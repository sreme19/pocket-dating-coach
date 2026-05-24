<script lang="ts">
  import { fade, slide, scale } from 'svelte/transition';
  import type { Gender } from '../types';

  interface Props {
    gender?: Gender;
    onSubmit?: (data: { responses: Record<string, string | string[]> }) => Promise<void>;
    onCancel?: () => void;
  }

  let { gender = 'prefer_not_to_say', onSubmit, onCancel }: Props = $props();

  // State management
  let currentQuestionIndex = $state(0);
  let responses = $state<Record<string, string | string[]>>({});
  let loading = $state(false);
  let error = $state<string | null>(null);
  let step = $state<'questions' | 'review' | 'submitting'>('questions');

  // Voice input
  let listening = $state(false);
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
          const q = getCurrentQuestion();
          const current = (responses[q.id] as string) || '';
          handleTextInput(current ? current.trimEnd() + ' ' + transcript : transcript);
          listening = false;
        };
        recognition.onerror = () => { listening = false; };
        recognition.onend = () => { listening = false; };
      }
    }
  });

  function toggleVoice() {
    if (!recognition) return;
    if (listening) {
      recognition.stop();
      listening = false;
    } else {
      recognition.start();
      listening = true;
    }
  }

  // Gender-specific questions
  const questionSets: Record<Gender, Question[]> = {
    man: [
      {
        id: 'spending_comfort',
        type: 'multiple-choice',
        question: 'What\'s your comfort level with spending on dates?',
        options: [
          { value: 'budget', label: 'Budget-conscious (₹1,000–3,000)' },
          { value: 'moderate', label: 'Moderate spender (₹3,000–8,000)' },
          { value: 'generous', label: 'Generous spender (₹8,000–20,000)' },
          { value: 'luxury', label: 'Luxury spender (₹20,000+)' }
        ]
      },
      {
        id: 'dating_intent',
        type: 'multiple-choice',
        question: 'What\'s your primary dating intent?',
        options: [
          { value: 'casual', label: 'Casual dating' },
          { value: 'relationship', label: 'Serious relationship' },
          { value: 'marriage', label: 'Marriage-minded' },
          { value: 'exploring', label: 'Still exploring' }
        ]
      },
      {
        id: 'lifestyle_values',
        type: 'text',
        question: 'What lifestyle values matter most to you? (e.g., travel, fitness, culture)',
        placeholder: 'Share what matters to you...'
      },
      {
        id: 'relationship_timeline',
        type: 'multiple-choice',
        question: 'What\'s your ideal relationship timeline?',
        options: [
          { value: 'no_rush', label: 'No rush, let it develop naturally' },
          { value: 'months', label: 'Months to a year' },
          { value: 'year', label: 'Within a year' },
          { value: 'asap', label: 'ASAP' }
        ]
      },
      {
        id: 'deal_breakers',
        type: 'text',
        question: 'What are your deal-breakers in a partner?',
        placeholder: 'Be honest about what won\'t work for you...'
      }
    ],
    woman: [
      {
        id: 'date_expectations',
        type: 'multiple-choice',
        question: 'What do you expect from a date?',
        options: [
          { value: 'casual', label: 'Casual hangout' },
          { value: 'thoughtful', label: 'Thoughtful & planned' },
          { value: 'upscale', label: 'Upscale experience' },
          { value: 'luxury', label: 'Luxury treatment' }
        ]
      },
      {
        id: 'partner_qualities',
        type: 'text',
        question: 'What qualities matter most in a partner?',
        placeholder: 'Describe your ideal partner...'
      },
      {
        id: 'dating_intent',
        type: 'multiple-choice',
        question: 'What\'s your primary dating intent?',
        options: [
          { value: 'casual', label: 'Casual dating' },
          { value: 'relationship', label: 'Serious relationship' },
          { value: 'marriage', label: 'Marriage-minded' },
          { value: 'exploring', label: 'Still exploring' }
        ]
      },
      {
        id: 'lifestyle_values',
        type: 'text',
        question: 'What lifestyle values matter most to you? (e.g., travel, fitness, culture)',
        placeholder: 'Share what matters to you...'
      },
      {
        id: 'red_flags',
        type: 'text',
        question: 'What are your red flags in a partner?',
        placeholder: 'Be honest about what won\'t work for you...'
      }
    ],
    prefer_not_to_say: [
      {
        id: 'dating_intent',
        type: 'multiple-choice',
        question: 'What\'s your primary dating intent?',
        options: [
          { value: 'casual', label: 'Casual dating' },
          { value: 'relationship', label: 'Serious relationship' },
          { value: 'marriage', label: 'Marriage-minded' },
          { value: 'exploring', label: 'Still exploring' }
        ]
      },
      {
        id: 'lifestyle_values',
        type: 'text',
        question: 'What lifestyle values matter most to you?',
        placeholder: 'Share what matters to you...'
      },
      {
        id: 'partner_qualities',
        type: 'text',
        question: 'What qualities matter most in a partner?',
        placeholder: 'Describe your ideal partner...'
      },
      {
        id: 'spending_comfort',
        type: 'multiple-choice',
        question: 'What\'s your comfort level with spending on dates?',
        options: [
          { value: 'budget', label: 'Budget-conscious' },
          { value: 'moderate', label: 'Moderate spender' },
          { value: 'generous', label: 'Generous spender' },
          { value: 'luxury', label: 'Luxury spender' }
        ]
      },
      {
        id: 'deal_breakers',
        type: 'text',
        question: 'What are your deal-breakers in a partner?',
        placeholder: 'Be honest about what won\'t work for you...'
      }
    ]
  };

  interface Question {
    id: string;
    type: 'multiple-choice' | 'text';
    question: string;
    options?: Array<{ value: string; label: string }>;
    placeholder?: string;
  }

  const questions = $derived(questionSets[gender]);

  function getCurrentQuestion(): Question {
    return questions[currentQuestionIndex];
  }

  function handleOptionSelect(value: string) {
    const question = getCurrentQuestion();
    responses[question.id] = value;
    responses = { ...responses }; // Trigger reactivity
  }

  function handleTextInput(value: string) {
    const question = getCurrentQuestion();
    responses[question.id] = value;
    responses = { ...responses }; // Trigger reactivity
  }

  function isCurrentQuestionAnswered(): boolean {
    const question = getCurrentQuestion();
    const response = responses[question.id];
    return response !== undefined && response !== '' && response !== null;
  }

  function handleNext() {
    error = null;

    if (!isCurrentQuestionAnswered()) {
      error = 'Please answer this question before continuing';
      return;
    }

    if (currentQuestionIndex < questions.length - 1) {
      currentQuestionIndex++;
    } else {
      step = 'review';
    }
  }

  function handleBack() {
    error = null;

    if (currentQuestionIndex > 0) {
      currentQuestionIndex--;
    } else if (step === 'review') {
      step = 'questions';
      currentQuestionIndex = questions.length - 1;
    }
  }

  function handleEditQuestion(index: number) {
    currentQuestionIndex = index;
    step = 'questions';
  }

  async function handleSubmit() {
    error = null;

    // Validate all questions are answered
    const allAnswered = questions.every((q) => {
      const response = responses[q.id];
      return response !== undefined && response !== '' && response !== null;
    });

    if (!allAnswered) {
      error = 'Please answer all questions before submitting';
      return;
    }

    if (!onSubmit) return;

    loading = true;
    step = 'submitting';

    try {
      await onSubmit({ responses });
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to submit responses';
      step = 'review';
    } finally {
      loading = false;
    }
  }

  function getProgressPercentage(): number {
    if (step === 'review') return 100;
    return ((currentQuestionIndex + 1) / questions.length) * 100;
  }

  function getProgressLabel(): string {
    if (step === 'review') return `${questions.length} of ${questions.length}`;
    return `${currentQuestionIndex + 1} of ${questions.length}`;
  }
