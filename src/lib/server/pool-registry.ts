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

// The live female onboarding (DrawnToStep + HowYouLiveStep) stores archetype-
// specific section picks under onboarding.vv_qa_responses / vv_how_you_live,
// keyed by section (e.g. `standards`, `emotional_openness`, `vibe`, `timeline`).
// Map those section keys into the four buckets the matcher's prompt reads.
// Private/intimate sections (chemistry, income, marital status) are intentionally
// EXCLUDED — they stay private to AI Bestie.
type PrefBucket = 'emotional' | 'lifestyle' | 'maturity' | 'dealbreakers';

const FEMALE_SECTION_BUCKET: Record<string, PrefBucket> = {
  // standards / values / non-negotiables → dealbreakers
  standards: 'dealbreakers', non_negotiables: 'dealbreakers', what_youre_done_with: 'dealbreakers',
  what_you_value: 'dealbreakers', core_values: 'dealbreakers', values: 'dealbreakers',
  good_friend_traits: 'dealbreakers',
  // emotional / connection / what she needs
  partner_energy: 'emotional', energy: 'emotional', emotional_openness: 'emotional',
  connection_style: 'emotional', what_you_need: 'emotional', energy_needed: 'emotional',
  love_language: 'emotional', how_you_show_up: 'emotional', partner_qualities: 'emotional',
  partner_fit: 'emotional', friend_energy: 'emotional', great_connection: 'emotional',
  what_you_hope_for: 'emotional', what_you_seek: 'emotional', appreciation: 'emotional',
  how_you_like_to_be_treated: 'emotional', what_matters: 'emotional', what_you_appreciate: 'emotional',
  // lifestyle / experiences / vibe
  experiences: 'lifestyle', lifestyle: 'lifestyle', vibe: 'lifestyle', activities: 'lifestyle',
  what_you_enjoy: 'lifestyle', what_excites_you: 'lifestyle', family_approach: 'lifestyle',
  religion: 'lifestyle',
  // readiness / maturity / pace
  this_chapter: 'maturity', what_is_different: 'maturity', comfort_level: 'maturity',
  life_stage: 'maturity', experience_level: 'maturity', what_slow_means: 'maturity',
  partnership_vision: 'maturity', relationship_approach: 'maturity', where_you_are: 'maturity',
  comfort_zone: 'maturity', social_style: 'maturity',
};

const FEMALE_PRIVATE_SECTIONS = new Set(['chemistry', 'income', 'marital_status']);

// Fallback relationship intent by archetype family (when no explicit `timeline` pick).
const FEMALE_INTENT_BY_ARCHETYPE: Record<string, string> = {
  casual_generous: 'casual', spoiled_casual: 'casual',
  hopeless_romantic: 'serious relationship', forever_focused: 'marriage-minded',
  traditional_matrimony: 'marriage / matrimony', rebound_healing: 'taking it slow — healing, no pressure',
  untouched_heart: 'sincere first relationship, unhurried', second_chapter: 'serious — a considered second chance',
  just_friends: 'friendship / platonic',
};

function asStrArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
  if (typeof v === 'string' && v.trim()) return [v];
  return [];
}

function distillFemalePreferenceModel(
  masterData: Record<string, unknown>,
  archetype = '',
): Record<string, unknown> {
  const onboarding = (masterData.onboarding ?? {}) as Record<string, unknown>;

  const buckets: Record<PrefBucket, Set<string>> = {
    emotional: new Set(), lifestyle: new Set(), maturity: new Set(), dealbreakers: new Set(),
  };
  let timelineIntent = '';

  // Real shape: section-keyed picks from the live DrawnTo + HowYouLive steps.
  for (const sourceKey of ['vv_qa_responses', 'vv_how_you_live']) {
    const src = onboarding[sourceKey];
    if (!src || typeof src !== 'object') continue;
    for (const [section, picks] of Object.entries(src as Record<string, unknown>)) {
      if (FEMALE_PRIVATE_SECTIONS.has(section)) continue;
      const labels = asStrArray(picks);
      if (!labels.length) continue;
      if (section === 'timeline') { timelineIntent = labels[0]; continue; }
      const bucket = FEMALE_SECTION_BUCKET[section];
      if (bucket) for (const l of labels) buckets[bucket].add(l);
    }
  }

  // Legacy snake_case shape (older rows) — merge in if present.
  for (const l of asStrArray(onboarding.emotional_signals ?? onboarding.vv_emotional_signals)) buckets.emotional.add(l);
  for (const l of asStrArray(onboarding.lifestyle_signals)) buckets.lifestyle.add(l);
  for (const l of asStrArray(onboarding.maturity_signals)) buckets.maturity.add(l);
  for (const l of asStrArray(onboarding.dealbreakers ?? onboarding.here_for_hard_nos)) buckets.dealbreakers.add(l);

  const archKey = archetype.replace(/_(man|woman)$/, '');
  const relationshipIntent =
    timelineIntent ||
    (typeof onboarding.relationship_timeline === 'string' ? onboarding.relationship_timeline : '') ||
    (typeof onboarding.dating_intent === 'string' ? onboarding.dating_intent : '') ||
    FEMALE_INTENT_BY_ARCHETYPE[archKey] ||
    '';

  return {
    dealbreakers:      [...buckets.dealbreakers],
    emotionalSignals:  [...buckets.emotional],
    lifestyleSignals:  [...buckets.lifestyle],
    maturitySignals:   [...buckets.maturity],
    relationshipIntent,
    // Do NOT include sensitiveTranslations / chemistry / income — those stay private to AI Bestie.
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
  const prefModel      = distillFemalePreferenceModel(masterData, user.archetype);
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
