/**
 * GET  /api/verified-vibe/master-profile
 *   Returns the full master profile from user_master_profile for the
 *   authenticated user so any device can hydrate its localStorage.
 *
 * POST /api/verified-vibe/master-profile
 *   Merges client-side data (onboarding QA, generated profile, draft, countries)
 *   into user_master_profile. Does NOT touch verifiedProofs — those are written
 *   exclusively by the proof-upload endpoint.
 *
 * Auth: Bearer token (required for both)
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';
import { getSupabase } from '$lib/server/supabase';
import { refreshWingmanPoolEntry, refreshBestiePoolEntry } from '$lib/server/pool-registry';

// ── Auth helper ───────────────────────────────────────────────────────────────

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

// ── Convert DB verifiedProofs → localStorage StoredInsight[] ─────────────────
// (used so a new device can restore vv_proof_insights from Supabase)

function proofsToLocalStorage(verifiedProofs: unknown[]): object[] {
  if (!Array.isArray(verifiedProofs)) return [];
  const CATEGORY_PTS: Record<string, number> = {
    lifestyle: 8, hosting: 6, discipline: 4, social_proof: 4,
    linkedin: 5, instagram: 3, twitter: 2, habit_tracker: 2,
    intro: 8, spending: 10, assets: 10, wealth: 12,
  };
  return verifiedProofs.map((p: any) => {
    const entry: Record<string, unknown> = {
      id:            p.id ?? crypto.randomUUID(),
      category:      p.category ?? '',
      insight_label: p.insights?.[0]?.label ?? 'Proof verified',
      insight_emoji: p.insights?.[0]?.emoji ?? '✅',
      insights:      p.insights  ?? [],
      aggregated:    p.aggregated ?? '',
      photo_count:   p.photo_count ?? 0,
      pts_awarded:   p.pts_awarded ?? CATEGORY_PTS[p.category] ?? 4,
      verified_at:   p.verified_at ?? new Date().toISOString(),
      showcased:     p.showcased ?? false,
      // thumbnails: storage URLs restored from DB (base64 thumbnails from old uploads stay client-local)
      ...(Array.isArray(p.thumbnail_urls) && p.thumbnail_urls.length > 0 ? { thumbnails: p.thumbnail_urls } : {}),
    };
    // Restore rich fields saved by persistInsight
    if (Array.isArray(p.spendingBreakdown) && p.spendingBreakdown.length > 0) {
      entry.spendingBreakdown = p.spendingBreakdown;
    }
    if (Array.isArray(p.assets) && p.assets.length > 0) {
      entry.assets = p.assets;
    }
    if (Array.isArray(p.locations) && p.locations.length > 0) {
      entry.locations = p.locations;
    }
    return entry;
  });
}

// ── GET ───────────────────────────────────────────────────────────────────────

export const GET: RequestHandler = async ({ request }: { request: Request }) => {
  const userId = await getUserId(request);
  if (!userId) return json({ error: 'Unauthorized' }, { status: 401 });

  const db = getSupabase() as any;

  // Fetch from user_master_profile
  const { data: row } = await db
    .from('user_master_profile')
    .select('data, updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  const masterData = (row?.data as Record<string, unknown>) ?? {};

  // verifiedProofs lives inside the master profile blob
  const verifiedProofs: unknown[] = Array.isArray(masterData.verifiedProofs)
    ? masterData.verifiedProofs as unknown[]
    : [];

  // Collect countries from verifiedProofs locations as well as stored list
  const dbCountries: string[] = verifiedProofs.flatMap((p: any) =>
    Array.isArray(p.locations) ? p.locations : []
  );
  const storedCountries: string[] = Array.isArray(masterData.countriesTraveled)
    ? masterData.countriesTraveled as string[]
    : [];
  const mergedCountries = Array.from(new Set([...storedCountries, ...dbCountries]));

  return json({
    profileDraft:             masterData.profileDraft              ?? null,
    generatedProfile:         masterData.generatedProfile          ?? null,
    onboarding:               masterData.onboarding               ?? null,
    countriesTraveled:        mergedCountries,
    proofInsightsLocalStorage: proofsToLocalStorage(verifiedProofs),
    photos:                   Array.isArray(masterData.photos)   ? masterData.photos   : [],
    aiPhotos:                 Array.isArray(masterData.aiPhotos) ? masterData.aiPhotos : [],
    lastSynced:               row?.updated_at ?? null,
  });
};

// ── POST ──────────────────────────────────────────────────────────────────────

export const POST: RequestHandler = async ({ request }: { request: Request }) => {
  const userId = await getUserId(request);
  if (!userId) return json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return json({ error: 'Invalid JSON body' }, { status: 400 }); }

  const db = getSupabase() as any;

  // Fetch existing row to merge into (not overwrite)
  const { data: existing } = await db
    .from('user_master_profile')
    .select('data')
    .eq('user_id', userId)
    .maybeSingle();

  const prev = (existing?.data as Record<string, unknown>) ?? {};

  // Deep-merge onboarding keys (keep DB keys not present in this push)
  const prevOnboarding   = (prev.onboarding  as Record<string, unknown>) ?? {};
  const newOnboarding    = (body.onboarding  as Record<string, unknown>) ?? {};
  const mergedOnboarding = { ...prevOnboarding, ...newOnboarding };

  // Countries: union merge from both sources
  const prevCountries  = Array.isArray(prev.countriesTraveled) ? prev.countriesTraveled as string[] : [];
  const newCountries   = Array.isArray(body.countriesTraveled) ? body.countriesTraveled as string[] : [];
  const mergedCountries = Array.from(new Set([...prevCountries, ...newCountries]));

  // Keep verifiedProofs from DB — proof-upload owns that field
  const updated: Record<string, unknown> = {
    ...prev,
    onboarding:        mergedOnboarding,
    countriesTraveled: mergedCountries,
    lastSynced:        new Date().toISOString(),
  };

  if (body.identity              !== undefined) updated.identity              = body.identity;
  if (body.profileDraft          !== undefined) updated.profileDraft          = body.profileDraft;
  if (body.generatedProfile      !== undefined) updated.generatedProfile      = body.generatedProfile;
  if (body.personalityPortraitUrl !== undefined) updated.personalityPortraitUrl = body.personalityPortraitUrl;
  if (body.garagePortraitUrl      !== undefined) updated.garagePortraitUrl      = body.garagePortraitUrl;
  // Photos: full-replace (client owns the canonical ordered list of hosted URLs)
  if (body.photos                !== undefined) updated.photos                = body.photos;
  if (body.aiPhotos              !== undefined) updated.aiPhotos              = body.aiPhotos;

  if (existing) {
    await db
      .from('user_master_profile')
      .update({ data: updated, updated_at: new Date().toISOString() })
      .eq('user_id', userId);
  } else {
    await db
      .from('user_master_profile')
      .insert({ user_id: userId, data: updated });
  }

  // Fire-and-forget: refresh pool entry so Matchmaker has fresh data
  refreshWingmanPoolEntry(userId).catch(() => {});
  refreshBestiePoolEntry(userId).catch(() => {});

  return json({ synced: true, countriesTraveled: mergedCountries });
};
