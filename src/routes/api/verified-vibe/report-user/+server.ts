/**
 * POST /api/verified-vibe/report-user
 *
 * Reports a user for objectionable content or behavior (Apple Guideline 1.2 /
 * UGC safety). Persists the report for the moderation team, which commits to
 * reviewing every report within 24 hours.
 *
 * Request body:
 * {
 *   reportedUserId: string,
 *   reason: 'inappropriate_content' | 'harassment' | 'fake_profile' | 'scam' | 'other',
 *   description?: string,   // optional free text, max 1000 chars
 *   matchId?: string        // optional conversation/match the report came from
 * }
 *
 * Auth: Bearer token required
 *
 * Status codes:
 * - 200: Report successfully submitted
 * - 400: Invalid request (missing fields or invalid reason)
 * - 401: Unauthorized (not authenticated)
 * - 500: Internal server error
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import type { ReportReason } from '$lib/verified-vibe/types';
import { getSupabase } from '$lib/server/supabase';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';

interface ReportUserRequest {
  reportedUserId?: string;
  reason?: ReportReason;
  description?: string;
  matchId?: string;
}

const VALID_REASONS: ReportReason[] = [
  'inappropriate_content',
  'harassment',
  'fake_profile',
  'scam',
  'other',
];

export const POST: RequestHandler = async ({ request }) => {
  try {
    // Authenticate via Bearer token (same flow as block-user)
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const authClient = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);

    if (authError || !user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const reporterId = user.id;

    // Parse + validate body
    const body = await request.json() as ReportUserRequest;
    const reportedUserId = (body.reportedUserId ?? '').trim();
    const matchId = (body.matchId ?? '').trim();
    const description = typeof body.description === 'string' ? body.description.trim() : '';

    if (!reportedUserId) {
      return json({ error: 'reportedUserId is required' }, { status: 400 });
    }
    if (!body.reason) {
      return json({ error: 'reason is required' }, { status: 400 });
    }
    if (!VALID_REASONS.includes(body.reason)) {
      return json({ error: `reason must be one of: ${VALID_REASONS.join(', ')}` }, { status: 400 });
    }
    if (description.length > 1000) {
      return json({ error: 'description must be less than 1000 characters' }, { status: 400 });
    }
    if (reporterId === reportedUserId) {
      return json({ error: 'Cannot report yourself' }, { status: 400 });
    }

    // Persist the report for the moderation team.
    const db = getSupabase() as any;
    const { data: inserted, error: insertError } = await db
      .from('verified_vibe_reports')
      .insert({
        reporter_id: reporterId,
        reported_user_id: reportedUserId,
        match_id: matchId || null,
        reason: body.reason,
        description: description || null,
        status: 'pending',
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('[report-user] insert failed', insertError);
      return json({ error: 'Internal server error' }, { status: 500 });
    }

    return json({
      data: {
        success: true,
        message: 'Report received. Our moderation team reviews every report within 24 hours and acts on objectionable content or users.',
        reportId: inserted.id,
      },
    });
  } catch (err) {
    console.error('[report-user]', err);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};
