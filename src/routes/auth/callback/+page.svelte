<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { getSupabaseClient } from '$lib/client/supabase';

  onMount(async () => {
    const supabase = getSupabaseClient();

    // Handle PKCE code exchange (newer Supabase flow)
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        goto('/verified-vibe/auth?error=callback_failed');
        return;
      }
    }

    // After session is established (either PKCE or implicit hash flow),
    // check session and route accordingly
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      goto('/verified-vibe/auth');
      return;
    }

    goto('/verified-vibe/profile');
  });
</script>

<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#0f0f13;color:#a0a0a0;font-family:sans-serif;">
  Signing you in…
</div>
