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

// ── Dealbreaker derivation (second mapping layer) ─────────────────────────────
// Onboarding never asks "what's your dealbreaker?" directly — it collects
// positively-framed requirements (the standards / values / non-negotiables /
// "done settling for" sections). Taking those literally is wrong (a dealbreaker
// of "Honest communication" is nonsense), so each pick is translated into the
// trait that VIOLATES it. Source section(s) differ per archetype; just_friends
// collects no standards and stays empty by design.

// Pick label (lowercased) → derived dealbreaker. One concept can be fed by
// several differently-worded picks across archetypes.
const DEALBREAKER_MAP: Record<string, string> = {
  // Honesty / communication
  'honest communication':              'Dishonesty',
  'honesty':                           'Dishonesty',
  'honest & direct':                   'Dishonesty',
  'direct and honest':                 'Dishonesty',
  'honesty above everything':          'Dishonesty',
  'consistent communication':          'Inconsistent communication',
  "people who can't communicate":      'Poor communicator',
  'emotional intelligence':            'Emotionally unintelligent',
  // Respect / boundaries / privacy
  'mutual respect':                    'Disrespect',
  'respect':                           'Disrespect',
  'respectful & grounded':             'Disrespect',
  'respect for boundaries':            'Disrespects boundaries',
  'respects my boundaries':            'Disrespects boundaries',
  "respects where i'm at":             'Disrespects boundaries / rushes',
  'discretion matters':                'Indiscreet',
  'privacy respected':                 "Doesn't respect privacy",
  // Drama / games / manipulation
  'drama-free':                        'Brings drama',
  'drama-free only':                   'Brings drama',
  'drama-free love':                   'Brings drama',
  'no drama':                          'Brings drama',
  'no games':                          'Plays games',
  'no games or pressure':              'Plays games / pressures',
  'no games or manipulation':          'Plays games / manipulative',
  'no manipulation':                   'Manipulative',
  // Clarity / intent
  'clear expectations':                'Mixed signals / unclear intentions',
  'clear expectations from the start': 'Mixed signals / unclear intentions',
  'mixed signals':                     'Mixed signals',
  'knowing what they want':            "Doesn't know what they want",
  // Loyalty / availability / maturity
  'loyalty':                           'Disloyal / unfaithful',
  'faithfulness and loyalty':          'Disloyal / unfaithful',
  'emotional maturity':                'Emotional immaturity',
  'emotional availability':            'Emotionally unavailable',
  'emotional unavailability':          'Emotionally unavailable',
  'emotional steadiness':              'Emotionally volatile',
  // Consistency / effort / priority
  'consistency':                       'Inconsistency',
  'consistent effort':                 'Inconsistent / low effort',
  'consistent and reliable':           'Inconsistent / unreliable',
  'hot and cold behaviour':            'Hot and cold',
  'half-in, half-out energy':          'Half-in, half-out',
  'making each other a priority':      'Makes you an afterthought',
  'being an afterthought':             'Makes you an afterthought',
  'one-sided effort':                  'One-sided effort',
  'surface-level connections':         'Surface-level only',
  'love that drains instead of fills': 'Emotionally draining',
  "being each other's safe place":     'Emotionally unsafe',
  'intentional romance':               'No effort / unromantic',
  // Readiness
  'ready to actually show up':         'Flaky / not ready',
  'not in a hurry to perform':         'Rushing / performative',
  // Care / warmth / sincerity
  'kindness':                          'Unkind',
  'genuine care':                      'Uncaring',
  'warmth':                            'Cold / distant',
  'genuine warmth':                    'Cold / distant',
  'being genuinely real':              'Fake / performative',
  'sincerity over polish':             'Insincere',
  'mutual curiosity':                  'Self-absorbed',
  // Pace
  'taking time':                       'Rushes / pressures',
  'patient without resentment':        'Impatient / resentful',
  'low-pressure energy':               'Pushy / high-pressure',
  // Trust / safety
  'safety & trust first':              'Untrustworthy',
  'verified profiles preferred':       'Unverified / fake profile',
  // Growth
  'growth mindset':                    'Complacent / no growth',
  'growing together':                  'Complacent / stagnant',
  // Money / family / children
  'financial responsibility':          'Financially irresponsible',
  'financially responsible':           'Financially irresponsible',
  'aligned on children':               'Misaligned on children',
  'parenting-aligned':                 'Misaligned on parenting',
  'family-oriented':                   'Not family-oriented',
  'family-first':                      'Not family-oriented',
  // Matrimony — core values (culture / tradition / community / roots).
  // 'religiously compatible' is handled specially below (uses the actual religion).
  'culturally aligned':                'Culturally incompatible',
  'traditional values':               'Rejects tradition',
  'community-oriented':                'Isolated / not community-minded',
  'grounded in roots':                 'Disconnected from roots',
  // Matrimony — lifestyle facts (concrete, the most filterable dealbreakers)
  'non-smoker':                        'Smoker',
  'non-drinker':                       'Drinker',
  'vegetarian':                        'Non-vegetarian',
  'religiously practicing':            'Non-practicing',
  'fitness-focused':                   'Unhealthy / not fitness-focused',
};

