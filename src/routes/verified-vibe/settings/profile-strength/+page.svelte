<script lang="ts">
  /**
   * Profile Strength surface (web) — Scoring & Matching redesign §8, Phase 2.
   * Mirrors the Flutter ProfileStrengthScreen and reads the same endpoint
   * (/api/verified-vibe/profile-strength). Shows a BAND + momentum + verification
   * upside — never a raw worth verdict.
   */
  import { onMount } from 'svelte';
  import { getSupabaseClient } from '$lib/client/supabase';

  type Action = { dimension: string; label: string; deltaPS: number };
  let loading = $state(true);
  let error = $state<string | null>(null);
  let ps = $state<any>(null);

  async function token(): Promise<string | null> {
    const { data: { session } } = await getSupabaseClient().auth.getSession();
    return session?.access_token ?? null;
  }

  onMount(async () => {
    try {
      const t = await token();
      if (!t) { error = 'Please sign in.'; loading = false; return; }
      const res = await fetch('/api/verified-vibe/profile-strength', { headers: { Authorization: `Bearer ${t}` } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      ps = await res.json();
    } catch (e) {
      error = `Could not load: ${e instanceof Error ? e.message : e}`;
    } finally {
      loading = false;
    }
  });
</script>

<svelte:head><title>Profile strength · riteangle</title></svelte:head>

<div class="wrap">
  <h1>Profile strength</h1>
  {#if loading}
    <p class="muted">Loading…</p>
  {:else if error}
    <p class="error">{error}</p>
  {:else if !ps?.hasVectors}
    <div class="card center">
      <div class="emoji">🌱</div>
      <p class="lead">Your profile strength is still warming up</p>
      <p class="muted">Add a few proofs and complete your profile — then come back to see your standing and how to climb.</p>
    </div>
  {:else}
    <div class="hero">
      <div class="eyebrow">YOUR PULL IN THIS POOL RIGHT NOW</div>
      <div class="band">{ps.band}</div>
      <div class="bar"><div class="fill" style="width:{ps.nextBand ? Math.max(4, ps.progressInBand * 100) : 100}%"></div></div>
      <p class="muted">
        {#if !ps.nextBand}You're at the top tier — keep your proofs fresh to hold it.
        {:else}{ps.pointsToNextBand} to go to “{ps.nextBand}.” It's earned and movable.{/if}
      </p>
    </div>

    {#if ps.verificationUpside?.deltaPS > 0}
      <div class="card">
        <strong>🔓 Locked standing</strong>
        <p class="muted">
          Based on what you've told us, verifying your current claims would lift your standing{ps.verifiedBand && ps.verifiedBand !== ps.band ? ` to “${ps.verifiedBand}.”` : '.'}
          You've earned it on paper — go claim it.
        </p>
      </div>
    {/if}

    {#if ps.actions?.length}
      <h2>Highest-leverage next moves</h2>
      {#each ps.actions as a (a.dimension)}
        <div class="action">
          <div>
            <strong>Verify your {a.label.toLowerCase()}</strong>
            <span class="sub">Prove a claim you've already made</span>
          </div>
          <span class="delta">+{a.deltaPS}</span>
        </div>
      {/each}
    {/if}

    <a class="link" href="/verified-vibe/settings/preferences">Adjust what you value →</a>
  {/if}
</div>

<style>
  .wrap { max-width: 640px; margin: 0 auto; padding: 24px 20px 48px; }
  h1 { font-size: 28px; font-weight: 800; color: var(--text-1); margin: 0 0 16px; }
  h2 { font-size: 12px; font-weight: 700; letter-spacing: 0.5px; color: var(--text-2);
       text-transform: uppercase; margin: 22px 0 10px; }
  .muted { color: var(--text-2); font-size: 13.5px; line-height: 1.5; }
  .error { color: #ef4444; }
  .hero { padding: 18px; border-radius: 18px; border: 1px solid var(--accent-tint);
          background: linear-gradient(135deg, var(--accent-tint), var(--bg-2)); }
  .eyebrow { font-size: 11px; font-weight: 700; letter-spacing: 0.8px; color: var(--text-2); }
  .band { font-size: 30px; font-weight: 800; color: var(--accent-bright); margin: 8px 0 14px; }
  .bar { height: 8px; border-radius: 99px; background: color-mix(in srgb, var(--accent) 20%, transparent); overflow: hidden; }
  .fill { height: 100%; background: var(--accent); border-radius: 99px; }
  .card { background: var(--bg-2); border: 1px solid var(--border-1); border-radius: 14px; padding: 16px; margin-top: 18px; }
  .card strong { color: var(--text-1); }
  .center { text-align: center; }
  .emoji { font-size: 40px; }
  .lead { color: var(--text-1); font-size: 17px; font-weight: 600; margin: 12px 0 8px; }
  .action { display: flex; justify-content: space-between; align-items: center; gap: 10px;
            background: var(--bg-2); border: 1px solid var(--border-1); border-radius: 14px; padding: 14px; margin-bottom: 10px; }
  .action strong { color: var(--text-1); font-size: 15px; font-weight: 600; display: block; }
  .sub { color: var(--text-3); font-size: 12px; }
  .delta { color: var(--accent-bright); font-weight: 700; background: var(--accent-tint); padding: 6px 10px; border-radius: 999px; white-space: nowrap; }
  .link { display: inline-block; margin-top: 18px; color: var(--accent-bright); text-decoration: none; }
</style>
