<script lang="ts">
  import { fade, scale } from 'svelte/transition';
  import { SwipeGestureHandler, type SwipeEvent } from '../utils/swipeGesture';
  import type { DiscoveryProfile } from '../types';

  /**
   * SwipeCard Component
   *
   * A swipeable card component with comprehensive gesture support.
   * Handles both touch and mouse events with smooth animations.
   *
   * Features:
   * - Touch and mouse swipe detection
   * - Smooth card animations
   * - Visual feedback during swipe
   * - Keyboard navigation support
   * - Accessibility compliance
   * - Mobile responsive
   *
   * @component
   * @example
   * ```svelte
   * <SwipeCard
   *   profile={profile}
   *   onLike={() => handleLike()}
   *   onPass={() => handlePass()}
   * />
   * ```
   */

  interface Props {
    /** Profile to display */
    profile: DiscoveryProfile;
    /** Callback when user likes */
    onLike?: () => void;
    /** Callback when user passes */
    onPass?: () => void;
    /** Custom swipe threshold */
    swipeThreshold?: number;
  }

  let {
    profile,
    onLike,
    onPass,
    swipeThreshold = 50
  }: Props = $props();

  // State
  let cardElement: HTMLElement | undefined = $state();
  let swipeHandler = $state(new SwipeGestureHandler({
    threshold: swipeThreshold,
    verticalThreshold: 50,
    velocityThreshold: 0.5
  }));
  let swipeOffset = $state(0);
  let swipeProgress = $state(0);
  let isAnimating = $state(false);
  let swipeDirection = $state<'left' | 'right' | null>(null);

  /**
   * Handle swipe start
   */
  function handleSwipeStart(e: TouchEvent | MouseEvent) {
    if (isAnimating || !swipeHandler) return;

    // Prevent text selection during swipe
    if (e instanceof TouchEvent) {
      e.preventDefault();
    }

    swipeHandler.startSwipe(e);
  }

  /**
   * Handle swipe move
   */
  function handleSwipeMove(e: TouchEvent | MouseEvent) {
    if (!swipeHandler?.isActive() || !swipeHandler) return;

    swipeHandler.updateSwipe(e);
    swipeOffset = swipeHandler.getCurrentOffset();
    swipeProgress = swipeHandler.getCurrentProgress();

    // Update swipe direction indicator
    if (swipeOffset > 0) {
      swipeDirection = 'right';
    } else if (swipeOffset < 0) {
      swipeDirection = 'left';
    }
  }

  /**
   * Handle swipe end
   */
  function handleSwipeEnd() {
    if (!swipeHandler) return;

    const swipeEvent = swipeHandler.endSwipe();
    swipeDirection = null;

    if (swipeEvent) {
      handleSwipeComplete(swipeEvent);
    } else {
      // Reset position if swipe was invalid
      animateReset();
    }
  }

  /**
   * Handle completed swipe
   */
  function handleSwipeComplete(swipeEvent: SwipeEvent) {
    isAnimating = true;

    if (swipeEvent.direction === 'right') {
      animateOut('right', () => {
        onLike?.();
      });
    } else {
      animateOut('left', () => {
        onPass?.();
      });
    }
  }

  /**
   * Animate card out
   */
  function animateOut(direction: 'left' | 'right', callback?: () => void) {
    if (!cardElement) return;

    const distance = direction === 'right' ? 500 : -500;
    const startTime = Date.now();
    const duration = 300;

    function animate() {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      swipeOffset = distance * progress;
      swipeProgress = 1;

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        swipeOffset = 0;
        swipeProgress = 0;
        isAnimating = false;
        callback?.();
      }
    }

    animate();
  }

  /**
   * Animate card back to center
   */
  function animateReset() {
    if (!cardElement) return;

    const startOffset = swipeOffset;
    const startTime = Date.now();
    const duration = 200;

    function animate() {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function for smooth return
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      swipeOffset = startOffset * (1 - easeProgress);
      swipeProgress = swipeHandler?.getCurrentProgress() || 0;

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        swipeOffset = 0;
        swipeProgress = 0;
      }
    }

    animate();
  }

  /**
   * Handle keyboard navigation
   */
  function handleKeydown(e: KeyboardEvent) {
    if (isAnimating) return;

    if (e.key === 'ArrowRight' || e.key === 'Enter') {
      e.preventDefault();
      isAnimating = true;
      animateOut('right', () => {
        onLike?.();
      });
    } else if (e.key === 'ArrowLeft' || e.key === 'Backspace') {
      e.preventDefault();
      isAnimating = true;
      animateOut('left', () => {
        onPass?.();
      });
    }
  }

  /**
   * Calculate opacity based on swipe progress
   */
  const opacity = $derived(1 - Math.abs(swipeProgress) * 0.3);

  /**
   * Calculate rotation based on swipe offset
   */
  const rotation = $derived((swipeOffset / 100) * 5);
