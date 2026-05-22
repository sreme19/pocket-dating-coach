import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getClaudeClient, CLAUDE_MODEL } from '$lib/claude';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { conversationId, matchName } = await request.json();

		if (!conversationId || !matchName) {
			return json({ error: 'Missing conversationId or matchName' }, { status: 400 });
		}

		const client = getClaudeClient();

		const message = await client.messages.create({
			model: CLAUDE_MODEL,
			max_tokens: 150,
			messages: [
				{
					role: 'user',
					content: `You are AI Bestie — a warm, savvy friend helping a woman start a conversation with a match named ${matchName}.

Generate a single opening message to kick things off. It should:
- Feel natural and friendly, not like an interrogation
- Gently invite him to share something real — a goal, a vibe, what he's been up to
- Be one or two sentences, written in a casual first-person voice, ready to send

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
