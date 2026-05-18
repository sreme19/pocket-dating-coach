<script lang="ts">
  import { goto } from '$app/navigation';
  import { getSupabaseClient } from '$lib/client/supabase';
  import { setPhase } from '$lib/verified-vibe/stores';
  import {
    getProfileCompleteness,
    routeForCompleteness
  } from '$lib/verified-vibe/services/profileService';
  import { fade, slide } from 'svelte/transition';
  import { ShieldCheck } from 'lucide-svelte';

  // ── state ──────────────────────────────────────────────────────────────────
  type Step = 'email' | 'code' | 'loading';
  let step  = $state<Step>('email');
  let email = $state('');
  let code  = $state('');
  let error = $state('');
  let busy  = $state(false);

  // ── helpers ────────────────────────────────────────────────────────────────

  async function sendOtp() {
    error = '';
    if (!email.trim()) { error = 'Enter your email address'; return; }
    if (!/\S+@\S+\.\S+/.test(email.trim())) { error = 'Enter a valid email address'; return; }

    busy = true;
    try {
      const supabase = getSupabaseClient();
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { shouldCreateUser: true }
      });
      if (authError) throw authError;
      step = 'code';
    } catch (e: any) {
      error = e.message ?? 'Failed to send code. Try again.';
    } finally {
      busy = false;
    }
  }

  async function verifyCode() {
    error = '';
    const token = code.replace(/\s/g, '');
    if (token.length !== 6) { error = 'Enter the 6-digit code'; return; }

    busy = true;
    step = 'loading';
    try {
      const supabase = getSupabaseClient();
      const { error: authError } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token,
        type: 'email'
      });
      if (authError) throw authError;

      // Route based on how complete the profile is
      const completeness = await getProfileCompleteness();
      const destination  = routeForCompleteness(completeness);

      if (completeness === 'complete') {
        setPhase('app');
      } else if (completeness === 'no_verification') {
        setPhase('verify');
      } else if (completeness === 'no_archetype') {
        setPhase('home');
      } else {
        setPhase('gate');
      }

      goto(destination);
    } catch (e: any) {
      error = e.message?.includes('expired')
        ? 'Code expired. Request a new one.'
        : e.message?.includes('invalid')
        ? 'Incorrect code. Check your email and try again.'
        : (e.message ?? 'Verification failed. Try again.');
      step = 'code';
    } finally {
      busy = false;
    }
  }

  function resend() {
    step  = 'email';
    code  = '';
    error = '';
  }

  function handleCodeInput(e: Event) {
    const raw = (e.target as HTMLInputElement).value;
    // Only keep digits, max 6
    code = raw.replace(/\D/g, '').slice(0, 6);
    (e.target as HTMLInputElement).value = code;
  }
</script>

