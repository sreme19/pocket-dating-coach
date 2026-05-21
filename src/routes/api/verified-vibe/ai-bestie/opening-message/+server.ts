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
					content: `You are AI Bestie — a sharp dating coach helping a woman open an interview-style conversation with a male match named ${matchName}.

Generate a single opening question to kick off the conversation. It should:
- Be warm but purposeful — this is an evaluation, not small talk
- Invite him to reveal something about his values, goals, or lifestyle
- Be one sentence, written in the woman's voice, ready to send

Return only the question. No extra text.`
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
