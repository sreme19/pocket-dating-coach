<script lang="ts">
  import { fade, slide } from 'svelte/transition';

  interface Props {
    onSubmit?: (data: { spendingImage: string; mimeType: string }) => Promise<void>;
    onCancel?: () => void;
  }

  let { onSubmit, onCancel }: Props = $props();

  let loading = $state(false);
  let error = $state<string | null>(null);
  let selectedFile = $state<File | null>(null);
  let preview = $state<string | null>(null);
  let step = $state<'upload' | 'review' | 'submitting'>('upload');

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

  function handleFileSelect(event: Event) {
    error = null;
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      error = 'File is too large. Maximum size is 10MB.';
      return;
    }

    // Validate file type
    if (!ACCEPTED_TYPES.includes(file.type)) {
      error = 'Invalid file type. Please upload a JPEG, PNG, or WebP image.';
      return;
    }

    selectedFile = file;

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      preview = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  function handleRemoveFile() {
    selectedFile = null;
    preview = null;
    error = null;
  }

  async function handleSubmit() {
    error = null;

    if (!selectedFile || !preview) {
      error = 'Please select a spending image';
      return;
    }

    if (!onSubmit) return;

    loading = true;
    step = 'submitting';

    try {
      // Convert to base64
      const base64 = preview.split(',')[1];
      await onSubmit({
        spendingImage: base64,
        mimeType: selectedFile.type
      });
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to submit spending image';
      step = 'review';
    } finally {
      loading = false;
    }
  }

  function handleBack() {
    error = null;
    if (step === 'review') {
      step = 'upload';
    } else if (onCancel) {
      onCancel();
    }
  }
</script>

