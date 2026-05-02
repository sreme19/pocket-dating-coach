<script lang="ts">
	import { onMount } from 'svelte';
	import { Upload, Loader2, User, Camera, FileText, Zap } from 'lucide-svelte';
	import FeedbackButtons from '$lib/components/FeedbackButtons.svelte';
	import type { ProfileFeedback, UserProfile } from '$lib/types';

	let userProfile = $state<UserProfile | null>(null);
	let selectedFile = $state<File | null>(null);
	let previewUrl = $state<string | null>(null);
	let loading = $state(false);
	let feedback = $state<ProfileFeedback | null>(null);
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
		feedback = null;
		error = '';
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		const file = e.dataTransfer?.files[0];
		if (!file || !file.type.startsWith('image/')) return;
		selectedFile = file;
		previewUrl = URL.createObjectURL(file);
		feedback = null;
	}

	async function analyzeProfile() {
		if (!selectedFile) return;
		loading = true;
		error = '';
		feedback = null;

		try {
			const formData = new FormData();
			formData.append('image', selectedFile);
			if (userProfile) formData.append('userProfile', JSON.stringify(userProfile));

			const res = await fetch('/api/analyze-profile', { method: 'POST', body: formData });
			if (!res.ok) throw new Error('Analysis failed');
			const data = await res.json();
			feedback = data.feedback;
		} catch {
			error = 'Something went wrong. Please try again.';
		} finally {
			loading = false;
		}
	}

	function reset() {
		selectedFile = null;
		previewUrl = null;
		feedback = null;
		feedbackValue = null;
		error = '';
	}
</script>

<div class="flex flex-col h-full overflow-y-auto">
	<!-- Header -->
	<div class="px-6 py-4 border-b border-gray-800 flex items-center gap-3 flex-shrink-0">
		<User class="w-5 h-5 text-rose-400" />
		<div>
			<h1 class="font-semibold text-white">Profile Review</h1>
			<p class="text-xs text-gray-500">Upload your dating app profile screenshot</p>
		</div>
	</div>

	<div class="flex-1 p-6 max-w-3xl mx-auto w-full">
		{#if !feedback}
			<!-- Upload area -->
			<div
				role="button"
				tabindex="0"
				ondrop={handleDrop}
				ondragover={(e) => e.preventDefault()}
				class="border-2 border-dashed border-gray-700 hover:border-rose-500/50 rounded-2xl p-8 text-center transition-all cursor-pointer mb-6 group"
				onclick={() => document.getElementById('file-input')?.click()}
				onkeydown={(e) => e.key === 'Enter' && document.getElementById('file-input')?.click()}
			>
				<input id="file-input" type="file" accept="image/*" class="hidden" onchange={handleFileSelect} />
				{#if previewUrl}
					<img src={previewUrl} alt="Profile preview" class="max-h-80 mx-auto rounded-xl object-contain" />
					<p class="text-sm text-gray-400 mt-3">Click to change image</p>
				{:else}
					<div class="flex flex-col items-center gap-3">
						<div class="w-16 h-16 rounded-2xl bg-gray-800 group-hover:bg-rose-600/10 flex items-center justify-center transition-all">
							<Camera class="w-8 h-8 text-gray-500 group-hover:text-rose-400 transition-colors" />
						</div>
						<div>
							<p class="font-medium text-white">Drop your profile screenshot here</p>
							<p class="text-sm text-gray-500 mt-1">Works with Tinder, Bumble, Hinge, or any dating app</p>
						</div>
						<button class="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition-all flex items-center gap-2">
							<Upload class="w-4 h-4" /> Browse files
						</button>
					</div>
				{/if}
			</div>

			{#if selectedFile}
				<button
					onclick={analyzeProfile}
					disabled={loading}
					class="w-full py-3.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
				>
					{#if loading}
						<Loader2 class="w-5 h-5 animate-spin" />
						Analyzing your profile...
					{:else}
						<Zap class="w-5 h-5" />
						Analyze My Profile
					{/if}
				</button>
			{/if}

			{#if error}
				<p class="text-rose-400 text-sm text-center mt-4">{error}</p>
			{/if}
		{:else}
			<!-- Results -->
			<div class="space-y-5">
				<div class="flex items-center justify-between">
					<h2 class="text-lg font-bold text-white">Your Profile Review</h2>
					<button onclick={reset} class="text-sm text-gray-400 hover:text-white transition-colors">← Analyze another</button>
				</div>

				<!-- Overall -->
				<div class="bg-rose-600/10 border border-rose-600/20 rounded-2xl p-4">
					<div class="flex items-center gap-2 mb-2">
						<Zap class="w-4 h-4 text-rose-400" />
						<span class="font-semibold text-rose-300 text-sm">Overall Takeaway</span>
					</div>
					<p class="text-gray-200 text-sm leading-relaxed">{feedback.overallTakeaway}</p>
				</div>

				<!-- Sections -->
				{#each [feedback.bio, feedback.photos, feedback.prompts, feedback.openingStrategy] as section}
					<div class="bg-gray-800/50 border border-gray-700 rounded-2xl p-5">
						<div class="flex items-center gap-2 mb-4">
							<FileText class="w-4 h-4 text-gray-400" />
							<h3 class="font-semibold text-white">{section.title}</h3>
						</div>
						<div class="space-y-4">
							{#each section.points as point}
								<div class="pl-3 border-l-2 border-gray-700">
									<p class="text-sm text-gray-300 mb-1"><span class="font-medium text-gray-100">Observation:</span> {point.observation}</p>
									<p class="text-sm text-emerald-400 mb-1"><span class="font-medium">Suggestion:</span> {point.suggestion}</p>
									{#if point.citation}
										<p class="text-xs text-gray-500 italic">{point.citation}</p>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				{/each}

				<FeedbackButtons value={feedbackValue} onFeedback={(v) => feedbackValue = v} />
			</div>
		{/if}
	</div>
</div>
