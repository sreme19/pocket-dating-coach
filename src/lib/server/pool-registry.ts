/**
 * Pool Registry Service
 *
 * Writes and refreshes entries in vv_pool_wingmen (male users) and
 * vv_pool_besties (female users). Called:
 *   - On verification completion (auto-enroll)
 *   - On any master-profile update (keep pool fresh)
 *
 * These tables are what AI Matchmaker reads. Keeping them fresh is the
 * only way Matchmaker has accurate data to score and rank pairs.
 */

import { getSupabase } from './supabase';

// ── Trust score → band mapping ────────────────────────────────────────────────

export function getTrustScoreBand(score: number): string {
  if (score >= 95) return '95+';
  if (score >= 85) return '85-94';
  if (score >= 70) return '70-84';
  if (score >= 60) return '60-69';
  if (score >= 40) return '40-59';
  return '0-39';
}

// ── Distill male master profile into a Matchmaker-safe match profile ──────────

function distillMaleMatchProfile(masterData: Record<string, unknown>): Record<string, unknown> {
  const identity = (masterData.identity ?? {}) as Record<string, unknown>;
  const gp = (masterData.generatedProfile ?? {}) as Record<string, unknown>;
  const proofs = (masterData.verifiedProofs ?? []) as Array<Record<string, unknown>>;

  // Pull top proof signals (label + category, no raw financial data)
  const topProofSignals: string[] = proofs.flatMap((p) => {
    const insights = (p.insights ?? []) as Array<{ label?: string }>;
    return insights.slice(0, 2).map((i) => i.label ?? '').filter(Boolean);
  }).slice(0, 10);

  return {
    archetype:               identity.archetype ?? '',
    city:                    identity.city ?? '',
    bio:                     gp.about ?? '',
    intentStatement:         gp.intentStatement ?? '',
    personalityDescriptors:  Array.isArray(gp.personalityDescriptors) ? gp.personalityDescriptors : [],
    lifestyleTags:           Array.isArray(gp.lifestyleTags) ? gp.lifestyleTags : [],
    countriesTraveled:       Array.isArray(masterData.countriesTraveled) ? masterData.countriesTraveled : [],
    topProofSignals,
    proofCategories:         proofs.map((p) => p.category).filter(Boolean),
  };
}

// ── Distill male preference model ─────────────────────────────────────────────

function distillMalePreferenceSignals(masterData: Record<string, unknown>): Record<string, unknown> {
  const onboarding = (masterData.onboarding ?? {}) as Record<string, unknown>;

  // Preferences may be stored in onboarding QA responses or profile draft
  const draft = (masterData.profileDraft ?? {}) as Record<string, unknown>;

  return {
    dealbreakers:     (onboarding.dealbreakers ?? draft.dealbreakers ?? []) as string[],
    lookingFor:       (onboarding.relationship_timeline ?? draft.lookingFor ?? '') as string,
    emotionalSignals: (onboarding.lifestyle_values ?? []) as string[],
  };
}

// ── Distill female master profile ─────────────────────────────────────────────

function distillFemaleMatchProfile(masterData: Record<string, unknown>): Record<string, unknown> {
  const gp = (masterData.generatedProfile ?? {}) as Record<string, unknown>;
  const proofs = (masterData.verifiedProofs ?? []) as Array<Record<string, unknown>>;

  const topProofSignals: string[] = proofs.flatMap((p) => {
    const insights = (p.insights ?? []) as Array<{ label?: string }>;
    return insights.slice(0, 2).map((i) => i.label ?? '').filter(Boolean);
  }).slice(0, 8);

  return {
    headline:             gp.headline ?? '',
    publicIntro:          gp.publicIntro ?? gp.about ?? '',
    whatSheValues:        Array.isArray(gp.whatSheValues) ? gp.whatSheValues : [],
    conversationHooks:    Array.isArray(gp.conversationHooks) ? gp.conversationHooks : [],
    compatibilitySignals: Array.isArray(gp.compatibilitySignals) ? gp.compatibilitySignals : [],
    topProofSignals,
    proofCategories:      proofs.map((p) => p.category).filter(Boolean),
  };
}

// ── Distill female preference model (normalize, no raw sensitive translations) ─

