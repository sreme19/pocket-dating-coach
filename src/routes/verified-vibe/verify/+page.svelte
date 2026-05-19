<script lang="ts">
  import { goto } from '$app/navigation';
  import { setPhase } from '$lib/verified-vibe/stores';
  import { ARCHETYPES, VERIFICATION_STEPS } from '$lib/verified-vibe/constants';
  import type { Archetype } from '$lib/verified-vibe/types';
  import { ChevronLeft, Clock } from 'lucide-svelte';
  import { slide, fade } from 'svelte/transition';
  import { getProfile } from '$lib/verified-vibe/services/profileService';

  let archetype = $state<Archetype | null>(null);

  // Load archetype from Supabase (falls back to localStorage)
  $effect(() => {
    getProfile().then((profile) => {
      if (profile?.archetype) {
        archetype = profile.archetype;
        localStorage.setItem('verified_vibe_archetype', profile.archetype);
      } else {
        const stored = localStorage.getItem('verified_vibe_archetype');
        if (stored) {
          archetype = stored as Archetype;
        } else {
          goto('/verified-vibe/home');
        }
      }
    }).catch(() => {
      const stored = localStorage.getItem('verified_vibe_archetype');
      if (stored) {
        archetype = stored as Archetype;
      } else {
        goto('/verified-vibe/home');
      }
    });
  });

  const archetypeData = $derived(archetype ? ARCHETYPES[archetype] : null);

  function handleBack() {
    setPhase('home');
    goto('/verified-vibe/home');
  }

  function handleStartVerification() {
    setPhase('verification');
    goto('/verified-vibe/verification');
  }

  const totalTime = $derived(
    VERIFICATION_STEPS.reduce((sum, step) => {
      const minutes = parseInt(step.time);
      return sum + (isNaN(minutes) ? 0 : minutes);
    }, 0)
  );
</script>

