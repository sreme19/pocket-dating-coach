<script lang="ts">
  export interface ProfileIntakeData {
    firstName: string;
    age: number;
    city: string;
    about: string;
    personalityTags: string[];
    lookingFor: string;
    interests: string[];
  }

  interface Props {
    onSubmit: (data: ProfileIntakeData) => void;
    onCancel: () => void;
    initialName?: string;
    initialAge?: number;
    archetype?: string;
  }

  let { onSubmit, onCancel, initialName = '', initialAge = 0, archetype = '' }: Props = $props();

  const PERSONALITY_TAGS: { value: string; label: string }[] = [
    { value: 'Ambitious',     label: '🚀 Ambitious' },
    { value: 'Laid-back',     label: '😌 Laid-back' },
    { value: 'Adventurous',   label: '🌍 Adventurous' },
    { value: 'Intellectual',  label: '🧠 Intellectual' },
    { value: 'Funny',         label: '😂 Funny' },
    { value: 'Creative',      label: '🎨 Creative' },
    { value: 'Athletic',      label: '💪 Athletic' },
    { value: 'Spontaneous',   label: '⚡ Spontaneous' },
    { value: 'Grounded',      label: '🌿 Grounded' },
    { value: 'Empathetic',    label: '🤍 Empathetic' },
    { value: 'Direct',        label: '🎯 Direct' },
    { value: 'Curious',       label: '🔍 Curious' },
    { value: 'Loyal',         label: '🛡️ Loyal' },
    { value: 'Social',        label: '🥂 Social' },
    { value: 'Independent',   label: '🦁 Independent' }
  ];


  // ── City combobox ──────────────────────────────────────────────────────────
  const CITIES = [
    // UK
    'London, UK', 'Manchester, UK', 'Birmingham, UK', 'Leeds, UK', 'Glasgow, UK',
    'Edinburgh, UK', 'Liverpool, UK', 'Bristol, UK', 'Sheffield, UK', 'Cardiff, UK',
    'Newcastle, UK', 'Nottingham, UK', 'Leicester, UK', 'Oxford, UK', 'Cambridge, UK',
    'Brighton, UK', 'Bath, UK', 'York, UK', 'Coventry, UK', 'Belfast, UK',
    // US
    'New York, NY', 'Los Angeles, CA', 'Chicago, IL', 'Houston, TX', 'Phoenix, AZ',
    'Philadelphia, PA', 'San Antonio, TX', 'San Diego, CA', 'Dallas, TX', 'San Jose, CA',
    'Austin, TX', 'Jacksonville, FL', 'San Francisco, CA', 'Columbus, OH', 'Charlotte, NC',
    'Indianapolis, IN', 'Seattle, WA', 'Denver, CO', 'Washington, DC', 'Nashville, TN',
    'Boston, MA', 'Las Vegas, NV', 'Portland, OR', 'Miami, FL', 'Atlanta, GA',
    // India
    'Mumbai, India', 'Delhi, India', 'Bangalore, India', 'Hyderabad, India', 'Chennai, India',
    'Kolkata, India', 'Pune, India', 'Ahmedabad, India', 'Jaipur, India', 'Surat, India',
    'Lucknow, India', 'Kanpur, India', 'Nagpur, India', 'Indore, India', 'Thane, India',
    'Bhopal, India', 'Chandigarh, India', 'Kochi, India', 'Coimbatore, India', 'Goa, India',
    // Australia
    'Sydney, Australia', 'Melbourne, Australia', 'Brisbane, Australia', 'Perth, Australia',
    'Adelaide, Australia', 'Gold Coast, Australia', 'Canberra, Australia',
    // Canada
    'Toronto, Canada', 'Vancouver, Canada', 'Montreal, Canada', 'Calgary, Canada',
    'Ottawa, Canada', 'Edmonton, Canada',
    // UAE / Middle East
    'Dubai, UAE', 'Abu Dhabi, UAE', 'Riyadh, Saudi Arabia', 'Doha, Qatar',
    // Europe
    'Paris, France', 'Berlin, Germany', 'Madrid, Spain', 'Rome, Italy', 'Amsterdam, Netherlands',
    'Zurich, Switzerland', 'Vienna, Austria', 'Stockholm, Sweden', 'Oslo, Norway',
    'Copenhagen, Denmark', 'Helsinki, Finland', 'Dublin, Ireland', 'Lisbon, Portugal',
    'Brussels, Belgium', 'Warsaw, Poland', 'Prague, Czech Republic', 'Budapest, Hungary',
    'Athens, Greece', 'Istanbul, Turkey', 'Zurich, Switzerland',
    // Asia
    'Singapore', 'Hong Kong', 'Tokyo, Japan', 'Osaka, Japan', 'Seoul, South Korea',
    'Bangkok, Thailand', 'Kuala Lumpur, Malaysia', 'Jakarta, Indonesia', 'Manila, Philippines',
    'Taipei, Taiwan', 'Shanghai, China', 'Beijing, China', 'Guangzhou, China', 'Shenzhen, China',
    // Africa / LatAm
    'Lagos, Nigeria', 'Nairobi, Kenya', 'Cape Town, South Africa', 'Johannesburg, South Africa',
    'São Paulo, Brazil', 'Rio de Janeiro, Brazil', 'Buenos Aires, Argentina',
    'Bogotá, Colombia', 'Mexico City, Mexico',
    // NZ
    'Auckland, New Zealand', 'Wellington, New Zealand',
  ];

  let firstName = $state(initialName);
  let age = $state<number | ''>(initialAge || '');
  let city = $state('');
  let cityQuery = $state('');
  let cityOpen = $state(false);
  let cityHighlight = $state(-1);
  let cityInputEl = $state<HTMLInputElement | null>(null);

  const citySuggestions = $derived.by(() => {
    const q = cityQuery.trim().toLowerCase();
    if (!q) return [];
    return CITIES.filter(c => c.toLowerCase().includes(q)).slice(0, 6);
  });

  function selectCity(c: string) {
    city = c;
    cityQuery = c;
    cityOpen = false;
    cityHighlight = -1;
  }

  function onCityInput(e: Event) {
    cityQuery = (e.target as HTMLInputElement).value;
    city = cityQuery; // keep raw value in sync in case user types something not in the list
    cityOpen = true;
    cityHighlight = -1;
  }

  function onCityKeydown(e: KeyboardEvent) {
    if (!cityOpen || citySuggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      cityHighlight = (cityHighlight + 1) % citySuggestions.length;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      cityHighlight = (cityHighlight - 1 + citySuggestions.length) % citySuggestions.length;
    } else if (e.key === 'Enter' && cityHighlight >= 0) {
      e.preventDefault();
      selectCity(citySuggestions[cityHighlight]);
    } else if (e.key === 'Escape') {
      cityOpen = false;
    }
  }

  function onCityBlur() {
    // Small delay so click on suggestion registers first
    setTimeout(() => { cityOpen = false; }, 150);
  }

  let about = $state('');
  let selectedTags = $state<Set<string>>(new Set());
  let touched = $state(false);

  // Voice input — tracks which field is actively listening
  let listeningFor = $state<'about' | null>(null);
  let voiceSupported = $state(false);
  let voiceLiveText = $state('');
  let recognition: any = null;

  $effect(() => {
    if (typeof window !== 'undefined') {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      voiceSupported = !!SR;
    }
  });

  function toggleVoice(target: 'about') {
    if (listeningFor) {
      recognition?.stop();
      return;
    }

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-IN';

    const baseText = about ? about.trimEnd() + ' ' : '';
    let finalChunk = '';
    voiceLiveText = '';

    recognition.onresult = (e: any) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          finalChunk += e.results[i][0].transcript + ' ';
        } else {
          interim += e.results[i][0].transcript;
        }
      }
      voiceLiveText = (finalChunk + interim).trimStart();
      about = (baseText + voiceLiveText).trimStart();
    };

    recognition.onerror = () => {
      listeningFor = null;
      voiceLiveText = '';
    };

    recognition.onend = () => {
      listeningFor = null;
      voiceLiveText = '';
    };

    recognition.start();
    listeningFor = target;
  }

  const isValid = $derived(
    firstName.trim().length > 0 &&
    city.trim().length > 0 &&
    about.trim().length > 20 &&
    selectedTags.size > 0
  );

  function toggleTag(tag: string) {
    const next = new Set(selectedTags);
    if (next.has(tag)) {
      next.delete(tag);
    } else if (next.size < 3) {
      next.add(tag);
    }
    selectedTags = next;
  }

  function handleSubmit() {
    touched = true;
    if (!isValid) return;
    onSubmit({
      firstName: firstName.trim(),
      age: Number(age) || 0,
      city: city.trim(),
      about: about.trim(),
      personalityTags: [...selectedTags],
      lookingFor: '',
      interests: []
    });
  }
