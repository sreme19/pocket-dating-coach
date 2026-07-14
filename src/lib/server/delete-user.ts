/**
 * Canonical "purge a user" routine, shared by the user-facing account-deletion
 * endpoint and the admin dashboard's delete-user action so the two can never
 * drift apart.
 *
 * Deletion order:
 *   1. Delete the verified_vibe_users row — cascades to every verified_vibe_*
 *      table, user_master_profile, pool registries, artifacts, tips, etc.
 *   2. Delete the Supabase auth user — cascades to auth.users-keyed tables
 *      (ai_assistant_*, device_tokens) and removes the login itself.
 *
 * Note: verified_vibe_users.id holds the same UUID as auth.users.id but is not
 * an FK to it, so both deletes are required for a full wipe.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type PurgeResult =
	| { ok: true }
	| { ok: false; stage: 'profile' | 'auth'; message: string };

/**
 * Delete a user's application data and auth login. Must be called with the
 * service-role client (getSupabase()) so it can bypass RLS and use the auth
 * admin API.
 */
export async function purgeUser(db: SupabaseClient<any>, userId: string): Promise<PurgeResult> {
	// 1. Delete the app profile row — cascades to all verified_vibe_* data.
	const { error: profileErr } = await db.from('verified_vibe_users').delete().eq('id', userId);
	if (profileErr) {
		console.error('purgeUser: failed to delete profile row:', profileErr);
		return { ok: false, stage: 'profile', message: 'Failed to delete account data.' };
	}

	// 2. Delete the auth user — cascades to auth.users-keyed tables and the login.
	const { error: authErr } = await db.auth.admin.deleteUser(userId);
	if (authErr) {
		console.error('purgeUser: failed to delete auth user:', authErr);
		return {
			ok: false,
			stage: 'auth',
			message: 'Data was deleted but the login could not be fully removed.'
		};
	}

	return { ok: true };
}
