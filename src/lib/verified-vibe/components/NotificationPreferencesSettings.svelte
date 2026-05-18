<script lang="ts">
  /**
   * NotificationPreferencesSettings Component
   *
   * Allows users to configure their notification preferences.
   * Includes message, match, system, and marketing notifications.
   *
   * Props:
   * - preferences: any - User notification preferences
   * - isLoading: boolean - Loading state
   * - onSave: (preferences: any) => void - Save callback
   * - onCancel: () => void - Cancel callback
   * - onTestNotification: () => void - Test notification callback
   */

  interface Props {
    preferences?: any;
    isLoading?: boolean;
    onSave?: (preferences: any) => void;
    onCancel?: () => void;
    onTestNotification?: () => void;
  }

  let {
    preferences = {},
    isLoading = false,
    onSave = () => {},
    onCancel = () => {},
    onTestNotification = () => {}
  }: Props = $props();

  let formData = $state({
    // Message notifications
    messageNotifications: preferences.messageNotifications !== false,
    messageFrequency: preferences.messageFrequency || 'immediate',
    messageEmail: preferences.messageEmail !== false,
    messagePush: preferences.messagePush !== false,
    messageSms: preferences.messageSms || false,
    // Match notifications
    matchNotifications: preferences.matchNotifications !== false,
    matchFrequency: preferences.matchFrequency || 'immediate',
    matchEmail: preferences.matchEmail !== false,
    matchPush: preferences.matchPush !== false,
    matchSms: preferences.matchSms || false,
    // System notifications
    systemNotifications: preferences.systemNotifications !== false,
    systemFrequency: preferences.systemFrequency || 'immediate',
    systemEmail: preferences.systemEmail || false,
    systemPush: preferences.systemPush !== false,
    systemSms: preferences.systemSms || false,
    // Marketing notifications
    marketingNotifications: preferences.marketingNotifications || false,
    marketingFrequency: preferences.marketingFrequency || 'weekly',
    marketingEmail: preferences.marketingEmail || false,
    marketingPush: preferences.marketingPush || false,
    // Do Not Disturb
    dndEnabled: preferences.dndEnabled || false,
    dndStartTime: preferences.dndStartTime || '22:00',
    dndEndTime: preferences.dndEndTime || '08:00'
  });

  let isDirty = $state(false);

  const frequencies = [
    { value: 'immediate', label: 'Immediate' },
    { value: 'daily', label: 'Daily Digest' },
    { value: 'weekly', label: 'Weekly Digest' }
  ];

  function handleInputChange() {
    isDirty = true;
  }

  function handleSave() {
    const updatedPreferences = {
      ...preferences,
      messageNotifications: formData.messageNotifications,
      messageFrequency: formData.messageFrequency,
      messageEmail: formData.messageEmail,
      messagePush: formData.messagePush,
      messageSms: formData.messageSms,
      matchNotifications: formData.matchNotifications,
      matchFrequency: formData.matchFrequency,
      matchEmail: formData.matchEmail,
      matchPush: formData.matchPush,
      matchSms: formData.matchSms,
      systemNotifications: formData.systemNotifications,
      systemFrequency: formData.systemFrequency,
      systemEmail: formData.systemEmail,
      systemPush: formData.systemPush,
      systemSms: formData.systemSms,
      marketingNotifications: formData.marketingNotifications,
      marketingFrequency: formData.marketingFrequency,
      marketingEmail: formData.marketingEmail,
      marketingPush: formData.marketingPush,
      dndEnabled: formData.dndEnabled,
      dndStartTime: formData.dndStartTime,
      dndEndTime: formData.dndEndTime
    };

    onSave(updatedPreferences);
    isDirty = false;
  }

  function handleCancel() {
    formData = {
      messageNotifications: preferences.messageNotifications !== false,
      messageFrequency: preferences.messageFrequency || 'immediate',
      messageEmail: preferences.messageEmail !== false,
      messagePush: preferences.messagePush !== false,
      messageSms: preferences.messageSms || false,
      matchNotifications: preferences.matchNotifications !== false,
      matchFrequency: preferences.matchFrequency || 'immediate',
      matchEmail: preferences.matchEmail !== false,
      matchPush: preferences.matchPush !== false,
      matchSms: preferences.matchSms || false,
      systemNotifications: preferences.systemNotifications !== false,
      systemFrequency: preferences.systemFrequency || 'immediate',
      systemEmail: preferences.systemEmail || false,
      systemPush: preferences.systemPush !== false,
      systemSms: preferences.systemSms || false,
      marketingNotifications: preferences.marketingNotifications || false,
      marketingFrequency: preferences.marketingFrequency || 'weekly',
      marketingEmail: preferences.marketingEmail || false,
      marketingPush: preferences.marketingPush || false,
      dndEnabled: preferences.dndEnabled || false,
      dndStartTime: preferences.dndStartTime || '22:00',
      dndEndTime: preferences.dndEndTime || '08:00'
    };
    isDirty = false;
    onCancel();
  }
