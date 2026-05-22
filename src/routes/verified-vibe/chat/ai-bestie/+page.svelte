<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { goto } from '$app/navigation';
  import { fade, fly } from 'svelte/transition';
  import { user } from '$lib/verified-vibe/stores';
  import VoiceDictation from '$lib/components/VoiceDictation.svelte';
  import BestieAvatar from '$lib/components/BestieAvatar.svelte';

  // ── Types ──────────────────────────────────────────────────────────────────
  interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    pending?: boolean;
  }

  // ── State ──────────────────────────────────────────────────────────────────
  let messages = $state<ChatMessage[]>([]);
  let input = $state('');
  let sending = $state(false);
  let messagesEnd: HTMLDivElement | undefined;

  // Quick-action chips
  const CHIPS: { label: string; icon: string; intent: 'summary' | 'insights' | 'configure' }[] = [
    { label: 'Summarize my matches', icon: '📋', intent: 'summary' },
    { label: 'Fresh insights', icon: '✨', intent: 'insights' },
    { label: 'Configure Bestie', icon: '⚙️', intent: 'configure' }
  ];

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  onMount(async () => {
    user.hydrate();

    // Opening greeting from Bestie
    messages = [{
      role: 'assistant',
      content: "Hey! 👋 I'm your AI Bestie — I've got eyes on all your matches so you don't have to juggle it alone. Ask me anything, or use the chips below to get a summary or fresh insights.",
      timestamp: new Date()
    }];
  });

  // ── Helpers ────────────────────────────────────────────────────────────────
  async function scrollToBottom() {
    await tick();
    messagesEnd?.scrollIntoView({ behavior: 'smooth' });
  }

  function historyForApi(): { role: 'user' | 'assistant'; content: string }[] {
    return messages
      .filter(m => !m.pending)
      .map(m => ({ role: m.role, content: m.content }));
  }

  async function send(opts: { text?: string; intent?: 'summary' | 'insights' }) {
    if (sending) return;
    const text = (opts.text ?? input).trim();
    if (!text && !opts.intent) return;

    input = '';
    sending = true;

    // Add user bubble (empty for implicit intents)
    const userContent =
      opts.intent === 'summary' ? '📋 Summarize my matches'
      : opts.intent === 'insights' ? '✨ Any fresh insights?'
      : text;

    messages = [...messages, { role: 'user', content: userContent, timestamp: new Date() }];

    // Placeholder typing bubble
    const pendingId = Date.now();
    messages = [...messages, { role: 'assistant', content: '…', timestamp: new Date(), pending: true }];
    await scrollToBottom();

    try {
      const res = await fetch('/api/verified-vibe/ai-bestie/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: $user?.id ?? '',
          message: opts.intent ? '' : text,
          intent: opts.intent ?? 'chat',
          history: historyForApi()
        })
      });

      const data = await res.json();
      const reply: string = data.reply ?? data.error ?? 'Something went wrong.';

      // Replace pending bubble with real reply
      messages = [
        ...messages.filter(m => !m.pending),
        { role: 'assistant', content: reply, timestamp: new Date() }
      ];
    } catch {
      messages = [
        ...messages.filter(m => !m.pending),
        { role: 'assistant', content: "Sorry, something went wrong. Try again?", timestamp: new Date() }
      ];
    } finally {
      sending = false;
      await scrollToBottom();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send({ text: input });
    }
  }

  async function handleChip(intent: 'summary' | 'insights' | 'configure') {
    if (intent === 'configure') {
      goto('/verified-vibe/chat/ai-bestie/configure');
      return;
    }
    await send({ intent });
  }

  function formatTime(d: Date) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
</script>

