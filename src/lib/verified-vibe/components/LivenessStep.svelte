<script lang="ts">
  import { fade, slide, scale } from 'svelte/transition';
  import type { LivenessCheckResult } from '../types';

  /**
   * LivenessStep Component - Selfie Capture & Liveness Verification
   *
   * Handles selfie photo upload and Claude Vision API integration for liveness check.
   * Compares selfie to ID photo to verify the user is the same person.
   */

  interface Props {
    idPhotoBase64: string;
    onSubmit?: (data: LivenessCheckResult) => Promise<void>;
    onCancel?: () => void;
  }

  let { idPhotoBase64, onSubmit, onCancel }: Props = $props();

  // State management
  let uploadedFile = $state<File | null>(null);
  let previewUrl = $state<string | null>(null);
  let livenessResult = $state<LivenessCheckResult | null>(null);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let isDragging = $state(false);
  let step = $state<'upload' | 'result' | 'confirmed'>('upload');
  let cameraActive = $state(false);
  let videoElement = $state<HTMLVideoElement | null>(null);
  let canvasElement = $state<HTMLCanvasElement | null>(null);

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
   * Start camera capture
   */
  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' }
      });
      if (videoElement) {
        videoElement.srcObject = stream;
        cameraActive = true;
      }
    } catch (err) {
      error = 'Unable to access camera. Please check permissions.';
    }
  }

  /**
   * Capture photo from camera
   */
  function capturePhoto() {
    if (!videoElement || !canvasElement) return;

    const context = canvasElement.getContext('2d');
    if (!context) return;

    canvasElement.width = videoElement.videoWidth;
    canvasElement.height = videoElement.videoHeight;
    context.drawImage(videoElement, 0, 0);

    // Convert canvas to blob and create file
    canvasElement.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], 'selfie.jpg', { type: 'image/jpeg' });
        processFile(file);
        stopCamera();
      }
    }, 'image/jpeg', 0.95);
  }

  /**
   * Stop camera
   */
  function stopCamera() {
    if (videoElement && videoElement.srcObject) {
      const stream = videoElement.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      cameraActive = false;
    }
  }

  /**
   * Send selfie + ID photo to Claude API for liveness check
   */
  async function checkLiveness() {
    if (!uploadedFile || !previewUrl) {
      error = 'Please upload a selfie first';
      return;
    }

    loading = true;
    error = null;

    try {
      // Convert image to base64
      const base64Image = previewUrl.split(',')[1];

      // Call API endpoint
      const response = await fetch('/api/verified-vibe/check-liveness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selfie: base64Image,
          idPhoto: idPhotoBase64,
          mimeType: uploadedFile.type
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to check liveness');
      }

      const result = await response.json();
      livenessResult = result.data;
      step = 'result';
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to check liveness. Please try again.';
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
    livenessResult = null;
    error = null;
    step = 'upload';
  }

  /**
   * Handle confirm
   */
  async function handleConfirm() {
    if (!livenessResult) return;

    loading = true;
    error = null;

    try {
      if (onSubmit) {
        await onSubmit(livenessResult);
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
    stopCamera();
    if (onCancel) {
      onCancel();
    }
  }

  /**
   * Cleanup on unmount
   */
  function cleanup() {
    stopCamera();
  }
</script>

<svelte:window onunload={cleanup} />

<div class="liveness-step" transition:fade={{ duration: 300 }}>
  <!-- Upload Step -->
  {#if step === 'upload'}
    <div class="step-content" transition:slide={{ duration: 300, axis: 'y' }}>
      <div class="step-header">
        <h3 class="step-title">Selfie Verification</h3>
        <p class="step-description">Take a selfie to verify you're the same person as your ID</p>
      </div>

      <!-- Camera or Upload Tabs -->
      <div class="upload-tabs">
        <button
          class="tab-button"
          class:active={!cameraActive}
          onclick={() => {
            stopCamera();
          }}
          aria-label="Upload photo"
        >
          📤 Upload Photo
        </button>
        <button
          class="tab-button"
          class:active={cameraActive}
          onclick={startCamera}
          aria-label="Take photo with camera"
        >
          📷 Take Photo
        </button>
      </div>

      <!-- Camera View -->
      {#if cameraActive}
        <div class="camera-section" transition:slide={{ duration: 300, axis: 'y' }}>
          <video
            bind:this={videoElement}
            autoplay
            playsinline
            class="camera-video"
            aria-label="Camera preview"
          ></video>
          <canvas bind:this={canvasElement} class="hidden-canvas"></canvas>
          <div class="camera-controls">
            <button
              class="btn btn-primary"
              onclick={capturePhoto}
              disabled={loading}
              aria-label="Capture photo"
            >
              📸 Capture
            </button>
            <button
              class="btn btn-secondary"
              onclick={stopCamera}
              disabled={loading}
              aria-label="Close camera"
            >
              ✕ Close
            </button>
          </div>
        </div>
      {/if}

      <!-- Upload Area -->
      {#if !cameraActive}
        <div
          class="upload-area"
          class:dragging={isDragging}
          ondragover={handleDragOver}
          ondragleave={handleDragLeave}
          ondrop={handleDrop}
          role="button"
          tabindex="0"
          aria-label="Upload selfie photo"
        >
          <div class="upload-icon">🤳</div>
          <p class="upload-text">Drag and drop your selfie here</p>
          <p class="upload-hint">or click to select a file</p>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onchange={handleFileSelect}
            disabled={loading}
            aria-label="Select selfie photo file"
            class="file-input"
          />
        </div>

        <!-- File Requirements -->
        <div class="requirements">
          <h4 class="requirements-title">Requirements:</h4>
          <ul class="requirements-list">
            <li>Clear, well-lit selfie</li>
            <li>Face clearly visible</li>
            <li>No filters or heavy makeup</li>
            <li>JPG, PNG, or WebP format</li>
            <li>Max 5MB file size</li>
          </ul>
        </div>
      {/if}

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
          <img src={previewUrl} alt="Selfie preview" class="preview-image" />
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

      <!-- Check Liveness Button -->
      <div class="actions">
        <button
          class="btn btn-primary"
          onclick={checkLiveness}
          disabled={!previewUrl || loading}
          aria-label="Check liveness"
        >
          {#if loading}
            <span class="loading-spinner"></span>
            Checking...
          {:else}
            Check Liveness
          {/if}
        </button>
      </div>
    </div>
  {/if}

  <!-- Result Step -->
  {#if step === 'result'}
    <div class="step-content" transition:slide={{ duration: 300, axis: 'y' }}>
      <div class="step-header">
        <h3 class="step-title">Verification Result</h3>
        <p class="step-description">Here's how well your selfie matches your ID</p>
      </div>

      {#if livenessResult}
        <div class="result-card" transition:scale={{ duration: 300 }}>
          <div class="confidence-display">
            <div class="confidence-score">{livenessResult.confidence}%</div>
            <div class="confidence-label">Match Confidence</div>
          </div>

          <div class="result-status">
            {#if livenessResult.match}
              <div class="status-passed">
                <span class="status-icon">✓</span>
                <span class="status-text">Face Match Verified</span>
              </div>
              <p class="status-description">Your selfie matches your ID photo</p>
            {:else}
              <div class="status-failed">
                <span class="status-icon">✗</span>
                <span class="status-text">Face Doesn't Match</span>
              </div>
              <p class="status-description">Please retake your selfie and try again</p>
            {/if}
          </div>

          <div class="confidence-bar">
            <div class="bar-fill" style="width: {livenessResult.confidence}%"></div>
          </div>
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
            aria-label="Retake selfie"
          >
            Retake Selfie
          </button>
          {#if livenessResult.match}
            <button
              class="btn btn-primary"
              onclick={handleConfirm}
              disabled={loading}
              aria-label="Confirm and continue"
            >
              {#if loading}
                <span class="loading-spinner"></span>
                Confirming...
              {:else}
                Confirm
              {/if}
            </button>
          {/if}
        </div>
      {/if}
    </div>
  {/if}

  <!-- Confirmed Step -->
  {#if step === 'confirmed'}
    <div class="step-content" transition:slide={{ duration: 300, axis: 'y' }}>
      <div class="success-message" transition:scale={{ duration: 300 }}>
        <div class="success-icon">✓</div>
        <h3 class="success-title">Liveness Verified</h3>
        <p class="success-description">Your face has been verified against your ID</p>
      </div>
    </div>
  {/if}
</div>

<style>
  .liveness-step {
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

  /* Tabs */
  .upload-tabs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--gap-md);
  }

  .tab-button {
    padding: var(--spacing-md);
    border: 2px solid var(--color-vibe-border);
    border-radius: var(--radius-lg);
    background: var(--color-vibe-bg-2);
    color: var(--color-vibe-text-2);
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-semibold);
    cursor: pointer;
    transition: all 200ms ease;
    min-height: 44px;
  }

  .tab-button.active {
    border-color: var(--color-vibe-emerald);
    background: rgba(16, 185, 129, 0.1);
    color: var(--color-vibe-emerald);
  }

  @media (hover: hover) {
    .tab-button:hover:not(:disabled) {
      border-color: var(--color-vibe-emerald);
    }
  }

  /* Camera Section */
  .camera-section {
    display: flex;
    flex-direction: column;
    gap: var(--gap-md);
  }

  .camera-video {
    width: 100%;
    border-radius: var(--radius-lg);
    background: #000;
    aspect-ratio: 1;
    object-fit: cover;
  }

  .hidden-canvas {
    display: none;
  }

  .camera-controls {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--gap-md);
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

  /* Result Card */
  .result-card {
    display: flex;
    flex-direction: column;
    gap: var(--gap-lg);
    background: var(--color-vibe-bg-2);
    border-radius: var(--radius-lg);
    padding: var(--spacing-lg);
  }

  .confidence-display {
    text-align: center;
  }

  .confidence-score {
    font-size: 48px;
    font-weight: var(--font-weight-bold);
    color: var(--color-vibe-emerald);
    margin: 0 0 var(--gap-sm);
  }

  .confidence-label {
    font-size: var(--font-size-sm);
    color: var(--color-vibe-text-2);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .result-status {
    text-align: center;
  }

  .status-passed,
  .status-failed {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--gap-md);
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-semibold);
    margin: 0 0 var(--gap-sm);
  }

  .status-passed {
    color: var(--color-vibe-emerald);
  }

  .status-failed {
    color: #ef4444;
  }

  .status-icon {
    font-size: 24px;
  }

  .status-description {
    font-size: var(--font-size-sm);
    color: var(--color-vibe-text-2);
    margin: 0;
  }

  .confidence-bar {
    height: 8px;
    background: var(--color-vibe-bg-1);
    border-radius: 4px;
    overflow: hidden;
  }

  .bar-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--color-vibe-emerald), var(--color-vibe-mint));
    transition: width 500ms ease;
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

    .result-card {
      padding: var(--spacing-md);
      gap: var(--gap-md);
    }

    .confidence-score {
      font-size: 40px;
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

    .camera-controls {
      grid-template-columns: 1fr 1fr;
    }
  }

  /* Desktop Responsive */
  @media (min-width: 1024px) {
    .actions {
      grid-template-columns: 1fr 1fr;
    }

    .camera-controls {
      grid-template-columns: 1fr 1fr;
    }
  }
</style>
