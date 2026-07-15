import type { PageServerLoad } from './$types';
import { getSupabase } from '$lib/server/supabase';

export const load: PageServerLoad = async () => {
	const db = getSupabase() as any;

	const [{ data: users }, { data: links }, { data: signups }] = await Promise.all([
		db
			.from('verified_vibe_users')
			.select('id, first_name, age, city, gender, is_seed')
			.order('first_name', { ascending: true }),
		db
			.from('verified_vibe_referral_links')
			.select('referrer_id, token, active, created_at'),
		db
			.from('verified_vibe_beta_signups')
			.select('id, email, status, referrer_id, matched_user_id, created_at, matched_at')
			.order('created_at', { ascending: false })
	]);

	const nameById = new Map<string, string>(
		(users ?? []).map((u: any) => [u.id, u.first_name])
	);
	const linkByReferrer = new Map<string, any>(
		(links ?? []).map((l: any) => [l.referrer_id, l])
	);

	// Female users = the ones who can own a share link.
	const women = (users ?? [])
		.filter((u: any) => u.gender === 'woman')
		.map((u: any) => ({
			id: u.id,
			first_name: u.first_name,
			age: u.age,
			city: u.city,
			is_seed: u.is_seed,
			token: linkByReferrer.get(u.id)?.token ?? null
		}));

	const signupRows = (signups ?? []).map((s: any) => ({
		id: s.id,
		email: s.email,
		status: s.status,
		created_at: s.created_at,
		matched_at: s.matched_at,
		referrerName: nameById.get(s.referrer_id) ?? '—',
		matchedName: s.matched_user_id ? (nameById.get(s.matched_user_id) ?? '—') : null
	}));

	return { women, signups: signupRows };
};
