import type { PageServerLoad } from './$types';
import { getSupabase } from '$lib/server/supabase';

export const load: PageServerLoad = async ({ params }) => {
	const db = getSupabase() as any;

	const { data: link } = await db
		.from('verified_vibe_referral_links')
		.select('token, active, referrer_id')
		.eq('token', params.token)
		.maybeSingle();

	// Don't leak whether a token exists — an inactive or unknown token both
	// render the same "not available" state.
	if (!link || !link.active) {
		return { valid: false, token: params.token, referrer: null };
	}

	// The woman who owns the link — shown on a card so the visitor knows exactly
	// who they'll be matched with.
	const { data: referrer } = await db
		.from('verified_vibe_users')
		.select('first_name, age, city, avatar_url, about')
		.eq('id', link.referrer_id)
		.maybeSingle();

	return {
		valid: true,
		token: link.token,
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