<div class="verify-screen">
  <!-- Header -->
  <div class="verify-top" transition:slide={{ duration: 400, delay: 0, axis: 'y' }}>
    <button class="verify-back" onclick={handleBack} title="Go back">
      <ChevronLeft size={20} />
    </button>
  </div>

  <!-- Archetype Hero Section -->
  {#if archetypeData}
    <div class="archetype-hero" transition:slide={{ duration: 400, delay: 50, axis: 'y' }}>
      <div class="archetype-emoji" transition:fade={{ duration: 300, delay: 100 }}>
        {archetypeData.emoji}
      </div>
      <h1 class="archetype-name" transition:fade={{ duration: 300, delay: 150 }}>
        {archetypeData.name}
      </h1>
      <p class="archetype-tag" transition:fade={{ duration: 300, delay: 200 }}>
        {archetypeData.tag}
      </p>
      <p class="archetype-description" transition:fade={{ duration: 300, delay: 250 }}>
        {archetypeData.longTag}
      </p>
    </div>
  {/if}

  <!-- Hero -->
  {#if archetypeData}
    <div class="verify-hero" transition:slide={{ duration: 400, delay: 100, axis: 'y' }}>
      <h2>
        Get <em>verified</em>
      </h2>
      <p>
        Complete a quick verification process to unlock matches. We keep your data private and secure.
      </p>
    </div>

    <!-- Verification steps -->
    <div class="verify-list" transition:slide={{ duration: 400, delay: 150, axis: 'y' }}>
      {#each VERIFICATION_STEPS as step, index}
        <div class="verify-item" transition:fade={{ duration: 300, delay: 200 + index * 50 }}>
          <div class="step">{index + 1}</div>
          <div class="label">
            <div class="n">{step.label}</div>
            <div class="d">{step.description}</div>
          </div>
          <div class="t">{step.time}</div>
        </div>
      {/each}
    </div>

    <!-- Time estimate -->
    <div class="verify-time" transition:slide={{ duration: 400, delay: 250, axis: 'y' }}>
      <Clock size={16} class="ico" />
      <span>Takes about <span class="em">~{totalTime} minutes</span> total</span>
    </div>

    <!-- Privacy note -->
    <div class="verify-privacy-note" transition:slide={{ duration: 400, delay: 300, axis: 'y' }}>
      <p>
        Your verification data is encrypted and stored securely. We never share your information with third parties.
      </p>
    </div>

    <!-- CTA -->
    <div class="verify-foot" transition:slide={{ duration: 400, delay: 350, axis: 'y' }}>
      <button class="btn btn-primary full" onclick={handleStartVerification}>
        Start Verification
      </button>
      <button class="btn btn-secondary full" onclick={handleBack}>
        Back
      </button>
    </div>

    <!-- Footer text -->
    <div class="verify-privacy" transition:fade={{ duration: 400, delay: 400 }}>
      <p>
        By verifying, you agree to our <a href="/verified-vibe/privacy">Verification Policy</a> and <a href="/verified-vibe/privacy">Privacy Policy</a>.
      </p>
    </div>
  {/if}
</div>

<style>
  .verify-screen {
    padding: 16px 24px 24px;
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 100%;
  }

  .verify-top {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 22px;
  }

  .verify-back {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    display: grid;
    place-items: center;
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    color: var(--text-2);
    cursor: pointer;
    transition: all 200ms ease;
    font-family: inherit;
  }

  .verify-back:hover {
    color: var(--text-1);
    border-color: var(--border-2);
  }

  /* Archetype Hero Section */
  .archetype-hero {
    text-align: center;
    margin-bottom: 32px;
    padding: 24px 0;
    border-bottom: 1px solid var(--border-1);
  }

  .archetype-emoji {
    font-size: 64px;
    line-height: 1;
    margin-bottom: 16px;
    display: inline-block;
  }

  .archetype-name {
    font-size: 32px;
    font-weight: 700;
    line-height: 1.2;
    margin: 0 0 8px;
    color: var(--text-1);
    letter-spacing: -0.01em;
  }

  .archetype-tag {
    font-size: 14px;
    font-weight: 600;
    color: var(--accent-bright);
    margin: 0 0 12px;
    letter-spacing: 0.02em;
  }

  .archetype-description {
    font-size: 14px;
    font-style: italic;
    color: var(--text-2);
    margin: 0;
    line-height: 1.5;
    max-width: 40ch;
    margin-left: auto;
    margin-right: auto;
  }

  .verify-hero {
    margin-bottom: 22px;
  }

  .verify-hero h2 {
    font-family: var(--font-serif);
    font-style: italic;
    font-size: 44px;
    line-height: 1;
    letter-spacing: -0.02em;
    margin: 0 0 12px;
    color: var(--text-1);
  }

  .verify-hero h2 em {
    color: var(--accent-bright);
    font-style: italic;
  }

  .verify-hero p {
    margin: 0;
    font-size: 14px;
    color: var(--text-2);
    max-width: 32ch;
    line-height: 1.5;
  }

  .verify-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 22px;
  }

  .verify-item {
    display: grid;
    grid-template-columns: 32px 1fr auto;
    gap: 14px;
    align-items: center;
    padding: 14px 16px;
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    border-radius: var(--r-md);
  }

  .verify-item .step {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--accent-tint);
    color: var(--accent-bright);
    font-family: var(--font-mono);
    font-size: 13px;
    font-weight: 700;
  }

  .verify-item .label {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .verify-item .label .n {
    font-size: 14px;
    font-weight: 600;
  }

  .verify-item .label .d {
    font-size: 12px;
    color: var(--text-3);
  }

  .verify-item .t {
    font-size: 11px;
    color: var(--text-3);
    font-family: var(--font-mono);
  }

  .verify-time {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    background: var(--accent-tint);
    border: 1px solid rgba(16, 185, 129, 0.25);
    border-radius: var(--r-md);
    margin-bottom: 16px;
    font-size: 13px;
    color: var(--text-1);
  }

  .verify-time .em {
    color: var(--accent-bright);
    font-weight: 700;
  }

  .verify-privacy-note {
    padding: 12px 16px;
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    border-radius: var(--r-md);
    margin-bottom: 16px;
    font-size: 12px;
    color: var(--text-2);
    line-height: 1.5;
  }

  .verify-privacy-note p {
    margin: 0;
  }

  .verify-foot {
    margin-top: auto;
    padding-top: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .btn {
    width: 100%;
    min-height: 48px;
    padding: 13px 16px;
    font-size: 15px;
    font-weight: 600;
    border-radius: var(--r-lg);
    cursor: pointer;
    transition: all 200ms ease;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: inherit;
    border: none;
  }

  .btn-primary {
    background: var(--accent);
    color: #06281e;
  }

  .btn-primary:hover {
    background: var(--accent-bright);
    box-shadow: 0 8px 24px -8px var(--accent-glow);
    transform: translateY(-1px);
  }

  .btn-secondary {
    background: var(--bg-3);
    color: var(--text-2);
    border: 1px solid var(--border-2);
  }

  .btn-secondary:hover {
    background: var(--bg-4);
    color: var(--text-1);
    border-color: var(--border-3);
  }

  .btn.full {
    width: 100%;
  }

  .verify-privacy {
    font-size: 11px;
    color: var(--text-4);
    text-align: center;
    margin-top: 14px;
    line-height: 1.55;
  }

  .verify-privacy a {
    color: var(--text-3);
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  @media (max-width: 767px) {
    .verify-screen {
      padding: 12px 16px 20px;
    }

    .verify-top {
      gap: 8px;
      margin-bottom: 16px;
    }

    .verify-back {
      width: 40px;
      height: 40px;
      min-width: 40px;
      min-height: 40px;
      border-radius: 8px;
    }

    /* Archetype Hero Mobile */
    .archetype-hero {
      margin-bottom: 24px;
      padding: 16px 0;
      border-bottom: 1px solid var(--border-1);
    }

    .archetype-emoji {
      font-size: 56px;
      margin-bottom: 12px;
    }

    .archetype-name {
      font-size: 24px;
      margin: 0 0 6px;
    }

    .archetype-tag {
      font-size: 13px;
      margin: 0 0 10px;
    }

    .archetype-description {
      font-size: 13px;
      line-height: 1.4;
      max-width: 100%;
    }

    .verify-hero {
      margin-bottom: 18px;
    }

    .verify-hero h2 {
      font-size: 32px;
      line-height: 1;
      margin: 0 0 10px;
    }

    .verify-hero p {
      font-size: 13px;
      max-width: 100%;
      line-height: 1.5;
    }

    .verify-list {
      gap: 8px;
      margin-bottom: 16px;
    }

    .verify-item {
      grid-template-columns: 28px 1fr auto;
      padding: 12px 12px;
      gap: 10px;
      border-radius: var(--r-md);
    }

    .verify-item .step {
      width: 28px;
      height: 28px;
      min-width: 28px;
      min-height: 28px;
      font-size: 11px;
    }

    .verify-item .label .n {
      font-size: 13px;
    }

    .verify-item .label .d {
      font-size: 11px;
    }

    .verify-item .t {
      font-size: 10px;
    }

    .verify-time {
      gap: 6px;
      padding: 10px 12px;
      margin-bottom: 12px;
      font-size: 12px;
      border-radius: var(--r-md);
    }

    .verify-privacy-note {
      padding: 10px 12px;
      margin-bottom: 12px;
      font-size: 11px;
      border-radius: var(--r-md);
      line-height: 1.4;
    }

    .verify-privacy-note p {
      margin: 0;
    }

    .verify-foot {
      margin-top: auto;
      padding-top: 12px;
      gap: 8px;
    }

    .btn {
      min-height: 44px;
      padding: 12px 16px;
      font-size: 14px;
      border-radius: var(--r-lg);
    }

    .verify-privacy {
      font-size: 10px;
      margin-top: 12px;
      line-height: 1.5;
    }
  }
</style>
