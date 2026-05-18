<script lang="ts">
  /**
   * MessageReactions Component
   *
   * Displays emoji reactions on a message with user counts.
   * Allows adding and removing reactions.
   *
   * Props:
   * - reactions: MessageReaction[] - Array of reactions
   * - onAddReaction: (emoji: string) => void - Callback for adding reaction
   * - onRemoveReaction: (emoji: string) => void - Callback for removing reaction
   * - currentUserId: string - Current user ID
   * - showAddButton: boolean - Show add reaction button (default: true)
   */

  import { fade } from 'svelte/transition';

  interface MessageReaction {
    emoji: string;
    users: string[];
    count: number;
  }

  interface Props {
    reactions?: MessageReaction[];
    onAddReaction?: (emoji: string) => void;
    onRemoveReaction?: (emoji: string) => void;
    currentUserId?: string;
    showAddButton?: boolean;
  }

  let {
    reactions = [],
    onAddReaction = () => {},
    onRemoveReaction = () => {},
    currentUserId = '',
    showAddButton = true
  }: Props = $props();

  let showEmojiPicker = $state(false);

  const commonEmojis = ['❤️', '😂', '😮', '😢', '👍', '🔥', '✨', '🎉'];

  function handleReactionClick(emoji: string) {
    const reaction = reactions.find((r) => r.emoji === emoji);
    if (reaction && reaction.users.includes(currentUserId)) {
      onRemoveReaction(emoji);
    } else {
      onAddReaction(emoji);
    }
  }

  function handleAddEmoji(emoji: string) {
    handleReactionClick(emoji);
    showEmojiPicker = false;
  }

  function hasUserReacted(reaction: MessageReaction): boolean {
    return reaction.users.includes(currentUserId);
  }
</script>

<div class="message-reactions" transition:fade={{ duration: 200 }}>
  {#each reactions as reaction (reaction.emoji)}
    <button
      class="reaction-button"
      class:active={hasUserReacted(reaction)}
      on:click={() => handleReactionClick(reaction.emoji)}
      title={`${reaction.count} ${reaction.count === 1 ? 'person' : 'people'} reacted with ${reaction.emoji}`}
      aria-label={`${reaction.emoji} reaction, ${reaction.count} ${reaction.count === 1 ? 'person' : 'people'}`}
    >
      <span class="emoji">{reaction.emoji}</span>
      <span class="count">{reaction.count}</span>
    </button>
  {/each}

  {#if showAddButton}
    <div class="add-reaction-container">
      <button
        class="add-reaction-button"
        on:click={() => (showEmojiPicker = !showEmojiPicker)}
        aria-label="Add reaction"
        title="Add reaction"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
          <line x1="9" y1="9" x2="9.01" y2="9"></line>
          <line x1="15" y1="9" x2="15.01" y2="9"></line>
        </svg>
      </button>

      {#if showEmojiPicker}
        <div class="emoji-picker" transition:fade={{ duration: 150 }}>
          {#each commonEmojis as emoji}
            <button
              class="emoji-option"
              on:click={() => handleAddEmoji(emoji)}
              aria-label={`React with ${emoji}`}
            >
              {emoji}
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .message-reactions {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
    margin-top: 8px;
    padding: 4px 0;
  }

  .reaction-button {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    border-radius: 12px;
    cursor: pointer;
    font-size: 13px;
    transition: all 200ms ease;
    color: var(--text-2);
  }

  .reaction-button:hover {
    background: var(--bg-3);
    border-color: var(--border-2);
  }

  .reaction-button.active {
    background: rgba(59, 130, 246, 0.1);
    border-color: #3b82f6;
    color: #3b82f6;
  }

  .emoji {
    font-size: 16px;
    line-height: 1;
  }

  .count {
    font-size: 12px;
    font-weight: 500;
  }

  .add-reaction-container {
    position: relative;
  }

  .add-reaction-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    border-radius: 12px;
    cursor: pointer;
    color: var(--text-3);
    transition: all 200ms ease;
  }

  .add-reaction-button:hover {
    background: var(--bg-3);
    border-color: var(--border-2);
    color: var(--text-2);
  }

  .emoji-picker {
    position: absolute;
    bottom: 100%;
    right: 0;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
    padding: 8px;
    background: var(--bg-1);
    border: 1px solid var(--border-1);
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    margin-bottom: 8px;
    z-index: 10;
  }

  .emoji-option {
    width: 32px;
    height: 32px;
    padding: 0;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 8px;
    cursor: pointer;
    font-size: 18px;
    transition: all 150ms ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .emoji-option:hover {
    background: var(--bg-2);
    border-color: var(--border-1);
    transform: scale(1.1);
  }

  /* Mobile responsive */
  @media (max-width: 767px) {
    .message-reactions {
      gap: 3px;
      margin-top: 6px;
      padding: 3px 0;
    }

    .reaction-button {
      padding: 3px 6px;
      font-size: 12px;
      border-radius: 10px;
    }

    .emoji {
      font-size: 14px;
    }

    .count {
      font-size: 11px;
    }

    .add-reaction-button {
      width: 24px;
      height: 24px;
      border-radius: 10px;
    }

    .emoji-picker {
      grid-template-columns: repeat(4, 1fr);
      gap: 3px;
      padding: 6px;
      margin-bottom: 6px;
    }

    .emoji-option {
      width: 28px;
      height: 28px;
      font-size: 16px;
      border-radius: 6px;
    }
  }
</style>
