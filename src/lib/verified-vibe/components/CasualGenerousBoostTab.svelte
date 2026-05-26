<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { ShieldCheck, Zap } from 'lucide-svelte';
  import { calculateCGSubscores, calculateCGTotal } from '$lib/verified-vibe/server/trustScore';
  import type { VerificationRecord } from '$lib/verified-vibe/types';

  interface Props {
    trustScore: number;
    verificationRecords: VerificationRecord[];
    onEditQA?: () => void;
  }

  let { trustScore, verificationRecords, onEditQA = () => {} }: Props = $props();

  // ── Proof insights (from localStorage) ───────────────────────────────────────
  interface ProofInsight {
    id: string;
    category: string;
    insight_label: string;
    insight_emoji: string;
    pts_awarded: number;
    verified_at: string;
  }

  let proofInsights = $state<ProofInsight[]>([]);

  onMount(() => {
    try {
      proofInsights = JSON.parse(localStorage.getItem('vv_proof_insights') ?? '[]');
    } catch { proofInsights = []; }
  });

  // ── Score boost from proof insights ──────────────────────────────────────────
  const PROOF_BOOST: Record<string, { key: keyof ReturnType<typeof calculateCGSubscores>; boost: number }> = {
    lifestyle:    { key: 'lifestyleDepth',    boost: 30 },
    hosting:      { key: 'lifestyleDepth',    boost: 20 },
    discipline:   { key: 'emotionalSafety',   boost: 35 },
    social_proof: { key: 'socialLegitimacy',  boost: 30 },
    linkedin:     { key: 'socialLegitimacy',  boost: 50 },
    habit_tracker:{ key: 'socialLegitimacy',  boost: 20 },
    intro:        { key: 'emotionalSafety',   boost: 45 },
  };

  const baseSubscores = $derived(calculateCGSubscores(verificationRecords));

  const subscores = $derived.by(() => {
    const s = { ...baseSubscores };
    for (const p of proofInsights) {
      const boost = PROOF_BOOST[p.category];
      if (boost) {
        (s[boost.key] as number) = Math.min(100, (s[boost.key] as number) + boost.boost);
      }
    }
    return s;
  });

  const cgTotal = $derived(calculateCGTotal(subscores));

  const fitLabel = $derived(
    cgTotal >= 80 ? 'Strong Casual Generous Alignment' :
    cgTotal >= 60 ? 'Building Casual Generous Profile'  :
                   'Getting Started'
  );

  const tier60 = $derived(cgTotal >= 60);
  const tier70 = $derived(cgTotal >= 70);
  const tier85 = $derived(cgTotal >= 85);
  const tier95 = $derived(cgTotal >= 95);

  // Color tier for a subscore
  function scoreColor(s: number): 'red' | 'amber' | 'green' {
    if (s < 50)  return 'red';
    if (s < 75)  return 'amber';
    return 'green';
  }

  const ic = $derived(scoreColor(subscores.identity));
  const lc = $derived(scoreColor(subscores.lifestyleDepth));
  const gc = $derived(scoreColor(subscores.generositySignals));
  const ec = $derived(scoreColor(subscores.emotionalSafety));
  const sc = $derived(scoreColor(subscores.socialLegitimacy));

  const showOffCategories = [
    { icon: '🌍', label: 'Lifestyle',    desc: 'Travel, dining, events',      pts: 8, time: '2 min', category: 'lifestyle'    },
    { icon: '🍽️', label: 'Hosting',      desc: 'Dinners, celebrations',        pts: 6, time: '2 min', category: 'hosting'      },
    { icon: '💪', label: 'Discipline',   desc: 'Gym, sleep, reading routines', pts: 4, time: '1 min', category: 'discipline'   },
    { icon: '🤝', label: 'Social Proof', desc: 'Friends, communities',         pts: 4, time: '2 min', category: 'social_proof' },
  ] as const;

  const proofConnections = [
    { icon: '💼', label: 'LinkedIn',      desc: 'Career stability proof',          pts: 5, time: '1 min', category: 'linkedin'      },
    { icon: '📱', label: 'Habit Tracker', desc: 'Sleep, gym, reading — live proof', pts: 2, time: '1 min', category: 'habit_tracker' },
  ] as const;
