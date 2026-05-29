<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { getSupabaseClient } from '$lib/client/supabase';
  import type { LivenessCheckResult } from '../types';

  interface Props {
    idPhotoBase64: string;
    onSubmit?: (data: LivenessCheckResult) => Promise<void>;
    onCancel?: () => void;
  }

  let { idPhotoBase64, onSubmit, onCancel }: Props = $props();

  // ── State machine ────────────────────────────────────────────────────────────
  type Phase =
    | 'idle'        // pre-camera — show guide + "Start" button
    | 'opening'     // waiting for getUserMedia permission
    | 'ready'       // camera live, ring visible, waiting 2 s before fill
    | 'filling'     // ring animating 0→100 %
    | 'verifying'   // Claude running (camera block already gone)
    | 'failed';     // mismatch or error

  let phase      = $state<Phase>('idle');
  let fillPct    = $state(0);        // 0–100 for ring progress
  let flashOn    = $state(false);    // white flash on capture
  let errMsg     = $state<string | null>(null);
  let permDenied = $state(false);

  let videoEl      = $state<HTMLVideoElement | null>(null);
  let canvasEl     = $state<HTMLCanvasElement | null>(null);
  let fallbackEl   = $state<HTMLInputElement | null>(null);
  // Captured JPEG base64 stored before phase changes so canvas unbind doesn't matter
  let capturedB64  = $state<string | null>(null);

  let fillTimer:  ReturnType<typeof setInterval>  | null = null;
  let delayTimer: ReturnType<typeof setTimeout>   | null = null;

  // ── Ring geometry (SVG circle, CSS scaleY → oval) ───────────────────────────
  const R           = 108;
  const CIRCUMF     = +(2 * Math.PI * R).toFixed(1);   // ≈ 678.6
  const ringOffset  = $derived(CIRCUMF * (1 - fillPct / 100));
  const ringStroke  = $derived(fillPct > 0 ? '#34D399' : 'rgba(255,255,255,0.55)');

  // ── Camera helpers ───────────────────────────────────────────────────────────
  async function openCamera() {
    phase     = 'opening';
    errMsg    = null;
    permDenied = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      phase = 'ready';
      await tick();
      if (videoEl) {
        videoEl.srcObject = stream;
        await videoEl.play().catch(() => {});
      }
      scheduleAutoCapture();
    } catch (e: any) {
      phase = 'idle';
      if (e?.name === 'NotAllowedError') {
        permDenied = true;
        errMsg = 'Camera access denied. Use the button below to take a selfie.';
      } else {
        permDenied = true;
        errMsg = 'Camera unavailable. Use the button below to take a selfie.';
      }
    }
  }

  function scheduleAutoCapture() {
    // 2 s pause so user can centre face, then ring fills over 1.5 s
    delayTimer = setTimeout(() => {
      phase     = 'filling';
      fillPct   = 0;
      const TOTAL   = 1500;   // ms for full fill
      const TICK    = 30;     // ms per interval
      const STEP    = 100 / (TOTAL / TICK);
      fillTimer = setInterval(() => {
        fillPct = Math.min(100, fillPct + STEP);
        if (fillPct >= 100) {
          clearInterval(fillTimer!);
          fillTimer = null;
          doCapture();
        }
      }, TICK);
    }, 2000);
  }

  function doCapture() {
    if (!videoEl || !canvasEl) return;
    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;
    canvasEl.width  = videoEl.videoWidth;
    canvasEl.height = videoEl.videoHeight;
    ctx.drawImage(videoEl, 0, 0);
    stopStream();

    // Extract base64 NOW — before phase change unmounts the canvas block
    // and rebinds canvasEl to null.
    canvasEl.toBlob(blob => {
      if (!blob) {
        phase  = 'failed';
        errMsg = 'Capture failed — please try again.';
        return;
      }
      const fr = new FileReader();
      fr.onload = e => {
        capturedB64 = (e.target!.result as string).split(',')[1];
        flashOn = true;
        setTimeout(() => { flashOn = false; }, 250);
        phase = 'verifying';   // camera block unmounts here — that's fine
        runVerification();
      };
      fr.readAsDataURL(blob);
    }, 'image/jpeg', 0.92);
  }

  function stopStream() {
    if (videoEl?.srcObject) {
      (videoEl.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    }
    clearTimeout(delayTimer!);
    clearInterval(fillTimer!);
    delayTimer = null;
    fillTimer  = null;
  }

  // ── Fallback: file input (permission denied) ─────────────────────────────────
  function handleFallbackFile(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    (e.target as HTMLInputElement).value = '';
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      // Store base64 directly — no canvas round-trip needed
      capturedB64 = dataUrl.split(',')[1];
      phase = 'verifying';
      runVerification();
    };
    reader.readAsDataURL(file);
  }

  // ── Liveness check ───────────────────────────────────────────────────────────
  async function runVerification() {
    // capturedB64 must be set before this is called (by doCapture or handleFallbackFile)
    if (!capturedB64) {
      phase  = 'failed';
      errMsg = 'Capture failed — please try again.';
      return;
    }
    errMsg = null;

    const selfieBase64 = capturedB64;   // snapshot; phase changes won't clear this

    try {
      // Get auth token (best-effort; server still works without it)
      let token = '';
      try {
        const sb = getSupabaseClient();
        const { data: { session } } = await sb.auth.getSession();
        token = session?.access_token ?? '';
      } catch { /* non-critical */ }

      // Call the verify-step endpoint so auth + persistence happen in one shot
      const res = await fetch('/api/verified-vibe/verify-step', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          step: 'liveness',
          data: {
            selfieImage:   selfieBase64,
            idPhotoBase64: idPhotoBase64,
            mimeType:      'image/jpeg'
          }
        })
      });

      const json = await res.json();

      if (!res.ok || json.status === 'failed') {
        phase  = 'failed';
        errMsg = json.data?.match === false
          ? "Face doesn't match your ID — please try again in better lighting."
          : json.error || 'Verification failed — please try again.';
        return;
      }

      // Success — hand off to parent
      if (onSubmit) await onSubmit(json.data as LivenessCheckResult);

    } catch (e) {
      phase  = 'failed';
      errMsg = 'Network error — please check your connection and retry.';
    }
  }

  // ── Retry ────────────────────────────────────────────────────────────────────
  function retry() {
    stopStream();
    phase      = 'idle';
    fillPct    = 0;
    errMsg     = null;
    permDenied = false;
  }

  function cancel() {
    stopStream();
    onCancel?.();
  }

  onMount(() => { return () => stopStream(); });
