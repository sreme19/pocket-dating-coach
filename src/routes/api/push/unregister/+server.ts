import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSupabase } from '$lib/server/supabase';
import type { PushPlatform } from '$lib/push-notifications';

/**
 * DELETE /api/push/unregister
 * Remove a device token for the authenticated user and specified platform.
 * Used during logout to disassociate push notifications from the user.
 *
 * Request body: { platform: 'android' | 'ios' }
 */
export const DELETE: RequestHandler = async ({ request }) => {
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
	let body: { platform?: string };
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON in request body' }, { status: 400 });
	}

	const { platform } = body;
	if (!platform || typeof platform !== 'string') {
		return json({ error: 'platform is required and must be a string' }, { status: 400 });
	}

	const validPlatforms: PushPlatform[] = ['android', 'ios'];
	if (!validPlatforms.includes(platform as PushPlatform)) {
		return json({ error: 'platform must be either "android" or "ios"' }, { status: 400 });
	}

	try {
		const { error: dbError } = await getSupabase()
			.from('device_tokens')
			.delete()
			.eq('user_id', userId)
			.eq('platform', platform as PushPlatform);

		if (dbError) {
			console.error('DELETE /api/push/unregister DB error:', dbError);
			return json({ error: 'Failed to remove device token' }, { status: 500 });
		}

		return json({ success: true, message: 'Device token removed' });
	} catch (err) {
		console.error('DELETE /api/push/unregister:', err);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
