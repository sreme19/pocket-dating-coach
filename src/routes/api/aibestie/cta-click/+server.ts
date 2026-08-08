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
import { getSupabase } from '$lib/server/supabase';
import { hashToken } from '$lib/server/aibestie-session';

export const POST: RequestHandler = async ({ request }) => {
	const header = request.headers.get('authorization') ?? '';
	const token = header.startsWith('Bearer ') ? header.slice(7) : null;
	if (!token) return json({ ok: false }, { status: 401 });

	try {
		// First tap wins. He may bounce back and press it again, and the interesting
		// figure is when he first decided, not how many times he pressed.
		await (getSupabase() as any)
			.from('aibestie_lp_sessions')
			.update({ cta_clicked_at: new Date().toISOString() })
			.eq('token_hash', hashToken(token))
			.is('cta_clicked_at', null);

		return json({ ok: true });
	} catch (err) {
		console.error('[aibestie] cta-click failed (non-critical):', err);
		return json({ ok: false }, { status: 200 });
	}
};
