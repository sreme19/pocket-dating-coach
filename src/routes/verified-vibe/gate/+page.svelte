<script lang="ts">
  import { goto } from '$app/navigation';
  import { setPhase } from '$lib/verified-vibe/stores';
  import type { Gender } from '$lib/verified-vibe/types';
  import { fade, slide } from 'svelte/transition';
  import LiveWomenCarousel from '$lib/verified-vibe/components/LiveWomenCarousel.svelte';

  let gender = $state<Gender | null>(null);
  let over18 = $state(false);
  let errorMessage = $state<string | null>(null);
  const ready = $derived(!!gender && over18);

  function handleContinue() {
    if (!gender) {
      errorMessage = 'Please select your gender to continue.';
      return;
    }
    if (!over18) {
      errorMessage = 'Please confirm you are 18 or older to continue.';
      return;
    }
    errorMessage = null;
    // Store gender locally — will be saved to Supabase after auth on the next step
    localStorage.setItem('verified_vibe_gender', gender!);
    localStorage.setItem('verified_vibe_pending_gender', gender!);
    setPhase('home');
    goto('/verified-vibe/home');
  }
</script>

<a href="#main-content" class="skip-link">Skip to main content</a>

<div class="gate-screen">
  <div class="gate-hero" transition:slide={{ duration: 400, axis: 'y' }}>
    <div class="gate-eyebrow">
      <span class="pulse" aria-hidden="true"></span>
      Verified Vibe
    </div>
    <h1 class="gate-title">Two questions. <em>Then we move.</em></h1>
  </div>

  <main id="main-content">
    <!-- Error alert region -->
    <div aria-live="polite">
      {#if errorMessage}
        <div role="alert" class="gate-error">{errorMessage}</div>
      {/if}
    </div>

    <!-- Question 1: Gender -->
    <fieldset class="gate-q" transition:slide={{ duration: 400, delay: 100, axis: 'y' }}>
      <legend class="gate-q-label">
        <span class="gate-q-num {gender ? 'done' : ''}">
          {#if gender}✓{:else}1{/if}
        </span>
        <span class="gate-q-title">I'm a…</span>
      </legend>
      <div class="gate-pick" role="group" aria-label="Gender selection">
        <button
          class="gate-pick-btn {gender === 'man' ? 'selected' : ''}"
          aria-pressed={gender === 'man'}
          aria-label="Select Man"
          onclick={() => { gender = 'man'; }}
        >
          <span class="pick-ico" aria-hidden="true">♂</span>
          <span class="pick-name">Man</span>
          <span class="pick-sub">See Casual &amp; Marriage-Minded</span>
        </button>
        <button
          class="gate-pick-btn {gender === 'woman' ? 'selected' : ''}"
          aria-pressed={gender === 'woman'}
          aria-label="Select Woman"
          onclick={() => { gender = 'woman'; }}
        >
          <span class="pick-ico" aria-hidden="true">♀</span>
          <span class="pick-name">Woman</span>
          <span class="pick-sub">See Spoilt &amp; Safety-First</span>
        </button>
      </div>
    </fieldset>

    <!-- Question 2: Age -->
    <fieldset class="gate-q" transition:slide={{ duration: 400, delay: 200, axis: 'y' }}>
      <legend class="gate-q-label">
        <span class="gate-q-num {over18 ? 'done' : ''}">
          {#if over18}✓{:else}2{/if}
        </span>
        <span class="gate-q-title">I'm 18 or older</span>
      </legend>
      <label class="gate-age {over18 ? 'checked' : ''}">
        <input
          type="checkbox"
          class="gate-checkbox"
          aria-label="I confirm I am 18 or older"
          checked={over18}
          onchange={() => { over18 = !over18; }}
        />
        <span class="box" aria-hidden="true">{#if over18}✓{/if}</span>
        <span class="copy">
          <span class="l">Yes, I'm 18+</span>
          <span class="s">Required — we ID-verify everyone, no exceptions.</span>
        </span>
      </label>
    </fieldset>

    <!-- CTA -->
    <div class="gate-cta" transition:slide={{ duration: 400, delay: 300, axis: 'y' }}>
      <div aria-live="polite">
        {#if errorMessage}
          <div role="alert" class="gate-error">{errorMessage}</div>
        {/if}
      </div>
      <button
        class="btn btn-primary"
        onclick={handleContinue}
        aria-label="Continue to next step"
      >
        {ready ? "Let's go →" : "Pick both to continue"}
      </button>
      <div class="gate-foot" transition:fade={{ duration: 400, delay: 400 }}>
        By continuing you agree to ID verification, our <a href="/verified-vibe/privacy">Terms</a> and <a href="/verified-vibe/privacy">Privacy</a>.<br/>We never share ID details with matches.
      </div>
    </div>

    <!-- Sign-in link for returning members -->
    <div class="gate-signin" transition:fade={{ duration: 400, delay: 500 }}>
      Already a member? <a href="/verified-vibe/auth?mode=signin" class="gate-signin-link">Sign in →</a>
    </div>

  </main>

  <div class="gate-carousel" transition:fade={{ duration: 400, delay: 600 }}>
    <LiveWomenCarousel showMixed={true} redirectTo="/verified-vibe/gate" />
  </div>
</div>

<style>
  .skip-link {
    position: absolute;
    top: -40px;
    left: 0;
    background: var(--accent);
    color: #06281e;
    padding: 8px 16px;
    text-decoration: none;
    z-index: 100;
    border-radius: 0 0 4px 0;
  }
  .skip-link:focus { top: 0; }

  .gate-signin {
    margin-top: 28px;
    text-align: center;
    font-size: 14px;
    color: var(--text-3);
  }

  .gate-signin-link {
    color: var(--accent);
    font-weight: 600;
    text-decoration: none;
    transition: color 200ms;
  }

  .gate-signin-link:hover {
    color: var(--accent-bright);
  }

  .gate-screen {
    padding: 20px 24px 32px;
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 100%;
    width: 100%;
    box-sizing: border-box;
    overflow-x: hidden;
  }

  /* Hero */
  .gate-hero {
    padding: 12px 0 28px;
  }

  .gate-eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--accent-bright);
    margin-bottom: 18px;
  }

  .gate-eyebrow .pulse {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--accent);
    box-shadow: 0 0 0 4px var(--accent-tint);
    animation: pulse 1.6s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { box-shadow: 0 0 0 4px var(--accent-tint); }
    50%       { box-shadow: 0 0 0 8px rgba(16,185,129,0.04); }
  }

  .gate-title {
    font-family: var(--font-serif);
    font-style: italic;
    font-size: 56px;
    line-height: 0.95;
    letter-spacing: -0.02em;
    margin: 0 0 12px;
    color: var(--text-1);
  }

  .gate-title em {
    color: var(--accent-bright);
    font-style: italic;
  }

  .gate-sub {
    font-size: 15px;
    color: var(--text-2);
    max-width: 30ch;
    margin: 0;
  }

  /* Questions */
  .gate-q {
    margin-top: 22px;
    border: none;
    padding: 0;
  }

  .gate-q-label {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
    font-weight: 600;
  }

  .gate-q-num {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--bg-3);
    border: 1px solid var(--border-2);
    display: grid;
    place-items: center;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 600;
    color: var(--text-2);
    flex-shrink: 0;
    transition: all 200ms ease;
  }

  .gate-q-num.done {
    background: var(--accent);
    border-color: var(--accent);
    color: #06281e;
  }

  .gate-q-title {
    font-size: 16px;
    font-weight: 600;
    letter-spacing: -0.005em;
  }

  /* Gender pick */
  .gate-pick {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .gate-pick-btn {
    position: relative;
    padding: 22px 16px;
    border-radius: var(--r-lg);
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    cursor: pointer;
    transition: all 220ms ease;
    text-align: left;
    overflow: hidden;
    font-family: inherit;
    color: inherit;
    min-height: 44px;
  }

  .gate-pick-btn:hover { border-color: var(--border-3); transform: translateY(-1px); }
  .gate-pick-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

  .gate-pick-btn.selected {
    border-color: var(--accent);
    background: radial-gradient(80% 100% at 100% 0%, var(--accent-tint), transparent 70%), var(--bg-2);
  }

  .gate-pick-btn.selected::after {
    content: '';
    position: absolute;
    top: 12px;
    right: 12px;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--accent) url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2306281e' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'><polyline points='4 12 10 18 20 6'/></svg>") no-repeat center;
  }

  .pick-ico {
    font-size: 26px;
    line-height: 1;
    margin-bottom: 6px;
    color: var(--text-2);
  }

  .pick-name {
    font-size: 17px;
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  .pick-sub {
    font-size: 12px;
    color: var(--text-3);
    line-height: 1.4;
  }

  .gate-checkbox {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .gate-error {
    margin-bottom: 12px;
    padding: 10px 14px;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 8px;
    color: #dc2626;
    font-size: 14px;
  }

  /* Age toggle */
  .gate-checkbox {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
  }

  .gate-error {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 8px;
    padding: 10px 14px;
    font-size: 14px;
    color: #ef4444;
    margin-bottom: 12px;
  }

  .gate-age {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 16px;
    border-radius: var(--r-lg);
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    cursor: pointer;
    transition: all 220ms ease;
    user-select: none;
    font-family: inherit;
    color: inherit;
    text-align: left;
    min-height: 44px;
  }

  .gate-age:hover { border-color: var(--border-3); }
  .gate-age:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

  .gate-age.checked {
    border-color: var(--accent);
    background: radial-gradient(80% 100% at 100% 0%, var(--accent-tint), transparent 70%), var(--bg-2);
  }

  .gate-age .box {
    width: 26px;
    height: 26px;
    border-radius: 8px;
    background: var(--bg-3);
    border: 1px solid var(--border-2);
    display: grid;
    place-items: center;
    flex-shrink: 0;
    transition: all 200ms ease;
    font-weight: 600;
    font-size: 13px;
    color: var(--text-1);
  }

  .gate-age.checked .box {
    background: var(--accent);
    border-color: var(--accent);
    color: #06281e;
  }

  .gate-age .copy {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0;
  }

  .gate-age .copy .l { font-size: 15px; font-weight: 600; }
  .gate-age .copy .s { font-size: 12px; color: var(--text-3); }

  /* CTA */
  main { flex: 1; display: flex; flex-direction: column; }

  .gate-cta {
    margin-top: auto;
    padding-top: 20px;
  }

  .btn {
    width: 100%;
    min-height: 52px;
    padding: 14px 16px;
    font-size: 16px;
    font-weight: 600;
    border-radius: var(--r-lg);
    cursor: pointer;
    transition: all 220ms ease;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: inherit;
  }

  .btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .btn-primary {
    background: var(--accent);
    color: #06281e;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--accent-bright);
    box-shadow: 0 12px 32px -10px var(--accent-glow);
    transform: translateY(-1px);
  }

  .btn-primary:active:not(:disabled) { transform: scale(0.97); }

  .gate-foot {
    font-size: 11px;
    color: var(--text-4);
    text-align: center;
    margin-top: 14px;
    line-height: 1.55;
  }

  .gate-foot a {
    color: var(--text-3);
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .gate-carousel {
    margin-top: 28px;
  }

  /* Mobile */
  @media (max-width: 767px) {
    .gate-screen { padding: 16px 16px 24px; }
    .gate-title { font-size: 44px; }
    .gate-pick { gap: 8px; }
    .gate-pick-btn { padding: 18px 14px; }
  }

  @media (prefers-reduced-motion: reduce) {
    .gate-pick-btn, .gate-age, .btn { transition: none; }
    .pulse { animation: none; }
  }

</style>
