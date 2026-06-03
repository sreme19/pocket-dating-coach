import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSupabase } from '$lib/server/supabase';

/**
 * Stale voice-call reaper.
 *
 * A call row is normally closed by the worker's /finalize callback. If the
 * worker never joined (bad dispatch) or died mid-call, the row is left stuck in
 * 'ringing' or 'live'. This job sweeps those:
 *   - 'ringing' older than RING_TIMEOUT_MIN  -> 'no_answer'
 *   - 'live'    older than LIVE_TIMEOUT_MIN   -> 'failed'
 *
 * Auth: Authorization: Bearer <CRON_SECRET>. Vercel Cron sends a GET with this
 * header automatically when CRON_SECRET is set; external schedulers can POST.
 * See vercel.json for the schedule.
 */

const RING_TIMEOUT_MIN = 3;
const LIVE_TIMEOUT_MIN = 15;

function authorized(request: Request): boolean {
	const secret = process.env.CRON_SECRET;
	if (!secret) return false;
	const header = request.headers.get('authorization') ?? '';
	return header.startsWith('Bearer ') && header.slice(7) === secret;
}

async function reap() {
	const supabase = getSupabase();
	const now = Date.now();
	const ringCutoff = new Date(now - RING_TIMEOUT_MIN * 60_000).toISOString();
	const liveCutoff = new Date(now - LIVE_TIMEOUT_MIN * 60_000).toISOString();
	const endedAt = new Date(now).toISOString();

	const [ringRes, liveRes] = await Promise.all([
		(supabase as any)
			.from('vv_voice_calls')
			.update({ status: 'no_answer', failure_reason: 'reaper: never connected', ended_at: endedAt })
			.eq('status', 'ringing')
			.lt('started_at', ringCutoff)
			.select('id'),
		(supabase as any)
			.from('vv_voice_calls')
			.update({ status: 'failed', failure_reason: 'reaper: stuck live (worker dropped)', ended_at: endedAt })
			.eq('status', 'live')
			.lt('started_at', liveCutoff)
			.select('id')
	]);

	return {
		ringingReaped: ringRes.data?.length ?? 0,
		liveReaped: liveRes.data?.length ?? 0
	};
}

const handle: RequestHandler = async ({ request }) => {
	if (!authorized(request)) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	try {
		const result = await reap();
		return json({ success: true, ...result });
	} catch (err) {
		console.error('[voice/reap] failed:', err);
		return json({ error: 'reap failed', details: err instanceof Error ? err.message : String(err) }, { status: 500 });
	}
};

export const GET = handle;
export const POST = handle;
