/**
 * POST /api/aibestie/cta-click
 *
 * Stamps the moment he tapped through to the store.
 *
 * Without it the funnel has a hole exactly where the money is: Play reports
 * installs and aibestie_lp_sessions reports conversations, but nothing joins the
 * two, so a campaign that produces cheap installs from people who never engaged
 * looks identical to one that produces fewer installs from people who talked for
 * five turns. Only the second is worth paying for.
 *
 * Fire-and-forget by design — the caller navigates away immediately after, so this
 * must never be something the navigation waits on or that can fail it.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { getSupabase } from '$lib/server/supabase';

export const POST: RequestHandler = async ({ request }) => {
	const header = request.headers.get('authorization') ?? '';
	const bearer = header.startsWith('Bearer ') ? header.slice(7) : null;
	if (!bearer) return json({ ok: false }, { status: 401 });

	try {
		const userClient = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
			global: { headers: { Authorization: `Bearer ${bearer}` } }
		});
		const {
			data: { user }
		} = await userClient.auth.getUser();
		if (!user?.id) return json({ ok: false }, { status: 401 });

		// First tap wins. He may bounce back and press it again, and the interesting
		// figure is when he first decided, not how many times he pressed.
		await (getSupabase() as any)
			.from('aibestie_lp_sessions')
			.update({ cta_clicked_at: new Date().toISOString() })
			.eq('user_id', user.id)
			.is('cta_clicked_at', null);

		return json({ ok: true });
	} catch (err) {
		console.error('[aibestie] cta-click failed (non-critical):', err);
		return json({ ok: false }, { status: 200 });
	}
};
