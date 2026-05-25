<script lang="ts">
  import { fade, slide, scale } from 'svelte/transition';

  interface Props {
    onSubmit?: (data: { responses: Record<string, string | string[]> }) => Promise<void>;
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
    type: 'multiple-choice' | 'multi-select';
    question: string;
    subtitle?: string;
    options: Array<{ value: string; label: string }>;
  }

  const questions: Question[] = [
    {
      id: 'connection_pace',
      type: 'multiple-choice',
      question: '✨ What kind of connection feels right to you right now?',
      options: [
        { value: 'slow_intentional', label: '🌱 Slow & intentional' },
        { value: 'emotionally_grounded', label: '🧘 Emotionally grounded' },
        { value: 'lighthearted_meaningful', label: '😊 Lighthearted but meaningful' },
        { value: 'open_to_seeing', label: '🌊 Open to seeing where things go' }
      ]
    },
    {
      id: 'emotional_values',
      type: 'multi-select',
      question: '❤️ What qualities matter most in a healthy relationship?',
      subtitle: 'Select all that apply',
      options: [
        { value: 'emotional_honesty', label: '💬 Emotional honesty' },
        { value: 'mutual_respect', label: '🤝 Mutual respect' },
        { value: 'consistent_effort', label: '⏳ Consistent effort' },
        { value: 'calm_communication', label: '🧘 Calm communication' },
        { value: 'emotional_maturity', label: '🧠 Emotional maturity' },
        { value: 'genuine_affection', label: '🫶 Genuine affection' },
        { value: 'patience_understanding', label: '😊 Patience & understanding' },
        { value: 'trust_safety', label: '🛡️ Trust & safety' },
        { value: 'independence', label: '🌍 Independence' },
        { value: 'shared_growth', label: '🌱 Shared growth' },
        { value: 'reliability', label: '🤝 Reliability' },
        { value: 'empathy', label: '❤️ Empathy' }
      ]
    },
    {
      id: 'relationship_energy',
      type: 'multi-select',
      question: '✨ What kind of energy are you drawn to in a partner?',
      subtitle: 'Select all that apply',
      options: [
        { value: 'emotionally_available', label: '❤️ Emotionally available' },
        { value: 'calm_grounded', label: '🧘 Calm & grounded' },
        { value: 'romantic', label: '🌹 Romantic' },
        { value: 'thoughtful', label: '💭 Thoughtful' },
        { value: 'confident', label: '✨ Confident' },
        { value: 'affectionate', label: '🫶 Affectionate' },
        { value: 'self_aware', label: '🪞 Self-aware' },
        { value: 'playful', label: '😄 Playful' },
        { value: 'supportive', label: '🤝 Supportive' },
        { value: 'gentle_energy', label: '🕊️ Gentle energy' },
        { value: 'good_communicator', label: '💬 Good communicator' },
        { value: 'passionate', label: '🔥 Passionate' }
      ]
    },
    {
      id: 'healing_vibe',
      type: 'multi-select',
      question: '🌙 How would you describe yourself in relationships now?',
      subtitle: 'Select all that apply',
      options: [
        { value: 'more_self_aware', label: '🪞 More self-aware' },
        { value: 'emotionally_open', label: '❤️ Emotionally open' },
        { value: 'thoughtful_with_energy', label: '💭 Thoughtful with my energy' },
        { value: 'independent_affectionate', label: '🌍 Independent but affectionate' },
        { value: 'protective_of_peace', label: '🛡️ Protective of my peace' },
        { value: 'slow_to_trust', label: '🌱 Slow to trust, but genuine' },
        { value: 'romantic_at_heart', label: '🌹 Romantic at heart' },
        { value: 'more_intentional', label: '✨ More intentional now' },
        { value: 'comfortable_communicating', label: '💬 Comfortable communicating needs' },
        { value: 'healing_but_hopeful', label: '🌤️ Healing but hopeful' }
      ]
    },
    {
      id: 'chemistry_style',
      type: 'multi-select',
      question: '🔥 What kind of chemistry feels best to you?',
      subtitle: 'Select all that apply',
      options: [
        { value: 'emotional_connection_first', label: '❤️ Emotional connection first' },
        { value: 'slow_burn', label: '🌱 Slow-burn attraction' },
        { value: 'flirty_banter', label: '😏 Flirty banter' },
        { value: 'affection_touch', label: '🫶 Affection & touch' },
        { value: 'romantic_intimacy', label: '🌹 Romantic intimacy' },
        { value: 'passionate_chemistry', label: '🔥 Passionate chemistry' },
        { value: 'emotional_safety', label: '🛡️ Emotional safety' },
        { value: 'deep_conversations', label: '💬 Deep conversations' },
        { value: 'physical_attraction', label: '✨ Physical attraction matters' },
        { value: 'playful_connection', label: '😄 Playful connection' }
      ]
    },
    {
      id: 'meaningful_experiences',
      type: 'multi-select',
      question: '✨ What kinds of moments make a relationship meaningful to you?',
      subtitle: 'Select all that apply',
      options: [
        { value: 'deep_conversations', label: '💬 Deep conversations' },
        { value: 'quiet_quality_time', label: '🕯️ Quiet quality time' },
        { value: 'shared_travel', label: '✈️ Shared travel experiences' },
        { value: 'emotionally_understood', label: '🫶 Feeling emotionally understood' },
        { value: 'romantic_gestures', label: '🌹 Romantic gestures' },
        { value: 'physical_affection', label: '🤗 Physical affection' },
        { value: 'laughing_together', label: '😂 Laughing together' },
        { value: 'new_experiences', label: '🌍 Trying new experiences together' },
        { value: 'consistent_communication', label: '💬 Consistent communication' },
        { value: 'relaxed_date_nights', label: '🌙 Relaxed date nights' },
        { value: 'shared_routines', label: '☕ Shared routines' },
        { value: 'emotional_support', label: '❤️ Emotional support during hard times' }
      ]
    },
    {
      id: 'intimacy_preferences',
      type: 'multi-select',
      question: '💋 What kind of intimacy and connection are you open to?',
      subtitle: 'Select all that apply',
      options: [
        { value: 'pda_affection', label: '🤗 PDA & affection' },
        { value: 'sensual_connection', label: '🌹 Sensual connection' },
        { value: 'emotional_intimacy', label: '❤️ Emotional intimacy' },
        { value: 'passionate_chemistry', label: '🔥 Passionate chemistry' },
        { value: 'exploring_naturally', label: '🌱 Exploring chemistry naturally' },
        { value: 'playful_flirtation', label: '😏 Playful flirtation' },
        { value: 'open_minded', label: '✨ Open-minded connection' },
        { value: 'physical_touch_matters', label: '🫶 Physical touch matters' },
        { value: 'slow_emotional_intimacy', label: '🕯️ Slow emotional intimacy' },
        { value: 'prefer_discretion', label: '🔒 Prefer discretion' }
      ]
    },
    {
      id: 'emotional_boundaries',
      type: 'multi-select',
      question: '🛡️ What boundaries or relationship standards matter most to you?',
      subtitle: 'Select all that apply',
      options: [
        { value: 'honest_communication', label: '💬 Honest communication' },
        { value: 'emotional_maturity', label: '🧠 Emotional maturity' },
        { value: 'mutual_respect', label: '🤝 Mutual respect' },
        { value: 'clear_intentions', label: '✨ Clear intentions' },
        { value: 'consistency_matters', label: '⏳ Consistency matters' },
        { value: 'no_manipulation', label: '🚫 No manipulation or games' },
        { value: 'emotional_safety_first', label: '🛡️ Emotional safety first' },
        { value: 'respect_for_boundaries', label: '🌿 Respect for boundaries' },
        { value: 'drama_free', label: '☮️ Drama-free connection' },
        { value: 'accountability', label: '🪞 Accountability matters' },
        { value: 'privacy_discretion', label: '🔒 Privacy & discretion' },
        { value: 'kindness_during_conflict', label: '❤️ Kindness during conflict' }
      ]
    }
  ];

  const totalQuestions = questions.length;

  function current(): Question {
    return questions[currentIndex];
  }

  function isAnswered(q: Question): boolean {
    const r = responses[q.id];
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

  function handleNext() {
    error = null;
    if (!isAnswered(current())) {
      error = 'Please make a selection before continuing';
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
      await onSubmit({ responses });
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
    if (q.type === 'multi-select') {
      const vals = responses[q.id] as string[];
      if (!vals?.length) return 'None selected';
      return vals.map(v => q.options.find(o => o.value === v)?.label ?? v).join(', ');
    }
    return q.options.find(o => o.value === responses[q.id])?.label ?? String(responses[q.id]);
  }
</script>

<div class="rebound-healing-step">
  <div class="header" transition:fade={{ duration: 200 }}>
    <div class="header-content">
      <h2 class="title">
        {step === 'questions' ? 'Connection Style' : 'Review Your Answers'}
      </h2>
      <p class="subtitle">
        {step === 'questions'
          ? 'Help us understand how you connect'
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

          <div class="options-grid" class:chips={q.options && q.options.length > 6}>
            {#each q.options as opt (opt.value)}
              {@const sel = q.type === 'multi-select'
                ? ((responses[q.id] as string[]) ?? []).includes(opt.value)
                : responses[q.id] === opt.value}
              <button
                class="option-button"
                class:selected={sel}
                onclick={() => q.type === 'multi-select' ? toggleMulti(opt.value) : handleSelect(opt.value)}
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
  .rebound-healing-step {
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
    .rebound-healing-step { gap: 1rem; }
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
