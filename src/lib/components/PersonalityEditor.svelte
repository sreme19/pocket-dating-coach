<script lang="ts">
	import { Save, X, Clock, AlertCircle, CheckCircle } from 'lucide-svelte';
	import type { PersonalityProfile, ProfileVersion } from '$lib/server/profile-service';

	interface Props {
		personality?: PersonalityProfile;
		isLoading?: boolean;
		onSave?: (updates: Partial<PersonalityProfile>, reason: string) => Promise<void>;
		onCancel?: () => void;
		showVersionHistory?: boolean;
		versionHistory?: ProfileVersion[];
		onRestoreVersion?: (versionId: string) => Promise<void>;
	}

	let {
		personality = {
			communicationStyle: '',
			personalityVibe: '',
			mattersMost: '',
			values: [],
			datingPatterns: [],
			redFlagsToAvoid: [],
			updatedAt: Date.now()
		},
		isLoading = false,
		onSave,
		onCancel,
		showVersionHistory = false,
		versionHistory = [],
		onRestoreVersion
	}: Props = $props();

	// Local state for editing
	let editedPersonality = $state({
		communicationStyle: personality.communicationStyle,
		personalityVibe: personality.personalityVibe,
		mattersMost: personality.mattersMost,
		values: [...personality.values],
		datingPatterns: [...personality.datingPatterns],
		redFlagsToAvoid: [...personality.redFlagsToAvoid]
	});

	let updateReason = $state('');
	let isSaving = $state(false);
	let saveError = $state<string | null>(null);
	let saveSuccess = $state(false);
	let showHistoryPanel = $state(false);
	let restoringVersionId = $state<string | null>(null);

	// Track if there are unsaved changes
	let hasChanges = $derived.by(() => {
		return (
			JSON.stringify(editedPersonality) !== JSON.stringify({
				communicationStyle: personality.communicationStyle,
				personalityVibe: personality.personalityVibe,
				mattersMost: personality.mattersMost,
				values: personality.values,
				datingPatterns: personality.datingPatterns,
				redFlagsToAvoid: personality.redFlagsToAvoid
			})
		);
	});

	function addItem(field: 'values' | 'datingPatterns' | 'redFlagsToAvoid') {
		const arr = editedPersonality[field] as string[];
		arr.push('');
	}

	function removeItem(field: 'values' | 'datingPatterns' | 'redFlagsToAvoid', index: number) {
		const arr = editedPersonality[field] as string[];
		arr.splice(index, 1);
	}

	function updateItem(field: 'values' | 'datingPatterns' | 'redFlagsToAvoid', index: number, value: string) {
		const arr = editedPersonality[field] as string[];
		arr[index] = value;
	}

	function updateTextField(field: 'communicationStyle' | 'personalityVibe' | 'mattersMost', value: string) {
		editedPersonality[field] = value;
	}

	async function handleSave() {
		if (!hasChanges) {
			saveError = 'No changes to save';
			return;
		}

		if (!updateReason.trim()) {
			saveError = 'Please provide a reason for this update';
			return;
		}

		isSaving = true;
		saveError = null;
		saveSuccess = false;

		try {
			// Filter out empty strings from arrays
			const updates: Partial<PersonalityProfile> = {
				communicationStyle: editedPersonality.communicationStyle.trim(),
				personalityVibe: editedPersonality.personalityVibe.trim(),
				mattersMost: editedPersonality.mattersMost.trim(),
				values: editedPersonality.values.filter(s => s.trim()),
				datingPatterns: editedPersonality.datingPatterns.filter(s => s.trim()),
				redFlagsToAvoid: editedPersonality.redFlagsToAvoid.filter(s => s.trim())
			};

			await onSave?.(updates, updateReason);

			saveSuccess = true;
			updateReason = '';

			// Reset to current personality
			editedPersonality = {
				communicationStyle: personality.communicationStyle,
				personalityVibe: personality.personalityVibe,
				mattersMost: personality.mattersMost,
				values: [...personality.values],
				datingPatterns: [...personality.datingPatterns],
				redFlagsToAvoid: [...personality.redFlagsToAvoid]
			};

			// Clear success message after 3 seconds
			setTimeout(() => {
				saveSuccess = false;
			}, 3000);
		} catch (err) {
			saveError = err instanceof Error ? err.message : 'Failed to save personality';
		} finally {
			isSaving = false;
		}
	}

	function handleCancel() {
		// Reset to original personality
		editedPersonality = {
			communicationStyle: personality.communicationStyle,
			personalityVibe: personality.personalityVibe,
			mattersMost: personality.mattersMost,
			values: [...personality.values],
			datingPatterns: [...personality.datingPatterns],
			redFlagsToAvoid: [...personality.redFlagsToAvoid]
		};
		updateReason = '';
		saveError = null;
		onCancel?.();
	}

	async function handleRestoreVersion(versionId: string) {
		if (!confirm('Are you sure you want to restore this version? This will overwrite your current personality profile.')) {
			return;
		}

		restoringVersionId = versionId;
		try {
			await onRestoreVersion?.(versionId);
			saveSuccess = true;
			setTimeout(() => {
				saveSuccess = false;
			}, 3000);
		} catch (err) {
			saveError = err instanceof Error ? err.message : 'Failed to restore version';
		} finally {
			restoringVersionId = null;
		}
	}

	function formatDate(timestamp: number): string {
		return new Date(timestamp).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<div class="w-full max-w-4xl mx-auto">
	<!-- Header -->
	<div class="mb-6">
		<h2 class="text-2xl font-bold text-gray-100 mb-2">Edit Your Personality Profile</h2>
		<p class="text-gray-400">
			Update your personality profile to help AI Wingman provide better advice grounded in who you are.
		</p>
	</div>

	<!-- Last Updated -->
	{#if personality.updatedAt}
		<div class="mb-6 p-3 rounded-lg bg-gray-800/50 border border-gray-700 flex items-center gap-2">
			<Clock class="w-4 h-4 text-gray-400" />
			<span class="text-sm text-gray-400">
				Last updated: {formatDate(personality.updatedAt)}
			</span>
		</div>
	{/if}

	<!-- Status Messages -->
	{#if saveError}
		<div class="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-3">
			<AlertCircle class="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
			<div>
				<p class="text-sm font-medium text-red-400">Error</p>
				<p class="text-sm text-red-300">{saveError}</p>
			</div>
		</div>
	{/if}

	{#if saveSuccess}
		<div class="mb-6 p-4 rounded-lg bg-green-500/10 border border-green-500/30 flex items-start gap-3">
			<CheckCircle class="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
			<p class="text-sm text-green-300">Personality profile saved successfully!</p>
		</div>
	{/if}

	<!-- Main Content -->
	<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
		<!-- Editor Panel -->
		<div class="lg:col-span-2">
			<div class="bg-gray-800/50 rounded-lg border border-gray-700 p-6">
				<!-- Communication Style -->
				<div class="mb-6">
					<div class="flex items-start justify-between mb-3">
						<div>
							<label class="block text-sm font-semibold text-gray-200 mb-1">Communication Style</label>
							<p class="text-xs text-gray-400">How do you typically communicate with matches? (e.g., direct, playful, thoughtful)</p>
						</div>
					</div>

					<input
						type="text"
						value={editedPersonality.communicationStyle}
						onchange={(e) => updateTextField('communicationStyle', e.currentTarget.value)}
						placeholder="e.g., Direct and honest, Playful and witty, Thoughtful and deep"
						class="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gray-400 transition-colors text-sm"
					/>
				</div>

				<!-- Personality Vibe -->
				<div class="mb-6">
					<div class="flex items-start justify-between mb-3">
						<div>
							<label class="block text-sm font-semibold text-gray-200 mb-1">Personality Vibe</label>
							<p class="text-xs text-gray-400">How would you describe your overall personality? (e.g., ambitious, laid-back, adventurous)</p>
						</div>
					</div>

					<input
						type="text"
						value={editedPersonality.personalityVibe}
						onchange={(e) => updateTextField('personalityVibe', e.currentTarget.value)}
						placeholder="e.g., Ambitious and driven, Laid-back and chill, Adventurous and spontaneous"
						class="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gray-400 transition-colors text-sm"
					/>
				</div>

				<!-- What Matters Most -->
				<div class="mb-6">
					<div class="flex items-start justify-between mb-3">
						<div>
							<label class="block text-sm font-semibold text-gray-200 mb-1">What Matters Most</label>
							<p class="text-xs text-gray-400">What's the most important thing to you in dating? (e.g., humor, authenticity, shared values)</p>
						</div>
					</div>

					<input
						type="text"
						value={editedPersonality.mattersMost}
						onchange={(e) => updateTextField('mattersMost', e.currentTarget.value)}
						placeholder="e.g., Humor and making each other laugh, Genuine connection, Shared life goals"
						class="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gray-400 transition-colors text-sm"
					/>
				</div>

				<!-- Core Values -->
				<div class="mb-6">
					<div class="flex items-start justify-between mb-3">
						<div>
							<label class="block text-sm font-semibold text-gray-200 mb-1">Core Values</label>
							<p class="text-xs text-gray-400">What values are most important to you?</p>
						</div>
					</div>

					<div class="space-y-2 mb-3">
						{#each editedPersonality.values as item, index (index)}
							<div class="flex gap-2">
								<input
									type="text"
									value={item}
									onchange={(e) => updateItem('values', index, e.currentTarget.value)}
									placeholder="Add a core value"
									class="flex-1 px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gray-400 transition-colors text-sm"
								/>
								<button
									onclick={() => removeItem('values', index)}
									class="px-3 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors"
									title="Remove item"
								>
									<X class="w-4 h-4" />
								</button>
							</div>
						{/each}
					</div>

					<button
						onclick={() => addItem('values')}
						class="text-sm px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
					>
						+ Add core value
					</button>
				</div>

				<!-- Dating Patterns -->
				<div class="mb-6">
					<div class="flex items-start justify-between mb-3">
						<div>
							<label class="block text-sm font-semibold text-gray-200 mb-1">Dating Patterns</label>
							<p class="text-xs text-gray-400">What patterns have you noticed in your dating approach?</p>
						</div>
					</div>

					<div class="space-y-2 mb-3">
						{#each editedPersonality.datingPatterns as item, index (index)}
							<div class="flex gap-2">
								<input
									type="text"
									value={item}
									onchange={(e) => updateItem('datingPatterns', index, e.currentTarget.value)}
									placeholder="Add a dating pattern"
									class="flex-1 px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gray-400 transition-colors text-sm"
								/>
								<button
									onclick={() => removeItem('datingPatterns', index)}
									class="px-3 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors"
									title="Remove item"
								>
									<X class="w-4 h-4" />
								</button>
							</div>
						{/each}
					</div>

					<button
						onclick={() => addItem('datingPatterns')}
						class="text-sm px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
					>
						+ Add dating pattern
					</button>
				</div>

				<!-- Red Flags to Avoid -->
				<div class="mb-6">
					<div class="flex items-start justify-between mb-3">
						<div>
							<label class="block text-sm font-semibold text-gray-200 mb-1">Red Flags to Avoid</label>
							<p class="text-xs text-gray-400">What behaviors or traits are red flags for you?</p>
						</div>
					</div>

					<div class="space-y-2 mb-3">
						{#each editedPersonality.redFlagsToAvoid as item, index (index)}
							<div class="flex gap-2">
								<input
									type="text"
									value={item}
									onchange={(e) => updateItem('redFlagsToAvoid', index, e.currentTarget.value)}
									placeholder="Add a red flag"
									class="flex-1 px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gray-400 transition-colors text-sm"
								/>
								<button
									onclick={() => removeItem('redFlagsToAvoid', index)}
									class="px-3 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors"
									title="Remove item"
								>
									<X class="w-4 h-4" />
								</button>
							</div>
						{/each}
					</div>

					<button
						onclick={() => addItem('redFlagsToAvoid')}
						class="text-sm px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
					>
						+ Add red flag
					</button>
				</div>

				<!-- Update Reason -->
				<div class="mb-6">
					<label class="block text-sm font-semibold text-gray-200 mb-2">
						Reason for Update
					</label>
					<textarea
						value={updateReason}
						onchange={(e) => (updateReason = e.currentTarget.value)}
						placeholder="Why are you updating your personality profile? (e.g., 'Refined based on recent conversations')"
						class="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gray-400 transition-colors text-sm resize-none"
						rows="3"
					/>
					<p class="text-xs text-gray-400 mt-1">
						{updateReason.length}/500 characters
					</p>
				</div>

				<!-- Action Buttons -->
				<div class="flex gap-3">
					<button
						onclick={handleSave}
						disabled={!hasChanges || isSaving || isLoading}
						class="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium transition-colors"
					>
						{#if isSaving || isLoading}
							<div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
							<span>Saving...</span>
						{:else}
							<Save class="w-4 h-4" />
							<span>Save Changes</span>
						{/if}
					</button>
					<button
						onclick={handleCancel}
						disabled={isSaving || isLoading}
						class="flex-1 px-4 py-3 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-gray-300 font-medium transition-colors"
					>
						Cancel
					</button>
				</div>
			</div>
		</div>

		<!-- Sidebar -->
		<div class="lg:col-span-1">
			<!-- Version History Button -->
			{#if showVersionHistory && versionHistory.length > 0}
				<button
					onclick={() => (showHistoryPanel = !showHistoryPanel)}
					class="w-full mb-4 px-4 py-3 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium transition-colors text-sm"
				>
					📋 Version History ({versionHistory.length})
				</button>
			{/if}

			<!-- Version History Panel -->
			{#if showHistoryPanel && versionHistory.length > 0}
				<div class="bg-gray-800/50 rounded-lg border border-gray-700 p-4">
					<h3 class="text-sm font-semibold text-gray-200 mb-3">Version History</h3>
					<div class="space-y-2 max-h-96 overflow-y-auto">
						{#each versionHistory as version (version.id)}
							<div class="p-3 rounded-lg bg-gray-700/50 border border-gray-600">
								<div class="flex items-start justify-between mb-2">
									<div>
										<p class="text-xs font-medium text-gray-300">Version {version.version}</p>
										<p class="text-xs text-gray-400">{formatDate(version.createdAt)}</p>
									</div>
								</div>
								<p class="text-xs text-gray-400 mb-2 line-clamp-2">{version.reason}</p>
								<button
									onclick={() => handleRestoreVersion(version.id)}
									disabled={restoringVersionId === version.id}
									class="w-full px-2 py-1.5 rounded text-xs bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 text-gray-300 transition-colors"
								>
									{restoringVersionId === version.id ? 'Restoring...' : 'Restore'}
								</button>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Info Panel -->
			<div class="bg-blue-500/10 rounded-lg border border-blue-500/30 p-4">
				<h3 class="text-sm font-semibold text-blue-300 mb-2">💡 Tips</h3>
				<ul class="text-xs text-blue-200 space-y-2">
					<li>• Be honest about who you are and what you value</li>
					<li>• Update regularly as you learn more about yourself</li>
					<li>• Your personality helps AI Wingman give authentic advice</li>
					<li>• All changes are tracked with version history</li>
				</ul>
			</div>
		</div>
	</div>
</div>

<style>
	:global(.line-clamp-2) {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		line-clamp: 2;
		overflow: hidden;
	}
</style>
