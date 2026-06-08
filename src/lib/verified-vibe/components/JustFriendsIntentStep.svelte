<script lang="ts">
  import { fade, slide, scale } from 'svelte/transition';

  interface Props {
    onSubmit?: (data: { intent: Record<string, string | string[]> }) => Promise<void>;
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
    type: 'multiple-choice' | 'text';
    question: string;
    options?: Array<{ value: string; label: string }>;
    placeholder?: string;
    optional?: boolean;
  }

  const questions: Question[] = [
    {
      id: 'friendship_goal',
      type: 'multiple-choice',
      question: '🌿 What are you hoping to find here?',
      options: [
        { value: 'genuine_conversations', label: '💬 Genuine conversations' },
        { value: 'meaningful_friendships', label: '🤝 Meaningful friendships' },
        { value: 'new_people_experiences', label: '🌍 New people and experiences' },
        { value: 'comfortable_company', label: '😊 Comfortable company without pressure' }
      ]
    },
    {
      id: 'social_energy',
      type: 'multiple-choice',
      question: '✨ What kind of social connection feels best to you?',
      options: [
        { value: 'deep_one_on_one', label: '💬 Deep one-on-one conversations' },
        { value: 'fun_playful', label: '😂 Fun and playful interactions' },
        { value: 'slow_natural', label: '🌱 Slow, natural friendships' },
        { value: 'shared_activities', label: '🌍 Shared activities and experiences' }
      ]
    },
    {
      id: 'pressure_preference',
      type: 'multiple-choice',
      question: '🫶 What matters most in a friendship here?',
      options: [
        { value: 'emotionally_safe', label: '😊 Feeling emotionally safe' },
        { value: 'easy_honest_comms', label: '💬 Easy and honest communication' },
        { value: 'mutual_respect', label: '🤝 Mutual respect and consistency' },
        { value: 'no_pressure', label: '🌿 No pressure or hidden agendas' }
      ]
    },
    {
      id: 'friendship_pace',
      type: 'multiple-choice',
      question: '⏳ How do you usually build friendships?',
      options: [
        { value: 'slowly_over_time', label: '🌱 Slowly over time' },
        { value: 'regular_conversations', label: '💬 Through regular conversations' },
        { value: 'naturally_by_vibe', label: '😊 Naturally if the vibe feels right' },
        { value: 'shared_interests', label: '🌍 Through shared interests and experiences' }
      ]
    },
    {
      id: 'connection_meaning',
      type: 'text',
      question: '✍️ What makes someone feel genuinely good to be around?',
      placeholder: 'Describe what makes someone easy and enjoyable to spend time with…'
    }
  ];

  const totalQuestions = questions.length;

  function current(): Question {
    return questions[currentIndex];
  }

  function isAnswered(q: Question): boolean {
    const r = responses[q.id];
    if (q.optional) return true;
    return r !== undefined && r !== '' && r !== null;
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
      await onSubmit({ intent: responses });
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
    if (q.type === 'multiple-choice') {
      return q.options?.find(o => o.value === responses[q.id])?.label ?? String(responses[q.id]);
    }
    return String(responses[q.id]);
  }
</script>

<div class="just-friends-intent-step">
  <div class="header" transition:fade={{ duration: 200 }}>
    <div class="header-content">
      <h2 class="title">
        {step === 'questions' ? 'Social Intent' : 'Review Your Answers'}
      </h2>
      <p class="subtitle">
        {step === 'questions'
          ? 'Tell us what kind of connection you\'re looking for'
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

          {#if q.type === 'multiple-choice'}
            <div class="options-grid">
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
  .just-friends-intent-step {
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

  .options-grid { display: grid; grid-template-columns: 1fr; gap: 0.5rem; }

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
    box-shadow: 0 0 0 3px rgba(255, 59, 107, 0.15);
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
  .button-primary:hover:not(:disabled) { opacity: 0.9; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(255, 59, 107, 0.3); }
  .button-primary:disabled { opacity: 0.5; cursor: not-allowed; }

  .button-secondary { background-color: var(--bg-2); color: var(--text-1); border: 1px solid var(--border-1); }
  .button-secondary:hover:not(:disabled) { background-color: var(--bg-3); border-color: var(--border-2); }
  .button-secondary:disabled { opacity: 0.6; cursor: not-allowed; }

  @media (max-width: 767px) {
    .just-friends-intent-step { gap: 1rem; }
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
