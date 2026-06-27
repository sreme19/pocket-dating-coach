/**
 * GET /api/verified-vibe/blocked-users
 *
 * Lists the users the caller has blocked, with enough display info to render
 * an "unblock" list. Source is verified_vibe_passes (reason='blocked') — the
 * same store /block-user writes to.
 *
 * Response:
 * { data: { blocked: [{ id, firstName, age, avatar }] } }
 *
 * Auth: Bearer token required
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getSupabase } from '$lib/server/supabase';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';

export const GET: RequestHandler = async ({ request }) => {
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

    const db = getSupabase() as any;

    const { data: passes } = await db
      .from('verified_vibe_passes')
      .select('passed_user_id, created_at')
      .eq('user_id', user.id)
      .eq('reason', 'blocked')
      .order('created_at', { ascending: false });

    const ids = (passes ?? []).map((p: any) => p.passed_user_id).filter(Boolean);
    if (ids.length === 0) {
      return json({ data: { blocked: [] } });
    }

    const { data: users } = await db
      .from('verified_vibe_users')
      .select('id, first_name, age, avatar_url')
      .in('id', ids);

    const byId = new Map((users ?? []).map((u: any) => [u.id, u]));
    // Preserve block recency order from the passes query.
    const blocked = ids
      .map((id: string) => byId.get(id))
      .filter(Boolean)
      .map((u: any) => ({
        id: u.id,
        firstName: u.first_name ?? '—',
        age: u.age ?? null,
        avatar: u.avatar_url ?? null,
      }));

    return json({ data: { blocked } });
  } catch (err) {
    console.error('[blocked-users]', err);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};
