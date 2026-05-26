<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { ShieldCheck, Zap } from 'lucide-svelte';
  import { calculateCGSubscores, calculateCGTotal } from '$lib/verified-vibe/server/trustScore';
  import type { VerificationRecord } from '$lib/verified-vibe/types';
  import { getSupabaseClient } from '$lib/client/supabase';

  interface Props {
    trustScore: number;
    verificationRecords: VerificationRecord[];
    onEditQA?: () => void;
  }

  let { trustScore, verificationRecords, onEditQA = () => {} }: Props = $props();

  // ── Proof insights (localStorage + Supabase) ─────────────────────────────────
  interface ProofInsight {
    id: string;
    category: string;
    insight_label: string;
    insight_emoji: string;
    insights?: Array<{ label: string; emoji: string }>;
    photo_count?: number;
    pts_awarded: number;
    verified_at: string;
  }

  let proofInsights = $state<ProofInsight[]>([]);

  // Scores derived from localStorage onboarding completion (fallback when DB records missing)
  let lsBaseScores = $state({ identity: 0, lifestyleDepth: 0, generositySignals: 0 });

  onMount(async () => {
    // Load proof insights from localStorage immediately
    try {
      proofInsights = JSON.parse(localStorage.getItem('vv_proof_insights') ?? '[]');
    } catch { proofInsights = []; }

    // Derive base scores from onboarding localStorage data (fixes 0/100 in dev/skip mode)
    try {
      const hasUser = !!localStorage.getItem('vv_user');
      const hasPhotos = !!localStorage.getItem('vv_photos');
      let qaData: Record<string, unknown> = {};
      try { qaData = JSON.parse(localStorage.getItem('vv_qa_responses') ?? '{}'); } catch {}
      const hasCGProfile = !!localStorage.getItem('vv_casual_generous_profile');

      lsBaseScores = {
        identity:          hasUser ? 65 : 0,
        lifestyleDepth:    hasPhotos ? 60 : 0,
        generositySignals: (qaData.spending_comfort || hasCGProfile) ? 75 : (Object.keys(qaData).length > 2 ? 50 : 0),
      };
    } catch { /* ignore */ }

    // Try to pull proof insights from Supabase (fixes device-switch / localStorage clear)
    try {
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: rows } = await (supabase as any)
          .from('verified_vibe_verification')
          .select('id, step, data, completed_at')
          .eq('user_id', session.user.id)
          .like('step', 'proof_%');

        if (rows && rows.length > 0) {
          const fromDB: ProofInsight[] = rows.map((r: any) => ({
            id:            r.id,
            category:      (r.step as string).replace('proof_', ''),
            insight_label: r.data?.insights?.[0]?.label ?? r.data?.insight_label ?? 'Proof verified',
            insight_emoji: r.data?.insights?.[0]?.emoji ?? r.data?.insight_emoji ?? '✅',
            insights:      r.data?.insights ?? undefined,
            photo_count:   r.data?.photo_count,
            pts_awarded:   r.data?.pts_awarded ?? 0,
            verified_at:   r.completed_at ?? new Date().toISOString(),
          }));

          // Merge: Supabase takes priority over localStorage for same category
          const merged = [...proofInsights];
          for (const dbItem of fromDB) {
            const idx = merged.findIndex(p => p.category === dbItem.category);
            if (idx >= 0) merged[idx] = dbItem; else merged.push(dbItem);
          }
          proofInsights = merged;
          localStorage.setItem('vv_proof_insights', JSON.stringify(proofInsights));
        }
      }
    } catch { /* non-critical */ }
  });

  // ── Score boost from proof insights ──────────────────────────────────────────
  const PROOF_BOOST: Record<string, { key: keyof ReturnType<typeof calculateCGSubscores>; boost: number }> = {
    lifestyle:    { key: 'lifestyleDepth',    boost: 30 },
    hosting:      { key: 'lifestyleDepth',    boost: 20 },
    discipline:   { key: 'emotionalSafety',   boost: 35 },
    social_proof: { key: 'socialLegitimacy',  boost: 30 },
    linkedin:     { key: 'socialLegitimacy',  boost: 50 },
    instagram:    { key: 'socialLegitimacy',  boost: 25 },
    twitter:      { key: 'socialLegitimacy',  boost: 15 },
    habit_tracker:{ key: 'socialLegitimacy',  boost: 20 },
    intro:        { key: 'emotionalSafety',   boost: 45 },
    spending:     { key: 'generositySignals', boost: 30 },
    assets:       { key: 'generositySignals', boost: 35 },
  };

  // Show-off categories scale boost by photo count
  const SHOW_OFF_CATS = new Set(['lifestyle', 'hosting', 'discipline', 'social_proof']);
  function photoBoostMultiplier(count: number | undefined): number {
    if (!count || count <= 0) return 1;
    if (count <= 4)  return 0.40;
    if (count <= 9)  return 0.65;
    if (count <= 14) return 0.85;
    return 1.0;
  }

  // Base subscores: DB verification records supplemented by localStorage onboarding data
  const baseSubscores = $derived.by(() => {
    const fromRecords = calculateCGSubscores(verificationRecords);
    return {
      identity:          Math.max(fromRecords.identity,          lsBaseScores.identity),
      lifestyleDepth:    Math.max(fromRecords.lifestyleDepth,    lsBaseScores.lifestyleDepth),
      generositySignals: Math.max(fromRecords.generositySignals, lsBaseScores.generositySignals),
      emotionalSafety:   fromRecords.emotionalSafety,
      socialLegitimacy:  fromRecords.socialLegitimacy,
    };
  });

  const subscores = $derived.by(() => {
    const s = { ...baseSubscores };
    for (const p of proofInsights) {
      const boost = PROOF_BOOST[p.category];
      if (boost) {
        const multiplier = SHOW_OFF_CATS.has(p.category) ? photoBoostMultiplier(p.photo_count) : 1;
        (s[boost.key] as number) = Math.min(100, (s[boost.key] as number) + Math.round(boost.boost * multiplier));
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

  // ── Tier unlock notification ──────────────────────────────────────────────────
  const TIER_MESSAGES: Record<number, { emoji: string; title: string; desc: string }> = {
    60: { emoji: '🎉', title: 'You hit Visible tier!',  desc: 'You are now showing up in match pools.' },
    70: { emoji: '🚀', title: 'You hit Featured tier!', desc: 'Lifestyle-Oriented Women now see you in their feed.' },
    85: { emoji: '⭐', title: 'You hit Priority tier!', desc: 'You appear first. Spoilt Women\'s pool fully unlocked.' },
    95: { emoji: '👑', title: 'You hit Elite tier!',    desc: 'Exclusive visibility across all match pools.' },
  };
  let tierUnlock = $state<{ emoji: string; title: string; desc: string } | null>(null);

  $effect(() => {
    const score = cgTotal;
    if (typeof window === 'undefined') return;
    const prevScore = parseInt(localStorage.getItem('vv_cg_prev_score') ?? '0', 10);
    if (score <= prevScore) return;

    // Find highest new tier crossed
    const tiers = [95, 85, 70, 60] as const;
    for (const t of tiers) {
      if (score >= t && prevScore < t) {
        tierUnlock = TIER_MESSAGES[t];
        break;
      }
    }
    localStorage.setItem('vv_cg_prev_score', String(score));
  });

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
    { icon: '💼', label: 'LinkedIn / CV',  desc: 'Career stability proof',           pts: 5, time: '1 min', category: 'linkedin'      },
    { icon: '📸', label: 'Instagram',       desc: 'Social life and personality',       pts: 3, time: '1 min', category: 'instagram'     },
    { icon: '🐦', label: 'Twitter / X',     desc: 'Thoughts, interests, engagement',   pts: 2, time: '1 min', category: 'twitter'       },
    { icon: '📱', label: 'Habit Tracker',   desc: 'Sleep, gym, reading. Live proof.',  pts: 2, time: '1 min', category: 'habit_tracker' },
    { icon: '🏠', label: 'Assets',          desc: 'Car, property, company ownership. Name match required.', pts: 10, time: '2 min', category: 'assets' },
  ] as const;
</script>

<!-- ── Privacy banner ─────────────────────────────────────────────────────── -->
<div class="privacy-banner">
  <span class="privacy-lock">🔒</span>
  <span class="privacy-text">Everything here stays private. We only verify that your profile reflects real life. This improves your Trust Score and who you match with.</span>
</div>

<!-- ── Tier unlock celebration ────────────────────────────────────────────── -->
{#if tierUnlock}
<div class="tier-unlock-banner">
  <span class="tier-unlock-emoji">{tierUnlock.emoji}</span>
  <div class="tier-unlock-body">
    <div class="tier-unlock-title">{tierUnlock.title}</div>
    <div class="tier-unlock-desc">{tierUnlock.desc}</div>
  </div>
  <button class="tier-unlock-dismiss" onclick={() => tierUnlock = null} aria-label="Dismiss">✕</button>
</div>
{/if}

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
        <button class="nudge-cta nudge-{ic}" onclick={() => goto('/verified-vibe/verification?step=id&standalone=1')}>
          <span class="nudge-text">Verify your identity. Women only message verified men.</span>
          <span class="nudge-pts">+50 pts →</span>
        </button>
      {:else if subscores.identity < 75}
        <button class="nudge-cta nudge-{ic}" onclick={() => goto('/verified-vibe/verification?step=liveness&standalone=1')}>
          <span class="nudge-text">Complete face match to maximise your identity score</span>
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
        <button class="nudge-cta nudge-{lc}" onclick={() => goto('/verified-vibe/proof-upload?category=lifestyle')}>
          <span class="nudge-text">Add lifestyle photos. Women want to see your actual world.</span>
          <span class="nudge-pts">+30 pts →</span>
        </button>
      {:else if subscores.lifestyleDepth < 75}
        <button class="nudge-cta nudge-{lc}" onclick={() => goto('/verified-vibe/proof-upload?category=lifestyle')}>
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
        <button class="nudge-cta nudge-{gc}" onclick={() => goto('/verified-vibe/proof-upload?category=spending')}>
          <span class="nudge-text">Upload a spending receipt. The #1 signal for Casual Generous profiles.</span>
          <span class="nudge-pts">+10 pts →</span>
        </button>
      {:else if subscores.generositySignals < 75}
        <button class="nudge-cta nudge-{gc}" onclick={() => goto('/verified-vibe/proof-upload?category=spending')}>
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
        <button class="nudge-cta nudge-{sc}" onclick={() => goto('/verified-vibe/proof-upload?category=linkedin')}>
          <span class="nudge-text">Connect LinkedIn. Proves career stability and legitimacy.</span>
          <span class="nudge-pts">+5 pts →</span>
        </button>
      {:else}
        <div class="breakdown-subs">✓ Social presence verified</div>
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
    {#each proofInsights as p (p.id)}
      {#if p.insights && p.insights.length > 0}
        {#each p.insights as ins}
          <div class="insight-row">
            <span class="insight-row-emoji">{ins.emoji}</span>
            <span class="insight-row-label">{ins.label}</span>
            <span class="insight-row-badge">✓ Verified</span>
          </div>
        {/each}
      {:else}
        <!-- Backward compat: old single-insight format -->
        <div class="insight-row">
          <span class="insight-row-emoji">{p.insight_emoji}</span>
          <span class="insight-row-label">{p.insight_label}</span>
          <span class="insight-row-badge">✓ Verified</span>
        </div>
      {/if}
    {/each}
  </div>
</section>
{/if}

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
          {#if done}
            {@const pi = proofInsights.find(p => p.category === conn.category)}
            <div class="proof-desc">{pi?.insights?.[0]?.label ?? pi?.insight_label ?? conn.desc}</div>
          {:else}
            <div class="proof-desc">{conn.desc}</div>
          {/if}
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
  /* ── Tier unlock banner ── */
  .tier-unlock-banner {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0 16px;
    padding: 12px 14px;
    background: linear-gradient(135deg, rgba(52,211,153,0.12), rgba(52,211,153,0.06));
    border: 1px solid rgba(52, 211, 153, 0.35);
    border-radius: 14px;
    animation: tier-pop 0.4s cubic-bezier(0.34,1.56,0.64,1);
  }

  @keyframes tier-pop {
    from { transform: scale(0.94); opacity: 0; }
    to   { transform: scale(1);    opacity: 1; }
  }

  .tier-unlock-emoji { font-size: 28px; flex-shrink: 0; }

  .tier-unlock-body { flex: 1; display: flex; flex-direction: column; gap: 2px; }

  .tier-unlock-title {
    font-size: 14px;
    font-weight: 700;
    color: var(--accent);
  }

  .tier-unlock-desc {
    font-size: 12px;
    color: var(--text-2);
    line-height: 1.4;
  }

  .tier-unlock-dismiss {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--bg-3);
    border: 1px solid var(--border-1);
    color: var(--text-3);
    font-size: 11px;
    cursor: pointer;
    display: grid;
    place-items: center;
    flex-shrink: 0;
  }

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
