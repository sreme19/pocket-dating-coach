/**
 * POST /admin/analytics/delete-user
 *   Permanently deletes a user's profile and all associated backend data.
 *   Triggered from the Users table in the admin analytics dashboard.
 *
 *   Body (JSON): { userId: string, hard?: boolean }
 *     hard — when true, performs a full destructive erasure (right-to-erasure).
 *            Default is a soft-delete that retains data for product improvement.
 *
 * Auth: admin session cookie (pdc_admin). This route lives under /admin so the
 * path-scoped admin cookie is sent with the request; +server.ts handlers don't
 * run the layout load, so the token is validated explicitly here.
 *
 * Deletion reuses purgeUser() — the same routine the user-facing account
 * deletion endpoint uses — so an admin delete behaves exactly like a user one.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSupabase } from '$lib/server/supabase';
import { ADMIN_COOKIE, tokenIsValid } from '$lib/server/admin-auth';
import { purgeUser } from '$lib/server/delete-user';

export const POST: RequestHandler = async ({ request, cookies }) => {
	if (!tokenIsValid(cookies.get(ADMIN_COOKIE))) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	let userId: unknown;
	let hard = false;
	try {
		const body = await request.json();
		userId = body?.userId;
		hard = body?.hard === true;
	} catch {
		return json({ error: 'Invalid request body' }, { status: 400 });
	}
	if (typeof userId !== 'string' || !userId) {
		return json({ error: 'userId is required' }, { status: 400 });
	}

	const db = getSupabase() as any;

	// Snapshot the name before the row is gone, for the response/confirmation.
	const { data: profile } = await db
		.from('verified_vibe_users')
		.select('first_name')
		.eq('id', userId)
		.maybeSingle();
	if (!profile) {
		return json({ error: 'User not found' }, { status: 404 });
	}

	const result = await purgeUser(db, userId, { mode: hard ? 'hard' : 'soft' });
	if (!result.ok) {
		return json({ error: result.message }, { status: 500 });
	}

	return json({ success: true, deletedName: profile.first_name ?? null });
};
