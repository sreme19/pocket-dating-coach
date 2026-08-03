import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getClaudeClient, CLAUDE_MODEL } from '$lib/claude';
import { getSupabase } from '$lib/server/supabase';
import { appendAdvisorChat } from '$lib/server/advisor-chat';
import {
	appendAdvisorExchange,
	loadAdvisorThread,
	buildClaudeHistory,
	markAdvisorRead,
	CLAUDE_HISTORY_TURNS
} from '$lib/server/advisor-thread';
import { detectTaskIntent, createAdvisorTask } from '$lib/server/advisor-tasks';
import { resolveUserId, reconcileBodyUserId } from '$lib/server/require-user';
import { loadProofPayoffContext } from '$lib/server/proof-payoff';
import { logAppError } from '$lib/server/logAppError';
import { loadPreferences, updatePreferences } from '$lib/server/profile-service';
import type { PreferencesProfile } from '$lib/server/profile-service';
import { touchLastActive } from '$lib/server/pool-registry';
import { popPendingChatMessage } from '$lib/server/intelligence-report-processor';
import { loadBestieAdvisorContext } from '$lib/server/bestie-advisor-context';
import { buildCompetitiveSnapshot } from '$lib/server/competitive-snapshot';
import { loadMatchIntelligenceContext } from '$lib/server/match-intelligence';
import { loadVectorAdvisorContext, loadUnlockRecommendations, loadPursuitPlanContext } from '$lib/server/vector-advisor-context';
import { buildAIBestieAdvisorSystemPrompt } from '$lib/prompts';
import { complianceGateWithRetry, correctiveInstruction } from '$lib/server/ai-compliance';

/**
 * POST /api/verified-vibe/ai-bestie/chat
 *
 * AI Bestie advisor chat endpoint. Neha can:
 *   - Chat freely with her bestie for tips
 *   - Request a digest of all matches (intent: 'summary')
 *   - Request fresh proactive insights (intent: 'insights')
 *
 * The preferences/match context and the system prompt are assembled by the
 * SHARED helpers (loadBestieAdvisorContext + buildAIBestieAdvisorSystemPrompt)
 * so this live path and the admin Test Suite can never drift — the mirror of
 * what the AI Wingman advisor does on the male side.
 *
 * Auth: userId passed in request body (consistent with VV AI Bestie endpoints pattern —
 *       see /api/verified-vibe/ai-bestie/generate-response). The getSupabaseClient()
 *       singleton may not have the session in all navigation contexts, so we accept
 *       the userId directly and trust it for intra-VV requests.
 *
 * Body:
 * {
 *   userId: string                // VV user ID (Supabase auth UUID)
 *   message: string               // free-form message from Neha (can be empty for summary/insights)
 *   intent?: 'chat' | 'summary' | 'insights'   // default: 'chat'
 *   history?: { role: 'user'|'assistant', content: string }[]
 * }
 *
 * Response: { reply: string }
 */
