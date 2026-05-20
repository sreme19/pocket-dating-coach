<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { user } from '$lib/verified-vibe/stores';
  import { upsertProfile } from '$lib/verified-vibe/services/profileService';
  import { getSupabaseClient } from '$lib/client/supabase';
  import { ShieldCheck, Pencil, Check, X, MapPin, Sparkles, Wand2, LogOut } from 'lucide-svelte';
  import type { ProfileIntakeData } from '$lib/verified-vibe/components/ProfileIntakeStep.svelte';
  import type { PhotoEnhanceResult } from '$lib/photo-enhance/types';

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
  let draft = $state<ProfileIntakeData | null>(null);
  let generated = $state<GeneratedProfile | null>(null);
  let photos = $state<PhotoEntry[]>([]);
  let aiPhotos = $state<PhotoEnhanceResult[]>([]);
  let enhancing = $state(false);
  let enhanceError = $state<string | null>(null);
  let generationProgress = $state(0); // 0-5 for number of photos generated

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

    <div class="profile-sections">
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

      <!-- Personality -->
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

      <!-- Photo grid -->
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
  </div>
</div>

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
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-1);
    background: var(--bg-1);
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .header-label {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-1);
  }

  .back-btn {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    display: grid;
    place-items: center;
    cursor: pointer;
    color: var(--text-2);
  }

  .edit-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 7px 12px;
    border-radius: 8px;
    background: var(--bg-2);
    border: 1px solid var(--border-2);
    color: var(--text-2);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
    transition: all 150ms ease;
  }

  .edit-btn:hover {
    color: var(--text-1);
    border-color: var(--accent-bright);
  }

  .edit-actions {
    display: flex;
    gap: 8px;
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
    max-height: 480px;
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
    gap: 12px;
    background: var(--bg-3);
  }

  .hero-placeholder-icon {
    font-size: 48px;
  }

  .hero-placeholder-text {
    font-size: 14px;
    color: var(--text-3);
    text-align: center;
    line-height: 1.5;
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
    bottom: 20px;
    left: 20px;
    right: 20px;
  }

  .hero-name-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 6px;
  }

  .hero-name {
    font-family: var(--font-serif);
    font-size: 32px;
    font-style: italic;
    color: #fff;
    margin: 0;
    line-height: 1;
  }

  .trust-badge {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border-radius: 999px;
    background: rgba(16, 185, 129, 0.2);
    border: 1px solid rgba(52, 211, 153, 0.4);
    color: var(--accent-bright);
    font-size: 12px;
    font-weight: 600;
    flex-shrink: 0;
  }

  .hero-city {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
    color: rgba(255,255,255,0.7);
    margin-bottom: 8px;
  }

  .archetype-badge {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 999px;
    background: var(--accent-tint);
    border: 1px solid var(--accent-bright);
    color: var(--accent-bright);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  /* Body */
  .profile-body {
    flex: 1;
  }

  .profile-sections {
    padding: 24px 20px 48px;
    display: flex;
    flex-direction: column;
    gap: 28px;
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .section-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 700;
    color: var(--text-3);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .section-count {
    margin-left: auto;
    font-size: 11px;
    font-weight: 500;
    color: var(--text-4);
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

  /* Photo grid */
  .photo-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }

  .photo-cell {
    position: relative;
    aspect-ratio: 3/4;
    border-radius: 8px;
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
    bottom: 5px;
    left: 6px;
    font-size: 9px;
    font-weight: 600;
    color: rgba(255,255,255,0.8);
    text-transform: capitalize;
    letter-spacing: 0.03em;
    text-shadow: 0 1px 3px rgba(0,0,0,0.6);
  }

  /* Generation progress */
  .generation-progress {
    margin-bottom: 16px;
    padding: 12px;
    border-radius: 10px;
    background: var(--bg-2);
  }

  .progress-text {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-2);
    margin-bottom: 8px;
  }

  .progress-bar {
    width: 100%;
    height: 6px;
    border-radius: 3px;
    background: var(--bg-3);
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #7c3aed, #a855f7);
    transition: width 300ms ease;
  }

  /* Loading skeleton */
  .photo-cell.loading {
    background: var(--bg-2);
    border: 1px solid var(--border-1);
  }

  .skeleton-pulse {
    width: 100%;
    height: 100%;
    background: linear-gradient(
      90deg,
      var(--bg-3) 0%,
      var(--bg-2) 50%,
      var(--bg-3) 100%
    );
    background-size: 200% 100%;
    animation: skeleton-loading 1.5s infinite;
  }

  @keyframes skeleton-loading {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
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
    gap: 6px;
    padding: 8px;
  }

  .placeholder-icon {
    font-size: 20px;
    color: var(--text-4);
    font-weight: 300;
  }

  .placeholder-text {
    font-size: 9px;
    color: var(--text-4);
    text-align: center;
    line-height: 1.4;
  }

  .placeholder-text em {
    color: var(--accent-bright);
    font-style: normal;
    font-weight: 600;
  }

  .ai-photo-badge {
    position: absolute;
    top: 5px;
    right: 6px;
    font-size: 12px;
    filter: drop-shadow(0 1px 2px rgba(0,0,0,0.5));
  }

  .enhance-photos-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 13px 16px;
    border-radius: 12px;
    background: linear-gradient(135deg, #7c3aed, #a855f7);
    color: white;
    font-size: 14px;
    font-weight: 600;
    border: none;
    cursor: pointer;
    transition: all 150ms ease;
    font-family: inherit;
    margin-top: 4px;
  }

  .enhance-photos-btn:hover:not(:disabled) {
    opacity: 0.9;
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(139, 92, 246, 0.4);
  }

  .enhance-photos-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    transform: none;
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
    gap: 8px;
    padding: 16px 20px;
    border-radius: 14px;
    background: var(--accent-bright);
    color: var(--bg-1);
    font-size: 15px;
    font-weight: 600;
    border: none;
    cursor: pointer;
    transition: all 150ms ease;
    font-family: inherit;
    width: 100%;
  }

  .discover-cta:hover {
    opacity: 0.9;
    transform: translateY(-1px);
    box-shadow: 0 4px 16px var(--accent-glow);
  }

  /* Sign Out Button */
  .sign-out-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 16px;
    margin-top: 12px;
    border-radius: 10px;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #ef4444;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
    font-family: inherit;
    width: 100%;
  }

  .sign-out-btn:hover {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.5);
    box-shadow: 0 2px 8px rgba(239, 68, 68, 0.2);
  }

  .sign-out-btn:active {
    transform: translateY(1px);
  }

  @media (max-width: 767px) {
    .hero-name {
      font-size: 26px;
    }

    .profile-sections {
      padding: 20px 16px 48px;
    }
  }
</style>
