<script lang="ts">
  import { ChevronDown } from 'lucide-svelte';
  import { fade, slide, scale } from 'svelte/transition';
  import type { ArchetypeDefinition } from '../types';
  import { ARCHETYPE_COLORS } from '../constants';

  /**
   * ArchetypeCard Component
   *
   * A reusable, collapsible card component that displays archetype information.
   * Supports both collapsed (summary) and expanded (detailed) views with smooth GPU-accelerated animations.
   *
   * Features:
   * - Smooth expand/collapse animation (300ms)
   * - Chevron rotates 90° on expand
   * - GPU-accelerated transforms (transform/opacity)
   * - 60fps capable animations
   * - Mobile responsive
   * - Accessible keyboard navigation
   *
   * @component
   * @example
   * ```svelte
   * <ArchetypeCard
   *   archetype={archetypeData}
   *   selected={isSelected}
   *   onSelect={() => handleSelect()}
   *   onExpandChange={(isExpanded) => handleExpandChange(isExpanded)}
   * />
   * ```
   */

  interface Props {
    /** The archetype data to display */
    archetype: ArchetypeDefinition;
    /** Whether this card is currently selected */
    selected?: boolean;
    /** Callback when the card is selected/locked in */
    onSelect?: () => void;
    /** Callback when expand state changes (for managing single-expanded state) */
    onExpandChange?: (isExpanded: boolean) => void;
  }

  let { archetype, selected = false, onSelect, onExpandChange }: Props = $props();

  /** Internal state for expanded/collapsed view */
  let expanded = $state(false);

  /** Get the accent color for this archetype */
  let accentColor = $derived(ARCHETYPE_COLORS[archetype.id] || '#10b981');

  /**
   * Toggle expanded state and notify parent
   */
  function toggleExpanded() {
    expanded = !expanded;
    onExpandChange?.(expanded);
  }

  /**
   * Handle selection/lock-in
   */
  function handleLockIn() {
    if (onSelect) {
      onSelect();
    }
  }

  /**
   * Handle keyboard navigation (Enter/Space to toggle)
   */
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleExpanded();
    }
  }
</script>

