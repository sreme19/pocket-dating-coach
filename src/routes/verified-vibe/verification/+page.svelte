<script lang="ts">
  import { goto } from '$app/navigation';
  import {
    verificationStep,
    verificationProgress,
    addVerificationRecord,
    setPhase,
    setError,
    clearError,
    user,
    userVerification,
    updateTrustScore,
    loading as globalLoading
  } from '$lib/verified-vibe/stores';
  import { calculateTrustScore } from '$lib/verified-vibe/utils';
  import { getSupabaseClient } from '$lib/client/supabase';
  import PhotoUploadStep from '$lib/verified-vibe/components/PhotoUploadStep.svelte';
  import SpendingQAStep from '$lib/verified-vibe/components/SpendingQAStep.svelte';
  import SpendingUploadStep from '$lib/verified-vibe/components/SpendingUploadStep.svelte';
  import IDExtractionStep from '$lib/verified-vibe/components/IDExtractionStep.svelte';
  import LivenessStep from '$lib/verified-vibe/components/LivenessStep.svelte';
  import type { VerificationStep as VerificationStepType, LivenessCheckResult } from '$lib/verified-vibe/types';
  import { fade, slide } from 'svelte/transition';
  import { onMount } from 'svelte';

  /** Returns auth headers with the current session token (if available). */
  async function getAuthHeaders(): Promise<Record<string, string>> {
    const { data: { session } } = await getSupabaseClient().auth.getSession();
    if (!session?.access_token) return { 'Content-Type': 'application/json' };
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`
    };
  }

  const totalSteps = 4;
  let currentStep = $state(1);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let completedSteps = $state<Set<number>>(new Set());
  let skippedSteps = $state<Set<number>>(new Set());
  let showSkipWarning = $state(false);
  let stepData = $state<Record<number, any>>({});
  let idPhotoBase64 = $state('');

  const steps = [
    {
      number: 1,
      name: 'Government ID',
      description: 'Upload a clear photo of your government ID',
      icon: '🆔',
      stepType: 'id' as VerificationStepType,
      time: '2 min'
    },
    {
      number: 2,
      name: 'Liveness Check',
      description: 'Take a selfie to prove it\'s really you',
      icon: '📸',
      stepType: 'liveness' as VerificationStepType,
      time: '1 min'
    },
    {
      number: 3,
      name: 'Photo Story',
      description: 'Upload 5+ photos that tell your story',
      icon: '🖼️',
      stepType: 'photos' as VerificationStepType,
      time: '3 min'
    },
    {
      number: 4,
      name: 'Spending/Q&A',
      description: 'Complete spending or Q&A verification',
      icon: '💰',
      stepType: 'spending_or_qa' as VerificationStepType,
      time: '4 min'
    }
  ];

  onMount(() => {
    // Initialize from store
    verificationStep.subscribe(step => {
      currentStep = step;
    });
    
    verificationProgress.subscribe(progress => {
      // Update completed steps based on progress
      const stepsCompleted = Math.floor((progress / 100) * totalSteps);
      for (let i = 1; i <= stepsCompleted; i++) {
        completedSteps.add(i);
      }
    });
  });

  async function handleIDSubmit(data: { idImage: string; mimeType: string }) {
    error = null;
    clearError();
    loading = true;
    // Store base64 ID photo for use in liveness step
    idPhotoBase64 = data.idImage;

    try {
      // Submit to API
      const response = await fetch('/api/verified-vibe/verify-step', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          step: 'id',
          data: {
            image: data.idImage,
            mimeType: data.mimeType
          }
        })
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'ID verification failed');
      }

      const result = await response.json();

      // Store verification record
      addVerificationRecord({
        id: `${$user?.id}-id`,
        userId: $user?.id || '',
        step: 'id',
        status: 'completed',
        data: result.data,
        completedAt: new Date(),
        createdAt: new Date()
      });

      // Mark step as completed
      completedSteps.add(currentStep);

      // Update progress
      const progress = (completedSteps.size / totalSteps) * 100;
      verificationProgress.set(progress);

      // Update trust score
      updateTrustScoreAfterVerification();

      // Move to next step
      if (currentStep < totalSteps) {
        currentStep++;
        verificationStep.set(currentStep);
      } else {
        // All steps complete
        setPhase('app');
        goto('/verified-vibe/discover');
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred';
      setError(error);
    } finally {
      loading = false;
    }
  }

  async function handleLivenessSubmit(data: LivenessCheckResult) {
    error = null;
    clearError();
    loading = true;

    try {
      // Store verification record (liveness check already completed in LivenessStep)
      addVerificationRecord({
        id: `${$user?.id}-liveness`,
        userId: $user?.id || '',
        step: 'liveness',
        status: 'completed',
        data,
        completedAt: new Date(),
        createdAt: new Date()
      });

      // Mark step as completed
      completedSteps.add(currentStep);

      // Update progress
      const progress = (completedSteps.size / totalSteps) * 100;
      verificationProgress.set(progress);

      // Update trust score
      updateTrustScoreAfterVerification();

      // Move to next step
      if (currentStep < totalSteps) {
        currentStep++;
        verificationStep.set(currentStep);
      } else {
        // All steps complete
        setPhase('app');
        goto('/verified-vibe/discover');
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred';
      setError(error);
    } finally {
      loading = false;
    }
  }

  async function handlePhotoSubmit(data: { photos: File[]; labels: Record<string, string> }) {
    error = null;
    clearError();
    loading = true;

    try {
      // Convert photos to base64
      const base64Images = await Promise.all(
        data.photos.map(file => {
          return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const result = reader.result as string;
              const base64 = result.split(',')[1];
              resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        })
      );

      // Submit to API
      const response = await fetch('/api/verified-vibe/verify-step', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          step: 'photos',
          data: {
            images: base64Images,
            mimeTypes: data.photos.map(f => f.type),
            labels: data.labels
          }
        })
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Photo verification failed');
      }

      const result = await response.json();

      // Store verification record
      addVerificationRecord({
        id: `${$user?.id}-photos`,
        userId: $user?.id || '',
        step: 'photos',
        status: 'completed',
        data: result.data,
        completedAt: new Date(),
        createdAt: new Date()
      });

      // Mark step as completed
      completedSteps.add(currentStep);

      // Update progress
      const progress = (completedSteps.size / totalSteps) * 100;
      verificationProgress.set(progress);

      // Update trust score
      updateTrustScoreAfterVerification();

      // Move to next step
      if (currentStep < totalSteps) {
        currentStep++;
        verificationStep.set(currentStep);
      } else {
        // All steps complete
        setPhase('app');
        goto('/verified-vibe/discover');
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred';
      setError(error);
    } finally {
      loading = false;
    }
  }

  async function handleSpendingSubmit(data: { spendingImage: string; mimeType: string }) {
    error = null;
    clearError();
    loading = true;

    try {
      // Submit to API
      const response = await fetch('/api/verified-vibe/verify-step', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          step: 'spending_or_qa',
          data: {
            spendingImage: data.spendingImage,
            mimeType: data.mimeType,
            gender: $user?.gender
          }
        })
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Spending verification failed');
      }

      const result = await response.json();

      // Store verification record
      addVerificationRecord({
        id: `${$user?.id}-spending_or_qa`,
        userId: $user?.id || '',
        step: 'spending_or_qa',
        status: 'completed',
        data: result.data,
        completedAt: new Date(),
        createdAt: new Date()
      });

      // Mark step as completed
      completedSteps.add(currentStep);

      // Update progress
      const progress = (completedSteps.size / totalSteps) * 100;
      verificationProgress.set(progress);

      // Update trust score
      updateTrustScoreAfterVerification();

      // Move to next step or complete
      if (currentStep < totalSteps) {
        currentStep++;
        verificationStep.set(currentStep);
      } else {
        // All steps complete
        setPhase('app');
        goto('/verified-vibe/discover');
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred';
      setError(error);
    } finally {
      loading = false;
    }
  }

  async function handleQASubmit(data: { responses: Record<string, string | string[]> }) {
    error = null;
    clearError();
    loading = true;

    try {
      // Submit to API
      const response = await fetch('/api/verified-vibe/verify-step', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          step: 'spending_or_qa',
          data: {
            responses: data.responses,
            gender: $user?.gender
          }
        })
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Q&A verification failed');
      }

      const result = await response.json();

      // Store verification record
      addVerificationRecord({
        id: `${$user?.id}-spending_or_qa`,
        userId: $user?.id || '',
        step: 'spending_or_qa',
        status: 'completed',
        data: result.data,
        completedAt: new Date(),
        createdAt: new Date()
      });

      // Mark step as completed
      completedSteps.add(currentStep);

      // Update progress
      const progress = (completedSteps.size / totalSteps) * 100;
      verificationProgress.set(progress);

      // Update trust score
      updateTrustScoreAfterVerification();

      // Move to next step or complete
      if (currentStep < totalSteps) {
        currentStep++;
        verificationStep.set(currentStep);
      } else {
        // All steps complete
        setPhase('app');
        goto('/verified-vibe/discover');
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred';
      setError(error);
    } finally {
      loading = false;
    }
  }

  async function handleNext() {
    error = null;
    clearError();

    // Validate current step data
    if (!validateStepData(currentStep)) {
      error = 'Please complete this step before continuing';
      return;
    }

    loading = true;

    try {
      // Submit current step to API
      const stepType = steps[currentStep - 1].stepType;
      const response = await fetch('/api/verified-vibe/verify-step', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          step: stepType,
          data: stepData[currentStep] || {}
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Verification failed');
      }

      const result = await response.json();

      // Store verification record
      addVerificationRecord({
        id: `${$user?.id}-${stepType}`,
        userId: $user?.id || '',
        step: stepType,
        status: 'completed',
        data: result.data,
        completedAt: new Date(),
        createdAt: new Date()
      });

      // Mark step as completed
      completedSteps.add(currentStep);

      // Update progress
      const progress = (completedSteps.size / totalSteps) * 100;
      verificationProgress.set(progress);

      // Update trust score
      updateTrustScoreAfterVerification();

      // Move to next step or complete
      if (currentStep < totalSteps) {
        currentStep++;
        verificationStep.set(currentStep);
      } else {
        // All steps complete
        setPhase('app');
        goto('/verified-vibe/discover');
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred';
      setError(error);
    } finally {
      loading = false;
    }
  }

  function handleBack() {
    error = null;
    clearError();
    showSkipWarning = false;

    if (currentStep > 1) {
      currentStep--;
      verificationStep.set(currentStep);
    } else {
      goto('/verified-vibe/verify');
    }
  }

  function handleSkipClick() {
    showSkipWarning = true;
  }

  function confirmSkip() {
    error = null;
    clearError();
    showSkipWarning = false;
    skippedSteps.add(currentStep);

    if (currentStep < totalSteps) {
      currentStep++;
      verificationStep.set(currentStep);
    } else {
      // All steps processed (some skipped)
      setPhase('app');
      goto('/verified-vibe/discover');
    }
  }

  function cancelSkip() {
    showSkipWarning = false;
  }

  function validateStepData(step: number): boolean {
    // Basic validation - in real app, would validate file uploads, etc.
    return true;
  }

  function updateStepData(step: number, data: any) {
    stepData[step] = data;
  }

  function getProgressPercentage(): number {
    return (currentStep / totalSteps) * 100;
  }

  function isStepCompleted(step: number): boolean {
    return completedSteps.has(step);
  }

  function isStepSkipped(step: number): boolean {
    return skippedSteps.has(step);
  }

  /**
   * Update trust score after verification step is completed
   */
  function updateTrustScoreAfterVerification() {
    let records: any[] = [];
    userVerification.subscribe((r) => {
      records = r;
    })();
    
    const trustScore = calculateTrustScore(records);
    updateTrustScore(trustScore);
  }
</script>

<div class="verification-screen">
  <!-- Header -->
  <div class="verification-header" transition:slide={{ duration: 400, delay: 0, axis: 'y' }}>
    <button class="back-btn" onclick={handleBack} disabled={loading} aria-label="Go back">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
    </button>
    <div class="header-title">Verification</div>
    <div class="header-spacer"></div>
  </div>

  <!-- Step Navigation Indicator -->
  <div class="step-navigation" transition:slide={{ duration: 400, delay: 50, axis: 'y' }}>
    <div class="step-indicators">
      {#each steps as step (step.number)}
        {@const completed = isStepCompleted(step.number)}
        {@const skipped = isStepSkipped(step.number)}
        {@const active = currentStep === step.number}
        <div class="step-indicator {active ? 'active' : ''} {completed ? 'completed' : ''} {skipped ? 'skipped' : ''}">
          <div class="step-number">
            {#if completed}
              <span class="checkmark">✓</span>
            {:else if skipped}
              <span class="skip-mark">⊘</span>
            {:else}
              {step.number}
            {/if}
          </div>
          <div class="step-label">{step.number}/{totalSteps}</div>
        </div>
      {/each}
    </div>
  </div>

  <!-- Progress bar -->
  <div class="progress-container" transition:slide={{ duration: 400, delay: 100, axis: 'y' }}>
    <div class="progress-bar">
      <div class="progress-fill" style="width: {getProgressPercentage()}%"></div>
    </div>
    <div class="progress-text">Step {currentStep} of {totalSteps}</div>
  </div>

  <!-- Error message -->
  {#if error}
    <div class="error-banner" transition:slide={{ duration: 300, axis: 'y' }}>
      <div class="error-icon">⚠️</div>
      <div class="error-message">{error}</div>
      <button class="error-close" onclick={() => { error = null; clearError(); }}>×</button>
    </div>
  {/if}

  <!-- Step content -->
  {#key currentStep}
  <div class="verification-content">
    <div class="step-header" transition:fade={{ duration: 300 }}>
      <div class="step-icon">{steps[currentStep - 1].icon}</div>
      <h2 class="step-title">{steps[currentStep - 1].name}</h2>
      <p class="step-description">{steps[currentStep - 1].description}</p>
      <p class="step-time">⏱️ {steps[currentStep - 1].time}</p>
    </div>

    <!-- Step-specific content -->
    <div class="step-body" transition:slide={{ duration: 300, axis: 'y' }}>
      {#if currentStep === 1}
        <IDExtractionStep
          onSubmit={handleIDSubmit}
          onCancel={handleBack}
        />
      {:else if currentStep === 2}
        <LivenessStep
          {idPhotoBase64}
          onSubmit={handleLivenessSubmit}
          onCancel={handleBack}
        />
      {:else if currentStep === 3}
        <PhotoUploadStep
          onSubmit={handlePhotoSubmit}
          onCancel={handleBack}
        />
      {:else if currentStep === 4}
        {#if $user?.gender === 'man'}
          <SpendingUploadStep
            onSubmit={handleSpendingSubmit}
            onCancel={handleBack}
          />
        {:else}
          <SpendingQAStep
            gender={$user?.gender}
            onSubmit={handleQASubmit}
            onCancel={handleBack}
          />
        {/if}
      {/if}
    </div>
  </div>
  {/key}

  <!-- Skip Warning Modal -->
  {#if showSkipWarning}
    <div class="skip-warning-overlay" transition:fade={{ duration: 200 }}>
      <div class="skip-warning-modal" transition:slide={{ duration: 300, axis: 'y' }}>
        <div class="warning-icon">⚠️</div>
        <h3 class="warning-title">Skip this step?</h3>
        <p class="warning-text">
          Skipping verification steps may reduce your trust score and limit your matches.
        </p>
        <div class="warning-actions">
          <button class="btn btn-secondary" onclick={cancelSkip} disabled={loading}>
            Cancel
          </button>
          <button class="btn btn-warning" onclick={confirmSkip} disabled={loading}>
            Skip Anyway
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Actions -->
  <div class="verification-actions" transition:slide={{ duration: 400, delay: 100, axis: 'y' }}>
    {#if currentStep !== 4}
      <button class="btn btn-secondary" onclick={handleSkipClick} disabled={loading}>
        Skip
      </button>
      <button class="btn btn-primary" onclick={handleNext} disabled={loading}>
        {#if loading}
          <span class="loading-spinner"></span>
          Processing...
        {:else}
          {currentStep === totalSteps ? 'Complete' : 'Next'}
        {/if}
      </button>
    {/if}
  </div>
</div>

<style>
  .verification-screen {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 0;
    background: var(--bg-1);
  }

  /* Header */
  .verification-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-1);
    background: var(--bg-1);
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
    flex-shrink: 0;
  }

  .back-btn:hover:not(:disabled) {
    background: var(--bg-3);
    border-color: var(--border-2);
  }

  .back-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .header-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-1);
  }

  .header-spacer {
    width: 40px;
    flex-shrink: 0;
  }

  /* Step Navigation */
  .step-navigation {
    padding: 12px 20px;
    border-bottom: 1px solid var(--border-1);
    background: var(--bg-1);
  }

  .step-indicators {
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }

  .step-indicator {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    flex: 1;
    cursor: pointer;
    transition: all 200ms ease;
  }

  .step-number {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--bg-2);
    border: 2px solid var(--border-1);
    display: grid;
    place-items: center;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-2);
    transition: all 200ms ease;
  }

  .step-indicator.active .step-number {
    background: var(--accent-bright);
    border-color: var(--accent-bright);
    color: var(--bg-1);
    box-shadow: 0 0 0 3px var(--accent-tint);
  }

  .step-indicator.completed .step-number {
    background: var(--accent-bright);
    border-color: var(--accent-bright);
    color: var(--bg-1);
  }

  .step-indicator.skipped .step-number {
    background: var(--bg-3);
    border-color: var(--border-2);
    color: var(--text-3);
  }

  .checkmark {
    font-size: 18px;
  }

  .skip-mark {
    font-size: 16px;
  }

  .step-label {
    font-size: 10px;
    font-weight: 600;
    color: var(--text-3);
    text-align: center;
  }

  /* Progress Container */
  .progress-container {
    padding: 12px 20px;
    border-bottom: 1px solid var(--border-1);
    background: var(--bg-1);
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
    background: linear-gradient(90deg, var(--accent-bright), var(--accent-bright));
    transition: width 300ms ease;
    border-radius: 2px;
  }

  .progress-text {
    font-size: 12px;
    color: var(--text-3);
    text-align: center;
    font-weight: 500;
  }

  /* Error Banner */
  .error-banner {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    margin: 12px 16px 0;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 8px;
    color: #ef4444;
  }

  .error-icon {
    font-size: 18px;
    flex-shrink: 0;
  }

  .error-message {
    font-size: 13px;
    flex: 1;
  }

  .error-close {
    background: none;
    border: none;
    color: #ef4444;
    font-size: 20px;
    cursor: pointer;
    padding: 0;
    width: 24px;
    height: 24px;
    display: grid;
    place-items: center;
    flex-shrink: 0;
  }

  /* Content */
  .verification-content {
    flex: 1;
    overflow-y: auto;
    padding: 24px 20px;
    display: flex;
    flex-direction: column;
  }

  .step-header {
    text-align: center;
    margin-bottom: 32px;
  }

  .step-icon {
    font-size: 48px;
    margin-bottom: 16px;
    display: block;
  }

  .step-title {
    font-size: 24px;
    font-weight: 600;
    margin: 0 0 8px;
    color: var(--text-1);
  }

  .step-description {
    font-size: 14px;
    color: var(--text-2);
    margin: 0 0 8px;
  }

  .step-time {
    font-size: 12px;
    color: var(--text-3);
    margin: 0;
  }

  .step-body {
    margin-bottom: 24px;
  }

  /* Skip Warning Modal */
  .skip-warning-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: grid;
    place-items: center;
    z-index: 100;
    padding: 20px;
  }

  .skip-warning-modal {
    background: var(--bg-1);
    border-radius: 12px;
    padding: 24px;
    max-width: 400px;
    width: 100%;
    text-align: center;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  }

  .warning-icon {
    font-size: 48px;
    margin-bottom: 16px;
  }

  .warning-title {
    font-size: 18px;
    font-weight: 600;
    margin: 0 0 12px;
    color: var(--text-1);
  }

  .warning-text {
    font-size: 14px;
    color: var(--text-2);
    margin: 0 0 20px;
    line-height: 1.5;
  }

  .warning-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  /* Actions */
  .verification-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    padding: 16px 20px calc(16px + env(safe-area-inset-bottom, 0));
    border-top: 1px solid var(--border-1);
    background: var(--bg-1);
  }

  /* Button Styles */
  .btn {
    padding: 12px 16px;
    border-radius: 8px;
    border: none;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 200ms ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 44px;
  }

  .btn-primary {
    background: var(--accent-bright);
    color: var(--bg-1);
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--accent-bright);
    opacity: 0.9;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
  }

  .btn-secondary {
    background: var(--bg-2);
    color: var(--text-1);
    border: 1px solid var(--border-1);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--bg-3);
    border-color: var(--border-2);
  }

  .btn-warning {
    background: #f59e0b;
    color: white;
  }

  .btn-warning:hover:not(:disabled) {
    background: #d97706;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .loading-spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Mobile Responsive */
  @media (max-width: 767px) {
    .verification-header {
      padding: 12px 16px;
      gap: 8px;
    }

    .back-btn {
      width: 40px;
      height: 40px;
      min-width: 40px;
      min-height: 40px;
    }

    .header-title {
      font-size: 15px;
    }

    .header-spacer {
      width: 40px;
    }

    .step-navigation {
      padding: 10px 16px;
    }

    .step-indicators {
      gap: 6px;
    }

    .step-number {
      width: 32px;
      height: 32px;
      font-size: 12px;
    }

    .step-label {
      font-size: 9px;
    }

    .progress-container {
      padding: 10px 16px;
    }

    .progress-bar {
      height: 3px;
      margin-bottom: 6px;
    }

    .progress-text {
      font-size: 11px;
    }

    .error-banner {
      margin: 10px 12px 0;
      padding: 10px 12px;
      font-size: 12px;
    }

    .verification-content {
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
      margin: 0 0 6px;
    }

    .step-description {
      font-size: 13px;
      margin: 0 0 6px;
    }

    .step-time {
      font-size: 11px;
    }

    .step-body {
      margin-bottom: 16px;
    }

    .skip-warning-modal {
      padding: 20px;
      border-radius: 12px;
    }

    .warning-icon {
      font-size: 40px;
      margin-bottom: 12px;
    }

    .warning-title {
      font-size: 16px;
      margin: 0 0 10px;
    }

    .warning-text {
      font-size: 13px;
      margin: 0 0 16px;
    }

    .warning-actions {
      gap: 10px;
    }

    .verification-actions {
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0));
    }

    .btn {
      min-height: 44px;
      padding: 12px 14px;
      font-size: 13px;
      border-radius: 8px;
    }
  }

  /* Tablet Responsive */
  @media (min-width: 768px) and (max-width: 1023px) {
    .verification-content {
      padding: 28px 24px;
    }

    .step-header {
      margin-bottom: 36px;
    }

    .step-icon {
      font-size: 44px;
    }

    .step-title {
      font-size: 22px;
    }

    .verification-actions {
      gap: 14px;
      padding: 18px 24px calc(18px + env(safe-area-inset-bottom, 0));
    }
  }

  /* Desktop */
  @media (min-width: 1024px) {
    .verification-screen {
      max-width: 600px;
      margin: 0 auto;
    }

    .verification-content {
      padding: 32px 28px;
    }

    .step-header {
      margin-bottom: 40px;
    }

    .step-icon {
      font-size: 52px;
    }

    .step-title {
      font-size: 26px;
    }

    .verification-actions {
      gap: 16px;
      padding: 20px 28px;
    }
  }
</style>
