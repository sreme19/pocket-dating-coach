import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { runAnonymizeDeleted } from '$lib/server/anonymize-deleted';

/**
 * Day-90 retention cron — runs daily at 03:30 UTC.
 * Anonymizes soft-deleted users past the 90-day retention window: strips
 * identifiers, purges photos/voice from storage, and scrubs the auth PII.
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
		const report = await runAnonymizeDeleted();
		return json({ ok: true, ...report });
	} catch (err: any) {
		console.error('anonymize-deleted cron failed:', err);
		return json({ ok: false, error: err?.message ?? String(err) }, { status: 500 });
	}
};
