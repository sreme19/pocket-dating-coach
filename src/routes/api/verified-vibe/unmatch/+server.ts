/**
 * POST /api/verified-vibe/unmatch
 *
 * Unmatches a user (softer than block — they can still appear in discovery).
 * Removes the match record and records an outcome signal for Matchmaker.
 *
 * Request body:
 * {
 *   matchedUserId: string   — the user to unmatch
 *   matchId:       string   — the match ID
 * }
 *
 * Auth: Bearer token required
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getSupabase } from '$lib/server/supabase';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';

export const POST: RequestHandler = async ({ request }) => {
  try {
    // Authenticate via Bearer token
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

    const userId = user.id;

    // Parse body
    const body = await request.json() as {
      matchedUserId?: string;
      matchId?: string;
    };

    const matchedUserId = (body.matchedUserId ?? '').trim();
    const matchId = (body.matchId ?? '').trim();

    if (!matchedUserId) {
      return json({ error: 'matchedUserId is required' }, { status: 400 });
    }

    if (!matchId) {
      return json({ error: 'matchId is required' }, { status: 400 });
    }

    const db = getSupabase() as any;

    // Verify the match exists and the user is part of it
    const { data: match } = await db
      .from('verified_vibe_matches')
      .select('id, user1_id, user2_id')
      .eq('id', matchId)
      .single();

    if (!match) {
      return json({ error: 'Match not found' }, { status: 404 });
    }

    if (match.user1_id !== userId && match.user2_id !== userId) {
      return json({ error: 'Unauthorized — not part of this match' }, { status: 403 });
    }

    // Soft-delete the match: mark it 'unmatched' rather than deleting the row, so
    // the match + its message history are preserved for analytics. Reads that list
    // active matches filter status='mutual', so this hides it from both users. The
    // pair CAN resurface in Discover again (unmatched, not blocked).
    await db
      .from('verified_vibe_matches')
      .update({ status: 'unmatched' })
      .eq('id', matchId);

    // Record outcome signal for Matchmaker feedback loop (fire-and-forget)
    fetch(new URL('/api/verified-vibe/matchmaker/unmatch', request.url).toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        matchedUserId,
        matchId,
        outcome: 'unmatched',
      }),
    }).catch(() => { /* non-critical */ });

    return json({
      data: {
        success: true,
        message: 'Match removed',
        matchId,
      },
    });

  } catch (err) {
    console.error('[unmatch]', err);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};
