<script lang="ts">
  import { fade, slide, scale } from 'svelte/transition';
  import type { IDExtractionResult } from '../types';
  import { ARCHETYPE_COLORS } from '../constants';

  /**
   * VerificationStep Component - ID Extraction
   *
   * Handles government ID photo upload and Claude Vision API integration for data extraction.
   * Features:
   * - File upload with drag-and-drop support
   * - Image preview
   * - Claude Vision API integration for ID data extraction
   * - Extracted data confirmation/editing
   * - Error handling with user-friendly messages
   * - Loading states
   * - Mobile responsive (375px-1024px)
   * - WCAG 2.1 AA accessibility
   *
   * @component
   * @example
   * ```svelte
   * <VerificationStep
   *   onSubmit={async (data) => {
   *     // Handle submission
   *   }}
   *   onCancel={() => {
   *     // Handle cancel
   *   }}
   * />
   * ```
   */

  interface Props {
    /** Callback when user confirms extracted data */
    onSubmit?: (data: IDExtractionResult) => Promise<void>;
    /** Callback when user cancels */
    onCancel?: () => void;
  }

  let { onSubmit, onCancel }: Props = $props();

  // State management
  let uploadedFile = $state<File | null>(null);
  let previewUrl = $state<string | null>(null);
  let extractedData = $state<IDExtractionResult | null>(null);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let isDragging = $state(false);
  let step = $state<'upload' | 'extracted' | 'confirmed'>('upload');

  // Form state for editing extracted data
  let editedData = $state<IDExtractionResult | null>(null);
  let isEditing = $state(false);

  /**
   * Handle file selection from input
   */
  function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      processFile(file);
    }
  }

  /**
   * Handle drag and drop
   */
  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    isDragging = true;
  }

  function handleDragLeave() {
    isDragging = false;
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    isDragging = false;
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      processFile(file);
    }
  }

  /**
   * Process uploaded file
   */
  function processFile(file: File) {
    error = null;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      error = 'Please upload an image file';
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      error = 'File size must be less than 5MB';
      return;
    }

    uploadedFile = file;

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      previewUrl = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  /**
   * Send image to Claude API for ID extraction
   */
  async function extractIDData() {
    if (!uploadedFile || !previewUrl) {
      error = 'Please upload an image first';
      return;
    }

    loading = true;
    error = null;

    try {
      // Convert image to base64
      const base64Image = previewUrl.split(',')[1];

      // Call API endpoint
      const response = await fetch('/api/verified-vibe/extract-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: base64Image,
          mimeType: uploadedFile.type
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to extract ID data');
      }

      const result = await response.json();
      extractedData = result.data;
      editedData = { ...result.data };
      step = 'extracted';
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to extract ID data. Please try again.';
    } finally {
      loading = false;
    }
  }

  /**
   * Handle re-upload
   */
  function handleReupload() {
    uploadedFile = null;
    previewUrl = null;
    extractedData = null;
    editedData = null;
    error = null;
    step = 'upload';
    isEditing = false;
  }

  /**
   * Toggle edit mode
   */
  function toggleEdit() {
    if (isEditing) {
      editedData = { ...extractedData } as IDExtractionResult;
    }
    isEditing = !isEditing;
  }

  /**
   * Handle confirm
   */
  async function handleConfirm() {
    if (!editedData) return;

    loading = true;
    error = null;

    try {
      if (onSubmit) {
        await onSubmit(editedData);
      }
      step = 'confirmed';
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to save data';
    } finally {
      loading = false;
    }
  }

  /**
   * Handle cancel
   */
  function handleCancel() {
    if (onCancel) {
      onCancel();
    }
  }

  /**
   * Update edited data field
   */
  function updateField(field: keyof IDExtractionResult, value: string) {
    if (editedData) {
      editedData[field] = value;
    }
  }
</script>

