<script lang="ts">
  import { onMount } from 'svelte';
  import { error as errorStore, clearError } from '$lib/verified-vibe/stores';
  import { X, AlertCircle, AlertTriangle, Info } from 'lucide-svelte';

  let isVisible = $state(false);
  let currentError: string | null = $state(null);
  let isRetrying = $state(false);
  let retryCallback: (() => Promise<void>) | null = $state(null);

  // Initialize subscription
  if (typeof window !== 'undefined') {
    const unsubscribe = errorStore.subscribe((err) => {
      if (err) {
        currentError = err;
        isVisible = true;
      } else {
        currentError = null;
        isVisible = false;
      }
    });

    onMount(() => {
      return unsubscribe;
    });
  }

  function handleDismiss() {
    isVisible = false;
    clearError();
    currentError = null;
  }

  async function handleRetry() {
    if (!retryCallback) return;

    isRetrying = true;
    try {
      await retryCallback();
      handleDismiss();
    } catch (err) {
      // Error will be caught and displayed by error store
      console.error('Retry failed:', err);
    } finally {
      isRetrying = false;
    }
  }

  function setRetryCallback(callback: () => Promise<void>) {
    retryCallback = callback;
  }

  // Export for use in parent components
  export { setRetryCallback };

  // Determine error severity based on message
  function getSeverity(message: string): 'info' | 'warning' | 'error' {
    const lower = message.toLowerCase();
    if (lower.includes('temporarily') || lower.includes('unavailable')) {
      return 'warning';
    }
    if (lower.includes('unauthorized') || lower.includes('not authorized') ||
        lower.includes('failed') || lower.includes('denied') || lower.includes('error')) {
      return 'error';
    }
    return 'info';
  }

  const severity = $derived(currentError ? getSeverity(currentError) : 'error');
</script>

{#if isVisible && currentError}
  <div
    class="fixed bottom-4 right-4 max-w-md z-50 animate-in fade-in slide-in-from-bottom-4 duration-300"
  >
    <div
      role="alert"
      aria-live="polite"
      aria-atomic="true"
      class={`rounded-lg border p-4 shadow-lg ${
        severity === 'error'
          ? 'border-red-200 bg-red-50 text-red-900'
          : severity === 'warning'
            ? 'border-amber-200 bg-amber-50 text-amber-900'
            : 'border-blue-200 bg-blue-50 text-blue-900'
      }`}
    >
      <div class="flex items-start gap-3">
        <div class="flex-shrink-0 mt-0.5">
          {#if severity === 'error'}
            <AlertCircle class="h-5 w-5 text-red-600" aria-hidden="true" />
          {:else if severity === 'warning'}
            <AlertTriangle class="h-5 w-5 text-amber-600" aria-hidden="true" />
          {:else}
            <Info class="h-5 w-5 text-blue-600" aria-hidden="true" />
          {/if}
        </div>

        <div class="flex-1">
          <p class="text-sm font-medium">{currentError}</p>
          {#if retryCallback}
            <button
              onclick={handleRetry}
              disabled={isRetrying}
              class={`mt-2 text-sm font-medium underline transition-colors ${
                severity === 'error'
                  ? 'text-red-700 hover:text-red-800 disabled:text-red-500'
                  : severity === 'warning'
                    ? 'text-amber-700 hover:text-amber-800 disabled:text-amber-500'
                    : 'text-blue-700 hover:text-blue-800 disabled:text-blue-500'
              }`}
              aria-label="Retry the failed operation"
            >
              {isRetrying ? 'Retrying...' : 'Try Again'}
            </button>
          {/if}
        </div>

        <button
          onclick={handleDismiss}
          class={`flex-shrink-0 transition-colors ${
            severity === 'error'
              ? 'text-red-600 hover:text-red-700'
              : severity === 'warning'
                ? 'text-amber-600 hover:text-amber-700'
                : 'text-blue-600 hover:text-blue-700'
          }`}
          aria-label="Dismiss error message"
        >
          <X class="h-5 w-5" />
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  @keyframes fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes slide-in-from-bottom {
    from {
      transform: translateY(1rem);
    }
    to {
      transform: translateY(0);
    }
  }

  :global(.animate-in) {
    animation: fade-in 0.3s ease-out, slide-in-from-bottom 0.3s ease-out;
  }
</style>
