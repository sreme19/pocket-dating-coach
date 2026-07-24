/**
 * POST /admin/referral-payouts/mark-paid
 *   Record that a Flow 2 cash referral reward has been PAID OUT by a human via
 *   UPI/bank. This does NOT move any money — it only stamps the ledger row so it
 *   drops off the payable queue. Actual disbursement happens outside the app.
 *
 *   Body (JSON): { rewardId: string, payoutRef?: string }
 *   Returns:     { success: true, paid_at: string }
 *
 * Auth: admin session cookie (pdc_admin).
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSupabase } from '$lib/server/supabase';
import { ADMIN_COOKIE, tokenIsValid } from '$lib/server/admin-auth';

export const POST: RequestHandler = async ({ request, cookies }) => {
	if (!tokenIsValid(cookies.get(ADMIN_COOKIE))) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	let rewardId: unknown;
	let payoutRef: unknown;
	try {
		({ rewardId, payoutRef } = await request.json());
	} catch {
		return json({ error: 'Invalid request body' }, { status: 400 });
	}
	if (typeof rewardId !== 'string' || !rewardId) {
		return json({ error: 'rewardId is required' }, { status: 400 });
	}

	const db = getSupabase() as any;
	const paidAt = new Date().toISOString();
	const ref = typeof payoutRef === 'string' && payoutRef.trim() ? payoutRef.trim() : null;

	// Only a 'payable' row can be marked paid — makes a double-click idempotent
	// and stops a 'void' (over-cap) row from being paid by mistake.
	const { data, error } = await db
		.from('vv_referral_rewards')
		.update({ status: 'paid', paid_at: paidAt, paid_by: 'admin', payout_ref: ref })
		.eq('id', rewardId)
		.eq('status', 'payable')
		.select('id')
		.maybeSingle();

	if (error) {
		return json({ error: 'Failed to mark paid' }, { status: 500 });
	}
	if (!data) {
		return json({ error: 'Reward not found or not payable' }, { status: 404 });
	}

	return json({ success: true, paid_at: paidAt });
};