<div class="archetype-card" class:selected class:expanded transition:fade={{ duration: 200 }}>
  <!-- Collapsed View -->
  <button
    class="card-header"
    onclick={toggleExpanded}
    onkeydown={handleKeydown}
    aria-expanded={expanded}
    aria-label="Toggle {archetype.name} details"
  >
    <div class="header-content">
      <div class="emoji">{archetype.emoji}</div>
      <div class="header-text">
        <h3 class="name">{archetype.name}</h3>
        <p class="tag">{archetype.tag}</p>
      </div>
    </div>
    <div class="chevron" class:rotated={expanded}>
      <ChevronDown size={20} />
    </div>
  </button>

  <!-- Expanded View -->
  {#if expanded}
    <div class="card-content" transition:slide={{ duration: 300, easing: (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t }}>
      <!-- Long Tag -->
      <div class="section" transition:fade={{ duration: 150, delay: 50 }}>
        <p class="long-tag">{archetype.longTag}</p>
      </div>

      <!-- Match Traits -->
      <div class="section" transition:fade={{ duration: 150, delay: 100 }}>
        <h4 class="section-title">Who You're Looking For</h4>
        <div class="traits-list">
          {#each archetype.matchTraits as trait (trait.label)}
            <div class="trait-item" class:lead={trait.lead} transition:fade={{ duration: 150 }}>
              {#if trait.lead}
                <span class="lead-badge">Lead Match</span>
              {/if}
              <span class="trait-label">{trait.label}</span>
            </div>
          {/each}
        </div>
      </div>

      <!-- What You Bring -->
      <div class="section" transition:fade={{ duration: 150, delay: 100 }}>
        <h4 class="section-title">What You Bring</h4>
        <div class="brings-list">
          {#each archetype.brings as item (item)}
            <div class="bring-item" transition:fade={{ duration: 150 }}>
              <span class="bullet">•</span>
              <span>{item}</span>
            </div>
          {/each}
        </div>
      </div>

      <!-- Traits to Avoid -->
      <div class="section" transition:fade={{ duration: 150, delay: 100 }}>
        <h4 class="section-title">Traits to Avoid</h4>
        <div class="avoid-list">
          {#each archetype.avoidTraits as trait (trait.label)}
            <div class="avoid-item" style="text-decoration: line-through" transition:fade={{ duration: 150 }}>
              <span class="bullet">✕</span>
              <span>{trait.label}</span>
            </div>
          {/each}
        </div>
      </div>

      <!-- Verification Needs -->
      <div class="section" transition:fade={{ duration: 150, delay: 100 }}>
        <h4 class="section-title">What We Need From You</h4>
        <div class="needs-list">
          {#each archetype.needs as need (need)}
            <div class="need-item" transition:fade={{ duration: 150 }}>
              <span class="checkmark">✓</span>
              <span>{need}</span>
            </div>
          {/each}
        </div>
      </div>

      <!-- Time Estimate -->
      <div class="section time-estimate" transition:fade={{ duration: 150, delay: 100 }}>
        <span class="time-label">Verification time:</span>
        <span class="time-value">~{archetype.timeMins} minutes</span>
      </div>

      <!-- Lock It In Button -->
      <button class="lock-button" onclick={handleLockIn} transition:fade={{ duration: 150, delay: 150 }}>
        <span>Lock it in</span>
        <span class="arrow">→</span>
      </button>
    </div>
  {/if}
</div>

<style>
  .archetype-card {
    background: var(--color-vibe-bg-2);
    border: 1px solid var(--color-vibe-border);
    border-radius: var(--radius-lg);
    overflow: hidden;
    transition: var(--transition-base);
    will-change: transform, opacity;
  }

  @media (prefers-reduced-motion: reduce) {
    .archetype-card {
      transition: none;
      will-change: auto;
    }
  }

  @media (hover: hover) {
    .archetype-card:hover {
      border-color: var(--color-vibe-border);
      box-shadow: var(--shadow-md);
    }
  }

  .archetype-card.selected {
    border-color: v-bind(accentColor);
    box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.1);
  }

  /* Card Header (Collapsed View) */
  .card-header {
    width: 100%;
    padding: var(--spacing-lg);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--gap-md);
    background: transparent;
    border: none;
    cursor: pointer;
    transition: background-color 200ms ease;
    font-family: inherit;
    text-align: left;
    will-change: background-color;
    /* Ensure minimum touch target size (44x44px) */
    min-height: 44px;
    touch-action: manipulation;
  }

  @media (prefers-reduced-motion: reduce) {
    .card-header {
      transition: none;
      will-change: auto;
    }
  }

  @media (hover: hover) {
    .card-header:hover {
      background: var(--color-vibe-bg-3);
    }
  }

  /* Active state for touch feedback */
  .card-header:active {
    background: var(--color-vibe-bg-3);
    opacity: 0.8;
  }

  .card-header:focus-visible {
    outline: 2px solid v-bind(accentColor);
    outline-offset: -2px;
  }

  .header-content {
    display: flex;
    align-items: center;
    gap: var(--gap-md);
    flex: 1;
    min-width: 0;
  }

  .emoji {
    font-size: 32px;
    line-height: 1;
    flex-shrink: 0;
  }

  .header-text {
    display: flex;
    flex-direction: column;
    gap: var(--gap-xs);
    min-width: 0;
  }

  .name {
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-semibold);
    color: var(--color-vibe-text-1);
    margin: 0;
    line-height: 1.2;
  }

  .tag {
    font-size: var(--font-size-sm);
    color: var(--color-vibe-text-3);
    margin: 0;
    line-height: 1.2;
  }

  .chevron {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-vibe-text-3);
    transition: transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1), color 200ms ease;
    flex-shrink: 0;
    will-change: transform;
  }

  @media (prefers-reduced-motion: reduce) {
    .chevron {
      transition: none;
      will-change: auto;
    }
  }

  .chevron.rotated {
    transform: rotate(90deg);
  }

  @media (hover: hover) {
    .card-header:hover .chevron {
      color: v-bind(accentColor);
    }
  }

  /* Card Content (Expanded View) */
  .card-content {
    padding: 0 var(--spacing-lg) var(--spacing-lg);
    border-top: 1px solid var(--color-vibe-border);
    display: flex;
    flex-direction: column;
    gap: var(--gap-lg);
    will-change: transform, opacity;
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: var(--gap-md);
    will-change: opacity;
  }

  .section.time-estimate {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-md);
    background: var(--color-vibe-bg-3);
    border-radius: var(--radius-md);
  }

  .long-tag {
    font-size: var(--font-size-base);
    color: var(--color-vibe-text-2);
    margin: 0;
    line-height: var(--line-height-relaxed);
    font-style: italic;
  }

  .section-title {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--color-vibe-text-1);
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  /* Traits List */
  .traits-list {
    display: flex;
    flex-direction: column;
    gap: var(--gap-sm);
  }

  .trait-item {
    display: flex;
    align-items: center;
    gap: var(--gap-sm);
    font-size: var(--font-size-sm);
    color: var(--color-vibe-text-2);
    will-change: opacity;
  }

  .trait-item.lead {
    font-weight: var(--font-weight-semibold);
    color: v-bind(accentColor);
  }

  .lead-badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 6px;
    background: rgba(16, 185, 129, 0.1);
    color: v-bind(accentColor);
    border-radius: var(--radius-sm);
    font-size: 10px;
    font-weight: var(--font-weight-semibold);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    flex-shrink: 0;
  }

  .trait-label {
    flex: 1;
  }

  /* Brings List */
  .brings-list {
    display: flex;
    flex-direction: column;
    gap: var(--gap-sm);
  }

  .bring-item {
    display: flex;
    align-items: flex-start;
    gap: var(--gap-sm);
    font-size: var(--font-size-sm);
    color: var(--color-vibe-text-2);
    line-height: 1.4;
    will-change: opacity;
  }

  .bullet {
    color: v-bind(accentColor);
    font-weight: var(--font-weight-bold);
    flex-shrink: 0;
    margin-top: 2px;
  }

  /* Avoid List */
  .avoid-list {
    display: flex;
    flex-direction: column;
    gap: var(--gap-sm);
  }

  .avoid-item {
    display: flex;
    align-items: flex-start;
    gap: var(--gap-sm);
    font-size: var(--font-size-sm);
    color: var(--color-vibe-text-3);
    line-height: 1.4;
    will-change: opacity;
  }

  .avoid-item .bullet {
    color: #ef4444;
    font-weight: var(--font-weight-bold);
    flex-shrink: 0;
    margin-top: 2px;
  }

  /* Needs List */
  .needs-list {
    display: flex;
    flex-direction: column;
    gap: var(--gap-sm);
  }

  .need-item {
    display: flex;
    align-items: flex-start;
    gap: var(--gap-sm);
    font-size: var(--font-size-sm);
    color: var(--color-vibe-text-2);
    line-height: 1.4;
    will-change: opacity;
  }

  .need-item .checkmark {
    color: var(--color-vibe-lime);
    font-weight: var(--font-weight-bold);
    flex-shrink: 0;
    margin-top: 2px;
  }

  /* Time Estimate */
  .time-label {
    font-size: var(--font-size-sm);
    color: var(--color-vibe-text-3);
    font-weight: var(--font-weight-medium);
  }

  .time-value {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--color-vibe-text-1);
  }

  /* Lock Button */
  .lock-button {
    width: 100%;
    padding: var(--spacing-md) var(--spacing-lg);
    background: v-bind(accentColor);
    color: white;
    border: none;
    border-radius: var(--radius-lg);
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-semibold);
    cursor: pointer;
    transition: opacity 200ms ease, transform 200ms ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--gap-sm);
    font-family: inherit;
    margin-top: var(--spacing-md);
    will-change: opacity, transform;
    /* Ensure minimum touch target size (44x44px) */
    min-height: 44px;
    touch-action: manipulation;
  }

  @media (prefers-reduced-motion: reduce) {
    .lock-button {
      transition: none;
      will-change: auto;
    }
  }

  @media (hover: hover) {
    .lock-button:hover {
      opacity: 0.9;
      box-shadow: var(--shadow-md);
    }
  }

  /* Active state for touch feedback */
  .lock-button:active {
    opacity: 0.8;
    transform: scale(0.98);
  }

  .lock-button:focus-visible {
    outline: 2px solid rgba(255, 255, 255, 0.5);
    outline-offset: 2px;
  }

  .arrow {
    font-size: 18px;
    transition: transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
    will-change: transform;
  }

  @media (prefers-reduced-motion: reduce) {
    .arrow {
      transition: none;
      will-change: auto;
    }
  }

  @media (hover: hover) {
    .lock-button:hover .arrow {
      transform: translateX(4px);
    }
  }

  /* Mobile Responsive */
  @media (max-width: 767px) {
    .card-header {
      padding: var(--spacing-md);
      /* Ensure 44x44px minimum on mobile */
      min-height: 44px;
    }

    .emoji {
      font-size: 28px;
    }

    .name {
      font-size: var(--font-size-base);
    }

    .tag {
      font-size: var(--font-size-xs);
    }

    .card-content {
      padding: 0 var(--spacing-md) var(--spacing-md);
      gap: var(--gap-md);
    }

    .section-title {
      font-size: 11px;
    }

    .trait-item,
    .bring-item,
    .avoid-item,
    .need-item {
      font-size: var(--font-size-xs);
    }

    .lock-button {
      padding: var(--spacing-md);
      font-size: var(--font-size-sm);
      /* Ensure 44x44px minimum on mobile */
      min-height: 44px;
    }
  }
</style>
