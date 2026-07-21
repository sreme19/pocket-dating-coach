<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { currentPhase, currentTab, hydrateStores, user, storesHydrated } from '$lib/verified-vibe/stores';
  import { getProfile } from '$lib/verified-vibe/services/profileService';
  import type { Tab } from '$lib/verified-vibe/types';
  import { getSupabaseClient } from '$lib/client/supabase';
  import { MessageCircle, Compass, User } from 'lucide-svelte';
  import { fade, slide } from 'svelte/transition';
  import { onMount } from 'svelte';
  import RiteLogo from '$lib/verified-vibe/components/RiteLogo.svelte';

  const COMING_SOON = true;
  const isAdminPreview = $derived($page.url.searchParams.has('adminPreview'));

  // In admin preview, the profile being viewed is /verified-vibe/profile/<id>.
  // Grab that id so the Chat nav can jump straight to this user's conversations
  // in the admin QA inspector instead of the member chat route (which needs a
  // member session and would bounce the admin to auth).
  const adminPreviewUserId = $derived(
    isAdminPreview
      ? (pathname.match(/^\/verified-vibe\/profile\/([^/]+)/)?.[1] ?? null)
      : null
  );

  let { children } = $props();
  let hydrationComplete = $state(false);
  let pathname = $derived($page.url.pathname);

  const ONBOARDING_PATHS = ['/verified-vibe/auth', '/verified-vibe/gate', '/verified-vibe/home', '/verified-vibe/verify', '/verified-vibe/verification'];
  const showBottomNav = $derived(
    !ONBOARDING_PATHS.some(p => pathname === p || pathname.startsWith(p + '/')) &&
    !pathname.match(/^\/verified-vibe\/chat\/.+/)
  );

  // ── Hydration ────────────────────────────────────────────────────────────────
  // On mount, hydrate stores from Supabase (if authenticated) or localStorage (pre-auth)
  onMount(async () => {
    await hydrateStores();
    hydrationComplete = true;
  });

  // ── Android WebView async-paint fix ─────────────────────────────────────────
  // Stores hydrate asynchronously after mount. Gender-/auth-gated UI across the
  // app — e.g. the AI Wingman/Bestie rows in chat ({#if $user.gender === ...}) —
  // flips visible only once $user resolves. On Android WebView (Capacitor), DOM
  // updates driven purely by async callbacks aren't always re-rasterized until
  // an input event, so that content stays hidden until the user taps something.
  // Desktop browsers repaint immediately. Nudge the scroll container to
  // re-rasterize whenever the user/hydration state changes so the freshly
  // revealed content paints without a tap.
  $effect(() => {
    void $user;
    void $storesHydrated;
    void pathname;
    if (typeof document === 'undefined') return;
    requestAnimationFrame(() => {
      const el = document.querySelector('.verified-vibe-content') as HTMLElement | null;
      if (!el) return;
      el.style.transform = 'translateZ(0)';
      void el.offsetHeight; // force synchronous reflow + layer re-raster
      el.style.transform = '';
    });
  });

  // ── Auth guard ──────────────────────────────────────────────────────────────
  // Gate and auth pages are public (no session needed).
  // Everything else checks session and redirects if unauthenticated.
  // Verified, profile, and discovery are app-phase routes (require full verification).
  const PUBLIC_VV_PATHS = ['/verified-vibe/auth', '/verified-vibe/gate', '/verified-vibe/home', '/verified-vibe/privacy', '/verified-vibe/verify', '/verified-vibe/verification', '/verified-vibe/profile'];
  const APP_PHASE_PATHS = ['/verified-vibe/discover', '/verified-vibe/chat'];

  $effect(() => {
    if (!hydrationComplete) return; // Wait for hydration to complete

    const pathname = $page.url.pathname;

    // Public paths (no session check needed)
    if (PUBLIC_VV_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) return;

    // App-phase routes require a session. If the phase store is already 'app',
    // hydrateStores() already validated the profile — no need to re-fetch it.
    if (APP_PHASE_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) {
      getSupabaseClient()
        .auth.getSession()
        .then(async ({ data: { session } }) => {
          if (!session) {
            goto('/verified-vibe/auth');
            return;
          }

          // Phase store validated by hydrateStores — trust it
          if ($currentPhase === 'app') return;

          // Phase not yet 'app' — check profile to decide where to send the user
          const profile = await getProfile();
          if (!profile) {
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
    { tab: 'chat', icon: MessageCircle, label: 'Chat', description: 'Messages' },
    { tab: 'profile', icon: User, label: 'Profile', description: 'Your profile' }
  ];
</script>

<div class="verified-vibe-container">
  {#if COMING_SOON && !isAdminPreview}
    <div class="coming-soon-screen" transition:fade={{ duration: 300 }}>
      <div class="coming-soon-brand">
        <div class="coming-soon-logo">
          <RiteLogo mark={true} word={false} markSize={32} />
        </div>
        <p class="coming-soon-wordmark"><RiteLogo mark={false} /></p>
      </div>
      <div class="coming-soon-body">
        <h1 class="coming-soon-title">Coming Soon</h1>
        <p class="coming-soon-sub">
          The riteangle web app is on its way.<br />
          Download the app to get started.
        </p>
        <div class="coming-soon-badges">
          <a
            href="https://testflight.apple.com/join/FxGV4VrC"
            class="store-badge"
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
            App Store
          </a>
          <a
            href="https://play.google.com/apps/testing/com.riteangle.app"
            class="store-badge"
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M3 20.5v-17c0-.83.94-1.3 1.6-.8l14 8.5c.6.36.6 1.24 0 1.6l-14 8.5c-.66.5-1.6.03-1.6-.8z"/></svg>
            Google Play
          </a>
        </div>
      </div>
    </div>
  {:else}
    <!-- Main content with transitions -->
    {#key $page.url.pathname}
    <div class="verified-vibe-content">
      <div in:fade={{ duration: 300 }} out:fade={{ duration: 200 }}>
        {@render children()}
      </div>
    </div>
    {/key}

    <!-- Bottom navigation (hidden only during early onboarding and individual chat pages) -->
    {#if showBottomNav}
      <nav class="verified-vibe-bottomnav" transition:slide={{ duration: 300, axis: 'y' }}>
        {#each navItems as item}
          {@const active = pathname.startsWith(`/verified-vibe/${item.tab}`)}
          {@const Icon = item.icon}
          <button
            class="nav-item {active ? 'active' : ''}"
            onclick={async () => {
              // Admin preview: Chat inspects this user's conversations in the QA
              // console rather than opening the member chat (no member session here).
              if (isAdminPreview && item.tab === 'chat') {
                await goto(adminPreviewUserId ? `/admin/qa?user=${adminPreviewUserId}` : '/admin/qa');
                return;
              }
              currentTab.set(item.tab);
              await goto(`/verified-vibe/${item.tab}`);
            }}
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
  {/if}
</div>

<svelte:head>
  <!-- Gabarito is self-hosted via @font-face in app.css; no external font load needed. -->
</svelte:head>

<style>
  .verified-vibe-container {
    /* Design tokens scoped to Verified Vibe — riteangle LIGHT theme (cream + hot pink) */
    --bg-1: #FFF3F0;
    --bg-2: #FFFFFF;
    --bg-3: #FBE9E6;
    --bg-4: #F6E2DB;
    --text-1: #1B1020;
    --text-2: #6E5F64;
    --text-3: #A08B91;
    --text-4: #C2B0B5;
    --border-1: #F1E0E3;
    --border-2: #E7D2D7;
    --border-3: #D9BFC6;
    --accent: #FF3B6B;
    --accent-bright: #E11D54;
    --accent-dim: #FFE1EA;
    --accent-tint: rgba(255,59,107,0.12);
    --accent-glow: rgba(255,59,107,0.30);
    --font-serif: 'Gabarito', system-ui, sans-serif;
    --font-mono: 'Menlo', 'Monaco', monospace;
    --r-lg: 20px;
    --r-md: 12px;

    /* Legacy --color-vibe-* tokens used by ArchetypeCard and other components */
    --color-vibe-bg-1: #FFF3F0;
    --color-vibe-bg-2: #FFFFFF;
    --color-vibe-bg-3: #FBE9E6;
    --color-vibe-bg-4: #F6E2DB;
    --color-vibe-text-1: #1B1020;
    --color-vibe-text-2: #6E5F64;
    --color-vibe-text-3: #A08B91;
    --color-vibe-text-4: #C2B0B5;
    --color-vibe-border: #F1E0E3;
    --color-vibe-border-2: #E7D2D7;
    --color-vibe-accent: #FF3B6B;
    --color-vibe-accent-bright: #E11D54;
    --color-vibe-accent-tint: rgba(255,59,107,0.12);
    --color-vibe-lime: #FF7A4D;

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
    --shadow-md: 0 8px 24px rgba(20,8,18,0.10);

    /* Transition token */
    --transition-base: all 200ms ease;

    /* Mobile-first: constrain to mobile viewport.
       position:fixed + inset:0 pins the shell to the visual viewport directly,
       sidestepping mobile/Capacitor WebView quirks where height:100dvh / 100%
       under-resolves and lets the flex column grow taller than the screen
       (pushing the bottom nav below the fold). The inner content keeps its own
       overflow:auto, so it scrolls while the nav stays pinned at the bottom. */
    display: flex;
    flex-direction: column;
    position: fixed;
    inset: 0;
    width: 100%;
    max-width: 100%;
    background: var(--bg-1);
    color: var(--text-1);
    font-family: 'Gabarito', system-ui, sans-serif;
    margin: 0 auto;
    padding-top: env(safe-area-inset-top, 0);
  }

  /* Mobile viewport constraint - ensure content fits mobile screens */
  @media (min-width: 768px) {
    .verified-vibe-container {
      max-width: 430px;
      /* left:0/right:0 (from inset) + auto margins center the fixed shell */
      margin: 0 auto;
      border-left: 1px solid var(--border-1);
      border-right: 1px solid var(--border-1);
    }
  }

  .verified-vibe-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    animation: pageEnter 300ms ease-out;
    background: var(--bg-1);
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
    background: linear-gradient(to top, var(--bg-1), rgba(255, 243, 240, 0.85));
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

  /* Coming Soon */
  .coming-soon-screen {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 40px;
    padding: 32px 24px;
    background: var(--bg-1);
  }

  .coming-soon-brand {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .coming-soon-logo {
    width: 64px;
    height: 64px;
    border-radius: 20px;
    background: var(--accent-tint);
    border: 1px solid var(--accent-glow);
    display: grid;
    place-items: center;
    color: var(--accent-bright);
  }

  .coming-soon-wordmark {
    font-size: 20px;
    font-weight: 700;
    color: var(--text-1);
    margin: 0;
  }

  .coming-soon-body {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    text-align: center;
  }

  .coming-soon-title {
    font-size: 28px;
    font-weight: 700;
    color: var(--text-1);
    margin: 0;
    letter-spacing: -0.02em;
  }

  .coming-soon-sub {
    font-size: 15px;
    color: var(--text-2);
    line-height: 1.6;
    margin: 0;
  }

  .coming-soon-badges {
    display: flex;
    gap: 12px;
    margin-top: 8px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .store-badge {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 20px;
    background: var(--accent);
    color: #ffffff;
    border-radius: var(--r-lg);
    font-size: 14px;
    font-weight: 600;
    text-decoration: none;
    transition: background 200ms ease;
  }

  .store-badge:hover {
    background: var(--accent-bright);
  }
</style>
