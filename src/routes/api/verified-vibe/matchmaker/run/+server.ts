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
import { runAllMatchScores } from '$lib/server/match-scoring';
import { refreshBestiePoolEntry } from '$lib/server/pool-registry';
import { getSupabase } from '$lib/server/supabase';
import { MATCHMAKER_RUN_SECRET } from '$env/static/private';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json() as {
      secret?: string;
      cityScoped?: boolean;
      task?: 'trust-normalize' | 'match-scores' | 'refresh-besties';
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

    // Match scoring only — recompute vv_match_scores for every mutual pair.
    // Synchronous so the caller sees the result. Heavy (LLM) but bounded.
    if (body.task === 'match-scores') {
      const result = await runAllMatchScores();
      return json({ task: 'match-scores', ...result });
    }

    // Re-distill every woman's pool entry (preference_model) from her current
    // master-profile onboarding. Run after a distillation change, then follow
    // with task:'match-scores'. Synchronous so the caller sees the count.
    if (body.task === 'refresh-besties') {
      const db = getSupabase() as any;
      const { data: women } = await db
        .from('verified_vibe_users')
        .select('id')
        .eq('gender', 'woman');
      let refreshed = 0, failed = 0;
      for (const w of (women ?? [])) {
        try { await refreshBestiePoolEntry(w.id); refreshed++; }
        catch { failed++; }
      }
      return json({ task: 'refresh-besties', total: women?.length ?? 0, refreshed, failed });
    }

    const cityScoped = body.cityScoped ?? false;

    // Nightly: re-normalize trust FIRST (matching + scoring read trust), then
    // match, then refresh match scores. Async — respond immediately.
    runTrustNormalization()
      .then(() => runNightlyBatch(cityScoped))
      .then(() => runAllMatchScores())
      .catch((err) => {
        console.error('[matchmaker/run] nightly run failed:', err);
      });

    return json({ started: true, cityScoped });

  } catch (err) {
    console.error('[matchmaker/run]', err);
    return json({ error: 'Failed to start matchmaker run' }, { status: 500 });
  }
};
