import { describe, it, expect } from 'vitest';
import {
  deriveDealbreakers,
  deriveAllDealbreakers,
  resolveHardNos,
  distillPreferences,
} from '../pool-registry';

/**
 * Coverage + correctness for the dealbreaker derivation (second mapping layer).
 *
 * The label lists below are copied verbatim from the onboarding source sections
 * in DrawnToStep.svelte / HowYouLiveStep.svelte. If those labels change, these
 * lists must change too — a mismatch here means a real user pick would silently
 * map to no dealbreaker.
 */

// archetype → { sectionKey: [exact onboarding labels] }
const SOURCES: Record<string, Record<string, string[]>> = {
  casual_generous_man: {
    standards: [
      'Honest communication', 'Emotional maturity', 'Mutual respect', 'Drama-free', 'Consistency',
      'Discretion matters', 'Clear expectations', 'Safety & trust first', 'Verified profiles preferred',
      'No games or manipulation', 'Privacy respected', 'Respect for boundaries',
    ],
  },
  spoiled_casual_woman: {
    standards: [
      'Discretion matters', 'Drama-free only', 'Honest & direct', 'Mutual respect', 'No games or pressure',
      'Clear expectations from the start', 'Privacy respected', 'Safety & trust first',
      'Respects my boundaries', 'Verified profiles preferred',
    ],
  },
  hopeless_romantic_woman: {
    what_youre_done_with: [
      'Emotional unavailability', 'Surface-level connections', 'Mixed signals', 'Being an afterthought',
      'Hot and cold behaviour', 'One-sided effort', "People who can't communicate",
      'Half-in, half-out energy', 'Love that drains instead of fills',
    ],
    standards: [
      'Emotional availability', 'Consistent communication', 'Faithfulness and loyalty',
      'Making each other a priority', "Being each other's safe place", 'Mutual respect',
      'Intentional romance', 'Drama-free love', 'Growing together', 'Emotional intelligence',
    ],
  },
  rebound_healing_man: {
    standards: [
      'Honesty', 'Drama-free', 'Emotional steadiness', "Respects where I'm at", 'No manipulation',
      'Patient without resentment', 'Direct and honest', 'Low-pressure energy', 'Genuine care',
    ],
  },
  untouched_heart_woman: {
    values: [
      'Honesty above everything', 'Kindness', 'No games', 'Taking time', 'Being genuinely real',
      'Respect', 'Warmth', 'Sincerity over polish', 'Mutual curiosity',
    ],
  },
  forever_focused_man: {
    non_negotiables: [
      'Loyalty', 'Aligned on children', 'Financial responsibility', 'Honest communication',
      'Emotional maturity', 'No games', 'Consistent effort', 'Family-oriented', 'Growth mindset',
      'Mutual respect',
    ],
  },
  second_chapter_woman: {
    non_negotiables: [
      'No drama', 'Honest communication', 'Emotional maturity', 'Knowing what they want', 'Mutual respect',
      'Not in a hurry to perform', 'Consistent and reliable', 'Genuine warmth', 'Ready to actually show up',
    ],
  },
  traditional_matrimony_woman: {
    core_values: [
      'Family-first', 'Culturally aligned', 'Respectful & grounded', 'Traditional values',
      'Religiously compatible', 'Community-oriented', 'Financially responsible', 'Parenting-aligned',
      'Grounded in roots',
    ],
    lifestyle: ['Vegetarian', 'Non-smoker', 'Non-drinker', 'Religiously practicing', 'Family-oriented', 'Fitness-focused'],
  },
};

describe('deriveDealbreakers — coverage (no onboarding pick silently dropped)', () => {
  for (const [archetype, sections] of Object.entries(SOURCES)) {
    for (const [sectionKey, labels] of Object.entries(sections)) {
      for (const label of labels) {
        it(`${archetype}: "${label}" maps to a dealbreaker`, () => {
          const out = deriveDealbreakers(archetype, { [sectionKey]: [label] });
          expect(out.length).toBeGreaterThanOrEqual(1);
        });
      }
    }
  }
});

