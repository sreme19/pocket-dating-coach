/**
 * preferences-initializer.ts
 *
 * Deterministic seeding of PreferencesProfile for female users based on their
 * onboarding archetype and free-text profile fields (about / looking).
 *
 * No AI or external calls — pure data transformation.
 *
 * Archetypes supported:
 *   spoilt_woman       — values effort, quality, financial stability, tasteful experiences
 *   safety_first_woman — prioritises safety, consistency, no pressure, honesty
 */

import type { PreferencesProfile } from './profile-service';
import { updatePreferences, loadPreferences } from './profile-service';

// ─── Archetype resolution ─────────────────────────────────────────────────────

// The DB can store either the enum values ('spoilt_woman', 'safety_first_woman')
// OR the rich descriptive labels used in seed data ('The NRI / Diaspora-Bridging Woman', etc.)
// We normalise both to our two seed categories.
type FemaleArchetype = 'spoilt_woman' | 'safety_first_woman';

/**
 * Map any archetype string → one of our two female seed categories.
 * Safety-first keywords → safety_first_woman.
 * Everything else → spoilt_woman (high-effort, quality expectations).
 * This covers both enum values AND the descriptive labels in seed data.
 */
export function resolveFemaleArchetype(archetype: string): FemaleArchetype {
  const lower = archetype.toLowerCase();
  const safetyKeywords = [
    'safety', 'independent', 'feminist', 'traditional', 'family-first',
    'divorced', 'spiritual', 'therapy', 'bdsm', 'ethically', 'polyamorous',
    'awakened', 'monogamish', 'swinger', 'serial dater', 'time pressure'
  ];
  if (safetyKeywords.some(kw => lower.includes(kw))) return 'safety_first_woman';
  return 'spoilt_woman';
}

// ─── Archetype seed map ──────────────────────────────────────────────────────

/**
 * Base PreferencesProfile for each female archetype.
 *
 * These represent the "factory defaults" — signals and limits that are almost
 * universally true for a user of this archetype before any conversation data
 * has been collected.  They are intentionally opinionated but conservative so
 * they never put words in the user's mouth that could feel wrong.
 */
export const ARCHETYPE_SEED_PREFERENCES: Record<FemaleArchetype, Omit<PreferencesProfile, 'updatedAt'>> = {
  spoilt_woman: {
    emotionalSignals: [
      'Makes genuine effort to plan and organise dates',
      'Shows appreciation and recognition in tangible ways',
      'Is attentive and present — not distracted or half-hearted',
      'Pursues her intentionally, not lazily'
    ],
    lifestyleSignals: [
      'Financially stable and comfortable with quality experiences',
      'Enjoys or is open to fine dining and tasteful outings',
      'Takes pride in his appearance and presentation',
      'Has a clear direction in life — career, ambition, or purpose'
    ],
    maturitySignals: [
      'Understands that effort and investment are forms of respect',
      'Does not sulk or get resentful when she has standards',
      'Comfortable leading when it comes to planning and logistics',
      'Secure enough not to be threatened by her expectations'
    ],
    boundaries: [
      'Does not tolerate being made to feel high-maintenance for having standards',
      'Will not accept last-minute, low-effort date suggestions',
      'Expects to be treated as a priority, not an afterthought'
    ],
    dealbreakers: [
      'Financial instability or chronic complaints about money',
      'Cheap or stingy behaviour on dates — especially early on',
      'Treating her standards as a problem rather than a feature',
      'Passive or directionless lifestyle with no ambition'
    ],
    privateCompatibilityNotes: []
  },

  safety_first_woman: {
    emotionalSignals: [
      'Consistent and predictable — she can count on him showing up',
      'Honest and transparent, even when it is uncomfortable',
      'Creates a calm, low-pressure environment',
      'Patient — does not rush emotional or physical intimacy',
      'Listens well and does not dismiss her feelings'
    ],
    lifestyleSignals: [
      'Prefers clear, defined plans over spontaneous or unpredictable outings',
      'Comfortable meeting in public, well-lit, or familiar places early on',
      'Respects her pace and does not push boundaries around location or timing',
      'Communicates ahead of time — no last-minute changes without notice'
    ],
    maturitySignals: [
      'Understands "no" or "not yet" without making it awkward',
      'Does not pressure her to share personal information too soon',
      'Demonstrates reliability over time, not just in words',
      'Emotionally regulated — no outbursts, guilt trips, or silent treatment'
    ],
    boundaries: [
      'Will not share her home address or exact location early in dating',
      'Will not meet somewhere isolated or private on early dates',
      'Needs time to build trust before physical closeness',
      'Reserves the right to leave any situation that feels unsafe without explanation'
    ],
    dealbreakers: [
      'Any pressure — emotional, physical, or social — to move faster than she is comfortable',
      'Anger or withdrawal when she sets a limit',
      'Inconsistency between words and actions',
      'Dismissing her safety concerns as paranoia or over-reaction',
      'Unwillingness to meet in public or insistence on privacy too early'
    ],
    privateCompatibilityNotes: []
  }
};

