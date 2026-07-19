/**
 * DELETE /api/verified-vibe/account
 *   Soft-deletes the authenticated user's account: they are removed from the
 *   product (unmatched, undiscoverable) and their login is locked, but their
 *   data is retained (anonymized after 90 days) for product improvement.
 *
 *   Body (optional JSON): { reason?: string, feedback?: string }
 *     reason   — one of the canned churn reason codes (see VALID_REASONS)
 *     feedback — optional free-text the user typed on the way out
 *
 *   Order:
 *     1. Record a churn row in account_deletions.
 *     2. purgeUser (soft mode): stamp verified_vibe_users.deleted_at, drop the
 *        user from the pool, and ban the auth login. Data is kept; the day-90
 *        job anonymizes it + purges photos later.
 *
 * Auth: Bearer token (required)
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';
import { getSupabase } from '$lib/server/supabase';
import { purgeUser } from '$lib/server/delete-user';

// Canned reason codes the UI offers. Anything else is coerced to null.
const VALID_REASONS = new Set([
  'found_someone',
  'taking_break',
  'not_enough_matches',
  'privacy',
  'too_expensive',
  'technical',
  'other'
]);

async function getUserId(request: Request): Promise<string | null> {
  const authHeader = request.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;
  try {
    const client = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });
    const { data: { user } } = await client.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

export const DELETE: RequestHandler = async ({ request }) => {
  const userId = await getUserId(request);
  if (!userId) return json({ error: 'Unauthorized' }, { status: 401 });

  // Parse optional feedback body (deletion still proceeds if it's missing/invalid).
  let reason: string | null = null;
  let feedback: string | null = null;
  try {
    const body = await request.json();
    if (typeof body?.reason === 'string' && VALID_REASONS.has(body.reason)) reason = body.reason;
    if (typeof body?.feedback === 'string' && body.feedback.trim()) {
      feedback = body.feedback.trim().slice(0, 2000);
    }
  } catch {
    // Body is optional — ignore parse errors.
  }

  const db = getSupabase() as any;

  // Snapshot a little context for the churn record before the profile row is gone.
  let archetype: string | null = null;
  let trustScore: number | null = null;
  let accountAgeDays: number | null = null;
  try {
    const { data: profile } = await db
      .from('verified_vibe_users')
      .select('archetype, trust_score, created_at')
      .eq('id', userId)
      .maybeSingle();
    if (profile) {
      archetype = profile.archetype ?? null;
      trustScore = typeof profile.trust_score === 'number' ? profile.trust_score : null;
      if (profile.created_at) {
        accountAgeDays = Math.floor(
          (Date.now() - new Date(profile.created_at).getTime()) / 86_400_000
        );
      }
    }
  } catch (err) {
    console.error('Account deletion: failed to snapshot profile (continuing):', err);
  }

  // 1. Record churn feedback first — this row must outlive the user.
  try {
    await db.from('account_deletions').insert({
      auth_user_id: userId,
      reason,
      feedback,
      archetype,
      trust_score: trustScore,
      account_age_days: accountAgeDays
    });
  } catch (err) {
    // Non-fatal: never block a user's right-to-be-forgotten on our analytics row.
    console.error('Account deletion: failed to record feedback (continuing):', err);
  }

  // 2. Soft-delete: retain the data, drop from the pool, ban the login.
  const result = await purgeUser(db, userId, { mode: 'soft', reason });
  if (!result.ok) {
    const error =
      result.stage === 'auth'
        ? 'Your account was deleted but the login could not be fully locked. Please contact support.'
        : 'Failed to delete account data. Please try again.';
    return json({ error }, { status: 500 });
  }

  return json({ success: true, deletedAt: new Date().toISOString() });
};
