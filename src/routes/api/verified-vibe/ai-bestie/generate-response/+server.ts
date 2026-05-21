import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getClaudeClient, CLAUDE_MODEL } from '$lib/claude';

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

		const client = getClaudeClient();

		const message = await client.messages.create({
			model: CLAUDE_MODEL,
			max_tokens: 400,
			messages: [
				{
					role: 'user',
					content: `You are AI Bestie — a sharp, no-nonsense dating coach helping a woman interview and evaluate a male match named ${matchName}.${preferencesContext}

${matchName} just said: "${adrianMessage}"

Evaluate his response and produce exactly three fields in this JSON format:
{
  "signal": "🚩" | "⚠️" | "✅",
  "read": "One or two sentences explaining what his response reveals about his intent, values, or character — evaluated as a potential partner.",
  "suggestedQuestion": "A single, direct follow-up question to probe further or establish clarity. Written in the woman's voice, ready to send."
}

Signal guide:
- ✅ Positive — shows genuine interest, honesty, or compatibility
- ⚠️ Caution — vague, evasive, or worth pressing on
- 🚩 Red flag — entitlement, dishonesty, inconsistency, or a deal-breaker pattern

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
