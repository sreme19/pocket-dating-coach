<script lang="ts">
	import { goto } from '$app/navigation';
	import { Copy, Download, Edit2, Check, X, Loader2, Share2 } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import { getMaleProfile, saveMaleProfile } from '$lib/male-profile';
	import ProfileCard from '$lib/components/ProfileCard.svelte';
	import type { MaleProfile } from '$lib/types';

	let profile = $state<MaleProfile | null>(null);
	let editingField = $state<keyof MaleProfile | null>(null);
	let editValue = $state('');
	let validating = $state(false);
	let showCard = $state(false);
	let copied = $state(false);

	onMount(() => {
		const stored = getMaleProfile();
		if (!stored) {
			// Try to fetch from localStorage fallback
			const fallback = localStorage.getItem('pdc_male_profile');
			profile = fallback ? JSON.parse(fallback) : null;
		} else {
			profile = stored;
		}

		if (!profile) {
			// Not ready - go back to chat
			goto('/profile-chat');
		}
	});

	function startEdit(field: keyof MaleProfile) {
		if (field === 'citations' || field === 'generatedAt' || field === 'feedback') return;
		editingField = field;
		editValue = String(profile?.[field] ?? '');
	}

	function cancelEdit() {
		editingField = null;
		editValue = '';
	}

	async function saveEdit() {
		if (!profile || !editingField) return;
		validating = true;

		try {
			const response = await fetch('/api/validate-profile-edit', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					field: editingField,
					originalValue: profile[editingField],
					newValue: editValue,
					profile
				})
			});

			const data = await response.json();
			if (data.error) throw new Error(data.error);

			// Update profile
			(profile as any)[editingField] = editValue;

			saveMaleProfile(profile);
			editingField = null;
			editValue = '';
		} catch (err) {
			alert('Failed to validate edit: ' + (err instanceof Error ? err.message : 'Unknown error'));
		} finally {
			validating = false;
		}
	}

	function copyToClipboard(text: string) {
		navigator.clipboard.writeText(text);
		copied = true;
		setTimeout(() => {
			copied = false;
		}, 2000);
	}

	function shareProfile() {
		if (!profile) return;
		const text = `${profile.headline}\n\n${profile.elevatorPitch}`;
		if (navigator.share) {
			navigator.share({
				title: 'My Dating Profile',
				text
			});
		} else {
			copyToClipboard(text);
		}
	}

	function downloadCard() {
		// Trigger card download - handled in ProfileCard component
		const btn = document.getElementById('download-btn') as HTMLButtonElement;
		btn?.click();
	}

	const fieldLabels: Record<string, string> = {
		headline: 'Headline',
		elevatorPitch: 'About You',
		coreStrengths: 'Core Strengths',
		growthEdges: 'Growth Edges',
		firstDateVibe: 'First Date Vibe',
		redFlagsAvoided: 'What You Avoid',
		compatibilitySignals: 'Compatibility Signals',
		conversationStarters: 'Conversation Starters',
		whyThisProfile: 'Why This Profile'
	};
</script>

