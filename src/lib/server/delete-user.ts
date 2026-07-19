/**
 * Canonical "delete a user" routine, shared by the user-facing account-deletion
 * endpoint and the admin dashboard's delete-user action so the two can never
 * drift apart.
 *
 * Two modes:
 *
 *   SOFT (default, user-facing) — retain the data for product improvement.
 *     1. Stamp verified_vibe_users.deleted_at + deletion_reason (row is kept).
 *     2. Drop the user from the live pool (vv_pool_profiles.availability_status
 *        = 'deleted') so the matcher/discover never surface them again.
 *     3. BAN the auth login (do not delete it). The user can no longer sign in,
 *        and because auth.users survives, the ON DELETE CASCADE on ai_assistant_*
 *        never fires — bestie/wingman conversations are retained automatically.
 *     A day-90 scheduled job later anonymizes the retained row + purges photos.
 *
 *   HARD — genuine right-to-erasure. The original destructive behaviour:
 *     1. Delete the verified_vibe_users row — cascades to every verified_vibe_*
 *        table, user_master_profile, pool registries, artifacts, tips, etc.
 *     2. Delete the Supabase auth user — cascades to auth.users-keyed tables
 *        (ai_assistant_*, device_tokens) and removes the login itself.
 *
 * Note: verified_vibe_users.id holds the same UUID as auth.users.id but is not
 * an FK to it, so the hard path needs both deletes for a full wipe.
 *
 * Must be called with the service-role client (getSupabase()) so it can bypass
 * RLS and use the auth admin API.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type PurgeResult =
	| { ok: true }
	| { ok: false; stage: 'profile' | 'auth' | 'pool'; message: string };

export interface PurgeOptions {
	/** 'soft' (default) retains data + bans login; 'hard' destroys everything. */
	mode?: 'soft' | 'hard';
	/** Canned churn reason code, stored on the soft-deleted row. */
	reason?: string | null;
}

// Ban effectively forever (~100 years). Supabase clears a ban with 'none'.
const BAN_FOREVER = '876000h';

/**
 * Soft-delete: retain the user's data but remove them from the product and lock
 * out the login. Reversible in principle (clear deleted_at + unban) until the
 * day-90 anonymization job runs.
 */
async function softDeleteUser(
	db: SupabaseClient<any>,
	userId: string,
	reason: string | null
): Promise<PurgeResult> {
	// 1. Stamp the soft-delete marker — the row (and all its cascaded data) stays.
	const { error: markErr } = await db
		.from('verified_vibe_users')
		.update({ deleted_at: new Date().toISOString(), deletion_reason: reason })
		.eq('id', userId);
	if (markErr) {
		console.error('softDeleteUser: failed to stamp deleted_at:', markErr);
		return { ok: false, stage: 'profile', message: 'Failed to delete account data.' };
	}

	// 2. Drop out of the live pool so the matcher/discover never surface them.
	//    No-op if the user was never enrolled (seed / unverified).
	const { error: poolErr } = await db
		.from('vv_pool_profiles')
		.update({ availability_status: 'deleted', last_updated: new Date().toISOString() })
		.eq('user_id', userId);
	if (poolErr) {
		// Non-fatal: the discover-feed / cohort guards also filter on deleted_at, so
		// a stale pool row can't leak the user. Log and continue.
		console.error('softDeleteUser: failed to deactivate pool row (continuing):', poolErr);
	}

	// 2b. Unmatch active matches so the counterparty's thread disappears (the row
	//     is retained, just moved to 'unmatched'). Hard-delete used to cascade
	//     these away; soft-delete must hide them explicitly.
	const { error: matchErr } = await db
		.from('verified_vibe_matches')
		.update({ status: 'unmatched' })
		.or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
		.in('status', ['mutual', 'pending']);
	if (matchErr) {
		console.error('softDeleteUser: failed to unmatch active matches (continuing):', matchErr);
	}

	// 3. Ban the auth login (do NOT delete it — deletion would cascade-wipe the
	//    ai_assistant_* conversations we want to keep).
	const { error: banErr } = await db.auth.admin.updateUserById(userId, {
		ban_duration: BAN_FOREVER
	} as any);
	if (banErr) {
		console.error('softDeleteUser: failed to ban auth login:', banErr);
		return {
			ok: false,
			stage: 'auth',
			message: 'Your data was hidden but the login could not be locked. Please contact support.'
		};
	}

	return { ok: true };
}

/**
 * Hard-delete: the original destructive purge, for genuine right-to-erasure.
 */
async function hardDeleteUser(db: SupabaseClient<any>, userId: string): Promise<PurgeResult> {
	// 1. Delete the app profile row — cascades to all verified_vibe_* data.
	const { error: profileErr } = await db.from('verified_vibe_users').delete().eq('id', userId);
	if (profileErr) {
		console.error('hardDeleteUser: failed to delete profile row:', profileErr);
		return { ok: false, stage: 'profile', message: 'Failed to delete account data.' };
	}

	// 2. Delete the auth user — cascades to auth.users-keyed tables and the login.
	const { error: authErr } = await db.auth.admin.deleteUser(userId);
	if (authErr) {
		console.error('hardDeleteUser: failed to delete auth user:', authErr);
		return {
			ok: false,
			stage: 'auth',
			message: 'Data was deleted but the login could not be fully removed.'
		};
	}

	return { ok: true };
}

/**
 * Delete a user. Defaults to a soft-delete that retains data for product
 * improvement; pass { mode: 'hard' } for a full destructive erasure.
 */
export async function purgeUser(
	db: SupabaseClient<any>,
	userId: string,
	opts: PurgeOptions = {}
): Promise<PurgeResult> {
	const mode = opts.mode ?? 'soft';
	return mode === 'hard'
		? hardDeleteUser(db, userId)
		: softDeleteUser(db, userId, opts.reason ?? null);
}
