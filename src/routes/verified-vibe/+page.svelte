<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { getSupabaseClient } from '$lib/client/supabase';
  import { getProfile } from '$lib/verified-vibe/services/profileService';
  import { setPhase } from '$lib/verified-vibe/stores';

  onMount(async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        goto('/verified-vibe/gate', { replaceState: true });
        return;
      }

      // Returning user — if they have a profile, send straight to profile page
      const profile = await getProfile();
      if (profile?.gender) {
        setPhase('app');
        goto('/verified-vibe/profile', { replaceState: true });
        return;
      }

      // No profile yet — send to onboarding start
      setPhase('gate');
      goto('/verified-vibe/gate', { replaceState: true });
    } catch {
      goto('/verified-vibe/gate', { replaceState: true });
    }
  });
</script>
