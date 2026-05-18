<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, slide } from 'svelte/transition';

  export let onSubmit: (data: { idImage: string; mimeType: string }) => Promise<void> = async () => {};
  export let onCancel: () => void = () => {};

  let loading = $state(false);
  let error = $state<string | null>(null);
  let selectedFile = $state<File | null>(null);
  let preview = $state<string | null>(null);
  let extractedData = $state<{
    idNumber?: string;
    idName?: string;
    idDOB?: string;
    expirationDate?: string;
  } | null>(null);
  let isConfirming = $state(false);

  async function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      error = 'Please select an image file';
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      error = 'File size must be less than 5MB';
      return;
    }

    selectedFile = file;
    error = null;

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      preview = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  async function handleExtract() {
    if (!selectedFile) {
      error = 'Please select an ID image';
      return;
    }

    loading = true;
    error = null;

    try {
      // Convert file to base64
      const base64 = await fileToBase64(selectedFile);

      // Call extraction API
      const response = await fetch('/api/verified-vibe/extract-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: base64,
          mimeType: selectedFile.type
        })
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to extract ID data');
      }

      const result = await response.json();
      extractedData = result.data;
      isConfirming = true;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to extract ID data';
    } finally {
      loading = false;
    }
  }

  async function handleConfirm() {
    if (!selectedFile) return;

    loading = true;
    error = null;

    try {
      const base64 = await fileToBase64(selectedFile);
      await onSubmit({
        idImage: base64,
        mimeType: selectedFile.type
      });
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to submit ID';
    } finally {
      loading = false;
    }
  }

  function handleEdit() {
    isConfirming = false;
    extractedData = null;
  }

  function handleClear() {
    selectedFile = null;
    preview = null;
    extractedData = null;
    isConfirming = false;
    error = null;
  }

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
</script>