/** Strip the gender suffix so 'forever_focused_man' → 'forever_focused'. */
function archetypeBase(archetype: string): string {
  return (archetype || '').replace(/_(man|woman)$/, '');
}

/** Which onboarding section keys feed an archetype's dealbreakers. */
function dealbreakerSourceKeys(archetype: string): string[] {
  switch (archetypeBase(archetype)) {
    case 'just_friends':          return [];                                    // none by design
    case 'hopeless_romantic':     return ['what_youre_done_with', 'standards']; // 'done settling for' is already negative
    case 'forever_focused':       return ['non_negotiables'];
    case 'second_chapter':        return ['non_negotiables'];
    case 'untouched_heart':       return ['values'];
    case 'traditional_matrimony': return ['core_values', 'lifestyle'];          // + religion (special-cased)
    case 'casual_generous':       // casual_generous_man
    case 'spoiled_casual':        // spoiled_casual_woman
    case 'rebound_healing':       return ['standards'];
    default:                      return ['standards', 'non_negotiables', 'values']; // safe net
  }
}

/**
 * Translate a user's positive onboarding picks into the dealbreakers they imply.
 * just_friends → []. traditional_matrimony additionally turns its concrete
 * religion pick into a precise "different religion" dealbreaker.
 *
 * Exported so the dealbreaker mapping can be unit-tested against the exact
 * onboarding labels without going through a DB round-trip.
 */
export function deriveDealbreakers(archetype: string, a: Record<string, unknown>): string[] {
  const base = archetypeBase(archetype);
  if (base === 'just_friends') return [];

  const out: string[] = [];
  for (const key of dealbreakerSourceKeys(archetype)) {
    for (const label of toSignalArray(a[key])) {
      const db = DEALBREAKER_MAP[label.toLowerCase().trim()];
      if (db) out.push(db);
    }
  }

  // Matrimony: if religious compatibility is a stated value, the concrete
  // dealbreaker is a partner of a DIFFERENT religion — use their actual pick.
  if (base === 'traditional_matrimony') {
    const valuesReligion = toSignalArray(a.core_values)
      .some((v) => v.toLowerCase().includes('religiously compatible'));
    if (valuesReligion) {
      const religion = firstString(a.religion);
      out.push(religion ? `Different religion (non-${religion})` : 'Religiously incompatible');
    }
  }

  return Array.from(new Set(out)).slice(0, 12);
}

// ── Intent derivation (lookingFor / relationshipIntent) ───────────────────────
// Two tiers: (1) the archetype's explicit onboarding intent answer; (2) ONLY
// when no such answer exists (casual / spoiled / romantic lanes, where the
// archetype itself IS the intent) a fixed archetype phrase. The fallback can
// never override a real answer — it only fills a void.

const ARCHETYPE_INTENT_FALLBACK: Record<string, string> = {
  casual_generous:   'Casual, no-strings — experiences and generosity over labels',
  spoiled_casual:    'Casual, no-strings — wants to be treated well, no labels',
  hopeless_romantic: 'Serious, emotionally deep relationship',
};

/** Onboarding answer keys that state relationship goal/timeline, per archetype. */
function intentSourceKeys(archetype: string): string[] {
  switch (archetypeBase(archetype)) {
    case 'forever_focused':       return ['life_stage', 'timeline'];
    case 'rebound_healing':       return ['comfort_level', 'where_you_are'];
    case 'second_chapter':        return ['where_you_are', 'this_chapter'];
    case 'untouched_heart':       return ['experience_level'];
    case 'just_friends':          return ['comfort_zone'];
    case 'traditional_matrimony': return ['connection_style', 'marital_status'];
    default:                      return []; // casual / spoiled / romantic → fallback phrase
  }
}

