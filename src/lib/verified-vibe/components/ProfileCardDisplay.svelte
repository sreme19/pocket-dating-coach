<script lang="ts">
  import { Edit2 } from 'lucide-svelte';
  import { fade, slide } from 'svelte/transition';
  import type { VerifiedVibeUser } from '../types';

  /**
   * ProfileCardDisplay Component
   *
   * Displays user profile card with archetype emoji, name, age, city, distance,
   * about/looking text, and verified badges. Includes edit button for profile updates.
   *
   * Features:
   * - Archetype emoji display
   * - User profile information
   * - Verified badges for completed steps
   * - Edit button for profile updates
   * - Mobile responsive
   * - WCAG 2.1 AA accessibility compliance
   * - Smooth animations
   *
   * @component
   * @example
   * ```svelte
   * <ProfileCardDisplay
   *   profile={userProfile}
   *   onEdit={() => handleEdit()}
   * />
   * ```
   */

  interface Props {
    /** User profile to display */
    profile: VerifiedVibeUser;
    /** Callback when edit button is clicked */
    onEdit?: () => void;
    /** Array of verified badges (e.g., ['id', 'photos', 'spending']) */
    verified?: string[];
  }

  let { profile, onEdit, verified = [] }: Props = $props();

  // Archetype emoji mapping
  const archetypeEmojis: Record<string, string> = {
    casual_man: '🎯',
    spoilt_woman: '👑',
    ambitious_professional: '💼',
    creative_soul: '🎨',
    adventure_seeker: '🧗',
    homebody: '🏠',
    fitness_enthusiast: '💪',
    bookworm: '📚',
    foodie: '🍽️',
    traveler: '✈️'
  };

  let emoji = $derived(archetypeEmojis[profile.archetype] || '✨');

  // Verified badge labels
  const badgeLabels: Record<string, string> = {
    id: 'ID Verified',
    liveness: 'Liveness',
    photos: 'Photos',
    spending: 'Spending',
    spending_or_qa: 'Q&A',
    qa: 'Q&A'
  };
</script>

