<script lang="ts">
  import { onMount } from 'svelte';
  import { Wifi, WifiOff } from 'lucide-svelte';

  let isOnline = $state(true);
  let showNotification = $state(false);

  // Initialize network status
  if (typeof window !== 'undefined') {
    isOnline = navigator.onLine;

    onMount(() => {
      // Listen for online/offline events
      const handleOnline = () => {
        isOnline = true;
        showNotification = true;
        setTimeout(() => {
          showNotification = false;
        }, 3000);
      };

      const handleOffline = () => {
        isOnline = false;
        showNotification = true;
      };

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    });
  }
</script>

{#if showNotification}
  <div
    class={`fixed top-4 left-4 right-4 max-w-md z-50 animate-in fade-in slide-in-from-top-4 duration-300 rounded-lg border p-4 shadow-lg ${
      isOnline
        ? 'border-green-200 bg-green-50 text-green-900'
        : 'border-red-200 bg-red-50 text-red-900'
    }`}
    role="status"
    aria-live="polite"
    aria-atomic="true"
  >
    <div class="flex items-center gap-3">
      {#if isOnline}
        <Wifi class="h-5 w-5 text-green-600" aria-hidden="true" />
        <p class="text-sm font-medium">Connection restored</p>
      {:else}
        <WifiOff class="h-5 w-5 text-red-600" aria-hidden="true" />
        <p class="text-sm font-medium">No internet connection</p>
      {/if}
    </div>
  </div>
{/if}

{#if !isOnline}
  <div
    class="fixed bottom-0 left-0 right-0 border-t border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-900"
    role="status"
    aria-live="polite"
  >
    <div class="flex items-center justify-center gap-2">
      <WifiOff class="h-4 w-4" aria-hidden="true" />
      <span>You are offline. Some features may be limited.</span>
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

  @keyframes slide-in-from-top {
    from {
      transform: translateY(-1rem);
    }
    to {
      transform: translateY(0);
    }
  }

  :global(.animate-in) {
    animation: fade-in 0.3s ease-out, slide-in-from-top 0.3s ease-out;
  }
</style>
