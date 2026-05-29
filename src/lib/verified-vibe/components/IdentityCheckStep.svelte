<script lang="ts">
  interface IDFields {
    name: string;
    dob: string;
    gender?: string;
    idNumber: string;
  }

  interface Props {
    idDone: boolean;
    selfieDone: boolean;
    idFields?: IDFields | null;
    loading?: boolean;
    onIDFileSelected: (data: { idImage: string; mimeType: string }) => Promise<void>;
    onSelfieFileSelected: (data: { selfieImage: string; mimeType: string }) => Promise<void>;
    onStartSelfie?: () => void;
    onComplete: () => void;
    onSkip: () => void;
  }

  let {
    idDone,
    selfieDone,
    idFields = null,
    loading = false,
    onIDFileSelected,
    onSelfieFileSelected,
    onStartSelfie,
    onComplete,
    onSkip,
  }: Props = $props();

  const allDone = $derived(idDone && selfieDone);
  const doneCount = $derived((idDone ? 1 : 0) + (selfieDone ? 1 : 0));

  async function handleFileChange(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1];
      await onIDFileSelected({ idImage: base64, mimeType: file.type });
    };
    reader.readAsDataURL(file);
    (e.target as HTMLInputElement).value = '';
  }

  async function handleSelfieChange(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1];
      await onSelfieFileSelected({ selfieImage: base64, mimeType: file.type });
    };
    reader.readAsDataURL(file);
    (e.target as HTMLInputElement).value = '';
  }
</script>

