<script lang="ts">
	import { onMount } from 'svelte';
	import { Search, Loader2, Upload, Camera, ArrowRight, CheckCircle, XCircle, AlertCircle } from 'lucide-svelte';
	import FeedbackButtons from '$lib/components/FeedbackButtons.svelte';
	import type { ConversationAnalysis, UserProfile } from '$lib/types';

	let userProfile = $state<UserProfile | null>(null);
	let inputMode = $state<'text' | 'image'>('text');
	let conversationText = $state('');
	let selectedFile = $state<File | null>(null);
	let previewUrl = $state<string | null>(null);
	let loading = $state(false);
	let analysis = $state<ConversationAnalysis | null>(null);
	let error = $state('');
	let feedbackValue = $state<'up' | 'down' | null>(null);

	onMount(() => {
		const stored = localStorage.getItem('pdc_profile');
		if (stored) userProfile = JSON.parse(stored);
	});

	function handleFileSelect(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;
		selectedFile = file;
		previewUrl = URL.createObjectURL(file);
		analysis = null;
	}

	async function analyzeConversation() {
		if (!conversationText.trim() && !selectedFile) return;
		loading = true;
		error = '';
		analysis = null;

		try {
			const formData = new FormData();
			if (selectedFile) formData.append('image', selectedFile);
			if (conversationText.trim()) formData.append('text', conversationText.trim());
			if (userProfile) formData.append('userProfile', JSON.stringify(userProfile));

			const res = await fetch('/api/analyze-chat', { method: 'POST', body: formData });
			if (!res.ok) throw new Error('Analysis failed');
			const data = await res.json();
			analysis = data.analysis;
		} catch {
			error = 'Something went wrong. Please try again.';
		} finally {
			loading = false;
		}
	}

	function reset() {
		conversationText = '';
		selectedFile = null;
		previewUrl = null;
		analysis = null;
		feedbackValue = null;
		error = '';
	}
</script>

