/**
 * POST /api/verified-vibe/matchmaker/run
 *
 * Triggers the nightly Matchmaker batch.
 * Called exclusively by the Supabase Edge Function cron job
 * (matchmaker-nightly). Protected by a shared secret header.
 *
 * Body:
 *   { secret: string; cityScoped?: boolean }            — nightly run (async)
 *   { secret: string; task: 'trust-normalize' }          — trust pass only (SYNC,
 *                                                           returns before/after report)
 * Response: { started: true } | { task, count, report }
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { runNightlyBatch } from '$lib/server/matchmaker-service';
import { runTrustNormalization } from '$lib/server/trust-normalize';
import { MATCHMAKER_RUN_SECRET } from '$env/static/private';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json() as {
      secret?: string;
      cityScoped?: boolean;
      task?: 'trust-normalize';
    };

    // Validate secret
    if (!body.secret || body.secret !== MATCHMAKER_RUN_SECRET) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Trust normalization only — runs SYNCHRONOUSLY and returns the before/after
    // report. Used for the one-time backfill and ad-hoc re-normalization.
    if (body.task === 'trust-normalize') {
      const report = await runTrustNormalization();
      return json({ task: 'trust-normalize', count: report.length, report });
    }

    const cityScoped = body.cityScoped ?? false;

    // Nightly: re-normalize trust FIRST (matching reads trust bands), then match.
    // Runs asynchronously — respond immediately, work continues in background.
    runTrustNormalization()
      .then(() => runNightlyBatch(cityScoped))
      .catch((err) => {
        console.error('[matchmaker/run] nightly run failed:', err);
      });

    return json({ started: true, cityScoped });

  } catch (err) {
    console.error('[matchmaker/run]', err);
    return json({ error: 'Failed to start matchmaker run' }, { status: 500 });
  }
};
