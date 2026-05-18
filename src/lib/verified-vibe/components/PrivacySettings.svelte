<script lang="ts">
  import { untrack } from 'svelte';
  /**
   * PrivacySettings Component
   *
   * Allows users to configure their privacy settings.
   * Includes profile visibility, data sharing, and message permissions.
   *
   * Props:
   * - privacy: any - User privacy settings
   * - isLoading: boolean - Loading state
   * - onSave: (privacy: any) => void - Save callback
   * - onCancel: () => void - Cancel callback
   */

  interface Props {
    privacy?: any;
    isLoading?: boolean;
    onSave?: (privacy: any) => void;
    onCancel?: () => void;
  }

  let {
    privacy = {},
    isLoading = false,
    onSave = () => {},
    onCancel = () => {}
  }: Props = $props();

  let formData = $state(untrack(() => ({
    profileVisibility: privacy.profileVisibility || 'public',
    showOnlineStatus: privacy.showOnlineStatus !== false,
    showLastSeen: privacy.showLastSeen !== false,
    allowMessagesFrom: privacy.allowMessagesFrom || 'anyone',
    dataSharing: privacy.dataSharing || false,
    analyticsTracking: privacy.analyticsTracking !== false
  })));

  let isDirty = $state(false);

  const visibilityOptions = [
    { value: 'public', label: 'Public', description: 'Anyone can see your profile' },
    { value: 'private', label: 'Private', description: 'Only you can see your profile' },
    { value: 'friends_only', label: 'Matches Only', description: 'Only your matches can see your profile' }
  ];

  const messageOptions = [
    { value: 'anyone', label: 'Anyone', description: 'Anyone can message you' },
    { value: 'matches_only', label: 'Matches Only', description: 'Only your matches can message you' },
    { value: 'friends_only', label: 'Friends Only', description: 'Only your friends can message you' }
  ];

  function handleInputChange() {
    isDirty = true;
  }

  function handleSave() {
    const updatedPrivacy = {
      ...privacy,
      profileVisibility: formData.profileVisibility,
      showOnlineStatus: formData.showOnlineStatus,
      showLastSeen: formData.showLastSeen,
      allowMessagesFrom: formData.allowMessagesFrom,
      dataSharing: formData.dataSharing,
      analyticsTracking: formData.analyticsTracking
    };

    onSave(updatedPrivacy);
    isDirty = false;
  }

  function handleCancel() {
    formData = {
      profileVisibility: privacy.profileVisibility || 'public',
      showOnlineStatus: privacy.showOnlineStatus !== false,
      showLastSeen: privacy.showLastSeen !== false,
      allowMessagesFrom: privacy.allowMessagesFrom || 'anyone',
      dataSharing: privacy.dataSharing || false,
      analyticsTracking: privacy.analyticsTracking !== false
    };
    isDirty = false;
    onCancel();
  }
</script>