</script>

<div class="intake">
  <!-- Name + Age row -->
  <div class="field-row">
    <div class="field">
      <label class="label" for="firstName">First name</label>
      <input
        id="firstName"
        class="input {touched && !firstName.trim() ? 'error' : ''}"
        type="text"
        placeholder="Alex"
        bind:value={firstName}
      />
    </div>
    <div class="field field-sm">
      <label class="label" for="age">Age</label>
      <input
        id="age"
        class="input"
        type="number"
        min="18"
        max="99"
        placeholder="28"
        bind:value={age}
      />
    </div>
  </div>

  <!-- City combobox -->
  <div class="field">
    <label class="label" for="city">City</label>
    <div class="city-wrap">
      <input
        id="city"
        bind:this={cityInputEl}
        class="input {touched && !city.trim() ? 'error' : ''}"
        type="text"
        placeholder="Start typing your city…"
        autocomplete="off"
        value={cityQuery}
        oninput={onCityInput}
        onkeydown={onCityKeydown}
        onblur={onCityBlur}
        onfocus={() => { if (cityQuery) cityOpen = true; }}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={cityOpen && citySuggestions.length > 0}
      />
      {#if cityOpen && citySuggestions.length > 0}
        <ul class="city-dropdown" role="listbox">
          {#each citySuggestions as suggestion, i}
            <li
              class="city-option {i === cityHighlight ? 'highlighted' : ''}"
              role="option"
              aria-selected={i === cityHighlight}
              onmousedown={() => selectCity(suggestion)}
            >
              <span class="city-pin">📍</span>
              {suggestion}
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </div>

  <!-- About -->
  <div class="field">
    <label class="label" for="about">
      About you
      <span class="label-hint">What would a stranger know about you in 60 seconds?</span>
    </label>
    <div class="textarea-wrap">
      <textarea
        id="about"
        class="textarea {touched && about.trim().length < 20 ? 'error' : ''}"
        placeholder="I build things by day and explore the city by night. Equal parts ambitious and present — I take work seriously but I know how to switch off."
        rows="4"
        bind:value={about}
      ></textarea>
      {#if voiceSupported}
        <button
          type="button"
          class="mic-btn {listeningFor === 'about' ? 'listening' : ''}"
          onclick={() => toggleVoice('about')}
          aria-label={listeningFor === 'about' ? 'Stop recording' : 'Speak your answer'}
          title={listeningFor === 'about' ? 'Tap to stop' : 'Tap to speak'}
        >
          {#if listeningFor === 'about'}
            <span class="mic-ring"></span>
          {/if}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
        </button>
        {#if listeningFor === 'about'}
          <p class="voice-hint">Listening… speak now</p>
        {/if}
      {/if}
    </div>
    <div class="char-hint">{about.length} chars {about.trim().length < 20 ? '(min 20)' : ''}</div>
  </div>

  <!-- Personality tags -->
  <div class="field">
    <label class="label">
      Personality
      <span class="label-hint">Pick up to 3</span>
    </label>
    <div class="chip-grid">
      {#each PERSONALITY_TAGS as tag}
        {@const selected = selectedTags.has(tag.value)}
        {@const disabled = !selected && selectedTags.size >= 3}
        <button
          type="button"
          class="chip {selected ? 'selected' : ''} {disabled ? 'disabled' : ''}"
          onclick={() => toggleTag(tag.value)}
          disabled={disabled}
        >
          {tag.label}
        </button>
      {/each}
    </div>
    {#if touched && selectedTags.size === 0}
      <p class="field-error">Pick at least one</p>
    {/if}
  </div>

  <!-- Submit -->
  <button class="submit-btn" onclick={handleSubmit}>
    Build my profile
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      <path d="M5 12h14M12 5l7 7-7 7"/>
    </svg>
  </button>
</div>

<style>
  /* ── City combobox ── */
  .city-wrap {
    position: relative;
  }

  .city-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    border-radius: 10px;
    list-style: none;
    margin: 0;
    padding: 4px;
    z-index: 100;
    box-shadow: 0 8px 24px rgba(0,0,0,0.3);
    overflow: hidden;
  }

  .city-option {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    border-radius: 7px;
    font-size: 14px;
    color: var(--text-1);
    cursor: pointer;
    transition: background 100ms;
  }

  .city-option:hover,
  .city-option.highlighted {
    background: var(--bg-3);
  }

  .city-pin {
    font-size: 13px;
    flex-shrink: 0;
  }

  /* ─────────────────── */
  .intake {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .field-row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 12px;
    align-items: start;
  }

  .field-sm {
    width: 80px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .label {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-2);
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .label-hint {
    font-size: 11px;
    font-weight: 400;
    color: var(--text-3);
  }

  .input,
  .textarea {
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    border-radius: 10px;
    padding: 12px 14px;
    font-size: 14px;
    color: var(--text-1);
    font-family: inherit;
    transition: border-color 150ms ease;
    width: 100%;
    box-sizing: border-box;
  }

  .input:focus,
  .textarea:focus {
    outline: none;
    border-color: var(--accent-bright);
  }

  .input.error,
  .textarea.error {
    border-color: #ef4444;
  }

  .input::placeholder,
  .textarea::placeholder {
    color: var(--text-4);
  }

  .textarea {
    resize: vertical;
    min-height: 96px;
    line-height: 1.5;
  }

  .textarea-wrap {
    position: relative;
  }

  .mic-btn {
    position: absolute;
    bottom: 10px;
    right: 10px;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    border: 1px solid var(--border-2);
    background: var(--bg-1);
    color: var(--text-3);
    display: grid;
    place-items: center;
    cursor: pointer;
    transition: all 150ms ease;
    flex-shrink: 0;
  }

  .mic-btn:hover {
    border-color: var(--accent-bright);
    color: var(--accent-bright);
  }

  .mic-btn.listening {
    border-color: var(--accent-bright);
    background: var(--accent-tint);
    color: var(--accent-bright);
  }

  .mic-ring {
    position: absolute;
    inset: -4px;
    border-radius: 50%;
    border: 2px solid var(--accent-bright);
    animation: mic-pulse 1.2s ease-in-out infinite;
    pointer-events: none;
  }

  @keyframes mic-pulse {
    0%, 100% { opacity: 0.8; transform: scale(1); }
    50%       { opacity: 0.2; transform: scale(1.25); }
  }

  .voice-hint {
    font-size: 11px;
    color: var(--accent-bright);
    margin: 4px 0 0;
    font-style: italic;
  }

  .char-hint {
    font-size: 11px;
    color: var(--text-3);
    text-align: right;
    margin-top: -4px;
  }

  .chip-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .chip {
    padding: 7px 14px;
    border-radius: 999px;
    border: 1px solid var(--border-2);
    background: var(--bg-2);
    color: var(--text-2);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
    font-family: inherit;
  }

  .chip:hover:not(.disabled) {
    border-color: var(--accent-bright);
    color: var(--text-1);
  }

  .chip.selected {
    background: var(--accent-tint);
    border-color: var(--accent-bright);
    color: var(--accent-bright);
  }

  .chip.disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .option-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .option {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border-radius: 10px;
    border: 1px solid var(--border-1);
    background: var(--bg-2);
    color: var(--text-2);
    font-size: 14px;
    cursor: pointer;
    text-align: left;
    transition: all 150ms ease;
    font-family: inherit;
  }

  .option:hover {
    border-color: var(--border-2);
    color: var(--text-1);
  }

  .option.selected {
    background: var(--accent-tint);
    border-color: var(--accent-bright);
    color: var(--accent-bright);
  }

  .option-dot {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 2px solid currentColor;
    flex-shrink: 0;
    position: relative;
  }

  .option.selected .option-dot::after {
    content: '';
    position: absolute;
    inset: 2px;
    border-radius: 50%;
    background: var(--accent-bright);
  }

  .field-error {
    font-size: 11px;
    color: #ef4444;
    margin: 0;
  }

  .submit-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 14px 20px;
    border-radius: 12px;
    background: var(--accent-bright);
    color: var(--bg-1);
    font-size: 15px;
    font-weight: 600;
    border: none;
    cursor: pointer;
    transition: all 150ms ease;
    font-family: inherit;
    margin-top: 8px;
  }

  .submit-btn:hover {
    opacity: 0.9;
    transform: translateY(-1px);
    box-shadow: 0 4px 16px var(--accent-glow);
  }

  .submit-btn:active {
    transform: translateY(0);
  }
</style>
