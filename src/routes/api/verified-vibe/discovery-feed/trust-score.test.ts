/**
 * Regression tests for the Discover card's trust score.
 *
 * The bug these pin: the feed summed 25 points per completed verification ROW
 * with no upper bound, while the handler's sibling verificationMap is a Set
 * keyed on step NAME. A member who re-completed a step therefore had two
 * 'completed' rows, was scored twice, and rendered as "125%" on their Discover
 * card — observed in the live iOS build on 2026-09-05, on the exact screen a
 * pending App Store 4.3(b) resubmission is built to showcase.
 */

import { describe, it, expect } from 'vitest';
import { trustScoresFromVerificationRows } from './+server';

const row = (user_id: string, status: string) => ({ user_id, status });

describe('trustScoresFromVerificationRows', () => {
  it('awards 25 points per completed step', () => {
    const scores = trustScoresFromVerificationRows([
      row('u1', 'completed'),
      row('u1', 'completed')
    ]);
    expect(scores.get('u1')).toBe(50);
  });

  it('scores the four-step maximum as exactly 100', () => {
    const scores = trustScoresFromVerificationRows([
      row('u1', 'completed'),
      row('u1', 'completed'),
      row('u1', 'completed'),
      row('u1', 'completed')
    ]);
    expect(scores.get('u1')).toBe(100);
  });

  // The actual regression. Five completed rows is what a re-completed step
  // looks like in verified_vibe_verification, and it used to render "125%".
  it('never exceeds 100, even with duplicate completed rows for one step', () => {
    const scores = trustScoresFromVerificationRows([
      row('u1', 'completed'),
      row('u1', 'completed'),
      row('u1', 'completed'),
      row('u1', 'completed'),
      row('u1', 'completed')
    ]);
    expect(scores.get('u1')).toBe(100);
    expect(scores.get('u1')).toBeLessThanOrEqual(100);
  });

  it('stays bounded under heavy duplication', () => {
    const rows = Array.from({ length: 40 }, () => row('u1', 'completed'));
    expect(trustScoresFromVerificationRows(rows).get('u1')).toBe(100);
  });

  it('ignores rows that are not completed', () => {
    const scores = trustScoresFromVerificationRows([
      row('u1', 'completed'),
      row('u1', 'pending'),
      row('u1', 'failed')
    ]);
    expect(scores.get('u1')).toBe(25);
  });

  it('never returns a negative score', () => {
    const scores = trustScoresFromVerificationRows([row('u1', 'pending')]);
    expect(scores.get('u1')).toBe(0);
  });

  it('scores each user independently', () => {
    const scores = trustScoresFromVerificationRows([
      row('u1', 'completed'),
      row('u2', 'completed'),
      row('u2', 'completed'),
      row('u3', 'pending')
    ]);
    expect(scores.get('u1')).toBe(25);
    expect(scores.get('u2')).toBe(50);
    expect(scores.get('u3')).toBe(0);
  });

  it('returns an empty map for no rows', () => {
    expect(trustScoresFromVerificationRows([]).size).toBe(0);
  });
});
