/**
 * /beta/{token}/app — the "you're in, get the app" page.
 *
 * This is the web twin of the early-access invite email, for people the team
 * hand-invites over WhatsApp: a riteangle URL (so the link looks like us and
 * previews her photo instead of pasting a raw storage URL) that opens on the
 * same congratulations + her card + store button the email carries.
 *
 * The token is HER referral link, not a per-signup one — so this page shows the
 * store button to anyone who has the link and appends /app. That is a deliberate
 * trade for shipping without a migration: the store links are already public
 * join URLs that go out in every invite email, and the real gate on becoming a
 * tester is the store's own tester cap, not the secrecy of this path. If that
 * stops being acceptable, the fix is a per-signup invite_token column and
 * resolving the device + referrer from the signup row instead of the query.
 *
 * Device: ?d=ios|android, written by the admin Copy button (which knows the
 * device on file). Falls back to sniffing the User-Agent so a link that lost its
 * query string still lands on the right store, and shows both buttons when we
 * genuinely cannot tell.
 */

import type { PageServerLoad } from './$types';
import { getSupabase } from '$lib/server/supabase';
import { modeOf, selectReferralLinks } from '$lib/server/referral-links';
import { STORE_LINKS, type Platform } from '$lib/server/beta-invite-email';

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
			storeLinks: STORE_LINKS,
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
		storeLinks: STORE_LINKS,
		ogImage: referrer?.avatar_url ?? null,
		pageUrl
	};
};
