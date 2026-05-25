<script lang="ts">
  /**
   * OnlineStatusBadge Component
   *
   * Displays the online status of a user with a visual indicator.
   * Shows "Online" with a green dot, or "Last seen X ago" with a gray dot.
   *
   * Props:
   * - isOnline: boolean - Whether the user is currently online
   * - lastSeen: Date | null - When the user was last seen (if offline)
   * - showDot: boolean - Whether to show the status dot (default: true)
   * - size: 'small' | 'medium' | 'large' - Size of the badge (default: 'medium')
   */

  function formatDistanceToNow(date: Date): string {
    const diff = Date.now() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'}`;
    return `${Math.floor(hours / 24)} day${Math.floor(hours / 24) === 1 ? '' : 's'}`;
  }

  interface Props {
    isOnline?: boolean;
    lastSeen?: Date | null;
    showDot?: boolean;
    size?: 'small' | 'medium' | 'large';
  }

  let { isOnline = false, lastSeen = null, showDot = true, size = 'medium' }: Props = $props();

  function formatLastSeen(date: Date | null): string {
    if (!date) return 'Last seen recently';

    try {
      return `Last seen ${formatDistanceToNow(new Date(date))} ago`;
    } catch (error) {
      return 'Last seen recently';
    }
  }

  const statusText = isOnline ? 'Online' : formatLastSeen(lastSeen);
  const statusClass = isOnline ? 'online' : 'offline';
  const sizeClass = `size-${size}`;
</script>

<div class="online-status-badge {statusClass} {sizeClass}" role="status" aria-label={statusText}>
  {#if showDot}
    <div class="status-dot"></div>
  {/if}
  <span class="status-text">{statusText}</span>
</div>

<style>
  .online-status-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 500;
    transition: all 200ms ease;
  }

  .online-status-badge.online {
    background: rgba(34, 197, 94, 0.1);
    color: #22c55e;
  }

  .online-status-badge.offline {
    background: rgba(107, 114, 128, 0.1);
    color: var(--text-3);
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .online-status-badge.online .status-dot {
    background: #22c55e;
    box-shadow: 0 0 8px rgba(34, 197, 94, 0.5);
    animation: pulse-online 2s infinite;
  }

  .online-status-badge.offline .status-dot {
    background: #9ca3af;
  }

  .status-text {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Size variants */
  .online-status-badge.size-small {
    padding: 2px 6px;
    font-size: 11px;
    gap: 4px;
  }

  .online-status-badge.size-small .status-dot {
    width: 6px;
    height: 6px;
  }

  .online-status-badge.size-medium {
    padding: 4px 8px;
    font-size: 12px;
    gap: 6px;
  }

  .online-status-badge.size-medium .status-dot {
    width: 8px;
    height: 8px;
  }

  .online-status-badge.size-large {
    padding: 6px 12px;
    font-size: 13px;
    gap: 8px;
  }

  .online-status-badge.size-large .status-dot {
    width: 10px;
    height: 10px;
  }

  /* Pulse animation for online status */
  @keyframes pulse-online {
    0%,
    100% {
      opacity: 1;
    }

    50% {
      opacity: 0.7;
    }
  }

  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .online-status-badge.online .status-dot {
      animation: none;
      opacity: 1;
    }

    .online-status-badge {
      transition: none;
    }
  }

  /* Mobile responsive */
  @media (max-width: 767px) {
    .online-status-badge {
      padding: 3px 6px;
      font-size: 11px;
      gap: 4px;
    }

    .online-status-badge.size-small {
      padding: 2px 4px;
      font-size: 10px;
    }

    .online-status-badge.size-medium {
      padding: 3px 6px;
      font-size: 11px;
    }

    .online-status-badge.size-large {
      padding: 4px 8px;
      font-size: 12px;
    }
  }
</style>

