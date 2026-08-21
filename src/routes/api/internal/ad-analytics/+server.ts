import { json } from '@sveltejs/kit';
import { timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from './$types';
import { buildAdAnalytics } from '$lib/server/ad-analytics';
import { adSpendConfigStatus } from '$lib/server/ad-spend/sync';
import { resolveGranularity, resolveIstRange } from '$lib/ist-dates';
import { isAudience } from '$lib/server/ad-audience';
import { env } from '$env/dynamic/private';

/**
 * GET /api/internal/ad-analytics?start=2026-08-01&end=2026-08-10&currency=INR
 *
 * Machine-to-machine twin of /admin/analytics/ads-data, for the
 * ad-management-agent repo. Same query params, same resolveIstRange /
 * resolveGranularity / audience handling, same buildAdAnalytics() call, same
 * response shape — this route never re-derives the aggregation itself.
 * pocket-dating-coach stays the single owner of every rate, sample-size gate,
 * and bot-traffic exclusion in that function.
 *
 * Auth is a bearer token against ADS_AGENT_API_KEY, not the admin session
 * cookie — this is called by a script, not a logged-in browser.
 *
 * GET-only, read-only, single purpose: answer what the analytics aggregation
 * currently says for a range/filter. Do not add mutation endpoints or other
 * admin functionality behind this same key.
 */

function apiKeyMatches(submitted: string): boolean {
	const expected = env.ADS_AGENT_API_KEY;
	if (!expected) return false;
	const a = Buffer.from(submitted);
	const b = Buffer.from(expected);
	if (a.length !== b.length) return false;
	return timingSafeEqual(a, b);
}

export const GET: RequestHandler = async ({ url, request }) => {
	const auth = request.headers.get('authorization') ?? '';
	const [scheme, token] = auth.split(' ');
	if (scheme !== 'Bearer' || !token || !apiKeyMatches(token)) {
		return json({ error: 'unauthorized' }, { status: 401 });
	}

	const range = resolveIstRange({
		start: url.searchParams.get('start'),
		end: url.searchParams.get('end'),
		days: url.searchParams.get('days')
	});
	const currency = url.searchParams.get('currency') === 'USD' ? 'USD' : 'INR';
	const gran = resolveGranularity(url.searchParams.get('granularity'), range.days);

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
		return json({
			...data,
			rangeClamped: range.clamped,
			granularityClamped: gran.clamped,
			spendConfig: adSpendConfigStatus()
		});
	} catch (err: any) {
		console.error('[ad-analytics:internal] failed:', err);
		return json({ error: err?.message ?? String(err) }, { status: 500 });
	}
};