</script>

<!-- ── Privacy banner ─────────────────────────────────────────────────────── -->
<div class="privacy-banner">
  <span class="privacy-lock">🔒</span>
  <span class="privacy-text">Everything here stays private. We only verify that your profile reflects real life — improving your Trust Score and matches.</span>
</div>

<!-- ── Trust Score gauge ──────────────────────────────────────────────────── -->
<section class="section">
  <div class="section-label">
    <ShieldCheck size={13} />
    Your Trust Score
  </div>
  <div class="trust-gauge-container">
    <div class="gauge-visual">
      <svg viewBox="0 0 200 200" class="radial-gauge">
        <circle cx="100" cy="100" r="90" fill="none" stroke="var(--bg-3)" stroke-width="12" />
        <circle
          cx="100" cy="100" r="90"
          fill="none" stroke="var(--accent)" stroke-width="12"
          stroke-dasharray="{(cgTotal / 100) * 565} 565"
          stroke-linecap="round"
          transform="rotate(-90 100 100)"
        />
        <text x="100" y="100" text-anchor="middle" dy="0.3em" class="gauge-text">
          <tspan class="gauge-number">{cgTotal}</tspan>
          <tspan x="100" dy="1.2em" class="gauge-label-small">/ 100</tspan>
        </text>
      </svg>
    </div>

    <!-- Archetype fit badge -->
    <div class="fit-badge">
      <span class="fit-dot"></span>
      {fitLabel}
    </div>
  </div>
</section>

