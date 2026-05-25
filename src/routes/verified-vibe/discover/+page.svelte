<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import {
    user,
    discoveryProfiles,
    discoveryIndex,
    nextDiscoveryProfile,
    addDiscoveryProfile,
    setError,
    clearError
  } from '$lib/verified-vibe/stores';
  import { fade, slide } from 'svelte/transition';
  import MatchOverlay from '$lib/verified-vibe/components/MatchOverlay.svelte';
  import TrustScoreBadge from '$lib/verified-vibe/components/TrustScoreBadge.svelte';
  import TipSheet from '$lib/verified-vibe/components/TipSheet.svelte';
  import AttentionSheet from '$lib/verified-vibe/components/AttentionSheet.svelte';
  import { swipe } from '$lib/verified-vibe/utils/swipe';
  import type { DiscoveryProfile } from '$lib/verified-vibe/types';
  import { ARCHETYPES } from '$lib/verified-vibe/constants';

  interface RichProfile {
    id: string;
    firstName: string;
    age: number;
    city: string;
    avatar: string | null;
    about: string | null;
    looking: string | null;
    trustScore: number;
    archetype: string;
    archetypeName: string;
    archetypeEmoji: string;
    gender: string;
    vibeWords: string[];
    traitScores: { decisiveness: number; warmth: number; openness: number; pace: number };
    brings: string[];
    hereFor: string;
    communicationStyle: string | null;
    mattersMost: string | null;
  }

  let showMatchOverlay = $state(false);
  let matchedProfile = $state<DiscoveryProfile | null>(null);
  let showTipSheet = $state(false);
  let showAttentionSheet = $state(false);
  let currentUserGender = $state<'man' | 'woman' | 'prefer_not_to_say'>('man');
  let currentUserId = $state<string | null>(null);
  let sentAttentionIds = $state<Set<string>>(new Set());
  let isLoadingMore = $state(false);
  let hasMoreProfiles = $state(true);
  let offset = $state(0);
  let error = $state<string | null>(null);
  let isAnimating = $state(false);
  let cardStackContainer: HTMLElement | undefined = $state();
  let selectedProfile = $state<DiscoveryProfile | null>(null);
  let isViewingSelected = $state(false);

  const limit = 10;
  const passedIds = $state<Set<string>>(new Set());
  const likedIds = $state<Set<string>>(new Set());
  let richProfile = $state<RichProfile | null>(null);
  let richProfileLoading = $state(false);
  let showingSeedProfiles = $state(false);

  // Get current profile
  let currentProfile = $derived(isViewingSelected ? selectedProfile : ($discoveryProfiles[$discoveryIndex] || null));

  // Load a specific profile by ID
  async function loadSpecificProfile(profileId: string) {
    try {
      const { getSupabaseClient } = await import('$lib/client/supabase');
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`/api/verified-vibe/profile/${profileId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        throw new Error('Profile not found');
      }

      const result = await response.json();
      selectedProfile = result.data;
      isViewingSelected = true;
    } catch (err) {
      console.error('Error loading profile:', err);
      error = err instanceof Error ? err.message : 'Failed to load profile';
      setError(error);
      // Still mark as viewing selected even on error, to hide action buttons
      isViewingSelected = true;
    }
  }

  // Handle back from selected profile view
  function handleBackFromSelected() {
    isViewingSelected = false;
    selectedProfile = null;
  }

  // Load initial profiles
  async function loadProfiles() {
    if (isLoadingMore || !hasMoreProfiles) return;

    isLoadingMore = true;
    error = null;
    try {
      // Get the access token from Supabase session
      const { getSupabaseClient } = await import('$lib/client/supabase');
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('No session token available');
      }

      const allExcludeIds = new Set([...passedIds, ...likedIds]);
      const excludeIds = Array.from(allExcludeIds).join(',');
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
        sortBy: 'trustScore',
        ...(excludeIds && { excludeIds })
      });

      const response = await fetch(`/api/verified-vibe/discovery-feed?${params}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      if (!response.ok) {
        throw new Error(`Failed to load profiles: ${response.statusText}`);
      }

      const result = await response.json();
      const newProfiles = result.data.profiles;

      if (newProfiles.length > 0) {
        showingSeedProfiles = newProfiles.some((p: DiscoveryProfile) => p.isSeed);
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

  // Check for profile query parameter on mount
  onMount(() => {
    const profileId = $page.url.searchParams.get('profile');
    if (profileId) {
      console.log('Loading profile:', profileId);
      loadSpecificProfile(profileId);
    } else if ($discoveryProfiles.length === 0) {
      // Load initial batch if no profile is selected
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
      console.log('Liking profile:', currentProfile.id);

      // Get user ID from session
      const { getSupabaseClient } = await import('$lib/client/supabase');
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user?.id) {
        throw new Error('User not authenticated');
      }

      // Call like API
      const response = await fetch('/api/verified-vibe/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: currentProfile.id,
          userId: session.user.id
        })
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to like profile');
      }

      const result = await response.json();
      console.log('Like response:', result);

      // Check if mutual match
      if (result.matched) {
        console.log('Mutual match!');
        matchedProfile = currentProfile;
        showMatchOverlay = true;
      }

      // Add to liked set to prevent duplicate likes
      likedIds.add(currentProfile.id);
      console.log('Current discovery index before:', $discoveryIndex);

      // Move to next profile
      nextDiscoveryProfile();
      console.log('Current discovery index after:', $discoveryIndex);
      console.log('Next profile:', $discoveryProfiles[$discoveryIndex]);
    } catch (err) {
      console.error('Like error:', err);
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
      // Get user ID from session
      const { getSupabaseClient } = await import('$lib/client/supabase');
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user?.id) {
        throw new Error('User not authenticated');
      }

      // Call pass API
      const response = await fetch('/api/verified-vibe/pass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: currentProfile.id,
          userId: session.user.id
        })
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to pass profile');
      }

      // Add to passed set
      passedIds.add(currentProfile.id);
      console.log('Passed on profile:', currentProfile.id);
      console.log('Current discovery index before:', $discoveryIndex);

      // Move to next profile
      nextDiscoveryProfile();
      console.log('Current discovery index after:', $discoveryIndex);
      console.log('Total profiles loaded:', $discoveryProfiles.length);
    } catch (err) {
      console.error('Pass error:', err);
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

  // Skip to next profile without recording a pass/like
  function handleSkip() {
    if (isAnimating) return;
    if (isViewingSelected) {
      handleBackFromSelected();
    } else {
      nextDiscoveryProfile();
    }
  }

  function buildFallbackProfile(p: DiscoveryProfile): RichProfile {
    const archetypeDef = ARCHETYPES[p.archetype];
    return {
      id: p.id,
      firstName: p.firstName,
      age: p.age,
      city: p.city,
      avatar: p.avatar,
      about: p.about,
      looking: p.looking,
      trustScore: p.trustScore,
      archetype: p.archetype,
      archetypeName: archetypeDef?.name ?? p.archetype.replace(/_/g, ' '),
      archetypeEmoji: archetypeDef?.emoji ?? '✨',
      gender: p.gender,
      vibeWords: [],
      traitScores: { decisiveness: 60, warmth: 60, openness: 60, pace: 60 },
      brings: archetypeDef?.brings ?? [],
      hereFor: p.looking ?? archetypeDef?.tag ?? 'A real connection',
      communicationStyle: null,
      mattersMost: null
    };
  }

  // Load full rich profile data for the current profile
  async function loadRichProfile(profile: DiscoveryProfile) {
    richProfileLoading = true;
    richProfile = null;
    try {
      const { getSupabaseClient } = await import('$lib/client/supabase');
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? '';
      const res = await fetch(`/api/verified-vibe/match-profile/${profile.id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const json = await res.json();
      if (res.ok && !json.error) {
        richProfile = json.data;
      } else {
        richProfile = buildFallbackProfile(profile);
      }
    } catch (err) {
      console.error('Failed to load rich profile:', err);
      richProfile = buildFallbackProfile(profile);
    } finally {
      richProfileLoading = false;
    }
  }

  $effect(() => {
    if (currentProfile) {
      loadRichProfile(currentProfile);
    } else {
      richProfile = null;
    }
  });

  // Load viewer's gender from the user store (authoritative), fall back to localStorage
  $effect(() => {
    const g = $user?.gender;
    if (g === 'man' || g === 'woman' || g === 'prefer_not_to_say') {
      currentUserGender = g;
    } else if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('verified_vibe_gender') as typeof currentUserGender | null;
      if (stored) currentUserGender = stored;
    }
  });

  $effect(() => {
    (async () => {
      if (typeof window === 'undefined') return;
      try {
        const { getSupabaseClient } = await import('$lib/client/supabase');
        const supabase = getSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) return;
        currentUserId = session.user.id;
        const res = await fetch(`/api/verified-vibe/attention?senderId=${session.user.id}`);
        if (res.ok) {
          const data = await res.json();
          sentAttentionIds = new Set(data.sentToIds ?? []);
        }
      } catch { /* non-blocking */ }
    })();
  });

  // Attention button visibility: only show for opposite-gender unmatched profiles
  let attentionMessageType = $derived<'secret_admirer' | 'craving_attention'>(
    currentUserGender === 'man' ? 'craving_attention' : 'secret_admirer'
  );

  let showAttentionButton = $derived(
    currentProfile !== null &&
    currentUserId !== null &&
    !sentAttentionIds.has(currentProfile.id) &&
    (
      (currentUserGender === 'man'   && (currentProfile as any).gender === 'woman') ||
      (currentUserGender === 'woman' && (currentProfile as any).gender === 'man')
    )
  );

  let alreadySentAttention = $derived(
    currentProfile !== null && sentAttentionIds.has(currentProfile.id)
  );

  function barWidth(score: number): string {
    return `${Math.max(4, Math.min(100, score))}%`;
  }

  function traitLabel(score: number, low: string, high: string): string {
    if (score >= 75) return high;
    if (score <= 35) return low;
    return '';
  }

  // Handle swipe left (pass)
  function handleSwipeLeft() {
    if (!isAnimating && currentProfile) {
      handlePass();
    }
  }

  // Handle swipe right (like)
  function handleSwipeRight() {
    if (!isAnimating && currentProfile) {
      handleLike();
    }
  }

  // Attach swipe handlers to card stack container
  $effect.pre(() => {
    if (!cardStackContainer) return;

    const swipeHandler = swipe(cardStackContainer, {
      minDistance: 50,
      maxTime: 500,
      onSwipeLeft: handleSwipeLeft,
      onSwipeRight: handleSwipeRight
    });

    return () => swipeHandler.destroy();
  });
</script>

<div class="discover-screen">
  <!-- Header -->
  <div class="discover-header" transition:slide={{ duration: 300, axis: 'y' }}>
    {#if isViewingSelected}
      <button class="back-btn" onclick={handleBackFromSelected} aria-label="Go back">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
      </button>
    {/if}
    <div class="header-content">
      <h1 class="header-title">Discover</h1>
      <p class="header-subtitle">Find your match</p>
    </div>
  </div>

  <!-- Error Message -->
  {#if error}
    <div class="error-banner" transition:slide={{ duration: 300, axis: 'y' }}>
      <span class="error-icon">⚠️</span>
      <span class="error-text">{error}</span>
      <button class="error-close" onclick={() => { error = null; clearError(); }}>×</button>
    </div>
  {/if}

  <!-- Seed profiles notice -->
  {#if showingSeedProfiles}
    <div class="seed-banner" transition:slide={{ duration: 300, axis: 'y' }}>
      <span>👀 Preview profiles — real members joining soon</span>
    </div>
  {/if}

  <!-- Profile scroll area -->
  <div class="profile-scroll" bind:this={cardStackContainer}>
    {#if richProfileLoading}
      <div class="loading-state" transition:fade={{ duration: 200 }}>
        <div class="loading-spinner"></div>
        <p class="loading-text">Loading profile…</p>
      </div>

    {:else if currentProfile && richProfile}
      <div transition:fade={{ duration: 250 }} key={currentProfile.id}>

        <!-- Photo -->
        <div class="photo-block">
          {#if richProfile.avatar}
            <img src={richProfile.avatar} alt={richProfile.firstName} class="profile-photo" />
          {:else}
            <div class="photo-placeholder">
              <span class="photo-initial">{richProfile.firstName.charAt(0)}</span>
            </div>
          {/if}
          <div class="trust-badge-wrap">
            <TrustScoreBadge score={richProfile.trustScore} size="md" />
          </div>
        </div>

        <!-- Identity -->
        <div class="identity-block">
          <h1 class="profile-name">{richProfile.firstName}, {richProfile.age}</h1>
          {#if richProfile.city}
            <p class="profile-location">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline-block;vertical-align:-1px">
                <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
              {richProfile.city}
            </p>
          {/if}
          {#if richProfile.archetypeEmoji || richProfile.archetypeName}
            <div class="archetype-chip">
              <span>{richProfile.archetypeEmoji}</span>
              <span>{richProfile.archetypeName}</span>
            </div>
          {/if}
        </div>

        <!-- Here For -->
        {#if richProfile.hereFor}
          <section class="profile-section">
            <h2 class="section-title"><span class="section-icon">💫</span> Here For</h2>
            <p class="section-body">{richProfile.hereFor}</p>
          </section>
        {/if}

        <!-- Vibe Words -->
        {#if richProfile.vibeWords.length > 0}
          <section class="profile-section">
            <h2 class="section-title"><span class="section-icon">✨</span> The Vibe in Three Words</h2>
            <div class="vibe-pills">
              {#each richProfile.vibeWords as word}
                <span class="vibe-pill">{word}</span>
              {/each}
            </div>
          </section>
        {/if}

        <!-- Personality Reads -->
        <section class="profile-section">
          <h2 class="section-title"><span class="section-icon">🧠</span> Personality Reads</h2>
          <div class="trait-bars">
            {#each [
              { label: 'Decisiveness', score: richProfile.traitScores.decisiveness, low: 'Goes with the flow', high: 'Takes the lead' },
              { label: 'Warmth',       score: richProfile.traitScores.warmth,       low: 'Reserved',          high: 'Openly caring' },
              { label: 'Openness',     score: richProfile.traitScores.openness,     low: 'Traditional',       high: 'Adventurous' },
              { label: 'Pace',         score: richProfile.traitScores.pace,         low: 'Patient & slow',    high: 'Fast-paced' },
            ] as trait}
              <div class="trait-row">
                <div class="trait-meta">
                  <span class="trait-label">{trait.label}</span>
                  {#if traitLabel(trait.score, trait.low, trait.high)}
                    <span class="trait-hint">{traitLabel(trait.score, trait.low, trait.high)}</span>
                  {/if}
                </div>
                <div class="bar-track">
                  <div class="bar-fill" style="width:{barWidth(trait.score)}"></div>
                </div>
              </div>
            {/each}
          </div>
        </section>

        <!-- What He Brings -->
        {#if richProfile.brings.length > 0}
          <section class="profile-section">
            <h2 class="section-title"><span class="section-icon">🎁</span> What He Brings</h2>
            <ul class="brings-list">
              {#each richProfile.brings.slice(0, 6) as item}
                <li class="brings-item"><span class="brings-check">✓</span><span>{item}</span></li>
              {/each}
            </ul>
          </section>
        {/if}

        <!-- About -->
        {#if richProfile.about}
          <section class="profile-section">
            <h2 class="section-title"><span class="section-icon">📝</span> About</h2>
            <p class="section-body">{richProfile.about}</p>
          </section>
        {/if}

        <!-- Communication Style -->
        {#if richProfile.communicationStyle}
          <section class="profile-section">
            <h2 class="section-title"><span class="section-icon">💬</span> Communication Style</h2>
            <p class="section-body">{richProfile.communicationStyle}</p>
          </section>
        {/if}

        <!-- Matters Most -->
        {#if richProfile.mattersMost}
          <section class="profile-section">
            <h2 class="section-title"><span class="section-icon">❤️</span> What Matters Most</h2>
            <p class="section-body">{richProfile.mattersMost}</p>
          </section>
        {/if}

        <!-- Action row -->
        {#if !isViewingSelected}
          <div class="next-wrap">
            <button class="tip-btn" onclick={() => showTipSheet = true} title="Leave an anonymous tip">
              💬 Tip
            </button>
            {#if showAttentionButton}
              <button
                class="attention-btn"
                onclick={() => showAttentionSheet = true}
                title={attentionMessageType === 'secret_admirer' ? 'Send a secret admirer message' : 'Send a craving attention message'}
              >
                {attentionMessageType === 'secret_admirer' ? '🌹 Admire' : '👀 Notice me'}
              </button>
            {:else if alreadySentAttention}
              <span class="attention-sent">Sent ✓</span>
            {/if}
            <button class="next-btn" onclick={handleSkip} disabled={isAnimating}>Next →</button>
          </div>
        {/if}

        <div style="height: 32px"></div>
      </div>

    {:else if currentProfile && !richProfileLoading}
      <!-- Rich profile failed to load but basic profile exists — show fallback -->
      <div class="loading-state" transition:fade={{ duration: 200 }}>
        <div class="loading-spinner"></div>
        <p class="loading-text">Loading profile…</p>
      </div>

    {:else if $discoveryProfiles.length === 0 && !isLoadingMore}
      <div class="empty-state" transition:fade={{ duration: 300 }}>
        <div class="empty-icon">🔍</div>
        <h2 class="empty-title">No profiles yet</h2>
        <p class="empty-text">Check back soon for new matches</p>
      </div>
    {:else if !hasMoreProfiles && $discoveryIndex >= $discoveryProfiles.length}
      <div class="empty-state" transition:fade={{ duration: 300 }}>
        <div class="empty-icon">✨</div>
        <h2 class="empty-title">You've seen all profiles!</h2>
        <p class="empty-text">Check back later for new matches</p>
      </div>
    {:else}
      <div class="loading-state" transition:fade={{ duration: 300 }}>
        <div class="loading-spinner"></div>
        <p class="loading-text">Loading profiles…</p>
      </div>
    {/if}
  </div>

  <!-- Match Overlay -->
  {#if showMatchOverlay && matchedProfile}
    <MatchOverlay
      profile={matchedProfile}
      onSendMessage={handleSendMessage}
      onClose={handleCloseMatch}
    />
  {/if}

  <!-- Anonymous Tip Sheet -->
  {#if showTipSheet && currentProfile}
    <TipSheet
      targetUserId={currentProfile.id}
      targetName={currentProfile.firstName}
      submitterGender={currentUserGender}
      onClose={() => showTipSheet = false}
    />
  {/if}

  <!-- Attention Sheet (Secret Admirer / Craving Attention) -->
  {#if showAttentionSheet && currentProfile && currentUserId}
    <AttentionSheet
      senderId={currentUserId}
      recipientId={currentProfile.id}
      recipientName={currentProfile.firstName}
      messageType={attentionMessageType}
      onClose={() => showAttentionSheet = false}
      onSent={() => {
        sentAttentionIds.add(currentProfile!.id);
        showAttentionSheet = false;
      }}
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
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-1);
    background: var(--bg-1);
  }

  .back-btn {
    width: 40px;
    height: 40px;
    border-radius: 8px;
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    display: grid;
    place-items: center;
    cursor: pointer;
    color: var(--text-1);
    transition: all 200ms ease;
    flex-shrink: 0;
  }

  .back-btn:hover {
    background: var(--bg-3);
    border-color: var(--border-2);
  }

  .back-btn:active {
    transform: scale(0.95);
  }

  .header-content {
    flex: 1;
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

  .seed-banner {
    padding: 8px 16px;
    margin: 8px 16px 0;
    background: var(--accent-tint);
    border: 1px solid var(--accent-bright);
    border-radius: 8px;
    color: var(--accent-bright);
    font-size: 12px;
    font-weight: 500;
    text-align: center;
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

  /* Profile scroll area */
  .profile-scroll {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  /* Photo block */
  .photo-block {
    position: relative;
    width: 100%;
    aspect-ratio: 3 / 4;
    max-height: 55vh;
    overflow: hidden;
    background: var(--bg-2);
  }

  .profile-photo {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: top center;
    display: block;
  }

  .photo-placeholder {
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #1a1a2e, #2d1b4e);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .photo-initial {
    font-size: 80px;
    font-weight: 700;
    color: rgba(255,255,255,0.2);
  }

  .trust-badge-wrap {
    position: absolute;
    bottom: 12px;
    right: 12px;
    filter: drop-shadow(0 2px 8px rgba(0,0,0,0.5));
  }

  /* Identity */
  .identity-block { padding: 16px 20px 8px; }

  .profile-name {
    font-size: 26px;
    font-weight: 800;
    color: var(--text-1);
    margin: 0 0 4px;
  }

  .profile-location {
    font-size: 13px;
    color: var(--text-3);
    margin: 0 0 10px;
    display: flex;
    align-items: center;
    gap: 3px;
  }

  .archetype-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    border-radius: 20px;
    background: rgba(168,85,247,0.12);
    border: 1px solid rgba(168,85,247,0.25);
    color: #c084fc;
    font-size: 13px;
    font-weight: 600;
  }

  /* Sections */
  .profile-section {
    padding: 14px 20px;
    border-top: 1px solid var(--border-1);
  }

  .section-title {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: var(--text-3);
    margin: 0 0 10px;
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .section-icon { font-size: 13px; }

  .section-body {
    font-size: 14px;
    color: var(--text-2);
    line-height: 1.55;
    margin: 0;
  }

  /* Vibe pills */
  .vibe-pills { display: flex; flex-wrap: wrap; gap: 8px; }

  .vibe-pill {
    padding: 5px 14px;
    border-radius: 20px;
    border: 1px solid rgba(168,85,247,0.3);
    background: rgba(168,85,247,0.08);
    color: #c084fc;
    font-size: 13px;
    font-weight: 500;
  }

  /* Trait bars */
  .trait-bars { display: flex; flex-direction: column; gap: 10px; }

  .trait-row { display: flex; flex-direction: column; gap: 4px; }

  .trait-meta {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  .trait-label { font-size: 13px; font-weight: 600; color: var(--text-1); }

  .trait-hint { font-size: 11px; color: var(--text-3); }

  .bar-track {
    height: 5px;
    background: var(--bg-3);
    border-radius: 3px;
    overflow: hidden;
  }

  .bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #ec4899, #a855f7);
    border-radius: 3px;
    transition: width 400ms ease;
  }

  /* Brings list */
  .brings-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 7px; }

  .brings-item { display: flex; align-items: flex-start; gap: 8px; font-size: 14px; color: var(--text-2); }

  .brings-check { color: #34d399; font-weight: 700; flex-shrink: 0; }

  /* Next button */
  .next-wrap {
    padding: 20px 20px 0;
    display: flex;
    gap: 10px;
    align-items: center;
  }

  .tip-btn {
    padding: 0 16px;
    height: 40px;
    border-radius: 10px;
    border: 1px solid var(--border-2);
    background: var(--bg-2);
    color: var(--text-2);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
    white-space: nowrap;
    transition: border-color 150ms, color 150ms;
    flex-shrink: 0;
  }

  .tip-btn:hover {
    border-color: var(--accent-bright);
    color: var(--accent-bright);
  }

  .attention-btn {
    padding: 0 14px;
    height: 40px;
    border-radius: 10px;
    border: 1px solid #ec489966;
    background: rgba(236, 72, 153, 0.08);
    color: #ec4899;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    white-space: nowrap;
    flex-shrink: 0;
    transition: border-color 150ms, background 150ms;
  }

  .attention-btn:hover {
    border-color: #ec4899;
    background: rgba(236, 72, 153, 0.14);
  }

  .attention-sent {
    font-size: 12px;
    color: var(--text-3);
    font-weight: 500;
    flex-shrink: 0;
    padding: 0 4px;
  }

  .next-btn {
    width: 100%;
    padding: 13px;
    border-radius: 12px;
    border: 1px solid var(--border-2);
    background: var(--bg-2);
    color: var(--text-2);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background 150ms;
  }

  .next-btn:hover:not(:disabled) { background: var(--bg-3); color: var(--text-1); }
  .next-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  /* Empty / Loading states */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    text-align: center;
    padding: 60px 20px;
  }

  .empty-icon { font-size: 48px; }
  .empty-title { font-size: 18px; font-weight: 600; margin: 0; color: var(--text-1); }
  .empty-text { font-size: 14px; color: var(--text-2); margin: 0; }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 60px 20px;
  }

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--bg-2);
    border-top-color: var(--accent-bright);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  .loading-text { font-size: 14px; color: var(--text-2); margin: 0; }
</style>
