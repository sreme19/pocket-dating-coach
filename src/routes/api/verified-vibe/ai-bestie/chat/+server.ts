import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getClaudeClient, CLAUDE_MODEL } from '$lib/claude';
import { getSupabase } from '$lib/server/supabase';
import { loadPreferences, updatePreferences } from '$lib/server/profile-service';
import type { PreferencesProfile } from '$lib/server/profile-service';
import { touchLastActive } from '$lib/server/pool-registry';
import { popPendingChatMessage } from '$lib/server/intelligence-report-processor';
import { queueIntelligenceReport } from '$lib/server/matchmaker-service';
import { processIntelligenceReport } from '$lib/server/intelligence-report-processor';
import { complianceGate } from '$lib/server/ai-compliance';

const INTELLIGENCE_INTENTS_FEMALE = [
  'how can i improve', 'how do i improve', 'how to improve',
  'better matches', 'get better matches', 'attract better',
  'high value men', 'high-value men', 'quality men',
  'improve my profile', 'stand out', 'compete',
  'how am i doing', 'my ranking', 'how do i rank',
  'what should i work on', 'what can i do better',
  'beat other women', 'get his attention', 'get noticed',
];

function detectsFemaleIntelligenceIntent(message: string): boolean {
  const lower = message.toLowerCase();
  return INTELLIGENCE_INTENTS_FEMALE.some((phrase) => lower.includes(phrase));
}

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

		// Touch last_active
		touchLastActive(userId).catch(() => {});

		// ── Resolve the actual user's first name ─────────────────────────────
		const supabaseForName = getSupabase();
		const { data: userRow } = await (supabaseForName as any)
			.from('verified_vibe_users')
			.select('first_name')
			.eq('id', userId)
			.single();
		const userName: string = userRow?.first_name || 'her';

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

		// ── Intelligence intent detection ─────────────────────────────────────
		if (detectsFemaleIntelligenceIntent(userMessage)) {
			const reportId = await queueIntelligenceReport(userId, 'female_competitive', 'user_driven');
			processIntelligenceReport(reportId).catch(() => {});
		}

		// ── Pending report injection ──────────────────────────────────────────
		const pendingReport = await popPendingChatMessage(userId).catch(() => null);
		const pendingReportContext = pendingReport
			? `\n\n--- INTELLIGENCE REPORT READY ---\nThe following competitive intelligence report was just generated for this user. Acknowledge it warmly, summarise the key action points as her bestie would, then respond to her message:\n${pendingReport}\n--- END REPORT ---\n`
			: '';

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
			if (parts.length) prefsContext = `\n\n${userName}'s preferences:\n${parts.join('\n')}`;
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
		const nameToMatchId: Record<string, string> = {};

		if (!matches || matches.length === 0) {
			matchContext = `\n\n${userName} has no matches yet.`;
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

				// Track name → match ID for draft resolution
				nameToMatchId[otherUser.first_name.toLowerCase()] = match.id;

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
								.map((m) => `${m.sender_id === userId ? userName : otherUser.first_name}: ${m.content}`)
								.join('\n')
						: 'No messages yet';

				// Load match's trust artifacts — proactively signal verified lifestyle claims
				let artifactLine = '';
				try {
					const { data: artifacts } = await (supabase as any)
						.from('user_artifacts')
						.select('claim_tag, trust_points')
						.eq('user_id', otherUserId);

					if (artifacts?.length) {
						const tagCounts: Record<string, number> = {};
						for (const a of artifacts) {
							tagCounts[a.claim_tag] = (tagCounts[a.claim_tag] ?? 0) + 1;
						}
						const parts = Object.entries(tagCounts).map(
							([tag, count]) => `${tag}${count > 1 ? ` (×${count})` : ''}`
						);
						artifactLine = `\nVerified lifestyle proofs uploaded: ${parts.join(', ')}`;
					}
				} catch { /* skip */ }

				const freshTag = recentActivity ? ' 🆕 (active in last 48h)' : '';
				details.push(
					`**${otherUser.first_name}**, ${otherUser.age}${freshTag}\nBio: ${otherUser.about?.slice(0, 120) ?? 'n/a'}${artifactLine}\nRecent messages:\n${msgText}`
				);
			}

			const remaining = matches.length > 6 ? ` (+${matches.length - 6} more)` : '';
			matchContext = `\n\n${userName}'s current matches (${matches.length} total${remaining}):\n\n${details.join('\n\n---\n\n')}`;
		}

		// ── Build system prompt ───────────────────────────────────────────────
		const systemPrompt = `You are AI Bestie — ${userName}'s warm, perceptive personal dating advisor on Verified Vibe.

You are NOT a chatbot. You are her trusted girlfriend who happens to be great at reading people. You have full context on her matches, their preferences, and any lifestyle proofs they've uploaded.

HOW THE THREE AI AGENTS WORK TOGETHER — know this so you can explain it clearly when she asks:
- AI Matchmaker runs behind the scenes — she decides which profiles appear in Discover, ranked by compatibility and Trust Score. She doesn't talk to users directly.
- AI Bestie (you) = her private advisor in this chat.
- AI Wingman = the private advisor living in each man's chat, helping him with strategy and uploads.
- When she lands on a man's profile, you have already seen his verified proofs and will proactively coach her about him — framing him accurately based on what he has verified.
- The verification loop: the more a man uploads (lifestyle proofs via the 📎 button in his Wingman chat), the higher the Matchmaker ranks him → she sees him in Discover → you coach her with real context about him → better decisions for her.
- She can also upload proofs in her own Bestie chat (📎) — these go on her profile so the Matchmaker ranks her higher and Wingman coaches her matches about her.
- Uploads are completely private — never visible in the other person's direct chat — only the AI agents and the Matchmaker see them.
- You can give her competitive intelligence: how many verified men match her criteria, who stands out, where she sits in the pool.

Your role:
- Give ${userName} honest, balanced, actionable advice about her matches
- Lead with what is going well before flagging concerns — most people are normal and decent
- When asked for a summary: produce a crisp digest — who has good energy, who's worth more time, any genuine concerns
- When asked for insights: only flag things that are meaningfully new or worth acting on (no generic filler)
- For general chat: answer directly, warmly, with zero fluff
- Save real concern for real red flags — do not manufacture drama where there is none
- If she asks to configure or update your focus: tell her she can do that from Settings → AI Bestie, or by going to her Profile page and tapping "Configure"
- TRUST PROOFS: If a match has uploaded verified lifestyle proofs (travel, wealth, fitness etc.), mention this naturally and positively — it shows he's intentional and has real substance. Weave it in warmly, e.g. "He's actually taken the time to verify his travel lifestyle — that kind of follow-through says something." Never make it sound like a data readout.

Tone: like texting your warmest, most grounded girlfriend. Encouraging and real. Short paragraphs. Occasional light humour. Never preachy. Never paranoid. Never generic.
Format: use **bold** for names and key points. Use bullet lists (- item) for multi-point info. Use emoji sparingly but meaningfully — e.g. 🟢 good sign, 🔴 concern, 💡 tip, 💬 on their messages, ✨ highlight, 💛 warm note. Keep it mobile-friendly and easy to scan.

PREFERENCE DETECTION: If ${userName} explicitly states a preference, rule, or boundary in her message — e.g. "block guys who…", "I don't want men who…", "that's a dealbreaker for me", "I prefer someone who…" — embed a structured marker at the very end of your reply:
- [PREF:dealbreaker:description] for dealbreakers (things that disqualify a match)
- [PREF:boundary:description] for hard limits or personal rules
- [PREF:signal:description] for green/red flags she values or watches for
- [PREF:note:description] for private compatibility notes
Keep values concise (max 80 chars). Multiple markers are fine. Only add a marker when she explicitly states a preference — never when you're inferring. Place all markers on a new line after your reply, with no explanation.

DRAFT MESSAGES: When ${userName} explicitly asks you to draft a message to send to a specific match, or when she approves a suggested message and says she wants to send it — wrap the final send-ready message text in:
[DRAFT:MatchFirstName]
message text here
[/DRAFT]
Use this ONLY for finalized messages Neha has confirmed she wants to send — not for examples, suggestions, or openers you're proposing. One [DRAFT] block per match. Place draft blocks after your reply text, each on its own line. Use the exact first name as shown in the match list above.
${prefsContext}${matchContext}${pendingReportContext}`;

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
		const compliance = await complianceGate({ text: strippedReply, userId, assistantType: 'bestie' });
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

		return json({ reply, userMessage, prefsUpdated: detectedPrefs.length > 0, drafts });
	} catch (err) {
		console.error('[AI Bestie chat]', err);
		return json(
			{ error: err instanceof Error ? err.message : 'Something went wrong' },
			{ status: 500 }
		);
	}
};
