<script lang="ts">
  import { goto } from '$app/navigation';
  import { setPhase, setError } from '$lib/verified-vibe/stores';
  import type { Gender } from '$lib/verified-vibe/types';
  import { fade, slide } from 'svelte/transition';

  let gender = $state<Gender | null>(null);
  let ageConfirmed = $state(false);

  function handleContinue() {
    if (!gender || !ageConfirmed) {
      setError('Please select your gender and confirm your age');
      return;
    }

    // Save to localStorage for later
    localStorage.setItem('verified_vibe_gender', gender);

    // Move to home phase
    setPhase('home');
    goto('/verified-vibe/home');
  }

  function handleGenderSelect(selectedGender: Gender) {
    gender = selectedGender;
  }
</script>

<div class="gate-screen">
  <!-- Hero section -->
  <div class="gate-hero" transition:slide={{ duration: 400, delay: 0, axis: 'y' }}>
    <div class="hero-container">
      <h1 class="hero-title">Verified Vibe</h1>
      <p class="hero-subtitle">Real connections. Real people. Real trust.</p>
    </div>
  </div>

  <!-- Gender selection -->
  <div class="gate-q" transition:slide={{ duration: 400, delay: 100, axis: 'y' }}>
    <div class="gate-q-label">
      <div class="gate-q-num">01</div>
      <div class="gate-q-title">Who are you?</div>
    </div>
    <div class="gate-pick">
      <button
        class="gate-pick-btn {gender === 'man' ? 'selected' : ''}"
        onclick={() => handleGenderSelect('man')}
      >
        <div class="pick-ico">👨</div>
        <div class="pick-name">Man</div>
      </button>
      <button
        class="gate-pick-btn {gender === 'woman' ? 'selected' : ''}"
        onclick={() => handleGenderSelect('woman')}
      >
        <div class="pick-ico">👩</div>
        <div class="pick-name">Woman</div>
      </button>
      <button
        class="gate-pick-btn {gender === 'prefer_not_to_say' ? 'selected' : ''}"
        onclick={() => handleGenderSelect('prefer_not_to_say')}
      >
        <div class="pick-ico">🤝</div>
        <div class="pick-name">Prefer not to say</div>
      </button>
    </div>
  </div>

  <!-- Age confirmation -->
  <div class="gate-q" transition:slide={{ duration: 400, delay: 200, axis: 'y' }}>
    <div class="gate-q-label">
      <div class="gate-q-num {ageConfirmed ? 'done' : ''}">02</div>
      <div class="gate-q-title">Age check</div>
    </div>
    <label class="gate-age {ageConfirmed ? 'checked' : ''}">
      <input
        type="checkbox"
        bind:checked={ageConfirmed}
        style="display: none;"
      />
      <div class="box">
        {#if ageConfirmed}✓{/if}
      </div>
      <div class="copy">
        <div class="l">I'm 18 or older</div>
        <div class="s">Required to use Verified Vibe</div>
      </div>
    </label>
  </div>

  <!-- CTA -->
  <div class="gate-cta" transition:slide={{ duration: 400, delay: 300, axis: 'y' }}>
    <button
      class="btn btn-primary full"
      disabled={!gender || !ageConfirmed}
      onclick={handleContinue}
    >
      Continue
    </button>
  </div>

  <!-- Footer -->
  <div class="gate-foot" transition:fade={{ duration: 400, delay: 400 }}>
    <p>By continuing, you agree to our <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>.</p>
  </div>
</div>

<style>
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

  .gate-hero {
    padding: 40px 0 48px;
    text-align: center;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .hero-container {
    max-width: 100%;
  }

  .hero-title {
    font-family: var(--font-serif);
    font-size: 56px;
    font-weight: 700;
    line-height: 1.1;
    letter-spacing: -0.02em;
    margin: 0 0 16px;
    color: var(--text-1);
  }

  .hero-subtitle {
    font-size: 18px;
    line-height: 1.5;
    letter-spacing: -0.005em;
    color: var(--text-2);
    margin: 0;
    max-width: 40ch;
    margin-left: auto;
    margin-right: auto;
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
    0%, 100% {
      box-shadow: 0 0 0 4px var(--accent-tint);
    }
    50% {
      box-shadow: 0 0 0 8px rgba(16, 185, 129, 0.04);
    }
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

  .gate-q {
    margin-top: 22px;
  }

  .gate-q-label {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
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

  .gate-pick {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
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
    min-width: 44px;
  }

  .gate-pick-btn:hover {
    border-color: var(--border-3);
    transform: translateY(-1px);
  }

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
    background: var(--accent);
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2306281e' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'><polyline points='4 12 10 18 20 6'/></svg>");
    background-repeat: no-repeat;
    background-position: center;
  }

  .pick-ico {
    font-size: 30px;
    line-height: 1;
    margin-bottom: 6px;
  }

  .pick-name {
    font-size: 17px;
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  .gate-age {
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
    min-height: 44px;
  }

  .gate-age:hover {
    border-color: var(--border-3);
  }

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

  .gate-age .copy .l {
    font-size: 15px;
    font-weight: 600;
  }

  .gate-age .copy .s {
    font-size: 12px;
    color: var(--text-3);
  }

  .gate-cta {
    margin-top: auto;
    padding-top: 16px;
  }

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

  @media (max-width: 767px) {
    .gate-screen {
      padding: 16px 16px 24px;
      width: 100%;
      box-sizing: border-box;
      overflow-x: hidden;
    }

    .gate-hero {
      padding: 28px 0 36px;
    }

    .hero-title {
      font-size: 40px;
      margin-bottom: 12px;
      line-height: 1.1;
    }

    .hero-subtitle {
      font-size: 15px;
      line-height: 1.5;
    }

    .gate-q {
      margin-top: 20px;
    }

    .gate-q-label {
      gap: 10px;
      margin-bottom: 12px;
    }

    .gate-q-title {
      font-size: 15px;
      font-weight: 600;
    }

    .gate-pick {
      grid-template-columns: 1fr;
      gap: 10px;
    }

    .gate-pick-btn {
      padding: 18px 16px;
      min-height: 48px;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 6px;
      border-radius: var(--r-lg);
    }

    .pick-ico {
      font-size: 28px;
      line-height: 1;
      margin-bottom: 4px;
    }

    .pick-name {
      font-size: 16px;
      font-weight: 600;
      letter-spacing: -0.01em;
    }

    .gate-age {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 16px;
      min-height: 48px;
      border-radius: var(--r-lg);
      background: var(--bg-2);
      border: 1px solid var(--border-1);
      cursor: pointer;
      transition: all 220ms ease;
      user-select: none;
    }

    .gate-age .box {
      width: 28px;
      height: 28px;
      min-width: 28px;
      min-height: 28px;
      border-radius: 8px;
      background: var(--bg-3);
      border: 1px solid var(--border-2);
      display: grid;
      place-items: center;
      flex-shrink: 0;
      transition: all 200ms ease;
      font-weight: 600;
      color: var(--text-1);
    }

    .gate-age .copy {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1;
      min-width: 0;
    }

    .gate-age .copy .l {
      font-size: 15px;
      font-weight: 600;
      line-height: 1.4;
    }

    .gate-age .copy .s {
      font-size: 12px;
      color: var(--text-3);
      line-height: 1.3;
    }

    .gate-cta {
      margin-top: auto;
      padding-top: 16px;
    }

    .btn {
      width: 100%;
      min-height: 48px;
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
    }

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
  }
</style>
