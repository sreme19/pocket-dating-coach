import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deactivateAssistant } from '$lib/server/ai-assistant-manager';
import { loadSessionState } from '$lib/server/session-state-manager';
import type { AssistantType } from '$lib/types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { userId, matchId } = body;

		if (!userId || !matchId) {
			throw error(400, 'userId and matchId are required');
		}

		// Get current session to find active assistant
		const sessionState = await loadSessionState(userId, matchId);

		if (!sessionState.activeAssistant) {
			return json({
				success: true,
				message: 'No active assistant to deactivate'
			});
		}

		// Deactivate the active assistant
		await deactivateAssistant(userId, matchId, sessionState.activeAssistant as AssistantType);

		// Load updated session state
		const updatedSessionState = await loadSessionState(userId, matchId);

		return json({
			success: true,
			activeAssistant: updatedSessionState.activeAssistant
		});
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}

		console.error('Error deactivating assistant:', err);
		throw error(500, 'Failed to deactivate assistant');
	}
};
