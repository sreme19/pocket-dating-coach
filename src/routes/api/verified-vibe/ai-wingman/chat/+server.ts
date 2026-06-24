/**
 * POST /api/verified-vibe/ai-wingman/chat
 *
 * AI Wingman advisor chat for male VV users.
 * Reads the man's personality, his matches' preferences (abstracted — never dumped),
 * his uploaded trust artifacts, and anonymous tips. Grounds advice in book principles.
 *
 * Body:
 *   userId   string
 *   message  string   (empty for summary/insights intents)
 *   intent?  'chat' | 'summary' | 'insights'
 *   history? { role: 'user'|'assistant', content: string }[]
 *
 * Response: { reply: string }
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getClaudeClient, CLAUDE_MODEL } from '$lib/claude';
import { getSupabase } from '$lib/server/supabase';
import { appendAdvisorChat } from '$lib/server/advisor-chat';
import { loadWingmanAdvisorContext } from '$lib/server/wingman-advisor-context';
import { buildAIWingmanAdvisorSystemPrompt } from '$lib/prompts';
import { touchLastActive } from '$lib/server/pool-registry';
import { popPendingChatMessage } from '$lib/server/intelligence-report-processor';
import { buildCompetitiveSnapshot } from '$lib/server/competitive-snapshot';
import { loadMatchIntelligenceContext } from '$lib/server/match-intelligence';
import { complianceGate } from '$lib/server/ai-compliance';
import { logAppError } from '$lib/server/logAppError';

export const POST: RequestHandler = async ({ request }) => {
	// Server-half latency clock: request received → reply ready. Mirrors the
	// AI Bestie generation timing so advisor replies show up in the AI Latency tab.
	const t0 = Date.now();
	try {
		const body = await request.json() as {
			userId?: string;
			message?: string;
			intent?: 'chat' | 'summary' | 'insights';
			history?: { role: 'user' | 'assistant'; content: string }[];
		};

		const userId = (body.userId ?? '').trim();
		if (!userId) return json({ error: 'userId is required' }, { status: 400 });

		// Touch last_active and check for pending intelligence reports (fire-and-forget for active touch)
		touchLastActive(userId).catch(() => {});

		const intent = body.intent ?? 'chat';
		const rawMessage = (body.message ?? '').trim();
		const history = body.history ?? [];

		let userMessage = rawMessage;
		if (!userMessage) {
			if (intent === 'summary') {
				userMessage = "Give me a quick read of my matches. Who deserves my attention right now?";
			} else if (intent === 'insights') {
				userMessage = "What's new across my matches? Any fresh moves I should make?";
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

		// ── Load advisor context (shared with the admin Test Suite) ─────────────
		// All profile/match/artifact/admirer assembly lives in one place so the
		// live endpoint and the Test Suite can never drift. See
		// src/lib/server/wingman-advisor-context.ts.
		const { personalityContext, masterProfileContext, artifactsContext, admirerContext, matchContext } =
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

		// ── Build system prompt ────────────────────────────────────────────────
		const systemPrompt = buildAIWingmanAdvisorSystemPrompt({
			personalityContext,
			masterProfileContext,
			artifactsContext,
			admirerContext,
			matchContext,
			competitiveContext,
			matchIntelligenceContext,
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
		const compliance = await complianceGate({ text: rawReply, userId, assistantType: 'wingman', context: 'advisor' });
		const reply = compliance.text;

		// Reply is ready — stamp the server half of the latency record. The advisor
		// chat keeps no per-message DB row, so we mint the join key here and hand it
		// back to the client, which fills the delivery/render half via /ai-render.
		const replyMessageId = crypto.randomUUID();
		const generatedAt = new Date().toISOString();
		const generationMs = Date.now() - t0;

		// Persist the exchange server-side for QA review. Awaited (not fire-and-forget):
		// on serverless the function is frozen once the response is sent, so an un-awaited
		// write never completes. try/catch keeps the guarantee that it can't break the reply.
		try {
			await appendAdvisorChat(supabase, userId, 'wingman', userMessage, reply, generatedAt, replyMessageId);
		} catch (e) {
			console.warn('[AI Wingman VV chat] advisor persist failed:', e);
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
