<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { currentPhase, currentTab, hydrateStores } from '$lib/verified-vibe/stores';
  import { getProfile } from '$lib/verified-vibe/services/profileService';
  import type { Tab } from '$lib/verified-vibe/types';
  import { getSupabaseClient } from '$lib/client/supabase';
  import { MessageCircle, Compass, ShieldCheck } from 'lucide-svelte';
  import { fade, slide } from 'svelte/transition';
  import { onMount } from 'svelte';

  let { children } = $props();
  let hydrationComplete = $state(false);

  // ── Hydration ────────────────────────────────────────────────────────────────
  // On mount, hydrate stores from Supabase (if authenticated) or localStorage (pre-auth)
  onMount(async () => {
    await hydrateStores();
    hydrationComplete = true;
  });

  // ── Auth guard ──────────────────────────────────────────────────────────────
  // Gate and auth pages are public (no session needed).
  // Everything else checks session and redirects if unauthenticated.
  // Verified, profile, and discovery are app-phase routes (require full verification).
  const PUBLIC_VV_PATHS = ['/verified-vibe/auth', '/verified-vibe/gate', '/verified-vibe/home', '/verified-vibe/privacy', '/verified-vibe/verify', '/verified-vibe/verification', '/verified-vibe/profile'];
  const APP_PHASE_PATHS = ['/verified-vibe/discover', '/verified-vibe/trust', '/verified-vibe/chat'];

  $effect(() => {
    if (!hydrationComplete) return; // Wait for hydration to complete

    const pathname = $page.url.pathname;

    // Public paths (no session check needed)
    if (PUBLIC_VV_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) return;

    // App-phase routes require session + full verification
    if (APP_PHASE_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) {
      getSupabaseClient()
        .auth.getSession()
        .then(async ({ data: { session } }) => {
          if (!session) {
            goto('/verified-vibe/auth');
            return;
          }

          // Check if user has a profile
          const profile = await getProfile();
          if (!profile) {
            // Authenticated but no profile — redirect to gate to create one
            goto('/verified-vibe/gate');
          }
        })
        .catch(() => {
          goto('/verified-vibe/auth');
        });
    }
  });

  const navItems: Array<{ tab: Tab; icon: typeof Compass; label: string; description: string }> = [
    { tab: 'discover', icon: Compass, label: 'Discover', description: 'Find matches' },
    { tab: 'trust', icon: ShieldCheck, label: 'Trust', description: 'Your score' },
    { tab: 'chat', icon: MessageCircle, label: 'Chat', description: 'Messages' }
  ];
</script>

<div class="verified-vibe-container">
  <!-- Main content with transitions -->
  {#key $page.url.pathname}
  <div class="verified-vibe-content">
    <div in:fade={{ duration: 300 }} out:fade={{ duration: 200 }}>
      {@render children()}
    </div>
  </div>
  {/key}

  <!-- Bottom navigation (only show in app phase) -->
  {#if $currentPhase === 'app'}
    <nav class="verified-vibe-bottomnav" transition:slide={{ duration: 300, axis: 'y' }}>
      {#each navItems as item}
        {@const active = $currentTab === item.tab}
        {@const Icon = item.icon}
        <button
          class="nav-item {active ? 'active' : ''}"
          onclick={() => currentTab.set(item.tab)}
          title={item.label}
        >
          <div class="nav-icon">
            <Icon size={24} />
          </div>
          <span class="nav-label">{item.label}</span>
        </button>
      {/each}
    </nav>
  {/if}
</div>

<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous">
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">
</svelte:head>

<style>
  .verified-vibe-container {
    /* Design tokens scoped to Verified Vibe — overrides root app.css light values */
    --bg-1: #0b1120;
    --bg-2: #131a2b;
    --bg-3: #1a2336;
    --bg-4: #202b40;
    --text-1: #f1f5f9;
    --text-2: #94a3b8;
    --text-3: #64748b;
    --text-4: #475569;
    --border-1: rgba(255,255,255,0.07);
    --border-2: rgba(255,255,255,0.10);
    --border-3: rgba(255,255,255,0.16);
    --accent: #10b981;
    --accent-bright: #34d399;
    --accent-dim: #064e3b;
    --accent-tint: rgba(16,185,129,0.12);
    --accent-glow: rgba(16,185,129,0.35);
    --font-serif: 'Instrument Serif', Georgia, serif;
    --font-mono: 'Menlo', 'Monaco', monospace;
    --r-lg: 20px;
    --r-md: 12px;

    /* Legacy --color-vibe-* tokens used by ArchetypeCard and other components */
    --color-vibe-bg-1: #0b1120;
    --color-vibe-bg-2: #131a2b;
    --color-vibe-bg-3: #1a2336;
    --color-vibe-bg-4: #202b40;
    --color-vibe-text-1: #f1f5f9;
    --color-vibe-text-2: #94a3b8;
    --color-vibe-text-3: #64748b;
    --color-vibe-text-4: #475569;
    --color-vibe-border: rgba(255,255,255,0.07);
    --color-vibe-border-2: rgba(255,255,255,0.10);
    --color-vibe-accent: #10b981;
    --color-vibe-accent-bright: #34d399;
    --color-vibe-accent-tint: rgba(16,185,129,0.12);
    --color-vibe-lime: #34d399;

    /* Spacing / gap tokens */
    --spacing-xs: 4px;
    --spacing-sm: 8px;
    --spacing-md: 12px;
    --spacing-lg: 16px;
    --spacing-xl: 24px;
    --gap-xs: 4px;
    --gap-sm: 8px;
    --gap-md: 12px;
    --gap-lg: 16px;

    /* Typography tokens */
    --font-size-xs: 11px;
    --font-size-sm: 13px;
    --font-size-base: 15px;
    --font-size-lg: 17px;
    --font-weight-medium: 500;
    --font-weight-semibold: 600;
    --font-weight-bold: 700;
    --line-height-relaxed: 1.6;

    /* Radius tokens */
    --radius-sm: 6px;
    --radius-md: 12px;
    --radius-lg: 20px;

    /* Shadow tokens */
    --shadow-md: 0 4px 16px rgba(0,0,0,0.4);

    /* Transition token */
    --transition-base: all 200ms ease;

    display: flex;
    flex-direction: column;
    height: 100vh;
    background: var(--bg-1);
    color: var(--text-1);
    font-family: 'Inter', system-ui, sans-serif;
  }

  .verified-vibe-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    animation: pageEnter 300ms ease-out;
  }

  @keyframes pageEnter {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .verified-vibe-bottomnav {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0;
    background: linear-gradient(to top, var(--bg-1), rgba(11, 17, 32, 0.85));
    backdrop-filter: blur(20px);
    border-top: 1px solid var(--border-1);
    padding: 10px 12px calc(10px + env(safe-area-inset-bottom, 12px));
    position: relative;
    z-index: 10;
  }

  .nav-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 8px 0;
    color: var(--text-3);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.01em;
    position: relative;
    transition: color 200ms ease;
    border: none;
    background: none;
    cursor: pointer;
  }

  .nav-item:hover {
    color: var(--text-1);
  }

  .nav-item.active {
    color: var(--accent-bright);
  }

  .nav-icon {
    width: 28px;
    height: 28px;
    display: grid;
    place-items: center;
    border-radius: 10px;
    transition: background 200ms ease;
  }

  .nav-item.active .nav-icon {
    background: var(--accent-tint);
  }

  .nav-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }

  @media (max-width: 767px) {
    .verified-vibe-container {
      height: 100%;
    }
  }
</style>
