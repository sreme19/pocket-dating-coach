<script lang="ts">
  import { goto } from '$app/navigation';
  import { setPhase, setError } from '$lib/verified-vibe/stores';
  import { ARCHETYPES, ARCHETYPES_BY_GENDER } from '$lib/verified-vibe/constants';
  import type { Archetype, Gender } from '$lib/verified-vibe/types';
  import { ChevronRight } from 'lucide-svelte';
  import { slide, fade } from 'svelte/transition';
  import ArchetypeCard from '$lib/verified-vibe/components/ArchetypeCard.svelte';
  import LiveNowCarousel from '$lib/verified-vibe/components/LiveNowCarousel.svelte';

  let gender = $state<Gender | null>(null);
  let selectedArchetype = $state<Archetype | null>(null);
  let expandedArchetype = $state<Archetype | null>(null);

  // Get gender from localStorage
  $effect(() => {
    const stored = localStorage.getItem('verified_vibe_gender');
    if (stored) {
      gender = stored as Gender;
    }
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
    } else {
      // Only collapse if it's the currently expanded card
      if (expandedArchetype === archetypeId) {
        expandedArchetype = null;
      }
    }
  }

  function handleLockIn(archetypeId: Archetype) {
    selectedArchetype = archetypeId;
    localStorage.setItem('verified_vibe_archetype', archetypeId);
    setPhase('verify');
    goto('/verified-vibe/verify');
  }
</script>

<div class="home-screen">
  <!-- Hero section -->
  <div class="home-hero" transition:slide={{ duration: 400, delay: 0, axis: 'y' }}>
    <div class="home-mark">
      <span class="shield">🛡️</span>
      Verified dating
    </div>
    <h1 class="home-title">Find your <em>match</em></h1>
    <p class="home-tag">
      Choose your dating archetype. We'll match you with people who align with your values.
    </p>
  </div>

  <!-- Archetype selection -->
  <div class="home-content">
    <!-- Live Now Carousel -->
    <LiveNowCarousel />

    <div class="archetype-prompt" transition:slide={{ duration: 400, delay: 100, axis: 'y' }}>
      <p class="home-prompt">What's your dating vibe?</p>
      <p class="home-prompt-sub">Select one to see who you'll match with</p>
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
  </div>
</div>

<style>
  .home-screen {
    padding: 8px 24px 32px;
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 100%;
  }

  .home-hero {
    padding: 28px 0 24px;
  }

  .home-mark {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--text-2);
    letter-spacing: 0.04em;
    text-transform: uppercase;
    font-weight: 600;
    margin-bottom: 18px;
  }

  .home-mark .shield {
    color: var(--accent-bright);
  }

  .home-title {
    font-family: var(--font-serif);
    font-style: italic;
    font-size: 56px;
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
    font-size: 15px;
    color: var(--text-2);
    margin: 14px 0 24px;
    max-width: 30ch;
  }

  .home-content {
    flex: 1;
  }

  .archetype-prompt {
    margin-bottom: 20px;
  }

  .home-prompt {
    font-size: 18px;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: var(--text-1);
    margin: 0;
  }

  .home-prompt-sub {
    font-size: 13px;
    color: var(--text-3);
    margin: 2px 0 0;
  }

  .archetype-grid {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .archetype-wrapper {
    position: relative;
  }

  @media (max-width: 767px) {
    .home-screen {
      padding: 16px 16px 24px;
    }

    .home-hero {
      padding: 24px 0 20px;
    }

    .home-title {
      font-size: 40px;
      line-height: 1;
      margin-bottom: 8px;
    }

    .home-tag {
      font-size: 14px;
      margin: 12px 0 20px;
    }

    .archetype-prompt {
      margin-bottom: 16px;
    }

    .home-prompt {
      font-size: 16px;
      margin: 0;
    }

    .home-prompt-sub {
      font-size: 12px;
      margin: 4px 0 0;
    }

    .archetype-grid {
      gap: 8px;
    }
  }
</style>