function distillFemalePreferenceModel(masterData: Record<string, unknown>): Record<string, unknown> {
  const onboarding = (masterData.onboarding ?? {}) as Record<string, unknown>;

  // Extract normalized preference fields — avoid raw sensitiveTranslations
  const emotionalSignals  = (onboarding.emotional_signals ?? onboarding.vv_emotional_signals ?? []) as string[];
  const lifestyleSignals  = (onboarding.lifestyle_signals ?? []) as string[];
  const maturitySignals   = (onboarding.maturity_signals ?? []) as string[];
  const dealbreakers      = (onboarding.dealbreakers ?? onboarding.here_for_hard_nos ?? []) as string[];
  const relationshipIntent = (onboarding.relationship_timeline ?? onboarding.dating_intent ?? '') as string;

  return {
    dealbreakers,
    emotionalSignals,
    lifestyleSignals,
    maturitySignals,
    relationshipIntent,
    // Do NOT include sensitiveTranslations — those stay private to AI Bestie
  };
}

// ── Public: refresh male user's pool entry ────────────────────────────────────

export async function refreshWingmanPoolEntry(userId: string): Promise<void> {
  const db = getSupabase() as any;

  // Load user base data
  const { data: user, error: userErr } = await db
    .from('verified_vibe_users')
    .select('archetype, trust_score, city, gender')
    .eq('id', userId)
    .single();

  if (userErr || !user || user.gender !== 'man') return;

  // Load master profile
  const { data: masterRow } = await db
    .from('user_master_profile')
    .select('data')
    .eq('user_id', userId)
    .maybeSingle();

  const masterData = (masterRow?.data ?? {}) as Record<string, unknown>;

  const trustBand       = getTrustScoreBand(user.trust_score ?? 0);
  const matchProfile    = distillMaleMatchProfile(masterData);
  const prefSignals     = distillMalePreferenceSignals(masterData);
  const city            = (masterData.identity as any)?.city ?? user.city ?? null;

  await db.from('vv_pool_wingmen').upsert(
    {
      user_id:            userId,
      archetype:          user.archetype,
      trust_score_band:   trustBand,
      city:               city,
      match_profile:      matchProfile,
      preference_signals: prefSignals,
      availability_status: 'active',
      last_updated:       new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );
}

// ── Public: refresh female user's pool entry ──────────────────────────────────

export async function refreshBestiePoolEntry(userId: string): Promise<void> {
  const db = getSupabase() as any;

  const { data: user, error: userErr } = await db
    .from('verified_vibe_users')
    .select('archetype, trust_score, city, gender')
    .eq('id', userId)
    .single();

  if (userErr || !user || user.gender !== 'woman') return;

  const { data: masterRow } = await db
    .from('user_master_profile')
    .select('data')
    .eq('user_id', userId)
    .maybeSingle();

  const masterData = (masterRow?.data ?? {}) as Record<string, unknown>;

  const trustBand      = getTrustScoreBand(user.trust_score ?? 0);
  const matchProfile   = distillFemaleMatchProfile(masterData);
  const prefModel      = distillFemalePreferenceModel(masterData);
  const city           = (masterData.identity as any)?.city ?? user.city ?? null;

  await db.from('vv_pool_besties').upsert(
    {
      user_id:             userId,
      archetype:           user.archetype,
      trust_score_band:    trustBand,
      city:                city,
      match_profile:       matchProfile,
      preference_model:    prefModel,
      availability_status: 'active',
      last_updated:        new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );
}

// ── Public: auto-enroll on verification completion ────────────────────────────
// Called from verify-step endpoint when all 4 steps are complete.

export async function enrollInPoolIfVerified(userId: string): Promise<void> {
  const db = getSupabase() as any;

  // Count completed steps
  const { data: steps } = await db
    .from('verified_vibe_verification')
    .select('step, status')
    .eq('user_id', userId)
    .eq('status', 'completed');

  const completedSteps = new Set((steps ?? []).map((s: any) => s.step));
  const required = ['id', 'liveness', 'photos', 'spending_or_qa'];
  const allDone = required.every((s) => completedSteps.has(s));

  if (!allDone) return;

  // Determine gender and call the right refresh
  const { data: user } = await db
    .from('verified_vibe_users')
    .select('gender')
    .eq('id', userId)
    .single();

  if (!user) return;

  if (user.gender === 'man') {
    await refreshWingmanPoolEntry(userId);
  } else if (user.gender === 'woman') {
    await refreshBestiePoolEntry(userId);
  }
}

// ── Public: update last_active_at ─────────────────────────────────────────────

export async function touchLastActive(userId: string): Promise<void> {
  const db = getSupabase() as any;
  await db
    .from('verified_vibe_users')
    .update({ last_active_at: new Date().toISOString() })
    .eq('id', userId);
}
