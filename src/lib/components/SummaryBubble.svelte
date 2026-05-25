<script lang="ts">
	import { ChevronDown, TrendingUp, TrendingDown, Minus, CheckCircle, AlertCircle, XCircle, Zap } from 'lucide-svelte';
	import type { MatchSummary } from '../../routes/api/ai-bestie/summary/+server';

	interface Props {
		summaries: MatchSummary[];
		lastUpdated: number;
		isLoading?: boolean;
		onRefresh?: () => void;
	}

	let { summaries = [], lastUpdated = 0, isLoading = false, onRefresh }: Props = $props();

	// Track expanded state for each match
	let expandedMatches = $state<Record<string, boolean>>({});

	function toggleMatch(matchId: string) {
		expandedMatches[matchId] = !expandedMatches[matchId];
	}

	// Format timestamp to readable time
	function formatTime(timestamp: number): string {
		const date = new Date(timestamp);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);

		if (diffMins < 1) return 'just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;

		return date.toLocaleDateString();
	}

	// Get momentum icon and color
	function getMomentumDisplay(momentum: string) {
		switch (momentum) {
			case 'heating_up':
				return {
					icon: TrendingUp,
					color: 'text-red-400',
					label: 'Heating up',
					bgColor: 'bg-red-500/10',
					borderColor: 'border-red-500/30'
				};
			case 'cooling_down':
				return {
					icon: TrendingDown,
					color: 'text-blue-400',
					label: 'Cooling down',
					bgColor: 'bg-blue-500/10',
					borderColor: 'border-blue-500/30'
				};
			default:
				return {
					icon: Minus,
					color: 'text-yellow-400',
					label: 'Steady',
					bgColor: 'bg-yellow-500/10',
					borderColor: 'border-yellow-500/30'
				};
		}
	}

	// Calculate total flags
	function getTotalFlags(summary: MatchSummary) {
		return summary.greenFlags.length + summary.yellowFlags.length + summary.redFlags.length;
	}

	// Get flag summary text
	function getFlagSummary(summary: MatchSummary): string {
		const parts = [];
		if (summary.greenFlags.length > 0) parts.push(`${summary.greenFlags.length}🟢`);
		if (summary.yellowFlags.length > 0) parts.push(`${summary.yellowFlags.length}🟡`);
		if (summary.redFlags.length > 0) parts.push(`${summary.redFlags.length}🔴`);
		return parts.join(' ');
	}
</script>

