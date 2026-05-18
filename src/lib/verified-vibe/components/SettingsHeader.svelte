<script lang="ts">
  /**
   * SettingsHeader Component
   *
   * Header for settings pages with title and description.
   *
   * Props:
   * - title: string - Page title
   * - description: string - Page description
   * - icon: string - Optional emoji icon
   */

  interface Props {
    title?: string;
    description?: string;
    icon?: string;
  }

  let {
    title = 'Settings',
    description = 'Manage your account and preferences',
    icon = '⚙️'
  }: Props = $props();
</script>

<div class="settings-header">
  {#if icon}
    <span class="header-icon">{icon}</span>
  {/if}
  <div class="header-content">
    <h1>{title}</h1>
    {#if description}
      <p>{description}</p>
    {/if}
  </div>
</div>

<style>
  .settings-header {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    padding: 24px;
    background: var(--bg-2);
    border-radius: 12px;
    border: 1px solid var(--border-1);
  }

  .header-icon {
    font-size: 32px;
    flex-shrink: 0;
  }

  .header-content {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .header-content h1 {
    margin: 0;
    font-size: 24px;
    font-weight: 700;
    color: var(--text-1);
  }

  .header-content p {
    margin: 0;
    font-size: 14px;
    color: var(--text-3);
  }

  /* Mobile responsive */
  @media (max-width: 767px) {
    .settings-header {
      gap: 12px;
      padding: 16px;
    }

    .header-icon {
      font-size: 24px;
    }

    .header-content h1 {
      font-size: 20px;
    }

    .header-content p {
      font-size: 13px;
    }
  }
</style>