<div class="verification-step" transition:fade={{ duration: 300 }}>
  <!-- Upload Step -->
  {#if step === 'upload'}
    <div class="step-content" transition:slide={{ duration: 300, axis: 'y' }}>
      <div class="step-header">
        <h3 class="step-title">Government ID</h3>
        <p class="step-description">Upload a clear photo of your government ID (front or back)</p>
      </div>

      <!-- Upload Area -->
      <div
        class="upload-area"
        class:dragging={isDragging}
        ondragover={handleDragOver}
        ondragleave={handleDragLeave}
        ondrop={handleDrop}
        role="button"
        tabindex="0"
        aria-label="Upload ID photo"
      >
        <div class="upload-icon">📄</div>
        <p class="upload-text">Drag and drop your ID photo here</p>
        <p class="upload-hint">or click to select a file</p>
        <input
          type="file"
          accept="image/*"
          onchange={handleFileSelect}
          disabled={loading}
          aria-label="Select ID photo file"
          class="file-input"
        />
      </div>

      <!-- File Requirements -->
      <div class="requirements">
        <h4 class="requirements-title">Requirements:</h4>
        <ul class="requirements-list">
          <li>Clear, well-lit photo</li>
          <li>All text must be readable</li>
          <li>No glare or shadows</li>
          <li>JPG, PNG, or WebP format</li>
          <li>Max 5MB file size</li>
        </ul>
      </div>

      <!-- Error Message -->
      {#if error}
        <div class="error-message" transition:slide={{ duration: 300, axis: 'y' }} role="alert">
          <span class="error-icon">⚠️</span>
          <span class="error-text">{error}</span>
        </div>
      {/if}

      <!-- Preview -->
      {#if previewUrl}
        <div class="preview-section" transition:slide={{ duration: 300, axis: 'y' }}>
          <h4 class="preview-title">Preview</h4>
          <img src={previewUrl} alt="ID photo preview" class="preview-image" />
          <button
            class="btn btn-secondary"
            onclick={handleReupload}
            disabled={loading}
            aria-label="Upload a different photo"
          >
            Upload Different Photo
          </button>
        </div>
      {/if}

      <!-- Extract Button -->
      <div class="actions">
        <button
          class="btn btn-primary"
          onclick={extractIDData}
          disabled={!previewUrl || loading}
          aria-label="Extract ID information"
        >
          {#if loading}
            <span class="loading-spinner"></span>
            Extracting...
          {:else}
            Extract Information
          {/if}
        </button>
      </div>
    </div>
  {/if}

  <!-- Extracted Data Step -->
  {#if step === 'extracted'}
    <div class="step-content" transition:slide={{ duration: 300, axis: 'y' }}>
      <div class="step-header">
        <h3 class="step-title">Confirm Your Information</h3>
        <p class="step-description">Please review and confirm the extracted information</p>
      </div>

      <!-- Extracted Data Display -->
      {#if extractedData}
        <div class="extracted-data" transition:fade={{ duration: 300 }}>
          <!-- ID Number -->
          <div class="data-field">
            <label for="id-number" class="field-label">ID Number</label>
            {#if isEditing}
              <input
                id="id-number"
                type="text"
                class="field-input"
                value={editedData?.idNumber || ''}
                onchange={(e) => updateField('idNumber', e.currentTarget.value)}
                disabled={loading}
              />
            {:else}
              <div class="field-value">{extractedData.idNumber}</div>
            {/if}
          </div>

          <!-- Name -->
          <div class="data-field">
            <label for="id-name" class="field-label">Full Name</label>
            {#if isEditing}
              <input
                id="id-name"
                type="text"
                class="field-input"
                value={editedData?.idName || ''}
                onchange={(e) => updateField('idName', e.currentTarget.value)}
                disabled={loading}
              />
            {:else}
              <div class="field-value">{extractedData.idName}</div>
            {/if}
          </div>

          <!-- Date of Birth -->
          <div class="data-field">
            <label for="id-dob" class="field-label">Date of Birth</label>
            {#if isEditing}
              <input
                id="id-dob"
                type="text"
                class="field-input"
                value={editedData?.idDOB || ''}
                onchange={(e) => updateField('idDOB', e.currentTarget.value)}
                disabled={loading}
                placeholder="MM/DD/YYYY"
              />
            {:else}
              <div class="field-value">{extractedData.idDOB}</div>
            {/if}
          </div>

          <!-- Expiration Date (if available) -->
          {#if extractedData.expirationDate}
            <div class="data-field">
              <label for="expiration-date" class="field-label">Expiration Date</label>
              {#if isEditing}
                <input
                  id="expiration-date"
                  type="text"
                  class="field-input"
                  value={editedData?.expirationDate || ''}
                  onchange={(e) => updateField('expirationDate', e.currentTarget.value)}
                  disabled={loading}
                  placeholder="MM/DD/YYYY"
                />
              {:else}
                <div class="field-value">{extractedData.expirationDate}</div>
              {/if}
            </div>
          {/if}
        </div>

        <!-- Error Message -->
        {#if error}
          <div class="error-message" transition:slide={{ duration: 300, axis: 'y' }} role="alert">
            <span class="error-icon">⚠️</span>
            <span class="error-text">{error}</span>
          </div>
        {/if}

        <!-- Edit Toggle -->
        <button
          class="btn btn-secondary btn-edit"
          onclick={toggleEdit}
          disabled={loading}
          aria-label={isEditing ? 'Done editing' : 'Edit information'}
        >
          {isEditing ? 'Done Editing' : 'Edit Information'}
        </button>

        <!-- Actions -->
        <div class="actions">
          <button
            class="btn btn-secondary"
            onclick={handleReupload}
            disabled={loading}
            aria-label="Upload a different photo"
          >
            Re-upload
          </button>
          <button
            class="btn btn-primary"
            onclick={handleConfirm}
            disabled={loading}
            aria-label="Confirm and save information"
          >
            {#if loading}
              <span class="loading-spinner"></span>
              Confirming...
            {:else}
              Confirm
            {/if}
          </button>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Confirmed Step -->
  {#if step === 'confirmed'}
    <div class="step-content" transition:slide={{ duration: 300, axis: 'y' }}>
      <div class="success-message" transition:scale={{ duration: 300 }}>
        <div class="success-icon">✓</div>
        <h3 class="success-title">ID Verified</h3>
        <p class="success-description">Your government ID has been verified successfully</p>
      </div>
    </div>
  {/if}
</div>

<style>
  .verification-step {
    display: flex;
    flex-direction: column;
    gap: var(--gap-lg);
    width: 100%;
  }

  .step-content {
    display: flex;
    flex-direction: column;
    gap: var(--gap-lg);
  }

  /* Header */
  .step-header {
    text-align: center;
  }

  .step-title {
    font-size: var(--font-size-xl);
    font-weight: var(--font-weight-semibold);
    color: var(--color-vibe-text-1);
    margin: 0 0 var(--gap-sm);
  }

  .step-description {
    font-size: var(--font-size-base);
    color: var(--color-vibe-text-2);
    margin: 0;
    line-height: var(--line-height-relaxed);
  }

  /* Upload Area */
  .upload-area {
    border: 2px dashed var(--color-vibe-border);
    border-radius: var(--radius-lg);
    padding: var(--spacing-xl);
    text-align: center;
    cursor: pointer;
    transition: all 200ms ease;
    background: var(--color-vibe-bg-2);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--gap-md);
    will-change: border-color, background-color;
  }

  @media (hover: hover) {
    .upload-area:hover {
      border-color: var(--color-vibe-emerald);
      background: rgba(255, 59, 107, 0.05);
    }
  }

  .upload-area.dragging {
    border-color: var(--color-vibe-emerald);
    background: rgba(255, 59, 107, 0.1);
  }

  .upload-area:focus-within {
    outline: 2px solid var(--color-vibe-emerald);
    outline-offset: 2px;
  }

  .upload-icon {
    font-size: 48px;
    line-height: 1;
  }

  .upload-text {
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-semibold);
    color: var(--color-vibe-text-1);
    margin: 0;
  }

  .upload-hint {
    font-size: var(--font-size-sm);
    color: var(--color-vibe-text-3);
    margin: 0;
  }

  .file-input {
    display: none;
  }

  /* Requirements */
  .requirements {
    background: var(--color-vibe-bg-2);
    border-radius: var(--radius-md);
    padding: var(--spacing-lg);
  }

  .requirements-title {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--color-vibe-text-1);
    margin: 0 0 var(--gap-md);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .requirements-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: var(--gap-sm);
  }

  .requirements-list li {
    font-size: var(--font-size-sm);
    color: var(--color-vibe-text-2);
    display: flex;
    align-items: center;
    gap: var(--gap-sm);
  }

  .requirements-list li::before {
    content: '✓';
    color: var(--color-vibe-emerald);
    font-weight: var(--font-weight-bold);
    flex-shrink: 0;
  }

  /* Error Message */
  .error-message {
    display: flex;
    align-items: center;
    gap: var(--gap-md);
    padding: var(--spacing-md);
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: var(--radius-md);
    color: #ef4444;
  }

  .error-icon {
    font-size: 20px;
    flex-shrink: 0;
  }

  .error-text {
    font-size: var(--font-size-sm);
    flex: 1;
  }

  /* Preview Section */
  .preview-section {
    display: flex;
    flex-direction: column;
    gap: var(--gap-md);
  }

  .preview-title {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--color-vibe-text-1);
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .preview-image {
    width: 100%;
    max-height: 300px;
    object-fit: cover;
    border-radius: var(--radius-md);
    border: 1px solid var(--color-vibe-border);
  }

  /* Extracted Data */
  .extracted-data {
    display: flex;
    flex-direction: column;
    gap: var(--gap-lg);
    background: var(--color-vibe-bg-2);
    border-radius: var(--radius-lg);
    padding: var(--spacing-lg);
  }

  .data-field {
    display: flex;
    flex-direction: column;
    gap: var(--gap-sm);
  }

  .field-label {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--color-vibe-text-1);
  }

  .field-value {
    font-size: var(--font-size-base);
    color: var(--color-vibe-text-1);
    padding: var(--spacing-md);
    background: var(--color-vibe-bg-1);
    border-radius: var(--radius-md);
    border: 1px solid var(--color-vibe-border);
  }

  .field-input {
    font-size: var(--font-size-base);
    color: var(--color-vibe-text-1);
    padding: var(--spacing-md);
    background: var(--color-vibe-bg-1);
    border: 1px solid var(--color-vibe-border);
    border-radius: var(--radius-md);
    font-family: inherit;
    transition: all 200ms ease;
  }

  .field-input:focus {
    outline: none;
    border-color: var(--color-vibe-emerald);
    box-shadow: 0 0 0 3px rgba(255, 59, 107, 0.1);
  }

  .field-input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Success Message */
  .success-message {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--gap-md);
    padding: var(--spacing-xl);
    text-align: center;
  }

  .success-icon {
    font-size: 64px;
    line-height: 1;
    color: var(--color-vibe-emerald);
  }

  .success-title {
    font-size: var(--font-size-xl);
    font-weight: var(--font-weight-semibold);
    color: var(--color-vibe-text-1);
    margin: 0;
  }

  .success-description {
    font-size: var(--font-size-base);
    color: var(--color-vibe-text-2);
    margin: 0;
  }

  /* Actions */
  .actions {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--gap-md);
  }

  .btn {
    padding: var(--spacing-md) var(--spacing-lg);
    border-radius: var(--radius-lg);
    border: none;
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-semibold);
    cursor: pointer;
    transition: all 200ms ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--gap-sm);
    font-family: inherit;
    min-height: 44px;
    touch-action: manipulation;
    will-change: opacity, transform;
  }

  @media (prefers-reduced-motion: reduce) {
    .btn {
      transition: none;
      will-change: auto;
    }
  }

  .btn-primary {
    background: var(--color-vibe-emerald);
    color: white;
  }

  @media (hover: hover) {
    .btn-primary:hover:not(:disabled) {
      opacity: 0.9;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(255, 59, 107, 0.3);
    }
  }

  .btn-primary:active:not(:disabled) {
    transform: translateY(0);
  }

  .btn-secondary {
    background: var(--color-vibe-bg-2);
    color: var(--color-vibe-text-1);
    border: 1px solid var(--color-vibe-border);
  }

  @media (hover: hover) {
    .btn-secondary:hover:not(:disabled) {
      background: var(--color-vibe-bg-3);
      border-color: var(--color-vibe-border);
    }
  }

  .btn-secondary:active:not(:disabled) {
    opacity: 0.8;
  }

  .btn-edit {
    width: 100%;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn:focus-visible {
    outline: 2px solid var(--color-vibe-emerald);
    outline-offset: 2px;
  }

  .loading-spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Mobile Responsive */
  @media (max-width: 767px) {
    .step-title {
      font-size: var(--font-size-lg);
    }

    .step-description {
      font-size: var(--font-size-sm);
    }

    .upload-area {
      padding: var(--spacing-lg);
      gap: var(--gap-md);
    }

    .upload-icon {
      font-size: 40px;
    }

    .upload-text {
      font-size: var(--font-size-sm);
    }

    .upload-hint {
      font-size: var(--font-size-xs);
    }

    .preview-image {
      max-height: 250px;
    }

    .extracted-data {
      padding: var(--spacing-md);
      gap: var(--gap-md);
    }

    .actions {
      grid-template-columns: 1fr;
    }

    .btn {
      padding: var(--spacing-md);
      font-size: var(--font-size-sm);
    }

    .success-icon {
      font-size: 56px;
    }

    .success-title {
      font-size: var(--font-size-lg);
    }

    .success-description {
      font-size: var(--font-size-sm);
    }
  }

  /* Tablet Responsive */
  @media (min-width: 768px) and (max-width: 1023px) {
    .actions {
      grid-template-columns: 1fr 1fr;
    }
  }

  /* Desktop Responsive */
  @media (min-width: 1024px) {
    .actions {
      grid-template-columns: 1fr 1fr;
    }
  }
</style>
