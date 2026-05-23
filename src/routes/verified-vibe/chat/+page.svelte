<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { fade } from 'svelte/transition';
  import { user } from '$lib/verified-vibe/stores';
  import BestieAvatar from '$lib/components/BestieAvatar.svelte';
  import type { Conversation } from '../api/verified-vibe/chat/conversations/+server';

  // ── Archetype display metadata ─────────────────────────────────────────────
  const ARCHETYPE_META: Record<string, { emoji: string; label: string; color: string; bg: string }> = {
    // Legacy (keep for any existing records)
    casual_man:          { emoji: '🎯', label: 'Casual',          color: '#f59e0b', bg: 'rgba(245,158,11,0.13)'  },
    marriage_minded_man: { emoji: '💍', label: 'Marriage-Minded', color: '#818cf8', bg: 'rgba(99,102,241,0.13)'  },
    spoilt_woman:        { emoji: '💎', label: 'Spoilt Woman',     color: '#ec4899', bg: 'rgba(236,72,153,0.13)'  },
    safety_first_woman:  { emoji: '🛡️', label: 'Safety-First',    color: '#34d399', bg: 'rgba(16,185,129,0.13)'  },
    // New archetypes (PDC-48)
    casual_generous_man:       { emoji: '💸', label: 'Casual-Generous',    color: '#34d399', bg: 'rgba(16,185,129,0.13)' },
    hopeless_romantic_man:     { emoji: '💞', label: 'Hopeless-Romantic',  color: '#818cf8', bg: 'rgba(99,102,241,0.13)' },
    rebound_healing_man:       { emoji: '🌱', label: 'Rebound-Healing',    color: '#84cc16', bg: 'rgba(132,204,22,0.13)'  },
    untouched_heart_man:       { emoji: '🕊️', label: 'Untouched-Heart',   color: '#3b82f6', bg: 'rgba(59,130,246,0.13)'  },
    forever_focused_man:       { emoji: '🎯', label: 'Forever-Focused',    color: '#14b8a6', bg: 'rgba(20,184,166,0.13)'  },
    traditional_matrimony_man: { emoji: '🏛️', label: 'Traditional',       color: '#f59e0b', bg: 'rgba(245,158,11,0.13)'  },
    spoiled_casual_woman:        { emoji: '✨', label: 'Spoiled-Casual',     color: '#f59e0b', bg: 'rgba(245,158,11,0.13)'  },
    hopeless_romantic_woman:     { emoji: '🌹', label: 'Hopeless-Romantic', color: '#ec4899', bg: 'rgba(236,72,153,0.13)'  },
    rebound_healing_woman:       { emoji: '🌿', label: 'Rebound-Healing',   color: '#84cc16', bg: 'rgba(132,204,22,0.13)'  },
    untouched_heart_woman:       { emoji: '🌸', label: 'Untouched-Heart',   color: '#3b82f6', bg: 'rgba(59,130,246,0.13)'  },
    forever_focused_woman:       { emoji: '💍', label: 'Forever-Focused',   color: '#34d399', bg: 'rgba(16,185,129,0.13)'  },
    traditional_matrimony_woman: { emoji: '🏛️', label: 'Traditional',      color: '#f59e0b', bg: 'rgba(245,158,11,0.13)'  },
  };

  // ── Attention message type ─────────────────────────────────────────────────
  interface AttentionMessage {
    id: string;
    senderId: string;
    senderName: string;
    senderAge: number | null;
    senderAvatar: string | null;
    senderArchetype: string | null;
    messageType: 'secret_admirer' | 'craving_attention';
    content: string;
    replyContent: string | null;
    replySentAt: string | null;
    isRead: boolean;
    createdAt: string;
  }

  // ── State ──────────────────────────────────────────────────────────────────
  let conversations    = $state<Conversation[]>([]);
  let attentionMsgs    = $state<AttentionMessage[]>([]);
  let isLoading        = $state(true);
  let error            = $state<string | null>(null);
  let activeFilter     = $state<'all' | 'unread'>('all');
  let replyingToId     = $state<string | null>(null);
  let replyContent     = $state('');
  let isReplying       = $state(false);

  // ── Derived ────────────────────────────────────────────────────────────────
  let newMatches     = $derived(conversations.filter(c => !c.hasMessages));
  let activeConvos   = $derived(conversations.filter(c => c.hasMessages));
  let unreadTotal    = $derived(conversations.reduce((s, c) => s + c.unreadCount, 0));
  let filteredConvos = $derived(
    activeFilter === 'unread'
      ? activeConvos.filter(c => c.unreadCount > 0)
      : activeConvos
  );

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  onMount(async () => {
    user.hydrate();

    try {
      isLoading = true;
      error = null;

      const { getSupabaseClient } = await import('$lib/client/supabase');
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) throw new Error('Not authenticated');

      const response = await fetch('/api/verified-vibe/chat/conversations', {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.error || `Failed to fetch conversations (${response.status})`);
      }

      const data = await response.json();
      conversations = data.data.conversations;

      // Load attention inbox (non-blocking — failures are silent)
      try {
        const attnRes = await fetch(`/api/verified-vibe/attention?recipientId=${session.user.id}`);
        if (attnRes.ok) {
          const attnData = await attnRes.json();
          attentionMsgs = attnData.messages ?? [];
        }
      } catch { /* non-blocking */ }

    } catch (err) {
      console.error('Error fetching conversations:', err);
      error = err instanceof Error ? err.message : 'An error occurred';
    } finally {
      isLoading = false;
    }
  });

  // ── Reply to attention message ─────────────────────────────────────────────
  async function submitAttentionReply(messageId: string) {
    if (!replyContent.trim() || isReplying) return;
    isReplying = true;
    try {
      const res = await fetch('/api/verified-vibe/attention/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, replyContent: replyContent.trim() }),
      });
      if (res.ok) {
        const snapshot = replyContent.trim();
        attentionMsgs = attentionMsgs.map(m =>
          m.id === messageId
            ? { ...m, replyContent: snapshot, replySentAt: new Date().toISOString() }
            : m
        );
        replyingToId = null;
        replyContent = '';
      }
    } finally {
      isReplying = false;
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  function formatTime(date: Date | string): string {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours   = Math.floor(diff / 3600000);
    const days    = Math.floor(diff / 86400000);

    if (minutes < 1)  return 'now';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24)   return `${hours}h`;
    if (days === 1)   return 'Yesterday';
    if (days < 7)     return `${days}d`;

    const d = new Date(date);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }

  function isRecent(date: Date | string): boolean {
    return (Date.now() - new Date(date).getTime()) < 24 * 60 * 60 * 1000;
  }

  function truncate(str: string, max = 44): string {
    return str.length <= max ? str : str.slice(0, max) + '…';
  }
