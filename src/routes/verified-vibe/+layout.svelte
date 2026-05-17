<script lang="ts">
  import { page } from '$app/stores';
  import { currentPhase, currentTab } from '$lib/verified-vibe/stores';
  import { MessageCircle, Compass, ShieldCheck } from 'lucide-svelte';
  import { fade, slide } from 'svelte/transition';

  let { children } = $props();

  const navItems = [
    { tab: 'discover', icon: Compass, label: 'Discover', description: 'Find matches' },
    { tab: 'trust', icon: ShieldCheck, label: 'Trust', description: 'Your score' },
    { tab: 'chat', icon: MessageCircle, label: 'Chat', description: 'Messages' }
  ];
</script>

<div class="verified-vibe-container">
  <!-- Main content with transitions -->
  <div class="verified-vibe-content" key={$page.url.pathname}>
    <div in:fade={{ duration: 300 }} out:fade={{ duration: 200 }}>
      {@render children()}
    </div>
  </div>

  <!-- Bottom navigation (only show in app phase) -->
  {#if $currentPhase === 'app'}
    <nav class="verified-vibe-bottomnav" transition:slide={{ duration: 300, axis: 'y' }}>
      {#each navItems as item}
        {@const active = $currentTab === item.tab}
        <button
          class="nav-item {active ? 'active' : ''}"
          onclick={() => currentTab.set(item.tab)}
          title={item.label}
        >
          <div class="nav-icon">
            <svelte:component this={item.icon} size={24} />
          </div>
          <span class="nav-label">{item.label}</span>
        </button>
      {/each}
    </nav>
  {/if}
</div>

<style>
  .verified-vibe-container {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: var(--bg-1);
    color: var(--text-1);
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
