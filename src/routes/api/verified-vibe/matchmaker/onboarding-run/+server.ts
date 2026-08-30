/**
 * POST /api/verified-vibe/matchmaker/onboarding-run
 *   Fired once by the profile page when a freshly-onboarded user lands on it, so
 *   their inbox is seeded rather than empty while the pool is small and the
 *   nightly batch is dormant. This is a SYSTEM run — it neither charges nor is
 *   gated by the user's lifetime matchmaker presses.
 *
 *   Idempotent: guarded by verified_vibe_users.onboarding_match_run_at, so repeat
 *   profile visits never re-trigger it. It also no-ops if the user already has a
 *   match (so an existing user visiting their profile is never re-seeded).
 *
 *   Women are seeded with at least 3 matches from men active in the last week;
 *   men get the single-best-match system run (see runOnboardingMatchmaker).
 *
 *   → { status: 'ran' | 'skipped', reason?, result? }
 *
 * Auth: Supabase bearer token (required).
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';
import { getSupabase } from '$lib/server/supabase';
import { runOnboardingMatchmaker } from '$lib/server/matchmaker-service';

// Mirrors find-matches: a match creates the row AND generates the Bestie opener
// inline (Claude + DB writes). Seeding several matches at once needs the longer
// ceiling so a real match isn't created and then killed mid-opener.
export const config = { maxDuration: 60 };

async function getUserId(request: Request): Promise<string | null> {
  const authHeader = request.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;
  try {
    const client = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user } } = await client.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

export const POST: RequestHandler = async ({ request }) => {
  const userId = await getUserId(request);
  if (!userId) return json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const db = getSupabase() as any;

    // Idempotency: already seeded once → nothing to do.
    const { data: me } = await db
      .from('verified_vibe_users')
      .select('onboarding_match_run_at')
      .eq('id', userId)
      .maybeSingle();
    if (me?.onboarding_match_run_at) {
      return json({ status: 'skipped', reason: 'already_run' });
    }

    // Never re-seed a user who already has a match (an existing member visiting
    // their profile). Stamp the flag so we stop checking on every visit.
    const { count: matchCount } = await db
      .from('verified_vibe_matches')
      .select('id', { count: 'exact', head: true })
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`);
    if ((matchCount ?? 0) > 0) {
      await db
        .from('verified_vibe_users')
        .update({ onboarding_match_run_at: new Date().toISOString() })
        .eq('id', userId);
      return json({ status: 'skipped', reason: 'already_has_matches' });
    }

    const result = await runOnboardingMatchmaker(userId);

    // Stamp the flag only once she's actually eligible (an active pool entry).
    // 'needs_verification' means onboarding isn't fully processed yet — leave the
    // flag null so the next profile visit retries the seeding.
    if (result.status !== 'needs_verification') {
      await db
        .from('verified_vibe_users')
        .update({ onboarding_match_run_at: new Date().toISOString() })
        .eq('id', userId);
    }

    return json({ status: 'ran', result });
  } catch (err) {
    console.error('[onboarding-run] error:', err);
    return json({ error: 'Onboarding matchmaker run failed' }, { status: 500 });
  }
};
