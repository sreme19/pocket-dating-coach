<script lang="ts">
  /**
   * Settings Page
   *
   * Main settings page with tab navigation and integrated settings components.
   */

  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { page } from '$app/stores';
  import SettingsDashboard from '$lib/verified-vibe/components/SettingsDashboard.svelte';
  import ProfileSettings from '$lib/verified-vibe/components/ProfileSettings.svelte';
  import AccountSettings from '$lib/verified-vibe/components/AccountSettings.svelte';
  import PreferencesSettings from '$lib/verified-vibe/components/PreferencesSettings.svelte';
  import PrivacySettings from '$lib/verified-vibe/components/PrivacySettings.svelte';
  import BlockedUsers from '$lib/verified-vibe/components/BlockedUsers.svelte';
  import NotificationPreferencesSettings from '$lib/verified-vibe/components/NotificationPreferencesSettings.svelte';
  import {
    settingsStore,
    profileStore,
    accountStore,
    preferencesStore,
    privacyStore,
    notificationsStore,
    blockedUsersStore,
    settingsLoadingStore,
    settingsSavingStore,
    settingsErrorStore,
    settingsSuccessStore
  } from '$lib/verified-vibe/stores/settingsStore';

  let activeTab = $state('profile');
  let userId = $state('user_123'); // In real app, get from auth

  // Subscribe to stores
  let profile = $derived($profileStore);
  let account = $derived($accountStore);
  let preferences = $derived($preferencesStore);
  let privacy = $derived($privacyStore);
  let notifications = $derived($notificationsStore);
  let blockedUsers = $derived($blockedUsersStore);
  let isLoading = $derived($settingsLoadingStore);
  let isSaving = $derived($settingsSavingStore);
  let error = $derived($settingsErrorStore);
  let success = $derived($settingsSuccessStore);

  onMount(async () => {
    // Load all settings on mount
    await settingsStore.loadSettings(userId);
    await settingsStore.loadPrivacy(userId);
    await settingsStore.loadNotifications(userId);
    await settingsStore.loadBlockedUsers(userId);
  });

  function handleTabChange(tab: string) {
    activeTab = tab;
  }

  function handleProfileSave(updatedProfile: any) {
    settingsStore.saveSettings(userId, { profile: updatedProfile });
  }

  function handleAccountSave(updatedAccount: any) {
    settingsStore.saveSettings(userId, { account: updatedAccount });
  }

  function handlePreferencesSave(updatedPreferences: any) {
    settingsStore.saveSettings(userId, { preferences: updatedPreferences });
  }

  function handlePrivacySave(updatedPrivacy: any) {
    settingsStore.savePrivacy(userId, updatedPrivacy);
  }

  function handleNotificationsSave(updatedNotifications: any) {
    settingsStore.saveNotifications(userId, updatedNotifications);
  }

  function handleTestNotification() {
    // In real app, call API to send test notification
    console.log('Sending test notification...');
  }

  function handleUnblockUser(blockedUserId: string) {
    // In real app, call API to unblock user
    console.log('Unblocking user:', blockedUserId);
  }
</script>

<svelte:head>
  <title>Settings - Pocket Dating Coach</title>
</svelte:head>

<div class="settings-page">
  <!-- Success Message -->
  {#if success}
    <div class="success-banner" transition:fade={{ duration: 200 }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      <span>{success}</span>
    </div>
  {/if}

  <!-- Settings Dashboard -->
  <SettingsDashboard
    {activeTab}
    onTabChange={handleTabChange}
    isLoading={isSaving}
    error={error}
  >
    <!-- Profile Settings Tab -->
    {#if activeTab === 'profile'}
      <ProfileSettings
        {profile}
        isLoading={isSaving}
        onSave={handleProfileSave}
        onCancel={() => settingsStore.clearError()}
      />
    {/if}

    <!-- Account Settings Tab -->
    {#if activeTab === 'account'}
      <AccountSettings
        account={account}
        isLoading={isSaving}
        onSave={handleAccountSave}
        onCancel={() => settingsStore.clearError()}
      />
    {/if}

    <!-- Preferences Settings Tab -->
    {#if activeTab === 'preferences'}
      <PreferencesSettings
        preferences={preferences}
        isLoading={isSaving}
        onSave={handlePreferencesSave}
        onCancel={() => settingsStore.clearError()}
      />
    {/if}

    <!-- Privacy Settings Tab -->
    {#if activeTab === 'privacy'}
      <div class="privacy-section">
        <PrivacySettings
          privacy={privacy}
          isLoading={isSaving}
          onSave={handlePrivacySave}
          onCancel={() => settingsStore.clearError()}
        />

        <div class="divider"></div>

        <BlockedUsers
          blockedUsers={blockedUsers}
          isLoading={isSaving}
          onUnblock={handleUnblockUser}
        />
      </div>
    {/if}

    <!-- Notifications Settings Tab -->
    {#if activeTab === 'notifications'}
      <NotificationPreferencesSettings
        preferences={notifications}
        isLoading={isSaving}
        onSave={handleNotificationsSave}
        onCancel={() => settingsStore.clearError()}
        onTestNotification={handleTestNotification}
      />
    {/if}
  </SettingsDashboard>
</div>

<style>
  .settings-page {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-height: 100vh;
  }

  .success-banner {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: rgba(34, 197, 94, 0.1);
    border: 1px solid rgba(34, 197, 94, 0.3);
    border-radius: 8px;
    color: #16a34a;
    margin: 16px 24px 0;
  }

  .success-banner svg {
    flex-shrink: 0;
  }

  .privacy-section {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .divider {
    height: 1px;
    background: var(--border-1);
  }

  /* Mobile responsive */
  @media (max-width: 767px) {
    .settings-page {
      gap: 12px;
    }

    .success-banner {
      margin: 12px 16px 0;
    }
  }
</style>
