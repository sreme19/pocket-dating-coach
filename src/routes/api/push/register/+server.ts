import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSupabase } from '$lib/server/supabase';
import type { PushPlatform } from '$lib/push-notifications';

/**
 * POST /api/push/register
 * Register or update a device push notification token for the authenticated user.
 *
 * Accepts { token, platform } payload; derives userId from the Bearer token.
 * Upserts the token (replaces existing for same userId + platform combination).
 */
export const POST: RequestHandler = async ({ request }) => {
	// Validate authentication via Bearer token
	const authHeader = request.headers.get('authorization') ?? '';
	const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
	if (!bearerToken) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const { createClient } = await import('@supabase/supabase-js');
	const { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } = await import('$env/static/public');
	const userClient = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
		global: { headers: { Authorization: `Bearer ${bearerToken}` } }
	});

	const { data: { user }, error: authErr } = await userClient.auth.getUser();
	if (authErr || !user?.id) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const userId = user.id;

	// Parse request body
	let body: { token?: unknown; platform?: unknown };
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON in request body' }, { status: 400 });
	}

	// Validate token
	if (!body.token || typeof body.token !== 'string' || body.token.trim() === '') {
		return json({ error: 'token is required and must be a non-empty string' }, { status: 400 });
	}
	if (body.token.length > 256) {
		return json({ error: 'token must not exceed 256 characters' }, { status: 400 });
	}

	// Validate platform
	const validPlatforms: PushPlatform[] = ['android', 'ios'];
	if (!body.platform || typeof body.platform !== 'string' || !validPlatforms.includes(body.platform as PushPlatform)) {
		return json({ error: 'platform is required and must be "android" or "ios"' }, { status: 400 });
	}

	const token = body.token.trim();
	const platform = body.platform as PushPlatform;

	try {
		const supabase = getSupabase();
		const { error } = await supabase
			.from('device_tokens')
			.upsert(
				{ user_id: userId, token, platform, created_at: new Date().toISOString() },
				{ onConflict: 'user_id,platform' }
			);

		if (error) {
			console.error('POST /api/push/register DB error:', error);
			return json({ error: 'Failed to register device token' }, { status: 500 });
		}

		return json({ success: true }, { status: 200 });
	} catch (err) {
		console.error('POST /api/push/register:', err);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
