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

  const PERSONALITY_TAGS = [
    'Ambitious', 'Laid-back', 'Adventurous', 'Intellectual', 'Funny',
    'Creative', 'Athletic', 'Spontaneous', 'Grounded', 'Empathetic',
    'Direct', 'Curious', 'Loyal', 'Social', 'Independent'
  ];

  const INTERESTS = [
    'Travel', 'Food & Dining', 'Music', 'Fitness', 'Reading',
    'Movies', 'Outdoors', 'Art', 'Gaming', 'Cooking',
    'Photography', 'Dancing', 'Sports', 'Tech', 'Fashion'
  ];

  const LOOKING_FOR_OPTIONS: Record<string, string[]> = {
    casual_man: ['Casual dating', 'Something that evolves', 'No strings attached', 'Seeing where it goes'],
    marriage_minded_man: ['Long-term relationship', 'Future partner', 'Serious commitment', 'Building something real']
  };

  let firstName = $state(initialName);
  let age = $state<number | ''>(initialAge || '');
  let city = $state('');
  let about = $state('');
  let selectedTags = $state<Set<string>>(new Set());
  let lookingFor = $state('');
  let selectedInterests = $state<Set<string>>(new Set());
  let touched = $state(false);

  const lookingForOptions = $derived(
    LOOKING_FOR_OPTIONS[archetype] ?? LOOKING_FOR_OPTIONS.casual_man
  );

  const isValid = $derived(
    firstName.trim().length > 0 &&
    city.trim().length > 0 &&
    about.trim().length > 20 &&
    selectedTags.size > 0 &&
    lookingFor.length > 0
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
    <textarea
      id="about"
      class="textarea {touched && about.trim().length < 20 ? 'error' : ''}"
      placeholder="I build things by day and explore the city by night. Equal parts ambitious and present — I take work seriously but I know how to switch off."
      rows="4"
      bind:value={about}
    ></textarea>
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
        {@const selected = selectedTags.has(tag)}
        {@const disabled = !selected && selectedTags.size >= 3}
        <button
          type="button"
          class="chip {selected ? 'selected' : ''} {disabled ? 'disabled' : ''}"
          onclick={() => toggleTag(tag)}
          disabled={disabled}
        >
          {tag}
        </button>
      {/each}
    </div>
    {#if touched && selectedTags.size === 0}
      <p class="field-error">Pick at least one</p>
    {/if}
  </div>

  <!-- Looking for -->
  <div class="field">
    <label class="label">What are you looking for?</label>
    <div class="option-list">
      {#each lookingForOptions as option}
        <button
          type="button"
          class="option {lookingFor === option ? 'selected' : ''}"
          onclick={() => lookingFor = option}
        >
          <span class="option-dot"></span>
          {option}
        </button>
      {/each}
    </div>
    {#if touched && !lookingFor}
      <p class="field-error">Select one</p>
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
        {@const selected = selectedInterests.has(interest)}
        {@const disabled = !selected && selectedInterests.size >= 5}
        <button
          type="button"
          class="chip {selected ? 'selected' : ''} {disabled ? 'disabled' : ''}"
          onclick={() => toggleInterest(interest)}
          disabled={disabled}
        >
          {interest}
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
