<script lang="ts">
	import { ThumbsUp, ThumbsDown } from 'lucide-svelte';

	let { onFeedback, value = null }: {
		onFeedback: (v: 'up' | 'down') => void;
		value?: 'up' | 'down' | null;
	} = $props();

	let showFollowup = $state(false);

	function handle(v: 'up' | 'down') {
		onFeedback(v);
		if (v === 'up') {
			showFollowup = true;
			setTimeout(() => (showFollowup = false), 8000);
		}
	}
</script>

<div class="flex items-center gap-2 mt-2">
	<span class="text-xs text-gray-500">Was this helpful?</span>
	<button
		onclick={() => handle('up')}
		class={`p-1.5 rounded-lg transition-all ${value === 'up' ? 'text-emerald-400 bg-emerald-400/10' : 'text-gray-500 hover:text-emerald-400 hover:bg-emerald-400/10'}`}
		title="Helpful"
	>
		<ThumbsUp class="w-3.5 h-3.5" />
	</button>
	<button
		onclick={() => handle('down')}
		class={`p-1.5 rounded-lg transition-all ${value === 'down' ? 'text-rose-400 bg-rose-400/10' : 'text-gray-500 hover:text-rose-400 hover:bg-rose-400/10'}`}
		title="Not helpful"
	>
		<ThumbsDown class="w-3.5 h-3.5" />
	</button>

	{#if showFollowup}
		<span class="text-xs text-emerald-400 animate-pulse">Glad it helped! Let me know how it goes 🤞</span>
	{/if}
</div>
