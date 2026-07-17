<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { ShieldCheck, MapPin } from 'lucide-svelte';
  import PublicProfileBody from '$lib/verified-vibe/components/PublicProfileBody.svelte';
  import { user } from '$lib/verified-vibe/stores';
  import { getSupabaseClient } from '$lib/client/supabase';

  const backToDiscover = $derived($page.url.searchParams.get('back') === 'discover');

  interface GarageCar {
    make: string;
    model: string;
    year?: string;
    color?: string;
    vehicleType?: string;
  }

  // Loose shape — rendering is delegated to PublicProfileBody; the hero reads the
  // top-level identity fields. Keep it permissive so the API payload flows through.
  type PublicProfile = Record<string, any> & {
    firstName: string;
    age: number;
    city: string;
    avatar: string | null;
    trustScore: number;
    archetypeName: string;
    archetypeEmoji: string;
    gender: string;
  };

  let profile = $state<PublicProfile | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let garageActiveIdx = $state(0);
  let carImages = $state<Record<string, string>>({});

  const profileId = $page.params.profileId ?? '';

  // ── Admin public-view preview ────────────────────────────────────────────
  // Opened from the admin Users table as /verified-vibe/profile/[id]?adminPreview=1&as=man|woman.
  // In this mode the viewer gender is driven by the `as` toggle (not the logged-in
  // user), and the Bestie flags are fetched from an admin-cookie-gated endpoint so
  // no member session is needed.
  const adminPreview = $derived($page.url.searchParams.get('adminPreview') === '1');
  let previewGender = $state<'man' | 'woman'>(
    $page.url.searchParams.get('as') === 'man' ? 'man' : 'woman'
  );
  const effectiveViewerGender = $derived(
    adminPreview ? previewGender : ($user?.gender ?? null)
  );

  function setPreviewGender(g: 'man' | 'woman') {
    if (previewGender === g) return;
    previewGender = g;
    bestieFlags = [];
    if (g === 'woman' && profile?.gender === 'man') fetchBestieFlags(profileId);
  }

  const intentTags = $derived(
    (() => {
      const raw = profile?.looking ?? '';
      if (!raw) return [];
      return raw.split(',').map((s: string) => s.trim()).filter(Boolean);
    })()
  );

  const BRAND_COLORS: Record<string, { accent: string; logo: string }> = {
    'bmw':            { accent: '#1C69D4', logo: '𝗕𝗠𝗪' },
    'mercedes':       { accent: '#00ADEF', logo: '𝗠𝗕' },
    'mercedes-benz':  { accent: '#00ADEF', logo: '𝗠𝗕' },
    'audi':           { accent: '#BB0A30', logo: '𝗔𝗨𝗗𝗜' },
    'porsche':        { accent: '#C9A84C', logo: '𝗣𝗢𝗥𝗦𝗖𝗛𝗘' },
    'ferrari':        { accent: '#DC143C', logo: '𝗙𝗘𝗥𝗥𝗔𝗥𝗜' },
    'lamborghini':    { accent: '#DAA520', logo: '𝗟𝗔𝗠𝗕𝗢' },
    'tesla':          { accent: '#E31937', logo: '𝗧𝗘𝗦𝗟𝗔' },
    'range rover':    { accent: '#006B3F', logo: '𝗥𝗥' },
    'land rover':     { accent: '#006B3F', logo: '𝗟𝗥' },
    'rolls-royce':    { accent: '#C0A882', logo: '𝗥𝗥' },
    'bentley':        { accent: '#254E52', logo: '𝗕' },
    'mclaren':        { accent: '#FF7900', logo: '𝗠𝗖' },
    'maserati':       { accent: '#1C3E6E', logo: '𝗠' },
    'jaguar':         { accent: '#1C3E6E', logo: '𝗝𝗔𝗚' },
    'toyota':         { accent: '#EB0A1E', logo: '𝗧𝗢𝗬𝗢𝗧𝗔' },
    'honda':          { accent: '#CC0000', logo: '𝗛𝗢𝗡𝗗𝗔' },
    'ford':           { accent: '#003476', logo: '𝗙𝗢𝗥𝗗' },
    'chevrolet':      { accent: '#D4A017', logo: '𝗖𝗛𝗘𝗩𝗬' },
    'lexus':          { accent: '#1A1A1A', logo: '𝗟𝗘𝗫𝗨𝗦' },
    'infiniti':       { accent: '#1A1A1A', logo: '𝗜𝗡𝗙' },
    'volvo':          { accent: '#003057', logo: '𝗩𝗢𝗟𝗩𝗢' },
    'mg':             { accent: '#C8102E', logo: '𝗠𝗚' },
    'hyundai':        { accent: '#002C5F', logo: '𝗛𝗬𝗨𝗡𝗗𝗔𝗜' },
    'kia':            { accent: '#05141F', logo: '𝗞𝗜𝗔' },
    'volkswagen':     { accent: '#001E6C', logo: '𝗩𝗪' },
    'vw':             { accent: '#001E6C', logo: '𝗩𝗪' },
    'skoda':          { accent: '#4BA82E', logo: '𝗦𝗞𝗢𝗗𝗔' },
    'tata':           { accent: '#00205B', logo: '𝗧𝗔𝗧𝗔' },
    'mahindra':       { accent: '#C8102E', logo: '𝗠&𝗠' },
    'maruti':         { accent: '#003087', logo: '𝗠𝗦' },
    'suzuki':         { accent: '#003087', logo: '𝗦𝗨𝗭𝗨𝗞𝗜' },
    'nissan':         { accent: '#C3002F', logo: '𝗡𝗜𝗦𝗦𝗔𝗡' },
    'jeep':           { accent: '#365B2F', logo: '𝗝𝗘𝗘𝗣' },
  };

  function getBrandStyle(make: string): { accent: string; logo: string } {
    const key = make.toLowerCase().trim();
    return BRAND_COLORS[key] ?? { accent: '#FF3B6B', logo: make.slice(0, 2).toUpperCase() };
  }

  function getCarSVG(car: GarageCar, accent: string): string {
    const vt = (car.vehicleType ?? '').toLowerCase();
    const m  = (car.model ?? '').toLowerCase();
    const c  = accent;
    const f  = c + '28';
    const s  = c;

    if (vt.includes('suv') || vt.includes('4x4') || vt.includes('crossover')) {
      return `<svg viewBox="0 0 300 120" xmlns="http://www.w3.org/2000/svg" class="car-svg-el">
        <path d="M22,98 L22,58 Q28,32 60,20 L150,14 Q200,11 228,26 L266,56 L278,98 Z" fill="${f}" stroke="${s}" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="M60,20 Q82,6 122,4 L175,3 Q208,3 228,26" fill="${f}" stroke="${s}" stroke-width="2" stroke-linejoin="round"/>
        <path d="M67,22 Q88,10 120,8 L155,8 L158,16 L74,18 Z" fill="${c}" opacity="0.18"/>
        <path d="M161,16 L196,14 Q216,13 228,26 L218,22 Q198,14 168,15 Z" fill="${c}" opacity="0.18"/>
        <circle cx="82" cy="98" r="23" fill="rgba(0,0,0,0.65)" stroke="${s}" stroke-width="2.5"/>
        <circle cx="82" cy="98" r="12" fill="${c}" opacity="0.22" stroke="${s}" stroke-width="1.5"/>
        <circle cx="220" cy="98" r="23" fill="rgba(0,0,0,0.65)" stroke="${s}" stroke-width="2.5"/>
        <circle cx="220" cy="98" r="12" fill="${c}" opacity="0.22" stroke="${s}" stroke-width="1.5"/>
        <ellipse cx="151" cy="117" rx="128" ry="5" fill="rgba(0,0,0,0.28)"/>
      </svg>`;
    }

    if (vt.includes('super') || vt.includes('sport') || vt.includes('coupe') ||
        m.includes('911') || m.includes('ferrari') || m.includes('lambo')) {
      return `<svg viewBox="0 0 340 105" xmlns="http://www.w3.org/2000/svg" class="car-svg-el">
        <path d="M18,88 L18,74 Q28,56 58,44 L98,34 Q135,22 178,20 L238,22 Q272,24 298,48 L318,70 L325,88 Z" fill="${f}" stroke="${s}" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="M98,34 Q125,16 168,13 L212,13 Q244,14 270,30 L238,22 Q200,18 165,20 L98,34" fill="${f}" stroke="${s}" stroke-width="2" stroke-linejoin="round"/>
        <path d="M103,34 Q128,18 165,15 L196,15 L198,22 L108,26 Z" fill="${c}" opacity="0.18"/>
        <path d="M201,22 L235,23 Q260,24 272,36 L252,28 Q230,22 206,22 Z" fill="${c}" opacity="0.18"/>
        <circle cx="88" cy="88" r="20" fill="rgba(0,0,0,0.65)" stroke="${s}" stroke-width="2.5"/>
        <circle cx="88" cy="88" r="10" fill="${c}" opacity="0.22" stroke="${s}" stroke-width="1.5"/>
        <circle cx="255" cy="88" r="20" fill="rgba(0,0,0,0.65)" stroke="${s}" stroke-width="2.5"/>
        <circle cx="255" cy="88" r="10" fill="${c}" opacity="0.22" stroke="${s}" stroke-width="1.5"/>
        <ellipse cx="172" cy="104" rx="145" ry="4" fill="rgba(0,0,0,0.28)"/>
      </svg>`;
    }

    // Default sedan
    return `<svg viewBox="0 0 320 110" xmlns="http://www.w3.org/2000/svg" class="car-svg-el">
      <path d="M20,90 L20,62 Q26,44 54,32 L105,20 Q148,12 185,12 L232,14 Q268,18 288,42 L302,68 L308,90 Z" fill="${f}" stroke="${s}" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M105,20 Q132,8 172,6 L210,6 Q244,7 268,26 L232,14 Q196,10 162,12 L105,20" fill="${f}" stroke="${s}" stroke-width="2" stroke-linejoin="round"/>
      <path d="M110,20 Q136,9 170,7 L200,7 L202,14 L116,16 Z" fill="${c}" opacity="0.18"/>
      <path d="M205,14 L232,15 Q255,16 268,28 L248,22 Q228,16 208,15 Z" fill="${c}" opacity="0.18"/>
      <circle cx="84" cy="90" r="21" fill="rgba(0,0,0,0.65)" stroke="${s}" stroke-width="2.5"/>
      <circle cx="84" cy="90" r="11" fill="${c}" opacity="0.22" stroke="${s}" stroke-width="1.5"/>
      <circle cx="240" cy="90" r="21" fill="rgba(0,0,0,0.65)" stroke="${s}" stroke-width="2.5"/>
      <circle cx="240" cy="90" r="11" fill="${c}" opacity="0.22" stroke="${s}" stroke-width="1.5"/>
      <ellipse cx="162" cy="108" rx="136" ry="4" fill="rgba(0,0,0,0.28)"/>
    </svg>`;
  }

  async function fetchCarImage(make: string, model: string) {
    const key = `${make}_${model}`.replace(/\s+/g, '_');
    if (key in carImages) return;
    carImages = { ...carImages, [key]: '' };
    try {
      const cacheKey = `vv_car_img_v3_${key}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) { carImages = { ...carImages, [key]: cached }; return; }
      const res = await fetch(`/api/verified-vibe/car-image?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`);
      if (res.ok) {
        const data = await res.json() as { imageUrl: string | null };
        if (data.imageUrl) {
          carImages = { ...carImages, [key]: data.imageUrl };
          localStorage.setItem(cacheKey, data.imageUrl);
        }
      }
    } catch { /* SVG fallback */ }
  }

  // ── AI Bestie flags (female viewers only) ────────────────────────────────
  interface BestieFlag { level: 'orange' | 'red'; title: string; detail: string; }
  let bestieFlags = $state<BestieFlag[]>([]);
  let bestieFlagsLoading = $state(false);

  async function fetchBestieFlags(pId: string) {
    if (effectiveViewerGender !== 'woman') return;
    bestieFlagsLoading = true;
    try {
      let res: Response;
      if (adminPreview) {
        // Admin cookie (path-scoped to /admin) rides along on this request.
        res = await fetch('/admin/analytics/public-view-flags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profileId: pId }),
        });
      } else {
        const sb = getSupabaseClient();
        const { data: { session } } = await sb.auth.getSession();
        if (!session?.access_token) return;
        res = await fetch('/api/verified-vibe/bestie-profile-flags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
          body: JSON.stringify({ profileId: pId }),
        });
      }
      if (res.ok) {
        const data = await res.json() as { flags: BestieFlag[] };
        bestieFlags = data.flags ?? [];
      }
    } catch { /* non-critical */ } finally {
      bestieFlagsLoading = false;
    }
  }

  onMount(async () => {
    try {
      const res = await fetch(`/api/verified-vibe/public-profile/${profileId}`);
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? 'Profile not found');
      profile = json.data;
      for (const car of (profile?.garageCars ?? [])) fetchCarImage(car.make, car.model);
      // Fetch bestie flags after profile loads (male profiles only)
      if (profile?.gender === 'man') fetchBestieFlags(profileId);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Something went wrong';
    } finally {
      loading = false;
    }
  });
</script>

<svelte:head>
  <title>{profile ? `${profile.firstName}'s Profile` : 'Profile'} · riteangle</title>
</svelte:head>

<div class="public-profile-page">
  {#if adminPreview}
    <div class="admin-preview-bar">
      <span class="apb-tag">ADMIN PREVIEW</span>
      <span class="apb-label">Viewing as</span>
      <div class="apb-toggle" role="group" aria-label="Viewer perspective">
        <button
          type="button"
          class="apb-btn"
          class:active={previewGender === 'woman'}
          onclick={() => setPreviewGender('woman')}
        >👩 Woman</button>
        <button
          type="button"
          class="apb-btn"
          class:active={previewGender === 'man'}
          onclick={() => setPreviewGender('man')}
        >👨 Man</button>
      </div>
      {#if profile}
        <span class="apb-note">
          {#if profile.gender === 'man'}
            {previewGender === 'woman'
              ? "Bestie's Take shows below (women-only panel)"
              : "Bestie's Take hidden (men don't see it)"}
          {:else}
            Perspective doesn't change this profile
          {/if}
        </span>
      {/if}
    </div>
  {/if}

  {#if backToDiscover}
    <button class="back-bar" onclick={() => goto('/verified-vibe/discover')}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
      Discover
    </button>
  {/if}

  {#if loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading profile…</p>
    </div>
  {:else if error}
    <div class="error-state">
      <p class="error-msg">{error}</p>
      <a href="/verified-vibe/auth?mode=signin" class="cta-btn">Join riteangle</a>
    </div>
  {:else if profile}
    <!-- Hero photo -->
    <div class="hero-wrap">
      {#if profile.avatar}
        <img class="hero-photo" src={profile.avatar} alt="{profile.firstName}'s photo" />
        {#if profile.heroIsAi}
          <span class="hero-ai-badge">✨ Generated from verified photos</span>
        {/if}
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
      <PublicProfileBody {profile} />

      <!-- AI Bestie flags — female viewer + male profile only -->
      {#if effectiveViewerGender === 'woman' && profile.gender === 'man'}
        <div class="bestie-section">
          <div class="bestie-header">
            <span class="bestie-avatar">💬</span>
            <div>
              <p class="bestie-title">Bestie's Take</p>
              <p class="bestie-sub">What to double-check before you match</p>
            </div>
          </div>

          {#if bestieFlagsLoading}
            <div class="bestie-loading">
              <div class="bestie-spinner"></div>
              <span>Bestie is reading his profile…</span>
            </div>
          {:else if bestieFlags.length === 0}
            <p class="bestie-clear">✓ Nothing suspicious — profile claims look consistent with what was verified.</p>
          {:else}
            <div class="bestie-flags">
              {#each bestieFlags as flag}
                <div class="bestie-flag bestie-flag--{flag.level}">
                  <span class="bestie-flag-icon">{flag.level === 'red' ? '🚨' : '⚠️'}</span>
                  <div>
                    <p class="bestie-flag-title">{flag.title}</p>
                    <p class="bestie-flag-detail">{flag.detail}</p>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}

      <!-- Privacy note -->
      <div class="privacy-note">
        <span class="lock-icon">🔒</span>
        Everything here stays private. We only verify that this profile reflects real life. This improves Trust Score and who they match with.
      </div>

      <!-- CTA -->
      <div class="cta-wrap">
        <a href="/verified-vibe/auth?mode=signin" class="cta-btn">
          Connect on riteangle
        </a>
        <p class="cta-sub">Join to see their full verified profile</p>
      </div>
    </div>
  {/if}
</div>

<style>
  .back-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 14px 16px;
    background: transparent;
    border: none;
    color: #FF3B6B;
    font-size: 14px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    position: sticky;
    top: 0;
    z-index: 10;
    backdrop-filter: blur(12px);
    background: rgba(255, 243, 240, 0.85);
    width: 100%;
    text-align: left;
  }

  .public-profile-page {
    min-height: 100vh;
    background: #FFF3F0;
    color: #1B1020;
    display: flex;
    flex-direction: column;
    max-width: 480px;
    margin: 0 auto;
  }

  .admin-preview-bar {
    position: sticky;
    top: 0;
    z-index: 30;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: #1B1020;
    color: #FFF3F0;
    font-size: 0.75rem;
  }
  .apb-tag {
    font-weight: 700;
    letter-spacing: 0.06em;
    font-size: 0.625rem;
    background: #FF3D7F;
    color: #fff;
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
  }
  .apb-label { opacity: 0.8; }
  .apb-toggle {
    display: inline-flex;
    border: 1px solid rgba(255, 255, 255, 0.25);
    border-radius: 999px;
    overflow: hidden;
  }
  .apb-btn {
    padding: 0.2rem 0.65rem;
    background: transparent;
    color: #FFF3F0;
    border: none;
    cursor: pointer;
    font-size: 0.75rem;
    line-height: 1.2;
  }
  .apb-btn.active {
    background: #FF3D7F;
    color: #fff;
    font-weight: 600;
  }
  .apb-note {
    opacity: 0.7;
    font-style: italic;
    flex-basis: 100%;
  }

  .loading-state, .error-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 40px 24px;
    color: #6E5F64;
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid rgba(27,16,32,0.1);
    border-top-color: #FF3B6B;
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
    background: #FBE9E6;
    flex-shrink: 0;
  }

  .hero-photo {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .hero-ai-badge {
    position: absolute;
    top: 14px;
    left: 14px;
    z-index: 2;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 5px 11px;
    border-radius: 999px;
    background: rgba(27,16,32,0.62);
    backdrop-filter: blur(4px);
    color: #fff;
    font-size: 11px;
    font-weight: 600;
    line-height: 1;
  }

  .hero-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #FBE9E6;
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
    background: rgba(255,59,107,0.18);
    color: #FF3B6B;
    border: 1px solid rgba(255,59,107,0.3);
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
  .section-label-row { display: flex; align-items: center; justify-content: space-between; }
  .section-meta { font-size: 10px; font-weight: 500; color: rgba(255,255,255,0.25); letter-spacing: 0.05em; }

  /* Vibe tags */
  .vibe-tag { padding: 6px 14px; border-radius: 999px; background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.12); font-size: 13px; font-weight: 500; color: #e8e8e8; }
  .vibe-tag--highlight { background: rgba(255,59,107,0.12); border-color: rgba(255,59,107,0.35); color: #FF3B6B; }

  /* Brings */
  .brings-list { list-style: none; padding: 0; margin: 8px 0 0; display: flex; flex-direction: column; gap: 0; }
  .brings-item { display: flex; align-items: center; gap: 12px; padding: 12px 14px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; margin-bottom: 6px; font-size: 14px; color: #e0e0e0; }
  .brings-check { color: #FF3B6B; font-weight: 700; flex-shrink: 0; font-size: 15px; }

  /* Verified signals */
  .signal-tabs { display: flex; gap: 6px; flex-wrap: wrap; margin: 10px 0; }
  .signal-tab { padding: 6px 14px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.5); font-size: 12px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.15s; }
  .signal-tab--active { background: rgba(255,59,107,0.12); border-color: rgba(255,59,107,0.4); color: #FF3B6B; }
  .signal-items { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
  .signal-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: rgba(255,255,255,0.04); border-radius: 10px; }
  .signal-emoji { font-size: 18px; }
  .signal-label { font-size: 13.5px; color: #d0d0d0; font-weight: 500; }
  .signal-verified { font-size: 11px; color: #FF3B6B; margin: 8px 0 0; }

  /* Archetype chips */
  .chip-group { margin-bottom: 14px; }
  .chip-group-label { font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.3); margin: 0 0 8px; }
  .chip-row { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip-pill { padding: 6px 12px; border-radius: 999px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); font-size: 12.5px; color: #c8c8c8; }

  /* Travel magnets */
  .travel-grid { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
  .travel-chip { display: flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); }
  .travel-globe { font-size: 16px; }
  .travel-name { font-size: 12px; font-weight: 600; color: #d0d0d0; text-transform: uppercase; letter-spacing: 0.05em; }

  /* Money matters */
  .money-card { background: rgba(255,200,80,0.05); border: 1px solid rgba(255,200,80,0.2); border-radius: 16px; padding: 14px; margin-top: 8px; }
  .money-role { display: flex; flex-direction: column; gap: 3px; margin-bottom: 12px; }
  .money-role-line { font-size: 13px; color: #d0d0d0; font-weight: 500; }
  .money-badges { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 12px; }
  .money-badge { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 10px 8px; display: flex; flex-direction: column; align-items: center; gap: 5px; text-align: center; }
  .money-badge-emoji { font-size: 22px; }
  .money-badge-label { font-size: 10.5px; color: #b0b0b0; font-weight: 500; line-height: 1.2; }
  .money-verified { font-size: 11px; color: #FF3B6B; margin: 0; }

  /* AI portraits */
  .portrait-sub { font-size: 11.5px; color: rgba(255,255,255,0.3); margin: 2px 0 10px; }
  .portrait-grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
  .portrait-img { width: 100%; aspect-ratio: 3/4; object-fit: cover; border-radius: 14px; }

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
    background: #FBE9E6;
    border: 1px solid #F1E0E3;
    border-radius: 12px;
    padding: 14px 16px;
    font-size: 12px;
    color: #6E5F64;
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
    background: linear-gradient(135deg, #FF3B6B, #E11D54);
    color: #fff;
    font-weight: 700;
    font-size: 15px;
    padding: 14px 24px;
    border-radius: 14px;
    text-decoration: none;
    box-shadow: 0 4px 20px rgba(255,59,107,0.25);
    transition: opacity 0.15s;
  }

  .cta-btn:hover { opacity: 0.9; }

  .cta-sub {
    font-size: 12px;
    color: #A08B91;
    margin: 0;
  }

  /* Garage */
  .garage-section { overflow: visible; }

  .garage-showroom {
    position: relative;
    width: 100%;
    border-radius: 16px;
    overflow: hidden;
    aspect-ratio: 4/3;
    max-height: 260px;
  }

  .garage-card {
    position: absolute;
    inset: 0;
    background: linear-gradient(160deg, #0d0d0d 0%, #1a1a2e 45%, #0d0d1a 100%);
    border-radius: 16px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    transition: opacity 0.4s ease, transform 0.4s ease;
  }

  .garage-card-active  { opacity: 1; transform: scale(1); pointer-events: auto; }
  .garage-card-hidden  { opacity: 0; transform: scale(0.97); pointer-events: none; }

  .garage-brand-bar { height: 4px; width: 100%; flex-shrink: 0; }

  .garage-grid-overlay {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
    background-size: 32px 32px;
    pointer-events: none;
  }

  .garage-hero {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
  }

  .garage-light-sweep {
    position: absolute;
    top: -40%;
    left: 50%;
    transform: translateX(-50%);
    width: 140%;
    height: 200%;
    background: radial-gradient(ellipse at 50% 30%, rgba(255,255,255,0.06) 0%, transparent 65%);
    pointer-events: none;
  }

  .garage-car-svg {
    position: relative;
    z-index: 1;
    width: 88%;
    max-width: 320px;
    filter: drop-shadow(0 10px 28px rgba(0,0,0,0.55));
    animation: garageFloat 4s ease-in-out infinite;
  }

  .garage-car-img {
    position: relative;
    z-index: 1;
    width: 88%;
    max-width: 320px;
    height: 200px;
    object-fit: cover;
    object-position: center;
    border-radius: 12px;
    filter: drop-shadow(0 10px 28px rgba(0,0,0,0.55));
  }

  :global(.car-svg-el) { width: 100%; height: auto; display: block; }

  @keyframes garageFloat {
    0%, 100% { transform: translateY(0px); }
    50%       { transform: translateY(-7px); }
  }

  .garage-info {
    padding: 10px 14px 12px;
    background: linear-gradient(0deg, rgba(0,0,0,0.85) 0%, transparent 100%);
    position: relative;
    z-index: 1;
  }

  .garage-make-row { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }

  .garage-brand-badge {
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.08em;
    padding: 2px 7px;
    border-radius: 4px;
    color: white;
    line-height: 1.4;
  }

  .garage-year { font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.5); letter-spacing: 0.04em; }

  .garage-model { font-size: 18px; font-weight: 700; color: white; letter-spacing: 0.01em; line-height: 1.2; }

  .garage-color-row { display: flex; align-items: center; gap: 5px; margin-top: 3px; }

  .garage-color-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    border: 1px solid rgba(255,255,255,0.3);
    flex-shrink: 0;
  }

  .garage-color-label { font-size: 11px; color: rgba(255,255,255,0.55); text-transform: capitalize; }

  .garage-verified-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-top: 6px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: #FF3B6B;
    text-transform: uppercase;
  }

  .garage-nav { display: flex; align-items: center; justify-content: center; gap: 12px; margin-top: 10px; }

  .garage-arrow {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: rgba(255,255,255,0.07);
    border: 1px solid rgba(255,255,255,0.12);
    color: rgba(255,255,255,0.7);
    font-size: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    line-height: 1;
    padding: 0 0 1px;
    transition: background 0.15s;
  }
  .garage-arrow:hover { background: rgba(255,255,255,0.12); }

  .garage-dots { display: flex; gap: 6px; align-items: center; }

  .garage-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: rgba(255,255,255,0.2);
    border: none;
    cursor: pointer;
    padding: 0;
    transition: background 0.2s, transform 0.2s;
  }

  .garage-dot-active { background: #FF3B6B; transform: scale(1.4); }

  .garage-counter { text-align: center; font-size: 11px; color: rgba(255,255,255,0.35); margin: 4px 0 0; }

  /* AI Bestie flags */
  .bestie-section {
    background: rgba(255, 180, 60, 0.05);
    border: 1px solid rgba(255, 180, 60, 0.2);
    border-radius: 16px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .bestie-header {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .bestie-avatar {
    font-size: 24px;
    flex-shrink: 0;
  }

  .bestie-title {
    margin: 0;
    font-size: 13px;
    font-weight: 700;
    color: #fbbf24;
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }

  .bestie-sub {
    margin: 2px 0 0;
    font-size: 11.5px;
    color: #6E5F64;
  }

  .bestie-loading {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12.5px;
    color: #6E5F64;
    padding: 4px 0;
  }

  .bestie-spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(251,191,36,0.2);
    border-top-color: #fbbf24;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    flex-shrink: 0;
  }

  .bestie-clear {
    margin: 0;
    font-size: 13px;
    color: #FF3B6B;
  }

  .bestie-flags {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .bestie-flag {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 10px;
  }

  .bestie-flag--orange {
    background: rgba(251, 146, 60, 0.1);
    border: 1px solid rgba(251, 146, 60, 0.25);
  }

  .bestie-flag--red {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  .bestie-flag-icon {
    font-size: 16px;
    flex-shrink: 0;
    margin-top: 1px;
  }

  .bestie-flag-title {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    color: #1B1020;
    line-height: 1.3;
  }

  .bestie-flag-detail {
    margin: 3px 0 0;
    font-size: 12px;
    color: #6E5F64;
    line-height: 1.5;
  }
</style>
