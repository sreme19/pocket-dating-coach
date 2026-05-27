/**
 * POST /api/verified-vibe/matchmaker/intelligence/process
 *
 * Internal endpoint — processes a single vv_intelligence_reports row
 * (runs Claude generation, writes result, fires push notification).
 *
 * Called by POST /api/verified-vibe/matchmaker/intelligence via fire-and-forget
 * fetch so that the actual Claude work runs in its own Vercel invocation and
 * isn't killed when the parent response is sent.
 *
 * Auth: x-matchmaker-secret header must match MATCHMAKER_RUN_SECRET
 *
 * Body: { reportId: string }
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { MATCHMAKER_RUN_SECRET } from '$env/static/private';
import { processIntelligenceReport } from '$lib/server/intelligence-report-processor';

// Give this function up to 60 seconds — Claude generation can take 15–30 s
export const config = { maxDuration: 60 };

export const POST: RequestHandler = async ({ request }) => {
  const secret = request.headers.get('x-matchmaker-secret');
  if (!secret || secret !== MATCHMAKER_RUN_SECRET) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json() as { reportId?: string };
  const reportId = (body.reportId ?? '').trim();

  if (!reportId) {
    return json({ error: 'reportId is required' }, { status: 400 });
  }

  try {
    await processIntelligenceReport(reportId);
    return json({ success: true, reportId });
  } catch (err) {
    console.error('[intelligence/process] failed', reportId, err);
    return json({ error: 'Processing failed' }, { status: 500 });
  }
};
