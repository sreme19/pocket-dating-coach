<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { goto } from '$app/navigation';
  import { fade, fly } from 'svelte/transition';
  import { user } from '$lib/verified-vibe/stores';
  import { getSupabaseClient } from '$lib/client/supabase';
  import VoiceDictation from '$lib/components/VoiceDictation.svelte';
  import BestieAvatar from '$lib/components/BestieAvatar.svelte';
  import EcosystemExplainer from '$lib/components/EcosystemExplainer.svelte';

  // ── Proactive greeting ────────────────────────────────────────────────────
  interface Greeting {
    id: string;
    content: string;
    mode: number;
    topicTags: string[];
  }
  let greeting = $state<Greeting | null>(null);
  let greetingFeedback = $state<'up' | 'down' | null>(null);
  let greetingFeedbackDone = $state(false);
  let showReasonChips = $state(false);
  let selectedReasonChip = $state<string | null>(null);
  let feedbackNote = $state('');
  let showFeedbackNote = $state(false);
  let submittingFeedback = $state(false);

  const REASON_CHIPS = [
    { key: 'too_generic',   label: 'Too generic' },
    { key: 'not_relevant',  label: 'Not relevant' },
    { key: 'wrong_tone',    label: 'Wrong tone' },
    { key: 'factually_off', label: 'Factually off' },
    { key: 'other',         label: 'Other' },
  ];

  async function fetchGreeting() {
    try {
      const sb = getSupabaseClient();
      const { data: { session } } = await sb.auth.getSession();
      if (!session?.access_token) return;

      const res = await fetch('/api/verified-vibe/ai-greeting', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({}),
      });
      if (!res.ok) return;
      const data = await res.json() as { isNew: boolean; greetingId?: string; content?: string; mode?: number; topicTags?: string[] };
      if (data.isNew && data.greetingId && data.content) {
        greeting = { id: data.greetingId, content: data.content, mode: data.mode ?? 0, topicTags: data.topicTags ?? [] };
      }
    } catch { /* greeting is non-critical */ }
  }

  async function submitGreetingFeedback(rating: 'up' | 'down') {
    if (greetingFeedbackDone || !greeting) return;
    greetingFeedback = rating;
    if (rating === 'down') { showReasonChips = true; return; }
    await doSubmitFeedback(1, null, null);
  }

  async function submitWithReason() {
    if (!greeting || submittingFeedback) return;
    await doSubmitFeedback(-1, selectedReasonChip, feedbackNote.trim() || null);
    showReasonChips = false;
    showFeedbackNote = false;
  }

  async function doSubmitFeedback(rating: 1 | -1, chip: string | null, note: string | null) {
    if (!greeting || submittingFeedback) return;
    submittingFeedback = true;
    try {
      const sb = getSupabaseClient();
      const { data: { session } } = await sb.auth.getSession();
      if (!session?.access_token) return;
      await fetch('/api/verified-vibe/ai-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ greetingId: greeting.id, rating, reasonChip: chip, feedbackText: note }),
      });
      greetingFeedbackDone = true;
    } catch { /* fail silently */ }
    finally { submittingFeedback = false; }
  }

  // ── Types ──────────────────────────────────────────────────────────────────
  interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    pending?: boolean;
  }

  interface Draft {
    matchName: string;
    matchId: string;
    content: string;
  }

  // ── Persistence ────────────────────────────────────────────────────────────
  const STORAGE_KEY = 'vv_bestie_messages';
  const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

  function loadPersistedMessages(): ChatMessage[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const cutoff = Date.now() - MAX_AGE_MS;
      const parsed = JSON.parse(raw) as Array<{ role: string; content: string; timestamp: string }>;
      return parsed
        .filter(m => new Date(m.timestamp).getTime() > cutoff)
        .map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
          timestamp: new Date(m.timestamp)
        }));
    } catch {
      return [];
    }
  }

  function persistMessages(msgs: ChatMessage[]) {
    try {
      // Never persist pending / typing-indicator bubbles
      const toSave = msgs.filter(m => !m.pending);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch {
      // localStorage quota exceeded — fail silently
    }
  }

  // ── State ──────────────────────────────────────────────────────────────────
  let messages = $state<ChatMessage[]>([]);
  let input = $state('');
  let sending = $state(false);
  let uploadingImage = $state(false);
  let fileInputEl: HTMLInputElement | undefined;
  let sendingDraftId = $state<string | null>(null);
  let pendingDrafts = $state<Draft[]>([]);
  let messagesEnd: HTMLDivElement | undefined;
  let feedback = $state<Map<number, 'up' | 'down'>>(new Map());
  let bestieName = $state('AI Bestie');
  let showEcosystemExplainer = $state(false);

  // Auto-save whenever messages change (skips pending bubbles)
  $effect(() => {
    if (messages.length > 0) persistMessages(messages);
  });

  // ── Markdown renderer ──────────────────────────────────────────────────────
  function renderMarkdown(text: string): string {
    // Bold first so markers are present when we split into blocks
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    const blocks = text.split(/\n{2,}/);
    return blocks.map(block => {
      const trimmed = block.trim();
      if (!trimmed) return '';
      if (/^[-•]\s+/m.test(trimmed)) {
        const items = trimmed.split('\n')
          .filter(l => l.trim())
          .map(l => `<li>${l.replace(/^[-•]\s+/, '')}</li>`)
          .join('');
        return `<ul>${items}</ul>`;
      }
      return `<p>${trimmed.replace(/([^\n])\n([^\n])/g, '$1<br>$2')}</p>`;
    }).filter(b => b).join('');
  }

  // ── Per-message feedback (thumbs + reason-chips panel) ──────────────────────
  let feedbackPanelIdx = $state<number | null>(null);   // message index with the panel open
  let msgReasonChip = $state<string | null>(null);
  let msgFeedbackNote = $state('');
  let msgShowNote = $state(false);
  let msgFeedbackDone = $state<Set<number>>(new Set());
  let submittingMsgFeedback = $state(false);

  function resetMsgPanel() {
    msgReasonChip = null;
    msgFeedbackNote = '';
    msgShowNote = false;
  }

  async function rateMessage(i: number, val: 'up' | 'down', messageContent: string) {
    const prev = feedback.get(i);
    const next = new Map(feedback);

    // Toggle off if the same button is clicked again
    if (prev === val) {
      next.delete(i);
      feedback = next;
      if (val === 'down') { feedbackPanelIdx = null; resetMsgPanel(); }
      return;
    }

    next.set(i, val);
    feedback = next;

    if (val === 'down') {
      // Open the detailed-feedback panel; persistence happens on Send/Skip.
      feedbackPanelIdx = i;
      resetMsgPanel();
      return;
    }

    // Positive — close any open panel and persist immediately.
    feedbackPanelIdx = null;
    await postMessageFeedback('positive', messageContent, null, null);
  }

  async function submitMessageFeedback(i: number, messageContent: string, chip: string | null, note: string | null) {
    if (submittingMsgFeedback) return;
    submittingMsgFeedback = true;
    try {
      await postMessageFeedback('negative', messageContent, chip, note);
      const done = new Set(msgFeedbackDone);
      done.add(i);
      msgFeedbackDone = done;
      feedbackPanelIdx = null;
      resetMsgPanel();
    } finally {
      submittingMsgFeedback = false;
    }
  }

  async function postMessageFeedback(
    feedbackType: 'positive' | 'negative',
    messageContent: string,
    reasonChip: string | null,
    feedbackText: string | null
  ) {
    try {
      await fetch('/api/verified-vibe/ai-bestie/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: $user?.id ?? '',
          assistantType: 'bestie',
          feedbackType,
          messageContent,
          reasonChip,
          feedbackText
        })
      });
    } catch (err) {
      console.warn('[AI Bestie feedback] failed to save:', err);
      // Non-blocking — don't revert UI state on network errors
    }
  }

  // Quick-action chips
  const CHIPS: { label: string; icon: string; intent: 'summary' | 'insights' | 'configure' | 'update_profile' | 'better_matches' }[] = [
    { label: 'Summarize matches', icon: '📋', intent: 'summary' },
    { label: 'Fresh insights', icon: '✨', intent: 'insights' },
    { label: 'How can I get better matches', icon: '💡', intent: 'better_matches' },
    { label: 'Update profile', icon: '✏️', intent: 'update_profile' },
    { label: 'Configure Bestie', icon: '⚙️', intent: 'configure' }
  ];

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  onMount(async () => {
    user.hydrate();

    // Load configured bestie name
    try {
      const raw = localStorage.getItem('ai_bestie_persona');
      if (raw) {
        const persona = JSON.parse(raw);
        if (persona?.name) bestieName = persona.name;
      }
    } catch { /* ignore */ }

    // Restore persisted history (pruned to last 7 days)
    const persisted = loadPersistedMessages();

    if (persisted.length > 0) {
      messages = persisted;
    } else {
      // First visit — show opening greeting
      messages = [{
        role: 'assistant',
        content: "Hey! 👋 I'm your AI Bestie — I've got eyes on all your matches so you don't have to juggle it alone. Ask me anything, or use the chips below to get a summary or fresh insights.",
        timestamp: new Date()
      }];
    }

    // Fetch proactive greeting in parallel (non-blocking)
    fetchGreeting();
    fetchStanding();
    await scrollToBottom();
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

  // ── "Where you stand" panel — precomputed match intelligence ────────────────
  let standing = $state<any[]>([]);
  let standingOpen = $state(true);
  async function fetchStanding() {
    try {
      const id = $user?.id;
      if (!id) return;
      const res = await fetch(`/api/verified-vibe/match-intelligence?userId=${encodeURIComponent(id)}`);
      if (!res.ok) return;
      const data = await res.json();
      standing = Array.isArray(data.matches) ? data.matches : [];
    } catch { /* non-fatal — panel just stays hidden */ }
  }

  async function handleFileUpload(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file || !$user?.id) return;
    uploadingImage = true;
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('userId', $user.id);
      fd.append('claimTag', 'general');
      fd.append('description', file.name);
      const res = await fetch('/api/verified-vibe/artifacts', { method: 'POST', body: fd });
      const data = await res.json();
      if (res.ok && data.url) {
        input = (input ? input + '\n' : '') + data.url;
      }
    } finally {
      uploadingImage = false;
      if (fileInputEl) fileInputEl.value = '';
    }
  }

  async function send(opts: { text?: string; intent?: 'summary' | 'insights' }) {
    if (sending) return;
    const text = (opts.text ?? input).trim();
    if (!text && !opts.intent) return;

    input = '';
    sending = true;

    // Add user bubble (empty for implicit intents)
    const userContent =
      opts.intent === 'summary' ? '📋 Summarize matches'
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
      const finalMessages = [
        ...messages.filter(m => !m.pending),
        { role: 'assistant' as const, content: reply, timestamp: new Date() }
      ];
      messages = finalMessages;
      persistMessages(finalMessages);

      // Surface any drafts AI Bestie prepared
      if (data.drafts?.length > 0) {
        pendingDrafts = data.drafts as Draft[];
      }
    } catch {
      const errorMessages = [
        ...messages.filter(m => !m.pending),
        { role: 'assistant' as const, content: "Sorry, something went wrong. Try again?", timestamp: new Date() }
      ];
      messages = errorMessages;
      persistMessages(errorMessages);
    } finally {
      sending = false;
      await scrollToBottom();
    }
  }

  async function sendDraft(draft: Draft) {
    sendingDraftId = draft.matchId;
    try {
      const { data: { session } } = await getSupabaseClient().auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const res = await fetch('/api/verified-vibe/chat/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ conversationId: draft.matchId, content: draft.content })
      });

      pendingDrafts = pendingDrafts.filter(d => d.matchId !== draft.matchId);

      if (res.ok) {
        messages = [...messages, {
          role: 'assistant',
          content: `✅ Sent to **${draft.matchName}**!`,
          timestamp: new Date()
        }];
      } else {
        const err = await res.json().catch(() => ({}));
        messages = [...messages, {
          role: 'assistant',
          content: `⚠️ Couldn't send to ${draft.matchName}: ${err.error ?? 'Unknown error'}`,
          timestamp: new Date()
        }];
      }
    } catch (err) {
      messages = [...messages, {
        role: 'assistant',
        content: `⚠️ Failed to send to ${draft.matchName}. Try again?`,
        timestamp: new Date()
      }];
    } finally {
      sendingDraftId = null;
      await scrollToBottom();
    }
  }

  function dismissDraft(matchId: string) {
    pendingDrafts = pendingDrafts.filter(d => d.matchId !== matchId);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send({ text: input });
    }
  }

  async function handleChip(intent: 'summary' | 'insights' | 'configure' | 'update_profile' | 'better_matches') {
    if (intent === 'configure') {
      goto('/verified-vibe/chat/ai-bestie/configure');
      return;
    }
    if (intent === 'update_profile') {
      messages = [...messages, {
        role: 'assistant',
        content: "I can update your profile from here. You can change your name, city, bio, what you're looking for, your lane, and your photos. What would you like to change?",
        timestamp: new Date()
      }];
      await scrollToBottom();
      return;
    }
    if (intent === 'better_matches') {
      await send({ text: 'How can I get better matches?' });
      return;
    }
    await send({ intent });
  }

  function formatTime(d: Date) {
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const isThisYear = d.getFullYear() === now.getFullYear();
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', ...(isThisYear ? {} : { year: 'numeric' }) });
  }

  function clearHistory() {
    localStorage.removeItem(STORAGE_KEY);
    messages = [{
      role: 'assistant',
      content: "Hey! 👋 I'm your AI Bestie — I've got eyes on all your matches so you don't have to juggle it alone. Ask me anything, or use the chips below to get a summary or fresh insights.",
      timestamp: new Date()
    }];
    feedback = new Map();
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
        <div class="bestie-name">{bestieName}</div>
        <div class="bestie-status">Your match advisor</div>
      </div>
    </div>

    <div class="header-actions">
      <button
        class="config-btn"
        onclick={() => showEcosystemExplainer = true}
        title="How the AI agents work"
        aria-label="How the AI agents work"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
      </button>
      <button
        class="config-btn"
        onclick={() => { if (confirm('Clear chat history?')) clearHistory(); }}
        title="Clear chat history"
        aria-label="Clear chat history"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
        </svg>
      </button>
      <button class="config-btn" onclick={() => goto('/verified-vibe/chat/ai-bestie/configure')} title="Configure AI Bestie">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
        </svg>
      </button>
    </div>
  </div>

  <EcosystemExplainer open={showEcosystemExplainer} perspective="woman" onClose={() => showEcosystemExplainer = false} />

  <!-- Messages -->
  <div class="messages-area">
    <!-- Proactive greeting bubble -->
    {#if greeting}
      <div class="msg-row assistant" transition:fly={{ y: 8, duration: 260 }}>
        <BestieAvatar size={32} />
        <div class="assistant-col">
          <div class="greeting-badge">✨ New from {bestieName}</div>
          <div class="bubble assistant greeting-bubble">
            {@html renderMarkdown(greeting.content)}
          </div>

          {#if !greetingFeedbackDone}
            {#if !showReasonChips}
              <div class="feedback-row">
                <span class="feedback-label">Helpful?</span>
                <button class="thumb-btn {greetingFeedback === 'up' ? 'active up' : ''}" onclick={() => submitGreetingFeedback('up')} disabled={submittingFeedback} aria-label="Helpful">👍</button>
                <button class="thumb-btn {greetingFeedback === 'down' ? 'active down' : ''}" onclick={() => submitGreetingFeedback('down')} disabled={submittingFeedback} aria-label="Not helpful">👎</button>
              </div>
            {:else}
              <div class="reason-chips-panel" transition:fly={{ y: 6, duration: 180 }}>
                <p class="reason-prompt">What was off?</p>
                <div class="reason-chips">
                  {#each REASON_CHIPS as rc}
                    <button
                      class="reason-chip {selectedReasonChip === rc.key ? 'selected' : ''}"
                      onclick={() => { selectedReasonChip = rc.key; showFeedbackNote = rc.key === 'other'; }}
                    >{rc.label}</button>
                  {/each}
                </div>
                {#if showFeedbackNote || selectedReasonChip}
                  <textarea class="feedback-note" placeholder="Optional — tell us more…" bind:value={feedbackNote} rows="2"></textarea>
                {/if}
                <div class="reason-actions">
                  <button class="reason-skip" onclick={() => { showReasonChips = false; greetingFeedbackDone = true; doSubmitFeedback(-1, null, null); }}>Skip</button>
                  <button class="reason-submit" disabled={!selectedReasonChip || submittingFeedback} onclick={submitWithReason}>{submittingFeedback ? 'Sending…' : 'Send'}</button>
                </div>
              </div>
            {/if}
          {:else}
            <div class="feedback-done">Thanks for the feedback 👍</div>
          {/if}
        </div>
      </div>
      <div class="greeting-divider"><span>Your messages</span></div>
    {/if}

    {#each messages as msg, i (i)}
      <div
        class="msg-row {msg.role}"
        transition:fly={{ y: 8, duration: 200 }}
      >
        {#if msg.role === 'assistant'}
          <BestieAvatar size={32} />
          <div class="assistant-col">
            <div class="bubble assistant {msg.pending ? 'pending' : ''}">
              {#if msg.pending}
                <span class="typing-dots"><span></span><span></span><span></span></span>
              {:else}
                {@html renderMarkdown(msg.content)}
              {/if}
            </div>
            {#if !msg.pending}
              {#if msgFeedbackDone.has(i)}
                <div class="feedback-done">Thanks for the feedback 👍</div>
              {:else if feedbackPanelIdx === i}
                <div class="reason-chips-panel" transition:fly={{ y: 6, duration: 180 }}>
                  <p class="reason-prompt">What was off?</p>
                  <div class="reason-chips">
                    {#each REASON_CHIPS as rc}
                      <button
                        class="reason-chip {msgReasonChip === rc.key ? 'selected' : ''}"
                        onclick={() => { msgReasonChip = rc.key; msgShowNote = rc.key === 'other'; }}
                      >{rc.label}</button>
                    {/each}
                  </div>
                  {#if msgShowNote || msgReasonChip}
                    <textarea class="feedback-note" placeholder="Optional — tell us more…" bind:value={msgFeedbackNote} rows="2"></textarea>
                  {/if}
                  <div class="reason-actions">
                    <button class="reason-skip" onclick={() => submitMessageFeedback(i, msg.content, null, null)}>Skip</button>
                    <button class="reason-submit" disabled={!msgReasonChip || submittingMsgFeedback} onclick={() => submitMessageFeedback(i, msg.content, msgReasonChip, msgFeedbackNote.trim() || null)}>{submittingMsgFeedback ? 'Sending…' : 'Send'}</button>
                  </div>
                </div>
              {:else}
                <div class="feedback-row">
                  <button
                    class="thumb-btn {feedback.get(i) === 'up' ? 'active up' : ''}"
                    onclick={() => rateMessage(i, 'up', msg.content)}
                    aria-label="Positive feedback"
                    data-tooltip="Positive feedback"
                  >👍</button>
                  <button
                    class="thumb-btn {feedback.get(i) === 'down' ? 'active down' : ''}"
                    onclick={() => rateMessage(i, 'down', msg.content)}
                    aria-label="Negative feedback"
                    data-tooltip="Negative feedback"
                  >👎</button>
                </div>
              {/if}
            {/if}
          </div>
        {:else}
          <div class="bubble user">
            {msg.content}
          </div>
        {/if}
      </div>
    {/each}
    <div bind:this={messagesEnd}></div>
  </div>

  <!-- Where you stand panel (precomputed match intelligence) -->
  {#if standing.length}
    <div class="stand-panel" transition:fly={{ y: 20, duration: 220 }}>
      <button class="stand-panel-head" onclick={() => standingOpen = !standingOpen} aria-expanded={standingOpen}>
        <span class="stand-panel-title">📊 Where you stand</span>
        <span class="stand-panel-toggle">{standingOpen ? '▾' : '▸'}</span>
      </button>
      {#if standingOpen}
        <div class="stand-panel-body">
          {#each standing as m}
            <div class="stand-match">
              <div class="stand-match-head">
                <span class="stand-name">{m.partnerName}</span>
                {#if (m.standingPool ?? 0) > 1}
                  <span class="stand-rank">#{m.standingRank} of {m.standingPool}</span>
                {:else}
                  <span class="stand-rank stand-rank--solo">Only match · convert</span>
                {/if}
              </div>
              {#if m.simulation?.length}
                <div class="stand-levers-label">Move the needle:</div>
                {#each m.simulation.slice(0, 3) as a}
                  <div class="stand-lever">
                    <span class="stand-lever-label">{a.label}</span>
                    <span class="stand-lever-delta">
                      trust {a.trustBefore}→{a.trustAfter}{#if (a.standingPool ?? 0) > 1 && a.standingAfter !== a.standingBefore} · #{a.standingBefore}→#{a.standingAfter}{/if}
                    </span>
                  </div>
                {/each}
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}

  <!-- Draft action cards -->
  {#if pendingDrafts.length > 0}
    <div class="drafts-panel" transition:fly={{ y: 12, duration: 200 }}>
      <div class="drafts-label">📤 Ready to send</div>
      {#each pendingDrafts as draft (draft.matchId)}
        <div class="draft-card" transition:fly={{ y: 8, duration: 150 }}>
          <div class="draft-header">
            <span class="draft-to">To <strong>{draft.matchName}</strong></span>
            <button class="draft-dismiss" onclick={() => dismissDraft(draft.matchId)} aria-label="Dismiss">✕</button>
          </div>
          <div class="draft-preview">"{draft.content}"</div>
          <button
            class="draft-send-btn"
            onclick={() => sendDraft(draft)}
            disabled={sendingDraftId === draft.matchId}
          >
            {#if sendingDraftId === draft.matchId}
              <span class="send-spinner small"></span> Sending…
            {:else}
              Send to {draft.matchName} →
            {/if}
          </button>
        </div>
      {/each}
    </div>
  {/if}

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
      rows="2"
      placeholder="Ask AI Bestie anything…"
      bind:value={input}
      onkeydown={handleKeydown}
      oninput={(e) => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 180) + 'px'; }}
      disabled={sending}
    ></textarea>
    <VoiceDictation onUse={(text) => { input = text; }} disabled={sending} />
    <input bind:this={fileInputEl} type="file" accept="image/*" style="display:none" onchange={handleFileUpload} />
    <button type="button" class="attach-btn" onclick={() => fileInputEl?.click()} disabled={sending || uploadingImage} title="Attach image" aria-label="Attach image">
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
  /* ── Layout ── */
  .bestie-screen {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-1);
    overflow: hidden;
  }

  /* ── Greeting bubble ── */
  .greeting-badge {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--accent-bright);
    margin-bottom: 4px;
  }

  .greeting-bubble {
    border-color: var(--accent-bright) !important;
    border-width: 1.5px !important;
  }

  .greeting-divider {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 4px 0 2px;
    color: var(--text-3);
    font-size: 11px;
  }
  .greeting-divider::before,
  .greeting-divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--border-1);
  }

  .feedback-label {
    font-size: 11px;
    color: var(--text-3);
    margin-right: 4px;
  }

  /* ── Reason chips ── */
  .reason-chips-panel {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 6px;
    padding: 10px 12px;
    background: var(--bg-2);
    border: 1px solid var(--border-2);
    border-radius: 12px;
    max-width: 78vw;
  }

  .reason-prompt {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-2);
    margin: 0;
  }

  .reason-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .reason-chip {
    padding: 5px 12px;
    border-radius: 999px;
    border: 1px solid var(--border-2);
    background: var(--bg-1);
    color: var(--text-2);
    font-size: 12px;
    font-family: inherit;
    cursor: pointer;
    transition: all 130ms;
  }
  .reason-chip:hover { border-color: var(--accent-bright); color: var(--accent-bright); }
  .reason-chip.selected {
    border-color: var(--accent-bright);
    background: var(--accent-tint);
    color: var(--accent-bright);
    font-weight: 600;
  }

  .feedback-note {
    width: 100%;
    background: var(--bg-1);
    border: 1px solid var(--border-1);
    border-radius: 8px;
    padding: 8px 10px;
    font-size: 13px;
    color: var(--text-1);
    font-family: inherit;
    resize: none;
    line-height: 1.5;
    box-sizing: border-box;
  }
  .feedback-note:focus { outline: none; border-color: var(--accent-bright); }

  .reason-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  .reason-skip {
    background: none;
    border: none;
    color: var(--text-3);
    font-size: 12px;
    cursor: pointer;
    padding: 4px 8px;
    font-family: inherit;
  }

  .reason-submit {
    background: var(--accent-bright);
    border: none;
    color: #ffffff;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    padding: 5px 14px;
    border-radius: 999px;
    font-family: inherit;
    transition: opacity 150ms;
  }
  .reason-submit:disabled { opacity: 0.45; cursor: not-allowed; }

  .feedback-done {
    font-size: 11px;
    color: var(--text-3);
    padding: 2px 0;
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

  .header-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-left: auto;
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
    padding: 10px 14px;
    border-radius: 16px;
    font-size: 14px;
    line-height: 1.55;
    word-break: break-word;
  }

  .bubble.assistant {
    /* max-width delegated to .assistant-col */
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    color: var(--text-1);
    border-bottom-left-radius: 4px;
  }

  .bubble.user {
    max-width: 76%;
    white-space: pre-wrap;
    background: linear-gradient(135deg, #ec4899, #a855f7);
    color: #fff;
    border-bottom-right-radius: 4px;
  }

  /* ── Assistant column (bubble + feedback) ── */
  .assistant-col {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    max-width: 76%;
    min-width: 0;
  }

  /* ── Feedback row ── */
  .feedback-row {
    display: flex;
    gap: 4px;
    padding-left: 2px;
    opacity: 0;
    transition: opacity 200ms;
  }
  .msg-row.assistant:hover .feedback-row,
  .feedback-row:has(.thumb-btn.active) {
    opacity: 1;
  }

  .thumb-btn {
    font-size: 13px;
    padding: 3px 8px;
    border-radius: 20px;
    border: 1px solid var(--border-1);
    background: var(--bg-2);
    cursor: pointer;
    line-height: 1;
    transition: all 150ms;
    opacity: 0.65;
    position: relative;
  }
  .thumb-btn:hover {
    opacity: 1;
    background: var(--bg-3);
  }

  /* ── Tooltip ── */
  .thumb-btn::after {
    content: attr(data-tooltip);
    position: absolute;
    bottom: calc(100% + 7px);
    left: 50%;
    transform: translateX(-50%);
    white-space: nowrap;
    background: rgba(15, 15, 25, 0.92);
    color: #e2e8f0;
    font-size: 11px;
    font-weight: 500;
    padding: 4px 9px;
    border-radius: 6px;
    pointer-events: none;
    opacity: 0;
    transition: opacity 150ms, transform 150ms;
    transform: translateX(-50%) translateY(4px);
    z-index: 10;
    border: 1px solid rgba(255,255,255,0.08);
  }
  .thumb-btn:hover::after {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
  /* small caret */
  .thumb-btn::before {
    content: '';
    position: absolute;
    bottom: calc(100% + 3px);
    left: 50%;
    transform: translateX(-50%);
    border: 4px solid transparent;
    border-top-color: rgba(15, 15, 25, 0.92);
    pointer-events: none;
    opacity: 0;
    transition: opacity 150ms;
    z-index: 10;
  }
  .thumb-btn:hover::before { opacity: 1; }
  .thumb-btn.active.up {
    background: rgba(34, 197, 94, 0.15);
    border-color: rgba(34, 197, 94, 0.5);
    opacity: 1;
  }
  .thumb-btn.active.down {
    background: rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.5);
    opacity: 1;
  }

  /* ── Markdown inside assistant bubbles ── */
  .bubble.assistant :global(p) {
    margin: 0 0 8px;
    line-height: 1.6;
  }
  .bubble.assistant :global(p:last-child) {
    margin-bottom: 0;
  }
  .bubble.assistant :global(strong) {
    font-weight: 700;
    color: var(--text-1);
  }
  .bubble.assistant :global(ul) {
    margin: 6px 0;
    padding-left: 18px;
  }
  .bubble.assistant :global(li) {
    margin: 3px 0;
    line-height: 1.5;
  }
  .bubble.assistant :global(br) {
    display: block;
    content: '';
    margin-top: 4px;
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
    display: grid;
    grid-template-rows: repeat(2, auto);
    grid-auto-flow: column;
    grid-auto-columns: max-content;
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
    padding: 12px 14px;
    font-size: 15px;
    color: var(--text-1);
    line-height: 1.5;
    min-height: 52px;
    max-height: 180px;
    overflow-y: auto;
    outline: none;
    transition: border-color 150ms;
  }
  .chat-input:focus {
    border-color: rgba(236, 72, 153, 0.5);
  }
  .chat-input::placeholder { color: var(--text-3); }

  .attach-btn {
    width: 34px;
    height: 34px;
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

  /* ── "Where you stand" panel ── */
  .stand-panel {
    margin: 0 16px 8px;
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    border-left: 3px solid var(--accent-bright);
    border-radius: 12px;
    flex-shrink: 0;
    overflow: hidden;
  }
  .stand-panel-head {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--text-1);
  }
  .stand-panel-title { font-size: 13px; font-weight: 700; letter-spacing: 0.02em; }
  .stand-panel-toggle { font-size: 12px; color: var(--text-3); }
  .stand-panel-body { padding: 0 14px 12px; display: flex; flex-direction: column; gap: 12px; }
  .stand-match { display: flex; flex-direction: column; gap: 6px; }
  .stand-match-head { display: flex; align-items: center; justify-content: space-between; }
  .stand-name { font-size: 13px; font-weight: 700; color: var(--text-1); }
  .stand-rank {
    font-size: 11px; font-weight: 700; color: var(--accent-bright);
    background: var(--accent-tint); padding: 2px 8px; border-radius: 999px;
  }
  .stand-rank--solo { color: var(--text-2); background: var(--bg-1); }
  .stand-levers-label { font-size: 11px; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.04em; }
  .stand-lever {
    display: flex; align-items: baseline; justify-content: space-between; gap: 8px;
    padding: 6px 8px; background: var(--bg-1); border-radius: 8px;
  }
  .stand-lever-label { font-size: 12px; color: var(--text-1); }
  .stand-lever-delta { font-size: 11px; font-weight: 700; color: var(--accent-bright); white-space: nowrap; }
  .attach-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .upload-spin {
    width: 12px;
    height: 12px;
    border: 2px solid var(--border-2);
    border-top-color: var(--accent-bright);
    border-radius: 50%;
    animation: aspin 0.6s linear infinite;
  }
  @keyframes aspin { to { transform: rotate(360deg); } }

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

  /* ── Draft panel ── */
  .drafts-panel {
    flex-shrink: 0;
    padding: 8px 16px 4px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    border-top: 1px solid rgba(255, 59, 107, 0.2);
    background: rgba(255, 59, 107, 0.04);
  }

  .drafts-label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--accent-bright);
    opacity: 0.8;
  }

  .draft-card {
    background: var(--bg-2);
    border: 1px solid rgba(255, 59, 107, 0.25);
    border-radius: 12px;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 7px;
  }

  .draft-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .draft-to {
    font-size: 12px;
    color: var(--text-2);
  }
  .draft-to strong {
    color: var(--text-1);
  }

  .draft-dismiss {
    background: none;
    border: none;
    color: var(--text-3);
    font-size: 13px;
    cursor: pointer;
    padding: 2px 4px;
    line-height: 1;
    transition: color 150ms;
  }
  .draft-dismiss:hover { color: var(--text-1); }

  .draft-preview {
    font-size: 13px;
    color: var(--text-2);
    line-height: 1.5;
    font-style: italic;
    word-break: break-word;
  }

  .draft-send-btn {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px;
    border-radius: 20px;
    background: var(--accent);
    color: #fff;
    font-size: 13px;
    font-weight: 600;
    border: none;
    cursor: pointer;
    transition: opacity 150ms, background 150ms;
  }
  .draft-send-btn:hover:not(:disabled) {
    background: var(--accent-bright);
  }
  .draft-send-btn:disabled {
    opacity: 0.55;
    cursor: default;
  }

  .send-spinner.small {
    width: 12px;
    height: 12px;
    border-width: 2px;
  }

  /* ── Mobile ── */
  @media (max-width: 767px) {
    .bestie-header { padding: 10px 12px; }
    .messages-area { padding: 12px; }
    .chips-row { padding: 6px 12px; }
    .input-bar { padding: 8px 12px 12px; }
    .bubble { max-width: 85%; font-size: 13px; }
    .drafts-panel { padding: 8px 12px 4px; }
  }
</style>
