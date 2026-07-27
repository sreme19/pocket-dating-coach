import type { PageServerLoad } from './$types';
import { getSupabase } from '$lib/server/supabase';
import { modeOf, selectReferralLinks } from '$lib/server/referral-links';
import { formatPhone } from '$lib/phone';

const SIGNUP_COLUMNS =
	'id, email, platform, status, referrer_id, link_id, matched_user_id, created_at, matched_at, invited_at';

/**
 * Signups, with the WhatsApp columns when they exist. Migration
 * 20260728013000 is applied by hand in the SQL editor, so this page can load
 * against a database that predates it — PostgREST fails the WHOLE select on an
 * unknown column, which would blank the tab rather than just the new field.
 * Falling back keeps every other column working; the numbers show as "—".
 */
async function loadSignups(db: any) {
	const withPhone = await db
		.from('verified_vibe_beta_signups')
		.select(`${SIGNUP_COLUMNS}, whatsapp_country_code, whatsapp_number`)
		.order('created_at', { ascending: false });
	if (!withPhone.error) return withPhone;

	if (`${withPhone.error.code}` === '42703') {
		console.error(
			'[admin/beta] whatsapp_* columns missing — run migration ' +
				'20260728013000_add_whatsapp_to_beta_signups.sql. Numbers hidden for now.'
		);
	} else {
		console.error('[admin/beta] signup load failed:', withPhone.error);
	}
	return db
		.from('verified_vibe_beta_signups')
		.select(SIGNUP_COLUMNS)
		.order('created_at', { ascending: false });
}

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
		selectReferralLinks(db, 'id, referrer_id, token, active, created_at, kind'),
		loadSignups(db)
	]);

	const nameById = new Map<string, string>(
		(users ?? []).map((u: any) => [u.id, u.first_name])
	);
	const genderById = new Map<string, string>(
		(users ?? []).map((u: any) => [u.id, u.gender])
	);
	const linkKindById = new Map<string, string | null>(
		(links ?? []).map((l: any) => [l.id, l.kind ?? null])
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

	// Admin owns two distinctly-typed links (kind on the link row), so which one
	// a signup came through is known immediately. A member owns a single
	// shareable link that both men and women can join through — for her rows
	// there's no link-level type, so we infer the flow from who actually
	// joined (matched_user_id → gender). Until a signup matches, that's unknowable.
	const signupRows = (signups ?? []).map((s: any) => {
		const kind = s.referrer_id ? null : linkKindById.get(s.link_id) ?? null;
		const matchedGender = s.matched_user_id ? genderById.get(s.matched_user_id) ?? null : null;

		let linkTypeLabel: string;
		if (kind === 'admin_invite_women') linkTypeLabel = 'Invite women';
		else if (kind === 'admin_invite_men') linkTypeLabel = 'Invite men';
		else if (!s.referrer_id) linkTypeLabel = 'Unknown link';
		else linkTypeLabel = 'Personal link';

		const genderBucket: 'male' | 'female' | 'pending' =
			matchedGender === 'man' ? 'male' : matchedGender === 'woman' ? 'female' : 'pending';

		return {
			id: s.id,
			email: s.email,
			platform: s.platform ?? null,
			whatsapp: formatPhone(s.whatsapp_country_code ?? null, s.whatsapp_number ?? null),
			status: s.status,
			invited_at: s.invited_at ?? null,
			created_at: s.created_at,
			matched_at: s.matched_at,
			ownerKey: s.referrer_id ?? 'admin',
			referrerName: s.referrer_id ? (nameById.get(s.referrer_id) ?? '—') : 'Admin',
			matchedName: s.matched_user_id ? (nameById.get(s.matched_user_id) ?? '—') : null,
			linkTypeLabel,
			genderBucket
		};
	});

	return { women, signups: signupRows, adminLinks };
};
