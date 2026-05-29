<script lang="ts">
  /**
   * EcosystemExplainer.svelte
   *
   * Bottom-sheet modal explaining how the three AI agents (Matchmaker,
   * Wingman, Bestie) work together, so users know exactly what to do
   * to take advantage of the system.
   *
   * Props:
   *   open        – whether the sheet is visible
   *   perspective – 'man' (shows Wingman framing) or 'woman' (shows Bestie framing)
   *   onClose     – called when the user dismisses
   */

  interface Props {
    open: boolean;
    perspective: 'man' | 'woman';
    onClose: () => void;
  }

  let { open, perspective, onClose }: Props = $props();

  function handleBackdrop(e: MouseEvent) {
    if ((e.target as Element).classList.contains('backdrop')) onClose();
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="backdrop" onclick={handleBackdrop} role="dialog" aria-modal="true" aria-label="How the AI agents work">
    <div class="sheet">
      <div class="sheet-handle"></div>

      <div class="sheet-header">
        <span class="sheet-title">How the AI agents work</span>
        <button class="close-btn" onclick={onClose} aria-label="Close">✕</button>
      </div>

      <!-- The three agents -->
      <div class="agents">
        <div class="agent">
          <div class="agent-icon">🤖</div>
          <div class="agent-body">
            <div class="agent-name">AI Matchmaker</div>
            <div class="agent-desc">Runs behind the scenes — decides which profiles appear in Discover, ranked by compatibility and Trust Score. She never talks to you directly.</div>
          </div>
        </div>

        <div class="agent">
          <div class="agent-icon">{perspective === 'man' ? '🛡️' : '✨'}</div>
          <div class="agent-body">
            <div class="agent-name">{perspective === 'man' ? 'AI Wingman (you)' : 'AI Bestie (you)'}</div>
            <div class="agent-desc">Your private advisor — lives in this chat. Gives you strategy, insights, competitive intel, and helps you make the most of every match.</div>
          </div>
        </div>

        <div class="agent">
          <div class="agent-icon">{perspective === 'man' ? '✨' : '🛡️'}</div>
          <div class="agent-body">
            <div class="agent-name">{perspective === 'man' ? 'AI Bestie (on their side)' : 'AI Wingman (on their side)'}</div>
            <div class="agent-desc">
              {#if perspective === 'man'}
                Lives in each woman's private chat. When she finds your profile in Discover, her Bestie sees your verified proofs and proactively coaches her about you — framing you positively before she even swipes.
              {:else}
                Lives in each man's private chat. When you find his profile in Discover, you (Bestie) see his verified proofs and coach him — and you coach her to see those qualities clearly.
              {/if}
            </div>
          </div>
        </div>
      </div>

      <!-- The loop -->
      <div class="loop-card">
        <div class="loop-title">⚡ The verification loop</div>
        <div class="loop-steps">
          <div class="loop-step">
            <span class="step-num">1</span>
            <span class="step-text">You upload a proof here (travel, wealth, fitness, lifestyle) via the 📎 button</span>
          </div>
          <div class="loop-arrow">↓</div>
          <div class="loop-step">
            <span class="step-num">2</span>
            <span class="step-text">AI Matchmaker raises your Trust Score → your profile shows up to more people in Discover</span>
          </div>
          <div class="loop-arrow">↓</div>
          <div class="loop-step">
            <span class="step-num">3</span>
            <span class="step-text">
              {#if perspective === 'man'}
                Each woman's AI Bestie sees your proofs and coaches her about you: "he's verified travel to 5+ countries, he's a director, he invests in himself"
              {:else}
                Each man's AI Wingman sees your proofs and coaches him about you, framing your strengths clearly before he even starts the conversation
              {/if}
            </span>
          </div>
          <div class="loop-arrow">↓</div>
          <div class="loop-step">
            <span class="step-num">4</span>
            <span class="step-text">Better first impressions → more meaningful matches → better conversations</span>
          </div>
        </div>
      </div>

      <!-- Privacy note -->
      <div class="privacy-note">
        <span class="privacy-icon">🔒</span>
        <span>Proofs are completely private — never visible in your chats with matches. Only the AI agents and the Matchmaker can see them.</span>
      </div>

      <!-- CTA -->
      <div class="cta-row">
        <div class="cta-text">
          {#if perspective === 'man'}
            Ask AI Wingman anything — or tap 📎 to upload your first proof and start the loop.
          {:else}
            Ask AI Bestie anything — or tap 📎 to upload your first proof and start the loop.
          {/if}
        </div>
        <button class="got-it-btn" onclick={onClose}>Got it</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    z-index: 200;
    display: flex;
    align-items: flex-end;
    backdrop-filter: blur(2px);
    animation: fade-in 180ms ease;
  }

  @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }

  .sheet {
    width: 100%;
    max-height: 88vh;
    background: var(--bg-1);
    border-radius: 20px 20px 0 0;
    padding: 12px 20px calc(28px + env(safe-area-inset-bottom, 0));
    overflow-y: auto;
    animation: slide-up 240ms cubic-bezier(0.32, 0.72, 0, 1);
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  @keyframes slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }

  .sheet-handle {
    width: 36px;
    height: 4px;
    border-radius: 999px;
    background: var(--border-2);
    margin: 0 auto 4px;
    flex-shrink: 0;
  }

  .sheet-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
  }

  .sheet-title {
    font-size: 17px;
    font-weight: 700;
    color: var(--text-1);
  }

  .close-btn {
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    color: var(--text-3);
    width: 30px;
    height: 30px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-size: 13px;
    cursor: pointer;
  }

  /* Agents */
  .agents {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .agent {
    display: flex;
    gap: 12px;
    align-items: flex-start;
  }

  .agent-icon {
    width: 38px;
    height: 38px;
    border-radius: 12px;
    background: var(--accent-tint);
    border: 1px solid rgba(52, 211, 153, 0.25);
    display: grid;
    place-items: center;
    font-size: 18px;
    flex-shrink: 0;
  }

  .agent-name {
    font-size: 14px;
    font-weight: 700;
    color: var(--text-1);
    margin-bottom: 3px;
  }

  .agent-desc {
    font-size: 13px;
    color: var(--text-2);
    line-height: 1.5;
  }

  /* Loop card */
  .loop-card {
    background: var(--bg-2);
    border: 1px solid var(--border-2);
    border-radius: 14px;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .loop-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--accent-bright);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .loop-steps {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .loop-step {
    display: flex;
    gap: 10px;
    align-items: flex-start;
  }

  .step-num {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--accent-bright);
    color: #06281e;
    font-size: 11px;
    font-weight: 800;
    display: grid;
    place-items: center;
    flex-shrink: 0;
    margin-top: 1px;
  }

  .step-text {
    font-size: 13px;
    color: var(--text-2);
    line-height: 1.5;
  }

  .loop-arrow {
    font-size: 14px;
    color: var(--text-3);
    text-align: center;
    padding-left: 10px;
  }

  /* Privacy */
  .privacy-note {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    padding: 10px 12px;
    background: rgba(245, 158, 11, 0.08);
    border: 1px solid rgba(245, 158, 11, 0.2);
    border-radius: 10px;
    font-size: 12px;
    color: var(--text-2);
    line-height: 1.5;
  }

  .privacy-icon {
    font-size: 15px;
    flex-shrink: 0;
    margin-top: 1px;
  }

  /* CTA */
  .cta-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .cta-text {
    flex: 1;
    font-size: 13px;
    color: var(--text-3);
    line-height: 1.4;
  }

  .got-it-btn {
    background: var(--accent-bright);
    border: none;
    color: #06281e;
    font-size: 14px;
    font-weight: 700;
    padding: 10px 20px;
    border-radius: 12px;
    cursor: pointer;
    font-family: inherit;
    flex-shrink: 0;
    transition: opacity 150ms;
  }
  .got-it-btn:hover { opacity: 0.88; }
</style>
