import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import TrustGauge from './TrustGauge.svelte';
import type { TrustScore } from '../types';

describe('TrustGauge Component', () => {
  const mockTrustScore: TrustScore = {
    total: 75,
    identity: {
      score: 25,
      max: 30,
      items: [
        { label: 'ID Verified', ok: true },
        { label: 'Face Match', ok: true },
        { label: 'Liveness', ok: false }
      ]
    },
    lifestyle: {
      score: 30,
      max: 45,
      items: [
        { label: 'Photos', ok: true },
        { label: 'Consistency', ok: true }
      ]
    },
    intent: {
      score: 20,
      max: 25,
      items: [
        { label: 'Q&A Complete', ok: true },
        { label: 'Archetype Clear', ok: false }
      ]
    }
  };

  it('renders radial gauge by default', () => {
    const { container } = render(TrustGauge, {
      props: {
        trust: mockTrustScore,
        style: 'radial'
      }
    });

    const gauge = container.querySelector('.radial-gauge');
    expect(gauge).toBeTruthy();
  });

  it('renders linear gauge when style is linear', () => {
    const { container } = render(TrustGauge, {
      props: {
        trust: mockTrustScore,
        style: 'linear'
      }
    });

    const gauge = container.querySelector('.linear-bar');
    expect(gauge).toBeTruthy();
  });

  it('renders arc gauge when style is arc', () => {
    const { container } = render(TrustGauge, {
      props: {
        trust: mockTrustScore,
        style: 'arc'
      }
    });

    const gauge = container.querySelector('.arc-gauge');
    expect(gauge).toBeTruthy();
  });

  it('displays correct trust score', () => {
    const { container } = render(TrustGauge, {
      props: {
        trust: mockTrustScore,
        style: 'radial'
      }
    });

    const scoreText = container.querySelector('.gauge-number');
    expect(scoreText?.textContent).toBe('75');
  });

  it('shows breakdown when showBreakdown is true', () => {
    const { container } = render(TrustGauge, {
      props: {
        trust: mockTrustScore,
        showBreakdown: true
      }
    });

    const breakdown = container.querySelector('.breakdown-section');
    expect(breakdown).toBeTruthy();
  });

  it('hides breakdown when showBreakdown is false', () => {
    const { container } = render(TrustGauge, {
      props: {
        trust: mockTrustScore,
        showBreakdown: false
      }
    });

    const breakdown = container.querySelector('.breakdown-section');
    expect(breakdown).toBeFalsy();
  });

  it('displays all three categories in breakdown', () => {
    const { container } = render(TrustGauge, {
      props: {
        trust: mockTrustScore,
        showBreakdown: true
      }
    });

    const items = container.querySelectorAll('.breakdown-item');
    expect(items.length).toBe(3);
  });

  it('calculates category percentages correctly', () => {
    const { container } = render(TrustGauge, {
      props: {
        trust: mockTrustScore,
        showBreakdown: true
      }
    });

    const scores = container.querySelectorAll('.breakdown-score');
    // Identity: 25/30 = 83%
    // Lifestyle: 30/45 = 67%
    // Intent: 20/25 = 80%
    expect(scores[0]?.textContent).toContain('83');
    expect(scores[1]?.textContent).toContain('67');
    expect(scores[2]?.textContent).toContain('80');
  });

  it('applies correct size class', () => {
    const { container } = render(TrustGauge, {
      props: {
        trust: mockTrustScore,
        size: 'lg'
      }
    });

    const gauge = container.querySelector('.size-lg');
    expect(gauge).toBeTruthy();
  });

  it('has accessibility attributes', () => {
    const { container } = render(TrustGauge, {
      props: {
        trust: mockTrustScore
      }
    });

    const region = container.querySelector('[role="region"]');
    expect(region).toBeTruthy();
    expect(region?.getAttribute('aria-label')).toBe('Trust score gauge');
  });

  it('includes screen reader text', () => {
    const { container } = render(TrustGauge, {
      props: {
        trust: mockTrustScore
      }
    });

    const srText = container.querySelector('.sr-only');
    expect(srText).toBeTruthy();
    expect(srText?.textContent).toContain('75');
  });

  it('handles zero trust score', () => {
    const zeroTrust: TrustScore = {
      ...mockTrustScore,
      total: 0
    };

    const { container } = render(TrustGauge, {
      props: {
        trust: zeroTrust
      }
    });

    const scoreText = container.querySelector('.gauge-number');
    expect(scoreText?.textContent).toBe('0');
  });

  it('handles maximum trust score', () => {
    const maxTrust: TrustScore = {
      ...mockTrustScore,
      total: 100
    };

    const { container } = render(TrustGauge, {
      props: {
        trust: maxTrust
      }
    });

    const scoreText = container.querySelector('.gauge-number');
    expect(scoreText?.textContent).toBe('100');
  });
});
