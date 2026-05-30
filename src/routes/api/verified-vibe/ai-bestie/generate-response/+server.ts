import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getClaudeClient, CLAUDE_MODEL } from '$lib/claude';
import { loadPreferences } from '$lib/server/profile-service';
import type { PreferencesProfile } from '$lib/server/profile-service';
import { buildBestieReplyPrompt } from '$lib/prompts';

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
		const { conversationId, adrianMessage, matchName, userId, history } = await request.json() as {
			conversationId?: string;
			adrianMessage?: string;
			matchName?: string;
			userId?: string;
			history?: Array<{ role: 'mekhala' | 'match'; fromBestie?: boolean; content: string }>;
		};

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

		// Build a readable transcript of the recent conversation so Bestie has full
		// context and never repeats a question or contradicts what was already said.
		let transcript = '';
		if (Array.isArray(history) && history.length > 0) {
			const lines = history.map((h) => {
				const speaker = h.role === 'mekhala' ? userName : matchName;
				return `${speaker}: ${h.content}`;
			});
			transcript = `\n\nCONVERSATION SO FAR (most recent last) — read carefully, do NOT repeat questions already asked or re-raise topics already settled:\n${lines.join('\n')}\n`;
		}

		const client = getClaudeClient();

		const message = await client.messages.create({
			model: CLAUDE_MODEL,
			max_tokens: 400,
			messages: [
				{
					role: 'user',
					content: buildBestieReplyPrompt({
						userName,
						matchName,
						contextBlock: `${preferencesContext}${structuredPreferencesContext}${maleArtifactContext}`,
						transcript,
						lastMessage: adrianMessage
					})
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