</script>

<div
  class="swipe-card"
  bind:this={cardElement}
  role="button"
  tabindex="0"
  aria-label={`Profile of ${profile.firstName}, ${profile.age}`}
  onkeydown={handleKeydown}
  ontouchstart={handleSwipeStart}
  ontouchmove={handleSwipeMove}
  ontouchend={handleSwipeEnd}
  onmousedown={handleSwipeStart}
  onmousemove={handleSwipeMove}
  onmouseup={handleSwipeEnd}
  onmouseleave={handleSwipeEnd}
  style="
    transform: translateX({swipeOffset}px) rotate({rotation}deg);
    opacity: {opacity};
  "
>
  <!-- Card content slot -->
  <slot />

  <!-- Swipe indicators -->
  <div class="swipe-indicators">
    {#if swipeDirection === 'right' && swipeProgress > 0.3}
      <div class="swipe-indicator like" transition:scale={{ duration: 200 }}>
        <span class="indicator-text">❤️ Like</span>
      </div>
    {/if}

    {#if swipeDirection === 'left' && swipeProgress > 0.3}
      <div class="swipe-indicator pass" transition:scale={{ duration: 200 }}>
        <span class="indicator-text">👎 Pass</span>
      </div>
    {/if}
  </div>

  <!-- Progress bar -->
  {#if swipeProgress > 0}
    <div class="swipe-progress">
      <div
        class="progress-bar"
        class:like={swipeDirection === 'right'}
        class:pass={swipeDirection === 'left'}
        style="width: {swipeProgress * 100}%"
      />
    </div>
  {/if}
</div>

<style>
  .swipe-card {
    position: relative;
    width: 100%;
    height: 100%;
    cursor: grab;
    user-select: none;
    touch-action: none;
    transition: transform 100ms ease-out, opacity 100ms ease-out;
    will-change: transform, opacity;
  }

  .swipe-card:active {
    cursor: grabbing;
  }

  .swipe-card:focus-visible {
    outline: 2px solid var(--color-vibe-emerald);
    outline-offset: 2px;
    border-radius: var(--radius-lg);
  }

  @media (prefers-reduced-motion: reduce) {
    .swipe-card {
      transition: none;
      will-change: auto;
    }
  }

  /* Swipe indicators */
  .swipe-indicators {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    z-index: 10;
  }

  .swipe-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 48px;
    font-weight: 700;
    animation: popIn 200ms ease;
  }

  .swipe-indicator.like {
    color: #e74c3c;
    text-shadow: 0 2px 8px rgba(231, 76, 60, 0.3);
  }

  .swipe-indicator.pass {
    color: #95a5a6;
    text-shadow: 0 2px 8px rgba(149, 165, 166, 0.3);
  }

  .indicator-text {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 24px;
    font-weight: 600;
    color: inherit;
  }

  @keyframes popIn {
    from {
      opacity: 0;
      transform: scale(0.5);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  /* Progress bar */
  .swipe-progress {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: var(--color-vibe-bg-3);
    z-index: 20;
    overflow: hidden;
  }

  .progress-bar {
    height: 100%;
    transition: background-color 100ms ease;
  }

  .progress-bar.like {
    background: linear-gradient(90deg, #e74c3c, #c0392b);
  }

  .progress-bar.pass {
    background: linear-gradient(90deg, #95a5a6, #7f8c8d);
  }

  @media (prefers-reduced-motion: reduce) {
    .swipe-indicator {
      animation: none;
    }

    .progress-bar {
      transition: none;
    }
  }
</style>
