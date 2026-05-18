<script lang="ts">
  import { Heart, X, MapPin, Shield, CheckCircle2, Flag, Ban } from 'lucide-svelte';
  import { fade, scale } from 'svelte/transition';
  import TrustScoreBadge from './TrustScoreBadge.svelte';
  import type { DiscoveryProfile, VerificationStep } from '../types';
  import { ARCHETYPE_COLORS } from '../constants';

  /**
   * UserProfileCard Component
   *
   * Displays a detailed user profile with trust score badge, verification badges,
   * and like/pass buttons. Supports both expanded and compact views with mobile
   * responsive design.
   *
   * Features:
   * - Prominent trust score badge with color coding
   * - Verification badges for completed steps (ID, Liveness, Photos, Q&A)
   * - Like and Pass buttons with accessible interactions
   * - Block and Report buttons for safety
   * - Photo carousel with navigation
   * - Mobile responsive (375px-1024px)
   * - WCAG 2.1 AA accessibility compliance
   * - Smooth animations and transitions
   *
   * @component
   * @example
   * ```svelte
   * <UserProfileCard
   *   profile={userProfile}
   *   onLike={() => handleLike()}
   *   onPass={() => handlePass()}
   *   onBlock={() => handleBlock()}
   *   onReport={() => handleReport()}
   * />
   * ```
   */

  interface Props {
    /** The user profile to display */
    profile: DiscoveryProfile;
    /** Callback when user clicks like button */
    onLike?: () => void;
    /** Callback when user clicks pass button */
    onPass?: () => void;
    /** Callback when user clicks block button */
    onBlock?: () => void;
    /** Callback when user clicks report button */
    onReport?: () => void;
    /** Whether to show compact view */
    compact?: boolean;
  }

  let { profile, onLike, onPass, onBlock, onReport, compact = false }: Props = $props();

  // State for photo carousel
  let currentPhotoIndex = $state(0);
  let isLoading = $state(false);
  let showMoreOptions = $state(false);

  // Derived values
  let accentColor = $derived(ARCHETYPE_COLORS[profile.archetype] || '#10b981');
  let totalPhotos = $derived(profile.avatar ? 1 : 0); // In real app, would be array of photos
  let verificationBadges = $derived(getVerificationBadges(profile.verified));

  /**
   * Get verification badges from verified array
   */
  function getVerificationBadges(verified: string[]): Array<{
    step: VerificationStep;
    label: string;
    icon: string;
  }> {
    const steps: VerificationStep[] = ['id', 'liveness', 'photos', 'spending_or_qa'];
    const labels: Record<VerificationStep, string> = {
      id: 'ID',
      liveness: 'Liveness',
      photos: 'Photos',
      spending_or_qa: 'Q&A'
    };

    return steps
      .filter((step) => verified.includes(step))
      .map((step) => ({
        step,
        label: labels[step],
        icon: '✓'
      }));
  }

  /**
   * Handle like button click
   */
  function handleLike() {
    isLoading = true;
    onLike?.();
    // Reset loading state after animation
    setTimeout(() => {
      isLoading = false;
    }, 300);
  }

  /**
   * Handle pass button click
   */
  function handlePass() {
    isLoading = true;
    onPass?.();
    // Reset loading state after animation
    setTimeout(() => {
      isLoading = false;
    }, 300);
  }

  /**
   * Handle block button click
   */
  function handleBlock() {
    if (!onBlock) return;
    isLoading = true;
    onBlock();
    setTimeout(() => {
      isLoading = false;
      showMoreOptions = false;
    }, 300);
  }

  /**
   * Handle report button click
   */
  function handleReport() {
    if (!onReport) return;
    isLoading = true;
    onReport();
    setTimeout(() => {
      isLoading = false;
      showMoreOptions = false;
    }, 300);
  }

  /**
   * Navigate to next photo
   */
  function nextPhoto() {
    if (totalPhotos > 1) {
      currentPhotoIndex = (currentPhotoIndex + 1) % totalPhotos;
    }
  }

  /**
   * Navigate to previous photo
   */
  function prevPhoto() {
    if (totalPhotos > 1) {
      currentPhotoIndex = (currentPhotoIndex - 1 + totalPhotos) % totalPhotos;
    }
  }

  /**
   * Toggle more options menu
   */
  function toggleMoreOptions() {
    showMoreOptions = !showMoreOptions;
  }

