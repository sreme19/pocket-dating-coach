import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSupabase } from '$lib/server/supabase';

export const POST: RequestHandler = async ({ params, request }) => {
	const { userId } = params;
	const { isSeed } = await request.json() as { isSeed: boolean };

	const sb = getSupabase() as any;
	const { error } = await sb
		.from('verified_vibe_users')
		.update({ is_seed: isSeed })
		.eq('id', userId);

	if (error) return json({ error: error.message }, { status: 500 });
	return json({ ok: true });
};
