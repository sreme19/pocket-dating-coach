<script lang="ts">
  import { fade, slide, scale } from 'svelte/transition';

  interface Props {
    onSubmit?: (data: { preferences: Record<string, string | string[]> }) => Promise<void>;
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
    type: 'multiple-choice' | 'multi-select' | 'text';
    question: string;
    subtitle?: string;
    options?: Array<{ value: string; label: string }>;
    placeholder?: string;
    optional?: boolean;
  }

  const questions: Question[] = [
    {
      id: 'partner_life_direction',
      type: 'multiple-choice',
      question: '🚀 What kind of life direction do you admire in a partner?',
      options: [
        { value: 'ambitious', label: '🎯 Ambitious and driven' },
        { value: 'balanced', label: '⚖️ Balanced and grounded' },
        { value: 'emotionally_aware', label: '🌱 Emotionally self-aware' },
        { value: 'adventurous', label: '🌍 Adventurous and unconventional' }
      ]
    },
    {
      id: 'partner_commitment_style',
      type: 'multiple-choice',
      question: '💍 What kind of commitment are you open to?',
      options: [
        { value: 'marriage_soon', label: '💒 Marriage in the near future' },
        { value: 'long_term_first', label: '🏡 Long-term partnership first' },
        { value: 'take_time', label: '🌱 Taking time before major decisions' },
        { value: 'flexible', label: '🤝 Flexible with the right connection' }
      ]
    },
    {
      id: 'partner_lifestyle',
      type: 'multi-select',
      question: '🌿 Which traits matter most in a partner\'s lifestyle?',
      subtitle: 'Select all that apply',
      options: [
        { value: 'non_smoker', label: '🚭 Non-smoker' },
        { value: 'social_drinker_ok', label: '🍷 Social drinker is okay' },
        { value: 'health_conscious', label: '💪 Health-conscious' },
        { value: 'family_oriented', label: '👨‍👩‍👧‍👦 Family-oriented' },
        { value: 'loves_travel', label: '✈️ Loves travel & experiences' },
        { value: 'emotionally_aware', label: '🧠 Emotionally aware' },
        { value: 'respects_space', label: '⚖️ Respects personal space' }
      ]
    },
    {
      id: 'career_alignment',
      type: 'multiple-choice',
      question: '💼 How important is career alignment in a relationship?',
      options: [
        { value: 'very_important', label: '🚀 Very important — ambition matters' },
        { value: 'lifestyle_matters', label: '⚖️ Similar lifestyles matter more than titles' },
        { value: 'emotional_support', label: '❤️ Emotional support matters more than career' },
        { value: 'no_preference', label: '🤷 No strong preference' }
      ]
    },
    {
      id: 'future_vision',
      type: 'multiple-choice',
      question: '🏡 What future are you hoping to build with someone?',
      options: [
        { value: 'marriage_family', label: '💒 Marriage & family' },
        { value: 'shared_experiences', label: '🌍 A life of shared experiences' },
        { value: 'stability_security', label: '🧱 Stability and emotional security' },
        { value: 'power_couple', label: '🚀 A power-couple dynamic' }
      ]
    },
    {
      id: 'ideal_partner_energy',
      type: 'text',
      question: '💝 Describe the kind of partner you naturally feel drawn to.',
      placeholder: 'Describe the kind of partner you naturally feel drawn to…',
      optional: true
    }
  ];

  const totalQuestions = questions.length;

  function current(): Question {
    return questions[currentIndex];
  }

  function isAnswered(q: Question): boolean {
    const r = responses[q.id];
    if (q.optional) return true;
    if (q.type === 'multi-select') return Array.isArray(r) && r.length > 0;
    return r !== undefined && r !== '' && r !== null;
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

  function handleSelect(value: string) {
    const q = current();
    responses[q.id] = value;
    responses = { ...responses };
  }

  function handleText(value: string) {
    const q = current();
    responses[q.id] = value;
    responses = { ...responses };
  }

  function handleNext() {
    error = null;
    if (!isAnswered(current())) {
      error = 'Please answer this question before continuing';
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
      await onSubmit({ preferences: responses });
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
    if (!responses[q.id]) return q.optional ? 'Skipped' : 'Not answered';
    if (q.type === 'multi-select') {
      const vals = responses[q.id] as string[];
      if (!vals?.length) return 'None selected';
      return vals.map(v => q.options?.find(o => o.value === v)?.label ?? v).join(', ');
    }
    if (q.type === 'multiple-choice') {
      return q.options?.find(o => o.value === responses[q.id])?.label ?? String(responses[q.id]);
    }
    return String(responses[q.id]);
  }
</script>

<div class="forever-prefs-step">
  <div class="header" transition:fade={{ duration: 200 }}>
    <div class="header-content">
      <h2 class="title">
        {step === 'questions' ? 'Partner Preferences' : 'Review Preferences'}
      </h2>
      <p class="subtitle">
        {step === 'questions'
          ? 'Tell us what you\'re looking for in a partner'
          : 'Make sure everything looks right'}
      </p>
    </div>
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

          {#if q.type === 'multiple-choice'}
            <div class="options-grid" class:chips={q.options && q.options.length > 6}>
              {#each q.options ?? [] as opt (opt.value)}
                <button
                  class="option-button"
                  class:selected={responses[q.id] === opt.value}
                  onclick={() => handleSelect(opt.value)}
                  disabled={loading}
                  aria-pressed={responses[q.id] === opt.value}
                >
                  <span class="option-label">{opt.label}</span>
                  {#if responses[q.id] === opt.value}
                    <span class="checkmark">✓</span>
                  {/if}
                </button>
              {/each}
            </div>

          {:else if q.type === 'multi-select'}
            <div class="options-grid" class:chips={q.options && q.options.length > 6}>
              {#each q.options ?? [] as opt (opt.value)}
                {@const selected = ((responses[q.id] as string[]) ?? []).includes(opt.value)}
                <button
                  class="option-button"
                  class:selected
                  onclick={() => toggleMulti(opt.value)}
                  disabled={loading}
                  aria-pressed={selected}
                >
                  <span class="option-label">{opt.label}</span>
                  {#if selected}<span class="checkmark">✓</span>{/if}
                </button>
              {/each}
            </div>

          {:else if q.type === 'text'}
            <textarea
              class="text-input"
              placeholder={q.placeholder}
              value={(responses[q.id] as string) || ''}
              oninput={(e) => handleText(e.currentTarget.value)}
              disabled={loading}
              maxlength="500"
            ></textarea>
            <p class="char-count">{((responses[q.id] as string)?.length ?? 0)}/500</p>
          {/if}
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
  .forever-prefs-step {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    max-width: 600px;
    margin: 0 auto;
  }

  .header { display: flex; flex-direction: column; gap: 1rem; }
  .header-content { display: flex; flex-direction: column; gap: 0.5rem; }

  .title { font-size: 1.5rem; font-weight: 600; color: var(--text-1); margin: 0; }
  .subtitle { font-size: 0.95rem; color: var(--text-2); margin: 0; }

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

  .text-input {
    padding: 1rem;
    border: 2px solid var(--border-1);
    border-radius: 8px;
    font-size: 0.95rem;
    font-family: inherit;
    color: var(--text-1);
    background-color: var(--bg-3);
    resize: vertical;
    min-height: 120px;
    transition: border-color 0.2s ease;
  }

  .text-input:focus {
    outline: none;
    border-color: var(--accent-bright);
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15);
  }

  .text-input:disabled { opacity: 0.6; cursor: not-allowed; }

  .char-count { font-size: 0.8rem; color: var(--text-3); margin: 0; text-align: right; }

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
  .button-primary:hover:not(:disabled) { opacity: 0.9; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3); }
  .button-primary:disabled { opacity: 0.5; cursor: not-allowed; }

  .button-secondary { background-color: var(--bg-2); color: var(--text-1); border: 1px solid var(--border-1); }
  .button-secondary:hover:not(:disabled) { background-color: var(--bg-3); border-color: var(--border-2); }
  .button-secondary:disabled { opacity: 0.6; cursor: not-allowed; }

  @media (max-width: 767px) {
    .forever-prefs-step { gap: 1rem; }
    .title { font-size: 1.25rem; }
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
