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

// ── Onboarding answer resolution ──────────────────────────────────────────────
// The client stores Q&A + archetype-preference answers in
// user_master_profile.data.onboarding, but NESTED under localStorage-key names
// (vv_qa_responses, vv_romantic_preferences, vv_forever_preferences, …), each
// holding a map of question-id → answer. The distillers need flat access to
// individual answers by question id, so we merge every nested bag into one flat
// id→answer map. Q&A answers pulled straight from verified_vibe_verification
// (passed in as `qaResponses`) take priority, since those land server-side even
// before the client ever syncs the master profile.

function buildAnswerMap(
  masterData: Record<string, unknown>,
  qaResponses: Record<string, unknown> = {},
): Record<string, unknown> {
  const flat: Record<string, unknown> = {};
  const onboarding = (masterData.onboarding ?? {}) as Record<string, unknown>;

  const absorb = (bag: Record<string, unknown>) => {
    for (const [qid, ans] of Object.entries(bag ?? {})) {
      const empty = flat[qid] === undefined || flat[qid] === '' ||
        (Array.isArray(flat[qid]) && (flat[qid] as unknown[]).length === 0);
      if (empty && ans !== undefined && ans !== '') flat[qid] = ans;
    }
  };

  // 1. verified_vibe_verification responses (most reliable) win first.
  absorb(qaResponses);

  // 2. Merge every nested onboarding bag, plus any flat onboarding keys.
  for (const [key, val] of Object.entries(onboarding)) {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      absorb(val as Record<string, unknown>); // nested answer bag
    } else {
      absorb({ [key]: val }); // legacy / already-flat key
    }
  }

  return flat;
}

/** Collect one or more answers (string or string[]) into a clean signal array. */
function toSignalArray(...vals: unknown[]): string[] {
  const out: string[] = [];
  for (const v of vals) {
    if (Array.isArray(v)) {
      for (const item of v) if (typeof item === 'string' && item.trim()) out.push(item.trim());
    } else if (typeof v === 'string' && v.trim()) {
      for (const part of v.split(/[,;\n•]+/)) if (part.trim()) out.push(part.trim());
    }
  }
  return Array.from(new Set(out)).slice(0, 12);
}

/** First non-empty answer as a string (arrays are comma-joined). */
function firstString(...vals: unknown[]): string {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (Array.isArray(v) && v.length) {
      const joined = (v as unknown[]).filter((x) => typeof x === 'string' && x.trim()).join(', ');
      if (joined) return joined;
    }
  }
  return '';
}

// ── DrawnTo preference keys (archetype-specific "what you're drawn to") ────────
// Same key set for men and women — see DrawnToStep.svelte buildSections(). These
// are folded into emotionalSignals for both genders. Keys not present for a given
// archetype resolve to undefined and are skipped by toSignalArray.
const DRAWN_TO_KEYS = [
  'energy', 'experiences', 'appreciation', 'chemistry',
  'partner_energy', 'connection_style', 'love_language',
  'partner_qualities', 'partnership_vision', 'what_you_value',
  'core_values', 'family_approach', 'partner_fit',
  'energy_needed', 'what_slow_means', 'what_you_seek',
  'what_you_hope_for', 'what_matters', 'this_chapter', 'what_you_appreciate',
  'friend_energy', 'activities', 'great_connection', 'vibe',
] as const;

/** Pull every DrawnTo answer present in the flat answer map. */
function drawnToValues(a: Record<string, unknown>): unknown[] {
  return DRAWN_TO_KEYS.map((k) => a[k]);
}

// ── Distill male preference model ─────────────────────────────────────────────

