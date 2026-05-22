import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSupabase } from '$lib/server/supabase';
import type { PushPlatform } from '$lib/push-notifications';
import {
	throwAuthenticationError,
	throwValidationError,
	throwDatabaseError,
	logError,
	ErrorType
} from '$lib/server/error-handler';

/**
 * DELETE /api/push/unregister
 * Remove a device token for the authenticated user and specified platform.
 * Used during logout to disassociate push notifications from the user.
 *
 * Request body: { platform: 'android' | 'ios' }
 *
 * Requirements: 4.10, 5.2
 */
export const DELETE: RequestHandler = async ({ request, locals }) => {
	// Validate authentication
	const session = await locals.auth.getSession();
	if (!session?.user?.id) {
		throwAuthenticationError('User authentication required');
	}

	const userId = session.user.id;

	// Parse and validate request body
	let body: { platform?: string };

	try {
		body = await request.json();
	} catch (err) {
		logError('DELETE /api/push/unregister', err, ErrorType.VALIDATION_ERROR);
		throwValidationError('Invalid JSON in request body');
	}

	// Validate platform field — accepts both 'android' and 'ios' (Req 10.3)
	const { platform } = body;

	if (!platform || typeof platform !== 'string') {
		throwValidationError('platform is required and must be a string');
	}

	const validPlatforms: PushPlatform[] = ['android', 'ios'];
	if (!validPlatforms.includes(platform as PushPlatform)) {
		throwValidationError('platform must be either "android" or "ios"');
	}

	try {
		// Delete the device token for this user and platform
		const { error: dbError } = await getSupabase()
			.from('device_tokens')
			.delete()
			.eq('user_id', userId)
			.eq('platform', platform);

		if (dbError) {
			throwDatabaseError(
				'DELETE /api/push/unregister',
				dbError,
				'Failed to remove device token'
			);
		}

		return json({
			success: true,
			message: 'Device token removed'
		});
	} catch (err) {
		// Re-throw SvelteKit errors (from throwDatabaseError etc.)
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}

		logError('DELETE /api/push/unregister', err, ErrorType.INTERNAL_ERROR, { userId, platform });
		throwDatabaseError(
			'DELETE /api/push/unregister',
			err,
			'Failed to remove device token'
		);
	}
};