</script>

<div class="notification-preferences">
  <div class="section-header">
    <h2>Notification Preferences</h2>
    <p>Control how and when you receive notifications</p>
  </div>

  <form on:submit|preventDefault={handleSave} class="settings-form">
    <!-- Message Notifications -->
    <div class="notification-section">
      <div class="section-title">
        <h3>💬 Message Notifications</h3>
        <label class="toggle-switch">
          <input
            type="checkbox"
            bind:checked={formData.messageNotifications}
            on:change={handleInputChange}
          />
          <span class="toggle-slider"></span>
        </label>
      </div>

      {#if formData.messageNotifications}
        <div class="notification-options">
          <div class="option-group">
            <label>Frequency</label>
            <select bind:value={formData.messageFrequency} on:change={handleInputChange}>
              {#each frequencies as freq (freq.value)}
                <option value={freq.value}>{freq.label}</option>
              {/each}
            </select>
          </div>

          <div class="delivery-methods">
            <label class="checkbox-option">
              <input type="checkbox" bind:checked={formData.messageEmail} on:change={handleInputChange} />
              <span>Email</span>
            </label>
            <label class="checkbox-option">
              <input type="checkbox" bind:checked={formData.messagePush} on:change={handleInputChange} />
              <span>Push</span>
            </label>
            <label class="checkbox-option">
              <input type="checkbox" bind:checked={formData.messageSms} on:change={handleInputChange} />
              <span>SMS</span>
            </label>
          </div>
        </div>
      {/if}
    </div>

    <!-- Match Notifications -->
    <div class="notification-section">
      <div class="section-title">
        <h3>❤️ Match Notifications</h3>
        <label class="toggle-switch">
          <input
            type="checkbox"
            bind:checked={formData.matchNotifications}
            on:change={handleInputChange}
          />
          <span class="toggle-slider"></span>
        </label>
      </div>

      {#if formData.matchNotifications}
        <div class="notification-options">
          <div class="option-group">
            <label>Frequency</label>
            <select bind:value={formData.matchFrequency} on:change={handleInputChange}>
              {#each frequencies as freq (freq.value)}
                <option value={freq.value}>{freq.label}</option>
              {/each}
            </select>
          </div>

          <div class="delivery-methods">
            <label class="checkbox-option">
              <input type="checkbox" bind:checked={formData.matchEmail} on:change={handleInputChange} />
              <span>Email</span>
            </label>
            <label class="checkbox-option">
              <input type="checkbox" bind:checked={formData.matchPush} on:change={handleInputChange} />
              <span>Push</span>
            </label>
            <label class="checkbox-option">
              <input type="checkbox" bind:checked={formData.matchSms} on:change={handleInputChange} />
              <span>SMS</span>
            </label>
          </div>
        </div>
      {/if}
    </div>

    <!-- System Notifications -->
    <div class="notification-section">
      <div class="section-title">
        <h3>ℹ️ System Notifications</h3>
        <label class="toggle-switch">
          <input
            type="checkbox"
            bind:checked={formData.systemNotifications}
            on:change={handleInputChange}
          />
          <span class="toggle-slider"></span>
        </label>
      </div>

      {#if formData.systemNotifications}
        <div class="notification-options">
          <div class="option-group">
            <label>Frequency</label>
            <select bind:value={formData.systemFrequency} on:change={handleInputChange}>
              {#each frequencies as freq (freq.value)}
                <option value={freq.value}>{freq.label}</option>
              {/each}
            </select>
          </div>

          <div class="delivery-methods">
            <label class="checkbox-option">
              <input type="checkbox" bind:checked={formData.systemEmail} on:change={handleInputChange} />
              <span>Email</span>
            </label>
            <label class="checkbox-option">
              <input type="checkbox" bind:checked={formData.systemPush} on:change={handleInputChange} />
              <span>Push</span>
            </label>
            <label class="checkbox-option">
              <input type="checkbox" bind:checked={formData.systemSms} on:change={handleInputChange} />
              <span>SMS</span>
            </label>
          </div>
        </div>
      {/if}
    </div>

    <!-- Marketing Notifications -->
    <div class="notification-section">
      <div class="section-title">
        <h3>📢 Marketing Notifications</h3>
        <label class="toggle-switch">
          <input
            type="checkbox"
            bind:checked={formData.marketingNotifications}
            on:change={handleInputChange}
          />
          <span class="toggle-slider"></span>
        </label>
      </div>

      {#if formData.marketingNotifications}
        <div class="notification-options">
          <div class="option-group">
            <label>Frequency</label>
            <select bind:value={formData.marketingFrequency} on:change={handleInputChange}>
              {#each frequencies as freq (freq.value)}
                <option value={freq.value}>{freq.label}</option>
              {/each}
            </select>
          </div>

          <div class="delivery-methods">
            <label class="checkbox-option">
              <input type="checkbox" bind:checked={formData.marketingEmail} on:change={handleInputChange} />
              <span>Email</span>
            </label>
            <label class="checkbox-option">
              <input type="checkbox" bind:checked={formData.marketingPush} on:change={handleInputChange} />
              <span>Push</span>
            </label>
          </div>
        </div>
      {/if}
    </div>

    <!-- Do Not Disturb -->
    <div class="notification-section">
      <div class="section-title">
        <h3>🔇 Do Not Disturb</h3>
        <label class="toggle-switch">
          <input
            type="checkbox"
            bind:checked={formData.dndEnabled}
            on:change={handleInputChange}
          />
          <span class="toggle-slider"></span>
        </label>
      </div>

      {#if formData.dndEnabled}
        <div class="notification-options">
          <div class="time-range">
            <div class="time-input">
              <label for="dnd-start">From</label>
              <input
                type="time"
                id="dnd-start"
                bind:value={formData.dndStartTime}
                on:change={handleInputChange}
              />
            </div>
            <div class="time-input">
              <label for="dnd-end">To</label>
              <input
                type="time"
                id="dnd-end"
                bind:value={formData.dndEndTime}
                on:change={handleInputChange}
              />
            </div>
          </div>
          <span class="help-text">Notifications will be silenced during this time</span>
        </div>
      {/if}
    </div>

    <!-- Test Notification -->
    <div class="test-section">
      <button
        type="button"
        class="btn-test"
        on:click={onTestNotification}
        disabled={isLoading}
      >
        📬 Send Test Notification
      </button>
    </div>

    <!-- Form Actions -->
    <div class="form-actions">
      <button
        type="button"
        class="btn-secondary"
        on:click={handleCancel}
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
  .notification-preferences {
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

  .notification-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    background: var(--bg-1);
    border: 1px solid var(--border-1);
    border-radius: 8px;
  }

  .section-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .section-title h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: var(--text-1);
  }

  .toggle-switch {
    position: relative;
    display: inline-flex;
    width: 44px;
    height: 24px;
    cursor: pointer;
  }

  .toggle-switch input {
    display: none;
  }

  .toggle-slider {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--border-1);
    border-radius: 12px;
    transition: all 200ms ease;
  }

  .toggle-slider::before {
    content: '';
    position: absolute;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: white;
    top: 2px;
    left: 2px;
    transition: all 200ms ease;
  }

  .toggle-switch input:checked ~ .toggle-slider {
    background: var(--accent);
  }

  .toggle-switch input:checked ~ .toggle-slider::before {
    left: 22px;
  }

  .notification-options {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--border-1);
  }

  .option-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .option-group label {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-2);
  }

  .option-group select {
    padding: 8px 10px;
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    border-radius: 6px;
    color: var(--text-1);
    font-size: 13px;
    cursor: pointer;
  }

  .delivery-methods {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }

  .checkbox-option {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    font-size: 13px;
    color: var(--text-2);
  }

  .checkbox-option input {
    cursor: pointer;
  }

  .time-range {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .time-input {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .time-input label {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-2);
  }

  .time-input input {
    padding: 8px 10px;
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    border-radius: 6px;
    color: var(--text-1);
    font-size: 13px;
  }

  .help-text {
    font-size: 12px;
    color: var(--text-3);
  }

  .test-section {
    display: flex;
    justify-content: center;
  }

  .btn-test {
    padding: 10px 20px;
    background: transparent;
    border: 1px solid var(--border-1);
    border-radius: 6px;
    color: var(--text-1);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 200ms ease;
  }

  .btn-test:hover:not(:disabled) {
    background: var(--bg-2);
    border-color: var(--border-2);
  }

  .btn-test:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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
    .notification-preferences {
      gap: 16px;
    }

    .section-header h2 {
      font-size: 18px;
    }

    .settings-form {
      gap: 16px;
    }

    .section-title {
      flex-direction: column;
      align-items: flex-start;
    }

    .time-range {
      grid-template-columns: 1fr;
    }

    .form-actions {
      flex-direction: column-reverse;
    }

    .btn-primary,
    .btn-secondary,
    .btn-test {
      width: 100%;
      justify-content: center;
    }
  }
</style>
