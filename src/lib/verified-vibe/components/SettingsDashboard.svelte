<script lang="ts">
  /**
   * SettingsDashboard Component
   *
   * Main settings page layout with tab navigation.
   * Provides access to profile, account, and preferences settings.
   *
   * Props:
   * - activeTab: string - Currently active tab (profile, account, preferences)
   * - onTabChange: (tab: string) => void - Tab change callback
   * - isLoading: boolean - Loading state
   * - error: string | null - Error message
   * - onSave: (settings: any) => void - Save callback
   */

  import { fade, slide } from 'svelte/transition';

  import type { Snippet } from 'svelte';

  interface Props {
    activeTab?: string;
    onTabChange?: (tab: string) => void;
    isLoading?: boolean;
    error?: string | null;
    onSave?: (settings: any) => void;
    children?: Snippet;
  }

  let {
    activeTab = 'profile',
    onTabChange = () => {},
    isLoading = false,
    error = null,
    onSave = () => {},
    children
  }: Props = $props();

  const tabs = [
    { id: 'profile', label: 'Profile', icon: '👤' },
    { id: 'account', label: 'Account', icon: '⚙️' },
    { id: 'preferences', label: 'Preferences', icon: '🎨' }
  ];

  function handleTabClick(tabId: string) {
    activeTab = tabId;
    onTabChange(tabId);
  }
</script>

<div class="settings-dashboard">
  <!-- Header -->
  <div class="settings-header">
    <h1>Settings</h1>
    <p class="settings-subtitle">Manage your profile, account, and preferences</p>
  </div>

  <!-- Error Message -->
  {#if error}
    <div class="error-banner" transition:slide={{ duration: 200 }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      <span>{error}</span>
    </div>
  {/if}

  <!-- Main Content -->
  <div class="settings-container">
    <!-- Sidebar Navigation -->
    <aside class="settings-sidebar">
      <nav class="settings-nav">
        {#each tabs as tab (tab.id)}
          <button
            class="nav-item"
            class:active={activeTab === tab.id}
            onclick={() => handleTabClick(tab.id)}
            disabled={isLoading}
            aria-label={`Go to ${tab.label} settings`}
            title={tab.label}
          >
            <span class="nav-icon">{tab.icon}</span>
            <span class="nav-label">{tab.label}</span>
          </button>
        {/each}
      </nav>
    </aside>

    <!-- Content Area -->
    <main class="settings-content">
      {#if isLoading}
        <div class="loading-state" transition:fade={{ duration: 200 }}>
          <div class="spinner"></div>
          <p>Loading settings...</p>
        </div>
      {:else}
        <div class="tab-content" transition:fade={{ duration: 200 }}>
          {@render children?.()}
        </div>
      {/if}
    </main>
  </div>
</div>

<style>
  .settings-dashboard {
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding: 24px;
    background: var(--bg-1);
    min-height: 100vh;
  }

  .settings-header {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .settings-header h1 {
    margin: 0;
    font-size: 32px;
    font-weight: 700;
    color: var(--text-1);
  }

  .settings-subtitle {
    margin: 0;
    font-size: 16px;
    color: var(--text-3);
  }

  .error-banner {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 8px;
    color: #dc2626;
  }

  .error-banner svg {
    flex-shrink: 0;
  }

  .settings-container {
    display: grid;
    grid-template-columns: 200px 1fr;
    gap: 24px;
  }

  .settings-sidebar {
    display: flex;
    flex-direction: column;
  }

  .settings-nav {
    display: flex;
    flex-direction: column;
    gap: 8px;
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 8px;
    cursor: pointer;
    color: var(--text-2);
    font-size: 14px;
    font-weight: 500;
    transition: all 200ms ease;
    text-align: left;
  }

  .nav-item:hover:not(:disabled) {
    background: var(--bg-2);
    border-color: var(--border-1);
    color: var(--text-1);
  }

  .nav-item.active {
    background: var(--accent);
    border-color: var(--accent);
    color: white;
  }

  .nav-item:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .nav-icon {
    font-size: 18px;
    flex-shrink: 0;
  }

  .nav-label {
    flex: 1;
  }

  .settings-content {
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding: 24px;
    background: var(--bg-2);
    border-radius: 12px;
    border: 1px solid var(--border-1);
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 60px 20px;
    color: var(--text-3);
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--border-1);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .tab-content {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  /* Mobile responsive */
  @media (max-width: 767px) {
    .settings-dashboard {
      gap: 16px;
      padding: 16px;
    }

    .settings-header h1 {
      font-size: 24px;
    }

    .settings-container {
      grid-template-columns: 1fr;
      gap: 16px;
    }

    .settings-sidebar {
      display: none;
    }

    .settings-nav {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }

    .nav-item {
      padding: 10px 12px;
      font-size: 12px;
      flex-direction: column;
      text-align: center;
    }

    .nav-label {
      display: none;
    }

    .nav-item.active .nav-label {
      display: block;
    }

    .settings-content {
      padding: 16px;
    }
  }
</style>
