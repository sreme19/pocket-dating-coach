<script lang="ts">
  import { getTrustScoreColor, getTrustScoreLabel } from '../server/trustScore';
  import type { TrustScore } from '../types';

  /**
   * TrustGauge Component
   *
   * Displays trust score with multiple visualization styles:
   * - Radial gauge (default): Circular progress indicator
   * - Linear gauge: Horizontal progress bar
   * - Arc gauge: Curved progress indicator
   *
   * Features:
   * - Multiple visualization styles
   * - Category breakdown display
   * - Smooth animations
   * - ARIA labels for accessibility
   * - Mobile responsive
   * - WCAG 2.1 AA compliance
   *
   * @component
   * @example
   * ```svelte
   * <TrustGauge
   *   trust={trustScore}
   *   style="radial"
   *   showBreakdown={true}
   * />
   * ```
   */

  interface Props {
    /** Trust score object with overall score and category breakdown */
    trust: TrustScore;
    /** Visualization style: 'radial' (default), 'linear', or 'arc' */
    style?: 'radial' | 'linear' | 'arc';
    /** Whether to show category breakdown */
    showBreakdown?: boolean;
    /** Size of the gauge: 'sm', 'md' (default), 'lg' */
    size?: 'sm' | 'md' | 'lg';
  }

  let { trust, style = 'radial', showBreakdown = true, size = 'md' }: Props = $props();

  // Derived values
  let overallScore = $derived(trust.total);
  let color = $derived(getTrustScoreColor(overallScore));
  let label = $derived(getTrustScoreLabel(overallScore));
  let circumference = $derived(2 * Math.PI * 90); // radius = 90
  let strokeDashoffset = $derived(circumference - (overallScore / 100) * circumference);

  // Size configurations
  const sizeConfig = {
    sm: { gauge: 120, radius: 45, strokeWidth: 8, fontSize: 32 },
    md: { gauge: 160, radius: 60, strokeWidth: 10, fontSize: 48 },
    lg: { gauge: 200, radius: 75, strokeWidth: 12, fontSize: 56 }
  };

  const config = $derived(sizeConfig[size]);

  // Arc path for arc gauge
  let arcPath = $derived.by(() => {
    const radius = config.radius;
    const angle = (overallScore / 100) * 270; // 270 degree arc
    const startAngle = -135; // Start from top-left
    const endAngle = startAngle + angle;

    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;

    const x1 = 100 + radius * Math.cos(startRad);
    const y1 = 100 + radius * Math.sin(startRad);
    const x2 = 100 + radius * Math.cos(endRad);
    const y2 = 100 + radius * Math.sin(endRad);

    const largeArc = angle > 180 ? 1 : 0;

    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
  });

  // Get category scores
  let categoryScores = $derived.by(() => {
    return {
      Identity: (trust.identity.score / trust.identity.max) * 100,
      Lifestyle: (trust.lifestyle.score / trust.lifestyle.max) * 100,
      Intent: (trust.intent.score / trust.intent.max) * 100
    };
  });
</script>