describe('deriveDealbreakers — correctness', () => {
  it('just_friends stays empty (both genders)', () => {
    expect(deriveDealbreakers('just_friends_man', { good_friend_traits: ['Honest'] })).toEqual([]);
    expect(deriveDealbreakers('just_friends_woman', { values: ['Kindness'] })).toEqual([]);
  });

  it('forever_focused negates non-negotiables into violations', () => {
    const out = deriveDealbreakers('forever_focused_man', {
      non_negotiables: ['Loyalty', 'Aligned on children', 'Honest communication'],
    });
    expect(out).toContain('Disloyal / unfaithful');
    expect(out).toContain('Misaligned on children');
    expect(out).toContain('Dishonesty');
  });

  it('hopeless_romantic carries "done settling for" picks through as negatives', () => {
    const out = deriveDealbreakers('hopeless_romantic_woman', {
      what_youre_done_with: ['Emotional unavailability', 'Hot and cold behaviour'],
    });
    expect(out).toContain('Emotionally unavailable');
    expect(out).toContain('Hot and cold');
  });

  it('traditional_matrimony uses the actual religion pick + negates lifestyle facts', () => {
    const out = deriveDealbreakers('traditional_matrimony_woman', {
      core_values: ['Religiously compatible', 'Traditional values'],
      religion: ['Hindu'],
      lifestyle: ['Non-smoker', 'Non-drinker'],
    });
    expect(out).toContain('Different religion (non-Hindu)');
    expect(out).toContain('Rejects tradition');
    expect(out).toContain('Smoker');
    expect(out).toContain('Drinker');
  });

  it('traditional_matrimony falls back to generic when religion missing', () => {
    const out = deriveDealbreakers('traditional_matrimony_man', {
      core_values: ['Religiously compatible'],
    });
    expect(out).toContain('Religiously incompatible');
  });

  it('caps output at 12 and dedupes', () => {
    const out = deriveDealbreakers('forever_focused_man', {
      non_negotiables: ['Honest communication', 'Mutual respect', 'Mutual respect'],
    });
    expect(out.length).toBeLessThanOrEqual(12);
    // 'Mutual respect' appears twice but 'Disrespect' should be deduped
    expect(out.filter((d) => d === 'Disrespect').length).toBe(1);
  });
});

describe('resolveHardNos — empty hard_nos seeds from onboarding, non-empty is user-owned', () => {
  it('(a) empty → seeds from the onboarding-derived set, flags a write', () => {
    const { hardNos, needsSeedWrite } = resolveHardNos(
      'forever_focused_man',
      { non_negotiables: ['Loyalty', 'Aligned on children'] },
      {},
      { hardNos: [] },
    );
    expect(needsSeedWrite).toBe(true);
    expect(hardNos).toEqual(
      deriveAllDealbreakers('forever_focused_man', { non_negotiables: ['Loyalty', 'Aligned on children'] }, {}),
    );
    expect(hardNos).toContain('Disloyal / unfaithful');
  });

  it('(b) existing manual entries → returned verbatim, no re-seed even if onboarding would derive', () => {
    const { hardNos, needsSeedWrite } = resolveHardNos(
      'forever_focused_man',
      { non_negotiables: ['Loyalty'] }, // would derive, but must NOT replace manual entries
      {},
      { hardNos: ['Smoking', 'Non-Muslim'] },
    );
    expect(needsSeedWrite).toBe(false);
    expect(hardNos).toEqual(['Smoking', 'Non-Muslim']);
    expect(hardNos).not.toContain('Disloyal / unfaithful');
  });

  it('(c) empty with no derivable dealbreakers → empty, no write flagged', () => {
    const { hardNos, needsSeedWrite } = resolveHardNos(
      'just_friends_woman', // collects no standards → derives nothing
      { non_negotiables: ['Loyalty'] },
      {},
      { hardNos: [] },
    );
    expect(needsSeedWrite).toBe(false);
    expect(hardNos).toEqual([]);
  });

  it('trims and drops blank entries', () => {
    const { hardNos } = resolveHardNos('spoiled_casual_woman', {}, {}, {
      hardNos: ['  Smoking ', '', '   ', 'Non-Muslim'],
    });
    expect(hardNos).toEqual(['Smoking', 'Non-Muslim']);
  });
});

describe('distillPreferences — hard_nos is the canonical dealbreaker projection', () => {
  it('uses the seeded hard_nos verbatim (deduped)', () => {
    const prefs = distillPreferences({}, {}, 'spoiled_casual_woman', [
      'Smoking', 'Excessive Drinking', 'Non-Muslim', 'Smoking',
    ]);
    expect(prefs.dealbreakers).toEqual(['Smoking', 'Excessive Drinking', 'Non-Muslim']);
  });

  it('respects removals — an item dropped from hard_nos is absent from the projection', () => {
    // User removed 'Excessive Drinking'; onboarding would still imply a drinker
    // dealbreaker, but the canonical list wins so the removal sticks.
    const prefs = distillPreferences(
      {},
      { lifestyle: ['Non-drinker'] },
      'traditional_matrimony_woman',
      ['Smoking', 'Non-Muslim'],
    );
    expect(prefs.dealbreakers).not.toContain('Excessive Drinking');
    expect(prefs.dealbreakers).not.toContain('Drinker');
    expect(prefs.dealbreakers).toEqual(['Smoking', 'Non-Muslim']);
  });

  it('falls back to the onboarding-derived set before seeding (hardNos null)', () => {
    const prefs = distillPreferences(
      {},
      { non_negotiables: ['Loyalty'] },
      'forever_focused_man',
      null,
    );
    expect(prefs.dealbreakers).toContain('Disloyal / unfaithful');
  });
});
