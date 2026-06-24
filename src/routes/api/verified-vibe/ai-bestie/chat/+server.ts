import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getClaudeClient, CLAUDE_MODEL } from '$lib/claude';
import { getSupabase } from '$lib/server/supabase';
import { appendAdvisorChat } from '$lib/server/advisor-chat';
import { logAppError } from '$lib/server/logAppError';
import { loadPreferences, updatePreferences } from '$lib/server/profile-service';
import type { PreferencesProfile } from '$lib/server/profile-service';
import { touchLastActive } from '$lib/server/pool-registry';
import { popPendingChatMessage } from '$lib/server/intelligence-report-processor';
import { loadBestieAdvisorContext } from '$lib/server/bestie-advisor-context';
import { buildCompetitiveSnapshot } from '$lib/server/competitive-snapshot';
import { loadMatchIntelligenceContext } from '$lib/server/match-intelligence';
import { buildAIBestieAdvisorSystemPrompt } from '$lib/prompts';
import { complianceGate } from '$lib/server/ai-compliance';

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
	try {
		// ── Parse body ────────────────────────────────────────────────────────
		const body = (await request.json()) as {
			userId?: string;
			message?: string;
			intent?: 'chat' | 'summary' | 'insights';
			history?: { role: 'user' | 'assistant'; content: string }[];
		};

		// ── Validate userId ───────────────────────────────────────────────────
		const userId = (body.userId ?? '').trim();
		if (!userId) {
			return json({ error: 'userId is required' }, { status: 400 });
		}

		// Touch last_active
		touchLastActive(userId).catch(() => {});

		const intent = body.intent ?? 'chat';
		const rawMessage = (body.message ?? '').trim();
		const history = body.history ?? [];

		const supabase = getSupabase();

		// ── Load advisor context (shared with the admin Test Suite) ─────────────
		// Name, preferences, and current matches (+ bios/messages/proofs) are all
		// assembled in one place so the live endpoint and the Test Suite can never
		// drift. See src/lib/server/bestie-advisor-context.ts.
		const { userName, prefsContext, matchContext, nameToMatchId } =
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

		// ── Build system prompt (shared builder) ──────────────────────────────
		const systemPrompt = buildAIBestieAdvisorSystemPrompt({
			userName,
			prefsContext,
			matchContext,
			competitiveContext,
			matchIntelligenceContext,
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
		const compliance = await complianceGate({ text: strippedReply, userId, assistantType: 'bestie', context: 'advisor' });
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

		// Persist the exchange server-side for QA review. Awaited (not fire-and-forget):
		// on serverless the function is frozen once the response is sent, so an un-awaited
		// write never completes. try/catch keeps the guarantee that it can't break the reply.
		try {
			await appendAdvisorChat(supabase, userId, 'bestie', userMessage, reply, new Date().toISOString());
		} catch (e) {
			console.warn('[AI Bestie chat] advisor persist failed:', e);
		}

		return json({ reply, userMessage, prefsUpdated: detectedPrefs.length > 0, drafts });
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
