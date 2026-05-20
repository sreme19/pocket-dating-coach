<script lang="ts">
  interface Props {
    points: number;
    size?: 'sm' | 'md' | 'lg';
    variant?: 'badge' | 'inline';
  }

  let { points = 0, size = 'md', variant = 'badge' } = $props();

  const sizeMap = {
    sm: '16px',
    md: '20px',
    lg: '24px'
  };

  const fontSize = {
    sm: '10px',
    md: '12px',
    lg: '14px'
  };

  const dotSize = sizeMap[size];
  const textSize = fontSize[size];
</script>

{#if variant === 'badge'}
  <div class="trust-badge {size}">
    <div class="dot" style="width: {dotSize}; height: {dotSize};"></div>
    <span class="text" style="font-size: {textSize};">+{points} pts</span>
  </div>
{:else if variant === 'inline'}
  <span class="trust-inline {size}">
    <span class="dot-inline" style="width: {dotSize}; height: {dotSize};"></span>
    +{points}
  </span>
{/if}

<style>
  .trust-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: 999px;
    background: var(--accent-tint);
    border: 1px solid rgba(52, 211, 153, 0.3);
  }

  .trust-badge.sm {
    padding: 4px 8px;
  }

  .trust-badge.lg {
    padding: 8px 12px;
  }

  .dot {
    border-radius: 50%;
    background: var(--accent-bright);
    flex-shrink: 0;
  }

  .text {
    color: var(--accent-bright);
    font-weight: 600;
    white-space: nowrap;
  }

  .trust-inline {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--accent-bright);
    font-weight: 600;
    font-size: 12px;
  }

  .dot-inline {
    border-radius: 50%;
    background: var(--accent-bright);
    flex-shrink: 0;
  }
</style>
