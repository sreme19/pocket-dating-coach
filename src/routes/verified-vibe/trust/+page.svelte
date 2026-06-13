<script lang="ts">
  import { goto } from '$app/navigation';
  import { currentTab, user, userVerification } from '$lib/verified-vibe/stores';
  import { calculateTrustScore, getTrustScoreLabel } from '$lib/verified-vibe/server/trustScore';
  import { fade, slide } from 'svelte/transition';

  let showEditModal = $state(false);

  let trustScoreBreakdown = $derived(calculateTrustScore($userVerification || []));
  // Fall back to the profile's trust_score (set server-side) when local
  // verification records haven't been loaded yet (e.g. RLS not yet resolved).
  let trustScore = $derived(trustScoreBreakdown.total || $user?.trustScore || 0);
  let trustLabel = $derived(getTrustScoreLabel(trustScore));

  let trustBreakdown = $derived([
    {
      category: 'Identity',
      score: trustScoreBreakdown.idScore,
      max: 100,
      items: ['ID Verified', 'Face Match', 'Liveness']
    },
    {
      category: 'Lifestyle',
      score: trustScoreBreakdown.photoScore,
      max: 100,
      items: ['Photo Consistency', 'Self-Presentation']
    },
    {
      category: 'Intent',
      score: trustScoreBreakdown.qaScore,
      max: 100,
      items: ['Q&A Complete', 'Authentic Responses']
    }
  ]);

  let userProfile = $derived({
    name: $user?.firstName || 'User',
    age: $user?.age || 0,
    city: $user?.city || 'Unknown',
    archetype: $user?.archetype || 'unknown',
    archetypeEmoji: '🎯',
    about: $user?.about || 'Creating genuine connections...',
    verified: ($userVerification || [])
      .filter((v) => v.status === 'completed')
      .map((v) => {
        const names: Record<string, string> = {
          id: 'ID',
          liveness: 'Liveness',
          photos: 'Photos',
          spending_or_qa: 'Q&A'
        };
        return names[v.step] || v.step;
      })
  });

  function handleEditQA() {
    showEditModal = true;
  }

  function handleSaveQA() {
    showEditModal = false;
  }

  function handleNavigate(tab: string) {
    currentTab.set(tab as any);
    goto(`/verified-vibe/${tab}`);
  }
</script>

