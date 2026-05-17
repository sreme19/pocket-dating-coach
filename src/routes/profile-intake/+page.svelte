<script lang="ts">
	import { goto } from '$app/navigation';
	import { Upload, Plus, Trash2, ChevronRight, Loader2 } from 'lucide-svelte';
	import type { MaleProfilePhoto, MaleProfileIntake } from '$lib/types';

	let stage = $state<'photos' | 'prompts' | 'context'>('photos');
	let loading = $state(false);

	// Photos section
	let photos = $state<MaleProfilePhoto[]>([]);
	let selectedFile = $state<File | null>(null);
	let previewUrl = $state<string | null>(null);
	let photoCaption = $state('');
	let photoRole = $state<'main' | 'lifestyle' | 'hobby' | 'group' | 'close-up'>('main');

	// Prompts section
	let aboutYou = $state('');
	let lookingFor = $state('');
	let dealbreakers = $state('');

	// Context section
	let height = $state('');
	let ageRange = $state('');
	let locationVibe = $state<'city' | 'suburb' | 'small-town'>('city');
	let educationLevel = $state<'high-school' | 'some-college' | 'bachelors' | 'advanced'>('bachelors');

	const photoRoles = [
		{ value: 'main', label: 'Main photo', description: 'Best photo of you' },
		{ value: 'lifestyle', label: 'Lifestyle', description: 'Doing something fun' },
		{ value: 'hobby', label: 'Hobby', description: 'Your interests' },
		{ value: 'group', label: 'Group', description: 'With friends' },
		{ value: 'close-up', label: 'Close-up', description: 'Face/smile' }
	];

	const stages = [
		{ id: 'photos', label: '📸 Photos', description: 'Upload 3-5 dating app photos' },
		{ id: 'prompts', label: '📝 About You', description: 'Tell your story' },
		{ id: 'context', label: '👤 Details', description: 'Quick context' }
	];

	function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		selectedFile = file;
		const reader = new FileReader();
		reader.onload = (e) => {
			previewUrl = e.target?.result as string;
		};
		reader.readAsDataURL(file);
	}

	function addPhoto() {
		if (!selectedFile || !previewUrl) return;

		const newPhoto: MaleProfilePhoto = {
			id: Math.random().toString(36),
			name: selectedFile.name,
			url: previewUrl,
			role: photoRole,
			caption: photoCaption,
			uploadedAt: Date.now()
		};

		photos = [...photos, newPhoto];
		selectedFile = null;
		previewUrl = null;
		photoCaption = '';
		photoRole = 'main';
	}

	function removePhoto(id: string) {
		photos = photos.filter((p) => p.id !== id);
	}

	function nextStage() {
		if (stage === 'photos' && photos.length === 0) {
			alert('Add at least one photo');
			return;
		}
		if (stage === 'prompts' && (!aboutYou || !lookingFor)) {
			alert('Fill in both questions');
			return;
		}

		const stageOrder: Array<'photos' | 'prompts' | 'context'> = ['photos', 'prompts', 'context'];
		const nextIdx = stageOrder.indexOf(stage) + 1;
		if (nextIdx < stageOrder.length) {
			stage = stageOrder[nextIdx];
		}
	}

	function prevStage() {
		const stageOrder: Array<'photos' | 'prompts' | 'context'> = ['photos', 'prompts', 'context'];
		const prevIdx = stageOrder.indexOf(stage) - 1;
		if (prevIdx >= 0) {
			stage = stageOrder[prevIdx];
		}
	}

	async function completeIntake() {
		loading = true;

		const profile = JSON.parse(localStorage.getItem('pdc_profile') || '{}');
		const intake: MaleProfileIntake = {
			sessionId: `pdc-male-${Date.now()}`,
			photos,
			aboutYou,
			lookingFor,
			dealbreakers,
			height: height || undefined,
			ageRange: ageRange || undefined,
			locationVibe: locationVibe as 'city' | 'suburb' | 'small-town',
			educationLevel,
			collectedAt: Date.now(),
			updatedAt: Date.now()
		};

		localStorage.setItem('pdc_male_intake', JSON.stringify(intake));
		localStorage.setItem('pdc_profile', JSON.stringify(profile));

		// Move to profile chat for conversational refinement
		goto('/profile-chat');
	}

	const stageIndex = stages.findIndex((s) => s.id === stage);
	const progress = ((stageIndex + 1) / stages.length) * 100;
</script>