function distillMalePreferenceSignals(
  masterData: Record<string, unknown>,
  qaResponses: Record<string, unknown> = {},
): Record<string, unknown> {
  const draft = (masterData.profileDraft ?? {}) as Record<string, unknown>;
  const a = buildAnswerMap(masterData, qaResponses);

  return {
    dealbreakers: toSignalArray(
      a.deal_breakers, a.red_flags, a.dealbreakers, a.here_for_hard_nos, draft.dealbreakers,
    ),
    lookingFor: firstString(
      a.relationship_timeline, a.dating_intent, a.future_intent, a.future_vision,
      a.future_romance, a.ideal_relationship, draft.lookingFor,
    ),
    emotionalSignals: toSignalArray(
      a.lifestyle_values, a.partner_qualities, a.partner_energy, a.relationship_energy,
      a.relationship_vibe, a.appreciation, a.show_appreciation, a.communication_expectation,
      a.communication_style, a.ideal_partner_energy, a.preferred_energy, a.partner_approach,
      a.chemistry_type,
      // DrawnTo "what you're drawn to" answers (all archetypes)
      ...drawnToValues(a),
    ),
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

function distillFemalePreferenceModel(
  masterData: Record<string, unknown>,
  qaResponses: Record<string, unknown> = {},
): Record<string, unknown> {
  const a = buildAnswerMap(masterData, qaResponses);

  // Extract normalized preference fields — avoid raw sensitiveTranslations
  const dealbreakers = toSignalArray(
    a.deal_breakers, a.red_flags, a.dealbreakers, a.here_for_hard_nos,
  );
  const emotionalSignals = toSignalArray(
    a.emotional_signals, a.vv_emotional_signals, a.partner_qualities, a.partner_energy,
    a.relationship_energy, a.relationship_vibe, a.appreciation, a.show_appreciation,
    a.communication_expectation, a.communication_style, a.ideal_partner_energy,
    a.preferred_energy, a.partner_approach, a.chemistry_type, a.ideal_partner_energy,
    // DrawnTo "what you're drawn to" answers (all archetypes)
    ...drawnToValues(a),
  );
  const lifestyleSignals = toSignalArray(
    a.lifestyle_signals, a.lifestyle_values, a.lifestyle_experiences, a.shared_experiences,
    a.lifestyle_today, a.lifestyle, a.lifestyle_profile, a.partner_lifestyle, a.career_alignment,
  );
  const maturitySignals = toSignalArray(
    a.maturity_signals, a.partner_maturity, a.relationship_standards, a.relationship_foundation,
    a.boundaries, a.boundary_expectation, a.partner_commitment_style, a.relationship_approach,
    a.partner_life_direction, a.partner_life_stage, a.partner_commitment_style,
  );
  const relationshipIntent = firstString(
    a.relationship_timeline, a.dating_intent, a.future_intent, a.future_vision,
    a.future_romance, a.ideal_relationship, a.future_possibility, a.future_friendship,
  );

  return {
    dealbreakers,
    emotionalSignals,
    lifestyleSignals,
    maturitySignals,
    relationshipIntent,
    // Do NOT include sensitiveTranslations — those stay private to AI Bestie
  };
}

// ── Load Q&A responses from the verification table ────────────────────────────
// The spending_or_qa step stores the user's onboarding answers (deal_breakers,
// lifestyle_values, relationship_timeline, dating_intent, …) keyed by question id.
// This lands server-side immediately, so it's a reliable source even if the client
// never synced the master profile.

async function loadQAResponses(db: any, userId: string): Promise<Record<string, unknown>> {
  const { data } = await db
    .from('verified_vibe_verification')
    .select('data')
    .eq('user_id', userId)
    .eq('step', 'spending_or_qa')
    .eq('status', 'completed')
    .maybeSingle();
  const responses = (data?.data as any)?.responses;
  return responses && typeof responses === 'object' ? responses : {};
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
  const qaResponses = await loadQAResponses(db, userId);

  const trustBand       = getTrustScoreBand(user.trust_score ?? 0);
  const matchProfile    = distillMaleMatchProfile(masterData);
  const prefSignals     = distillMalePreferenceSignals(masterData, qaResponses);
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
  const qaResponses = await loadQAResponses(db, userId);

  const trustBand      = getTrustScoreBand(user.trust_score ?? 0);
  const matchProfile   = distillFemaleMatchProfile(masterData);
  const prefModel      = distillFemalePreferenceModel(masterData, qaResponses);
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
