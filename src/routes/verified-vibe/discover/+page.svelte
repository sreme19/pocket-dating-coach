<script lang="ts">
  import { goto } from '$app/navigation';
  import { currentTab, discoveryProfiles, discoveryIndex, discoveryLoading } from '$lib/verified-vibe/stores';
  import { fade, slide } from 'svelte/transition';
  import type { DiscoveryProfile } from '$lib/verified-vibe/types';

  let showMatchOverlay = $state(false);
  let matchedProfile = $state<DiscoveryProfile | null>(null);
  let sortBy = $state<'trustScore' | 'compatibility'>('trustScore');
  let isLoadingMore = $state(false);
  let hasMoreProfiles = $state(true);
  let offset = $state(0);
  const limit = 10;
  const passedIds = $state<Set<string>>(new Set());

  // Load initial profiles
  async function loadProfiles() {
    if (isLoadingMore || !hasMoreProfiles) return;
    
    isLoadingMore = true;
    try {
      const excludeIds = Array.from(passedIds).join(',');
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
        sortBy,
        ...(excludeIds && { excludeIds })
      });

      const response = await fetch(`/api/verified-vibe/discovery-feed?${params}`);
      if (!response.ok) throw new Error('Failed to load profiles');

      const result = await response.json();
      const newProfiles = result.data.profiles;

      if (newProfiles.length > 0) {
        discoveryProfiles.update(profiles => [...profiles, ...newProfiles]);
        offset += limit;
        hasMoreProfiles = result.data.hasMore;
      } else {
        hasMoreProfiles = false;
      }
    } catch (error) {
      console.error('Error loading profiles:', error);
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

  function handleLike() {
    const currentProfile = $discoveryProfiles[$discoveryIndex];
    if (currentProfile) {
      // Show match overlay (in production, this would check for mutual likes)
      matchedProfile = currentProfile;
      showMatchOverlay = true;
    }
  }

  function handlePass() {
    const currentProfile = $discoveryProfiles[$discoveryIndex];
    if (currentProfile) {
      passedIds.add(currentProfile.id);
    }
    
    discoveryIndex.update(i => i + 1);

    // Load more profiles if we're running low
    if ($discoveryProfiles.length - $discoveryIndex < 3 && hasMoreProfiles) {
      loadProfiles();
    }
  }

  function handleSendMessage() {
    showMatchOverlay = false;
    currentTab.set('chat');
    goto('/verified-vibe/chat');
  }

  function handleCloseMatch() {
    showMatchOverlay = false;
    handlePass();
  }

  function handleSortChange(newSort: 'trustScore' | 'compatibility') {
    sortBy = newSort;
    // Reset and reload with new sort
    discoveryProfiles.set([]);
    discoveryIndex.set(0);
    offset = 0;
    passedIds.clear();
    hasMoreProfiles = true;
    loadProfiles();
  }

  const currentProfile = $discoveryProfiles[$discoveryIndex] || null;
  const hasMoreCards = $discoveryIndex < $discoveryProfiles.length;
</script>

<div class="discover-screen">
  <!-- Header with sorting -->
  <div class="discover-header" transition:slide={{ duration: 400, delay: 0, axis: 'y' }}>
    <div class="header-top">
      <h1>Discover</h1>
      <div class="sort-controls">
        <button 
          class="sort-btn" 
          class:active={sortBy === 'trustScore'}
          onclick={() => handleSortChange('trustScore')}
          title="Sort by trust score"
        >
          🛡️ Trust
        </button>
        <button 
          class="sort-btn" 
          class:active={sortBy === 'compatibility'}
          onclick={() => handleSortChange('compatibility')}
          title="Sort by compatibility"
        >
          💕 Match
        </button>
      </div>
    </div>
    <p class="discover-subtitle">Find your match</p>
  </div>

  <!-- Card stack -->
  <div class="card-stack">
    {#if hasMoreCards && currentProfile}
      <div class="discovery-card" key={currentProfile.id} transition:fade={{ duration: 300 }}>
        <div class="card-photo">
          <div class="photo-placeholder">📸</div>
        </div>

        <div class="card-content">
          <div class="card-header">
            <div class="card-title">
              <h2>{currentProfile.firstName}, {currentProfile.age}</h2>
              <span class="card-distance">{currentProfile.distance}</span>
            </div>
            <div class="card-archetype">
              <span class="archetype-emoji">{currentProfile.archetype === 'spoilt_woman' ? '👑' : '🛡️'}</span>
            </div>
          </div>

          <p class="card-about">{currentProfile.about}</p>

          <div class="card-footer">
            <div class="trust-badge">
              <span class="trust-score">🛡️ {currentProfile.trustScore}</span>
            </div>
            <div class="verified-badges">
              {#each currentProfile.verified as badge}
                <span class="badge" title={badge}>✓</span>
              {/each}
            </div>
          </div>
        </div>
      </div>
    {:else if !hasMoreCards && $discoveryProfiles.length > 0}
      <div class="empty-state" transition:fade={{ duration: 300 }}>
        <div class="empty-icon">🎉</div>
        <h2>No more profiles</h2>
        <p>Check back later for more matches!</p>
      </div>
    {:else}
      <div class="loading-state" transition:fade={{ duration: 300 }}>
        <div class="spinner"></div>
        <p>Loading profiles...</p>
      </div>
    {/if}
  </div>

  <!-- Actions -->
  <div class="discover-actions" transition:slide={{ duration: 400, delay: 100, axis: 'y' }}>
    <button class="action-btn pass-btn" onclick={handlePass} disabled={!hasMoreCards}>
      <span>👎</span>
      <span>Pass</span>
    </button>
    <button class="action-btn like-btn" onclick={handleLike} disabled={!hasMoreCards}>
      <span>❤️</span>
      <span>Like</span>
    </button>
  </div>

  <!-- Loading indicator for infinite scroll -->
  {#if isLoadingMore}
    <div class="loading-indicator" transition:fade={{ duration: 200 }}>
      <div class="mini-spinner"></div>
      <span>Loading more...</span>
    </div>
  {/if}

  <!-- Match overlay -->
  {#if showMatchOverlay && matchedProfile}
    <div class="match-overlay" transition:fade={{ duration: 300 }}>
      <div class="match-content" transition:slide={{ duration: 300, axis: 'y' }}>
        <div class="match-header">
          <button class="close-btn" onclick={handleCloseMatch}>✕</button>
        </div>

        <div class="match-body">
          <div class="match-icon">💕</div>
          <h2>It's a Match!</h2>
          <p>You and {matchedProfile.firstName} liked each other</p>

          <div class="match-profile">
            <div class="match-photo">📸</div>
            <div class="match-info">
              <h3>{matchedProfile.firstName}, {matchedProfile.age}</h3>
              <p>{matchedProfile.city}</p>
            </div>
          </div>
        </div>

        <div class="match-actions">
          <button class="btn btn-secondary full" onclick={handleCloseMatch}>
            Keep Discovering
          </button>
          <button class="btn btn-primary full" onclick={handleSendMessage}>
            Send Message
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .discover-screen {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 20px;
    gap: 20px;
    padding-bottom: calc(20px + env(safe-area-inset-bottom, 0));
  }

  .discover-header {
    padding-top: 8px;
  }

  .header-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
  }

  .discover-header h1 {
    font-size: 28px;
    font-weight: 700;
    margin: 0;
  }

  .sort-controls {
    display: flex;
    gap: 8px;
  }

  .sort-btn {
    padding: 8px 12px;
    border-radius: 8px;
    border: 1px solid var(--border-1);
    background: var(--bg-2);
    color: var(--text-2);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 200ms ease;
    white-space: nowrap;
  }

  .sort-btn:hover {
    background: var(--bg-3);
    border-color: var(--border-2);
  }

  .sort-btn.active {
    background: var(--accent);
    color: white;
    border-color: var(--accent);
  }

  .discover-subtitle {
    font-size: 14px;
    color: var(--text-3);
    margin: 4px 0 0;
  }

  .card-stack {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 300px;
  }

  .discovery-card {
    width: 100%;
    max-width: 400px;
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    border-radius: var(--r-lg);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
    animation: slideIn 300ms ease;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .card-photo {
    width: 100%;
    aspect-ratio: 1;
    background: linear-gradient(135deg, var(--accent-tint), var(--bg-3));
    display: grid;
    place-items: center;
    font-size: 80px;
  }

  .card-content {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
  }

  .card-title h2 {
    font-size: 20px;
    font-weight: 600;
    margin: 0;
  }

  .card-distance {
    font-size: 12px;
    color: var(--text-3);
  }

  .card-archetype {
    font-size: 24px;
  }

  .card-about {
    font-size: 14px;
    color: var(--text-2);
    margin: 0;
    line-height: 1.5;
  }

  .card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 12px;
    border-top: 1px solid var(--border-1);
  }

  .trust-badge {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .trust-score {
    font-size: 13px;
    font-weight: 600;
    color: var(--accent);
  }

  .verified-badges {
    display: flex;
    gap: 4px;
  }

  .badge {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--accent-tint);
    color: var(--accent-bright);
    display: grid;
    place-items: center;
    font-size: 12px;
    font-weight: 600;
  }

  .empty-state {
    text-align: center;
    padding: 40px 20px;
  }

  .empty-icon {
    font-size: 64px;
    margin-bottom: 16px;
  }

  .empty-state h2 {
    font-size: 20px;
    font-weight: 600;
    margin: 0 0 8px;
  }

  .empty-state p {
    font-size: 14px;
    color: var(--text-3);
    margin: 0;
  }

  .loading-state {
    text-align: center;
    padding: 40px 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--border-1);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .loading-state p {
    font-size: 14px;
    color: var(--text-2);
    margin: 0;
  }

  .discover-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .loading-indicator {
    position: fixed;
    bottom: 100px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    border-radius: 8px;
    padding: 12px 16px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--text-2);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .mini-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid var(--border-1);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .action-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 16px;
    border-radius: var(--r-lg);
    border: 1px solid var(--border-1);
    background: var(--bg-2);
    cursor: pointer;
    transition: all 200ms ease;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-1);
  }

  .action-btn:hover:not(:disabled) {
    background: var(--bg-3);
    border-color: var(--border-2);
    transform: translateY(-2px);
  }

  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .action-btn span:first-child {
    font-size: 24px;
  }

  .like-btn {
    border-color: var(--accent);
    color: var(--accent);
  }

  .like-btn:hover:not(:disabled) {
    background: var(--accent-tint);
  }

  .btn {
    padding: 12px 16px;
    border-radius: var(--r-lg);
    border: none;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 200ms ease;
  }

  .btn-primary {
    background: var(--accent);
    color: white;
  }

  .btn-primary:hover {
    background: var(--accent-bright);
  }

  .btn-secondary {
    background: var(--bg-2);
    color: var(--text-1);
    border: 1px solid var(--border-1);
  }

  .btn-secondary:hover {
    background: var(--bg-3);
  }

  .btn.full {
    width: 100%;
  }

  .match-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: grid;
    place-items: center;
    z-index: 100;
    padding: 20px;
    animation: fadeIn 300ms ease;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .match-content {
    background: var(--bg-1);
    border: 1px solid var(--border-1);
    border-radius: var(--r-lg);
    width: 100%;
    max-width: 400px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    animation: slideUp 300ms ease;
  }

  @keyframes slideUp {
    from {
      transform: translateY(40px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  .match-header {
    display: flex;
    justify-content: flex-end;
    padding: 12px;
  }

  .close-btn {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    display: grid;
    place-items: center;
    cursor: pointer;
    color: var(--text-1);
    font-size: 18px;
  }

  .match-body {
    padding: 20px;
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .match-icon {
    font-size: 48px;
    animation: bounce 600ms ease;
  }

  @keyframes bounce {
    0%, 100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.2);
    }
  }

  .match-body h2 {
    font-size: 24px;
    font-weight: 700;
    margin: 0;
  }

  .match-body p {
    font-size: 14px;
    color: var(--text-2);
    margin: 0;
  }

  .match-profile {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    background: var(--bg-2);
    border-radius: var(--r-lg);
    margin-top: 8px;
  }

  .match-photo {
    width: 56px;
    height: 56px;
    border-radius: 12px;
    background: var(--accent-tint);
    display: grid;
    place-items: center;
    font-size: 28px;
    flex-shrink: 0;
  }

  .match-info {
    text-align: left;
  }

  .match-info h3 {
    font-size: 16px;
    font-weight: 600;
    margin: 0;
  }

  .match-info p {
    font-size: 12px;
    color: var(--text-3);
    margin: 2px 0 0;
  }

  .match-actions {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 20px;
    border-top: 1px solid var(--border-1);
  }

  @media (max-width: 767px) {
    .discover-screen {
      padding: 12px 12px 16px;
      gap: 16px;
    }

    .discover-header {
      padding-top: 4px;
    }

    .header-top {
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
      margin-bottom: 4px;
    }

    .discover-header h1 {
      font-size: 24px;
      font-weight: 700;
      margin: 0;
    }

    .sort-controls {
      width: 100%;
      gap: 6px;
    }

    .sort-btn {
      flex: 1;
      padding: 6px 10px;
      font-size: 11px;
    }

    .discover-subtitle {
      font-size: 13px;
      color: var(--text-3);
      margin: 2px 0 0;
    }

    .card-stack {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 280px;
    }

    .discovery-card {
      width: 100%;
      max-width: 100%;
      border-radius: var(--r-lg);
    }

    .card-photo {
      width: 100%;
      aspect-ratio: 1;
    }

    .card-content {
      padding: 16px;
      gap: 10px;
    }

    .card-header {
      gap: 10px;
    }

    .card-title h2 {
      font-size: 18px;
      font-weight: 600;
    }

    .card-distance {
      font-size: 11px;
    }

    .card-archetype {
      font-size: 22px;
    }

    .card-about {
      font-size: 13px;
      line-height: 1.4;
    }

    .card-footer {
      padding-top: 10px;
      gap: 8px;
    }

    .trust-score {
      font-size: 12px;
    }

    .badge {
      width: 22px;
      height: 22px;
      font-size: 11px;
    }

    .empty-state {
      text-align: center;
      padding: 30px 16px;
    }

    .empty-icon {
      font-size: 56px;
      margin-bottom: 12px;
    }

    .empty-state h2 {
      font-size: 18px;
      margin: 0 0 6px;
    }

    .empty-state p {
      font-size: 13px;
      margin: 0;
    }

    .loading-state {
      padding: 30px 16px;
    }

    .spinner {
      width: 36px;
      height: 36px;
    }

    .discover-actions {
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }

    .action-btn {
      padding: 14px 12px;
      border-radius: var(--r-lg);
      font-size: 13px;
      min-height: 48px;
      gap: 6px;
    }

    .action-btn span:first-child {
      font-size: 20px;
    }

    .loading-indicator {
      bottom: 80px;
      padding: 10px 14px;
      font-size: 11px;
    }

    .mini-spinner {
      width: 14px;
      height: 14px;
    }

    .match-overlay {
      padding: 16px;
    }

    .match-content {
      max-width: 100%;
      border-radius: var(--r-lg);
    }

    .match-header {
      padding: 10px;
    }

    .close-btn {
      width: 36px;
      height: 36px;
      font-size: 16px;
    }

    .match-body {
      padding: 16px;
      gap: 10px;
    }

    .match-icon {
      font-size: 40px;
    }

    .match-body h2 {
      font-size: 20px;
    }

    .match-body p {
      font-size: 13px;
    }

    .match-profile {
      gap: 10px;
      padding: 12px;
    }

    .match-photo {
      width: 48px;
      height: 48px;
      font-size: 24px;
    }

    .match-info h3 {
      font-size: 14px;
    }

    .match-info p {
      font-size: 11px;
    }

    .match-actions {
      gap: 10px;
      padding: 16px;
    }

    .btn {
      min-height: 44px;
      padding: 12px 16px;
      font-size: 14px;
      border-radius: var(--r-lg);
    }
  }
</style>
