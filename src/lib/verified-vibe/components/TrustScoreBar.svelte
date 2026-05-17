<script lang="ts">
  import { getTrustScoreColor } from '../server/trustScore';
  import type { TrustScoreBreakdown } from '../server/trustScore';

  interface Props {
    breakdown: TrustScoreBreakdown;
    showBreakdown?: boolean;
  }

  let { breakdown, showBreakdown = true }: Props = $props();

  let color = $derived(getTrustScoreColor(breakdown.total));

  const colorClasses = {
    red: 'bg-red-500',
    yellow: 'bg-yellow-500',
    green: 'bg-green-500'
  };

  const stepLabels = {
    id: 'ID Verification',
    liveness: 'Liveness Check',
    photos: 'Photo Consistency',
    qa: 'Q&A Completion'
  };
</script>

<div class="space-y-4">
  <!-- Main Progress Bar -->
  <div class="space-y-2">
    <div class="flex justify-between items-center">
      <span class="text-sm font-semibold text-gray-700">Overall Trust Score</span>
      <span class="text-lg font-bold text-gray-900">{Math.round(breakdown.total)}%</span>
    </div>
    <div class="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
      <div
        class={`h-full rounded-full transition-all duration-300 ${colorClasses[color]}`}
        style={`width: ${breakdown.total}%`}
      />
    </div>
  </div>

  <!-- Breakdown by Step -->
  {#if showBreakdown}
    <div class="space-y-3 pt-4 border-t border-gray-200">
      <p class="text-sm font-semibold text-gray-700">Score Breakdown</p>

      <!-- ID Verification -->
      <div class="space-y-1">
        <div class="flex justify-between items-center">
          <span class="text-xs text-gray-600">{stepLabels.id}</span>
          <span class="text-xs font-semibold text-gray-700">{Math.round(breakdown.idScore)}%</span>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
          <div
            class="h-full bg-blue-500 rounded-full transition-all duration-300"
            style={`width: ${breakdown.idScore}%`}
          />
        </div>
        {#if breakdown.details.id.status === 'pending'}
          <p class="text-xs text-gray-500">Pending</p>
        {:else if breakdown.details.id.status === 'failed'}
          <p class="text-xs text-red-500">Failed</p>
        {/if}
      </div>

      <!-- Liveness Check -->
      <div class="space-y-1">
        <div class="flex justify-between items-center">
          <span class="text-xs text-gray-600">{stepLabels.liveness}</span>
          <span class="text-xs font-semibold text-gray-700">{Math.round(breakdown.livenessScore)}%</span>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
          <div
            class="h-full bg-purple-500 rounded-full transition-all duration-300"
            style={`width: ${breakdown.livenessScore}%`}
          />
        </div>
        {#if breakdown.details.liveness.status === 'pending'}
          <p class="text-xs text-gray-500">Pending</p>
        {:else if breakdown.details.liveness.status === 'failed'}
          <p class="text-xs text-red-500">Failed</p>
        {/if}
      </div>

      <!-- Photo Consistency -->
      <div class="space-y-1">
        <div class="flex justify-between items-center">
          <span class="text-xs text-gray-600">{stepLabels.photos}</span>
          <span class="text-xs font-semibold text-gray-700">{Math.round(breakdown.photoScore)}%</span>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
          <div
            class="h-full bg-pink-500 rounded-full transition-all duration-300"
            style={`width: ${breakdown.photoScore}%`}
          />
        </div>
        {#if breakdown.details.photos.status === 'pending'}
          <p class="text-xs text-gray-500">Pending</p>
        {:else if breakdown.details.photos.status === 'failed'}
          <p class="text-xs text-red-500">Failed</p>
        {/if}
      </div>

      <!-- Q&A Completion -->
      <div class="space-y-1">
        <div class="flex justify-between items-center">
          <span class="text-xs text-gray-600">{stepLabels.qa}</span>
          <span class="text-xs font-semibold text-gray-700">{Math.round(breakdown.qaScore)}%</span>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
          <div
            class="h-full bg-indigo-500 rounded-full transition-all duration-300"
            style={`width: ${breakdown.qaScore}%`}
          />
        </div>
        {#if breakdown.details.qa.status === 'pending'}
          <p class="text-xs text-gray-500">Pending</p>
        {:else if breakdown.details.qa.status === 'failed'}
          <p class="text-xs text-red-500">Failed</p>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  /* Additional styling can be added here */
</style>
