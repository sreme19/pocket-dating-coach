import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { addMessageToHistory } from '$lib/server/session-state-manager';
import type { ChatMessage, AssistantType } from '$lib/types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { userId, matchId, assistantType, message } = body;

		if (!userId || !matchId || !assistantType || !message) {
			throw error(400, 'userId, matchId, assistantType, and message are required');
		}

		if (assistantType !== 'bestie' && assistantType !== 'wingman') {
			throw error(400, 'assistantType must be "bestie" or "wingman"');
		}

		// Validate message structure
		if (!message.id || !message.role || !message.content) {
			throw error(400, 'message must have id, role, and content');
		}

		// Add message to history
		await addMessageToHistory(userId, matchId, assistantType as AssistantType, message as ChatMessage);

		return json({
			success: true,
			message: 'Message added to history'
		});
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}

		console.error('Error adding message to history:', err);
		throw error(500, 'Failed to add message to history');
	}
};
