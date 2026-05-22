<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { user, userVerification } from '$lib/verified-vibe/stores';
  import { calculateTrustScore, getTrustScoreLabel } from '$lib/verified-vibe/server/trustScore';
  import { upsertProfile } from '$lib/verified-vibe/services/profileService';
  import { getSupabaseClient } from '$lib/client/supabase';
  import { ShieldCheck, Pencil, Check, X, MapPin, Sparkles, Wand2, LogOut, Heart, Zap } from 'lucide-svelte';
  import type { ProfileIntakeData } from '$lib/verified-vibe/components/ProfileIntakeStep.svelte';
  import type { PhotoEnhanceResult } from '$lib/photo-enhance/types';
  import BestieAvatar from '$lib/components/BestieAvatar.svelte';

  interface GeneratedProfile {
    about: string;
    personalityDescriptors: string[];
    intentStatement: string;
    lifestyleTags: string[];
  }

  interface PhotoEntry {
    dataUrl: string;
    label: string;
  }

  const PHOTO_SLOTS = ['lead', 'warmth', 'lifestyle', 'conversation', 'social'];
  const ARCHETYPE_LABELS: Record<string, string> = {
    casual_man: 'Casual',
    marriage_minded_man: 'Marriage-Minded',
    spoilt_woman: 'Spoilt',
    safety_first_woman: 'Safety-First'
  };

  let mode = $state<'public' | 'enhance'>('public');
  let activeTab = $state<'public' | 'boost'>('public');
  let draft = $state<ProfileIntakeData | null>(null);
  let generated = $state<GeneratedProfile | null>(null);
  let photos = $state<PhotoEntry[]>([]);
  let aiPhotos = $state<PhotoEnhanceResult[]>([]);
  let enhancing = $state(false);
  let enhanceError = $state<string | null>(null);
  let generationProgress = $state(0); // 0-5 for number of photos generated

  // Personality reads data
  interface PersonalityRead {
    name: string;
    level: 'Very high' | 'High' | 'Solid' | 'Moderate' | 'Low';
    description: string;
    percentage: number;
  }

  const personalityReads = $state<PersonalityRead[]>([
    { name: 'Decisiveness', level: 'Very high', description: 'Picks a place, picks a time, follows through.', percentage: 95 },
    { name: 'Warmth', level: 'High', description: 'Generous without being a pushover.', percentage: 80 },
    { name: 'Openness', level: 'High', description: 'Reads, travels, asks better questions than most.', percentage: 75 },
    { name: 'Pace', level: 'Solid', description: 'Moves at a comfortable, intentional clip.', percentage: 65 },
    { name: 'Stability', level: 'High', description: 'Grounded, reliable, shows up consistently.', percentage: 78 }
  ]);

  // Vibe tags
  const vibeTags = ['Calm', 'Decisive', 'Generous', 'Curious', 'Direct'];
  const highlightedVibeTag = 'Calm';

  // What He Brings
  const whatBrings = [
    'Financial stability',
    'Generosity on dates',
    'Time he actually gives you',
    'Privacy & discretion',
    'Real opinions, gently held'
  ];

  // Here For
  const hereFor = {
    archetype: 'Spoilt Women',
    description: 'Wants effort, taste, and a calendar that respects yours.'
  };

  // Hard Nos
  const hardNos = [
    'Dishonesty about what someone wants',
    'Game-playing',
    'Flake energy'
  ];

  // Edit state — populated from generated/draft on entering enhance mode
  let editAbout = $state('');
  let editTags = $state<string[]>([]);
  let editIntent = $state('');
  let editLifestyle = $state<string[]>([]);

  // Photo upload
  let fileInput = $state<HTMLInputElement | null>(null);

  function handlePhotoClick() {
    fileInput?.click();
  }

  function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      const reader = new FileReader();

      reader.onload = (e) => {
        if (e.target?.result && typeof e.target.result === 'string') {
          const dataUrl = e.target.result;

          // Add photo if we haven't reached max
          if (photos.length < 5) {
            photos = [...photos, { dataUrl, label: `photo-${photos.length + 1}` }];
            localStorage.setItem('vv_photos', JSON.stringify(photos));
          } else {
            alert('Maximum 5 photos allowed');
          }
        }
      };

      reader.readAsDataURL(file);
    }
  }

  async function handleSignOut() {
    try {
      const supabase = getSupabaseClient();
      await supabase.auth.signOut();
      // Clear local storage
      localStorage.clear();
      // Redirect to auth page
      await goto('/verified-vibe/auth');
    } catch (err) {
      console.error('Sign out error:', err);
      alert('Failed to sign out');
    }
  }

  onMount(() => {
    const rawDraft = localStorage.getItem('vv_profile_draft');
    const rawGenerated = localStorage.getItem('vv_profile');
    const rawPhotos = localStorage.getItem('vv_photos');
    const rawAiPhotos = localStorage.getItem('vv_ai_photos');

    if (rawDraft) draft = JSON.parse(rawDraft);
    if (rawGenerated) generated = JSON.parse(rawGenerated);
    if (rawPhotos) photos = JSON.parse(rawPhotos);
    if (rawAiPhotos) aiPhotos = JSON.parse(rawAiPhotos);

    // If no local photos but user has an avatar from Supabase, use it as hero
    if (photos.length === 0 && $user?.avatar) {
      photos = [{ dataUrl: $user.avatar, label: 'lead' }];
    }
  });

  async function handleEnhancePhotos() {
    if (photos.length === 0) return;
    enhancing = true;
    enhanceError = null;
    generationProgress = 0;

    try {
      // Use the first uploaded photo (lead or index 0) as the reference
      const reference = photos.find(p => p.label === 'lead') ?? photos[0];

      const response = await fetch('/api/photo-enhance/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referenceDataUrl: reference.dataUrl,
          archetype: $user?.archetype ?? 'casual_man',
          count: 2 // dev: limit to 2 to conserve credits
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message ?? 'Enhancement failed');
      }

      const result = await response.json() as { photos: PhotoEnhanceResult[]; errors: { role: string; error: string }[] };
      aiPhotos = result.photos;
      generationProgress = result.photos.length;
      localStorage.setItem('vv_ai_photos', JSON.stringify(aiPhotos));

      if (result.errors.length > 0) {
        enhanceError = `${result.photos.length} photos generated, ${result.errors.length} failed.`;
      }
    } catch (err) {
      enhanceError = err instanceof Error ? err.message : 'Something went wrong';
    } finally {
      enhancing = false;
    }
  }

  const displayName = $derived($user?.firstName || draft?.firstName || 'You');
  const displayAge = $derived($user?.age || draft?.age || null);
  const displayCity = $derived($user?.city || draft?.city || null);
  const displayArchetype = $derived(ARCHETYPE_LABELS[$user?.archetype ?? ''] ?? '');
  const trustScore = $derived($user?.trustScore ?? 0);
  const trustScoreBreakdown = $derived(calculateTrustScore($userVerification || []));
  const trustLabel = $derived(getTrustScoreLabel(trustScore));
  const trustBreakdown = $derived([
    { category: 'Identity', score: trustScoreBreakdown.idScore, max: 100, items: ['ID Verified', 'Face Match', 'Liveness'] },
    { category: 'Lifestyle', score: trustScoreBreakdown.photoScore, max: 100, items: ['Photo Consistency', 'Self-Presentation'] },
    { category: 'Intent', score: trustScoreBreakdown.qaScore, max: 100, items: ['Q&A Complete', 'Authentic Responses'] }
  ]);
  let showEditQAModal = $state(false);

  const about = $derived(generated?.about ?? draft?.about ?? '');
  const personalityTags = $derived(generated?.personalityDescriptors ?? draft?.personalityTags ?? []);
  const intentStatement = $derived(generated?.intentStatement ?? draft?.lookingFor ?? '');
  const lifestyleTags = $derived(generated?.lifestyleTags ?? draft?.interests ?? []);

  // AI photos take priority; fall back to uploaded real photos
  const aiPhotosByRole = $derived(
    Object.fromEntries(aiPhotos.map(p => [p.role, p.url]))
  );
  const photosByLabel = $derived(
    Object.fromEntries(photos.map(p => [p.label, p.dataUrl]))
  );

  // Resolve each slot: AI → real → null
  function resolveSlotPhoto(slot: string): string | null {
    return aiPhotosByRole[slot] ?? photosByLabel[slot] ?? null;
  }

  const heroPhoto = $derived(
    aiPhotosByRole['lead'] ?? photosByLabel['lead'] ?? aiPhotos[0]?.url ?? photos[0]?.dataUrl ?? null
  );

  const hasRealPhotos = $derived(photos.length > 0);
  const hasAiPhotos = $derived(aiPhotos.length > 0);

  function enterEnhance() {
    editAbout = about;
    editTags = [...personalityTags];
    editIntent = intentStatement;
    editLifestyle = [...lifestyleTags];
    mode = 'enhance';
  }

  async function saveEnhance() {
    const updatedGenerated: GeneratedProfile = {
      about: editAbout,
      personalityDescriptors: editTags,
      intentStatement: editIntent,
      lifestyleTags: editLifestyle
    };

    // Save to localStorage for immediate persistence
    localStorage.setItem('vv_profile', JSON.stringify(updatedGenerated));
    generated = updatedGenerated;

    // Also persist basic profile fields to Supabase if available
    if ($user) {
      try {
        await upsertProfile({
          gender: $user.gender,
          archetype: $user.archetype,
          first_name: $user.firstName,
          age: $user.age,
          city: $user.city
        });
      } catch (err) {
        console.error('Failed to sync profile to Supabase:', err);
        // Continue anyway — localStorage has the data, will sync on next opportunity
      }
    }

    mode = 'public';
  }

  function cancelEnhance() {
    mode = 'public';
  }

  function handleTagEdit(e: Event) {
    const val = (e.target as HTMLInputElement).value;
    editTags = val.split(',').map(t => t.trim()).filter(Boolean);
  }

  function handleLifestyleEdit(e: Event) {
    const val = (e.target as HTMLInputElement).value;
    editLifestyle = val.split(',').map(t => t.trim()).filter(Boolean);
  }
