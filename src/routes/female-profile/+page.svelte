<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Camera,
		CheckCircle,
		HeartHandshake,
		Lock,
		Plus,
		RefreshCw,
		Send,
		ShieldCheck,
		Sparkles,
		Trash2,
		Upload
	} from 'lucide-svelte';
	import {
		generateFemaleProfile,
		nextFemalePrompt,
		buildFemalePreferenceModel
	} from '$lib/female-profile';
	import type {
		FemaleGeneratedProfile,
		FemaleJourneyAnswer,
		FemalePhotoAsset,
		FemalePreferenceModel,
		FemaleProfileStage
	} from '$lib/types';

	const STORAGE_KEY = 'pdc_female_journey';
	const SESSION_KEY = 'pdc_session_id';

	let stage = $state<FemaleProfileStage>('profile');
	let sessionId = $state('');
	let displayName = $state('');
	let ageRange = $state('25-30');
	let city = $state('');
	let intent = $state('intentional dating');
	let photoAssets = $state<FemalePhotoAsset[]>([]);
	let answers = $state<FemaleJourneyAnswer[]>([]);
	let currentAnswer = $state('');
	let approvedForMatching = $state(false);
	let generatedProfile = $state<FemaleGeneratedProfile | null>(null);
	let preferenceModel = $state<FemalePreferenceModel | null>(null);
	let syncStatus = $state<'idle' | 'saving' | 'saved' | 'offline' | 'error' | 'uploading'>('idle');
	let activePrompt = $derived(nextFemalePrompt(answers));

	const roleOptions: Array<{ value: FemalePhotoAsset['storyRole']; label: string }> = [
		{ value: 'lead', label: 'Lead' },
		{ value: 'warmth', label: 'Warmth' },
		{ value: 'lifestyle', label: 'Lifestyle' },
		{ value: 'conversation', label: 'Conversation' },
		{ value: 'social', label: 'Social' }
	];

	onMount(async () => {
		sessionId = getOrCreateSessionId();
		const stored = localStorage.getItem(STORAGE_KEY);
		if (!stored) return;
		const parsed = JSON.parse(stored);
		applyStoredProfile(parsed);
		await loadRemoteProfile();
	});

	function getOrCreateSessionId() {
		const stored = localStorage.getItem(SESSION_KEY);
		if (stored) return stored;
		const next = crypto.randomUUID();
		localStorage.setItem(SESSION_KEY, next);
		return next;
	}

	function applyStoredProfile(parsed: {
		stage?: FemaleProfileStage;
		displayName?: string;
		ageRange?: string;
		city?: string;
		intent?: string;
		photoAssets?: FemalePhotoAsset[];
		answers?: FemaleJourneyAnswer[];
		approvedForMatching?: boolean;
		generatedProfile?: FemaleGeneratedProfile | null;
		preferenceModel?: FemalePreferenceModel | null;
	}) {
		displayName = parsed.displayName ?? '';
		ageRange = parsed.ageRange ?? '25-30';
		city = parsed.city ?? '';
		intent = parsed.intent ?? 'intentional dating';
		photoAssets = parsed.photoAssets ?? [];
		answers = parsed.answers ?? [];
		approvedForMatching = parsed.approvedForMatching ?? false;
		generatedProfile = parsed.generatedProfile ?? null;
		preferenceModel = parsed.preferenceModel ?? null;
		stage = parsed.stage ?? 'profile';
	}

	async function loadRemoteProfile() {
		if (!sessionId) return;
		try {
			const response = await fetch(`/api/female-profile?sessionId=${encodeURIComponent(sessionId)}`);
			if (!response.ok) return;
			const data = await response.json();
			if (!data.profile) return;
			applyStoredProfile({
				...data.profile,
				stage: data.profile.generatedProfile ? 'review' : data.profile.answers?.length ? 'fantasy' : 'profile'
			});
			persistLocal();
			syncStatus = 'saved';
		} catch {
			syncStatus = 'offline';
		}
	}

	function persistLocal() {
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({
				stage,
				displayName,
				ageRange,
				city,
				intent,
				photoAssets,
				answers,
				approvedForMatching,
				generatedProfile,
				preferenceModel
			})
		);
	}

	async function persist() {
		persistLocal();
		if (!sessionId) return;
		syncStatus = 'saving';
		try {
			const response = await fetch('/api/female-profile', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sessionId,
					displayName,
					ageRange,
					city,
					intent,
					approvedForMatching,
					photoAssets,
					answers,
					generatedProfile,
					preferenceModel
				})
			});
			if (!response.ok) throw new Error('Save failed');
			syncStatus = 'saved';
		} catch {
			syncStatus = 'offline';
		}
	}

	async function uploadPhoto(file: File): Promise<Pick<FemalePhotoAsset, 'url' | 'storagePath'>> {
		if (!sessionId) return { url: URL.createObjectURL(file), storagePath: null };
		const formData = new FormData();
		formData.append('sessionId', sessionId);
		formData.append('file', file);
		const response = await fetch('/api/female-profile/photo', {
			method: 'POST',
			body: formData
		});
		if (!response.ok) throw new Error('Photo upload failed');
		const data = await response.json();
		return {
			url: data.signedUrl,
			storagePath: data.storagePath
		};
	}

	async function handlePhotoSelect(event: Event) {
		const files = Array.from((event.target as HTMLInputElement).files ?? []);
		if (files.length === 0) return;
		syncStatus = 'uploading';
		const nextPhotos: FemalePhotoAsset[] = [];
		for (const [index, file] of files.entries()) {
			try {
				const uploaded = await uploadPhoto(file);
				nextPhotos.push({
					id: crypto.randomUUID(),
					name: file.name,
					url: uploaded.url,
					storagePath: uploaded.storagePath,
					storyRole: (index === 0 && photoAssets.length === 0 ? 'lead' : 'lifestyle') as FemalePhotoAsset['storyRole'],
					note: ''
				});
			} catch {
				nextPhotos.push({
					id: crypto.randomUUID(),
					name: file.name,
					url: URL.createObjectURL(file),
					storagePath: null,
					storyRole: (index === 0 && photoAssets.length === 0 ? 'lead' : 'lifestyle') as FemalePhotoAsset['storyRole'],
					note: ''
				});
				syncStatus = 'offline';
			}
		}
		photoAssets = [...photoAssets, ...nextPhotos].slice(0, 8);
		void persist();
		(event.target as HTMLInputElement).value = '';
	}

	function updatePhotoRole(id: string, storyRole: FemalePhotoAsset['storyRole']) {
		photoAssets = photoAssets.map((photo) => (photo.id === id ? { ...photo, storyRole } : photo));
		void persist();
	}

	function updatePhotoNote(id: string, note: string) {
		photoAssets = photoAssets.map((photo) => (photo.id === id ? { ...photo, note } : photo));
		void persist();
	}

	function removePhoto(id: string) {
		photoAssets = photoAssets.filter((photo) => photo.id !== id);
		void persist();
	}

	function continueToFantasy() {
		stage = 'fantasy';
		void persist();
	}

	function addAnswer() {
		if (!activePrompt || !currentAnswer.trim()) return;
		answers = [
			...answers,
			{
				id: crypto.randomUUID(),
				prompt: activePrompt.prompt,
				answer: currentAnswer.trim(),
				category: activePrompt.category
			}
		];
		currentAnswer = '';
		generatedProfile = null;
		preferenceModel = null;
		void persist();
	}

	function removeAnswer(id: string) {
		answers = answers.filter((answer) => answer.id !== id);
		generatedProfile = null;
		preferenceModel = null;
		void persist();
	}

	function generateProfile() {
		preferenceModel = buildFemalePreferenceModel(answers);
		generatedProfile = generateFemaleProfile(answers, photoAssets, approvedForMatching);
		stage = 'review';
		void persist();
	}

	function toggleApproval() {
		approvedForMatching = !approvedForMatching;
		if (generatedProfile) {
			generatedProfile = { ...generatedProfile, approvedForMatching };
		}
		void persist();
	}

	function resetJourney() {
		displayName = '';
		ageRange = '25-30';
		city = '';
		intent = 'intentional dating';
		photoAssets = [];
		answers = [];
		currentAnswer = '';
		approvedForMatching = false;
		generatedProfile = null;
		preferenceModel = null;
		stage = 'profile';
		localStorage.removeItem(STORAGE_KEY);
		syncStatus = 'idle';
	}