<div class="profile-card" transition:fade={{ duration: 300 }}>
  <!-- Header with avatar and basic info -->
  <div class="card-header">
    <div class="avatar-section">
      <div class="avatar">
        {#if profile.avatar}
          <img src={profile.avatar} alt={profile.firstName} class="avatar-image" />
        {:else}
          <div class="avatar-placeholder">{emoji}</div>
        {/if}
      </div>
      <div class="archetype-badge">
        <span class="archetype-emoji">{emoji}</span>
      </div>
    </div>

    <div class="info-section">
      <div class="name-info">
        <h2 class="name">{profile.firstName}, {profile.age}</h2>
        <p class="archetype-name">{profile.archetype.replace(/_/g, ' ')}</p>
      </div>

      {#if profile.city}
        <p class="location">📍 {profile.city}</p>
      {/if}
    </div>

    <button class="edit-button" onclick={onEdit} aria-label="Edit profile" title="Edit profile">
      <Edit2 size={18} />
    </button>
  </div>

  <!-- About section -->
  {#if profile.about}
    <div class="section" transition:slide={{ duration: 300, delay: 50 }}>
      <h3 class="section-title">About</h3>
      <p class="section-text">{profile.about}</p>
    </div>
  {/if}

  <!-- Looking for section -->
  {#if profile.looking}
    <div class="section" transition:slide={{ duration: 300, delay: 100 }}>
      <h3 class="section-title">Looking For</h3>
      <p class="section-text">{profile.looking}</p>
    </div>
  {/if}

  <!-- Verified badges -->
  {#if verified.length > 0}
    <div class="verified-section" transition:slide={{ duration: 300, delay: 150 }}>
      <h3 class="section-title">Verified</h3>
      <div class="badges">
        {#each verified as badge}
          <span class="badge" transition:fade={{ duration: 200 }}>
            <span class="badge-icon">✓</span>
            <span class="badge-label">{badgeLabels[badge] || badge}</span>
          </span>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .profile-card {
    background: var(--color-vibe-bg-2);
    border: 1px solid var(--color-vibe-border);
    border-radius: var(--radius-lg);
    padding: var(--spacing-lg);
    display: flex;
    flex-direction: column;
    gap: var(--gap-lg);
    will-change: opacity;
  }

  /* Header */
  .card-header {
    display: flex;
    align-items: flex-start;
    gap: var(--gap-md);
    position: relative;
  }

  .avatar-section {
    position: relative;
    flex-shrink: 0;
  }

  .avatar {
    width: 80px;
    height: 80px;
    border-radius: var(--radius-lg);
    background: var(--color-vibe-bg-3);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    border: 2px solid var(--color-vibe-border);
  }

  .avatar-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .avatar-placeholder {
    font-size: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .archetype-badge {
    position: absolute;
    bottom: -4px;
    right: -4px;
    width: 32px;
    height: 32px;
    background: var(--color-vibe-accent);
    border: 2px solid var(--color-vibe-bg-1);
    border-radius: var(--radius-full);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: var(--shadow-md);
  }

  .archetype-emoji {
    font-size: 18px;
  }

  .info-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--gap-sm);
  }

  .name-info {
    display: flex;
    flex-direction: column;
    gap: var(--gap-xs);
  }

  .name {
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-bold);
    color: var(--color-vibe-text-1);
    margin: 0;
    line-height: 1.2;
  }

  .archetype-name {
    font-size: var(--font-size-sm);
    color: var(--color-vibe-text-3);
    margin: 0;
    text-transform: capitalize;
  }

  .location {
    font-size: var(--font-size-sm);
    color: var(--color-vibe-text-2);
    margin: 0;
  }

  /* Edit Button */
  .edit-button {
    width: 40px;
    height: 40px;
    border-radius: var(--radius-md);
    background: var(--color-vibe-bg-3);
    border: 1px solid var(--color-vibe-border);
    color: var(--color-vibe-text-2);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 200ms ease;
    flex-shrink: 0;
    touch-action: manipulation;
  }

  @media (prefers-reduced-motion: reduce) {
    .edit-button {
      transition: none;
    }
  }

  @media (hover: hover) {
    .edit-button:hover {
      background: var(--color-vibe-accent);
      color: white;
      border-color: var(--color-vibe-accent);
    }
  }

  .edit-button:active {
    transform: scale(0.95);
  }

  .edit-button:focus-visible {
    outline: 2px solid var(--color-vibe-accent);
    outline-offset: 2px;
  }

  /* Sections */
  .section {
    display: flex;
    flex-direction: column;
    gap: var(--gap-sm);
    padding: var(--spacing-md);
    background: var(--color-vibe-bg-3);
    border-radius: var(--radius-md);
  }

  .section-title {
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-semibold);
    color: var(--color-vibe-text-3);
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .section-text {
    font-size: var(--font-size-sm);
    color: var(--color-vibe-text-2);
    margin: 0;
    line-height: var(--line-height-relaxed);
  }

  /* Verified Section */
  .verified-section {
    display: flex;
    flex-direction: column;
    gap: var(--gap-md);
  }

  .badges {
    display: flex;
    flex-wrap: wrap;
    gap: var(--gap-sm);
  }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: var(--gap-xs);
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--color-vibe-lime-tint);
    color: var(--color-vibe-lime);
    border-radius: var(--radius-full);
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-semibold);
    will-change: opacity;
  }

  .badge-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: var(--font-weight-bold);
  }

  .badge-label {
    display: none;
  }

  @media (min-width: 480px) {
    .badge-label {
      display: inline;
    }
  }

  /* Mobile Responsive */
  @media (max-width: 767px) {
    .profile-card {
      padding: var(--spacing-md);
      gap: var(--gap-md);
    }

    .card-header {
      gap: var(--gap-sm);
    }

    .avatar {
      width: 64px;
      height: 64px;
    }

    .avatar-placeholder {
      font-size: 32px;
    }

    .archetype-badge {
      width: 28px;
      height: 28px;
    }

    .archetype-emoji {
      font-size: 16px;
    }

    .name {
      font-size: var(--font-size-base);
    }

    .archetype-name {
      font-size: var(--font-size-xs);
    }

    .location {
      font-size: var(--font-size-xs);
    }

    .edit-button {
      width: 36px;
      height: 36px;
    }

    .section {
      padding: var(--spacing-sm);
      gap: var(--gap-xs);
    }

    .section-title {
      font-size: var(--font-size-xs);
    }

    .section-text {
      font-size: var(--font-size-xs);
    }

    .badges {
      gap: var(--gap-xs);
    }

    .badge {
      padding: var(--spacing-xs) var(--spacing-sm);
      font-size: var(--font-size-xs);
    }
  }
</style>
