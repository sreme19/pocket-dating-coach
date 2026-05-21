import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { switchAssistant } from '$lib/server/session-state-manager';
import { loadSessionState } from '$lib/server/session-state-manager';
import type { AssistantType } from '$lib/types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { userId, matchId, assistantType } = body;

		if (!userId || !matchId || !assistantType) {
			throw error(400, 'userId, matchId, and assistantType are required');
		}

		if (assistantType !== 'bestie' && assistantType !== 'wingman') {
			throw error(400, 'assistantType must be "bestie" or "wingman"');
		}

		// Switch to the new assistant
		await switchAssistant(userId, matchId, assistantType as AssistantType);

		// Load updated session state
		const sessionState = await loadSessionState(userId, matchId);

		return json({
			success: true,
			activeAssistant: sessionState.activeAssistant,
			assistantConfig: sessionState.assistantConfig
		});
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}

		console.error('Error switching assistant:', err);
		throw error(500, 'Failed to switch assistant');
	}
};
