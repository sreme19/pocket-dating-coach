<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { currentPhase, setPhase } from '$lib/verified-vibe/stores';

  onMount(() => {
    // Redirect to gate screen if not already in app phase
    if ($currentPhase === 'gate') {
      goto('/verified-vibe/gate');
    }
  });
</script>

<div class="verified-vibe-entry">
  <p>Loading Verified Vibe...</p>
</div>

<style>
  .verified-vibe-entry {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-2);
  }
</style>
