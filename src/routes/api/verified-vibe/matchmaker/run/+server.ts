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
import { refreshPoolEntry } from '$lib/server/pool-registry';
import { runAnonymizeDeleted } from '$lib/server/anonymize-deleted';
import { runPhotoSignalBackfill } from '$lib/server/photo-signal-capture';
import { getSupabase } from '$lib/server/supabase';
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
        | 'score-vectors-shadow' | 'diff-scores' | 'match-v2-dryrun' | 'match-v2'
        | 'backfill-profile-fields' | 'anonymize-deleted' | 'capture-photo-signals';
      userId?: string;
      userIds?: string[];
      includeSeed?: boolean;
      limit?: number;
      olderThanDays?: number;
      dryRun?: boolean;
      force?: boolean;
    };

    // Validate secret
    if (!body.secret || body.secret !== MATCHMAKER_RUN_SECRET) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Multimodal (shadow): analyse each user's uploaded photos into data.photoSignals,
    // then rebuild their vectors + trust so the claim/confidence/trust changes land.
    // No-op unless PHOTO_SIGNAL_GATE is on; hash-guarded (pass force:true to re-analyse
    // everyone). One Claude vision call per user with photos. Synchronous.
    if (body.task === 'capture-photo-signals') {
      const result = await runPhotoSignalBackfill({
        userIds: body.userIds,
        includeSeed: body.includeSeed,
        force: body.force,
      });
      return json({ task: 'capture-photo-signals', ...result });
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

    // Day-90 retention: anonymize soft-deleted users past the retention window
    // (strip identifiers, purge photos/voice, scrub auth PII). Synchronous, no
    // LLM. Pass dryRun:true to preview, olderThanDays to override the 90d window.
    if (body.task === 'anonymize-deleted') {
      const result = await runAnonymizeDeleted({
        olderThanDays: body.olderThanDays,
        limit: body.limit,
        dryRun: body.dryRun
      });
      return json({ task: 'anonymize-deleted', ...result });
    }

    // Backfill the user-facing "Here For" + "Hard nos" columns from onboarding by
    // re-running refreshPoolEntry for every enrolled user. Idempotent: it only
    // seeds columns the owner left blank, never overwrites edits. Synchronous,
    // no LLM (pure derivation). Optional `userId` scopes it to one user.
    if (body.task === 'backfill-profile-fields') {
      const db = getSupabase() as any;
      // Guard deleted_at: refreshPoolEntry re-sets availability_status='active',
      // which would resurrect a soft-deleted user into the pool.
      let q = db.from('verified_vibe_users').select('id').in('gender', ['man', 'woman']).is('deleted_at', null);
      if (body.userId) q = q.eq('id', body.userId);
      const { data: users } = await q;
      let hereForCount = 0, hardNosCount = 0;
      for (const u of users ?? []) {
        await refreshPoolEntry(u.id);
        const { data: after } = await db
          .from('verified_vibe_users')
          .select('here_for_title, here_for_desc, hard_nos')
          .eq('id', u.id)
          .single();
        if (`${after?.here_for_title ?? ''}`.trim() || `${after?.here_for_desc ?? ''}`.trim()) hereForCount++;
        if (Array.isArray(after?.hard_nos) && after.hard_nos.length > 0) hardNosCount++;
      }
      return json({
        task: 'backfill-profile-fields',
        total: users?.length ?? 0,
        withHereFor: hereForCount,
        withHardNos: hardNosCount,
      });
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
