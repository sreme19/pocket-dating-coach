/**
 * /beta/{token}/app — the "you're in, get the app" page.
 *
 * This is the web twin of the early-access invite email, for people the team
 * hand-invites over WhatsApp: a riteangle URL (so the link looks like us and
 * previews her photo instead of pasting a raw storage URL) that opens on the
 * same congratulations + her card + store button the email carries.
 *
 * The token is HER referral link, not a per-signup one, so this page shows the
 * store buttons to anyone who has the link and appends /app. Since open testing
 * (2026-08-03) that is not even a trade any more: both store links are public
 * join URLs, the /beta landing hands them out directly, and there is no tester
 * allow-list left to protect.
 *
 * NOTE this path collects no email, which the /beta landing does. A person who
 * arrives here therefore has no verified_vibe_beta_signups row from us, so they
 * are only attributed to their referrer if the team already collected them (the
 * admin Copy button builds this URL from an existing signup row). Keep that in
 * mind before repurposing this page as a general share target.
 *
 * Device: ?d=ios|android, written by the admin Copy button (which knows the
 * device on file), else sniffed from the User-Agent. It only ORDERS the two store
 * buttons — the page always offers both (see $lib/store-links), so a stale
 * `platform` column or a forwarded link can't strand anyone on the wrong store.
 */

import type { PageServerLoad } from './$types';
import { getSupabase } from '$lib/server/supabase';
import { modeOf, selectReferralLinks } from '$lib/server/referral-links';
import type { Platform } from '$lib/store-links';

/** Read the device from ?d=, else from the User-Agent, else null (show both). */
function resolvePlatform(param: string | null, userAgent: string): Platform | null {
	if (param === 'ios' || param === 'android') return param;
	if (/android/i.test(userAgent)) return 'android';
	if (/iphone|ipad|ipod/i.test(userAgent)) return 'ios';
	return null;
}

export const load: PageServerLoad = async ({ params, url, request }) => {
	const db = getSupabase() as any;
	const pageUrl = url.href;

	const platform = resolvePlatform(
		url.searchParams.get('d'),
		request.headers.get('user-agent') ?? ''
	);

	const { rows } = await selectReferralLinks(db, 'token, active, referrer_id', (q) =>
		q.eq('token', params.token).limit(1)
	);
	const link = rows[0] ?? null;

	// Unknown and inactive tokens render the same dead end as the signup page —
	// never leak which one it was.
	if (!link || !link.active) {
		return {
			valid: false,
			referrer: null,
			platform,
			ogImage: null,
			pageUrl
		};
	}

	// A PRIVATE link carries nothing about its owner. Enforced by never loading
	// her, exactly as the signup page and both email paths do — so no copy change
	// here can leak her later.
	const isPrivate = modeOf(link) === 'private';

	const { data: referrer } =
		link.referrer_id && !isPrivate
			? await db
					.from('verified_vibe_users')
					.select('first_name, age, city, avatar_url')
					.eq('id', link.referrer_id)
					.maybeSingle()
			: { data: null };

	return {
		valid: true,
		referrer: referrer ?? null,
		platform,
		ogImage: referrer?.avatar_url ?? null,
		pageUrl
	};
};
