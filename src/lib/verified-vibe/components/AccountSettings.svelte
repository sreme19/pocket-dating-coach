<script lang="ts">
  import { untrack } from 'svelte';
  import VoiceOnboarding from './VoiceOnboarding.svelte';
  /**
   * AccountSettings Component
   *
   * Allows users to edit their account information.
   * Includes email, phone, and username fields.
   *
   * Props:
   * - account: any - User account data
   * - isLoading: boolean - Loading state
   * - onSave: (account: any) => void - Save callback
   * - onCancel: () => void - Cancel callback
   */

  interface Props {
    account?: any;
    isLoading?: boolean;
    onSave?: (account: any) => void;
    onCancel?: () => void;
  }

  let {
    account = {},
    isLoading = false,
    onSave = () => {},
    onCancel = () => {}
  }: Props = $props();

  let formData = $state(untrack(() => ({
    email: account.email || '',
    phone: account.phone || '',
    username: account.username || ''
  })));

  let errors = $state<Record<string, string>>({});
  let isDirty = $state(false);

  function validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  function validatePhone(phone: string): boolean {
    if (!phone) return true; // Phone is optional
    const phoneRegex = /^[\d\s\-\+\(\)]+$/;
    return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
  }

  function validateForm() {
    errors = {};

    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (formData.phone && !validatePhone(formData.phone)) {
      errors.phone = 'Please enter a valid phone number';
    }

    if (!formData.username.trim()) {
      errors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      errors.username = 'Username must be at least 3 characters';
    } else if (formData.username.length > 30) {
      errors.username = 'Username must be less than 30 characters';
    } else if (!/^[a-zA-Z0-9_-]+$/.test(formData.username)) {
      errors.username = 'Username can only contain letters, numbers, underscores, and hyphens';
    }

    return Object.keys(errors).length === 0;
  }

  function handleInputChange() {
    isDirty = true;
  }

  function handleSave() {
    if (!validateForm()) return;

    const updatedAccount = {
      ...account,
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      username: formData.username.trim()
    };

    onSave(updatedAccount);
    isDirty = false;
  }

  function handleCancel() {
    formData = {
      email: account.email || '',
      phone: account.phone || '',
      username: account.username || ''
    };
    isDirty = false;
    onCancel();
  }
</script>

<div class="account-settings">
  <div class="section-header">
    <h2>Account Information</h2>
    <p>Update your account details</p>
  </div>

  <form onsubmit={(e) => { e.preventDefault(); handleSave(); }} class="settings-form">
    <!-- Email -->
    <div class="form-group">
      <label for="email">Email Address *</label>
      <input
        type="email"
        id="email"
        bind:value={formData.email}
        onchange={handleInputChange}
        placeholder="Enter your email address"
        aria-describedby={errors.email ? 'email-error' : undefined}
      />
      {#if errors.email}
        <span id="email-error" class="error-message">{errors.email}</span>
      {/if}
      <span class="help-text">We'll use this to send you important updates</span>
    </div>

    <!-- Phone -->
    <div class="form-group">
      <label for="phone">Phone Number</label>
      <input
        type="tel"
        id="phone"
        bind:value={formData.phone}
        onchange={handleInputChange}
        placeholder="Enter your phone number (optional)"
        aria-describedby={errors.phone ? 'phone-error' : undefined}
      />
      {#if errors.phone}
        <span id="phone-error" class="error-message">{errors.phone}</span>
      {/if}
      <span class="help-text">Optional - used for SMS notifications</span>
    </div>

    <!-- Username -->
    <div class="form-group">
      <label for="username">Username *</label>
      <input
        type="text"
        id="username"
        bind:value={formData.username}
        onchange={handleInputChange}
        placeholder="Choose a unique username"
        maxlength="30"
        aria-describedby={errors.username ? 'username-error' : undefined}
      />
      {#if errors.username}
        <span id="username-error" class="error-message">{errors.username}</span>
      {/if}
      <span class="char-count">{formData.username.length}/30</span>
      <span class="help-text">Letters, numbers, underscores, and hyphens only</span>
    </div>

    <!-- Info Box -->
    <div class="info-box">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
      </svg>
      <p>
        Changing your email address will require verification. A confirmation link will be sent to your new email.
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

  <!-- Bestie voice calls (renders only for female users) -->
  <div class="voice-onboarding-block">
    <VoiceOnboarding />
  </div>
</div>

<style>
  .account-settings {
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

  .form-group label {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-1);
  }

  .form-group input {
    padding: 10px 12px;
    background: var(--bg-1);
    border: 1px solid var(--border-1);
    border-radius: 6px;
    color: var(--text-1);
    font-size: 14px;
    font-family: inherit;
    transition: all 200ms ease;
  }

  .form-group input:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.1);
  }

  .form-group input::placeholder {
    color: var(--text-4);
  }

  .error-message {
    font-size: 12px;
    color: #dc2626;
  }

  .char-count {
    font-size: 12px;
    color: var(--text-4);
    text-align: right;
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
    .account-settings {
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
