/**
 * GET  /api/verified-vibe/master-profile
 *   Returns the full master profile for the authenticated user so any device
 *   can hydrate its localStorage from Supabase.
 *
 * POST /api/verified-vibe/master-profile
 *   Merges client-side data (onboarding QA, generated profile, draft, countries)
 *   into the master profile row in ai_assistant_profiles.
 *   Does NOT touch verifiedProofs — those are owned by the proof-upload endpoint.
 *
 * Auth: Bearer token (required for both)
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';
import { getSupabase } from '$lib/server/supabase';

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

function proofsToLocalStorage(verifiedProofs: unknown[]): object[] {
  if (!Array.isArray(verifiedProofs)) return [];
  const CATEGORY_PTS: Record<string, number> = {
    lifestyle: 8, hosting: 6, discipline: 4, social_proof: 4,
    linkedin: 5, instagram: 3, twitter: 2, habit_tracker: 2,
    intro: 8, spending: 10, assets: 10,
  };
  return verifiedProofs.map((p: any) => ({
    id:            p.id ?? crypto.randomUUID(),
    category:      p.category ?? '',
    insight_label: p.insights?.[0]?.label ?? 'Proof verified',
    insight_emoji: p.insights?.[0]?.emoji ?? '✅',
    insights:      p.insights  ?? [],
    aggregated:    p.aggregated ?? '',
    photo_count:   p.photo_count ?? 0,
    pts_awarded:   CATEGORY_PTS[p.category] ?? 4,
    verified_at:   p.verified_at ?? new Date().toISOString(),
    showcased:     p.showcased ?? false,
    // thumbnails intentionally omitted — too large for DB; client keeps them locally
  }));
}

// ── GET ───────────────────────────────────────────────────────────────────────

export const GET: RequestHandler = async ({ request }: { request: Request }) => {
  const userId = await getUserId(request);
  if (!userId) return json({ error: 'Unauthorized' }, { status: 401 });

  const db = getSupabase() as any;

  // Fetch master profile row
  const { data: masterRow } = await db
    .from('ai_assistant_profiles')
    .select('data, updated_at')
    .eq('user_id', userId)
    .eq('profile_type', 'master')
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Fetch personality profile row (contains verifiedProofs)
  const { data: personalityRow } = await db
    .from('ai_assistant_profiles')
    .select('data')
    .eq('user_id', userId)
    .eq('profile_type', 'personality')
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  const masterData = (masterRow?.data as Record<string, unknown>) ?? {};
  const verifiedProofs: unknown[] = Array.isArray((personalityRow?.data as any)?.verifiedProofs)
    ? (personalityRow.data as any).verifiedProofs
    : [];

  // Convert verifiedProofs → localStorage format
  const proofInsightsLocalStorage = proofsToLocalStorage(verifiedProofs);

  // Collect countries from verifiedProofs as well
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
    proofInsightsLocalStorage,                     // hydrates vv_proof_insights
    lastSynced:               masterRow?.updated_at ?? null,
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

  // Fetch existing master row to merge (not overwrite)
  const { data: existing } = await db
    .from('ai_assistant_profiles')
    .select('id, data, version')
    .eq('user_id', userId)
    .eq('profile_type', 'master')
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  const prev = (existing?.data as Record<string, unknown>) ?? {};

  // Deep-merge onboarding keys (client sends only what it has — keep DB keys not overwritten)
  const prevOnboarding  = (prev.onboarding  as Record<string, unknown>) ?? {};
  const newOnboarding   = (body.onboarding  as Record<string, unknown>) ?? {};
  const mergedOnboarding = { ...prevOnboarding, ...newOnboarding };

  // Countries: merge both sets (client may have picked up new ones offline)
  const prevCountries   = Array.isArray(prev.countriesTraveled)  ? prev.countriesTraveled  as string[] : [];
  const newCountries    = Array.isArray(body.countriesTraveled)   ? body.countriesTraveled  as string[] : [];
  const mergedCountries = Array.from(new Set([...prevCountries, ...newCountries]));

  // Newer wins for leaf objects (client always sends latest)
  const updated: Record<string, unknown> = {
    ...prev,
    onboarding:       mergedOnboarding,
    countriesTraveled: mergedCountries,
    lastSynced:       new Date().toISOString(),
  };

  if (body.profileDraft     !== undefined) updated.profileDraft     = body.profileDraft;
  if (body.generatedProfile !== undefined) updated.generatedProfile = body.generatedProfile;

  if (existing) {
    await db
      .from('ai_assistant_profiles')
      .update({ data: updated, version: (existing.version ?? 1) + 1, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
  } else {
    await db
      .from('ai_assistant_profiles')
      .insert({
        user_id:      userId,
        profile_type: 'master',
        data:         updated,
        version:      1,
        reason:       'client_sync',
      });
  }

  return json({ synced: true, countriesTraveled: mergedCountries });
};
