import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getClaudeClient, CLAUDE_MODEL } from '$lib/claude';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { conversationId, matchName, ownerName } = await request.json();

		if (!conversationId || !matchName) {
			return json({ error: 'Missing conversationId or matchName' }, { status: 400 });
		}

		const owner = ownerName || 'her';
		const client = getClaudeClient();

		const message = await client.messages.create({
			model: CLAUDE_MODEL,
			max_tokens: 150,
			messages: [
				{
					role: 'user',
					content: `You are ${owner}'s AI Bestie, reaching out to her match ${matchName} ON HER BEHALF. You are NOT ${owner} — you are her bestie, helping her get to know matches before she jumps in herself.

Generate a single opening message to kick things off. It should:
- Briefly introduce yourself as ${owner}'s bestie (warm and honest about who you are), helping her get to know him first
- Refer to ${owner} in the third person, by name — never write as if you are her
- Gently invite him to share something real — a goal, a vibe, what he's been up to
- Be one or two sentences, in your own warm voice, ready to send
- Not feel like an interrogation

Return only the message. No extra text.`
				}
			]
		});

		const content = message.content[0];
		if (content.type !== 'text') {
			throw new Error('Unexpected response type from Claude');
		}

		return json({ message: content.text.trim() });
	} catch (error) {
		console.error('Error generating opening message:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Failed to generate opening message' },
			{ status: 500 }
		);
	}
};
