<script lang="ts">
	import { onMount } from 'svelte';
	import { ChevronRight, Loader2, Sparkles, Copy, Check } from 'lucide-svelte';
	import FeedbackButtons from '$lib/components/FeedbackButtons.svelte';
	import type { ReplyOption, UserProfile } from '$lib/types';

	let userProfile = $state<UserProfile | null>(null);
	let conversationHistory = $state('');
	let matchLastMessage = $state('');
	let loading = $state(false);
	let replies = $state<ReplyOption[]>([]);
	let error = $state('');
	let copiedIdx = $state<number | null>(null);

	const toneColors: Record<string, string> = {
		playful: 'text-amber-300 bg-amber-600/10 border-amber-600/20',
		warm: 'text-rose-300 bg-rose-600/10 border-rose-600/20',
		direct: 'text-blue-300 bg-blue-600/10 border-blue-600/20'
	};

	const toneEmoji: Record<string, string> = {
		playful: '😄',
		warm: '🤗',
		direct: '💬'
	};

	onMount(() => {
		const stored = localStorage.getItem('pdc_profile');
		if (stored) userProfile = JSON.parse(stored);
	});

	async function generateReplies() {
		if (!matchLastMessage.trim()) return;
		loading = true;
		error = '';
		replies = [];

		try {
			const res = await fetch('/api/suggest-reply', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					conversationHistory: conversationHistory.trim(),
					matchLastMessage: matchLastMessage.trim(),
					userProfile
				})
			});
			if (!res.ok) throw new Error('Failed to generate replies');
			const data = await res.json();
			replies = data.replies;
		} catch {
			error = 'Something went wrong. Please try again.';
		} finally {
			loading = false;
		}
	}

	async function copyReply(text: string, idx: number) {
		await navigator.clipboard.writeText(text);
		copiedIdx = idx;
		setTimeout(() => (copiedIdx = null), 2000);
	}

	function setReplyFeedback(idx: number, value: 'up' | 'down') {
		replies = replies.map((r, i) => i === idx ? { ...r, feedback: value } : r);
	}

	function reset() {
		replies = [];
		error = '';
	}
</script>

<div class="flex flex-col h-full overflow-y-auto">
	<!-- Header -->
	<div class="px-6 py-4 border-b border-gray-800 flex items-center gap-3 flex-shrink-0">
		<ChevronRight class="w-5 h-5 text-rose-400" />
		<div>
			<h1 class="font-semibold text-white">Reply Suggester</h1>
			<p class="text-xs text-gray-500">Get 3 reply options for any message</p>
		</div>
	</div>

	<div class="flex-1 p-6 max-w-3xl mx-auto w-full">
		<div class="space-y-5">
			<!-- Conversation context -->
			<div>
				<label for="history" class="block text-sm font-medium text-gray-300 mb-2">
					Conversation so far <span class="text-gray-500 font-normal">(optional, but recommended)</span>
				</label>
				<textarea
					id="history"
					bind:value={conversationHistory}
					placeholder="You: Hey! Love that you're into hiking 🏔️&#10;Them: Yes! I go every weekend if I can&#10;You: That's amazing, where do you usually go?"
					rows="5"
					class="w-full bg-gray-800 border border-gray-700 focus:border-rose-500/50 text-white placeholder-gray-600 rounded-xl px-4 py-3 text-sm outline-none transition-colors resize-none"
				></textarea>
			</div>

			<!-- Their last message -->
			<div>
				<label for="last-msg" class="block text-sm font-medium text-gray-300 mb-2">
					Their latest message <span class="text-rose-400">*</span>
				</label>
				<textarea
					id="last-msg"
					bind:value={matchLastMessage}
					placeholder="e.g. Honestly not sure, there are so many good spots near the city. Do you hike?"
					rows="3"
					class="w-full bg-gray-800 border border-gray-700 focus:border-rose-500/50 text-white placeholder-gray-600 rounded-xl px-4 py-3 text-sm outline-none transition-colors resize-none"
				></textarea>
			</div>

			<button
				onclick={generateReplies}
				disabled={loading || !matchLastMessage.trim()}
				class="w-full py-3.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
			>
				{#if loading}
					<Loader2 class="w-5 h-5 animate-spin" />
					Crafting your replies...
				{:else}
					<Sparkles class="w-5 h-5" />
					Generate 3 Replies
				{/if}
			</button>

			{#if error}
				<p class="text-rose-400 text-sm text-center">{error}</p>
			{/if}

			<!-- Reply options -->
			{#if replies.length > 0}
				<div class="space-y-4 pt-2">
					<div class="flex items-center justify-between">
						<h2 class="font-semibold text-white">Your Reply Options</h2>
						<button onclick={reset} class="text-sm text-gray-400 hover:text-white transition-colors">Generate new</button>
					</div>

					{#each replies as reply, i}
						<div class={`border rounded-2xl p-5 ${toneColors[reply.tone] ?? 'text-gray-300 bg-gray-800/50 border-gray-700'}`}>
							<div class="flex items-center justify-between mb-3">
								<div class="flex items-center gap-2">
									<span class="text-lg">{toneEmoji[reply.tone] ?? '💬'}</span>
									<span class="font-semibold capitalize text-sm">{reply.tone}</span>
								</div>
								<button
									onclick={() => copyReply(reply.message, i)}
									class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/20 hover:bg-black/30 transition-all text-xs font-medium"
								>
									{#if copiedIdx === i}
										<Check class="w-3.5 h-3.5" /> Copied!
									{:else}
										<Copy class="w-3.5 h-3.5" /> Copy
									{/if}
								</button>
							</div>

							<p class="text-white font-medium text-sm mb-3 leading-relaxed">"{reply.message}"</p>

							<p class="text-xs opacity-70 mb-1">{reply.why}</p>
							{#if reply.citation}
								<p class="text-xs opacity-50 italic">{reply.citation}</p>
							{/if}

							<FeedbackButtons value={reply.feedback ?? null} onFeedback={(v) => setReplyFeedback(i, v)} />
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>
