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
import { runVectorBackfill, computeUserVectors } from '$lib/server/vector-builder';
import { runShadowScoring, diffScores } from '$lib/server/vector-scoring-shadow';
import { runVectorMatchmaker } from '$lib/server/vector-matchmaker';
import { MATCHMAKER_RUN_SECRET } from '$env/static/private';
import { env } from '$env/dynamic/private';
import { logAppError } from '$lib/server/logAppError';

/** Phase 3 cutover flag — when 'true', the nightly run uses the vector matcher. */
const MATCHMAKER_V2 = env.MATCHMAKER_V2 === 'true';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json() as {
      secret?: string;
      cityScoped?: boolean;
      task?: 'trust-normalize' | 'match-scores' | 'build-vectors' | 'inspect-vectors'
        | 'score-vectors-shadow' | 'diff-scores' | 'match-v2-dryrun' | 'match-v2';
      userId?: string;
      userIds?: string[];
      includeSeed?: boolean;
      limit?: number;
    };

    // Validate secret
    if (!body.secret || body.secret !== MATCHMAKER_RUN_SECRET) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Phase 0 (shadow): backfill per-user value vectors into vv_user_vectors.
    // Nothing on the live path reads these yet — safe to run/re-run. Synchronous
    // so the caller sees per-user status. One LLM call per user.
    if (body.task === 'build-vectors') {
      const result = await runVectorBackfill({ userIds: body.userIds, includeSeed: body.includeSeed });
      return json({ task: 'build-vectors', ...result });
    }

    // Phase 0 diff/inspection: compute (without persisting) one user's vectors so
    // we can eyeball whether v/c/w look sane before relying on them.
    if (body.task === 'inspect-vectors') {
      if (!body.userId) return json({ error: 'userId required' }, { status: 400 });
      const vectors = await computeUserVectors(body.userId);
      return json({ task: 'inspect-vectors', userId: body.userId, vectors });
    }

    // Phase 1 (shadow): vector-score every mutual pair + compute Profile Strength
    // for every user with vectors, writing *_v2 / profile_strength columns ONLY.
    // Pure arithmetic, no LLM. Live scoring/matching/advisors are untouched.
    if (body.task === 'score-vectors-shadow') {
      const result = await runShadowScoring();
      return json({ task: 'score-vectors-shadow', ...result });
    }

    // Phase 1 admin diff: live LLM appeal vs vector appeal per pair (+ delta), and
    // Profile Strength per user. Read-only — the gate for validating the engine.
    if (body.task === 'diff-scores') {
      const result = await diffScores(body.limit ?? 100);
      return json({ task: 'diff-scores', ...result });
    }

    // Phase 3: vector matchmaker DRY-RUN — proposes the constrained min-cost-flow
    // matching + diff vs current, WITHOUT firing. The gate before flipping the flag.
    if (body.task === 'match-v2-dryrun') {
      const result = await runVectorMatchmaker({ dryRun: true });
      return json({ task: 'match-v2-dryrun', ...result });
    }
    // Phase 3: vector matchmaker for real (fires new matches, hysteresis-preserving).
    if (body.task === 'match-v2') {
      const result = await runVectorMatchmaker({ dryRun: false });
      return json({ task: 'match-v2', ...result });
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

    const cityScoped = body.cityScoped ?? false;

    // Nightly: re-normalize trust FIRST (trust still feeds the legacy path), then
    // run the matcher. When MATCHMAKER_V2 is on, use the vector matcher (cheap
    // arithmetic + min-cost-flow, no per-pair LLM); otherwise the legacy LLM
    // batch + match-score refresh. Async — respond immediately.
    runTrustNormalization()
      .then(() => (MATCHMAKER_V2
        ? runVectorMatchmaker({ dryRun: false }).then(() => undefined)
        : runNightlyBatch(cityScoped).then(() => runAllMatchScores()).then(() => undefined)))
      .catch((err) => {
        console.error('[matchmaker/run] nightly run failed:', err);
      });

    return json({ started: true, cityScoped, matcher: MATCHMAKER_V2 ? 'v2' : 'legacy' });

  } catch (err) {
    console.error('[matchmaker/run]', err);
    logAppError(err, {
      feature: 'Matchmaker',
      file: 'src/routes/api/verified-vibe/matchmaker/run/+server.ts',
      endpoint: 'POST /api/verified-vibe/matchmaker/run',
    }).catch(() => {});
    return json({ error: 'Failed to start matchmaker run' }, { status: 500 });
  }
};
