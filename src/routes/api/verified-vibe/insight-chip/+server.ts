/**
 * POST /api/verified-vibe/insight-chip
 *   Add or remove a single insight chip within a verified-proof category in
 *   user_master_profile.data.verifiedProofs. Lets a client (e.g. the native
 *   app, which has no localStorage) persist chip edits that the web previously
 *   only kept client-side.
 *
 *   Body: { action: 'add' | 'remove', category: string, label: string, emoji?: string }
 *
 *   This only edits the descriptive `insights` array — it does NOT change
 *   pts_awarded or recompute trust, so hand-edited chips can't inflate score.
 *
 * Auth: Bearer token (required)
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';
import { getSupabase } from '$lib/server/supabase';

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

interface Insight { label: string; emoji?: string; }

export const POST: RequestHandler = async ({ request }: { request: Request }) => {
  const userId = await getUserId(request);
  if (!userId) return json({ error: 'Unauthorized' }, { status: 401 });

  let body: { action?: string; category?: string; label?: string; emoji?: string };
  try { body = await request.json(); }
  catch { return json({ error: 'Invalid JSON body' }, { status: 400 }); }

  const action = body.action;
  const category = (body.category ?? '').trim();
  const label = (body.label ?? '').trim();
  const emoji = (body.emoji ?? '•').trim() || '•';

  if (action !== 'add' && action !== 'remove') {
    return json({ error: 'action must be "add" or "remove"' }, { status: 400 });
  }
  if (!category || !label) {
    return json({ error: 'category and label are required' }, { status: 400 });
  }

  const db = getSupabase() as any;

  const { data: row } = await db
    .from('user_master_profile')
    .select('data')
    .eq('user_id', userId)
    .maybeSingle();

  const data = (row?.data as Record<string, unknown>) ?? {};
  const proofs: any[] = Array.isArray(data.verifiedProofs) ? (data.verifiedProofs as any[]) : [];

  const idx = proofs.findIndex((p) => p?.category === category);
  let entry = idx >= 0 ? { ...proofs[idx] } : { category, insights: [] as Insight[], aggregated: '', verified_at: new Date().toISOString() };
  const insights: Insight[] = Array.isArray(entry.insights) ? [...entry.insights] : [];

  if (action === 'add') {
    if (!insights.some((i) => (i.label ?? '').toLowerCase() === label.toLowerCase())) {
      insights.push({ label, emoji });
    }
  } else {
    const filtered = insights.filter((i) => (i.label ?? '').toLowerCase() !== label.toLowerCase());
    insights.length = 0;
    insights.push(...filtered);
  }
  entry.insights = insights;

  const nextProofs = [...proofs];
  if (idx >= 0) {
    // Drop the whole category entry if a remove emptied a manually-created one
    // that has no points; otherwise keep the updated entry.
    if (insights.length === 0 && entry.pts_awarded === undefined) nextProofs.splice(idx, 1);
    else nextProofs[idx] = entry;
  } else if (insights.length > 0) {
    nextProofs.push(entry);
  }

  const updated = { ...data, verifiedProofs: nextProofs, lastSynced: new Date().toISOString() };

  if (row) {
    await db.from('user_master_profile').update({ data: updated, updated_at: new Date().toISOString() }).eq('user_id', userId);
  } else {
    await db.from('user_master_profile').insert({ user_id: userId, data: updated });
  }

  return json({ ok: true, category, insights });
};
