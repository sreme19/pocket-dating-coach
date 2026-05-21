import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSupabase } from '$lib/server/supabase';
import {
	getPreferencesHistory,
	type ProfileVersion
} from '$lib/server/profile-service';
import {
	throwAuthenticationError,
	throwValidationError,
	throwDatabaseError,
	logError,
	ErrorType
} from '$lib/server/error-handler';

/**
 * GET /api/preferences/:userId/history
 * Retrieve the version history of preferences profile changes
 * 
 * Requirements: 8.1, 12.1, 12.2, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	// Validate authentication
	const session = await locals.auth.getSession();
	if (!session?.user?.id) {
		throwAuthenticationError('User authentication required');
	}

	const userId = params.userId;

	// Validate userId parameter
	if (!userId || typeof userId !== 'string') {
		throwValidationError('userId parameter is required');
	}

	// Users can only access their own history
	if (session.user.id !== userId) {
		throwAuthenticationError('You can only access your own preferences history');
	}

	try {
		const history = await getPreferencesHistory(userId);

		return json({
			success: true,
			data: history,
			count: history.length
		});
	} catch (err) {
		logError('GET /api/preferences/:userId/history', err, ErrorType.DATABASE_ERROR, {
			userId
		});

		throwDatabaseError(
			'GET /api/preferences/:userId/history',
			err,
			'Failed to retrieve preferences history'
		);
	}
};
