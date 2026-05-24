<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import { X } from 'lucide-svelte';
  import type { ArchetypeDefinition } from '../types';

  interface Props {
    archetype: ArchetypeDefinition | null;
    onClose: () => void;
    onLockIn: () => void;
  }

  let { archetype, onClose, onLockIn }: Props = $props();

  // Lock scroll on the app scroll container when modal is open
  $effect(() => {
    if (archetype) {
      const scroller = document.querySelector('.verified-vibe-content') as HTMLElement | null;
      if (scroller) scroller.style.overflow = 'hidden';
      return () => {
        if (scroller) scroller.style.overflow = '';
      };
    }
  });
</script>

{#if archetype}
  <!-- Full-viewport backdrop -->
  <div
    class="backdrop"
    onclick={onClose}
    aria-hidden="true"
    transition:fade={{ duration: 200 }}
  ></div>

  <!-- Sheet constrained to the 430px app column -->
  <div
    class="sheet-positioner"
    role="dialog"
    aria-modal="true"
    aria-label="{archetype.name} details"
    transition:fly={{ y: 500, duration: 360, easing: (t) => 1 - Math.pow(1 - t, 3) }}
  >
    <div
      class="sheet"
      onclick={(e) => e.stopPropagation()}
    >
      <div class="handle"></div>

      <div class="sheet-header">
        <div class="identity">
          <div class="emoji-box">{archetype.emoji}</div>
          <div>
            <div class="you-are">YOU'RE A</div>
            <div class="arch-name">{archetype.name}.</div>
          </div>
        </div>
        <button class="close-btn" onclick={onClose} aria-label="Close">
          <X size={18} />
        </button>
      </div>

      <div class="sheet-body">
        <p class="description">{archetype.longTag}</p>

        <section class="chip-section">
          <h4 class="section-label">💚 YOU'LL MATCH WITH</h4>
          {#if archetype.matchTraits.some(t => t.tier === 'best')}
            <p class="tier-label">Best match</p>
            <div class="chips">
              {#each archetype.matchTraits.filter(t => t.tier === 'best') as trait}
                <div class="chip chip-lead">
                  <span class="chip-prefix">💎</span>
                  {trait.label}
                </div>
              {/each}
            </div>
            {#if archetype.matchTraits.some(t => t.tier === 'good')}
              <p class="tier-label tier-label-good">Good fit</p>
              <div class="chips">
                {#each archetype.matchTraits.filter(t => t.tier === 'good') as trait}
                  <div class="chip chip-match">
                    <span class="chip-check">✓</span>
                    {trait.label}
                  </div>
                {/each}
              </div>
            {/if}
          {:else}
            <div class="chips">
              {#each archetype.matchTraits as trait}
                <div class="chip" class:chip-lead={trait.lead} class:chip-match={!trait.lead}>
                  {#if trait.lead}<span class="chip-prefix">💎</span>{:else}<span class="chip-check">✓</span>{/if}
                  {trait.label}
                </div>
              {/each}
            </div>
          {/if}
        </section>

        <section class="chip-section">
          <h4 class="section-label avoid-label">✕ YOU WON'T SEE</h4>
          <div class="chips">
            {#each archetype.avoidTraits as trait}
              <div class="chip chip-avoid">
                <span class="chip-x">✕</span>
                <s>{trait.label}</s>
              </div>
            {/each}
          </div>
        </section>

        <section class="chip-section">
          <h4 class="section-label">✨ WHAT YOU BRING TO THE TABLE</h4>
          <div class="chips">
            {#each archetype.brings as item}
              <div class="chip chip-bring">
                <span class="chip-check">✓</span>
                {item}
              </div>
            {/each}
          </div>
        </section>
      </div>

      <div class="sheet-footer">
        <button class="lock-btn" onclick={onLockIn}>
          I'm a {archetype.name} {(archetype.gender ?? (archetype.id?.includes('_man') ? 'man' : 'woman')) === 'man' ? 'Man' : 'Woman'} — Let's go →
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Full-viewport dimmed backdrop */
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.65);
    z-index: 50;
  }

  /* Sheet pinned to bottom, width-capped to match the app column */
  .sheet-positioner {
    position: fixed;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 100%;
    max-width: 430px;
    z-index: 51;
    display: flex;
    flex-direction: column;
  }

  .sheet {
    width: 100%;
    max-height: 88vh;
    background: var(--bg-1);
    border-radius: 20px 20px 0 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .handle {
    width: 40px;
    height: 4px;
    background: var(--border-2);
    border-radius: 2px;
    margin: 12px auto 0;
    flex-shrink: 0;
  }

  .sheet-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px 12px;
    flex-shrink: 0;
  }

  .identity {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .emoji-box {
    width: 54px;
    height: 54px;
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    border-radius: 14px;
    display: grid;
    place-items: center;
    font-size: 26px;
    flex-shrink: 0;
  }

  .you-are {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: var(--text-3);
    text-transform: uppercase;
    margin-bottom: 3px;
  }

  .arch-name {
    font-family: var(--font-serif);
    font-style: italic;
    font-size: 26px;
    line-height: 1;
    color: var(--text-1);
    letter-spacing: -0.01em;
  }

  .close-btn {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    display: grid;
    place-items: center;
    cursor: pointer;
    color: var(--text-2);
    flex-shrink: 0;
    transition: background 200ms;
  }

  .close-btn:active { background: var(--bg-3); }

  .sheet-body {
    flex: 1;
    overflow-y: auto;
    padding: 4px 20px 16px;
    display: flex;
    flex-direction: column;
    gap: 22px;
    -webkit-overflow-scrolling: touch;
  }

  .description {
    font-style: italic;
    font-size: 14px;
    color: var(--text-2);
    margin: 0;
    line-height: 1.5;
  }

  .chip-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .section-label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-2);
    margin: 0;
  }

  .avoid-label { color: var(--text-3); }

  .tier-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--accent-bright);
    margin: 0 0 6px;
  }

  .tier-label-good {
    color: var(--text-3);
    margin-top: 10px;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 13px;
    font-weight: 500;
    line-height: 1;
  }

  .chip-lead {
    background: var(--accent-tint);
    border: 1px solid var(--accent);
    color: var(--accent-bright);
    font-weight: 600;
  }

  .chip-match {
    background: var(--bg-2);
    border: 1px solid var(--border-2);
    color: var(--text-1);
  }

  .chip-avoid {
    background: rgba(239, 68, 68, 0.06);
    border: 1px solid rgba(239, 68, 68, 0.15);
    color: var(--text-3);
  }

  .chip-bring {
    background: var(--bg-2);
    border: 1px solid var(--border-2);
    color: var(--text-1);
  }

  .chip-prefix { font-size: 12px; }

  .chip-check {
    font-size: 11px;
    color: var(--accent-bright);
    font-weight: 700;
  }

  .chip-x {
    font-size: 10px;
    color: #ef4444;
  }

  .sheet-footer {
    padding: 12px 20px calc(20px + env(safe-area-inset-bottom, 0));
    border-top: 1px solid var(--border-1);
    flex-shrink: 0;
  }

  .lock-btn {
    width: 100%;
    min-height: 52px;
    padding: 14px 16px;
    background: var(--accent-bright);
    color: #06281e;
    border: none;
    border-radius: 14px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: opacity 200ms, transform 200ms;
  }

  .lock-btn:active {
    opacity: 0.85;
    transform: scale(0.98);
  }
</style>