<div class="trust-gauge" class:style-{style} class:size-{size} role="region" aria-label="Trust score gauge">
  <!-- Radial Gauge -->
  {#if style === 'radial'}
    <div class="gauge-container">
      <svg viewBox="0 0 200 200" class="radial-gauge" aria-hidden="true">
        <!-- Background circle -->
        <circle cx="100" cy="100" r={config.radius} fill="none" stroke="var(--color-vibe-bg-3)" stroke-width={config.strokeWidth} />

        <!-- Progress circle -->
        <circle
          cx="100"
          cy="100"
          r={config.radius}
          fill="none"
          stroke="var(--color-vibe-{color})"
          stroke-width={config.strokeWidth}
          stroke-dasharray={circumference}
          stroke-dashoffset={strokeDashoffset}
          stroke-linecap="round"
          transform="rotate(-90 100 100)"
          class="progress-circle"
        />

        <!-- Center text -->
        <text x="100" y="100" text-anchor="middle" dy="0.3em" class="gauge-text">
          <tspan class="gauge-number" style="font-size: {config.fontSize}px">{Math.round(overallScore)}</tspan>
          <tspan x="100" dy="1.2em" class="gauge-label">/ 100</tspan>
        </text>
      </svg>
    </div>
  {/if}

  <!-- Linear Gauge -->
  {#if style === 'linear'}
    <div class="gauge-container linear">
      <div class="linear-header">
        <span class="linear-label">{label}</span>
        <span class="linear-value">{Math.round(overallScore)}%</span>
      </div>
      <div class="linear-bar">
        <div class="linear-fill" style="width: {overallScore}%; background-color: var(--color-vibe-{color})"></div>
      </div>
    </div>
  {/if}

  <!-- Arc Gauge -->
  {#if style === 'arc'}
    <div class="gauge-container">
      <svg viewBox="0 0 200 200" class="arc-gauge" aria-hidden="true">
        <!-- Background arc -->
        <path
          d={arcPath}
          fill="none"
          stroke="var(--color-vibe-bg-3)"
          stroke-width={config.strokeWidth}
          stroke-linecap="round"
        />

        <!-- Progress arc -->
        <path
          d={arcPath}
          fill="none"
          stroke="var(--color-vibe-{color})"
          stroke-width={config.strokeWidth}
          stroke-linecap="round"
          class="progress-arc"
          style="stroke-dasharray: {(overallScore / 100) * 212}; stroke-dashoffset: 0;"
        />

        <!-- Center text -->
        <text x="100" y="100" text-anchor="middle" dy="0.3em" class="gauge-text">
          <tspan class="gauge-number" style="font-size: {config.fontSize}px">{Math.round(overallScore)}</tspan>
          <tspan x="100" dy="1.2em" class="gauge-label">/ 100</tspan>
        </text>
      </svg>
    </div>
  {/if}

  <!-- Category Breakdown -->
  {#if showBreakdown}
    <div class="breakdown-section">
      <h3 class="breakdown-title">Trust Breakdown</h3>
      <div class="breakdown-items">
        {#each Object.entries(categoryScores) as [category, score]}
          <div class="breakdown-item">
            <div class="breakdown-header">
              <span class="breakdown-name">{category}</span>
              <span class="breakdown-score">{Math.round(score)}%</span>
            </div>
            <div class="breakdown-bar">
              <div class="breakdown-fill" style="width: {score}%; background-color: var(--color-vibe-{getTrustScoreColor(score)})"></div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Accessibility info -->
  <div class="sr-only" role="status" aria-live="polite">
    Trust score: {Math.round(overallScore)} out of 100. {label}.
  </div>
</div>

<style>
  .trust-gauge {
    display: flex;
    flex-direction: column;
    gap: var(--gap-lg);
    width: 100%;
  }

  /* Gauge Container */
  .gauge-container {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
  }

  .gauge-container.linear {
    flex-direction: column;
    gap: var(--gap-md);
  }

  /* Radial Gauge */
  .radial-gauge {
    width: 100%;
    height: auto;
    max-width: 200px;
    filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.1));
  }

  .progress-circle {
    transition: stroke-dashoffset 600ms cubic-bezier(0.4, 0, 0.2, 1);
    will-change: stroke-dashoffset;
  }

  @media (prefers-reduced-motion: reduce) {
    .progress-circle {
      transition: none;
      will-change: auto;
    }
  }

  /* Arc Gauge */
  .arc-gauge {
    width: 100%;
    height: auto;
    max-width: 200px;
    filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.1));
  }

  .progress-arc {
    transition: stroke-dasharray 600ms cubic-bezier(0.4, 0, 0.2, 1);
    will-change: stroke-dasharray;
  }

  @media (prefers-reduced-motion: reduce) {
    .progress-arc {
      transition: none;
      will-change: auto;
    }
  }

  /* Gauge Text */
  .gauge-text {
    font-family: var(--font-mono);
    font-weight: 700;
  }

  .gauge-number {
    fill: var(--color-vibe-text-1);
  }

  .gauge-label {
    fill: var(--color-vibe-text-3);
    font-size: 14px;
  }

  /* Linear Gauge */
  .linear-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .linear-label {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--color-vibe-text-1);
  }

  .linear-value {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-bold);
    color: var(--color-vibe-text-1);
    font-family: var(--font-mono);
  }

  .linear-bar {
    width: 100%;
    height: 8px;
    background: var(--color-vibe-bg-3);
    border-radius: var(--radius-full);
    overflow: hidden;
  }

  .linear-fill {
    height: 100%;
    transition: width 600ms cubic-bezier(0.4, 0, 0.2, 1);
    will-change: width;
  }

  @media (prefers-reduced-motion: reduce) {
    .linear-fill {
      transition: none;
      will-change: auto;
    }
  }

  /* Breakdown Section */
  .breakdown-section {
    display: flex;
    flex-direction: column;
    gap: var(--gap-md);
    padding: var(--spacing-lg);
    background: var(--color-vibe-bg-2);
    border: 1px solid var(--color-vibe-border);
    border-radius: var(--radius-lg);
  }

  .breakdown-title {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--color-vibe-text-1);
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .breakdown-items {
    display: flex;
    flex-direction: column;
    gap: var(--gap-md);
  }

  .breakdown-item {
    display: flex;
    flex-direction: column;
    gap: var(--gap-sm);
  }

  .breakdown-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .breakdown-name {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: var(--color-vibe-text-1);
  }

  .breakdown-score {
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-semibold);
    color: var(--color-vibe-text-3);
    font-family: var(--font-mono);
  }

  .breakdown-bar {
    width: 100%;
    height: 6px;
    background: var(--color-vibe-bg-3);
    border-radius: var(--radius-full);
    overflow: hidden;
  }

  .breakdown-fill {
    height: 100%;
    transition: width 300ms ease;
    will-change: width;
  }

  @media (prefers-reduced-motion: reduce) {
    .breakdown-fill {
      transition: none;
      will-change: auto;
    }
  }

  /* Size Variants */
  .size-sm .radial-gauge,
  .size-sm .arc-gauge {
    max-width: 120px;
  }

  .size-lg .radial-gauge,
  .size-lg .arc-gauge {
    max-width: 240px;
  }

  /* Mobile Responsive */
  @media (max-width: 767px) {
    .trust-gauge {
      gap: var(--gap-md);
    }

    .breakdown-section {
      padding: var(--spacing-md);
      gap: var(--gap-sm);
    }

    .breakdown-title {
      font-size: var(--font-size-xs);
    }

    .breakdown-item {
      gap: var(--gap-xs);
    }

    .breakdown-name {
      font-size: var(--font-size-xs);
    }

    .breakdown-score {
      font-size: var(--font-size-xs);
    }

    .linear-label,
    .linear-value {
      font-size: var(--font-size-xs);
    }
  }

  /* Screen reader only */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }
</style>
