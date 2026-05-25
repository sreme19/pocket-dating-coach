<script lang="ts">
  import type { Archetype } from '$lib/verified-vibe/types';
  import { ARCHETYPES } from '$lib/verified-vibe/constants';

  interface Props {
    archetype: Archetype;
    size?: 'sm' | 'md' | 'lg';
    showLabel?: boolean;
  }

  let { archetype, size = 'md', showLabel = false } = $props();

  const archetypeData = ARCHETYPES[archetype];

  const sizeMap = {
    sm: '24px',
    md: '32px',
    lg: '48px'
  };

  const fontSize = {
    sm: '12px',
    md: '16px',
    lg: '24px'
  };

  const iconSize = sizeMap[size as 'sm' | 'md' | 'lg'];
  const textSize = fontSize[size as 'sm' | 'md' | 'lg'];
</script>

<div class="archetype-icon {size}">
  <div class="icon" style="font-size: {iconSize}; width: {iconSize}; height: {iconSize};">
    {archetypeData.emoji}
  </div>
  {#if showLabel}
    <span class="label" style="font-size: {textSize};">
      {archetypeData.name}
    </span>
  {/if}
</div>

<style>
  .archetype-icon {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .archetype-icon.sm {
    gap: 4px;
  }

  .icon {
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: var(--accent-tint);
    border: 1px solid rgba(52, 211, 153, 0.3);
    flex-shrink: 0;
  }

  .label {
    font-weight: 600;
    color: var(--text-1);
    text-align: center;
    line-height: 1.2;
  }
</style>
