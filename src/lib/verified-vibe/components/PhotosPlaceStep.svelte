<script lang="ts">
  interface PhotoEntry {
    file: File;
    dataUrl: string;
  }

  interface Props {
    gender?: 'man' | 'woman' | null;
    initialFirstName?: string;
    initialAge?: number | null;
    onSubmit: (data: { photos: File[]; firstName: string; age: number; city: string; openToTravel: boolean }) => void;
    onCancel?: () => void;
    onSkip?: () => void;
  }

  let { gender = null, initialFirstName = '', initialAge = null, onSubmit, onCancel, onSkip }: Props = $props();

  const showAiStrip = $derived(gender !== 'woman');

  const MAX_PHOTOS = 6;
  let MIN_PHOTOS = $derived(gender === 'woman' ? 1 : 3);
  const MIN_AGE = 18;
  const MAX_AGE = 120;

  let firstName = $state(initialFirstName);
  let age = $state<number | null>(initialAge);
  let photos = $state<PhotoEntry[]>([]);
  let city = $state('');
  let openToTravel = $state(false);
  let fileInputEl = $state<HTMLInputElement | null>(null);
  let detecting = $state(false);
  let detectError = $state('');
  let photoError = $state('');
  let checking = $state(false);

  const nameOk = $derived(firstName.trim().length > 0);
  const ageOk = $derived(age != null && age >= MIN_AGE && age <= MAX_AGE);
  const aboutFilled = $derived(nameOk && ageOk);
  const ready = $derived(aboutFilled && photos.length >= MIN_PHOTOS && city.trim().length > 0);
  const photosFilled = $derived(photos.length >= MIN_PHOTOS);
  const showOptionalSlots = $derived(showAiStrip && photos.length >= 3);

  function readFileAsDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function checkPhotoQuality(dataUrl: string): Promise<{ ok: boolean; error: string }> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = async () => {
        const scale = Math.min(1, 320 / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve({ ok: true, error: '' }); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // Blur check: low pixel variance → blurry image
        let sum = 0, sumSq = 0, n = 0;
        for (let i = 0; i < data.length; i += 4) {
          const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          sum += gray; sumSq += gray * gray; n++;
        }
        const mean = sum / n;
        const variance = sumSq / n - mean * mean;
        if (variance < 80) {
          resolve({ ok: false, error: 'This photo looks blurry. Try a clearer one.' });
          return;
        }

        // Face detection — Chrome/Android WebView only; skip gracefully elsewhere
        if ('FaceDetector' in window) {
          try {
            // @ts-ignore
            const detector = new window.FaceDetector({ fastMode: true });
            const faces = await detector.detect(img);
            if (faces.length === 0) {
              resolve({ ok: false, error: "We couldn't detect a clear face. Try a different photo." });
              return;
            }
          } catch { /* unsupported or permission denied — skip */ }
        }

        resolve({ ok: true, error: '' });
      };
      img.onerror = () => resolve({ ok: true, error: '' });
      img.src = dataUrl;
    });
  }

  async function handleFileChange(e: Event & { currentTarget: HTMLInputElement }) {
    const files = e.currentTarget.files;
    if (!files?.length) return;
    const remaining = MAX_PHOTOS - photos.length;
    const toAdd = Array.from(files).slice(0, remaining);
    checking = true;
    photoError = '';
    for (const file of toAdd) {
      const dataUrl = await readFileAsDataURL(file);
      const check = await checkPhotoQuality(dataUrl);
      if (!check.ok) {
        photoError = check.error;
        continue;
      }
      photos = [...photos, { file, dataUrl }];
    }
    checking = false;
    e.currentTarget.value = '';
  }

  function removePhoto(index: number) {
    photos = photos.filter((_, i) => i !== index);
    photoError = '';
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

  <!-- About you (name + age) -->
  <div class="section">
    <div class="section-title" class:section-title--filled={aboutFilled}>
      <span class="section-icon">🪪</span>
      About you
    </div>
    <div class="section-sub" style="margin-bottom: 12px;">Your first name and age — shown on your profile.</div>

    <div class="about-row">
      <input
        class="about-input about-input--name"
        type="text"
        autocomplete="given-name"
        autocapitalize="words"
        placeholder="First name"
        bind:value={firstName}
      />
      <input
        class="about-input about-input--age"
        type="number"
        inputmode="numeric"
        min={MIN_AGE}
        max={MAX_AGE}
        placeholder="Age"
        bind:value={age}
      />
    </div>
    {#if age != null && !ageOk}
      <p class="detect-error">Enter an age between {MIN_AGE} and {MAX_AGE}.</p>
    {/if}
  </div>

  <!-- Photos section -->
  <div class="section">
    <div class="section-header">
      <div class="section-left">
        <div class="section-title" class:section-title--filled={photosFilled}>
          <span class="section-icon">📸</span>
          Add a few photos
        </div>
        <div class="section-sub">
          {#if showAiStrip}
            Min 3. More photos = better AI results.
          {:else}
            Min 1. First photo becomes your hero.
          {/if}
        </div>
      </div>
      <div class="count-pip" class:count-pip--filled={photosFilled}>
        {photos.length}<span class="count-denom">/{MAX_PHOTOS}</span>
      </div>
    </div>

    <!-- Consent notice — men only -->
    {#if showAiStrip}
      <p class="consent-notice">
        🔒 Your photos are used only to create your AI profile pictures. They will never be shown to anyone.
      </p>
    {/if}

    <!-- Required slots (0–2) -->
    <div class="photo-grid">
      {#each [0, 1, 2] as i (i)}
        {#if photos[i]}
          <div class="slot slot--filled" style="background-image: url({photos[i].dataUrl})">
            {#if i === 0}<div class="main-badge">MAIN</div>{/if}
            <button class="remove-btn" onclick={() => removePhoto(i)} aria-label="Remove photo">✕</button>
            <div class="slot-gradient"></div>
          </div>
        {:else}
          <button
            class="slot slot--empty"
            class:slot--empty-next={i === photos.length}
            onclick={triggerFileInput}
            disabled={checking}
          >
            <div class="slot-plus-icon" class:slot-plus-icon--next={i === photos.length}>
              <span class="plus-symbol">{checking && i === photos.length ? '…' : '+'}</span>
            </div>
            <span class="slot-label">{i === 0 && photos.length === 0 ? 'Add main' : 'Add'}</span>
          </button>
        {/if}
      {/each}
    </div>

    <!-- Optional slots (3–5) — men only, revealed after 3 required are filled -->
    {#if showOptionalSlots}
      <div class="optional-row-label">✨ Add more for better AI results <span class="optional-tag">optional</span></div>
      <div class="photo-grid">
        {#each [3, 4, 5] as i (i)}
          {#if photos[i]}
            <div class="slot slot--filled" style="background-image: url({photos[i].dataUrl})">
              <button class="remove-btn" onclick={() => removePhoto(i)} aria-label="Remove photo">✕</button>
              <div class="slot-gradient"></div>
            </div>
          {:else}
            <button
              class="slot slot--empty"
              class:slot--empty-next={i === photos.length}
              onclick={triggerFileInput}
              disabled={checking}
            >
              <div class="slot-plus-icon" class:slot-plus-icon--next={i === photos.length}>
                <span class="plus-symbol">{checking && i === photos.length ? '…' : '+'}</span>
              </div>
              <span class="slot-label">Add</span>
            </button>
          {/if}
        {/each}
      </div>
    {/if}

    {#if photoError}
      <p class="photo-error">{photoError}</p>
    {/if}

    <!-- AI portrait strip — men only -->
    {#if showAiStrip}
      <div class="ai-strip">
        <div class="ai-strip-icon">✨</div>
        <p class="ai-strip-text">
          <em class="ai-strip-em">AI will render</em> your profile portraits from these photos — your real photos stay private.
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
      onclick={() => ready && onSubmit({ photos: photos.map(p => p.file), firstName: firstName.trim(), age: age ?? 0, city: city.trim(), openToTravel })}
    >
      {#if ready}
        Create profile &amp; find matches →
      {:else}
        Add your name, age, {showAiStrip ? '3 photos' : 'a photo'} &amp; city to continue
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
    background: rgba(255, 122, 77, 0.1);
    border-color: rgba(255, 122, 77, 0.3);
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
    border-color: rgba(255, 122, 77, 0.4);
    background: rgba(255, 122, 77, 0.04);
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
    background: rgba(255, 122, 77, 0.12);
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

  /* Consent notice */
  .consent-notice {
    font-size: 11px;
    color: var(--text-3);
    margin: 0 0 10px;
    padding: 8px 12px;
    background: rgba(255,255,255,0.03);
    border: 1px solid var(--border-1);
    border-radius: 10px;
    line-height: 1.4;
  }

  /* Optional row label */
  .optional-row-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-3);
    letter-spacing: 0.02em;
    margin: 12px 0 8px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .optional-tag {
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    padding: 2px 7px;
    border-radius: 999px;
    background: rgba(255,255,255,0.06);
    border: 1px solid var(--border-1);
    color: var(--text-3);
  }

  /* Photo error */
  .photo-error {
    font-size: 11.5px;
    color: #f87171;
    margin: 4px 0 8px;
    padding: 0 2px;
  }

  /* AI strip */
  .ai-strip {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    background: rgba(255, 122, 77, 0.04);
    border: 1px solid rgba(255, 122, 77, 0.18);
    border-radius: 12px;
  }
  .ai-strip-icon {
    width: 32px;
    height: 32px;
    border-radius: 10px;
    background: rgba(255, 122, 77, 0.10);
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

  /* About you fields */
  .about-row {
    display: flex;
    gap: 8px;
  }
  .about-input {
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    border-radius: 14px;
    padding: 13px 14px;
    color: var(--text-1);
    font-size: 14.5px;
    font-weight: 500;
    font-family: inherit;
    outline: none;
    min-width: 0;
  }
  .about-input::placeholder {
    color: var(--text-3);
  }
  .about-input:focus {
    border-color: rgba(255, 122, 77, 0.4);
  }
  .about-input--name {
    flex: 1;
  }
  .about-input--age {
    width: 88px;
    flex-shrink: 0;
    -moz-appearance: textfield;
  }
  .about-input--age::-webkit-outer-spin-button,
  .about-input--age::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
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
    background: rgba(255, 122, 77, 0.08);
    border: 1px solid rgba(255, 122, 77, 0.3);
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
    background: rgba(255, 122, 77, 0.06);
    border-color: rgba(255, 122, 77, 0.3);
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
    background: rgba(255, 122, 77, 0.12);
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
    background: rgba(255, 122, 77, 0.10);
    border: 1px solid rgba(255, 122, 77, 0.16);
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
    box-shadow: 0 12px 32px rgba(255, 122, 77, 0.32);
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
