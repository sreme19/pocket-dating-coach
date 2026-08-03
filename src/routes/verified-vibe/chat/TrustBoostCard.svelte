<!--
  Trust & Boost — the card pinned above both advisor threads.

  This is the point of the advisor surface. The median member has completed ZERO
  optional proof categories, and appeal to the other side has a median of 15/100.
  Generic "upload more proofs" nudging has not moved that, so the card leads with
  ONE named action and the real number attached to it.

  Two rules govern the copy here:

  1. Every number rendered comes off the wire. `deltaPS`, `appealGains[].delta`,
     `done`/`total` and `pointsToNextBand` are ABSOLUTE — Profile Strength uses fixed
     population weights and appeal depends only on one evaluator's own preferences —
     so they can be stated plainly with no hedging. Nothing else is invented.

  2. Money categories are never presented as a draw. The endpoint already excludes
     them from `actions`, but this card also renders the FULL category list, so the
     financial chips carry verification language only ("confirms you're real") and
     can never show an appeal or standing gain. App Store guideline 1.1.4, not a
     styling preference.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { PROOF_CATEGORIES, isMoneyProofCategory } from '$lib/verified-vibe/proof-categories';
  import type { AdvisorPortfolio, PortfolioAction } from '$lib/client/advisor-thread';

  interface Props {
    portfolio: AdvisorPortfolio;
  }
  let { portfolio }: Props = $props();

  /** Collapsed state survives navigation — a pinned card he's dismissed shouldn't
   *  reopen itself every time he comes back to the thread. */
  const OPEN_KEY = 'vv_trust_boost_card_open';
  let open = $state(true);

  onMount(() => {
    try {
      if (localStorage.getItem(OPEN_KEY) === '0') open = false;
    } catch { /* private mode — just stay open */ }
  });

  function toggle() {
    open = !open;
    try { localStorage.setItem(OPEN_KEY, open ? '1' : '0'); } catch { /* ignore */ }
  }

  /** Server order is already priority order, so the head of the list is the ask. */
  let top = $derived<PortfolioAction | null>(portfolio.actions[0] ?? null);

  let doneSet = $derived(new Set(portfolio.completed.map(c => c.replace(/^proof_/, ''))));

  let pct = $derived(
    Math.max(0, Math.min(100, Math.round((portfolio.done / portfolio.total) * 100)))
  );

  /** One decimal at most, and never a bare `.0` — "+5" reads better than "+5.0". */
  function num(n: number): string {
    const r = Math.round(n * 10) / 10;
    return Number.isInteger(r) ? String(r) : r.toFixed(1);
  }

  /**
   * The upload screen this category actually opens. `travel` gained a config there
   * as part of this work; anything the screen doesn't know falls back to its own
   * default rather than deep-linking to a blank.
   */
  function href(id: string): string {
    return `/verified-vibe/proof-upload?category=${encodeURIComponent(id)}`;
  }
</script>

