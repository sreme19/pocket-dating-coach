/**
 * POST /api/verified-vibe/matchmaker/run
 *
 * Triggers the nightly Matchmaker batch.
 * Called exclusively by the Supabase Edge Function cron job
 * (matchmaker-nightly). Protected by a shared secret header.
 *
 * Body: { secret: string; cityScoped?: boolean }
 * Response: { started: true } (batch runs asynchronously)
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { runNightlyBatch } from '$lib/server/matchmaker-service';
import { MATCHMAKER_RUN_SECRET } from '$env/static/private';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json() as { secret?: string; cityScoped?: boolean };

    // Validate secret
    if (!body.secret || body.secret !== MATCHMAKER_RUN_SECRET) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cityScoped = body.cityScoped ?? false;

    // Run asynchronously — respond immediately, batch runs in background
    runNightlyBatch(cityScoped).catch((err) => {
      console.error('[matchmaker/run] nightly batch failed:', err);
    });

    return json({ started: true, cityScoped });

  } catch (err) {
    console.error('[matchmaker/run]', err);
    return json({ error: 'Failed to start matchmaker run' }, { status: 500 });
  }
};
