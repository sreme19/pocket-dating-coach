<script lang="ts">
	import { Save, X, Clock, AlertCircle, CheckCircle } from 'lucide-svelte';
	import type { PreferencesProfile, ProfileVersion } from '$lib/server/profile-service';

	interface Props {
		preferences?: PreferencesProfile;
		isLoading?: boolean;
		onSave?: (updates: Partial<PreferencesProfile>, reason: string) => Promise<void>;
		onCancel?: () => void;
		showVersionHistory?: boolean;
		versionHistory?: ProfileVersion[];
		onRestoreVersion?: (versionId: string) => Promise<void>;
	}

	let {
		preferences = {
			emotionalSignals: [],
			lifestyleSignals: [],
			maturitySignals: [],
			boundaries: [],
			dealbreakers: [],
			privateCompatibilityNotes: [],
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
	let editedPreferences = $state({
		emotionalSignals: [...preferences.emotionalSignals],
		lifestyleSignals: [...preferences.lifestyleSignals],
		maturitySignals: [...preferences.maturitySignals],
		boundaries: [...preferences.boundaries],
		dealbreakers: [...preferences.dealbreakers],
		privateCompatibilityNotes: [...preferences.privateCompatibilityNotes]
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
			JSON.stringify(editedPreferences) !== JSON.stringify({
				emotionalSignals: preferences.emotionalSignals,
				lifestyleSignals: preferences.lifestyleSignals,
				maturitySignals: preferences.maturitySignals,
				boundaries: preferences.boundaries,
				dealbreakers: preferences.dealbreakers,
				privateCompatibilityNotes: preferences.privateCompatibilityNotes
			})
		);
	});

	function addItem(field: keyof typeof editedPreferences) {
		const arr = editedPreferences[field] as string[];
		arr.push('');
	}

	function removeItem(field: keyof typeof editedPreferences, index: number) {
		const arr = editedPreferences[field] as string[];
		arr.splice(index, 1);
	}

	function updateItem(field: keyof typeof editedPreferences, index: number, value: string) {
		const arr = editedPreferences[field] as string[];
		arr[index] = value;
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
			// Filter out empty strings
			const updates: Partial<PreferencesProfile> = {
				emotionalSignals: editedPreferences.emotionalSignals.filter(s => s.trim()),
				lifestyleSignals: editedPreferences.lifestyleSignals.filter(s => s.trim()),
				maturitySignals: editedPreferences.maturitySignals.filter(s => s.trim()),
				boundaries: editedPreferences.boundaries.filter(s => s.trim()),
				dealbreakers: editedPreferences.dealbreakers.filter(s => s.trim()),
				privateCompatibilityNotes: editedPreferences.privateCompatibilityNotes.filter(s => s.trim())
			};

			await onSave?.(updates, updateReason);

			saveSuccess = true;
			updateReason = '';

			// Reset to current preferences
			editedPreferences = {
				emotionalSignals: [...preferences.emotionalSignals],
				lifestyleSignals: [...preferences.lifestyleSignals],
				maturitySignals: [...preferences.maturitySignals],
				boundaries: [...preferences.boundaries],
				dealbreakers: [...preferences.dealbreakers],
				privateCompatibilityNotes: [...preferences.privateCompatibilityNotes]
			};

			// Clear success message after 3 seconds
			setTimeout(() => {
				saveSuccess = false;
			}, 3000);
		} catch (err) {
			saveError = err instanceof Error ? err.message : 'Failed to save preferences';
		} finally {
			isSaving = false;
		}
	}

	function handleCancel() {
		// Reset to original preferences
		editedPreferences = {
			emotionalSignals: [...preferences.emotionalSignals],
			lifestyleSignals: [...preferences.lifestyleSignals],
			maturitySignals: [...preferences.maturitySignals],
			boundaries: [...preferences.boundaries],
			dealbreakers: [...preferences.dealbreakers],
			privateCompatibilityNotes: [...preferences.privateCompatibilityNotes]
		};
		updateReason = '';
		saveError = null;
		onCancel?.();
	}

	async function handleRestoreVersion(versionId: string) {
		if (!confirm('Are you sure you want to restore this version? This will overwrite your current preferences.')) {
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
		<h2 class="text-2xl font-bold text-gray-100 mb-2">Edit Your Preferences</h2>
		<p class="text-gray-400">
			Update your dating preferences to help AI Bestie provide better advice and compatibility assessments.
		</p>
	</div>

	<!-- Last Updated -->
	{#if preferences.updatedAt}
		<div class="mb-6 p-3 rounded-lg bg-gray-800/50 border border-gray-700 flex items-center gap-2">
			<Clock class="w-4 h-4 text-gray-400" />
			<span class="text-sm text-gray-400">
				Last updated: {formatDate(preferences.updatedAt)}
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
			<p class="text-sm text-green-300">Preferences saved successfully!</p>
		</div>
	{/if}

	<!-- Main Content -->
	<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
		<!-- Editor Panel -->
		<div class="lg:col-span-2">
			<div class="bg-gray-800/50 rounded-lg border border-gray-700 p-6">
				<!-- Emotional Signals -->
				<div class="mb-6">
					<div class="flex items-start justify-between mb-3">
						<div>
							<label class="block text-sm font-semibold text-gray-200 mb-1">Emotional Signals</label>
							<p class="text-xs text-gray-400">What emotional qualities do you value in a partner?</p>
						</div>
					</div>

					<div class="space-y-2 mb-3">
						{#each editedPreferences.emotionalSignals as item, index (index)}
							<div class="flex gap-2">
								<input
									type="text"
									value={item}
									onchange={(e) => updateItem('emotionalSignals', index, e.currentTarget.value)}
									placeholder="Add emotional signal"
									class="flex-1 px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gray-400 transition-colors text-sm"
								/>
								<button
									onclick={() => removeItem('emotionalSignals', index)}
									class="px-3 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors"
									title="Remove item"
								>
									<X class="w-4 h-4" />
								</button>
							</div>
						{/each}
					</div>

					<button
						onclick={() => addItem('emotionalSignals')}
						class="text-sm px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
					>
						+ Add emotional signal
					</button>
				</div>

				<!-- Lifestyle Signals -->
				<div class="mb-6">
					<div class="flex items-start justify-between mb-3">
						<div>
							<label class="block text-sm font-semibold text-gray-200 mb-1">Lifestyle Signals</label>
							<p class="text-xs text-gray-400">What lifestyle traits are important to you?</p>
						</div>
					</div>

					<div class="space-y-2 mb-3">
						{#each editedPreferences.lifestyleSignals as item, index (index)}
							<div class="flex gap-2">
								<input
									type="text"
									value={item}
									onchange={(e) => updateItem('lifestyleSignals', index, e.currentTarget.value)}
									placeholder="Add lifestyle signal"
									class="flex-1 px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gray-400 transition-colors text-sm"
								/>
								<button
									onclick={() => removeItem('lifestyleSignals', index)}
									class="px-3 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors"
									title="Remove item"
								>
									<X class="w-4 h-4" />
								</button>
							</div>
						{/each}
					</div>

					<button
						onclick={() => addItem('lifestyleSignals')}
						class="text-sm px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
					>
						+ Add lifestyle signal
					</button>
				</div>

				<!-- Maturity Signals -->
				<div class="mb-6">
					<div class="flex items-start justify-between mb-3">
						<div>
							<label class="block text-sm font-semibold text-gray-200 mb-1">Maturity Signals</label>
							<p class="text-xs text-gray-400">What signs of maturity do you look for?</p>
						</div>
					</div>

					<div class="space-y-2 mb-3">
						{#each editedPreferences.maturitySignals as item, index (index)}
							<div class="flex gap-2">
								<input
									type="text"
									value={item}
									onchange={(e) => updateItem('maturitySignals', index, e.currentTarget.value)}
									placeholder="Add maturity signal"
									class="flex-1 px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gray-400 transition-colors text-sm"
								/>
								<button
									onclick={() => removeItem('maturitySignals', index)}
									class="px-3 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors"
									title="Remove item"
								>
									<X class="w-4 h-4" />
								</button>
							</div>
						{/each}
					</div>

					<button
						onclick={() => addItem('maturitySignals')}
						class="text-sm px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
					>
						+ Add maturity signal
					</button>
				</div>

				<!-- Boundaries -->
				<div class="mb-6">
					<div class="flex items-start justify-between mb-3">
						<div>
							<label class="block text-sm font-semibold text-gray-200 mb-1">Boundaries</label>
							<p class="text-xs text-gray-400">What are your non-negotiable boundaries?</p>
						</div>
					</div>

					<div class="space-y-2 mb-3">
						{#each editedPreferences.boundaries as item, index (index)}
							<div class="flex gap-2">
								<input
									type="text"
									value={item}
									onchange={(e) => updateItem('boundaries', index, e.currentTarget.value)}
									placeholder="Add boundary"
									class="flex-1 px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gray-400 transition-colors text-sm"
								/>
								<button
									onclick={() => removeItem('boundaries', index)}
									class="px-3 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors"
									title="Remove item"
								>
									<X class="w-4 h-4" />
								</button>
							</div>
						{/each}
					</div>

					<button
						onclick={() => addItem('boundaries')}
						class="text-sm px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
					>
						+ Add boundary
					</button>
				</div>

				<!-- Dealbreakers -->
				<div class="mb-6">
					<div class="flex items-start justify-between mb-3">
						<div>
							<label class="block text-sm font-semibold text-gray-200 mb-1">Dealbreakers</label>
							<p class="text-xs text-gray-400">What are absolute dealbreakers for you?</p>
						</div>
					</div>

					<div class="space-y-2 mb-3">
						{#each editedPreferences.dealbreakers as item, index (index)}
							<div class="flex gap-2">
								<input
									type="text"
									value={item}
									onchange={(e) => updateItem('dealbreakers', index, e.currentTarget.value)}
									placeholder="Add dealbreaker"
									class="flex-1 px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gray-400 transition-colors text-sm"
								/>
								<button
									onclick={() => removeItem('dealbreakers', index)}
									class="px-3 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors"
									title="Remove item"
								>
									<X class="w-4 h-4" />
								</button>
							</div>
						{/each}
					</div>

					<button
						onclick={() => addItem('dealbreakers')}
						class="text-sm px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
					>
						+ Add dealbreaker
					</button>
				</div>

				<!-- Private Notes -->
				<div class="mb-6">
					<div class="flex items-start justify-between mb-3">
						<div>
							<label class="block text-sm font-semibold text-gray-200 mb-1">Private Compatibility Notes</label>
							<p class="text-xs text-gray-400">Personal notes about compatibility patterns you've noticed</p>
						</div>
					</div>

					<div class="space-y-2 mb-3">
						{#each editedPreferences.privateCompatibilityNotes as item, index (index)}
							<div class="flex gap-2">
								<input
									type="text"
									value={item}
									onchange={(e) => updateItem('privateCompatibilityNotes', index, e.currentTarget.value)}
									placeholder="Add private note"
									class="flex-1 px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gray-400 transition-colors text-sm"
								/>
								<button
									onclick={() => removeItem('privateCompatibilityNotes', index)}
									class="px-3 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors"
									title="Remove item"
								>
									<X class="w-4 h-4" />
								</button>
							</div>
						{/each}
					</div>

					<button
						onclick={() => addItem('privateCompatibilityNotes')}
						class="text-sm px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
					>
						+ Add private note
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
						placeholder="Why are you updating these preferences? (e.g., 'Refined based on recent conversations')"
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
					<li>• Be specific and honest about what matters to you</li>
					<li>• Update regularly as you learn more about yourself</li>
					<li>• Your preferences help AI Bestie assess compatibility</li>
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
