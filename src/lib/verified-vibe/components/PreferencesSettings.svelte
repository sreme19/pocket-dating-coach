<script lang="ts">
  import { untrack } from 'svelte';
  /**
   * PreferencesSettings Component
   *
   * Allows users to configure their preferences.
   * Includes language, timezone, and theme settings.
   *
   * Props:
   * - preferences: any - User preferences data
   * - isLoading: boolean - Loading state
   * - onSave: (preferences: any) => void - Save callback
   * - onCancel: () => void - Cancel callback
   */

  interface Props {
    preferences?: any;
    isLoading?: boolean;
    onSave?: (preferences: any) => void;
    onCancel?: () => void;
  }

  let {
    preferences = {},
    isLoading = false,
    onSave = () => {},
    onCancel = () => {}
  }: Props = $props();

  let formData = $state(untrack(() => ({
    language: preferences.language || 'en',
    timezone: preferences.timezone || 'UTC',
    theme: preferences.theme || 'light'
  })));

  let isDirty = $state(false);

  const languages = [
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Español' },
    { value: 'fr', label: 'Français' },
    { value: 'de', label: 'Deutsch' },
    { value: 'it', label: 'Italiano' },
    { value: 'pt', label: 'Português' },
    { value: 'ja', label: '日本語' },
    { value: 'zh', label: '中文' }
  ];

  const timezones = [
    'UTC',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Asia/Hong_Kong',
    'Australia/Sydney'
  ];

  const themes = [
    { value: 'light', label: 'Light', icon: '☀️' },
    { value: 'dark', label: 'Dark', icon: '🌙' },
    { value: 'auto', label: 'Auto', icon: '🔄' }
  ];

  function handleInputChange() {
    isDirty = true;
  }

  function handleSave() {
    const updatedPreferences = {
      ...preferences,
      language: formData.language,
      timezone: formData.timezone,
      theme: formData.theme
    };

    onSave(updatedPreferences);
    isDirty = false;
  }

  function handleCancel() {
    formData = {
      language: preferences.language || 'en',
      timezone: preferences.timezone || 'UTC',
      theme: preferences.theme || 'light'
    };
    isDirty = false;
    onCancel();
  }
</script>

<div class="preferences-settings">
  <div class="section-header">
    <h2>Preferences</h2>
    <p>Customize your experience</p>
  </div>

  <form onsubmit={(e) => { e.preventDefault(); handleSave(); }} class="settings-form">
    <!-- Language -->
    <div class="form-group">
      <label for="language">Language</label>
      <select
        id="language"
        bind:value={formData.language}
        onchange={handleInputChange}
      >
        {#each languages as lang (lang.value)}
          <option value={lang.value}>{lang.label}</option>
        {/each}
      </select>
      <span class="help-text">Choose your preferred language</span>
    </div>

    <!-- Timezone -->
    <div class="form-group">
      <label for="timezone">Timezone</label>
      <select
        id="timezone"
        bind:value={formData.timezone}
        onchange={handleInputChange}
      >
        {#each timezones as tz (tz)}
          <option value={tz}>{tz}</option>
        {/each}
      </select>
      <span class="help-text">Used for scheduling and time display</span>
    </div>

    <!-- Theme -->
    <div class="form-group">
      <span class="form-group-label">Theme</span>
      <div class="theme-options">
        {#each themes as theme (theme.value)}
          <label class="theme-option">
            <input
              type="radio"
              name="theme"
              value={theme.value}
              bind:group={formData.theme}
              onchange={handleInputChange}
            />
            <span class="theme-icon">{theme.icon}</span>
            <span class="theme-label">{theme.label}</span>
          </label>
        {/each}
      </div>
      <span class="help-text">Choose how the app looks</span>
    </div>

    <!-- Info Box -->
    <div class="info-box">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
      </svg>
      <p>
        Your preferences will be applied immediately. Some changes may require a page refresh to take effect.
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
  .preferences-settings {
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
    gap: 8px;
  }

  .form-group label,
  .form-group .form-group-label {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-1);
  }

  .form-group select {
    padding: 10px 12px;
    background: var(--bg-1);
    border: 1px solid var(--border-1);
    border-radius: 6px;
    color: var(--text-1);
    font-size: 14px;
    font-family: inherit;
    cursor: pointer;
    transition: all 200ms ease;
  }

  .form-group select:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.1);
  }

  .theme-options {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }

  .theme-option {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    background: var(--bg-1);
    border: 2px solid var(--border-1);
    border-radius: 6px;
    cursor: pointer;
    transition: all 200ms ease;
  }

  .theme-option input {
    cursor: pointer;
  }

  .theme-option input:checked ~ .theme-icon,
  .theme-option input:checked ~ .theme-label {
    color: var(--accent);
  }

  .theme-option:has(input:checked) {
    border-color: var(--accent);
    background: rgba(34, 197, 94, 0.05);
  }

  .theme-option:hover {
    border-color: var(--border-2);
  }

  .theme-icon {
    font-size: 20px;
  }

  .theme-label {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-1);
  }

  .help-text {
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
    .preferences-settings {
      gap: 16px;
    }

    .section-header h2 {
      font-size: 18px;
    }

    .settings-form {
      gap: 16px;
    }

    .theme-options {
      grid-template-columns: 1fr;
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