<div class="id-extraction-step">
  {#if !isConfirming}
    <!-- Upload Section -->
    <div class="upload-section" transition:fade={{ duration: 300 }}>
      {#if !preview}
        <label class="upload-area" for="id-input" role="button" tabindex="0">
          <div class="upload-icon">📄</div>
          <p class="upload-text">Upload your government ID</p>
          <p class="upload-hint">Clear photo of front or back</p>
          <p class="upload-formats">JPG, PNG, or PDF (max 5MB)</p>
          <input
            id="id-input"
            type="file"
            accept="image/*,.pdf"
            disabled={loading}
            onchange={handleFileSelect}
            class="hidden-input"
          />
        </label>
      {:else}
        <div class="preview-section">
          <div class="preview-image">
            <img src={preview} alt="ID preview" />
          </div>
          <div class="preview-actions">
            <button
              class="btn btn-secondary"
              onclick={handleClear}
              disabled={loading}
            >
              Choose Different
            </button>
            <button
              class="btn btn-primary"
              onclick={handleExtract}
              disabled={loading}
            >
              {#if loading}
                <span class="loading-spinner"></span>
                Extracting...
              {:else}
                Extract Data
              {/if}
            </button>
          </div>
        </div>
      {/if}

      {#if error}
        <div class="error-message" transition:slide={{ duration: 300, axis: 'y' }}>
          <span class="error-icon">⚠️</span>
          <span>{error}</span>
        </div>
      {/if}
    </div>
  {:else if extractedData}
    <!-- Confirmation Section -->
    <div class="confirmation-section" transition:fade={{ duration: 300 }}>
      <div class="confirmation-header">
        <h3>Verify Extracted Information</h3>
        <p>Please confirm the extracted data is correct</p>
      </div>

      <div class="extracted-fields">
        {#if extractedData.idName}
          <div class="field">
            <label>Name</label>
            <div class="field-value">{extractedData.idName}</div>
          </div>
        {/if}

        {#if extractedData.idDOB}
          <div class="field">
            <label>Date of Birth</label>
            <div class="field-value">{extractedData.idDOB}</div>
          </div>
        {/if}

        {#if extractedData.idNumber}
          <div class="field">
            <label>ID Number</label>
            <div class="field-value">{extractedData.idNumber}</div>
          </div>
        {/if}

        {#if extractedData.expirationDate}
          <div class="field">
            <label>Expiration Date</label>
            <div class="field-value">{extractedData.expirationDate}</div>
          </div>
        {/if}
      </div>

      <div class="confirmation-actions">
        <button
          class="btn btn-secondary"
          onclick={handleEdit}
          disabled={loading}
        >
          Edit
        </button>
        <button
          class="btn btn-primary"
          onclick={handleConfirm}
          disabled={loading}
        >
          {#if loading}
            <span class="loading-spinner"></span>
            Confirming...
          {:else}
            Confirm & Continue
          {/if}
        </button>
      </div>

      {#if error}
        <div class="error-message" transition:slide={{ duration: 300, axis: 'y' }}>
          <span class="error-icon">⚠️</span>
          <span>{error}</span>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .id-extraction-step {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .upload-section {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .upload-area {
    border: 2px dashed var(--border-2);
    border-radius: 12px;
    padding: 32px 20px;
    text-align: center;
    cursor: pointer;
    transition: all 200ms ease;
    background: var(--bg-2);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .upload-area:hover {
    border-color: var(--accent-bright);
    background: var(--accent-tint);
  }

  .upload-icon {
    font-size: 48px;
    display: block;
  }

  .upload-text {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-1);
    margin: 0;
  }

  .upload-hint {
    font-size: 12px;
    color: var(--text-3);
    margin: 0;
  }

  .upload-formats {
    font-size: 11px;
    color: var(--text-3);
    margin: 0;
    font-style: italic;
  }

  .hidden-input {
    display: none;
  }

  .preview-section {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .preview-image {
    border-radius: 12px;
    overflow: hidden;
    background: var(--bg-2);
    max-height: 300px;
  }

  .preview-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .preview-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .confirmation-section {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .confirmation-header {
    text-align: center;
  }

  .confirmation-header h3 {
    font-size: 18px;
    font-weight: 600;
    margin: 0 0 8px;
    color: var(--text-1);
  }

  .confirmation-header p {
    font-size: 13px;
    color: var(--text-2);
    margin: 0;
  }

  .extracted-fields {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    background: var(--bg-2);
    border-radius: 12px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .field label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-3);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .field-value {
    font-size: 14px;
    color: var(--text-1);
    padding: 8px 12px;
    background: var(--bg-1);
    border-radius: 8px;
    border: 1px solid var(--border-1);
  }

  .confirmation-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .error-message {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 8px;
    color: #ef4444;
    font-size: 13px;
  }

  .error-icon {
    font-size: 16px;
    flex-shrink: 0;
  }

  .btn {
    padding: 12px 16px;
    border-radius: 8px;
    border: none;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 200ms ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 44px;
  }

  .btn-primary {
    background: var(--accent-bright);
    color: var(--bg-1);
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--accent-bright);
    opacity: 0.9;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
  }

  .btn-secondary {
    background: var(--bg-2);
    color: var(--text-1);
    border: 1px solid var(--border-1);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--bg-3);
    border-color: var(--border-2);
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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

  @media (max-width: 767px) {
    .upload-area {
      padding: 24px 16px;
      gap: 10px;
    }

    .upload-icon {
      font-size: 40px;
    }

    .upload-text {
      font-size: 13px;
    }

    .upload-hint {
      font-size: 11px;
    }

    .upload-formats {
      font-size: 10px;
    }

    .preview-image {
      max-height: 250px;
    }

    .preview-actions {
      gap: 10px;
    }

    .confirmation-header h3 {
      font-size: 16px;
    }

    .confirmation-header p {
      font-size: 12px;
    }

    .extracted-fields {
      gap: 10px;
      padding: 12px;
    }

    .field label {
      font-size: 11px;
    }

    .field-value {
      font-size: 13px;
      padding: 6px 10px;
    }

    .confirmation-actions {
      gap: 10px;
    }

    .btn {
      min-height: 44px;
      padding: 12px 14px;
      font-size: 13px;
    }
  }
</style>
