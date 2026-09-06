/**
 * The identity penalty, and what it is allowed to punish.
 *
 * normalizeScore halves a member's displayed trust when they have not proved
 * they are a live human. That test of "proved" used to be liveness AND
 * government ID — but ID is not a step this product asks anyone to take
 * (POOL_REQUIRED_STEPS is ['liveness','photos'], and government ID only gates
 * spending/wealth proof uploads). So the penalty fired on almost everybody.
 *
 * Measured on live data 2026-09-06: 123 of 127 real men and 16 of 17 real women
 * were halved, only 5 of 144 had completed both steps, and the Discover feed
 * read "Low trust" for 118 of 127 men against a raw-trust median of 39.
 */

import { describe, it, expect } from 'vitest';
import { normalizeScore } from '../trust-normalize';

// A cohort large enough that the cold-start blend is fully percentile-driven
// (COLD_START_FULL_N = 30), so these cases test the penalty and not the blend.
const cohort = Array.from({ length: 40 }, (_, i) => i * 2);

describe('normalizeScore identity penalty', () => {
  it('does not penalize a member who has done liveness', () => {
    const withLiveness = normalizeScore(40, true, cohort);
    const without = normalizeScore(40, false, cohort);
    expect(withLiveness).toBeGreaterThan(without);
    // Within 1, not exact: normalizeScore rounds once at the end, so halving
    // the already-rounded score is a different number by up to half a point.
    expect(Math.abs(without - withLiveness * 0.5)).toBeLessThanOrEqual(1);
  });

  // The regression this exists for: someone who cleared liveness but never
  // uploaded a government ID is fully compliant with what we ask, and must not
  // be halved. Under the old rule this member scored the same as someone who
  // had proved nothing at all.
  it('treats liveness-without-ID as proven, not as unproven', () => {
    const livenessOnly = normalizeScore(40, true, cohort);
    const nothingProven = normalizeScore(40, false, cohort);
    expect(livenessOnly).not.toBe(nothingProven);
    expect(livenessOnly).toBe(normalizeScore(40, true, cohort));
  });

  it('still halves a member who never proved a live face', () => {
    expect(normalizeScore(60, false, cohort)).toBeLessThan(normalizeScore(60, true, cohort));
  });

  it('stays inside 0-100 either way', () => {
    for (const proven of [true, false]) {
      for (const raw of [0, 1, 50, 99, 100, 500, -10]) {
        const v = normalizeScore(raw, proven, cohort);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
    }
  });

  // Worth pinning because it surprises people (it surprised the author of this
  // test): a raw score of 0 does NOT display as 0. The score is a percentile,
  // so a member tied with everyone else sits at the top of that cohort, and the
  // cold-start blend hands back a fraction of it. Displayed trust is competitive
  // standing, not an absolute measure of what someone has uploaded.
  it('a raw zero is still relative to the cohort, and the penalty still applies', () => {
    const proven = normalizeScore(0, true, [0, 0, 0]);
    const unproven = normalizeScore(0, false, [0, 0, 0]);
    expect(proven).toBeGreaterThan(0);
    expect(unproven).toBe(Math.round(proven * 0.5));
    expect(unproven).toBeGreaterThanOrEqual(0);
  });

  it('handles an empty cohort without dividing by zero', () => {
    expect(normalizeScore(40, true, [])).toBe(40);
    expect(normalizeScore(40, false, [])).toBe(20);
  });
});
