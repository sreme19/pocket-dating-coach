<script lang="ts">
  import { goto } from '$app/navigation';
  import { currentTab } from '$lib/verified-vibe/stores';
  import { fade, slide } from 'svelte/transition';

  let currentCardIndex = $state(0);
  let showMatchOverlay = $state(false);
  let matchedProfile = $state<any>(null);

  const profiles = [
    {
      id: '1',
      name: 'Sarah',
      age: 26,
      city: 'Brooklyn, NY',
      distance: '2 mi',
      archetype: 'spoilt_woman',
      archetypeEmoji: '👑',
      photo: '👩',
      about: 'Looking for someone genuine and ambitious. Love trying new restaurants and weekend trips.',
      trustScore: 81,
      verified: ['ID', 'Photos', 'Spending']
    },
    {
      id: '2',
      name: 'Emma',
      age: 24,
      city: 'Manhattan, NY',
      distance: '5 mi',
      archetype: 'spoilt_woman',
      archetypeEmoji: '👑',
      photo: '👩',
      about: 'Creative professional seeking meaningful connections. Coffee enthusiast.',
      trustScore: 76,
      verified: ['ID', 'Photos']
    },
    {
      id: '3',
      name: 'Jessica',
      age: 28,
      city: 'Williamsburg, NY',
      distance: '3 mi',
      archetype: 'spoilt_woman',
      archetypeEmoji: '👑',
      photo: '👩',
      about: 'Entrepreneur with a passion for travel and good conversation.',
      trustScore: 88,
      verified: ['ID', 'Photos', 'Spending', 'Q&A']
    }
  ];

  function handleLike() {
    if (currentCardIndex < profiles.length - 1) {
      // Show match overlay
      matchedProfile = profiles[currentCardIndex];
      showMatchOverlay = true;
    } else {
      // No more cards
      currentCardIndex++;
    }
  }

  function handlePass() {
    if (currentCardIndex < profiles.length - 1) {
      currentCardIndex++;
    }
  }

  function handleSendMessage() {
    showMatchOverlay = false;
    currentTab.set('chat');
    goto('/verified-vibe/chat');
  }

  function handleCloseMatch() {
    showMatchOverlay = false;
    if (currentCardIndex < profiles.length - 1) {
      currentCardIndex++;
    }
  }

  const currentProfile = profiles[currentCardIndex];
  const hasMoreCards = currentCardIndex < profiles.length;
</script>

<div class="discover-screen">
  <!-- Header -->
  <div class="discover-header" transition:slide={{ duration: 400, delay: 0, axis: 'y' }}>
    <h1>Discover</h1>
    <p class="discover-subtitle">Find your match</p>
  </div>

  <!-- Card stack -->
  <div class="card-stack">
    {#if hasMoreCards && currentProfile}
      <div class="discovery-card" key={currentProfile.id} transition:fade={{ duration: 300 }}>
        <div class="card-photo">{currentProfile.photo}</div>

        <div class="card-content">
          <div class="card-header">
            <div class="card-title">
              <h2>{currentProfile.name}, {currentProfile.age}</h2>
              <span class="card-distance">{currentProfile.distance}</span>
            </div>
            <div class="card-archetype">
              <span class="archetype-emoji">{currentProfile.archetypeEmoji}</span>
            </div>
          </div>

          <p class="card-about">{currentProfile.about}</p>

          <div class="card-footer">
            <div class="trust-badge">
              <span class="trust-score">🛡️ {currentProfile.trustScore}</span>
            </div>
            <div class="verified-badges">
              {#each currentProfile.verified as badge}
                <span class="badge">✓</span>
              {/each}
            </div>
          </div>
        </div>
      </div>
    {:else}
      <div class="empty-state" transition:fade={{ duration: 300 }}>
        <div class="empty-icon">🎉</div>
        <h2>No more profiles</h2>
        <p>Check back later for more matches!</p>
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
          <p>You and {matchedProfile.name} liked each other</p>

          <div class="match-profile">
            <div class="match-photo">{matchedProfile.photo}</div>
            <div class="match-info">
              <h3>{matchedProfile.name}, {matchedProfile.age}</h3>
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

  .discover-header h1 {
    font-size: 28px;
    font-weight: 700;
    margin: 0;
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

  .discover-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
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

    .discover-header h1 {
      font-size: 24px;
      font-weight: 700;
      margin: 0;
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
