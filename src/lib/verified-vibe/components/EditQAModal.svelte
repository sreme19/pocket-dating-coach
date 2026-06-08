<script lang="ts">
  import { X } from 'lucide-svelte';
  import { fade, slide } from 'svelte/transition';

  /**
   * EditQAModal Component
   *
   * Modal for editing Q&A responses. Displays current Q&A responses,
   * allows user to edit each response, and saves changes to Supabase.
   * Updates trust score after save.
   *
   * Features:
   * - Display current Q&A responses
   * - Edit each response
   * - Save changes to Supabase
   * - Update trust score after save
   * - Error handling
   * - Mobile responsive (full-screen on mobile)
   * - WCAG 2.1 AA accessibility compliance
   * - Smooth animations
   *
   * @component
   * @example
   * ```svelte
   * <EditQAModal
   *   isOpen={showModal}
   *   qaResponses={responses}
   *   onSave={(responses) => handleSave(responses)}
   *   onClose={() => handleClose()}
   * />
   * ```
   */

  interface Props {
    /** Whether modal is open */
    isOpen: boolean;
    /** Current Q&A responses */
    qaResponses: Array<{ question: string; answer: string }>;
    /** Callback when save button is clicked */
    onSave?: (responses: Array<{ question: string; answer: string }>) => Promise<void>;
    /** Callback when close button is clicked */
    onClose?: () => void;
  }

  let { isOpen, qaResponses, onSave, onClose }: Props = $props();

  // Local state
  let responses = $state(qaResponses.map((r) => ({ ...r })));
  let isSaving = $state(false);
  let error = $state<string | null>(null);

  // Update responses when prop changes
  $effect(() => {
    if (isOpen) {
      responses = qaResponses.map((r) => ({ ...r }));
      error = null;
    }
  });

  /**
   * Handle response change
   */
  function handleResponseChange(index: number, value: string) {
    responses[index].answer = value;
  }

  /**
   * Handle save
   */
  async function handleSave() {
    if (!onSave) return;

    isSaving = true;
    error = null;

    try {
      await onSave(responses);
      onClose?.();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to save Q&A responses';
    } finally {
      isSaving = false;
    }
  }

  /**
   * Handle close
   */
  function handleClose() {
    if (!isSaving) {
      onClose?.();
    }
  }

  /**
   * Handle overlay click
   */
  function handleOverlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget && !isSaving) {
      handleClose();
    }
  }
</script>

