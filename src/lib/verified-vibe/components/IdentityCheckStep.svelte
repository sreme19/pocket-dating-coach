<script lang="ts">
  interface Props {
    selfieDone: boolean;
    loading?: boolean;
    onStartSelfie?: () => void;
    onComplete: () => void;
  }

  let {
    selfieDone,
    loading = false,
    onStartSelfie,
    onComplete,
  }: Props = $props();
</script>

<div class="identity-panel">
  <!-- Single liveness tile: a quick selfie proves you're a real, live person.
       No government ID is collected here — that's requested later, only when a
       name-bearing document (bank statement, ownership papers, etc.) is added. -->
  <div class="tiles">
    <button
      class="tile"
      class:tile--done={selfieDone}
      class:tile--loading={loading}
      disabled={loading}
      onclick={() => { if (!loading) { if (selfieDone) { onComplete(); } else if (onStartSelfie) { onStartSelfie(); } } }}
    >
      <div class="tile-icon" class:tile-icon--done={selfieDone}>
        {#if selfieDone}
          <span class="tile-check">✓</span>
        {:else}
          📷
        {/if}
      </div>
      <div class="tile-body">
        <div class="tile-title-row">
          <span class="tile-title">Quick selfie</span>
          <span class="tile-time">⏱ 60 sec</span>
        </div>
        <p class="tile-sub">
          {#if selfieDone}
            Verified — you're a real, live person ✓
          {:else}
            A quick face check confirms you're a real person — no ID needed
          {/if}
        </p>
      </div>
    </button>
  </div>

  <!-- CTA -->
  <div class="cta-area">
    <button
      class="cta-btn"
      class:cta-btn--active={selfieDone}
      onclick={selfieDone ? onComplete : (onStartSelfie ?? undefined)}
      disabled={loading}
    >
      {#if selfieDone}
        Continue →
      {:else}
        Take a quick selfie
      {/if}
    </button>
    <!-- No skip. The selfie is the anchor every later face check reads from, and
         a profile without it never enters Discover or the matchmaker pool
         (POOL_REQUIRED_STEPS = liveness + photos). Say why it is required
         instead of offering a way past it. Mirrors the Flutter step 0. -->
    <p class="required-note">
      This one is required — your selfie is what proves your photos are really
      you. Nobody can see your profile until it's done.
    </p>
  </div>
</div>

<style>
  .identity-panel {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  /* tiles */
  .tiles {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 18px;
  }

  .tile {
    width: 100%;
    text-align: left;
    background: var(--bg-2);
    border: 1.5px dashed var(--border-1);
    border-radius: 16px;
    padding: 17px 14px;
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 14px;
    cursor: pointer;
    transition: all 0.2s ease;
    color: inherit;
    font: inherit;
    box-sizing: border-box;
  }

  .tile--done {
    background: rgba(255, 122, 77, 0.06);
    border: 1px solid rgba(255, 122, 77, 0.4);
    border-style: solid;
  }

  .tile:not(:disabled):active {
    opacity: 0.85;
    transform: scale(0.99);
  }

  .tile-icon {
    width: 56px;
    height: 56px;
    border-radius: 16px;
    flex-shrink: 0;
    background: rgba(255, 122, 77, 0.08);
    border: 1px solid rgba(255, 122, 77, 0.18);
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

  .tile-check {
    font-size: 22px;
    font-weight: 800;
    color: #052819;
  }

  .tile-body {
    flex: 1;
    min-width: 0;
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
    background: var(--accent-bright);
    border: 1px solid var(--accent-bright);
    border-radius: 16px;
    color: #052819;
    font-size: 15px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.25s ease;
  }

  .cta-btn--active {
    box-shadow: 0 8px 24px rgba(255, 122, 77, 0.28);
  }

  .cta-btn:active {
    opacity: 0.85;
    transform: scale(0.98);
  }

  .required-note {
    margin: 0;
    color: var(--text-3);
    font-size: 12.5px;
    font-weight: 500;
    line-height: 1.5;
    padding: 10px;
    text-align: center;
    width: 100%;
  }
</style>
