import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { runNightlyBatch } from '$lib/server/matchmaker-service';
import { runTrustNormalization } from '$lib/server/trust-normalize';
import { runAllMatchScores } from '$lib/server/match-scoring';
import { runVectorMatchmaker } from '$lib/server/vector-matchmaker';
import { env } from '$env/dynamic/private';

/**
 * Nightly Matchmaker cron — the real trigger for the nightly batch.
 *
 * Replaces the Supabase Edge Function (supabase/functions/matchmaker-nightly),
 * which was never a working trigger: it POSTs and awaits the app's response, and
 * the app's nightly path used to answer `{ started: true }` immediately and do
 * the work fire-and-forget. Vercel freezes the invocation once a response is
 * returned, so the batch was killed mid-flight every single time — all six
 * `nightly` rows in vv_matchmaker_runs (2026-06-10 → 2026-07-28) have
 * completed_at NULL and pairs_evaluated 0, and every real match in production
 * came from the synchronous on_demand path instead.
 *
 * A Vercel cron avoids the whole class of bug: it invokes this function directly,
 * so there is no upstream client whose own timeout can drop the connection and
 * tear down the run. The work below is awaited, and maxDuration is raised to
 * match. See vercel.json for the schedule.
 *
 * Requires MATCHMAKER_V2=true to be realistic: the v2 vector matcher is pure
 * arithmetic + min-cost-flow with no per-pair LLM call, so a full pool finishes
 * in seconds. The legacy path makes an LLM call per pair and will not complete
 * inside any function limit — it stays reachable only for a manual on-demand run.
 *
 * Auth: Authorization: Bearer <CRON_SECRET>
 */

/** 300s is the Pro ceiling; on Hobby the max accepted value is 60. */
export const config = { maxDuration: 300 };

const MATCHMAKER_V2 = env.MATCHMAKER_V2 === 'true';

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
		// Trust still feeds the legacy path, so normalize first either way.
		await runTrustNormalization();

		if (MATCHMAKER_V2) {
			const result = await runVectorMatchmaker({ dryRun: false });
			return json({ ok: true, matcher: 'v2', ...result });
		}

		// Legacy fallback. Left in so a misconfigured flag degrades to the old
		// behaviour rather than silently matching nobody, but it is expected to
		// exceed maxDuration on a real pool — check MATCHMAKER_V2 if this branch
		// starts showing incomplete runs.
		console.warn('[matchmaker-nightly] MATCHMAKER_V2 is off — running the legacy LLM batch, which may exceed maxDuration');
		await runNightlyBatch(false);
		await runAllMatchScores();
		return json({ ok: true, matcher: 'legacy' });
	} catch (err: any) {
		console.error('matchmaker-nightly cron failed:', err);
		return json({ ok: false, error: err?.message ?? String(err) }, { status: 500 });
	}
};

export const GET = handle;
export const POST = handle;
