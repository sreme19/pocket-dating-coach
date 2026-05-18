<script lang="ts">
  import { fade, slide } from 'svelte/transition';
  import { notifications, unreadNotifications, markNotificationAsRead, deleteNotification, markAllNotificationsAsRead } from '../stores';
  import type { Notification } from '../types';

  interface Props {
    onNotificationTap?: (notification: Notification) => void;
  }

  let { onNotificationTap }: Props = $props();

  let isOpen = $state(false);
  let notificationList = $state<Notification[]>([]);
  let unreadCount = $state(0);

  const unsubNotifications = notifications.subscribe((value) => {
    notificationList = value;
  });

  const unsubUnread = unreadNotifications.subscribe((value) => {
    unreadCount = value;
  });

  function getNotificationIcon(type: string): string {
    switch (type) {
      case 'message':
        return '💬';
      case 'match':
        return '❤️';
      case 'system':
        return 'ℹ️';
      default:
        return '🔔';
    }
  }

  function formatTime(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return new Date(date).toLocaleDateString();
  }

  function handleMarkAsRead(notificationId: string) {
    markNotificationAsRead(notificationId);
  }

  function handleNotificationClick(notification: Notification) {
    if (notification.status === 'unread') {
      handleMarkAsRead(notification.id);
    }
    onNotificationTap?.(notification);
    if (notification.data?.actionUrl) {
      window.location.href = notification.data.actionUrl;
    }
  }
</script>

<div class="notification-center">
  <!-- Notification Bell Button -->
  <button
    class="notification-bell"
    onclick={() => (isOpen = !isOpen)}
    aria-label={`Notifications (${unreadCount} unread)`}
    title={`${unreadCount} unread notifications`}
  >
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
    </svg>

    {#if unreadCount > 0}
      <span class="badge" transition:fade={{ duration: 200 }}>
        {unreadCount > 99 ? '99+' : unreadCount}
      </span>
    {/if}
  </button>

  <!-- Notification Dropdown -->
  {#if isOpen}
    <div class="notification-dropdown" transition:slide={{ duration: 200 }}>
      <!-- Header -->
      <div class="notification-header">
        <h3>Notifications</h3>
        {#if notificationList.length > 0}
          <button
            class="clear-all-btn"
            onclick={markAllNotificationsAsRead}
            aria-label="Clear all notifications"
            title="Clear all"
          >
            ✕
          </button>
        {/if}
      </div>

      <!-- Notifications List -->
      <div class="notification-list">
        {#if notificationList.length === 0}
          <div class="empty-state">
            <p>No notifications</p>
          </div>
        {:else}
          {#each notificationList as notification (notification.id)}
            <button
              class="notification-item"
              class:unread={notification.status === 'unread'}
              role="button"
              tabindex="0"
              onclick={() => handleNotificationClick(notification)}
              transition:slide={{ duration: 200 }}
            >
              <div class="notification-icon">
                {getNotificationIcon(notification.type)}
              </div>

              <div class="notification-content">
                <h4 class="notification-title">{notification.title}</h4>
                <p class="notification-message">{notification.body}</p>
                <span class="notification-time">{formatTime(notification.createdAt)}</span>
              </div>

              <button
                class="notification-close"
                onclick={(e) => { e.stopPropagation(); deleteNotification(notification.id); }}
                aria-label="Dismiss notification"
              >
                ✕
              </button>
            </button>
          {/each}
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .notification-center {
    position: relative;
  }

  .notification-bell {
    position: relative;
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
  }

  .notification-bell:hover {
    background: var(--bg-3);
    border-color: var(--border-2);
  }

  .notification-bell svg {
    width: 20px;
    height: 20px;
  }

  .badge {
    position: absolute;
    top: -8px;
    right: -8px;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #ef4444;
    color: white;
    display: grid;
    place-items: center;
    font-size: 11px;
    font-weight: 700;
    border: 2px solid var(--bg-1);
  }

  .notification-dropdown {
    position: absolute;
    top: 100%;
    right: 0;
    width: 360px;
    max-height: 500px;
    background: var(--bg-1);
    border: 1px solid var(--border-1);
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    margin-top: 8px;
    z-index: 100;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .notification-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    border-bottom: 1px solid var(--border-1);
  }

  .notification-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-1);
  }

  .clear-all-btn {
    width: 24px;
    height: 24px;
    border-radius: 4px;
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--text-3);
    font-size: 16px;
    transition: all 150ms ease;
    display: grid;
    place-items: center;
  }

  .clear-all-btn:hover {
    background: var(--bg-2);
    color: var(--text-2);
  }

  .notification-list {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    color: var(--text-3);
    font-size: 14px;
  }

  .notification-item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px 16px;
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--border-1);
    cursor: pointer;
    transition: all 150ms ease;
    text-align: left;
    width: 100%;
  }

  .notification-item:last-child {
    border-bottom: none;
  }

  .notification-item:hover {
    background: var(--bg-2);
  }

  .notification-item.unread {
    background: rgba(59, 130, 246, 0.05);
  }

  .notification-icon {
    font-size: 20px;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .notification-content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .notification-title {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-1);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .notification-message {
    margin: 0;
    font-size: 13px;
    color: var(--text-3);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .notification-time {
    font-size: 11px;
    color: var(--text-4);
  }

  .notification-close {
    width: 24px;
    height: 24px;
    border-radius: 4px;
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--text-3);
    font-size: 14px;
    transition: all 150ms ease;
    display: grid;
    place-items: center;
    flex-shrink: 0;
  }

  .notification-close:hover {
    background: var(--bg-3);
    color: var(--text-2);
  }

  @media (max-width: 767px) {
    .notification-dropdown {
      width: 320px;
      max-height: 400px;
    }

    .notification-header {
      padding: 12px;
    }

    .notification-header h3 {
      font-size: 14px;
    }

    .notification-item {
      padding: 10px 12px;
      gap: 10px;
    }

    .notification-icon {
      font-size: 18px;
    }

    .notification-title {
      font-size: 13px;
    }

    .notification-message {
      font-size: 12px;
    }

    .notification-time {
      font-size: 10px;
    }
  }
</style>