/** Resolve a single relationship-intent string: explicit answer first, then fallback. */
export function deriveIntent(archetype: string, a: Record<string, unknown>, ...extra: unknown[]): string {
  const explicit = firstString(
    ...intentSourceKeys(archetype).map((k) => a[k]),
    // Legacy keys from the old SpendingQA flow.
    a.relationship_timeline, a.dating_intent, a.future_intent, a.future_vision,
    a.future_romance, a.ideal_relationship,
    ...extra,
  );
  return explicit || (ARCHETYPE_INTENT_FALLBACK[archetypeBase(archetype)] ?? '');
}

// ── Maturity-signal derivation (women) ────────────────────────────────────────
// The maturity / standards qualities she values in a partner. Unlike dealbreakers
// these need NO negation — the picks are already positive. just_friends is
// platonic, so it has no romantic-maturity axis and stays empty by design.

/** Onboarding answer keys carrying maturity/standards, per archetype. */
function maturitySourceKeys(archetype: string): string[] {
  switch (archetypeBase(archetype)) {
    case 'just_friends':          return [];                                    // platonic — empty by design
    case 'forever_focused':       return ['non_negotiables', 'relationship_approach'];
    case 'second_chapter':        return ['non_negotiables', 'what_is_different'];
    case 'untouched_heart':       return ['values'];
    case 'traditional_matrimony': return ['partner_fit', 'core_values', 'connection_style'];
    case 'spoiled_casual':        // spoiled_casual_woman
    case 'hopeless_romantic':
    case 'rebound_healing':       return ['standards'];
    default:                      return ['standards', 'non_negotiables', 'values']; // safe net
  }
}

export function deriveMaturitySignals(archetype: string, a: Record<string, unknown>): string[] {
  if (archetypeBase(archetype) === 'just_friends') return [];
  return toSignalArray(
    ...maturitySourceKeys(archetype).map((k) => a[k]),
    // Legacy keys from the old SpendingQA flow.
    a.maturity_signals, a.partner_maturity, a.relationship_standards, a.boundaries,
    a.partner_commitment_style, a.relationship_foundation,
  );
}

// ── Distill male preference model ─────────────────────────────────────────────

function distillMalePreferenceSignals(
  masterData: Record<string, unknown>,
  qaResponses: Record<string, unknown> = {},
  archetype = '',
): Record<string, unknown> {
  const draft = (masterData.profileDraft ?? {}) as Record<string, unknown>;
  const a = buildAnswerMap(masterData, qaResponses);

  return {
    dealbreakers: Array.from(new Set([
      // Derived from the archetype's standards / values / non-negotiables picks.
      ...deriveDealbreakers(archetype, a),
      // Legacy literal answers (old SpendingQA flow) kept as a fallback.
      ...toSignalArray(a.deal_breakers, a.red_flags, a.dealbreakers, a.here_for_hard_nos, draft.dealbreakers),
    ])).slice(0, 12),
    lookingFor: deriveIntent(archetype, a, draft.lookingFor),
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
  archetype = '',
): Record<string, unknown> {
  const a = buildAnswerMap(masterData, qaResponses);

  // Extract normalized preference fields — avoid raw sensitiveTranslations
  const dealbreakers = Array.from(new Set([
    // Derived from the archetype's standards / values / non-negotiables picks.
    ...deriveDealbreakers(archetype, a),
    // Legacy literal answers (old SpendingQA flow) kept as a fallback.
    ...toSignalArray(a.deal_breakers, a.red_flags, a.dealbreakers, a.here_for_hard_nos),
  ])).slice(0, 12);
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
  const maturitySignals = deriveMaturitySignals(archetype, a);
  const relationshipIntent = deriveIntent(archetype, a, a.future_possibility, a.future_friendship);

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
  const prefSignals     = distillMalePreferenceSignals(masterData, qaResponses, user.archetype);
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
  const prefModel      = distillFemalePreferenceModel(masterData, qaResponses, user.archetype);
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
  // 'id' (government ID) is only required for spending/wealth proof uploads,
  // not for pool eligibility. The 3 Safety Check steps are sufficient.
  const required = ['liveness', 'photos', 'spending_or_qa'];
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
