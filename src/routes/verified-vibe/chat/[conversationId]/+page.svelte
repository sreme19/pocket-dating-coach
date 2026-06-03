<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { fade, slide } from 'svelte/transition';
  import { user, currentMatch, messages, isTyping, addMessage, setCurrentMatch, clearCurrentMatch, matchUserOnlineStatus, updateMatchUserOnlineStatus } from '$lib/verified-vibe/stores';
  import { subscribeToMessages, subscribeToTypingIndicator, publishTypingIndicator } from '$lib/client/supabase';
  import { subscribeToUserOnlineStatus, formatLastSeen, trackUserOnline, untrackUserOnline, updateLastActivity } from '$lib/verified-vibe/services/onlineStatusService';
  import type { Message, VerifiedVibeUser } from '$lib/verified-vibe/types';
  import type { AssistantType } from '$lib/types';
  import VoiceDictation from '$lib/components/VoiceDictation.svelte';
  import VoiceCall from '$lib/verified-vibe/components/VoiceCall.svelte';
  import * as perf from '$lib/verified-vibe/utils/perf';

  let disposeLongTasks: (() => void) | null = null;

  // Initialise from route params immediately — the $effect fires AFTER onMount,
  // so reading $page.params here ensures localStorage keys are correct from mount.
  let conversationId = $state($page.params.conversationId || '');
  let messageInput = $state('');
  let isLoading = $state(true);
  let uploadingImage = $state(false);
  let fileInputEl: HTMLInputElement | undefined;
  let error = $state<string | null>(null);
  let isSending = $state(false);
  let messagesContainer: HTMLElement | undefined;
  let isTypingLocal = $state(false);
  // True while we're awaiting a server-side AI Bestie reply to the message the
  // user just sent — drives the typing dots so the wait doesn't look broken.
  let bestieTyping = $state(false);
  let typingTimeout: ReturnType<typeof setTimeout> | null = null;
  let unsubscribeMessages: (() => void) | null = null;
  let unsubscribeTyping: (() => void) | null = null;
  let unsubscribeOnlineStatus: (() => void) | null = null;
  let optimisticMessageId = $state<string | null>(null);
  let connectionError = $state(false);
  let reconnectAttempts = $state(0);
  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY = 3000; // 3 seconds
  let activityTimeout: ReturnType<typeof setTimeout> | null = null;
  let activeAssistant = $state<AssistantType | null>(null);
  let lastMessageId = $state<string | null>(null);
  let pollInterval: ReturnType<typeof setInterval> | null = null;
  // Flips false on teardown so the detached post-send Bestie watcher stops
  // polling once the user leaves the conversation.
  let isMounted = true;
  // Upper bound on what counts as genuine delivery latency for the AI Latency
  // dashboard. Delivery = the poll gap (≤ the 5s interval, plus slack) for a
  // recipient who's actively watching. A message surfaced more than this long
  // after it was generated means the thread was just (re)opened and history is
  // being backfilled — that's staleness, not delivery, so we don't log it.
  const MAX_DELIVERY_AGE_MS = 60000; // 60s
  // Track message IDs that were auto-sent by AI Bestie (not typed by the user)
  let bestieMessageIds = $state<Set<string>>(new Set());
  let isActivating = false;
  let aiBestieActive = $state(false);
  let userIsSeed = $state(false);
  // Populated from Supabase session in onMount — used instead of $user to avoid
  // hydration race conditions where the Svelte store may still be null.
  let currentUserId = $state<string | null>(null);
  let currentUserGender = $state<string | null>(null);
  // False during the initial message render so the whole thread doesn't slide
  // in at once (N concurrent transitions = open-jank). Flipped true after the
  // first paint so only genuinely-new messages animate.
  let listReady = $state(false);

  // ── Unmatch / Block state ────────────────────────────────────────────────
  let showOptionsMenu = $state(false);
  let showUnmatchConfirm = $state(false);
  let showBlockConfirm = $state(false);
  let isUnmatching = $state(false);

  interface CoachingCard { signal: string; read: string; }
  let coachingCards = $state<Map<string, CoachingCard>>(new Map());

  // ── Coaching-card feedback (thumbs + reason chips) ──────────────────────────
  // Rendered only inside the female-owner-gated coaching card, so this UI is
  // visible to the AI Bestie owner only. Keyed by the received message id the
  // card is attached to.
  const REASON_CHIPS = [
    { key: 'too_generic',   label: 'Too generic' },
    { key: 'not_relevant',  label: 'Not relevant' },
    { key: 'wrong_tone',    label: 'Wrong tone' },
    { key: 'factually_off', label: 'Factually off' },
    { key: 'other',         label: 'Other' },
  ];
  let cardFeedback = $state<Map<string, 'up' | 'down'>>(new Map());
  let cardFeedbackDone = $state<Set<string>>(new Set());
  let feedbackPanelMsgId = $state<string | null>(null);
  let cardReasonChip = $state<string | null>(null);
  let cardFeedbackNote = $state('');
  let cardShowNote = $state(false);
  let submittingCardFeedback = $state(false);

  function resetCardPanel() {
    cardReasonChip = null;
    cardFeedbackNote = '';
    cardShowNote = false;
  }

  async function rateCard(msgId: string, val: 'up' | 'down', read: string) {
    const prev = cardFeedback.get(msgId);
    const next = new Map(cardFeedback);

    // Toggle off if the same button is clicked again
    if (prev === val) {
      next.delete(msgId);
      cardFeedback = next;
      if (val === 'down' && feedbackPanelMsgId === msgId) { feedbackPanelMsgId = null; resetCardPanel(); }
      return;
    }

    next.set(msgId, val);
    cardFeedback = next;

    if (val === 'down') {
      feedbackPanelMsgId = msgId;
      resetCardPanel();
      return;
    }

    feedbackPanelMsgId = null;
    await postCardFeedback('positive', read, null, null);
  }

  async function submitCardFeedback(msgId: string, read: string, chip: string | null, note: string | null) {
    if (submittingCardFeedback) return;
    submittingCardFeedback = true;
    try {
      await postCardFeedback('negative', read, chip, note);
      const done = new Set(cardFeedbackDone);
      done.add(msgId);
      cardFeedbackDone = done;
      feedbackPanelMsgId = null;
      resetCardPanel();
    } finally {
      submittingCardFeedback = false;
    }
  }

  async function postCardFeedback(
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
          userId: currentUserId ?? $user?.id ?? '',
          assistantType: 'bestie',
          feedbackType,
          messageContent,
          reasonChip,
          feedbackText
        })
      });
    } catch (err) {
      console.warn('[Bestie coaching feedback] failed to save:', err);
      // Non-blocking — don't revert UI state on network errors
    }
  }

  interface ArtifactNotice { id: string; text: string; }
  let artifactNotices = $state<ArtifactNotice[]>([]);

  // ── Chat upload panel (male in female chat) ────────────────────────────────
  const CHAT_UPLOAD_CATEGORIES = [
    { tag: 'wealthy',       icon: '💰', label: 'Wealth & Success',  pts: 10, examples: 'salary slip, bank balance, car, business proof' },
    { tag: 'well_traveled', icon: '✈️', label: 'Travel',            pts:  8, examples: 'passport stamps, travel photos, hotel, booking' },
    { tag: 'fitness',       icon: '💪', label: 'Fitness & Health',  pts:  5, examples: 'gym selfie, sport, workout, outdoor activity' },
    { tag: 'general',       icon: '🏆', label: 'Lifestyle',         pts:  3, examples: 'apartment, watch, nice dinner, hobby' },
    { tag: 'general',       icon: '📄', label: 'Other',             pts:  3, examples: 'anything else that shows what you\'re about' },
  ] as const;

  // Which tags to highlight as "recommended" per female archetype
  const ARCHETYPE_TOP_CATS: Record<string, string[]> = {
    spoiled_casual_woman:        ['wealthy', 'well_traveled'],
    hopeless_romantic_woman:     ['general', 'fitness'],
    rebound_healing_woman:       ['fitness', 'general'],
    untouched_heart_woman:       ['general', 'fitness'],
    forever_focused_woman:       ['wealthy', 'general'],
    traditional_matrimony_woman: ['wealthy', 'general'],
  };

  let showUploadPanel     = $state(false);
  let uploadPanelTag      = $state<string>('general');
  let matchArchetype      = $state<string | null>(null);
  let loadingMatchProfile = $state(false);

  const topCats = $derived(matchArchetype ? (ARCHETYPE_TOP_CATS[matchArchetype] ?? ['wealthy', 'general']) : ['wealthy', 'general']);

  async function openAttachPanel() {
    const isMaleInFemaleChat = currentUserGender === 'man' && $currentMatch?.gender === 'woman';
    if (!isMaleInFemaleChat) {
      fileInputEl?.click();
      return;
    }
    // Lazy-load match archetype once
    if (!matchArchetype && $currentMatch?.id && !loadingMatchProfile) {
      loadingMatchProfile = true;
      try {
        const { getSupabaseClient } = await import('$lib/client/supabase');
        const supabase = getSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`/api/verified-vibe/match-profile/${$currentMatch.id}`, {
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        });
        if (res.ok) {
          const j = await res.json();
          matchArchetype = j.data?.archetype ?? null;
        }
      } catch { /* non-critical */ }
      finally { loadingMatchProfile = false; }
    }
    showUploadPanel = true;
  }

  function selectUploadCategory(tag: string) {
    uploadPanelTag = tag;
    fileInputEl?.click();
  }

  function persistCoachingCards() {
    if (typeof localStorage === 'undefined' || !conversationId) return;
    const obj: Record<string, CoachingCard> = {};
    coachingCards.forEach((card, msgId) => { obj[msgId] = card; });
    localStorage.setItem(`bestie-cards-${conversationId}`, JSON.stringify(obj));
  }

  function loadCoachingCards() {
    if (typeof localStorage === 'undefined' || !conversationId) return;
    try {
      const raw = localStorage.getItem(`bestie-cards-${conversationId}`);
      if (raw) {
        const obj = JSON.parse(raw) as Record<string, CoachingCard>;
        coachingCards = new Map(Object.entries(obj));
      }
    } catch { /* ignore */ }
  }

  // Utility function to validate UUID format
  function isValidUUID(id: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  }

  // Get conversation ID from route and restore Bestie state + poller + coaching cards
  $effect(() => {
    conversationId = $page.params.conversationId || '';
    if (conversationId) {
      // Always restore coaching cards — they're visible regardless of active/inactive state
      loadCoachingCards();
      // currentUserGender may not be set yet at $effect time (it's loaded async in onMount).
      // We only start Bestie for women — onMount will start it if DB says active.
      const saved = localStorage.getItem(`ai-bestie-active-${conversationId}`);
      if (saved === 'true' && !activeAssistant) {
        // Defer gender check — onMount sets currentUserGender before starting poller
        activeAssistant = 'bestie'; // tentative; onMount will clear if male
      }
    }
  });

  onMount(async () => {
    const endLoad = perf.startSpan('conversation load (onMount → messages rendered)');
    disposeLongTasks = perf.observeLongTasks();
    // Expose an on-demand frame sampler: run __pdcSampleFps() in the console,
    // then immediately scroll the thread to capture jank numbers.
    try { (window as any).__pdcSampleFps = (ms?: number) => perf.sampleFps(ms); } catch { /* ignore */ }
    try {
      isLoading = true;
      error = null;
      connectionError = false;

      // Check if user is a seed user
      userIsSeed = await isSeedUser();

      // Check if AI Bestie was previously active
      const savedActiveAssistant = localStorage.getItem(`ai-bestie-active-${conversationId}`);
      if (savedActiveAssistant === 'true') {
        activeAssistant = 'bestie';
      }

      // Track current user as online
      if ($user) {
        await trackUserOnline($user.id);
      }

      // Get the auth token from Supabase
      const { getSupabaseClient } = await import('$lib/client/supabase');
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      // Store authenticated user ID directly from session — avoids race conditions
      // with the Svelte $user store (hydrateStores runs in the layout's onMount,
      // which fires after this child onMount finishes).
      currentUserId = session.user.id;

      // Fetch current user's gender so we can gate female-only UI elements (AI Bestie toggle)
      try {
        const { data: userProfile } = await supabase
          .from('verified_vibe_users')
          .select('gender')
          .eq('id', session.user.id)
          .maybeSingle();
        currentUserGender = (userProfile as any)?.gender ?? null;
        // If gender resolved to non-woman, kill any bestie state set by $effect
        if (currentUserGender !== 'woman') {
          activeAssistant = null;
          localStorage.removeItem(`ai-bestie-active-${conversationId}`);
        }
      } catch {
        // Non-critical — worst case is the toggle is shown to all users
      }

      // Fetch conversation data
      const response = await fetch(`/api/verified-vibe/chat/${conversationId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load conversation');
      }

      const data = await response.json();
      const { matchedUser, messages: initialMessages, aiBestieActive: bestieActive } = data.data;

      aiBestieActive = bestieActive ?? true;

      // If bestie is active in the DB, restore activeAssistant.
      // Only for female users — male users never run Bestie on their side.
      if (aiBestieActive && !activeAssistant && currentUserGender === 'woman') {
        activeAssistant = 'bestie';
        localStorage.setItem(`ai-bestie-active-${conversationId}`, 'true');
      }

      // Start the live-message poller for EVERY conversation — this is what
      // makes incoming messages appear without a manual refresh.
      startMessagePoller();

      // Set current match in store
      setCurrentMatch(conversationId, matchedUser);

      // Load initial messages
      if (initialMessages && Array.isArray(initialMessages)) {
        messages.set(initialMessages);
      }

      // Restore any coaching cards from localStorage now that messages are loaded.
      // (loadCoachingCards is also called in the $effect, but $effect runs after
      //  onMount so we call it here too to guarantee cards are visible immediately.)
      loadCoachingCards();

      // Mark this conversation as read — clears the unread badge on the chat list.
      // Fire-and-forget: non-blocking, doesn't affect UX if it fails.
      if (currentUserId && conversationId) {
        fetch('/api/verified-vibe/chat/mark-read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ matchId: conversationId, userId: currentUserId })
        }).catch(() => { /* non-critical */ });
      }

      // Restore any in-progress draft (survives HMR reloads)
      try {
        const draft = sessionStorage.getItem(`draft-${conversationId}`);
        if (draft) messageInput = draft;
      } catch { /* ignore */ }

      // Realtime disabled: anon key can't subscribe to RLS-protected tables
      // Auto-response uses polling instead (startBestiePoller)

      // Subscribe to match user's online status
      // if (matchedUser) {
      //   subscribeToRealtimeOnlineStatus(matchedUser.id);
      // }

      // Scroll to bottom
      setTimeout(() => {
        scrollToBottom();
        // Initial batch has now painted (without per-message slide); enable
        // animation so subsequent incoming messages slide in.
        listReady = true;
        endLoad({ messages: $messages.length });
        // Surface which live-update mechanism (if any) is active. If both are
        // false the user MUST refresh/re-open to see new messages — this is the
        // root cause of the "manual refresh" complaint.
        perf.plog('live-update mode', {
          poller: !!pollInterval,
          realtime: !!unsubscribeMessages,
          gender: currentUserGender,
          bestieActive: aiBestieActive
        });
      }, 100);
    } catch (err) {
      console.error('Error loading conversation:', err);
      error = err instanceof Error ? err.message : 'An error occurred';
    } finally {
      isLoading = false;
    }
  });


  onDestroy(() => {
    // Stop the detached post-send Bestie watcher (if mid-wait).
    isMounted = false;

    // Unsubscribe from realtime updates
    if (unsubscribeMessages) {
      unsubscribeMessages();
    }

    if (unsubscribeTyping) {
      unsubscribeTyping();
    }

    if (unsubscribeOnlineStatus) {
      unsubscribeOnlineStatus();
    }

    // Clear polling interval + visibility listener
    if (pollInterval) {
      clearInterval(pollInterval);
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }

    // Clear typing timeout
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }

    // Clear activity timeout
    if (activityTimeout) {
      clearTimeout(activityTimeout);
    }

    // Untrack user online status
    if ($user) {
      untrackUserOnline();
    }

    // Clear current match
    clearCurrentMatch();

    // Stop perf long-task observer
    if (disposeLongTasks) disposeLongTasks();
  });

  /**
   * Subscribe to realtime online status updates
   */
  function subscribeToRealtimeOnlineStatus(matchedUserId: string) {
    try {
      unsubscribeOnlineStatus = subscribeToUserOnlineStatus(
        matchedUserId,
        (status) => {
          updateMatchUserOnlineStatus(status.isOnline, status.lastSeen);
          connectionError = false;
          reconnectAttempts = 0;
        }
      );
    } catch (err) {
      console.error('Failed to subscribe to online status:', err);
      // Don't treat online status errors as critical
    }
  }

  /**
   * Subscribe to realtime message updates
   */
  function subscribeToRealtimeMessages() {
    try {
      unsubscribeMessages = subscribeToMessages(
        conversationId,
        (newMessage) => {
          // Transform database message to Message type
          const message: Message = {
            id: newMessage.id,
            matchId: newMessage.match_id,
            senderId: newMessage.sender_id,
            content: newMessage.content,
            createdAt: new Date(newMessage.created_at)
          };

          // Add message to store if not already present (avoid duplicates)
          messages.update((msgs) => {
            const exists = msgs.some((m) => m.id === message.id);
            if (!exists) {
              return [...msgs, message];
            }
            return msgs;
          });

          // AI Bestie auto-responses are generated server-side (chat/send
          // endpoint) so they fire even when this app is closed. No client send.

          scrollToBottom();
          connectionError = false;
          reconnectAttempts = 0;
        },
        (err) => {
          console.error('Realtime message subscription error:', err);
          connectionError = true;
          attemptReconnect();
        }
      );
    } catch (err) {
      console.error('Failed to subscribe to messages:', err);
      connectionError = true;
      attemptReconnect();
    }
  }

  /**
   * Subscribe to realtime typing indicators
   */
  function subscribeToRealtimeTyping() {
    if (!$user) return;

    try {
      unsubscribeTyping = subscribeToTypingIndicator(
        conversationId,
        $user.id,
        (isTypingStatus, typingUserId) => {
          isTyping.set(isTypingStatus);
          if (isTypingStatus) {
            scrollToBottom();
          }
        },
        (err) => {
          console.error('Typing indicator subscription error:', err);
          // Don't treat typing indicator errors as critical
        }
      );
    } catch (err) {
      console.error('Failed to subscribe to typing indicators:', err);
      // Don't treat typing indicator errors as critical
    }
  }

  /**
   * Attempt to reconnect to realtime subscriptions
   */
  function attemptReconnect() {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      error = 'Connection lost. Please refresh the page to reconnect.';
      return;
    }

    reconnectAttempts++;
    setTimeout(() => {
      console.log(`Attempting to reconnect (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
      
      // Unsubscribe from old subscriptions
      if (unsubscribeMessages) {
        unsubscribeMessages();
      }
      if (unsubscribeTyping) {
        unsubscribeTyping();
      }

      // Resubscribe
      subscribeToRealtimeMessages();
      if ($user) {
        subscribeToRealtimeTyping();
      }
    }, RECONNECT_DELAY);
  }

  /**
   * Scroll to bottom of messages
   */
  // `force` (sends, initial load) always scrolls. Otherwise (poll-driven new
  // messages) we only scroll when the user is already near the bottom, so we
  // don't yank them away while they're reading earlier messages.
  // Uses instant scroll — repeated `smooth` scrolls stacked up and caused jank,
  // especially in the Android WebView.
  function scrollToBottom(force = true) {
    const el = messagesContainer;
    if (!el) return;
    if (!force) {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (distanceFromBottom > 120) return;
    }
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }

  /**
   * Handle message input change
   */
  function handleInputChange(e: Event) {
    const target = e.target as HTMLTextAreaElement;
    messageInput = target.value;

    // Auto-grow the textarea
    target.style.height = 'auto';
    target.style.height = Math.min(target.scrollHeight, 160) + 'px';

    // Persist draft so HMR reloads don't wipe it
    if (conversationId) {
      try { sessionStorage.setItem(`draft-${conversationId}`, target.value); } catch { /* ignore */ }
    }

    // Update last activity
    if ($user) {
      updateLastActivity();
    }

    // Show typing indicator
    if (!isTypingLocal && messageInput.trim().length > 0) {
      isTypingLocal = true;
      // Notify server that user is typing
      notifyTyping(true);
    }

    // Clear existing timeout
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }

    // Set timeout to hide typing indicator
    typingTimeout = setTimeout(() => {
      isTypingLocal = false;
      notifyTyping(false);
    }, 3000);
  }

  /**
   * Notify server that user is typing
   */
  async function notifyTyping(isTyping: boolean) {
    if (!$user) return;

    try {
      await publishTypingIndicator(conversationId, $user.id, isTyping);
    } catch (err) {
      console.error('Error notifying typing:', err);
      // Don't show error to user for typing indicator failures
    }
  }

  async function handleFileUpload(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    const userId = currentUserId ?? $user?.id;
    if (!file || !userId) return;

    const isMaleInFemaleChat = currentUserGender === 'man' && $currentMatch?.gender === 'woman';
    // Close the panel immediately so the user sees the upload in progress
    showUploadPanel = false;

    uploadingImage = true;
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('userId', userId);
      fd.append('claimTag', isMaleInFemaleChat ? uploadPanelTag : 'general');
      fd.append('description', file.name);
      const res = await fetch('/api/verified-vibe/artifacts', { method: 'POST', body: fd });
      const data = await res.json();
      if (res.ok) {
        if (isMaleInFemaleChat) {
          const matchName = $currentMatch?.firstName ?? 'your match';
          const pts = data.trustPoints ?? 3;
          artifactNotices = [...artifactNotices, {
            id: 'artifact-' + Date.now(),
            text: `🔒 Stored as your trust proof — ${matchName} can't see this. +${pts} trust pts`
          }];
          scrollToBottom();
        } else if (data.url) {
          messageInput = (messageInput ? messageInput + '\n' : '') + data.url;
        }
      }
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      uploadPanelTag = 'general';
      uploadingImage = false;
      if (fileInputEl) fileInputEl.value = '';
    }
  }

  /**
   * Handle send message with optimistic update
   */
  async function handleSendMessage() {
    if (!messageInput.trim()) return;
    const endSend = perf.startSpan('send → server ack');
    const endOptimistic = perf.startSpan('send → optimistic bubble (input latency)');

    // Resolve the current user ID — prefer the session-populated local var over
    // the Svelte store so sends work even before hydrateStores() completes.
    const userId = currentUserId ?? $user?.id ?? null;
    if (!userId) return;

    try {
      isSending = true;
      const content = messageInput.trim();
      messageInput = '';
      isTypingLocal = false;
      try { sessionStorage.removeItem(`draft-${conversationId}`); } catch { /* ignore */ }

      // Update last activity
      await updateLastActivity();

      // Clear typing timeout and notify
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }
      await notifyTyping(false);

      // Create optimistic message
      const optimisticId = 'optimistic-' + Date.now();
      const optimisticMessage: Message = {
        id: optimisticId,
        matchId: conversationId,
        senderId: userId,
        content,
        createdAt: new Date()
      };

      // Add optimistic message to UI immediately
      optimisticMessageId = optimisticId;
      addMessage(optimisticMessage);
      endOptimistic();
      scrollToBottom();

      // If the recipient is a woman with AI Bestie active, the server will reply
      // on her behalf (synchronously, inside this send request). Show the typing
      // dots while we wait so the gap reads as "she's replying", not "broken".
      const expectBestieReply =
        currentUserGender === 'man' && $currentMatch?.gender === 'woman' && aiBestieActive;
      if (expectBestieReply) {
        bestieTyping = true;
        scrollToBottom();
      }

      // Send message to server
      const { getSupabaseClient } = await import('$lib/client/supabase');
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch('/api/verified-vibe/chat/send', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`
        },
        body: JSON.stringify({
          conversationId: conversationId,
          content
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send message');
      }

      const data = await response.json();
      const newMessage: Message = data.data.message;

      // Replace optimistic message with real message.
      // The realtime subscription / poll may have already appended the real
      // message (keyed on its DB id, which differs from the optimistic id). If
      // so, just drop the optimistic placeholder — otherwise overwriting it in
      // place would leave two copies of the real message in the thread.
      messages.update((msgs) => {
        const realExists = msgs.some((m) => m.id === newMessage.id);
        const index = msgs.findIndex((m) => m.id === optimisticId);
        if (index < 0) {
          // Optimistic entry already replaced/removed elsewhere — nothing to do.
          return msgs;
        }
        if (realExists) {
          // Real message already present: remove the optimistic duplicate.
          return msgs.filter((m) => m.id !== optimisticId);
        }
        msgs[index] = newMessage;
        return msgs;
      });

      optimisticMessageId = null;
      error = null;
      endSend({ ok: true });
      scrollToBottom();

      // Bestie now generates her reply OUT OF BAND (the server returns before
      // it's done), so it isn't in the DB yet. Watch for it with a short
      // fast-poll loop, keeping the typing dots up until it lands. Fire-and-
      // forget so the input frees up immediately (isSending clears in finally)
      // — the user can keep typing while she "replies".
      if (expectBestieReply) {
        void waitForBestieReply();
      }
    } catch (err) {
      endSend({ ok: false });
      console.error('Error sending message:', err);
      error = err instanceof Error ? err.message : 'Failed to send message';
      bestieTyping = false;

      // Remove optimistic message on error
      if (optimisticMessageId) {
        messages.update((msgs) => msgs.filter((m) => m.id !== optimisticMessageId));
        optimisticMessageId = null;
      }

      // Restore message input on error
      messageInput = messageInput;
    } finally {
      // NOTE: bestieTyping is intentionally NOT cleared here — waitForBestieReply
      // owns it on the success path so the dots persist until her reply arrives.
      isSending = false;
    }
  }

  /**
   * Handle key press in message input
   */
  function handleKeyPress(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }

  /**
   * Format message timestamp
   */
  function formatTime(date: Date): string {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();

    // Same day
    if (diff < 86400000) {
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }

    // Yesterday
    if (diff < 172800000) {
      return 'Yesterday';
    }

    // Older
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  /**
   * Check if message is sent by current user
   */
  function isSentMessage(message: Message): boolean {
    const myId = currentUserId ?? $user?.id ?? null;
    return myId !== null && message.senderId === myId;
  }

  /**
   * Handle back button click
   */
  function handleBackClick() {
    goto('/verified-vibe/chat');
  }

  /**
   * Handle profile click to view matched user's profile
   */
  function handleProfileClick() {
    if ($currentMatch) {
      goto(`/verified-vibe/match-profile/${$currentMatch.id}?from=/verified-vibe/chat/${conversationId}`);
    }
  }

  /**
   * Check if current user is a seed user (for testing/demo purposes)
   */
  async function isSeedUser(): Promise<boolean> {
    try {
      const { getSupabaseClient } = await import('$lib/client/supabase');
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      return user?.email?.endsWith('@seed.vv') ?? false;
    } catch (err) {
      console.error('Failed to check seed user status:', err);
      return false;
    }
  }

  /**
   * Clear all chat messages for current conversation (seed users only)
   */
  async function handleClearChat() {
    try {
      const confirmed = window.confirm(
        'Are you sure you want to clear all chat messages? This action cannot be undone.'
      );
      if (!confirmed) return;

      const { getSupabaseClient } = await import('$lib/client/supabase');
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`/api/verified-vibe/chat/${conversationId}/clear`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to clear chat');
      }

      const data = await response.json();
      console.log(`Cleared ${data.data.deletedCount} messages`);

      // Clear messages from store
      messages.set([]);
      error = null;
    } catch (err) {
      console.error('Error clearing chat:', err);
      error = err instanceof Error ? err.message : 'Failed to clear chat messages';
    }
  }

  /**
   * Poll for new messages when AI Bestie is active
   * DISABLED - causing too many messages
   */
  // async function pollForNewMessages() {
  //   ...
  // }

  /**
   * Dismiss error message
   */
  function dismissError() {
    error = null;
  }

  /**
   * Handle activate assistant
   */
  async function handleActivateAssistant(assistantType: AssistantType) {
    if (isActivating || activeAssistant) return;
    isActivating = true;
    try {
      activeAssistant = assistantType;
      localStorage.setItem(`ai-bestie-active-${conversationId}`, 'true');

      // Persist AI Bestie active status to Supabase so Adrian's UI can show the intro card
      const { getSupabaseClient } = await import('$lib/client/supabase');
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      await fetch('/api/verified-vibe/ai-bestie/activate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`
        },
        body: JSON.stringify({ conversationId })
      });
      aiBestieActive = true;

      // Don't send opening message - only generate coaching cards for Adrian's messages
      // await sendAIBestieOpeningMessage();
      startMessagePoller();
    } catch (err) {
      console.error('Failed to activate assistant:', err);
      activeAssistant = null;
      localStorage.removeItem(`ai-bestie-active-${conversationId}`);
    } finally {
      isActivating = false;
    }
  }

  // Polls the thread for new messages + refreshed coaching fields. Runs for
  // EVERY conversation (not just AI-assistant ones) — without it, plain chats
  // had no live updates at all and the user had to refresh/re-open to see new
  // messages. Realtime stays disabled (anon key can't subscribe to RLS tables).
  // One poll pass. Extracted so it can run both on the interval and immediately
  // when the page regains visibility (returning from another screen / app).
  async function pollOnce(): Promise<number> {
      if (!(currentUserId ?? $user?.id) || !conversationId) return 0;
      const endPoll = perf.startSpan('poll cycle (fetch + merge)');
      try {
        const { getSupabaseClient } = await import('$lib/client/supabase');
        const supabase = getSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`/api/verified-vibe/chat/${conversationId}`, {
          headers: { 'Authorization': `Bearer ${session?.access_token || ''}` }
        });
        if (!res.ok) return 0;
        const rawBody = await res.text();
        // Timestamp the moment we received the payload — the "received" stage for
        // any AI message this poll surfaces (used by the AI Latency dashboard).
        const receivedAt = new Date().toISOString();
        const { data } = JSON.parse(rawBody);
        const fetched: Message[] = (data.messages || []).map((m: any) => ({
          id: m.id,
          matchId: m.matchId || conversationId,
          senderId: m.senderId,
          content: m.content,
          isAi: m.isAi ?? false,
          aiSignal: m.aiSignal ?? undefined,
          aiRead: m.aiRead ?? undefined,
          createdAt: new Date(m.createdAt)
        }));
        // Merge new messages AND refresh coaching fields on existing ones
        // (a male's message may gain ai_read after the server-side Bestie runs).
        // AI messages surfaced this pass are collected so we can report their
        // render timing once the DOM has painted them.
        let surfacedAi: Message[] = [];
        messages.update(existing => {
          const byId = new Map(fetched.map(m => [m.id, m]));
          // Reconcile coaching fields on existing rows, and swap any pending
          // optimistic placeholder for its real server row (matched by
          // sender+content). Without this, a poll that lands while /send is
          // still blocked on AI Bestie generation would APPEND the real row
          // alongside the optimistic bubble — the visible duplicate.
          const claimed = new Set<string>();
          const merged = existing.map(m => {
            if (m.id.startsWith('optimistic-')) {
              const real = fetched.find(f =>
                !claimed.has(f.id) &&
                !existing.some(e => e.id === f.id) &&
                f.senderId === m.senderId &&
                f.content === m.content
              );
              if (real) { claimed.add(real.id); return real; }
              return m;
            }
            const f = byId.get(m.id);
            return f && (f.aiRead !== m.aiRead || f.aiSignal !== m.aiSignal) ? { ...m, aiRead: f.aiRead, aiSignal: f.aiSignal } : m;
          });
          const mergedIds = new Set(merged.map(m => m.id));
          const newMsgs = fetched.filter(m => !mergedIds.has(m.id) && !claimed.has(m.id));
          if (newMsgs.length > 0) {
            scrollToBottom(false);
            // Only AI messages young enough that "received now" reflects a real
            // delivery (poll gap) — not a backfill of history surfaced on (re)open.
            surfacedAi = newMsgs.filter(m => (m as any).isAi && perf.messageAgeMs(m.createdAt) <= MAX_DELIVERY_AGE_MS);
            // Staleness of the freshest arriving message = how long it sat on the
            // server before this poll surfaced it. This is the headline
            // "delay before a message shows up" number.
            const newest = newMsgs.reduce((a, b) => (a.createdAt > b.createdAt ? a : b));
            perf.plog('new messages surfaced', {
              count: newMsgs.length,
              freshestAgeMs: Math.round(perf.messageAgeMs(newest.createdAt)),
              threadSize: existing.length + newMsgs.length
            });
          }
          return [...merged, ...newMsgs];
        });
        // NOTE: Bestie auto-responses are now generated SERVER-SIDE (in the chat
        // /send endpoint) so they fire even when this app is closed. The client
        // no longer sends replies — it only fetches + displays them.
        endPoll({ payloadKB: +(rawBody.length / 1024).toFixed(1), fetched: fetched.length });
        // After the surfaced AI messages paint, report their delivery/render
        // timing for the AI Latency dashboard (fire-and-forget).
        if (surfacedAi.length > 0) {
          await tick();
          requestAnimationFrame(() => {
            const renderedAt = new Date().toISOString();
            for (const m of surfacedAi) reportAiRenderTiming(m, receivedAt, renderedAt);
          });
        }
        // Report how many AI replies this pass surfaced so the post-send watcher
        // knows when Bestie's reply has landed and can drop the typing dots.
        return surfacedAi.length;
      } catch (err) {
        console.error('Message poller error:', err);
        endPoll({ error: true });
        return 0;
      }
  }

  /**
   * After a send that expects a Bestie reply, poll faster than the 5s background
   * interval until her reply lands — keeping the typing dots up until then (or
   * until a timeout, so they never hang if generation fails server-side).
   * Bestie now generates out-of-band, so the reply isn't ready when /send
   * returns; this is what bridges that gap for the sender.
   */
  async function waitForBestieReply() {
    const startedAt = Date.now();
    const TIMEOUT_MS = 25000;
    const INTERVAL_MS = 1200;
    try {
      while (isMounted && Date.now() - startedAt < TIMEOUT_MS) {
        await new Promise((r) => setTimeout(r, INTERVAL_MS));
        if (!isMounted) break;
        const aiSurfaced = await pollOnce();
        if (aiSurfaced > 0) break;
      }
    } finally {
      bestieTyping = false;
    }
  }

  // Reports an AI message's client-side delivery + render timing to the AI
  // Latency dashboard. Fire-and-forget — never blocks or breaks the chat.
  function reportAiRenderTiming(msg: Message, receivedAt: string, renderedAt: string) {
    const uid = currentUserId ?? $user?.id;
    if (!uid) return;
    fetch('/api/verified-vibe/analytics/ai-render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: uid,
        matchId: conversationId,
        replyMessageId: msg.id,
        responseType: 'bestie',
        generatedAt: new Date(msg.createdAt).toISOString(),
        receivedAt,
        renderedAt
      })
    }).catch(() => { /* non-critical */ });
  }

  function handleVisibilityChange() {
    // Coming back to the conversation — fetch right away instead of waiting out
    // the rest of the 5s interval. Directly fixes the "switch screens and come
    // back, nothing's there until I refresh" case.
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      pollOnce();
    }
  }

  function startMessagePoller() {
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(pollOnce, 5000);
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }
  }

  // NOTE: Bestie auto-responses are generated SERVER-SIDE (chat/send endpoint)
  // so they fire even when this app is closed. The old client-side
  // generateAndSendAIBestieResponse() was removed — the client only fetches and
  // displays replies + coaching cards now.

  async function sendAIBestieOpeningMessage() {
    try {
      if (!$user || !$currentMatch) {
        console.error('Missing user or currentMatch');
        return;
      }

      isSending = true;
      console.log('Sending AI Bestie opening message to:', $currentMatch.firstName);

      // Generate opening message from AI Bestie speaking on behalf of the female
      // user (in the bestie's own voice — never impersonating her)
      const { getSupabaseClient } = await import('$lib/client/supabase');
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();

      console.log('Calling API with conversationId:', conversationId);

      const response = await fetch('/api/verified-vibe/ai-bestie/opening-message', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`
        },
        body: JSON.stringify({
          conversationId: conversationId,
          matchName: $currentMatch.firstName,
          ownerName: $user.firstName
        })
      });

      console.log('API response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('API error:', errorData);
        throw new Error(errorData.error || 'Failed to generate opening message');
      }

      const data = await response.json();
      console.log('Generated message:', data.message);
      
      const messageContent = data.message;

      // Send the message through the chat API to actually deliver it to Adrian
      const sendResponse = await fetch('/api/verified-vibe/chat/send', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`
        },
        body: JSON.stringify({
          conversationId: conversationId,
          content: messageContent
        })
      });

      if (!sendResponse.ok) {
        const errorData = await sendResponse.json();
        console.error('Send error:', errorData);
        throw new Error(errorData.error || 'Failed to send message');
      }

      const sentData = await sendResponse.json();
      console.log('Message sent successfully:', sentData);

      // The message will be added to the UI through the realtime subscription
      // But we can also add it optimistically
      const aiMessage: Message = {
        id: sentData.data.message.id,
        matchId: conversationId,
        senderId: $user.id,
        content: messageContent,
        createdAt: new Date(sentData.data.message.createdAt)
      };

      console.log('Adding message to chat:', aiMessage);
      addMessage(aiMessage);
      scrollToBottom();
    } catch (err) {
      console.error('Failed to send AI Bestie message:', err);
      error = err instanceof Error ? err.message : 'Failed to send AI Bestie message';
    } finally {
      isSending = false;
    }
  }

  /**
   * Handle deactivate assistant
   */
  async function handleDeactivateAssistant() {
    try {
      console.log('Deactivating assistant');
      activeAssistant = null;
      
      // Remove active state from localStorage
      localStorage.removeItem(`ai-bestie-active-${conversationId}`);
      
      // Stop polling if active
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
      
      console.log('Assistant deactivated successfully');
    } catch (err) {
      console.error('Failed to deactivate assistant:', err);
    }
  }

  // ── Unmatch / Block handlers ─────────────────────────────────────────────

  function toggleOptionsMenu() {
    showOptionsMenu = !showOptionsMenu;
  }

  function closeOptionsMenu() {
    showOptionsMenu = false;
  }

  async function handleUnmatch() {
    if (!$currentMatch || !conversationId || isUnmatching) return;
    isUnmatching = true;
    showUnmatchConfirm = false;
    showOptionsMenu = false;

    try {
      const { getSupabaseClient } = await import('$lib/client/supabase');
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch('/api/verified-vibe/unmatch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify({
          matchedUserId: $currentMatch.id,
          matchId: conversationId,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to unmatch');
      }

      // Navigate back to chat list
      goto('/verified-vibe/chat');
    } catch (err) {
      console.error('Unmatch error:', err);
      error = err instanceof Error ? err.message : 'Failed to unmatch';
    } finally {
      isUnmatching = false;
    }
  }

  async function handleBlock() {
    if (!$currentMatch || isUnmatching) return;
    isUnmatching = true;
    showBlockConfirm = false;
    showOptionsMenu = false;

    try {
      const { getSupabaseClient } = await import('$lib/client/supabase');
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch('/api/verified-vibe/block-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify({
          blockedUserId: $currentMatch.id,
          matchId: conversationId,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to block user');
      }

      // Navigate back to chat list
      goto('/verified-vibe/chat');
    } catch (err) {
      console.error('Block error:', err);
      error = err instanceof Error ? err.message : 'Failed to block user';
    } finally {
      isUnmatching = false;
    }
  }
