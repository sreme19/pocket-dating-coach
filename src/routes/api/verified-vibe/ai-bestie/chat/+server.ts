import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getClaudeClient, CLAUDE_MODEL } from '$lib/claude';
import { getSupabase } from '$lib/server/supabase';
import { loadPreferences } from '$lib/server/profile-service';

/**
 * POST /api/verified-vibe/ai-bestie/chat
 *
 * AI Bestie advisor chat endpoint. Neha can:
 *   - Chat freely with her bestie for tips
 *   - Request a digest of all matches (intent: 'summary')
 *   - Request fresh proactive insights (intent: 'insights')
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

		const intent = body.intent ?? 'chat';
		const rawMessage = (body.message ?? '').trim();
		const history = body.history ?? [];

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

		// ── Load preferences ─────────────────────────────────────────────────
		let prefsContext = '';
		try {
			const prefs = await loadPreferences(userId);
			const parts: string[] = [];
			if (prefs.dealbreakers.length)
				parts.push(`Dealbreakers: ${prefs.dealbreakers.join(', ')}`);
			if (prefs.emotionalSignals.length)
				parts.push(`Green flags she values: ${prefs.emotionalSignals.join(', ')}`);
			if (prefs.boundaries.length)
				parts.push(`Hard boundaries: ${prefs.boundaries.join(', ')}`);
			if (prefs.maturitySignals.length)
				parts.push(`Maturity signals she looks for: ${prefs.maturitySignals.join(', ')}`);
			if (prefs.privateCompatibilityNotes.length)
				parts.push(`Private notes: ${prefs.privateCompatibilityNotes.join(', ')}`);
			if (parts.length) prefsContext = `\n\nNeha's preferences:\n${parts.join('\n')}`;
		} catch {
			// gracefully skip if preferences not set up yet
		}

		// ── Fetch matches with recent messages ────────────────────────────────
		const supabase = getSupabase();

		const { data: matches } = await supabase
			.from('verified_vibe_matches')
			.select('id, user1_id, user2_id, created_at')
			.eq('status', 'mutual')
			.or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
			.order('created_at', { ascending: false })
			.limit(10);

		let matchContext = '';

		if (!matches || matches.length === 0) {
			matchContext = '\n\nNeha has no matches yet.';
		} else {
			const cutoff = intent === 'insights' ? Date.now() - 48 * 60 * 60 * 1000 : null;
			const details: string[] = [];

			for (const match of matches.slice(0, 6)) {
				const otherUserId = match.user1_id === userId ? match.user2_id : match.user1_id;

				const { data: otherUser } = await supabase
					.from('verified_vibe_users')
					.select('first_name, age, about')
					.eq('id', otherUserId)
					.single();

				if (!otherUser) continue;

				const { data: recentMsgs } = await supabase
					.from('verified_vibe_messages')
					.select('content, sender_id, created_at')
					.eq('match_id', match.id)
					.order('created_at', { ascending: false })
					.limit(6);

				const msgs = (recentMsgs ?? []).reverse();

				// For insights intent, flag matches with activity in the last 48 h
				const recentActivity =
					cutoff && msgs.some((m) => new Date(m.created_at).getTime() > cutoff);

				const msgText =
					msgs.length > 0
						? msgs
								.map((m) => `${m.sender_id === userId ? 'Neha' : otherUser.first_name}: ${m.content}`)
								.join('\n')
						: 'No messages yet';

				const freshTag = recentActivity ? ' 🆕 (active in last 48h)' : '';
				details.push(
					`**${otherUser.first_name}**, ${otherUser.age}${freshTag}\nBio: ${otherUser.about?.slice(0, 120) ?? 'n/a'}\nRecent messages:\n${msgText}`
				);
			}

			const remaining = matches.length > 6 ? ` (+${matches.length - 6} more)` : '';
			matchContext = `\n\nNeha's current matches (${matches.length} total${remaining}):\n\n${details.join('\n\n---\n\n')}`;
		}

		// ── Build system prompt ───────────────────────────────────────────────
		const systemPrompt = `You are AI Bestie — Neha's sharp, warm, no-nonsense personal dating advisor on Verified Vibe.

You are NOT a chatbot. You are her trusted girlfriend who happens to be a brilliant relationship strategist. You have full context on her matches and preferences.

Your role:
- Give Neha honest, specific, actionable advice about her matches
- When asked for a summary: produce a crisp digest — who's worth time, who's going cold, momentum shifts
- When asked for insights: only flag things that are meaningfully new or worth acting on (no generic filler)
- For general chat: answer directly, warmly, with zero fluff
- If she asks to configure or update your focus: tell her she can do that from Settings → AI Bestie, or by going to her Profile page and tapping "Configure"

Tone: like texting your smartest, most candid girlfriend. Short paragraphs. Occasional light humour. Never preachy. Never generic.
${prefsContext}${matchContext}`;

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
		const reply = block.type === 'text' ? block.text.trim() : '';

		return json({ reply, userMessage });
	} catch (err) {
		console.error('[AI Bestie chat]', err);
		return json(
			{ error: err instanceof Error ? err.message : 'Something went wrong' },
			{ status: 500 }
		);
	}
};
