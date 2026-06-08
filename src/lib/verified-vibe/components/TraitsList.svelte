<script lang="ts">
  import { Check, X } from 'lucide-svelte';

  interface Props {
    traits: string[];
    type?: 'match' | 'avoid' | 'brings';
    variant?: 'pills' | 'items';
  }

  let { traits = [], type = 'match', variant = 'pills' } = $props();

  const getIcon = () => {
    if (type === 'brings') return Check;
    if (type === 'avoid') return X;
    return Check;
  };

  const Icon = getIcon();
</script>

{#if variant === 'pills'}
  <div class="traits-pills">
    {#each traits as trait}
      <span class="trait-pill {type}">
        {#if type === 'brings'}
          <Check size={14} />
        {:else if type === 'avoid'}
          <X size={14} />
        {/if}
        {trait}
      </span>
    {/each}
  </div>
{:else if variant === 'items'}
  <div class="traits-items">
    {#each traits as trait}
      <div class="trait-item {type}">
        {#if type === 'brings'}
          <span class="trait-check">✓</span>
        {:else if type === 'avoid'}
          <span class="trait-x">✕</span>
        {/if}
        <span class="trait-text">{trait}</span>
      </div>
    {/each}
  </div>
{/if}

<style>
  .traits-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .trait-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
  }

  .trait-pill.match {
    background: var(--accent-tint);
    border: 1px solid rgba(255, 122, 77, 0.3);
    color: var(--accent-bright);
  }

  .trait-pill.avoid {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }

  .trait-pill.brings {
    background: var(--accent-tint);
    border: 1px solid rgba(255, 122, 77, 0.3);
    color: var(--accent-bright);
  }

  .traits-items {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .trait-item {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px 14px;
    border-radius: 10px;
    background: var(--bg-2);
    border: 1px solid var(--border-2);
  }

  .trait-item.brings {
    background: var(--bg-2);
    border: 1px solid var(--border-2);
  }

  .trait-item.avoid {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.2);
  }

  .trait-check {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--accent-bright);
    color: var(--bg-1);
    font-size: 12px;
    font-weight: 700;
    flex-shrink: 0;
  }

  .trait-x {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #ef4444;
    color: white;
    font-size: 12px;
    font-weight: 700;
    flex-shrink: 0;
  }

  .trait-text {
    font-size: 14px;
    color: var(--text-1);
    line-height: 1.4;
  }

  .trait-item.avoid .trait-text {
    color: #ef4444;
  }
</style>
