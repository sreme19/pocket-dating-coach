import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { buildAdAnalytics } from '$lib/server/ad-analytics';
import { adSpendConfigStatus } from '$lib/server/ad-spend/sync';
import { ADMIN_COOKIE, tokenIsValid } from '$lib/server/admin-auth';

/**
 * GET /api/analytics/ads?days=30&currency=INR
 *
 * Everything the admin Ad Analytics tab renders.
 *
 * Fetched when the tab is first opened rather than loaded with the page. The
 * admin/analytics load function already runs ten queries plus a batched
 * auth.admin lookup per user and takes seconds; adding six more to it would slow
 * down the two tabs that do not need any of this.
 *
 * Auth is inherited from admin/+layout.server.ts, which redirects to the login
 * page without the admin cookie. This route sits under /api rather than /admin,
 * so it repeats the check rather than assuming it.
 */

const MAX_DAYS = 180;

export const GET: RequestHandler = async ({ url, cookies }) => {
	// The same signed token the admin layout checks. Repeated rather than assumed
	// because this route lives under /api, outside that layout's protection.
	if (!tokenIsValid(cookies.get(ADMIN_COOKIE))) {
		return json({ error: 'unauthorized' }, { status: 401 });
	}

	const requested = Number(url.searchParams.get('days') ?? 30);
	const days = Number.isFinite(requested) ? Math.min(Math.max(1, Math.round(requested)), MAX_DAYS) : 30;
	const currency = url.searchParams.get('currency') === 'USD' ? 'USD' : 'INR';

	try {
		const data = await buildAdAnalytics({ days, currency });
		// Which credentials each network can see, by name and never by value.
		// Included here so the health panel can distinguish "not configured yet"
		// from "configured and returning nothing", which look identical on a chart.
		return json({ ...data, spendConfig: adSpendConfigStatus() });
	} catch (err: any) {
		console.error('[ad-analytics] failed:', err);
		return json({ error: err?.message ?? String(err) }, { status: 500 });
	}
};
