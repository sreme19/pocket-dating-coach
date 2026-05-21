<script lang="ts">
	import { ChevronDown, CheckCircle, AlertCircle, XCircle } from 'lucide-svelte';
	import type { CompatibilityAnalysis } from '$lib/server/ai-assistant-service';

	interface Props {
		analysis: CompatibilityAnalysis;
		isLoading?: boolean;
	}

	let { analysis, isLoading = false }: Props = $props();

	// Track which flag groups are expanded
	let expandedGroups = $state<Record<string, boolean>>({
		green: true,
		yellow: true,
		red: true
	});

	function toggleGroup(group: 'green' | 'yellow' | 'red') {
		expandedGroups[group] = !expandedGroups[group];
	}

	// Flag colors and icons
	const flagConfig = {
		green: {
			bgColor: 'bg-green-500/10',
			borderColor: 'border-green-500/30',
			textColor: 'text-green-300',
			labelBg: 'bg-green-500/20',
			labelBorder: 'border-green-500/30',
			icon: CheckCircle,
			label: 'Green Flag'
		},
		yellow: {
			bgColor: 'bg-yellow-500/10',
			borderColor: 'border-yellow-500/30',
			textColor: 'text-yellow-300',
			labelBg: 'bg-yellow-500/20',
			labelBorder: 'border-yellow-500/30',
			icon: AlertCircle,
			label: 'Yellow Flag'
		},
		red: {
			bgColor: 'bg-red-500/10',
			borderColor: 'border-red-500/30',
			textColor: 'text-red-300',
			labelBg: 'bg-red-500/20',
			labelBorder: 'border-red-500/30',
			icon: XCircle,
			label: 'Red Flag'
		}
	};
</script>

<div class="w-full">
	{#if isLoading}
		<!-- Loading state -->
		<div class="flex items-center justify-center py-8">
			<div class="flex flex-col items-center gap-3">
				<div class="w-8 h-8 border-2 border-gray-600 border-t-gray-300 rounded-full animate-spin"></div>
				<p class="text-sm text-gray-400">Analyzing compatibility...</p>
			</div>
		</div>
	{:else}
		<!-- Overall Assessment -->
		<div class="mb-6 p-4 rounded-lg border border-gray-700 bg-gray-800/30">
			<p class="text-sm text-gray-300 leading-relaxed">{analysis.overallAssessment}</p>
		</div>

		<!-- Green Flags Section -->
		{#if analysis.greenFlags.length > 0}
			<div class="mb-4">
				<button
					onclick={() => toggleGroup('green')}
					class="w-full flex items-center justify-between p-3 rounded-lg border transition-all {flagConfig.green.bgColor} {flagConfig.green.borderColor} hover:border-green-500/50"
				>
					<div class="flex items-center gap-3">
						<svelte:component this={flagConfig.green.icon} class="w-5 h-5 {flagConfig.green.textColor}" />
						<span class="font-medium text-green-300">
							Green Flags ({analysis.greenFlags.length})
						</span>
					</div>
					<ChevronDown
						class="w-5 h-5 text-green-300 transition-transform {expandedGroups.green ? 'rotate-180' : ''}"
					/>
				</button>

				{#if expandedGroups.green}
					<div class="mt-2 space-y-2">
						{#each analysis.greenFlags as flag (flag.signal)}
							<div class="p-3 rounded-lg border {flagConfig.green.bgColor} {flagConfig.green.borderColor}">
								<div class="flex items-start gap-3">
									<CheckCircle class="w-4 h-4 {flagConfig.green.textColor} flex-shrink-0 mt-0.5" />
									<div class="flex-1 min-w-0">
										<p class="font-medium text-green-300 text-sm">{flag.signal}</p>
										<p class="text-xs text-gray-400 mt-1">{flag.reason}</p>
									</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}

		<!-- Yellow Flags Section -->
		{#if analysis.yellowFlags.length > 0}
			<div class="mb-4">
				<button
					onclick={() => toggleGroup('yellow')}
					class="w-full flex items-center justify-between p-3 rounded-lg border transition-all {flagConfig.yellow.bgColor} {flagConfig.yellow.borderColor} hover:border-yellow-500/50"
				>
					<div class="flex items-center gap-3">
						<svelte:component this={flagConfig.yellow.icon} class="w-5 h-5 {flagConfig.yellow.textColor}" />
						<span class="font-medium text-yellow-300">
							Yellow Flags ({analysis.yellowFlags.length})
						</span>
					</div>
					<ChevronDown
						class="w-5 h-5 text-yellow-300 transition-transform {expandedGroups.yellow ? 'rotate-180' : ''}"
					/>
				</button>

				{#if expandedGroups.yellow}
					<div class="mt-2 space-y-2">
						{#each analysis.yellowFlags as flag (flag.signal)}
							<div class="p-3 rounded-lg border {flagConfig.yellow.bgColor} {flagConfig.yellow.borderColor}">
								<div class="flex items-start gap-3">
									<AlertCircle class="w-4 h-4 {flagConfig.yellow.textColor} flex-shrink-0 mt-0.5" />
									<div class="flex-1 min-w-0">
										<p class="font-medium text-yellow-300 text-sm">{flag.signal}</p>
										<p class="text-xs text-gray-400 mt-1">{flag.reason}</p>
									</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}

		<!-- Red Flags Section -->
		{#if analysis.redFlags.length > 0}
			<div class="mb-4">
				<button
					onclick={() => toggleGroup('red')}
					class="w-full flex items-center justify-between p-3 rounded-lg border transition-all {flagConfig.red.bgColor} {flagConfig.red.borderColor} hover:border-red-500/50"
				>
					<div class="flex items-center gap-3">
						<svelte:component this={flagConfig.red.icon} class="w-5 h-5 {flagConfig.red.textColor}" />
						<span class="font-medium text-red-300">
							Red Flags ({analysis.redFlags.length})
						</span>
					</div>
					<ChevronDown
						class="w-5 h-5 text-red-300 transition-transform {expandedGroups.red ? 'rotate-180' : ''}"
					/>
				</button>

				{#if expandedGroups.red}
					<div class="mt-2 space-y-2">
						{#each analysis.redFlags as flag (flag.signal)}
							<div class="p-3 rounded-lg border {flagConfig.red.bgColor} {flagConfig.red.borderColor}">
								<div class="flex items-start gap-3">
									<XCircle class="w-4 h-4 {flagConfig.red.textColor} flex-shrink-0 mt-0.5" />
									<div class="flex-1 min-w-0">
										<p class="font-medium text-red-300 text-sm">{flag.signal}</p>
										<p class="text-xs text-gray-400 mt-1">{flag.reason}</p>
									</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}

		<!-- Citations Section -->
		{#if analysis.citations.length > 0}
			<div class="mt-6 p-3 rounded-lg border border-gray-700 bg-gray-800/20">
				<p class="text-xs font-medium text-gray-400 mb-2">Sources:</p>
				<div class="space-y-1">
					{#each analysis.citations as citation (citation)}
						<p class="text-xs text-gray-500 italic">{citation}</p>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Empty state -->
		{#if analysis.greenFlags.length === 0 && analysis.yellowFlags.length === 0 && analysis.redFlags.length === 0}
			<div class="text-center py-8">
				<p class="text-gray-400 text-sm">No compatibility analysis available yet</p>
			</div>
		{/if}
	{/if}
</div>

<style>
	:global(.rotate-180) {
		transform: rotate(180deg);
	}
</style>
