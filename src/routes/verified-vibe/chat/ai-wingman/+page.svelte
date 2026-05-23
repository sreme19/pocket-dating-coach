<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { goto } from '$app/navigation';
  import { fly } from 'svelte/transition';
  import { user } from '$lib/verified-vibe/stores';
  import VoiceDictation from '$lib/components/VoiceDictation.svelte';

  interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    pending?: boolean;
  }

  // ── Persistence ─────────────────────────────────────────────────────────────
  const STORAGE_KEY = 'vv_wingman_messages_v2'; // bumped to clear old "upload in any chat" message
  const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

  function loadPersistedMessages(): ChatMessage[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const cutoff = Date.now() - MAX_AGE_MS;
      return (JSON.parse(raw) as Array<{ role: string; content: string; timestamp: string }>)
        .filter(m => new Date(m.timestamp).getTime() > cutoff)
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content, timestamp: new Date(m.timestamp) }));
    } catch { return []; }
  }

  function persistMessages(msgs: ChatMessage[]) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.filter(m => !m.pending)));
    } catch { /* quota */ }
  }

  // ── State ────────────────────────────────────────────────────────────────────
  let messages = $state<ChatMessage[]>([]);
  let input = $state('');
  let sending = $state(false);
  let uploadingImage = $state(false);
  let fileInputEl: HTMLInputElement | undefined;
  let messagesEnd: HTMLDivElement | undefined;
  let feedback = $state<Map<number, 'up' | 'down'>>(new Map());

  $effect(() => { if (messages.length > 0) persistMessages(messages); });

  // ── Markdown ─────────────────────────────────────────────────────────────────
  function renderMarkdown(text: string): string {
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    const blocks = text.split(/\n{2,}/);
    return blocks.map(block => {
      const trimmed = block.trim();
      if (!trimmed) return '';
      if (/^[-•]\s+/m.test(trimmed)) {
        const items = trimmed.split('\n').filter(l => l.trim()).map(l => `<li>${l.replace(/^[-•]\s+/, '')}</li>`).join('');
        return `<ul>${items}</ul>`;
      }
      return `<p>${trimmed.replace(/([^\n])\n([^\n])/g, '$1<br>$2')}</p>`;
    }).filter(Boolean).join('');
  }

  const CHIPS: { label: string; icon: string; intent: 'summary' | 'insights' | 'upload' }[] = [
    { label: 'Summarize my matches', icon: '📋', intent: 'summary' },
    { label: 'New insights', icon: '⚡', intent: 'insights' },
    { label: 'Upload proof', icon: '📸', intent: 'upload' }
  ];

  const UPLOAD_CATEGORIES = [
    { tag: 'wealthy',       icon: '💰', label: 'Wealth & Success',  pts: 10, examples: 'salary slip, bank balance, car, business proof' },
    { tag: 'well_traveled', icon: '✈️', label: 'Travel',            pts: 8,  examples: 'passport stamps, travel photos, hotel, booking' },
    { tag: 'fitness',       icon: '💪', label: 'Fitness & Health',  pts: 5,  examples: 'gym selfie, sport, workout, outdoor activity' },
    { tag: 'general',       icon: '🏆', label: 'Lifestyle',         pts: 3,  examples: 'apartment, watch, nice dinner, hobby' },
    { tag: 'general',       icon: '📄', label: 'Other',             pts: 3,  examples: 'anything else that shows what you\'re about' },
  ];

  let showUploadSuggestions = $state(false);
  let pendingClaimTag = $state('general');

  onMount(async () => {
    user.hydrate();
    const persisted = loadPersistedMessages();
    if (persisted.length > 0) {
      messages = persisted;
    } else {
      messages = [{
        role: 'assistant',
        content: "Hey, good to have you here. 🛡️ I've got the full picture on all your matches — and honestly, you've got more to work with than you might think. Ask me anything, or tap a chip below to get the read you need.",
        timestamp: new Date()
      }];
    }
    await scrollToBottom();
  });

  async function scrollToBottom() {
    await tick();
    messagesEnd?.scrollIntoView({ behavior: 'smooth' });
  }

  function historyForApi() {
    return messages.filter(m => !m.pending).map(m => ({ role: m.role, content: m.content }));
  }

  function toggleFeedback(i: number, val: 'up' | 'down') {
    const next = new Map(feedback);
    next.get(i) === val ? next.delete(i) : next.set(i, val);
    feedback = next;
  }

  function handleChip(intent: 'summary' | 'insights' | 'upload') {
    if (intent === 'upload') {
      showUploadSuggestions = !showUploadSuggestions;
      return;
    }
    send({ intent });
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send({ text: input });
    }
  }

  function clearHistory() {
    localStorage.removeItem(STORAGE_KEY);
    messages = [{
      role: 'assistant',
      content: "Hey, good to have you here. 🛡️ I've got the full picture on all your matches — and honestly, you've got more to work with than you might think. Ask me anything, or tap a chip below to get the read you need.",
      timestamp: new Date()
    }];
    feedback = new Map();
  }

  async function handleFileUpload(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file || !$user?.id) return;
    uploadingImage = true;
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('userId', $user.id);
      fd.append('claimTag', pendingClaimTag);
      fd.append('description', file.name);
      const res = await fetch('/api/verified-vibe/artifacts', { method: 'POST', body: fd });
      const data = await res.json();
      if (res.ok && data.url) {
        const tagLabel = UPLOAD_CATEGORIES.find(c => c.tag === pendingClaimTag)?.label ?? 'proof';
        messages = [...messages, {
          role: 'assistant',
          content: `✨ Logged it — **${tagLabel}** added to your trust profile. **+${data.trustPoints} trust pts.** That's the kind of thing that sets you apart. I'll weave it in when the moment's right with your matches.`,
          timestamp: new Date()
        }];
      }
    } finally {
      uploadingImage = false;
      pendingClaimTag = 'general';
      if (fileInputEl) fileInputEl.value = '';
    }
  }

  async function send(opts: { text?: string; intent?: 'summary' | 'insights' }) {
    if (sending) return;
    const text = (opts.text ?? input).trim();
    if (!text && !opts.intent) return;

    input = '';
    sending = true;

    const userContent =
      opts.intent === 'summary' ? '📋 Summarize my matches'
      : opts.intent === 'insights' ? '⚡ Any new insights?'
      : text;

    messages = [...messages, { role: 'user', content: userContent, timestamp: new Date() }];
    messages = [...messages, { role: 'assistant', content: '…', timestamp: new Date(), pending: true }];
    await scrollToBottom();

    try {
      const res = await fetch('/api/verified-vibe/ai-wingman/chat', {
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

      messages = [
        ...messages.filter(m => !m.pending),
        { role: 'assistant', content: reply, timestamp: new Date() }
      ];
    } catch {
      messages = [
        ...messages.filter(m => !m.pending),
        { role: 'assistant', content: "Connection issue. Try again?", timestamp: new Date() }
      ];
    } finally {
      sending = false;
      await scrollToBottom();
    }
  }
</script>

<div class="wingman-screen">
  <!-- Header -->
  <div class="wingman-header">
    <button class="back-btn" onclick={() => goto('/verified-vibe/chat')} aria-label="Back to messages">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
    </button>

    <div class="wingman-identity">
      <div class="wm-avatar" aria-label="AI Wingman">🛡️</div>
      <div>
        <div class="wm-name">AI Wingman</div>
        <div class="wm-status">Your match advisor</div>
      </div>
    </div>

    <div class="header-actions">
      <button
        class="config-btn"
        onclick={() => { if (confirm('Clear chat history?')) clearHistory(); }}
        title="Clear history"
        aria-label="Clear chat history"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
        </svg>
      </button>
    </div>
  </div>

  <!-- Messages -->
  <div class="messages-area">
    {#each messages as msg, i (i)}
      <div class="msg-row {msg.role}" transition:fly={{ y: 8, duration: 200 }}>
        {#if msg.role === 'assistant'}
          <div class="wm-bubble-avatar">🛡️</div>
          <div class="assistant-col">
            <div class="bubble assistant {msg.pending ? 'pending' : ''}">
              {#if msg.pending}
                <span class="typing-dots"><span></span><span></span><span></span></span>
              {:else}
                {@html renderMarkdown(msg.content)}
              {/if}
            </div>
            {#if !msg.pending}
              <div class="feedback-row">
                <button
                  class="thumb-btn {feedback.get(i) === 'up' ? 'active up' : ''}"
                  onclick={() => toggleFeedback(i, 'up')}
                  aria-label="Helpful"
                >👍</button>
                <button
                  class="thumb-btn {feedback.get(i) === 'down' ? 'active down' : ''}"
                  onclick={() => toggleFeedback(i, 'down')}
                  aria-label="Not helpful"
                >👎</button>
              </div>
            {/if}
          </div>
        {:else}
          <div class="bubble user">{msg.content}</div>
        {/if}
      </div>
    {/each}
    <div bind:this={messagesEnd}></div>
  </div>

  <!-- Upload suggestions panel -->
  {#if showUploadSuggestions}
    <div class="upload-panel" transition:fly={{ y: 20, duration: 220 }}>
      <div class="upload-panel-header">
        <span class="upload-panel-title">📸 Upload proof, build trust</span>
        <button class="upload-panel-close" onclick={() => showUploadSuggestions = false} aria-label="Close">✕</button>
      </div>

      <div class="upload-benefits">
        <div class="upload-benefit-row">
          <span class="upload-benefit-icon">📈</span>
          <span class="upload-benefit-text"><strong>Trust score goes up</strong> — verified profiles rank higher in Discover</span>
        </div>
        <div class="upload-benefit-row">
          <span class="upload-benefit-icon">✨</span>
          <span class="upload-benefit-text"><strong>Your matches' AI Bestie sees this</strong> — she coaches them to see you in the best light</span>
        </div>
        <div class="upload-benefit-row">
          <span class="upload-benefit-icon">🔒</span>
          <span class="upload-benefit-text"><strong>Stays private</strong> — never visible in your chats with them, only here</span>
        </div>
      </div>

      <div class="upload-face-note">
        <span class="upload-face-icon">🤳</span>
        <p>Your face must be visible in the photo — that's what makes it <strong>verifiable</strong>, not just a screenshot.</p>
      </div>

      <p class="upload-panel-subhead">What do you want to verify?</p>

      <div class="upload-categories">
        {#each UPLOAD_CATEGORIES as cat}
          <button
            class="upload-cat-btn"
            onclick={() => { pendingClaimTag = cat.tag; showUploadSuggestions = false; fileInputEl?.click(); }}
          >
            <span class="upload-cat-icon">{cat.icon}</span>
            <div class="upload-cat-text">
              <div class="upload-cat-top">
                <span class="upload-cat-label">{cat.label}</span>
                <span class="upload-cat-pts">+{cat.pts} pts</span>
              </div>
              <span class="upload-cat-examples">{cat.examples}</span>
            </div>
          </button>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Quick chips -->
  <div class="chips-row">
    {#each CHIPS as chip}
      <button
        class="chip"
        class:chip-active={chip.intent === 'upload' && showUploadSuggestions}
        onclick={() => handleChip(chip.intent)}
        disabled={sending && chip.intent !== 'upload'}
      >
        {chip.icon} {chip.label}
      </button>
    {/each}
  </div>

  <!-- Input -->
  <div class="input-bar">
    <textarea
      class="chat-input"
      rows="2"
      placeholder="Ask AI Wingman anything…"
      bind:value={input}
      onkeydown={handleKeydown}
      oninput={(e) => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 180) + 'px'; }}
      disabled={sending}
    ></textarea>
    <VoiceDictation onUse={(text) => { input = text; }} disabled={sending} />
    <input bind:this={fileInputEl} type="file" accept="image/*" style="display:none" onchange={handleFileUpload} />
    <button type="button" class="attach-btn" onclick={() => fileInputEl?.click()} disabled={sending || uploadingImage} title="Upload trust proof" aria-label="Attach image">
      {#if uploadingImage}
        <span class="upload-spin"></span>
      {:else}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
      {/if}
    </button>
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
  .wingman-screen {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-1);
    overflow: hidden;
  }

  /* Header */
  .wingman-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-1);
    background: var(--bg-1);
    flex-shrink: 0;
  }

  .wingman-identity {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
    min-width: 0;
  }

  .wm-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--accent-tint);
    border: 1.5px solid var(--accent-bright);
    display: grid;
    place-items: center;
    font-size: 18px;
    flex-shrink: 0;
  }

  .wm-name {
    font-size: 15px;
    font-weight: 700;
    color: var(--text-1);
    line-height: 1.1;
  }

  .wm-status {
    font-size: 11px;
    color: var(--text-3);
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-left: auto;
  }

  .back-btn, .config-btn {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    display: grid;
    place-items: center;
    cursor: pointer;
    color: var(--text-2);
    flex-shrink: 0;
    transition: background 150ms;
  }
  .back-btn:hover, .config-btn:hover { background: var(--bg-3); }

  /* Messages */
  .messages-area {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    -webkit-overflow-scrolling: touch;
  }

  .msg-row {
    display: flex;
    gap: 8px;
    align-items: flex-end;
  }

  .msg-row.user {
    flex-direction: row-reverse;
  }

  .wm-bubble-avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--accent-tint);
    border: 1px solid var(--accent-bright);
    display: grid;
    place-items: center;
    font-size: 14px;
    flex-shrink: 0;
    align-self: flex-end;
  }

  .assistant-col {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .bubble {
    max-width: 78vw;
    padding: 10px 14px;
    border-radius: 16px;
    font-size: 14px;
    line-height: 1.5;
    word-break: break-word;
  }

  .bubble.assistant {
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    border-bottom-left-radius: 4px;
    color: var(--text-1);
  }

  .bubble.user {
    background: var(--accent-bright);
    color: #06281e;
    border-bottom-right-radius: 4px;
    font-weight: 500;
  }

  .bubble.pending {
    padding: 14px;
  }

  :global(.bubble.assistant ul) {
    margin: 6px 0;
    padding-left: 18px;
  }
  :global(.bubble.assistant p) {
    margin: 0 0 6px;
  }
  :global(.bubble.assistant p:last-child) { margin-bottom: 0; }

  .feedback-row {
    display: flex;
    gap: 4px;
  }

  .thumb-btn {
    background: none;
    border: none;
    font-size: 14px;
    cursor: pointer;
    opacity: 0.4;
    padding: 2px;
    transition: opacity 150ms, transform 150ms;
  }
  .thumb-btn:hover { opacity: 0.8; }
  .thumb-btn.active { opacity: 1; transform: scale(1.2); }

  /* Typing dots */
  .typing-dots {
    display: inline-flex;
    gap: 4px;
    align-items: center;
    height: 12px;
  }
  .typing-dots span {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--text-3);
    animation: dot-bounce 1.2s infinite;
  }
  .typing-dots span:nth-child(2) { animation-delay: 0.2s; }
  .typing-dots span:nth-child(3) { animation-delay: 0.4s; }
  @keyframes dot-bounce {
    0%, 80%, 100% { transform: translateY(0); }
    40% { transform: translateY(-6px); }
  }

  /* Chips */
  .chips-row {
    display: flex;
    gap: 8px;
    padding: 10px 16px 6px;
    overflow-x: auto;
    flex-shrink: 0;
    -webkit-overflow-scrolling: touch;
  }
  .chips-row::-webkit-scrollbar { display: none; }

  .chip {
    padding: 7px 14px;
    border-radius: 999px;
    border: 1px solid var(--border-2);
    background: var(--bg-2);
    color: var(--text-2);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    font-family: inherit;
    transition: all 130ms;
  }
  .chip:hover:not(:disabled) {
    border-color: var(--accent-bright);
    color: var(--accent-bright);
  }
  .chip:disabled { opacity: 0.4; cursor: not-allowed; }

  /* Input bar */
  .input-bar {
    display: flex;
    align-items: flex-end;
    gap: 8px;
    padding: 10px 16px calc(16px + env(safe-area-inset-bottom, 0));
    border-top: 1px solid var(--border-1);
    background: var(--bg-1);
    flex-shrink: 0;
  }

  .chat-input {
    flex: 1;
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    border-radius: 12px;
    padding: 10px 14px;
    font-size: 14px;
    color: var(--text-1);
    font-family: inherit;
    resize: none;
    line-height: 1.5;
    min-height: 40px;
    max-height: 180px;
    transition: border-color 150ms;
  }
  .chat-input:focus {
    outline: none;
    border-color: var(--accent-bright);
  }

  .attach-btn {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    display: grid;
    place-items: center;
    cursor: pointer;
    color: var(--text-3);
    flex-shrink: 0;
    transition: color 150ms, border-color 150ms;
  }
  .attach-btn:hover:not(:disabled) { color: var(--accent-bright); border-color: var(--accent-bright); }
  .attach-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .upload-spin {
    width: 12px; height: 12px;
    border: 2px solid var(--border-2);
    border-top-color: var(--accent-bright);
    border-radius: 50%;
    animation: aspin2 0.6s linear infinite;
  }
  @keyframes aspin2 { to { transform: rotate(360deg); } }

  .send-btn {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    background: var(--accent-bright);
    border: none;
    display: grid;
    place-items: center;
    cursor: pointer;
    color: #06281e;
    flex-shrink: 0;
    transition: opacity 150ms, transform 150ms;
  }
  .send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .send-btn:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }

  .send-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(6,40,30,0.3);
    border-top-color: #06281e;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Upload suggestions panel */
  .upload-panel {
    margin: 0 12px 2px;
    background: var(--bg-2);
    border: 1px solid var(--border-2);
    border-radius: 14px;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    flex-shrink: 0;
  }

  .upload-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .upload-panel-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-1);
  }

  .upload-panel-close {
    background: none;
    border: none;
    color: var(--text-3);
    font-size: 14px;
    cursor: pointer;
    padding: 2px 4px;
    line-height: 1;
  }

  .upload-benefits {
    display: flex;
    flex-direction: column;
    gap: 6px;
    background: var(--accent-tint);
    border: 1px solid rgba(52, 211, 153, 0.2);
    border-radius: 10px;
    padding: 10px 12px;
  }

  .upload-benefit-row {
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }

  .upload-benefit-icon {
    font-size: 13px;
    flex-shrink: 0;
    margin-top: 1px;
  }

  .upload-benefit-text {
    font-size: 12px;
    color: var(--text-2);
    line-height: 1.4;
  }

  .upload-benefit-text strong {
    color: var(--accent-bright);
  }

  .upload-face-note {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 9px 11px;
    background: rgba(245, 158, 11, 0.08);
    border: 1px solid rgba(245, 158, 11, 0.25);
    border-radius: 8px;
  }

  .upload-face-icon {
    font-size: 16px;
    flex-shrink: 0;
    line-height: 1.4;
  }

  .upload-face-note p {
    font-size: 12px;
    color: var(--text-2);
    margin: 0;
    line-height: 1.5;
  }

  .upload-face-note strong {
    color: #f59e0b;
  }

  .upload-panel-subhead {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-3);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin: 0;
  }

  .upload-categories {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .upload-cat-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 12px;
    background: var(--bg-1);
    border: 1px solid var(--border-1);
    border-radius: 10px;
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    transition: border-color 130ms, background 130ms;
  }

  .upload-cat-btn:hover {
    border-color: var(--accent-bright);
    background: var(--accent-tint);
  }

  .upload-cat-icon {
    font-size: 18px;
    flex-shrink: 0;
    width: 24px;
    text-align: center;
  }

  .upload-cat-text {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .upload-cat-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
  }

  .upload-cat-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-1);
  }

  .upload-cat-pts {
    font-size: 11px;
    font-weight: 700;
    color: var(--accent-bright);
    background: var(--accent-tint);
    border-radius: 999px;
    padding: 1px 7px;
    white-space: nowrap;
  }

  .upload-cat-examples {
    font-size: 11px;
    color: var(--text-3);
  }

  .chip-active {
    border-color: var(--accent-bright);
    color: var(--accent-bright);
    background: var(--accent-tint);
  }
</style>
