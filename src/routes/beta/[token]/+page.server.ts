import type { PageServerLoad } from './$types';
import { getSupabase } from '$lib/server/supabase';
import { modeOf, selectReferralLinks } from '$lib/server/referral-links';

export const load: PageServerLoad = async ({ params, url }) => {
	const db = getSupabase() as any;

	// Absolute URL of this invite page — used for og:url so link-preview
	// crawlers (WhatsApp/Telegram/iMessage/Slack) have a canonical target.
	const pageUrl = url.href;

	// Referral framing (women-invite flow): /beta/<token>?m=networking|casual|serious.
	// Picks the landing variant + copy only; never drives onboarding.
	const moodParam = url.searchParams.get('m');
	const mood = ['networking', 'casual', 'serious'].includes(moodParam ?? '') ? moodParam : null;

	const { rows } = await selectReferralLinks(db, 'token, active, referrer_id', (q) =>
		q.eq('token', params.token).limit(1)
	);
	const link = rows[0] ?? null;

	// Don't leak whether a token exists — an inactive or unknown token both
	// render the same "not available" state.
	if (!link || !link.active) {
		return {
			valid: false,
			token: params.token,
			referrer: null,
			pageUrl,
			ogImage: null,
			mood,
			isPrivate: false
		};
	}

	// A PRIVATE link carries nothing about its owner: no photo, no name, no age
	// or city, and the brand logo (not their face) in the link preview. That is
	// the whole point of the mode, and it is enforced here — by never loading the
	// referrer — rather than in the markup, so no future copy change can leak it.
	const isPrivate = modeOf(link) === 'private';

	// The person who owns the link — shown on a card so the visitor knows exactly
	// who they'll be matched with. Admin-level links (no referrer_id) and private
	// links skip this entirely and fall through to generic brand copy.
	const { data: referrer } = link.referrer_id && !isPrivate
		? await db
				.from('verified_vibe_users')
				.select('first_name, age, city, avatar_url, about')
				.eq('id', link.referrer_id)
				.maybeSingle()
		: { data: null };

	// Absolute, publicly reachable image for the link preview card. Crawlers
	// don't run JS and won't follow relative paths, so resolve against origin.
	// Falls back to the brand logo when there's no referrer photo to show
	// (Admin-level links, or a real referrer without an avatar on file).
	const ogImage = referrer?.avatar_url
		? new URL(referrer.avatar_url, url.origin).href
		: new URL('/og/riteangle-logo.png', url.origin).href;

	return {
		valid: true,
		mood,
		isPrivate,
		token: link.token,
		pageUrl,
		ogImage,
		referrer: referrer
			? {
					first_name: referrer.first_name,
					age: referrer.age,
					city: referrer.city,
					avatar_url: referrer.avatar_url,
					about: referrer.about
				}
			: null
	};
};
