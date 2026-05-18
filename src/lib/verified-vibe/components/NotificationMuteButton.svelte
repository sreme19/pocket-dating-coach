<script lang="ts">
  import { onMount } from 'svelte';
  import { getConversationMutingStatus, toggleConversationMuting } from '../services/notificationService';

  interface Props {
    conversationId: string;
    onMuteChange?: (isMuted: boolean) => void;
  }

  let { conversationId, onMuteChange }: Props = $props();

  let isMuted = $state(false);
  let isLoading = $state(false);

  onMount(() => {
    isMuted = getConversationMutingStatus(conversationId);
  });

  async function handleToggleMute() {
    try {
      isLoading = true;
      const newMutedStatus = toggleConversationMuting(conversationId);
      isMuted = newMutedStatus;
      onMuteChange?.(newMutedStatus);
    } catch (error) {
      console.error('Error toggling notification mute:', error);
    } finally {
      isLoading = false;
    }
  }
</script>

<button
  class="mute-button"
  class:muted={isMuted}
  onclick={handleToggleMute}
  disabled={isLoading}
  aria-label={isMuted ? 'Unmute notifications' : 'Mute notifications'}
  title={isMuted ? 'Notifications muted' : 'Mute notifications'}
>
  {#if isMuted}
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M11 5L6 9H2v6h4l5 5v-16z" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  {:else}
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  {/if}
</button>

<style>
  .mute-button {
    width: 40px;
    height: 40px;
    border-radius: 8px;
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    display: grid;
    place-items: center;
    cursor: pointer;
    color: var(--text-1);
    transition: all 200ms ease;
    flex-shrink: 0;
  }

  .mute-button:hover:not(:disabled) {
    background: var(--bg-3);
    border-color: var(--border-2);
  }

  .mute-button:active:not(:disabled) {
    transform: scale(0.95);
  }

  .mute-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .mute-button.muted {
    background: var(--accent-tint);
    border-color: var(--accent);
    color: var(--accent);
  }

  .mute-button.muted:hover:not(:disabled) {
    background: var(--accent);
    color: #06281e;
  }

  @media (max-width: 767px) {
    .mute-button {
      width: 36px;
      height: 36px;
    }

    .mute-button svg {
      width: 18px;
      height: 18px;
    }
  }
</style>
