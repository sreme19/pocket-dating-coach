import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { runAibestiePrune } from '$lib/server/aibestie-prune';

/**
 * /aibestie reaper — runs nightly. Removes unclaimed landing-page conversations
 * and bounced sessions once they pass the retention window (30 days, both).
 *
 * DRY RUN BY DEFAULT. It reports what it would delete and deletes nothing until
 * AIBESTIE_PRUNE_DRY_RUN=false. Read the report for a few nights before arming it.
 *
 * Never touches a claimed conversation: that session's user_id is a REAL member,
 * and the delete would cascade their whole history. See aibestie-prune.ts.
 *
 * Idempotent — safe to re-run; anything already gone no longer matches.
 *
 * Auth: Authorization: Bearer <CRON_SECRET>
 */

function authorized(request: Request): boolean {
	const secret = process.env.CRON_SECRET;
	if (!secret) return false;
	const header = request.headers.get('authorization') ?? '';
	return header.startsWith('Bearer ') && header.slice(7) === secret;
}

const handle: RequestHandler = async ({ request }) => {
	if (!authorized(request)) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	try {
		const report = await runAibestiePrune();
		return json({ ok: true, ...report });
	} catch (err: any) {
		console.error('aibestie-prune cron failed:', err);
		return json({ ok: false, error: err?.message ?? String(err) }, { status: 500 });
	}
};

export const GET = handle;
export const POST = handle;
