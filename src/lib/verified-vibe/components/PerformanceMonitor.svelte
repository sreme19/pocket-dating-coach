<script lang="ts">
	import { onMount } from 'svelte';
	import { PerformanceMonitor, type PerformanceMetrics } from '../services/performance';

	interface Props {
		enabled?: boolean;
		onMetricsCollected?: (metrics: PerformanceMetrics) => void;
	}

	let { enabled = true, onMetricsCollected }: Props = $props();

	let metrics = $state<PerformanceMetrics | null>(null);
	let monitor: PerformanceMonitor | null = null;

	onMount(() => {
		if (!enabled) return;

		monitor = new PerformanceMonitor();
		monitor.startMonitoring();

		// Collect metrics after page load
		const collectMetrics = () => {
			if (monitor) {
				metrics = monitor.collectMetrics();
				onMetricsCollected?.(metrics);
			}
		};

		if (document.readyState === 'complete') {
			collectMetrics();
		} else {
			window.addEventListener('load', collectMetrics);
			return () => window.removeEventListener('load', collectMetrics);
		}
	});

	function formatTime(ms: number): string {
		return `${ms.toFixed(2)}ms`;
	}

	function formatSize(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
	}

	function getPerformanceRating(pageLoadTime: number): string {
		if (pageLoadTime < 1000) return 'Excellent';
		if (pageLoadTime < 2000) return 'Good';
		if (pageLoadTime < 3000) return 'Fair';
		return 'Poor';
	}
</script>

{#if metrics && enabled}
	<div class="fixed bottom-4 right-4 bg-gray-900 border border-gray-700 rounded-lg p-4 text-xs text-gray-300 max-w-xs z-50 shadow-lg">
		<div class="font-bold text-white mb-2">Performance Metrics</div>

		<div class="space-y-1">
			<div class="flex justify-between">
				<span>Page Load:</span>
				<span class="font-mono text-emerald-400">{formatTime(metrics.pageLoadTime)}</span>
			</div>

			<div class="flex justify-between">
				<span>Rating:</span>
				<span class="font-mono text-emerald-400">{getPerformanceRating(metrics.pageLoadTime)}</span>
			</div>

			<div class="flex justify-between">
				<span>FCP:</span>
				<span class="font-mono text-blue-400">{formatTime(metrics.firstContentfulPaint)}</span>
			</div>

			<div class="flex justify-between">
				<span>LCP:</span>
				<span class="font-mono text-blue-400">{formatTime(metrics.largestContentfulPaint)}</span>
			</div>

			<div class="flex justify-between">
				<span>CLS:</span>
				<span class="font-mono text-yellow-400">{metrics.cumulativeLayoutShift.toFixed(3)}</span>
			</div>

			<div class="flex justify-between">
				<span>TTI:</span>
				<span class="font-mono text-purple-400">{formatTime(metrics.timeToInteractive)}</span>
			</div>

			<div class="flex justify-between">
				<span>Cache Hit:</span>
				<span class="font-mono text-cyan-400">{metrics.cacheHitRate.toFixed(1)}%</span>
			</div>

			{#if metrics.resourceTiming.length > 0}
				<div class="mt-2 pt-2 border-t border-gray-700">
					<div class="font-bold text-white mb-1">Resources ({metrics.resourceTiming.length})</div>
					{#each metrics.resourceTiming.slice(0, 3) as resource}
						<div class="flex justify-between text-xs">
							<span class="truncate">{resource.name.split('/').pop()}</span>
							<span class="font-mono text-gray-400">{formatSize(resource.size)}</span>
						</div>
					{/each}
				</div>
			{/if}

			{#if metrics.imageMetrics.length > 0}
				<div class="mt-2 pt-2 border-t border-gray-700">
					<div class="font-bold text-white mb-1">Images ({metrics.imageMetrics.length})</div>
					{#each metrics.imageMetrics.slice(0, 2) as image}
						<div class="flex justify-between text-xs">
							<span class="truncate">{image.src.split('/').pop()}</span>
							<span class="font-mono text-gray-400">
								{formatSize(image.optimizedSize)} / {formatSize(image.originalSize)}
							</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	:global(.performance-monitor-hidden) {
		display: none;
	}
</style>
