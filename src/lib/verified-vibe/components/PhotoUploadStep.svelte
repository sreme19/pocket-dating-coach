<script lang="ts">
  import { fade, slide, scale } from 'svelte/transition';
  // PhotoConsistencyResult import archived with consistency check feature

  interface Props {
    onSubmit?: (data: { photos: File[]; labels: Record<string, string> }) => Promise<void>;
    onCancel?: () => void;
  }

  let { onSubmit, onCancel }: Props = $props();

  // State management
  let uploadedFiles = $state<File[]>([]);
  let previewUrls = $state<string[]>([]);
  let photoLabels = $state<Record<string, string>>({});
  let loading = $state(false);
  let error = $state<string | null>(null);
  let isDragging = $state(false);
  let step = $state<'upload' | 'label'>('upload');
  let fileInputEl = $state<HTMLInputElement | null>(null);

  const PHOTO_LABELS = ['lead', 'warmth', 'lifestyle', 'conversation', 'social'];
  const MIN_PHOTOS = 1;
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    processFiles(files);
  }

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
    const files = Array.from(event.dataTransfer?.files || []);
    processFiles(files);
  }

  function processFiles(files: File[]) {
    error = null;

    const invalidFiles = files.filter(f => !f.type.startsWith('image/'));
    if (invalidFiles.length > 0) {
      error = 'Please upload only image files';
      return;
    }

    const oversizedFiles = files.filter(f => f.size > MAX_FILE_SIZE);
    if (oversizedFiles.length > 0) {
      error = 'Some files exceed 5MB limit';
      return;
    }

    if (files.length < MIN_PHOTOS) {
      error = `Please upload at least ${MIN_PHOTOS} photos`;
      return;
    }

    uploadedFiles = files;
    previewUrls = [];
    // Auto-assign labels in order
    photoLabels = Object.fromEntries(files.map((_, i) => [i, PHOTO_LABELS[i] ?? `photo-${i + 1}`]));

    files.forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        previewUrls[index] = e.target?.result as string;
        previewUrls = previewUrls;
      };
      reader.readAsDataURL(file);
    });

    step = 'label';
  }

  async function handleSubmit() {
    if (!isLabelComplete()) {
      error = 'Please label all photos';
      return;
    }

    loading = true;
    error = null;

    try {
      if (onSubmit) {
        await onSubmit({
          photos: uploadedFiles,
          labels: photoLabels
        });
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to save photos';
    } finally {
      loading = false;
    }
  }

  function handleReupload() {
    uploadedFiles = [];
    previewUrls = [];
    photoLabels = {};
    error = null;
    step = 'upload';
  }

  /* ARCHIVED: photo consistency check (re-enable when needed)
  async function checkConsistency() { ... calls /api/verified-vibe/check-photo-consistency ... }
  async function handleConfirm() { ... requires consistencyResult.consistent ... }
  See git history for full implementation.
  */

  function isLabelComplete(): boolean {
    // Labels are auto-assigned on upload, so just verify all photos have one
    return uploadedFiles.every((_, i) => !!photoLabels[i]);
  }

  function handleCancel() {
    if (onCancel) {
      onCancel();
    }
  }
</script>

<div class="photo-upload-step" transition:fade={{ duration: 300 }}>
  <!-- Upload Step -->
  {#if step === 'upload'}
    <div class="step-content" transition:slide={{ duration: 300, axis: 'y' }}>
      <div class="step-header">
        <h3 class="step-title">Photo Story</h3>
        <p class="step-description">Upload photos that tell your story</p>
      </div>

      <!-- Upload Area -->
      <div
        class="upload-area"
        class:dragging={isDragging}
        ondragover={handleDragOver}
        ondragleave={handleDragLeave}
        ondrop={handleDrop}
        onclick={() => fileInputEl?.click()}
        role="button"
        tabindex="0"
        aria-label="Upload photos"
      >
        <div class="upload-icon">🖼️</div>
        <p class="upload-text">Drag and drop your photos here</p>
        <p class="upload-hint">or click to select files</p>
        <input
          type="file"
          accept="image/*"
          multiple
          onchange={handleFileSelect}
          disabled={loading}
          aria-label="Select photo files"
          class="file-input"
          bind:this={fileInputEl}
        />
      </div>

      <!-- Error Message -->
      {#if error}
        <div class="error-message" transition:slide={{ duration: 300, axis: 'y' }} role="alert">
          <span class="error-icon">⚠️</span>
          <span class="error-text">{error}</span>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Label Step -->
  {#if step === 'label'}
    <div class="step-content" transition:slide={{ duration: 300, axis: 'y' }}>
      <div class="step-header">
        <h3 class="step-title">Label Your Photos</h3>
        <p class="step-description">Tell us what each photo represents</p>
      </div>

      <!-- Photos Grid -->
      <div class="photos-grid">
        {#each uploadedFiles as file, index (index)}
          <div class="photo-item" transition:scale={{ duration: 300 }}>
            <div class="photo-preview">
              {#if previewUrls[index]}
                <img src={previewUrls[index]} alt="Photo {index + 1}" />
              {/if}
            </div>
            <p class="photo-auto-label">{(PHOTO_LABELS[index] ?? `photo-${index + 1}`).charAt(0).toUpperCase() + (PHOTO_LABELS[index] ?? `photo-${index + 1}`).slice(1)}</p>
          </div>
        {/each}
      </div>

      <!-- Error Message -->
      {#if error}
        <div class="error-message" transition:slide={{ duration: 300, axis: 'y' }} role="alert">
          <span class="error-icon">⚠️</span>
          <span class="error-text">{error}</span>
        </div>
      {/if}

      <!-- Actions -->
      <div class="actions">
        <button
          class="btn btn-secondary"
          onclick={handleReupload}
          disabled={loading}
          tabindex="0"
          aria-label="Upload different photos"
        >
          Re-upload
        </button>
        <button
          class="btn btn-primary"
          onclick={handleSubmit}
          disabled={uploadedFiles.length === 0 || loading}
          tabindex="0"
          aria-label="Continue to next step"
        >
          {#if loading}
            <span class="loading-spinner"></span>
            Saving...
          {:else}
            Next
          {/if}
        </button>
      </div>
    </div>
  {/if}

  <!-- ARCHIVED: Checking and Result steps removed. See git history to restore. -->
</div>

<style>
  .photo-upload-step {
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
      background: rgba(16, 185, 129, 0.05);
    }
  }

  .upload-area.dragging {
    border-color: var(--color-vibe-emerald);
    background: rgba(16, 185, 129, 0.1);
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

  /* Photos Grid */
  .photos-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: var(--gap-md);
  }

  .photo-item {
    display: flex;
    flex-direction: column;
    gap: var(--gap-sm);
  }

  .photo-preview {
    width: 100%;
    aspect-ratio: 1;
    border-radius: var(--radius-md);
    overflow: hidden;
    border: 1px solid var(--color-vibe-border);
    background: var(--color-vibe-bg-2);
  }

  .photo-preview img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .photo-auto-label {
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-semibold);
    color: var(--color-vibe-text-3);
    text-align: center;
    text-transform: capitalize;
    letter-spacing: 0.03em;
    margin: 0;
  }

  /* Checking State */
  .checking-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--gap-lg);
    padding: var(--spacing-xl);
    text-align: center;
  }

  .checking-spinner {
    width: 48px;
    height: 48px;
    border: 3px solid rgba(16, 185, 129, 0.2);
    border-top-color: var(--color-vibe-emerald);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .checking-title {
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-semibold);
    color: var(--color-vibe-text-1);
    margin: 0;
  }

  .checking-description {
    font-size: var(--font-size-base);
    color: var(--color-vibe-text-2);
    margin: 0;
  }

  /* Result Container */
  .result-container {
    display: flex;
    flex-direction: column;
    gap: var(--gap-lg);
  }

  .result-success,
  .result-failure {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--gap-md);
    padding: var(--spacing-xl);
    border-radius: var(--radius-lg);
    text-align: center;
  }

  .result-success {
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  .result-failure {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  .result-icon {
    font-size: 48px;
    line-height: 1;
  }

  .result-success .result-icon {
    color: var(--color-vibe-emerald);
  }

  .result-failure .result-icon {
    color: #ef4444;
  }

  .result-title {
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-semibold);
    color: var(--color-vibe-text-1);
    margin: 0;
  }

  .result-description {
    font-size: var(--font-size-base);
    color: var(--color-vibe-text-2);
    margin: 0;
  }

  .result-hint {
    font-size: var(--font-size-sm);
    color: var(--color-vibe-text-3);
    margin: 0;
  }

  .confidence-badge {
    display: flex;
    align-items: center;
    gap: var(--gap-sm);
    padding: var(--spacing-md) var(--spacing-lg);
    background: var(--color-vibe-bg-2);
    border-radius: var(--radius-md);
    margin-top: var(--gap-md);
  }

  .confidence-label {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--color-vibe-text-2);
  }

  .confidence-value {
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-bold);
    color: var(--color-vibe-emerald);
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
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
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

    .photos-grid {
      grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
      gap: var(--gap-sm);
    }

    .actions {
      grid-template-columns: 1fr;
    }

    .btn {
      padding: var(--spacing-md);
      font-size: var(--font-size-sm);
    }

    .result-success,
    .result-failure {
      padding: var(--spacing-lg);
    }

    .result-icon {
      font-size: 40px;
    }

    .result-title {
      font-size: var(--font-size-base);
    }

    .result-description {
      font-size: var(--font-size-sm);
    }

    .checking-spinner {
      width: 40px;
      height: 40px;
    }

    .checking-title {
      font-size: var(--font-size-base);
    }

    .checking-description {
      font-size: var(--font-size-sm);
    }
  }

  /* Tablet Responsive */
  @media (min-width: 768px) and (max-width: 1023px) {
    .photos-grid {
      grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    }

    .actions {
      grid-template-columns: 1fr 1fr;
    }
  }

  /* Desktop Responsive */
  @media (min-width: 1024px) {
    .photos-grid {
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    }

    .actions {
      grid-template-columns: 1fr 1fr;
    }
  }
</style>
