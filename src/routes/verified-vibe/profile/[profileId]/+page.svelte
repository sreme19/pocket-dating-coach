<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { ShieldCheck, MapPin } from 'lucide-svelte';

  interface PublicProfile {
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
  }

  let profile = $state<PublicProfile | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  const profileId = $page.params.profileId;

  const intentTags = $derived(
    (() => {
      const raw = profile?.looking ?? '';
      if (!raw) return [];
      return raw.split(',').map((s: string) => s.trim()).filter(Boolean);
    })()
  );

  onMount(async () => {
    try {
      const res = await fetch(`/api/verified-vibe/public-profile/${profileId}`);
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? 'Profile not found');
      profile = json.data;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Something went wrong';
    } finally {
      loading = false;
    }
  });
</script>

<svelte:head>
  <title>{profile ? `${profile.firstName}'s Profile` : 'Profile'} · Verified Vibe</title>
</svelte:head>

<div class="public-profile-page">
  {#if loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading profile…</p>
    </div>
  {:else if error}
    <div class="error-state">
      <p class="error-msg">{error}</p>
      <a href="/verified-vibe/auth?mode=signin" class="cta-btn">Join Verified Vibe</a>
    </div>
  {:else if profile}
    <!-- Hero photo -->
    <div class="hero-wrap">
      {#if profile.avatar}
        <img class="hero-photo" src={profile.avatar} alt="{profile.firstName}'s photo" />
      {:else}
        <div class="hero-placeholder">
          <span class="placeholder-icon">📸</span>
        </div>
      {/if}
      <div class="hero-gradient"></div>
      <div class="hero-identity">
        <div class="hero-name-row">
          <h1 class="hero-name">{profile.firstName}{profile.age ? `, ${profile.age}` : ''}</h1>
          {#if profile.trustScore > 0}
            <div class="trust-badge">
              <ShieldCheck size={13} />
              {profile.trustScore}
            </div>
          {/if}
        </div>
        {#if profile.city}
          <div class="hero-city">
            <MapPin size={12} />
            {profile.city}
          </div>
        {/if}
        {#if profile.archetypeName}
          <div class="archetype-badge">{profile.archetypeEmoji} {profile.archetypeName}</div>
        {/if}
      </div>
    </div>

    <div class="profile-sections">
      <!-- About -->
      {#if profile.about}
        <section class="section">
          <div class="section-label">About</div>
          <p class="about-text">{profile.about}</p>
        </section>
      {/if}

      <!-- Looking for -->
      {#if intentTags.length > 0}
        <section class="section">
          <div class="section-label">Looking for</div>
          <div class="tag-row">
            {#each intentTags as tag}
              <span class="tag">{tag}</span>
            {/each}
          </div>
        </section>
      {/if}

      <!-- Privacy note -->
      <div class="privacy-note">
        <span class="lock-icon">🔒</span>
        Everything here stays private. We only verify that this profile reflects real life. This improves Trust Score and who they match with.
      </div>

      <!-- CTA -->
      <div class="cta-wrap">
        <a href="/verified-vibe/auth?mode=signin" class="cta-btn">
          Connect on Verified Vibe
        </a>
        <p class="cta-sub">Join to see their full verified profile</p>
      </div>
    </div>
  {/if}
</div>

<style>
  .public-profile-page {
    min-height: 100vh;
    background: #0d1117;
    color: #e8e8e8;
    display: flex;
    flex-direction: column;
    max-width: 480px;
    margin: 0 auto;
  }

  .loading-state, .error-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 40px 24px;
    color: rgba(255,255,255,0.5);
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid rgba(255,255,255,0.1);
    border-top-color: #34d399;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  .error-msg {
    font-size: 14px;
    text-align: center;
  }

  /* Hero */
  .hero-wrap {
    position: relative;
    width: 100%;
    aspect-ratio: 3/4;
    max-height: 520px;
    overflow: hidden;
    background: #1a2030;
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
    align-items: center;
    justify-content: center;
    background: #1a2030;
  }

  .placeholder-icon {
    font-size: 48px;
    opacity: 0.4;
  }

  .hero-gradient {
    position: absolute;
    inset: 0;
    background: linear-gradient(to bottom, transparent 40%, rgba(13,17,23,0.95) 100%);
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
  }

  .hero-name {
    font-family: 'Georgia', serif;
    font-style: italic;
    font-size: 28px;
    color: #fff;
    margin: 0;
    line-height: 1.1;
  }

  .trust-badge {
    display: flex;
    align-items: center;
    gap: 4px;
    background: rgba(52,211,153,0.18);
    color: #34d399;
    border: 1px solid rgba(52,211,153,0.3);
    border-radius: 20px;
    padding: 3px 9px;
    font-size: 12px;
    font-weight: 600;
    flex-shrink: 0;
  }

  .hero-city {
    display: flex;
    align-items: center;
    gap: 4px;
    color: rgba(255,255,255,0.65);
    font-size: 13px;
    margin-top: 5px;
  }

  .archetype-badge {
    display: inline-block;
    margin-top: 6px;
    background: rgba(255,255,255,0.12);
    border: 1px solid rgba(255,255,255,0.18);
    border-radius: 12px;
    padding: 3px 10px;
    font-size: 12px;
    color: rgba(255,255,255,0.8);
  }

  /* Sections */
  .profile-sections {
    padding: 20px 20px 40px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .section-label {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.35);
  }

  .about-text {
    font-size: 14px;
    line-height: 1.65;
    color: rgba(255,255,255,0.75);
    margin: 0;
  }

  .tag-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .tag {
    background: rgba(255,255,255,0.07);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 20px;
    padding: 5px 12px;
    font-size: 13px;
    color: rgba(255,255,255,0.7);
  }

  /* Privacy note */
  .privacy-note {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px;
    padding: 14px 16px;
    font-size: 12px;
    color: rgba(255,255,255,0.45);
    line-height: 1.5;
    display: flex;
    gap: 8px;
    align-items: flex-start;
  }

  .lock-icon { flex-shrink: 0; font-size: 13px; }

  /* CTA */
  .cta-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding-top: 4px;
  }

  .cta-btn {
    display: block;
    width: 100%;
    text-align: center;
    background: linear-gradient(135deg, #34d399, #059669);
    color: #fff;
    font-weight: 700;
    font-size: 15px;
    padding: 14px 24px;
    border-radius: 14px;
    text-decoration: none;
    box-shadow: 0 4px 20px rgba(52,211,153,0.25);
    transition: opacity 0.15s;
  }

  .cta-btn:hover { opacity: 0.9; }

  .cta-sub {
    font-size: 12px;
    color: rgba(255,255,255,0.35);
    margin: 0;
  }
</style>
