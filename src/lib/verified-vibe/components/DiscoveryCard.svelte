<script lang="ts">
  import { Heart, X, MapPin, CheckCircle2, ChevronLeft, ChevronRight, MessageCircle, Flag } from 'lucide-svelte';
  import { fade, scale } from 'svelte/transition';
  import TrustScoreBadge from './TrustScoreBadge.svelte';
  import type { DiscoveryProfile, VerificationStep } from '../types';
  import { ARCHETYPE_COLORS } from '../constants';

  /**
   * DiscoveryCard Component - Enhanced
   *
   * Displays a swipeable profile card for the discovery interface. Shows profile
   * photos with carousel, name, age, archetype, distance, about text, trust score,
   * and verified badges. Supports smooth animations and is fully accessible.
   *
   * Features:
   * - Photo carousel with navigation (swipe, arrows, dots)
   * - Full-width, high-quality profile photo display
   * - Name, age, and archetype emoji
   * - Distance display with icon
   * - About/bio text
   * - Trust score badge with color coding
   * - Verified badges (ID, Photos, Spending, Q&A)
   * - Quick action buttons (Message, Report)
   * - Photo counter and navigation indicators
   * - Smooth animations and transitions
   * - WCAG 2.1 AA accessibility compliance
   * - Mobile responsive (375px-1024px)
   * - Keyboard navigation support
   *
   * @component
   * @example
   * ```svelte
   * <DiscoveryCard
   *   profile={discoveryProfile}
   *   onLike={() => handleLike()}
   *   onPass={() => handlePass()}
   *   onMessage={() => handleMessage()}
   *   onReport={() => handleReport()}
   * />
   * ```
   */

  interface Props {
    /** The profile to display */
    profile: DiscoveryProfile;
    /** Callback when user likes the profile */
    onLike?: () => void;
    /** Callback when user passes on the profile */
    onPass?: () => void;
    /** Callback when user wants to message the profile */
    onMessage?: () => void;
    /** Callback when user wants to report the profile */
    onReport?: () => void;
  }

  let { profile, onLike, onPass, onMessage, onReport }: Props = $props();

  // State
  let isLoading = $state(false);
  let currentPhotoIndex = $state(0);
  let showQuickActions = $state(false);

  // Derived values
  let accentColor = $derived(ARCHETYPE_COLORS[profile.archetype] || '#10b981');
  let verificationBadges = $derived(getVerificationBadges(profile.verified));
  let archetypeEmoji = $derived(getArchetypeEmoji(profile.archetype));
  let allPhotos = $derived(getAllPhotos(profile));
  let currentPhoto = $derived(allPhotos[currentPhotoIndex] || profile.avatar);
  let photoCount = $derived(allPhotos.length);
  let hasMultiplePhotos = $derived(photoCount > 1);

  /**
   * Get all photos (avatar + additional photos)
   */
  function getAllPhotos(profile: DiscoveryProfile): string[] {
    const photos: string[] = [];
    if (profile.avatar) {
      photos.push(profile.avatar);
    }
    if (profile.photos && profile.photos.length > 0) {
      photos.push(...profile.photos);
    }
    return photos.length > 0 ? photos : [profile.avatar || ''];
  }

  /**
   * Get verification badges from verified array
   */
  function getVerificationBadges(verified: string[]): Array<{
    step: VerificationStep;
    label: string;
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
        label: labels[step]
      }));
  }

  /**
   * Get archetype emoji
   */
  function getArchetypeEmoji(archetype: string): string {
    const emojiMap: Record<string, string> = {
      casual_man: '🎯',
      marriage_minded_man: '💍',
      spoilt_woman: '💎',
      safety_first_woman: '🛡️'
    };
    return emojiMap[archetype] || '👤';
  }

  /**
   * Navigate to previous photo
   */
  function previousPhoto() {
    if (hasMultiplePhotos) {
      currentPhotoIndex = (currentPhotoIndex - 1 + photoCount) % photoCount;
    }
  }

  /**
   * Navigate to next photo
   */
  function nextPhoto() {
    if (hasMultiplePhotos) {
      currentPhotoIndex = (currentPhotoIndex + 1) % photoCount;
    }
  }

  /**
   * Go to specific photo
   */
  function goToPhoto(index: number) {
    if (index >= 0 && index < photoCount) {
      currentPhotoIndex = index;
    }
  }

  /**
   * Handle like button click
   */
  function handleLike() {
    if (!isLoading) {
      isLoading = true;
      onLike?.();
      // Reset loading state after animation
      setTimeout(() => {
        isLoading = false;
      }, 300);
    }
  }

  /**
   * Handle pass button click
   */
  function handlePass() {
    if (!isLoading) {
      isLoading = true;
      onPass?.();
      // Reset loading state after animation
      setTimeout(() => {
        isLoading = false;
      }, 300);
    }
  }

  /**
   * Handle message button click
   */
  function handleMessage() {
    if (!isLoading) {
      isLoading = true;
      onMessage?.();
      setTimeout(() => {
        isLoading = false;
      }, 300);
    }
  }

  /**
   * Handle report button click
   */
  function handleReport() {
    if (!isLoading) {
      isLoading = true;
      onReport?.();
      setTimeout(() => {
        isLoading = false;
      }, 300);
    }
  }

  /**
   * Handle keyboard navigation
   */
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (hasMultiplePhotos && showQuickActions === false) {
        nextPhoto();
      } else {
        handleLike();
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (hasMultiplePhotos && showQuickActions === false) {
        previousPhoto();
      } else {
        handlePass();
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleLike();
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      handlePass();
    }
  }
