/**
 * Pool Registry Service
 *
 * Writes and refreshes entries in the unified vv_pool_profiles table
 * (assistant_type 'wingman' for men, 'bestie' for women). Called:
 *   - On verification completion (auto-enroll)
 *   - On any master-profile update (keep pool fresh)
 *
 * vv_pool_profiles is what AI Matchmaker reads. Keeping it fresh is the
 * only way Matchmaker has accurate data to score and rank pairs.
 *
 * SINGLE SOURCE: every field is distilled from user_master_profile.data
 * (its `onboarding` blob + `generatedProfile` + `verifiedProofs`). The old
 * direct read of verified_vibe_verification is gone — onboarding answers reach
 * the pool only via the master-profile mirror written in verify-step. The
 * legacy vv_pool_wingmen / vv_pool_besties tables are no longer written.
 */

import { getSupabase } from './supabase';
import { env } from '$env/dynamic/private';
import { buildAndStoreUserVectors } from './vector-builder';

// ── Trust score → band mapping ────────────────────────────────────────────────

export function getTrustScoreBand(score: number): string {
  if (score >= 95) return '95+';
  if (score >= 85) return '85-94';
  if (score >= 70) return '70-84';
  if (score >= 60) return '60-69';
  if (score >= 40) return '40-59';
  return '0-39';
}

// ── Distill the unified, Matchmaker-safe match_profile (gender-neutral) ────────
// "Who I am" (self / public-facing). List fields are derived from the user's
// onboarding picks (see Table 3 of the field-mapping); headline/publicIntro come
// from the AI generatedProfile when present. conversationHooks is intentionally
// NOT produced — the field is unused and has no onboarding source.

