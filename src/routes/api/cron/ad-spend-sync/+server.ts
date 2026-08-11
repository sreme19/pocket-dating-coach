import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { syncAdSpend, SYNC_WINDOW_DAYS } from '$lib/server/ad-spend/sync';

/**
 * Ad spend sync — pulls daily campaign spend from Snap and Meta.
 *
 * RE-FETCHES A TRAILING WINDOW, EVERY RUN. Snap finalises metrics 48 hours after
 * a day ends and Meta restates for longer, so a day written once is a day
 * written wrong. Each run re-reads the last week and upserts, letting the
 * numbers converge on the truth instead of freezing at whatever they read an
 * hour after the spend happened.
 *
 * Inert until credentials exist. An unconfigured network reports
 * `configured: false` and writes nothing, which is deliberately distinct in the
 * response from a configured network that failed — those look identical on a
 * chart (both are zero) and call for opposite responses.
 *
 * Idempotent, so re-running is free and the hourly schedule overlapping a manual
 * run is not a problem.
 *
 * Auth: Authorization: Bearer <CRON_SECRET>
 */

function authorized(request: Request): boolean {
	const secret = process.env.CRON_SECRET;
	if (!secret) return false;
	const header = request.headers.get('authorization') ?? '';
	return header.startsWith('Bearer ') && header.slice(7) === secret;
}

const handle: RequestHandler = async ({ request, url }) => {
	if (!authorized(request)) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	// Widen the window by hand when back-filling a new account. Capped so a typo
	// cannot ask two ad networks for a decade of daily rows.
	const requested = Number(url.searchParams.get('days') ?? SYNC_WINDOW_DAYS);
	const days = Number.isFinite(requested) ? Math.min(Math.max(1, requested), 90) : SYNC_WINDOW_DAYS;

	try {
		const outcome = await syncAdSpend(days);

		// A network that is configured and errored is reported as ok:false even
		// though the request itself succeeded — otherwise a dead token shows up as
		// a healthy sync that happened to find no spend.
		const failed = outcome.networks.filter((n) => n.configured && n.error);

		// Reported SEPARATELY rather than folded into `ok`. Demographics are colour
		// around the spend number, not the number itself, so a breakdown parameter
		// a network refuses must not mark the spend sync — the thing decisions are
		// made on — as broken. It must not vanish either: a flag nobody sets is how
		// a fetch that has never once succeeded goes a month without being noticed.
		const demoFailed = outcome.demographics.networks.filter((n) => n.configured && n.error);

		return json({ ok: failed.length === 0, demographicsOk: demoFailed.length === 0, ...outcome });
	} catch (err: any) {
		console.error('ad-spend-sync cron failed:', err);
		return json({ ok: false, error: err?.message ?? String(err) }, { status: 500 });
	}
};

export const GET = handle;
export const POST = handle;
