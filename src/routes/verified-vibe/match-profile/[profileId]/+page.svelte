<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { fade, fly } from 'svelte/transition';
  import { user } from '$lib/verified-vibe/stores';
  import { getSupabaseClient } from '$lib/client/supabase';
  import TrustScoreBadge from '$lib/verified-vibe/components/TrustScoreBadge.svelte';

  // ── Types ──────────────────────────────────────────────────────────────────
  interface TraitScores {
    decisiveness: number;
    warmth: number;
    openness: number;
    pace: number;
  }

  interface MatchProfileData {
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
    traitScores: TraitScores;
    brings: string[];
    hereFor: string;
    communicationStyle: string | null;
    mattersMost: string | null;
  }

  // ── State ──────────────────────────────────────────────────────────────────
  let profileId = $state($page.params.profileId || '');
  let profile = $state<MatchProfileData | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let currentUserGender = $state<string | null>(null);

  // Where to go back — carry 'from' query param so we can return to the right chat
  let backUrl = $derived($page.url.searchParams.get('from') || '/verified-vibe/chat');

  // ── Tip state ──────────────────────────────────────────────────────────────
  const TIP_TAGS: Record<string, { id: string; label: string }[]> = {
    man: [
      { id: 'stunning',         label: '✨ Stunning' },
      { id: 'elegant',          label: '👑 Elegant' },
      { id: 'approachable',     label: '🤗 Approachable' },
      { id: 'warm',             label: '🌸 Warm' },
      { id: 'authentic',        label: '💎 Authentic' },
      { id: 'interesting-vibe', label: '💫 Interesting vibe' },
      { id: 'intimidating',     label: '😤 Intimidating' },
      { id: 'guarded',          label: '🛡️ Guarded' },
      { id: 'great-photos',     label: '📸 Great photos' },
      { id: 'improve-photos',   label: '📷 Better photos needed' },
    ],
    woman: [
      { id: 'handsome',          label: '😍 Handsome' },
      { id: 'successful-vibes',  label: '💼 Successful vibes' },
      { id: 'trustworthy',       label: '🤝 Trustworthy' },
      { id: 'charming',          label: '✨ Charming' },
      { id: 'well-spoken',       label: '🗣️ Well-spoken' },
      { id: 'mysterious',        label: '🌙 Mysterious' },
      { id: 'red-flag-energy',   label: '🚩 Red flag energy' },
      { id: 'not-my-type',       label: '🙅 Not my type' },
      { id: 'great-photos',      label: '📸 Great photos' },
      { id: 'improve-photos',    label: '📷 Better photos needed' },
    ],
  };

  let showTipForm    = $state(false);
  let selectedTags   = $state(new Set<string>());
  let tipText        = $state('');
  let tipSubmitting  = $state(false);
  let tipSubmitted   = $state(false);
  let tipError       = $state('');

  const availableTags = $derived(currentUserGender ? (TIP_TAGS[currentUserGender] ?? []) : []);
  const canSubmitTip  = $derived(selectedTags.size > 0 || tipText.trim().length > 0);

  function toggleTag(id: string) {
    const next = new Set(selectedTags);
    next.has(id) ? next.delete(id) : next.add(id);
    selectedTags = next;
  }

  async function submitTip() {
    if (!canSubmitTip || tipSubmitting || !profile) return;
    // Guard: submitterGender must be a valid value
    const gender = currentUserGender ?? $user?.gender ?? null;
    if (!gender || !['man', 'woman', 'prefer_not_to_say'].includes(gender)) {
      tipError = 'Could not determine your gender — please refresh and try again.';
      return;
    }
    tipSubmitting = true;
    tipError = '';
    try {
      const res = await fetch('/api/verified-vibe/tips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: profile.id,
          submitterGender: gender,
          tags: [...selectedTags],
          text: tipText.trim() || null,
        }),
      });
      let data: { error?: string; ok?: boolean } = {};
      try { data = await res.json(); } catch { /* non-JSON response */ }
      if (res.ok) {
        tipSubmitted = true;
      } else {
        tipError = data.error ?? `Submission failed (${res.status}) — please try again.`;
      }
    } catch {
      tipError = 'Network error — please try again.';
    } finally {
      tipSubmitting = false;
    }
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  onMount(async () => {
    user.hydrate();
    await loadProfile();
  });

  // ── Helpers ────────────────────────────────────────────────────────────────
  async function loadProfile() {
    if (!profileId) { error = 'No profile ID'; loading = false; return; }

    const supabase = getSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token ?? '';

    // Load current user's gender for tip tag selection
    if (session?.user?.id) {
      try {
        const { data: me } = await supabase
          .from('verified_vibe_users')
          .select('gender')
          .eq('id', session.user.id)
          .maybeSingle();
        currentUserGender = (me as any)?.gender ?? $user?.gender ?? null;
      } catch { currentUserGender = $user?.gender ?? null; }
    }

    try {
      const res = await fetch(`/api/verified-vibe/match-profile/${profileId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? 'Failed to load profile');
      profile = json.data;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Something went wrong';
    } finally {
      loading = false;
    }
  }

  /** Format a 0–100 score as a percentage width for the bar. */
  function barWidth(score: number): string {
    return `${Math.max(4, Math.min(100, score))}%`;
  }

  /** Map a trait score to a label. */
  function traitLabel(score: number, low: string, high: string): string {
    if (score >= 75) return high;
    if (score <= 35) return low;
    return '';
  }
</script>

<div class="profile-screen">
  <!-- ── Header ── -->
  <div class="profile-header">
    <button class="back-btn" onclick={() => goto(backUrl)} aria-label="Go back">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
    </button>
    <span class="header-title">{profile?.firstName ?? 'Profile'}</span>
    <div style="width:36px"></div><!-- spacer -->
  </div>

  <!-- ── Loading ── -->
  {#if loading}
    <div class="loading-state" transition:fade>
      <div class="spinner"></div>
      <p>Loading profile…</p>
    </div>

  <!-- ── Error ── -->
  {:else if error || !profile}
    <div class="error-state" transition:fade>
      <p>😬 {error ?? 'Profile not found'}</p>
      <button class="retry-btn" onclick={loadProfile}>Try again</button>
    </div>

  <!-- ── Profile Content ── -->
  {:else}
    <div class="scroll-area" transition:fly={{ y: 12, duration: 250 }}>

      <!-- Photo + Trust Badge -->
      <div class="photo-block">
        {#if profile.avatar}
          <img src={profile.avatar} alt={profile.firstName} class="profile-photo" />
        {:else}
          <div class="photo-placeholder">
            <span class="photo-initial">{profile.firstName.charAt(0)}</span>
          </div>
        {/if}

        <!-- Trust badge overlaid -->
        <div class="trust-badge-wrap">
          <TrustScoreBadge score={profile.trustScore} size="md" />
        </div>
      </div>

      <!-- Name / Age / City -->
      <div class="identity-block">
        <h1 class="name">{profile.firstName}, {profile.age}</h1>
        <p class="location">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline-block;vertical-align:-1px">
            <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
          </svg>
          {profile.city}
        </p>
        <div class="archetype-chip">
          <span>{profile.archetypeEmoji}</span>
          <span>{profile.archetypeName}</span>
        </div>
      </div>

      <!-- Here For -->
      {#if profile.hereFor}
        <section class="section">
          <h2 class="section-title">
            <span class="section-icon">💫</span> Here For
          </h2>
          <p class="here-for-text">{profile.hereFor}</p>
        </section>
      {/if}

      <!-- The Vibe in Three Words -->
      {#if profile.vibeWords.length > 0}
        <section class="section">
          <h2 class="section-title">
            <span class="section-icon">✨</span> The Vibe in Three Words
          </h2>
          <div class="vibe-pills">
            {#each profile.vibeWords as word}
              <span class="vibe-pill">{word}</span>
            {/each}
          </div>
        </section>
      {/if}

      <!-- Personality Reads -->
      <section class="section">
        <h2 class="section-title">
          <span class="section-icon">🧠</span> Personality Reads
        </h2>
        <div class="trait-bars">
          {#each [
            { label: 'Decisiveness', score: profile.traitScores.decisiveness, low: 'Goes with the flow', high: 'Takes the lead' },
            { label: 'Warmth',       score: profile.traitScores.warmth,       low: 'Reserved',          high: 'Openly caring' },
            { label: 'Openness',     score: profile.traitScores.openness,     low: 'Traditional',       high: 'Adventurous' },
            { label: 'Pace',         score: profile.traitScores.pace,         low: 'Patient & slow',    high: 'Fast-paced' },
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
      {#if profile.brings.length > 0}
        <section class="section">
          <h2 class="section-title">
            <span class="section-icon">🎁</span> What He Brings
          </h2>
          <ul class="brings-list">
            {#each profile.brings.slice(0, 6) as item}
              <li class="brings-item">
                <span class="brings-check">✓</span>
                <span>{item}</span>
              </li>
            {/each}
          </ul>
        </section>
      {/if}

      <!-- About / Bio -->
      {#if profile.about}
        <section class="section">
          <h2 class="section-title">
            <span class="section-icon">📝</span> About
          </h2>
          <p class="about-text">{profile.about}</p>
        </section>
      {/if}

      <!-- Communication style -->
      {#if profile.communicationStyle}
        <section class="section">
          <h2 class="section-title">
            <span class="section-icon">💬</span> Communication Style
          </h2>
          <p class="about-text">{profile.communicationStyle}</p>
        </section>
      {/if}

      <!-- Matters Most -->
      {#if profile.mattersMost}
        <section class="section">
          <h2 class="section-title">
            <span class="section-icon">❤️</span> What Matters Most
          </h2>
          <p class="about-text">{profile.mattersMost}</p>
        </section>
      {/if}

      <!-- Anonymous Tip Section -->
      {#if availableTags.length > 0}
        <section class="section tip-section">
          <button
            class="tip-toggle"
            onclick={() => { showTipForm = !showTipForm; tipSubmitted = false; tipError = ''; }}
            aria-expanded={showTipForm}
          >
            <span class="tip-toggle-left">
              <span class="tip-toggle-icon">💡</span>
              <span class="tip-toggle-label">Leave an anonymous tip</span>
            </span>
            <span class="tip-toggle-chevron" class:flipped={showTipForm}>›</span>
          </button>

          {#if showTipForm}
            <div class="tip-form" transition:fly={{ y: 8, duration: 180 }}>
              {#if tipSubmitted}
                <div class="tip-success">
                  <span class="tip-success-icon">🎉</span>
                  <p>Tip sent — it's anonymous. Your input helps make matches better.</p>
                </div>
              {:else}
                <p class="tip-note">Your identity is never revealed. This helps AI coach {profile?.firstName} behind the scenes.</p>

                <div class="tip-tags">
                  {#each availableTags as tag}
                    <button
                      class="tip-tag"
                      class:tip-tag-selected={selectedTags.has(tag.id)}
                      onclick={() => toggleTag(tag.id)}
                      type="button"
                    >{tag.label}</button>
                  {/each}
                </div>

                <div class="tip-text-wrap">
                  <textarea
                    class="tip-textarea"
                    placeholder="Optional: add a note (max 280 chars)…"
                    maxlength="280"
                    rows="3"
                    bind:value={tipText}
                  ></textarea>
                  <span class="tip-char-count">{280 - tipText.length}</span>
                </div>

                {#if tipError}
                  <p class="tip-error">{tipError}</p>
                {/if}

                <button
                  class="tip-submit"
                  onclick={submitTip}
                  disabled={!canSubmitTip || tipSubmitting}
                >
                  {tipSubmitting ? 'Sending…' : 'Send anonymous tip'}
                </button>
              {/if}
            </div>
          {/if}
        </section>
      {/if}

      <div class="bottom-pad"></div>
    </div>
  {/if}
</div>

<style>
  /* ── Layout ── */
  .profile-screen {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-1);
    overflow: hidden;
  }

  /* ── Header ── */
  .profile-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-1);
    background: var(--bg-1);
    flex-shrink: 0;
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
    color: var(--text-1);
    transition: background 150ms;
    flex-shrink: 0;
  }
  .back-btn:hover { background: var(--bg-3); }

  .header-title {
    font-size: 16px;
    font-weight: 700;
    color: var(--text-1);
  }

  /* ── Loading / Error ── */
  .loading-state,
  .error-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    color: var(--text-3);
    font-size: 14px;
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--border-1);
    border-top-color: #ec4899;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .retry-btn {
    padding: 8px 18px;
    border-radius: 8px;
    background: rgba(236,72,153,0.1);
    border: 1px solid rgba(236,72,153,0.3);
    color: #ec4899;
    cursor: pointer;
    font-size: 13px;
  }

  /* ── Scroll area ── */
  .scroll-area {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  /* ── Photo block ── */
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

  /* ── Identity ── */
  .identity-block {
    padding: 16px 20px 8px;
  }

  .name {
    font-size: 26px;
    font-weight: 800;
    color: var(--text-1);
    margin: 0 0 4px;
  }

  .location {
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
    background: rgba(168, 85, 247, 0.12);
    border: 1px solid rgba(168, 85, 247, 0.3);
    font-size: 12px;
    font-weight: 600;
    color: #a855f7;
  }

  /* ── Sections ── */
  .section {
    padding: 16px 20px;
    border-top: 1px solid var(--border-1);
  }

  .section-title {
    font-size: 13px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-3);
    margin: 0 0 12px;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .section-icon {
    font-size: 14px;
  }

  /* Here For */
  .here-for-text {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-1);
    margin: 0;
  }

  /* Vibe pills */
  .vibe-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .vibe-pill {
    padding: 6px 14px;
    border-radius: 20px;
    font-size: 13px;
    font-weight: 600;
    background: rgba(236, 72, 153, 0.1);
    border: 1px solid rgba(236, 72, 153, 0.25);
    color: #ec4899;
  }

  /* Trait bars */
  .trait-bars {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .trait-row {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .trait-meta {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
  }

  .trait-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-1);
  }

  .trait-hint {
    font-size: 11px;
    color: var(--text-3);
    font-style: italic;
  }

  .bar-track {
    height: 6px;
    border-radius: 3px;
    background: var(--bg-3);
    overflow: hidden;
  }

  .bar-fill {
    height: 100%;
    border-radius: 3px;
    background: linear-gradient(90deg, #ec4899, #a855f7);
    transition: width 600ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* What He Brings */
  .brings-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .brings-item {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    font-size: 14px;
    color: var(--text-1);
  }

  .brings-check {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: rgba(255, 59, 107, 0.15);
    border: 1px solid rgba(255, 59, 107, 0.4);
    color: #FF3B6B;
    font-size: 11px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-top: 1px;
    font-weight: 700;
  }

  /* About / text sections */
  .about-text {
    font-size: 14px;
    line-height: 1.65;
    color: var(--text-2);
    margin: 0;
  }

  .bottom-pad { height: 32px; }

  /* ── Tip section ── */
  .tip-section {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .tip-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    font-family: inherit;
  }

  .tip-toggle-left {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .tip-toggle-icon {
    font-size: 14px;
  }

  .tip-toggle-label {
    font-size: 13px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-3);
  }

  .tip-toggle-chevron {
    font-size: 18px;
    color: var(--text-3);
    transition: transform 200ms;
    line-height: 1;
  }

  .tip-toggle-chevron.flipped {
    transform: rotate(90deg);
  }

  .tip-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 14px;
  }

  .tip-note {
    font-size: 12px;
    color: var(--text-3);
    margin: 0;
    line-height: 1.5;
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    border-radius: 10px;
    padding: 10px 12px;
  }

  .tip-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .tip-tag {
    padding: 7px 13px;
    border-radius: 999px;
    border: 1px solid var(--border-2);
    background: var(--bg-2);
    color: var(--text-2);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
    transition: all 130ms;
  }

  .tip-tag:hover {
    border-color: #ec4899;
    color: #ec4899;
  }

  .tip-tag-selected {
    border-color: #ec4899;
    background: rgba(236, 72, 153, 0.1);
    color: #ec4899;
    font-weight: 600;
  }

  .tip-text-wrap {
    position: relative;
  }

  .tip-textarea {
    width: 100%;
    box-sizing: border-box;
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    border-radius: 12px;
    padding: 10px 12px 26px;
    font-size: 13px;
    color: var(--text-1);
    font-family: inherit;
    resize: none;
    line-height: 1.5;
    transition: border-color 150ms;
  }

  .tip-textarea:focus {
    outline: none;
    border-color: #ec4899;
  }

  .tip-char-count {
    position: absolute;
    bottom: 8px;
    right: 10px;
    font-size: 10px;
    color: var(--text-4);
  }

  .tip-error {
    font-size: 12px;
    color: #f87171;
    margin: 0;
  }

  .tip-submit {
    width: 100%;
    padding: 12px;
    border-radius: 12px;
    border: none;
    background: linear-gradient(135deg, #ec4899, #a855f7);
    color: #fff;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: opacity 150ms;
  }

  .tip-submit:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .tip-success {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px;
    background: rgba(255, 59, 107, 0.08);
    border: 1px solid rgba(255, 59, 107, 0.25);
    border-radius: 12px;
  }

  .tip-success-icon { font-size: 20px; flex-shrink: 0; }

  .tip-success p {
    font-size: 13px;
    color: var(--text-2);
    margin: 0;
    line-height: 1.5;
  }

  /* ── Mobile ── */
  @media (max-width: 767px) {
    .identity-block { padding: 14px 16px 6px; }
    .section { padding: 14px 16px; }
    .name { font-size: 22px; }
  }
</style>