<section class="tb-card" aria-label="Trust and Boost portfolio">
  <button class="tb-head" onclick={toggle} aria-expanded={open}>
    <span class="tb-title">🛡️ Trust &amp; Boost</span>
    <span class="tb-count">{portfolio.done} of {portfolio.total} proofs</span>
    <span class="tb-toggle" aria-hidden="true">{open ? '▾' : '▸'}</span>
  </button>

  <div
    class="tb-meter"
    role="progressbar"
    aria-label="Proof portfolio completion"
    aria-valuenow={portfolio.done}
    aria-valuemin="0"
    aria-valuemax={portfolio.total}
  >
    <div class="tb-meter-fill" style="width: {pct}%"></div>
  </div>

  {#if open}
    <div class="tb-body">
      {#if portfolio.profileStrength !== null && portfolio.band}
        <div class="tb-strength">
          <span class="tb-ps">Profile Strength {num(portfolio.profileStrength)}</span>
          <span class="tb-band">{portfolio.band}</span>
          {#if portfolio.nextBand && portfolio.pointsToNextBand !== null}
            <span class="tb-to-next">
              {num(portfolio.pointsToNextBand)} to {portfolio.nextBand}
            </span>
          {/if}
        </div>
      {/if}

      {#if top}
        <div class="tb-next">
          <div class="tb-next-label">Biggest next win</div>
          <div class="tb-next-ask">
            Add your {top.askPhrase || top.label.toLowerCase()}
          </div>

          <ul class="tb-gains">
            <li>
              <strong>+{num(top.deltaPS)}</strong> Profile Strength
              {#if top.crossesBand && top.bandAfter}
                <span class="tb-crosses">— reaches {top.bandAfter}</span>
              {/if}
            </li>
            <!-- Named, absolute, and hers alone: no hedging needed. -->
            {#each top.appealGains as gain (gain.name)}
              <li>Lifts you with <strong>{gain.name}</strong> +{num(gain.delta)}</li>
            {/each}
          </ul>

          <a class="tb-cta" href={href(top.id)}>Add {top.label} →</a>
        </div>
      {/if}

      <div class="tb-chips">
        {#each PROOF_CATEGORIES as cat (cat.id)}
          {@const isDone = doneSet.has(cat.id)}
          {@const isTop = top?.id === cat.id}
          {@const isMoney = isMoneyProofCategory(cat.id)}
          <a
            class="tb-chip"
            class:tb-chip--done={isDone}
            class:tb-chip--top={isTop && !isDone}
            href={href(cat.id)}
            title={isMoney
              ? `${cat.label} — confirms you're real`
              : isDone ? `${cat.label} — done` : `Add ${cat.label}`}
          >
            <span class="tb-chip-mark" aria-hidden="true">{isDone ? '✓' : '+'}</span>
            <span class="tb-chip-label">{cat.label}</span>
          </a>
        {/each}
      </div>

      <!-- Says what the money categories are FOR, in one line, so nothing on this
           card can be read as "pay to be more attractive". -->
      <p class="tb-foot">Financial proofs confirm you're real. They never buy attention.</p>
    </div>
  {/if}
</section>

<style>
  /* Same white-card-with-a-left-stripe shape as the task cards and "Where you
     stand", so a pinned card reads as part of the advisor surface rather than a
     new kind of object. Amber #EF9F27 for the open ask, emerald #10B981 for what's
     already banked — the pairing the task cards established. #DC2626 stays
     reserved for the unread badge and is deliberately absent. */
  /* Margin-only sizing, exactly like .stand-panel: the screen is a column flex
     container, so stretch gives the right width and nothing can overflow sideways. */
  .tb-card {
    flex-shrink: 0;
    box-sizing: border-box;
    margin: 8px 16px 0;
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    border-left: 3px solid #EF9F27;
    border-radius: 12px;
    overflow: hidden;
    min-width: 0;
  }

  .tb-head {
    width: 100%;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px 8px;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--text-1);
    font-family: inherit;
    text-align: left;
  }
  .tb-title {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.02em;
    min-width: 0;
  }
  .tb-count {
    margin-left: auto;
    font-size: 11px;
    font-weight: 700;
    color: #B45309;
    background: rgba(239, 159, 39, 0.14);
    padding: 2px 8px;
    border-radius: 999px;
    white-space: nowrap;
  }
  .tb-toggle { font-size: 12px; color: var(--text-3); }

  /* Meter stays visible when collapsed — the one number worth glancing at. */
  .tb-meter {
    height: 5px;
    margin: 0 14px 10px;
    background: var(--bg-3, var(--bg-1));
    border-radius: 999px;
    overflow: hidden;
  }
  .tb-meter-fill {
    height: 100%;
    background: #10B981;
    border-radius: 999px;
    transition: width 320ms ease;
  }
  @media (prefers-reduced-motion: reduce) {
    .tb-meter-fill { transition: none; }
  }

  .tb-body {
    padding: 0 14px 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
  }

  /* ── Profile Strength line ── */
  .tb-strength {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 6px 10px;
    min-width: 0;
  }
  .tb-ps { font-size: 12px; font-weight: 700; color: var(--text-1); }
  .tb-band {
    font-size: 11px;
    font-weight: 700;
    color: var(--accent-bright);
    background: var(--accent-tint);
    padding: 2px 8px;
    border-radius: 999px;
  }
  .tb-to-next { font-size: 11px; color: var(--text-3); }

  /* ── The single ask ── */
  .tb-next {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    padding: 10px 12px;
    background: var(--bg-1);
    border: 1px solid var(--border-1);
    border-radius: 10px;
    min-width: 0;
  }
  .tb-next-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #B45309;
  }
  .tb-next-ask {
    font-size: 13.5px;
    font-weight: 600;
    line-height: 1.45;
    color: var(--text-1);
    overflow-wrap: anywhere;
  }

  .tb-gains {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .tb-gains li {
    font-size: 12.5px;
    line-height: 1.5;
    color: var(--text-2);
    overflow-wrap: anywhere;
  }
  .tb-gains strong { color: #047857; font-weight: 700; }
  .tb-crosses { color: var(--text-3); }

  .tb-cta {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 2px;
    padding: 7px 14px;
    border-radius: 20px;
    background: var(--accent-bright);
    color: #fff;
    font-size: 13px;
    font-weight: 600;
    text-decoration: none;
    max-width: 100%;
    transition: opacity 150ms;
  }
  .tb-cta:hover { opacity: 0.88; }

  /* ── Category chips ── */
  .tb-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    min-width: 0;
  }
  .tb-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    max-width: 100%;
    padding: 3px 9px;
    border-radius: 999px;
    border: 1px solid var(--border-1);
    background: var(--bg-1);
    color: var(--text-3);
    font-size: 11.5px;
    line-height: 1.5;
    text-decoration: none;
    transition: border-color 130ms, color 130ms;
  }
  .tb-chip:hover { border-color: var(--accent-bright); color: var(--accent-bright); }
  .tb-chip-label { min-width: 0; overflow-wrap: anywhere; }
  .tb-chip-mark { flex-shrink: 0; font-size: 10px; }

  .tb-chip--done {
    border-color: rgba(16, 185, 129, 0.4);
    background: rgba(16, 185, 129, 0.08);
    color: #047857;
    font-weight: 600;
  }
  .tb-chip--done:hover { border-color: rgba(16, 185, 129, 0.7); color: #047857; }

  .tb-chip--top {
    border-color: #EF9F27;
    background: rgba(239, 159, 39, 0.12);
    color: #B45309;
    font-weight: 700;
  }
  .tb-chip--top:hover { border-color: #EF9F27; color: #B45309; }

  .tb-foot {
    margin: 0;
    font-size: 10.5px;
    line-height: 1.5;
    color: var(--text-3);
  }

  @media (max-width: 767px) {
    .tb-card { margin: 6px 12px 0; width: calc(100% - 24px); }
  }
</style>
