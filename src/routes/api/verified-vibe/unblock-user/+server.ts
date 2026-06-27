/**
 * POST /api/verified-vibe/unblock-user
 *
 * Reverses a block. Removes the bidirectional block rows written by
 * /block-user (the `blocked` row this user owns + the `blocked_reverse` row on
 * the other side), so both people can surface in each other's Discover again.
 *
 * Does NOT recreate the old match — if they want to reconnect they re-match
 * through Discover like anyone else.
 *
 * Request body:
 * {
 *   blockedUserId: string   — the user to unblock
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
    const body = await request.json() as { blockedUserId?: string };
    const blockedUserId = (body.blockedUserId ?? '').trim();

    if (!blockedUserId) {
      return json({ error: 'blockedUserId is required' }, { status: 400 });
    }

    const db = getSupabase() as any;

    // Remove the forward block (this user → blocked user)…
    await db.from('verified_vibe_passes')
      .delete()
      .eq('user_id', userId)
      .eq('passed_user_id', blockedUserId)
      .eq('reason', 'blocked');

    // …and the reverse block placed on the other side.
    await db.from('verified_vibe_passes')
      .delete()
      .eq('user_id', blockedUserId)
      .eq('passed_user_id', userId)
      .eq('reason', 'blocked_reverse');

    return json({
      data: {
        success: true,
        message: 'User unblocked',
        unblockedUserId: blockedUserId,
      },
    });
  } catch (err) {
    console.error('[unblock-user]', err);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};
