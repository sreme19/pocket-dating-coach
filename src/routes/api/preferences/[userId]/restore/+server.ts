import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSupabase } from '$lib/server/supabase';
import {
	loadPreferences,
	getPreferencesHistory,
	restoreProfileVersion,
	type PreferencesProfile
} from '$lib/server/profile-service';
import {
	throwAuthenticationError,
	throwValidationError,
	throwDatabaseError,
	logError,
	ErrorType
} from '$lib/server/error-handler';

/**
 * POST /api/preferences/:userId/restore
 * Restore a previous version of the preferences profile
 * 
 * Request body:
 * {
 *   "versionId": "uuid of the version to restore"
 * }
 * 
 * Requirements: 8.1, 12.1, 12.2, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
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

	// Users can only restore their own preferences
	if (session.user.id !== userId) {
		throwAuthenticationError('You can only restore your own preferences');
	}

	// Parse and validate request body
	let body: { versionId: string };

	try {
		body = await request.json();
	} catch (err) {
		logError('POST /api/preferences/:userId/restore', err, ErrorType.VALIDATION_ERROR);
		throwValidationError('Invalid JSON in request body');
	}

	// Validate required fields
	if (!body.versionId || typeof body.versionId !== 'string') {
		throwValidationError('versionId field is required and must be a string');
	}

	try {
		// Verify the version exists and belongs to this user
		const history = await getPreferencesHistory(userId);
		const versionExists = history.some(v => v.id === body.versionId);

		if (!versionExists) {
			throwValidationError('Version not found for this user');
		}

		// Restore the version
		await restoreProfileVersion(userId, body.versionId);

		// Load the restored preferences
		const restoredPreferences = await loadPreferences(userId);

		// Get updated version history to return the new version number
		const updatedHistory = await getPreferencesHistory(userId);
		const latestVersion = updatedHistory.length > 0 ? updatedHistory[0].version : 1;

		return json({
			success: true,
			message: `Preferences profile restored to version ${body.versionId}`,
			data: restoredPreferences,
			version: latestVersion,
			restoredAt: Date.now()
		});
	} catch (err) {
		if (err instanceof Error && err.message.includes('Version not found')) {
			logError('POST /api/preferences/:userId/restore', err, ErrorType.VALIDATION_ERROR, {
				userId,
				versionId: body.versionId
			});
			throwValidationError(err.message);
		}

		logError('POST /api/preferences/:userId/restore', err, ErrorType.DATABASE_ERROR, {
			userId,
			versionId: body.versionId
		});

		throwDatabaseError(
			'POST /api/preferences/:userId/restore',
			err,
			'Failed to restore preferences version'
		);
	}
};
