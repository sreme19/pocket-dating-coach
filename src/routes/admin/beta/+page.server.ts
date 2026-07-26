import type { PageServerLoad } from './$types';
import { getSupabase } from '$lib/server/supabase';
import { modeOf, selectReferralLinks } from '$lib/server/referral-links';

export const load: PageServerLoad = async () => {
	const db = getSupabase() as any;

	const [{ data: users }, { rows: links }, { data: signups }] = await Promise.all([
		db
			.from('verified_vibe_users')
			.select('id, first_name, age, city, gender, is_seed')
			.order('first_name', { ascending: true }),
		// Members can own a private link too (mode='private'). This tab is about
		// the public share links, so drop the private rows — otherwise a private
		// token could win the per-referrer slot below and be handed out as if it
		// were her shareable link.
		selectReferralLinks(db, 'referrer_id, token, active, created_at, kind'),
		db
			.from('verified_vibe_beta_signups')
			.select('id, email, platform, status, referrer_id, matched_user_id, created_at, matched_at, invited_at')
			.order('created_at', { ascending: false })
	]);

	const nameById = new Map<string, string>(
		(users ?? []).map((u: any) => [u.id, u.first_name])
	);
	const linkByReferrer = new Map<string, any>(
		(links ?? [])
			.filter((l: any) => l.referrer_id && modeOf(l) === 'public')
			.map((l: any) => [l.referrer_id, l])
	);
	const linkByKind = new Map<string, any>(
		(links ?? []).filter((l: any) => l.kind).map((l: any) => [l.kind, l])
	);
	const adminLinks = {
		women: linkByKind.get('admin_invite_women')?.token ?? null,
		men: linkByKind.get('admin_invite_men')?.token ?? null
	};

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
		platform: s.platform ?? null,
		status: s.status,
		invited_at: s.invited_at ?? null,
		created_at: s.created_at,
		matched_at: s.matched_at,
		referrerName: s.referrer_id ? (nameById.get(s.referrer_id) ?? '—') : 'Admin',
		matchedName: s.matched_user_id ? (nameById.get(s.matched_user_id) ?? '—') : null
	}));

	return { women, signups: signupRows, adminLinks };
};
