import type { PageServerLoad } from './$types';
import { getSupabase } from '$lib/server/supabase';

export const load: PageServerLoad = async ({ params }) => {
	const db = getSupabase() as any;

	const { data: link } = await db
		.from('verified_vibe_referral_links')
		.select('token, active')
		.eq('token', params.token)
		.maybeSingle();

	// Don't leak whether a token exists — an inactive or unknown token both
	// render the same "not available" state.
	if (!link || !link.active) {
		return { valid: false, token: params.token };
	}

	return { valid: true, token: link.token };
};
