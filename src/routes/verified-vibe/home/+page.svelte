<script lang="ts">
  import { goto } from '$app/navigation';
  import { user, setPhase, setError } from '$lib/verified-vibe/stores';
  import { ARCHETYPES, ARCHETYPES_BY_GENDER } from '$lib/verified-vibe/constants';
  import type { Archetype, Gender, VerifiedVibeUser } from '$lib/verified-vibe/types';
  import { ChevronRight } from 'lucide-svelte';
  import { slide, fade } from 'svelte/transition';
  import ArchetypeCard from '$lib/verified-vibe/components/ArchetypeCard.svelte';
  import ProfileSummaryCard from '$lib/verified-vibe/components/ProfileSummaryCard.svelte';
  import LiveWomenCarousel from '$lib/verified-vibe/components/LiveWomenCarousel.svelte';
  import { getProfile, upsertProfile } from '$lib/verified-vibe/services/profileService';

  let gender = $state<Gender | null>(null);
  let selectedArchetype = $state<Archetype | null>(null);
  let expandedArchetype = $state<Archetype | null>(null);
  let showProfileSummary = $state(false);

  // Load gender — try Supabase first (logged-in users), fall back to localStorage (pre-auth)
  $effect(() => {
    getProfile().then((profile) => {
      if (profile?.gender) {
        gender = profile.gender;
        localStorage.setItem('verified_vibe_gender', profile.gender);
      } else {
        const stored = localStorage.getItem('verified_vibe_gender');
        if (stored) gender = stored as Gender;
      }
    }).catch(() => {
      const stored = localStorage.getItem('verified_vibe_gender');
      if (stored) gender = stored as Gender;
    });
  });

  // Get available archetypes for this gender
  const availableArchetypes = $derived.by(() => {
    if (!gender) return [];
    const archetypeIds = ARCHETYPES_BY_GENDER[gender] || [];
    return archetypeIds.map(id => ARCHETYPES[id as Archetype]).filter(Boolean);
  });

  /**
   * Handle expand/collapse with single-expanded-at-a-time logic
   */
  function handleExpandChange(archetypeId: Archetype, isExpanded: boolean) {
    if (isExpanded) {
      // Collapse any previously expanded card
      expandedArchetype = archetypeId;
      showProfileSummary = true;
    } else {
      // Only collapse if it's the currently expanded card
      if (expandedArchetype === archetypeId) {
        expandedArchetype = null;
        showProfileSummary = false;
      }
    }
  }

  function handleLockIn(archetypeId: Archetype) {
    selectedArchetype = archetypeId;
    localStorage.setItem('verified_vibe_archetype', archetypeId);
    localStorage.setItem('verified_vibe_pending_archetype', archetypeId);

    // Dev mode: create a local user directly, skip auth
    const devUser: VerifiedVibeUser = {
      id: crypto.randomUUID(),
      gender: gender!,
      archetype: archetypeId,
      firstName: '',
      age: 0,
      city: '',
      avatar: null,
      about: null,
      looking: null,
      trustScore: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    user.set(devUser);
    setPhase('verification');
    goto('/verified-vibe/verification');
  }
</script>

<div class="home-screen">
  <!-- Hero section -->
  <div class="home-hero" transition:slide={{ duration: 400, delay: 0, axis: 'y' }}>
    <div class="home-mark">
      <span class="shield">🛡️</span>
      Verified Vibe
    </div>
    <h1 class="home-title">Pick your <em>lane.</em></h1>
    <p class="home-tag">
      Stop swiping blind. Earn your profile, verify your intent, and start speaking to people who actually want what you want.
    </p>
  </div>

  <!-- Archetype selection -->
  <div class="home-content">
    <div class="archetype-prompt" transition:slide={{ duration: 400, delay: 100, axis: 'y' }}>
      <p class="home-prompt">What are you here for?</p>
      <p class="home-prompt-sub">Pick one. You can switch later – but switching means re-verifying.</p>
    </div>

    <div class="archetype-grid">
      {#each availableArchetypes as archetype, index (archetype.id)}
        {@const isExpanded = expandedArchetype === archetype.id}
        <div class="archetype-wrapper" transition:slide={{ duration: 400, delay: 150 + index * 50, axis: 'y' }}>
          <ArchetypeCard
            {archetype}
            selected={selectedArchetype === archetype.id}
            onSelect={() => handleLockIn(archetype.id)}
            onExpandChange={(isExpanded) => handleExpandChange(archetype.id, isExpanded)}
          />
        </div>
      {/each}
    </div>

    <!-- Profile Summary Card -->
    {#if showProfileSummary && expandedArchetype}
      <div class="profile-summary-wrapper" transition:slide={{ duration: 300, axis: 'y' }}>
        <ProfileSummaryCard
          archetype={expandedArchetype}
          onClose={() => { showProfileSummary = false; expandedArchetype = null; }}
        />
      </div>
    {/if}

    <!-- Live Women Carousel -->
    {#if expandedArchetype}
      <div class="live-carousel-wrapper" transition:slide={{ duration: 300, axis: 'y' }}>
        <LiveWomenCarousel />
      </div>
    {/if}

    <!-- CTA -->
    {#if expandedArchetype}
      <div class="cta-section" transition:slide={{ duration: 300, axis: 'y' }}>
        <button class="cta-button" onclick={() => handleLockIn(expandedArchetype)}>
          Start with {ARCHETYPES[expandedArchetype].name} →
        </button>
        <p class="cta-note">
          We verify ID, photos, spending pattern & intent. No one sees the raw files — only the signals you allow.
        </p>
      </div>
    {/if}
  </div>
</div>

<style>
  .home-screen {
    padding: 16px 16px 32px;
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 100%;
    width: 100%;
    max-width: 100%;
  }

  .home-hero {
    padding: 20px 0 16px;
  }

  .home-mark {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--text-2);
    letter-spacing: 0.04em;
    text-transform: uppercase;
    font-weight: 600;
    margin-bottom: 16px;
  }

  .home-mark .shield {
    color: var(--accent-bright);
  }

  .home-title {
    font-family: var(--font-serif);
    font-style: italic;
    font-size: 36px;
    line-height: 0.95;
    letter-spacing: -0.02em;
    color: var(--text-1);
    margin: 0 0 4px;
  }

  .home-title em {
    color: var(--accent-bright);
    font-style: italic;
  }

  .home-tag {
    font-size: 14px;
    color: var(--text-2);
    margin: 12px 0 20px;
    max-width: 100%;
    line-height: 1.5;
  }

  .home-content {
    flex: 1;
  }

  .archetype-prompt {
    margin-bottom: 16px;
  }

  .home-prompt {
    font-size: 16px;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: var(--text-1);
    margin: 0;
  }

  .home-prompt-sub {
    font-size: 12px;
    color: var(--text-3);
    margin: 4px 0 0;
    line-height: 1.4;
  }

  .archetype-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .archetype-wrapper {
    position: relative;
  }

  .profile-summary-wrapper {
    margin-top: 16px;
  }

  .live-carousel-wrapper {
    margin-top: 16px;
  }

  .cta-section {
    margin-top: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .cta-button {
    padding: 14px 16px;
    border-radius: 10px;
    background: var(--accent-bright);
    color: var(--bg-1);
    font-size: 14px;
    font-weight: 600;
    border: none;
    cursor: pointer;
    transition: all 200ms ease;
    font-family: inherit;
    width: 100%;
  }

  .cta-button:active {
    opacity: 0.85;
    transform: scale(0.98);
  }

  .cta-note {
    font-size: 11px;
    color: var(--text-4);
    text-align: center;
    margin: 0;
    line-height: 1.5;
  }

  @media (min-width: 768px) {
    .home-screen {
      padding: 24px 20px 40px;
    }

    .home-hero {
      padding: 28px 0 24px;
    }

    .home-title {
      font-size: 48px;
      line-height: 0.95;
      margin-bottom: 8px;
    }

    .home-tag {
      font-size: 15px;
      margin: 14px 0 24px;
      max-width: 30ch;
    }

    .archetype-prompt {
      margin-bottom: 20px;
    }

    .home-prompt {
      font-size: 18px;
    }

    .home-prompt-sub {
      font-size: 13px;
      margin: 2px 0 0;
    }

    .archetype-grid {
      gap: 10px;
    }

    .profile-summary-wrapper {
      margin-top: 24px;
    }

    .live-carousel-wrapper {
      margin-top: 24px;
    }

    .cta-section {
      margin-top: 24px;
    }

    .cta-button {
      padding: 16px 20px;
      border-radius: 12px;
      font-size: 15px;
    }

    .cta-button:hover {
      opacity: 0.9;
      transform: translateY(-1px);
      box-shadow: 0 4px 16px rgba(52, 211, 153, 0.3);
    }

    .cta-button:active {
      opacity: 0.85;
      transform: scale(1);
    }

    .cta-note {
      font-size: 12px;
    }
  }
</style>
