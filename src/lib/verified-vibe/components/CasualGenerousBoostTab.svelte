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
  let insightsExpanded = $state(false);

  const CHIPS_PREVIEW = 2;

  // Flat list of all insight chips across all proof categories
  const allInsightChips = $derived(
    proofInsights.flatMap(p =>
      (p.insights && p.insights.length > 0)
        ? p.insights.map(ins => ({ emoji: ins.emoji, label: ins.label }))
        : [{ emoji: p.insight_emoji, label: p.insight_label }]
    )
  );

  const visibleChips  = $derived(insightsExpanded ? allInsightChips : allInsightChips.slice(0, CHIPS_PREVIEW));
  const hiddenCount   = $derived(allInsightChips.length - CHIPS_PREVIEW);

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
    { icon: '🌍', label: 'Lifestyle',    desc: 'Travel, dining, events',               pts: 8,  time: '2 min', category: 'lifestyle',    powers: 'Lifestyle Signals · Travel Magnets' },
    { icon: '🍽️', label: 'Hosting',      desc: 'Dinners, celebrations',                 pts: 6,  time: '2 min', category: 'hosting',      powers: 'Lifestyle Signals'                  },
    { icon: '💪', label: 'Discipline',   desc: 'Gym, sleep, reading routines',          pts: 4,  time: '1 min', category: 'discipline',   powers: 'Health & Fitness'                   },
    { icon: '🤝', label: 'Social Proof', desc: 'Friends, communities',                  pts: 4,  time: '2 min', category: 'social_proof', powers: 'Social Life'                        },
    { icon: '💰', label: 'Wealth',       desc: 'Bank statements, salary, investments',  pts: 12, time: '2 min', category: 'wealth',       powers: 'Money Matters'                      },
    { icon: '🏠', label: 'Assets',       desc: 'Car, property, company ownership',      pts: 10, time: '2 min', category: 'assets',       powers: 'In the Garage · Money Matters'      },
  ] as const;

  // Social platforms grouped into one card
  const socialPlatforms = [
    { category: 'linkedin',  label: 'LinkedIn', pts: 5 },
    { category: 'instagram', label: 'Instagram', pts: 3 },
    { category: 'twitter',   label: 'Twitter / X', pts: 2 },
  ] as const;

  // Non-social proof connections — Assets moved to Show-Off
  const proofConnections: { icon: string; label: string; desc: string; pts: number; time: string; category: string }[] = [];
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
        <defs>
          <linearGradient id="trustRingGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#5BF0BA"/>
            <stop offset="100%" stop-color="#0F8A5E"/>
          </linearGradient>
        </defs>
        <circle cx="100" cy="100" r="90" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="12" />
        <circle
          cx="100" cy="100" r="90"
          fill="none" stroke="url(#trustRingGrad)" stroke-width="12"
          stroke-dasharray="{(cgTotal / 100) * 565} 565"
          stroke-linecap="round"
          transform="rotate(-90 100 100)"
        />
        <text x="100" y="92" text-anchor="middle" class="gauge-number-serif">{cgTotal}</text>
        <text x="100" y="116" text-anchor="middle" class="gauge-label-small">/ 100</text>
      </svg>
    </div>

    <!-- Archetype fit badge -->
    <div class="fit-badge">
      <span class="fit-dot"></span>
      {fitLabel}
    </div>

    <!-- Tier ladder with color zones -->
    <div class="tier-ladder">
      <div class="tier-ladder-header">
        <span class="tier-ladder-title">Score progress</span>
        <span class="tier-ladder-next">
          {#if cgTotal < 60}+{60 - cgTotal} → Visible{:else if cgTotal < 70}+{70 - cgTotal} → Featured{:else if cgTotal < 85}+{85 - cgTotal} → Priority{:else if cgTotal < 95}+{95 - cgTotal} → Elite{:else}🏆 Elite tier{/if}
        </span>
      </div>

      <!-- Zoned bar -->
      <div class="tier-zone-bar">
        <div class="tier-zone tier-zone--red" style="flex: 60">
          <div class="tier-zone-fill" style="width: {Math.min(100, (Math.max(0, cgTotal) / 60) * 100)}%"></div>
        </div>
        <div class="tier-zone tier-zone--amber" style="flex: 25">
          <div class="tier-zone-fill" style="width: {cgTotal >= 60 ? Math.min(100, ((cgTotal - 60) / 25) * 100) : 0}%"></div>
        </div>
        <div class="tier-zone tier-zone--green" style="flex: 15">
          <div class="tier-zone-fill" style="width: {cgTotal >= 85 ? Math.min(100, ((cgTotal - 85) / 15) * 100) : 0}%"></div>
        </div>
      </div>

      <!-- Tier dots — odd indexes label above, even below to prevent overlap -->
      <div class="tier-dots-row">
        {#each [{v:60,label:'Visible'},{v:70,label:'Featured'},{v:85,label:'Priority'},{v:95,label:'Elite'}] as t, i}
          {@const reached = cgTotal >= t.v}
          {@const color = t.v >= 85 ? 'var(--accent)' : t.v >= 60 ? '#f4b95c' : '#ef4444'}
          <div class="tier-dot-item {i % 2 === 1 ? 'tier-dot-item--above' : ''}" style="left: {t.v}%">
            <span class="tier-dot-label" style="color: {reached ? color : 'var(--text-3)'}">{t.label}</span>
            <div class="tier-dot" style="background: {reached ? color : 'var(--bg-3)'}; border-color: {reached ? color : 'var(--border-1)'}">
              {#if reached}<svg width="6" height="6" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>{/if}
            </div>
          </div>
        {/each}
      </div>

      <!-- Zone legend -->
      <div class="tier-zone-legend">
        <span class="tier-zone-leg" class:tier-zone-leg--active={cgTotal < 60} style="--zc: #ef4444">At Risk</span>
        <span class="tier-zone-leg" class:tier-zone-leg--active={cgTotal >= 60 && cgTotal < 85} style="--zc: #f4b95c">In Progress</span>
        <span class="tier-zone-leg" class:tier-zone-leg--active={cgTotal >= 85} style="--zc: var(--accent)">Trusted</span>
      </div>
    </div>
  </div>
</section>

<!-- ── Safety Check ───────────────────────────────────────────────────────── -->
<section class="section">
  <div class="section-label">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
    </svg>
    Safety Check
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

  </div>
</section>

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
      {@const pi = proofInsights.find(p => p.category === cat.category)}
      {@const docCount = pi?.photo_count ?? (pi ? 1 : 0)}
      <button class="showoff-tile" class:showoff-tile--done={done} onclick={() => goto(`/verified-vibe/proof-upload?category=${cat.category}`)}>
        <div class="showoff-icon">{cat.icon}</div>
        <div class="showoff-body">
          <div class="showoff-label">{cat.label}</div>
          {#if done}
            <div class="showoff-desc">{pi?.insights?.[0]?.label ?? pi?.insight_label ?? cat.desc}</div>
          {:else}
            <div class="showoff-desc">{cat.desc}</div>
          {/if}
          <div class="showoff-meta">
            {#if done}
              <span class="showoff-done-tag">✓ Verified{docCount > 0 ? ` · ${docCount} ${docCount === 1 ? 'photo' : 'photos'}` : ''}</span>
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

<!-- ── Socials — single compact card ─────────────────────────────────────── -->
<section class="section">
  <div class="section-label">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>
    Socials
    <span class="section-hint">connect to verify</span>
  </div>

  <div class="socials-card">
    {#each socialPlatforms as sp}
      {@const done = proofInsights.some(p => p.category === sp.category)}
      <button
        class="social-btn {done ? 'social-btn--done' : ''}"
        onclick={() => goto(`/verified-vibe/proof-upload?category=${sp.category}`)}
        type="button"
        title={sp.label}
      >
        <!-- Platform logo SVG -->
        {#if sp.category === 'linkedin'}
          <svg class="social-logo" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
          </svg>
        {:else if sp.category === 'instagram'}
          <svg class="social-logo" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
          </svg>
        {:else}
          <svg class="social-logo" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
        {/if}

        {#if done}
          <span class="social-check">✓</span>
        {:else}
          <span class="social-pts">+{sp.pts}</span>
        {/if}
      </button>
    {/each}
  </div>
</section>

<!-- ── Background Verification ────────────────────────────────────────────── -->
<section class="section">
  <div class="section-label">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
    </svg>
    Background Verification
    <span class="section-hint">optional</span>
  </div>
  <button class="bgv-card" onclick={() => goto('/verified-vibe/background-check')} type="button">
    <div class="bgv-icon-wrap">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M9 12l2 2 4-4"/>
        <path d="M12 2L3 7v5c0 5.25 3.75 10.2 9 11.4C17.25 22.2 21 17.25 21 12V7l-9-5z"/>
      </svg>
    </div>
    <div class="bgv-body">
      <p class="bgv-title">Run a background check</p>
      <p class="bgv-desc">Criminal, identity & address verification — report stays private, only a badge shows on your profile.</p>
    </div>
    <svg class="bgv-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      <path d="M9 5l7 7-7 7"/>
    </svg>
  </button>
</section>

<!-- ── Remaining proof connections (Assets) ───────────────────────────────── -->
{#if proofConnections.length > 0}
<section class="section">
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
{/if}

<!-- ── Verified Insights — inline comma-separated, 2 shown + "+X more" ───── -->
{#if allInsightChips.length > 0}
<section class="section">
  <div class="section-label">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
    </svg>
    Verified Insights
  </div>
  <p class="insights-inline">
    {#each visibleChips as chip, i}
      <span class="insight-inline-item">
        <span class="insight-inline-emoji">{chip.emoji}</span>{chip.label}
      </span>{#if i < visibleChips.length - 1}<span class="insight-sep">, </span>{/if}
    {/each}
    {#if !insightsExpanded && hiddenCount > 0}
      <span class="insight-sep"> · </span><button class="insights-more-btn" onclick={() => insightsExpanded = true} type="button">+{hiddenCount} more</button>
    {:else if insightsExpanded && allInsightChips.length > CHIPS_PREVIEW}
      <span class="insight-sep"> · </span><button class="insights-more-btn insights-more-btn--less" onclick={() => insightsExpanded = false} type="button">Show less</button>
    {/if}
  </p>
</section>
{/if}

<style>
  /* ── Tier unlock banner ── */
  .tier-unlock-banner {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0 16px;
    padding: 12px 14px;
    background: linear-gradient(135deg, rgba(255, 122, 77,0.12), rgba(255, 122, 77,0.06));
    border: 1px solid rgba(255, 122, 77, 0.35);
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
    width: 180px;
    height: 180px;
  }

  .gauge-number-serif { font-size: 56px; font-style: italic; font-weight: 400; fill: #fff; font-family: var(--font-serif, "Georgia", serif); }
  .gauge-label-small { font-size: 13px; fill: var(--text-3); font-family: inherit; }

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
    box-shadow: 0 0 10px var(--accent);
    animation: pulse-fit 2.4s ease-in-out infinite;
  }
  @keyframes pulse-fit {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 1; }
  }

  /* Tier ladder */
  .tier-ladder {
    width: 100%;
    padding: 14px 0 2px;
    border-top: 1px solid var(--border-1);
    margin-top: 14px;
  }
  .tier-ladder-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  }
  .tier-ladder-title {
    font-size: 10px;
    font-weight: 700;
    color: var(--text-3);
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  .tier-ladder-next {
    font-size: 11px;
    font-weight: 500;
    color: var(--text-2);
  }
  .tier-zone-bar {
    display: flex;
    gap: 2px;
    height: 6px;
    border-radius: 3px;
    overflow: hidden;
  }
  .tier-zone {
    position: relative;
    border-radius: 3px;
    background: rgba(255,255,255,0.05);
  }
  .tier-zone-fill {
    position: absolute;
    inset: 0;
    border-radius: 3px;
    transition: width 0.5s ease;
  }
  .tier-zone--red .tier-zone-fill { background: #ef4444; }
  .tier-zone--amber .tier-zone-fill { background: #f4b95c; }
  .tier-zone--green .tier-zone-fill { background: var(--accent); }
  .tier-dots-row {
    position: relative;
    height: 52px;
    margin: 0 0 4px;
  }
  .tier-dot-item {
    position: absolute;
    top: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column-reverse;
    align-items: center;
    gap: 3px;
  }
  .tier-dot-item--above {
    flex-direction: column;
  }
  .tier-dot {
    width: 11px;
    height: 11px;
    border-radius: 50%;
    border: 2px solid;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .tier-dot-label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.02em;
    white-space: nowrap;
  }
  .tier-zone-legend {
    display: flex;
    justify-content: space-between;
    padding-top: 8px;
    border-top: 1px solid var(--border-1);
    margin-top: 6px;
  }
  .tier-zone-leg {
    font-size: 9.5px;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-3);
    display: flex;
    align-items: center;
    gap: 5px;
    opacity: 0.55;
  }
  .tier-zone-leg::before {
    content: '';
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--zc);
  }
  .tier-zone-leg--active {
    color: var(--zc);
    opacity: 1;
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

  /* ── Verified Insights — inline comma-separated ── */
  .insights-inline {
    font-size: 13px;
    color: var(--text-2);
    line-height: 1.65;
    margin: 0;
  }

  .insight-inline-item {
    display: inline;
  }

  .insight-inline-emoji {
    display: inline;
    margin-right: 3px;
    font-size: 14px;
  }

  .insight-sep {
    color: var(--text-3);
  }

  .insights-more-btn {
    display: inline;
    background: none;
    border: none;
    padding: 0;
    font-size: 13px;
    font-weight: 700;
    color: var(--accent);
    cursor: pointer;
    font-family: inherit;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .insights-more-btn--less {
    color: var(--text-3);
    font-weight: 500;
  }

  /* ── Background Verification card ── */
  .bgv-card {
    display: flex;
    align-items: center;
    gap: 14px;
    width: 100%;
    padding: 14px 16px;
    background: linear-gradient(135deg, rgba(99,102,241,0.08), rgba(99,102,241,0.04));
    border: 1px solid rgba(99,102,241,0.28);
    border-radius: 14px;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s, border-color 0.15s;
  }
  .bgv-card:hover {
    background: linear-gradient(135deg, rgba(99,102,241,0.14), rgba(99,102,241,0.08));
    border-color: rgba(99,102,241,0.45);
  }
  .bgv-icon-wrap {
    flex-shrink: 0;
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: rgba(99,102,241,0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #FF7A4D;
  }
  .bgv-body {
    flex: 1;
    min-width: 0;
  }
  .bgv-title {
    font-size: 14px;
    font-weight: 700;
    color: var(--text-1);
    margin: 0 0 3px;
  }
  .bgv-desc {
    font-size: 11px;
    color: var(--text-3);
    line-height: 1.45;
    margin: 0;
  }
  .bgv-arrow {
    flex-shrink: 0;
    color: rgba(99,102,241,0.6);
  }

  /* kept for any stale references */
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
  /* ── Socials card ── */
  .socials-card {
    display: flex;
    gap: 10px;
  }

  .social-btn {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 14px 10px 10px;
    background: var(--bg-2);
    border: 1px solid var(--border-2);
    border-radius: 14px;
    cursor: pointer;
    color: rgba(255,255,255,0.55);
    transition: background 0.15s, border-color 0.15s, color 0.15s;
    position: relative;
  }

  .social-btn:active {
    background: var(--bg-3);
  }

  @media (hover: hover) {
    .social-btn:hover {
      background: var(--bg-3);
      border-color: var(--border-1);
      color: rgba(255,255,255,0.85);
    }
  }

  .social-btn--done {
    border-color: rgba(255, 122, 77, 0.4);
    background: rgba(255, 122, 77, 0.06);
    color: var(--accent);
  }

  .social-logo {
    width: 26px;
    height: 26px;
    flex-shrink: 0;
  }

  .social-pts {
    font-size: 10px;
    font-weight: 700;
    color: var(--accent);
    background: rgba(255, 122, 77, 0.12);
    padding: 2px 6px;
    border-radius: 100px;
  }

  .social-check {
    font-size: 11px;
    font-weight: 700;
    color: var(--accent);
  }

  /* ── proof-list (Assets tile only now) ── */
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
