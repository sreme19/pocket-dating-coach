/**
 * seed-existing-preferences.ts
 *
 * One-time script to seed ai_assistant_profiles (profile_type = 'preferences')
 * for all existing female users in verified_vibe_users who don't yet have an entry.
 *
 * Run with:
 *   tsx --env-file=.env.local scripts/seed-existing-preferences.ts
 */

import { createClient } from '@supabase/supabase-js';

// ─── Types ────────────────────────────────────────────────────────────────────

type FemaleArchetype = 'spoilt_woman' | 'safety_first_woman';

/** Map any archetype string → our two seed categories */
function resolveFemaleArchetype(archetype: string): FemaleArchetype {
  const lower = archetype.toLowerCase();
  const safetyKeywords = [
    'safety', 'independent', 'feminist', 'traditional', 'family-first',
    'divorced', 'spiritual', 'therapy', 'bdsm', 'ethically', 'polyamorous',
    'awakened', 'monogamish', 'swinger', 'serial dater', 'time pressure'
  ];
  if (safetyKeywords.some(kw => lower.includes(kw))) return 'safety_first_woman';
  return 'spoilt_woman';
}

interface PreferencesProfile {
  emotionalSignals: string[];
  lifestyleSignals: string[];
  maturitySignals: string[];
  boundaries: string[];
  dealbreakers: string[];
  privateCompatibilityNotes: string[];
  updatedAt: number;
}

interface VerifiedVibeUser {
  id: string;
  gender: string;
  archetype: FemaleArchetype;
  first_name: string;
  about: string | null;
  looking: string | null;
}

// ─── Archetype seed data ──────────────────────────────────────────────────────

const ARCHETYPE_SEED_PREFERENCES: Record<
  FemaleArchetype,
  Omit<PreferencesProfile, 'updatedAt'>
> = {
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

// ─── Build initial preferences ────────────────────────────────────────────────

function buildInitialPreferences(
  archetype: string,   // accepts enum or descriptive label
  about?: string | null,
  looking?: string | null
): PreferencesProfile {
  const resolved = resolveFemaleArchetype(archetype);
  const seed = ARCHETYPE_SEED_PREFERENCES[resolved];

  const profile: PreferencesProfile = {
    ...seed,
    privateCompatibilityNotes: [...seed.privateCompatibilityNotes],
    updatedAt: Date.now()
  };

  if (about && about.trim().length > 0) {
    profile.privateCompatibilityNotes.push(`From her "About me": ${about.trim()}`);
  }

  if (looking && looking.trim().length > 0) {
    profile.privateCompatibilityNotes.push(`From her "Looking for": ${looking.trim()}`);
  }

  return profile;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function seedExistingPreferences() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // 1. Fetch all female users — query by gender='woman' to capture both
  //    enum archetypes ('spoilt_woman') AND descriptive labels from seed data
  //    ('The NRI / Diaspora-Bridging Woman', etc.)
  const { data: users, error: fetchError } = await supabase
    .from('verified_vibe_users')
    .select('id, gender, archetype, first_name, about, looking')
    .eq('gender', 'woman');

  if (fetchError) {
    console.error('Failed to fetch users:', fetchError.message);
    process.exit(1);
  }

  if (!users || users.length === 0) {
    console.log('No female users with matching archetypes found.');
    return;
  }

  console.log(`Found ${users.length} user(s) to process.\n`);

  let seededCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const user of users as VerifiedVibeUser[]) {
    try {
      // 2. Check if a preferences row already exists for this user
      const { data: existing, error: checkError } = await supabase
        .from('ai_assistant_profiles')
        .select('id')
        .eq('user_id', user.id)
        .eq('profile_type', 'preferences')
        .maybeSingle();

      if (checkError) {
        console.error(
          `  Error checking existing preferences for ${user.first_name} (${user.archetype}):`,
          checkError.message
        );
        errorCount++;
        continue;
      }

      if (existing) {
        console.log(`  Skipped ${user.first_name} (already has preferences)`);
        skippedCount++;
        continue;
      }

      // 3. Build and insert the initial preferences row
      const preferences = buildInitialPreferences(user.archetype, user.about, user.looking);

      const { error: insertError } = await supabase.from('ai_assistant_profiles').insert({
        user_id: user.id,
        profile_type: 'preferences',
        data: preferences,
        version: 1,
        reason: 'Seeded from existing profile'
      });

      if (insertError) {
        console.error(
          `  Error seeding ${user.first_name} (${user.archetype}):`,
          insertError.message
        );
        errorCount++;
        continue;
      }

      console.log(`  Seeded ${user.first_name} (${user.archetype})`);
      seededCount++;
    } catch (err: any) {
      console.error(
        `  Unexpected error processing ${user.first_name} (${user.archetype}):`,
        err.message
      );
      errorCount++;
    }
  }

  console.log(`\nSummary:`);
  console.log(`  Seeded:  ${seededCount}`);
  console.log(`  Skipped: ${skippedCount}`);
  console.log(`  Errors:  ${errorCount}`);
}

seedExistingPreferences().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
