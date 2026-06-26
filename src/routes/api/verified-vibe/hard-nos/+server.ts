/**
 * POST /api/verified-vibe/hard-nos
 *
 * Persist the user's hard_nos (dealbreakers) and refresh their matchmaker pool
 * entry so the edit propagates to matching immediately. hard_nos is the single
 * source of truth for dealbreakers (see pool-registry.ts / refreshPoolEntry).
 *
 * An explicit save marks the list user-owned (hard_nos_seeded = true) so the
 * one-time onboarding seed never re-populates it later — including the case of a
 * user deliberately clearing all their hard nos.
 *
 * Auth: Bearer token (the caller may only edit their own hard_nos).
 *
 * Body: { hardNos: string[] }
 * Response: { saved: true, hardNos: string[] }
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';
import { getSupabase } from '$lib/server/supabase';
import { refreshPoolEntry } from '$lib/server/pool-registry';

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

export const POST: RequestHandler = async ({ request }) => {
  const userId = await getUserId(request);
  if (!userId) return json({ error: 'Unauthorized' }, { status: 401 });

  let body: { hardNos?: unknown };
  try { body = await request.json(); }
  catch { return json({ error: 'Invalid JSON' }, { status: 400 }); }

  if (!Array.isArray(body.hardNos)) {
    return json({ error: 'hardNos must be an array' }, { status: 400 });
  }

  // Normalise: trim, drop empties, dedupe, cap (mirrors the matchmaker projection).
  const hardNos = Array.from(
    new Set(body.hardNos.map((h) => `${h}`.trim()).filter(Boolean)),
  ).slice(0, 12);

  const db = getSupabase() as any;
  const { error } = await db
    .from('verified_vibe_users')
    .update({ hard_nos: hardNos, hard_nos_seeded: true })
    .eq('id', userId);

  if (error) {
    return json({ error: 'Failed to save hard nos' }, { status: 500 });
  }

  // Propagate to the matchmaker pool. Awaited so the edit is reflected before we
  // return; refreshPoolEntry won't re-seed because hard_nos_seeded is now true.
  await refreshPoolEntry(userId).catch(() => {});

  return json({ saved: true, hardNos });
};
