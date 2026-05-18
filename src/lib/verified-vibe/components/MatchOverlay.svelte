<script lang="ts">
  import { Heart, X } from 'lucide-svelte';
  import { fade, scale, slide } from 'svelte/transition';
  import type { VerifiedVibeUser } from '../types';

  /**
   * MatchOverlay Component
   *
   * Displays a celebratory overlay when a mutual match occurs. Shows the matched
   * profile with a larger photo, name, age, and location. Provides "Send Message"
   * and "Close" buttons for user actions. Includes smooth animations and is fully
   * responsive (full-screen on mobile).
   *
   * Features:
   * - Displays matched profile with large photo
   * - Shows profile name, age, and location
   * - Celebratory animation with heart icon
   * - "Send Message" button to navigate to chat
   * - "Close" button to return to discovery
   * - Smooth fade and slide animations
   * - Full-screen overlay on mobile
   * - Centered modal on desktop
   * - WCAG 2.1 AA accessibility compliance
   * - Keyboard support (Escape to close)
   * - Mobile responsive (375px-1024px)
   *
   * @component
   * @example
   * ```svelte
   * <MatchOverlay
   *   profile={matchedProfile}
   *   onSendMessage={() => handleSendMessage()}
   *   onClose={() => handleClose()}
   * />
   * ```
   */

  interface Props {
    /** The matched profile to display */
    profile: VerifiedVibeUser;
    /** Callback when user clicks "Send Message" */
    onSendMessage?: () => void;
    /** Callback when user clicks "Close" */
    onClose?: () => void;
  }

  let { profile, onSendMessage, onClose }: Props = $props();

  // State
  let isAnimating = $state(false);

  /**
   * Handle send message button click
   */
  function handleSendMessage() {
    if (!isAnimating) {
      isAnimating = true;
      onSendMessage?.();
    }
  }

  /**
   * Handle close button click
   */
  function handleClose() {
    if (!isAnimating) {
      isAnimating = true;
      onClose?.();
    }
  }

  /**
   * Handle keyboard events (Escape to close)
   */
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && !isAnimating) {
      handleClose();
    }
  }

  /**
   * Handle backdrop click (close overlay)
   */
  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget && !isAnimating) {
      handleClose();
    }
  }
</script>

<div
  class="match-overlay"
  transition:fade={{ duration: 300 }}
  role="dialog"
  aria-modal="true"
  aria-labelledby="match-title"
  tabindex="-1"
  onclick={handleBackdropClick}
  onkeydown={handleKeydown}
