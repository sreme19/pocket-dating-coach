<script lang="ts">
  /**
   * BlockedUsers Component
   *
   * Displays and manages blocked users.
   * Allows users to view and unblock users.
   *
   * Props:
   * - blockedUsers: any[] - Array of blocked users
   * - isLoading: boolean - Loading state
   * - onUnblock: (userId: string) => void - Unblock callback
   */

  import { fade, slide } from 'svelte/transition';

  interface BlockedUser {
    id: string;
    userId: string;
    blockedUserId: string;
    blockedUserName: string;
    blockedUserAvatar?: string;
    reason?: string;
    createdAt: Date;
  }

  interface Props {
    blockedUsers?: BlockedUser[];
    isLoading?: boolean;
    onUnblock?: (userId: string) => void;
  }

  let {
    blockedUsers = [],
    isLoading = false,
    onUnblock = () => {}
  }: Props = $props();

  let unblockingId = $state<string | null>(null);

  function handleUnblock(userId: string) {
    unblockingId = userId;
    onUnblock(userId);
    setTimeout(() => {
      unblockingId = null;
    }, 500);
  }

  function formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }
</script>

<div class="blocked-users">
  <div class="section-header">
    <h2>Blocked Users</h2>
    <p>Manage users you've blocked</p>
  </div>

  {#if isLoading}
    <div class="loading-state" transition:fade={{ duration: 200 }}>
      <div class="spinner"></div>
      <p>Loading blocked users...</p>
    </div>
  {:else if blockedUsers.length === 0}
    <div class="empty-state" transition:fade={{ duration: 200 }}>
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      <p>You haven't blocked any users</p>
      <span class="empty-description">Users you block won't be able to see your profile or message you</span>
    </div>
  {:else}
    <div class="blocked-users-list" transition:fade={{ duration: 200 }}>
      {#each blockedUsers as user (user.id)}
        <div class="blocked-user-item" transition:slide={{ duration: 200 }}>
          <div class="user-info">
            {#if user.blockedUserAvatar}
              <img src={user.blockedUserAvatar} alt={user.blockedUserName} class="user-avatar" />
            {:else}
              <div class="user-avatar-placeholder">
                {user.blockedUserName.charAt(0).toUpperCase()}
              </div>
            {/if}

            <div class="user-details">
              <h3 class="user-name">{user.blockedUserName}</h3>
              {#if user.reason}
                <p class="block-reason">{user.reason}</p>
              {/if}
              <span class="block-date">Blocked {formatDate(user.createdAt)}</span>
            </div>
          </div>

          <button
            class="unblock-btn"
            onclick={() => handleUnblock(user.blockedUserId)}
            disabled={isLoading || unblockingId === user.blockedUserId}
            aria-label={`Unblock ${user.blockedUserName}`}
            title="Unblock user"
          >
            {#if unblockingId === user.blockedUserId}
              <span class="spinner-small"></span>
            {:else}
              Unblock
            {/if}
          </button>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .blocked-users {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .section-header {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .section-header h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: var(--text-1);
  }

  .section-header p {
    margin: 0;
    font-size: 14px;
    color: var(--text-3);
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 60px 20px;
    color: var(--text-3);
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

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 60px 20px;
    color: var(--text-3);
  }

  .empty-state svg {
    color: var(--text-4);
    opacity: 0.5;
  }

  .empty-state p {
    margin: 0;
    font-size: 16px;
    font-weight: 500;
    color: var(--text-2);
  }

  .empty-description {
    font-size: 13px;
    color: var(--text-4);
  }

  .blocked-users-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .blocked-user-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 16px;
    background: var(--bg-1);
    border: 1px solid var(--border-1);
    border-radius: 8px;
    transition: all 200ms ease;
  }

  .blocked-user-item:hover {
    border-color: var(--border-2);
    background: var(--bg-2);
  }

  .user-info {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
    min-width: 0;
  }

  .user-avatar,
  .user-avatar-placeholder {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    flex-shrink: 0;
    display: grid;
    place-items: center;
    background: var(--bg-2);
    font-weight: 600;
    color: var(--text-1);
  }

  .user-avatar {
    object-fit: cover;
  }

  .user-details {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .user-name {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-1);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .block-reason {
    margin: 0;
    font-size: 12px;
    color: var(--text-3);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .block-date {
    font-size: 11px;
    color: var(--text-4);
  }

  .unblock-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    background: transparent;
    border: 1px solid var(--border-1);
    border-radius: 6px;
    color: var(--text-2);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 200ms ease;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .unblock-btn:hover:not(:disabled) {
    background: var(--bg-2);
    border-color: var(--border-2);
    color: var(--text-1);
  }

  .unblock-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .spinner-small {
    width: 12px;
    height: 12px;
    border: 2px solid rgba(0, 0, 0, 0.1);
    border-top-color: var(--text-2);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  /* Mobile responsive */
  @media (max-width: 767px) {
    .blocked-users {
      gap: 16px;
    }

    .section-header h2 {
      font-size: 18px;
    }

    .blocked-user-item {
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
    }

    .user-info {
      width: 100%;
    }

    .unblock-btn {
      width: 100%;
      justify-content: center;
    }
  }
</style>
