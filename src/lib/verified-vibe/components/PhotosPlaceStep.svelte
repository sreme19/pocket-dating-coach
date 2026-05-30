<script lang="ts">
  interface PhotoEntry {
    file: File;
    dataUrl: string;
  }

  interface Props {
    gender?: 'man' | 'woman' | null;
    onSubmit: (data: { photos: File[]; city: string; openToTravel: boolean }) => void;
    onCancel?: () => void;
    onSkip?: () => void;
  }

  let { gender = null, onSubmit, onCancel, onSkip }: Props = $props();

  const showAiStrip = $derived(gender !== 'woman');

  const MAX_PHOTOS = 3;
  const MIN_PHOTOS = 1;

  let photos = $state<PhotoEntry[]>([]);
  let city = $state('');
  let openToTravel = $state(false);
  let fileInputEl = $state<HTMLInputElement | null>(null);
  let detecting = $state(false);
  let detectError = $state('');

  const ready = $derived(photos.length >= MIN_PHOTOS && city.trim().length > 0);
  const photosFilled = $derived(photos.length >= MIN_PHOTOS);

  function readFileAsDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleFileChange(e: Event & { currentTarget: HTMLInputElement }) {
    const files = e.currentTarget.files;
    if (!files?.length) return;
    const remaining = MAX_PHOTOS - photos.length;
    const toAdd = Array.from(files).slice(0, remaining);
    for (const file of toAdd) {
      const dataUrl = await readFileAsDataURL(file);
      photos = [...photos, { file, dataUrl }];
    }
    e.currentTarget.value = '';
  }

  function removePhoto(index: number) {
    photos = photos.filter((_, i) => i !== index);
  }

  function triggerFileInput() {
    fileInputEl?.click();
  }
</script>

<!-- Hidden file input -->
<input
  bind:this={fileInputEl}
  type="file"
  accept="image/*"
  multiple
  style="display: none;"
  onchange={handleFileChange}
/>