<div class="bestie-screen">
  <!-- Header -->
  <div class="bestie-header">
    <button class="back-btn" onclick={() => goto('/verified-vibe/chat')} aria-label="Back to messages">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
    </button>

    <div class="bestie-identity">
      <BestieAvatar size={36} />
      <div>
        <div class="bestie-name">AI Bestie</div>
        <div class="bestie-status">Your match advisor</div>
      </div>
    </div>

    <button class="config-btn" onclick={() => goto('/verified-vibe/chat/ai-bestie/configure')} title="Configure AI Bestie">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
      </svg>
    </button>
  </div>

  <!-- Messages -->
  <div class="messages-area">
    {#each messages as msg, i (i)}
      <div
        class="msg-row {msg.role}"
        transition:fly={{ y: 8, duration: 200 }}
      >
        {#if msg.role === 'assistant'}
          <BestieAvatar size={32} />
        {/if}
        <div class="bubble {msg.role} {msg.pending ? 'pending' : ''}">
          {#if msg.pending}
            <span class="typing-dots"><span></span><span></span><span></span></span>
          {:else}
            {msg.content}
          {/if}
        </div>
      </div>
    {/each}
    <div bind:this={messagesEnd}></div>
  </div>

  <!-- Quick-action chips -->
  <div class="chips-row">
    {#each CHIPS as chip}
      <button
        class="chip {chip.intent === 'configure' ? 'chip-config' : ''}"
        onclick={() => handleChip(chip.intent)}
        disabled={sending && chip.intent !== 'configure'}
      >
        {chip.icon} {chip.label}
      </button>
    {/each}
  </div>

  <!-- Input -->
  <div class="input-bar">
    <textarea
      class="chat-input"
      rows="1"
      placeholder="Ask AI Bestie anything…"
      bind:value={input}
      onkeydown={handleKeydown}
      disabled={sending}
    ></textarea>
    <VoiceDictation onUse={(text) => { input = text; }} disabled={sending} />
    <button
      class="send-btn"
      onclick={() => send({ text: input })}
      disabled={sending || !input.trim()}
      aria-label="Send"
    >
      {#if sending}
        <span class="send-spinner"></span>
      {:else}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
        </svg>
      {/if}
    </button>
  </div>
</div>

<style>
  /* ── Layout ── */
  .bestie-screen {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-1);
    overflow: hidden;
  }

  /* ── Header ── */
  .bestie-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-1);
    background: var(--bg-1);
    flex-shrink: 0;
  }

  .back-btn {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    display: grid;
    place-items: center;
    cursor: pointer;
    color: var(--text-1);
    flex-shrink: 0;
    transition: background 150ms;
  }
  .back-btn:hover { background: var(--bg-3); }

  .bestie-identity {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  /* .bestie-avatar-sm replaced by <BestieAvatar size={36} /> */

  .bestie-name {
    font-size: 15px;
    font-weight: 700;
    color: var(--text-1);
    background: linear-gradient(90deg, #ec4899, #a855f7);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .bestie-status {
    font-size: 12px;
    color: var(--text-3);
  }

  .config-btn {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: transparent;
    border: 1px solid var(--border-1);
    display: grid;
    place-items: center;
    cursor: pointer;
    color: var(--text-3);
    flex-shrink: 0;
    transition: all 150ms;
  }
  .config-btn:hover {
    background: var(--bg-2);
    color: var(--text-1);
  }

  /* ── Messages ── */
  .messages-area {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .msg-row {
    display: flex;
    align-items: flex-end;
    gap: 8px;
  }

  .msg-row.user {
    flex-direction: row-reverse;
  }

  /* .bestie-avatar-bubble replaced by <BestieAvatar size={32} /> */

  .bubble {
    max-width: 76%;
    padding: 10px 14px;
    border-radius: 16px;
    font-size: 14px;
    line-height: 1.55;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .bubble.assistant {
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    color: var(--text-1);
    border-bottom-left-radius: 4px;
  }

  .bubble.user {
    background: linear-gradient(135deg, #ec4899, #a855f7);
    color: #fff;
    border-bottom-right-radius: 4px;
  }

  .bubble.pending {
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    min-width: 56px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* typing dots */
  .typing-dots {
    display: flex;
    gap: 4px;
    align-items: center;
    height: 16px;
  }
  .typing-dots span {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--text-3);
    animation: bounce 1.2s ease-in-out infinite;
  }
  .typing-dots span:nth-child(2) { animation-delay: 0.2s; }
  .typing-dots span:nth-child(3) { animation-delay: 0.4s; }
  @keyframes bounce {
    0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
    40% { transform: translateY(-5px); opacity: 1; }
  }

  /* ── Chips ── */
  .chips-row {
    display: flex;
    gap: 8px;
    padding: 8px 16px;
    overflow-x: auto;
    flex-shrink: 0;
    scrollbar-width: none;
  }
  .chips-row::-webkit-scrollbar { display: none; }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 7px 13px;
    border-radius: 20px;
    font-size: 13px;
    font-weight: 500;
    border: 1px solid rgba(236, 72, 153, 0.35);
    background: rgba(236, 72, 153, 0.08);
    color: #ec4899;
    cursor: pointer;
    white-space: nowrap;
    transition: all 150ms;
    flex-shrink: 0;
  }
  .chip:hover:not(:disabled) {
    background: rgba(236, 72, 153, 0.18);
    border-color: rgba(236, 72, 153, 0.6);
  }
  .chip:disabled {
    opacity: 0.45;
    cursor: default;
  }
  .chip-config {
    border-color: rgba(168, 85, 247, 0.35);
    background: rgba(168, 85, 247, 0.08);
    color: #a855f7;
  }
  .chip-config:hover:not(:disabled) {
    background: rgba(168, 85, 247, 0.18);
    border-color: rgba(168, 85, 247, 0.6);
  }

  /* ── Input ── */
  .input-bar {
    display: flex;
    align-items: flex-end;
    gap: 10px;
    padding: 10px 16px 14px;
    border-top: 1px solid var(--border-1);
    background: var(--bg-1);
    flex-shrink: 0;
  }

  .chat-input {
    flex: 1;
    resize: none;
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    border-radius: 12px;
    padding: 10px 14px;
    font-size: 14px;
    color: var(--text-1);
    line-height: 1.4;
    max-height: 120px;
    overflow-y: auto;
    outline: none;
    transition: border-color 150ms;
  }
  .chat-input:focus {
    border-color: rgba(236, 72, 153, 0.5);
  }
  .chat-input::placeholder { color: var(--text-3); }

  .send-btn {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: linear-gradient(135deg, #ec4899, #a855f7);
    border: none;
    display: grid;
    place-items: center;
    cursor: pointer;
    color: #fff;
    flex-shrink: 0;
    transition: opacity 150ms;
  }
  .send-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .send-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── Mobile ── */
  @media (max-width: 767px) {
    .bestie-header { padding: 10px 12px; }
    .messages-area { padding: 12px; }
    .chips-row { padding: 6px 12px; }
    .input-bar { padding: 8px 12px 12px; }
    .bubble { max-width: 85%; font-size: 13px; }
  }
</style>
