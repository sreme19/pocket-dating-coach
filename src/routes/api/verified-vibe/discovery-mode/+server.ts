/**
 * /api/verified-vibe/discovery-mode
 *
 * The user's "season" — 'date' (default) or 'networking' (Networking Season).
 * See docs/requirements/Networking_Mode_Design.md.
 *
 *   GET → { discoveryMode: 'date' | 'networking' }
 *   PUT { mode: 'date' | 'networking' } → { saved: true, discoveryMode }
 *
 * Auth: Bearer token (a caller may only read/write their own mode).
 * On write we refresh the matchmaker pool entry so vv_pool_profiles.discovery_mode
 * stays in sync (same pattern as hard-nos).
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';
import { getSupabase } from '$lib/server/supabase';
import { refreshPoolEntry } from '$lib/server/pool-registry';

const MODES = ['date', 'networking'] as const;
type Mode = (typeof MODES)[number];

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
  } catch { return null; }
}

export const GET: RequestHandler = async ({ request }) => {
  const userId = await getUserId(request);
  if (!userId) return json({ error: 'Unauthorized' }, { status: 401 });

  const db = getSupabase() as any;
  const { data, error } = await db
    .from('verified_vibe_users')
    .select('discovery_mode')
    .eq('id', userId)
    .maybeSingle();

  if (error) return json({ error: 'Failed to load discovery mode' }, { status: 500 });

  const discoveryMode: Mode = data?.discovery_mode === 'networking' ? 'networking' : 'date';
  return json({ discoveryMode });
};

export const PUT: RequestHandler = async ({ request }) => {
  const userId = await getUserId(request);
  if (!userId) return json({ error: 'Unauthorized' }, { status: 401 });

  let body: { mode?: unknown };
  try { body = await request.json(); }
  catch { return json({ error: 'Invalid JSON' }, { status: 400 }); }

  const mode = `${body.mode}`.trim() as Mode;
  if (!MODES.includes(mode)) {
    return json({ error: "mode must be 'date' or 'networking'" }, { status: 400 });
  }

  const db = getSupabase() as any;
  const { error } = await db
    .from('verified_vibe_users')
    .update({ discovery_mode: mode })
    .eq('id', userId);

  if (error) return json({ error: 'Failed to save discovery mode' }, { status: 500 });

  // Keep vv_pool_profiles.discovery_mode in sync for the matcher/discovery path.
  await refreshPoolEntry(userId).catch(() => {});

  return json({ saved: true, discoveryMode: mode });
};
