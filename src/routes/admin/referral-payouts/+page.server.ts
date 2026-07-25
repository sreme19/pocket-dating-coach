import type { PageServerLoad } from './$types';
import { getSupabase } from '$lib/server/supabase';

// Refer & Earn payout ledger, BOTH tracks: 'woman' (invite women — ₹100 for
// #1-25 then ₹150, cap 100) and 'man' (invite men — flat ₹25, cap 1000). The
// track column is what makes a ₹25 row legible next to a ₹150 one, so it is
// surfaced in the table. The /admin tree is gated by the admin layout, so no
// auth check is needed here (mirrors /admin/beta). Reads are service-role via
// getSupabase(); vv_referral_rewards is RLS deny-all otherwise.
export const load: PageServerLoad = async () => {
	const db = getSupabase() as any;

	const columns =
		'id, referrer_id, referred_user_id, amount_inr, tier_rate, reward_index, status, mood, created_at, payable_at, paid_at, paid_by, payout_ref';

	const [rewardsRes, { data: users }] = await Promise.all([
		db
			.from('vv_referral_rewards')
			.select(`${columns}, track`)
			.order('created_at', { ascending: false }),
		db.from('verified_vibe_users').select('id, first_name')
	]);

	// Pre-migration fallback: `track` only exists after 20260725143000, and every
	// row written before it is a women-flow referral.
	let rewards = rewardsRes.data;
	if (rewardsRes.error && `${rewardsRes.error.code}` === '42703') {
		const retry = await db
			.from('vv_referral_rewards')
			.select(columns)
			.order('created_at', { ascending: false });
		rewards = (retry.data ?? []).map((r: any) => ({ ...r, track: 'woman' }));
	}

	const nameById = new Map<string, string>((users ?? []).map((u: any) => [u.id, u.first_name]));

	const rows = (rewards ?? []).map((r: any) => ({
		id: r.id,
		referrerName: nameById.get(r.referrer_id) ?? '—',
		referredName: nameById.get(r.referred_user_id) ?? '—',
		amountInr: r.amount_inr,
		tierRate: r.tier_rate,
		rewardIndex: r.reward_index,
		track: (r.track ?? 'woman') as 'woman' | 'man',
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
