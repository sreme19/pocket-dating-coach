<script lang="ts">
  interface Props {
    isOnline: boolean;
    lastSeen?: Date;
    size?: 'sm' | 'md' | 'lg';
    showText?: boolean;
  }

  let { isOnline = false, lastSeen, size = 'md', showText = true } = $props();

  function formatLastSeen(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  const sizeMap = {
    sm: '8px',
    md: '12px',
    lg: '16px'
  };

  const dotSize = $derived(sizeMap[size as 'sm' | 'md' | 'lg']);
</script>

<div class="online-indicator {size}">
  <div class="dot {isOnline ? 'online' : 'offline'}" style="width: {dotSize}; height: {dotSize};"></div>
  {#if showText}
    <span class="text">
      {#if isOnline}
        Online
      {:else if lastSeen}
        Last seen {formatLastSeen(lastSeen)}
      {:else}
        Offline
      {/if}
    </span>
  {/if}
</div>

<style>
  .online-indicator {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .online-indicator.sm {
    font-size: 11px;
  }

  .online-indicator.md {
    font-size: 12px;
  }

  .online-indicator.lg {
    font-size: 13px;
  }

  .dot {
    border-radius: 50%;
    flex-shrink: 0;
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }

  .dot.online {
    background: var(--accent-bright);
    box-shadow: 0 0 8px rgba(52, 211, 153, 0.5);
  }

  .dot.offline {
    background: var(--text-4);
    animation: none;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.7;
    }
  }

  .text {
    color: var(--text-3);
    font-weight: 500;
  }

  .online-indicator.sm .text {
    color: var(--text-4);
  }
</style>
