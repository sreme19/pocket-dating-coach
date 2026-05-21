import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getClaudeClient, CLAUDE_MODEL } from '$lib/claude';

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const { conversationId, adrianMessage, matchName } = await request.json();

		if (!conversationId || !adrianMessage || !matchName) {
			return json({ error: 'Missing required fields' }, { status: 400 });
		}

		const client = getClaudeClient();

		// Generate response from AI Bestie impersonating the female user
		const message = await client.messages.create({
			model: CLAUDE_MODEL,
			max_tokens: 200,
			messages: [
				{
					role: 'user',
					content: `You are an AI Bestie helping a woman respond to a dating message. ${matchName} just sent: "${adrianMessage}"

Generate a natural, engaging response from the woman's perspective. The response should be:
- Friendly and flirty but not too forward
- Authentic and conversational
- Keep it short (1-2 sentences)
- Show genuine interest in what he said

Just provide the response message, nothing else.`
				}
			]
		});

		const content = message.content[0];
		if (content.type !== 'text') {
			throw new Error('Unexpected response type from Claude');
		}

		return json({
			message: content.text
		});
	} catch (error) {
		console.error('Error generating response:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Failed to generate response' },
			{ status: 500 }
		);
	}
};
