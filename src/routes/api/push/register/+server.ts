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
 * POST /api/push/register
 * Register or update a device push notification token for the authenticated user.
 *
 * Accepts { token, platform } payload; derives userId from the authenticated session.
 * Upserts the token (replaces existing for same userId + platform combination).
 *
 * Requirements: 5.3, 5.4, 5.5
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	// Validate authentication
	const session = await locals.auth.getSession();
	if (!session?.user?.id) {
		throwAuthenticationError('User authentication required');
	}

	const userId = session.user.id;

	// Parse request body
	let body: { token?: unknown; platform?: unknown };
	try {
		body = await request.json();
	} catch {
		throwValidationError('Invalid JSON in request body');
	}

	// Validate token
	if (!body.token || typeof body.token !== 'string' || body.token.trim() === '') {
		throwValidationError('token is required and must be a non-empty string');
	}

	if (body.token.length > 256) {
		throwValidationError('token must not exceed 256 characters');
	}

	// Validate platform — accepts both 'android' and 'ios' for cross-platform support (Req 10.3)
	const validPlatforms: PushPlatform[] = ['android', 'ios'];
	if (!body.platform || typeof body.platform !== 'string' || !validPlatforms.includes(body.platform as PushPlatform)) {
		throwValidationError('platform is required and must be "android" or "ios"');
	}

	const token = body.token.trim();
	const platform: PushPlatform = body.platform as PushPlatform;

	try {
		const supabase = getSupabase();

		// Upsert token: replace existing for same userId + platform
		const { error } = await supabase
			.from('device_tokens')
			.upsert(
				{
					user_id: userId,
					token,
					platform,
					created_at: new Date().toISOString()
				},
				{
					onConflict: 'user_id,platform'
				}
			);

		if (error) {
			throwDatabaseError('POST /api/push/register', error, 'Failed to register device token');
		}

		return json({ success: true }, { status: 200 });
	} catch (err) {
		// Re-throw SvelteKit errors (from throwDatabaseError etc.)
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}

		logError('POST /api/push/register', err, ErrorType.INTERNAL_ERROR, { userId });
		throwDatabaseError('POST /api/push/register', err, 'Failed to register device token');
	}
};
