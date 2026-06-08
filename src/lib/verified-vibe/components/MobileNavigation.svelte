<script lang="ts">
  import { currentTab, currentPhase } from '$lib/verified-vibe/stores';
  import { MessageCircle, Compass, ShieldCheck, Menu, X, ChevronLeft } from 'lucide-svelte';
  import { slide } from 'svelte/transition';
  import RiteLogo from '$lib/verified-vibe/components/RiteLogo.svelte';

  let { onNavigate = () => {} } = $props();

  let menuOpen = $state(false);
  let touchStartX = $state(0);
  let touchStartY = $state(0);
  let canSwipeBack = $state(typeof window !== 'undefined' ? window.history.length > 1 : true);

  const navItems = [
    { tab: 'discover', icon: Compass, label: 'Discover', description: 'Find matches' },
    { tab: 'trust', icon: ShieldCheck, label: 'Trust', description: 'Your score' },
    { tab: 'chat', icon: MessageCircle, label: 'Chat', description: 'Messages' }
  ];

  const menuItems = [
    { href: '/verified-vibe/trust-profile', label: 'Trust Profile' },
    { href: '/verified-vibe/verification-history', label: 'Verification History' },
    { href: '/verified-vibe/trust-insights', label: 'Trust Insights' },
    { href: '/verified-vibe/privacy', label: 'Privacy & Data' }
  ];

  /**
   * Handle back button click
   */
  function handleBack() {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back();
    }
  }

  /**
   * Handle hamburger menu toggle
   */
  function toggleMenu() {
    menuOpen = !menuOpen;
  }

  /**
   * Close menu when navigating
   */
  function handleMenuItemClick(href: string) {
    menuOpen = false;
    if (typeof window !== 'undefined') {
      window.location.href = href;
    }
  }

  /**
   * Handle touch start for swipe gestures
   */
  function handleTouchStart(e: TouchEvent) {
    touchStartX = e.touches[0]?.clientX ?? 0;
    touchStartY = e.touches[0]?.clientY ?? 0;
  }

  /**
   * Handle touch end for swipe gestures
   */
  function handleTouchEnd(e: TouchEvent) {
    const touchEndX = e.changedTouches[0]?.clientX ?? 0;
    const touchEndY = e.changedTouches[0]?.clientY ?? 0;

    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;

    // Swipe back gesture (right swipe from left edge)
    if (
      deltaX > 50 &&
      Math.abs(deltaY) < 50 &&
      touchStartX < 50 &&
      canSwipeBack
    ) {
      handleBack();
    }

    // Swipe to navigate between tabs (left/right swipe)
    if (Math.abs(deltaX) > 50 && Math.abs(deltaY) < 50 && $currentPhase === 'app') {
      const currentIndex = navItems.findIndex((item) => item.tab === $currentTab);

      if (deltaX > 50 && currentIndex > 0) {
        // Swipe right - go to previous tab
        currentTab.set(navItems[currentIndex - 1].tab as any);
        onNavigate();
      } else if (deltaX < -50 && currentIndex < navItems.length - 1) {
        // Swipe left - go to next tab
        currentTab.set(navItems[currentIndex + 1].tab as any);
        onNavigate();
      }
    }
  }

  /**
   * Close menu when clicking outside
   */
  function handleClickOutside(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (menuOpen && !target.closest('.mobile-menu') && !target.closest('.menu-button')) {
      menuOpen = false;
    }
  }
</script>

