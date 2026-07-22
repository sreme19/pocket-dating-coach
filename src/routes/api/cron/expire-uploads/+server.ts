import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { runExpireUploads } from '$lib/server/expire-uploads';

/**
 * Retention cron — runs daily. Deletes captured uploads (upload_audit rows +
 * their private-bucket objects) past the 90-day retention window.
 * Idempotent — safe to re-run.
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
		const report = await runExpireUploads();
		return json({ ok: true, ...report });
	} catch (err: any) {
		console.error('expire-uploads cron failed:', err);
		return json({ ok: false, error: err?.message ?? String(err) }, { status: 500 });
	}
};