<!-- ── CG Subscores ───────────────────────────────────────────────────────── -->
<section class="section">
  <div class="section-label">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
    </svg>
    Casual Generous Fit
  </div>
  <div class="breakdown">

    <!-- Identity -->
    <div class="breakdown-item">
      <div class="breakdown-header">
        <span class="breakdown-name">Identity</span>
        <span class="breakdown-score score-{ic}">{subscores.identity}/100</span>
      </div>
      <div class="breakdown-bar">
        <div class="breakdown-fill fill-{ic}" style="width: {subscores.identity}%"></div>
      </div>
      {#if subscores.identity < 50}
        <button class="nudge-cta nudge-{ic}" onclick={() => goto('/verified-vibe/verification')}>
          <span class="nudge-text">Complete ID verification — women only message verified men</span>
          <span class="nudge-pts">+50 pts →</span>
        </button>
      {:else if subscores.identity < 75}
        <button class="nudge-cta nudge-{ic}" onclick={() => goto('/verified-vibe/verification')}>
          <span class="nudge-text">Complete face match to maximise identity score</span>
          <span class="nudge-pts">boost →</span>
        </button>
      {:else}
        <div class="breakdown-subs">✓ ID verified · Face matched</div>
      {/if}
    </div>

    <!-- Lifestyle Depth -->
    <div class="breakdown-item">
      <div class="breakdown-header">
        <span class="breakdown-name">Lifestyle Depth</span>
        <span class="breakdown-score score-{lc}">{subscores.lifestyleDepth}/100</span>
      </div>
      <div class="breakdown-bar">
        <div class="breakdown-fill fill-{lc}" style="width: {subscores.lifestyleDepth}%"></div>
      </div>
      {#if subscores.lifestyleDepth < 50}
        <button class="nudge-cta nudge-{lc}" onclick={() => goto('/verified-vibe/verification')}>
          <span class="nudge-text">Add lifestyle photos — women want to see your actual world</span>
          <span class="nudge-pts">+25 pts →</span>
        </button>
      {:else if subscores.lifestyleDepth < 75}
        <button class="nudge-cta nudge-{lc}" onclick={() => goto('/verified-vibe/verification')}>
          <span class="nudge-text">More real-world moments strengthen this signal</span>
          <span class="nudge-pts">boost →</span>
        </button>
      {:else}
        <div class="breakdown-subs">✓ Photo story verified</div>
      {/if}
    </div>

    <!-- Generosity Signals -->
    <div class="breakdown-item">
      <div class="breakdown-header">
        <span class="breakdown-name">Generosity Signals</span>
        <span class="breakdown-score score-{gc}">{subscores.generositySignals}/100</span>
      </div>
      <div class="breakdown-bar">
        <div class="breakdown-fill fill-{gc}" style="width: {subscores.generositySignals}%"></div>
      </div>
      {#if subscores.generositySignals < 50}
        <button class="nudge-cta nudge-{gc}" onclick={() => goto('/verified-vibe/verification')}>
          <span class="nudge-text">Add a spending snapshot — #1 signal for Casual Generous profiles</span>
          <span class="nudge-pts">+25 pts →</span>
        </button>
      {:else if subscores.generositySignals < 75}
        <button class="nudge-cta nudge-{gc}" onclick={() => goto('/verified-vibe/verification')}>
          <span class="nudge-text">Add more spending proof to push this signal higher</span>
          <span class="nudge-pts">boost →</span>
        </button>
      {:else}
        <div class="breakdown-subs">✓ Spending proof verified</div>
      {/if}
    </div>

    <!-- Emotional Safety -->
    <div class="breakdown-item">
      <div class="breakdown-header">
        <span class="breakdown-name">Emotional Safety</span>
        <span class="breakdown-score score-{ec}">{subscores.emotionalSafety}/100</span>
      </div>
      <div class="breakdown-bar">
        <div class="breakdown-fill fill-{ec}" style="width: {subscores.emotionalSafety}%"></div>
      </div>
      {#if subscores.emotionalSafety < 50}
        <button class="nudge-cta nudge-{ec}" onclick={() => goto('/verified-vibe/proof-upload?category=intro')}>
          <span class="nudge-text">Voice + video intro unlocks women messaging you first</span>
          <span class="nudge-pts">+8 pts →</span>
        </button>
      {:else if subscores.emotionalSafety < 75}
        <button class="nudge-cta nudge-{ec}" onclick={() => goto('/verified-vibe/proof-upload?category=intro')}>
          <span class="nudge-text">Add a video intro to complete your safety signal</span>
          <span class="nudge-pts">boost →</span>
        </button>
      {:else}
        <div class="breakdown-subs">✓ Voice &amp; video intro verified</div>
      {/if}
    </div>

    <!-- Social Legitimacy -->
    <div class="breakdown-item">
      <div class="breakdown-header">
        <span class="breakdown-name">Social Legitimacy</span>
        <span class="breakdown-score score-{sc}">{subscores.socialLegitimacy}/100</span>
      </div>
      <div class="breakdown-bar">
        <div class="breakdown-fill fill-{sc}" style="width: {subscores.socialLegitimacy}%"></div>
      </div>
      {#if subscores.socialLegitimacy < 75}
        <button class="nudge-cta nudge-{sc}">
          <span class="nudge-text">Connect LinkedIn — proves career stability & legitimacy</span>
          <span class="nudge-pts">+5 pts →</span>
        </button>
      {:else}
        <div class="breakdown-subs">✓ LinkedIn connected</div>
      {/if}
    </div>

  </div>
</section>

<!-- ── Verified Insights (from proof uploads) ────────────────────────────── -->
{#if proofInsights.length > 0}
<section class="section">
  <div class="section-label">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
    </svg>
    Verified Insights
  </div>
  <div class="insights-list">
    {#each proofInsights as insight (insight.id)}
      <div class="insight-row">
        <span class="insight-row-emoji">{insight.insight_emoji}</span>
        <span class="insight-row-label">{insight.insight_label}</span>
        <span class="insight-row-badge">✓ Verified</span>
      </div>
    {/each}
  </div>
</section>
{/if}

<!-- ── Show-Off upload prompts ────────────────────────────────────────────── -->
<section class="section">
  <div class="section-label">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 12h8M12 8v8"/>
    </svg>
    Show-Off
    <span class="section-hint">prove, don't claim</span>
  </div>
  <div class="showoff-grid">
    {#each showOffCategories as cat}
      {@const done = proofInsights.some(p => p.category === cat.category)}
      <button class="showoff-tile" class:showoff-tile--done={done} onclick={() => goto(`/verified-vibe/proof-upload?category=${cat.category}`)}>
        <div class="showoff-icon">{cat.icon}</div>
        <div class="showoff-body">
          <div class="showoff-label">{cat.label}</div>
          <div class="showoff-desc">{done ? proofInsights.find(p => p.category === cat.category)?.insight_label ?? cat.desc : cat.desc}</div>
          <div class="showoff-meta">
            {#if done}
              <span class="showoff-done-tag">✓ Verified</span>
            {:else}
              <span class="showoff-time">{cat.time}</span>
            {/if}
          </div>
        </div>
        {#if done}
          <div class="showoff-pts showoff-pts--done">✓</div>
        {:else}
          <div class="showoff-pts">+{cat.pts}</div>
        {/if}
      </button>
    {/each}
  </div>
</section>

<!-- ── Tier unlocks ───────────────────────────────────────────────────────── -->
<section class="section">
  <div class="section-label">
    <Zap size={13} />
    What Each Tier Unlocks
  </div>
  <div class="tier-list">
    <div class="tier-item {tier60 ? 'unlocked' : 'locked'}">
      {#if tier60}<div class="tier-check">✓</div>{:else}<div class="tier-number">60</div>{/if}
      <div class="tier-content">
        <div class="tier-title">60 · Visible</div>
        <div class="tier-desc">You start showing up in pools.</div>
      </div>
    </div>
    <div class="tier-item {tier70 ? 'unlocked' : 'locked'}">
      {#if tier70}<div class="tier-check">✓</div>{:else}<div class="tier-number">70</div>{/if}
      <div class="tier-content">
        <div class="tier-title">70 · Featured</div>
        <div class="tier-desc">Lifestyle-Oriented Women see you in their feed{tier70 ? ' ← you\'re here' : ''}.</div>
      </div>
    </div>
    <div class="tier-item {tier85 ? 'unlocked' : 'locked'}">
      {#if tier85}<div class="tier-check">✓</div>{:else}<div class="tier-number">85</div>{/if}
      <div class="tier-content">
        <div class="tier-title">85 · Priority</div>
        <div class="tier-desc">You appear first. Spoilt Women's pool fully unlocks.</div>
      </div>
    </div>
    <div class="tier-item {tier95 ? 'unlocked' : 'locked'}">
      {#if tier95}<div class="tier-check">✓</div>{:else}<div class="tier-number">95</div>{/if}
      <div class="tier-content">
        <div class="tier-title">95 · Elite</div>
        <div class="tier-desc">Exclusive visibility across all pools.</div>
      </div>
    </div>
  </div>
  <p class="tier-note">🔒 Everything here stays private. Matches only</p>
</section>

<!-- ── Proof connections ──────────────────────────────────────────────────── -->
<section class="section">
  <div class="section-label">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>
    Proof Connections
  </div>
  <div class="proof-list">
    {#each proofConnections as conn}
      {@const done = proofInsights.some(p => p.category === conn.category)}
      <button class="proof-tile" class:proof-tile--done={done} onclick={() => goto(`/verified-vibe/proof-upload?category=${conn.category}`)}>
        <div class="proof-icon">{conn.icon}</div>
        <div class="proof-body">
          <div class="proof-label">{conn.label}</div>
          <div class="proof-desc">{done ? proofInsights.find(p => p.category === conn.category)?.insight_label ?? conn.desc : conn.desc}</div>
          <div class="proof-time" class:proof-time--done={done}>{done ? '✓ Verified' : conn.time}</div>
        </div>
        <div class="proof-right">
          {#if done}
            <div class="proof-pts proof-pts--done">✓</div>
          {:else}
            <div class="proof-pts">+{conn.pts}</div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 5l7 7-7 7"/>
            </svg>
          {/if}
        </div>
      </button>
    {/each}
  </div>
</section>

<style>
  /* ── Privacy banner ── */
  .privacy-banner {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin: 0 16px;
    padding: 10px 13px;
    background: rgba(99, 102, 241, 0.09);
    border: 1px solid rgba(99, 102, 241, 0.22);
    border-radius: 12px;
  }

  .privacy-lock {
    font-size: 13px;
    flex-shrink: 0;
    margin-top: 1px;
  }

  .privacy-text {
    font-size: 12px;
    color: #a5b4fc;
    line-height: 1.5;
    font-weight: 500;
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 0 16px;
  }

  .section-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-3);
  }

  .section-hint {
    font-weight: 400;
    font-size: 11px;
    text-transform: none;
    letter-spacing: 0;
    color: var(--text-3);
    opacity: 0.7;
    margin-left: 2px;
  }

  /* ── Gauge ── */
  .trust-gauge-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    border-radius: var(--r-lg);
    padding: 20px 16px 16px;
  }

  .gauge-visual {
    display: flex;
    justify-content: center;
  }

  .radial-gauge {
    width: 140px;
    height: 140px;
  }

  .gauge-text { font-family: var(--font-mono); }
  .gauge-number { font-size: 44px; font-weight: 700; fill: var(--text-1); }
  .gauge-label-small { font-size: 12px; fill: var(--text-3); }

  .fit-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 600;
    color: var(--accent);
    padding: 6px 14px;
    background: var(--accent-tint);
    border-radius: 20px;
  }

  .fit-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--accent);
    flex-shrink: 0;
  }

  /* ── Subscores ── */
  .breakdown {
    display: flex;
    flex-direction: column;
    gap: 10px;
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    border-radius: var(--r-lg);
    padding: 12px;
  }

  .breakdown-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .breakdown-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .breakdown-name {
    font-size: 13px;
    font-weight: 600;
  }

  .breakdown-score {
    font-size: 11px;
    font-family: var(--font-mono);
    font-weight: 700;
  }

  /* Score color variants */
  .score-red   { color: #ef4444; }
  .score-amber { color: #f59e0b; }
  .score-green { color: var(--accent); }

  .breakdown-bar {
    width: 100%;
    height: 4px;
    background: var(--bg-3);
    border-radius: 3px;
    overflow: hidden;
  }

  .breakdown-fill {
    height: 100%;
    border-radius: 3px;
    transition: width 500ms ease;
  }

  /* Fill color variants */
  .fill-red   { background: #ef4444; }
  .fill-amber { background: #f59e0b; }
  .fill-green { background: var(--accent); }

  .breakdown-subs {
    font-size: 11px;
    color: var(--text-3);
  }

  .nudge-cta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 7px 10px;
    border-radius: 8px;
    cursor: pointer;
    text-align: left;
    width: 100%;
    transition: opacity 150ms;
  }

  .nudge-cta:active { opacity: 0.75; }

  /* Nudge CTA color variants */
  .nudge-red {
    background: rgba(239, 68, 68, 0.08);
    border: 1px solid rgba(239, 68, 68, 0.25);
  }

  .nudge-amber {
    background: rgba(245, 158, 11, 0.08);
    border: 1px solid rgba(245, 158, 11, 0.25);
  }

  .nudge-text {
    font-size: 11px;
    color: var(--text-2);
    line-height: 1.4;
    flex: 1;
  }

  .nudge-pts {
    font-size: 11px;
    font-weight: 700;
    color: var(--accent);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .nudge-red   .nudge-pts { color: #ef4444; }
  .nudge-amber .nudge-pts { color: #f59e0b; }

  /* ── Show-Off ── */
  .showoff-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .showoff-tile {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    border-radius: var(--r-lg);
    cursor: pointer;
    text-align: left;
    width: 100%;
  }

  .showoff-icon {
    font-size: 22px;
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
    flex-shrink: 0;
    background: var(--bg-3);
    border-radius: 10px;
  }

  .showoff-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .showoff-label {
    font-size: 13px;
    font-weight: 600;
  }

  .showoff-desc {
    font-size: 11px;
    color: var(--text-3);
  }

  .showoff-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 2px;
  }

  .showoff-time {
    font-size: 11px;
    font-weight: 600;
    color: var(--accent);
  }

  .showoff-pts {
    font-size: 13px;
    font-weight: 700;
    color: var(--accent);
    background: var(--accent-tint);
    padding: 4px 10px;
    border-radius: 20px;
    flex-shrink: 0;
  }

  /* ── Tiers ── */
  .tier-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .tier-item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px 14px;
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    border-radius: var(--r-lg);
  }

  .tier-item.unlocked {
    border-color: var(--accent);
    background: var(--accent-tint);
  }

  .tier-check {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--accent);
    color: #000;
    display: grid;
    place-items: center;
    font-size: 13px;
    font-weight: 700;
    flex-shrink: 0;
  }

  .tier-number {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--bg-3);
    color: var(--text-3);
    display: grid;
    place-items: center;
    font-size: 12px;
    font-weight: 600;
    flex-shrink: 0;
  }

  .tier-content {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .tier-title {
    font-size: 13px;
    font-weight: 600;
  }

  .tier-item.locked .tier-title {
    color: var(--text-2);
  }

  .tier-desc {
    font-size: 12px;
    color: var(--text-3);
    line-height: 1.4;
  }

  .tier-note {
    font-size: 11px;
    color: var(--text-3);
    text-align: center;
    margin: 0;
  }

  /* ── Verified Insights ── */
  .insights-list {
    display: flex;
    flex-direction: column;
    gap: 1px;
    background: var(--border-1);
    border: 1px solid var(--border-1);
    border-radius: var(--r-lg);
    overflow: hidden;
  }

  .insight-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 11px 14px;
    background: var(--bg-2);
  }

  .insight-row-emoji {
    font-size: 20px;
    width: 28px;
    text-align: center;
    flex-shrink: 0;
  }

  .insight-row-label {
    flex: 1;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-1);
  }

  .insight-row-badge {
    font-size: 11px;
    font-weight: 700;
    color: var(--accent);
    background: var(--accent-tint);
    padding: 2px 8px;
    border-radius: 100px;
    white-space: nowrap;
    flex-shrink: 0;
  }

  /* ── Show-Off done state ── */
  .showoff-tile--done {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 6%, var(--bg-2));
  }

  .showoff-done-tag {
    font-size: 11px;
    font-weight: 700;
    color: var(--accent);
  }

  .showoff-pts--done {
    background: var(--accent);
    color: #000;
    font-size: 14px;
  }

  /* ── Proof connections ── */
  .proof-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .proof-tile {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    border-radius: var(--r-lg);
    cursor: pointer;
    text-align: left;
    width: 100%;
    font-family: inherit;
    transition: background 150ms, border-color 150ms;
  }

  .proof-tile:active {
    background: var(--bg-3);
  }

  @media (hover: hover) {
    .proof-tile:hover {
      background: var(--bg-3);
    }
  }

  .proof-tile--done {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 6%, var(--bg-2));
  }

  .proof-time--done {
    color: var(--accent);
    font-weight: 700;
  }

  .proof-pts--done {
    background: var(--accent);
    color: #000;
    font-weight: 700;
  }

  .proof-icon {
    font-size: 22px;
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
    flex-shrink: 0;
    background: var(--bg-3);
    border-radius: 10px;
  }

  .proof-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .proof-label {
    font-size: 13px;
    font-weight: 600;
  }

  .proof-desc {
    font-size: 11px;
    color: var(--text-3);
  }

  .proof-time {
    font-size: 11px;
    font-weight: 600;
    color: var(--accent);
    margin-top: 2px;
  }

  .proof-right {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
    color: var(--text-3);
  }

  .proof-pts {
    font-size: 13px;
    font-weight: 700;
    color: var(--accent);
    background: var(--accent-tint);
    padding: 4px 10px;
    border-radius: 20px;
  }
</style>
