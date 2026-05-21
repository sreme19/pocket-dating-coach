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

  let conversationId = $state('');
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

  // Utility function to validate UUID format
  function isValidUUID(id: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  }

  // Get conversation ID from route
  $effect(() => {
    conversationId = $page.params.conversationId || '';
  });

  onMount(async () => {
    try {
      isLoading = true;
      error = null;
      connectionError = false;

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
      const { matchedUser, messages: initialMessages } = data.data;

      // Set current match in store
      setCurrentMatch(conversationId, matchedUser);

      // Load initial messages
      if (initialMessages && Array.isArray(initialMessages)) {
        messages.set(initialMessages);
      }

      // Subscribe to realtime message updates (only if conversationId is a valid UUID)
      if (isValidUUID(conversationId)) {
        // TODO: Fix realtime subscriptions - polling disabled for now
        // subscribeToRealtimeMessages();

        // Subscribe to typing indicators
        // if ($user) {
        //   subscribeToRealtimeTyping();
        // }
      } else {
        console.warn('Invalid conversation ID format, skipping realtime subscriptions:', conversationId);
      }

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

          // If AI Bestie is active and this is a message from Adrian (not from us), auto-respond
          if (activeAssistant === 'bestie' && message.senderId !== $user?.id) {
            console.log('AI Bestie auto-responding to message from Adrian');
            setTimeout(() => {
              generateAndSendAIBestieResponse(message.content);
            }, 1000); // Delay 1 second to feel more natural
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
    if (!messageInput.trim() || !$user) return;

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
        senderId: $user.id,
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
    return message.senderId === $user?.id;
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
    try {
      console.log('Activating assistant:', assistantType);
      activeAssistant = assistantType;
      
      // Save active state to localStorage
      localStorage.setItem(`ai-bestie-active-${conversationId}`, 'true');
      
      // Send opening message from AI Bestie (impersonating the female user)
      await sendAIBestieOpeningMessage();
      console.log('Assistant activated successfully');
    } catch (err) {
      console.error('Failed to activate assistant:', err);
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
   * Generate and send AI Bestie response to Adrian's message
   * DISABLED - causing too many messages
   */
  // async function generateAndSendAIBestieResponse(adrianMessage: string) {
  //   ...
  // }
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

      <!-- AI Bestie Toggle Button -->
      {#if $user}
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
