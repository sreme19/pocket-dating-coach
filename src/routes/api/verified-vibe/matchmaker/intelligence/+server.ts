/**
 * POST /api/verified-vibe/matchmaker/intelligence
 *
 * Called by AI Wingman or AI Bestie when the profile owner asks an
 * improvement/ranking question, or when a proactive cold/weekly trigger fires.
 *
 * Creates a vv_intelligence_reports row and immediately kicks off async
 * processing. Response returns the reportId so the caller can track it.
 * Delivery happens via push notification + proactive in-chat message.
 *
 * Body:
 * {
 *   userId:      string
 *   reportType:  'pool_competitive' | 'per_match_ranking' | 'female_competitive'
 *   triggerType: 'user_driven' | 'cold_push' | 'weekly'
 * }
 *
 * Response: { reportId: string; message: string }
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { queueIntelligenceReport } from '$lib/server/matchmaker-service';
import { getSupabase } from '$lib/server/supabase';
import { touchLastActive, refreshPoolEntry } from '$lib/server/pool-registry';
import { MATCHMAKER_RUN_SECRET } from '$env/static/private';

// This endpoint awaits the /process dispatch — give it enough headroom for
// Claude generation (typically 15–30 s) plus DB writes.
export const config = { maxDuration: 60 };

export const POST: RequestHandler = async ({ request, url }) => {
  try {
    const body = await request.json() as {
      userId?:      string;
      reportType?:  string;
      triggerType?: string;
    };

    const userId      = (body.userId ?? '').trim();
    const reportType  = body.reportType  as 'pool_competitive' | 'per_match_ranking' | 'female_competitive';
    const triggerType = body.triggerType as 'user_driven' | 'cold_push' | 'weekly';

    if (!userId)      return json({ error: 'userId is required' },      { status: 400 });
    if (!reportType)  return json({ error: 'reportType is required' },  { status: 400 });
    if (!triggerType) return json({ error: 'triggerType is required' }, { status: 400 });

    const validReportTypes  = ['pool_competitive', 'per_match_ranking', 'female_competitive'];
    const validTriggerTypes = ['user_driven', 'cold_push', 'weekly'];

    if (!validReportTypes.includes(reportType))
      return json({ error: 'Invalid reportType' }, { status: 400 });
    if (!validTriggerTypes.includes(triggerType))
      return json({ error: 'Invalid triggerType' }, { status: 400 });

    // Verify user exists and is in pool
    const db = getSupabase() as any;
    const { data: user } = await db
      .from('verified_vibe_users')
      .select('id, gender')
      .eq('id', userId)
      .single();

    if (!user) return json({ error: 'User not found' }, { status: 404 });

    // Touch last_active and ensure pool entry exists (auto-enroll if missing,
    // e.g. seed users who bypassed the verification flow)
    await touchLastActive(userId);
    await refreshPoolEntry(userId);

    // Guard: don't queue duplicate pending reports of same type
    const { data: existing } = await db
      .from('vv_intelligence_reports')
      .select('id, status')
      .eq('user_id', userId)
      .eq('report_type', reportType)
      .in('status', ['pending', 'processing'])
      .maybeSingle();

    if (existing) {
      return json({
        reportId: existing.id,
        message:  'A report of this type is already being processed. You\'ll be notified when it\'s ready.',
      });
    }

    // Queue the report
    const reportId = await queueIntelligenceReport(userId, reportType, triggerType);

    // Dispatch processing to /process endpoint and await it.
    // Node.js lambdas don't support fire-and-forget after response — the
    // function exits when it returns. We await the fetch so this Lambda
    // stays alive until the Claude generation and DB writes complete.
    // Both endpoints are configured with maxDuration: 60.
    const processUrl = new URL('/api/verified-vibe/matchmaker/intelligence/process', url).toString();
    const processRes = await fetch(processUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-matchmaker-secret': MATCHMAKER_RUN_SECRET,
      },
      body: JSON.stringify({ reportId }),
    });

    if (!processRes.ok) {
      console.error('[intelligence] process endpoint returned', processRes.status, reportId);
      return json({
        reportId,
        message: 'Report queued but processing encountered an issue. It will be retried shortly.',
      });
    }

    return json({
      reportId,
      message: 'Your intelligence report is ready. Check your Wingman chat for your personalised summary.',
    });

  } catch (err) {
    console.error('[matchmaker/intelligence]', err);
    return json({ error: 'Failed to queue intelligence report' }, { status: 500 });
  }
};
