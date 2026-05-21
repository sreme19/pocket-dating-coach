import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { restoreProfileVersion, loadPersonality, getPersonalityHistory } from '$lib/server/profile-service';

/**
 * POST /api/personality/:userId/restore/:versionId
 * Restore a previous version of user's personality.md profile
 * 
 * This creates a new version with the restored data, preserving the full version history.
 * 
 * Requirements: 8.1, 12.1, 12.2
 */
export const POST: RequestHandler = async ({ params, request }) => {
	const userId = params.userId;
	const versionId = params.versionId;

	// Validate parameters
	if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
		throw error(400, 'userId parameter is required');
	}

	if (!versionId || typeof versionId !== 'string' || versionId.trim().length === 0) {
		throw error(400, 'versionId parameter is required');
	}

	// Validate user authentication
	const authHeader = request.headers.get('authorization');
	if (!authHeader) {
		throw error(401, 'Authorization header is required');
	}

	try {
		// Restore the version
		await restoreProfileVersion(userId, versionId);

		// Load the restored personality
		const restoredPersonality = await loadPersonality(userId);

		// Get updated version history
		const history = await getPersonalityHistory(userId);
		const latestVersion = history.length > 0 ? history[0].version : 1;

		return json({
			success: true,
			message: `Personality profile restored to version ${versionId}`,
			data: restoredPersonality,
			version: latestVersion,
			restoredAt: Date.now()
		});
	} catch (err) {
		console.error('[api/personality/restore POST] Error restoring version:', err);

		// Check if error is due to version not found
		if (err instanceof Error && err.message.includes('Failed to find version')) {
			throw error(404, 'Version not found');
		}

		throw error(500, 'Failed to restore personality version');
	}
};
