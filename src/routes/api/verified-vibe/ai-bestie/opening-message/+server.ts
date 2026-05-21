import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getClaudeClient, CLAUDE_MODEL, MAX_TOKENS } from '$lib/claude';

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const { conversationId, matchName } = await request.json();

		if (!conversationId || !matchName) {
			return json({ error: 'Missing conversationId or matchName' }, { status: 400 });
		}

		const client = getClaudeClient();

		// Generate opening message from AI Bestie impersonating the female user
		const message = await client.messages.create({
			model: CLAUDE_MODEL,
			max_tokens: 150,
			messages: [
				{
					role: 'user',
					content: `You are an AI Bestie helping a woman continue a dating conversation. Generate a natural, engaging opening message to send to ${matchName}. The message should be from the woman's perspective, friendly and flirty but not too forward. Keep it short (1-2 sentences). Just provide the message, nothing else.`
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
		console.error('Error generating opening message:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Failed to generate opening message' },
			{ status: 500 }
		);
	}
};