<div class="min-h-screen bg-slate-950 text-white flex flex-col">
	<!-- Header -->
	<div class="px-6 py-6 border-b border-slate-800">
		<div class="max-w-4xl mx-auto">
			<div class="mb-6">
				<h1 class="text-3xl font-bold mb-2">Build Your Profile</h1>
				<p class="text-slate-400">We'll help you create a profile that stands out</p>
			</div>

			<!-- Progress bar -->
			<div class="w-full bg-slate-800 rounded-full h-2 overflow-hidden mb-6">
				<div
					class="bg-gradient-to-r from-rose-500 to-amber-500 h-full transition-all duration-300"
					style="width: {progress}%"
				/>
			</div>

			<!-- Stage indicators -->
			<div class="flex gap-3 overflow-x-auto pb-2">
				{#each stages as s (s.id)}
					<button
						onclick={() => {
							if (stages.indexOf(s) <= stageIndex) stage = s.id as 'photos' | 'prompts' | 'context';
						}}
						class="flex-shrink-0 px-4 py-2 rounded-lg transition-all {stage === s.id
							? 'bg-rose-600 text-white'
							: stages.indexOf(s) < stageIndex
								? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/30'
								: 'bg-slate-800 text-slate-400 border border-slate-700'}"
					>
						<span class="text-sm font-medium">{s.label}</span>
					</button>
				{/each}
			</div>
		</div>
	</div>

	<!-- Content -->
	<div class="flex-1 px-6 py-12">
		<div class="max-w-2xl mx-auto">
			{#if stage === 'photos'}
				<!-- Photos section -->
				<div>
					<h2 class="text-2xl font-bold mb-6">📸 Upload Your Photos</h2>
					<p class="text-slate-400 mb-8">Choose 3-5 of your best dating app photos. Variety helps!</p>

					<!-- Upload form -->
					{#if !selectedFile}
						<div
							class="border-2 border-dashed border-slate-700 rounded-xl p-12 text-center mb-8 hover:border-rose-500/50 transition-colors cursor-pointer"
							role="button"
							tabindex="0"
							onkeydown={(e) => e.key === 'Enter' && document.getElementById('photo-input')?.click()}
						>
							<input
								id="photo-input"
								type="file"
								accept="image/*"
								hidden
								onchange={handleFileSelect}
							/>
							<Upload class="w-12 h-12 text-slate-600 mx-auto mb-3" />
							<p class="font-medium mb-1">Click or drag to upload</p>
							<p class="text-sm text-slate-500">PNG, JPG up to 10MB</p>
							<button
								onclick={() => document.getElementById('photo-input')?.click()}
								class="mt-4 px-4 py-2 bg-rose-600 hover:bg-rose-700 rounded-lg font-medium transition-colors"
							>
								Choose Photo
							</button>
						</div>
					{:else}
						<!-- Preview and caption -->
						<div class="mb-8">
							<div class="rounded-xl overflow-hidden mb-6 aspect-square bg-slate-800">
								<img src={previewUrl} alt="Preview" class="w-full h-full object-cover" />
							</div>

							<div class="space-y-4 mb-6">
								<div>
									<label class="block text-sm font-medium mb-2">What's in this photo?</label>
									<select
										bind:value={photoRole}
										class="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-rose-500 outline-none"
									>
										{#each photoRoles as role}
											<option value={role.value}>{role.label}</option>
										{/each}
									</select>
								</div>

								<div>
									<label class="block text-sm font-medium mb-2">Caption (optional)</label>
									<input
										type="text"
										bind:value={photoCaption}
										placeholder="e.g., Hiking in Tahoe"
										class="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:border-rose-500 outline-none"
									/>
								</div>
							</div>

							<div class="flex gap-3">
								<button
									onclick={() => {
										selectedFile = null;
										previewUrl = null;
									}}
									class="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg font-medium transition-colors"
								>
									Cancel
								</button>
								<button
									onclick={addPhoto}
									class="flex-1 px-4 py-2 bg-rose-600 hover:bg-rose-700 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
								>
									<Plus class="w-4 h-4" /> Add Photo
								</button>
							</div>
						</div>
					{/if}

					<!-- Photos list -->
					{#if photos.length > 0}
						<div class="mb-8">
							<h3 class="font-medium mb-4">Your photos ({photos.length})</h3>
							<div class="space-y-3">
								{#each photos as photo (photo.id)}
									<div class="flex gap-3 p-4 bg-slate-800 rounded-lg">
										<img
											src={photo.url}
											alt={photo.name}
											class="w-16 h-16 rounded object-cover flex-shrink-0"
										/>
										<div class="flex-1 min-w-0">
											<p class="font-medium text-sm">{photo.role}</p>
											{#if photo.caption}
												<p class="text-sm text-slate-400">{photo.caption}</p>
											{/if}
										</div>
										<button
											onclick={() => removePhoto(photo.id)}
											class="text-slate-500 hover:text-rose-500 transition-colors"
										>
											<Trash2 class="w-4 h-4" />
										</button>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			{:else if stage === 'prompts'}
				<!-- Prompts section -->
				<div>
					<h2 class="text-2xl font-bold mb-6">📝 Tell Your Story</h2>
					<p class="text-slate-400 mb-8">Help us understand who you are</p>

					<div class="space-y-6">
						<div>
							<label class="block font-medium mb-3">What do you want your match to know about you?</label>
							<textarea
								bind:value={aboutYou}
								placeholder="Share what makes you unique... hobbies, passions, what you're proud of"
								class="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-rose-500 outline-none resize-none"
								rows="5"
							/>
							<p class="text-xs text-slate-500 mt-2">{aboutYou.length}/500 characters</p>
						</div>

						<div>
							<label class="block font-medium mb-3">What are you looking for?</label>
							<textarea
								bind:value={lookingFor}
								placeholder="Describe your ideal match... personality traits, interests, values"
								class="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-rose-500 outline-none resize-none"
								rows="5"
							/>
							<p class="text-xs text-slate-500 mt-2">{lookingFor.length}/500 characters</p>
						</div>

						<div>
							<label class="block font-medium mb-3">Any deal-breakers? (optional)</label>
							<textarea
								bind:value={dealbreakers}
								placeholder="Be honest about what won't work for you"
								class="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-rose-500 outline-none resize-none"
								rows="3"
							/>
							<p class="text-xs text-slate-500 mt-2">{dealbreakers.length}/500 characters</p>
						</div>
					</div>
				</div>
			{:else if stage === 'context'}
				<!-- Context section -->
				<div>
					<h2 class="text-2xl font-bold mb-6">👤 Quick Context</h2>
					<p class="text-slate-400 mb-8">Help us refine your profile</p>

					<div class="space-y-6">
						<div class="grid grid-cols-2 gap-4">
							<div>
								<label class="block text-sm font-medium mb-2">Height (optional)</label>
								<input
									type="text"
									bind:value={height}
									placeholder="e.g., 6 ft 1 in"
									class="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:border-rose-500 outline-none"
								/>
							</div>
							<div>
								<label class="block text-sm font-medium mb-2">Age range (optional)</label>
								<input
									type="text"
									bind:value={ageRange}
									placeholder="e.g., 26-32"
									class="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:border-rose-500 outline-none"
								/>
							</div>
						</div>

						<div>
							<label class="block text-sm font-medium mb-2">Where do you live?</label>
							<select
								bind:value={locationVibe}
								class="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-rose-500 outline-none"
							>
								<option value="city">🏙️ City</option>
								<option value="suburb">🏘️ Suburb</option>
								<option value="small-town">🌾 Small town</option>
							</select>
						</div>

						<div>
							<label class="block text-sm font-medium mb-2">Education level</label>
							<select
								bind:value={educationLevel}
								class="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-rose-500 outline-none"
							>
								<option value="high-school">High school</option>
								<option value="some-college">Some college</option>
								<option value="bachelors">Bachelor's degree</option>
								<option value="advanced">Advanced degree</option>
							</select>
						</div>
					</div>
				</div>
			{/if}
		</div>
	</div>

	<!-- Footer -->
	<div class="px-6 py-6 border-t border-slate-800">
		<div class="max-w-2xl mx-auto flex gap-3">
			<button
				onclick={prevStage}
				disabled={stage === 'photos'}
				class="flex-1 px-6 py-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
			>
				← Back
			</button>
			{#if stage !== 'context'}
				<button
					onclick={nextStage}
					class="flex-1 px-6 py-3 bg-rose-600 hover:bg-rose-700 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
				>
					Next <ChevronRight class="w-4 h-4" />
				</button>
			{:else}
				<button
					onclick={completeIntake}
					disabled={loading}
					class="flex-1 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
				>
					{#if loading}
						<Loader2 class="w-4 h-4 animate-spin" />
					{/if}
					Let's Go! →
				</button>
			{/if}
		</div>
	</div>
</div>
