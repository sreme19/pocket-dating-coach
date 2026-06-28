<script lang="ts">
  /**
   * Explicit preference-weighting step (web) — Scoring & Matching redesign §6a,
   * Phase 0b. Mirrors the Flutter PreferenceWeightingScreen and reads the SAME
   * taxonomy + endpoint (/api/verified-vibe/preferences/weights). Self-contained:
   * uses the real Supabase session token, not the legacy mock settings store.
   */
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { getSupabaseClient } from '$lib/client/supabase';

  type Dim = { id: string; label: string; cls: 'open' | 'sensitive'; blurb: string };

  let loading = $state(true);
  let saving = $state(false);
  let error = $state<string | null>(null);
  let saved = $state(false);
  let dims = $state<Dim[]>([]);
  let importance = $state<Record<string, number>>({});
  let max = $state(5);
  let source = $state<string | null>(null);
  // Onboarding mode (?onboarding=1): final new-user step — advances into the app
  // after save and offers a skip so it's never a trap (parity with Flutter).
  let onboarding = $state(false);

  const LABELS = ['Skip', 'Low', 'Some', 'Matters', 'A lot', 'Must-have'];

  async function token(): Promise<string | null> {
    const { data: { session } } = await getSupabaseClient().auth.getSession();
    return session?.access_token ?? null;
  }

  onMount(async () => {
    onboarding = new URLSearchParams(window.location.search).get('onboarding') === '1';
    try {
      const t = await token();
      if (!t) { error = 'Please sign in.'; loading = false; return; }
      const res = await fetch('/api/verified-vibe/preferences/weights', {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      dims = data.dimensions ?? [];
      importance = { ...(data.importance ?? {}) };
      max = data.maxImportance ?? 5;
      source = data.weightsSource ?? null;
    } catch (e) {
      error = `Could not load: ${e instanceof Error ? e.message : e}`;
    } finally {
      loading = false;
    }
  });

  async function save() {
    if (saving) return;
    saving = true; error = null; saved = false;
    try {
      const t = await token();
      if (!t) throw new Error('Not signed in');
      const res = await fetch('/api/verified-vibe/preferences/weights', {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ importance }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      saved = true; source = 'explicit';
      if (onboarding) { goto('/verified-vibe/discover'); return; }
    } catch (e) {
      error = `Could not save: ${e instanceof Error ? e.message : e}`;
    } finally {
      saving = false;
    }
  }

  let open = $derived(dims.filter((d) => d.cls === 'open'));
  let sensitive = $derived(dims.filter((d) => d.cls === 'sensitive'));
</script>

<svelte:head><title>What you value · riteangle</title></svelte:head>

<div class="wrap">
  <h1>What you value</h1>
  <p class="intro">
    Tell us what matters most to you in a match. We weight your matches by what
    <em>you</em> value — the same person ranks differently for different people.
  </p>
  {#if source === 'explicit'}<div class="pill">✓ You've set these — tweak anytime</div>{/if}

  {#if loading}
    <p class="muted">Loading…</p>
  {:else}
    <h2>What you value in a partner</h2>
    {#each open as d (d.id)}
      <div class="row">
        <div class="row-head">
          <div><strong>{d.label}</strong><span class="blurb">{d.blurb}</span></div>
          <span class="val">{LABELS[Math.min(importance[d.id] ?? 2, LABELS.length - 1)]}</span>
        </div>
        <input type="range" min="0" max={max} step="1" bind:value={importance[d.id]} />
      </div>
    {/each}

    {#if sensitive.length}
      <h2>Personal preferences</h2>
      <p class="muted small">Optional, and personal — these shape who you see but never your own standing.</p>
      {#each sensitive as d (d.id)}
        <div class="row">
          <div class="row-head">
            <div><strong>{d.label}</strong><span class="blurb">{d.blurb}</span></div>
            <span class="val">{LABELS[Math.min(importance[d.id] ?? 2, LABELS.length - 1)]}</span>
          </div>
          <input type="range" min="0" max={max} step="1" bind:value={importance[d.id]} />
        </div>
      {/each}
    {/if}

    {#if error}<p class="error">{error}</p>{/if}
    {#if saved}<p class="ok">Saved — your matches will weight what matters to you.</p>{/if}

    <button class="save" onclick={save} disabled={saving}>
      {saving ? 'Saving…' : onboarding ? 'Save & continue' : 'Save what matters'}
    </button>
    {#if onboarding}
      <button class="skip" type="button" onclick={() => goto('/verified-vibe/discover')}>Skip for now</button>
    {/if}
  {/if}
</div>

<style>
  .wrap { max-width: 640px; margin: 0 auto; padding: 24px 20px 48px; }
  h1 { font-size: 28px; font-weight: 800; color: var(--text-1); margin: 0 0 8px; }
  h2 { font-size: 12px; font-weight: 700; letter-spacing: 0.5px; color: var(--text-2);
       text-transform: uppercase; margin: 24px 0 10px; }
  .intro { color: var(--text-2); font-size: 15px; line-height: 1.55; margin: 0 0 12px; }
  .muted { color: var(--text-3); }
  .small { font-size: 12px; margin: -4px 0 8px; }
  .pill { display: inline-block; padding: 6px 12px; border-radius: 999px;
          background: var(--accent-tint); color: var(--accent-bright); font-size: 12px; font-weight: 600; }
  .row { background: var(--bg-2); border: 1px solid var(--border-1); border-radius: 14px;
         padding: 12px 14px; margin-bottom: 10px; }
  .row-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
  .row-head strong { color: var(--text-1); font-size: 15px; font-weight: 600; }
  .blurb { display: block; color: var(--text-3); font-size: 12px; line-height: 1.35; margin-top: 2px; }
  .val { color: var(--accent-bright); font-size: 12px; font-weight: 700; white-space: nowrap; }
  input[type='range'] { width: 100%; margin-top: 10px; accent-color: var(--accent); }
  .error { color: #ef4444; font-size: 14px; }
  .ok { color: #16a34a; font-size: 14px; }
  .save { width: 100%; height: 52px; margin-top: 20px; border: none; border-radius: 999px;
          background: var(--accent); color: #fff; font-size: 16px; font-weight: 600; cursor: pointer; }
  .save:disabled { opacity: 0.6; cursor: default; }
  .skip { display: block; width: 100%; margin-top: 12px; background: none; border: none;
          color: var(--text-2); font-size: 14px; cursor: pointer; }
</style>
