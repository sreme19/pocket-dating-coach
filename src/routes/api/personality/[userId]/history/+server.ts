import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPersonalityHistory } from '$lib/server/profile-service';

/**
 * GET /api/personality/:userId/history
 * Retrieve version history for user's personality.md profile
 * 
 * Returns array of ProfileVersion objects with:
 * - id: version ID
 * - version: version number
 * - data: PersonalityProfile data
 * - reason: reason for update
 * - createdAt: timestamp
 * 
 * Requirements: 8.1, 12.1, 12.2
 */
export const GET: RequestHandler = async ({ params, request }) => {
	const userId = params.userId;

	// Validate userId parameter
	if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
		throw error(400, 'userId parameter is required');
	}

	// Validate user authentication
	const authHeader = request.headers.get('authorization');
	if (!authHeader) {
		throw error(401, 'Authorization header is required');
	}

	try {
		const history = await getPersonalityHistory(userId);

		return json({
			success: true,
			data: history,
			count: history.length
		});
	} catch (err) {
		console.error('[api/personality/history GET] Error loading history:', err);
		throw error(500, 'Failed to load personality history');
	}
};