</script>

<div class="chat-interface-screen">
  <!-- Header -->
  <div class="chat-header" transition:slide={{ duration: 400, delay: 0, axis: 'y' }}>
    <button class="back-btn" onclick={handleBackClick} aria-label="Go back">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
    </button>

    <div class="chat-header-content">
      {#if $currentMatch}
        <button class="match-info" onclick={handleProfileClick} aria-label="View profile">
          {#if $currentMatch.avatar}
            <img src={$currentMatch.avatar} alt={$currentMatch.firstName} class="match-avatar" />
          {:else}
            <div class="match-avatar-placeholder">
              {$currentMatch.firstName.charAt(0).toUpperCase()}
            </div>
          {/if}
          <div class="match-details">
            <h1 class="chat-title">
              {$currentMatch.firstName}, {$currentMatch.age}
            </h1>
            <p class="chat-subtitle">
              {#if $matchUserOnlineStatus?.isOnline}
                <span class="online-indicator"></span>
                Online
              {:else if $matchUserOnlineStatus?.lastSeen}
                <span class="offline-indicator"></span>
                Last seen {formatLastSeen($matchUserOnlineStatus.lastSeen)}
              {:else}
                <span class="offline-indicator"></span>
                Offline
              {/if}
            </p>
          </div>
        </button>

        <button
          class="clear-chat-btn"
          onclick={handleClearChat}
          title="Clear all chat messages"
          aria-label="Clear chat messages"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6h14zM10 11v6M14 11v6"/>
          </svg>
        </button>
      {/if}
    </div>

    <!-- Options menu (unmatch/block) -->
    <div class="header-options">
      <button
        class="options-btn"
        onclick={toggleOptionsMenu}
        aria-label="Conversation options"
        aria-expanded={showOptionsMenu}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>
        </svg>
      </button>

      {#if showOptionsMenu}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="options-backdrop" onclick={closeOptionsMenu}></div>
        <div class="options-dropdown" transition:fade={{ duration: 150 }}>
          <button class="options-item" onclick={() => { showUnmatchConfirm = true; showOptionsMenu = false; }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
            <span>Unmatch</span>
          </button>
          <button class="options-item options-item--danger" onclick={() => { showBlockConfirm = true; showOptionsMenu = false; }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><path d="M4.93 4.93l14.14 14.14"/>
            </svg>
            <span>Block</span>
          </button>
        </div>
      {/if}
    </div>
  </div>

  <!-- Error Banner -->
  {#if error}
    <div class="error-banner" transition:slide={{ duration: 300, axis: 'y' }}>
      <p class="error-text">{error}</p>
      <button class="error-close" onclick={dismissError} aria-label="Dismiss error">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>
  {/if}

  <!-- Connection Status Banner -->
  {#if connectionError}
    <div class="connection-banner" transition:slide={{ duration: 300, axis: 'y' }}>
      <div class="connection-status">
        <div class="connection-indicator disconnected"></div>
        <p class="connection-text">
          {reconnectAttempts > 0 
            ? `Reconnecting... (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`
            : 'Connection lost. Attempting to reconnect...'}
        </p>
      </div>
    </div>
  {/if}

  <!-- AI Bestie Intro Card — visible to Adrian (male) only when AI Bestie is active -->
  {#if aiBestieActive && $currentMatch?.gender === 'woman' && currentUserGender === 'woman'}
    {@const cleared = Math.min($messages.filter(m => m.senderId === $user?.id).length, 5)}
    {@const total = 5}
    <div class="bestie-intro-card" transition:slide={{ duration: 300, axis: 'y' }}>
      <div class="bestie-intro-header">
        <div class="bestie-intro-icon">✨</div>
        <div class="bestie-intro-title">
          <span class="bestie-intro-name">AI Bestie</span>
          <span class="bestie-intro-subtitle">{$currentMatch.firstName.toUpperCase()}'S AI BESTIE</span>
        </div>
      </div>
      <p class="bestie-intro-body">
        <strong>{$currentMatch.firstName}</strong> asked AI Bestie to get to know you first.
        Anything you share here, <strong>{$currentMatch.firstName}</strong> sees — directly,
        or summarised by AI Bestie. Bring your best.
      </p>
      <div class="bestie-intro-divider"></div>
      <div class="bestie-intro-progress-section">
        <div class="bestie-intro-progress-header">
          <span class="bestie-intro-joins"><strong>{$currentMatch.firstName}</strong> joins in</span>
          <span class="bestie-intro-cleared">{cleared}/{total} cleared</span>
        </div>
        <div class="bestie-intro-progress-bar">
          <div class="bestie-intro-progress-star">★</div>
          <div class="bestie-intro-bar-track">
            <div class="bestie-intro-bar-fill" style="width: {(cleared / total) * 100}%"></div>
          </div>
        </div>
        <p class="bestie-intro-drop-in">She can also drop in herself, any time.</p>
      </div>
      <div class="bestie-intro-divider"></div>
      <p class="bestie-intro-footer">
        Not a fit? AI Bestie will let {$currentMatch.firstName} know kindly.
        Your replies still go toward strengthening <em>your</em> profile.
      </p>
    </div>
  {/if}

  <!-- Messages Container -->
  <div class="messages-container" bind:this={messagesContainer}>
    {#if isLoading}
      <div class="loading-state" transition:fade={{ duration: 300 }}>
        <div class="spinner"></div>
        <p>Loading conversation...</p>
      </div>
    {:else if $messages.length === 0}
      <div class="empty-state" transition:fade={{ duration: 300 }}>
        <div class="empty-icon">💬</div>
        <h2>Start the conversation</h2>
        <p>Say hello and get to know {$currentMatch?.firstName}!</p>
      </div>
    {:else}
      <div class="messages-list" transition:fade={{ duration: 300 }}>
        {#each $messages as message, index (message.id)}
          {@const isSent = isSentMessage(message)}
          {@const isBestie = message.isAi || bestieMessageIds.has(message.id)}
          {@const ownerName = isSent ? ($user?.firstName ?? 'You') : ($currentMatch?.firstName ?? 'Them')}
          {@const senderName = isBestie ? `${ownerName}'s AI Bestie` : ownerName}
          {@const senderInitial = senderName.charAt(0).toUpperCase()}
          {@const senderAvatar = isSent ? null : $currentMatch?.avatar}
          <div
            class="message-group"
            class:sent={isSent}
            class:received={!isSent}
            class:bestie-sent={isBestie}
            class:optimistic={message.id.startsWith('optimistic-')}
            transition:slide={{ duration: listReady ? 220 : 0 }}
          >
            <!-- Avatar -->
            {#if !isSent}
              <div class="msg-avatar msg-avatar--received">
                {#if senderAvatar}
                  <img src={senderAvatar} alt={senderName} class="msg-avatar-img" />
                {:else}
                  <span class="msg-avatar-initial">{senderInitial}</span>
                {/if}
              </div>
            {/if}

            <div class="msg-body">
              <!-- Sender name -->
              <span class="msg-sender-name" class:msg-sender-name--sent={isSent && !isBestie} class:msg-sender-name--bestie={isBestie}>
                {senderName}
              </span>
              <div class="message-bubble">
                <p class="message-content">{message.content}</p>
                <span class="message-time">{formatTime(message.createdAt)}</span>
              </div>
            </div>

            <!-- Sent avatar (right side) -->
            {#if isSent}
              <div class="msg-avatar msg-avatar--sent">
                {#if isBestie}
                  <span class="msg-avatar-initial msg-avatar-initial--bestie">✨</span>
                {:else}
                  <span class="msg-avatar-initial msg-avatar-initial--user">{($user?.firstName ?? 'Y').charAt(0).toUpperCase()}</span>
                {/if}
              </div>
            {/if}
          </div>
          {@const card = (message.aiRead ? { signal: message.aiSignal ?? '✅', read: message.aiRead } : coachingCards.get(message.id))}
          {#if !isSentMessage(message) && card && currentUserGender === 'woman'}
            <div class="bestie-coaching-card" transition:slide={{ duration: 300 }}>
              <div class="bestie-card-header">
                <span class="bestie-label">✨ AI Bestie</span>
                <span class="bestie-signal">{card.signal}</span>
              </div>
              <p class="bestie-read">{card.read}</p>

              {#if cardFeedbackDone.has(message.id)}
                <div class="card-feedback-done">Thanks for the feedback 👍</div>
              {:else if feedbackPanelMsgId === message.id}
                <div class="reason-chips-panel" transition:slide={{ duration: 180 }}>
                  <p class="reason-prompt">What was off?</p>
                  <div class="reason-chips">
                    {#each REASON_CHIPS as rc}
                      <button
                        type="button"
                        class="reason-chip {cardReasonChip === rc.key ? 'selected' : ''}"
                        onclick={() => { cardReasonChip = rc.key; cardShowNote = rc.key === 'other'; }}
                      >{rc.label}</button>
                    {/each}
                  </div>
                  {#if cardShowNote || cardReasonChip}
                    <textarea class="feedback-note" placeholder="Optional — tell us more…" bind:value={cardFeedbackNote} rows="2"></textarea>
                  {/if}
                  <div class="reason-actions">
                    <button type="button" class="reason-skip" onclick={() => submitCardFeedback(message.id, card.read, null, null)}>Skip</button>
                    <button type="button" class="reason-submit" disabled={!cardReasonChip || submittingCardFeedback} onclick={() => submitCardFeedback(message.id, card.read, cardReasonChip, cardFeedbackNote.trim() || null)}>{submittingCardFeedback ? 'Sending…' : 'Send'}</button>
                  </div>
                </div>
              {:else}
                <div class="card-feedback-row">
                  <button
                    type="button"
                    class="card-thumb {cardFeedback.get(message.id) === 'up' ? 'active up' : ''}"
                    onclick={() => rateCard(message.id, 'up', card.read)}
                    aria-label="This read was helpful"
                  >👍</button>
                  <button
                    type="button"
                    class="card-thumb {cardFeedback.get(message.id) === 'down' ? 'active down' : ''}"
                    onclick={() => rateCard(message.id, 'down', card.read)}
                    aria-label="This read was off"
                  >👎</button>
                </div>
              {/if}
            </div>
          {/if}
        {/each}

        <!-- Typing Indicator -->
        {#if $isTyping || bestieTyping}
          <div class="message-group received" transition:slide={{ duration: 300 }}>
            <div class="message-bubble typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        {/if}

        <!-- Private artifact notices (visible only to male user, not sent as messages) -->
        {#each artifactNotices as notice (notice.id)}
          <div class="artifact-notice-row" transition:slide={{ duration: 300 }}>
            <div class="artifact-notice-bubble">{notice.text}</div>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Upload Panel — male-only, shown instead of direct file picker -->
  {#if showUploadPanel && currentUserGender === 'man'}
    <!-- Backdrop -->
    <div
      class="up-backdrop"
      onclick={() => showUploadPanel = false}
      aria-hidden="true"
      transition:fade={{ duration: 180 }}
    ></div>

    <!-- Sheet -->
    <div
      class="up-sheet"
      role="dialog"
      aria-modal="true"
      aria-label="Upload proof"
      transition:slide={{ axis: 'y', duration: 320 }}
    >
      <div class="up-handle"></div>

      <div class="up-header">
        <span class="up-title">🛡️ Upload proof, build trust</span>
        <button class="up-close" onclick={() => showUploadPanel = false} aria-label="Close">✕</button>
      </div>

      <!-- Benefits callout -->
      <div class="up-benefits">
        <p class="up-benefit">📈 <strong>Trust score goes up</strong> — verified profiles rank higher in Discover</p>
        <p class="up-benefit">✨ <strong>{$currentMatch?.firstName ?? 'Your match'}'s AI Bestie sees this</strong> — she coaches them to see you in the best light</p>
        <p class="up-benefit">🔒 <strong>Stays private</strong> — never visible in your chats with them, only here</p>
      </div>

      <!-- Face requirement note -->
      <div class="up-face-note">
        <span class="up-face-icon">🤳</span>
        <p>Your face must be visible in the photo — that's what makes it <strong>verifiable</strong>, not just a screenshot.</p>
      </div>

      <p class="up-section-label">
        WHAT WOULD IMPRESS {($currentMatch?.firstName ?? 'HER').toUpperCase()}?
      </p>

      <div class="up-categories">
        {#each CHAT_UPLOAD_CATEGORIES as cat, i}
          {@const shownTagsBefore = new Set(CHAT_UPLOAD_CATEGORIES.slice(0, i).map(c => c.tag))}
          {@const isTop = topCats.includes(cat.tag) && !shownTagsBefore.has(cat.tag)}
          <button
            class="up-cat"
            class:up-cat-top={isTop}
            onclick={() => selectUploadCategory(cat.tag)}
            type="button"
          >
            <span class="up-cat-icon">{cat.icon}</span>
            <div class="up-cat-body">
              <div class="up-cat-row">
                <span class="up-cat-label">{cat.label}</span>
                <span class="up-cat-pts">+{cat.pts} pts</span>
                {#if isTop}
                  <span class="up-cat-rec">✨ Recommended</span>
                {/if}
              </div>
              <span class="up-cat-examples">{cat.examples}</span>
            </div>
          </button>
        {/each}
      </div>

      <div class="up-footer-pad"></div>
    </div>
  {/if}

  <!-- Input Area -->
  <div class="input-area" transition:slide={{ duration: 400, delay: 0, axis: 'y' }}>
    <!-- Voice call: the male match can request a live call with her AI bestie -->
    {#if currentUserGender === 'man' && $currentMatch?.gender === 'woman'}
      <VoiceCall conversationId={conversationId} ownerName={$currentMatch?.firstName ?? 'her'} />
    {/if}

    <div class="input-wrapper">
      <textarea
        class="message-input"
        placeholder="Type a message..."
        bind:value={messageInput}
        oninput={handleInputChange}
        onkeypress={handleKeyPress}
        disabled={isSending || isLoading}
        aria-label="Message input"
        rows="1"
      ></textarea>

      <!-- Voice dictation — available for both Neha and Adrian -->
      <VoiceDictation
        onUse={(text) => { messageInput = text; }}
        disabled={isSending || isLoading}
      />

      <!-- Image / document upload (PDC-50) -->
      <input
        bind:this={fileInputEl}
        type="file"
        accept="image/*"
        style="display:none"
        onchange={handleFileUpload}
      />
      <button
        class="attach-btn {uploadingImage ? 'uploading' : ''}"
        type="button"
        onclick={openAttachPanel}
        disabled={isSending || isLoading || uploadingImage}
        title="Upload image or document"
        aria-label="Attach image"
      >
        {#if uploadingImage}
          <span class="upload-spin"></span>
        {:else}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
          </svg>
        {/if}
      </button>

      <!-- AI Bestie Toggle Button — only shown to female users (it's their feature) -->
      {#if currentUserGender === 'woman' || $user?.gender === 'woman'}
        <button
          class="bestie-toggle-btn"
          class:bestie-on={activeAssistant}
          onclick={async () => {
            if (activeAssistant) {
              await handleDeactivateAssistant();
            } else {
              await handleActivateAssistant('bestie');
            }
          }}
          disabled={isSending || isLoading}
          title={activeAssistant ? 'Pause AI Bestie' : 'Ask AI Bestie'}
          aria-label={activeAssistant ? 'Pause AI Bestie' : 'Ask AI Bestie'}
        >
          {#if activeAssistant}
            <!-- Active: glowing double-sparkle -->
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2c0 0 1 4.5 2.5 6S22 12 22 12s-5.5 1.5-7.5 4S12 22 12 22s-1-4.5-2.5-6S2 12 2 12s5.5-1.5 7.5-4S12 2 12 2z"/>
            </svg>
          {:else}
            <!-- Inactive: subtle single sparkle -->
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 3c0 0 .9 3.6 2 5s5 4 5 4-3.6.9-5 2-2 5-2 5-.9-3.6-2-5-5-2-5-2 3.6-.9 5-2 2-5 2-5z"/>
              <path d="M5 5l.5 1.5L7 7l-1.5.5L5 9l-.5-1.5L3 7l1.5-.5z" opacity="0.5"/>
            </svg>
          {/if}
        </button>
      {/if}

      <button
        class="send-btn"
        onclick={handleSendMessage}
        disabled={!messageInput.trim() || isSending || isLoading}
        aria-label="Send message"
        title={isSending ? 'Sending...' : 'Send message (Enter)'}
      >
        {#if isSending}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="1" />
            <circle cx="19" cy="12" r="1" />
            <circle cx="5" cy="12" r="1" />
          </svg>
        {:else}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16.6915026,12.4744748 L3.50612381,13.2599618 C3.19218622,13.2599618 3.03521743,13.4170592 3.03521743,13.5741566 L1.15159189,20.0151496 C0.8376543,20.8006365 0.99,21.89 1.77946707,22.52 C2.41,22.99 3.50612381,23.1 4.13399899,22.8429026 L21.714504,14.0454487 C22.6563168,13.5741566 23.1272231,12.6315722 22.9702544,11.6889879 L4.13399899,1.16346272 C3.34915502,0.9 2.40734225,1.00636533 1.77946707,1.4776575 C0.994623095,2.10604706 0.837654326,3.0486314 1.15159189,3.99701575 L3.03521743,10.4380088 C3.03521743,10.5951061 3.19218622,10.7522035 3.50612381,10.7522035 L16.6915026,11.5376905 C16.6915026,11.5376905 17.1624089,11.5376905 17.1624089,12.0089827 C17.1624089,12.4744748 16.6915026,12.4744748 16.6915026,12.4744748 Z" />
          </svg>
        {/if}
      </button>
    </div>
  </div>
</div>

<!-- Unmatch confirmation modal -->
{#if showUnmatchConfirm}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-backdrop" onclick={() => showUnmatchConfirm = false} transition:fade={{ duration: 150 }}>
    <div class="modal-card" onclick={(e) => e.stopPropagation()}>
      <h3 class="modal-title">Unmatch?</h3>
      <p class="modal-text">
        This will remove your match with {$currentMatch?.firstName ?? 'this person'}. You won't be able to message each other, but they may still appear in your discovery feed.
      </p>
      <div class="modal-actions">
        <button class="modal-btn modal-btn--cancel" onclick={() => showUnmatchConfirm = false} disabled={isUnmatching}>
          Cancel
        </button>
        <button class="modal-btn modal-btn--danger" onclick={handleUnmatch} disabled={isUnmatching}>
          {isUnmatching ? 'Removing…' : 'Unmatch'}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Block confirmation modal -->
{#if showBlockConfirm}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-backdrop" onclick={() => showBlockConfirm = false} transition:fade={{ duration: 150 }}>
    <div class="modal-card" onclick={(e) => e.stopPropagation()}>
      <h3 class="modal-title">Block {$currentMatch?.firstName ?? 'this person'}?</h3>
      <p class="modal-text">
        They won't be able to see your profile or contact you. This also removes your match. This action cannot be undone.
      </p>
      <div class="modal-actions">
        <button class="modal-btn modal-btn--cancel" onclick={() => showBlockConfirm = false} disabled={isUnmatching}>
          Cancel
        </button>
        <button class="modal-btn modal-btn--danger" onclick={handleBlock} disabled={isUnmatching}>
          {isUnmatching ? 'Blocking…' : 'Block'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .chat-interface-screen {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-1);
  }

  /* Header */
  .chat-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-1);
    gap: 12px;
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

  .back-btn:hover {
    background: var(--bg-3);
    border-color: var(--border-2);
  }

  .back-btn:active {
    transform: scale(0.95);
  }

  .chat-header-content {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .match-info {
    display: flex;
    align-items: center;
    gap: 12px;
    cursor: pointer;
    transition: opacity 200ms ease;
    background: none;
    border: none;
    padding: 0;
    font-family: inherit;
    flex: 1;
    min-width: 0;
  }

  .match-info:hover {
    opacity: 0.8;
  }

  .match-info:active {
    opacity: 0.6;
  }

  .match-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
  }

  .match-avatar-placeholder {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--accent-tint);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    color: var(--accent);
    flex-shrink: 0;
  }

  .match-details {
    flex: 1;
    min-width: 0;
    overflow: hidden;
  }

  .chat-title {
    font-size: 16px;
    font-weight: 600;
    margin: 0;
    color: var(--text-1);
  }

  .chat-subtitle {
    font-size: 12px;
    color: var(--text-3);
    margin: 2px 0 0 0;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .online-indicator {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #10b981;
    display: inline-block;
  }

  .offline-indicator {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--text-3);
    display: inline-block;
  }

  .clear-chat-btn {
    width: 40px;
    height: 40px;
    border-radius: 8px;
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    display: grid;
    place-items: center;
    cursor: pointer;
    color: #ef4444;
    transition: all 200ms ease;
    flex-shrink: 0;
  }

  .clear-chat-btn:hover {
    background: rgba(239, 68, 68, 0.1);
    border-color: #ef4444;
  }

  .clear-chat-btn:active {
    transform: scale(0.95);
  }

  .header-spacer {
    width: 40px;
    flex-shrink: 0;
  }

  /* Error Banner */
  .error-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 16px;
    background: rgba(239, 68, 68, 0.1);
    border-bottom: 1px solid rgba(239, 68, 68, 0.3);
  }

  .error-text {
    font-size: 13px;
    color: #ef4444;
    margin: 0;
    flex: 1;
  }

  .error-close {
    width: 24px;
    height: 24px;
    border-radius: 4px;
    background: transparent;
    border: none;
    display: grid;
    place-items: center;
    cursor: pointer;
    color: #ef4444;
    transition: all 200ms ease;
    flex-shrink: 0;
  }

  .error-close:hover {
    background: rgba(239, 68, 68, 0.1);
  }

  .error-close:active {
    transform: scale(0.95);
  }

  /* Connection Status Banner */
  .connection-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 16px;
    background: rgba(251, 146, 60, 0.1);
    border-bottom: 1px solid rgba(251, 146, 60, 0.3);
  }

  .connection-status {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
  }

  .connection-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .connection-indicator.disconnected {
    background: #fb923c;
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  .connection-text {
    font-size: 13px;
    color: #fb923c;
    margin: 0;
  }

  /* Messages Container */
  .messages-container {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    padding: 16px;
    gap: 12px;
  }

  /* Loading State */
  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 40px 20px;
    flex: 1;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--border-1);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .loading-state p {
    color: var(--text-3);
    font-size: 14px;
    margin: 0;
  }

  /* Empty State */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 40px 20px;
    flex: 1;
  }

  .empty-icon {
    font-size: 48px;
    margin-bottom: 8px;
  }

  .empty-state h2 {
    font-size: 18px;
    font-weight: 600;
    margin: 0;
    color: var(--text-1);
  }

  .empty-state p {
    font-size: 14px;
    color: var(--text-3);
    margin: 0;
    text-align: center;
  }

  /* Messages List */
  .messages-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .message-group {
    display: flex;
    gap: 8px;
    align-items: flex-end;
  }

  .message-group.sent {
    justify-content: flex-end;
  }

  .message-group.received {
    justify-content: flex-start;
  }

  /* WhatsApp-style avatar */
  .msg-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    flex-shrink: 0;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 700;
    margin-bottom: 2px;
  }

  .msg-avatar--received { order: 0; }
  .msg-avatar--sent     { order: 2; }

  .msg-avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .msg-avatar-initial {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-4);
    color: var(--text-2);
    font-size: 13px;
    font-weight: 700;
  }

  .msg-avatar-initial--bestie {
    background: linear-gradient(135deg, #7c3aed, #db2777);
    color: #fff;
    font-size: 14px;
  }

  .msg-avatar-initial--user {
    background: var(--accent-dim);
    color: var(--accent-bright);
  }

  /* Message body wrapper (name + bubble stacked) */
  .msg-body {
    display: flex;
    flex-direction: column;
    gap: 3px;
    max-width: 72%;
    order: 1;
  }

  .message-group.sent .msg-body {
    align-items: flex-end;
  }

  .msg-sender-name {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-3);
    letter-spacing: 0.01em;
    padding: 0 4px;
  }

  .msg-sender-name--sent {
    color: var(--accent-bright);
  }

  .msg-sender-name--bestie {
    background: linear-gradient(90deg, #a855f7, #ec4899);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .message-bubble {
    max-width: 100%;
    padding: 10px 14px;
    border-radius: 12px;
    word-wrap: break-word;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .message-group.sent .message-bubble {
    background: var(--accent-bright);
    color: #06281e;
    border-bottom-right-radius: 4px;
    box-shadow: 0 2px 8px rgba(52, 211, 153, 0.2);
  }

  .message-group.received .message-bubble {
    background: rgba(52, 211, 153, 0.12);
    color: var(--text-1);
    border: 1px solid rgba(52, 211, 153, 0.25);
    border-bottom-left-radius: 4px;
  }

  /* AI Bestie auto-sent messages — purple/pink to distinguish from user's own green bubbles */
  .message-group.bestie-sent .message-bubble {
    background: linear-gradient(135deg, #7c3aed, #db2777);
    color: #fff;
    border-bottom-right-radius: 4px;
    box-shadow: 0 2px 10px rgba(139, 92, 246, 0.35);
  }

  /* Optimistic message styling */
  .message-group.optimistic .message-bubble {
    opacity: 0.7;
  }

  .message-content {
    font-size: 14px;
    margin: 0;
    line-height: 1.4;
    word-break: break-word;
  }

  .message-time {
    font-size: 11px;
    opacity: 0.7;
    margin-top: 2px;
  }

  /* Typing Indicator */
  .typing-indicator {
    display: flex;
    gap: 4px;
    align-items: center;
    padding: 10px 14px;
  }

  .typing-indicator span {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--text-3);
    animation: typing 1.4s infinite;
  }

  .typing-indicator span:nth-child(2) {
    animation-delay: 0.2s;
  }

  .typing-indicator span:nth-child(3) {
    animation-delay: 0.4s;
  }

  @keyframes typing {
    0%, 60%, 100% {
      opacity: 0.5;
      transform: translateY(0);
    }
    30% {
      opacity: 1;
      transform: translateY(-8px);
    }
  }

  /* Input Area */
  .input-area {
    padding: 12px 16px;
    border-top: 1px solid var(--border-1);
    background: var(--bg-1);
  }

  .input-wrapper {
    display: flex;
    gap: 8px;
    align-items: flex-end;
  }

  .message-input {
    flex: 1;
    padding: 12px 14px;
    border: 1px solid var(--border-1);
    border-radius: 12px;
    background: var(--bg-2);
    color: var(--text-1);
    font-size: 15px;
    font-family: inherit;
    resize: none;
    min-height: 48px;
    max-height: 160px;
    line-height: 1.5;
    overflow-y: auto;
    transition: border-color 200ms ease;
  }

  .message-input:focus {
    outline: none;
    border-color: var(--accent);
    background: var(--bg-1);
  }

  .message-input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .send-btn {
    width: 40px;
    height: 40px;
    border-radius: 8px;
    background: var(--accent);
    border: none;
    display: grid;
    place-items: center;
    cursor: pointer;
    color: #06281e;
    transition: all 200ms ease;
    flex-shrink: 0;
  }

  .send-btn:hover:not(:disabled) {
    transform: scale(1.05);
  }

  .send-btn:active:not(:disabled) {
    transform: scale(0.95);
  }

  .send-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* ── Attach button ── */
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

  .attach-btn:hover:not(:disabled) {
    color: var(--accent-bright);
    border-color: var(--accent-bright);
  }

  .attach-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .upload-spin {
    width: 14px;
    height: 14px;
    border: 2px solid var(--border-2);
    border-top-color: var(--accent-bright);
    border-radius: 50%;
    animation: uspin 0.6s linear infinite;
  }
  @keyframes uspin { to { transform: rotate(360deg); } }

  /* Toggle Button */
  /* ── AI Bestie toggle button ── */
  .bestie-toggle-btn {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    background: rgba(168, 85, 247, 0.08);
    border: 1.5px solid rgba(168, 85, 247, 0.3);
    display: grid;
    place-items: center;
    cursor: pointer;
    color: #a855f7;
    transition: all 200ms ease;
    flex-shrink: 0;
    position: relative;
  }

  .bestie-toggle-btn:hover:not(:disabled) {
    background: rgba(168, 85, 247, 0.16);
    border-color: rgba(168, 85, 247, 0.55);
    transform: scale(1.05);
  }

  /* Active state — full gradient, glow, pulsing ring */
  .bestie-toggle-btn.bestie-on {
    background: linear-gradient(135deg, #ec4899, #a855f7);
    border-color: transparent;
    color: #fff;
    box-shadow: 0 0 0 3px rgba(168, 85, 247, 0.25), 0 4px 12px rgba(168, 85, 247, 0.35);
    animation: bestie-pulse 2.4s ease-in-out infinite;
  }

  .bestie-toggle-btn.bestie-on:hover:not(:disabled) {
    box-shadow: 0 0 0 4px rgba(168, 85, 247, 0.35), 0 6px 16px rgba(168, 85, 247, 0.45);
    transform: scale(1.06);
  }

  .bestie-toggle-btn:active:not(:disabled) {
    transform: scale(0.94);
  }

  .bestie-toggle-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  @keyframes bestie-pulse {
    0%, 100% { box-shadow: 0 0 0 3px rgba(168,85,247,0.25), 0 4px 12px rgba(168,85,247,0.35); }
    50%       { box-shadow: 0 0 0 5px rgba(236,72,153,0.2),  0 4px 16px rgba(168,85,247,0.5);  }
  }

  /* AI Bestie Intro Card (shown to Adrian) */
  .bestie-intro-card {
    margin: 12px 16px 0;
    padding: 16px;
    background: linear-gradient(135deg, rgba(168, 85, 247, 0.12) 0%, rgba(139, 92, 246, 0.08) 100%);
    border: 1px solid rgba(168, 85, 247, 0.3);
    border-top: 3px solid #a855f7;
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .bestie-intro-header {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .bestie-intro-icon {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: linear-gradient(135deg, #a855f7, #7c3aed);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    flex-shrink: 0;
  }

  .bestie-intro-title {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .bestie-intro-name {
    font-size: 18px;
    font-weight: 700;
    color: #c084fc;
    font-style: italic;
  }

  .bestie-intro-subtitle {
    font-size: 10px;
    font-weight: 700;
    color: rgba(168, 85, 247, 0.7);
    letter-spacing: 1px;
  }

  .bestie-intro-body {
    font-size: 13px;
    color: var(--text-1);
    margin: 0;
    line-height: 1.6;
  }

  .bestie-intro-body strong {
    color: #c084fc;
  }

  .bestie-intro-divider {
    border: none;
    border-top: 1px dashed rgba(168, 85, 247, 0.25);
  }

  .bestie-intro-progress-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .bestie-intro-progress-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .bestie-intro-joins {
    font-size: 13px;
    color: var(--text-1);
  }

  .bestie-intro-joins strong {
    color: var(--text-1);
  }

  .bestie-intro-cleared {
    font-size: 12px;
    color: var(--text-3);
    font-family: monospace;
  }

  .bestie-intro-progress-bar {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .bestie-intro-progress-star {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #7c3aed;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    color: white;
    flex-shrink: 0;
  }

  .bestie-intro-bar-track {
    flex: 1;
    height: 8px;
    background: rgba(168, 85, 247, 0.2);
    border-radius: 4px;
    overflow: hidden;
  }

  .bestie-intro-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #7c3aed, #a855f7);
    border-radius: 4px;
    transition: width 600ms ease;
    min-width: 4px;
  }

  .bestie-intro-drop-in {
    font-size: 12px;
    color: var(--text-3);
    margin: 0;
  }

  .bestie-intro-footer {
    font-size: 12px;
    color: var(--text-3);
    margin: 0;
    line-height: 1.5;
  }

  /* AI Bestie Coaching Card */
  .bestie-coaching-card {
    align-self: flex-start;
    max-width: 80%;
    margin-left: 4px;
    padding: 10px 14px;
    background: rgba(168, 85, 247, 0.08);
    border: 1px solid rgba(168, 85, 247, 0.25);
    border-left: 3px solid #a855f7;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .bestie-card-header {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .bestie-label {
    font-size: 11px;
    font-weight: 600;
    color: #a855f7;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .bestie-signal {
    font-size: 16px;
    line-height: 1;
  }

  .bestie-read {
    font-size: 12px;
    color: var(--text-2);
    margin: 0;
    line-height: 1.5;
    font-style: italic;
  }

  /* ── Coaching-card feedback (AI Bestie owner only) ──────────────────────── */
  .card-feedback-row {
    display: flex;
    gap: 6px;
    margin-top: 2px;
  }

  .card-thumb {
    background: transparent;
    border: 1px solid rgba(168, 85, 247, 0.25);
    border-radius: 6px;
    padding: 2px 7px;
    font-size: 13px;
    line-height: 1.2;
    cursor: pointer;
    opacity: 0.65;
    transition: opacity 0.15s, border-color 0.15s, background 0.15s;
  }

  .card-thumb:hover { opacity: 1; border-color: #a855f7; }
  .card-thumb.active { opacity: 1; }
  .card-thumb.active.up { background: rgba(34, 197, 94, 0.18); border-color: rgba(34, 197, 94, 0.5); }
  .card-thumb.active.down { background: rgba(239, 68, 68, 0.18); border-color: rgba(239, 68, 68, 0.5); }

  .card-feedback-done {
    font-size: 11px;
    color: #a855f7;
    font-weight: 600;
  }

  .reason-chips-panel {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 2px;
  }

  .reason-prompt {
    font-size: 11px;
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
    background: transparent;
    border: 1px solid rgba(168, 85, 247, 0.3);
    color: var(--text-2);
    border-radius: 999px;
    padding: 3px 10px;
    font-size: 11px;
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s, background 0.15s;
  }

  .reason-chip:hover { border-color: #a855f7; color: #c98bff; }
  .reason-chip.selected {
    background: rgba(168, 85, 247, 0.2);
    border-color: #a855f7;
    color: #d7b3ff;
  }

  .feedback-note {
    width: 100%;
    box-sizing: border-box;
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(168, 85, 247, 0.25);
    border-radius: 6px;
    color: var(--text-1);
    font-size: 12px;
    padding: 6px 8px;
    resize: vertical;
    font-family: inherit;
  }

  .feedback-note:focus { outline: none; border-color: #a855f7; }

  .reason-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .reason-skip,
  .reason-submit {
    border-radius: 6px;
    padding: 4px 12px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid transparent;
  }

  .reason-skip {
    background: transparent;
    border-color: rgba(255, 255, 255, 0.15);
    color: var(--text-2);
  }

  .reason-skip:hover { border-color: rgba(255, 255, 255, 0.3); }

  .reason-submit {
    background: #a855f7;
    color: #fff;
  }

  .reason-submit:disabled { opacity: 0.45; cursor: not-allowed; }
  .reason-submit:not(:disabled):hover { background: #9333ea; }

  /* Private artifact notice — visible to sender only, never stored as a message */
  .artifact-notice-row {
    display: flex;
    justify-content: flex-end;
  }

  .artifact-notice-bubble {
    max-width: 78%;
    padding: 8px 12px;
    background: rgba(100, 116, 139, 0.12);
    border: 1px dashed rgba(100, 116, 139, 0.35);
    border-radius: 10px;
    font-size: 12px;
    color: var(--text-3);
    font-style: italic;
    line-height: 1.4;
  }

  /* ── Chat upload panel ── */
  .up-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    z-index: 50;
  }

  .up-sheet {
    position: fixed;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 100%;
    max-width: 430px;
    background: var(--bg-1);
    border-radius: 20px 20px 0 0;
    z-index: 51;
    max-height: 85vh;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  .up-handle {
    width: 40px;
    height: 4px;
    background: var(--border-2);
    border-radius: 2px;
    margin: 12px auto 0;
    flex-shrink: 0;
  }

  .up-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 20px 4px;
    flex-shrink: 0;
  }

  .up-title {
    font-size: 15px;
    font-weight: 700;
    color: var(--text-1);
  }

  .up-close {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    display: grid;
    place-items: center;
    cursor: pointer;
    color: var(--text-3);
    font-size: 12px;
  }

  .up-benefits {
    margin: 12px 20px;
    background: rgba(16, 185, 129, 0.07);
    border: 1px solid rgba(16, 185, 129, 0.2);
    border-radius: 12px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 7px;
    flex-shrink: 0;
  }

  .up-benefit {
    font-size: 12px;
    color: var(--text-2);
    margin: 0;
    line-height: 1.4;
  }

  .up-benefit strong {
    color: #34d399;
  }

  .up-face-note {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    margin: 0 20px;
    padding: 10px 12px;
    background: rgba(245, 158, 11, 0.08);
    border: 1px solid rgba(245, 158, 11, 0.25);
    border-radius: 10px;
  }

  .up-face-icon {
    font-size: 18px;
    flex-shrink: 0;
    line-height: 1.4;
  }

  .up-face-note p {
    font-size: 12px;
    color: var(--text-2);
    margin: 0;
    line-height: 1.5;
  }

  .up-face-note strong {
    color: #f59e0b;
  }

  .up-section-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: var(--text-4);
    margin: 4px 20px 8px;
  }

  .up-categories {
    display: flex;
    flex-direction: column;
    gap: 0;
    padding: 0 16px;
  }

  .up-cat {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border-radius: 12px;
    border: 1px solid var(--border-1);
    background: var(--bg-2);
    cursor: pointer;
    font-family: inherit;
    text-align: left;
    transition: border-color 130ms, background 130ms;
    margin-bottom: 6px;
  }

  .up-cat:hover {
    border-color: var(--accent-bright);
    background: var(--bg-3);
  }

  .up-cat-top {
    border-color: rgba(52, 211, 153, 0.4);
    background: rgba(52, 211, 153, 0.05);
  }

  .up-cat-top:hover {
    border-color: var(--accent-bright);
    background: rgba(52, 211, 153, 0.1);
  }

  .up-cat-icon {
    font-size: 22px;
    flex-shrink: 0;
  }

  .up-cat-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .up-cat-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .up-cat-label {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-1);
  }

  .up-cat-pts {
    font-size: 11px;
    font-weight: 700;
    color: var(--accent-bright);
    background: rgba(52, 211, 153, 0.12);
    border-radius: 999px;
    padding: 2px 8px;
  }

  .up-cat-rec {
    font-size: 10px;
    font-weight: 600;
    color: #f59e0b;
    background: rgba(245, 158, 11, 0.1);
    border-radius: 999px;
    padding: 2px 8px;
  }

  .up-cat-examples {
    font-size: 11px;
    color: var(--text-4);
    line-height: 1.4;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .up-footer-pad {
    height: calc(16px + env(safe-area-inset-bottom, 0));
    flex-shrink: 0;
  }

  /* Mobile Responsive */
  @media (max-width: 767px) {
    .chat-header {
      padding: 10px 12px;
      gap: 8px;
    }

    .back-btn {
      width: 40px;
      height: 40px;
      min-width: 40px;
      min-height: 40px;
    }

    .chat-title {
      font-size: 15px;
    }

    .chat-subtitle {
      font-size: 11px;
    }

    .header-spacer {
      width: 40px;
    }

    .error-banner {
      padding: 10px 12px;
      gap: 8px;
    }

    .error-text {
      font-size: 12px;
    }

    .error-close {
      width: 20px;
      height: 20px;
    }

    .messages-container {
      padding: 12px;
      gap: 10px;
    }

    .message-bubble {
      max-width: 85%;
      padding: 8px 12px;
      font-size: 13px;
    }

    .message-content {
      font-size: 13px;
    }

    .message-time {
      font-size: 10px;
    }

    .input-area {
      padding: 10px 12px;
    }

    .input-wrapper {
      gap: 6px;
    }

    .message-input {
      padding: 10px 12px;
      font-size: 15px;
      min-height: 44px;
    }

    .send-btn {
      width: 36px;
      height: 36px;
    }

    .empty-state {
      padding: 30px 16px;
    }

    .empty-icon {
      font-size: 40px;
    }

    .empty-state h2 {
      font-size: 16px;
    }

    .empty-state p {
      font-size: 13px;
    }

    .loading-state {
      padding: 30px 16px;
    }
  }

  /* ── Options menu (unmatch/block) ── */
  .header-options {
    position: relative;
  }

  .options-btn {
    background: none;
    border: none;
    color: var(--text-2);
    padding: 8px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .options-btn:hover {
    background: var(--bg-2);
  }

  .options-backdrop {
    position: fixed;
    inset: 0;
    z-index: 99;
  }

  .options-dropdown {
    position: absolute;
    top: 100%;
    right: 0;
    z-index: 100;
    background: var(--bg-1);
    border: 1px solid var(--border-1);
    border-radius: 12px;
    padding: 6px;
    min-width: 160px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
  }

  .options-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 10px 14px;
    border: none;
    background: none;
    color: var(--text-1);
    font-size: 14px;
    border-radius: 8px;
    cursor: pointer;
    text-align: left;
  }

  .options-item:hover {
    background: var(--bg-2);
  }

  .options-item--danger {
    color: #ef4444;
  }

  .options-item--danger:hover {
    background: rgba(239, 68, 68, 0.1);
  }

  /* ── Confirmation modals ── */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }

  .modal-card {
    background: var(--bg-1);
    border: 1px solid var(--border-1);
    border-radius: 16px;
    padding: 24px;
    max-width: 340px;
    width: 100%;
  }

  .modal-title {
    margin: 0 0 8px;
    font-size: 18px;
    font-weight: 600;
    color: var(--text-1);
  }

  .modal-text {
    margin: 0 0 20px;
    font-size: 14px;
    color: var(--text-2);
    line-height: 1.5;
  }

  .modal-actions {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
  }

  .modal-btn {
    padding: 10px 18px;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    border: none;
  }

  .modal-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .modal-btn--cancel {
    background: var(--bg-2);
    color: var(--text-1);
  }

  .modal-btn--cancel:hover:not(:disabled) {
    background: var(--bg-3, var(--bg-2));
  }

  .modal-btn--danger {
    background: #ef4444;
    color: white;
  }

  .modal-btn--danger:hover:not(:disabled) {
    background: #dc2626;
  }
</style>
