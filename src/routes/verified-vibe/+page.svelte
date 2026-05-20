<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { currentPhase } from '$lib/verified-vibe/stores';

  onMount(() => {
    if ($currentPhase === 'app') {
      goto('/verified-vibe/discover', { replaceState: true });
    } else {
      goto('/verified-vibe/gate', { replaceState: true });
    }
  });
</script>
