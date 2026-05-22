<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { fade, slide } from 'svelte/transition';
  import { user } from '$lib/verified-vibe/stores';
  import type { Conversation } from '../api/verified-vibe/chat/conversations/+server';

  let conversations = $state<Conversation[]>([]);
  let isLoading = $state(true);
  let error = $state<string | null>(null);

  onMount(async () => {
    user.hydrate();

    try {
      isLoading = true;
      error = null;

      // Get the auth token from Supabase
      const { getSupabaseClient } = await import('$lib/client/supabase');
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/api/verified-vibe/chat/conversations', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.error || `Failed to fetch conversations (${response.status})`);
      }

      const data = await response.json();
      conversations = data.data.conversations;
    } catch (err) {
      console.error('Error fetching conversations:', err);
      error = err instanceof Error ? err.message : 'An error occurred';
    } finally {
      isLoading = false;
    }
  });

  function formatTime(date: Date) {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'now';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;

    const d = new Date(date);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }

  function truncateMessage(message: string, maxLength: number = 50): string {
    if (message.length <= maxLength) return message;
    return message.substring(0, maxLength) + '...';
  }

  function handleConversationClick(matchId: string) {
    goto(`/verified-vibe/chat/${matchId}`);
  }

  function handleBackClick() {
    goto('/verified-vibe/discover');
  }
</script>

