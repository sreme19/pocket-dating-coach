<script lang="ts">
  import { Heart, MessageCircle, Shield } from 'lucide-svelte';
  import { currentTab } from '../stores';
  import { goto } from '$app/navigation';
  import type { Tab } from '../types';

  /**
   * BottomNav Component
   *
   * Mobile navigation component showing on mobile only (hidden on desktop).
   * Displays tabs for Discover, Trust, and Chat with badge for unread messages.
   *
   * Features:
   * - Mobile-only display (hidden on desktop)
   * - Three main tabs: Discover, Trust, Chat
   * - Badge for unread messages
   * - Smooth transitions between tabs
   * - Accessible with keyboard navigation
   * - WCAG 2.1 AA compliance
   * - Touch-friendly (44x44px minimum targets)
   *
   * @component
   * @example
   * ```svelte
   * <BottomNav
   *   unreadCount={3}
   * />
   * ```
   */

  interface Props {
    /** Number of unread messages */
    unreadCount?: number;
  }

  let { unreadCount = 0 }: Props = $props();

  const tabs: Array<{ id: Tab; label: string; icon: typeof Heart }> = [
    { id: 'discover', label: 'Discover', icon: Heart },
    { id: 'trust', label: 'Trust', icon: Shield },
    { id: 'chat', label: 'Chat', icon: MessageCircle }
  ];

  /**
   * Handle tab click
   */
  async function handleTabClick(tabId: Tab) {
    currentTab.set(tabId);
    await goto(`/verified-vibe/${tabId}`);
  }
</script>

<nav class="bottom-nav" role="navigation" aria-label="Main navigation">
  <div class="nav-container">
    {#each tabs as tab (tab.id)}
      <button
        class="nav-tab"
        class:active={$currentTab === tab.id}
        onclick={() => handleTabClick(tab.id)}
        aria-label={tab.label}
        aria-current={$currentTab === tab.id ? 'page' : undefined}
        title={tab.label}
      >
        <div class="tab-icon">
          <svelte:component this={tab.icon} size={24} />
          {#if tab.id === 'chat' && unreadCount > 0}
            <span class="badge" aria-label={`${unreadCount} unread messages`}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          {/if}
        </div>
        <span class="tab-label">{tab.label}</span>
      </button>
    {/each}
  </div>
</nav>

<style>
  .bottom-nav {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: var(--color-vibe-bg-1);
    border-top: 1px solid var(--color-vibe-border);
    z-index: 50;
    display: none;
    padding-bottom: max(0, env(safe-area-inset-bottom, 0));
  }

  @media (max-width: 767px) {
    .bottom-nav {
      display: block;
    }
  }

  .nav-container {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    height: 60px;
    gap: 0;
  }

  .nav-tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--gap-xs);
    background: transparent;
    border: none;
    color: var(--color-vibe-text-3);
    cursor: pointer;
    transition: all 200ms ease;
    font-family: inherit;
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-medium);
    padding: var(--spacing-sm);
    min-height: 60px;
    touch-action: manipulation;
    position: relative;
  }

  @media (prefers-reduced-motion: reduce) {
    .nav-tab {
      transition: none;
    }
  }

  @media (hover: hover) {
    .nav-tab:hover {
      color: var(--color-vibe-text-1);
      background: var(--color-vibe-bg-2);
    }
  }

  .nav-tab:active {
    background: var(--color-vibe-bg-3);
  }

  .nav-tab:focus-visible {
    outline: 2px solid var(--color-vibe-accent);
    outline-offset: -2px;
  }

  .nav-tab.active {
    color: var(--color-vibe-accent);
  }

  .nav-tab.active::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: var(--color-vibe-accent);
  }

  .tab-icon {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
  }

  .tab-label {
    display: none;
  }

  @media (min-width: 480px) {
    .tab-label {
      display: block;
    }

    .nav-container {
      height: 70px;
    }

    .nav-tab {
      min-height: 70px;
      gap: var(--gap-sm);
    }
  }

  /* Badge */
  .badge {
    position: absolute;
    top: -4px;
    right: -4px;
    min-width: 20px;
    height: 20px;
    background: #ef4444;
    color: white;
    border-radius: var(--radius-full);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-bold);
    border: 2px solid var(--color-vibe-bg-1);
    box-shadow: var(--shadow-md);
  }

  /* Accessibility */
  @media (prefers-reduced-motion: reduce) {
    .nav-tab {
      transition: none;
    }
  }
</style>
