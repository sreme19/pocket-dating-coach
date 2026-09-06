import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSupabase } from '$lib/server/supabase';

/**
 * Debug endpoint: show Snap rows with their ad_set_id values.
 *
 * Auth: Authorization: Bearer <CRON_SECRET>
 */

function authorized(request: Request): boolean {
	const secret = process.env.CRON_SECRET;
	if (!secret) return false;
	const header = request.headers.get('authorization') ?? '';
	return header.startsWith('Bearer ') && header.slice(7) === secret;
}

export const GET: RequestHandler = async ({ request }) => {
	if (!authorized(request)) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const supabase = getSupabase() as any;

		const { data, error } = await supabase
			.from('ad_spend_daily')
			.select('date, campaign_id, campaign_name, ad_set_id, ad_set_name, spend, currency')
			.eq('network', 'snap')
			.order('date', { ascending: false })
			.limit(10);

		if (error) {
			return json({ ok: false, error: error.message }, { status: 500 });
		}

		return json({ ok: true, rows: data ?? [] });
	} catch (err: any) {
		return json({ ok: false, error: err?.message ?? String(err) }, { status: 500 });
	}
};