<div class="trust-screen">
  <!-- Header -->
  <div class="trust-header" transition:slide={{ duration: 400, delay: 0, axis: 'y' }}>
    <h1>Trust Dashboard</h1>
  </div>

  <!-- Profile card -->
  <div class="profile-card" transition:slide={{ duration: 400, delay: 100, axis: 'y' }}>
    <div class="profile-header">
      <div class="profile-avatar">👤</div>
      <div class="profile-info">
        <h2>{userProfile.name}, {userProfile.age}</h2>
        <p>{userProfile.city}</p>
      </div>
    </div>

    <div class="profile-archetype">
      <span class="archetype-emoji">{userProfile.archetypeEmoji}</span>
      <span class="archetype-name">{userProfile.archetype}</span>
    </div>

    <p class="profile-about">{userProfile.about}</p>

    <div class="verified-badges">
      {#each userProfile.verified as badge}
        <span class="badge" transition:fade={{ duration: 300 }}>✓ {badge}</span>
      {/each}
    </div>
  </div>

  <!-- Trust gauge -->
  <div class="trust-gauge-container" transition:slide={{ duration: 400, delay: 150, axis: 'y' }}>
    <div class="gauge-header">
      <h3>Your Trust Score</h3>
      <p class="gauge-subtitle">Higher score = more matches</p>
    </div>

    <div class="gauge-visual">
      <svg viewBox="0 0 200 200" class="radial-gauge">
        <circle cx="100" cy="100" r="90" fill="none" stroke="var(--bg-3)" stroke-width="12" />
        <circle
          cx="100"
          cy="100"
          r="90"
          fill="none"
          stroke="var(--accent)"
          stroke-width="12"
          stroke-dasharray={`${(trustScore / 100) * 565} 565`}
          stroke-linecap="round"
          transform="rotate(-90 100 100)"
        />
        <text x="100" y="100" text-anchor="middle" dy="0.3em" class="gauge-text">
          <tspan class="gauge-number">{trustScore}</tspan>
          <tspan x="100" dy="1.2em" class="gauge-label">/ 100</tspan>
        </text>
      </svg>
    </div>

    <!-- Status -->
    <div class="trust-status" transition:slide={{ duration: 300, delay: 150 }}>
      <p class="status-label">{trustLabel}</p>
    </div>

    <!-- Breakdown -->
    <div class="breakdown">
      {#each trustBreakdown as item, index}
        <div class="breakdown-item" transition:fade={{ duration: 300, delay: 200 + index * 50 }}>
          <div class="breakdown-header">
            <span class="breakdown-name">{item.category}</span>
            <span class="breakdown-score">{Math.round(item.score)}/{item.max}</span>
          </div>
          <div class="breakdown-bar">
            <div class="breakdown-fill" style="width: {(item.score / item.max) * 100}%"></div>
          </div>
          <div class="breakdown-items">
            {#each item.items as subitem}
              <span class="breakdown-subitem">✓ {subitem}</span>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  </div>

  <!-- Actions -->
  <div class="trust-actions" transition:slide={{ duration: 400, delay: 250, axis: 'y' }}>
    <button class="btn btn-secondary full" onclick={handleEditQA}>
      Edit Q&A
    </button>
    <button class="btn btn-primary full" onclick={() => handleNavigate('discover')}>
      Start Discovering
    </button>
  </div>

  <!-- Edit modal -->
  {#if showEditModal}
    <div class="modal-overlay" onclick={() => (showEditModal = false)} onkeydown={(e) => e.key === 'Escape' && (showEditModal = false)} role="button" tabindex="0" transition:fade={{ duration: 300 }}>
      <div class="modal" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()} role="button" tabindex="0" transition:slide={{ duration: 300, axis: 'y' }}>
        <div class="modal-header">
          <h3>Edit Q&A</h3>
          <button class="close-btn" onclick={() => (showEditModal = false)}>✕</button>
        </div>

        <div class="modal-content">
          <div class="qa-field">
            <label for="qa-looking-for">What are you looking for?</label>
            <textarea id="qa-looking-for" placeholder="Share your thoughts..."></textarea>
          </div>
          <div class="qa-field">
            <label for="qa-first-date">What's your ideal first date?</label>
            <textarea id="qa-first-date" placeholder="Share your thoughts..."></textarea>
          </div>
        </div>

        <div class="modal-actions">
          <button class="btn btn-secondary" onclick={() => (showEditModal = false)}>Cancel</button>
          <button class="btn btn-primary" onclick={handleSaveQA}>Save</button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .trust-screen {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding-bottom: calc(20px + env(safe-area-inset-bottom, 0));
  }

  .trust-header {
    padding-top: 8px;
  }

  .trust-header h1 {
    font-size: 28px;
    font-weight: 700;
    margin: 0;
  }

  .profile-card {
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    border-radius: var(--r-lg);
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .profile-header {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .profile-avatar {
    width: 56px;
    height: 56px;
    border-radius: 12px;
    background: var(--bg-3);
    display: grid;
    place-items: center;
    font-size: 28px;
  }

  .profile-info h2 {
    font-size: 18px;
    font-weight: 600;
    margin: 0;
  }

  .profile-info p {
    font-size: 13px;
    color: var(--text-3);
    margin: 2px 0 0;
  }

  .profile-archetype {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 600;
    color: var(--accent);
  }

  .archetype-emoji {
    font-size: 20px;
  }

  .profile-about {
    font-size: 14px;
    color: var(--text-2);
    margin: 0;
    line-height: 1.5;
  }

  .verified-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 6px 12px;
    background: var(--accent-tint);
    color: var(--accent-bright);
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
  }

  .trust-gauge-container {
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    border-radius: var(--r-lg);
    padding: 24px 20px;
  }

  .gauge-header {
    text-align: center;
    margin-bottom: 24px;
  }

  .gauge-header h3 {
    font-size: 18px;
    font-weight: 600;
    margin: 0 0 4px;
  }

  .gauge-subtitle {
    font-size: 13px;
    color: var(--text-3);
    margin: 0;
  }

  .gauge-visual {
    display: flex;
    justify-content: center;
    margin-bottom: 32px;
  }

  .radial-gauge {
    width: 160px;
    height: 160px;
  }

  .gauge-text {
    font-family: var(--font-mono);
  }

  .gauge-number {
    font-size: 48px;
    font-weight: 700;
    fill: var(--text-1);
  }

  .gauge-label {
    font-size: 14px;
    fill: var(--text-3);
  }

  .trust-status {
    text-align: center;
    margin-bottom: 20px;
  }

  .status-label {
    font-size: 16px;
    font-weight: 600;
    color: var(--accent);
    margin: 0;
  }

  .breakdown {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .breakdown-item {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .breakdown-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .breakdown-name {
    font-size: 14px;
    font-weight: 600;
  }

  .breakdown-score {
    font-size: 12px;
    color: var(--text-3);
    font-family: var(--font-mono);
  }

  .breakdown-bar {
    width: 100%;
    height: 6px;
    background: var(--bg-3);
    border-radius: 3px;
    overflow: hidden;
  }

  .breakdown-fill {
    height: 100%;
    background: var(--accent);
    transition: width 300ms ease;
  }

  .breakdown-items {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .breakdown-subitem {
    font-size: 12px;
    color: var(--text-3);
  }

  .trust-actions {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: auto;
  }

  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: grid;
    place-items: center;
    z-index: 100;
    padding: 20px;
  }

  .modal {
    background: var(--bg-1);
    border: 1px solid var(--border-1);
    border-radius: var(--r-lg);
    width: 100%;
    max-width: 500px;
    max-height: 80vh;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px;
    border-bottom: 1px solid var(--border-1);
  }

  .modal-header h3 {
    font-size: 18px;
    font-weight: 600;
    margin: 0;
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

  .modal-content {
    flex: 1;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .qa-field {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .qa-field label {
    font-size: 14px;
    font-weight: 600;
  }

  .qa-field textarea {
    padding: 12px;
    border: 1px solid var(--border-1);
    border-radius: var(--r-lg);
    background: var(--bg-2);
    color: var(--text-1);
    font-family: inherit;
    font-size: 14px;
    resize: vertical;
    min-height: 80px;
  }

  .modal-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    padding: 20px;
    border-top: 1px solid var(--border-1);
  }

  @media (max-width: 767px) {
    .trust-screen {
      padding: 12px 16px 20px;
      gap: 16px;
    }

    .trust-header {
      padding-top: 4px;
    }

    .trust-header h1 {
      font-size: 24px;
      font-weight: 700;
      margin: 0;
    }

    .profile-card {
      padding: 16px;
      gap: 12px;
      border-radius: var(--r-lg);
    }

    .profile-header {
      gap: 10px;
    }

    .profile-avatar {
      width: 48px;
      height: 48px;
      border-radius: 10px;
      font-size: 24px;
    }

    .profile-info h2 {
      font-size: 16px;
    }

    .profile-info p {
      font-size: 12px;
    }

    .profile-archetype {
      font-size: 13px;
    }

    .archetype-emoji {
      font-size: 18px;
    }

    .profile-about {
      font-size: 13px;
      line-height: 1.4;
    }

    .verified-badges {
      gap: 6px;
    }

    .badge {
      padding: 5px 10px;
      font-size: 11px;
      border-radius: 16px;
    }

    .trust-gauge-container {
      padding: 18px 16px;
      border-radius: var(--r-lg);
    }

    .gauge-header {
      margin-bottom: 18px;
    }

    .gauge-header h3 {
      font-size: 16px;
      margin: 0 0 2px;
    }

    .gauge-subtitle {
      font-size: 12px;
    }

    .gauge-visual {
      margin-bottom: 24px;
    }

    .radial-gauge {
      width: 120px;
      height: 120px;
    }

    .gauge-number {
      font-size: 36px;
    }

    .gauge-label {
      font-size: 12px;
    }

    .breakdown {
      gap: 16px;
    }

    .breakdown-item {
      gap: 6px;
    }

    .breakdown-header {
      gap: 8px;
    }

    .breakdown-name {
      font-size: 13px;
    }

    .breakdown-score {
      font-size: 11px;
    }

    .breakdown-bar {
      height: 5px;
      border-radius: 2px;
    }

    .breakdown-items {
      gap: 6px;
    }

    .breakdown-subitem {
      font-size: 11px;
    }

    .trust-actions {
      gap: 10px;
    }

    .btn {
      min-height: 44px;
      padding: 12px 16px;
      font-size: 14px;
      border-radius: var(--r-lg);
    }

    .modal-overlay {
      padding: 16px;
    }

    .modal {
      max-width: 100%;
      max-height: 90vh;
      border-radius: var(--r-lg);
    }

    .modal-header {
      padding: 16px;
    }

    .modal-header h3 {
      font-size: 16px;
    }

    .close-btn {
      width: 32px;
      height: 32px;
      font-size: 16px;
    }

    .modal-content {
      padding: 16px;
      gap: 12px;
    }

    .qa-field {
      gap: 6px;
    }

    .qa-field label {
      font-size: 13px;
    }

    .qa-field textarea {
      padding: 10px;
      font-size: 13px;
      min-height: 70px;
      border-radius: var(--r-lg);
    }

    .modal-actions {
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      padding: 16px;
    }
  }
</style>
