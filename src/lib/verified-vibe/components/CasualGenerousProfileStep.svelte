<script lang="ts">
  import { fade, slide, scale } from 'svelte/transition';

  interface Props {
    onSubmit?: (data: { profile: Record<string, string | string[]> }) => Promise<void>;
    onCancel?: () => void;
  }

  let { onSubmit = async () => {}, onCancel = () => {} }: Props = $props();

  let loading = $state(false);
  let error = $state<string | null>(null);
  let currentIndex = $state(0);
  let responses = $state<Record<string, string | string[]>>({});
  let step = $state<'questions' | 'review'>('questions');

  interface Question {
    id: string;
    type: 'multi-select';
    question: string;
    subtitle?: string;
    note?: string;
    options: Array<{ value: string; label: string }>;
  }

  const questions: Question[] = [
    {
      id: 'relationship_energy',
      type: 'multi-select',
      question: '✨ What kind of energy are you drawn to in a partner?',
      subtitle: 'Select all that apply',
      options: [
        { value: 'feminine_energy',            label: '🌹 Feminine energy' },
        { value: 'affectionate',               label: '💋 Affectionate' },
        { value: 'flirty_playful',             label: '😏 Flirty & playful' },
        { value: 'confident',                  label: '✨ Confident' },
        { value: 'emotionally_warm',           label: '🥰 Emotionally warm' },
        { value: 'well_traveled',              label: '🌍 Well-traveled' },
        { value: 'glamorous',                  label: '💃 Glamorous' },
        { value: 'adventurous',               label: '🎭 Adventurous' },
        { value: 'passionate',                 label: '🔥 Passionate' },
        { value: 'magnetic_presence',          label: '🧲 Magnetic presence' },
        { value: 'sensual',                    label: '🕯 Sensual' },
        { value: 'discreet',                   label: '🔒 Discreet' }
      ]
    },
    {
      id: 'shared_experiences',
      type: 'multi-select',
      question: '✨ What kind of experiences do you enjoy sharing with a partner?',
      subtitle: 'Select all that apply',
      options: [
        { value: 'international_travel',       label: '🌍 International travel' },
        { value: 'luxury_getaways',            label: '🛥 Luxury getaways' },
        { value: 'fine_dining',                label: '🍷 Fine dining' },
        { value: 'vip_nightlife',              label: '🎭 VIP nightlife & events' },
        { value: 'luxury_hotels',              label: '🏨 Luxury hotels & resorts' },
        { value: 'spontaneous_trips',          label: '✈️ Spontaneous trips' },
        { value: 'high_end_social',            label: '🥂 High-end social experiences' },
        { value: 'thoughtful_gifting',         label: '🎁 Thoughtful gifting' },
        { value: 'memorable_experiences',      label: '📸 Memorable experiences together' },
        { value: 'art_culture_fashion',        label: '🎨 Art, culture & fashion' },
        { value: 'relaxing_escapes',           label: '🌴 Relaxing escapes' },
        { value: 'exotic_cars',                label: '🚘 Exotic cars & experiences' }
      ]
    },
    {
      id: 'generosity_style',
      type: 'multi-select',
      question: '💎 How do you naturally show appreciation in a relationship?',
      subtitle: 'Select all that apply',
      note: 'This shapes how we match you.',
      options: [
        { value: 'gifts_surprises',            label: '🎁 Gifts & surprises' },
        { value: 'shared_experiences',         label: '✈️ Shared experiences' },
        { value: 'attention_communication',    label: '💬 Attention & communication' },
        { value: 'quality_time',               label: '❤️ Quality time' },
        { value: 'financial_generosity',       label: '💎 Financial generosity' },
        { value: 'romance_affection',          label: '🌹 Romance & affection' },
        { value: 'elevated_experiences',       label: '🥂 Elevated experiences' },
        { value: 'luxury_treatment',           label: '🛍 Luxury treatment' },
        { value: 'consistency_reliability',    label: '🕰 Consistency & reliability' },
        { value: 'supporting_ambitious',       label: '💼 Supporting ambitious partners' }
      ]
    },
    {
      id: 'chemistry_preferences',
      type: 'multi-select',
      question: '🔥 What kind of chemistry do you enjoy most?',
      subtitle: 'Select all that apply',
      options: [
        { value: 'instant_sparks',             label: '⚡ Instant sparks' },
        { value: 'affection_touch',            label: '💋 Affection & touch' },
        { value: 'flirty_banter',              label: '😏 Flirty banter' },
        { value: 'romantic_intimacy',          label: '🌹 Romantic intimacy' },
        { value: 'sensual_experiences',        label: '🍷 Sensual experiences' },
        { value: 'passionate_chemistry',       label: '🔥 Passionate chemistry' },
        { value: 'slow_burn',                  label: '🕯 Slow-burn attraction' },
        { value: 'emotional_first',            label: '❤️ Emotional connection first' },
        { value: 'open_minded',                label: '💫 Open-minded connection' },
        { value: 'physical_affection',         label: '🥰 Physical affection matters' }
      ]
    },
  ];

  const totalQuestions = questions.length;

  function current(): Question {
    return questions[currentIndex];
  }

  function isAnswered(q: Question): boolean {
    const r = responses[q.id];
    return Array.isArray(r) && r.length > 0;
  }

  function toggleMulti(value: string) {
    const q = current();
    const existing = (responses[q.id] as string[]) ?? [];
    if (existing.includes(value)) {
      responses[q.id] = existing.filter(v => v !== value);
    } else {
      responses[q.id] = [...existing, value];
    }
    responses = { ...responses };
  }

  function handleNext() {
    error = null;
    if (!isAnswered(current())) {
      error = 'Please select at least one option before continuing';
      return;
    }
    if (currentIndex < totalQuestions - 1) {
      currentIndex++;
    } else {
      step = 'review';
    }
  }

  function handleBack() {
    error = null;
    if (step === 'review') {
      step = 'questions';
      currentIndex = totalQuestions - 1;
    } else if (currentIndex > 0) {
      currentIndex--;
    } else {
      onCancel();
    }
  }

  function handleEdit(index: number) {
    currentIndex = index;
    step = 'questions';
  }

  async function handleSubmit() {
    loading = true;
    error = null;
    try {
      await onSubmit({ profile: responses });
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to save';
      step = 'review';
    } finally {
      loading = false;
    }
  }

  function getProgressPct(): number {
    if (step === 'review') return 100;
    return ((currentIndex + 1) / totalQuestions) * 100;
  }

  function responseLabel(q: Question): string {
    if (!responses[q.id]) return 'Not answered';
    const vals = responses[q.id] as string[];
    if (!vals?.length) return 'None selected';
    return vals.map(v => q.options.find(o => o.value === v)?.label ?? v).join(', ');
  }
