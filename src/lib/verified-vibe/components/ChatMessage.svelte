<script lang="ts">
  import { fade, slide } from 'svelte/transition';
  import { Check, CheckCheck, Heart, Shield, BookOpen, ChevronDown } from 'lucide-svelte';
  import type { Message } from '../types';

  /**
   * ChatMessage Component
   *
   * Displays a single message in the chat interface. Shows sender/receiver distinction
   * with left/right alignment, message text, timestamp, and optional read status indicator.
   * Supports AI assistant messages (Bestie, Wingman, Coach) with distinct visual indicators,
   * badges, and citations. Includes smooth animations and is fully accessible (WCAG 2.1 AA).
   *
   * Features:
   * - Sender/receiver distinction with left/right alignment
   * - AI assistant type detection (Bestie, Wingman, Coach)
   * - Distinct visual indicators and badges for each assistant type
   * - Different styling for Bestie (pink) vs Wingman (blue)
   * - Message text content with word wrapping
   * - Timestamp display (relative or absolute)
   * - Read status indicator (optional)
   * - Citations display (inline or expandable)
   * - Smooth animations and transitions
   * - WCAG 2.1 AA accessibility compliance
   * - Mobile responsive (375px-1024px)
   * - Keyboard navigation support
   * - Dark mode support
   *
   * @component
   * @example
   * ```svelte
   * <ChatMessage
   *   message={message}
   *   isCurrentUser={true}
   *   showTimestamp={true}
   *   showReadStatus={true}
   * />
   * ```
   */

  interface Props {
    /** The message to display */
    message: Message;
    /** Whether this message is from the current user */
    isCurrentUser: boolean;
    /** Whether to show the timestamp */
    showTimestamp?: boolean;
    /** Whether to show the read status indicator */
    showReadStatus?: boolean;
    /** Whether the message has been read */
    isRead?: boolean;
  }

  let {
    message,
    isCurrentUser,
    showTimestamp = true,
    showReadStatus = false,
    isRead = false
  }: Props = $props();

  // State for expandable citations
  let showCitations = $state(false);

  // Derived values
  let formattedTime = $derived(formatTime(message.createdAt));
  let messageAlignment = $derived(isCurrentUser ? 'flex-end' : 'flex-start');
  let isAIMessage = $derived(!!message.assistantType && !isCurrentUser);
  let messageBubbleClass = $derived(
    isAIMessage
      ? `message-bubble-ai message-bubble-${message.assistantType}`
      : isCurrentUser
        ? 'message-bubble-sent'
        : 'message-bubble-received'
  );
  let assistantLabel = $derived(
    message.assistantType === 'bestie'
      ? 'AI Bestie'
      : message.assistantType === 'wingman'
        ? 'AI Wingman'
        : message.assistantType === 'coach'
          ? 'Ask Your Coach'
          : null
  );
  let assistantIcon = $derived(
    message.assistantType === 'bestie'
      ? 'heart'
      : message.assistantType === 'wingman'
        ? 'shield'
        : message.assistantType === 'coach'
          ? 'book'
          : null
  );
  let ariaLabel = $derived(
    `${isAIMessage ? assistantLabel : isCurrentUser ? 'You sent' : 'They sent'}: ${message.content}${showTimestamp ? ` at ${formattedTime}` : ''}`
  );

  /**
   * Format timestamp to relative time (e.g., "2m ago") or absolute time
   */
  function formatTime(date: Date): string {
    const now = new Date();
    const messageDate = new Date(date);
    const diffMs = now.getTime() - messageDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
      return 'now';
    } else if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      // Absolute time for older messages
      return messageDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  }

  /**
   * Handle keyboard navigation
   */
  function handleKeydown(e: KeyboardEvent) {
    // Allow focus on message for accessibility
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      // Could trigger actions like copy, react, etc.
    }
  }

  /**
   * Toggle citations visibility
   */
  function toggleCitations() {
    showCitations = !showCitations;
  }
</script>