<div class="privacy-settings">
  <div class="section-header">
    <h2>Privacy Settings</h2>
    <p>Control who can see your profile and contact you</p>
  </div>

  <form onsubmit={(e) => { e.preventDefault(); handleSave(); }} class="settings-form">
    <!-- Profile Visibility -->
    <div class="form-group">
      <span class="form-group-label">Profile Visibility</span>
      <div class="radio-group">
        {#each visibilityOptions as option (option.value)}
          <label class="radio-option">
            <input
              type="radio"
              name="profileVisibility"
              value={option.value}
              bind:group={formData.profileVisibility}
              onchange={handleInputChange}
            />
            <div class="radio-content">
              <span class="radio-label">{option.label}</span>
              <span class="radio-description">{option.description}</span>
            </div>
          </label>
        {/each}
      </div>
    </div>

    <!-- Online Status -->
    <div class="form-group">
      <label class="toggle-label">
        <input
          type="checkbox"
          bind:checked={formData.showOnlineStatus}
          onchange={handleInputChange}
        />
        <span class="toggle-text">
          <span class="toggle-title">Show Online Status</span>
          <span class="toggle-description">Let others see when you're online</span>
        </span>
      </label>
    </div>

    <!-- Last Seen -->
    <div class="form-group">
      <label class="toggle-label">
        <input
          type="checkbox"
          bind:checked={formData.showLastSeen}
          onchange={handleInputChange}
        />
        <span class="toggle-text">
          <span class="toggle-title">Show Last Seen</span>
          <span class="toggle-description">Let others see when you were last active</span>
        </span>
      </label>
    </div>

    <!-- Message Permissions -->
    <div class="form-group">
      <span class="form-group-label">Who Can Message You</span>
      <div class="radio-group">
        {#each messageOptions as option (option.value)}
          <label class="radio-option">
            <input
              type="radio"
              name="allowMessagesFrom"
              value={option.value}
              bind:group={formData.allowMessagesFrom}
              onchange={handleInputChange}
            />
            <div class="radio-content">
              <span class="radio-label">{option.label}</span>
              <span class="radio-description">{option.description}</span>
            </div>
          </label>
        {/each}
      </div>
    </div>

    <!-- Data Sharing -->
    <div class="form-group">
      <label class="toggle-label">
        <input
          type="checkbox"
          bind:checked={formData.dataSharing}
          onchange={handleInputChange}
        />
        <span class="toggle-text">
          <span class="toggle-title">Allow Data Sharing</span>
          <span class="toggle-description">Share anonymized data to improve our service</span>
        </span>
      </label>
    </div>

    <!-- Analytics Tracking -->
    <div class="form-group">
      <label class="toggle-label">
        <input
          type="checkbox"
          bind:checked={formData.analyticsTracking}
          onchange={handleInputChange}
        />
        <span class="toggle-text">
          <span class="toggle-title">Analytics Tracking</span>
          <span class="toggle-description">Help us understand how you use the app</span>
        </span>
      </label>
    </div>

    <!-- Info Box -->
    <div class="info-box">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
      </svg>
      <p>
        Your privacy settings are important to us. We never sell your personal data to third parties.
      </p>
    </div>

    <!-- Form Actions -->
    <div class="form-actions">
      <button
        type="button"
        class="btn-secondary"
        onclick={handleCancel}
        disabled={isLoading || !isDirty}
      >
        Cancel
      </button>
      <button
        type="submit"
        class="btn-primary"
        disabled={isLoading || !isDirty}
      >
        {#if isLoading}
          <span class="spinner"></span>
          Saving...
        {:else}
          Save Changes
        {/if}
      </button>
    </div>
  </form>
</div>

<style>
  .privacy-settings {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .section-header {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .section-header h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: var(--text-1);
  }

  .section-header p {
    margin: 0;
    font-size: 14px;
    color: var(--text-3);
  }

  .settings-form {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .form-group > label:first-child,
  .form-group > .form-group-label:first-child {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-1);
  }

  .radio-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .radio-option {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px;
    background: var(--bg-1);
    border: 1px solid var(--border-1);
    border-radius: 6px;
    cursor: pointer;
    transition: all 200ms ease;
  }

  .radio-option:hover {
    border-color: var(--border-2);
    background: var(--bg-2);
  }

  .radio-option input {
    margin-top: 4px;
    cursor: pointer;
  }

  .radio-option input:checked ~ .radio-content {
    color: var(--accent);
  }

  .radio-option:has(input:checked) {
    border-color: var(--accent);
    background: rgba(34, 197, 94, 0.05);
  }

  .radio-content {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
  }

  .radio-label {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-1);
  }

  .radio-description {
    font-size: 12px;
    color: var(--text-3);
  }

  .toggle-label {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: var(--bg-1);
    border: 1px solid var(--border-1);
    border-radius: 6px;
    cursor: pointer;
    transition: all 200ms ease;
  }

  .toggle-label:hover {
    border-color: var(--border-2);
    background: var(--bg-2);
  }

  .toggle-label input {
    width: 20px;
    height: 20px;
    cursor: pointer;
  }

  .toggle-text {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
  }

  .toggle-title {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-1);
  }

  .toggle-description {
    font-size: 12px;
    color: var(--text-3);
  }

  .info-box {
    display: flex;
    gap: 12px;
    padding: 12px 16px;
    background: rgba(59, 130, 246, 0.05);
    border: 1px solid rgba(59, 130, 246, 0.2);
    border-radius: 6px;
    color: #1e40af;
  }

  .info-box svg {
    flex-shrink: 0;
    margin-top: 2px;
  }

  .info-box p {
    margin: 0;
    font-size: 13px;
    line-height: 1.5;
  }

  .form-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    padding-top: 12px;
    border-top: 1px solid var(--border-1);
  }

  .btn-primary,
  .btn-secondary {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 200ms ease;
    border: none;
  }

  .btn-primary {
    background: var(--accent);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: #16a34a;
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-secondary {
    background: transparent;
    border: 1px solid var(--border-1);
    color: var(--text-1);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--bg-2);
    border-color: var(--border-2);
  }

  .btn-secondary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Mobile responsive */
  @media (max-width: 767px) {
    .privacy-settings {
      gap: 16px;
    }

    .section-header h2 {
      font-size: 18px;
    }

    .settings-form {
      gap: 16px;
    }

    .form-actions {
      flex-direction: column-reverse;
    }

    .btn-primary,
    .btn-secondary {
      width: 100%;
      justify-content: center;
    }

    .info-box {
      gap: 10px;
      padding: 10px 12px;
    }

    .info-box p {
      font-size: 12px;
    }
  }
</style>