<div class="min-h-screen bg-slate-950 text-white flex flex-col">
	<!-- Header -->
	<div class="px-6 py-6 border-b border-slate-800">
		<div class="max-w-4xl mx-auto">
			<h1 class="text-3xl font-bold mb-2">Your Profile is Ready 🎉</h1>
			<p class="text-slate-400">Review, edit, and share your psychographic profile</p>
		</div>
	</div>

	<!-- Content -->
	<div class="flex-1 px-6 py-12">
		<div class="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
			<!-- Profile content -->
			<div class="lg:col-span-2 space-y-6">
				{#if profile}
					<!-- Headline -->
					<div
						class="bg-slate-800/50 border border-slate-700 rounded-xl p-6 group hover:border-rose-500/30 transition-colors"
					>
						<div class="flex items-start justify-between mb-3">
							<div>
								<p class="text-xs uppercase tracking-wider text-slate-500 mb-1">Headline</p>
								<p class="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-amber-400">
									{profile.headline}
								</p>
							</div>
							<button
								onclick={() => startEdit('headline')}
								class="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-400 transition-all"
								title="Edit"
							>
								<Edit2 class="w-4 h-4" />
							</button>
						</div>
						<p class="text-xs text-slate-500">This is how you'd describe yourself</p>
					</div>

					<!-- Elevator Pitch -->
					<div
						class="bg-slate-800/50 border border-slate-700 rounded-xl p-6 group hover:border-rose-500/30 transition-colors"
					>
						<div class="flex items-start justify-between mb-3">
							<p class="text-xs uppercase tracking-wider text-slate-500">About You</p>
							<button
								onclick={() => startEdit('elevatorPitch')}
								class="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-400 transition-all"
								title="Edit"
							>
								<Edit2 class="w-4 h-4" />
							</button>
						</div>
						<p class="text-lg leading-relaxed mb-3">{profile.elevatorPitch}</p>
						<p class="text-xs text-slate-500">Your story in a nutshell</p>
					</div>

					<!-- Core Strengths -->
					{#if profile.coreStrengths?.length}
						<div
							class="bg-slate-800/50 border border-slate-700 rounded-xl p-6 group hover:border-rose-500/30 transition-colors"
						>
							<div class="flex items-start justify-between mb-3">
								<p class="text-xs uppercase tracking-wider text-slate-500">Core Strengths</p>
								<button
									onclick={() => startEdit('coreStrengths')}
									class="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-400 transition-all"
									title="Edit"
								>
									<Edit2 class="w-4 h-4" />
								</button>
							</div>
							<ul class="space-y-2 mb-3">
								{#each profile.coreStrengths as strength}
									<li class="flex items-start gap-3">
										<span class="text-amber-400 mt-1 flex-shrink-0">✦</span>
										<span>{strength}</span>
									</li>
								{/each}
							</ul>
							<p class="text-xs text-slate-500">What makes you genuinely stand out</p>
						</div>
					{/if}

					<!-- Growth Edges -->
					{#if profile.growthEdges?.length}
						<div
							class="bg-slate-800/30 border border-slate-700/60 rounded-xl p-6 group hover:border-slate-600 transition-colors"
						>
							<div class="flex items-start justify-between mb-3">
								<div>
									<p class="text-xs uppercase tracking-wider text-slate-500">Growth Edges</p>
									<p class="text-xs text-slate-600 mt-0.5">Honest self-awareness — a strength in itself</p>
								</div>
								<button
									onclick={() => startEdit('growthEdges')}
									class="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-300 transition-all"
									title="Edit"
								>
									<Edit2 class="w-4 h-4" />
								</button>
							</div>
							<ul class="space-y-2 mb-3">
								{#each profile.growthEdges as edge}
									<li class="flex items-start gap-3 text-slate-400">
										<span class="text-slate-500 mt-1 flex-shrink-0">◦</span>
										<span class="italic">{edge}</span>
									</li>
								{/each}
							</ul>
						</div>
					{/if}

					<!-- First Date Vibe -->
					<div
						class="bg-slate-800/50 border border-slate-700 rounded-xl p-6 group hover:border-rose-500/30 transition-colors"
					>
						<div class="flex items-start justify-between mb-3">
							<p class="text-xs uppercase tracking-wider text-slate-500">First Date Vibe</p>
							<button
								onclick={() => startEdit('firstDateVibe')}
								class="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-400 transition-all"
								title="Edit"
							>
								<Edit2 class="w-4 h-4" />
							</button>
						</div>
						<p class="text-base leading-relaxed mb-3">{profile.firstDateVibe}</p>
						<p class="text-xs text-slate-500">What a date with you would feel like</p>
					</div>

					<!-- Compatibility Signals -->
					<div
						class="bg-slate-800/50 border border-slate-700 rounded-xl p-6 group hover:border-rose-500/30 transition-colors"
					>
						<div class="flex items-start justify-between mb-3">
							<p class="text-xs uppercase tracking-wider text-slate-500">What Works</p>
							<button
								onclick={() => startEdit('compatibilitySignals')}
								class="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-400 transition-all"
								title="Edit"
							>
								<Edit2 class="w-4 h-4" />
							</button>
						</div>
						<ul class="space-y-2 mb-3">
							{#each profile.compatibilitySignals as signal}
								<li class="flex items-start gap-3">
									<span class="text-rose-400 mt-1">→</span>
									<span>{signal}</span>
								</li>
							{/each}
						</ul>
						<p class="text-xs text-slate-500">What kind of match vibes with you</p>
					</div>

					<!-- Conversation Starters -->
					<div
						class="bg-slate-800/50 border border-slate-700 rounded-xl p-6 group hover:border-rose-500/30 transition-colors"
					>
						<div class="flex items-start justify-between mb-3">
							<p class="text-xs uppercase tracking-wider text-slate-500">Conversation Starters</p>
							<button
								onclick={() => startEdit('conversationStarters')}
								class="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-400 transition-all"
								title="Edit"
							>
								<Edit2 class="w-4 h-4" />
							</button>
						</div>
						<ul class="space-y-2 mb-3">
							{#each profile.conversationStarters as starter}
								<li class="text-sm italic text-slate-300">"{starter}"</li>
							{/each}
						</ul>
						<p class="text-xs text-slate-500">How someone could open with you</p>
					</div>

					<!-- Why This Profile -->
					<div class="bg-emerald-600/10 border border-emerald-600/30 rounded-xl p-6">
						<p class="text-sm text-emerald-300 mb-2">{profile.whyThisProfile}</p>
						<p class="text-xs text-slate-500">How we got here</p>
					</div>
				{:else}
					<div class="text-center py-12">
						<Loader2 class="w-8 h-8 animate-spin mx-auto mb-4 text-slate-500" />
						<p class="text-slate-400">Loading your profile...</p>
					</div>
				{/if}
			</div>

			<!-- Sidebar: Preview Card -->
			<div class="lg:col-span-1">
				<div class="sticky top-6 space-y-4">
					{#if profile}
						<div class="bg-slate-800 border border-slate-700 rounded-xl p-6">
							<h3 class="font-bold mb-4 flex items-center gap-2">
								<span class="w-3 h-3 rounded-full bg-rose-500"></span>
								Preview
							</h3>
							<div class="space-y-3 mb-6 text-sm">
								<div>
									<p class="text-xs uppercase tracking-wider text-slate-500 mb-1">Headline</p>
									<p class="font-bold">{profile.headline}</p>
								</div>
								<div>
									<p class="text-xs uppercase tracking-wider text-slate-500 mb-1">Pitch</p>
									<p class="text-sm line-clamp-3">{profile.elevatorPitch}</p>
								</div>
								<div>
									<p class="text-xs uppercase tracking-wider text-slate-500 mb-2">Signals</p>
									<div class="flex flex-wrap gap-2">
										{#each profile.compatibilitySignals.slice(0, 2) as signal}
											<span class="bg-slate-700 px-2 py-1 rounded text-xs">{signal}</span>
										{/each}
									</div>
								</div>
							</div>

							<!-- Actions -->
							<div class="space-y-2">
								<button
									onclick={() => (showCard = !showCard)}
									class="w-full flex items-center justify-center gap-2 px-4 py-3 bg-rose-600 hover:bg-rose-700 rounded-lg font-medium transition-colors"
								>
									<Share2 class="w-4 h-4" />
									{showCard ? 'Hide Card' : 'Show Card'}
								</button>

								<button
									onclick={shareProfile}
									class="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors"
								>
									{#if copied}
										<Check class="w-4 h-4 text-emerald-400" />
										Copied!
									{:else}
										<Copy class="w-4 h-4" />
										Copy
									{/if}
								</button>

								<button
									onclick={() => goto('/')}
									class="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors"
								>
									← Explore More
								</button>
							</div>
						</div>

						{#if showCard}
							<div class="mt-4">
								<ProfileCard {profile} />
							</div>
						{/if}
					{/if}
				</div>
			</div>
		</div>
	</div>

	<!-- Edit Modal -->
	{#if editingField && profile}
		<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
			<div class="bg-slate-800 border border-slate-700 rounded-xl max-w-md w-full p-6">
				<h3 class="text-lg font-bold mb-4">
					Edit {fieldLabels[editingField]}
				</h3>

				{#if Array.isArray(profile[editingField as keyof MaleProfile])}
					<!-- For array fields -->
					<textarea
						bind:value={editValue}
						placeholder="Enter items separated by new lines..."
						class="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-rose-500 outline-none resize-none"
						rows="6"
					></textarea>
				{:else}
					<!-- For string fields -->
					<textarea
						bind:value={editValue}
						placeholder="Edit text..."
						class="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-rose-500 outline-none resize-none"
						rows="6"
					></textarea>
				{/if}

				<div class="flex gap-3 mt-6">
					<button
						onclick={cancelEdit}
						disabled={validating}
						class="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded-lg transition-colors flex items-center justify-center gap-2"
					>
						<X class="w-4 h-4" /> Cancel
					</button>
					<button
						onclick={saveEdit}
						disabled={validating}
						class="flex-1 px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-lg transition-colors flex items-center justify-center gap-2"
					>
						{#if validating}
							<Loader2 class="w-4 h-4 animate-spin" />
						{:else}
							<Check class="w-4 h-4" />
						{/if}
						Save
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>
