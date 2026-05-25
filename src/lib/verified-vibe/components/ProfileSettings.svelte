<script lang="ts">
  /**
   * ProfileSettings Component
   *
   * Allows users to edit their profile information.
   * Includes name, bio, interests, and looking for fields.
   *
   * Props:
   * - profile: any - User profile data
   * - isLoading: boolean - Loading state
   * - onSave: (profile: any) => void - Save callback
   * - onCancel: () => void - Cancel callback
   */

  import { fade } from 'svelte/transition';
  import { untrack } from 'svelte';

  interface Props {
    profile?: any;
    isLoading?: boolean;
    onSave?: (profile: any) => void;
    onCancel?: () => void;
  }

  let {
    profile = {},
    isLoading = false,
    onSave = () => {},
    onCancel = () => {}
  }: Props = $props();

  let formData = $state(untrack(() => ({
    firstName: profile.firstName || '',
    lastName: profile.lastName || '',
    bio: profile.bio || '',
    interests: profile.interests?.join(', ') || '',
    lookingFor: profile.lookingFor || ''
  })));

  let errors = $state<Record<string, string>>({});
  let isDirty = $state(false);

  function validateForm() {
    errors = {};

    if (!formData.firstName.trim()) {
      errors.firstName = 'First name is required';
    }

    if (formData.firstName.length > 50) {
      errors.firstName = 'First name must be less than 50 characters';
    }

    if (formData.bio.length > 500) {
      errors.bio = 'Bio must be less than 500 characters';
    }

    if (formData.lookingFor.length > 200) {
      errors.lookingFor = 'Looking for must be less than 200 characters';
    }

    return Object.keys(errors).length === 0;
  }

  function handleInputChange() {
    isDirty = true;
  }

  function handleSave() {
    if (!validateForm()) return;

    const updatedProfile = {
      ...profile,
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      bio: formData.bio.trim(),
      interests: formData.interests
        .split(',')
        .map((i: string) => i.trim())
        .filter((i: string) => i),
      lookingFor: formData.lookingFor.trim()
    };

    onSave(updatedProfile);
    isDirty = false;
  }

  function handleCancel() {
    formData = {
      firstName: profile.firstName || '',
      lastName: profile.lastName || '',
      bio: profile.bio || '',
      interests: profile.interests?.join(', ') || '',
      lookingFor: profile.lookingFor || ''
    };
    isDirty = false;
    onCancel();
  }
</script>

<div class="profile-settings">
  <div class="section-header">
    <h2>Profile Information</h2>
    <p>Update your profile details</p>
  </div>

  <form onsubmit={(e) => { e.preventDefault(); handleSave(); }} class="settings-form">
    <!-- First Name -->
    <div class="form-group">
      <label for="firstName">First Name *</label>
      <input
        type="text"
        id="firstName"
        bind:value={formData.firstName}
        onchange={handleInputChange}
        placeholder="Enter your first name"
        maxlength="50"
        aria-describedby={errors.firstName ? 'firstName-error' : undefined}
      />
      {#if errors.firstName}
        <span id="firstName-error" class="error-message">{errors.firstName}</span>
      {/if}
      <span class="char-count">{formData.firstName.length}/50</span>
    </div>

    <!-- Last Name -->
    <div class="form-group">
      <label for="lastName">Last Name</label>
      <input
        type="text"
        id="lastName"
        bind:value={formData.lastName}
        onchange={handleInputChange}
        placeholder="Enter your last name"
        maxlength="50"
      />
      <span class="char-count">{formData.lastName.length}/50</span>
    </div>

    <!-- Bio -->
    <div class="form-group">
      <label for="bio">Bio</label>
      <textarea
        id="bio"
        bind:value={formData.bio}
        onchange={handleInputChange}
        placeholder="Tell us about yourself"
        maxlength="500"
        rows="4"
        aria-describedby={errors.bio ? 'bio-error' : undefined}
      ></textarea>
      {#if errors.bio}
        <span id="bio-error" class="error-message">{errors.bio}</span>
      {/if}
      <span class="char-count">{formData.bio.length}/500</span>
    </div>

    <!-- Interests -->
    <div class="form-group">
      <label for="interests">Interests</label>
      <input
        type="text"
        id="interests"
        bind:value={formData.interests}
        onchange={handleInputChange}
        placeholder="Enter interests separated by commas (e.g., hiking, reading, cooking)"
      />
      <span class="help-text">Separate multiple interests with commas</span>
    </div>

    <!-- Looking For -->
    <div class="form-group">
      <label for="lookingFor">Looking For</label>
      <textarea
        id="lookingFor"
        bind:value={formData.lookingFor}
        onchange={handleInputChange}
        placeholder="What are you looking for?"
        maxlength="200"
        rows="3"
        aria-describedby={errors.lookingFor ? 'lookingFor-error' : undefined}
      ></textarea>
      {#if errors.lookingFor}
        <span id="lookingFor-error" class="error-message">{errors.lookingFor}</span>
      {/if}
      <span class="char-count">{formData.lookingFor.length}/200</span>
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
  .profile-settings {
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

  .form-group input,
  .form-group textarea {
    padding: 10px 12px;
    background: var(--bg-1);
    border: 1px solid var(--border-1);
    border-radius: 6px;
    color: var(--text-1);
    font-size: 14px;
    font-family: inherit;
    transition: all 200ms ease;
  }

  .form-group input:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.1);
  }

  .form-group input::placeholder,
  .form-group textarea::placeholder {
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
    .profile-settings {
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
  }
</style>
