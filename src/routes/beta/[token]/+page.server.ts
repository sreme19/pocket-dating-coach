import type { PageServerLoad } from './$types';
import { getSupabase } from '$lib/server/supabase';

export const load: PageServerLoad = async ({ params, url }) => {
	const db = getSupabase() as any;

	// Absolute URL of this invite page — used for og:url so link-preview
	// crawlers (WhatsApp/Telegram/iMessage/Slack) have a canonical target.
	const pageUrl = url.href;

	const { data: link } = await db
		.from('verified_vibe_referral_links')
		.select('token, active, referrer_id')
		.eq('token', params.token)
		.maybeSingle();

	// Don't leak whether a token exists — an inactive or unknown token both
	// render the same "not available" state.
	if (!link || !link.active) {
		return { valid: false, token: params.token, referrer: null, pageUrl, ogImage: null };
	}

	// The woman who owns the link — shown on a card so the visitor knows exactly
	// who they'll be matched with.
	const { data: referrer } = await db
		.from('verified_vibe_users')
		.select('first_name, age, city, avatar_url, about')
		.eq('id', link.referrer_id)
		.maybeSingle();

	// Absolute, publicly reachable image for the link preview card. Crawlers
	// don't run JS and won't follow relative paths, so resolve against origin.
	const ogImage = referrer?.avatar_url
		? new URL(referrer.avatar_url, url.origin).href
		: null;

	return {
		valid: true,
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