</script>

<div class="user-profile-card" class:compact transition:fade={{ duration: 200 }}>
  <!-- Photo Section with Trust Score Badge -->
  <div class="photo-section" role="region" aria-label="User photos">
    <!-- Main Photo -->
    <div class="photo-container">
      {#if profile.avatar}
        <img
          src={profile.avatar}
          alt={`${profile.firstName}'s profile photo`}
          class="profile-photo"
          loading="lazy"
        />
      {:else}
        <div class="photo-placeholder">
          <span>No photo</span>
        </div>
      {/if}

      <!-- Photo Navigation (if multiple photos) -->
      {#if totalPhotos > 1}
        <button
          class="nav-button prev"
          onclick={prevPhoto}
          aria-label="Previous photo"
          title="Previous photo"
        >
          ‹
        </button>
        <button
          class="nav-button next"
          onclick={nextPhoto}
          aria-label="Next photo"
          title="Next photo"
        >
          ›
        </button>

        <!-- Photo Indicators -->
        <div class="photo-indicators">
          {#each Array(totalPhotos) as _, i}
            <button
              class="indicator"
              class:active={i === currentPhotoIndex}
              onclick={() => (currentPhotoIndex = i)}
              aria-label={`Go to photo ${i + 1}`}
              aria-current={i === currentPhotoIndex}
            ></button>
          {/each}
        </div>
      {/if}

      <!-- Trust Score Badge (Prominent) -->
      <div class="trust-badge-container" transition:scale={{ duration: 300 }}>
        <TrustScoreBadge
          score={profile.trustScore}
          size="lg"
          showLabel={true}
          showPercentage={true}
        />
      </div>

      <!-- Verification Badges -->
      {#if verificationBadges.length > 0}
        <div class="verification-badges" transition:fade={{ duration: 200 }}>
          {#each verificationBadges as badge (badge.step)}
            <div
              class="verification-badge"
              title={`${badge.label} verified`}
              aria-label={`${badge.label} verified`}
              transition:scale={{ duration: 200 }}
            >
              <CheckCircle2 size={16} />
              <span class="badge-label">{badge.label}</span>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  <!-- Profile Info Section -->
  <div class="profile-info">
    <!-- Name, Age, Location -->
    <div class="header-info">
      <div class="name-age">
        <h2 class="name">{profile.firstName}, {profile.age}</h2>
        <p class="archetype">{profile.archetype.replace(/_/g, ' ')}</p>
      </div>

      {#if profile.distance}
        <div class="distance" aria-label={`${profile.distance} away`}>
          <MapPin size={16} />
          <span>{profile.distance}</span>
        </div>
      {/if}
    </div>

    <!-- Bio/About Section -->
    {#if profile.about && !compact}
      <div class="bio-section">
        <p class="bio">{profile.about}</p>
      </div>
    {/if}

    <!-- Looking For Section -->
    {#if profile.looking && !compact}
      <div class="looking-section">
        <p class="looking-label">Looking for:</p>
        <p class="looking-text">{profile.looking}</p>
      </div>
    {/if}

    <!-- Trust Score Details (Expanded View) -->
    {#if !compact}
      <div class="trust-details">
        <div class="trust-header">
          <Shield size={16} />
          <span>Trust Score Breakdown</span>
        </div>
        <div class="trust-breakdown">
          <div class="trust-item">
            <span class="trust-label">Identity</span>
            <div class="trust-bar">
              <div class="trust-fill" style="width: {Math.min(profile.trustScore, 100)}%"></div>
            </div>
          </div>
          <div class="trust-item">
            <span class="trust-label">Verification</span>
            <span class="trust-value">{verificationBadges.length}/4 steps</span>
          </div>
        </div>
      </div>
    {/if}
  </div>

  <!-- Action Buttons -->
  <div class="action-buttons">
    <button
      class="button pass-button"
      onclick={handlePass}
      disabled={isLoading}
      aria-label="Pass on this profile"
      title="Pass"
    >
      <X size={20} />
      <span class="button-text">Pass</span>
    </button>

    <button
      class="button like-button"
      onclick={handleLike}
      disabled={isLoading}
      aria-label="Like this profile"
      title="Like"
      style="--accent-color: {accentColor}"
    >
      <Heart size={20} />
      <span class="button-text">Like</span>
    </button>

    <!-- More Options Menu -->
    <div class="more-options-container">
      <button
        class="button more-button"
        onclick={toggleMoreOptions}
        onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleMoreOptions()}
        disabled={isLoading}
        aria-label="More options"
        aria-expanded={showMoreOptions}
        title="More options"
      >
        ⋮
      </button>

      {#if showMoreOptions}
        <div class="more-options-menu" transition:fade={{ duration: 150 }}>
          <button
            class="menu-item block-item"
            onclick={handleBlock}
            disabled={isLoading}
            aria-label="Block this user"
          >
            <Ban size={16} />
            <span>Block</span>
          </button>
          <button
            class="menu-item report-item"
            onclick={handleReport}
            disabled={isLoading}
            aria-label="Report this user"
          >
            <Flag size={16} />
            <span>Report</span>
          </button>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .user-profile-card {
    display: flex;
    flex-direction: column;
    background: var(--color-vibe-bg-2);
    border: 1px solid var(--color-vibe-border);
    border-radius: var(--radius-lg);
    overflow: hidden;
    transition: var(--transition-base);
    will-change: transform, opacity;
    height: 100%;
    max-width: 100%;
  }

  @media (prefers-reduced-motion: reduce) {
    .user-profile-card {
      transition: none;
      will-change: auto;
    }
  }

  @media (hover: hover) {
    .user-profile-card:hover {
      box-shadow: var(--shadow-lg);
      transform: translateY(-2px);
    }
  }

  /* Photo Section */
  .photo-section {
    position: relative;
    width: 100%;
    aspect-ratio: 3 / 4;
    background: var(--color-vibe-bg-3);
    overflow: hidden;
  }

  .photo-container {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
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
    font-size: var(--font-size-base);
  }

  /* Photo Navigation */
  .nav-button {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 44px;
    height: 44px;
    background: rgba(0, 0, 0, 0.3);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    font-size: 24px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color 200ms ease;
    z-index: 10;
    touch-action: manipulation;
  }

  @media (prefers-reduced-motion: reduce) {
    .nav-button {
      transition: none;
    }
  }

  @media (hover: hover) {
    .nav-button:hover {
      background: rgba(0, 0, 0, 0.5);
    }
  }

  .nav-button:active {
    background: rgba(0, 0, 0, 0.6);
  }

  .nav-button:focus-visible {
    outline: 2px solid white;
    outline-offset: 2px;
  }

  .nav-button.prev {
    left: var(--spacing-md);
  }

  .nav-button.next {
    right: var(--spacing-md);
  }

  /* Photo Indicators */
  .photo-indicators {
    position: absolute;
    bottom: var(--spacing-md);
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: var(--gap-xs);
    z-index: 10;
  }

  .indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.5);
    border: none;
    cursor: pointer;
    transition: background-color 200ms ease;
    padding: 0;
    touch-action: manipulation;
  }

  @media (prefers-reduced-motion: reduce) {
    .indicator {
      transition: none;
    }
  }

  .indicator.active {
    background: white;
  }

  @media (hover: hover) {
    .indicator:hover {
      background: rgba(255, 255, 255, 0.8);
    }
  }

  /* Trust Badge */
  .trust-badge-container {
    position: absolute;
    top: var(--spacing-lg);
    right: var(--spacing-lg);
    background: rgba(255, 255, 255, 0.95);
    padding: var(--spacing-md);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    z-index: 20;
    will-change: transform, opacity;
  }

  /* Verification Badges */
  .verification-badges {
    position: absolute;
    bottom: var(--spacing-lg);
    left: var(--spacing-lg);
    right: var(--spacing-lg);
    display: flex;
    flex-wrap: wrap;
    gap: var(--gap-sm);
    z-index: 15;
  }

  .verification-badge {
    display: flex;
    align-items: center;
    gap: var(--gap-xs);
    background: rgba(255, 255, 255, 0.95);
    color: var(--color-vibe-lime);
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: var(--radius-full);
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-semibold);
    box-shadow: var(--shadow-md);
    will-change: transform, opacity;
  }

  .badge-label {
    display: none;
  }

  @media (min-width: 480px) {
    .badge-label {
      display: inline;
    }
  }

  /* Profile Info */
  .profile-info {
    flex: 1;
    padding: var(--spacing-lg);
    display: flex;
    flex-direction: column;
    gap: var(--gap-md);
    overflow-y: auto;
  }

  .header-info {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--gap-md);
  }

  .name-age {
    display: flex;
    flex-direction: column;
    gap: var(--gap-xs);
  }

  .name {
    font-size: var(--font-size-xl);
    font-weight: var(--font-weight-bold);
    color: var(--color-vibe-text-1);
    margin: 0;
    line-height: 1.2;
  }

  .archetype {
    font-size: var(--font-size-sm);
    color: var(--color-vibe-text-3);
    margin: 0;
    text-transform: capitalize;
    line-height: 1.2;
  }

  .distance {
    display: flex;
    align-items: center;
    gap: var(--gap-xs);
    font-size: var(--font-size-sm);
    color: var(--color-vibe-text-2);
    white-space: nowrap;
  }

  /* Bio Section */
  .bio-section {
    display: flex;
    flex-direction: column;
    gap: var(--gap-sm);
  }

  .bio {
    font-size: var(--font-size-sm);
    color: var(--color-vibe-text-2);
    margin: 0;
    line-height: var(--line-height-relaxed);
  }

  /* Looking For Section */
  .looking-section {
    display: flex;
    flex-direction: column;
    gap: var(--gap-xs);
    padding: var(--spacing-md);
    background: var(--color-vibe-bg-3);
    border-radius: var(--radius-md);
  }

  .looking-label {
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-semibold);
    color: var(--color-vibe-text-3);
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .looking-text {
    font-size: var(--font-size-sm);
    color: var(--color-vibe-text-2);
    margin: 0;
    line-height: var(--line-height-relaxed);
  }

  /* Trust Details */
  .trust-details {
    display: flex;
    flex-direction: column;
    gap: var(--gap-md);
    padding: var(--spacing-md);
    background: var(--color-vibe-bg-3);
    border-radius: var(--radius-md);
    border-left: 3px solid var(--color-vibe-lime);
  }

  .trust-header {
    display: flex;
    align-items: center;
    gap: var(--gap-sm);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--color-vibe-text-1);
  }

  .trust-breakdown {
    display: flex;
    flex-direction: column;
    gap: var(--gap-md);
  }

  .trust-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--gap-md);
  }

  .trust-label {
    font-size: var(--font-size-xs);
    color: var(--color-vibe-text-3);
    font-weight: var(--font-weight-medium);
    min-width: 80px;
  }

  .trust-bar {
    flex: 1;
    height: 6px;
    background: var(--color-vibe-border);
    border-radius: var(--radius-full);
    overflow: hidden;
  }

  .trust-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--color-vibe-lime), var(--color-vibe-emerald));
    transition: width 300ms ease;
  }

  .trust-value {
    font-size: var(--font-size-xs);
    color: var(--color-vibe-text-2);
    font-weight: var(--font-weight-semibold);
    min-width: 60px;
    text-align: right;
  }

  /* Action Buttons */
  .action-buttons {
    display: flex;
    gap: var(--gap-md);
    padding: var(--spacing-lg);
    background: var(--color-vibe-bg-1);
    border-top: 1px solid var(--color-vibe-border);
  }

  .button {
    flex: 1;
    padding: var(--spacing-md) var(--spacing-lg);
    border: 2px solid var(--color-vibe-border);
    border-radius: var(--radius-lg);
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-semibold);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--gap-sm);
    transition: all 200ms ease;
    font-family: inherit;
    min-height: 44px;
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

  .button-text {
    display: none;
  }

  @media (min-width: 480px) {
    .button-text {
      display: inline;
    }
  }

  /* Pass Button */
  .pass-button {
    background: transparent;
    color: var(--color-vibe-text-2);
  }

  @media (hover: hover) {
    .pass-button:hover:not(:disabled) {
      background: var(--color-vibe-bg-3);
      border-color: var(--color-vibe-text-3);
      color: var(--color-vibe-text-1);
    }
  }

  .pass-button:active:not(:disabled) {
    transform: scale(0.98);
  }

  .pass-button:focus-visible {
    outline: 2px solid var(--color-vibe-text-2);
    outline-offset: 2px;
  }

  /* Like Button */
  .like-button {
    background: var(--accent-color);
    color: white;
    border-color: var(--accent-color);
  }

  @media (hover: hover) {
    .like-button:hover:not(:disabled) {
      opacity: 0.9;
      box-shadow: var(--shadow-md);
    }
  }

  .like-button:active:not(:disabled) {
    transform: scale(0.98);
  }

  .like-button:focus-visible {
    outline: 2px solid rgba(255, 255, 255, 0.5);
    outline-offset: 2px;
  }

  /* More Options */
  .more-options-container {
    position: relative;
  }

  .more-button {
    background: transparent;
    color: var(--color-vibe-text-2);
    border-color: var(--color-vibe-border);
    font-size: var(--font-size-lg);
    padding: var(--spacing-md) var(--spacing-sm);
  }

  @media (hover: hover) {
    .more-button:hover:not(:disabled) {
      background: var(--color-vibe-bg-3);
      border-color: var(--color-vibe-text-3);
      color: var(--color-vibe-text-1);
    }
  }

  .more-button:active:not(:disabled) {
    transform: scale(0.98);
  }

  .more-button:focus-visible {
    outline: 2px solid var(--color-vibe-text-2);
    outline-offset: 2px;
  }

  /* More Options Menu */
  .more-options-menu {
    position: absolute;
    bottom: 100%;
    right: 0;
    background: var(--color-vibe-bg-2);
    border: 1px solid var(--color-vibe-border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    z-index: 100;
    min-width: 140px;
    overflow: hidden;
    will-change: opacity;
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: var(--gap-sm);
    width: 100%;
    padding: var(--spacing-md) var(--spacing-lg);
    background: transparent;
    border: none;
    color: var(--color-vibe-text-2);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    cursor: pointer;
    transition: all 150ms ease;
    text-align: left;
    font-family: inherit;
    touch-action: manipulation;
  }

  @media (prefers-reduced-motion: reduce) {
    .menu-item {
      transition: none;
    }
  }

  .menu-item:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  @media (hover: hover) {
    .menu-item:hover:not(:disabled) {
      background: var(--color-vibe-bg-3);
      color: var(--color-vibe-text-1);
    }
  }

  .menu-item:active:not(:disabled) {
    background: var(--color-vibe-bg-3);
  }

  .menu-item:focus-visible {
    outline: 2px solid var(--color-vibe-text-2);
    outline-offset: -2px;
  }

  .menu-item.block-item {
    color: var(--color-vibe-text-2);
  }

  .menu-item.block-item:hover:not(:disabled) {
    color: #ef4444;
  }

  .menu-item.report-item {
    color: var(--color-vibe-text-2);
    border-top: 1px solid var(--color-vibe-border);
  }

  .menu-item.report-item:hover:not(:disabled) {
    color: #f59e0b;
  }

  /* Compact View */
  .user-profile-card.compact .profile-info {
    padding: var(--spacing-md);
  }

  .user-profile-card.compact .name {
    font-size: var(--font-size-lg);
  }

  .user-profile-card.compact .bio-section,
  .user-profile-card.compact .looking-section,
  .user-profile-card.compact .trust-details {
    display: none;
  }

  /* Mobile Responsive */
  @media (max-width: 767px) {
    .photo-section {
      aspect-ratio: 1 / 1;
    }

    .trust-badge-container {
      top: var(--spacing-md);
      right: var(--spacing-md);
      padding: var(--spacing-sm);
    }

    .verification-badges {
      bottom: var(--spacing-md);
      left: var(--spacing-md);
      right: var(--spacing-md);
    }

    .profile-info {
      padding: var(--spacing-md);
      gap: var(--gap-sm);
    }

    .name {
      font-size: var(--font-size-lg);
    }

    .archetype {
      font-size: var(--font-size-xs);
    }

    .bio {
      font-size: var(--font-size-xs);
    }

    .action-buttons {
      padding: var(--spacing-md);
      gap: var(--gap-sm);
    }

    .button {
      padding: var(--spacing-sm) var(--spacing-md);
      font-size: var(--font-size-sm);
      min-height: 40px;
    }
  }

  /* Tablet Responsive */
  @media (min-width: 768px) and (max-width: 1024px) {
    .photo-section {
      aspect-ratio: 3 / 4;
    }

    .profile-info {
      padding: var(--spacing-lg);
    }
  }

  /* Desktop */
  @media (min-width: 1025px) {
    .user-profile-card {
      max-width: 400px;
    }
  }
</style>