>
  <!-- Animated background -->
  <div class="overlay-background" aria-hidden="true">
    <div class="confetti confetti-1"></div>
    <div class="confetti confetti-2"></div>
    <div class="confetti confetti-3"></div>
    <div class="confetti confetti-4"></div>
    <div class="confetti confetti-5"></div>
  </div>

  <!-- Modal Content -->
  <div
    class="match-modal"
    transition:slide={{ duration: 400, axis: 'y' }}
    role="region"
    aria-label="Match notification"
  >
    <!-- Close Button -->
    <button
      class="close-button"
      onclick={handleClose}
      disabled={isAnimating}
      aria-label="Close match overlay"
      title="Close (Esc)"
    >
      <X size={24} aria-hidden="true" />
    </button>

    <!-- Match Header -->
    <div class="match-header">
      <div class="match-icon" transition:scale={{ duration: 600, delay: 100 }} aria-hidden="true">
        💕
      </div>
      <h2 id="match-title" class="match-title">It's a Match!</h2>
      <p class="match-subtitle">You and {profile.firstName} liked each other</p>
    </div>

    <!-- Profile Photo Section -->
    <div class="profile-section" transition:scale={{ duration: 500, delay: 200 }}>
      <div class="profile-photo-container">
        {#if profile.avatar}
          <img
            src={profile.avatar}
            alt={`${profile.firstName}'s profile photo`}
            class="profile-photo"
            loading="eager"
            decoding="async"
          />
        {:else}
          <div class="photo-placeholder" aria-label="No photo available">
            <span class="placeholder-icon">📸</span>
          </div>
        {/if}

        <!-- Decorative ring animation -->
        <div class="photo-ring" aria-hidden="true"></div>
      </div>

      <!-- Profile Info -->
      <div class="profile-info" transition:slide={{ duration: 400, delay: 300, axis: 'y' }}>
        <h3 class="profile-name">{profile.firstName}, {profile.age}</h3>
        {#if profile.city}
          <p class="profile-location">📍 {profile.city}</p>
        {/if}
        {#if profile.about}
          <p class="profile-about">{profile.about}</p>
        {/if}
      </div>
    </div>

    <!-- Action Buttons -->
    <div class="action-buttons" transition:slide={{ duration: 400, delay: 400, axis: 'y' }}>
      <button
        class="button button-secondary"
        onclick={handleClose}
        disabled={isAnimating}
        aria-label="Keep discovering"
      >
        <span class="button-icon">👀</span>
        <span class="button-text">Keep Discovering</span>
      </button>

      <button
        class="button button-primary"
        onclick={handleSendMessage}
        disabled={isAnimating}
        aria-label="Send message to matched profile"
      >
        <Heart size={20} aria-hidden="true" />
        <span class="button-text">Send Message</span>
      </button>
    </div>

    <!-- Trust Score Info (Optional) -->
    {#if profile.trustScore}
      <div class="trust-info" transition:fade={{ duration: 300, delay: 500 }}>
        <span class="trust-badge">🛡️ Trust Score: {profile.trustScore}/100</span>
      </div>
    {/if}
  </div>
</div>

<style>
  /* Overlay Container */
  .match-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: var(--spacing-lg);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    will-change: opacity;
  }

  @media (prefers-reduced-motion: reduce) {
    .match-overlay {
      backdrop-filter: none;
      -webkit-backdrop-filter: none;
    }
  }

  /* Animated Background */
  .overlay-background {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
  }

  .confetti {
    position: absolute;
    width: 10px;
    height: 10px;
    background: var(--color-vibe-emerald);
    border-radius: 50%;
    opacity: 0;
    animation: confetti-fall 3s ease-out forwards;
  }

  .confetti-1 {
    left: 10%;
    animation-delay: 0.2s;
    background: var(--color-vibe-emerald);
  }

  .confetti-2 {
    left: 30%;
    animation-delay: 0.4s;
    background: var(--color-vibe-mint);
  }

  .confetti-3 {
    left: 50%;
    animation-delay: 0.6s;
    background: var(--color-vibe-lime);
  }

  .confetti-4 {
    left: 70%;
    animation-delay: 0.8s;
    background: var(--color-vibe-amber);
  }

  .confetti-5 {
    left: 90%;
    animation-delay: 1s;
    background: var(--color-vibe-emerald);
  }

  @keyframes confetti-fall {
    0% {
      opacity: 1;
      transform: translateY(-100vh) rotate(0deg);
    }
    100% {
      opacity: 0;
      transform: translateY(100vh) rotate(720deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .confetti {
      animation: none;
      opacity: 0;
    }
  }

  /* Modal */
  .match-modal {
    background: var(--color-vibe-bg-1);
    border: 1px solid var(--color-vibe-border);
    border-radius: var(--radius-xl);
    width: 100%;
    max-width: 500px;
    padding: var(--spacing-xl);
    display: flex;
    flex-direction: column;
    gap: var(--gap-lg);
    box-shadow: var(--shadow-xl);
    position: relative;
    z-index: 10;
    will-change: transform, opacity;
  }

  @media (prefers-reduced-motion: reduce) {
    .match-modal {
      will-change: auto;
    }
  }

  /* Close Button */
  .close-button {
    position: absolute;
    top: var(--spacing-lg);
    right: var(--spacing-lg);
    width: 40px;
    height: 40px;
    border-radius: var(--radius-lg);
    background: var(--color-vibe-bg-2);
    border: 1px solid var(--color-vibe-border);
    color: var(--color-vibe-text-1);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 200ms ease;
    font-family: inherit;
    padding: 0;
    min-height: 44px;
    min-width: 44px;
    touch-action: manipulation;
    will-change: background-color, border-color, transform;
  }

  @media (prefers-reduced-motion: reduce) {
    .close-button {
      transition: none;
      will-change: auto;
    }
  }

  @media (hover: hover) {
    .close-button:hover:not(:disabled) {
      background: var(--color-vibe-bg-3);
      border-color: var(--color-vibe-text-2);
      transform: scale(1.05);
    }
  }

  .close-button:active:not(:disabled) {
    transform: scale(0.95);
  }

  .close-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .close-button:focus-visible {
    outline: 2px solid var(--color-vibe-emerald);
    outline-offset: 2px;
  }

  /* Match Header */
  .match-header {
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: var(--gap-md);
    padding-top: var(--spacing-lg);
  }

  .match-icon {
    font-size: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
    will-change: transform;
  }

  @keyframes bounce {
    0%, 100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.15);
    }
  }

  .match-icon {
    animation: bounce 0.8s ease-in-out;
  }

  @media (prefers-reduced-motion: reduce) {
    .match-icon {
      animation: none;
    }
  }

  .match-title {
    font-size: var(--font-size-2xl);
    font-weight: var(--font-weight-bold);
    color: var(--color-vibe-text-1);
    margin: 0;
    line-height: 1.2;
  }

  .match-subtitle {
    font-size: var(--font-size-base);
    color: var(--color-vibe-text-2);
    margin: 0;
    line-height: var(--line-height-relaxed);
  }

  /* Profile Section */
  .profile-section {
    display: flex;
    flex-direction: column;
    gap: var(--gap-lg);
    align-items: center;
    will-change: transform, opacity;
  }

  @media (prefers-reduced-motion: reduce) {
    .profile-section {
      will-change: auto;
    }
  }

  .profile-photo-container {
    position: relative;
    width: 200px;
    height: 200px;
    border-radius: var(--radius-xl);
    overflow: hidden;
    box-shadow: var(--shadow-lg);
  }

  .profile-photo {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .photo-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, var(--color-vibe-bg-3) 0%, var(--color-vibe-bg-2) 100%);
    color: var(--color-vibe-text-3);
  }

  .placeholder-icon {
    font-size: 80px;
  }

  /* Decorative ring animation */
  .photo-ring {
    position: absolute;
    inset: -4px;
    border: 3px solid var(--color-vibe-emerald);
    border-radius: var(--radius-xl);
    opacity: 0.3;
    animation: ring-pulse 2s ease-in-out infinite;
    pointer-events: none;
  }

  @keyframes ring-pulse {
    0%, 100% {
      opacity: 0.3;
      transform: scale(1);
    }
    50% {
      opacity: 0.1;
      transform: scale(1.05);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .photo-ring {
      animation: none;
      opacity: 0.2;
    }
  }

  /* Profile Info */
  .profile-info {
    display: flex;
    flex-direction: column;
    gap: var(--gap-sm);
    text-align: center;
    will-change: transform, opacity;
  }

  @media (prefers-reduced-motion: reduce) {
    .profile-info {
      will-change: auto;
    }
  }

  .profile-name {
    font-size: var(--font-size-xl);
    font-weight: var(--font-weight-bold);
    color: var(--color-vibe-text-1);
    margin: 0;
    line-height: 1.2;
  }

  .profile-location {
    font-size: var(--font-size-base);
    color: var(--color-vibe-text-2);
    margin: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--gap-xs);
  }

  .profile-about {
    font-size: var(--font-size-sm);
    color: var(--color-vibe-text-3);
    margin: 0;
    line-height: var(--line-height-relaxed);
    max-width: 300px;
  }

  /* Action Buttons */
  .action-buttons {
    display: flex;
    flex-direction: column;
    gap: var(--gap-md);
    will-change: transform, opacity;
  }

  @media (prefers-reduced-motion: reduce) {
    .action-buttons {
      will-change: auto;
    }
  }

  .button {
    padding: var(--spacing-md) var(--spacing-lg);
    border-radius: var(--radius-lg);
    border: none;
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-semibold);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--gap-sm);
    transition: all 200ms ease;
    font-family: inherit;
    min-height: 48px;
    touch-action: manipulation;
    will-change: background-color, border-color, transform;
  }

  @media (prefers-reduced-motion: reduce) {
    .button {
      transition: none;
      will-change: auto;
    }
  }

  .button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .button-icon {
    font-size: 20px;
  }

  .button-text {
    display: none;
  }

  @media (min-width: 480px) {
    .button-text {
      display: inline;
    }
  }

  /* Primary Button (Send Message) */
  .button-primary {
    background: var(--color-vibe-emerald);
    color: white;
  }

  @media (hover: hover) {
    .button-primary:hover:not(:disabled) {
      background: var(--color-vibe-emerald-bright);
      transform: translateY(-2px);
      box-shadow: var(--shadow-md);
    }
  }

  .button-primary:active:not(:disabled) {
    transform: translateY(0);
  }

  .button-primary:focus-visible {
    outline: 2px solid rgba(255, 255, 255, 0.5);
    outline-offset: 2px;
  }

  /* Secondary Button (Keep Discovering) */
  .button-secondary {
    background: var(--color-vibe-bg-2);
    color: var(--color-vibe-text-1);
    border: 1px solid var(--color-vibe-border);
  }

  @media (hover: hover) {
    .button-secondary:hover:not(:disabled) {
      background: var(--color-vibe-bg-3);
      border-color: var(--color-vibe-text-2);
      transform: translateY(-2px);
    }
  }

  .button-secondary:active:not(:disabled) {
    transform: translateY(0);
  }

  .button-secondary:focus-visible {
    outline: 2px solid var(--color-vibe-emerald);
    outline-offset: 2px;
  }

  /* Trust Info */
  .trust-info {
    display: flex;
    justify-content: center;
    padding: var(--spacing-md);
    background: var(--color-vibe-bg-2);
    border-radius: var(--radius-lg);
    border: 1px solid var(--color-vibe-border);
    will-change: opacity;
  }

  @media (prefers-reduced-motion: reduce) {
    .trust-info {
      will-change: auto;
    }
  }

  .trust-badge {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--color-vibe-text-2);
    display: flex;
    align-items: center;
    gap: var(--gap-xs);
  }

  /* Mobile Responsive */
  @media (max-width: 767px) {
    .match-overlay {
      padding: var(--spacing-md);
    }

    .match-modal {
      max-width: 100%;
      padding: var(--spacing-lg);
      gap: var(--gap-md);
      border-radius: var(--radius-lg);
    }

    .close-button {
      width: 36px;
      height: 36px;
      min-height: 40px;
      min-width: 40px;
    }

    .match-header {
      gap: var(--gap-sm);
      padding-top: var(--spacing-md);
    }

    .match-icon {
      font-size: 48px;
    }

    .match-title {
      font-size: var(--font-size-xl);
    }

    .match-subtitle {
      font-size: var(--font-size-sm);
    }

    .profile-section {
      gap: var(--gap-md);
    }

    .profile-photo-container {
      width: 160px;
      height: 160px;
    }

    .placeholder-icon {
      font-size: 64px;
    }

    .profile-name {
      font-size: var(--font-size-lg);
    }

    .profile-location {
      font-size: var(--font-size-sm);
    }

    .profile-about {
      font-size: var(--font-size-xs);
      max-width: 280px;
    }

    .action-buttons {
      gap: var(--gap-sm);
    }

    .button {
      padding: var(--spacing-md) var(--spacing-lg);
      font-size: var(--font-size-sm);
      min-height: 44px;
    }

    .button-icon {
      font-size: 18px;
    }

    .trust-info {
      padding: var(--spacing-sm);
    }

    .trust-badge {
      font-size: var(--font-size-xs);
    }
  }

  /* Tablet Responsive */
  @media (min-width: 768px) and (max-width: 1024px) {
    .match-modal {
      max-width: 450px;
    }

    .profile-photo-container {
      width: 180px;
      height: 180px;
    }
  }

  /* Desktop */
  @media (min-width: 1025px) {
    .match-modal {
      max-width: 500px;
    }

    .profile-photo-container {
      width: 200px;
      height: 200px;
    }
  }
</style>
