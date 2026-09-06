import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSupabase } from '$lib/server/supabase';

/**
 * Delete Snap ad spend rows with empty ad_set_id.
 *
 * Snap's campaign breakdown doesn't provide ad set or creative drill-down,
 * so those fields are empty. This endpoint removes those rows.
 *
 * Auth: Authorization: Bearer <CRON_SECRET>
 */

function authorized(request: Request): boolean {
	const secret = process.env.CRON_SECRET;
	if (!secret) return false;
	const header = request.headers.get('authorization') ?? '';
	return header.startsWith('Bearer ') && header.slice(7) === secret;
}

export const POST: RequestHandler = async ({ request }) => {
	if (!authorized(request)) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const supabase = getSupabase() as any;

		const { data, error, count } = await supabase
			.from('ad_spend_daily')
			.delete({ count: 'exact' })
			.eq('network', 'snap')
			.eq('ad_set_id', '');

		if (error) {
			return json({ ok: false, error: error.message }, { status: 500 });
		}

		return json({ ok: true, deleted: count ?? 0 });
	} catch (err: any) {
		return json({ ok: false, error: err?.message ?? String(err) }, { status: 500 });
	}
};