<div class="spending-upload-step">
  <!-- Header -->
  <div class="header" transition:fade={{ duration: 200 }}>
    <div class="header-content">
      <h2 class="title">
        {#if step === 'upload'}
          Spending Verification
        {:else if step === 'review'}
          Review Your Upload
        {:else}
          Analyzing...
        {/if}
      </h2>
      <p class="subtitle">
        {#if step === 'upload'}
          Upload a bank statement or spending screenshot to verify your spending pattern
        {:else if step === 'review'}
          Make sure the image is clear and readable
        {:else}
          Processing your spending image...
        {/if}
      </p>
    </div>
  </div>

  <!-- Error Message -->
  {#if error}
    <div class="error-message" role="alert" transition:slide={{ duration: 200 }}>
      <span class="error-icon">⚠️</span>
      <span class="error-text">{error}</span>
    </div>
  {/if}

  <!-- Upload View -->
  {#if step === 'upload'}
    <div class="upload-container" transition:fade={{ duration: 200 }}>
      <div class="upload-info">
        <p class="info-title">What to upload:</p>
        <ul class="info-list">
          <li>Bank statement screenshot (last 3 months)</li>
          <li>Credit card statement</li>
          <li>Payment app screenshot (Venmo, PayPal, etc.)</li>
          <li>Any proof of spending pattern</li>
        </ul>
        <p class="info-note">
          💡 Make sure the image is clear and readable. Personal information will be analyzed by AI and not stored.
        </p>
      </div>

      {#if !selectedFile}
        <div 
          class="upload-area" 
          role="button" 
          tabindex="0" 
          onclick={() => document.querySelector('.upload-area input')?.click()}
          onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              document.querySelector('.upload-area input')?.click();
            }
          }}
        >
          <div class="upload-icon">📊</div>
          <p class="upload-text">Click to upload or drag and drop</p>
          <p class="upload-hint">JPEG, PNG, or WebP (max 10MB)</p>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onchange={handleFileSelect}
            disabled={loading}
            aria-label="Upload spending image"
          />
        </div>
      {:else}
        <div class="file-preview" transition:fade={{ duration: 200 }}>
          <div class="preview-image">
            {#if preview}
              <img src={preview} alt="" />
            {/if}
          </div>
          <div class="file-info">
            <p class="file-name">{selectedFile.name}</p>
            <p class="file-size">{(selectedFile.size / 1024).toFixed(2)} KB</p>
          </div>
          <button
            class="remove-button"
            onclick={handleRemoveFile}
            disabled={loading}
            aria-label="Remove selected file"
          >
            ✕
          </button>
        </div>
      {/if}
    </div>

    <!-- Navigation Buttons -->
    <div class="button-group">
      <button
        class="button button-secondary"
        onclick={handleBack}
        disabled={loading}
        aria-label="Cancel spending verification"
      >
        Cancel
      </button>

      <button
        class="button button-primary"
        onclick={() => { step = 'review'; }}
        disabled={loading || !selectedFile}
        aria-label="Review spending image"
      >
        Review →
      </button>
    </div>
  {/if}

  <!-- Review View -->
  {#if step === 'review' || step === 'submitting'}
    <div class="review-container" transition:fade={{ duration: 200 }}>
      {#if preview}
        <div class="review-image">
          <img src={preview} alt="" />
        </div>
      {/if}

      <div class="review-info">
        <p class="review-label">File: {selectedFile?.name}</p>
        <p class="review-label">Size: {((selectedFile?.size || 0) / 1024).toFixed(2)} KB</p>
      </div>

      <!-- Review Navigation -->
      <div class="button-group">
        <button
          class="button button-secondary"
          onclick={handleBack}
          disabled={loading}
          aria-label="Go back to upload"
        >
          ← Back
        </button>

        <button
          class="button button-primary"
          onclick={handleSubmit}
          disabled={loading}
          aria-label="Submit spending image"
        >
          {#if loading}
            Analyzing...
          {:else}
            Submit
          {/if}
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .spending-upload-step {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1.5rem;
    max-width: 600px;
    margin: 0 auto;
  }

  .header {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .header-content {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .title {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--color-vibe-text-1, #111827);
    margin: 0;
  }

  .subtitle {
    font-size: 0.95rem;
    color: var(--color-vibe-text-2, #374151);
    margin: 0;
  }

  .error-message {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem;
    background-color: #fee2e2;
    border-left: 4px solid #ef4444;
    border-radius: 0.5rem;
  }

  .error-icon {
    font-size: 1.25rem;
    flex-shrink: 0;
  }

  .error-text {
    color: #991b1b;
    font-size: 0.95rem;
  }

  .upload-container {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .upload-info {
    padding: 1rem;
    background-color: var(--color-vibe-bg-2, #f9fafb);
    border-radius: 0.5rem;
    border: 1px solid var(--color-vibe-border, #e5e7eb);
  }

  .info-title {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--color-vibe-text-1, #111827);
    margin: 0 0 0.5rem;
  }

  .info-list {
    list-style: none;
    padding: 0;
    margin: 0 0 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .info-list li {
    font-size: 0.9rem;
    color: var(--color-vibe-text-2, #374151);
    padding-left: 1.5rem;
    position: relative;
  }

  .info-list li::before {
    content: '✓';
    position: absolute;
    left: 0;
    color: var(--color-vibe-emerald, #10b981);
    font-weight: bold;
  }

  .info-note {
    font-size: 0.85rem;
    color: var(--color-vibe-text-3, #6b7280);
    margin: 0;
    line-height: 1.4;
  }

  .upload-area {
    border: 2px dashed var(--color-vibe-border, #e5e7eb);
    border-radius: 0.75rem;
    padding: 2rem 1.5rem;
    text-align: center;
    cursor: pointer;
    transition: all 0.2s ease;
    background-color: var(--color-vibe-bg-2, #f9fafb);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  .upload-area:hover {
    border-color: var(--color-vibe-emerald, #10b981);
    background-color: #f0fdf4;
  }

  .upload-area input {
    display: none;
  }

  .upload-icon {
    font-size: 2.5rem;
    margin-bottom: 0.5rem;
  }

  .upload-text {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--color-vibe-text-1, #111827);
    margin: 0;
  }

  .upload-hint {
    font-size: 0.85rem;
    color: var(--color-vibe-text-3, #6b7280);
    margin: 0;
  }

  .file-preview {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background-color: var(--color-vibe-bg-2, #f9fafb);
    border: 1px solid var(--color-vibe-border, #e5e7eb);
    border-radius: 0.5rem;
  }

  .preview-image {
    width: 80px;
    height: 80px;
    border-radius: 0.375rem;
    overflow: hidden;
    background-color: var(--color-vibe-bg-3, #f3f4f6);
    flex-shrink: 0;
  }

  .preview-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .file-info {
    flex: 1;
    min-width: 0;
  }

  .file-name {
    font-size: 0.95rem;
    font-weight: 500;
    color: var(--color-vibe-text-1, #111827);
    margin: 0 0 0.25rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .file-size {
    font-size: 0.85rem;
    color: var(--color-vibe-text-3, #6b7280);
    margin: 0;
  }

  .remove-button {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background-color: #fee2e2;
    border: none;
    color: #ef4444;
    font-size: 1.25rem;
    cursor: pointer;
    display: grid;
    place-items: center;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .remove-button:hover:not(:disabled) {
    background-color: #fecaca;
  }

  .remove-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .review-container {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .review-image {
    border-radius: 0.75rem;
    overflow: hidden;
    background-color: var(--color-vibe-bg-2, #f9fafb);
    max-height: 400px;
  }

  .review-image img {
    width: 100%;
    height: auto;
    display: block;
  }

  .review-info {
    padding: 1rem;
    background-color: var(--color-vibe-bg-2, #f9fafb);
    border-radius: 0.5rem;
    border: 1px solid var(--color-vibe-border, #e5e7eb);
  }

  .review-label {
    font-size: 0.9rem;
    color: var(--color-vibe-text-2, #374151);
    margin: 0 0 0.5rem;
  }

  .review-label:last-child {
    margin-bottom: 0;
  }

  .button-group {
    display: flex;
    gap: 1rem;
    justify-content: space-between;
  }

  .button {
    flex: 1;
    padding: 1rem;
    border: none;
    border-radius: 0.5rem;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    min-height: 44px;
  }

  .button-primary {
    background-color: var(--color-vibe-emerald, #10b981);
    color: white;
  }

  .button-primary:hover:not(:disabled) {
    background-color: #059669;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
  }

  .button-primary:disabled {
    background-color: #d1d5db;
    cursor: not-allowed;
    opacity: 0.6;
  }

  .button-secondary {
    background-color: var(--color-vibe-bg-2, #f9fafb);
    color: var(--color-vibe-text-1, #111827);
    border: 1px solid var(--color-vibe-border, #e5e7eb);
  }

  .button-secondary:hover:not(:disabled) {
    background-color: var(--color-vibe-bg-3, #f3f4f6);
    border-color: var(--color-vibe-text-2, #374151);
  }

  .button-secondary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* Mobile Responsive */
  @media (max-width: 767px) {
    .spending-upload-step {
      padding: 1rem;
      gap: 1rem;
    }

    .title {
      font-size: 1.25rem;
    }

    .upload-area {
      padding: 1.5rem 1rem;
    }

    .file-preview {
      gap: 0.75rem;
      padding: 0.75rem;
    }

    .preview-image {
      width: 70px;
      height: 70px;
    }

    .button-group {
      flex-direction: column;
      gap: 0.75rem;
    }

    .button {
      width: 100%;
    }
  }

  /* Dark mode support */
  @media (prefers-color-scheme: dark) {
    .title,
    .upload-text,
    .file-name {
      color: var(--color-vibe-text-1, #f9fafb);
    }

    .subtitle,
    .error-text {
      color: var(--color-vibe-text-2, #d1d5db);
    }

    .upload-area {
      background-color: var(--color-vibe-bg-3, #1f2937);
    }

    .upload-area:hover {
      background-color: rgba(16, 185, 129, 0.1);
    }
  }
</style>