<div class="identity-panel">
  <!-- inner pips -->
  <div class="pips-row">
    <span class="pip" class:pip--done={idDone}>
      <span class="pip-dot">{#if idDone}✓{/if}</span>
      ID
    </span>
    <span class="pip-connector"></span>
    <span class="pip" class:pip--done={selfieDone}>
      <span class="pip-dot">{#if selfieDone}✓{/if}</span>
      Face match
    </span>
  </div>

  <!-- task tiles -->
  <div class="tiles">
    <!-- ID tile: transparent file input overlaid on top -->
    <div class="tile-wrap">
      <div class="tile" class:tile--done={idDone} class:tile--loading={loading}>
        <div class="tile-icon" class:tile-icon--done={idDone}>
          {#if idDone}
            <span class="tile-check">✓</span>
          {:else}
            📄
          {/if}
        </div>
        <div class="tile-body">
          <div class="tile-title-row">
            <span class="tile-title">Upload government ID</span>
            <span class="tile-time">⏱ 30 sec</span>
          </div>
          {#if idDone && idFields}
            <div class="id-fields">
              {#if idFields.name}<span class="id-field">{idFields.name}</span>{/if}
              {#if idFields.dob}<span class="id-field">{idFields.dob}</span>{/if}
              {#if idFields.gender}<span class="id-field">{idFields.gender}</span>{/if}
              {#if idFields.idNumber}<span class="id-field id-field--number">{idFields.idNumber}</span>{/if}
            </div>
          {:else}
            <p class="tile-sub">
              {idDone ? 'ID uploaded · verified' : 'Front of Aadhaar, PAN or passport'}
            </p>
          {/if}
        </div>
        <span class="tile-action">
          {#if idDone}
            <span class="retake">RETAKE</span>
          {:else}
            <span class="arrow">›</span>
          {/if}
        </span>
      </div>
      {#if !loading}
        <input
          class="tile-input-overlay"
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onchange={handleFileChange}
        />
      {/if}
    </div>

    <!-- Selfie tile: button routes to LivenessStep for reliable front-camera access -->
    <div class="tile-wrap">
      <button
        class="tile"
        class:tile--done={selfieDone}
        class:tile--locked={!idDone}
        class:tile--loading={loading}
        disabled={!idDone || loading}
        onclick={() => { if (idDone && !loading && onStartSelfie) onStartSelfie(); }}
      >
        <div class="tile-icon" class:tile-icon--done={selfieDone} class:tile-icon--locked={!idDone}>
          {#if selfieDone}
            <span class="tile-check">✓</span>
          {:else}
            📷
          {/if}
        </div>
        <div class="tile-body">
          <div class="tile-title-row">
            <span class="tile-title" class:tile-title--dim={!idDone}>Selfie face match</span>
            <span class="tile-time">⏱ 60 sec</span>
          </div>
          <p class="tile-sub">
            {#if selfieDone}
              Matched to ID · 99%+ confidence
            {:else if !idDone}
              Complete ID upload first
            {:else}
              Same face as your ID
            {/if}
          </p>
        </div>
        <span class="tile-action">
          {#if selfieDone}
            <span class="retake">RETAKE</span>
          {:else if !idDone}
            <span class="lock-icon">🔒</span>
          {:else}
            <span class="arrow">›</span>
          {/if}
        </span>
      </button>
    </div>
  </div>

  <!-- CTA -->
  <div class="cta-area">
    <button
      class="cta-btn"
      class:cta-btn--active={allDone}
      onclick={allDone ? onComplete : undefined}
      disabled={!allDone || loading}
    >
      {#if allDone}
        Continue →
      {:else if !idDone}
        Upload your ID to get started
      {:else}
        Match your face to continue
      {/if}
    </button>
    <button class="skip-link" onclick={onSkip} disabled={loading}>
      Skip identity check — lower your trust score
    </button>
  </div>

</div>

<style>
  .identity-panel {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  /* pips */
  .pips-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin-bottom: 18px;
  }

  .pip-connector {
    width: 18px;
    height: 1px;
    background: var(--border-1);
  }

  .pip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px 4px 5px;
    border-radius: 999px;
    border: 1px solid var(--border-1);
    font-size: 10.5px;
    font-weight: 600;
    letter-spacing: 0.06em;
    color: var(--text-3);
    transition: all 0.2s;
  }

  .pip--done {
    background: rgba(52, 211, 153, 0.1);
    border-color: rgba(52, 211, 153, 0.32);
    color: var(--accent-bright);
  }

  .pip-dot {
    width: 14px;
    height: 14px;
    border-radius: 8px;
    border: 1.5px solid var(--border-1);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 8px;
    font-weight: 800;
    color: transparent;
    transition: all 0.2s;
  }

  .pip--done .pip-dot {
    background: var(--accent-bright);
    border-color: var(--accent-bright);
    color: #052819;
  }

  /* tiles */
  .tiles {
    display: flex;
    flex-direction: row;
    gap: 10px;
    margin-bottom: 18px;
  }

  .tile-wrap {
    position: relative;
    flex: 1;
    min-width: 0;
  }

  .tile-input-overlay {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
    font-size: 0;
  }

  .tile {
    width: 100%;
    text-align: left;
    background: var(--bg-2);
    border: 1.5px dashed var(--border-1);
    border-radius: 16px;
    padding: 17px 12px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
    color: inherit;
    font: inherit;
    height: 100%;
    box-sizing: border-box;
  }

  .tile--done {
    background: rgba(52, 211, 153, 0.06);
    border: 1px solid rgba(52, 211, 153, 0.4);
    border-style: solid;
  }

  .tile--locked {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .tile:not(.tile--locked):not(:disabled):active {
    opacity: 0.85;
    transform: scale(0.99);
  }

  .tile-icon {
    width: 56px;
    height: 56px;
    border-radius: 16px;
    flex-shrink: 0;
    background: rgba(52, 211, 153, 0.08);
    border: 1px solid rgba(52, 211, 153, 0.18);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 26px;
    transition: all 0.2s;
  }

  .tile-icon--done {
    background: var(--accent-bright);
    border-color: var(--accent-bright);
  }

  .tile-icon--locked {
    background: var(--bg-3);
    border-color: var(--border-1);
  }

  .tile-check {
    font-size: 22px;
    font-weight: 800;
    color: #052819;
  }

  .tile-body {
    flex: 1;
    min-width: 0;
    width: 100%;
  }

  .tile-title-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 3px;
    flex-wrap: wrap;
  }

  .tile-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-1);
    line-height: 1.2;
  }

  .tile-title--dim {
    color: var(--text-3);
  }

  .tile-time {
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.06em;
    padding: 2px 7px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.06);
    color: var(--text-3);
    flex-shrink: 0;
  }

  .tile-sub {
    font-size: 12.5px;
    line-height: 1.3;
    color: var(--text-3);
    margin: 0;
  }

  .id-fields {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 8px;
    margin-top: 2px;
  }

  .id-field {
    font-size: 11px;
    font-weight: 500;
    color: var(--accent-bright);
    opacity: 0.8;
    letter-spacing: 0.02em;
  }

  .id-field--number {
    font-family: monospace;
    font-size: 10.5px;
    opacity: 0.6;
    color: var(--text-3);
  }

  .tile-action {
    display: none;
  }

  .retake {
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.06em;
    color: var(--accent-bright);
  }

  .arrow {
    font-size: 22px;
    color: var(--text-3);
    line-height: 1;
  }

  .lock-icon {
    font-size: 14px;
  }

  /* CTA */
  .cta-area {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-bottom: 18px;
  }

  .cta-btn {
    width: 100%;
    padding: 16px;
    background: rgba(52, 211, 153, 0.1);
    border: 1px solid rgba(52, 211, 153, 0.16);
    border-radius: 16px;
    color: var(--text-3);
    font-size: 15px;
    font-weight: 600;
    font-family: inherit;
    cursor: not-allowed;
    transition: all 0.25s ease;
  }

  .cta-btn--active {
    background: var(--accent-bright);
    border-color: var(--accent-bright);
    color: #052819;
    cursor: pointer;
    box-shadow: 0 8px 24px rgba(52, 211, 153, 0.28);
  }

  .cta-btn--active:active {
    opacity: 0.85;
    transform: scale(0.98);
  }

  .skip-link {
    background: transparent;
    border: none;
    color: var(--text-3);
    font-size: 12.5px;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    padding: 10px;
    text-align: center;
    width: 100%;
    transition: color 0.2s;
  }

  .skip-link:hover {
    color: var(--text-2);
  }

  /* trust note */
  .trust-note {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    background: rgba(255, 255, 255, 0.025);
    border: 1px solid var(--border-1);
    border-radius: 12px;
  }

  .lock-badge {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    background: rgba(52, 211, 153, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    flex-shrink: 0;
  }

  .trust-text {
    flex: 1;
    font-size: 11.5px;
    line-height: 1.35;
    color: var(--text-3);
    margin: 0;
  }

  .trust-accent {
    color: var(--accent-bright);
  }
</style>
