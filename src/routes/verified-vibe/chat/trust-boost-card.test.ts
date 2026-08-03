import { describe, it, expect, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import TrustBoostCard from './TrustBoostCard.svelte';
import { PROOF_CATEGORIES, isMoneyProofCategory } from '$lib/verified-vibe/proof-categories';
import type { AdvisorPortfolio } from '$lib/client/advisor-thread';

/**
 * The pinned Trust & Boost card.
 *
 * The load-bearing test here is the money one. App Store guideline 1.1.4 got 1.1.4
 * rejected once already for copy that could be read as paid dating, and this card is
 * the only surface that renders the FULL category list — money categories included —
 * so a future edit that gives a financial chip an appeal number has to fail here
 * rather than in review.
 */

const base: AdvisorPortfolio = {
  done: 4,
  total: 13,
  completed: ['lifestyle', 'discipline', 'travel', 'photos'],
  profileStrength: 24.5,
  band: 'Getting started',
  nextBand: 'Building',
  pointsToNextBand: 0.5,
  actions: [
    {
      id: 'linkedin',
      label: 'Career',
      askPhrase: 'career (a LinkedIn screenshot, or your résumé)',
      deltaPS: 5,
      crossesBand: true,
      bandAfter: 'Building',
      appealGains: [{ name: 'Aisha', delta: 3.2 }],
      matchesHelped: 1
    }
  ]
};

beforeEach(() => {
  localStorage.clear();
  cleanup();
});

describe('TrustBoostCard', () => {
  it('leads with completion and the single highest-value action', () => {
    const { container } = render(TrustBoostCard, { portfolio: base });
    const text = container.textContent ?? '';

    expect(text).toContain('4 of 13 proofs');
    expect(text).toContain('Profile Strength 24.5');
    expect(text).toContain('Getting started');
    expect(text).toContain('0.5 to Building');

    // The ask, its absolute delta, the band crossing, and the named appeal gain.
    expect(text).toContain('career (a LinkedIn screenshot, or your résumé)');
    expect(text).toContain('+5');
    expect(text).toContain('reaches Building');
    expect(text).toContain('Aisha');
    expect(text).toContain('+3.2');
  });

  it('never renders a bare .0 — "+5", not "+5.0"', () => {
    const { container } = render(TrustBoostCard, { portfolio: base });
    expect(container.textContent).not.toMatch(/\+\d+\.0\b/);
  });

  it('points the CTA at the real upload route for the top action', () => {
    const { container } = render(TrustBoostCard, { portfolio: base });
    const cta = container.querySelector('.tb-cta') as HTMLAnchorElement | null;
    expect(cta?.getAttribute('href')).toBe('/verified-vibe/proof-upload?category=linkedin');
  });

  it('renders every canonical category, ticking the completed ones', () => {
    const { container } = render(TrustBoostCard, { portfolio: base });
    const chips = [...container.querySelectorAll('.tb-chip')];
    expect(chips).toHaveLength(PROOF_CATEGORIES.length);

    const done = [...container.querySelectorAll('.tb-chip--done')].map(c => c.textContent?.trim());
    // 'photos' is not a proof category, so it must not invent a chip.
    expect(done).toHaveLength(3);
    expect(done.join(' ')).toContain('Travel');
  });

  it('gives money categories verification language only — never an appeal gain', () => {
    const { container } = render(TrustBoostCard, { portfolio: base });
    const moneyIds = PROOF_CATEGORIES.filter(c => isMoneyProofCategory(c.id)).map(c => c.id);
    expect(moneyIds.length).toBeGreaterThan(0);

    for (const id of moneyIds) {
      const chip = container.querySelector(`a[href$="category=${id}"]`);
      expect(chip, `chip missing for ${id}`).toBeTruthy();
      const title = chip?.getAttribute('title') ?? '';
      expect(title).toContain("confirms you're real");
      // No number, no "lifts", no "appeal" anywhere near a money category.
      expect(title).not.toMatch(/\d/);
      expect(title.toLowerCase()).not.toMatch(/appeal|lift|attract|standing/);
    }

    expect(container.textContent).toContain("Financial proofs confirm you're real");
  });

  it('still shows completion when the member has no vectors yet', () => {
    const { container } = render(TrustBoostCard, {
      portfolio: {
        ...base,
        done: 0,
        completed: [],
        profileStrength: null,
        band: null,
        nextBand: null,
        pointsToNextBand: null,
        actions: []
      }
    });
    const text = container.textContent ?? '';

    expect(text).toContain('0 of 13 proofs');
    expect(text).not.toContain('Profile Strength');
    expect(container.querySelector('.tb-next')).toBeNull();
    expect(container.querySelector('.tb-cta')).toBeNull();
    // Chips are the whole value of the card in this state — the median member.
    expect(container.querySelectorAll('.tb-chip')).toHaveLength(PROOF_CATEGORIES.length);
  });

  it('stays collapsed when he collapsed it last time', () => {
    localStorage.setItem('vv_trust_boost_card_open', '0');
    const { container } = render(TrustBoostCard, { portfolio: base });

    expect(container.querySelector('.tb-body')).toBeNull();
    // The count and the meter survive a collapse — one glanceable number.
    expect(container.textContent).toContain('4 of 13 proofs');
    expect(container.querySelector('.tb-meter-fill')).toBeTruthy();
  });
});