<div class="flex flex-col h-full overflow-y-auto">
	<!-- Header -->
	<div class="px-6 py-4 border-b border-gray-800 flex items-center gap-3 flex-shrink-0">
		<Search class="w-5 h-5 text-rose-400" />
		<div>
			<h1 class="font-semibold text-white">Chat Analyzer</h1>
			<p class="text-xs text-gray-500">Get feedback on your conversations</p>
		</div>
	</div>

	<div class="flex-1 p-6 max-w-3xl mx-auto w-full">
		{#if !analysis}
			<!-- Mode toggle -->
			<div class="flex bg-gray-800 rounded-xl p-1 mb-6">
				<button
					onclick={() => inputMode = 'text'}
					class={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${inputMode === 'text' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
				>
					Paste Text
				</button>
				<button
					onclick={() => inputMode = 'image'}
					class={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${inputMode === 'image' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
				>
					Upload Screenshot
				</button>
			</div>

			{#if inputMode === 'text'}
				<div class="mb-6">
					<label class="block text-sm font-medium text-gray-300 mb-2" for="conversation-text">Paste your last 4–6 messages</label>
					<textarea
						id="conversation-text"
						bind:value={conversationText}
						placeholder="Format like:&#10;You: Hey! Loved your photo at the beach 🏖️&#10;Them: Haha thanks! I go there every summer&#10;You: That's cool, where is it?&#10;Them: Goa! You been?&#10;You: Not yet but it's on my list..."
						rows="10"
						class="w-full bg-gray-800 border border-gray-700 focus:border-rose-500/50 text-white placeholder-gray-600 rounded-xl px-4 py-3 text-sm outline-none transition-colors resize-none"
					></textarea>
					<p class="text-xs text-gray-600 mt-1">Include 4–6 messages for best results. Format as "You: ..." and "Them: ..."</p>
				</div>
			{:else}
				<div
					role="button"
					tabindex="0"
					class="border-2 border-dashed border-gray-700 hover:border-rose-500/50 rounded-2xl p-8 text-center transition-all cursor-pointer mb-6 group"
					onclick={() => document.getElementById('chat-file-input')?.click()}
					onkeydown={(e) => e.key === 'Enter' && document.getElementById('chat-file-input')?.click()}
				>
					<input id="chat-file-input" type="file" accept="image/*" class="hidden" onchange={handleFileSelect} />
					{#if previewUrl}
						<img src={previewUrl} alt="Conversation screenshot" class="max-h-80 mx-auto rounded-xl object-contain" />
						<p class="text-sm text-gray-400 mt-3">Click to change image</p>
					{:else}
						<div class="flex flex-col items-center gap-3">
							<div class="w-16 h-16 rounded-2xl bg-gray-800 group-hover:bg-rose-600/10 flex items-center justify-center transition-all">
								<Camera class="w-8 h-8 text-gray-500 group-hover:text-rose-400 transition-colors" />
							</div>
							<div>
								<p class="font-medium text-white">Upload conversation screenshot</p>
								<p class="text-sm text-gray-500 mt-1">Screenshot from any dating app</p>
							</div>
							<button class="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition-all flex items-center gap-2">
								<Upload class="w-4 h-4" /> Browse files
							</button>
						</div>
					{/if}
				</div>
			{/if}

			<button
				onclick={analyzeConversation}
				disabled={loading || (!conversationText.trim() && !selectedFile)}
				class="w-full py-3.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
			>
				{#if loading}
					<Loader2 class="w-5 h-5 animate-spin" />
					Analyzing conversation...
				{:else}
					<Search class="w-5 h-5" />
					Analyze Conversation
				{/if}
			</button>

			{#if error}
				<p class="text-rose-400 text-sm text-center mt-4">{error}</p>
			{/if}
		{:else}
			<!-- Results -->
			<div class="space-y-5">
				<div class="flex items-center justify-between">
					<h2 class="text-lg font-bold text-white">Conversation Analysis</h2>
					<button onclick={reset} class="text-sm text-gray-400 hover:text-white transition-colors">← Analyze another</button>
				</div>

				<!-- Next move - hero -->
				<div class="bg-rose-600/15 border border-rose-500/30 rounded-2xl p-5">
					<div class="flex items-center gap-2 mb-2">
						<ArrowRight class="w-5 h-5 text-rose-400" />
						<span class="font-bold text-rose-300">Your Next Move</span>
					</div>
					<p class="text-white text-sm leading-relaxed font-medium">{analysis.nextMove}</p>
				</div>

				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<!-- What's working -->
					<div class="bg-emerald-600/10 border border-emerald-600/20 rounded-2xl p-4">
						<div class="flex items-center gap-2 mb-3">
							<CheckCircle class="w-4 h-4 text-emerald-400" />
							<span class="font-semibold text-emerald-300 text-sm">What's Working</span>
						</div>
						<ul class="space-y-1.5">
							{#each analysis.whatIsWorking as point}
								<li class="text-sm text-gray-300 flex gap-2"><span class="text-emerald-400 mt-0.5">•</span>{point}</li>
							{/each}
						</ul>
					</div>

					<!-- What needs work -->
					<div class="bg-amber-600/10 border border-amber-600/20 rounded-2xl p-4">
						<div class="flex items-center gap-2 mb-3">
							<XCircle class="w-4 h-4 text-amber-400" />
							<span class="font-semibold text-amber-300 text-sm">Needs Work</span>
						</div>
						<ul class="space-y-1.5">
							{#each analysis.whatNeedsWork as point}
								<li class="text-sm text-gray-300 flex gap-2"><span class="text-amber-400 mt-0.5">•</span>{point}</li>
							{/each}
						</ul>
					</div>
				</div>

				<!-- Patterns -->
				{#if analysis.patterns.length > 0}
					<div class="bg-gray-800/50 border border-gray-700 rounded-2xl p-4">
						<div class="flex items-center gap-2 mb-3">
							<AlertCircle class="w-4 h-4 text-gray-400" />
							<span class="font-semibold text-gray-300 text-sm">Patterns Observed</span>
						</div>
						<ul class="space-y-1.5">
							{#each analysis.patterns as p}
								<li class="text-sm text-gray-400 flex gap-2"><span class="text-gray-500 mt-0.5">•</span>{p}</li>
							{/each}
						</ul>
					</div>
				{/if}

				<!-- Citations -->
				{#if analysis.citations.length > 0}
					<div class="border-t border-gray-800 pt-4">
						{#each analysis.citations as c}
							<p class="text-xs text-gray-500 italic">{c}</p>
						{/each}
					</div>
				{/if}

				<FeedbackButtons value={feedbackValue} onFeedback={(v) => feedbackValue = v} />
			</div>
		{/if}
	</div>
</div>