{#if isOpen}
  <div class="modal-overlay" onclick={handleOverlayClick} transition:fade={{ duration: 200 }}>
    <div class="modal" transition:slide={{ duration: 300, axis: 'y' }} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <!-- Header -->
      <div class="modal-header">
        <h2 id="modal-title" class="modal-title">Edit Q&A Responses</h2>
        <button
          class="close-button"
          onclick={handleClose}
          disabled={isSaving}
          aria-label="Close modal"
          title="Close"
        >
          <X size={20} />
        </button>
      </div>

      <!-- Content -->
      <div class="modal-content">
        {#if error}
          <div class="error-message" role="alert" transition:slide={{ duration: 200 }}>
            <span class="error-icon">⚠️</span>
            <span class="error-text">{error}</span>
          </div>
        {/if}

        <div class="qa-fields">
          {#each responses as response, index (index)}
            <div class="qa-field" transition:fade={{ duration: 200, delay: index * 50 }}>
              <label class="qa-label" for="qa-{index}">
                <span class="question-number">Q{index + 1}.</span>
                <span class="question-text">{response.question}</span>
              </label>
              <textarea
                id="qa-{index}"
                class="qa-textarea"
                value={response.answer}
                onchange={(e) => handleResponseChange(index, e.currentTarget.value)}
                disabled={isSaving}
                placeholder="Your answer..."
                aria-label={`Answer to: ${response.question}`}
              ></textarea>
              <div class="char-count">
                <span class="count">{response.answer.length}</span>
                <span class="max">/ 500</span>
              </div>
            </div>
          {/each}
        </div>

        <!-- Info message -->
        <div class="info-message">
          <span class="info-icon">ℹ️</span>
          <span class="info-text">Your answers help us match you with compatible profiles. Be honest and authentic!</span>
        </div>
      </div>

      <!-- Footer -->
      <div class="modal-footer">
        <button
          class="button button-secondary"
          onclick={handleClose}
          disabled={isSaving}
          aria-label="Cancel"
        >
          Cancel
        </button>
        <button
          class="button button-primary"
          onclick={handleSave}
          disabled={isSaving}
          aria-label="Save Q&A responses"
        >
          {#if isSaving}
            <span class="spinner"></span>
            <span>Saving...</span>
          {:else}
            <span>Save Changes</span>
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    z-index: 1000;
    padding: var(--spacing-md);
    will-change: opacity;
  }

  @media (min-width: 768px) {
    .modal-overlay {
      align-items: center;
      padding: var(--spacing-lg);
    }
  }

  .modal {
    background: var(--color-vibe-bg-1);
    border: 1px solid var(--color-vibe-border);
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    width: 100%;
    max-width: 600px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    will-change: transform, opacity;
  }

  @media (min-width: 768px) {
    .modal {
      border-radius: var(--radius-lg);
      max-height: 80vh;
    }
  }

  /* Header */
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-lg);
    border-bottom: 1px solid var(--color-vibe-border);
    flex-shrink: 0;
  }

  .modal-title {
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-bold);
    color: var(--color-vibe-text-1);
    margin: 0;
  }

  .close-button {
    width: 40px;
    height: 40px;
    border-radius: var(--radius-md);
    background: var(--color-vibe-bg-2);
    border: 1px solid var(--color-vibe-border);
    color: var(--color-vibe-text-2);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 200ms ease;
    flex-shrink: 0;
    touch-action: manipulation;
  }

  @media (prefers-reduced-motion: reduce) {
    .close-button {
      transition: none;
    }
  }

  @media (hover: hover) {
    .close-button:hover:not(:disabled) {
      background: var(--color-vibe-bg-3);
      color: var(--color-vibe-text-1);
    }
  }

  .close-button:active:not(:disabled) {
    transform: scale(0.95);
  }

  .close-button:focus-visible {
    outline: 2px solid var(--color-vibe-accent);
    outline-offset: 2px;
  }

  .close-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Content */
  .modal-content {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-lg);
    display: flex;
    flex-direction: column;
    gap: var(--gap-lg);
  }

  /* Error Message */
  .error-message {
    display: flex;
    align-items: flex-start;
    gap: var(--gap-md);
    padding: var(--spacing-md);
    background: #fee2e2;
    border: 1px solid #fecaca;
    border-radius: var(--radius-md);
    color: #991b1b;
  }

  .error-icon {
    font-size: 18px;
    flex-shrink: 0;
  }

  .error-text {
    font-size: var(--font-size-sm);
    line-height: var(--line-height-relaxed);
  }

  /* Q&A Fields */
  .qa-fields {
    display: flex;
    flex-direction: column;
    gap: var(--gap-lg);
  }

  .qa-field {
    display: flex;
    flex-direction: column;
    gap: var(--gap-sm);
  }

  .qa-label {
    display: flex;
    align-items: flex-start;
    gap: var(--gap-sm);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--color-vibe-text-1);
    cursor: pointer;
  }

  .question-number {
    color: var(--color-vibe-accent);
    font-weight: var(--font-weight-bold);
    flex-shrink: 0;
  }

  .question-text {
    line-height: var(--line-height-relaxed);
  }

  .qa-textarea {
    padding: var(--spacing-md);
    border: 1px solid var(--color-vibe-border);
    border-radius: var(--radius-md);
    background: var(--color-vibe-bg-2);
    color: var(--color-vibe-text-1);
    font-family: inherit;
    font-size: var(--font-size-sm);
    resize: vertical;
    min-height: 100px;
    max-height: 200px;
    transition: border-color 200ms ease;
    font-weight: var(--font-weight-normal);
  }

  @media (prefers-reduced-motion: reduce) {
    .qa-textarea {
      transition: none;
    }
  }

  .qa-textarea:focus {
    outline: none;
    border-color: var(--color-vibe-accent);
    box-shadow: 0 0 0 3px rgba(255, 59, 107, 0.1);
  }

  .qa-textarea:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .char-count {
    display: flex;
    justify-content: flex-end;
    gap: var(--gap-xs);
    font-size: var(--font-size-xs);
    color: var(--color-vibe-text-3);
    font-family: var(--font-mono);
  }

  .count {
    font-weight: var(--font-weight-semibold);
  }

  /* Info Message */
  .info-message {
    display: flex;
    align-items: flex-start;
    gap: var(--gap-md);
    padding: var(--spacing-md);
    background: var(--color-vibe-bg-2);
    border: 1px solid var(--color-vibe-border);
    border-radius: var(--radius-md);
    color: var(--color-vibe-text-2);
  }

  .info-icon {
    font-size: 18px;
    flex-shrink: 0;
  }

  .info-text {
    font-size: var(--font-size-sm);
    line-height: var(--line-height-relaxed);
  }

  /* Footer */
  .modal-footer {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--gap-md);
    padding: var(--spacing-lg);
    border-top: 1px solid var(--color-vibe-border);
    background: var(--color-vibe-bg-1);
    flex-shrink: 0;
  }

  .button {
    padding: var(--spacing-md) var(--spacing-lg);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--gap-sm);
    transition: all 200ms ease;
    font-family: inherit;
    min-height: 44px;
    touch-action: manipulation;
    border: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .button {
      transition: none;
    }
  }

  .button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .button-secondary {
    background: var(--color-vibe-bg-2);
    color: var(--color-vibe-text-1);
    border: 1px solid var(--color-vibe-border);
  }

  @media (hover: hover) {
    .button-secondary:hover:not(:disabled) {
      background: var(--color-vibe-bg-3);
      border-color: var(--color-vibe-text-3);
    }
  }

  .button-secondary:active:not(:disabled) {
    transform: scale(0.98);
  }

  .button-secondary:focus-visible {
    outline: 2px solid var(--color-vibe-text-2);
    outline-offset: 2px;
  }

  .button-primary {
    background: var(--color-vibe-accent);
    color: white;
    border: 1px solid var(--color-vibe-accent);
  }

  @media (hover: hover) {
    .button-primary:hover:not(:disabled) {
      opacity: 0.9;
      box-shadow: var(--shadow-md);
    }
  }

  .button-primary:active:not(:disabled) {
    transform: scale(0.98);
  }

  .button-primary:focus-visible {
    outline: 2px solid rgba(255, 255, 255, 0.5);
    outline-offset: 2px;
  }

  /* Spinner */
  .spinner {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 600ms linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation: none;
      border-top-color: rgba(255, 255, 255, 0.3);
    }
  }

  /* Mobile Responsive */
  @media (max-width: 767px) {
    .modal-overlay {
      padding: 0;
    }

    .modal {
      border-radius: var(--radius-lg) var(--radius-lg) 0 0;
      max-height: 85vh;
    }

    .modal-header {
      padding: var(--spacing-md);
    }

    .modal-title {
      font-size: var(--font-size-base);
    }

    .close-button {
      width: 36px;
      height: 36px;
    }

    .modal-content {
      padding: var(--spacing-md);
      gap: var(--gap-md);
    }

    .qa-fields {
      gap: var(--gap-md);
    }

    .qa-field {
      gap: var(--gap-xs);
    }

    .qa-label {
      font-size: var(--font-size-xs);
    }

    .qa-textarea {
      padding: var(--spacing-sm);
      font-size: var(--font-size-xs);
      min-height: 80px;
    }

    .modal-footer {
      padding: var(--spacing-md);
      gap: var(--gap-sm);
    }

    .button {
      padding: var(--spacing-sm) var(--spacing-md);
      font-size: var(--font-size-xs);
      min-height: 40px;
    }
  }
</style>
