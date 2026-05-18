<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { notifications, unreadNotifications, markNotificationAsRead, deleteNotification } from '../stores';
  import type { Notification } from '../types';

  let displayedNotifications = $state<Notification[]>([]);
  let toastNotifications = $state<Array<{ id: string; title: string; body: string; type: string }>>([]);

  onMount(() => {
    // Listen for in-app notification events
    const handleNotification = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { title, body, type } = customEvent.detail;

      const toastId = `toast_${Date.now()}`;
      toastNotifications = [...toastNotifications, { id: toastId, title, body, type }];

      // Auto-remove toast after 5 seconds
      setTimeout(() => {
        toastNotifications = toastNotifications.filter((n) => n.id !== toastId);
      }, 5000);
    };

    window.addEventListener('notification', handleNotification);

    return () => {
      window.removeEventListener('notification', handleNotification);
    };
  });

  function handleNotificationClick(notification: Notification) {
    if (notification.status === 'unread') {
      markNotificationAsRead(notification.id);
    }

    // Navigate to action URL if available
    if (notification.data?.actionUrl) {
      window.location.href = notification.data.actionUrl;
    }
  }

  function handleDeleteNotification(notificationId: string) {
    deleteNotification(notificationId);
  }

  function getNotificationIcon(type: string): string {
    switch (type) {
      case 'message':
        return '💬';
      case 'match':
        return '❤️';
      case 'verification':
        return '✓';
      default:
        return 'ℹ️';
    }
  }

  function formatTime(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);

    if (minutes < 1) return 'now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;

    return new Date(date).toLocaleDateString();
  }
</script>

<!-- Toast Notifications (top-right) -->
<div class="toast-container">
  {#each toastNotifications as toast (toast.id)}
    <div class="toast" class:toast-message={toast.type === 'message'} class:toast-match={toast.type === 'match'} transition:slide={{ duration: 300, axis: 'x' }}>
      <div class="toast-icon">{getNotificationIcon(toast.type)}</div>
      <div class="toast-content">
        <p class="toast-title">{toast.title}</p>
        <p class="toast-body">{toast.body}</p>
      </div>
      <button class="toast-close" onclick={() => (toastNotifications = toastNotifications.filter((n) => n.id !== toast.id))} aria-label="Close notification">
        ✕
      </button>
    </div>
  {/each}
</div>

<!-- Notification Center (modal) -->
<div class="notification-center">
  <div class="notification-header">
    <h2>Notifications</h2>
    {#if $unreadNotifications > 0}
      <span class="unread-badge">{$unreadNotifications}</span>
    {/if}
  </div>

  <div class="notification-list">
    {#if $notifications.length === 0}
      <div class="empty-state">
        <p>No notifications yet</p>
      </div>
    {:else}
      {#each $notifications as notification (notification.id)}
        <button
          class="notification-item"
          class:unread={notification.status === 'unread'}
          onclick={() => handleNotificationClick(notification)}
          transition:slide={{ duration: 300 }}
        >
          <div class="notification-icon">{getNotificationIcon(notification.type)}</div>

          <div class="notification-content">
            <p class="notification-title">{notification.title}</p>
            <p class="notification-body">{notification.body}</p>
            <span class="notification-time">{formatTime(notification.createdAt)}</span>
          </div>

          <button
            class="notification-delete"
            onclick={(e) => {
              e.stopPropagation();
              handleDeleteNotification(notification.id);
            }}
            aria-label="Delete notification"
          >
            ✕
          </button>
        </button>
      {/each}
    {/if}
  </div>
</div>

<style>
  /* Toast Container */
  .toast-container {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: 12px;
    pointer-events: none;
  }

  .toast {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    pointer-events: auto;
    max-width: 400px;
  }

  .toast-message {
    border-left: 4px solid var(--accent);
  }

  .toast-match {
    border-left: 4px solid #ff6b6b;
  }

  .toast-icon {
    font-size: 20px;
    flex-shrink: 0;
  }

  .toast-content {
    flex: 1;
    min-width: 0;
  }

  .toast-title {
    font-size: 14px;
    font-weight: 600;
    margin: 0;
    color: var(--text-1);
  }

  .toast-body {
    font-size: 12px;
    color: var(--text-3);
    margin: 4px 0 0 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .toast-close {
    background: none;
    border: none;
    color: var(--text-3);
    cursor: pointer;
    font-size: 16px;
    padding: 0;
    flex-shrink: 0;
    transition: color 200ms ease;
  }

  .toast-close:hover {
    color: var(--text-1);
  }

  /* Notification Center */
  .notification-center {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-1);
  }

  .notification-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    border-bottom: 1px solid var(--border-1);
    gap: 12px;
  }

  .notification-header h2 {
    font-size: 18px;
    font-weight: 600;
    margin: 0;
    color: var(--text-1);
  }

  .unread-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    background: var(--accent);
    color: #06281e;
    border-radius: 50%;
    font-size: 12px;
    font-weight: 700;
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
    flex: 1;
    padding: 40px 20px;
  }

  .empty-state p {
    font-size: 14px;
    color: var(--text-3);
    margin: 0;
    text-align: center;
  }

  .notification-item {
    display: flex;
    align-items: flex-start;
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

  .notification-item:hover {
    background: var(--bg-2);
  }

  .notification-item.unread {
    background: var(--bg-2);
  }

  .notification-item.unread::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: var(--accent);
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
    font-size: 14px;
    font-weight: 600;
    margin: 0;
    color: var(--text-1);
  }

  .notification-body {
    font-size: 13px;
    color: var(--text-3);
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .notification-time {
    font-size: 11px;
    color: var(--text-3);
    margin-top: 2px;
  }

  .notification-delete {
    background: none;
    border: none;
    color: var(--text-3);
    cursor: pointer;
    font-size: 16px;
    padding: 4px;
    flex-shrink: 0;
    transition: color 200ms ease;
    opacity: 0;
  }

  .notification-item:hover .notification-delete {
    opacity: 1;
  }

  .notification-delete:hover {
    color: var(--text-1);
  }

  /* Mobile Responsive */
  @media (max-width: 767px) {
    .toast-container {
      top: 10px;
      right: 10px;
      left: 10px;
    }

    .toast {
      max-width: none;
      padding: 10px 12px;
    }

    .toast-title {
      font-size: 13px;
    }

    .toast-body {
      font-size: 11px;
    }

    .notification-header {
      padding: 12px;
    }

    .notification-header h2 {
      font-size: 16px;
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

    .notification-body {
      font-size: 12px;
    }

    .notification-time {
      font-size: 10px;
    }
  }
</style>