<div class="wrap">
  <!-- Hero -->
  <div class="hero">
    <h1 class="hero-title">Almost there.</h1>
    <div class="hero-meta">
      <span>⏱</span> 60 seconds to go live
    </div>
  </div>

  <!-- Photos section -->
  <div class="section">
    <div class="section-header">
      <div class="section-left">
        <div class="section-title" class:section-title--filled={photosFilled}>
          <span class="section-icon">📸</span>
          Add a few photos
        </div>
        <div class="section-sub">Min 1. First photo becomes your hero.</div>
      </div>
      <div class="count-pip" class:count-pip--filled={photosFilled}>
        {photos.length}<span class="count-denom">/{MAX_PHOTOS}</span>
      </div>
    </div>

    <!-- 3-slot photo grid -->
    <div class="photo-grid">
      {#each Array(MAX_PHOTOS) as _, i (i)}
        {#if photos[i]}
          <!-- Filled slot -->
          <div class="slot slot--filled" style="background-image: url({photos[i].dataUrl})">
            {#if i === 0}
              <div class="main-badge">MAIN</div>
            {/if}
            <button class="remove-btn" onclick={() => removePhoto(i)} aria-label="Remove photo">
              ✕
            </button>
            <div class="slot-gradient"></div>
          </div>
        {:else}
          <!-- Empty slot -->
          <button
            class="slot slot--empty"
            class:slot--empty-next={i === photos.length}
            onclick={triggerFileInput}
          >
            <div class="slot-plus-icon" class:slot-plus-icon--next={i === photos.length}>
              <span class="plus-symbol">+</span>
            </div>
            <span class="slot-label">
              {i === 0 && photos.length === 0 ? 'Add main' : 'Add'}
            </span>
          </button>
        {/if}
      {/each}
    </div>

    <!-- AI portrait strip — men only -->
    {#if showAiStrip}
      <div class="ai-strip">
        <div class="ai-strip-icon">✨</div>
        <p class="ai-strip-text">
          <em class="ai-strip-em">AI will render</em> two portraits from your verified face — added to your profile.
        </p>
      </div>
    {/if}
  </div>

  <!-- Location section -->
  <div class="section">
    <div class="section-title" class:section-title--filled={!!city.trim()}>
      <span class="section-icon">📍</span>
      Where you are
    </div>
    <div class="section-sub" style="margin-bottom: 12px;">Used to find matches near you. Never shown publicly.</div>

    <!-- City input -->
    <div class="city-row">
      <div class="city-pin-icon">📍</div>
      <input
        class="city-input"
        type="text"
        placeholder="Your city"
        bind:value={city}
      />
      <button
        class="detect-btn"
        class:detect-btn--loading={detecting}
        disabled={detecting}
        onclick={async () => {
          if (typeof navigator === 'undefined' || !navigator.geolocation) {
            detectError = 'Geolocation not supported on this device.';
            return;
          }
          detecting = true;
          detectError = '';
          navigator.geolocation.getCurrentPosition(
            async (pos) => {
              try {
                const res = await fetch(
                  `https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`
                );
                const data = await res.json();
                city = data.address?.city || data.address?.town || data.address?.state_district || data.address?.suburb || data.address?.village || data.address?.county || '';
                if (!city) detectError = 'Could not determine your city. Please type it manually.';
              } catch {
                detectError = 'Failed to fetch location. Please type your city.';
              } finally {
                detecting = false;
              }
            },
            () => {
              detectError = 'Location access denied. Please type your city manually.';
              detecting = false;
            },
            { timeout: 10000 }
          );
        }}
      >
        {#if detecting}
          ◌ Detecting…
        {:else}
          ◎ Detect
        {/if}
      </button>
    </div>

    {#if detectError}
      <p class="detect-error">{detectError}</p>
    {/if}

    <!-- Open to travel toggle -->
    <button
      class="travel-toggle"
      class:travel-toggle--on={openToTravel}
      onclick={() => { openToTravel = !openToTravel; }}
    >
      <div class="travel-icon" class:travel-icon--on={openToTravel}>✈️</div>
      <div class="travel-text">
        <div class="travel-label" class:travel-label--on={openToTravel}>Open to travel matches</div>
        <div class="travel-sub">Show people in cities you've visited</div>
      </div>
      <div class="toggle-track" class:toggle-track--on={openToTravel}>
        <div class="toggle-thumb" class:toggle-thumb--on={openToTravel}></div>
      </div>
    </button>
  </div>

  <div class="spacer"></div>

  <!-- CTA -->
  <div class="cta-wrap">
    <button
      class="cta-btn"
      class:cta-btn--ready={ready}
      disabled={!ready}
      onclick={() => ready && onSubmit({ photos: photos.map(p => p.file), city: city.trim(), openToTravel })}
    >
      {#if ready}
        Create profile &amp; find matches →
      {:else}
        Add a photo &amp; your city to continue
      {/if}
    </button>
    <p class="cta-hint">🔒 Photos are blurred for un-verified viewers.</p>
    {#if onSkip}
      <button class="skip-btn" onclick={onSkip}>Skip this step</button>
    {/if}
  </div>
</div>

<style>
  .wrap {
    display: flex;
    flex-direction: column;
    padding-bottom: 8px;
  }

  /* Hero */
  .hero {
    text-align: center;
    padding: 20px 18px 8px;
  }
  .hero-title {
    font-size: 36px;
    font-style: italic;
    font-weight: 400;
    font-family: 'Instrument Serif', 'Cormorant Garamond', Georgia, serif;
    color: var(--accent-bright);
    margin: 0 0 8px;
    letter-spacing: -0.01em;
    line-height: 1.05;
  }
  .hero-meta {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 12.5px;
    font-weight: 500;
    color: var(--text-3);
  }

  /* Section */
  .section {
    padding: 20px 0 4px;
    border-top: 1px solid var(--border-1);
  }
  .section:first-of-type {
    border-top: none;
  }
  .section-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
  }
  .section-left {
    flex: 1;
    min-width: 0;
  }
  .section-title {
    font-size: 22px;
    font-style: italic;
    font-weight: 400;
    font-family: 'Instrument Serif', 'Cormorant Garamond', Georgia, serif;
    color: var(--text-1);
    display: flex;
    align-items: baseline;
    gap: 7px;
    line-height: 1.2;
    letter-spacing: -0.005em;
    transition: color 0.25s ease;
    margin-bottom: 4px;
  }
  .section-title--filled {
    color: var(--accent-bright);
  }
  .section-icon {
    font-style: normal;
    font-size: 20px;
  }
  .section-sub {
    font-size: 11.5px;
    font-weight: 500;
    color: var(--text-3);
    letter-spacing: 0.02em;
  }

  /* Count pip */
  .count-pip {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 5px 9px;
    border-radius: 999px;
    flex-shrink: 0;
    background: rgba(255,255,255,0.04);
    border: 1px solid var(--border-1);
    color: var(--text-3);
    font-size: 10.5px;
    font-weight: 700;
    transition: all 0.2s ease;
  }
  .count-pip--filled {
    background: rgba(52, 211, 153, 0.1);
    border-color: rgba(52, 211, 153, 0.3);
    color: var(--accent-bright);
  }
  .count-denom { opacity: 0.55; }

  /* Photo grid — 3 slots */
  .photo-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin-bottom: 12px;
  }
  .slot {
    aspect-ratio: 3 / 4;
    border-radius: 14px;
    position: relative;
    overflow: hidden;
  }
  .slot--filled {
    background-size: cover;
    background-position: center;
    border: 1px solid rgba(255,255,255,0.12);
  }
  .slot--empty {
    border: 1.5px dashed rgba(255,255,255,0.16);
    background: transparent;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 6px;
    cursor: pointer;
    color: var(--text-3);
    transition: all 0.15s ease;
    font-family: inherit;
  }
  .slot--empty-next {
    border-color: rgba(52, 211, 153, 0.4);
    background: rgba(52, 211, 153, 0.04);
    color: var(--accent-bright);
  }
  .slot--empty:active {
    transform: scale(0.97);
  }
  .slot-plus-icon {
    width: 32px;
    height: 32px;
    border-radius: 10px;
    background: rgba(255,255,255,0.04);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .slot-plus-icon--next {
    background: rgba(52, 211, 153, 0.12);
  }
  .plus-symbol {
    font-size: 18px;
    line-height: 1;
    font-weight: 300;
  }
  .slot-label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    text-align: center;
    line-height: 1.2;
  }
  .main-badge {
    position: absolute;
    top: 6px;
    left: 6px;
    padding: 3px 8px;
    border-radius: 999px;
    background: var(--accent-bright);
    color: #052819;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.08em;
  }
  .remove-btn {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: rgba(0,0,0,0.6);
    border: 1px solid rgba(255,255,255,0.18);
    color: #fff;
    font-size: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-family: inherit;
    line-height: 1;
  }
  .slot-gradient {
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, transparent 60%, rgba(0,0,0,0.4) 100%);
    pointer-events: none;
  }

  /* AI strip */
  .ai-strip {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    background: rgba(52, 211, 153, 0.04);
    border: 1px solid rgba(52, 211, 153, 0.18);
    border-radius: 12px;
  }
  .ai-strip-icon {
    width: 32px;
    height: 32px;
    border-radius: 10px;
    background: rgba(52, 211, 153, 0.10);
    color: var(--accent-bright);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-size: 16px;
  }
  .ai-strip-text {
    flex: 1;
    font-size: 11.5px;
    line-height: 1.35;
    color: var(--text-3);
    margin: 0;
  }
  .ai-strip-em {
    color: var(--accent-bright);
    font-style: italic;
  }

  /* City input */
  .city-row {
    display: flex;
    align-items: center;
    gap: 10px;
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    border-radius: 14px;
    padding: 12px 14px;
    margin-bottom: 12px;
  }
  .city-pin-icon {
    font-size: 18px;
    flex-shrink: 0;
  }
  .city-input {
    flex: 1;
    min-width: 0;
    background: transparent;
    border: none;
    outline: none;
    color: var(--text-1);
    font-size: 14.5px;
    font-weight: 500;
    font-family: inherit;
  }
  .city-input::placeholder {
    color: var(--text-3);
  }
  .detect-btn {
    padding: 6px 10px;
    border-radius: 999px;
    background: rgba(52, 211, 153, 0.08);
    border: 1px solid rgba(52, 211, 153, 0.3);
    color: var(--accent-bright);
    font-size: 10.5px;
    font-weight: 600;
    font-family: inherit;
    letter-spacing: 0.06em;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s ease;
  }
  .detect-btn:active {
    opacity: 0.75;
  }
  .detect-btn--loading {
    opacity: 0.6;
    cursor: default;
  }
  .detect-error {
    font-size: 11.5px;
    color: #f87171;
    margin: -6px 0 10px;
    padding: 0 2px;
  }

  /* Travel toggle */
  .travel-toggle {
    width: 100%;
    padding: 12px 14px;
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    border-radius: 14px;
    display: flex;
    align-items: center;
    gap: 12px;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.2s ease;
    text-align: left;
  }
  .travel-toggle--on {
    background: rgba(52, 211, 153, 0.06);
    border-color: rgba(52, 211, 153, 0.3);
  }
  .travel-icon {
    width: 32px;
    height: 32px;
    border-radius: 10px;
    background: rgba(255,255,255,0.04);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-size: 16px;
    transition: background 0.2s ease;
  }
  .travel-icon--on {
    background: rgba(52, 211, 153, 0.12);
  }
  .travel-text {
    flex: 1;
  }
  .travel-label {
    font-size: 13.5px;
    font-weight: 600;
    color: var(--text-1);
    transition: color 0.2s ease;
  }
  .travel-label--on {
    color: var(--accent-bright);
  }
  .travel-sub {
    font-size: 11.5px;
    color: var(--text-3);
    margin-top: 1px;
    font-weight: 400;
  }
  .toggle-track {
    width: 36px;
    height: 22px;
    border-radius: 12px;
    background: rgba(255,255,255,0.08);
    position: relative;
    flex-shrink: 0;
    transition: background 0.2s ease;
  }
  .toggle-track--on {
    background: var(--accent-bright);
  }
  .toggle-thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 18px;
    height: 18px;
    border-radius: 10px;
    background: #fff;
    transition: left 0.2s ease;
  }
  .toggle-thumb--on {
    left: 16px;
  }

  /* CTA */
  .spacer { height: 16px; }
  .cta-wrap { padding: 0 0 4px; }
  .cta-btn {
    width: 100%;
    padding: 17px 16px;
    background: rgba(52, 211, 153, 0.10);
    border: 1px solid rgba(52, 211, 153, 0.16);
    border-radius: 16px;
    color: var(--text-3);
    font-size: 15px;
    font-weight: 700;
    font-family: inherit;
    letter-spacing: -0.005em;
    cursor: not-allowed;
    transition: all 0.25s ease;
  }
  .cta-btn--ready {
    background: var(--accent-bright);
    border-color: var(--accent-bright);
    color: #052819;
    cursor: pointer;
    box-shadow: 0 12px 32px rgba(52, 211, 153, 0.32);
  }
  .cta-btn--ready:active {
    opacity: 0.88;
    transform: scale(0.98);
  }
  .cta-hint {
    margin: 10px 0 0;
    text-align: center;
    font-size: 11.5px;
    font-weight: 500;
    color: var(--text-3);
  }
  .skip-btn {
    display: block;
    width: 100%;
    margin-top: 10px;
    padding: 10px;
    background: transparent;
    border: none;
    color: var(--text-3);
    font-size: 13px;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    text-align: center;
    opacity: 0.7;
    transition: opacity 0.15s ease;
  }
  .skip-btn:active { opacity: 0.5; }
</style>
