<script lang="ts">
  /**
   * TypingIndicator Component
   *
   * Displays an animated typing indicator when the other user is typing.
   * Shows three animated dots that bounce up and down.
   *
   * Props:
   * - isTyping: boolean - Whether the user is typing
   * - userName: string - Name of the user who is typing (optional)
   */

  interface Props {
    isTyping?: boolean;
    userName?: string;
  }

  let { isTyping = false, userName = 'User' }: Props = $props();
</script>

{#if isTyping}
  <div class="typing-indicator" transition:fade={{ duration: 200 }} role="status" aria-live="polite" aria-label="{userName} is typing">
    <div class="typing-text">
      <span class="typing-name">{userName}</span>
      <span class="typing-label">is typing</span>
    </div>
    <div class="typing-dots">
      <span class="dot"></span>
      <span class="dot"></span>
      <span class="dot"></span>
    </div>
  </div>
{/if}

<style>
  .typing-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    background: var(--bg-2);
    border-radius: 12px;
    margin: 8px 0;
    font-size: 13px;
    color: var(--text-3);
  }

  .typing-text {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .typing-name {
    font-weight: 600;
    color: var(--text-2);
  }

  .typing-label {
    color: var(--text-3);
  }

  .typing-dots {
    display: flex;
    align-items: center;
    gap: 3px;
  }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--text-3);
    animation: typing 1.4s infinite;
  }

  .dot:nth-child(2) {
    animation-delay: 0.2s;
  }

  .dot:nth-child(3) {
    animation-delay: 0.4s;
  }

  @keyframes typing {
    0%,
    60%,
    100% {
      transform: translateY(0);
      opacity: 0.7;
    }

    30% {
      transform: translateY(-8px);
      opacity: 1;
    }
  }

  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .dot {
      animation: none;
      opacity: 1;
    }
  }

  /* Mobile responsive */
  @media (max-width: 767px) {
    .typing-indicator {
      padding: 10px 12px;
      gap: 6px;
      font-size: 12px;
      margin: 6px 0;
    }

    .typing-dots {
      gap: 2px;
    }

    .dot {
      width: 5px;
      height: 5px;
    }
  }
</style>

<script lang="ts">
  import { fade } from 'svelte/transition';
</script>