</script>

<div class="spending-qa-step">
  <!-- Header -->
  <div class="header" transition:fade={{ duration: 200 }}>
    <div class="header-content">
      <h2 class="title">
        {#if step === 'questions'}
          Spending & Values
        {:else if step === 'review'}
          Review Your Answers
        {:else}
          Submitting...
        {/if}
      </h2>
      <p class="subtitle">
        {#if step === 'questions'}
          Help matches understand your values and intent
        {:else if step === 'review'}
          Make sure everything looks good
        {:else}
          Processing your responses...
        {/if}
      </p>
    </div>

    <!-- Progress Bar -->
    <div class="progress-container">
      <div class="progress-bar">
        <div class="progress-fill" style="width: {getProgressPercentage()}%"></div>
      </div>
      <p class="progress-label">{getProgressLabel()}</p>
    </div>
  </div>

  <!-- Error Message -->
  {#if error}
    <div class="error-message" role="alert" transition:slide={{ duration: 200 }}>
      <span class="error-icon">⚠️</span>
      <span class="error-text">{error}</span>
    </div>
  {/if}

  <!-- Questions View -->
  {#if step === 'questions'}
    <div class="questions-container" transition:fade={{ duration: 200 }}>
      {#each [getCurrentQuestion()] as question (question.id)}
        <div class="question-card" transition:scale={{ duration: 200 }}>
          <h3 class="question-text">{question.question}</h3>

          {#if question.type === 'multiple-choice'}
            <div class="options-grid">
              {#each question.options || [] as option (option.value)}
                <button
                  class="option-button"
                  class:selected={responses[question.id] === option.value}
                  onclick={() => handleOptionSelect(option.value)}
                  aria-pressed={responses[question.id] === option.value}
                  disabled={loading}
                >
                  <span class="option-label">{option.label}</span>
                  {#if responses[question.id] === option.value}
                    <span class="checkmark">✓</span>
                  {/if}
                </button>
              {/each}
            </div>
          {:else if question.type === 'text'}
            <div class="textarea-wrap">
              <textarea
                class="text-input"
                placeholder={question.placeholder}
                value={responses[question.id] || ''}
                oninput={(e) => handleTextInput(e.currentTarget.value)}
                disabled={loading}
                aria-label={question.question}
                maxlength="500"
              ></textarea>
              {#if voiceSupported}
                <button
                  type="button"
                  class="mic-btn {listening ? 'listening' : ''}"
                  onclick={toggleVoice}
                  aria-label={listening ? 'Stop recording' : 'Speak your answer'}
                  title={listening ? 'Tap to stop' : 'Tap to speak'}
                >
                  {#if listening}
                    <span class="mic-ring"></span>
                  {/if}
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" y1="19" x2="12" y2="23"/>
                    <line x1="8" y1="23" x2="16" y2="23"/>
                  </svg>
                </button>
                {#if listening}
                  <p class="voice-hint">Listening… speak now</p>
                {/if}
              {/if}
            </div>
            <p class="char-count">
              {(responses[question.id] as string)?.length || 0}/500
            </p>
          {/if}
        </div>
      {/each}
    </div>

    <!-- Navigation Buttons -->
    <div class="button-group">
      <button
        class="button button-secondary"
        onclick={handleBack}
        disabled={loading || currentQuestionIndex === 0}
        aria-label="Go to previous question"
      >
        ← Back
      </button>

      <button
        class="button button-primary"
        onclick={handleNext}
        disabled={loading || !isCurrentQuestionAnswered()}
        aria-label="Go to next question"
      >
        {currentQuestionIndex === questions.length - 1 ? 'Review' : 'Next'} →
      </button>
    </div>
  {/if}

  <!-- Review View -->
  {#if step === 'review' || step === 'submitting'}
    <div class="review-container" transition:fade={{ duration: 200 }}>
      <div class="review-list">
        {#each questions as question, index (question.id)}
          <div class="review-item">
            <div class="review-header">
              <h4 class="review-question">{question.question}</h4>
              {#if step === 'questions' || (step !== 'submitting' && !loading)}
                <button
                  class="edit-button"
                  onclick={() => handleEditQuestion(index)}
                  disabled={loading}
                  aria-label="Edit answer to {question.question}"
                >
                  Edit
                </button>
              {/if}
            </div>
            <div class="review-answer">
              {#if question.type === 'multiple-choice'}
                <p class="answer-text">
                  {question.options?.find((o) => o.value === responses[question.id])?.label ||
                    'Not answered'}
                </p>
              {:else}
                <p class="answer-text">{responses[question.id] || 'Not answered'}</p>
              {/if}
            </div>
          </div>
        {/each}
      </div>

      <!-- Review Navigation -->
      <div class="button-group">
        <button
          class="button button-secondary"
          onclick={handleBack}
          disabled={loading}
          aria-label="Go back to questions"
        >
          ← Back
        </button>

        <button
          class="button button-primary"
          onclick={handleSubmit}
          disabled={loading}
          aria-label="Submit your responses"
        >
          {#if loading}
            Submitting...
          {:else}
            Submit Responses
          {/if}
        </button>
      </div>
    </div>
  {/if}

  <!-- Cancel Button -->
  {#if onCancel && step === 'questions'}
    <button
      class="button-cancel"
      onclick={onCancel}
      disabled={loading}
      aria-label="Cancel spending and Q&A verification"
    >
      Cancel
    </button>
  {/if}
</div>

<style>
  .spending-qa-step {
    display: flex;
    flex-direction: column;
    gap: var(--gap-lg, 1.5rem);
    padding: var(--spacing-lg, 1.5rem);
    max-width: 600px;
    margin: 0 auto;
  }

  .header {
    display: flex;
    flex-direction: column;
    gap: var(--gap-md, 1rem);
  }

  .header-content {
    display: flex;
    flex-direction: column;
    gap: var(--gap-sm, 0.5rem);
  }

  .title {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--color-vibe-text-1, #111827);
    margin: 0;
  }

  .subtitle {
    font-size: 0.95rem;
    color: var(--color-vibe-text-2, #374151);
    margin: 0;
  }

  .progress-container {
    display: flex;
    flex-direction: column;
    gap: var(--gap-xs, 0.25rem);
  }

  .progress-bar {
    width: 100%;
    height: 4px;
    background-color: var(--color-vibe-bg-2, #f3f4f6);
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background-color: var(--color-vibe-emerald, #10b981);
    transition: width 0.3s ease;
  }

  .progress-label {
    font-size: 0.85rem;
    color: var(--color-vibe-text-3, #6b7280);
    margin: 0;
  }

  .error-message {
    display: flex;
    align-items: center;
    gap: var(--gap-sm, 0.5rem);
    padding: var(--spacing-md, 1rem);
    background-color: #fee2e2;
    border-left: 4px solid #ef4444;
    border-radius: var(--radius-md, 0.5rem);
  }

  .error-icon {
    font-size: 1.25rem;
    flex-shrink: 0;
  }

  .error-text {
    color: #991b1b;
    font-size: 0.95rem;
  }

  .questions-container {
    display: flex;
    flex-direction: column;
    gap: var(--gap-lg, 1.5rem);
  }

  .question-card {
    display: flex;
    flex-direction: column;
    gap: var(--gap-md, 1rem);
    padding: var(--spacing-lg, 1.5rem);
    background-color: var(--color-vibe-bg-1, #ffffff);
    border: 1px solid var(--color-vibe-border, #e5e7eb);
    border-radius: var(--radius-lg, 0.75rem);
  }

  .question-text {
    font-size: 1.1rem;
    font-weight: 500;
    color: var(--color-vibe-text-1, #111827);
    margin: 0;
  }

  .options-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--gap-sm, 0.5rem);
  }

  .option-button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-md, 1rem);
    background-color: var(--color-vibe-bg-2, #f9fafb);
    border: 2px solid var(--color-vibe-border, #e5e7eb);
    border-radius: var(--radius-md, 0.5rem);
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 0.95rem;
    color: var(--color-vibe-text-1, #111827);
    font-weight: 500;
  }

  .option-button:hover:not(:disabled) {
    border-color: var(--color-vibe-emerald, #10b981);
    background-color: #f0fdf4;
  }

  .option-button.selected {
    border-color: var(--color-vibe-emerald, #10b981);
    background-color: #f0fdf4;
  }

  .option-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .option-label {
    text-align: left;
  }

  .checkmark {
    color: var(--color-vibe-emerald, #10b981);
    font-weight: bold;
  }

  .text-input {
    padding: var(--spacing-md, 1rem);
    border: 2px solid var(--color-vibe-border, #e5e7eb);
    border-radius: var(--radius-md, 0.5rem);
    font-size: 0.95rem;
    font-family: inherit;
    color: var(--color-vibe-text-1, #111827);
    resize: vertical;
    min-height: 120px;
    transition: border-color 0.2s ease;
  }

  .text-input:focus {
    outline: none;
    border-color: var(--color-vibe-emerald, #10b981);
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
  }

  .text-input:disabled {
    background-color: var(--color-vibe-bg-2, #f9fafb);
    cursor: not-allowed;
    opacity: 0.6;
  }

  .char-count {
    font-size: 0.8rem;
    color: var(--color-vibe-text-3, #6b7280);
    margin: 0;
    text-align: right;
  }

  .review-container {
    display: flex;
    flex-direction: column;
    gap: var(--gap-lg, 1.5rem);
  }

  .review-list {
    display: flex;
    flex-direction: column;
    gap: var(--gap-md, 1rem);
  }

  .review-item {
    padding: var(--spacing-md, 1rem);
    background-color: var(--color-vibe-bg-2, #f9fafb);
    border-radius: var(--radius-md, 0.5rem);
    border: 1px solid var(--color-vibe-border, #e5e7eb);
  }

  .review-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--gap-md, 1rem);
    margin-bottom: var(--spacing-sm, 0.5rem);
  }

  .review-question {
    font-size: 0.95rem;
    font-weight: 500;
    color: var(--color-vibe-text-1, #111827);
    margin: 0;
    flex: 1;
  }

  .edit-button {
    padding: 0.25rem 0.75rem;
    background-color: transparent;
    border: 1px solid var(--color-vibe-emerald, #10b981);
    border-radius: var(--radius-sm, 0.375rem);
    color: var(--color-vibe-emerald, #10b981);
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
  }

  .edit-button:hover:not(:disabled) {
    background-color: var(--color-vibe-emerald, #10b981);
    color: white;
  }

  .edit-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .review-answer {
    display: flex;
    flex-direction: column;
  }

  .answer-text {
    font-size: 0.95rem;
    color: var(--color-vibe-text-2, #374151);
    margin: 0;
    line-height: 1.5;
  }

  .button-group {
    display: flex;
    gap: var(--gap-md, 1rem);
    justify-content: space-between;
  }

  .button {
    flex: 1;
    padding: var(--spacing-md, 1rem);
    border: none;
    border-radius: var(--radius-md, 0.5rem);
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    min-height: 44px;
  }

  .button-primary {
    background-color: var(--color-vibe-emerald, #10b981);
    color: white;
  }

  .button-primary:hover:not(:disabled) {
    background-color: #059669;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
  }

  .button-primary:disabled {
    background-color: #d1d5db;
    cursor: not-allowed;
    opacity: 0.6;
  }

  .button-secondary {
    background-color: var(--color-vibe-bg-2, #f9fafb);
    color: var(--color-vibe-text-1, #111827);
    border: 1px solid var(--color-vibe-border, #e5e7eb);
  }

  .button-secondary:hover:not(:disabled) {
    background-color: var(--color-vibe-bg-3, #f3f4f6);
    border-color: var(--color-vibe-text-2, #374151);
  }

  .button-secondary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .button-cancel {
    padding: var(--spacing-md, 1rem);
    background-color: transparent;
    border: 1px solid var(--color-vibe-border, #e5e7eb);
    border-radius: var(--radius-md, 0.5rem);
    color: var(--color-vibe-text-2, #374151);
    font-size: 0.95rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    min-height: 44px;
  }

  .button-cancel:hover:not(:disabled) {
    background-color: var(--color-vibe-bg-2, #f9fafb);
    border-color: var(--color-vibe-text-2, #374151);
  }

  .button-cancel:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* ── Voice input ─────────────────────────────────────────────────────────── */

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
    border: 1px solid var(--border-2, #e5e7eb);
    background: var(--bg-1, #ffffff);
    color: var(--text-3, #6b7280);
    display: grid;
    place-items: center;
    cursor: pointer;
    transition: all 150ms ease;
    flex-shrink: 0;
  }

  .mic-btn:hover {
    border-color: var(--color-vibe-emerald, #10b981);
    color: var(--color-vibe-emerald, #10b981);
  }

  .mic-btn.listening {
    border-color: var(--color-vibe-emerald, #10b981);
    background: rgba(16, 185, 129, 0.08);
    color: var(--color-vibe-emerald, #10b981);
  }

  .mic-ring {
    position: absolute;
    inset: -4px;
    border-radius: 50%;
    border: 2px solid var(--color-vibe-emerald, #10b981);
    animation: mic-pulse 1.2s ease-in-out infinite;
    pointer-events: none;
  }

  @keyframes mic-pulse {
    0%, 100% { opacity: 0.8; transform: scale(1); }
    50%       { opacity: 0.2; transform: scale(1.25); }
  }

  .voice-hint {
    font-size: 11px;
    color: var(--color-vibe-emerald, #10b981);
    margin: 4px 0 0;
    font-style: italic;
  }

  /* Mobile Responsive */
  @media (max-width: 767px) {
    .spending-qa-step {
      padding: var(--spacing-md, 1rem);
      gap: var(--gap-md, 1rem);
    }

    .title {
      font-size: 1.25rem;
    }

    .question-card {
      padding: var(--spacing-md, 1rem);
    }

    .button-group {
      flex-direction: column;
    }

    .button {
      width: 100%;
    }

    .review-header {
      flex-direction: column;
      align-items: flex-start;
    }

    .edit-button {
      align-self: flex-start;
    }
  }

  /* Tablet Responsive */
  @media (min-width: 768px) and (max-width: 1023px) {
    .spending-qa-step {
      max-width: 100%;
    }
  }

  /* Accessibility */
  @media (prefers-reduced-motion: reduce) {
    .progress-fill,
    .option-button,
    .text-input,
    .button {
      transition: none;
    }
  }

  /* Dark mode support */
  @media (prefers-color-scheme: dark) {
    .spending-qa-step {
      background-color: var(--color-vibe-bg-1, #1f2937);
    }

    .title,
    .question-text,
    .review-question {
      color: var(--color-vibe-text-1, #f9fafb);
    }

    .subtitle,
    .error-text,
    .answer-text {
      color: var(--color-vibe-text-2, #d1d5db);
    }

    .question-card,
    .review-item {
      background-color: var(--color-vibe-bg-2, #111827);
      border-color: var(--color-vibe-border, #374151);
    }

    .option-button {
      background-color: var(--color-vibe-bg-3, #1f2937);
      color: var(--color-vibe-text-1, #f9fafb);
    }

    .option-button:hover:not(:disabled) {
      background-color: rgba(16, 185, 129, 0.1);
    }

    .text-input {
      background-color: var(--color-vibe-bg-3, #1f2937);
      color: var(--color-vibe-text-1, #f9fafb);
      border-color: var(--color-vibe-border, #374151);
    }

    .text-input:focus {
      box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
    }
  }
</style>
