/**
 * Regression tests for the trust score shown on a Discover card.
 *
 * Two bugs, one after the other, on the screen a pending App Store 4.3(b)
 * resubmission exists to showcase:
 *
 *  1. The card summed 25 points per completed verification ROW with no upper
 *     bound, so a member who re-completed a step was scored twice and rendered
 *     as "125%". Clamped in 6b8f3a42; the clamp cases below are kept so it
 *     cannot come back by way of a new formula.
 *  2. The number disagreed with every other screen showing it. Measured
 *     2026-09-06 against live data: 123 of 146 members read a different trust
 *     score on their card than on their detail view, by up to 20 points. There
 *     were four competing formulas.
 *
 * The fix for (2) is that no surface computes a trust score any more — they all
 * read verified_vibe_users.trust_score, which trust-recompute.ts calls the
 * single source of truth. So these tests assert a passthrough, and the ones
 * about "25 points per step" are gone because that rule is gone.
 */

import { describe, it, expect } from 'vitest';
import { displayTrustScore } from '$lib/verified-vibe/server/trustScore';

describe('displayTrustScore', () => {
  it('returns the stored score unchanged', () => {
    expect(displayTrustScore({ trust_score: 34 })).toBe(34);
    expect(displayTrustScore({ trust_score: 100 })).toBe(100);
  });

  // A genuine 0 must display as 0. The expression this replaced ended in
  // `|| (profile.trust_score ?? 0)`, and `||` fires on 0 — so the one member
  // the fallback was written for, the one who had verified nothing, was the
  // one it silently gave a different number to.
  it('treats a stored 0 as a real score, not as missing', () => {
    expect(displayTrustScore({ trust_score: 0 })).toBe(0);
  });

  it('reads a missing or malformed score as 0 rather than NaN', () => {
    expect(displayTrustScore({ trust_score: null })).toBe(0);
    expect(displayTrustScore({ trust_score: undefined })).toBe(0);
    expect(displayTrustScore({})).toBe(0);
    expect(displayTrustScore({ trust_score: NaN })).toBe(0);
  });

  // The 125% guard. It can no longer arise from this path, but the bound is
  // cheap and the failure was user-visible on a review build.
  it('never renders outside 0-100, whatever is stored', () => {
    expect(displayTrustScore({ trust_score: 125 })).toBe(100);
    expect(displayTrustScore({ trust_score: 1000 })).toBe(100);
    expect(displayTrustScore({ trust_score: -20 })).toBe(0);
  });

  it('rounds, so a card never shows a fraction', () => {
    expect(displayTrustScore({ trust_score: 61.4 })).toBe(61);
    expect(displayTrustScore({ trust_score: 61.6 })).toBe(62);
  });

  // The invariant that was missing: the card and the detail view are handed the
  // same profile row and must not be able to disagree. Both call sites now pass
  // their row straight to this function, so agreement is a property of there
  // being one function — this pins that it stays that way.
  it('gives the same answer to every surface for the same member', () => {
    const member = { trust_score: 34 };
    const card = displayTrustScore(member);   // discovery-feed
    const detail = displayTrustScore(member); // public-profile/[profileId]
    expect(card).toBe(detail);
    expect(card).toBe(34);
  });
});