<!-- Mobile Navigation Container -->
<div class="mobile-navigation">
  <!-- Top Navigation Bar -->
  <nav class="mobile-topnav" aria-label="Mobile navigation">
    <!-- Back Button -->
    <button
      class="nav-button back-button"
      onclick={handleBack}
      title="Go back"
      aria-label="Go back to previous page"
      disabled={!canSwipeBack}
    >
      <ChevronLeft size={24} />
    </button>

    <!-- Title -->
    <div class="nav-title">
      <h1><RiteLogo mark={false} /></h1>
    </div>

    <!-- Hamburger Menu Button -->
    <button
      class="nav-button menu-button"
      onclick={toggleMenu}
      title="Menu"
      aria-label="Open menu"
      aria-expanded={menuOpen}
    >
      {#if menuOpen}
        <X size={24} />
      {:else}
        <Menu size={24} />
      {/if}
    </button>
  </nav>

  <!-- Hamburger Menu -->
  {#if menuOpen}
    <div class="mobile-menu" role="menu" transition:slide={{ duration: 200 }}>
      <div class="menu-content">
        {#each menuItems as item}
          <button
            class="menu-item"
            onclick={() => handleMenuItemClick(item.href)}
            role="menuitem"
          >
            {item.label}
          </button>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Bottom Navigation Bar (only in app phase) -->
  {#if $currentPhase === 'app'}
    <div class="mobile-bottomnav" role="tablist" aria-label="Main navigation">
      {#each navItems as item}
        {@const active = $currentTab === item.tab}
        <button
          class="nav-item {active ? 'active' : ''}"
          onclick={() => {
            currentTab.set(item.tab as any);
            onNavigate();
          }}
          title={item.label}
          role="tab"
          aria-selected={active}
          aria-label={item.label}
        >
          <div class="nav-icon">
            {#if item.icon === Compass}
              <Compass size={24} />
            {:else if item.icon === ShieldCheck}
              <ShieldCheck size={24} />
            {:else if item.icon === MessageCircle}
              <MessageCircle size={24} />
            {/if}
          </div>
          <span class="nav-label">{item.label}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .mobile-navigation {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--color-vibe-bg-1);
    color: var(--color-vibe-text-1);
    position: relative;
  }

  /* Top Navigation Bar */
  .mobile-topnav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: linear-gradient(
      to bottom,
      var(--color-vibe-bg-1),
      rgba(255, 255, 255, 0.95)
    );
    border-bottom: 1px solid var(--color-vibe-border);
    gap: 12px;
    position: sticky;
    top: 0;
    z-index: 40;
    min-height: 56px;
  }

  .nav-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: var(--radius-lg);
    background: transparent;
    border: none;
    color: var(--color-vibe-text-1);
    cursor: pointer;
    transition: var(--transition-colors);
    flex-shrink: 0;
  }

  .nav-button:hover:not(:disabled) {
    background: var(--color-vibe-bg-2);
    color: var(--color-vibe-emerald);
  }

  .nav-button:active:not(:disabled) {
    background: var(--color-vibe-bg-3);
  }

  .nav-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .nav-title {
    flex: 1;
    text-align: center;
    min-width: 0;
  }

  .nav-title h1 {
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-semibold);
    margin: 0;
    color: var(--color-vibe-text-1);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Hamburger Menu */
  .mobile-menu {
    position: absolute;
    top: 56px;
    right: 0;
    left: 0;
    background: var(--color-vibe-bg-2);
    border-bottom: 1px solid var(--color-vibe-border);
    z-index: 30;
    animation: slideDown 200ms ease-out;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .menu-content {
    display: flex;
    flex-direction: column;
    padding: 8px 0;
  }

  .menu-item {
    padding: 12px 16px;
    background: none;
    border: none;
    color: var(--color-vibe-text-1);
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-normal);
    text-align: left;
    cursor: pointer;
    transition: var(--transition-colors);
  }

  .menu-item:hover {
    background: var(--color-vibe-bg-3);
    color: var(--color-vibe-emerald);
  }

  .menu-item:active {
    background: var(--color-vibe-bg-1);
  }

  /* Bottom Navigation Bar */
  .mobile-bottomnav {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0;
    background: linear-gradient(to top, var(--color-vibe-bg-1), rgba(255, 255, 255, 0.95));
    backdrop-filter: blur(20px);
    border-top: 1px solid var(--color-vibe-border);
    padding: 10px 12px calc(10px + env(safe-area-inset-bottom, 12px));
    position: sticky;
    bottom: 0;
    z-index: 40;
    min-height: 64px;
  }

  .nav-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 8px 0;
    color: var(--color-vibe-text-3);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.01em;
    position: relative;
    transition: var(--transition-colors);
    border: none;
    background: none;
    cursor: pointer;
  }

  .nav-item:hover {
    color: var(--color-vibe-text-1);
  }

  .nav-item.active {
    color: var(--color-vibe-emerald);
  }

  .nav-icon {
    width: 28px;
    height: 28px;
    display: grid;
    place-items: center;
    border-radius: 10px;
    transition: var(--transition-colors);
  }

  .nav-item.active .nav-icon {
    background: rgba(255, 59, 107, 0.1);
  }

  .nav-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }

  /* Responsive adjustments */
  @media (max-width: 767px) {
    .mobile-topnav {
      padding: 10px 12px;
      min-height: 48px;
    }

    .nav-button {
      width: 36px;
      height: 36px;
    }

    .nav-title h1 {
      font-size: var(--font-size-base);
    }

    .mobile-bottomnav {
      min-height: 60px;
      padding: 8px 12px calc(8px + env(safe-area-inset-bottom, 12px));
    }
  }

  /* Accessibility */
  @media (prefers-reduced-motion: reduce) {
    .mobile-menu {
      animation: none;
    }

    .nav-button,
    .menu-item,
    .nav-item,
    .nav-icon {
      transition: none;
    }
  }

  /* Dark mode support */
  @media (prefers-color-scheme: dark) {
    .mobile-topnav {
      background: linear-gradient(
        to bottom,
        var(--color-vibe-bg-1),
        rgba(17, 24, 39, 0.95)
      );
    }

    .mobile-bottomnav {
      background: linear-gradient(to top, var(--color-vibe-bg-1), rgba(17, 24, 39, 0.95));
    }
  }
</style>
