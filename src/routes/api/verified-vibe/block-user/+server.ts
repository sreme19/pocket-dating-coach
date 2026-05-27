/**
 * POST /api/verified-vibe/block-user
 *
 * Blocks a user. If they are currently matched, also removes the match
 * and records an outcome signal for the Matchmaker feedback loop.
 *
 * Request body:
 * {
 *   blockedUserId: string   — the user to block
 *   matchId?:      string   — optional match ID (if blocking from a conversation)
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
      blockedUserId?: string;
      matchId?: string;
    };

    const blockedUserId = (body.blockedUserId ?? '').trim();
    const matchId = (body.matchId ?? '').trim();

    if (!blockedUserId) {
      return json({ error: 'blockedUserId is required' }, { status: 400 });
    }

    if (typeof blockedUserId !== 'string') {
      return json({ error: 'blockedUserId must be a string' }, { status: 400 });
    }

    if (userId === blockedUserId) {
      return json({ error: 'Cannot block yourself' }, { status: 400 });
    }

    const db = getSupabase() as any;

    // 1. Record the block in verified_vibe_passes (reuse pass table as block store)
    //    This prevents the blocked user from appearing in discovery
    await db.from('verified_vibe_passes').upsert(
      {
        user_id: userId,
        passed_user_id: blockedUserId,
        reason: 'blocked',
        created_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,passed_user_id' }
    );

    // Also block in reverse direction so blocked user can't see blocker
    await db.from('verified_vibe_passes').upsert(
      {
        user_id: blockedUserId,
        passed_user_id: userId,
        reason: 'blocked_reverse',
        created_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,passed_user_id' }
    );

    // 2. If there's an active match, remove it and record outcome signal
    let resolvedMatchId = matchId;

    if (!resolvedMatchId) {
      // Try to find the match between these two users
      const { data: match } = await db
        .from('verified_vibe_matches')
        .select('id')
        .or(`and(user1_id.eq.${userId},user2_id.eq.${blockedUserId}),and(user1_id.eq.${blockedUserId},user2_id.eq.${userId})`)
        .maybeSingle();

      resolvedMatchId = match?.id;
    }

    if (resolvedMatchId) {
      // Delete the match
      await db
        .from('verified_vibe_matches')
        .delete()
        .eq('id', resolvedMatchId);

      // Record outcome signal for Matchmaker feedback loop (fire-and-forget)
      fetch(new URL('/api/verified-vibe/matchmaker/unmatch', request.url).toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          matchedUserId: blockedUserId,
          matchId: resolvedMatchId,
          outcome: 'blocked',
        }),
      }).catch(() => { /* non-critical */ });
    }

    return json({
      data: {
        success: true,
        message: `User ${blockedUserId} has been blocked`,
        blockedUserId,
        matchRemoved: !!resolvedMatchId,
      },
    });

  } catch (err) {
    console.error('[block-user]', err);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};
