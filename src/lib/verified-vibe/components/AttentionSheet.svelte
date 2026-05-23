<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import { X } from 'lucide-svelte';

  interface Props {
    senderId: string;
    recipientId: string;
    recipientName: string;
    messageType: 'secret_admirer' | 'craving_attention';
    onClose: () => void;
    onSent: () => void;
  }

  let { senderId, recipientId, recipientName, messageType, onClose, onSent }: Props = $props();

  const isSecretAdmirer = $derived(messageType === 'secret_admirer');

  const EYEBROW  = $derived(isSecretAdmirer ? 'SECRET ADMIRER'    : 'CRAVING ATTENTION');
  const EMOJI    = $derived(isSecretAdmirer ? '🌹'                 : '👀');
  const TITLE    = $derived(isSecretAdmirer
    ? `Your message to ${recipientName}`
    : `Get ${recipientName}'s attention`);
  const HINT     = $derived(isSecretAdmirer
    ? `${recipientName} will see this in their Secret Admirers inbox.`
    : `${recipientName} will see this in their Craving Attention inbox.`);
  const SUBMIT_LABEL = $derived(isSecretAdmirer ? 'Send secret admirer 🌹' : 'Send message 👀');

  type Tone = 'flirty' | 'professional' | 'practical' | 'bold';

  const TONES: { id: Tone; label: string; emoji: string }[] = [
    { id: 'flirty',       label: 'Flirty',       emoji: '💋' },
    { id: 'professional', label: 'Professional',  emoji: '💼' },
    { id: 'practical',    label: 'Practical',     emoji: '🎯' },
    { id: 'bold',         label: 'Bold',          emoji: '🔥' },
  ];

  let content       = $state('');
  let selectedTone  = $state<Tone>('flirty');
  let isAutoGenning = $state(false);
  let isSubmitting  = $state(false);
  let submitted     = $state(false);
  let errorMsg      = $state('');

  const remaining = $derived(500 - content.length);
  const canSubmit  = $derived(content.trim().length > 0 && content.length <= 500);

  async function autoGen() {
    isAutoGenning = true;
    errorMsg = '';
    try {
      const res = await fetch('/api/verified-vibe/attention/auto-gen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senderId, recipientId, messageType, tone: selectedTone }),
      });
      const data = await res.json();
      if (res.ok) {
        content = data.text;
      } else {
        errorMsg = data.error ?? 'Auto-gen failed';
      }
    } catch {
      errorMsg = 'Could not generate message — try writing your own.';
    } finally {
      isAutoGenning = false;
    }
  }

  async function submit() {
    if (!canSubmit || isSubmitting) return;
    isSubmitting = true;
    errorMsg = '';
    try {
      const res = await fetch('/api/verified-vibe/attention', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senderId, recipientId, messageType, content: content.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        submitted = true;
        setTimeout(onSent, 1400);
      } else if (res.status === 409) {
        errorMsg = `You've already sent a message to ${recipientName}.`;
      } else {
        errorMsg = data.error ?? 'Failed to send — please try again.';
      }
    } catch {
      errorMsg = 'Network error — please try again.';
    } finally {
      isSubmitting = false;
    }
  }

  $effect(() => {
    if (recipientId) {
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
  aria-label={TITLE}
  transition:fly={{ y: 400, duration: 320, easing: (t) => 1 - Math.pow(1 - t, 3) }}
>
  <div class="sheet" onclick={(e) => e.stopPropagation()}>
    <div class="handle"></div>

    {#if submitted}
      <div class="success-state">
        <div class="success-icon">{EMOJI}</div>
        <p class="success-title">Message sent!</p>
        <p class="success-sub">{recipientName} will see it in their inbox.</p>
      </div>
    {:else}
      <div class="sheet-header">
        <div>
          <p class="eyebrow">{EYEBROW}</p>
          <p class="header-title">{TITLE}</p>
        </div>
        <button class="close-btn" onclick={onClose} aria-label="Close"><X size={16} /></button>
      </div>

      <div class="sheet-body">
        <p class="hint-note">{HINT}</p>

        <div class="textarea-wrap">
          <textarea
            class="msg-input"
            placeholder="Write something that stands out…"
            rows="4"
            maxlength="500"
            bind:value={content}
          ></textarea>
          <span class="char-count" class:near-limit={remaining < 60}>{remaining}</span>
        </div>

        <div class="tone-row">
          {#each TONES as t}
            <button
              class="tone-chip"
              class:tone-selected={selectedTone === t.id}
              onclick={() => selectedTone = t.id}
              type="button"
            >{t.emoji} {t.label}</button>
          {/each}
        </div>

        <button
          class="autogen-btn"
          onclick={autoGen}
          disabled={isAutoGenning}
        >
          {#if isAutoGenning}
            <span class="spin">⏳</span> Generating…
          {:else}
            ✨ Auto Gen
          {/if}
        </button>

        {#if errorMsg}
          <p class="error-msg">{errorMsg}</p>
        {/if}
      </div>

      <div class="sheet-footer">
        <button
          class="submit-btn"
          onclick={submit}
          disabled={!canSubmit || isSubmitting}
        >
          {isSubmitting ? 'Sending…' : SUBMIT_LABEL}
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
    max-height: 85vh;
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
    color: var(--accent-bright);
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
    gap: 12px;
  }

  .hint-note {
    font-size: 12px;
    color: var(--text-3);
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    border-radius: 10px;
    padding: 10px 12px;
    margin: 0;
    line-height: 1.5;
  }

  .textarea-wrap {
    position: relative;
  }

  .msg-input {
    width: 100%;
    box-sizing: border-box;
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    border-radius: 12px;
    padding: 12px 12px 28px;
    font-size: 14px;
    color: var(--text-1);
    font-family: inherit;
    resize: none;
    line-height: 1.6;
    transition: border-color 150ms;
  }

  .msg-input:focus {
    outline: none;
    border-color: var(--accent-bright);
  }

  .char-count {
    position: absolute;
    bottom: 8px;
    right: 10px;
    font-size: 10px;
    color: var(--text-4);
    transition: color 150ms;
  }

  .char-count.near-limit {
    color: #f59e0b;
  }

  .tone-row {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .tone-chip {
    padding: 6px 12px;
    border-radius: 999px;
    border: 1px solid var(--border-2);
    background: var(--bg-2);
    color: var(--text-2);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
    transition: all 130ms;
    white-space: nowrap;
  }

  .tone-chip:hover {
    border-color: var(--accent-bright);
    color: var(--accent-bright);
  }

  .tone-selected {
    border-color: var(--accent-bright);
    background: var(--accent-tint);
    color: var(--accent-bright);
    font-weight: 700;
  }

  .autogen-btn {
    align-self: flex-start;
    padding: 8px 16px;
    border-radius: 999px;
    border: 1px solid var(--accent-bright);
    background: var(--accent-tint);
    color: var(--accent-bright);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: opacity 150ms;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .autogen-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .spin {
    animation: spin 1s linear infinite;
    display: inline-block;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .error-msg {
    font-size: 12px;
    color: #f87171;
    margin: 0;
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

  .success-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 40px 20px calc(40px + env(safe-area-inset-bottom, 0));
    text-align: center;
  }

  .success-icon {
    font-size: 48px;
    line-height: 1;
  }

  .success-title {
    font-size: 18px;
    font-weight: 700;
    color: var(--text-1);
    margin: 4px 0 0;
  }

  .success-sub {
    font-size: 13px;
    color: var(--text-3);
    margin: 0;
  }
</style>
