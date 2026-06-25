/**
 * POST /api/verified-vibe/proof-thumbnail
 *   Remove a single thumbnail image from a verified-proof category in
 *   user_master_profile.data.verifiedProofs. Lets the native app (and web)
 *   let a user delete an uploaded photo preview from their proof panel.
 *
 *   Body: { action: 'remove', category: string, url: string }
 *
 *   Removes the URL from the category's `thumbnail_urls`, decrements
 *   `photo_count` (display only), and best-effort deletes the underlying
 *   Storage object — but ONLY when the object path belongs to this user's own
 *   proof-uploads/{userId}/ folder. It does NOT change pts_awarded or recompute
 *   trust, so removing a photo can't deflate (or inflate) the score.
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

const STORAGE_BUCKET = 'profiles';

// Derive the in-bucket object path from a public Storage URL, e.g.
// https://x.supabase.co/storage/v1/object/public/profiles/proof-uploads/<uid>/...
// → proof-uploads/<uid>/...  (null if the URL isn't a public object in our bucket)
function storagePathFromUrl(url: string): string | null {
  const marker = `/storage/v1/object/public/${STORAGE_BUCKET}/`;
  const i = url.indexOf(marker);
  if (i < 0) return null;
  const path = url.slice(i + marker.length).split('?')[0];
  try { return decodeURIComponent(path); } catch { return path; }
}

export const POST: RequestHandler = async ({ request }: { request: Request }) => {
  const userId = await getUserId(request);
  if (!userId) return json({ error: 'Unauthorized' }, { status: 401 });

  let body: { action?: string; category?: string; url?: string };
  try { body = await request.json(); }
  catch { return json({ error: 'Invalid JSON body' }, { status: 400 }); }

  const action = body.action;
  const category = (body.category ?? '').trim();
  const url = (body.url ?? '').trim();

  if (action !== 'remove') {
    return json({ error: 'action must be "remove"' }, { status: 400 });
  }
  if (!category || !url) {
    return json({ error: 'category and url are required' }, { status: 400 });
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
  if (idx < 0) return json({ ok: true, category, thumbnails: [] });

  const entry = { ...proofs[idx] };
  const thumbs: string[] = Array.isArray(entry.thumbnail_urls) ? [...entry.thumbnail_urls] : [];
  const next = thumbs.filter((t) => t !== url);

  if (next.length === thumbs.length) {
    // URL wasn't present — nothing to do (idempotent)
    return json({ ok: true, category, thumbnails: thumbs });
  }

  entry.thumbnail_urls = next;
  // Keep the displayed photo count in step with the visible thumbnails.
  if (typeof entry.photo_count === 'number') {
    entry.photo_count = Math.max(0, entry.photo_count - 1);
  }

  const nextProofs = [...proofs];
  nextProofs[idx] = entry;
  const updated = { ...data, verifiedProofs: nextProofs, lastSynced: new Date().toISOString() };

  await db.from('user_master_profile')
    .update({ data: updated, updated_at: new Date().toISOString() })
    .eq('user_id', userId);

  // Best-effort delete of the underlying object — only within this user's folder.
  const path = storagePathFromUrl(url);
  if (path && path.startsWith(`proof-uploads/${userId}/`)) {
    try { await db.storage.from(STORAGE_BUCKET).remove([path]); }
    catch (e) { console.warn('proof thumbnail storage delete failed (non-fatal):', e); }
  }

  return json({ ok: true, category, thumbnails: next });
};
