<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { goto } from '$app/navigation';
  import { fly } from 'svelte/transition';
  import { user } from '$lib/verified-vibe/stores';
  import { getSupabaseClient } from '$lib/client/supabase';
  import { accessToken, fetchAdvisorHistory, markAdvisorThreadRead, type AdvisorKind } from '$lib/client/advisor-thread';
  import VoiceDictation from '$lib/components/VoiceDictation.svelte';
  import EcosystemExplainer from '$lib/components/EcosystemExplainer.svelte';

  /**
   * Bearer header for the advisor endpoints. They derive identity from the token
   * now and reject a body userId that disagrees, so a request without this gets a
   * 401. Returns {} when there is no session, letting the call fail cleanly as
   * unauthorized rather than throwing here.
   */
  async function authHeader(): Promise<Record<string, string>> {
    const token = await accessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }


  interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    pending?: boolean;
    /** Server row id, when this turn came from (or was written to) the stored thread. */
    id?: string;
    kind?: AdvisorKind;
    /** Set on proactive greetings — routes thumbs to the greeting-feedback endpoint. */
    greetingId?: string | null;
    /** Set on task_ack / task_result — pairs an acknowledgement with its answer. */
    taskId?: string | null;
    /** Renderer data for the task cards. Untyped JSON off the wire — read defensively. */
    payload?: Record<string, unknown> | null;
  }

  // ── Persistence ─────────────────────────────────────────────────────────────
  // The server thread is the source of truth (see $lib/client/advisor-thread).
  // localStorage is only an offline / instant-paint cache now — the 7-day TTL that
  // used to live here silently deleted real coaching history, so it's gone.
  const STORAGE_KEY = 'vv_wingman_messages_v2'; // bumped to clear old "upload in any chat" message

  function loadPersistedMessages(): ChatMessage[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return (JSON.parse(raw) as Array<{
        role: string; content: string; timestamp: string;
        id?: string; kind?: string; greetingId?: string | null;
        taskId?: string | null; payload?: Record<string, unknown> | null;
      }>).map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
        timestamp: new Date(m.timestamp),
        id: m.id,
        kind: (m.kind as AdvisorKind | undefined) ?? 'chat',
        greetingId: m.greetingId ?? null,
        taskId: m.taskId ?? null,
        payload: m.payload ?? null
      }));
    } catch { return []; }
  }

  function persistMessages(msgs: ChatMessage[]) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.filter(m => !m.pending)));
    } catch { /* quota */ }
  }

  const OPENING_LINE =
    "Hey, good to have you here. 🛡️ I've got the full picture on all your matches — and honestly, you've got more to work with than you might think. Ask me anything, or tap a chip below to get the read you need.";

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

  const CHIPS: { label: string; icon: string; intent: 'summary' | 'insights' | 'upload' | 'update_profile' | 'better_matches' }[] = [
    { label: 'Summarize matches', icon: '📋', intent: 'summary' },
    { label: 'New insights', icon: '⚡', intent: 'insights' },
    { label: 'How can I get better matches', icon: '💡', intent: 'better_matches' },
    { label: 'Update profile', icon: '✏️', intent: 'update_profile' },
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
  let showEcosystemExplainer = $state(false);

  // ── Proactive greeting state ──────────────────────────────────────────────────
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
        const fresh = {
          id: data.greetingId,
          content: data.content,
          mode: data.mode ?? 0,
          topicTags: data.topicTags ?? [],
        };
        // Greetings are persisted to the advisor thread now, so one we just hydrated
        // would otherwise render twice — once in history, once in this bubble.
        if (alreadyInThread(fresh.id, fresh.content)) return;
        greeting = fresh;
        markReadIfVisible();
      }
    } catch { /* greeting is non-critical */ }
  }

  /** True when the stored thread already carries this greeting (by id, or verbatim). */
  function alreadyInThread(greetingId: string, content: string): boolean {
    const trimmed = content.trim();
    return messages.some(m =>
      (m.greetingId && m.greetingId === greetingId) ||
      (m.role === 'assistant' && m.content.trim() === trimmed)
    );
  }

  async function submitGreetingFeedback(rating: 'up' | 'down') {
    if (greetingFeedbackDone || !greeting) return;
    greetingFeedback = rating;

    if (rating === 'down') {
      showReasonChips = true;
      return; // Wait for reason chip selection before submitting
    }

    await doSubmitFeedback(1, null, null);
  }

  async function submitWithReason() {
    if (!greeting || submittingFeedback) return;
    const chip = selectedReasonChip;
    const note = feedbackNote.trim() || null;
    await doSubmitFeedback(-1, chip, note);
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
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          greetingId: greeting.id,
          rating,
          reasonChip: chip,
          feedbackText: note,
        }),
      });
      greetingFeedbackDone = true;
    } catch { /* fail silently */ }
    finally { submittingFeedback = false; }
  }

  // Fix: make parent containers constrained so header/input stay sticky,
  // AND inject critical bubble styles at runtime to bypass CSS lazy-loading issues
  // in Capacitor's WKWebView (route-specific CSS loads asynchronously after render).
  onMount(() => {
    const style = document.createElement('style');
    style.id = 'wingman-layout-fix';
    style.textContent = [
      '.verified-vibe-content { overflow: hidden !important; }',
      '.verified-vibe-content > div { height: 100%; display: flex; flex-direction: column; }',
      // Bubble styles — must be here because SvelteKit lazy-loads route CSS which may
      // arrive after the first render, leaving bubbles unstyled in WKWebView.
      '.bubble { max-width: 78vw; padding: 10px 14px; border-radius: 16px; font-size: 14px; line-height: 1.5; word-break: break-word; }',
      '.bubble.assistant { background: #ffffff !important; border: 1px solid #F1E0E3 !important; border-bottom-left-radius: 4px !important; color: #1B1020 !important; }',
      '.bubble.user { background: #E11D54 !important; color: #ffffff !important; border-bottom-right-radius: 4px !important; font-weight: 500 !important; }',
      '.bubble.pending { padding: 14px !important; }',
      '.bubble.assistant p { color: #1B1020 !important; margin: 0 0 6px !important; }',
      '.bubble.assistant p:last-child { margin-bottom: 0 !important; }',
      '.bubble.assistant ul { color: #1B1020 !important; margin: 6px 0 !important; padding-left: 18px !important; }',
      '.bubble.assistant li { color: #1B1020 !important; }',
      '.bubble.assistant strong { color: #1B1020 !important; }',
    ].join(' ');
    document.head.appendChild(style);
    return () => style.remove();
  });

  // ── Read state ─────────────────────────────────────────────────────────────
  // Only stamp the thread read while this screen is actually in front: a reply that
  // lands on a backgrounded tab hasn't been seen, and the chat-list badge should
  // still show it.
  function markReadIfVisible() {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    void markAdvisorThreadRead();
  }

  // ── Async advisor tasks ────────────────────────────────────────────────────
  // A task-shaped ask ("help me get matches") is queued server-side: the reply is an
  // acknowledgement (kind 'task_ack'), and a cron writes the answer back into the
  // thread later as its own turn (kind 'task_result'), paired by taskId.

  /** Tasks whose answer has landed — their ack card must stop spinning. */
  let settledTaskIds = $derived.by(() => {
    const done = new Set<string>();
    for (const m of messages) {
      if (m.kind === 'task_result' && m.taskId) done.add(m.taskId);
    }
    return done;
  });

  /** True while any acknowledgement is still waiting on its result. */
  let taskPending = $derived(
    messages.some(m => m.kind === 'task_ack' && m.taskId && !settledTaskIds.has(m.taskId))
  );

  // payload is untyped JSON off the wire, so every read is defensive.
  function ackSteps(msg: ChatMessage): string[] {
    const steps = (msg.payload as { steps?: unknown } | null)?.steps;
    return Array.isArray(steps) ? steps.filter((s): s is string => typeof s === 'string') : [];
  }

  function ackEtaMinutes(msg: ChatMessage): number {
    const eta = Number((msg.payload as { etaMinutes?: unknown } | null)?.etaMinutes);
    return Number.isFinite(eta) && eta > 0 ? Math.round(eta) : 2;
  }

  function taskFailed(msg: ChatMessage): boolean {
    return (msg.payload as { failed?: boolean } | null)?.failed === true;
  }

  function resultTitle(msg: ChatMessage): string {
    if (taskFailed(msg)) return "That one didn't finish";
    const kind = (msg.payload as { kind?: string } | null)?.kind;
    return kind === 'profile_audit' ? '🔍 Your profile audit is ready' : '📊 Your match scan is ready';
  }

  /**
   * Replace the thread with the stored one. Returns false when there's nothing to
   * show (offline, or a genuinely empty thread) so callers can keep the cache.
   */
  async function hydrateFromServer(): Promise<boolean> {
    const history = await fetchAdvisorHistory();
    if (!history || history.messages.length === 0) return false;

    messages = history.messages.map(m => ({
      role: m.role,
      content: m.content,
      timestamp: new Date(m.createdAt),
      id: m.id,
      kind: m.kind,
      greetingId: m.greetingId,
      taskId: m.taskId,
      payload: m.payload
    }));
    persistMessages(messages);
    markReadIfVisible();
    return true;
  }

  // The ack card tells him he can close the app, so the result often lands with this
  // page still open and nothing else would pull it in. Poll only while a task is
  // actually outstanding, skip hidden tabs, and let the effect's teardown cancel it —
  // that covers both "the task resolved" and "he navigated away".
  const TASK_POLL_MS = 20_000;
  $effect(() => {
    if (!taskPending) return;
    const id = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void hydrateFromServer();
    }, TASK_POLL_MS);
    return () => clearInterval(id);
  });

  onMount(async () => {
    user.hydrate();

    // Paint the cached copy first so the thread isn't blank while the fetch runs.
    const persisted = loadPersistedMessages();
    if (persisted.length > 0) messages = persisted;

    // Then hydrate from the server, which is canonical. Anything only ever rendered
    // client-side (the upload confirmation, chip replies) isn't in the stored thread
    // and is intentionally dropped in favour of the real transcript.
    const hydrated = await hydrateFromServer();
    if (!hydrated && messages.length === 0) {
      messages = [{ role: 'assistant', content: OPENING_LINE, timestamp: new Date() }];
    }

    // Greeting comes after hydration so the de-dupe has history to check against;
    // both of these stay non-blocking.
    fetchGreeting();
    fetchStanding();
    await scrollToBottom();
  });

  // Coming back to the tab counts as reading whatever arrived while it was hidden —
  // and if a task was still running, that's the moment to pull its answer in.
  onMount(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (taskPending) void hydrateFromServer();
      else markReadIfVisible();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  });

  async function scrollToBottom() {
    await tick();
    messagesEnd?.scrollIntoView({ behavior: 'smooth' });
  }

  function historyForApi() {
    return messages.filter(m => !m.pending).map(m => ({ role: m.role, content: m.content }));
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

  async function rateMessage(i: number, val: 'up' | 'down', msg: ChatMessage) {
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
    await postMessageFeedback('positive', msg, null, null);
  }

  async function submitMessageFeedback(i: number, msg: ChatMessage, chip: string | null, note: string | null) {
    if (submittingMsgFeedback) return;
    submittingMsgFeedback = true;
    try {
      await postMessageFeedback('negative', msg, chip, note);
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
    msg: ChatMessage,
    reasonChip: string | null,
    feedbackText: string | null
  ) {
    // A hydrated greeting keeps its own feedback record (keyed by greetingId), so
    // thumbs on one must go to the greeting endpoint — same split the standalone
    // greeting bubble above uses. Everything else is generic message feedback.
    if (msg.kind === 'greeting' && msg.greetingId) {
      try {
        const { data: { session } } = await getSupabaseClient().auth.getSession();
        if (!session?.access_token) return;
        await fetch('/api/verified-vibe/ai-feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
          body: JSON.stringify({
            greetingId: msg.greetingId,
            rating: feedbackType === 'positive' ? 1 : -1,
            reasonChip,
            feedbackText
          })
        });
      } catch (err) {
        console.warn('[AI Wingman feedback] greeting feedback failed to save:', err);
      }
      return;
    }

    try {
      await fetch('/api/verified-vibe/ai-bestie/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({
          userId: $user?.id ?? '',
          assistantType: 'wingman',
          feedbackType,
          messageContent: msg.content,
          reasonChip,
          feedbackText
        })
      });
    } catch (err) {
      console.warn('[AI Wingman feedback] failed to save:', err);
      // Non-blocking — don't revert UI state on network errors
    }
  }

  function handleChip(intent: 'summary' | 'insights' | 'upload' | 'update_profile' | 'better_matches') {
    if (intent === 'upload') {
      showUploadSuggestions = !showUploadSuggestions;
      return;
    }
    if (intent === 'update_profile') {
      messages = [...messages, {
        role: 'assistant',
        content: "You can update your profile from here — name, city, bio, what you're looking for, your lane, and your photos. What do you want to change?",
        timestamp: new Date()
      }];
      scrollToBottom();
      return;
    }
    if (intent === 'better_matches') {
      send({ text: 'How can I get better matches?' });
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

  // Clears this device's cached copy and the on-screen thread. The stored thread is
  // untouched — Wingman keeps his memory, and a reload re-hydrates it. The confirm
  // copy says so rather than promising a delete this can't do.
  function clearHistory() {
    localStorage.removeItem(STORAGE_KEY);
    messages = [{ role: 'assistant', content: OPENING_LINE, timestamp: new Date() }];
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

  // Report delivery + render timing for an advisor reply once it has painted.
  // generatedAt is the server stamp; receivedAt is when the fetch resolved here.
  // Mirrors the AI Bestie render ping so both surfaces feed the AI Latency tab.
  function reportWingmanRenderTiming(replyMessageId: string, generatedAt: string, receivedAt: string) {
    const uid = $user?.id;
    if (!uid) return;
    // Wait for Svelte to flush the new bubble, then measure paint on the next frame.
    tick().then(() => requestAnimationFrame(() => {
      const renderedAt = new Date().toISOString();
      // No bearer here: this is a fire-and-forget analytics ping inside a
      // non-async rAF callback, and the ai-render endpoint still takes userId on
      // trust. It is on the list to harden separately.
      fetch('/api/verified-vibe/analytics/ai-render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: uid,
          matchId: uid,           // groups all of this man's advisor replies together
          replyMessageId,
          responseType: 'wingman',
          generatedAt,
          receivedAt,
          renderedAt
        })
      }).catch(() => { /* non-critical */ });
    }));
  }

  async function send(opts: { text?: string; intent?: 'summary' | 'insights' }) {
    if (sending) return;
    const text = (opts.text ?? input).trim();
    if (!text && !opts.intent) return;

    input = '';
    sending = true;

    const userContent =
      opts.intent === 'summary' ? '📋 Summarize matches'
      : opts.intent === 'insights' ? '⚡ Any new insights?'
      : text;

    messages = [...messages, { role: 'user', content: userContent, timestamp: new Date() }];
    messages = [...messages, { role: 'assistant', content: '…', timestamp: new Date(), pending: true }];
    await scrollToBottom();

    try {
      const res = await fetch('/api/verified-vibe/ai-wingman/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({
          userId: $user?.id ?? '',
          message: opts.intent ? '' : text,
          intent: opts.intent ?? 'chat',
          history: historyForApi()
        })
      });

      const receivedAt = new Date().toISOString();
      const data = await res.json();
      const reply: string = data.reply ?? data.error ?? 'Something went wrong.';

      // A task-shaped ask was queued instead of answered. The endpoint already wrote
      // his turn AND the acknowledgement, but the ack's card data (steps, ETA) only
      // comes back through history — so re-read the thread rather than rendering a
      // stripped-down ack from `reply` alone. That also arms the poll.
      if (data.taskQueued) {
        messages = messages.filter(m => !m.pending);
        const hydrated = await hydrateFromServer();
        if (!hydrated) {
          // Offline-ish: still show the acknowledgement text so the ask isn't lost.
          messages = [...messages, {
            role: 'assistant', content: reply, timestamp: new Date(),
            kind: 'task_ack', taskId: data.taskId ?? null
          }];
        }
        return;
      }

      // The endpoint persisted this turn and already stamped the thread read for a
      // reply he is watching land — only turns that arrive on their own (greetings,
      // and anything that showed up while the tab was hidden) need the client call.
      messages = [
        ...messages.filter(m => !m.pending),
        { role: 'assistant', content: reply, timestamp: new Date(), kind: 'chat' }
      ];

      // Stamp the client half of the latency record after the bubble paints, so
      // this advisor reply shows up under "AI Wingman ↔ <name>" in AI Latency.
      if (data.replyMessageId && data.generatedAt) {
        reportWingmanRenderTiming(data.replyMessageId, data.generatedAt, receivedAt);
      }
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
        onclick={() => { if (confirm("Clear this device's copy? Your saved thread stays with Wingman.")) clearHistory(); }}
        title="Clear history on this device"
        aria-label="Clear history on this device"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
        </svg>
      </button>
    </div>
  </div>

  <EcosystemExplainer open={showEcosystemExplainer} perspective="man" onClose={() => showEcosystemExplainer = false} />

  <!-- Messages -->
  <div class="messages-area">
    <!-- Proactive greeting bubble -->
    {#if greeting}
      <div class="msg-row assistant" transition:fly={{ y: 8, duration: 260 }}>
        <div class="wm-bubble-avatar">🛡️</div>
        <div class="assistant-col">
          <div class="greeting-badge">✨ New from AI Wingman</div>
          <div class="msg-ai msg-ai--greeting">
            {@html renderMarkdown(greeting.content)}
          </div>

          {#if !greetingFeedbackDone}
            {#if !showReasonChips}
              <div class="feedback-row">
                <span class="feedback-label">Helpful?</span>
                <button
                  class="thumb-btn {greetingFeedback === 'up' ? 'active up' : ''}"
                  onclick={() => submitGreetingFeedback('up')}
                  disabled={submittingFeedback}
                  aria-label="Helpful"
                >👍</button>
                <button
                  class="thumb-btn {greetingFeedback === 'down' ? 'active down' : ''}"
                  onclick={() => submitGreetingFeedback('down')}
                  disabled={submittingFeedback}
                  aria-label="Not helpful"
                >👎</button>
              </div>
            {:else}
              <div class="reason-chips-panel" transition:fly={{ y: 6, duration: 180 }}>
                <p class="reason-prompt">What was off?</p>
                <div class="reason-chips">
                  {#each REASON_CHIPS as rc}
                    <button
                      class="reason-chip {selectedReasonChip === rc.key ? 'selected' : ''}"
                      onclick={() => {
                        selectedReasonChip = rc.key;
                        showFeedbackNote = rc.key === 'other';
                      }}
                    >{rc.label}</button>
                  {/each}
                </div>
                {#if showFeedbackNote || selectedReasonChip}
                  <textarea
                    class="feedback-note"
                    placeholder="Optional — tell us more…"
                    bind:value={feedbackNote}
                    rows="2"
                  ></textarea>
                {/if}
                <div class="reason-actions">
                  <button class="reason-skip" onclick={() => { showReasonChips = false; greetingFeedbackDone = true; doSubmitFeedback(-1, null, null); }}>Skip</button>
                  <button
                    class="reason-submit"
                    disabled={!selectedReasonChip || submittingFeedback}
                    onclick={submitWithReason}
                  >{submittingFeedback ? 'Sending…' : 'Send'}</button>
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
      <div class="msg-row {msg.role}" transition:fly={{ y: 8, duration: 200 }}>
        {#if msg.role === 'assistant'}
          <div class="wm-bubble-avatar">🛡️</div>
          <div class="assistant-col">
            {#if msg.pending}
              <div class="msg-pending">
                <span class="typing-dots"><span></span><span></span><span></span></span>
              </div>

            {:else if msg.kind === 'task_ack' && msg.taskId && settledTaskIds.has(msg.taskId)}
              <!-- Its answer has landed further down, so collapse the card to a line:
                   a spinner next to a finished result reads as a bug. -->
              <div class="task-ack-settled">✓ Done — the answer is below</div>

            {:else if msg.kind === 'task_ack'}
              <div class="task-card task-card-working">
                <div class="task-card-head">
                  <span class="task-spinner" aria-hidden="true"></span>
                  <span class="task-card-title">Working on it — about {ackEtaMinutes(msg)} {ackEtaMinutes(msg) === 1 ? 'minute' : 'minutes'}</span>
                </div>
                <div class="task-card-body">{@html renderMarkdown(msg.content)}</div>
                {#if ackSteps(msg).length}
                  <!-- The server doesn't report per-step progress yet, so this is a
                       fixed "first done, second running" read — honest for a ~2 minute
                       job, and it stops the card looking inert. -->
                  <ul class="task-steps">
                    {#each ackSteps(msg) as step, si}
                      <li class="task-step {si === 0 ? 'step-done' : si === 1 ? 'step-active' : 'step-todo'}">
                        <span class="task-step-mark" aria-hidden="true">{si === 0 ? '✓' : si === 1 ? '◍' : '○'}</span>
                        <span class="task-step-label">{step}</span>
                      </li>
                    {/each}
                  </ul>
                {/if}
              </div>

            {:else if msg.kind === 'task_result'}
              <!-- Muted stripe on a give-up: that turn is an apology, not a result. -->
              <div class="task-card {taskFailed(msg) ? 'task-card-failed' : 'task-card-ready'}">
                <div class="task-card-head">
                  <span class="task-card-title">{resultTitle(msg)}</span>
                </div>
                <div class="task-card-body">{@html renderMarkdown(msg.content)}</div>
              </div>

            {:else}
              {#if msg.kind === 'greeting'}
                <div class="greeting-badge">✨ From AI Wingman</div>
              {/if}
              <div class="msg-ai {msg.kind === 'greeting' ? 'msg-ai--greeting' : ''}">
                {@html renderMarkdown(msg.content)}
              </div>
            {/if}
            <!-- No thumbs on an acknowledgement — there's nothing to rate about "on it". -->
            {#if !msg.pending && msg.kind !== 'task_ack'}
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
                    <button class="reason-skip" onclick={() => submitMessageFeedback(i, msg, null, null)}>Skip</button>
                    <button class="reason-submit" disabled={!msgReasonChip || submittingMsgFeedback} onclick={() => submitMessageFeedback(i, msg, msgReasonChip, msgFeedbackNote.trim() || null)}>{submittingMsgFeedback ? 'Sending…' : 'Send'}</button>
                  </div>
                </div>
              {:else}
                <div class="feedback-row">
                  <button
                    class="thumb-btn {feedback.get(i) === 'up' ? 'active up' : ''}"
                    onclick={() => rateMessage(i, 'up', msg)}
                    aria-label="Helpful"
                  >👍</button>
                  <button
                    class="thumb-btn {feedback.get(i) === 'down' ? 'active down' : ''}"
                    onclick={() => rateMessage(i, 'down', msg)}
                    aria-label="Not helpful"
                  >👎</button>
                </div>
              {/if}
            {/if}
          </div>
        {:else}
          <div class="msg-user">{msg.content}</div>
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

  /* ── Message bubbles ──────────────────────────────────────────────────────────
     Static class names → Svelte adds the scope hash → scoped CSS works correctly.
     For {@html} inner content (p, ul, li, strong) use :global() within the
     scoped context: compiles to .msg-ai.svelte-xxx p (no hash on p needed). */

  .msg-ai {
    max-width: 78vw;
    padding: 10px 14px;
    background: #ffffff;
    border: 1px solid #F1E0E3;
    border-radius: 16px;
    border-bottom-left-radius: 4px;
    font-size: 14px;
    line-height: 1.5;
    word-break: break-word;
    color: #1B1020;
  }
  .msg-ai--greeting {
    border-color: var(--accent-bright);
    border-width: 1.5px;
  }
  .msg-ai :global(p) { margin: 0 0 6px; color: #1B1020; }
  .msg-ai :global(p:last-child) { margin-bottom: 0; }
  .msg-ai :global(ul) { margin: 6px 0; padding-left: 18px; }
  .msg-ai :global(li) { color: #1B1020; }
  .msg-ai :global(strong) { color: #1B1020; font-weight: 600; }

  /* ── Async task cards (task_ack / task_result) ──
     Same shape as .stand-panel — white card, left accent stripe — so a queued job
     reads as part of the advisor surface rather than a new kind of object. Amber
     #EF9F27 (the app's existing amber, as in the hand-off countdowns) while it runs,
     emerald #10B981 when the answer lands, grey when it gave up. */
  .task-card {
    max-width: 78vw;
    box-sizing: border-box;
    background: #ffffff;
    border: 1px solid #F1E0E3;
    border-left: 3px solid #F1E0E3;
    border-radius: 12px;
    padding: 10px 13px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 14px;
    line-height: 1.5;
    color: #1B1020;
    word-break: break-word;
  }
  .task-card-working { border-left-color: #EF9F27; }
  .task-card-ready   { border-left-color: #10B981; }
  .task-card-failed  { border-left-color: #9CA3AF; }

  .task-card :global(p) { margin: 0 0 6px; color: #1B1020; }
  .task-card :global(p:last-child) { margin-bottom: 0; }
  .task-card :global(ul) { margin: 6px 0; padding-left: 18px; }
  .task-card :global(li) { color: #1B1020; }
  .task-card :global(strong) { color: #1B1020; font-weight: 600; }

  .task-card-head {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .task-card-title {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.01em;
  }
  .task-card-working .task-card-title { color: #B45309; }
  .task-card-ready   .task-card-title { color: #047857; }
  .task-card-failed  .task-card-title { color: var(--text-2); }

  .task-spinner {
    width: 12px;
    height: 12px;
    flex-shrink: 0;
    border: 2px solid rgba(239, 159, 39, 0.28);
    border-top-color: #EF9F27;
    border-radius: 50%;
    animation: task-spin 0.8s linear infinite;
  }
  @keyframes task-spin { to { transform: rotate(360deg); } }
  /* A permanently spinning element is a migraine trigger — hold it still instead. */
  @media (prefers-reduced-motion: reduce) {
    .task-spinner { animation: none; }
  }

  .task-card-body { min-width: 0; }

  /* ── Task steps ── */
  .task-steps {
    list-style: none;
    margin: 0;
    padding: 8px 0 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
    border-top: 1px solid #F1E0E3;
  }
  .task-step {
    display: flex;
    align-items: flex-start;
    gap: 7px;
    font-size: 12.5px;
    line-height: 1.45;
  }
  .task-step-mark {
    flex-shrink: 0;
    width: 14px;
    text-align: center;
    font-size: 11px;
    line-height: 1.6;
  }
  .step-done   { color: var(--text-2); }
  .step-done   .task-step-mark { color: #10B981; }
  .step-active { color: #1B1020; font-weight: 600; }
  .step-active .task-step-mark { color: #EF9F27; }
  .step-todo   { color: var(--text-3); }

  /* Ack whose result has arrived — collapsed to one quiet line. */
  .task-ack-settled {
    font-size: 12px;
    color: var(--text-3);
    padding: 2px 0;
  }

  .msg-user {
    max-width: 78vw;
    padding: 10px 14px;
    background: var(--accent-bright);
    color: #ffffff;
    border-radius: 16px;
    border-bottom-right-radius: 4px;
    font-size: 14px;
    line-height: 1.5;
    font-weight: 500;
    word-break: break-word;
  }

  .msg-pending {
    max-width: 78vw;
    padding: 14px;
    background: #ffffff;
    border: 1px solid #F1E0E3;
    border-radius: 16px;
    border-bottom-left-radius: 4px;
  }

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
    display: grid;
    grid-template-rows: repeat(2, auto);
    grid-auto-flow: column;
    grid-auto-columns: max-content;
    gap: 8px;
    padding: 10px 16px 6px;
    overflow-x: auto;
    flex-shrink: 0;
    scrollbar-width: none;
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
    color: #ffffff;
    flex-shrink: 0;
    transition: opacity 150ms, transform 150ms;
  }
  .send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .send-btn:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }

  .send-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(6,40,30,0.3);
    border-top-color: #ffffff;
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

  /* ── "Where you stand" panel ── */
  .stand-panel {
    margin: 0 12px 8px;
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
    border: 1px solid rgba(255, 122, 77, 0.2);
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