// ─── Build initial preferences ───────────────────────────────────────────────

/**
 * Build a PreferencesProfile starting from the archetype seed, then appending
 * any compatibility notes derived from the user's `about` and `looking` text.
 *
 * The free-text fields are not parsed deeply — they are included verbatim as
 * private notes so the AI assistant can reference them without us guessing at
 * their meaning.
 *
 * @param archetype  The female archetype from verified_vibe_users
 * @param about      Optional: her "about me" bio text
 * @param looking    Optional: her "what I'm looking for" text
 */
export function buildInitialPreferences(
  archetype: string,   // accepts both enum values and descriptive labels
  about?: string | null,
  looking?: string | null
): PreferencesProfile {
  const resolved = resolveFemaleArchetype(archetype);
  const seed = ARCHETYPE_SEED_PREFERENCES[resolved];

  // Carry over all seed fields verbatim
  const profile: PreferencesProfile = {
    ...seed,
    privateCompatibilityNotes: [...seed.privateCompatibilityNotes],
    updatedAt: Date.now()
  };

  // Append free-text context as private notes for the AI assistant.
  // We keep them clearly attributed so the assistant knows these are
  // the user's own words, not inferred signals.
  if (about && about.trim().length > 0) {
    profile.privateCompatibilityNotes.push(`From her "About me": ${about.trim()}`);
  }

  if (looking && looking.trim().length > 0) {
    profile.privateCompatibilityNotes.push(`From her "Looking for": ${looking.trim()}`);
  }

  return profile;
}

// ─── Check if a preferences profile is still at default (empty / never set) ──

/**
 * Returns true if the loaded profile appears to be the empty default that
 * profile-service returns when no DB row exists yet.
 *
 * We detect this by checking that all signal arrays are empty.  A profile
 * seeded from an archetype will always have at least one emotionalSignal.
 */
function isDefaultEmptyProfile(profile: PreferencesProfile): boolean {
  return (
    profile.emotionalSignals.length === 0 &&
    profile.lifestyleSignals.length === 0 &&
    profile.maturitySignals.length === 0 &&
    profile.boundaries.length === 0 &&
    profile.dealbreakers.length === 0 &&
    profile.privateCompatibilityNotes.length === 0
  );
}

// ─── Public initializer ───────────────────────────────────────────────────────

/**
 * Initialise a preferences profile for a female user during onboarding.
 *
 * Idempotent: if a non-empty preferences profile already exists for the user
 * (i.e. a previous call already seeded it), this function is a no-op.
 *
 * @param userId    Supabase auth.users UUID
 * @param archetype The user's female archetype
 * @param about     Optional bio text from verified_vibe_users.about
 * @param looking   Optional intent text from verified_vibe_users.looking
 */
export async function initializeUserPreferences(
  userId: string,
  archetype: string,   // accepts both enum values and descriptive labels
  about?: string | null,
  looking?: string | null
): Promise<void> {
  // Load whatever is currently in the DB (or the empty default if nothing exists)
  const existing = await loadPreferences(userId);

  // If the profile already contains real data, do not overwrite it
  if (!isDefaultEmptyProfile(existing)) {
    return;
  }

  // Build the initial profile from the archetype seed + free-text fields
  const initialProfile = buildInitialPreferences(archetype, about, looking);

  // Persist via updatePreferences, which handles versioning and cache invalidation
  await updatePreferences(userId, initialProfile, 'Initialized from onboarding profile');
}
