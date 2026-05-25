<script lang="ts">
  import { goto } from '$app/navigation';
  import { user } from '$lib/verified-vibe/stores';
  import { ARCHETYPES, ARCHETYPES_BY_GENDER, ARCHETYPE_SECTIONS } from '$lib/verified-vibe/constants';
  import type { Archetype, Gender, VerifiedVibeUser } from '$lib/verified-vibe/types';
  import ArchetypeCard from '$lib/verified-vibe/components/ArchetypeCard.svelte';
  import ArchetypeDetailModal from '$lib/verified-vibe/components/ArchetypeDetailModal.svelte';
  import LiveWomenCarousel from '$lib/verified-vibe/components/LiveWomenCarousel.svelte';
  import { getProfile } from '$lib/verified-vibe/services/profileService';

  let gender = $state<Gender | null>(null);
  let openedArchetype = $state<Archetype | null>(null);
  let activeSection = $state<string | null>(null);

  // Countdown — starts at 14:59 and counts down
  let secondsLeft = $state(19 * 60 + 59);
  const timerDisplay = $derived(() => {
    const m = Math.floor(secondsLeft / 60).toString().padStart(2, '0');
    const s = (secondsLeft % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  });

  $effect(() => {
    const id = setInterval(() => {
      secondsLeft = secondsLeft > 0 ? secondsLeft - 1 : 0;
    }, 1000);
    return () => clearInterval(id);
  });

  $effect(() => {
    // Priority 1: fresh selection just made at the gate
    const pending = localStorage.getItem('verified_vibe_pending_gender') as Gender | null;
    if (pending) {
      gender = pending;
      localStorage.setItem('verified_vibe_gender', pending);
      localStorage.removeItem('verified_vibe_pending_gender');
      return;
    }

    // Priority 2: gender already stored locally from a previous gate visit
    // Trust localStorage over the DB here — the gate is the authoritative entry
    // point for gender selection, and a mismatched profile.gender (e.g. from a
    // seed account or stale data) should not override what the user picked.
    const stored = localStorage.getItem('verified_vibe_gender');
    if (stored) {
      gender = stored as Gender;
      return;
    }

    // Priority 3: no localStorage — first load or cleared storage, fall back to profile
    getProfile().then((profile) => {
      if (profile?.gender) {
        gender = profile.gender;
        localStorage.setItem('verified_vibe_gender', profile.gender);
      }
    }).catch(() => {});
  });

  const availableSections = $derived.by(() => {
    if (!gender) return [];
    const sections = ARCHETYPE_SECTIONS[gender] || [];
    return sections.map(section => ({
      label: section.label,
      archetypes: section.ids
        .map(id => ARCHETYPES[id as Archetype])
        .filter(Boolean),
    }));
  });

  const openedArchetypeData = $derived(openedArchetype ? ARCHETYPES[openedArchetype] : null);

  function toggleSection(label: string) {
    activeSection = activeSection === label ? null : label;
  }

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
    openedArchetype = null;

    goto('/verified-vibe/auth');
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
    <div class="urgency-banner">
      <div class="urgency-top">
        <span class="urgency-label">Get matched within</span>
        <span class="urgency-timer">{timerDisplay()}</span>
        <span class="urgency-label">minutes.</span>
        <span class="urgency-guaranteed">Guaranteed.</span>
      </div>
      <p class="urgency-sub">
        Earn your profile, verify your intent. <em class="pay-later-inline">Pay later.</em>
      </p>
    </div>
  </div>

  <div class="lane-section">
    <div class="lane-header">
      <p class="lane-q">What are you here for?</p>
      <p class="lane-sub">Pick one. You can switch later — but switching means re-verifying.</p>
    </div>

    {#if availableSections.length > 0}
      <div class="sections">
        {#each availableSections as section (section.label)}
          {@const isOpen = activeSection === section.label}
          <div class="section" class:section--collapsed={!isOpen}>
            <button
              class="section-header"
              class:section-header--serious={section.label === 'Serious Connection'}
              class:section-header--low={section.label === 'Low-Pressure'}
              onclick={() => toggleSection(section.label)}
              aria-expanded={isOpen}
            >
              <span class="section-pill">
                {section.label === 'Serious Connection' ? '❤️' : '✌️'}
                {section.label}
              </span>
              <span class="section-count">{section.archetypes.length} options</span>
              <span class="section-chevron" class:rotated={!isOpen}>›</span>
            </button>

            {#if isOpen}
              <div class="section-cards">
                {#each section.archetypes as archetype (archetype.id)}
                  <ArchetypeCard
                    {archetype}
                    onOpen={() => { openedArchetype = archetype.id as Archetype; }}
                  />
                {/each}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {:else}
      <div class="loading-cards">
        {#each [1, 2, 3, 4] as _}
          <div class="skeleton"></div>
        {/each}
      </div>
    {/if}

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

  .urgency-banner {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 14px 16px;
    background: color-mix(in srgb, var(--accent-bright) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent-bright) 25%, transparent);
    border-radius: 14px;
  }

  .urgency-top {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 6px;
  }

  .urgency-label {
    font-size: 15px;
    color: var(--text-2);
    font-weight: 500;
  }

  .urgency-timer {
    font-size: 22px;
    font-weight: 800;
    color: var(--accent-bright);
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.01em;
    animation: timer-pulse 1s ease-in-out infinite;
  }

  @keyframes timer-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }

  .urgency-guaranteed {
    font-size: 14px;
    font-weight: 700;
    color: var(--accent-bright);
    font-style: italic;
  }

  .urgency-sub {
    font-size: 13px;
    color: var(--text-3);
    margin: 0;
    line-height: 1.45;
  }

  .pay-later-inline {
    color: var(--accent-bright);
    font-weight: 600;
    font-style: italic;
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

  /* ── Sections ─────────────────────────────────────────────────────────────── */

  .sections {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .section {
    border-radius: 18px;
    border: 1px solid var(--border-1);
    overflow: hidden;
    transition: border-color 200ms;
  }

  .section--collapsed {
    border-color: var(--border-1);
  }

  .section-header {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 16px;
    background: var(--bg-2);
    border: none;
    cursor: pointer;
    font-family: inherit;
    text-align: left;
    transition: background 180ms;
  }

  .section-header:active {
    background: var(--bg-3);
  }

  @media (hover: hover) {
    .section-header:hover {
      background: var(--bg-3);
    }
  }

  .section-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    padding: 5px 12px;
    border-radius: 100px;
    flex-shrink: 0;
  }

  .section-header--serious .section-pill {
    background: color-mix(in srgb, var(--accent-bright) 12%, transparent);
    color: var(--accent-bright);
  }

  .section-header--low .section-pill {
    background: color-mix(in srgb, #a78bfa 12%, transparent);
    color: #a78bfa;
  }

  .section-count {
    font-size: 12px;
    color: var(--text-4);
    flex: 1;
  }

  .section-chevron {
    font-size: 20px;
    color: var(--text-3);
    line-height: 1;
    transition: transform 220ms ease;
    display: block;
    transform: rotate(90deg);
  }

  .section-chevron.rotated {
    transform: rotate(-90deg);
  }

  .section-cards {
    display: flex;
    flex-direction: column;
    gap: 1px;
    background: var(--border-1);
    border-top: 1px solid var(--border-1);
  }

  .section-cards :global(.card) {
    border-radius: 0;
    border: none;
    border-bottom: none;
  }

  .section-cards :global(.card:last-child) {
    border-radius: 0 0 17px 17px;
  }

  /* ── Loading skeletons ───────────────────────────────────────────────────── */

  .loading-cards {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .skeleton {
    height: 76px;
    border-radius: 16px;
    background: var(--bg-2);
    animation: pulse 1.4s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
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