<div
  class="message-container"
  class:sent={isCurrentUser}
  class:received={!isCurrentUser}
  class:ai-message={isAIMessage}
  transition:slide={{ duration: 300, axis: 'y' }}
>
  <!-- Message Bubble -->
  <div
    class="message-wrapper"
    style="justify-content: {messageAlignment}"
    role="article"
    aria-label={ariaLabel}
  >
    <!-- AI Assistant Badge (for AI messages) -->
    {#if isAIMessage}
      <div class="assistant-badge" class:bestie={message.assistantType === 'bestie'} class:wingman={message.assistantType === 'wingman'} class:coach={message.assistantType === 'coach'}>
        {#if assistantIcon === 'heart'}
          <Heart size={14} aria-hidden="true" />
        {:else if assistantIcon === 'shield'}
          <Shield size={14} aria-hidden="true" />
        {:else if assistantIcon === 'book'}
          <BookOpen size={14} aria-hidden="true" />
        {/if}
        <span class="badge-text">{assistantLabel}</span>
      </div>
    {/if}

    <div
      class="message-bubble {messageBubbleClass}"
      role="button"
      tabindex="0"
      onkeydown={handleKeydown}
    >
      <!-- Message Text -->
      <p class="message-text">
        {message.content}
      </p>

      <!-- Citations Section (for AI messages) -->
      {#if isAIMessage && message.citations && message.citations.length > 0}
        <div class="citations-section">
          {#if message.citations.length === 1}
            <!-- Single citation: show inline -->
            <p class="citation-inline">
              <em>{message.citations[0]}</em>
            </p>
          {:else}
            <!-- Multiple citations: show expandable -->
            <button
              class="citations-toggle"
              onclick={toggleCitations}
              aria-expanded={showCitations}
              aria-label={showCitations ? 'Hide citations' : 'Show citations'}
            >
              <ChevronDown size={14} class={showCitations ? 'rotated' : ''} aria-hidden="true" />
              <span>{message.citations.length} citation{message.citations.length !== 1 ? 's' : ''}</span>
            </button>
            {#if showCitations}
              <div class="citations-list" transition:slide={{ duration: 200 }}>
                {#each message.citations as citation}
                  <p class="citation-item">
                    <em>{citation}</em>
                  </p>
                {/each}
              </div>
            {/if}
          {/if}
        </div>
      {/if}

      <!-- Timestamp and Read Status -->
      <div class="message-footer">
        {#if showTimestamp}
          <span class="message-time" aria-label={`sent at ${formattedTime}`}>
            {formattedTime}
          </span>
        {/if}

        {#if showReadStatus && isCurrentUser}
          <span
            class="read-status"
            aria-label={isRead ? 'message read' : 'message sent'}
            title={isRead ? 'Read' : 'Sent'}
          >
            {#if isRead}
              <CheckCheck size={14} aria-hidden="true" />
            {:else}
              <Check size={14} aria-hidden="true" />
            {/if}
          </span>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .message-container {
    display: flex;
    width: 100%;
    padding: var(--spacing-sm) var(--spacing-lg);
    animation: messageSlideIn 0.3s ease-out;
  }

  @keyframes messageSlideIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .message-container {
      animation: none;
    }
  }

  .message-container.sent {
    justify-content: flex-end;
  }

  .message-container.received {
    justify-content: flex-start;
  }

  .message-container.ai-message {
    justify-content: flex-start;
  }

  /* Message Wrapper */
  .message-wrapper {
    display: flex;
    flex-direction: column;
    gap: var(--gap-xs);
    max-width: 85%;
    width: fit-content;
  }

  @media (min-width: 768px) {
    .message-wrapper {
      max-width: 60%;
    }
  }

  @media (min-width: 1024px) {
    .message-wrapper {
      max-width: 50%;
    }
  }

  /* Assistant Badge */
  .assistant-badge {
    display: flex;
    align-items: center;
    gap: var(--gap-xs);
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: var(--radius-md);
    font-size: var(--font-size-xs);
    font-weight: 600;
    width: fit-content;
    margin-bottom: var(--spacing-xs);
  }

  .assistant-badge.bestie {
    background: rgba(236, 72, 153, 0.1);
    color: #ec4899;
    border: 1px solid rgba(236, 72, 153, 0.3);
  }

  .assistant-badge.wingman {
    background: rgba(59, 130, 246, 0.1);
    color: #3b82f6;
    border: 1px solid rgba(59, 130, 246, 0.3);
  }

  .assistant-badge.coach {
    background: rgba(168, 85, 247, 0.1);
    color: #a855f7;
    border: 1px solid rgba(168, 85, 247, 0.3);
  }

  .badge-text {
    font-size: var(--font-size-xs);
  }

  /* Message Bubble */
  .message-bubble {
    display: flex;
    flex-direction: column;
    gap: var(--gap-xs);
    padding: var(--spacing-md) var(--spacing-lg);
    border-radius: var(--radius-lg);
    word-wrap: break-word;
    overflow-wrap: break-word;
    transition: all 200ms ease;
    will-change: background-color, box-shadow;
    outline: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .message-bubble {
      transition: none;
      will-change: auto;
    }
  }

  .message-bubble:focus-visible {
    outline: 2px solid var(--color-vibe-emerald);
    outline-offset: 2px;
  }

  /* Sent Message Bubble */
  .message-bubble-sent {
    background: var(--color-vibe-emerald);
    color: white;
    border-radius: var(--radius-lg) var(--radius-md) var(--radius-md) var(--radius-lg);
    box-shadow: var(--shadow-sm);
  }

  @media (hover: hover) {
    .message-bubble-sent:hover {
      box-shadow: var(--shadow-md);
      transform: translateY(-1px);
    }
  }

  /* Received Message Bubble */
  .message-bubble-received {
    background: var(--color-vibe-bg-2);
    color: var(--color-vibe-text-1);
    border: 1px solid var(--color-vibe-border);
    border-radius: var(--radius-md) var(--radius-lg) var(--radius-lg) var(--radius-md);
    box-shadow: var(--shadow-sm);
  }

  @media (hover: hover) {
    .message-bubble-received:hover {
      background: var(--color-vibe-bg-3);
      box-shadow: var(--shadow-md);
      transform: translateY(-1px);
    }
  }

  /* AI Message Bubbles */
  .message-bubble-ai {
    border-radius: var(--radius-md) var(--radius-lg) var(--radius-lg) var(--radius-md);
    box-shadow: var(--shadow-sm);
  }

  .message-bubble-bestie {
    background: rgba(236, 72, 153, 0.08);
    color: var(--color-vibe-text-1);
    border: 1px solid rgba(236, 72, 153, 0.3);
  }

  @media (hover: hover) {
    .message-bubble-bestie:hover {
      background: rgba(236, 72, 153, 0.12);
      box-shadow: var(--shadow-md);
      transform: translateY(-1px);
    }
  }

  .message-bubble-wingman {
    background: rgba(59, 130, 246, 0.08);
    color: var(--color-vibe-text-1);
    border: 1px solid rgba(59, 130, 246, 0.3);
  }

  @media (hover: hover) {
    .message-bubble-wingman:hover {
      background: rgba(59, 130, 246, 0.12);
      box-shadow: var(--shadow-md);
      transform: translateY(-1px);
    }
  }

  .message-bubble-coach {
    background: rgba(168, 85, 247, 0.08);
    color: var(--color-vibe-text-1);
    border: 1px solid rgba(168, 85, 247, 0.3);
  }

  @media (hover: hover) {
    .message-bubble-coach:hover {
      background: rgba(168, 85, 247, 0.12);
      box-shadow: var(--shadow-md);
      transform: translateY(-1px);
    }
  }

  /* Message Text */
  .message-text {
    margin: 0;
    font-size: var(--font-size-base);
    line-height: var(--line-height-relaxed);
    word-break: break-word;
    white-space: pre-wrap;
  }

  /* Citations Section */
  .citations-section {
    display: flex;
    flex-direction: column;
    gap: var(--gap-xs);
    margin-top: var(--spacing-sm);
    padding-top: var(--spacing-sm);
    border-top: 1px solid currentColor;
    opacity: 0.85;
  }

  .message-bubble-sent .citations-section {
    border-top-color: rgba(255, 255, 255, 0.3);
  }

  .message-bubble-received .citations-section {
    border-top-color: var(--color-vibe-border);
  }

  .message-bubble-ai .citations-section {
    border-top-color: currentColor;
    opacity: 0.8;
  }

  /* Citation Inline */
  .citation-inline {
    margin: 0;
    font-size: var(--font-size-xs);
    font-style: italic;
    line-height: var(--line-height-tight);
  }

  /* Citations Toggle Button */
  .citations-toggle {
    display: flex;
    align-items: center;
    gap: var(--gap-xs);
    padding: var(--spacing-xs) 0;
    background: none;
    border: none;
    color: inherit;
    font-size: var(--font-size-xs);
    font-weight: 500;
    cursor: pointer;
    transition: opacity 200ms ease;
  }

  .citations-toggle:hover {
    opacity: 0.8;
  }

  .citations-toggle:focus-visible {
    outline: 2px solid currentColor;
    outline-offset: 2px;
    border-radius: var(--radius-sm);
  }

  .citations-toggle :global(svg) {
    transition: transform 200ms ease;
  }

  .citations-toggle :global(svg.rotated) {
    transform: rotate(180deg);
  }

  /* Citations List */
  .citations-list {
    display: flex;
    flex-direction: column;
    gap: var(--gap-xs);
    padding: var(--spacing-sm) 0;
  }

  .citation-item {
    margin: 0;
    font-size: var(--font-size-xs);
    font-style: italic;
    line-height: var(--line-height-tight);
    padding-left: var(--spacing-sm);
    border-left: 2px solid currentColor;
    opacity: 0.9;
  }

  /* Message Footer */
  .message-footer {
    display: flex;
    align-items: center;
    gap: var(--gap-xs);
    margin-top: var(--spacing-xs);
  }

  /* Message Time */
  .message-time {
    font-size: var(--font-size-xs);
    opacity: 0.7;
    white-space: nowrap;
  }

  .message-bubble-sent .message-time {
    color: rgba(255, 255, 255, 0.8);
  }

  .message-bubble-received .message-time {
    color: var(--color-vibe-text-3);
  }

  .message-bubble-ai .message-time {
    color: var(--color-vibe-text-3);
  }

  /* Read Status */
  .read-status {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    color: rgba(255, 255, 255, 0.8);
    flex-shrink: 0;
  }

  /* Mobile Responsive */
  @media (max-width: 480px) {
    .message-container {
      padding: var(--spacing-xs) var(--spacing-md);
    }

    .message-wrapper {
      max-width: 90%;
    }

    .message-bubble {
      padding: var(--spacing-md) var(--spacing-md);
    }

    .message-text {
      font-size: var(--font-size-sm);
    }

    .message-time {
      font-size: var(--font-size-xs);
    }

    .assistant-badge {
      padding: var(--spacing-xs) var(--spacing-xs);
      font-size: var(--font-size-xs);
    }
  }

  /* Tablet Responsive */
  @media (min-width: 481px) and (max-width: 767px) {
    .message-wrapper {
      max-width: 75%;
    }
  }

  /* Dark Mode Support */
  @media (prefers-color-scheme: dark) {
    .message-bubble-sent {
      background: var(--color-vibe-emerald);
    }

    .message-bubble-received {
      background: var(--color-vibe-bg-2);
      border-color: var(--color-vibe-border);
    }

    .message-bubble-bestie {
      background: rgba(236, 72, 153, 0.12);
      border-color: rgba(236, 72, 153, 0.4);
    }

    .message-bubble-wingman {
      background: rgba(59, 130, 246, 0.12);
      border-color: rgba(59, 130, 246, 0.4);
    }

    .message-bubble-coach {
      background: rgba(168, 85, 247, 0.12);
      border-color: rgba(168, 85, 247, 0.4);
    }
  }
</style>