function distillMatchProfile(
  masterData: Record<string, unknown>,
  a: Record<string, unknown>,
  archetype: string,
): Record<string, unknown> {
  const gp = (masterData.generatedProfile ?? {}) as Record<string, unknown>;
  const proofs = (masterData.verifiedProofs ?? []) as Array<Record<string, unknown>>;
  const base = archetypeBase(archetype);

  // Pull top proof signals (label only, no raw financial data)
  const topProofSignals: string[] = proofs.flatMap((p) => {
    const insights = (p.insights ?? []) as Array<{ label?: string }>;
    return insights.slice(0, 2).map((i) => i.label ?? '').filter(Boolean);
  }).slice(0, 10);

  return {
    headline:                (gp.headline as string) ?? '',
    publicIntro:             (gp.publicIntro as string) ?? (gp.about as string) ?? '',
    intentStatement:         deriveIntent(archetype, a),
    values:                  deriveFromKeys(a, valuesSourceKeys(base), gp.values, gp.whatSheValues),
    lifestyleTags:           deriveFromKeys(a, lifestyleTagsSourceKeys(base), gp.lifestyleTags),
    personalityDescriptors:  deriveFromKeys(a, personalityDescriptorsSourceKeys(base), gp.personalityDescriptors),
    compatibilitySignals:    deriveFromKeys(a, compatibilitySignalsSourceKeys(base), gp.compatibilitySignals),
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

/**
 * The FULL onboarding-derived dealbreaker set: the archetype standards→trait
 * mapping plus the legacy literal answer keys. This is what the matchmaker used
 * before hard_nos existed, and it's exactly what we seed hard_nos with on first
 * collection so nothing is lost. Exported for unit testing.
 */
export function deriveAllDealbreakers(
  archetype: string,
  a: Record<string, unknown>,
  draft: Record<string, unknown> = {},
): string[] {
  return Array.from(new Set([
    // Derived from the archetype's standards / values / non-negotiables picks.
    ...deriveDealbreakers(archetype, a),
    // Legacy literal answers (old SpendingQA flow) kept as a fallback.
    ...toSignalArray(a.deal_breakers, a.red_flags, a.dealbreakers, a.here_for_hard_nos, draft.dealbreakers),
  ])).slice(0, 12);
}

/**
 * Resolve the effective hard_nos list for a user and whether a seed write is
 * needed. Pure (no DB) so it's unit-testable.
 *
 * The hard_nos column is the source of truth, with a NULL-sentinel that tells
 * "never seeded" apart from "deliberately cleared":
 *   - null/undefined → never seeded → seed from the onboarding-derived set and
 *     flag a write so it's materialised into the column.
 *   - an array (including []) → user-owned → returned verbatim, so edits,
 *     removals, and a deliberate "clear all" (empty list) all stick.
 */
export function resolveHardNos(
  archetype: string,
  a: Record<string, unknown>,
  draft: Record<string, unknown>,
  current: { hardNos: unknown },
): { hardNos: string[]; needsSeedWrite: boolean } {
  // An array (even empty) means the user has been seeded / has edited — respect it.
  if (Array.isArray(current.hardNos)) {
    const raw = (current.hardNos as unknown[]).map((h) => `${h}`.trim()).filter(Boolean);
    return { hardNos: raw, needsSeedWrite: false };
  }
  // null/undefined → never seeded → first collection from onboarding.
  const seeded = deriveAllDealbreakers(archetype, a, draft);
  return { hardNos: seeded, needsSeedWrite: seeded.length > 0 };
}

// ── Intent derivation (lookingFor / relationshipIntent) ───────────────────────
// Two tiers: (1) the archetype's explicit onboarding intent answer; (2) ONLY
// when no such answer exists (casual / spoiled / romantic lanes, where the
// archetype itself IS the intent) a fixed archetype phrase. The fallback can
// never override a real answer — it only fills a void.

// Lane defaults for the "Here For" intent line. The design contract is that when
// the owner hasn't stated an explicit intent, the default comes from the lane —
// so every archetype has a fallback phrase here, not just the casual lanes. These
// only fill a void; a real onboarding intent answer always wins (see deriveIntent).
const ARCHETYPE_INTENT_FALLBACK: Record<string, string> = {
  casual_generous:      'Casual, no-strings — experiences and generosity over labels',
  spoiled_casual:       'Casual, no-strings — wants to be treated well, no labels',
  hopeless_romantic:    'Serious, emotionally deep relationship',
  forever_focused:      'Serious, long-term — ready to build something real',
  rebound_healing:      'Taking it slow — healing, open to what grows',
  second_chapter:       'A fresh, intentional second chapter',
  untouched_heart:      'A genuine first connection, no rush',
  just_friends:         'Friendship-first, no pressure',
  traditional_matrimony:'Marriage-minded and family-aligned',
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

// ── match_profile self-field derivation (Table 3 mapping) ─────────────────────
// Positive, public-facing "who I am" picks. No negation. Source section keys
// differ per archetype; lanes without a relevant question resolve to [].

/** Collect answers for the given section keys (+ optional extras) into a signal array. */
function deriveFromKeys(a: Record<string, unknown>, keys: string[], ...extra: unknown[]): string[] {
  return toSignalArray(...keys.map((k) => a[k]), ...extra);
}

/** Self-values the user holds (public). */
function valuesSourceKeys(base: string): string[] {
  switch (base) {
    case 'forever_focused':       return ['what_you_value'];
    case 'traditional_matrimony': return ['core_values'];
    case 'untouched_heart':       return ['values'];
    case 'second_chapter':        return ['what_is_different'];
    case 'just_friends':          return ['good_friend_traits'];
    default:                      return ['standards']; // casual / spoiled / romantic / rebound
  }
}

/** Concrete lifestyle tags describing the user. */
function lifestyleTagsSourceKeys(base: string): string[] {
  switch (base) {
    case 'casual_generous':       return ['lifestyle', 'experiences'];
    case 'spoiled_casual':        return ['vibe', 'experiences'];
    case 'forever_focused':       return ['life_stage'];
    case 'traditional_matrimony': return ['lifestyle', 'religion', 'marital_status'];
    case 'rebound_healing':       return ['where_you_are'];
    case 'untouched_heart':       return ['experience_level'];
    case 'second_chapter':        return ['where_you_are'];
    case 'just_friends':          return ['social_style', 'what_you_enjoy'];
    default:                      return []; // hopeless_romantic has no lifestyle question
  }
}

/** Adjectives describing the user (self cards / show-up answers). */
function personalityDescriptorsSourceKeys(base: string): string[] {
  switch (base) {
    case 'casual_generous':       return ['lifestyle'];
    case 'spoiled_casual':        return ['vibe'];
    case 'hopeless_romantic':     return ['emotional_openness', 'how_you_show_up'];
    case 'forever_focused':       return ['life_stage', 'relationship_approach'];
    case 'traditional_matrimony': return ['core_values'];
    case 'rebound_healing':       return ['where_you_are'];
    case 'untouched_heart':       return ['experience_level', 'what_excites_you'];
    case 'second_chapter':        return ['what_is_different', 'where_you_are'];
    case 'just_friends':          return ['social_style'];
    default:                      return ['how_you_show_up', 'where_you_are'];
  }
}

/** Self-signals the matchmaker uses for compatibility (vision / approach). */
function compatibilitySignalsSourceKeys(base: string): string[] {
  switch (base) {
    case 'casual_generous':       return ['lifestyle', 'standards'];
    case 'spoiled_casual':        return ['vibe', 'how_you_like_to_be_treated'];
    case 'hopeless_romantic':     return ['how_you_show_up', 'emotional_openness'];
    case 'forever_focused':       return ['partnership_vision', 'relationship_approach'];
    case 'traditional_matrimony': return ['partner_fit', 'core_values', 'religion'];
    case 'rebound_healing':       return ['what_you_need', 'comfort_level'];
    case 'untouched_heart':       return ['what_you_need', 'values'];
    case 'second_chapter':        return ['this_chapter', 'what_you_need'];
    case 'just_friends':          return ['social_style', 'what_you_enjoy'];
    default:                      return ['relationship_approach', 'how_you_show_up'];
  }
}

/** Lifestyle signals the user wants in a partner / shared lifestyle (Drawn-to side). */
function lifestyleSignalsSourceKeys(base: string): string[] {
  switch (base) {
    case 'casual_generous':       return ['experiences', 'appreciation'];
    case 'spoiled_casual':        return ['how_you_like_to_be_treated', 'experiences'];
    case 'forever_focused':       return ['partnership_vision'];
    case 'traditional_matrimony': return ['partner_fit', 'family_approach', 'lifestyle'];
    case 'rebound_healing':       return ['what_you_need'];
    case 'untouched_heart':       return ['what_you_need'];
    case 'second_chapter':        return ['what_you_need'];
    case 'just_friends':          return ['activities', 'what_you_enjoy'];
    default:                      return []; // hopeless_romantic has no lifestyle axis
  }
}

// ── Distill the unified preferences model ("what I want") ──────────────────────

export function distillPreferences(
  masterData: Record<string, unknown>,
  a: Record<string, unknown>,
  archetype: string,
  hardNos: string[] | null = null,
): Record<string, unknown> {
  const draft = (masterData.profileDraft ?? {}) as Record<string, unknown>;
  const base = archetypeBase(archetype);

  return {
    lookingFor: deriveIntent(archetype, a, draft.lookingFor),
    // hard_nos is the canonical, user-owned dealbreaker list once seeded — use it
    // verbatim so bio edits/removals are live truth. Before seeding (hardNos null)
    // fall back to the onboarding-derived set for back-compat.
    dealbreakers: hardNos != null
      ? Array.from(new Set(hardNos.map((s) => s.trim()).filter(Boolean))).slice(0, 12)
      : deriveAllDealbreakers(archetype, a, draft),
    emotionalSignals: toSignalArray(
      a.emotional_signals, a.vv_emotional_signals, a.lifestyle_values, a.partner_qualities,
      a.partner_energy, a.relationship_energy, a.relationship_vibe, a.appreciation,
      a.show_appreciation, a.communication_expectation, a.communication_style,
      a.ideal_partner_energy, a.preferred_energy, a.partner_approach, a.chemistry_type,
      // DrawnTo "what you're drawn to" answers (all archetypes)
      ...drawnToValues(a),
    ),
    lifestyleSignals: toSignalArray(
      ...lifestyleSignalsSourceKeys(base).map((k) => a[k]),
      // Legacy keys from the old SpendingQA flow.
      a.lifestyle_signals, a.lifestyle_experiences, a.shared_experiences,
      a.lifestyle_today, a.lifestyle_profile, a.partner_lifestyle, a.career_alignment,
    ),
    maturitySignals: deriveMaturitySignals(archetype, a),
  };
}

// ── Public: refresh a user's unified pool entry ───────────────────────────────
// Single source: everything is distilled from user_master_profile.data. Writes
// the gender-neutral vv_pool_profiles row (assistant_type wingman | bestie).
// prefer_not_to_say users are NOT enrolled. The legacy vv_pool_wingmen /
// vv_pool_besties tables are intentionally no longer written.

export async function refreshPoolEntry(userId: string): Promise<void> {
  const db = getSupabase() as any;

  const { data: user, error: userErr } = await db
    .from('verified_vibe_users')
    .select('archetype, trust_score, city, gender, hard_nos, here_for_title, here_for_desc')
    .eq('id', userId)
    .single();

  if (userErr || !user) return;
  const assistantType =
    user.gender === 'man' ? 'wingman' : user.gender === 'woman' ? 'bestie' : null;
  if (!assistantType) return; // prefer_not_to_say → not enrolled

  const { data: masterRow } = await db
    .from('user_master_profile')
    .select('data')
    .eq('user_id', userId)
    .maybeSingle();

  const masterData = (masterRow?.data ?? {}) as Record<string, unknown>;
  const a = buildAnswerMap(masterData); // master_profile.onboarding only — no verification read
  const draft = (masterData.profileDraft ?? {}) as Record<string, unknown>;

  // hard_nos = single source of truth for dealbreakers. When it's empty we seed
  // it from the onboarding-derived set; once it has entries it's user-owned. The
  // resolved list is what feeds the matchmaker projection below.
  const { hardNos, needsSeedWrite } = resolveHardNos(
    user.archetype, a, draft,
    { hardNos: user.hard_nos },
  );
  if (needsSeedWrite) {
    await db.from('verified_vibe_users')
      .update({ hard_nos: hardNos })
      .eq('id', userId);
  }

  // Seed the user-facing "Here For" columns from onboarding when the owner hasn't
  // written their own (mirrors the hard_nos seed above). Title = the derived
  // relationship intent (archetype intent answer, or a lane fallback); description
  // = their "what you're looking for" picks. A non-empty column is owner-owned and
  // never overwritten — so a user who clears it deliberately gets re-seeded, same
  // trade-off as hard_nos.
  const hereForEmpty =
    !`${user.here_for_title ?? ''}`.trim() && !`${user.here_for_desc ?? ''}`.trim();
  if (hereForEmpty) {
    const intent = deriveIntent(user.archetype, a);
    const desc   = toSignalArray(a.what_you_seek).join(' · ');
    if (intent || desc) {
      await db.from('verified_vibe_users')
        .update({
          here_for_title: intent || null,
          here_for_desc:  desc   || null,
        })
        .eq('id', userId);
    }
  }

  const trustBand    = getTrustScoreBand(user.trust_score ?? 0);
  const matchProfile = distillMatchProfile(masterData, a, user.archetype);
  const preferences  = distillPreferences(masterData, a, user.archetype, hardNos);
  const city         = (masterData.identity as any)?.city ?? user.city ?? null;

  await db.from('vv_pool_profiles').upsert(
    {
      user_id:             userId,
      assistant_type:      assistantType,
      archetype:           user.archetype,
      trust_score_band:    trustBand,
      city:                city,
      match_profile:       matchProfile,
      preferences:         preferences,
      availability_status: 'active',
      last_updated:        new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  // Phase 3: when the vector matcher is on, keep the user's value vectors fresh on
  // profile change (the single LLM step). Fire-and-forget so it never blocks the
  // pool save; gated so it adds no cost while the legacy matcher is the default.
  if (env.MATCHMAKER_V2 === 'true') {
    buildAndStoreUserVectors(userId).catch(() => {});
  }
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

  await refreshPoolEntry(userId);

  // Testing-period beta invite: a man who just entered the pool may have been
  // referred via a woman's share link. Redeem it now. Dynamic import avoids a
  // module-load cycle (beta-invite → matchmaker-service). Idempotent + non-fatal
  // so it can never block enrollment.
  try {
    const { redeemBetaInviteIfEligible } = await import('./beta-invite');
    await redeemBetaInviteIfEligible(userId);
  } catch (e) {
    console.error('[pool-registry] beta invite redeem failed (non-fatal):', e);
  }
}

// ── Public: lite beta match — fire the referral match before full verification ─
// Testing-period lever: a referred man should match his referrer the moment he
// has a real, usable profile — name, age, city and ≥3 photos — WITHOUT waiting
// for the full 3-step verification (liveness + Q&A + photos) the matchmaker pool
// normally requires. This lowers ONLY the beta referral bar; enrollInPoolIfVerified
// still governs general matchmaker eligibility for everyone else.
//
// Called from the photos verify-step, so the photos row is already persisted; the
// client saves identity (name/age/city) just before that POST. Idempotent (the
// redeem no-ops when a match already exists) and non-fatal.
export async function redeemBetaInviteIfProfileReady(userId: string): Promise<void> {
  const db = getSupabase() as any;

  const { data: user } = await db
    .from('verified_vibe_users')
    .select('gender, first_name, age, city')
    .eq('id', userId)
    .maybeSingle();
  if (!user || user.gender !== 'man') return; // referral match is man → woman only

  const name = `${user.first_name ?? ''}`.trim();
  const city = `${user.city ?? ''}`.trim();
  const age  = typeof user.age === 'number' ? user.age : Number.parseInt(`${user.age ?? ''}`, 10);
  // saveGenderArchetype seeds placeholders ('New member' / 18 / '') on the brand-new
  // row; a real profile has overwritten name + city. Age can legitimately be 18, so
  // it's only range-checked — name/city are what prove the profile was actually filled.
  const nameReady = name.length > 0 && name !== 'New member';
  const cityReady = city.length > 0;
  const ageReady  = Number.isFinite(age) && age >= 18 && age <= 99;
  if (!nameReady || !cityReady || !ageReady) return;

  // Require the photos step complete with ≥3 photos (men upload 3+).
  const { data: photoRow } = await db
    .from('verified_vibe_verification')
    .select('data')
    .eq('user_id', userId)
    .eq('step', 'photos')
    .eq('status', 'completed')
    .maybeSingle();
  const photoCount = Number((photoRow?.data as any)?.photoCount ?? 0);
  if (!photoRow || photoCount < 3) return;

  // Give the man a pool entry (so the matchmaker + bestie have his distilled
  // profile), then redeem the referral into an instant mutual match.
  await refreshPoolEntry(userId);
  try {
    const { redeemBetaInviteIfEligible } = await import('./beta-invite');
    await redeemBetaInviteIfEligible(userId);
  } catch (e) {
    console.error('[pool-registry] lite beta redeem failed (non-fatal):', e);
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
