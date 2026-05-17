<script lang="ts">
  import { goto } from '$app/navigation';
  import { setPhase, setError } from '$lib/verified-vibe/stores';
  import { fade, slide } from 'svelte/transition';

  let currentStep = $state(1);
  const totalSteps = 4;
  let loading = $state(false);

  const steps = [
    {
      number: 1,
      name: 'ID Verification',
      description: 'Upload your government ID',
      icon: '🆔'
    },
    {
      number: 2,
      name: 'Liveness Check',
      description: 'Take a selfie to verify it\'s you',
      icon: '📸'
    },
    {
      number: 3,
      name: 'Photo Story',
      description: 'Upload 5+ photos of yourself',
      icon: '🖼️'
    },
    {
      number: 4,
      name: 'Spending/Q&A',
      description: 'Complete spending or Q&A verification',
      icon: '💰'
    }
  ];

  function handleNext() {
    if (currentStep < totalSteps) {
      currentStep++;
    } else {
      // Verification complete
      setPhase('app');
      goto('/verified-vibe/discover');
    }
  }

  function handleBack() {
    if (currentStep > 1) {
      currentStep--;
    } else {
      goto('/verified-vibe/verify');
    }
  }

  function handleSkip() {
    handleNext();
  }
</script>

<div class="verification-screen">
  <!-- Header -->
  <div class="verification-header" transition:slide={{ duration: 400, delay: 0, axis: 'y' }}>
    <button class="back-btn" onclick={handleBack}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
    </button>
    <div class="header-title">Verification</div>
    <div class="header-spacer"></div>
  </div>

  <!-- Progress bar -->
  <div class="progress-container" transition:slide={{ duration: 400, delay: 50, axis: 'y' }}>
    <div class="progress-bar">
      <div class="progress-fill" style="width: {(currentStep / totalSteps) * 100}%"></div>
    </div>
    <div class="progress-text">Step {currentStep} of {totalSteps}</div>
  </div>

  <!-- Step content -->
  <div class="verification-content" key={currentStep}>
    <div class="step-header" transition:fade={{ duration: 300 }}>
      <div class="step-icon">{steps[currentStep - 1].icon}</div>
      <h2 class="step-title">{steps[currentStep - 1].name}</h2>
      <p class="step-description">{steps[currentStep - 1].description}</p>
    </div>

    <!-- Step-specific content -->
    <div class="step-body" transition:slide={{ duration: 300, axis: 'y' }}>
      {#if currentStep === 1}
        <div class="upload-area">
          <div class="upload-icon">📄</div>
          <p>Upload your government ID</p>
          <input type="file" accept="image/*" />
        </div>
      {:else if currentStep === 2}
        <div class="upload-area">
          <div class="upload-icon">📷</div>
          <p>Take a selfie</p>
          <input type="file" accept="image/*" capture="user" />
        </div>
      {:else if currentStep === 3}
        <div class="upload-area">
          <div class="upload-icon">🖼️</div>
          <p>Upload 5+ photos</p>
          <input type="file" accept="image/*" multiple />
        </div>
      {:else if currentStep === 4}
        <div class="qa-area">
          <div class="qa-question">
            <label>What are you looking for in a partner?</label>
            <textarea placeholder="Share your thoughts..."></textarea>
          </div>
          <div class="qa-question">
            <label>What's your ideal first date?</label>
            <textarea placeholder="Share your thoughts..."></textarea>
          </div>
        </div>
      {/if}
    </div>
  </div>

  <!-- Actions -->
  <div class="verification-actions" transition:slide={{ duration: 400, delay: 100, axis: 'y' }}>
    <button class="btn btn-secondary" onclick={handleSkip} disabled={loading}>
      Skip
    </button>
    <button class="btn btn-primary" onclick={handleNext} disabled={loading}>
      {currentStep === totalSteps ? 'Complete' : 'Next'}
    </button>
  </div>
</div>

<style>
  .verification-screen {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 0;
  }

  .verification-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-1);
  }

  .back-btn {
    width: 40px;
    height: 40px;
    border-radius: 8px;
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    display: grid;
    place-items: center;
    cursor: pointer;
    color: var(--text-1);
    transition: all 200ms ease;
  }

  .back-btn:hover {
    background: var(--bg-3);
    border-color: var(--border-2);
  }

  .header-title {
    font-size: 16px;
    font-weight: 600;
  }

  .header-spacer {
    width: 40px;
  }

  .progress-container {
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-1);
  }

  .progress-bar {
    width: 100%;
    height: 4px;
    background: var(--bg-3);
    border-radius: 2px;
    overflow: hidden;
    margin-bottom: 8px;
  }

  .progress-fill {
    height: 100%;
    background: var(--accent);
    transition: width 300ms ease;
  }

  .progress-text {
    font-size: 12px;
    color: var(--text-3);
    text-align: center;
  }

  .verification-content {
    flex: 1;
    overflow-y: auto;
    padding: 24px 20px;
  }

  .step-header {
    text-align: center;
    margin-bottom: 32px;
  }

  .step-icon {
    font-size: 48px;
    margin-bottom: 16px;
  }

  .step-title {
    font-size: 24px;
    font-weight: 600;
    margin: 0 0 8px;
  }

  .step-description {
    font-size: 14px;
    color: var(--text-2);
    margin: 0;
  }

  .step-body {
    margin-bottom: 24px;
  }

  .upload-area {
    border: 2px dashed var(--border-2);
    border-radius: var(--r-lg);
    padding: 32px 20px;
    text-align: center;
    cursor: pointer;
    transition: all 200ms ease;
  }

  .upload-area:hover {
    border-color: var(--accent);
    background: var(--accent-tint);
  }

  .upload-icon {
    font-size: 48px;
    margin-bottom: 12px;
  }

  .upload-area p {
    font-size: 14px;
    color: var(--text-2);
    margin: 0 0 16px;
  }

  .upload-area input {
    display: none;
  }

  .qa-area {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .qa-question {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .qa-question label {
    font-size: 14px;
    font-weight: 600;
  }

  .qa-question textarea {
    padding: 12px;
    border: 1px solid var(--border-1);
    border-radius: var(--r-lg);
    background: var(--bg-2);
    color: var(--text-1);
    font-family: inherit;
    font-size: 14px;
    resize: vertical;
    min-height: 80px;
  }

  .verification-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    padding: 16px 20px calc(16px + env(safe-area-inset-bottom, 0));
    border-top: 1px solid var(--border-1);
  }

  @media (max-width: 767px) {
    .verification-screen {
      display: flex;
      flex-direction: column;
      height: 100%;
      padding: 0;
    }

    .verification-header {
      padding: 12px 16px;
      gap: 8px;
    }

    .back-btn {
      width: 40px;
      height: 40px;
      min-width: 40px;
      min-height: 40px;
      border-radius: 8px;
    }

    .header-title {
      font-size: 15px;
      font-weight: 600;
    }

    .header-spacer {
      width: 40px;
    }

    .progress-container {
      padding: 12px 16px;
    }

    .progress-bar {
      height: 3px;
      margin-bottom: 6px;
    }

    .progress-text {
      font-size: 11px;
    }

    .verification-content {
      flex: 1;
      overflow-y: auto;
      padding: 18px 16px;
    }

    .step-header {
      margin-bottom: 24px;
    }

    .step-icon {
      font-size: 40px;
      margin-bottom: 12px;
    }

    .step-title {
      font-size: 20px;
      font-weight: 600;
      margin: 0 0 6px;
    }

    .step-description {
      font-size: 13px;
      margin: 0;
    }

    .step-body {
      margin-bottom: 16px;
    }

    .upload-area {
      border: 2px dashed var(--border-2);
      border-radius: var(--r-lg);
      padding: 24px 16px;
      text-align: center;
      cursor: pointer;
    }

    .upload-icon {
      font-size: 40px;
      margin-bottom: 10px;
    }

    .upload-area p {
      font-size: 13px;
      margin: 0 0 12px;
    }

    .qa-area {
      gap: 12px;
    }

    .qa-question {
      gap: 6px;
    }

    .qa-question label {
      font-size: 13px;
    }

    .qa-question textarea {
      padding: 10px;
      font-size: 13px;
      min-height: 70px;
      border-radius: var(--r-lg);
    }

    .verification-actions {
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0));
    }

    .btn {
      min-height: 44px;
      padding: 12px 16px;
      font-size: 14px;
      border-radius: var(--r-lg);
    }
  }
</style>