</script>

<div class="profile-page">
  <!-- Mode toggle header -->
  <div class="profile-header">
    <button class="back-btn" onclick={() => goto('/verified-vibe/discover')} aria-label="Go to discover">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
    </button>
    <span class="header-label">My Profile</span>
    {#if mode === 'public'}
      <button class="edit-btn" onclick={enterEnhance}>
        <Pencil size={15} />
        Enhance
      </button>
    {:else}
      <div class="edit-actions">
        <button class="icon-btn cancel" onclick={cancelEnhance} aria-label="Cancel">
          <X size={18} />
        </button>
        <button class="icon-btn save" onclick={saveEnhance} aria-label="Save">
          <Check size={18} />
        </button>
      </div>
    {/if}
  </div>

  <!-- Tab Navigation -->
  <div class="tab-navigation">
    <button 
      class="tab-btn {activeTab === 'public' ? 'active' : ''}"
      onclick={() => activeTab = 'public'}
    >
      <Heart size={16} />
      The Public read
    </button>
    <button
      class="tab-btn {activeTab === 'boost' ? 'active' : ''}"
      onclick={() => activeTab = 'boost'}
    >
      <Zap size={16} />
      Trust & Boost
      <span class="boost-badge">+21</span>
    </button>
  </div>

  <div class="profile-body">
    <!-- Hero photo -->
    <div class="hero-wrap">
      {#if heroPhoto}
        <img class="hero-photo" src={heroPhoto} alt="{displayName}'s lead photo" />
      {:else}
        <div class="hero-placeholder">
          <div class="hero-placeholder-icon">📸</div>
          <p class="hero-placeholder-text">Add photos to boost<br/>your profile</p>
        </div>
      {/if}
      <!-- Gradient overlay -->
      <div class="hero-gradient"></div>

      <!-- Identity overlay -->
      <div class="hero-identity">
        <div class="hero-name-row">
          <h1 class="hero-name">{displayName}{displayAge ? `, ${displayAge}` : ''}</h1>
          {#if trustScore > 0}
            <div class="trust-badge">
              <ShieldCheck size={13} />
              {trustScore}
            </div>
          {/if}
        </div>
        {#if displayCity}
          <div class="hero-city">
            <MapPin size={12} />
            {displayCity}
          </div>
        {/if}
        {#if displayArchetype}
          <div class="archetype-badge">{displayArchetype}</div>
        {/if}
      </div>
    </div>

    <!-- Tab Content -->
    {#if activeTab === 'public'}
      <div class="profile-sections">
      <!-- The Vibe in Three Words -->
      {#if $user?.gender === 'man' || $user?.gender === null}
      <section class="section">
        <div class="section-label">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
          </svg>
          The Vibe in Three Words (or Five)
        </div>
        <div class="vibe-tags">
          {#each vibeTags as tag}
            <span class="vibe-tag {tag === highlightedVibeTag ? 'highlighted' : ''}">
              {tag}
            </span>
          {/each}
        </div>
      </section>
      {/if}

      <!-- About -->
      <section class="section">
        <div class="section-label">
          <Sparkles size={13} />
          About
          {#if generated}
            <span class="ai-tag">AI-crafted</span>
          {/if}
        </div>
        {#if mode === 'enhance'}
          <textarea
            class="edit-textarea"
            rows="4"
            bind:value={editAbout}
            placeholder="Write something about yourself..."
          ></textarea>
        {:else}
          <p class="about-text">{about || 'Your story goes here.'}</p>
        {/if}
      </section>

      <!-- Personality Reads -->
      {#if $user?.gender === 'man' || $user?.gender === null}
      <section class="section">
        <div class="section-label">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/>
          </svg>
          Personality Reads
          <span class="section-hint">inferred from Q&A + lifestyle</span>
        </div>
        <div class="personality-reads">
          {#each personalityReads as read}
            <div class="read-item">
              <div class="read-header">
                <span class="read-name">{read.name}</span>
                <span class="read-level">{read.level}</span>
              </div>
              <div class="read-bar">
                <div class="read-fill" style="width: {read.percentage}%"></div>
              </div>
              <p class="read-desc">{read.description}</p>
            </div>
          {/each}
        </div>
      </section>
      {/if}
      {#if personalityTags.length > 0 || mode === 'enhance'}
        <section class="section">
          <div class="section-label">Personality</div>
          {#if mode === 'enhance'}
            <input
              class="edit-input"
              type="text"
              value={editTags.join(', ')}
              onchange={handleTagEdit}
              placeholder="Ambitious, Curious, Grounded"
            />
            <p class="edit-hint">Comma-separated, up to 3</p>
          {:else}
            <div class="tag-row">
              {#each personalityTags as tag}
                <span class="tag">{tag}</span>
              {/each}
            </div>
          {/if}
        </section>
      {/if}

      <!-- What He Brings -->
      {#if $user?.gender === 'man' || $user?.gender === null}
      <section class="section">
        <div class="section-label">
          <Heart size={13} />
          What He Brings
        </div>
        <div class="brings-list">
          {#each whatBrings as item}
            <div class="brings-item">
              <span class="brings-check">✓</span>
              <span class="brings-text">{item}</span>
            </div>
          {/each}
        </div>
      </section>
      {/if}

      <!-- Here For -->
      {#if $user?.gender === 'man' || $user?.gender === null}
      <section class="section">
        <div class="section-label">
          <Heart size={13} />
          Here For
        </div>
        <div class="here-for-card">
          <div class="here-for-icon">💎</div>
          <div class="here-for-content">
            <h3 class="here-for-title">{hereFor.archetype}</h3>
            <p class="here-for-desc">{hereFor.description}</p>
          </div>
        </div>
      </section>
      {/if}

      <!-- Hard Nos -->
      {#if $user?.gender === 'man' || $user?.gender === null}
      <section class="section">
        <div class="section-label">
          <X size={13} />
          Hard Nos
        </div>
        <div class="hard-nos-list">
          {#each hardNos as item}
            <div class="hard-no-item">
              <span class="hard-no-x">✕</span>
              <span class="hard-no-text">{item}</span>
            </div>
          {/each}
        </div>
      </section>
      {/if}
      <section class="section">
        <div class="section-label">
          Photo Story
          <span class="section-count">{hasAiPhotos ? aiPhotos.length : photos.length}/5</span>
          {#if hasAiPhotos}
            <span class="ai-tag" style="margin-left: auto">AI-enhanced</span>
          {/if}
        </div>
        
        {#if enhancing}
          <div class="generation-progress">
            <div class="progress-text">Generating photos: {generationProgress}/5</div>
            <div class="progress-bar">
              <div class="progress-fill" style="width: {(generationProgress / 5) * 100}%"></div>
            </div>
          </div>
        {/if}
        
        <div class="photo-grid">
          {#each PHOTO_SLOTS as slot, i}
            {@const photo = resolveSlotPhoto(slot)}
            {#if photo}
              <div class="photo-cell">
                <img src={photo} alt={slot} class="photo-img" />
                <span class="photo-label">{slot}</span>
                {#if aiPhotosByRole[slot]}
                  <span class="ai-photo-badge">✨</span>
                {/if}
              </div>
            {:else if enhancing && i < generationProgress}
              <div class="photo-cell loading">
                <div class="skeleton-pulse"></div>
              </div>
            {:else if enhancing}
              <div class="photo-cell placeholder">
                <div class="placeholder-inner">
                  <span class="placeholder-icon">⏳</span>
                  <span class="placeholder-text">Generating...</span>
                </div>
              </div>
            {:else}
              <button
                class="photo-cell placeholder"
                onclick={handlePhotoClick}
                aria-label="Add photo"
              >
                <div class="placeholder-inner">
                  <span class="placeholder-icon">+</span>
                  <span class="placeholder-text">Add photo<br/><em>AI will enhance</em></span>
                </div>
              </button>
            {/if}
          {/each}
        </div>

        <!-- AI Enhance CTA -->
        {#if !hasAiPhotos && hasRealPhotos && mode === 'public'}
          <button
            class="enhance-photos-btn"
            onclick={handleEnhancePhotos}
            disabled={enhancing}
          >
            {#if enhancing}
              <span class="enhance-spinner"></span>
              Generating AI photos… (~30s)
            {:else}
              <Wand2 size={15} />
              Enhance with AI
            {/if}
          </button>
          {#if enhanceError}
            <p class="enhance-error">{enhanceError}</p>
          {/if}
        {:else if !hasRealPhotos && mode === 'public'}
          <p class="photo-nudge">Upload photos in verification to unlock AI enhancement</p>
        {/if}

        {#if hasAiPhotos && mode === 'public'}
          <button class="regenerate-btn" onclick={handleEnhancePhotos} disabled={enhancing}>
            {#if enhancing}
              <span class="enhance-spinner"></span>
              Regenerating…
            {:else}
              <Wand2 size={13} />
              Regenerate photos
            {/if}
          </button>
        {/if}
      </section>

      <!-- Looking for / Intent -->
      <section class="section">
        <div class="section-label">Looking for</div>
        {#if mode === 'enhance'}
          <input
            class="edit-input"
            type="text"
            bind:value={editIntent}
            placeholder="What are you looking for?"
          />
        {:else}
          <p class="intent-text">{intentStatement || '—'}</p>
        {/if}
      </section>

      <!-- Lifestyle tags -->
      {#if lifestyleTags.length > 0 || mode === 'enhance'}
        <section class="section">
          <div class="section-label">Lifestyle</div>
          {#if mode === 'enhance'}
            <input
              class="edit-input"
              type="text"
              value={editLifestyle.join(', ')}
              onchange={handleLifestyleEdit}
              placeholder="Travel, Fitness, Food & Dining"
            />
            <p class="edit-hint">Comma-separated</p>
          {:else}
            <div class="tag-row">
              {#each lifestyleTags as tag}
                <span class="tag lifestyle">{tag}</span>
              {/each}
            </div>
          {/if}
        </section>
      {/if}

      <!-- CTA to discover -->
      {#if mode === 'public'}
        <button class="discover-cta" onclick={() => goto('/verified-vibe/discover')}>
          Start discovering matches
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </button>
      {/if}

      <!-- Sign Out Button -->
      <button class="sign-out-btn" onclick={handleSignOut} title="Sign out">
        <LogOut size={16} />
        Sign out
      </button>
      </div>
    {:else if activeTab === 'boost'}
      <!-- Trust & Boost Tab Content -->
      <div class="profile-sections">

        <!-- Trust Score Section -->
        <section class="section">
          <div class="section-label">
            <ShieldCheck size={13} />
            Your Trust Score
          </div>
          <div class="trust-gauge-container">
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
                  stroke-dasharray="{(trustScore / 100) * 565} 565"
                  stroke-linecap="round"
                  transform="rotate(-90 100 100)"
                />
                <text x="100" y="100" text-anchor="middle" dy="0.3em" class="gauge-text">
                  <tspan class="gauge-number">{trustScore}</tspan>
                  <tspan x="100" dy="1.2em" class="gauge-label-small">/ 100</tspan>
                </text>
              </svg>
            </div>
            <p class="trust-label-text">{trustLabel}</p>
            <div class="breakdown">
              {#each trustBreakdown as item}
                <div class="breakdown-item">
                  <div class="breakdown-header">
                    <span class="breakdown-name">{item.category}</span>
                    <span class="breakdown-score">{Math.round(item.score)}/{item.max}</span>
                  </div>
                  <div class="breakdown-bar">
                    <div class="breakdown-fill" style="width: {(item.score / item.max) * 100}%"></div>
                  </div>
                </div>
              {/each}
            </div>
            <button class="btn btn-secondary full edit-qa-btn" onclick={() => showEditQAModal = true}>
              Edit Q&A to boost score
            </button>
          </div>
        </section>

        <section class="section">
          <div class="section-label">
            <Zap size={13} />
            What Each Tier Unlocks
          </div>
          <div class="tier-list">
            <div class="tier-item unlocked">
              <div class="tier-check">✓</div>
              <div class="tier-content">
                <div class="tier-title">60 · Visible</div>
                <div class="tier-desc">You start showing up in pools.</div>
              </div>
            </div>
            <div class="tier-item unlocked">
              <div class="tier-check">✓</div>
              <div class="tier-content">
                <div class="tier-title">70 · Featured</div>
                <div class="tier-desc">Spoilt Women see you in their "Live now" ← you're here</div>
              </div>
            </div>
            <div class="tier-item locked">
              <div class="tier-number">85</div>
              <div class="tier-content">
                <div class="tier-title">85 · Priority</div>
                <div class="tier-desc">You appear first. Marriage-Minded matches open up.</div>
              </div>
            </div>
            <div class="tier-item locked">
              <div class="tier-number">95</div>
              <div class="tier-content">
                <div class="tier-title">95 · Elite</div>
                <div class="tier-desc">Safety-First Women can see you. Their pool is exclusive.</div>
              </div>
            </div>
          </div>
          <p class="tier-note">🔒 Everything here stays private. Matches only</p>
        </section>

        <section class="section">
          <div class="section-label">
            <Heart size={13} />
            Connect a habit tracker
          </div>
          <div class="habit-tracker-cta">
            <div class="habit-icon">+<br/>2</div>
            <div class="habit-content">
              <div class="habit-title">Connect a habit tracker</div>
              <div class="habit-desc">Sleep, gym, reading — proves the lifestyle isn't fiction.</div>
              <div class="habit-time">1 min</div>
            </div>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 5l7 7-7 7"/>
            </svg>
          </div>
        </section>

        <!-- AI Bestie — female users only, in Trust & Boost tab -->
        {#if $user?.gender === 'woman'}
          <section class="section ai-bestie-section">
            <div class="section-label">
              <Sparkles size={13} />
              AI Bestie
            </div>
            <div class="ai-bestie-card">
              <BestieAvatar size={52} />
              <div class="ai-bestie-body">
                <h3 class="ai-bestie-title">Your personal match advisor</h3>
                <p class="ai-bestie-desc">AI Bestie screens your matches and gives you insights. Tell her exactly what to look for.</p>
              </div>
            </div>
            <div class="ai-bestie-actions">
              <button class="ai-bestie-btn-secondary" onclick={() => goto('/verified-vibe/chat/ai-bestie')}>
                Open chat
              </button>
              <button class="ai-bestie-btn" onclick={() => goto('/verified-vibe/chat/ai-bestie/configure')}>
                Configure
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </button>
            </div>
          </section>
        {/if}

        <!-- Sign Out Button -->
        <button class="sign-out-btn" onclick={handleSignOut} title="Sign out">
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    {/if}
  </div>
</div>

<!-- Edit Q&A Modal -->
{#if showEditQAModal}
  <div class="modal-overlay" onclick={() => (showEditQAModal = false)} onkeydown={(e) => e.key === 'Escape' && (showEditQAModal = false)} role="button" tabindex="0">
    <div class="modal" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()} role="button" tabindex="0">
      <div class="modal-header">
        <h3>Boost your Trust Score</h3>
        <button class="close-btn" onclick={() => (showEditQAModal = false)}>✕</button>
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
        <button class="btn btn-secondary" onclick={() => (showEditQAModal = false)}>Cancel</button>
        <button class="btn btn-primary" onclick={() => (showEditQAModal = false)}>Save</button>
      </div>
    </div>
  </div>
{/if}

<!-- Hidden file input for photo upload -->
<input
  type="file"
  accept="image/*"
  bind:this={fileInput}
  onchange={handleFileSelect}
  style="display: none;"
/>

<style>
  .profile-page {
    display: flex;
    flex-direction: column;
    min-height: 100%;
    background: var(--bg-1);
  }

  /* Header */
  .profile-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-1);
    background: var(--bg-1);
    position: sticky;
    top: 0;
    z-index: 10;
    gap: 8px;
  }

  .header-label {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-1);
    flex: 1;
    text-align: center;
  }

  .back-btn {
    width: 32px;
    height: 32px;
    border-radius: 6px;
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    display: grid;
    place-items: center;
    cursor: pointer;
    color: var(--text-2);
    flex-shrink: 0;
  }

  .edit-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 10px;
    border-radius: 6px;
    background: var(--bg-2);
    border: 1px solid var(--border-2);
    color: var(--text-2);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
    transition: all 150ms ease;
    flex-shrink: 0;
  }

  .edit-btn:active {
    color: var(--text-1);
    border-color: var(--accent-bright);
  }

  @media (min-width: 768px) {
    .profile-header {
      padding: 16px 20px;
      gap: 12px;
    }

    .header-label {
      font-size: 15px;
    }

    .back-btn {
      width: 36px;
      height: 36px;
      border-radius: 8px;
    }

    .edit-btn {
      padding: 7px 12px;
      border-radius: 8px;
      font-size: 13px;
      gap: 6px;
    }

    .edit-btn:hover {
      color: var(--text-1);
      border-color: var(--accent-bright);
    }
  }

  .edit-actions {
    display: flex;
    gap: 8px;
  }

  /* Tab Navigation */
  .tab-navigation {
    display: flex;
    gap: 8px;
    padding: 10px 12px;
    border-bottom: 1px solid var(--border-1);
    background: var(--bg-1);
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .tab-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    border-radius: 999px;
    background: transparent;
    border: 1.5px solid var(--border-2);
    color: var(--text-3);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
    transition: all 150ms ease;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .tab-btn:active {
    border-color: var(--accent-bright);
    color: var(--accent-bright);
  }

  .tab-btn.active {
    background: var(--accent-tint);
    border-color: var(--accent-bright);
    color: var(--accent-bright);
  }

  @media (min-width: 768px) {
    .tab-navigation {
      gap: 12px;
      padding: 12px 16px;
    }

    .tab-btn {
      gap: 8px;
      padding: 10px 16px;
      font-size: 13px;
    }

    .tab-btn:hover {
      border-color: var(--accent-bright);
      color: var(--accent-bright);
    }
  }

  .boost-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 24px;
    height: 20px;
    padding: 0 6px;
    border-radius: 999px;
    background: var(--accent-bright);
    color: var(--bg-1);
    font-size: 11px;
    font-weight: 700;
    margin-left: 4px;
  }

  .tab-btn.active .boost-badge {
    background: var(--accent-bright);
  }

  /* Trust score within Trust & Boost tab */
  .trust-gauge-container {
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    border-radius: var(--r-lg);
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .gauge-visual {
    display: flex;
    justify-content: center;
  }

  .radial-gauge {
    width: 140px;
    height: 140px;
  }

  .gauge-text {
    font-family: var(--font-mono);
  }

  .gauge-number {
    font-size: 44px;
    font-weight: 700;
    fill: var(--text-1);
  }

  .gauge-label-small {
    font-size: 13px;
    fill: var(--text-3);
  }

  .trust-label-text {
    text-align: center;
    font-size: 15px;
    font-weight: 600;
    color: var(--accent);
    margin: 0;
  }

  .breakdown {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .breakdown-item {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .breakdown-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .breakdown-name {
    font-size: 13px;
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

  .edit-qa-btn {
    margin-top: 4px;
  }

  .full {
    width: 100%;
  }

  /* Modal */
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

  .icon-btn {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    border: 1px solid var(--border-1);
    display: grid;
    place-items: center;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .icon-btn.cancel {
    background: var(--bg-2);
    color: var(--text-2);
  }

  .icon-btn.save {
    background: var(--accent-bright);
    color: var(--bg-1);
    border-color: var(--accent-bright);
  }

  /* Hero */
  .hero-wrap {
    position: relative;
    width: 100%;
    aspect-ratio: 4 / 5;
    max-height: 100%;
    overflow: hidden;
    background: var(--bg-3);
    flex-shrink: 0;
  }

  .hero-photo {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .hero-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    background: var(--bg-3);
  }

  .hero-placeholder-icon {
    font-size: 40px;
  }

  .hero-placeholder-text {
    font-size: 13px;
    color: var(--text-3);
    text-align: center;
    line-height: 1.4;
    margin: 0;
  }

  .hero-gradient {
    position: absolute;
    inset: 0;
    background: linear-gradient(to top, rgba(11,17,32,0.95) 0%, rgba(11,17,32,0.4) 50%, transparent 80%);
    pointer-events: none;
  }

  .hero-identity {
    position: absolute;
    bottom: 16px;
    left: 16px;
    right: 16px;
  }

  .hero-name-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }

  .hero-name {
    font-family: var(--font-serif);
    font-size: 26px;
    font-style: italic;
    color: #fff;
    margin: 0;
    line-height: 1;
  }

  .trust-badge {
    display: flex;
    align-items: center;
    gap: 3px;
    padding: 3px 6px;
    border-radius: 999px;
    background: rgba(16, 185, 129, 0.2);
    border: 1px solid rgba(52, 211, 153, 0.4);
    color: var(--accent-bright);
    font-size: 11px;
    font-weight: 600;
    flex-shrink: 0;
  }

  .hero-city {
    display: flex;
    align-items: center;
    gap: 3px;
    font-size: 12px;
    color: rgba(255,255,255,0.7);
    margin-bottom: 6px;
  }

  .archetype-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--accent-tint);
    border: 1px solid var(--accent-bright);
    color: var(--accent-bright);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  @media (min-width: 768px) {
    .hero-wrap {
      max-height: 480px;
    }

    .hero-placeholder-icon {
      font-size: 48px;
    }

    .hero-placeholder-text {
      font-size: 14px;
      gap: 12px;
    }

    .hero-identity {
      bottom: 20px;
      left: 20px;
      right: 20px;
    }

    .hero-name-row {
      gap: 10px;
      margin-bottom: 6px;
    }

    .hero-name {
      font-size: 32px;
    }

    .trust-badge {
      gap: 4px;
      padding: 4px 8px;
      font-size: 12px;
    }

    .hero-city {
      gap: 4px;
      font-size: 13px;
      margin-bottom: 8px;
    }

    .archetype-badge {
      padding: 3px 10px;
      font-size: 11px;
    }
  }

  /* Body */
  .profile-body {
    flex: 1;
  }

  .profile-sections {
    padding: 16px 16px 48px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .section-label {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 10px;
    font-weight: 700;
    color: var(--text-3);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .section-count {
    margin-left: auto;
    font-size: 10px;
    font-weight: 500;
    color: var(--text-4);
  }

  .section-hint {
    margin-left: auto;
    font-size: 9px;
    font-weight: 400;
    color: var(--text-4);
    text-transform: none;
    letter-spacing: 0;
  }

  @media (min-width: 768px) {
    .profile-sections {
      padding: 24px 20px 48px;
      gap: 28px;
    }

    .section {
      gap: 10px;
    }

    .section-label {
      gap: 6px;
      font-size: 11px;
    }

    .section-count {
      font-size: 11px;
    }

    .section-hint {
      font-size: 10px;
    }
  }

  /* Vibe Tags */
  .vibe-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .vibe-tag {
    padding: 8px 16px;
    border-radius: 999px;
    background: var(--bg-2);
    border: 1px solid var(--border-2);
    color: var(--text-2);
    font-size: 13px;
    font-weight: 500;
    transition: all 150ms ease;
  }

  .vibe-tag.highlighted {
    background: var(--accent-bright);
    border-color: var(--accent-bright);
    color: var(--bg-1);
    font-weight: 600;
  }

  .ai-tag {
    font-size: 10px;
    font-weight: 600;
    color: var(--accent-bright);
    background: var(--accent-tint);
    padding: 2px 7px;
    border-radius: 999px;
    letter-spacing: 0.02em;
    text-transform: none;
  }

  .about-text {
    font-size: 15px;
    color: var(--text-1);
    line-height: 1.65;
    margin: 0;
  }

  .intent-text {
    font-size: 15px;
    color: var(--text-2);
    line-height: 1.5;
    margin: 0;
    font-style: italic;
  }

  /* Tags */
  .tag-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .tag {
    padding: 6px 14px;
    border-radius: 999px;
    background: var(--bg-2);
    border: 1px solid var(--border-2);
    color: var(--text-2);
    font-size: 13px;
    font-weight: 500;
  }

  .tag.lifestyle {
    background: var(--accent-tint);
    border-color: rgba(52,211,153,0.25);
    color: var(--accent-bright);
  }

  /* Personality Reads */
  .personality-reads {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .read-item {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .read-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .read-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-1);
  }

  .read-level {
    font-size: 12px;
    font-weight: 600;
    color: var(--accent-bright);
  }

  .read-bar {
    width: 100%;
    height: 6px;
    border-radius: 3px;
    background: var(--bg-3);
    overflow: hidden;
  }

  .read-fill {
    height: 100%;
    background: var(--accent-bright);
    transition: width 300ms ease;
  }

  .read-desc {
    font-size: 12px;
    color: var(--text-3);
    margin: 0;
    line-height: 1.4;
  }

  /* What He Brings */
  .brings-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .brings-item {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px 14px;
    border-radius: 10px;
    background: var(--bg-2);
    border: 1px solid var(--border-2);
  }

  .brings-check {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--accent-bright);
    color: var(--bg-1);
    font-size: 12px;
    font-weight: 700;
    flex-shrink: 0;
  }

  .brings-text {
    font-size: 14px;
    color: var(--text-1);
    line-height: 1.4;
  }

  /* Here For */
  .here-for-card {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    padding: 16px;
    border-radius: 12px;
    background: var(--accent-tint);
    border: 1.5px solid var(--accent-bright);
  }

  .here-for-icon {
    font-size: 28px;
    flex-shrink: 0;
  }

  .here-for-content {
    flex: 1;
    min-width: 0;
  }

  .here-for-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--accent-bright);
    margin: 0 0 6px;
  }

  .here-for-desc {
    font-size: 13px;
    color: var(--text-2);
    margin: 0;
    line-height: 1.5;
  }

  /* Hard Nos */
  .hard-nos-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .hard-no-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 8px;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.2);
  }

  .hard-no-x {
    font-size: 14px;
    font-weight: 700;
    color: #ef4444;
  }

  .hard-no-text {
    font-size: 13px;
    color: #ef4444;
    font-weight: 500;
  }

  /* Photo grid */
  .photo-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 5px;
  }

  .photo-cell {
    position: relative;
    aspect-ratio: 3/4;
    border-radius: 6px;
    overflow: hidden;
    background: var(--bg-2);
  }

  .photo-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .photo-label {
    position: absolute;
    bottom: 4px;
    left: 5px;
    font-size: 8px;
    font-weight: 600;
    color: rgba(255,255,255,0.8);
    text-transform: capitalize;
    letter-spacing: 0.03em;
    text-shadow: 0 1px 3px rgba(0,0,0,0.6);
  }

  .photo-cell.placeholder {
    border: 1.5px dashed var(--border-2);
    background: var(--bg-2);
  }

  .placeholder-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 4px;
    padding: 6px;
  }

  .placeholder-icon {
    font-size: 18px;
    color: var(--text-4);
    font-weight: 300;
  }

  .placeholder-text {
    font-size: 8px;
    color: var(--text-4);
    text-align: center;
    line-height: 1.3;
  }

  .placeholder-text em {
    color: var(--accent-bright);
    font-style: normal;
    font-weight: 600;
  }

  .ai-photo-badge {
    position: absolute;
    top: 4px;
    right: 5px;
    font-size: 11px;
    filter: drop-shadow(0 1px 2px rgba(0,0,0,0.5));
  }

  .enhance-photos-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 100%;
    padding: 11px 14px;
    border-radius: 10px;
    background: linear-gradient(135deg, #7c3aed, #a855f7);
    color: white;
    font-size: 13px;
    font-weight: 600;
    border: none;
    cursor: pointer;
    transition: all 150ms ease;
    font-family: inherit;
    margin-top: 3px;
  }

  .enhance-photos-btn:active:not(:disabled) {
    opacity: 0.85;
    transform: scale(0.98);
  }

  .enhance-photos-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    transform: none;
  }

  @media (min-width: 768px) {
    .photo-grid {
      gap: 6px;
    }

    .photo-cell {
      border-radius: 8px;
    }

    .photo-label {
      bottom: 5px;
      left: 6px;
      font-size: 9px;
    }

    .placeholder-inner {
      gap: 6px;
      padding: 8px;
    }

    .placeholder-icon {
      font-size: 20px;
    }

    .placeholder-text {
      font-size: 9px;
      line-height: 1.4;
    }

    .ai-photo-badge {
      top: 5px;
      right: 6px;
      font-size: 12px;
    }

    .enhance-photos-btn {
      gap: 8px;
      padding: 13px 16px;
      border-radius: 12px;
      font-size: 14px;
      margin-top: 4px;
    }

    .enhance-photos-btn:hover:not(:disabled) {
      opacity: 0.9;
      transform: translateY(-1px);
      box-shadow: 0 4px 16px rgba(139, 92, 246, 0.4);
    }

    .enhance-photos-btn:active:not(:disabled) {
      opacity: 0.85;
      transform: scale(1);
    }
  }

  .enhance-spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    flex-shrink: 0;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .enhance-error {
    font-size: 12px;
    color: #f87171;
    margin: 6px 0 0;
    text-align: center;
  }

  .photo-nudge {
    font-size: 12px;
    color: var(--text-4);
    text-align: center;
    margin: 8px 0 0;
    font-style: italic;
  }

  .regenerate-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 100%;
    padding: 9px 14px;
    border-radius: 8px;
    background: transparent;
    border: 1px solid rgba(139, 92, 246, 0.4);
    color: #a855f7;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
    font-family: inherit;
    margin-top: 6px;
  }

  .regenerate-btn:hover:not(:disabled) {
    background: rgba(139, 92, 246, 0.1);
  }

  .regenerate-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Enhance mode inputs */
  .edit-textarea {
    background: var(--bg-2);
    border: 1px solid var(--accent-bright);
    border-radius: 10px;
    padding: 12px 14px;
    font-size: 14px;
    color: var(--text-1);
    font-family: inherit;
    line-height: 1.5;
    resize: vertical;
    width: 100%;
    box-sizing: border-box;
  }

  .edit-textarea:focus {
    outline: none;
  }

  .edit-input {
    background: var(--bg-2);
    border: 1px solid var(--accent-bright);
    border-radius: 10px;
    padding: 12px 14px;
    font-size: 14px;
    color: var(--text-1);
    font-family: inherit;
    width: 100%;
    box-sizing: border-box;
  }

  .edit-input:focus {
    outline: none;
  }

  .edit-hint {
    font-size: 11px;
    color: var(--text-3);
    margin: 0;
  }

  /* CTA */
  .discover-cta {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 13px 16px;
    border-radius: 10px;
    background: var(--accent-bright);
    color: var(--bg-1);
    font-size: 14px;
    font-weight: 600;
    border: none;
    cursor: pointer;
    transition: all 150ms ease;
    font-family: inherit;
    width: 100%;
  }

  .discover-cta:active {
    opacity: 0.85;
    transform: scale(0.98);
  }

  /* Sign Out Button */
  .sign-out-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 11px 14px;
    margin-top: 10px;
    border-radius: 8px;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #ef4444;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
    font-family: inherit;
    width: 100%;
  }

  .sign-out-btn:active {
    background: rgba(239, 68, 68, 0.2);
    transform: scale(0.98);
  }

  @media (min-width: 768px) {
    .discover-cta {
      gap: 8px;
      padding: 16px 20px;
      border-radius: 14px;
      font-size: 15px;
    }

    .discover-cta:hover {
      opacity: 0.9;
      transform: translateY(-1px);
      box-shadow: 0 4px 16px var(--accent-glow);
    }

    .discover-cta:active {
      opacity: 0.85;
      transform: scale(1);
    }

    .sign-out-btn {
      gap: 8px;
      padding: 12px 16px;
      margin-top: 12px;
      border-radius: 10px;
      font-size: 14px;
    }

    .sign-out-btn:hover {
      background: rgba(239, 68, 68, 0.2);
      border-color: rgba(239, 68, 68, 0.5);
      box-shadow: 0 2px 8px rgba(239, 68, 68, 0.2);
    }

    .sign-out-btn:active {
      background: rgba(239, 68, 68, 0.2);
      transform: translateY(1px);
    }
  }

  /* Tier List */
  .tier-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .tier-item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 14px 16px;
    border-radius: 12px;
    background: var(--bg-2);
    border: 1px solid var(--border-2);
    transition: all 150ms ease;
  }

  .tier-item.unlocked {
    background: rgba(52, 211, 153, 0.08);
    border-color: rgba(52, 211, 153, 0.2);
  }

  .tier-item.locked {
    opacity: 0.6;
  }

  .tier-check {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--accent-bright);
    color: var(--bg-1);
    font-size: 14px;
    font-weight: 700;
    flex-shrink: 0;
  }

  .tier-number {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 8px;
    background: var(--bg-3);
    color: var(--text-3);
    font-size: 14px;
    font-weight: 600;
    flex-shrink: 0;
  }

  .tier-content {
    flex: 1;
    min-width: 0;
  }

  .tier-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-1);
    margin-bottom: 4px;
  }

  .tier-desc {
    font-size: 13px;
    color: var(--text-3);
    line-height: 1.4;
  }

  .tier-note {
    font-size: 12px;
    color: var(--text-4);
    margin: 12px 0 0;
    text-align: center;
  }

  /* Habit Tracker CTA */
  .habit-tracker-cta {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 16px;
    border-radius: 12px;
    background: var(--bg-2);
    border: 1.5px solid var(--border-2);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .habit-tracker-cta:hover {
    border-color: var(--accent-bright);
    background: rgba(52, 211, 153, 0.05);
  }

  .habit-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: var(--accent-bright);
    color: var(--bg-1);
    font-size: 18px;
    font-weight: 700;
    flex-shrink: 0;
    line-height: 1.2;
  }

  .habit-content {
    flex: 1;
    min-width: 0;
  }

  .habit-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-1);
    margin-bottom: 4px;
  }

  .habit-desc {
    font-size: 13px;
    color: var(--text-3);
    margin-bottom: 6px;
  }

  .habit-time {
    font-size: 11px;
    color: var(--accent-bright);
    font-weight: 600;
  }

  /* ── AI Bestie section ── */
  .ai-bestie-section {
    border: 1px solid rgba(236, 72, 153, 0.25);
    border-radius: 14px;
    background: linear-gradient(135deg, rgba(236, 72, 153, 0.06) 0%, rgba(168, 85, 247, 0.06) 100%);
    padding: 16px;
  }

  .ai-bestie-card {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    margin-top: 10px;
  }

  .ai-bestie-icon {
    font-size: 28px;
    flex-shrink: 0;
    line-height: 1;
  }

  .ai-bestie-body {
    flex: 1;
    min-width: 0;
  }

  .ai-bestie-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-1);
    margin: 0 0 4px;
  }

  .ai-bestie-desc {
    font-size: 13px;
    color: var(--text-3);
    margin: 0;
    line-height: 1.5;
  }

  .ai-bestie-actions {
    display: flex;
    gap: 8px;
    margin-top: 12px;
  }

  .ai-bestie-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 8px 14px;
    border-radius: 20px;
    background: linear-gradient(135deg, #ec4899, #a855f7);
    color: #fff;
    font-size: 13px;
    font-weight: 600;
    border: none;
    cursor: pointer;
    white-space: nowrap;
    transition: opacity 0.15s;
  }
  .ai-bestie-btn:hover { opacity: 0.88; }

  .ai-bestie-btn-secondary {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 8px 14px;
    border-radius: 20px;
    background: transparent;
    color: #ec4899;
    font-size: 13px;
    font-weight: 600;
    border: 1px solid rgba(236, 72, 153, 0.4);
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s;
  }
  .ai-bestie-btn-secondary:hover { background: rgba(236, 72, 153, 0.1); }

  @media (max-width: 767px) {
    .hero-name {
      font-size: 26px;
    }

    .profile-sections {
      padding: 20px 16px 48px;
    }
  }
</style>
