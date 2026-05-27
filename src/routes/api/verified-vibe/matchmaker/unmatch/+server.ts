/**
 * POST /api/verified-vibe/matchmaker/unmatch
 *
 * Records an unmatch outcome signal for the feedback loop.
 * Called when a user unmatches or blocks another user.
 *
 * Body:
 * {
 *   userId:        string   -- the user initiating the unmatch
 *   matchedUserId: string   -- the user being unmatched
 *   matchId:       string   -- the verified_vibe_matches row id
 *   outcome:       'unmatched' | 'blocked' | 'no_messages'
 * }
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getSupabase } from '$lib/server/supabase';
import { getTrustScoreBand } from '$lib/server/pool-registry';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json() as {
      userId?:        string;
      matchedUserId?: string;
      matchId?:       string;
      outcome?:       string;
    };

    const { userId, matchedUserId, matchId, outcome } = body;

    if (!userId || !matchedUserId || !matchId || !outcome)
      return json({ error: 'userId, matchedUserId, matchId, outcome are required' }, { status: 400 });

    const validOutcomes = ['unmatched', 'blocked', 'no_messages'];
    if (!validOutcomes.includes(outcome))
      return json({ error: 'Invalid outcome' }, { status: 400 });

    const db = getSupabase() as any;

    // Resolve which user is male and which is female
    const { data: users } = await db
      .from('verified_vibe_users')
      .select('id, gender, archetype, trust_score')
      .in('id', [userId, matchedUserId]);

    if (!users?.length) return json({ error: 'Users not found' }, { status: 404 });

    const initiator = users.find((u: any) => u.id === userId);
    const other     = users.find((u: any) => u.id === matchedUserId);

    if (!initiator || !other) return json({ error: 'User data incomplete' }, { status: 404 });

    const maleUser   = initiator.gender === 'man' ? initiator : other;
    const femaleUser = initiator.gender === 'woman' ? initiator : other;

    if (!maleUser || !femaleUser) {
      // Same-gender scenario — skip outcome signal (future extension)
      return json({ recorded: false, reason: 'Same-gender pairs not tracked in v1' });
    }

    // Fetch the compatibility score from when they were matched (if available)
    const { data: outcomeData } = await db
      .from('vv_match_outcome_signals')
      .select('compatibility_score')
      .eq('match_id', matchId)
      .maybeSingle();

    await db.from('vv_match_outcome_signals').insert({
      match_id:            matchId,
      male_user_id:        maleUser.id,
      female_user_id:      femaleUser.id,
      outcome,
      initiated_by_gender: initiator.gender,
      compatibility_score: outcomeData?.compatibility_score ?? null,
      male_archetype:      maleUser.archetype,
      female_archetype:    femaleUser.archetype,
      male_trust_band:     getTrustScoreBand(maleUser.trust_score ?? 0),
      outcome_at:          new Date().toISOString(),
    });

    return json({ recorded: true });

  } catch (err) {
    console.error('[matchmaker/unmatch]', err);
    return json({ error: 'Failed to record outcome signal' }, { status: 500 });
  }
};