</script>

<div class="casual-generous-profile-step">
  <div class="header" transition:fade={{ duration: 200 }}>
    <div class="progress-container">
      <div class="progress-bar">
        <div class="progress-fill" style="width: {getProgressPct()}%"></div>
      </div>
      <p class="progress-label">
        {step === 'review' ? `${totalQuestions} of ${totalQuestions}` : `${currentIndex + 1} of ${totalQuestions}`}
      </p>
    </div>
  </div>

  {#if error}
    <div class="error-message" role="alert" transition:slide={{ duration: 200 }}>
      <span>⚠️</span>
      <span>{error}</span>
    </div>
  {/if}

  {#if step === 'questions'}
    <div class="questions-container" transition:fade={{ duration: 200 }}>
      {#each [current()] as q (q.id)}
        <div class="question-card" transition:scale={{ duration: 200 }}>
          <h3 class="question-text">{q.question}</h3>
          {#if q.subtitle}
            <p class="question-subtitle">{q.subtitle}</p>
          {/if}
          {#if q.note}
            <p class="question-note">💡 {q.note}</p>
          {/if}

          <div class="options-grid" class:chips={q.options && q.options.length > 6}>
            {#each q.options as opt (opt.value)}
              {@const sel = ((responses[q.id] as string[]) ?? []).includes(opt.value)}
              <button
                class="option-button"
                class:selected={sel}
                onclick={() => toggleMulti(opt.value)}
                disabled={loading}
                aria-pressed={sel}
              >
                <span class="option-label">{opt.label}</span>
                {#if sel}<span class="checkmark">✓</span>{/if}
              </button>
            {/each}
          </div>
        </div>
      {/each}
    </div>

    <div class="button-group">
      <button class="button button-secondary" onclick={handleBack} disabled={loading}>
        ← Back
      </button>
      <button
        class="button button-primary"
        onclick={handleNext}
        disabled={loading || !isAnswered(current())}
      >
        {currentIndex === totalQuestions - 1 ? 'Review' : 'Next'} →
      </button>
    </div>
  {/if}

  {#if step === 'review'}
    <div class="review-container" transition:fade={{ duration: 200 }}>
      <div class="review-list">
        {#each questions as q, i (q.id)}
          <div class="review-item">
            <div class="review-header">
              <h4 class="review-question">{q.question}</h4>
              <button class="edit-button" onclick={() => handleEdit(i)} disabled={loading}>Edit</button>
            </div>
            <p class="answer-text">{responseLabel(q)}</p>
          </div>
        {/each}
      </div>

      <div class="button-group">
        <button class="button button-secondary" onclick={handleBack} disabled={loading}>
          ← Back
        </button>
        <button class="button button-primary" onclick={handleSubmit} disabled={loading}>
          {loading ? 'Saving…' : 'Save & Continue'}
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .casual-generous-profile-step {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    max-width: 600px;
    margin: 0 auto;
  }

  .header { display: flex; flex-direction: column; gap: 0.5rem; }

  .progress-container { display: flex; flex-direction: column; gap: 0.25rem; }

  .progress-bar {
    width: 100%;
    height: 4px;
    background-color: var(--bg-2);
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background-color: var(--accent-bright);
    transition: width 0.3s ease;
  }

  .progress-label { font-size: 0.85rem; color: var(--text-3); margin: 0; }

  .error-message {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem;
    background-color: rgba(239, 68, 68, 0.1);
    border-left: 4px solid #ef4444;
    border-radius: 8px;
    color: #ef4444;
    font-size: 0.9rem;
  }

  .questions-container { display: flex; flex-direction: column; gap: 1.5rem; }

  .question-card {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.5rem;
    background-color: var(--bg-2);
    border: 1px solid var(--border-1);
    border-radius: 12px;
  }

  .question-text { font-size: 1.1rem; font-weight: 500; color: var(--text-1); margin: 0; }
  .question-subtitle { font-size: 0.85rem; color: var(--text-3); margin: 0; }
  .question-note {
    font-size: 0.8rem;
    color: var(--accent-bright);
    margin: 0;
    padding: 0.5rem 0.75rem;
    background-color: var(--accent-tint);
    border-radius: 6px;
  }

  .options-grid { display: grid; grid-template-columns: 1fr; gap: 0.5rem; }

  .options-grid.chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .options-grid.chips .option-button {
    flex: none;
    padding: 7px 16px;
    border-radius: 100px;
    font-size: 0.85rem;
    min-height: 36px;
    justify-content: center;
    white-space: nowrap;
  }

  .options-grid.chips .checkmark { display: none; }

  .option-button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem;
    background-color: var(--bg-3);
    border: 2px solid var(--border-1);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 0.95rem;
    color: var(--text-1);
    font-weight: 500;
    text-align: left;
  }

  .option-button:hover:not(:disabled) {
    border-color: var(--accent-bright);
    background-color: var(--accent-tint);
  }

  .option-button.selected {
    border-color: var(--accent-bright);
    background-color: var(--accent-tint);
  }

  .option-button:disabled { opacity: 0.6; cursor: not-allowed; }
  .option-label { text-align: left; }
  .checkmark { color: var(--accent-bright); font-weight: bold; flex-shrink: 0; }

  .review-container { display: flex; flex-direction: column; gap: 1.5rem; }
  .review-list { display: flex; flex-direction: column; gap: 1rem; }

  .review-item {
    padding: 1rem;
    background-color: var(--bg-2);
    border-radius: 8px;
    border: 1px solid var(--border-1);
  }

  .review-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 0.5rem;
  }

  .review-question { font-size: 0.95rem; font-weight: 500; color: var(--text-1); margin: 0; flex: 1; }

  .edit-button {
    padding: 0.25rem 0.75rem;
    background-color: transparent;
    border: 1px solid var(--accent-bright);
    border-radius: 6px;
    color: var(--accent-bright);
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
  }

  .edit-button:hover:not(:disabled) { background-color: var(--accent-bright); color: var(--bg-1); }
  .edit-button:disabled { opacity: 0.5; cursor: not-allowed; }

  .answer-text { font-size: 0.95rem; color: var(--text-2); margin: 0; line-height: 1.5; }

  .button-group { display: flex; gap: 1rem; }

  .button {
    flex: 1;
    padding: 1rem;
    border: none;
    border-radius: 8px;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    min-height: 44px;
    font-family: inherit;
  }

  .button-primary { background-color: var(--accent-bright); color: var(--bg-1); }
  .button-primary:hover:not(:disabled) { opacity: 0.9; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(255, 59, 107, 0.3); }
  .button-primary:disabled { opacity: 0.5; cursor: not-allowed; }

  .button-secondary { background-color: var(--bg-2); color: var(--text-1); border: 1px solid var(--border-1); }
  .button-secondary:hover:not(:disabled) { background-color: var(--bg-3); border-color: var(--border-2); }
  .button-secondary:disabled { opacity: 0.6; cursor: not-allowed; }

  @media (max-width: 767px) {
    .casual-generous-profile-step { gap: 1rem; }
    .question-card { padding: 1rem; }
    .button-group { flex-direction: column; }
    .button { width: 100%; }
    .review-header { flex-direction: column; align-items: flex-start; }
    .edit-button { align-self: flex-start; }
  }

  @media (prefers-reduced-motion: reduce) {
    .progress-fill, .option-button, .button { transition: none; }
  }
</style>