<div class="chat-list-screen">
  <!-- Header -->
  <div class="chat-list-header" transition:slide={{ duration: 400, delay: 0, axis: 'y' }}>
    <button class="back-btn" onclick={handleBackClick} aria-label="Go back">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
    </button>

    <h1 class="chat-list-title">Messages</h1>

    <div class="header-spacer"></div>
  </div>

  <!-- Content -->
  <div class="chat-list-content">
    <!-- AI Bestie pinned entry — female users only -->
    {#if $user?.gender === 'woman'}
      <button
        class="conversation-item bestie-pinned-item"
        onclick={() => goto('/verified-vibe/chat/ai-bestie')}
        transition:slide={{ duration: 300 }}
      >
        <div class="bestie-pinned-avatar">✨</div>
        <div class="conversation-content">
          <div class="conversation-header">
            <h3 class="conversation-name bestie-pinned-name">AI Bestie</h3>
            <span class="bestie-badge">Advisor</span>
          </div>
          <p class="conversation-message">Tips, match summaries & fresh insights</p>
        </div>
      </button>
      <div class="bestie-divider"></div>
    {/if}

    {#if isLoading}
      <div class="loading-state" transition:fade={{ duration: 300 }}>
        <div class="spinner"></div>
        <p>Loading conversations...</p>
      </div>
    {:else if error}
      <div class="error-state" transition:fade={{ duration: 300 }}>
        <p class="error-message">{error}</p>
        <button class="retry-btn" onclick={() => location.reload()}>
          Try Again
        </button>
      </div>
    {:else if conversations.length === 0}
      <div class="empty-state" transition:fade={{ duration: 300 }}>
        <div class="empty-icon">💬</div>
        <h2>No conversations yet</h2>
        <p>Start matching and chatting with people you like!</p>
        <button class="discover-btn" onclick={() => goto('/verified-vibe/discover')}>
          Discover People
        </button>
      </div>
    {:else}
      <div class="conversations-list" transition:fade={{ duration: 300 }}>
        {#each conversations as conversation (conversation.id)}
          <button
            class="conversation-item"
            onclick={() => handleConversationClick(conversation.matchId)}
            transition:slide={{ duration: 300 }}
          >
            <!-- Avatar -->
            <div class="conversation-avatar">
              {#if conversation.matchedUser.avatar}
                <img src={conversation.matchedUser.avatar} alt={conversation.matchedUser.firstName} />
              {:else}
                <div class="avatar-placeholder">
                  {conversation.matchedUser.firstName.charAt(0).toUpperCase()}
                </div>
              {/if}
            </div>

            <!-- Content -->
            <div class="conversation-content">
              <div class="conversation-header">
                <h3 class="conversation-name">
                  {conversation.matchedUser.firstName}, {conversation.matchedUser.age}
                </h3>
                <span class="conversation-time">
                  {formatTime(conversation.lastMessageTime)}
                </span>
              </div>

              <p class="conversation-message">
                {truncateMessage(conversation.lastMessage)}
              </p>
            </div>

            <!-- Unread Badge -->
            {#if conversation.unreadCount > 0}
              <div class="unread-badge" transition:fade={{ duration: 200 }}>
                {conversation.unreadCount}
              </div>
            {/if}
          </button>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .chat-list-screen {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-1);
  }

  /* Header */
  .chat-list-header {
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

  .chat-list-title {
    font-size: 18px;
    font-weight: 600;
    margin: 0;
    color: var(--text-1);
    flex: 1;
  }

  .header-spacer {
    width: 40px;
    flex-shrink: 0;
  }

  /* Content */
  .chat-list-content {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
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

  /* Error State */
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 40px 20px;
    flex: 1;
  }

  .error-message {
    color: var(--text-2);
    font-size: 14px;
    text-align: center;
    margin: 0;
  }

  .retry-btn {
    padding: 10px 20px;
    background: var(--accent);
    color: #06281e;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 200ms ease;
  }

  .retry-btn:hover {
    transform: scale(1.05);
  }

  .retry-btn:active {
    transform: scale(0.95);
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

  .discover-btn {
    margin-top: 16px;
    padding: 12px 24px;
    background: var(--accent);
    color: #06281e;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 200ms ease;
  }

  .discover-btn:hover {
    transform: scale(1.05);
  }

  .discover-btn:active {
    transform: scale(0.95);
  }

  /* Conversations List */
  .conversations-list {
    display: flex;
    flex-direction: column;
  }

  .conversation-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-1);
    background: transparent;
    border: none;
    cursor: pointer;
    transition: all 200ms ease;
    text-align: left;
    position: relative;
  }

  .conversation-item:hover {
    background: var(--bg-2);
  }

  .conversation-item:active {
    background: var(--bg-3);
  }

  /* Avatar */
  .conversation-avatar {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: var(--accent-tint);
    display: grid;
    place-items: center;
    flex-shrink: 0;
    overflow: hidden;
  }

  .conversation-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .avatar-placeholder {
    font-size: 18px;
    font-weight: 600;
    color: var(--accent);
  }

  /* Content */
  .conversation-content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .conversation-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .conversation-name {
    font-size: 15px;
    font-weight: 600;
    margin: 0;
    color: var(--text-1);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .conversation-time {
    font-size: 12px;
    color: var(--text-3);
    flex-shrink: 0;
  }

  .conversation-message {
    font-size: 13px;
    color: var(--text-3);
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* AI Bestie pinned row */
  .bestie-pinned-item {
    background: linear-gradient(90deg, rgba(236,72,153,0.06) 0%, rgba(168,85,247,0.06) 100%);
    border-bottom: 1px solid rgba(236,72,153,0.15);
  }
  .bestie-pinned-item:hover {
    background: linear-gradient(90deg, rgba(236,72,153,0.12) 0%, rgba(168,85,247,0.12) 100%);
  }

  .bestie-pinned-avatar {
    width: 48px;
    height: 48px;
    border-radius: 14px;
    background: linear-gradient(135deg, #ec4899, #a855f7);
    display: grid;
    place-items: center;
    font-size: 22px;
    flex-shrink: 0;
  }

  .bestie-pinned-name {
    background: linear-gradient(90deg, #ec4899, #a855f7);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .bestie-badge {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.04em;
    padding: 2px 7px;
    border-radius: 8px;
    background: linear-gradient(135deg, #ec4899, #a855f7);
    color: #fff;
    flex-shrink: 0;
    text-transform: uppercase;
  }

  .bestie-divider {
    height: 6px;
    background: var(--bg-2);
    border-top: 1px solid var(--border-1);
    border-bottom: 1px solid var(--border-1);
  }

  /* Unread Badge */
  .unread-badge {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--accent);
    color: #06281e;
    display: grid;
    place-items: center;
    font-size: 11px;
    font-weight: 700;
    flex-shrink: 0;
  }

  /* Mobile Responsive */
  @media (max-width: 767px) {
    .chat-list-header {
      padding: 10px 12px;
      gap: 8px;
    }

    .back-btn {
      width: 40px;
      height: 40px;
      min-width: 40px;
      min-height: 40px;
    }

    .chat-list-title {
      font-size: 16px;
    }

    .header-spacer {
      width: 40px;
    }

    .conversation-item {
      padding: 10px 12px;
      gap: 10px;
    }

    .conversation-avatar {
      width: 44px;
      height: 44px;
      border-radius: 10px;
    }

    .avatar-placeholder {
      font-size: 16px;
    }

    .conversation-name {
      font-size: 14px;
    }

    .conversation-time {
      font-size: 11px;
    }

    .conversation-message {
      font-size: 12px;
    }

    .unread-badge {
      width: 22px;
      height: 22px;
      font-size: 10px;
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

    .discover-btn {
      padding: 10px 20px;
      font-size: 14px;
    }

    .loading-state {
      padding: 30px 16px;
    }

    .error-state {
      padding: 30px 16px;
    }

    .error-message {
      font-size: 13px;
    }

    .retry-btn {
      padding: 10px 16px;
      font-size: 14px;
    }
  }
</style>