<div class="auth-screen">
  <!-- Brand mark -->
  <div class="auth-brand" transition:fade={{ duration: 300 }}>
    <div class="brand-icon">
      <ShieldCheck size={28} />
    </div>
    <div>
      <p class="brand-name">Verified Vibe</p>
      <p class="brand-tag">Trust-first dating</p>
    </div>
  </div>

  <!-- Card -->
  <div class="auth-card" transition:slide={{ duration: 400, axis: 'y' }}>

    {#if step === 'loading'}
      <!-- Loading spinner while we check completeness + navigate -->
      <div class="auth-loading" transition:fade={{ duration: 200 }}>
        <div class="spinner"></div>
        <p class="loading-text">Signing you in…</p>
      </div>

    {:else if step === 'email'}
      <div transition:fade={{ duration: 200 }}>
        <h1 class="auth-title">Sign in or create account</h1>
        <p class="auth-sub">We'll email you a 6-digit code. No password needed.</p>

        <div class="auth-field">
          <label class="auth-label" for="email-input">Email address</label>
          <input
            id="email-input"
            type="email"
            class="auth-input"
            placeholder="you@example.com"
            bind:value={email}
            onkeydown={(e) => e.key === 'Enter' && sendOtp()}
            autocomplete="email"
            autofocus
          />
        </div>

        {#if error}
          <p class="auth-error" transition:fade={{ duration: 150 }}>{error}</p>
        {/if}

        <button
          class="auth-btn primary"
          onclick={sendOtp}
          disabled={busy}
        >
          {#if busy}
            <span class="btn-spinner"></span>
          {:else}
            Send code →
          {/if}
        </button>

        <p class="auth-legal">
          By continuing you agree to our <a href="/verified-vibe/privacy">Privacy Policy</a>.
          New accounts are created automatically.
        </p>
      </div>

    {:else if step === 'code'}
      <div transition:fade={{ duration: 200 }}>
        <h1 class="auth-title">Check your email</h1>
        <p class="auth-sub">
          We sent a 6-digit code to <strong>{email}</strong>.<br />
          It expires in 5 minutes.
        </p>

        <div class="auth-field">
          <label class="auth-label" for="code-input">Verification code</label>
          <input
            id="code-input"
            type="text"
            inputmode="numeric"
            class="auth-input code-input"
            placeholder="000000"
            value={code}
            oninput={handleCodeInput}
            onkeydown={(e) => e.key === 'Enter' && verifyCode()}
            maxlength="6"
            autocomplete="one-time-code"
            autofocus
          />
        </div>

        {#if error}
          <p class="auth-error" transition:fade={{ duration: 150 }}>{error}</p>
        {/if}

        <button
          class="auth-btn primary"
          onclick={verifyCode}
          disabled={busy || code.length < 6}
        >
          {#if busy}
            <span class="btn-spinner"></span>
          {:else}
            Verify →
          {/if}
        </button>

        <button class="auth-btn ghost" onclick={resend}>
          Wrong email or didn't receive it? Start over
        </button>
      </div>
    {/if}

  </div>
</div>

<style>
  .auth-screen {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 24px 16px;
    background: var(--bg-1);
    gap: 32px;
  }

  /* Brand */
  .auth-brand {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .brand-icon {
    width: 52px;
    height: 52px;
    border-radius: 16px;
    background: var(--accent-tint);
    border: 1px solid var(--accent-glow);
    display: grid;
    place-items: center;
    color: var(--accent-bright);
  }

  .brand-name {
    font-size: 18px;
    font-weight: 700;
    color: var(--text-1);
    margin: 0;
  }

  .brand-tag {
    font-size: 13px;
    color: var(--accent);
    margin: 0;
    font-weight: 500;
  }

  /* Card */
  .auth-card {
    width: 100%;
    max-width: 420px;
    background: var(--bg-2);
    border: 1px solid var(--border-2);
    border-radius: var(--r-lg);
    padding: 32px 28px;
  }

  .auth-title {
    font-size: 22px;
    font-weight: 700;
    color: var(--text-1);
    margin: 0 0 8px;
    letter-spacing: -0.01em;
  }

  .auth-sub {
    font-size: 14px;
    color: var(--text-2);
    margin: 0 0 24px;
    line-height: 1.6;
  }

  .auth-sub strong {
    color: var(--text-1);
    font-weight: 600;
  }

  /* Field */
  .auth-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 16px;
  }

  .auth-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-2);
    letter-spacing: 0.01em;
  }

  .auth-input {
    width: 100%;
    padding: 13px 14px;
    background: var(--bg-3);
    border: 1px solid var(--border-2);
    border-radius: var(--r-md);
    color: var(--text-1);
    font-size: 16px;
    font-family: inherit;
    outline: none;
    transition: border-color 200ms;
    box-sizing: border-box;
  }

  .auth-input:focus {
    border-color: var(--accent);
  }

  .auth-input::placeholder {
    color: var(--text-4);
  }

  .code-input {
    font-size: 24px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-align: center;
    font-family: var(--font-mono);
  }

  /* Error */
  .auth-error {
    font-size: 13px;
    color: #f87171;
    margin: 0 0 12px;
    padding: 10px 12px;
    background: rgba(248, 113, 113, 0.1);
    border-radius: var(--r-md);
    border: 1px solid rgba(248, 113, 113, 0.2);
  }

  /* Buttons */
  .auth-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    padding: 14px 16px;
    border-radius: var(--r-lg);
    font-size: 15px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: all 200ms ease;
    border: none;
    margin-bottom: 10px;
  }

  .auth-btn.primary {
    background: var(--accent);
    color: #06281e;
  }

  .auth-btn.primary:hover:not(:disabled) {
    background: var(--accent-bright);
  }

  .auth-btn.primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .auth-btn.ghost {
    background: transparent;
    color: var(--text-3);
    font-size: 13px;
    font-weight: 500;
  }

  .auth-btn.ghost:hover {
    color: var(--text-2);
  }

  /* Legal */
  .auth-legal {
    font-size: 12px;
    color: var(--text-4);
    margin: 4px 0 0;
    line-height: 1.5;
    text-align: center;
  }

  .auth-legal a {
    color: var(--accent);
    text-decoration: none;
  }

  /* Loading */
  .auth-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 24px 0;
  }

  .loading-text {
    color: var(--text-2);
    font-size: 15px;
    margin: 0;
  }

  .spinner {
    width: 36px;
    height: 36px;
    border: 3px solid var(--border-2);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 700ms linear infinite;
  }

  .btn-spinner {
    display: inline-block;
    width: 18px;
    height: 18px;
    border: 2px solid rgba(6, 40, 30, 0.4);
    border-top-color: #06281e;
    border-radius: 50%;
    animation: spin 700ms linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
