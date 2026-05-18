<script lang="ts">
  /**
   * ImageUpload Component
   *
   * Handles image upload for chat messages.
   * Supports drag-and-drop and file selection.
   *
   * Props:
   * - onUpload: (file: File) => void - Upload callback
   * - onError: (error: string) => void - Error callback
   * - maxSize: number - Max file size in bytes (default: 5MB)
   * - acceptedTypes: string[] - Accepted MIME types (default: image/*)
   */

  import { fade } from 'svelte/transition';

  interface Props {
    onUpload?: (file: File) => void;
    onError?: (error: string) => void;
    maxSize?: number;
    acceptedTypes?: string[];
  }

  let {
    onUpload = () => {},
    onError = () => {},
    maxSize = 5 * 1024 * 1024, // 5MB
    acceptedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  }: Props = $props();

  let isDragging = $state(false);
  let isUploading = $state(false);
  let fileInput: HTMLInputElement | undefined;

  function validateFile(file: File): string | null {
    // Check file type
    if (!acceptedTypes.includes(file.type)) {
      return `File type not supported. Accepted types: ${acceptedTypes.join(', ')}`;
    }

    // Check file size
    if (file.size > maxSize) {
      return `File size exceeds maximum of ${Math.round(maxSize / 1024 / 1024)}MB`;
    }

    return null;
  }

  function handleFile(file: File) {
    const error = validateFile(file);
    if (error) {
      onError(error);
      return;
    }

    isUploading = true;
    onUpload(file);
    isUploading = false;
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

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  }

  function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  }

  function handleClick() {
    fileInput?.click();
  }
</script>

<div
  class="image-upload"
  class:dragging={isDragging}
  on:dragover={handleDragOver}
  on:dragleave={handleDragLeave}
  on:drop={handleDrop}
  role="button"
  tabindex="0"
  on:click={handleClick}
  on:keydown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleClick();
    }
  }}
  aria-label="Upload image"
>
  <input
    type="file"
    bind:this={fileInput}
    on:change={handleFileSelect}
    accept={acceptedTypes.join(',')}
    style="display: none"
    aria-hidden="true"
  />

  {#if isUploading}
    <div class="upload-state" transition:fade={{ duration: 200 }}>
      <div class="spinner"></div>
      <span>Uploading...</span>
    </div>
  {:else}
    <div class="upload-prompt" transition:fade={{ duration: 200 }}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="17 8 12 3 7 8"></polyline>
        <line x1="12" y1="3" x2="12" y2="15"></line>
      </svg>
      <span class="text">Click or drag image</span>
      <span class="subtext">Max {Math.round(maxSize / 1024 / 1024)}MB</span>
    </div>
  {/if}
</div>

<style>
  .image-upload {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 16px;
    border: 2px dashed var(--border-1);
    border-radius: 8px;
    background: var(--bg-2);
    cursor: pointer;
    transition: all 200ms ease;
    color: var(--text-3);
  }

  .image-upload:hover {
    border-color: var(--accent);
    background: var(--bg-3);
    color: var(--accent);
  }

  .image-upload.dragging {
    border-color: var(--accent);
    background: rgba(34, 197, 94, 0.05);
    color: var(--accent);
  }

  .upload-prompt {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .upload-prompt svg {
    width: 24px;
    height: 24px;
    color: currentColor;
  }

  .text {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-2);
  }

  .subtext {
    font-size: 12px;
    color: var(--text-4);
  }

  .upload-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .spinner {
    width: 24px;
    height: 24px;
    border: 2px solid var(--border-1);
    border-top-color: var(--accent);
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
    .image-upload {
      padding: 12px;
      gap: 6px;
    }

    .upload-prompt svg {
      width: 20px;
      height: 20px;
    }

    .text {
      font-size: 13px;
    }

    .subtext {
      font-size: 11px;
    }

    .spinner {
      width: 20px;
      height: 20px;
      border-width: 2px;
    }
  }
</style>
