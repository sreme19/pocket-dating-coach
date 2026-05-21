import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadSessionState } from '$lib/server/session-state-manager';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { userId, matchId } = body;

		if (!userId || !matchId) {
			throw error(400, 'userId and matchId are required');
		}

		const sessionState = await loadSessionState(userId, matchId);

		return json({
			activeAssistant: sessionState.activeAssistant,
			conversationHistory: sessionState.conversationHistory,
			assistantConfig: sessionState.assistantConfig,
			lastLoadedAt: sessionState.lastLoadedAt
		});
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}

		console.error('Error loading session state:', err);
		throw error(500, 'Failed to load session state');
	}
};
