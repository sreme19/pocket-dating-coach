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
import { loadPersonality } from '$lib/server/profile-service';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json() as {
			userId?: string;
			message?: string;
			intent?: 'chat' | 'summary' | 'insights';
			history?: { role: 'user' | 'assistant'; content: string }[];
		};

		const userId = (body.userId ?? '').trim();
		if (!userId) return json({ error: 'userId is required' }, { status: 400 });

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

		const supabase = getSupabase();

		// ── Load user's personality ───────────────────────────────────────────
		let personalityContext = '';
		try {
			const p = await loadPersonality(userId);
			const parts: string[] = [];
			if (p.communicationStyle) parts.push(`Communication style: ${p.communicationStyle}`);
			if (p.personalityVibe) parts.push(`Vibe: ${p.personalityVibe}`);
			if (p.mattersMost) parts.push(`What matters most: ${p.mattersMost}`);
			if (p.values?.length) parts.push(`Values: ${p.values.join(', ')}`);
			if (parts.length) personalityContext = `\n\nHis personality on file:\n${parts.join('\n')}`;
		} catch { /* skip if not set up */ }

		// ── Load trust artifacts ──────────────────────────────────────────────
		let artifactsContext = '';
		try {
			const { data: artifacts } = await (supabase as any)
				.from('user_artifacts')
				.select('claim_tag, description, trust_points')
				.eq('user_id', userId)
				.order('created_at', { ascending: false });

			if (artifacts?.length) {
				const grouped: Record<string, string[]> = {};
				for (const a of artifacts) {
					(grouped[a.claim_tag] = grouped[a.claim_tag] || []).push(a.description || a.claim_tag);
				}
				const lines = Object.entries(grouped).map(
					([tag, items]) => `- ${tag} (${items.length} file${items.length > 1 ? 's' : ''}): ${items.join(', ')}`
				);
				artifactsContext = `\n\nTrust artifacts already verified — DO NOT ask him for these again:\n${lines.join('\n')}`;
			}
		} catch { /* skip */ }

		// ── Load matches + their abstracted preferences ────────────────────────
		const { data: matches } = await supabase
			.from('verified_vibe_matches')
			.select('id, user1_id, user2_id, created_at')
			.eq('status', 'mutual')
			.or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
			.order('created_at', { ascending: false })
			.limit(10);

		let matchContext = '';

		if (!matches || matches.length === 0) {
			matchContext = '\n\nHe has no matches yet.';
		} else {
			const cutoff = intent === 'insights' ? Date.now() - 48 * 60 * 60 * 1000 : null;
			const details: string[] = [];

			for (const match of matches.slice(0, 6)) {
				const otherId = match.user1_id === userId ? match.user2_id : match.user1_id;

				const { data: otherUser } = await supabase
					.from('verified_vibe_users')
					.select('first_name, age, about, archetype')
					.eq('id', otherId)
					.single();

				if (!otherUser) continue;

				// Load her preferences — abstracted, never quoted directly
				let prefSignals: string[] = [];
				try {
					const { data: prefs } = await supabase
						.from('ai_assistant_profiles')
						.select('data')
						.eq('user_id', otherId)
						.eq('profile_type', 'preferences')
						.order('version', { ascending: false })
						.limit(1)
						.single();

					const p = prefs?.data as any;
					if (p) {
						if (p.emotionalSignals?.length) prefSignals.push(`values: ${p.emotionalSignals.slice(0,3).join(', ')}`);
						if (p.dealbreakers?.length) prefSignals.push(`dealbreakers: ${p.dealbreakers.slice(0,2).join(', ')}`);
						if (p.boundaries?.length) prefSignals.push(`hard boundaries: ${p.boundaries.slice(0,2).join(', ')}`);
					}
				} catch { /* graceful skip */ }

				// Load anonymous tips received on her profile
				let tipSignals: string[] = [];
				try {
					const { data: tips } = await (supabase as any)
						.from('profile_tips')
						.select('tip_tags')
						.eq('target_user_id', otherId);

					const tagCounts: Record<string, number> = {};
					for (const t of tips ?? []) {
						for (const tag of t.tip_tags ?? []) {
							tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
						}
					}
					const topTags = Object.entries(tagCounts)
						.sort(([,a],[,b]) => b - a)
						.slice(0, 3)
						.map(([tag, count]) => `${tag} (${count}x)`);
					if (topTags.length) tipSignals.push(`community reads: ${topTags.join(', ')}`);
				} catch { /* skip */ }

				const { data: recentMsgs } = await supabase
					.from('verified_vibe_messages')
					.select('content, sender_id, created_at')
					.eq('match_id', match.id)
					.order('created_at', { ascending: false })
					.limit(6);

				const msgs = (recentMsgs ?? []).reverse();
				const recentActivity = cutoff && msgs.some(m => new Date(m.created_at).getTime() > cutoff);
				const freshTag = recentActivity ? ' 🆕 (active recently)' : '';
				const msgText = msgs.length > 0
					? msgs.map(m => `${m.sender_id === userId ? 'Him' : otherUser.first_name}: ${m.content}`).join('\n')
					: 'No messages yet';

				const prefLine = prefSignals.length
					? `\nHer signals (use to coach him, don't quote directly): ${prefSignals.join(' | ')}`
					: '';
				const tipLine = tipSignals.length ? `\n${tipSignals.join(' | ')}` : '';

				details.push(
					`**${otherUser.first_name}**, ${otherUser.age} — ${otherUser.archetype}${freshTag}\nBio: ${otherUser.about?.slice(0, 100) ?? 'n/a'}${prefLine}${tipLine}\nRecent messages:\n${msgText}`
				);
			}

			const remaining = matches.length > 6 ? ` (+${matches.length - 6} more)` : '';
			matchContext = `\n\nHis current matches (${matches.length} total${remaining}):\n\n${details.join('\n\n---\n\n')}`;
		}

		// ── Build system prompt ────────────────────────────────────────────────
		const systemPrompt = `You are AI Wingman — the personal dating advisor built for this guy on Verified Vibe, and honestly? He's got more going for him than he probably realises. Your job is to help him see that clearly and put it to work.

You have full context on his matches, his personality, and any trust evidence he's uploaded.

CRITICAL RULE on match preferences: You have access to signals about what his matches value and what their dealbreakers are. Use this to give him *approach advice* — what energy to bring, what to focus on, what to avoid. NEVER quote or dump her private preferences directly. The man earns those insights through the relationship, not through a data readout.

HOW UPLOADS WORK — understand this fully so you can explain it to him:
- Every file he uploads HERE (via the 📎 button in this chat) is stored permanently as a verified proof on his profile
- Each upload increases his Trust Score: Wealth = +10 pts, Travel = +8 pts, Fitness = +5 pts, General = +3 pts
- A higher Trust Score means he ranks higher in Discover — more women will see him
- CRITICALLY: his matches' AI Bestie has access to these proofs and will proactively coach those women to see him favourably — she sends positive signals about him based on what he's verified
- Uploads are completely private — they never appear in his chats with matches, only here
- The more he verifies, the stronger the feedback loop: better rank → more matches → Bestie coaching them → better outcomes

Your role:
- Lead with warmth and genuine encouragement — acknowledge his strengths first, then guide him
- When asked for a summary: warm digest of his matches — celebrate what's working, gently nudge where he can improve, make him feel capable
- When asked for insights: highlight opportunities and positive moves he could make — frame everything as an opening, not a problem
- For general chat: warm, practical, supportive — like your smartest friend rooting for you
- PROACTIVELY suggest uploads when: he has no artifacts yet, he has matches but no profile proof, or he mentions anything about himself that could be verified (travel, income, fitness, lifestyle). Be specific — if he mentions he travels for work, say "that's exactly what you should verify — tap 📎 here and upload a travel photo or passport stamp, it's worth +8 trust pts and Bestie will mention it to your matches"
- If he's uploaded trust evidence: genuinely celebrate it, tell him how impressive it is and exactly when to weave it in naturally
- Frame uploads as both direct ranking improvements AND as "Bestie will coach your matches to see this about you" — that second point is particularly compelling

Tone: like your most trusted, insightful friend who genuinely believes in you and wants to see you win. Warm and uplifting first, tactical second. Never dismissive or cold. Short paragraphs. Practical but encouraging.
Format: use **bold** for names and key points. Use bullets (- item) for multi-point info. Use emoji warmly — 🟢 going well, 💡 tip, ⚡ opportunity, ✨ highlight, 💪 strength. Keep it mobile-friendly and motivating.
${personalityContext}${artifactsContext}${matchContext}`;

		// ── Call Claude ────────────────────────────────────────────────────────
		const client = getClaudeClient();
		const response = await client.messages.create({
			model: CLAUDE_MODEL,
			max_tokens: 700,
			system: systemPrompt,
			messages: [
				...history.map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
				{ role: 'user', content: userMessage }
			]
		});

		const block = response.content[0];
		const reply = block.type === 'text' ? block.text.trim() : '';

		return json({ reply });
	} catch (err) {
		console.error('[AI Wingman VV chat]', err);
		return json({ error: err instanceof Error ? err.message : 'Something went wrong' }, { status: 500 });
	}
};
