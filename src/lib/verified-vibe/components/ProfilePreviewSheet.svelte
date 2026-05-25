<script lang="ts">
  import { goto } from '$app/navigation';
  import { fade, fly } from 'svelte/transition';
  import { X, Lock } from 'lucide-svelte';
  import { ARCHETYPES } from '$lib/verified-vibe/constants';
  import type { SeedCarouselProfile } from './LiveWomenCarousel.svelte';

  interface Props {
    profile: SeedCarouselProfile | null;
    onClose: () => void;
    redirectTo?: string; // override destination for the CTA
  }

  let { profile, onClose, redirectTo }: Props = $props();

  const archetypeData = $derived(
    profile ? ARCHETYPES[profile.archetypeId] ?? null : null
  );

  // Lock scroll when open
  $effect(() => {
    if (profile) {
      const scroller = document.querySelector('.verified-vibe-content') as HTMLElement | null;
      if (scroller) scroller.style.overflow = 'hidden';
      return () => { if (scroller) scroller.style.overflow = ''; };
    }
  });

  function handleCTA() {
    onClose();
    if (redirectTo) {
      goto(redirectTo);
      return;
    }
    const gender = typeof window !== 'undefined'
      ? localStorage.getItem('verified_vibe_gender')
      : null;
    goto(gender ? '/verified-vibe/home' : '/verified-vibe/gate');
  }
</script>

{#if profile}
  <div
    class="backdrop"
    onclick={onClose}
    aria-hidden="true"
    transition:fade={{ duration: 180 }}
  ></div>

  <div
    class="sheet-positioner"
    role="dialog"
    aria-modal="true"
    aria-label="{profile.name}'s profile preview"
    transition:fly={{ y: 500, duration: 340, easing: (t) => 1 - Math.pow(1 - t, 3) }}
  >
    <div class="sheet" onclick={(e) => e.stopPropagation()}>
      <div class="handle"></div>

      <!-- Photo -->
      <div class="photo-wrap">
        <img
          src={profile.photoUrl}
          alt="{profile.name}, {profile.age}"
          class="photo"
          loading="lazy"
        />
        <button class="close-btn" onclick={onClose} aria-label="Close">
          <X size={18} />
        </button>
        <div class="photo-gradient"></div>
        <div class="photo-identity">
          <span class="photo-name">{profile.name}, {profile.age}</span>
          {#if profile.lastActive === 'online'}
            <span class="online-badge">● Online now</span>
          {:else}
            <span class="offline-badge">● {profile.lastActive}</span>
          {/if}
        </div>
      </div>

      <!-- Profile info -->
      <div class="info">
        {#if archetypeData}
          <div class="archetype-row">
            <span class="archetype-emoji">{archetypeData.emoji}</span>
            <span class="archetype-name">{archetypeData.name}</span>
            <span class="verified-badge">✓ Verified</span>
          </div>
        {/if}

        {#if profile.bio}
          <p class="bio">{profile.bio}</p>
        {/if}

        <!-- Locked CTA for unregistered users -->
        <div class="cta-block">
          <div class="locked-hint">
            <Lock size={14} />
            <span>Verify your profile to connect</span>
          </div>
          <button class="cta-btn" onclick={handleCTA}>
            Get verified &amp; message {profile.name}
          </button>
          <p class="cta-sub">Free to join · Takes ~10 minutes</p>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    z-index: 100;
  }

  .sheet-positioner {
    position: fixed;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: min(430px, 100vw);
    z-index: 101;
    pointer-events: none;
  }

  .sheet {
    background: var(--bg-1);
    border-radius: 24px 24px 0 0;
    overflow: hidden;
    pointer-events: all;
    max-height: 90dvh;
    display: flex;
    flex-direction: column;
  }

  .handle {
    width: 36px;
    height: 4px;
    border-radius: 2px;
    background: var(--border-2);
    margin: 12px auto 0;
    flex-shrink: 0;
  }

  /* ── Photo ─────────────────────────────────────────────────────────────── */

  .photo-wrap {
    position: relative;
    width: 100%;
    aspect-ratio: 4 / 3;
    flex-shrink: 0;
    overflow: hidden;
    margin-top: 10px;
  }

  .photo {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: top center;
    display: block;
  }

  .close-btn {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.45);
    border: none;
    cursor: pointer;
    display: grid;
    place-items: center;
    color: #fff;
    backdrop-filter: blur(4px);
    z-index: 2;
  }

  .photo-gradient {
    position: absolute;
    inset: 0;
    background: linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 50%);
  }

  .photo-identity {
    position: absolute;
    bottom: 14px;
    left: 16px;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .photo-name {
    font-size: 22px;
    font-weight: 700;
    color: #fff;
    line-height: 1.1;
    text-shadow: 0 1px 4px rgba(0,0,0,0.4);
  }

  .online-badge {
    font-size: 12px;
    font-weight: 600;
    color: var(--accent-bright);
  }

  .offline-badge {
    font-size: 12px;
    color: rgba(255,255,255,0.6);
  }

  /* ── Info ──────────────────────────────────────────────────────────────── */

  .info {
    padding: 16px 20px 24px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    overflow-y: auto;
  }

  .archetype-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .archetype-emoji {
    font-size: 20px;
  }

  .archetype-name {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-1);
  }

  .verified-badge {
    margin-left: auto;
    font-size: 11px;
    font-weight: 700;
    color: var(--accent-bright);
    background: color-mix(in srgb, var(--accent-bright) 12%, transparent);
    padding: 3px 9px;
    border-radius: 100px;
  }

  .bio {
    font-size: 14px;
    color: var(--text-2);
    line-height: 1.55;
    margin: 0;
  }

  /* ── CTA ───────────────────────────────────────────────────────────────── */

  .cta-block {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-top: 4px;
  }

  .locked-hint {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--text-3);
  }

  .cta-btn {
    width: 100%;
    padding: 15px;
    background: var(--accent-bright);
    color: #000;
    font-size: 15px;
    font-weight: 700;
    border: none;
    border-radius: 14px;
    cursor: pointer;
    font-family: inherit;
    transition: opacity 150ms;
  }

  .cta-btn:active {
    opacity: 0.85;
  }

  .cta-sub {
    font-size: 11px;
    color: var(--text-4);
    text-align: center;
    margin: 0;
  }
</style>
