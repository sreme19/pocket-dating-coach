import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSupabase } from '$lib/server/supabase';
import { ADMIN_COOKIE, tokenIsValid } from '$lib/server/admin-auth';

export const POST: RequestHandler = async ({ params, cookies }) => {
	if (!tokenIsValid(cookies.get(ADMIN_COOKIE))) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const { userId } = params;
	const db = getSupabase() as any;

	// 1. Lift the auth ban
	const { error: banErr } = await db.auth.admin.updateUserById(userId, {
		ban_duration: 'none',
	} as any);
	if (banErr) {
		return json({ error: 'Failed to unban auth user: ' + banErr.message }, { status: 500 });
	}

	// 2. Clear soft-delete marker on the profile row
	await db
		.from('verified_vibe_users')
		.update({ deleted_at: null, deletion_reason: null })
		.eq('id', userId);

	// 3. Restore pool availability
	await db
		.from('vv_pool_profiles')
		.update({ availability_status: 'active', last_updated: new Date().toISOString() })
		.eq('user_id', userId);

	return json({ ok: true });
};
