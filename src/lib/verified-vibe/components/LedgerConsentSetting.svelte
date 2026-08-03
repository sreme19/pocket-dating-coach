<script lang="ts">
  /**
   * Cross-conversation memory control (Requirement §E).
   *
   * A Bestie asks a man in-chat the first time reusing his earlier answers would
   * actually save him something. This is where he changes his mind afterwards,
   * and it is the setting her message points him at — so it has to exist and has
   * to tell the truth.
   *
   * Self-contained on purpose: it talks to /api/verified-vibe/ledger-consent
   * directly rather than through the settings store, because the endpoint derives
   * identity from the bearer token and this page still carries a placeholder
   * userId. Mirrors the native row in mobile/lib/settings_screen.dart.
   */

  import { onMount } from 'svelte';

  type State = { enabled: boolean; consent: string; entryCount: number };

  // Not named `state` — that shadows the $state rune and the component stops compiling.
  let consentState = $state<State | null>(null);
  let busy = $state(false);
  let failed = $state(false);

  onMount(async () => {
    try {
      const r = await fetch('/api/verified-vibe/ledger-consent');
      if (!r.ok) throw new Error(String(r.status));
      consentState = (await r.json()) as State;
    } catch {
      // Render nothing rather than a switch that might misstate what is on.
      failed = true;
    }
  });

  async function toggle() {
    if (!consentState || busy) return;
    const prev = consentState;
    const next = !consentState.enabled;
    busy = true;
    // Optimistic — a settings switch that lags the click reads as broken.
    consentState = { ...consentState, enabled: next, consent: next ? 'granted' : 'declined' };
    try {
      const r = await fetch('/api/verified-vibe/ledger-consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next })
      });
      if (!r.ok) throw new Error(String(r.status));
    } catch {
      consentState = prev;
    } finally {
      busy = false;
    }
  }

  // "Off" must not read as "erased". A man pausing the sharing should not think
  // he has just wiped what he said.
  const subtitle = $derived(
    !consentState
      ? ''
      : consentState.enabled
        ? consentState.entryCount > 0
          ? `Besties can use the ${consentState.entryCount} ${consentState.entryCount === 1 ? 'thing' : 'things'} you've already shared, so you don't repeat yourself.`
          : "Besties can use what you've already shared, so you don't repeat yourself."
        : consentState.entryCount > 0
          ? `Off. Your ${consentState.entryCount} saved ${consentState.entryCount === 1 ? 'answer is' : 'answers are'} kept but unused, so you may be asked the same things again.`
          : "Off. Besties won't reuse anything you've shared."
  );
</script>

{#if consentState && !failed}
  <div class="ledger-consent">
    <div class="lc-text">
      <p class="lc-title">Reuse what I've shared</p>
      <p class="lc-sub">{subtitle}</p>
    </div>
    <button
      class="lc-switch"
      class:on={consentState.enabled}
      role="switch"
      aria-checked={consentState.enabled}
      aria-label="Reuse what I've shared"
      disabled={busy}
      onclick={toggle}
    >
      <span class="lc-knob"></span>
    </button>
  </div>
{/if}

<style>
  .ledger-consent {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 14px 0;
  }
  .lc-text { flex: 1; min-width: 0; }
  .lc-title {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: var(--text-1, #111);
  }
  .lc-sub {
    margin: 3px 0 0;
    font-size: 12px;
    line-height: 1.4;
    color: var(--text-3, #6b7280);
  }
  .lc-switch {
    flex-shrink: 0;
    width: 46px;
    height: 27px;
    border-radius: 999px;
    border: none;
    padding: 3px;
    cursor: pointer;
    background: var(--border, #d1d5db);
    transition: background 160ms ease;
  }
  .lc-switch.on { background: #10b981; }
  .lc-switch:disabled { opacity: 0.6; cursor: default; }
  .lc-knob {
    display: block;
    width: 21px;
    height: 21px;
    border-radius: 50%;
    background: #fff;
    transform: translateX(0);
    transition: transform 160ms ease;
  }
  .lc-switch.on .lc-knob { transform: translateX(19px); }
</style>