</script>

<div class="liveness-wrap">

  <!-- ── IDLE — guide screen ─────────────────────────────────────────── -->
  {#if phase === 'idle'}
    <div class="guide-screen">
      <div class="guide-oval-preview">
        <svg viewBox="0 0 240 300" class="guide-svg">
          <ellipse cx="120" cy="148" rx="95" ry="120"
            fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="2.5" stroke-dasharray="6 5" />
          <!-- face silhouette hint -->
          <ellipse cx="120" cy="130" rx="38" ry="46" fill="rgba(255,255,255,0.05)" />
        </svg>
        <div class="guide-label">Position your face here</div>
      </div>

      <p class="guide-hint">Look straight into the camera and hold still.<br>We'll auto-capture once your face is centred.</p>

      {#if errMsg}
        <div class="err-row">⚠️ {errMsg}</div>
      {/if}

      {#if permDenied}
        <!-- Fallback button -->
        <button class="cta" onclick={() => fallbackEl?.click()}>
          📷 Take Selfie
        </button>
        <input bind:this={fallbackEl} type="file" accept="image/*" capture="user"
          class="sr-only" onchange={handleFallbackFile} />
      {:else}
        <button class="cta" onclick={openCamera} disabled={phase === 'opening'}>
          {phase === 'opening' ? 'Opening camera…' : '📷 Start'}
        </button>
      {/if}

      <button class="cancel-link" onclick={cancel}>Cancel</button>
    </div>
  {/if}

  <!-- ── CAMERA LIVE (ready / filling) ──────────────────────────────── -->
  {#if phase === 'ready' || phase === 'filling'}
    <div class="camera-screen">

      <!-- Video -->
      <video bind:this={videoEl} autoplay playsinline muted class="cam-video"></video>

      <!-- Canvas (hidden; used to grab frame before phase changes) -->
      <canvas bind:this={canvasEl} class="sr-only"></canvas>

      <!-- Capture flash -->
      {#if flashOn}
        <div class="flash-overlay"></div>
      {/if}

      <!-- Ring overlay -->
      <div class="ring-container">
        <svg class="ring-svg" viewBox="0 0 240 240" aria-hidden="true">
          <!-- dim track -->
          <circle cx="120" cy="120" r={R}
            fill="none"
            stroke="rgba(255,255,255,0.18)"
            stroke-width="3"
          />
          <!-- progress arc -->
          <circle cx="120" cy="120" r={R}
            fill="none"
            stroke={ringStroke}
            stroke-width="4"
            stroke-linecap="round"
            stroke-dasharray={CIRCUMF}
            stroke-dashoffset={ringOffset}
            transform="rotate(-90 120 120)"
            style="transition: stroke-dashoffset 0.03s linear, stroke 0.4s ease"
          />
        </svg>

        <!-- Corner close button -->
        <button class="close-btn" onclick={cancel} aria-label="Cancel">✕</button>

        <!-- Instruction bubble -->
        <div class="instruction" class:instruction--go={phase === 'filling'}>
          {#if phase === 'ready'}
            Centre your face in the ring
          {:else}
            Hold still…
          {/if}
        </div>
      </div>

    </div>
  {/if}

  <!-- ── VERIFYING ──────────────────────────────────────────────────── -->
  {#if phase === 'verifying'}
    <div class="status-screen">
      <div class="spinner-ring"></div>
      <p class="status-text">Verifying face match…</p>
      <p class="status-sub">Comparing against your ID</p>
    </div>
  {/if}

  <!-- ── FAILED ─────────────────────────────────────────────────────── -->
  {#if phase === 'failed'}
    <div class="status-screen">
      <div class="fail-icon">✕</div>
      <p class="status-text">Match failed</p>
      <p class="status-sub">{errMsg ?? 'Please try again in better lighting.'}</p>
      <button class="cta" onclick={retry}>Try again</button>
      <button class="cancel-link" onclick={cancel}>Cancel</button>
    </div>
  {/if}

</div>

<style>
  /* ── Container ───────────────────────────────────────────────────────────── */
  .liveness-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    min-height: 420px;
  }

  .sr-only {
    position: absolute;
    width: 1px; height: 1px;
    overflow: hidden; clip: rect(0,0,0,0);
  }

  /* ── Guide screen ────────────────────────────────────────────────────────── */
  .guide-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 18px;
    width: 100%;
    padding: 8px 0 4px;
  }

  .guide-oval-preview {
    position: relative;
    width: 200px;
    height: 250px;
  }

  .guide-svg {
    width: 100%;
    height: 100%;
  }

  .guide-label {
    position: absolute;
    bottom: 6px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 11px;
    color: var(--text-3);
    white-space: nowrap;
    letter-spacing: 0.04em;
  }

  .guide-hint {
    font-size: 14px;
    color: var(--text-3);
    text-align: center;
    line-height: 1.5;
    margin: 0;
    max-width: 300px;
  }

  /* ── Camera screen ───────────────────────────────────────────────────────── */
  .camera-screen {
    position: relative;
    width: 100%;
    /* square viewport */
    aspect-ratio: 1 / 1;
    border-radius: 20px;
    overflow: hidden;
    background: #000;
  }

  .cam-video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    /* Mirror for selfie feel */
    transform: scaleX(-1);
  }

  .cam-video.hidden {
    visibility: hidden;
  }

  .flash-overlay {
    position: absolute;
    inset: 0;
    background: #fff;
    opacity: 0.85;
    pointer-events: none;
    animation: flash-fade 250ms ease-out forwards;
  }

  @keyframes flash-fade {
    from { opacity: 0.85; }
    to   { opacity: 0; }
  }

  /* Ring overlay */
  .ring-container {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }

  .ring-svg {
    /* Scale horizontally so the circle becomes an oval matching a face shape */
    width: 82%;
    height: 82%;
    transform: scaleY(1.28);
    /* Re-enable pointer-events only for the close button */
  }

  .close-btn {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: none;
    background: rgba(0,0,0,0.45);
    color: #fff;
    font-size: 14px;
    cursor: pointer;
    pointer-events: all;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .instruction {
    position: absolute;
    bottom: 18px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0,0,0,0.55);
    backdrop-filter: blur(6px);
    padding: 7px 18px;
    border-radius: 999px;
    font-size: 13.5px;
    font-weight: 600;
    color: rgba(255,255,255,0.9);
    white-space: nowrap;
    pointer-events: none;
    transition: background 0.3s;
  }

  .instruction--go {
    background: rgba(52, 211, 153, 0.35);
    color: #d1fae5;
  }

  /* ── Status screens ──────────────────────────────────────────────────────── */
  .status-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    padding: 32px 16px;
    width: 100%;
    text-align: center;
  }

  /* Spinner */
  .spinner-ring {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    border: 4px solid rgba(52, 211, 153, 0.18);
    border-top-color: #34D399;
    animation: spin 0.9s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .fail-icon {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background: rgba(239,68,68,0.12);
    border: 2px solid rgba(239,68,68,0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    color: #ef4444;
    font-weight: 700;
  }

  .status-text {
    font-size: 17px;
    font-weight: 700;
    color: var(--text-1);
    margin: 0;
  }

  .status-sub {
    font-size: 13.5px;
    color: var(--text-3);
    margin: 0;
    max-width: 280px;
    line-height: 1.4;
  }

  /* ── CTA button ──────────────────────────────────────────────────────────── */
  .cta {
    width: 100%;
    max-width: 300px;
    padding: 15px 20px;
    background: var(--accent-bright);
    border: none;
    border-radius: 14px;
    color: #052819;
    font-size: 15px;
    font-weight: 700;
    font-family: inherit;
    cursor: pointer;
    transition: opacity 0.2s;
  }

  .cta:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .cta:active:not(:disabled) {
    opacity: 0.85;
    transform: scale(0.98);
  }

  .cancel-link {
    background: transparent;
    border: none;
    color: var(--text-3);
    font-size: 13px;
    font-family: inherit;
    cursor: pointer;
    padding: 6px 12px;
  }

  .err-row {
    font-size: 13px;
    color: #f87171;
    text-align: center;
    max-width: 300px;
  }
</style>
