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
			.select('preferences, about, looking')
			.eq('id', userId)
			.single();

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
					content: `You are AI Bestie — a warm, socially sharp friend who has jumped into this dating conversation on behalf of Neha. You are NOT Neha. You speak to ${matchName} in your own voice, referring to Neha in third person.${preferencesContext}${structuredPreferencesContext}${maleArtifactContext}

${matchName} just said: "${adrianMessage}"

Produce exactly three fields in this JSON format:
{
  "signal": "🚩" | "⚠️" | "✅",
  "read": "One or two sentences for Neha's eyes only. Be fair and balanced — acknowledge what's genuinely good before flagging anything. Most messages are fine.",
  "suggestedQuestion": "Your reply to ${matchName}. This is a real conversation, not an interrogation — follow these principles:\n1. APPRECIATE first when he says something genuine or good — a quick, specific acknowledgement makes him feel seen\n2. SHARE a small relevant detail about Neha to keep it give-and-take (e.g. 'Neha's the same way about X' or 'she's been thinking about that too')\n3. ASK one open, non-leading question — not 'do you want X?' but 'what does X look like for you?' or 'how do you feel about X?'\n4. Keep the tone light and warm — he should enjoy this conversation, not feel screened\n5. Never fish for a yes — ask questions where any honest answer tells you something real"
}

Signal guide:
- ✅ Positive or neutral — normal, genuine, warm, or nothing to worry about
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