export const POST: RequestHandler = async ({ request }) => {
	// Declared outside the try so the catch block can reference it in logAppError.
	let userId = '';
	try {
		// ── Parse body ────────────────────────────────────────────────────────
		const body = (await request.json()) as {
			userId?: string;
			message?: string;
			intent?: 'chat' | 'summary' | 'insights';
			history?: { role: 'user' | 'assistant'; content: string }[];
		};

		// ── Identity comes from the token, never the body ─────────────────────
		// This route used to take `body.userId` on trust. It is a public URL, so
		// anyone could POST any member's id and read her private coaching context —
		// trust score, standing, band, and her matches by name — as well as spend
		// Anthropic credits without an account.
		const authedUserId = await resolveUserId(request);
		if (!authedUserId) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}
		const reconciled = reconcileBodyUserId(authedUserId, body.userId);
		if (!reconciled.ok) {
			return json({ error: reconciled.reason }, { status: 403 });
		}
		userId = reconciled.userId;

		// Touch last_active
		touchLastActive(userId).catch(() => {});

		const intent = body.intent ?? 'chat';
		const rawMessage = (body.message ?? '').trim();
		// Cap advisor question length: a single coaching question never needs more
		// than ~1k chars. Rejecting longer input limits token flooding / prompt
		// injection through the advisor surface (the message is interpolated into
		// the system prompt downstream).
		if (rawMessage.length > 1000) {
			return json({ error: 'Message exceeds maximum length of 1000 characters' }, { status: 400 });
		}
		const supabase = getSupabase();

		// ── History: server-side and canonical ────────────────────────────────
		// The client used to POST its own transcript, which went straight into the
		// prompt — so a tampered client could rewrite what Bestie "previously said".
		// The stored thread is authoritative now.
		//
		// The client's copy is still honoured as a fallback for exactly one case: the
		// stored thread is empty. That covers the window between this deploy and the
		// advisor_messages migration being applied, where dropping it outright would
		// make Bestie lose her memory mid-conversation. Capped on both length and
		// turn count so the fallback can't be used to flood the prompt.
		const storedThread = await loadAdvisorThread(supabase, userId, 'bestie');
		const history =
			storedThread.length > 0
				? buildClaudeHistory(storedThread)
				: (body.history ?? [])
						.slice(-CLAUDE_HISTORY_TURNS)
						.map((h) => ({
							role: h.role === 'user' ? ('user' as const) : ('assistant' as const),
							content: String(h.content ?? '').slice(0, 2000)
						}));

		// ── Load advisor context (shared with the admin Test Suite) ─────────────
		// Name, preferences, and current matches (+ bios/messages/proofs) are all
		// assembled in one place so the live endpoint and the Test Suite can never
		// drift. See src/lib/server/bestie-advisor-context.ts.
		const { userName, prefsContext, matchContext, verificationContext, nameToMatchId } =
			await loadBestieAdvisorContext(supabase, userId, { intent });

		// ── Resolve the user message based on intent ──────────────────────────
		let userMessage = rawMessage;
		if (!userMessage) {
			if (intent === 'summary') {
				userMessage =
					"Give me a quick digest of all my matches. Who's worth my time right now and why?";
			} else if (intent === 'insights') {
				userMessage =
					"What's new across my matches? Any fresh things I should pay attention to?";
			} else {
				return json({ error: 'message is required for chat intent' }, { status: 400 });
			}
		}

		// ── Task-shaped asks go async ─────────────────────────────────────────
		// Some questions want real work behind them, which takes longer than a chat
		// reply should sit spinning. Queue it, acknowledge immediately, and let her
		// close the app — the sweeper writes the answer back into this thread and
		// pushes when it lands.
		//
		// Only free-form messages qualify: the quick-action chips are answered
		// synchronously from precomputed data and are already fast.
		if (rawMessage) {
			const taskKind = detectTaskIntent(rawMessage);
			if (taskKind) {
				const queued = await createAdvisorTask(supabase, {
					userId,
					assistantType: 'bestie',
					kind: taskKind,
					requestText: rawMessage,
					userMessage
				});
				// A null here means an identical task is already in flight, so fall
				// through and answer normally rather than acknowledging twice.
				if (queued) {
					return json({
						reply: queued.ackContent,
						userMessage,
						prefsUpdated: false,
						drafts: [],
						taskId: queued.taskId,
						taskQueued: true
					});
				}
			}
		}

		// ── Pending PROACTIVE push injection ──────────────────────────────────
		// Cold-push / weekly reports still arrive async via the proactive queue.
		// On-demand "how do I improve?" is answered synchronously from
		// vv_match_scores below (matchIntelligenceContext) — no turn-late report.
		const pendingReport = await popPendingChatMessage(userId).catch(() => null);
		const pendingReportContext = pendingReport
			? `\n\n--- INTELLIGENCE REPORT READY ---\nThe following competitive intelligence report was just generated for this user. Acknowledge it warmly, summarise the key action points as her bestie would, then respond to her message:\n${pendingReport}\n--- END REPORT ---\n`
			: '';

		// ── Competitive intelligence snapshot ──────────────────────────────────
		// Computed SYNCHRONOUSLY (cheap SQL, no Claude) so the live, real-platform
		// numbers — active real men (her options), her female competition, her
		// rivals per match, and her normalized trust standing — ground THIS reply.
		const { promptBlock: competitiveContext } = await buildCompetitiveSnapshot(supabase, userId);

		// ── Match intelligence (precomputed Standing + checklist + what-if sim) ──
		// Synchronous read of vv_match_scores — the on-demand source of truth for
		// "how do I improve / move up", replacing the old async report.
		const matchIntelligenceContext = await loadMatchIntelligenceContext(supabase, userId);

		// ── Vector Profile Strength (Phase 4, flag-gated) — her own self-coaching ──
		// Profile Strength band + what each remaining upload is actually worth. Both
		// ride the same prompt slot so the shared prompt builder (which the admin Test
		// Suite also uses) keeps its signature.
		const profileStrengthContext =
			(await loadVectorAdvisorContext(supabase, userId, { subject: 'woman' })) +
			(await loadProofPayoffContext(supabase, userId, { subject: 'woman' }));
		// ── Consent-unlock recommendations — matched men who cleared the bar (§11d) ──
		const unlockContext = await loadUnlockRecommendations(supabase, userId);
		// ── Targeted-pursuit path plan — how she raises her appeal to a man (§11i) ──
		const pursuitContext = await loadPursuitPlanContext(supabase, userId);

		// ── Build system prompt (shared builder) ──────────────────────────────
		const systemPrompt = buildAIBestieAdvisorSystemPrompt({
			userName,
			prefsContext,
			matchContext,
			verificationContext,
			competitiveContext,
			matchIntelligenceContext,
			profileStrengthContext,
			unlockContext,
			pursuitContext,
			pendingReportContext
		});

		// ── Call Claude ───────────────────────────────────────────────────────
		const client = getClaudeClient();
		const response = await client.messages.create({
			model: CLAUDE_MODEL,
			max_tokens: 700,
			system: systemPrompt,
			messages: [
				...history.map((h) => ({
					role: h.role as 'user' | 'assistant',
					content: h.content
				})),
				{ role: 'user', content: userMessage }
			]
		});

		const block = response.content[0];
		const rawReply = block.type === 'text' ? block.text.trim() : '';

		// ── Parse and save preference markers ────────────────────────────────
		const PREF_REGEX = /\[PREF:(dealbreaker|boundary|signal|note):([^\]]+)\]/g;
		const detectedPrefs: { type: string; value: string }[] = [];
		let m: RegExpExecArray | null;
		while ((m = PREF_REGEX.exec(rawReply)) !== null) {
			detectedPrefs.push({ type: m[1], value: m[2].trim() });
		}

		// ── Parse DRAFT markers ───────────────────────────────────────────────
		const DRAFT_REGEX = /\[DRAFT:([^\]]+)\]([\s\S]*?)\[\/DRAFT\]/g;
		const drafts: { matchName: string; matchId: string; content: string }[] = [];
		let dm: RegExpExecArray | null;
		while ((dm = DRAFT_REGEX.exec(rawReply)) !== null) {
			const matchName = dm[1].trim();
			const content = dm[2].trim();
			const matchId = nameToMatchId[matchName.toLowerCase()];
			if (matchId && content) drafts.push({ matchName, matchId, content });
		}

		// Strip both marker types from the visible reply
		const strippedReply = rawReply
			.replace(/\[PREF:[^\]]+\]/g, '')
			.replace(/\[DRAFT:[^\]]+\][\s\S]*?\[\/DRAFT\]/g, '')
			.trim();

		// Compliance gate — PII regex + Haiku validator
		// Compliance gate, with ONE corrective retry before deflecting. A blocked
		// reply used to be replaced wholesale by SAFE_FALLBACK, so a single borderline
		// clause cost her the entire briefing — which is exactly what happened on a
		// hand-off "Review" tap in production.
		const compliance = await complianceGateWithRetry({
			text: strippedReply,
			userId,
			assistantType: 'bestie',
			context: 'advisor',
			regenerate: async (violations) => {
				const retry = await client.messages.create({
					model: CLAUDE_MODEL,
					max_tokens: 700,
					system: systemPrompt + correctiveInstruction(violations),
					messages: [
						...history.map((h) => ({ role: h.role as 'user' | 'assistant', content: h.content })),
						{ role: 'user', content: userMessage }
					]
				});
				const b = retry.content[0];
				const t = b.type === 'text' ? b.text.trim() : '';
				// Strip the same markers the first pass strips, or they leak to her.
				return t
					.replace(/\[PREF:[^\]]+\]/g, '')
					.replace(/\[DRAFT:[^\]]+\][\s\S]*?\[\/DRAFT\]/g, '')
					.trim();
			}
		});
		const reply = compliance.text;

		if (detectedPrefs.length > 0) {
			try {
				const currentPrefs = await loadPreferences(userId);
				const updates: Partial<PreferencesProfile> = {};
				for (const { type, value } of detectedPrefs) {
					if (type === 'dealbreaker') {
						updates.dealbreakers = [...new Set([...currentPrefs.dealbreakers, value])];
					} else if (type === 'boundary') {
						updates.boundaries = [...new Set([...currentPrefs.boundaries, value])];
					} else if (type === 'signal') {
						updates.emotionalSignals = [...new Set([...currentPrefs.emotionalSignals, value])];
					} else if (type === 'note') {
						updates.privateCompatibilityNotes = [
							...new Set([...currentPrefs.privateCompatibilityNotes, value])
						];
					}
				}
				await updatePreferences(
					userId,
					updates,
					`AI Bestie chat detected ${detectedPrefs.length} preference(s)`
				);
			} catch (err) {
				console.warn('[AI Bestie] failed to save preferences:', err);
			}
		}

		// Persist the exchange. Awaited (not fire-and-forget): on serverless the
		// function is frozen once the response is sent, so an un-awaited write never
		// completes. try/catch keeps the guarantee that it can't break the reply.
		//
		// Two destinations on purpose. advisor_messages is the thread the app reads
		// back. ai_assistant_advisor_chats is the legacy QA aggregate that the QA
		// console, admin analytics and ai_qa_reviews' foreign key still depend on.
		let replyMessageId: string | null = null;
		try {
			const { replyTurn } = await appendAdvisorExchange(supabase, {
				userId,
				assistantType: 'bestie',
				userMessage,
				reply,
				replyPayload: drafts.length > 0 ? { drafts } : null
			});
			replyMessageId = replyTurn?.id ?? null;

			// She is looking at this reply as it lands, so it must not arrive already
			// counted as unread — otherwise every chat leaves a badge behind.
			await markAdvisorRead(supabase, userId, 'bestie');
		} catch (e) {
			console.warn('[AI Bestie chat] advisor thread persist failed:', e);
		}
		try {
			await appendAdvisorChat(supabase, userId, 'bestie', userMessage, reply, new Date().toISOString());
		} catch (e) {
			console.warn('[AI Bestie chat] QA aggregate persist failed:', e);
		}

		return json({
			reply,
			userMessage,
			prefsUpdated: detectedPrefs.length > 0,
			drafts,
			messageId: replyMessageId
		});
	} catch (err) {
		console.error('[AI Bestie chat]', err);
		logAppError(err, {
			feature: 'AI Bestie',
			file: 'src/routes/api/verified-vibe/ai-bestie/chat/+server.ts',
			endpoint: 'POST /api/verified-vibe/ai-bestie/chat',
			userId,
		}).catch(() => {});
		return json(
			{ error: err instanceof Error ? err.message : 'Something went wrong' },
			{ status: 500 }
		);
	}
};
