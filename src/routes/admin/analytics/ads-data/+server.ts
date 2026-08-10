import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { buildAdAnalytics } from '$lib/server/ad-analytics';
import { adSpendConfigStatus } from '$lib/server/ad-spend/sync';
import { ADMIN_COOKIE, tokenIsValid } from '$lib/server/admin-auth';
import { resolveGranularity, resolveIstRange } from '$lib/ist-dates';
import { isAudience } from '$lib/server/ad-audience';

/**
 * GET /admin/analytics/ads-data?start=2026-08-01&end=2026-08-10&currency=INR
 * GET /admin/analytics/ads-data?days=30&currency=INR
 *
 * Everything the admin Ad Analytics tab renders.
 *
 * START AND END ARE IST DAYS, and they win over `days` when both are given.
 * `days` is still accepted so the 7d/30d/90d chips and any bookmarked URL keep
 * working; it means "the last N Indian days, ending today". Both forms go
 * through resolveIstRange, so a hand-typed URL cannot ask for tomorrow, a
 * backwards range, or a span the aggregator will not honour.
 *
 * Fetched when the tab is first opened rather than loaded with the page. The
 * admin/analytics load function already runs ten queries plus a batched
 * auth.admin lookup per user and takes seconds; adding six more to it would slow
 * down the two tabs that do not need any of this.
 *
 * LIVES UNDER /admin FOR A LOAD-BEARING REASON. The admin session cookie is set
 * with `path: '/admin'` (see ADMIN_COOKIE_OPTS), so the browser does not attach
 * it to anything outside that tree. This endpoint first shipped at
 * /api/analytics/ads with exactly the auth check below and answered 401 to a
 * fully logged-in admin, because the cookie it was checking for was never sent.
 * Sitting beside delete-user and public-view-flags is what makes the check work.
 *
 * The check is still explicit rather than inherited: +layout.server.ts guards
 * pages, and its load function does not run for +server.ts routes.
 */

export const GET: RequestHandler = async ({ url, cookies }) => {
	// The same signed token the admin layout checks. Repeated rather than assumed
	// because this route lives under /api, outside that layout's protection.
	if (!tokenIsValid(cookies.get(ADMIN_COOKIE))) {
		return json({ error: 'unauthorized' }, { status: 401 });
	}

	const range = resolveIstRange({
		start: url.searchParams.get('start'),
		end: url.searchParams.get('end'),
		days: url.searchParams.get('days')
	});
	const currency = url.searchParams.get('currency') === 'USD' ? 'USD' : 'INR';
	// Capped against the span, not just validated: minute buckets over 180 days
	// would be 259,200 points. Too fine is coarsened rather than refused, and
	// reported so the UI can say the chart is not at the granularity asked for.
	const gran = resolveGranularity(url.searchParams.get('granularity'), range.days);

	// Both fall back to 'all' on anything unrecognised rather than 400-ing. A bad
	// filter value should show the unfiltered page, not an error dialog — and the
	// resolved value is echoed back in `range`, so the UI never has to assume the
	// filter it asked for is the filter that was applied.
	const requestedNetwork = url.searchParams.get('network');
	const network =
		requestedNetwork === 'snap' || requestedNetwork === 'meta' || requestedNetwork === 'other'
			? requestedNetwork
			: 'all';
	const requestedAudience = url.searchParams.get('audience');
	const audience = isAudience(requestedAudience) ? requestedAudience : 'all';

	try {
		const data = await buildAdAnalytics({
			start: range.start,
			end: range.end,
			currency,
			granularity: gran.granularity,
			network,
			audience
		});
		// Which credentials each network can see, by name and never by value.
		// Included here so the health panel can distinguish "not configured yet"
		// from "configured and returning nothing", which look identical on a chart.
		// `clamped` travels with the range so the UI can say the dates it is
		// showing are not the dates that were asked for.
		return json({
			...data,
			rangeClamped: range.clamped,
			granularityClamped: gran.clamped,
			spendConfig: adSpendConfigStatus()
		});
	} catch (err: any) {
		console.error('[ad-analytics] failed:', err);
		return json({ error: err?.message ?? String(err) }, { status: 500 });
	}
};
