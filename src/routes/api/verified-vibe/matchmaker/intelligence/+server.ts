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
import { touchLastActive } from '$lib/server/pool-registry';
import { MATCHMAKER_RUN_SECRET } from '$env/static/private';

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

    // Touch last_active
    await touchLastActive(userId);

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

    // Kick off processing in a separate Vercel invocation so it isn't killed
    // when this response is sent. The /process endpoint awaits the full Claude
    // generation and DB writes in its own Lambda lifecycle.
    const processUrl = new URL('/api/verified-vibe/matchmaker/intelligence/process', url).toString();
    fetch(processUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-matchmaker-secret': MATCHMAKER_RUN_SECRET,
      },
      body: JSON.stringify({ reportId }),
    }).catch((err) => {
      console.error('[intelligence] failed to dispatch process request', reportId, err);
    });

    return json({
      reportId,
      message: 'Your intelligence report is being prepared. You\'ll get a notification and in-chat summary when it\'s ready — usually within a minute.',
    });

  } catch (err) {
    console.error('[matchmaker/intelligence]', err);
    return json({ error: 'Failed to queue intelligence report' }, { status: 500 });
  }
};
