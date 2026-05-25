<script lang="ts">
  /**
   * ReadReceipt Component
   *
   * Displays the read status of a message with visual indicators.
   * Shows single checkmark for sent, double checkmark for delivered,
   * and blue double checkmark for read.
   *
   * Props:
   * - status: 'sent' | 'delivered' | 'read' - Message status
   * - readAt: Date | null - When message was read (optional)
   * - showTime: boolean - Whether to show read time (default: false)
   */

  function formatDistanceToNow(date: Date): string {
    const diff = Date.now() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  type ReadStatus = 'sent' | 'delivered' | 'read';

  interface Props {
    status?: ReadStatus;
    readAt?: Date | null;
    showTime?: boolean;
  }

  let { status = 'sent', readAt = null, showTime = false }: Props = $props();

  function getStatusLabel(): string {
    switch (status) {
      case 'sent':
        return 'Sent';
      case 'delivered':
        return 'Delivered';
      case 'read':
        return 'Read';
      default:
        return 'Sent';
    }
  }

  function formatReadTime(date: Date | null): string {
    if (!date) return '';

    try {
      return formatDistanceToNow(new Date(date));
    } catch (error) {
      return '';
    }
  }

  const statusLabel = getStatusLabel();
  const readTimeText = formatReadTime(readAt);
</script>

<div class="read-receipt" class:read={status === 'read'} role="img" aria-label={statusLabel}>
  <svg class="checkmark" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>

  {#if status === 'delivered' || status === 'read'}
    <svg class="checkmark" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  {/if}

  {#if showTime && readAt && status === 'read'}
    <span class="read-time">{readTimeText}</span>
  {/if}
</div>

<style>
  .read-receipt {
    display: flex;
    align-items: center;
    gap: 2px;
    color: var(--text-4);
    font-size: 11px;
    transition: color 200ms ease;
  }

  .read-receipt.read {
    color: #3b82f6;
  }

  .checkmark {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }

  .read-time {
    margin-left: 4px;
    font-size: 10px;
    color: var(--text-4);
  }

  .read-receipt.read .read-time {
    color: #3b82f6;
  }

  /* Hover effect */
  .read-receipt:hover {
    opacity: 0.8;
  }

  /* Mobile responsive */
  @media (max-width: 767px) {
    .read-receipt {
      gap: 1px;
      font-size: 10px;
    }

    .checkmark {
      width: 14px;
      height: 14px;
    }

    .read-time {
      font-size: 9px;
    }
  }
</style>
