<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import { X } from 'lucide-svelte';

  interface Props {
    targetUserId: string;
    targetName: string;
    submitterGender: 'man' | 'woman' | 'prefer_not_to_say';
    onClose: () => void;
  }

  let { targetUserId, targetName, submitterGender, onClose }: Props = $props();

  const TAGS_FOR_VIEWER: Record<string, string[]> = {
    woman: ['Handsome', 'Not my type', 'Successful vibes', 'Trustworthy', 'Charming', 'Red flag energy', 'Great photos', 'Improve photos', 'Well-spoken', 'Mysterious'],
    man:   ['Stunning', 'Elegant', 'Intimidating', 'Approachable', 'Warm', 'Guarded', 'Great photos', 'Improve photos', 'Interesting vibe', 'Authentic'],
    prefer_not_to_say: ['Great photos', 'Improve photos', 'Trustworthy', 'Approachable', 'Interesting vibe', 'Warm', 'Mysterious', 'Charming'],
  };

  const tags = $derived(TAGS_FOR_VIEWER[submitterGender] ?? TAGS_FOR_VIEWER.prefer_not_to_say);

  let selectedTags = $state<Set<string>>(new Set());
  let tipText = $state('');
  let submitting = $state(false);
  let submitted = $state(false);

  function toggleTag(tag: string) {
    const next = new Set(selectedTags);
    if (next.has(tag)) next.delete(tag);
    else next.add(tag);
    selectedTags = next;
  }

  async function submit() {
    if (selectedTags.size === 0 && !tipText.trim()) return;
    submitting = true;
    try {
      await fetch('/api/verified-vibe/tips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId,
          submitterGender,
          tags: [...selectedTags].map(t => t.toLowerCase().replace(/\s+/g, '-')),
          text: tipText.trim() || undefined,
        }),
      });
      submitted = true;
      setTimeout(onClose, 1400);
    } finally {
      submitting = false;
    }
  }

  $effect(() => {
    if (targetUserId) {
      const scroller = document.querySelector('.verified-vibe-content') as HTMLElement | null;
      if (scroller) scroller.style.overflow = 'hidden';
      return () => { if (scroller) scroller.style.overflow = ''; };
    }
  });
</script>

<!-- Backdrop -->
<div
  class="backdrop"
  onclick={onClose}
  aria-hidden="true"
  transition:fade={{ duration: 180 }}
></div>

<!-- Sheet -->
<div
  class="sheet-positioner"
  role="dialog"
  aria-modal="true"
  aria-label="Leave an anonymous tip"
  transition:fly={{ y: 400, duration: 320, easing: (t) => 1 - Math.pow(1 - t, 3) }}
>
  <div class="sheet" onclick={(e) => e.stopPropagation()}>
    <div class="handle"></div>

    {#if submitted}
      <div class="success-state">
        <div class="success-icon">✓</div>
        <p class="success-text">Tip sent anonymously</p>
      </div>
    {:else}
      <div class="sheet-header">
        <div>
          <p class="eyebrow">ANONYMOUS TIP</p>
          <p class="header-title">What do you think of {targetName}?</p>
        </div>
        <button class="close-btn" onclick={onClose} aria-label="Close"><X size={16} /></button>
      </div>

      <div class="sheet-body">
        <p class="anon-note">
          🔒 Your identity will never be shared. {targetName} won't see this — it only helps our AI guide them.
        </p>

        <div class="tag-grid">
          {#each tags as tag}
            {@const sel = selectedTags.has(tag)}
            <button
              type="button"
              class="tag {sel ? 'selected' : ''}"
              onclick={() => toggleTag(tag)}
            >{tag}</button>
          {/each}
        </div>

        <div class="text-field">
          <textarea
            class="tip-input"
            placeholder="Anything else? (optional)"
            rows="2"
            maxlength="280"
            bind:value={tipText}
          ></textarea>
          <span class="char-count">{tipText.length}/280</span>
        </div>
      </div>

      <div class="sheet-footer">
        <button
          class="submit-btn"
          onclick={submit}
          disabled={submitting || (selectedTags.size === 0 && !tipText.trim())}
        >
          {submitting ? 'Sending…' : 'Send anonymous tip'}
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    z-index: 50;
  }

  .sheet-positioner {
    position: fixed;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 100%;
    max-width: 430px;
    z-index: 51;
  }

  .sheet {
    background: var(--bg-1);
    border-radius: 20px 20px 0 0;
    max-height: 80vh;
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
    align-items: flex-start;
    justify-content: space-between;
    padding: 14px 20px 10px;
    flex-shrink: 0;
  }

  .eyebrow {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: var(--text-3);
    margin: 0 0 4px;
  }

  .header-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-1);
    margin: 0;
  }

  .close-btn {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    display: grid;
    place-items: center;
    cursor: pointer;
    color: var(--text-2);
    flex-shrink: 0;
  }

  .sheet-body {
    flex: 1;
    overflow-y: auto;
    padding: 4px 20px 12px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .anon-note {
    font-size: 12px;
    color: var(--text-3);
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    border-radius: 10px;
    padding: 10px 12px;
    margin: 0;
    line-height: 1.5;
  }

  .tag-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .tag {
    padding: 7px 14px;
    border-radius: 999px;
    border: 1px solid var(--border-2);
    background: var(--bg-2);
    color: var(--text-2);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
    transition: all 130ms ease;
  }

  .tag.selected {
    background: var(--accent-tint);
    border-color: var(--accent-bright);
    color: var(--accent-bright);
  }

  .text-field {
    position: relative;
  }

  .tip-input {
    width: 100%;
    box-sizing: border-box;
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    border-radius: 10px;
    padding: 10px 12px 24px;
    font-size: 14px;
    color: var(--text-1);
    font-family: inherit;
    resize: none;
    line-height: 1.5;
  }

  .tip-input:focus {
    outline: none;
    border-color: var(--accent-bright);
  }

  .char-count {
    position: absolute;
    bottom: 8px;
    right: 10px;
    font-size: 10px;
    color: var(--text-4);
  }

  .sheet-footer {
    padding: 10px 20px calc(20px + env(safe-area-inset-bottom, 0));
    border-top: 1px solid var(--border-1);
    flex-shrink: 0;
  }

  .submit-btn {
    width: 100%;
    min-height: 48px;
    padding: 12px 16px;
    background: var(--accent-bright);
    color: #06281e;
    border: none;
    border-radius: 12px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: opacity 150ms;
  }

  .submit-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* Success state */
  .success-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 40px 20px calc(40px + env(safe-area-inset-bottom, 0));
  }

  .success-icon {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: var(--accent-tint);
    border: 2px solid var(--accent-bright);
    color: var(--accent-bright);
    font-size: 22px;
    font-weight: 700;
    display: grid;
    place-items: center;
  }

  .success-text {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-1);
    margin: 0;
  }
</style>
