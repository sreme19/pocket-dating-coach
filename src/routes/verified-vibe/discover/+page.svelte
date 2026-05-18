<script lang="ts">
  import { goto } from '$app/navigation';
  import { 
    discoveryProfiles, 
    discoveryIndex,
    nextDiscoveryProfile,
    addDiscoveryProfile,
    setError,
    clearError
  } from '$lib/verified-vibe/stores';
  import { fade, slide, scale } from 'svelte/transition';
  import DiscoveryCard from '$lib/verified-vibe/components/DiscoveryCard.svelte';
  import MatchOverlay from '$lib/verified-vibe/components/MatchOverlay.svelte';
  import type { DiscoveryProfile } from '$lib/verified-vibe/types';

  let showMatchOverlay = $state(false);
  let matchedProfile = $state<DiscoveryProfile | null>(null);
  let isLoadingMore = $state(false);
  let hasMoreProfiles = $state(true);
  let offset = $state(0);
  let error = $state<string | null>(null);
  let isAnimating = $state(false);
  
  const limit = 10;
  const passedIds = $state<Set<string>>(new Set());

  // Get current profile
  let currentProfile = $derived($discoveryProfiles[$discoveryIndex] || null);

  // Load initial profiles
  async function loadProfiles() {
    if (isLoadingMore || !hasMoreProfiles) return;
    
    isLoadingMore = true;
    error = null;
    try {
      const excludeIds = Array.from(passedIds).join(',');
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
        sortBy: 'trustScore',
        ...(excludeIds && { excludeIds })
      });

      const response = await fetch(`/api/verified-vibe/discover?${params}`);
      if (!response.ok) {
        throw new Error(`Failed to load profiles: ${response.statusText}`);
      }

      const result = await response.json();
      const newProfiles = result.data.profiles;

      if (newProfiles.length > 0) {
        newProfiles.forEach((profile: DiscoveryProfile) => {
          addDiscoveryProfile(profile);
        });
        offset += limit;
        hasMoreProfiles = result.data.hasMore;
      } else {
        hasMoreProfiles = false;
      }
    } catch (err) {
      console.error('Error loading profiles:', err);
      error = err instanceof Error ? err.message : 'Failed to load profiles';
      setError(error);
    } finally {
      isLoadingMore = false;
    }
  }

  // Load initial batch on mount
  $effect.pre(() => {
    if ($discoveryProfiles.length === 0) {
      loadProfiles();
    }
  });

  // Load more profiles when approaching end
  $effect.pre(() => {
    if ($discoveryIndex > $discoveryProfiles.length - 3 && hasMoreProfiles && !isLoadingMore) {
      loadProfiles();
    }
  });

  // Handle like action
  async function handleLike() {
    if (!currentProfile || isAnimating) return;
    
    isAnimating = true;
    error = null;
    clearError();

    try {
      // Call like API
      const response = await fetch('/api/verified-vibe/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: currentProfile.id,
          userId: 'current-user-id' // TODO: Get from session
        })
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to like profile');
      }

      const result = await response.json();

      // Check if mutual match
      if (result.matched) {
        matchedProfile = currentProfile;
        showMatchOverlay = true;
      }

      // Move to next profile
      nextDiscoveryProfile();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to like profile';
      setError(error);
    } finally {
      isAnimating = false;
    }
  }

  // Handle pass action
  async function handlePass() {
    if (!currentProfile || isAnimating) return;
    
    isAnimating = true;
    error = null;
    clearError();

    try {
      // Call pass API
      const response = await fetch('/api/verified-vibe/pass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: currentProfile.id,
          userId: 'current-user-id' // TODO: Get from session
        })
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to pass profile');
      }

      // Add to passed set
      passedIds.add(currentProfile.id);

      // Move to next profile
      nextDiscoveryProfile();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to pass profile';
      setError(error);
    } finally {
      isAnimating = false;
    }
  }

  // Handle send message from match overlay
  function handleSendMessage() {
    if (matchedProfile) {
      showMatchOverlay = false;
      // TODO: Navigate to chat with matched profile
      goto(`/verified-vibe/chat/${matchedProfile.id}`);
    }
  }

  // Handle close match overlay
  function handleCloseMatch() {
    showMatchOverlay = false;
    matchedProfile = null;
  }
</script>

