<script lang="ts">
  import { goto } from '$app/navigation';
  import { setPhase } from '$lib/verified-vibe/stores';
  import { ARCHETYPES } from '$lib/verified-vibe/constants';
  import type { Archetype } from '$lib/verified-vibe/types';
  import { ChevronLeft } from 'lucide-svelte';
  import LiveWomenCarousel from '$lib/verified-vibe/components/LiveWomenCarousel.svelte';
  import { getProfile, getProfileCompleteness } from '$lib/verified-vibe/services/profileService';

  let archetype = $state<Archetype | null>(null);

  function loadArchetype() {
    getProfile().then((profile) => {
      if (profile?.archetype) {
        archetype = profile.archetype;
        localStorage.setItem('verified_vibe_archetype', profile.archetype);
      } else {
        const stored = localStorage.getItem('verified_vibe_archetype');
        if (stored) archetype = stored as Archetype;
        else goto('/verified-vibe/home');
      }
    }).catch(() => {
      const stored = localStorage.getItem('verified_vibe_archetype');
      if (stored) archetype = stored as Archetype;
      else goto('/verified-vibe/home');
    });
  }

  $effect(() => {
    // If the user is already fully verified, route them straight to discover.
    // This is a safety net for cases where routeAfterAuth() landed them here
    // due to a session-propagation race that has since resolved.
    getProfileCompleteness().then((completeness) => {
      if (completeness === 'complete') {
        setPhase('app');
        goto('/verified-vibe/discover');
        return;
      }
      loadArchetype();
    }).catch(() => {
      loadArchetype();
    });
  });

  const archetypeData = $derived(archetype ? ARCHETYPES[archetype] : null);

  const steps = [
    { num: '01', name: 'Government ID',      sub: 'prove you\'re real',        time: '~30 sec' },
    { num: '02', name: 'Lifestyle Choices',  sub: 'prove you\'re solid',       time: '~45 sec' },
    { num: '03', name: 'Match Preferences',  sub: 'tell us who you want',      time: '~3 min'  },
  ];

  function handleBack() {
    setPhase('home');
    goto('/verified-vibe/home');
  }

  function handleStart() {
    setPhase('verification');
    goto('/verified-vibe/verification');
  }
</script>

<div class="screen">
  <button class="back-btn" onclick={handleBack} aria-label="Go back">
    <ChevronLeft size={20} />
  </button>

  <div class="hero">
    <h1 class="title">Earn your<br /><em>profile.</em></h1>
  </div>

  <div class="steps-list">
    {#each steps as step}
      <div class="step-row">
        <div class="step-num">{step.num}</div>
        <div class="step-info">
          <span class="step-name">{step.name}</span>
          <span class="step-sub">{step.sub}</span>
        </div>
        <div class="step-time">{step.time}</div>
      </div>
    {/each}

    <div class="step-total">
      <span class="total-icon">⚡</span>
      <span class="total-label">Total time · <strong>~5 min</strong></span>
      <span class="total-pause">Pause anytime</span>
    </div>
  </div>

  <div class="carousel-section">
    <LiveWomenCarousel />
  </div>

  <div class="cta-section">
    <button class="cta-btn" onclick={handleStart}>
      Start with Government ID →
    </button>
    <p class="privacy-note">
      We verify ID, photos, spending pattern &amp; intent.<br />
      No one sees the raw files — only the signals you allow.
    </p>
  </div>
</div>

<style>
  .screen {
    padding: 16px 16px calc(32px + env(safe-area-inset-bottom, 0));
    display: flex;
    flex-direction: column;
    gap: 28px;
    min-height: 100%;
  }

  .back-btn {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    display: grid;
    place-items: center;
    cursor: pointer;
    color: var(--text-2);
    align-self: flex-start;
    transition: background 200ms;
    flex-shrink: 0;
  }

  .back-btn:active { background: var(--bg-3); }

  .hero {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .title {
    font-family: var(--font-serif);
    font-style: italic;
    font-size: clamp(48px, 13vw, 64px);
    line-height: 0.92;
    letter-spacing: -0.02em;
    color: var(--text-1);
    margin: 0;
  }

  .title em {
    color: var(--accent-bright);
    font-style: italic;
  }

  .subtitle {
    font-size: 14px;
    color: var(--text-2);
    line-height: 1.55;
    margin: 0;
  }

  .steps-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .step-row {
    display: grid;
    grid-template-columns: 40px 1fr auto;
    align-items: center;
    gap: 14px;
    padding: 14px 16px;
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    border-radius: 14px;
  }

  .step-num {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: var(--accent-tint);
    color: var(--accent-bright);
    font-size: 13px;
    font-weight: 700;
    font-family: var(--font-mono, monospace);
    display: grid;
    place-items: center;
    flex-shrink: 0;
  }

  .step-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .step-name {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-1);
    line-height: 1.2;
  }

  .step-sub {
    font-size: 12px;
    color: var(--text-3);
  }

  .step-time {
    font-size: 12px;
    color: var(--text-3);
    font-family: var(--font-mono, monospace);
    white-space: nowrap;
  }

  .step-total {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    background: var(--accent-tint);
    border: 1px solid rgba(16, 185, 129, 0.3);
    border-radius: 14px;
    font-size: 14px;
    color: var(--text-1);
  }

  .total-icon {
    font-size: 16px;
    flex-shrink: 0;
  }

  .total-label {
    flex: 1;
  }

  .total-label strong {
    color: var(--accent-bright);
    font-weight: 700;
  }

  .total-pause {
    font-size: 12px;
    color: var(--text-3);
  }

  .carousel-section {
    /* gap from parent handles spacing */
  }

  .cta-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: auto;
    padding-top: 4px;
  }

  .cta-btn {
    width: 100%;
    min-height: 56px;
    padding: 16px;
    background: var(--accent-bright);
    color: #06281e;
    border: none;
    border-radius: 14px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: opacity 200ms, transform 200ms;
  }

  .cta-btn:active {
    opacity: 0.85;
    transform: scale(0.98);
  }

  @media (hover: hover) {
    .cta-btn:hover {
      opacity: 0.9;
      box-shadow: 0 8px 24px -8px rgba(52, 211, 153, 0.5);
      transform: translateY(-1px);
    }
  }

  .privacy-note {
    font-size: 11px;
    color: var(--text-4);
    text-align: center;
    line-height: 1.6;
    margin: 0;
  }
</style>
