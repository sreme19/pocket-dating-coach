<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { fade, slide } from 'svelte/transition';
  import { user, currentMatch, messages, isTyping, addMessage, setCurrentMatch, clearCurrentMatch, matchUserOnlineStatus, updateMatchUserOnlineStatus } from '$lib/verified-vibe/stores';
  import { subscribeToMessages, subscribeToTypingIndicator, publishTypingIndicator } from '$lib/client/supabase';
  import { subscribeToUserOnlineStatus, formatLastSeen, trackUserOnline, untrackUserOnline, updateLastActivity } from '$lib/verified-vibe/services/onlineStatusService';
  import type { Message, VerifiedVibeUser } from '$lib/verified-vibe/types';
  import type { AssistantType } from '$lib/types';
  import VoiceDictation from '$lib/components/VoiceDictation.svelte';

  // Initialise from route params immediately — the $effect fires AFTER onMount,
  // so reading $page.params here ensures localStorage keys are correct from mount.
  let conversationId = $state($page.params.conversationId || '');
  let messageInput = $state('');
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let isSending = $state(false);
  let messagesContainer: HTMLElement | undefined;
  let isTypingLocal = $state(false);
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
  let respondedToMessageIds = $state<Set<string>>(new Set());
  let isActivating = false;
  let aiBestieActive = $state(false);
  let userIsSeed = $state(false);
  // Populated from Supabase session in onMount — used instead of $user to avoid
  // hydration race conditions where the Svelte store may still be null.
  let currentUserId = $state<string | null>(null);
  let currentUserGender = $state<string | null>(null);

  interface CoachingCard { signal: string; read: string; }
  let coachingCards = $state<Map<string, CoachingCard>>(new Map());

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
      const saved = localStorage.getItem(`ai-bestie-active-${conversationId}`);
      if (saved === 'true' && !activeAssistant) {
        activeAssistant = 'bestie';
        loadRespondedIds();
        startBestiePoller();
      }
    }
  });

  onMount(async () => {
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

      // Restore which messages AI Bestie already responded to (prevents flooding on page reload)
      loadRespondedIds();

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

      aiBestieActive = bestieActive ?? false;

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

      // Realtime disabled: anon key can't subscribe to RLS-protected tables
      // Auto-response uses polling instead (startBestiePoller)

      // Subscribe to match user's online status
      // if (matchedUser) {
      //   subscribeToRealtimeOnlineStatus(matchedUser.id);
      // }

      // Scroll to bottom
      setTimeout(() => {
        scrollToBottom();
      }, 100);
    } catch (err) {
      console.error('Error loading conversation:', err);
      error = err instanceof Error ? err.message : 'An error occurred';
    } finally {
      isLoading = false;
    }
  });


  onDestroy(() => {
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

    // Clear polling interval
    if (pollInterval) {
      clearInterval(pollInterval);
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

          // If AI Bestie is active and this is a message from Adrian, auto-respond
          if (activeAssistant === 'bestie' && message.senderId !== $user?.id) {
            setTimeout(() => {
              generateAndSendAIBestieResponse(message.content, message.id);
            }, 1500);
          }

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
  function scrollToBottom() {
    if (messagesContainer) {
      setTimeout(() => {
        messagesContainer?.scrollTo({
          top: messagesContainer.scrollHeight,
          behavior: 'smooth'
        });
      }, 0);
    }
  }

  /**
   * Handle message input change
   */
  function handleInputChange(e: Event) {
    const target = e.target as HTMLTextAreaElement;
    messageInput = target.value;

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

  /**
   * Handle send message with optimistic update
   */
  async function handleSendMessage() {
    if (!messageInput.trim()) return;

    // Resolve the current user ID — prefer the session-populated local var over
    // the Svelte store so sends work even before hydrateStores() completes.
    const userId = currentUserId ?? $user?.id ?? null;
    if (!userId) return;

    try {
      isSending = true;
      const content = messageInput.trim();
      messageInput = '';
      isTypingLocal = false;

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
      scrollToBottom();

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

      // Replace optimistic message with real message
      // The realtime subscription will also receive this message, so we need to handle duplicates
      messages.update((msgs) => {
        const index = msgs.findIndex((m) => m.id === optimisticId);
        if (index >= 0) {
          msgs[index] = newMessage;
        }
        return msgs;
      });

      optimisticMessageId = null;
      error = null;
      scrollToBottom();
    } catch (err) {
      console.error('Error sending message:', err);
      error = err instanceof Error ? err.message : 'Failed to send message';

      // Remove optimistic message on error
      if (optimisticMessageId) {
        messages.update((msgs) => msgs.filter((m) => m.id !== optimisticMessageId));
        optimisticMessageId = null;
      }

      // Restore message input on error
      messageInput = messageInput;
    } finally {
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
      goto(`/verified-vibe/discover?profile=${$currentMatch.id}`);
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
      startBestiePoller();
    } catch (err) {
      console.error('Failed to activate assistant:', err);
      activeAssistant = null;
      localStorage.removeItem(`ai-bestie-active-${conversationId}`);
    } finally {
      isActivating = false;
    }
  }

  function startBestiePoller() {
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(async () => {
      if (!activeAssistant || !$user || !conversationId) return;
      try {
        const { getSupabaseClient } = await import('$lib/client/supabase');
        const supabase = getSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`/api/verified-vibe/chat/${conversationId}`, {
          headers: { 'Authorization': `Bearer ${session?.access_token || ''}` }
        });
        if (!res.ok) return;
        const { data } = await res.json();
        const fetched: Message[] = (data.messages || []).map((m: any) => ({
          id: m.id,
          matchId: m.matchId || conversationId,
          senderId: m.senderId,
          content: m.content,
          createdAt: new Date(m.createdAt)
        }));
        // Merge any new messages into the store
        messages.update(existing => {
          const existingIds = new Set(existing.map(m => m.id));
          const newMsgs = fetched.filter(m => !existingIds.has(m.id));
          if (newMsgs.length > 0) scrollToBottom();
          return [...existing, ...newMsgs];
        });
        // Auto-respond to the latest unresponded message from Adrian
        const latest = fetched.filter(m => m.senderId !== $user?.id).at(-1);
        if (latest && !respondedToMessageIds.has(latest.id)) {
          await generateAndSendAIBestieResponse(latest.content, latest.id);
        }
      } catch (err) {
        console.error('Bestie poller error:', err);
      }
    }, 5000);
  }

  function persistRespondedIds() {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(
        `bestie-responded-${conversationId}`,
        JSON.stringify([...respondedToMessageIds])
      );
    }
  }

  function loadRespondedIds() {
    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem(`bestie-responded-${conversationId}`);
        if (saved) respondedToMessageIds = new Set(JSON.parse(saved));
      } catch { /* ignore */ }
    }
  }

  async function generateAndSendAIBestieResponse(adrianMessage: string, messageId: string) {
    if (!$user || !$currentMatch) return;
    if (respondedToMessageIds.has(messageId)) return;

    // Mark as responded immediately to prevent duplicate calls
    respondedToMessageIds = new Set([...respondedToMessageIds, messageId]);
    persistRespondedIds();

    try {
      const { getSupabaseClient } = await import('$lib/client/supabase');
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();

      // Get signal + read + suggestedQuestion from AI Bestie
      const response = await fetch('/api/verified-vibe/ai-bestie/generate-response', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`
        },
        body: JSON.stringify({
          conversationId,
          adrianMessage,
          matchName: $currentMatch.firstName,
          userId: $user?.id
        })
      });

      if (!response.ok) throw new Error('Failed to generate AI Bestie response');

      const { signal, read, suggestedQuestion } = await response.json();

      // Store coaching card — persisted to localStorage so it survives navigation
      coachingCards = new Map(coachingCards.set(messageId, { signal, read }));
      persistCoachingCards();

      // Auto-send the suggested question to Adrian as a real message
      if (suggestedQuestion) {
        const sendResponse = await fetch('/api/verified-vibe/chat/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token || ''}`
          },
          body: JSON.stringify({ conversationId, content: suggestedQuestion })
        });

        if (sendResponse.ok) {
          const sentData = await sendResponse.json();
          addMessage({
            id: sentData.data.message.id,
            matchId: conversationId,
            senderId: $user.id,
            content: suggestedQuestion,
            createdAt: new Date(sentData.data.message.createdAt)
          });
        }
      }

      scrollToBottom();
    } catch (err) {
      console.error('AI Bestie response failed:', err);
      // Remove from responded set so it can retry
      respondedToMessageIds.delete(messageId);
      persistRespondedIds();
    }
  }

  async function sendAIBestieOpeningMessage() {
    try {
      if (!$user || !$currentMatch) {
        console.error('Missing user or currentMatch');
        return;
      }

      isSending = true;
      console.log('Sending AI Bestie opening message to:', $currentMatch.firstName);

      // Generate opening message from AI Bestie impersonating the female user
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
          matchName: $currentMatch.firstName
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

        {#if userIsSeed}
          <button
            class="clear-chat-btn"
            onclick={handleClearChat}
            title="Clear all chat messages (seed users only)"
            aria-label="Clear chat messages"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6h14zM10 11v6M14 11v6"/>
            </svg>
          </button>
        {/if}
      {/if}
    </div>

    <div class="header-spacer"></div>
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
  {#if aiBestieActive && $currentMatch?.gender === 'woman'}
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
          <div
            class="message-group"
            class:sent={isSentMessage(message)}
            class:received={!isSentMessage(message)}
            class:optimistic={message.id.startsWith('optimistic-')}
            transition:slide={{ duration: 300 }}
          >
            <div class="message-bubble">
              <p class="message-content">{message.content}</p>
              <span class="message-time">{formatTime(message.createdAt)}</span>
            </div>
          </div>
          {#if !isSentMessage(message) && coachingCards.get(message.id)}
            {@const card = coachingCards.get(message.id)!}
            <div class="bestie-coaching-card" transition:slide={{ duration: 300 }}>
              <div class="bestie-card-header">
                <span class="bestie-label">✨ AI Bestie</span>
                <span class="bestie-signal">{card.signal}</span>
              </div>
              <p class="bestie-read">{card.read}</p>
            </div>
          {/if}
        {/each}

        <!-- Typing Indicator -->
        {#if $isTyping}
          <div class="message-group received" transition:slide={{ duration: 300 }}>
            <div class="message-bubble typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Input Area -->
  <div class="input-area" transition:slide={{ duration: 400, delay: 0, axis: 'y' }}>
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

      <!-- AI Bestie Toggle Button — only shown to female users (it's their feature) -->
      {#if currentUserGender === 'woman' || $user?.gender === 'woman'}
        <button
          class="toggle-btn"
          class:active={activeAssistant}
          onclick={async () => {
            if (activeAssistant) {
              await handleDeactivateAssistant();
            } else {
              await handleActivateAssistant('bestie');
            }
          }}
          disabled={isSending || isLoading}
          title={activeAssistant ? 'Deactivate AI Assistant' : 'Activate AI Assistant'}
          aria-label={activeAssistant ? 'Deactivate AI Assistant' : 'Activate AI Assistant'}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/>
          </svg>
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

  .message-bubble {
    max-width: 70%;
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
    padding: 10px 12px;
    border: 1px solid var(--border-1);
    border-radius: 8px;
    background: var(--bg-2);
    color: var(--text-1);
    font-size: 14px;
    font-family: inherit;
    resize: none;
    max-height: 100px;
    transition: all 200ms ease;
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

  /* Toggle Button */
  .toggle-btn {
    width: 40px;
    height: 40px;
    border-radius: 8px;
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    display: grid;
    place-items: center;
    cursor: pointer;
    color: var(--text-3);
    transition: all 200ms ease;
    flex-shrink: 0;
  }

  .toggle-btn:hover:not(:disabled) {
    background: var(--bg-3);
    border-color: var(--border-2);
    color: var(--text-1);
  }

  .toggle-btn.active {
    background: var(--accent);
    color: #06281e;
    border-color: var(--accent);
  }

  .toggle-btn.active:hover:not(:disabled) {
    background: var(--accent);
    opacity: 0.9;
  }

  .toggle-btn:active:not(:disabled) {
    transform: scale(0.95);
  }

  .toggle-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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
      padding: 8px 10px;
      font-size: 13px;
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
</style>
