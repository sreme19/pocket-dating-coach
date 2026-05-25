<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { getSupabaseClient } from '$lib/client/supabase';
  import { getProfileCompleteness, routeForCompleteness } from '$lib/verified-vibe/services/profileService';
  import { setPhase } from '$lib/verified-vibe/stores';

  onMount(async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        // No active session — send to the public landing/gate page
        goto('/verified-vibe/gate', { replaceState: true });
        return;
      }

      // Active session — check how far the user has progressed
      const completeness = await getProfileCompleteness();

      if (completeness === 'complete') {
        // Fully verified — land on their profile
        setPhase('app');
        goto('/verified-vibe/profile', { replaceState: true });
      } else {
        // Partially complete — resume where they left off
        const destination = routeForCompleteness(completeness);
        if (completeness === 'no_profile') setPhase('gate');
        else if (completeness === 'no_archetype') setPhase('home');
        else setPhase('verify');
        goto(destination, { replaceState: true });
      }
    } catch {
      // Supabase unavailable — fall back to gate
      goto('/verified-vibe/gate', { replaceState: true });
    }
  });
</script>
