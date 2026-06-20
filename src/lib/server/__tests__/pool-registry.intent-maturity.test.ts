import { describe, it, expect } from 'vitest';
import { deriveIntent, deriveMaturitySignals } from '../pool-registry';

describe('deriveIntent — explicit onboarding answer wins, archetype phrase only as fallback', () => {
  it('uses the explicit answer when present (forever → life_stage)', () => {
    expect(deriveIntent('forever_focused_woman', { life_stage: ['Completely ready to commit now'] }))
      .toBe('Completely ready to commit now');
  });

  it('uses the explicit answer (rebound → comfort_level, just_friends → comfort_zone)', () => {
    expect(deriveIntent('rebound_healing_man', { comfort_level: ['Something that could grow slowly'] }))
      .toBe('Something that could grow slowly');
    expect(deriveIntent('just_friends_woman', { comfort_zone: ['Platonic only'] }))
      .toBe('Platonic only');
  });

  it('falls back to the archetype phrase for casual lanes (no intent answer)', () => {
    expect(deriveIntent('casual_generous_man', {}))
      .toBe('Casual, no-strings — experiences and generosity over labels');
    expect(deriveIntent('spoiled_casual_woman', {}))
      .toBe('Casual, no-strings — wants to be treated well, no labels');
  });

  it('falls back for hopeless_romantic (emotional_openness is not an intent answer)', () => {
    expect(deriveIntent('hopeless_romantic_woman', { emotional_openness: ['Cautiously open'] }))
      .toBe('Serious, emotionally deep relationship');
  });

  it('NEVER overrides a real answer with the fallback (casual + legacy answer)', () => {
    expect(deriveIntent('casual_generous_man', { relationship_timeline: ['Within a year'] }))
      .toBe('Within a year');
  });

  it('honors the male draft.lookingFor extra source', () => {
    expect(deriveIntent('casual_generous_man', {}, 'Someone to travel with'))
      .toBe('Someone to travel with');
  });
});

describe('deriveMaturitySignals — positive picks, just_friends empty', () => {
  it('just_friends stays empty by design', () => {
    expect(deriveMaturitySignals('just_friends_woman', { good_friend_traits: ['Honest'], standards: ['x'] }))
      .toEqual([]);
  });

  it('pulls standards as-is (no negation)', () => {
    expect(deriveMaturitySignals('spoiled_casual_woman', { standards: ['Discretion matters', 'Drama-free only'] }))
      .toEqual(['Discretion matters', 'Drama-free only']);
  });

  it('forever → non_negotiables + relationship_approach', () => {
    const out = deriveMaturitySignals('forever_focused_woman', {
      non_negotiables: ['Loyalty', 'Emotional maturity'],
      relationship_approach: ['Intentional dating from day one'],
    });
    expect(out).toContain('Loyalty');
    expect(out).toContain('Emotional maturity');
    expect(out).toContain('Intentional dating from day one');
  });

  it('untouched → values', () => {
    expect(deriveMaturitySignals('untouched_heart_woman', { values: ['Kindness', 'No games'] }))
      .toEqual(['Kindness', 'No games']);
  });

  it('matrimony → partner_fit / core_values', () => {
    const out = deriveMaturitySignals('traditional_matrimony_woman', {
      partner_fit: ['Stable career', 'Financially settled'],
      core_values: ['Respectful & grounded'],
    });
    expect(out).toContain('Stable career');
    expect(out).toContain('Respectful & grounded');
  });
});