</script>

<div
  class="discovery-card"
  role="article"
  transition:fade={{ duration: 200 }}
  aria-label={`Profile of ${profile.firstName}, ${profile.age} years old, ${profile.distance} away`}
  tabindex="0"
  onkeydown={handleKeydown}
>
  <!-- Photo Section -->
  <div class="photo-section" role="region" aria-label="Profile photos">
    <div class="photo-container">
      {#if currentPhoto}
        <img
          src={currentPhoto}
          alt={`${profile.firstName}'s profile photo`}
          class="profile-photo"
          loading="lazy"
          decoding="async"
          key={currentPhotoIndex}
          transition:fade={{ duration: 200 }}
        />
      {:else}
        <div class="photo-placeholder" aria-label="No photo available">
          <span class="placeholder-icon">📸</span>
        </div>
      {/if}

      <!-- Photo Navigation (if multiple photos) -->
      {#if hasMultiplePhotos}
        <button
          class="photo-nav-button prev"
          onclick={previousPhoto}
          disabled={isLoading}
          aria-label="Previous photo"
          title="Previous photo (← arrow)"
        >
          <ChevronLeft size={24} aria-hidden="true" />
        </button>

        <button
          class="photo-nav-button next"
          onclick={nextPhoto}
          disabled={isLoading}
          aria-label="Next photo"
          title="Next photo (→ arrow)"
        >
          <ChevronRight size={24} aria-hidden="true" />
        </button>

        <!-- Photo Dots -->
        <div class="photo-dots" role="tablist" aria-label="Photo navigation">
          {#each Array.from({ length: photoCount }) as _, i}
            <button
              class="photo-dot"
              class:active={i === currentPhotoIndex}
              onclick={() => goToPhoto(i)}
              disabled={isLoading}
              role="tab"
              aria-selected={i === currentPhotoIndex}
              aria-label={`Photo ${i + 1} of ${photoCount}`}
              title={`Go to photo ${i + 1}`}
            ></button>
          {/each}
        </div>

        <!-- Photo Counter -->
        <div class="photo-counter" aria-live="polite">
          <span class="counter-text">{currentPhotoIndex + 1}/{photoCount}</span>
        </div>
      {/if}

      <!-- Trust Score Badge (Prominent) -->
      <div class="trust-badge-container" transition:scale={{ duration: 300 }}>
        <TrustScoreBadge
          score={profile.trustScore}
          size="lg"
          showLabel={false}
          showPercentage={false}
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
              <CheckCircle2 size={14} aria-hidden="true" />
              <span class="badge-label">{badge.label}</span>
            </div>
          {/each}
        </div>
      {/if}

      <!-- Quick Action Buttons (overlay) -->
      <div class="quick-actions" class:show={showQuickActions}>
        <button
          class="quick-action-button message"
          onclick={handleMessage}
          disabled={isLoading}
          aria-label="Send message"
          title="Send message"
        >
          <MessageCircle size={20} aria-hidden="true" />
          <span class="action-label">Message</span>
        </button>

        <button
          class="quick-action-button report"
          onclick={handleReport}
          disabled={isLoading}
          aria-label="Report profile"
          title="Report profile"
        >
          <Flag size={20} aria-hidden="true" />
          <span class="action-label">Report</span>
        </button>
      </div>

      <!-- Toggle Quick Actions -->
      <button
        class="toggle-quick-actions"
        onclick={() => (showQuickActions = !showQuickActions)}
        disabled={isLoading}
        aria-label={showQuickActions ? 'Hide quick actions' : 'Show quick actions'}
        title="More options"
      >
        ⋯
      </button>
    </div>
  </div>

  <!-- Profile Info Section -->
  <div class="profile-info">
    <!-- Header: Name, Age, Archetype -->
    <div class="header-section">
      <div class="name-age-section">
        <h2 class="name">{profile.firstName}, {profile.age}</h2>
        <div class="archetype-badge">
          <span class="archetype-emoji" aria-label={profile.archetype.replace(/_/g, ' ')}>
            {archetypeEmoji}
          </span>
        </div>
      </div>

      {#if profile.distance}
        <div class="distance" aria-label={`${profile.distance} away`}>
          <MapPin size={16} aria-hidden="true" />
          <span>{profile.distance}</span>
        </div>
      {/if}
    </div>

    <!-- About/Bio Section -->
    {#if profile.about}
      <div class="about-section">
        <p class="about-text">{profile.about}</p>
      </div>
    {/if}

    <!-- Looking For Section -->
    {#if profile.looking}
      <div class="looking-section">
        <p class="looking-label">Looking for:</p>
        <p class="looking-text">{profile.looking}</p>
      </div>
    {/if}

    <!-- Trust Score Details -->
    <div class="trust-details">
      <div class="trust-score-row">
        <span class="trust-label">Trust Score</span>
        <span class="trust-value">{profile.trustScore}/100</span>
      </div>
      {#if verificationBadges.length > 0}
        <div class="verification-count">
          <span class="verification-label">Verified:</span>
          <span class="verification-value">{verificationBadges.length}/4 steps</span>
        </div>
      {/if}
    </div>
  </div>

  <!-- Action Buttons -->
  <div class="action-buttons">
    <button
      class="button pass-button"
      onclick={handlePass}
      disabled={isLoading}
      aria-label="Pass on this profile"
      title="Pass (← or Backspace)"
    >
      <X size={20} aria-hidden="true" />
      <span class="button-text">Pass</span>
    </button>

    <button
      class="button like-button"
      onclick={handleLike}
      disabled={isLoading}
      aria-label="Like this profile"
      title="Like (→ or Enter)"
      style="--accent-color: {accentColor}"
    >
      <Heart size={20} aria-hidden="true" />
      <span class="button-text">Like</span>
    </button>
  </div>
</div>

<style>
  .discovery-card {
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
    box-shadow: var(--shadow-md);
  }

  @media (prefers-reduced-motion: reduce) {
    .discovery-card {
      transition: none;
      will-change: auto;
    }
  }

  @media (hover: hover) {
    .discovery-card:hover {
      box-shadow: var(--shadow-lg);
      transform: translateY(-2px);
    }
  }

  .discovery-card:focus-visible {
    outline: 2px solid var(--color-vibe-emerald);
    outline-offset: 2px;
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
  }

  .placeholder-icon {
    font-size: 64px;
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

  /* Photo Navigation */
  .photo-nav-button {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 44px;
    height: 44px;
    border-radius: var(--radius-lg);
    background: rgba(0, 0, 0, 0.4);
    border: none;
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 200ms ease;
    z-index: 25;
    padding: 0;
    min-height: 44px;
    min-width: 44px;
    touch-action: manipulation;
  }

  .photo-nav-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .photo-nav-button:hover:not(:disabled) {
    background: rgba(0, 0, 0, 0.6);
  }

  .photo-nav-button:active:not(:disabled) {
    transform: translateY(-50%) scale(0.95);
  }

  .photo-nav-button.prev {
    left: var(--spacing-md);
  }

  .photo-nav-button.next {
    right: var(--spacing-md);
  }

  /* Photo Dots */
  .photo-dots {
    position: absolute;
    bottom: var(--spacing-lg);
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: var(--gap-xs);
    z-index: 25;
  }

  .photo-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.5);
    border: none;
    cursor: pointer;
    transition: all 200ms ease;
    padding: 0;
    min-height: 44px;
    min-width: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    touch-action: manipulation;
  }

  .photo-dot:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.7);
  }

  .photo-dot.active {
    background: rgba(255, 255, 255, 0.95);
    width: 12px;
  }

  .photo-dot:disabled {
    cursor: not-allowed;
  }

  /* Photo Counter */
  .photo-counter {
    position: absolute;
    top: var(--spacing-lg);
    left: var(--spacing-lg);
    background: rgba(0, 0, 0, 0.5);
    color: white;
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: var(--radius-md);
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-semibold);
    z-index: 25;
  }

  .counter-text {
    display: flex;
    align-items: center;
    gap: var(--gap-xs);
  }

  /* Quick Actions */
  .quick-actions {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--gap-lg);
    z-index: 30;
    opacity: 0;
    pointer-events: none;
    transition: opacity 200ms ease;
  }

  .quick-actions.show {
    opacity: 1;
    pointer-events: auto;
  }

  .quick-action-button {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--gap-sm);
    padding: var(--spacing-lg);
    border-radius: var(--radius-lg);
    border: none;
    background: white;
    color: var(--color-vibe-text-1);
    cursor: pointer;
    font-weight: var(--font-weight-semibold);
    transition: all 200ms ease;
    min-height: 44px;
    min-width: 44px;
    touch-action: manipulation;
  }

  .quick-action-button:hover:not(:disabled) {
    transform: scale(1.05);
    box-shadow: var(--shadow-lg);
  }

  .quick-action-button:active:not(:disabled) {
    transform: scale(0.95);
  }

  .quick-action-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .quick-action-button.message {
    background: var(--color-vibe-emerald);
    color: white;
  }

  .quick-action-button.report {
    background: #ef4444;
    color: white;
  }

  .action-label {
    font-size: var(--font-size-xs);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  /* Toggle Quick Actions Button */
  .toggle-quick-actions {
    position: absolute;
    bottom: var(--spacing-lg);
    right: var(--spacing-lg);
    width: 44px;
    height: 44px;
    border-radius: var(--radius-lg);
    background: rgba(0, 0, 0, 0.5);
    border: none;
    color: white;
    cursor: pointer;
    font-size: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 200ms ease;
    z-index: 26;
    padding: 0;
    min-height: 44px;
    min-width: 44px;
    touch-action: manipulation;
  }

  .toggle-quick-actions:hover:not(:disabled) {
    background: rgba(0, 0, 0, 0.7);
  }

  .toggle-quick-actions:active:not(:disabled) {
    transform: scale(0.95);
  }

  .toggle-quick-actions:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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

  /* Header Section */
  .header-section {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--gap-md);
  }

  .name-age-section {
    display: flex;
    align-items: center;
    gap: var(--gap-md);
  }

  .name {
    font-size: var(--font-size-xl);
    font-weight: var(--font-weight-bold);
    color: var(--color-vibe-text-1);
    margin: 0;
    line-height: 1.2;
  }

  .archetype-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: var(--radius-lg);
    background: var(--color-vibe-bg-3);
  }

  .archetype-emoji {
    font-size: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .distance {
    display: flex;
    align-items: center;
    gap: var(--gap-xs);
    font-size: var(--font-size-sm);
    color: var(--color-vibe-text-2);
    white-space: nowrap;
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--color-vibe-bg-3);
    border-radius: var(--radius-md);
  }

  /* About Section */
  .about-section {
    display: flex;
    flex-direction: column;
    gap: var(--gap-sm);
  }

  .about-text {
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
    gap: var(--gap-sm);
    padding: var(--spacing-md);
    background: var(--color-vibe-bg-3);
    border-radius: var(--radius-md);
    border-left: 3px solid var(--color-vibe-lime);
  }

  .trust-score-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .trust-label {
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-semibold);
    color: var(--color-vibe-text-3);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .trust-value {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-bold);
    color: var(--color-vibe-lime);
  }

  .verification-count {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: var(--font-size-xs);
  }

  .verification-label {
    color: var(--color-vibe-text-3);
    font-weight: var(--font-weight-semibold);
  }

  .verification-value {
    color: var(--color-vibe-text-2);
    font-weight: var(--font-weight-medium);
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

    .archetype-badge {
      width: 36px;
      height: 36px;
    }

    .archetype-emoji {
      font-size: 20px;
    }

    .distance {
      font-size: var(--font-size-xs);
      padding: var(--spacing-xs) var(--spacing-sm);
    }

    .about-text {
      font-size: var(--font-size-xs);
    }

    .looking-section {
      padding: var(--spacing-sm);
    }

    .looking-label {
      font-size: var(--font-size-xs);
    }

    .looking-text {
      font-size: var(--font-size-xs);
    }

    .trust-details {
      padding: var(--spacing-sm);
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
    .discovery-card {
      max-width: 400px;
    }
  }
</style>
