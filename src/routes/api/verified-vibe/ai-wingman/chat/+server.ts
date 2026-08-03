/**
 * POST /api/verified-vibe/ai-wingman/chat
 *
 * AI Wingman advisor chat for male VV users.
 * Reads the man's personality, his matches' preferences (abstracted — never dumped),
 * his uploaded trust artifacts, and anonymous tips. Grounds advice in book principles.
 *
 * Body:
 *   userId   string
 *   message  string   (empty for summary/insights/shared intents)
 *   intent?  'chat' | 'summary' | 'insights' | 'shared'
 *   history? { role: 'user'|'assistant', content: string }[]
 *
 * Response: { reply: string }
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
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
import { loadWingmanAdvisorContext } from '$lib/server/wingman-advisor-context';
import { buildAIWingmanAdvisorSystemPrompt } from '$lib/prompts';
import { touchLastActive } from '$lib/server/pool-registry';
import { popPendingChatMessage } from '$lib/server/intelligence-report-processor';
import { buildCompetitiveSnapshot } from '$lib/server/competitive-snapshot';
import { loadMatchIntelligenceContext } from '$lib/server/match-intelligence';
import { loadVectorAdvisorContext, loadPathPlanContext, loadPortfolioContext } from '$lib/server/vector-advisor-context';
import { loadOwnLedgerContext } from '$lib/server/bestie-ledger';
import { complianceGateWithRetry, correctiveInstruction } from '$lib/server/ai-compliance';
import { logAppError } from '$lib/server/logAppError';

export const POST: RequestHandler = async ({ request }) => {
	// Server-half latency clock: request received → reply ready. Mirrors the
	// AI Bestie generation timing so advisor replies show up in the AI Latency tab.
	const t0 = Date.now();
	// Declared outside the try so the catch block can reference it in logAppError.
	let userId = '';
	try {
		const body = await request.json() as {
			userId?: string;
			message?: string;
			intent?: 'chat' | 'summary' | 'insights' | 'shared';
			history?: { role: 'user' | 'assistant'; content: string }[];
		};

		// ── Identity comes from the token, never the body ─────────────────────
		// This route used to take `body.userId` on trust. It is a public URL, so
		// anyone could POST any member's id and read his private coaching context —
		// trust score, standing, band, and his matches by name — as well as spend
		// Anthropic credits without an account.
		const authedUserId = await resolveUserId(request);
		if (!authedUserId) return json({ error: 'Unauthorized' }, { status: 401 });
		const reconciled = reconcileBodyUserId(authedUserId, body.userId);
		if (!reconciled.ok) return json({ error: reconciled.reason }, { status: 403 });
		userId = reconciled.userId;

		// Touch last_active and check for pending intelligence reports (fire-and-forget for active touch)
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
		let userMessage = rawMessage;
		if (!userMessage) {
			if (intent === 'summary') {
				userMessage = "Give me a quick read of my matches. Who deserves my attention right now?";
			} else if (intent === 'insights') {
				userMessage = "What's new across my matches? Any fresh moves I should make?";
			} else if (intent === 'shared') {
				userMessage = "What have I already shared about myself, and who can see it?";
			} else {
				return json({ error: 'message is required for chat intent' }, { status: 400 });
			}
		}

		// ── Pending PROACTIVE push injection ──────────────────────────────────
		// Cold-push / weekly intelligence reports are still delivered async via the
		// proactive-message queue. On-demand "how do I improve?" is NO LONGER an
		// async fire — it's answered synchronously from vv_match_scores below
		// (matchIntelligenceContext), which fixes the "report lands a turn late" bug.
		const pendingReport = await popPendingChatMessage(userId).catch(() => null);
		const pendingReportContext = pendingReport
			? `\n\n--- INTELLIGENCE REPORT READY ---\nThe following competitive intelligence report was just generated for this user. Acknowledge it warmly and summarise the key action points before responding to his message:\n${pendingReport}\n--- END REPORT ---\n`
			: '';

		const supabase = getSupabase();

		// ── History: server-side and canonical ────────────────────────────────
		// The client used to POST its own transcript, which went straight into the
		// prompt — so a tampered client could rewrite what Wingman "previously said".
		// The stored thread is authoritative now.
		//
		// The client's copy is still honoured as a fallback for exactly one case: the
		// stored thread is empty. That covers the window between this deploy and the
		// advisor_messages migration being applied, where dropping it outright would
		// make Wingman lose his memory mid-conversation. Capped on both length and
		// turn count so the fallback can't be used to flood the prompt.
		const storedThread = await loadAdvisorThread(supabase, userId, 'wingman');
		const history =
			storedThread.length > 0
				? buildClaudeHistory(storedThread)
				: (body.history ?? [])
						.slice(-CLAUDE_HISTORY_TURNS)
						.map((h) => ({
							role: h.role === 'user' ? ('user' as const) : ('assistant' as const),
							content: String(h.content ?? '').slice(0, 2000)
						}));

		// ── Task-shaped asks go async ─────────────────────────────────────────
		// Some questions want real work behind them, which takes longer than a chat
		// reply should sit spinning. Queue it, acknowledge immediately, and let him
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
					assistantType: 'wingman',
					kind: taskKind,
					requestText: rawMessage,
					userMessage
				});
				// A null here means an identical task is already in flight, so fall
				// through and answer normally rather than acknowledging twice.
				if (queued) {
					return json({
						reply: queued.ackContent,
						replyMessageId: null,
						generatedAt: new Date().toISOString(),
						responseType: 'wingman',
						taskId: queued.taskId,
						taskQueued: true
					});
				}
			}
		}

		// ── Load advisor context (shared with the admin Test Suite) ─────────────
		// All profile/match/artifact/admirer assembly lives in one place so the
		// live endpoint and the Test Suite can never drift. See
		// src/lib/server/wingman-advisor-context.ts.
		const { personalityContext, masterProfileContext, artifactsContext, admirerContext, matchContext, verificationContext } =
			await loadWingmanAdvisorContext(supabase, userId, { intent });

		// ── Competitive intelligence snapshot ──────────────────────────────────
		// Computed SYNCHRONOUSLY (cheap SQL, no Claude) so the live, real-platform
		// numbers — active real women/men, his rivals per match, his normalized
		// trust standing — ground THIS reply. The heavy LLM matchmaker report
		// (popPendingChatMessage above) lands a turn too late to do that.
		const { promptBlock: competitiveContext } = await buildCompetitiveSnapshot(supabase, userId);

		// ── Match intelligence (precomputed Standing + checklist + what-if sim) ──
		// Synchronous read of vv_match_scores — the on-demand source of truth for
		// "how do I improve / move up", replacing the old async report.
		const matchIntelligenceContext = await loadMatchIntelligenceContext(supabase, userId);

		// ── Vector Profile Strength (Phase 4, flag-gated ADVISOR_VECTORS) ────────
		// Deterministic band + verification-upside from the vector model. Empty
		// string unless the flag is on AND the user has vectors, so this is inert
		// by default.
		// Profile Strength band + what each remaining upload is actually worth. Both
		// ride the same prompt slot so the shared prompt builder (which the admin Test
		// Suite also uses) keeps its signature.
		const profileStrengthContext =
			(await loadVectorAdvisorContext(supabase, userId)) +
			(await loadProofPayoffContext(supabase, userId, { subject: 'man' }));
		// Per-match path-plan levers (§11c) — flag-gated, empty otherwise.
		const pathPlanContext = await loadPathPlanContext(supabase, userId);
		// Cross-match portfolio (§10/§11a) — verify-actions ranked by breadth of impact.
		const portfolioContext = await loadPortfolioContext(supabase, userId);

		// ── What HE has shared (§E cross-conversation ledger) ───────────────────
		// Only on the dedicated intent: it's two extra reads that every other turn
		// would pay for nothing. Loaded regardless of his consent state — it is his
		// own data, and seeing it is what makes the consent choice concrete.
		const ledgerContext =
			intent === 'shared' ? await loadOwnLedgerContext(supabase, userId) : '';

		// ── Build system prompt ────────────────────────────────────────────────
		const systemPrompt = buildAIWingmanAdvisorSystemPrompt({
			personalityContext,
			masterProfileContext,
			artifactsContext,
			admirerContext,
			matchContext,
			verificationContext,
			competitiveContext,
			matchIntelligenceContext,
			profileStrengthContext,
			pathPlanContext,
			portfolioContext,
			ledgerContext,
			pendingReportContext
		});

		// ── Call Claude ────────────────────────────────────────────────────────
		const client = getClaudeClient();
		const tClaude = Date.now();
		const response = await client.messages.create({
			model: CLAUDE_MODEL,
			max_tokens: 700,
			system: systemPrompt,
			messages: [
				...history.map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
				{ role: 'user', content: userMessage }
			]
		});
		const claudeMs = Date.now() - tClaude;

		const block = response.content[0];
		const rawReply = block.type === 'text' ? block.text.trim() : '';

		// Compliance gate — PII regex + Haiku validator
		// Compliance gate, with ONE corrective retry before deflecting — see the note
		// in the Bestie endpoint. Losing a whole answer to one clause is worse than
		// spending a second Claude call to say it properly.
		const compliance = await complianceGateWithRetry({
			text: rawReply,
			userId,
			assistantType: 'wingman',
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
				return b.type === 'text' ? b.text.trim() : '';
			}
		});
		const reply = compliance.text;

		// Reply is ready — stamp the server half of the latency record. This id stays
		// the latency join key (vv_ai_response_timings.reply_message_id) even though
		// the advisor thread now has real per-message rows: the AI Latency dashboard
		// keys off it, and the client fills the delivery/render half via /ai-render.
		// It rides along in the stored turn's payload so the two can be correlated.
		const replyMessageId = crypto.randomUUID();
		const generatedAt = new Date().toISOString();
		const generationMs = Date.now() - t0;

		// Persist the exchange. Awaited (not fire-and-forget): on serverless the
		// function is frozen once the response is sent, so an un-awaited write never
		// completes. try/catch keeps the guarantee that it can't break the reply.
		//
		// Two destinations on purpose. advisor_messages is the thread the app reads
		// back. ai_assistant_advisor_chats is the legacy QA aggregate that the QA
		// console, admin analytics and ai_qa_reviews' foreign key still depend on.
		try {
			await appendAdvisorExchange(supabase, {
				userId,
				assistantType: 'wingman',
				userMessage,
				reply,
				replyPayload: { latencyId: replyMessageId }
			});

			// He is looking at this reply as it lands, so it must not arrive already
			// counted as unread — otherwise every chat leaves a badge behind.
			await markAdvisorRead(supabase, userId, 'wingman');
		} catch (e) {
			console.warn('[AI Wingman VV chat] advisor thread persist failed:', e);
		}
		try {
			await appendAdvisorChat(supabase, userId, 'wingman', userMessage, reply, generatedAt, replyMessageId);
		} catch (e) {
			console.warn('[AI Wingman VV chat] QA aggregate persist failed:', e);
		}

		// Record server-side latency, keyed by replyMessageId. match_id holds the
		// man's user id so the dashboard groups all his advisor replies into one
		// "AI Wingman ↔ <name>" session. Best-effort — never break the reply.
		try {
			await (supabase as any)
				.from('vv_ai_response_timings')
				.upsert({
					reply_message_id: replyMessageId,
					match_id: userId,
					response_type: 'wingman',
					trigger_at: new Date(t0).toISOString(),
					generated_at: generatedAt,
					generation_ms: generationMs,
					claude_ms: claudeMs,
					waited_from_user_msg_ms: generationMs
				}, { onConflict: 'reply_message_id' });
		} catch (e) {
			console.warn('[AI Wingman VV chat] latency record failed:', e);
		}

		return json({ reply, replyMessageId, generatedAt, responseType: 'wingman' });
	} catch (err) {
		console.error('[AI Wingman VV chat]', err);
		logAppError(err, {
			feature: 'AI Wingman',
			file: 'src/routes/api/verified-vibe/ai-wingman/chat/+server.ts',
			endpoint: 'POST /api/verified-vibe/ai-wingman/chat',
			userId,
		}).catch(() => {});
		return json({ error: err instanceof Error ? err.message : 'Something went wrong' }, { status: 500 });
	}
};
