<script lang="ts">
  import { fade, slide, scale } from 'svelte/transition';
  import type { Gender } from '../types';

  interface Props {
    gender?: Gender;
    archetype?: string;
    onSubmit?: (data: { responses: Record<string, string | string[]> }) => Promise<void>;
    onCancel?: () => void;
  }

  let { gender = 'prefer_not_to_say', archetype, onSubmit, onCancel }: Props = $props();

  // State management
  let currentQuestionIndex = $state(0);
  let responses = $state<Record<string, string | string[]>>({});
  let loading = $state(false);
  let error = $state<string | null>(null);
  let step = $state<'questions' | 'review' | 'submitting'>('questions');

  interface Question {
    id: string;
    type: 'multiple-choice' | 'text';
    question: string;
    options?: Array<{ value: string; label: string }>;
    placeholder?: string;
  }

  const TIMELINE_OPTIONS = [
    { value: 'asap', label: "ASAP — I'm ready now" },
    { value: 'months', label: 'Within the next few months' },
    { value: 'year', label: 'Within the next year or two' },
    { value: 'no_rush', label: 'No rush, whenever it happens' }
  ];

  const MATRIMONY_QUESTIONS: Question[] = [
    {
      id: 'wedding_vision',
      type: 'multiple-choice',
      question: 'What kind of wedding are you envisioning?',
      options: [
        { value: 'intimate', label: 'Intimate — close family & friends' },
        { value: 'traditional', label: 'Traditional — full ceremony & rituals' },
        { value: 'big', label: 'Grand — large, celebratory event' },
        { value: 'destination', label: 'Destination — something unique' }
      ]
    },
    {
      id: 'family_involvement',
      type: 'multiple-choice',
      question: 'How involved would your family be in choosing a partner?',
      options: [
        { value: 'fully_involved', label: 'Fully — family leads the search' },
        { value: 'guided', label: 'Guided — family approves the choice' },
        { value: 'informed', label: 'Informed — I decide, family knows' },
        { value: 'independent', label: 'Independent — my choice, my way' }
      ]
    },
    {
      id: 'lifestyle_values',
      type: 'text',
      question: 'What lifestyle values matter most to you? (e.g., faith, culture, traditions)',
      placeholder: 'Share what matters to you...'
    },
    {
      id: 'relationship_timeline',
      type: 'multiple-choice',
      question: "What's your ideal relationship timeline?",
      options: TIMELINE_OPTIONS
    },
    {
      id: 'deal_breakers',
      type: 'text',
      question: "What are your deal-breakers in a partner?",
      placeholder: "Be honest about what won't work for you..."
    }
  ];

  // Archetype-specific question sets (take priority over gender)
  const archetypeQuestionSets: Record<string, Question[]> = {
    traditional_matrimony_man: MATRIMONY_QUESTIONS,
    traditional_matrimony_woman: MATRIMONY_QUESTIONS
  };

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

  // Gender-specific questions (fallback when no archetype-specific set exists)
  const questionSets: Record<Gender, Question[]> = {
    man: [
      {
        id: 'spending_comfort',
        type: 'multiple-choice',
        question: "What's your comfort level with spending on dates?",
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
        question: "What's your primary dating intent?",
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
        question: "What's your ideal relationship timeline?",
        options: TIMELINE_OPTIONS
      },
      {
        id: 'deal_breakers',
        type: 'text',
        question: "What are your deal-breakers in a partner?",
        placeholder: "Be honest about what won't work for you..."
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
        question: "What's your primary dating intent?",
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
        question: "What are your red flags in a partner?",
        placeholder: "Be honest about what won't work for you..."
      }
    ],
    prefer_not_to_say: [
      {
        id: 'dating_intent',
        type: 'multiple-choice',
        question: "What's your primary dating intent?",
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
        question: "What's your comfort level with spending on dates?",
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
        question: "What are your deal-breakers in a partner?",
        placeholder: "Be honest about what won't work for you..."
      }
    ]
  };

  const questions = $derived(archetypeQuestionSets[archetype ?? ''] ?? questionSets[gender]);

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

</div>

<style>
  .spending-qa-step {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    max-width: 600px;
    margin: 0 auto;
  }

  .header {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .header-content {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .title {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-1);
    margin: 0;
  }

  .subtitle {
    font-size: 0.95rem;
    color: var(--text-2);
    margin: 0;
  }

  .progress-container {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

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

  .progress-label {
    font-size: 0.85rem;
    color: var(--text-3);
    margin: 0;
  }

  .error-message {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem;
    background-color: rgba(239, 68, 68, 0.1);
    border-left: 4px solid #ef4444;
    border-radius: 8px;
  }

  .error-icon {
    font-size: 1.25rem;
    flex-shrink: 0;
  }

  .error-text {
    color: #ef4444;
    font-size: 0.95rem;
  }

  .questions-container {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .question-card {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.5rem;
    background-color: var(--bg-2);
    border: 1px solid var(--border-1);
    border-radius: 12px;
  }

  .question-text {
    font-size: 1.1rem;
    font-weight: 500;
    color: var(--text-1);
    margin: 0;
  }

  .options-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }

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

  .option-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .option-label {
    text-align: left;
  }

  .checkmark {
    color: var(--accent-bright);
    font-weight: bold;
  }

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

  .text-input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .char-count {
    font-size: 0.8rem;
    color: var(--text-3);
    margin: 0;
    text-align: right;
  }

  .review-container {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .review-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

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

  .review-question {
    font-size: 0.95rem;
    font-weight: 500;
    color: var(--text-1);
    margin: 0;
    flex: 1;
  }

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

  .edit-button:hover:not(:disabled) {
    background-color: var(--accent-bright);
    color: var(--bg-1);
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
    color: var(--text-2);
    margin: 0;
    line-height: 1.5;
  }

  .button-group {
    display: flex;
    gap: 1rem;
    justify-content: space-between;
  }

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
  }

  .button-primary {
    background-color: var(--accent-bright);
    color: var(--bg-1);
  }

  .button-primary:hover:not(:disabled) {
    opacity: 0.9;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
  }

  .button-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .button-secondary {
    background-color: var(--bg-2);
    color: var(--text-1);
    border: 1px solid var(--border-1);
  }

  .button-secondary:hover:not(:disabled) {
    background-color: var(--bg-3);
    border-color: var(--border-2);
  }

  .button-secondary:disabled {
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
  @media (max-width: 767px) {
    .spending-qa-step {
      gap: 1rem;
    }

    .title {
      font-size: 1.25rem;
    }

    .question-card {
      padding: 1rem;
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

  @media (prefers-reduced-motion: reduce) {
    .progress-fill,
    .option-button,
    .text-input,
    .button {
      transition: none;
    }
  }
</style>
