import type { PageServerLoad } from './$types';
import { getSupabase } from '$lib/server/supabase';

// Refer & Earn Flow 2 payout ledger. The /admin tree is gated by the admin
// layout, so no auth check is needed here (mirrors /admin/beta). Reads are
// service-role via getSupabase(); vv_referral_rewards is RLS deny-all otherwise.
export const load: PageServerLoad = async () => {
	const db = getSupabase() as any;

	const [{ data: rewards }, { data: users }] = await Promise.all([
		db
			.from('vv_referral_rewards')
			.select(
				'id, referrer_id, referred_user_id, amount_inr, tier_rate, reward_index, status, mood, created_at, payable_at, paid_at, paid_by, payout_ref'
			)
			.order('created_at', { ascending: false }),
		db.from('verified_vibe_users').select('id, first_name')
	]);

	const nameById = new Map<string, string>((users ?? []).map((u: any) => [u.id, u.first_name]));

	const rows = (rewards ?? []).map((r: any) => ({
		id: r.id,
		referrerName: nameById.get(r.referrer_id) ?? '—',
		referredName: nameById.get(r.referred_user_id) ?? '—',
		amountInr: r.amount_inr,
		tierRate: r.tier_rate,
		rewardIndex: r.reward_index,
		status: r.status,
		mood: r.mood ?? null,
		createdAt: r.created_at,
		payableAt: r.payable_at,
		paidAt: r.paid_at,
		paidBy: r.paid_by ?? null,
		payoutRef: r.payout_ref ?? null
	}));

	const totalPayable = rows
		.filter((r: any) => r.status === 'payable')
		.reduce((s: number, r: any) => s + (r.amountInr ?? 0), 0);
	const totalPaid = rows
		.filter((r: any) => r.status === 'paid')
		.reduce((s: number, r: any) => s + (r.amountInr ?? 0), 0);
	const countPayable = rows.filter((r: any) => r.status === 'payable').length;

	return { rows, totalPayable, totalPaid, countPayable };
};
