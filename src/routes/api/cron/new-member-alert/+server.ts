import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { runNewMemberAlert } from '$lib/server/new-member-alert';

/**
 * New-member alert cron — runs every 5 minutes. Emails the team once per fresh
 * real signup in verified_vibe_users (the USERS list in /admin/analytics).
 * Idempotent — safe to re-run; already-announced members are skipped.
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
		const report = await runNewMemberAlert();
		return json({ ok: true, ...report });
	} catch (err: any) {
		console.error('new-member-alert cron failed:', err);
		return json({ ok: false, error: err?.message ?? String(err) }, { status: 500 });
	}
};

export const GET = handle;
export const POST = handle;