<div class="w-full">
	<!-- Header -->
	<div class="flex items-center justify-between mb-4 px-4 py-3 rounded-lg border border-gray-700 bg-gray-800/30">
		<div class="flex items-center gap-3">
			<Zap class="w-5 h-5 text-amber-400" />
			<div>
				<h3 class="font-semibold text-gray-100">Match Insights</h3>
				<p class="text-xs text-gray-400">Last updated {formatTime(lastUpdated)}</p>
			</div>
		</div>
		{#if onRefresh}
			<button
				onclick={onRefresh}
				disabled={isLoading}
				class="p-2 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
				title="Refresh summaries"
			>
				<svg
					class="w-4 h-4 text-gray-400 {isLoading ? 'animate-spin' : ''}"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
				</svg>
			</button>
		{/if}
	</div>

	{#if isLoading}
		<!-- Loading state -->
		<div class="flex items-center justify-center py-12">
			<div class="flex flex-col items-center gap-3">
				<div class="w-8 h-8 border-2 border-gray-600 border-t-gray-300 rounded-full animate-spin"></div>
				<p class="text-sm text-gray-400">Loading insights...</p>
			</div>
		</div>
	{:else if summaries.length === 0}
		<!-- Empty state -->
		<div class="text-center py-12 px-4">
			<div class="mb-3">
				<Zap class="w-12 h-12 text-gray-600 mx-auto opacity-50" />
			</div>
			<p class="text-gray-400 text-sm">No active conversations yet</p>
			<p class="text-gray-500 text-xs mt-1">Start a conversation with a match to see insights</p>
		</div>
	{:else}
		<!-- Summaries list -->
		<div class="space-y-3">
			{#each summaries as summary (summary.matchId)}
				<div class="rounded-lg border border-gray-700 bg-gray-800/20 overflow-hidden transition-all hover:border-gray-600">
					<!-- Summary card header (always visible) -->
					<button
						onclick={() => toggleMatch(summary.matchId)}
						class="w-full p-4 flex items-start justify-between hover:bg-gray-800/40 transition-colors"
					>
						<div class="flex-1 min-w-0 text-left">
							<!-- Match name and message count -->
							<div class="flex items-center gap-2 mb-2">
								<h4 class="font-semibold text-gray-100 truncate">{summary.matchName || 'Match'}</h4>
								<span class="text-xs text-gray-500 bg-gray-700/50 px-2 py-0.5 rounded">
									{summary.messageCount} messages
								</span>
							</div>

							<!-- Key insights preview (first insight only on mobile, all on desktop) -->
							<div class="hidden sm:block mb-3">
								{#if summary.keyInsights.length > 0}
									<p class="text-sm text-gray-300 line-clamp-2">{summary.keyInsights[0]}</p>
								{/if}
							</div>

							<!-- Flags summary and momentum -->
							<div class="flex flex-wrap items-center gap-2">
								<!-- Flags -->
								{#if getTotalFlags(summary) > 0}
									<div class="text-xs font-medium text-gray-400">
										{getFlagSummary(summary)}
									</div>
								{/if}

								<!-- Momentum indicator -->
								{#if true}
									{@const momentumDisplay = getMomentumDisplay(summary.conversationMomentum)}
									<div class="flex items-center gap-1 px-2 py-1 rounded-full {momentumDisplay.bgColor} {momentumDisplay.borderColor} border">
										<svelte:component this={momentumDisplay.icon} class="w-3 h-3 {momentumDisplay.color}" />
										<span class="text-xs font-medium {momentumDisplay.color}">
											{momentumDisplay.label}
										</span>
									</div>
								{/if}

								<!-- Last message time -->
								<span class="text-xs text-gray-500 ml-auto">
									{formatTime(summary.lastMessageTime)}
								</span>
							</div>
						</div>

						<!-- Expand/collapse chevron -->
						<ChevronDown
							class="w-5 h-5 text-gray-400 flex-shrink-0 ml-2 transition-transform {expandedMatches[summary.matchId] ? 'rotate-180' : ''}"
						/>
					</button>

					<!-- Expanded details -->
					{#if expandedMatches[summary.matchId]}
						<div class="border-t border-gray-700 px-4 py-4 bg-gray-800/10 space-y-4">
							<!-- Key insights -->
							{#if summary.keyInsights.length > 0}
								<div>
									<h5 class="text-xs font-semibold text-gray-300 mb-2 uppercase tracking-wide">Key Insights</h5>
									<div class="space-y-2">
										{#each summary.keyInsights as insight (insight)}
											<p class="text-sm text-gray-300 leading-relaxed">• {insight}</p>
										{/each}
									</div>
								</div>
							{/if}

							<!-- Flags breakdown -->
							{#if getTotalFlags(summary) > 0}
								<div class="space-y-2">
									<!-- Green flags -->
									{#if summary.greenFlags.length > 0}
										<div class="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
											<div class="flex items-center gap-2 mb-2">
												<CheckCircle class="w-4 h-4 text-green-400" />
												<span class="text-sm font-medium text-green-300">
													Green Flags ({summary.greenFlags.length})
												</span>
											</div>
											<div class="space-y-1">
												{#each summary.greenFlags as flag (flag)}
													<p class="text-xs text-green-200">✓ {flag}</p>
												{/each}
											</div>
										</div>
									{/if}

									<!-- Yellow flags -->
									{#if summary.yellowFlags.length > 0}
										<div class="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
											<div class="flex items-center gap-2 mb-2">
												<AlertCircle class="w-4 h-4 text-yellow-400" />
												<span class="text-sm font-medium text-yellow-300">
													Yellow Flags ({summary.yellowFlags.length})
												</span>
											</div>
											<div class="space-y-1">
												{#each summary.yellowFlags as flag (flag)}
													<p class="text-xs text-yellow-200">⚠ {flag}</p>
												{/each}
											</div>
										</div>
									{/if}

									<!-- Red flags -->
									{#if summary.redFlags.length > 0}
										<div class="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
											<div class="flex items-center gap-2 mb-2">
												<XCircle class="w-4 h-4 text-red-400" />
												<span class="text-sm font-medium text-red-300">
													Red Flags ({summary.redFlags.length})
												</span>
											</div>
											<div class="space-y-1">
												{#each summary.redFlags as flag (flag)}
													<p class="text-xs text-red-200">✕ {flag}</p>
												{/each}
											</div>
										</div>
									{/if}
								</div>
							{/if}

							<!-- Recommended next move -->
							<div class="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
								<h5 class="text-xs font-semibold text-blue-300 mb-2 uppercase tracking-wide">Next Move</h5>
								<p class="text-sm text-blue-200">{summary.recommendedNextMove}</p>
							</div>
						</div>
					{/if}
				</div>
			{/each}
		</div>

		<!-- Mobile-specific compact view note -->
		<div class="mt-4 text-xs text-gray-500 text-center sm:hidden">
			Tap a match to see full details
		</div>
	{/if}
</div>

<style>
	:global(.rotate-180) {
		transform: rotate(180deg);
	}

	:global(.line-clamp-2) {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	:global(.animate-spin) {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}
</style>
