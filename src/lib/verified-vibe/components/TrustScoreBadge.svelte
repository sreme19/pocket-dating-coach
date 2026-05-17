<script lang="ts">
  import { getTrustScoreColor, getTrustScoreLabel } from '../server/trustScore';

  interface Props {
    score?: number;
    size?: 'sm' | 'md' | 'lg';
    showLabel?: boolean;
    showPercentage?: boolean;
  }

  let { score = 0, size = 'md', showLabel = true, showPercentage = true }: Props = $props();

  let color = $derived(getTrustScoreColor(score));
  let label = $derived(getTrustScoreLabel(score));

  const sizeClasses = {
    sm: 'w-12 h-12 text-xs',
    md: 'w-16 h-16 text-sm',
    lg: 'w-20 h-20 text-base'
  };

  const colorClasses = {
    red: 'bg-red-100 text-red-700 border-red-300',
    yellow: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    green: 'bg-green-100 text-green-700 border-green-300'
  };
</script>

<div class="flex flex-col items-center gap-2">
  <!-- Badge Circle -->
  <div
    class={`flex items-center justify-center rounded-full border-2 font-bold ${sizeClasses[size]} ${colorClasses[color]}`}
  >
    {#if showPercentage}
      <span>{Math.round(score)}%</span>
    {:else}
      <span>{Math.round(score)}</span>
    {/if}
  </div>

  <!-- Label -->
  {#if showLabel}
    <div class="text-center">
      <p class="text-xs font-semibold text-gray-700">{label}</p>
    </div>
  {/if}
</div>

<style>
  /* Additional styling can be added here */
</style>
