<script lang="ts">
  import { goto } from '$app/navigation';
  import { user, setPhase } from '$lib/verified-vibe/stores';
  import { ARCHETYPES, ARCHETYPES_BY_GENDER } from '$lib/verified-vibe/constants';
  import type { Archetype, Gender, VerifiedVibeUser } from '$lib/verified-vibe/types';
  import ArchetypeCard from '$lib/verified-vibe/components/ArchetypeCard.svelte';
  import ArchetypeDetailModal from '$lib/verified-vibe/components/ArchetypeDetailModal.svelte';
  import LiveWomenCarousel from '$lib/verified-vibe/components/LiveWomenCarousel.svelte';
  import { getProfile } from '$lib/verified-vibe/services/profileService';

  let gender = $state<Gender | null>(null);
  let openedArchetype = $state<Archetype | null>(null);

  $effect(() => {
    // Pending gender (set by gate page) is highest priority — the user just selected it.
    const pending = localStorage.getItem('verified_vibe_pending_gender') as Gender | null;
    if (pending) {
      gender = pending;
      localStorage.setItem('verified_vibe_gender', pending);
      localStorage.removeItem('verified_vibe_pending_gender');
      return;
    }

    // Fallback: load from Supabase profile or localStorage
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

  const availableArchetypes = $derived.by(() => {
    if (!gender) return [];
    const archetypeIds = ARCHETYPES_BY_GENDER[gender] || [];
    return archetypeIds.map(id => ARCHETYPES[id as Archetype]).filter(Boolean);
  });

  const openedArchetypeData = $derived(openedArchetype ? ARCHETYPES[openedArchetype] : null);

  function handleLockIn(archetypeId: Archetype) {
    localStorage.setItem('verified_vibe_archetype', archetypeId);
    localStorage.setItem('verified_vibe_pending_archetype', archetypeId);

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
    openedArchetype = null;
    goto('/verified-vibe/verify');
  }
</script>

<div class="home">
  <div class="hero">
    <div class="eyebrow">
      <span class="shield">🛡</span>
      VERIFIED VIBE · V1
    </div>
    <h1 class="title">
      Pick your<br /><em>lane.</em>
    </h1>
    <p class="subtitle">
      Stop swiping blind. Earn your profile, verify your intent, and start speaking to people who actually want what you want.
    </p>
    <p class="pay-later"><em>Pay later.</em></p>
  </div>

  <div class="lane-section">
    <div class="lane-header">
      <p class="lane-q">What are you here for?</p>
      <p class="lane-sub">Pick one. You can switch later — but switching means re-verifying.</p>
    </div>

    <div class="lane-cards">
      {#each availableArchetypes as archetype (archetype.id)}
        <ArchetypeCard
          {archetype}
          onOpen={() => { openedArchetype = archetype.id as Archetype; }}
        />
      {/each}
    </div>

    <p class="trust-note">
      We verify ID, photos, spending pattern &amp; intent.<br />
      No one sees the raw files — only the signals you allow.
    </p>
  </div>

  <div class="carousel-section">
    <LiveWomenCarousel viewerGender={gender} />
  </div>
</div>

<ArchetypeDetailModal
  archetype={openedArchetypeData}
  onClose={() => { openedArchetype = null; }}
  onLockIn={() => { if (openedArchetype) handleLockIn(openedArchetype); }}
/>

<style>
  .home {
    padding: 20px 16px 40px;
    display: flex;
    flex-direction: column;
    gap: 28px;
    min-height: 100%;
  }

  .hero {
    padding-top: 8px;
  }

  .eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-3);
    margin-bottom: 16px;
  }

  .shield {
    font-size: 14px;
    color: var(--accent-bright);
  }

  .title {
    font-family: var(--font-serif);
    font-style: italic;
    font-size: clamp(54px, 15vw, 72px);
    line-height: 0.92;
    letter-spacing: -0.02em;
    color: var(--text-1);
    margin: 0 0 18px;
  }

  .title em {
    color: var(--accent-bright);
    font-style: italic;
  }

  .subtitle {
    font-size: 15px;
    color: var(--text-2);
    line-height: 1.55;
    margin: 0 0 4px;
  }

  .pay-later {
    font-style: italic;
    color: var(--accent-bright);
    font-size: 15px;
    margin: 0;
  }

  .lane-section {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .lane-header {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .lane-q {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-1);
    margin: 0;
    letter-spacing: -0.01em;
  }

  .lane-sub {
    font-size: 13px;
    color: var(--text-3);
    margin: 0;
    line-height: 1.4;
  }

  .lane-cards {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .trust-note {
    font-size: 12px;
    color: var(--text-4);
    text-align: center;
    line-height: 1.6;
    margin: 0;
    padding: 0 8px;
  }

  .carousel-section {
    /* gap from parent handles spacing */
  }
</style>
