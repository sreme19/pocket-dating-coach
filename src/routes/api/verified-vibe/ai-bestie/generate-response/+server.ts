import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getClaudeClient, CLAUDE_MODEL } from '$lib/claude';
import { loadPreferences } from '$lib/server/profile-service';
import type { PreferencesProfile } from '$lib/server/profile-service';

function formatStructuredPreferences(prefs: PreferencesProfile): string {
	const lines: string[] = ['\nHer known preferences:'];

	if (prefs.emotionalSignals.length > 0) {
		lines.push(`- Emotional signals she values: ${prefs.emotionalSignals.join(', ')}`);
	}
	if (prefs.lifestyleSignals.length > 0) {
		lines.push(`- Lifestyle signals she values: ${prefs.lifestyleSignals.join(', ')}`);
	}
	if (prefs.maturitySignals.length > 0) {
		lines.push(`- Maturity signals she values: ${prefs.maturitySignals.join(', ')}`);
	}
	if (prefs.boundaries.length > 0) {
		lines.push(`- Her firm boundaries: ${prefs.boundaries.join(', ')}`);
	}
	if (prefs.dealbreakers.length > 0) {
		lines.push(`- Her dealbreakers (absolute no-gos): ${prefs.dealbreakers.join(', ')}`);
	}
	if (prefs.privateCompatibilityNotes.length > 0) {
		lines.push(`- Private notes: ${prefs.privateCompatibilityNotes.join(', ')}`);
	}

	return lines.join('\n');
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { conversationId, adrianMessage, matchName, userId } = await request.json();

		if (!conversationId || !adrianMessage || !matchName || !userId) {
			return json({ error: 'Missing required fields' }, { status: 400 });
		}

		const { getSupabase } = await import('$lib/server/supabase');
		const supabase = getSupabase();

		// Fetch the user's preferences
		const { data: user, error: userError } = await supabase
			.from('verified_vibe_users')
			.select('first_name, preferences, about, looking')
			.eq('id', userId)
			.single();

		const userName: string = (user as any)?.first_name || 'her';

		// Resolve the male match's user ID from the conversation (match row)
		// so we can load any trust artifacts he has uploaded
		let maleArtifactContext = '';
		try {
			const { data: matchRow } = await supabase
				.from('verified_vibe_matches')
				.select('user1_id, user2_id')
				.eq('id', conversationId)
				.single();

			if (matchRow) {
				const maleUserId = matchRow.user1_id === userId ? matchRow.user2_id : matchRow.user1_id;
				const { data: artifacts } = await (supabase as any)
					.from('user_artifacts')
					.select('claim_tag, trust_points')
					.eq('user_id', maleUserId);

				if (artifacts?.length) {
					const tagCounts: Record<string, number> = {};
					for (const a of artifacts) {
						tagCounts[a.claim_tag] = (tagCounts[a.claim_tag] ?? 0) + 1;
					}
					const parts = Object.entries(tagCounts).map(
						([tag, count]) => `${tag}${count > 1 ? ` (×${count})` : ''}`
					);
					maleArtifactContext = `\n\n${matchName} has uploaded verified proofs: ${parts.join(', ')}. These were submitted privately — he's taken intentional steps to back up his profile. Acknowledge this positively in your read/coaching when relevant.`;
				}
			}
		} catch { /* non-critical */ }

		if (userError) {
			console.error('Error fetching user preferences:', userError);
		}

		// Build preferences context for Claude
		let preferencesContext = '';
		if (user) {
			const prefs = user.preferences || {};
			const aboutText = user.about ? `\nAbout her: ${user.about}` : '';
			const lookingText = user.looking ? `\nLooking for: ${user.looking}` : '';
			const prefsText = Object.keys(prefs).length > 0
				? `\nHer preferences: ${JSON.stringify(prefs, null, 2)}`
				: '';
			preferencesContext = aboutText + lookingText + prefsText;
		}

		// Load structured preferences and append to context if non-empty
		let structuredPreferencesContext = '';
		try {
			const structuredPrefs = await loadPreferences(userId);
			if (
				structuredPrefs.emotionalSignals.length > 0 ||
				structuredPrefs.dealbreakers.length > 0 ||
				structuredPrefs.boundaries.length > 0
			) {
				structuredPreferencesContext = formatStructuredPreferences(structuredPrefs);
			}
		} catch (err) {
			console.error('Failed to load structured preferences, falling back to raw context:', err);
		}

		const client = getClaudeClient();

		const message = await client.messages.create({
			model: CLAUDE_MODEL,
			max_tokens: 400,
			messages: [
				{
					role: 'user',
					content: `You are ghostwriting a reply for ${userName} in her dating conversation with ${matchName}. Write entirely in ${userName}'s voice — first person, natural, like she typed it herself. ${matchName} must never know anyone else is involved.${preferencesContext}${structuredPreferencesContext}${maleArtifactContext}

HARD RULES — never break these:
- Never mention AI, a bestie, a friend, a helper, gatekeeping, vetting, wingman, or any third party
- Never refer to ${userName} in third person ("she", "${userName}'s")
- Never reveal or hint that someone else is writing on her behalf
- If ${matchName} mentions "AI bestie", "bestie", or asks who is chatting — respond naturally as ${userName}: acknowledge it simply and move the conversation forward warmly (e.g. "haha yeah sorry about that earlier mix-up! it's just me now 😊 anyway...")
- Do NOT dwell on or re-litigate the AI topic — one casual acknowledgement, then pivot
- Write as if ${userName} is relaxed, curious, and enjoying the conversation

${matchName} just said: "${adrianMessage}"

Produce exactly three fields in this JSON format:
{
  "signal": "🚩" | "⚠️" | "✅",
  "read": "One or two sentences for ${userName}'s eyes only (never shown to ${matchName}). Be fair and balanced — acknowledge what's genuinely good before flagging anything. Most messages are fine.",
  "suggestedQuestion": "The reply to send as ${userName}. Write in first person. Principles:\n1. APPRECIATE something genuine he said — a quick, specific acknowledgement makes him feel seen\n2. SHARE a small personal detail in ${userName}'s voice to keep it give-and-take\n3. ASK one open question — 'what does X look like for you?' not 'do you want X?'\n4. Keep it light and warm — 1-3 sentences, conversational\n5. Never fish for a yes — ask questions where any honest answer tells you something real"
}

Signal guide:
- ✅ Positive or neutral — normal, genuine, warm, nothing to worry about
- ⚠️ Something specific is vague, inconsistent, or worth a gentle follow-up
- 🚩 Clear entitlement, dishonesty, disrespect, or a confirmed dealbreaker

Default to ✅. Reserve ⚠️ and 🚩 for things that would genuinely concern a real friend.

Return only the JSON object. No extra text.`
				}
			]
		});

		const content = message.content[0];
		if (content.type !== 'text') {
			throw new Error('Unexpected response type from Claude');
		}

		let parsed: { signal: string; read: string; suggestedQuestion: string };
		try {
			const raw = content.text.trim().replace(/^```json\s*/i, '').replace(/```$/,'');
			parsed = JSON.parse(raw);
		} catch {
			throw new Error('Claude returned invalid JSON');
		}

		return json(parsed);
	} catch (error) {
		console.error('Error generating AI Bestie response:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Failed to generate response' },
			{ status: 500 }
		);
	}
};