</script>

<div class="chat-list-screen">

  <!-- ── Header ── -->
  <div class="page-header">
    <div class="header-top">
      <button class="back-btn" onclick={() => goto('/verified-vibe/discover')} aria-label="Go back">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
      </button>
      <h1 class="page-title">Messages<span class="title-dot">.</span></h1>
      <div class="header-right"></div>
    </div>
    {#if !isLoading && !error && conversations.length > 0}
      <div class="stats-bar" transition:fade={{ duration: 200 }}>
        <span class="stats-dot"></span>
        <span class="stats-text">{conversations.length} verified · {unreadTotal} unread</span>
      </div>
    {/if}
  </div>

  <!-- ── Content ── -->
  <div class="chat-list-content">

    <!-- AI Bestie pinned row — female users only -->
    {#if $user?.gender === 'woman'}
      <button class="bestie-row" onclick={() => goto('/verified-vibe/chat/ai-bestie')}>
        <BestieAvatar size={48} />
        <div class="bestie-text">
          <div class="bestie-name-row">
            <span class="bestie-name">AI Bestie</span>
            <span class="bestie-badge">ADVISOR</span>
          </div>
          <p class="bestie-sub">Tips, match summaries &amp; fresh insights</p>
        </div>
      </button>
      <div class="band-divider"></div>
    {/if}

    <!-- AI Wingman pinned row — male users only -->
    {#if $user?.gender === 'man'}
      <button class="bestie-row wingman-row" onclick={() => goto('/verified-vibe/chat/ai-wingman')}>
        <div class="wingman-avatar">🛡️</div>
        <div class="bestie-text">
          <div class="bestie-name-row">
            <span class="bestie-name">AI Wingman</span>
            <span class="bestie-badge wingman-badge">ADVISOR</span>
          </div>
          <p class="bestie-sub">Match reads, approach tips &amp; fresh insights</p>
        </div>
      </button>
      <div class="band-divider"></div>
    {/if}

    <!-- ── Loading ── -->
    {#if isLoading}
      <div class="loading-state" transition:fade={{ duration: 200 }}>
        <div class="spinner"></div>
        <p>Loading conversations…</p>
      </div>

    <!-- ── Error ── -->
    {:else if error}
      <div class="center-state" transition:fade={{ duration: 200 }}>
        <p class="error-message">{error}</p>
        <button class="action-btn" onclick={() => location.reload()}>Try Again</button>
      </div>

    <!-- ── Empty ── -->
    {:else if conversations.length === 0}
      <div class="center-state" transition:fade={{ duration: 200 }}>
        <div class="empty-icon">💬</div>
        <h2 class="empty-title">No conversations yet</h2>
        <p class="empty-sub">Start matching and chatting with people you like!</p>
        <button class="action-btn" onclick={() => goto('/verified-vibe/discover')}>Discover People</button>
      </div>

    {:else}

      <!-- ── Attention inbox (Secret Admirers / Craving Attention) ── -->
      {#if attentionMsgs.length > 0}
        {@const attnLabel = $user?.gender === 'man' ? '🌹 SECRET ADMIRERS' : '👀 CRAVING ATTENTION'}
        <section class="attention-section" transition:fade={{ duration: 200 }}>
          <div class="section-hdr">
            <span class="section-dot pink-dot"></span>
            <span class="section-label">{attnLabel}</span>
            <span class="section-hint">{attentionMsgs.length} message{attentionMsgs.length > 1 ? 's' : ''}</span>
          </div>

          {#each attentionMsgs as msg (msg.id)}
            {@const meta = ARCHETYPE_META[msg.senderArchetype ?? '']}
            <div class="attn-row {!msg.isRead ? 'attn-row-unread' : ''}">
              <div class="attn-avatar">
                {#if msg.senderAvatar}
                  <img class="attn-avatar-img" src={msg.senderAvatar} alt={msg.senderName} />
                {:else}
                  <div class="attn-avatar-letter">{msg.senderName.charAt(0).toUpperCase()}</div>
                {/if}
              </div>
              <div class="attn-body">
                <div class="attn-line1">
                  <div class="attn-name-group">
                    <span class="attn-name">{msg.senderName}</span>
                    {#if msg.senderAge}<span class="attn-age">, {msg.senderAge}</span>{/if}
                    {#if meta}
                      <span class="archetype-chip" style="color:{meta.color};background:{meta.bg};border-color:{meta.color}55;">{meta.emoji} {meta.label}</span>
                    {/if}
                  </div>
                  <span class="attn-time">{formatTime(msg.createdAt)}</span>
                </div>
                <p class="attn-content">{msg.content}</p>

                {#if msg.replyContent}
                  <div class="attn-replied">
                    <span class="replied-label">You replied:</span>
                    <p class="replied-text">{msg.replyContent}</p>
                  </div>
                {:else if replyingToId === msg.id}
                  <div class="attn-reply-form">
                    <textarea
                      class="reply-input"
                      placeholder="Write a reply… (max 500 chars)"
                      maxlength="500"
                      rows="2"
                      bind:value={replyContent}
                    ></textarea>
                    <div class="reply-actions">
                      <button class="reply-cancel" onclick={() => { replyingToId = null; replyContent = ''; }}>Cancel</button>
                      <button
                        class="reply-submit"
                        onclick={() => submitAttentionReply(msg.id)}
                        disabled={!replyContent.trim() || isReplying}
                      >{isReplying ? 'Sending…' : 'Reply'}</button>
                    </div>
                  </div>
                {:else}
                  <button
                    class="reply-btn"
                    onclick={() => { replyingToId = msg.id; replyContent = ''; }}
                  >Reply</button>
                {/if}
              </div>
            </div>
          {/each}
        </section>
        <div class="band-divider"></div>
      {/if}

      <!-- ── NEW MATCHES strip ── -->
      {#if newMatches.length > 0}
        <section class="new-matches-section" transition:fade={{ duration: 300 }}>
          <div class="section-hdr">
            <span class="section-dot orange-dot"></span>
            <span class="section-label">NEW MATCHES</span>
            <span class="section-hint">{newMatches.length} waiting · message first</span>
          </div>

          <div class="bubbles-scroll">
            {#each newMatches as m (m.id)}
              <button class="match-bubble" onclick={() => goto(`/verified-vibe/chat/${m.matchId}`)}>
                <div class="bubble-ring-wrap">
                  {#if m.matchedUser.avatar}
                    <img class="bubble-img" src={m.matchedUser.avatar} alt={m.matchedUser.firstName} />
                  {:else}
                    <div class="bubble-letter">{m.matchedUser.firstName.charAt(0).toUpperCase()}</div>
                  {/if}
                  <span class="sparkle-deco">✨</span>
                </div>
                <span class="bubble-name">{m.matchedUser.firstName}, {m.matchedUser.age}</span>
                <span class="bubble-time {isRecent(m.matchedAt) ? 'time-hot' : ''}">{formatTime(m.matchedAt)}</span>
              </button>
            {/each}
          </div>
        </section>
        <div class="band-divider"></div>
      {/if}

      <!-- ── Filter tabs ── -->
      {#if activeConvos.length > 0}
        <div class="filter-row">
          <button
            class="filter-tab {activeFilter === 'all' ? 'tab-active' : ''}"
            onclick={() => activeFilter = 'all'}
          >All {activeConvos.length}</button>
          <button
            class="filter-tab {activeFilter === 'unread' ? 'tab-active' : ''}"
            onclick={() => activeFilter = 'unread'}
          >Unread {unreadTotal}</button>
        </div>
      {/if}

      <!-- ── Active conversations ── -->
      <div class="convos-list">
        {#each filteredConvos as c (c.id)}
          {@const meta = ARCHETYPE_META[c.matchedUser.archetype ?? '']}
          <button
            class="convo-row {c.unreadCount > 0 ? 'row-unread' : ''}"
            onclick={() => goto(`/verified-vibe/chat/${c.matchId}`)}
          >
            <!-- Avatar -->
            <div class="convo-avatar-wrap">
              {#if c.matchedUser.avatar}
                <img class="convo-avatar-img" src={c.matchedUser.avatar} alt={c.matchedUser.firstName} />
              {:else}
                <div class="convo-avatar-letter">{c.matchedUser.firstName.charAt(0).toUpperCase()}</div>
              {/if}
            </div>

            <!-- Body -->
            <div class="convo-body">
              <!-- Line 1: name + archetype → time -->
              <div class="convo-line1">
                <div class="convo-name-group">
                  <span class="convo-name">{c.matchedUser.firstName}</span>
                  <span class="convo-age">, {c.matchedUser.age}</span>
                  {#if meta}
                    <span
                      class="archetype-chip"
                      style="color:{meta.color}; background:{meta.bg}; border-color:{meta.color}55;"
                    >{meta.emoji} {meta.label}</span>
                  {/if}
                </div>
                <span class="convo-time {c.unreadCount > 0 ? 'time-unread' : ''}">{formatTime(c.lastMessageTime)}</span>
              </div>

              <!-- Line 2: preview → trust + unread badge -->
              <div class="convo-line2">
                <span class="convo-preview {c.unreadCount > 0 ? 'preview-bold' : ''}">{truncate(c.lastMessage)}</span>
                <div class="convo-right-meta">
                  {#if c.matchedUser.trustScore}
                    <span class="trust-pill">🛡 {c.matchedUser.trustScore}</span>
                  {/if}
                  {#if c.unreadCount > 0}
                    <span class="unread-badge">{c.unreadCount}</span>
                  {/if}
                </div>
              </div>
            </div>
          </button>
        {/each}

        {#if filteredConvos.length === 0 && activeFilter === 'unread'}
          <div class="all-caught-up">✅ All caught up!</div>
        {/if}
      </div>

    {/if}
  </div>
</div>

<style>
  /* ── Layout ── */
  .chat-list-screen {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-1);
    overflow: hidden;
  }

  /* ── Header ── */
  .page-header {
    padding: 12px 16px 6px;
    border-bottom: 1px solid var(--border-1);
    background: var(--bg-1);
    flex-shrink: 0;
  }
  .header-top {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .back-btn {
    width: 38px;
    height: 38px;
    border-radius: 10px;
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
  .page-title {
    flex: 1;
    font-size: 26px;
    font-weight: 800;
    font-style: italic;
    font-family: Georgia, 'Times New Roman', serif;
    color: var(--text-1);
    margin: 0;
    line-height: 1.1;
  }
  .title-dot { color: var(--text-1); }
  .header-right { width: 38px; flex-shrink: 0; }

  .stats-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 4px;
    padding-left: 48px;
  }
  .stats-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #22c55e;
    flex-shrink: 0;
  }
  .stats-text {
    font-size: 12px;
    color: var(--text-3);
  }

  /* ── Content ── */
  .chat-list-content {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  /* ── Band divider ── */
  .band-divider {
    height: 6px;
    background: var(--bg-2);
    border-top: 1px solid var(--border-1);
    border-bottom: 1px solid var(--border-1);
    flex-shrink: 0;
  }

  /* ── AI Bestie row ── */
  .bestie-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: linear-gradient(90deg, rgba(236,72,153,0.07) 0%, rgba(168,85,247,0.07) 100%);
    border: none;
    border-bottom: 1px solid rgba(236,72,153,0.15);
    cursor: pointer;
    text-align: left;
    transition: background 150ms;
    flex-shrink: 0;
  }
  .bestie-row:hover {
    background: linear-gradient(90deg, rgba(236,72,153,0.13) 0%, rgba(168,85,247,0.13) 100%);
  }
  .bestie-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .bestie-name-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .bestie-name {
    font-size: 15px;
    font-weight: 700;
    background: linear-gradient(90deg, #ec4899, #a855f7);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .bestie-badge {
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.06em;
    padding: 2px 7px;
    border-radius: 6px;
    background: linear-gradient(135deg, #ec4899, #a855f7);
    color: #fff;
  }
  .bestie-sub {
    font-size: 13px;
    color: var(--text-3);
    margin: 0;
  }

  .wingman-row {
    background: linear-gradient(135deg, rgba(16,185,129,0.04), var(--bg-2));
    border: 1px solid rgba(16,185,129,0.15);
  }

  .wingman-avatar {
    width: 48px;
    height: 48px;
    border-radius: 14px;
    background: var(--accent-tint);
    border: 1.5px solid var(--accent-bright);
    display: grid;
    place-items: center;
    font-size: 24px;
    flex-shrink: 0;
  }

  .wingman-badge {
    background: linear-gradient(135deg, #10b981, #14b8a6);
  }

  /* ── Loading / Error / Empty ── */
  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 48px 20px;
    flex: 1;
  }
  .spinner {
    width: 36px;
    height: 36px;
    border: 3px solid var(--border-1);
    border-top-color: #22c55e;
    border-radius: 50%;
    animation: spin 0.9s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .loading-state p {
    color: var(--text-3);
    font-size: 14px;
    margin: 0;
  }

  .center-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 48px 20px;
    flex: 1;
  }
  .empty-icon { font-size: 46px; }
  .empty-title { font-size: 18px; font-weight: 700; margin: 0; color: var(--text-1); }
  .empty-sub   { font-size: 14px; color: var(--text-3); margin: 0; text-align: center; }
  .error-message { font-size: 14px; color: var(--text-2); text-align: center; margin: 0; }
  .action-btn {
    margin-top: 8px;
    padding: 11px 24px;
    background: #22c55e;
    color: #05150d;
    border: none;
    border-radius: 10px;
    font-weight: 700;
    font-size: 14px;
    cursor: pointer;
    transition: opacity 150ms;
  }
  .action-btn:hover { opacity: 0.9; }

  /* ── NEW MATCHES section ── */
  .new-matches-section {
    padding: 10px 0 0;
    flex-shrink: 0;
  }
  .section-hdr {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 16px 8px;
  }
  .section-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .orange-dot { background: #f97316; }
  .section-label {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.08em;
    color: var(--text-2);
    text-transform: uppercase;
  }
  .section-hint {
    font-size: 11px;
    color: var(--text-3);
    margin-left: auto;
  }

  .bubbles-scroll {
    display: flex;
    gap: 10px;
    padding: 0 16px 12px;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .bubbles-scroll::-webkit-scrollbar { display: none; }

  .match-bubble {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    background: none;
    border: none;
    cursor: pointer;
    flex-shrink: 0;
    width: 68px;
    padding: 0;
    transition: transform 150ms;
  }
  .match-bubble:hover  { transform: scale(1.05); }
  .match-bubble:active { transform: scale(0.96); }

  .bubble-ring-wrap {
    position: relative;
    width: 60px;
    height: 60px;
  }
  .bubble-img {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    object-fit: cover;
    border: 2.5px solid #22c55e;
    box-shadow: 0 0 0 3px rgba(34,197,94,0.22);
  }
  .bubble-letter {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background: var(--bg-3);
    border: 2.5px solid #22c55e;
    box-shadow: 0 0 0 3px rgba(34,197,94,0.22);
    display: grid;
    place-items: center;
    font-size: 22px;
    font-weight: 700;
    color: var(--text-1);
  }
  .sparkle-deco {
    position: absolute;
    bottom: -3px;
    left: -5px;
    font-size: 14px;
    line-height: 1;
    pointer-events: none;
  }
  .bubble-name {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-1);
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 68px;
  }
  .bubble-time {
    font-size: 11px;
    color: var(--text-3);
    text-align: center;
  }
  .bubble-time.time-hot { color: #f97316; font-weight: 600; }

  /* ── Filter tabs ── */
  .filter-row {
    display: flex;
    gap: 8px;
    padding: 10px 16px 8px;
    flex-shrink: 0;
  }
  .filter-tab {
    padding: 6px 18px;
    border-radius: 20px;
    font-size: 13px;
    font-weight: 600;
    border: 1.5px solid var(--border-2);
    background: transparent;
    color: var(--text-2);
    cursor: pointer;
    transition: all 150ms;
  }
  .filter-tab:hover:not(.tab-active) { background: var(--bg-2); }
  .filter-tab.tab-active {
    background: #22c55e;
    border-color: #22c55e;
    color: #05150d;
  }

  /* ── Conversations list ── */
  .convos-list {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow-y: auto;
  }

  .convo-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 11px 16px;
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--border-1);
    cursor: pointer;
    text-align: left;
    transition: background 150ms;
    position: relative;
  }
  .convo-row:hover    { background: var(--bg-2); }
  .convo-row:active   { background: var(--bg-3); }
  .convo-row.row-unread { background: rgba(34,197,94,0.04); }

  /* Avatar with ring */
  .convo-avatar-wrap {
    position: relative;
    width: 52px;
    height: 52px;
    flex-shrink: 0;
  }
  .convo-avatar-img {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid #22c55e;
    box-shadow: 0 0 0 2px rgba(34,197,94,0.2);
  }
  .convo-avatar-letter {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: var(--bg-3);
    border: 2px solid #22c55e;
    box-shadow: 0 0 0 2px rgba(34,197,94,0.2);
    display: grid;
    place-items: center;
    font-size: 18px;
    font-weight: 700;
    color: var(--text-1);
  }

  /* Body */
  .convo-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .convo-line1 {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
  }
  .convo-name-group {
    display: flex;
    align-items: center;
    gap: 5px;
    min-width: 0;
    flex: 1;
    overflow: hidden;
  }
  .convo-name {
    font-size: 15px;
    font-weight: 700;
    color: var(--text-1);
    white-space: nowrap;
  }
  .convo-age {
    font-size: 15px;
    font-weight: 400;
    color: var(--text-2);
    white-space: nowrap;
    flex-shrink: 0;
  }
  .archetype-chip {
    font-size: 11px;
    font-weight: 600;
    padding: 2px 7px;
    border-radius: 10px;
    border: 1px solid transparent;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 140px;
    flex-shrink: 1;
  }
  .convo-time {
    font-size: 12px;
    color: var(--text-3);
    white-space: nowrap;
    flex-shrink: 0;
  }
  .convo-time.time-unread { color: #22c55e; font-weight: 600; }

  .convo-line2 {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .convo-preview {
    font-size: 13px;
    color: var(--text-3);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
  }
  .convo-preview.preview-bold { color: var(--text-2); font-weight: 500; }

  .convo-right-meta {
    display: flex;
    align-items: center;
    gap: 5px;
    flex-shrink: 0;
  }
  .trust-pill {
    font-size: 11px;
    color: var(--text-3);
    white-space: nowrap;
  }
  .unread-badge {
    min-width: 20px;
    height: 20px;
    padding: 0 5px;
    border-radius: 10px;
    background: #22c55e;
    color: #05150d;
    font-size: 11px;
    font-weight: 700;
    display: grid;
    place-items: center;
  }

  .all-caught-up {
    padding: 28px;
    text-align: center;
    color: var(--text-3);
    font-size: 14px;
  }

  /* ── Attention inbox section ── */
  .attention-section {
    padding: 10px 0 0;
    flex-shrink: 0;
  }

  .pink-dot { background: #ec4899; }

  .attn-row {
    display: flex;
    gap: 12px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-1);
    transition: background 120ms;
  }

  .attn-row-unread {
    background: rgba(236, 72, 153, 0.04);
  }

  .attn-avatar {
    flex-shrink: 0;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    overflow: hidden;
    background: var(--bg-3);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .attn-avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .attn-avatar-letter {
    font-size: 18px;
    font-weight: 700;
    color: var(--text-2);
  }

  .attn-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .attn-line1 {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .attn-name-group {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
    flex-wrap: wrap;
  }

  .attn-name {
    font-size: 14px;
    font-weight: 700;
    color: var(--text-1);
  }

  .attn-age {
    font-size: 13px;
    color: var(--text-3);
  }

  .attn-time {
    font-size: 11px;
    color: var(--text-3);
    flex-shrink: 0;
  }

  .attn-content {
    font-size: 13px;
    color: var(--text-2);
    line-height: 1.5;
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .attn-replied {
    background: var(--bg-2);
    border-radius: 8px;
    padding: 8px 10px;
    margin-top: 4px;
  }

  .replied-label {
    font-size: 10px;
    font-weight: 700;
    color: var(--text-3);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .replied-text {
    font-size: 12px;
    color: var(--text-2);
    margin: 2px 0 0;
    line-height: 1.4;
  }

  .reply-btn {
    align-self: flex-start;
    margin-top: 4px;
    padding: 5px 14px;
    border-radius: 999px;
    border: 1px solid var(--border-2);
    background: var(--bg-2);
    color: var(--text-2);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
    transition: border-color 130ms, color 130ms;
  }

  .reply-btn:hover {
    border-color: #ec4899;
    color: #ec4899;
  }

  .attn-reply-form {
    margin-top: 6px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .reply-input {
    width: 100%;
    box-sizing: border-box;
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    border-radius: 10px;
    padding: 8px 10px;
    font-size: 13px;
    color: var(--text-1);
    font-family: inherit;
    resize: none;
    line-height: 1.5;
  }

  .reply-input:focus {
    outline: none;
    border-color: #ec4899;
  }

  .reply-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  .reply-cancel {
    padding: 6px 14px;
    border-radius: 8px;
    border: 1px solid var(--border-1);
    background: transparent;
    color: var(--text-3);
    font-size: 13px;
    cursor: pointer;
    font-family: inherit;
  }

  .reply-submit {
    padding: 6px 18px;
    border-radius: 8px;
    border: none;
    background: #ec4899;
    color: #fff;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: opacity 130ms;
  }

  .reply-submit:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* ── Mobile ── */
  @media (max-width: 767px) {
    .page-header  { padding: 10px 12px 5px; }
    .page-title   { font-size: 22px; }
    .stats-bar    { padding-left: 0; margin-top: 5px; }
    .bestie-row   { padding: 10px 12px; }
    .filter-row   { padding: 8px 12px 6px; }
    .convo-row    { padding: 10px 12px; gap: 10px; }
    .convo-name   { font-size: 14px; }
    .convo-time   { font-size: 11px; }
    .convo-preview { font-size: 12px; }
    .archetype-chip { max-width: 100px; }
  }
</style>
