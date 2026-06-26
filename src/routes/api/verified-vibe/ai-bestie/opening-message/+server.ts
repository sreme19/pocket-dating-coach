import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getClaudeClient, CLAUDE_MODEL } from '$lib/claude';
import { stripBannedDashes } from '$lib/prompts';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { conversationId, matchName, ownerName } = await request.json();

		if (!conversationId || !matchName) {
			return json({ error: 'Missing conversationId or matchName' }, { status: 400 });
		}

		const owner = ownerName || 'her';
		const client = getClaudeClient();

		// NOTE: the LIVE first Bestie message comes from the responder
		// (buildBestieReplyPrompt, isOpener path) — this proactive opener is
		// currently disabled in the chat page. Phrasing kept ally-toned here so it
		// can't reintroduce the "screening/filtering" framing if re-enabled.
		const message = await client.messages.create({
			model: CLAUDE_MODEL,
			max_tokens: 150,
			messages: [
				{
					role: 'user',
					content: `You are ${owner}'s AI Bestie, reaching out to her match ${matchName} ON HER BEHALF. You are NOT ${owner}. You are her bestie: on his side, here to help this match go well and bring ${owner} in once they're clicking.

Generate a single opening message to kick things off. It should:
- Briefly introduce yourself as ${owner}'s bestie (warm and honest about who you are), there to help this match get off to a great start
- Refer to ${owner} in the third person, by name. Never write as if you are her
- Sound like a real person texting: casual, warm, a little playful. Contractions, short sentences, no formal greetings
- Open the door for him to say something real, without firing a list of questions at him. One light question at most
- NEVER frame yourself as screening, filtering, vetting, or ranking him, and never imply he's one of many being filtered. You're his ally, rooting for this to work
- Be one or two sentences, ready to send
- Never use the em dash "—" or en dash "–". Use a comma or a period instead

Return only the message. No extra text.`
				}
			]
		});

		const content = message.content[0];
		if (content.type !== 'text') {
			throw new Error('Unexpected response type from Claude');
		}

		return json({ message: stripBannedDashes(content.text.trim()) });
	} catch (error) {
		console.error('Error generating opening message:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Failed to generate opening message' },
			{ status: 500 }
		);
	}
};