<div class="discover-screen">
  <!-- Header -->
  <div class="discover-header" transition:slide={{ duration: 300, axis: 'y' }}>
    <h1 class="header-title">Discover</h1>
    <p class="header-subtitle">Find your match</p>
  </div>

  <!-- Error Message -->
  {#if error}
    <div class="error-banner" transition:slide={{ duration: 300, axis: 'y' }}>
      <span class="error-icon">⚠️</span>
      <span class="error-text">{error}</span>
      <button class="error-close" onclick={() => { error = null; clearError(); }}>×</button>
    </div>
  {/if}

  <!-- Card Stack Container -->
  <div class="card-stack-container">
    {#if currentProfile}
      <div class="card-stack" transition:fade={{ duration: 300 }}>
        <DiscoveryCard 
          profile={currentProfile}
          onLike={handleLike}
          onPass={handlePass}
        />
      </div>
    {:else if $discoveryProfiles.length === 0 && !isLoadingMore}
      <div class="empty-state" transition:fade={{ duration: 300 }}>
        <div class="empty-icon">🔍</div>
        <h2 class="empty-title">No profiles yet</h2>
        <p class="empty-text">Check back soon for new matches</p>
      </div>
    {:else}
      <div class="loading-state" transition:fade={{ duration: 300 }}>
        <div class="loading-spinner"></div>
        <p class="loading-text">Loading profiles...</p>
      </div>
    {/if}
  </div>

  <!-- Action Buttons -->
  {#if currentProfile}
    <div class="action-buttons" transition:slide={{ duration: 300, axis: 'y' }}>
      <button 
        class="btn btn-pass" 
        onclick={handlePass}
        disabled={isAnimating}
        aria-label="Pass on this profile"
      >
        <span class="btn-icon">✕</span>
        <span class="btn-text">Pass</span>
      </button>
      <button 
        class="btn btn-like" 
        onclick={handleLike}
        disabled={isAnimating}
        aria-label="Like this profile"
      >
        <span class="btn-icon">♥</span>
        <span class="btn-text">Like</span>
      </button>
    </div>
  {/if}

  <!-- Match Overlay -->
  {#if showMatchOverlay && matchedProfile}
    <MatchOverlay 
      profile={matchedProfile}
      onSendMessage={handleSendMessage}
      onClose={handleCloseMatch}
    />
  {/if}
</div>

<style>
  .discover-screen {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-1);
    padding: 0;
  }

  /* Header */
  .discover-header {
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-1);
    background: var(--bg-1);
  }

  .header-title {
    font-size: 24px;
    font-weight: 700;
    margin: 0 0 4px;
    color: var(--text-1);
  }

  .header-subtitle {
    font-size: 13px;
    color: var(--text-3);
    margin: 0;
  }

  /* Error Banner */
  .error-banner {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    margin: 12px 16px 0;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 8px;
    color: #ef4444;
  }

  .error-icon {
    font-size: 16px;
    flex-shrink: 0;
  }

  .error-text {
    font-size: 13px;
    flex: 1;
  }

  .error-close {
    background: none;
    border: none;
    color: #ef4444;
    font-size: 20px;
    cursor: pointer;
    padding: 0;
    width: 24px;
    height: 24px;
    display: grid;
    place-items: center;
    flex-shrink: 0;
  }

  /* Card Stack Container */
  .card-stack-container {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    overflow: hidden;
  }

  .card-stack {
    width: 100%;
    max-width: 400px;
    height: 100%;
    max-height: 600px;
  }

  /* Empty State */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    text-align: center;
  }

  .empty-icon {
    font-size: 48px;
  }

  .empty-title {
    font-size: 18px;
    font-weight: 600;
    margin: 0;
    color: var(--text-1);
  }

  .empty-text {
    font-size: 14px;
    color: var(--text-2);
    margin: 0;
  }

  /* Loading State */
  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
  }

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--bg-2);
    border-top-color: var(--accent-bright);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .loading-text {
    font-size: 14px;
    color: var(--text-2);
    margin: 0;
  }

  /* Action Buttons */
  .action-buttons {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    padding: 16px 20px calc(16px + env(safe-area-inset-bottom, 0));
    border-top: 1px solid var(--border-1);
    background: var(--bg-1);
  }

  .btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 16px;
    border-radius: 8px;
    border: none;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 200ms ease;
    min-height: 44px;
  }

  .btn-icon {
    font-size: 18px;
  }

  .btn-pass {
    background: var(--bg-2);
    color: var(--text-1);
    border: 1px solid var(--border-1);
  }

  .btn-pass:hover:not(:disabled) {
    background: var(--bg-3);
    border-color: var(--border-2);
  }

  .btn-like {
    background: var(--accent-bright);
    color: var(--bg-1);
  }

  .btn-like:hover:not(:disabled) {
    background: var(--accent-bright);
    opacity: 0.9;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Mobile Responsive */
  @media (max-width: 767px) {
    .discover-header {
      padding: 12px 16px;
    }

    .header-title {
      font-size: 20px;
    }

    .header-subtitle {
      font-size: 12px;
    }

    .card-stack-container {
      padding: 16px;
    }

    .action-buttons {
      gap: 10px;
      padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0));
    }

    .btn {
      padding: 12px 14px;
      font-size: 13px;
    }
  }

  /* Tablet Responsive */
  @media (min-width: 768px) and (max-width: 1023px) {
    .card-stack-container {
      padding: 24px;
    }

    .card-stack {
      max-width: 450px;
      max-height: 650px;
    }
  }

  /* Desktop */
  @media (min-width: 1024px) {
    .discover-screen {
      max-width: 600px;
      margin: 0 auto;
    }

    .card-stack-container {
      padding: 28px;
    }

    .card-stack {
      max-width: 500px;
      max-height: 700px;
    }
  }
</style>
