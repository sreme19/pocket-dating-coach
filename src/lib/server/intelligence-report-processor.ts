/**
 * Intelligence Report Processor
 *
 * Picks up pending vv_intelligence_reports, runs the appropriate
 * generation function from matchmaker-service, then:
 *   1. Writes the result back to vv_intelligence_reports (status='ready')
 *   2. Sends a push notification with the summary
 *   3. Stores a proactive in-chat message so the next Wingman/Bestie
 *      chat session opens with the report already surfaced
 *
 * Called by:
 *   - POST /api/verified-vibe/matchmaker/intelligence (user-driven or cold)
 *   - The nightly Edge Function for weekly/cold_push reports
 */

import { getSupabase } from './supabase';
import { generatePerMatchRanking, generateFemaleCompetitiveReport } from './matchmaker-service';
import { sendPushNotification } from '../verified-vibe/server/notifications';

// ── Process a single pending report ──────────────────────────────────────────

export async function processIntelligenceReport(reportId: string): Promise<void> {
  const db = getSupabase() as any;

  // Mark as processing
  await db
    .from('vv_intelligence_reports')
    .update({ status: 'processing' })
    .eq('id', reportId);

  const { data: report } = await db
    .from('vv_intelligence_reports')
    .select('*')
    .eq('id', reportId)
    .single();

  if (!report) return;

  try {
    let payload: Record<string, unknown> = {};
    let summary = '';
    let actionList: unknown[] = [];

    if (report.report_type === 'per_match_ranking') {
      const result = await generatePerMatchRanking(report.user_id);
      payload     = result as unknown as Record<string, unknown>;
      summary     = result.summary;
      actionList  = result.actionList;

    } else if (report.report_type === 'pool_competitive') {
      // Pool competitive for men — runs a simplified version using existing per-match data
      const result = await generatePerMatchRanking(report.user_id);
      payload     = result as unknown as Record<string, unknown>;
      summary     = result.summary;
      actionList  = result.actionList;

    } else if (report.report_type === 'female_competitive') {
      const result = await generateFemaleCompetitiveReport(report.user_id);
      payload     = result as unknown as Record<string, unknown>;
      summary     = result.summary;
      actionList  = result.actionList;
    }

    // Write result
    await db
      .from('vv_intelligence_reports')
      .update({
        status:       'ready',
        payload,
        summary,
        action_list:  actionList,
        completed_at: new Date().toISOString(),
      })
      .eq('id', reportId);

    // Push notification
    if (summary) {
      await sendPushNotification(report.user_id, {
        title: '💡 Your Competitive Intelligence Report is Ready',
        body:  summary,
        data:  { type: 'intelligence_report', reportId, deepLink: 'wingman_chat' },
      });
    }

    // Store proactive in-chat message (picked up on next Wingman/Bestie chat open)
    await db.from('vv_proactive_chat_messages').upsert(
      {
        user_id:     report.user_id,
        report_id:   reportId,
        report_type: report.report_type,
        message:     formatReportAsMessage(report.report_type, summary, actionList as Array<{ priority: number; action: string; impact: string }>),
        delivered:   false,
        created_at:  new Date().toISOString(),
      },
      { onConflict: 'user_id' }  // one pending message at a time per user
    );

  } catch (err) {
    await db
      .from('vv_intelligence_reports')
      .update({ status: 'pending', completed_at: null })  // reset for retry
      .eq('id', reportId);
    throw err;
  }
}

// ── Format report payload as a readable in-chat message ──────────────────────

function formatReportAsMessage(
  reportType: string,
  summary: string,
  actionList: Array<{ priority: number; action: string; impact: string }>
): string {
  const typeLabel = reportType === 'per_match_ranking'
    ? '📊 **Your Match Ranking Report**'
    : reportType === 'female_competitive'
    ? '📊 **Your Competitive Intelligence Report**'
    : '📊 **Your Pool Intelligence Report**';

  const actionLines = actionList.length
    ? '\n\n**Your top actions right now:**\n' +
      actionList
        .sort((a, b) => a.priority - b.priority)
        .map((a) => `${a.priority}. **${a.action}** — ${a.impact}`)
        .join('\n')
    : '';

  return `${typeLabel}\n\n${summary}${actionLines}`;
}

// ── Retrieve and deliver pending proactive message for a user ─────────────────
// Called at the start of every Wingman/Bestie chat request.
// Returns the message text if there is one pending, and marks it delivered.

export async function popPendingChatMessage(userId: string): Promise<string | null> {
  const db = getSupabase() as any;

  const { data: row } = await db
    .from('vv_proactive_chat_messages')
    .select('*')
    .eq('user_id', userId)
    .eq('delivered', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row) return null;

  // Mark delivered
  await db
    .from('vv_proactive_chat_messages')
    .update({ delivered: true })
    .eq('user_id', userId);

  // Also mark the report as delivered
  if (row.report_id) {
    await db
      .from('vv_intelligence_reports')
      .update({ status: 'delivered', delivered_at: new Date().toISOString() })
      .eq('id', row.report_id);
  }

  return row.message as string;
}
