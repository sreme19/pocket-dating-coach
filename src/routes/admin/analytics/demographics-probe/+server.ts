import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ADMIN_COOKIE, tokenIsValid } from '$lib/server/admin-auth';
import { probeDemographicSupport } from '$lib/server/ad-spend/probe';

/**
 * GET /admin/analytics/demographics-probe
 *
 * Asks Snap and Meta, live, which demographic breakdowns this account actually
 * answers — and reports the raw status and first line of each reply.
 *
 * WHY THIS EXISTS AS A ROUTE RATHER THAN A SCRIPT. The credentials live only in
 * Vercel's production environment. `vercel env pull` writes every secret as an
 * empty string, so a local script cannot reach either API, and the Snap
 * demographic parameter could not be confirmed against a real account before the
 * adapter was written. Rather than let the adapter's guess sit unverified until
 * somebody wonders why a chart is empty, this runs the candidate spellings
 * where the credentials are and says plainly which ones work.
 *
 * READ-ONLY, and narrow by construction: it issues GETs against reporting
 * endpoints over a two-day window and returns status codes and truncated bodies.
 * It writes nothing, to either network or our database.
 *
 * WHAT TO DO WITH THE ANSWER. Every candidate that returns 200 with buckets is a
 * dimension worth keeping in SNAP_DIMENSIONS / META_BREAKDOWNS; the rest should
 * be deleted from those lists so the cron stops spending calls on them and the
 * health panel stops reporting their failures as a problem. Delete this route
 * once the lists are settled — it has no ongoing job.
 *
 * Under /admin because the admin cookie is scoped to `path: '/admin'` and is not
 * sent anywhere else. The check is explicit because +layout.server.ts does not
 * run for +server.ts routes.
 */

export const GET: RequestHandler = async ({ url, cookies }) => {
	if (!tokenIsValid(cookies.get(ADMIN_COOKIE))) {
		return json({ error: 'unauthorized' }, { status: 401 });
	}

	// A deliberately tiny window. This is asking "does the parameter work?", not
	// "what were the numbers?", and a wide range only makes each call slower.
	const start = url.searchParams.get('start');
	const end = url.searchParams.get('end');
	const isDay = (v: string | null): v is string => Boolean(v && /^\d{4}-\d{2}-\d{2}$/.test(v));

	const result = await probeDemographicSupport(
		isDay(start) ? start : undefined,
		isDay(end) ? end : undefined
	);

	return json(result);
};
