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

  const INTERESTS: { value: string; label: string }[] = [
    { value: 'Travel',        label: '✈️ Travel' },
    { value: 'Food & Dining', label: '🍽️ Food & Dining' },
    { value: 'Music',         label: '🎵 Music' },
    { value: 'Fitness',       label: '🏋️ Fitness' },
    { value: 'Reading',       label: '📚 Reading' },
    { value: 'Movies',        label: '🎬 Movies' },
    { value: 'Outdoors',      label: '🌲 Outdoors' },
    { value: 'Art',           label: '🎨 Art' },
    { value: 'Gaming',        label: '🎮 Gaming' },
    { value: 'Cooking',       label: '👨‍🍳 Cooking' },
    { value: 'Photography',   label: '📸 Photography' },
    { value: 'Dancing',       label: '💃 Dancing' },
    { value: 'Sports',        label: '⚽ Sports' },
    { value: 'Tech',          label: '💻 Tech' },
    { value: 'Fashion',       label: '👗 Fashion' }
  ];


  let firstName = $state(initialName);
  let age = $state<number | ''>(initialAge || '');
  let city = $state('');
  let about = $state('');
  let selectedTags = $state<Set<string>>(new Set());
  let lookingFor = $state('');
  let selectedInterests = $state<Set<string>>(new Set());
  let touched = $state(false);

  // Voice input — tracks which field is actively listening
  let listeningFor = $state<'about' | 'looking' | null>(null);
  let voiceSupported = $state(false);
  let recognition: any = null;

  $effect(() => {
    if (typeof window !== 'undefined') {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      voiceSupported = !!SR;
      if (SR) {
        recognition = new SR();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';
        recognition.onresult = (e: any) => {
          const transcript = e.results[0][0].transcript;
          if (listeningFor === 'about') {
            about = about ? about.trimEnd() + ' ' + transcript : transcript;
          } else if (listeningFor === 'looking') {
            lookingFor = lookingFor ? lookingFor.trimEnd() + ' ' + transcript : transcript;
          }
          listeningFor = null;
        };
        recognition.onerror = () => { listeningFor = null; };
        recognition.onend = () => { listeningFor = null; };
      }
    }
  });

  function toggleVoice(target: 'about' | 'looking') {
    if (!recognition) return;
    if (listeningFor) {
      recognition.stop();
      listeningFor = null;
    } else {
      listeningFor = target;
      recognition.start();
    }
  }

  const isValid = $derived(
    firstName.trim().length > 0 &&
    city.trim().length > 0 &&
    about.trim().length > 20 &&
    selectedTags.size > 0 &&
    lookingFor.trim().length > 10
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

  function toggleInterest(interest: string) {
    const next = new Set(selectedInterests);
    if (next.has(interest)) {
      next.delete(interest);
    } else if (next.size < 5) {
      next.add(interest);
    }
    selectedInterests = next;
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
      lookingFor,
      interests: [...selectedInterests]
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

  <!-- City -->
  <div class="field">
    <label class="label" for="city">City</label>
    <input
      id="city"
      class="input {touched && !city.trim() ? 'error' : ''}"
      type="text"
      placeholder="New York, NY"
      bind:value={city}
    />
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

  <!-- Who's a good match -->
  <div class="field">
    <label class="label" for="lookingFor">
      Who's a good match for you?
      <span class="label-hint">Be specific — it sharpens your matches</span>
    </label>
    <div class="textarea-wrap">
      <textarea
        id="lookingFor"
        class="textarea {touched && lookingFor.trim().length <= 10 ? 'error' : ''}"
        placeholder="Someone emotionally available, who has their own thing going but actually makes time. Doesn't need to be everywhere at once — consistent, a bit ambitious, knows how to have a real conversation."
        rows="4"
        bind:value={lookingFor}
      ></textarea>
      {#if voiceSupported}
        <button
          type="button"
          class="mic-btn {listeningFor === 'looking' ? 'listening' : ''}"
          onclick={() => toggleVoice('looking')}
          aria-label={listeningFor === 'looking' ? 'Stop recording' : 'Speak your answer'}
          title={listeningFor === 'looking' ? 'Tap to stop' : 'Tap to speak'}
        >
          {#if listeningFor === 'looking'}
            <span class="mic-ring"></span>
          {/if}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
        </button>
        {#if listeningFor === 'looking'}
          <p class="voice-hint">Listening… speak now</p>
        {/if}
      {/if}
    </div>
    <div class="char-hint">{lookingFor.length} chars</div>
    {#if touched && lookingFor.trim().length <= 10}
      <p class="field-error">Add a bit more detail</p>
    {/if}
  </div>

  <!-- Interests -->
  <div class="field">
    <label class="label">
      Interests
      <span class="label-hint">Pick up to 5 (optional)</span>
    </label>
    <div class="chip-grid">
      {#each INTERESTS as interest}
        {@const selected = selectedInterests.has(interest.value)}
        {@const disabled = !selected && selectedInterests.size >= 5}
        <button
          type="button"
          class="chip {selected ? 'selected' : ''} {disabled ? 'disabled' : ''}"
          onclick={() => toggleInterest(interest.value)}
          disabled={disabled}
        >
          {interest.label}
        </button>
      {/each}
    </div>
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
