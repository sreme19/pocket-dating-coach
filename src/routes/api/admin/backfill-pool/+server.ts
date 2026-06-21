/**
 * POST /api/admin/backfill-pool
 *
 * One-time backfill: finds all users who completed liveness + photos +
 * spending_or_qa but are not yet in the pool, then enrolls them.
 *
 * Auth: CRON_SECRET bearer token (same as cron jobs).
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getSupabase } from '$lib/server/supabase';
import { enrollInPoolIfVerified } from '$lib/server/pool-registry';

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get('authorization') ?? '';
  return header.startsWith('Bearer ') && header.slice(7) === secret;
}

export const POST: RequestHandler = async ({ request }) => {
  if (!authorized(request)) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getSupabase() as any;

  // Find all users with all 3 required steps completed
  const { data: rows, error } = await db
    .from('verified_vibe_verification')
    .select('user_id, step')
    .in('step', ['liveness', 'photos', 'spending_or_qa'])
    .eq('status', 'completed');

  if (error) {
    return json({ error: 'DB query failed', detail: error.message }, { status: 500 });
  }

  // Group by user_id
  const byUser = new Map<string, Set<string>>();
  for (const row of (rows ?? [])) {
    if (!byUser.has(row.user_id)) byUser.set(row.user_id, new Set());
    byUser.get(row.user_id)!.add(row.step);
  }

  // Filter: users with all 3 steps
  const required = ['liveness', 'photos', 'spending_or_qa'];
  const eligible = [...byUser.entries()]
    .filter(([, steps]) => required.every((s) => steps.has(s)))
    .map(([userId]) => userId);

  // Enroll each user (fire and await sequentially to avoid DB overload)
  const results: { userId: string; status: string }[] = [];
  for (const userId of eligible) {
    try {
      await enrollInPoolIfVerified(userId);
      results.push({ userId, status: 'enrolled' });
    } catch (e) {
      results.push({ userId, status: `error: ${e}` });
    }
  }

  const enrolled = results.filter((r) => r.status === 'enrolled').length;
  const failed   = results.filter((r) => r.status.startsWith('error')).length;

  console.log(`[backfill-pool] ${enrolled} enrolled, ${failed} failed out of ${eligible.length} eligible`);

  return json({ eligible: eligible.length, enrolled, failed, results });
};