</script>

<div class="flex h-full flex-col overflow-y-auto bg-gray-950">
	<div class="flex flex-shrink-0 items-center justify-between border-b border-gray-800 px-6 py-4">
		<div class="flex items-center gap-3">
			<Sparkles class="h-5 w-5 text-rose-400" />
			<div>
				<h1 class="font-semibold text-white">For Her</h1>
				<p class="text-xs text-gray-500">Profile, desire map, and matching brief</p>
			</div>
		</div>
		<button onclick={resetJourney} class="rounded-lg border border-gray-700 px-3 py-2 text-xs font-medium text-gray-400 transition-all hover:border-rose-500/50 hover:text-white">
			Reset
		</button>
	</div>

	<div class="border-b border-gray-900 px-6 py-2 text-xs text-gray-500">
		{#if syncStatus === 'saving'}
			Saving to Supabase...
		{:else if syncStatus === 'uploading'}
			Uploading photos to Supabase Storage...
		{:else if syncStatus === 'saved'}
			Saved to Supabase and this device
		{:else if syncStatus === 'offline'}
			Saved locally. Supabase sync will retry when the API is available.
		{:else if syncStatus === 'error'}
			Could not save latest changes
		{:else}
			Ready
		{/if}
	</div>

	<div class="mx-auto grid w-full max-w-6xl flex-1 gap-6 p-6 lg:grid-cols-[240px_minmax(0,1fr)]">
		<aside class="space-y-3">
			<button
					onclick={() => { stage = 'profile'; void persist(); }}
				class={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
					stage === 'profile'
						? 'border-rose-500/40 bg-rose-600/15 text-rose-200'
						: 'border-gray-800 bg-gray-900/70 text-gray-400 hover:border-gray-700 hover:text-white'
				}`}
			>
				<Camera class="h-4 w-4" />
				<span class="text-sm font-medium">Profile & photos</span>
			</button>
			<button
				onclick={() => { stage = 'fantasy'; void persist(); }}
				class={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
					stage === 'fantasy'
						? 'border-rose-500/40 bg-rose-600/15 text-rose-200'
						: 'border-gray-800 bg-gray-900/70 text-gray-400 hover:border-gray-700 hover:text-white'
				}`}
			>
				<HeartHandshake class="h-4 w-4" />
				<span class="text-sm font-medium">Preference chat</span>
			</button>
			<button
				onclick={() => { stage = 'review'; void persist(); }}
				class={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
					stage === 'review'
						? 'border-rose-500/40 bg-rose-600/15 text-rose-200'
						: 'border-gray-800 bg-gray-900/70 text-gray-400 hover:border-gray-700 hover:text-white'
				}`}
			>
				<ShieldCheck class="h-4 w-4" />
				<span class="text-sm font-medium">Profile review</span>
			</button>

			<div class="rounded-xl border border-gray-800 bg-gray-900/70 p-4">
				<p class="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Safety boundary</p>
				<div class="space-y-3 text-sm text-gray-400">
					<div class="flex gap-2">
						<Lock class="mt-0.5 h-4 w-4 flex-shrink-0 text-rose-400" />
						<p>Raw photos, fantasies, and private notes stay out of the shareable profile.</p>
					</div>
					<div class="flex gap-2">
						<ShieldCheck class="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" />
						<p>Only the approved preference layer is prepared for matching.</p>
					</div>
				</div>
			</div>
		</aside>

		<section class="min-w-0">
			{#if stage === 'profile'}
				<div class="space-y-6">
					<div class="rounded-2xl border border-gray-800 bg-gray-900 p-5">
						<div class="mb-5 flex items-center gap-3">
							<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-600/15 text-rose-300">
								<Camera class="h-5 w-5" />
							</div>
							<div>
								<h2 class="font-semibold text-white">Basic profile</h2>
								<p class="text-sm text-gray-500">A calm starting point before the deeper preference conversation.</p>
							</div>
						</div>

						<div class="grid gap-4 md:grid-cols-2">
							<label class="space-y-2">
								<span class="text-sm font-medium text-gray-300">Name or nickname</span>
								<input bind:value={displayName} onblur={() => void persist()} class="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-rose-500/60" placeholder="What should the profile call her?" />
							</label>
							<label class="space-y-2">
								<span class="text-sm font-medium text-gray-300">Age range</span>
								<select bind:value={ageRange} onchange={() => void persist()} class="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-rose-500/60">
									{#each ['18-22', '23-27', '28-32', '33-37', '38-42', '43-50', '50+'] as range}
										<option value={range}>{range}</option>
									{/each}
								</select>
							</label>
							<label class="space-y-2">
								<span class="text-sm font-medium text-gray-300">City</span>
								<input bind:value={city} onblur={() => void persist()} class="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-rose-500/60" placeholder="Mumbai, Bengaluru, Delhi..." />
							</label>
							<label class="space-y-2">
								<span class="text-sm font-medium text-gray-300">Dating intent</span>
								<input bind:value={intent} onblur={() => void persist()} class="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-rose-500/60" placeholder="Intentional dating, serious, exploratory..." />
							</label>
						</div>
					</div>

					<div class="rounded-2xl border border-gray-800 bg-gray-900 p-5">
						<div class="mb-5 flex items-center justify-between gap-4">
							<div>
								<h2 class="font-semibold text-white">Photo story</h2>
								<p class="text-sm text-gray-500">Sequence pictures by the role they play in her profile.</p>
							</div>
							<button onclick={() => document.getElementById('female-photo-input')?.click()} class="flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-rose-700">
								<Upload class="h-4 w-4" />
								Add photos
							</button>
							<input id="female-photo-input" type="file" accept="image/*" multiple class="hidden" onchange={handlePhotoSelect} />
						</div>

						{#if photoAssets.length === 0}
							<button onclick={() => document.getElementById('female-photo-input')?.click()} class="flex w-full flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-gray-700 p-8 text-center transition-all hover:border-rose-500/50">
								<Plus class="h-8 w-8 text-gray-500" />
								<span class="font-medium text-white">Upload her best profile pictures</span>
								<span class="max-w-md text-sm text-gray-500">Use one clear lead photo, one warmth photo, one lifestyle photo, and one conversation starter.</span>
							</button>
						{:else}
							<div class="grid gap-4 md:grid-cols-2">
								{#each photoAssets as photo (photo.id)}
									<div class="overflow-hidden rounded-2xl border border-gray-800 bg-gray-950">
										<img src={photo.url} alt={photo.name} class="h-56 w-full object-cover" />
										<div class="space-y-3 p-4">
											<div class="flex items-center justify-between gap-3">
												<select value={photo.storyRole} onchange={(event) => updatePhotoRole(photo.id, (event.target as HTMLSelectElement).value as FemalePhotoAsset['storyRole'])} class="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-xs font-medium text-white outline-none focus:border-rose-500/60">
													{#each roleOptions as role}
														<option value={role.value}>{role.label}</option>
													{/each}
												</select>
												<button onclick={() => removePhoto(photo.id)} class="rounded-lg p-2 text-gray-500 transition-all hover:bg-rose-600/10 hover:text-rose-300" title="Remove photo">
													<Trash2 class="h-4 w-4" />
												</button>
											</div>
											<textarea value={photo.note} oninput={(event) => updatePhotoNote(photo.id, (event.target as HTMLTextAreaElement).value)} rows="2" class="w-full resize-none rounded-xl border border-gray-800 bg-gray-900 px-3 py-2 text-sm text-gray-200 outline-none focus:border-rose-500/60" placeholder="What side of her should this picture communicate?"></textarea>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</div>

					<button onclick={continueToFantasy} class="w-full rounded-xl bg-rose-600 py-3.5 font-semibold text-white transition-all hover:bg-rose-700">
						Start preference chat
					</button>
				</div>
			{:else if stage === 'fantasy'}
				<div class="space-y-6">
					<div class="rounded-2xl border border-gray-800 bg-gray-900 p-5">
						<div class="mb-5 flex items-center gap-3">
							<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-600/15 text-rose-300">
								<HeartHandshake class="h-5 w-5" />
							</div>
							<div>
								<h2 class="font-semibold text-white">Preference chat</h2>
								<p class="text-sm text-gray-500">Turn fantasy into emotionally safe, matchable signals.</p>
							</div>
						</div>

						<div class="space-y-4">
							{#each answers as answer (answer.id)}
								<div class="rounded-2xl border border-gray-800 bg-gray-950 p-4">
									<div class="mb-2 flex items-start justify-between gap-3">
										<p class="text-sm font-medium text-rose-200">{answer.prompt}</p>
										<button onclick={() => removeAnswer(answer.id)} class="text-gray-600 transition-all hover:text-rose-300">
											<Trash2 class="h-4 w-4" />
										</button>
									</div>
									<p class="text-sm leading-relaxed text-gray-300">{answer.answer}</p>
								</div>
							{/each}

							{#if activePrompt}
								<div class="rounded-2xl border border-rose-500/25 bg-rose-600/10 p-5">
									<p class="mb-3 text-sm font-semibold text-rose-200">{activePrompt.prompt}</p>
									<textarea bind:value={currentAnswer} rows="5" class="w-full resize-none rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-rose-500/60" placeholder="Let her answer naturally. The app will translate desire into safe preference signals."></textarea>
									<button onclick={addAnswer} disabled={!currentAnswer.trim()} class="mt-3 flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-rose-700 disabled:opacity-40">
										<Send class="h-4 w-4" />
										Save answer
									</button>
								</div>
							{:else}
								<div class="rounded-2xl border border-emerald-500/20 bg-emerald-600/10 p-5">
									<div class="mb-2 flex items-center gap-2 text-emerald-300">
										<CheckCircle class="h-5 w-5" />
										<span class="font-semibold">Preference map is ready</span>
									</div>
									<p class="text-sm text-gray-300">The answers are enough to create a public profile, private match brief, and compatibility signal set.</p>
								</div>
							{/if}
						</div>
					</div>

					<button onclick={generateProfile} disabled={answers.length < 3} class="w-full rounded-xl bg-rose-600 py-3.5 font-semibold text-white transition-all hover:bg-rose-700 disabled:opacity-40">
						Generate her profile and matching brief
					</button>
				</div>
			{:else if generatedProfile}
				<div class="space-y-6">
					<div class="rounded-2xl border border-gray-800 bg-gray-900 p-5">
						<div class="mb-4 flex flex-wrap items-start justify-between gap-4">
							<div>
								<p class="text-xs font-semibold uppercase tracking-wide text-rose-300">Public profile</p>
								<h2 class="mt-1 text-2xl font-bold text-white">{generatedProfile.headline}</h2>
							</div>
							<button onclick={generateProfile} class="flex items-center gap-2 rounded-xl border border-gray-700 px-4 py-2 text-sm font-medium text-gray-300 transition-all hover:border-rose-500/50 hover:text-white">
								<RefreshCw class="h-4 w-4" />
								Regenerate
							</button>
						</div>
						<p class="text-sm leading-relaxed text-gray-300">{generatedProfile.publicIntro}</p>
					</div>

					<div class="grid gap-6 lg:grid-cols-2">
						<div class="rounded-2xl border border-gray-800 bg-gray-900 p-5">
							<h3 class="mb-4 font-semibold text-white">What she values</h3>
							<ul class="space-y-3">
								{#each generatedProfile.whatSheValues as value}
									<li class="rounded-xl bg-gray-950 p-3 text-sm text-gray-300">{value}</li>
								{/each}
							</ul>
						</div>

						<div class="rounded-2xl border border-gray-800 bg-gray-900 p-5">
							<h3 class="mb-4 font-semibold text-white">Conversation hooks</h3>
							<ul class="space-y-3">
								{#each generatedProfile.conversationHooks as hook}
									<li class="rounded-xl bg-gray-950 p-3 text-sm text-gray-300">{hook}</li>
								{/each}
							</ul>
						</div>
					</div>

					<div class="rounded-2xl border border-gray-800 bg-gray-900 p-5">
						<h3 class="mb-4 font-semibold text-white">Photo story</h3>
						<div class="grid gap-3 md:grid-cols-3">
							{#each generatedProfile.photoStory as story}
								<div class="rounded-xl bg-gray-950 p-3 text-sm text-gray-300">{story}</div>
							{/each}
						</div>
					</div>

					<div class="rounded-2xl border border-amber-500/20 bg-amber-600/10 p-5">
						<div class="mb-3 flex items-center gap-2 text-amber-200">
							<Lock class="h-5 w-5" />
							<h3 class="font-semibold">Private matching brief</h3>
						</div>
						<p class="text-sm leading-relaxed text-gray-300">{generatedProfile.privateMatchBrief}</p>
					</div>

					<div class="rounded-2xl border border-gray-800 bg-gray-900 p-5">
						<h3 class="mb-4 font-semibold text-white">Compatibility signals</h3>
						<div class="flex flex-wrap gap-2">
							{#each generatedProfile.compatibilitySignals as signal}
								<span class="rounded-full border border-gray-700 bg-gray-950 px-3 py-1.5 text-xs font-medium text-gray-300">{signal}</span>
							{/each}
						</div>
					</div>

					{#if preferenceModel?.sensitiveTranslations.length}
						<div class="rounded-2xl border border-rose-500/20 bg-rose-600/10 p-5">
							<h3 class="mb-4 font-semibold text-rose-200">Sensitive preference translations</h3>
							<div class="space-y-3">
								{#each preferenceModel.sensitiveTranslations as item}
									<div class="rounded-xl bg-gray-950 p-3">
										<p class="text-xs text-gray-500">Raw fantasy signal</p>
										<p class="mb-2 text-sm text-gray-300">{item.raw}</p>
										<p class="text-xs text-gray-500">Safe matching translation</p>
										<p class="text-sm text-rose-100">{item.translated}</p>
									</div>
								{/each}
							</div>
						</div>
					{/if}

					<div class="rounded-2xl border border-gray-800 bg-gray-900 p-5">
						<div class="flex flex-wrap items-center justify-between gap-4">
							<div>
								<h3 class="font-semibold text-white">Approval for matching</h3>
								<p class="mt-1 text-sm text-gray-500">Only the shareable profile and compatibility signals are prepared for downstream matching.</p>
							</div>
							<button onclick={toggleApproval} class={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${approvedForMatching ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>
								{approvedForMatching ? 'Approved' : 'Approve for matching'}
							</button>
						</div>
					</div>
				</div>
			{:else}
				<div class="rounded-2xl border border-gray-800 bg-gray-900 p-8 text-center">
					<p class="mb-4 text-gray-300">No generated profile yet.</p>
					<button onclick={() => { stage = 'fantasy'; void persist(); }} class="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white">Go to preference chat</button>
				</div>
			{/if}
		</section>
	</div>
</div>
