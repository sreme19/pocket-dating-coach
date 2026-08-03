/**
 * Advisor task sweeper.
 *
 * Runs the queued work behind asks like "help me get matches", writes each result
 * into the user's advisor thread, and sends one push. Also releases tasks whose
 * previous runner died mid-flight, which nothing does for vv_intelligence_reports —
 * a failed report there resets to 'pending' and is then stranded until the user
 * asks again by hand.
 *
 * The work is AWAITED inside the request. This is not a style preference: the
 * nightly matchmaker sat dead for seven weeks because an upstream caller got
 * `{started: true}` back and Vercel froze the invocation before the work ran —
 * six run rows with completed_at NULL and zero pairs evaluated. A cron that
 * invokes this route directly and waits is the pattern that actually completes.
 *
 * Auth: Authorization: Bearer <CRON_SECRET>. See vercel.json for the schedule.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sweepAdvisorTasks } from '$lib/server/advisor-tasks';

// Matches the other cron routes. A sweep batch is bounded so it fits well inside.
export const config = { maxDuration: 300 };

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
		const report = await sweepAdvisorTasks();
		return json({ ok: true, ...report });
	} catch (e) {
		console.error('[cron advisor-tasks] sweep failed:', e);
		return json({ error: e instanceof Error ? e.message : 'Sweep failed' }, { status: 500 });
	}
};
