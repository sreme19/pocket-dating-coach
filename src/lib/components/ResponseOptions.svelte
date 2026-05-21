<script lang="ts">
	import { Copy, Check, Edit2 } from 'lucide-svelte';
	import type { ResponseOption } from '$lib/server/ai-assistant-service';

	interface Props {
		options: ResponseOption[];
		onSelect?: (option: ResponseOption) => void;
		onEdit?: (option: ResponseOption) => void;
		isLoading?: boolean;
	}

	let { options = [], onSelect, onEdit, isLoading = false }: Props = $props();

	let copiedId: string | null = $state(null);
	let selectedId: string | null = $state(null);

	// Tone color mapping
	const toneColors = {
		playful: 'border-amber-500/30 bg-amber-500/10',
		warm: 'border-rose-500/30 bg-rose-500/10',
		direct: 'border-blue-500/30 bg-blue-500/10'
	};

	const toneTextColors = {
		playful: 'text-amber-300',
		warm: 'text-rose-300',
		direct: 'text-blue-300'
	};

	const toneBadgeColors = {
		playful: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
		warm: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
		direct: 'bg-blue-500/20 text-blue-300 border-blue-500/30'
	};

	async function copyToClipboard(text: string, optionId: string | undefined) {
		try {
			await navigator.clipboard.writeText(text);
			copiedId = optionId || null;
			setTimeout(() => {
				copiedId = null;
			}, 2000);
		} catch (error) {
			console.error('Failed to copy to clipboard:', error);
		}
	}

	function handleSelect(option: ResponseOption) {
		selectedId = option.id || null;
		onSelect?.(option);
	}

	function handleEdit(option: ResponseOption) {
		onEdit?.(option);
	}
</script>

<div class="w-full">
	{#if isLoading}
		<!-- Loading state -->
		<div class="flex items-center justify-center py-8">
			<div class="flex flex-col items-center gap-3">
				<div class="w-8 h-8 border-2 border-gray-600 border-t-gray-300 rounded-full animate-spin"></div>
				<p class="text-sm text-gray-400">Generating response options...</p>
			</div>
		</div>
	{:else if options.length === 0}
		<!-- Empty state -->
		<div class="text-center py-8">
			<p class="text-gray-400 text-sm">No response options available</p>
		</div>
	{:else}
		<!-- Mobile: Horizontal scrollable list -->
		<div class="md:hidden overflow-x-auto pb-2 -mx-4 px-4">
			<div class="flex gap-3 min-w-min">
				{#each options as option (option.id)}
					<div
						class={`flex-shrink-0 w-80 p-4 rounded-lg border transition-all cursor-pointer ${
							selectedId === option.id
								? 'border-gray-400 bg-gray-800/50'
								: `${toneColors[option.tone]} hover:border-gray-400`
						}`}
						onclick={() => handleSelect(option)}
						role="button"
						tabindex="0"
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								handleSelect(option);
							}
						}}
					>
						<!-- Tone badge -->
						<div class="flex items-center justify-between mb-3">
							<span class={`px-2.5 py-1 rounded-full text-xs font-medium border ${toneBadgeColors[option.tone]}`}>
								{option.tone.charAt(0).toUpperCase() + option.tone.slice(1)}
							</span>
						</div>

						<!-- Message -->
						<p class="text-sm text-gray-200 mb-3 line-clamp-3">{option.message}</p>

						<!-- Why -->
						<p class="text-xs text-gray-400 mb-3 italic">{option.why}</p>

						<!-- Citation -->
						{#if option.citation}
							<p class="text-xs text-gray-500 mb-3 border-t border-gray-700 pt-2">{option.citation}</p>
						{/if}

						<!-- Action buttons -->
						<div class="flex gap-2">
							<button
								onclick={(e) => {
									e.stopPropagation();
									copyToClipboard(option.message, option.id);
								}}
								class="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition-colors text-xs font-medium"
								title="Copy message to clipboard"
							>
								{#if copiedId === option.id}
									<Check class="w-3.5 h-3.5" />
									<span>Copied</span>
								{:else}
									<Copy class="w-3.5 h-3.5" />
									<span>Copy</span>
								{/if}
							</button>
							<button
								onclick={(e) => {
									e.stopPropagation();
									handleEdit(option);
								}}
								class="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition-colors text-xs font-medium"
								title="Edit message before sending"
							>
								<Edit2 class="w-3.5 h-3.5" />
								<span>Edit</span>
							</button>
						</div>
					</div>
				{/each}
			</div>
		</div>

		<!-- Desktop: Grid layout -->
		<div class="hidden md:grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
			{#each options as option (option.id)}
				<div
					class={`p-4 rounded-lg border transition-all cursor-pointer ${
						selectedId === option.id
							? 'border-gray-400 bg-gray-800/50'
							: `${toneColors[option.tone]} hover:border-gray-400`
					}`}
					onclick={() => handleSelect(option)}
					role="button"
					tabindex="0"
					onkeydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							handleSelect(option);
						}
					}}
				>
					<!-- Tone badge -->
					<div class="flex items-center justify-between mb-3">
						<span class={`px-2.5 py-1 rounded-full text-xs font-medium border ${toneBadgeColors[option.tone]}`}>
							{option.tone.charAt(0).toUpperCase() + option.tone.slice(1)}
						</span>
					</div>

					<!-- Message -->
					<p class="text-sm text-gray-200 mb-3 line-clamp-4">{option.message}</p>

					<!-- Why -->
					<p class="text-xs text-gray-400 mb-3 italic">{option.why}</p>

					<!-- Citation -->
					{#if option.citation}
						<p class="text-xs text-gray-500 mb-3 border-t border-gray-700 pt-2">{option.citation}</p>
					{/if}

					<!-- Action buttons -->
					<div class="flex gap-2">
						<button
							onclick={(e) => {
								e.stopPropagation();
								copyToClipboard(option.message, option.id);
							}}
							class="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition-colors text-xs font-medium"
							title="Copy message to clipboard"
						>
							{#if copiedId === option.id}
								<Check class="w-3.5 h-3.5" />
								<span>Copied</span>
							{:else}
								<Copy class="w-3.5 h-3.5" />
								<span>Copy</span>
							{/if}
						</button>
						<button
							onclick={(e) => {
								e.stopPropagation();
								handleEdit(option);
							}}
							class="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition-colors text-xs font-medium"
							title="Edit message before sending"
						>
							<Edit2 class="w-3.5 h-3.5" />
							<span>Edit</span>
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	:global(.line-clamp-3) {
		display: -webkit-box;
		-webkit-line-clamp: 3;
		-webkit-box-orient: vertical;
		line-clamp: 3;
		overflow: hidden;
	}

	:global(.line-clamp-4) {
		display: -webkit-box;
		-webkit-line-clamp: 4;
		-webkit-box-orient: vertical;
		line-clamp: 4;
		overflow: hidden;
	}
</style>
