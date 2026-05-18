<script lang="ts">
  /**
   * MessageContextMenu Component
   *
   * Displays a context menu for message actions (edit, delete, react, etc).
   * Appears on right-click or long-press.
   *
   * Props:
   * - isOpen: boolean - Whether menu is open
   * - x: number - X position
   * - y: number - Y position
   * - canEdit: boolean - Can edit message (default: true)
   * - canDelete: boolean - Can delete message (default: true)
   * - canReact: boolean - Can react to message (default: true)
   * - onEdit: () => void - Edit callback
   * - onDelete: () => void - Delete callback
   * - onReact: () => void - React callback
   * - onClose: () => void - Close callback
   */

  import { fade } from 'svelte/transition';

  interface Props {
    isOpen?: boolean;
    x?: number;
    y?: number;
    canEdit?: boolean;
    canDelete?: boolean;
    canReact?: boolean;
    onEdit?: () => void;
    onDelete?: () => void;
    onReact?: () => void;
    onClose?: () => void;
  }

  let {
    isOpen = false,
    x = 0,
    y = 0,
    canEdit = true,
    canDelete = true,
    canReact = true,
    onEdit = () => {},
    onDelete = () => {},
    onReact = () => {},
    onClose = () => {}
  }: Props = $props();

  let menuElement: HTMLElement | undefined;

  function handleAction(callback: () => void) {
    callback();
    onClose();
  }

  function handleClickOutside(event: MouseEvent) {
    if (menuElement && !menuElement.contains(event.target as Node)) {
      onClose();
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      onClose();
    }
  }
</script>

<svelte:window on:click={handleClickOutside} on:keydown={handleKeyDown} />

{#if isOpen}
  <div
    class="context-menu"
    style="--x: {x}px; --y: {y}px"
    bind:this={menuElement}
    transition:fade={{ duration: 150 }}
    role="menu"
  >
    {#if canReact}
      <button
        class="menu-item"
        on:click={() => handleAction(onReact)}
        role="menuitem"
        aria-label="Add reaction"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
          <line x1="9" y1="9" x2="9.01" y2="9"></line>
          <line x1="15" y1="9" x2="15.01" y2="9"></line>
        </svg>
        <span>React</span>
      </button>
    {/if}

    {#if canEdit}
      <button
        class="menu-item"
        on:click={() => handleAction(onEdit)}
        role="menuitem"
        aria-label="Edit message"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
        <span>Edit</span>
      </button>
    {/if}

    {#if canDelete}
      <button
        class="menu-item delete"
        on:click={() => handleAction(onDelete)}
        role="menuitem"
        aria-label="Delete message"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          <line x1="10" y1="11" x2="10" y2="17"></line>
          <line x1="14" y1="11" x2="14" y2="17"></line>
        </svg>
        <span>Delete</span>
      </button>
    {/if}
  </div>
{/if}

<style>
  .context-menu {
    position: fixed;
    left: var(--x);
    top: var(--y);
    display: flex;
    flex-direction: column;
    gap: 0;
    background: var(--bg-1);
    border: 1px solid var(--border-1);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 1000;
    min-width: 150px;
    overflow: hidden;
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 16px;
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--border-1);
    cursor: pointer;
    color: var(--text-2);
    font-size: 14px;
    transition: all 150ms ease;
    text-align: left;
  }

  .menu-item:last-child {
    border-bottom: none;
  }

  .menu-item:hover {
    background: var(--bg-2);
    color: var(--text-1);
  }

  .menu-item.delete {
    color: #ef4444;
  }

  .menu-item.delete:hover {
    background: rgba(239, 68, 68, 0.1);
  }

  .menu-item svg {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }

  /* Mobile responsive */
  @media (max-width: 767px) {
    .context-menu {
      min-width: 140px;
    }

    .menu-item {
      padding: 8px 12px;
      gap: 10px;
      font-size: 13px;
    }

    .menu-item svg {
      width: 14px;
      height: 14px;
    }
  }
</style>
