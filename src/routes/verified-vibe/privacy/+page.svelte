<script lang="ts">
  import { goto } from '$app/navigation';
  import { fade, slide } from 'svelte/transition';
  import { onMount } from 'svelte';

  let privacySettings = $state({
    profileVisibility: 'verified_only',
    allowMessages: true,
    allowNotifications: true,
    dataRetention: '12_months',
    analyticsOptIn: false
  });

  let showDeleteModal = $state(false);
  let showExportModal = $state(false);
  let deleteConfirmation = $state('');
  let isDeleting = $state(false);
  let isExporting = $state(false);
  let exportStatus = $state<'idle' | 'processing' | 'complete' | 'error'>('idle');
  let error = $state<string | null>(null);
  let success = $state<string | null>(null);

  const dataRetentionOptions = [
    { value: '3_months', label: '3 months' },
    { value: '6_months', label: '6 months' },
    { value: '12_months', label: '12 months' },
    { value: 'indefinite', label: 'Keep indefinitely' }
  ];

  const profileVisibilityOptions = [
    { value: 'verified_only', label: 'Verified users only' },
    { value: 'all_users', label: 'All users' },
    { value: 'hidden', label: 'Hidden from discovery' }
  ];

  onMount(async () => {
    try {
      const response = await fetch('/api/verified-vibe/privacy', {
        method: 'GET'
      });
      if (response.ok) {
        const data = await response.json();
        privacySettings = data;
      }
    } catch (err) {
      console.error('Failed to load privacy settings:', err);
    }
  });

  async function handleSaveSettings() {
    try {
      error = null;
      success = null;
      const response = await fetch('/api/verified-vibe/privacy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(privacySettings)
      });

      if (response.ok) {
        success = 'Privacy settings saved successfully';
        setTimeout(() => (success = null), 3000);
      } else {
        error = 'Failed to save privacy settings';
      }
    } catch (err) {
      error = 'Error saving privacy settings';
      console.error(err);
    }
  }

  async function handleExportData() {
    try {
      error = null;
      exportStatus = 'processing';
      const response = await fetch('/api/verified-vibe/privacy/export', {
        method: 'POST'
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `verified-vibe-data-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        exportStatus = 'complete';
        success = 'Data exported successfully';
        setTimeout(() => {
          exportStatus = 'idle';
          success = null;
          showExportModal = false;
        }, 2000);
      } else {
        exportStatus = 'error';
        error = 'Failed to export data';
      }
    } catch (err) {
      exportStatus = 'error';
      error = 'Error exporting data';
      console.error(err);
    }
  }

  async function handleDeleteAccount() {
    if (deleteConfirmation !== 'DELETE') {
      error = 'Please type DELETE to confirm';
      return;
    }

    try {
      error = null;
      isDeleting = true;
      const response = await fetch('/api/verified-vibe/account', {
        method: 'DELETE'
      });

      if (response.ok) {
        success = 'Account deleted successfully. Redirecting...';
        setTimeout(() => {
          goto('/verified-vibe/gate');
        }, 2000);
      } else {
        error = 'Failed to delete account';
        isDeleting = false;
      }
    } catch (err) {
      error = 'Error deleting account';
      isDeleting = false;
      console.error(err);
    }
  }

  function openDeleteModal() {
    deleteConfirmation = '';
    showDeleteModal = true;
  }

  function closeDeleteModal() {
    showDeleteModal = false;
    deleteConfirmation = '';
    error = null;
  }

  function openExportModal() {
    showExportModal = true;
  }

  function closeExportModal() {
    showExportModal = false;
    exportStatus = 'idle';
  }
</script>

<div class="privacy-screen">
  <!-- Header -->
  <div class="privacy-header" transition:slide={{ duration: 400, delay: 0, axis: 'y' }}>
    <h1>Privacy & Data</h1>
    <p>Manage your privacy settings and data</p>
  </div>

  <!-- Alerts -->
  {#if error}
    <div class="alert alert-error" transition:fade={{ duration: 300 }}>
      {error}
    </div>
  {/if}

  {#if success}
    <div class="alert alert-success" transition:fade={{ duration: 300 }}>
      {success}
    </div>
  {/if}

  <!-- Privacy Settings Section -->
  <div class="settings-section" transition:slide={{ duration: 400, delay: 100, axis: 'y' }}>
    <div class="section-header">
      <h2>Privacy Settings</h2>
      <p class="section-description">Control who can see your profile and how your data is used</p>
    </div>

    <div class="settings-group">
      <div class="setting-item">
        <div class="setting-label">
          <label for="profile-visibility">Profile Visibility</label>
          <p class="setting-description">Who can see your profile</p>
        </div>
        <select
          id="profile-visibility"
          bind:value={privacySettings.profileVisibility}
          class="select-input"
        >
          {#each profileVisibilityOptions as option}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </div>

      <div class="setting-item">
        <div class="setting-label">
          <label for="allow-messages">Allow Messages</label>
          <p class="setting-description">Allow other users to send you messages</p>
        </div>
        <label class="toggle-switch">
          <input
            type="checkbox"
            bind:checked={privacySettings.allowMessages}
            class="toggle-input"
          />
          <span class="toggle-slider"></span>
        </label>
      </div>

      <div class="setting-item">
        <div class="setting-label">
          <label for="allow-notifications">Allow Notifications</label>
          <p class="setting-description">Receive notifications about matches and messages</p>
        </div>
        <label class="toggle-switch">
          <input
            type="checkbox"
            bind:checked={privacySettings.allowNotifications}
            class="toggle-input"
          />
          <span class="toggle-slider"></span>
        </label>
      </div>

      <div class="setting-item">
        <div class="setting-label">
          <label for="analytics-opt-in">Analytics & Improvements</label>
          <p class="setting-description">Help us improve by sharing usage analytics</p>
        </div>
        <label class="toggle-switch">
          <input
            type="checkbox"
            bind:checked={privacySettings.analyticsOptIn}
            class="toggle-input"
          />
          <span class="toggle-slider"></span>
        </label>
      </div>
    </div>

    <button class="btn btn-primary full" onclick={handleSaveSettings}>
      Save Privacy Settings
    </button>
  </div>

  <!-- Data Retention Section -->
  <div class="settings-section" transition:slide={{ duration: 400, delay: 150, axis: 'y' }}>
    <div class="section-header">
      <h2>Data Retention</h2>
      <p class="section-description">GDPR compliance - control how long we keep your data</p>
    </div>

    <div class="settings-group">
      <div class="setting-item">
        <div class="setting-label">
          <label for="data-retention">Retention Period</label>
          <p class="setting-description">How long to keep your data after account deletion</p>
        </div>
        <select
          id="data-retention"
          bind:value={privacySettings.dataRetention}
          class="select-input"
        >
          {#each dataRetentionOptions as option}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </div>
    </div>

    <div class="info-box">
      <p>
        <strong>GDPR Compliance:</strong> We comply with GDPR regulations. You can request data deletion
        at any time, and we will permanently delete your data within 30 days.
      </p>
    </div>
  </div>

  <!-- Data Management Section -->
  <div class="settings-section" transition:slide={{ duration: 400, delay: 200, axis: 'y' }}>
    <div class="section-header">
      <h2>Data Management</h2>
      <p class="section-description">Export or delete your personal data</p>
    </div>

    <div class="action-buttons">
      <button class="btn btn-secondary full" onclick={openExportModal}>
        📥 Export My Data
      </button>
      <button class="btn btn-danger full" onclick={openDeleteModal}>
        🗑️ Delete Account & Data
      </button>
    </div>

    <div class="info-box">
      <p>
        <strong>Export Data:</strong> Download a copy of all your personal data in JSON format.
      </p>
      <p>
        <strong>Delete Account:</strong> Permanently delete your account and all associated data.
      </p>
    </div>
  </div>

  <!-- Export Modal -->
  {#if showExportModal}
    <div class="modal-overlay" onclick={closeExportModal} onkeydown={(e) => e.key === 'Escape' && closeExportModal()} role="button" tabindex="0" transition:fade={{ duration: 300 }}>
      <div class="modal" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()} role="button" tabindex="0" transition:slide={{ duration: 300, axis: 'y' }}>
        <div class="modal-header">
          <h3>Export Your Data</h3>
          <button class="close-btn" onclick={closeExportModal}>✕</button>
        </div>

        <div class="modal-content">
          {#if exportStatus === 'idle'}
            <p>
              Download a copy of all your personal data including profile information, verification
              records, matches, and messages.
            </p>
            <p class="text-muted">The file will be in JSON format and can be imported into other services.</p>
          {:else if exportStatus === 'processing'}
            <div class="loading-state">
              <div class="spinner"></div>
              <p>Preparing your data export...</p>
            </div>
          {:else if exportStatus === 'complete'}
            <div class="success-state">
              <p>✓ Data exported successfully!</p>
              <p class="text-muted">Your download should start automatically.</p>
            </div>
          {:else if exportStatus === 'error'}
            <div class="error-state">
              <p>✗ Failed to export data</p>
              <p class="text-muted">Please try again later.</p>
            </div>
          {/if}
        </div>

        <div class="modal-actions">
          <button class="btn btn-secondary" onclick={closeExportModal} disabled={exportStatus === 'processing'}>
            Cancel
          </button>
          <button
            class="btn btn-primary"
            onclick={handleExportData}
            disabled={exportStatus !== 'idle'}
          >
            {exportStatus === 'processing' ? 'Exporting...' : 'Export Data'}
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Delete Account Modal -->
  {#if showDeleteModal}
    <div class="modal-overlay" onclick={closeDeleteModal} onkeydown={(e) => e.key === 'Escape' && closeDeleteModal()} role="button" tabindex="0" transition:fade={{ duration: 300 }}>
      <div class="modal modal-danger" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()} role="button" tabindex="0" transition:slide={{ duration: 300, axis: 'y' }}>
        <div class="modal-header">
          <h3>Delete Account & Data</h3>
          <button class="close-btn" onclick={closeDeleteModal}>✕</button>
        </div>

        <div class="modal-content">
          <div class="warning-box">
            <p>⚠️ <strong>This action cannot be undone.</strong></p>
          </div>

          <p>
            Deleting your account will:
          </p>
          <ul class="delete-list">
            <li>Permanently delete your profile and all personal data</li>
            <li>Cancel all active matches and conversations</li>
            <li>Remove your verification records</li>
            <li>Delete all messages and chat history</li>
          </ul>

          <p class="text-muted">
            To confirm deletion, type <strong>DELETE</strong> in the field below:
          </p>

          <input
            type="text"
            placeholder="Type DELETE to confirm"
            bind:value={deleteConfirmation}
            class="text-input"
            disabled={isDeleting}
          />
        </div>

        <div class="modal-actions">
          <button class="btn btn-secondary" onclick={closeDeleteModal} disabled={isDeleting}>
            Cancel
          </button>
          <button
            class="btn btn-danger"
            onclick={handleDeleteAccount}
            disabled={deleteConfirmation !== 'DELETE' || isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete Account'}
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .privacy-screen {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding-bottom: calc(20px + env(safe-area-inset-bottom, 0));
    max-width: 800px;
    margin: 0 auto;
  }

  .privacy-header {
    padding-top: 8px;
  }

  .privacy-header h1 {
    font-size: 28px;
    font-weight: 700;
    margin: 0 0 4px;
  }

  .privacy-header p {
    font-size: 14px;
    color: var(--text-3);
    margin: 0;
  }

  .alert {
    padding: 12px 16px;
    border-radius: var(--r-lg);
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .alert-error {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
    border: 1px solid rgba(239, 68, 68, 0.2);
  }

  .alert-success {
    background: rgba(34, 197, 94, 0.1);
    color: #22c55e;
    border: 1px solid rgba(34, 197, 94, 0.2);
  }

  .settings-section {
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    border-radius: var(--r-lg);
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .section-header {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .section-header h2 {
    font-size: 18px;
    font-weight: 600;
    margin: 0;
  }

  .section-description {
    font-size: 13px;
    color: var(--text-3);
    margin: 0;
  }

  .settings-group {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .setting-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
  }

  .setting-label {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .setting-label label {
    font-size: 14px;
    font-weight: 600;
  }

  .setting-description {
    font-size: 12px;
    color: var(--text-3);
    margin: 0;
  }

  .select-input {
    padding: 10px 12px;
    border: 1px solid var(--border-1);
    border-radius: var(--r-lg);
    background: var(--bg-1);
    color: var(--text-1);
    font-size: 14px;
    cursor: pointer;
    min-width: 200px;
  }

  .toggle-switch {
    display: flex;
    align-items: center;
    cursor: pointer;
    position: relative;
    width: 48px;
    height: 28px;
  }

  .toggle-input {
    display: none;
  }

  .toggle-slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: var(--bg-3);
    transition: 0.3s;
    border-radius: 14px;
    border: 1px solid var(--border-1);
  }

  .toggle-slider::before {
    content: '';
    position: absolute;
    height: 20px;
    width: 20px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: 0.3s;
    border-radius: 50%;
  }

  .toggle-input:checked + .toggle-slider {
    background-color: var(--accent);
    border-color: var(--accent);
  }

  .toggle-input:checked + .toggle-slider::before {
    transform: translateX(20px);
  }

  .info-box {
    background: var(--bg-3);
    border: 1px solid var(--border-1);
    border-radius: var(--r-lg);
    padding: 16px;
    font-size: 13px;
    line-height: 1.6;
  }

  .info-box p {
    margin: 0 0 8px;
  }

  .info-box p:last-child {
    margin: 0;
  }

  .action-buttons {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .btn {
    padding: 12px 16px;
    border: none;
    border-radius: var(--r-lg);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 200ms ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary {
    background: var(--accent);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--accent-bright);
  }

  .btn-secondary {
    background: var(--bg-3);
    color: var(--text-1);
    border: 1px solid var(--border-1);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--bg-2);
  }

  .btn-danger {
    background: #ef4444;
    color: white;
  }

  .btn-danger:hover:not(:disabled) {
    background: #dc2626;
  }

  .full {
    width: 100%;
  }

  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: grid;
    place-items: center;
    z-index: 100;
    padding: 20px;
  }

  .modal {
    background: var(--bg-1);
    border: 1px solid var(--border-1);
    border-radius: var(--r-lg);
    width: 100%;
    max-width: 500px;
    max-height: 80vh;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  .modal-danger {
    border-color: #ef4444;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px;
    border-bottom: 1px solid var(--border-1);
  }

  .modal-header h3 {
    font-size: 18px;
    font-weight: 600;
    margin: 0;
  }

  .close-btn {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    display: grid;
    place-items: center;
    cursor: pointer;
    color: var(--text-1);
    font-size: 18px;
  }

  .modal-content {
    flex: 1;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    font-size: 14px;
    line-height: 1.6;
  }

  .modal-content p {
    margin: 0;
  }

  .loading-state,
  .success-state,
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    text-align: center;
    padding: 20px 0;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--bg-3);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .warning-box {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.2);
    border-radius: var(--r-lg);
    padding: 12px 16px;
    color: #ef4444;
    font-weight: 600;
  }

  .warning-box p {
    margin: 0;
  }

  .delete-list {
    margin: 12px 0;
    padding-left: 20px;
    list-style: disc;
  }

  .delete-list li {
    margin: 6px 0;
  }

  .text-muted {
    color: var(--text-3);
    font-size: 13px;
  }

  .text-input {
    width: 100%;
    padding: 12px;
    border: 1px solid var(--border-1);
    border-radius: var(--r-lg);
    background: var(--bg-2);
    color: var(--text-1);
    font-size: 14px;
    font-family: var(--font-mono);
  }

  .modal-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    padding: 20px;
    border-top: 1px solid var(--border-1);
  }

  @media (max-width: 767px) {
    .privacy-screen {
      padding: 12px 16px 20px;
      gap: 16px;
    }

    .privacy-header h1 {
      font-size: 24px;
    }

    .privacy-header p {
      font-size: 13px;
    }

    .settings-section {
      padding: 16px;
      gap: 16px;
    }

    .section-header h2 {
      font-size: 16px;
    }

    .section-description {
      font-size: 12px;
    }

    .settings-group {
      gap: 12px;
    }

    .setting-item {
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
    }

    .select-input {
      width: 100%;
      min-width: unset;
    }

    .info-box {
      padding: 12px;
      font-size: 12px;
    }

    .modal {
      max-width: 100%;
      max-height: 90vh;
    }

    .modal-header {
      padding: 16px;
    }

    .modal-header h3 {
      font-size: 16px;
    }

    .modal-content {
      padding: 16px;
      gap: 12px;
      font-size: 13px;
    }

    .text-input {
      padding: 10px;
      font-size: 13px;
    }

    .modal-actions {
      gap: 10px;
      padding: 16px;
    }

    .btn {
      padding: 10px 14px;
      font-size: 13px;
    }
  }
</style>
