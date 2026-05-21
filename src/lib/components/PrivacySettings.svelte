<script lang="ts">
	import { AlertCircle, Trash2, Loader2, CheckCircle, XCircle, Shield, Eye, Database } from 'lucide-svelte';
	import type { AssistantType } from '$lib/types';

	interface Props {
		assistantType?: AssistantType;
		isFirstActivation?: boolean;
		onAcknowledge?: () => Promise<void>;
		onDeleteConversationHistory?: () => Promise<void>;
		onDeleteAllData?: () => Promise<void>;
		onClose?: () => void;
	}

	let {
		assistantType = 'bestie',
		isFirstActivation = false,
		onAcknowledge,
		onDeleteConversationHistory,
		onDeleteAllData,
		onClose
	}: Props = $props();

	let acknowledged = $state(false);
	let isAcknowledging = $state(false);
	let showDeleteConversationConfirm = $state(false);
	let showDeleteAllDataConfirm = $state(false);
	let isDeletingConversation = $state(false);
	let isDeletingAllData = $state(false);
	let deleteError = $state<string | null>(null);
	let deleteSuccess = $state<string | null>(null);
	let successTimeout: ReturnType<typeof setTimeout> | null = null;

	const assistantLabel = $derived(assistantType === 'bestie' ? 'AI Bestie' : 'AI Wingman');
	const isRose = $derived(assistantType === 'bestie');

	async function handleAcknowledge() {
		if (!acknowledged) return;
		isAcknowledging = true;
		try {
			if (onAcknowledge) {
				await onAcknowledge();
			}
		} catch (error) {
			deleteError = error instanceof Error ? error.message : 'Failed to acknowledge privacy notice';
		} finally {
			isAcknowledging = false;
		}
	}

	async function handleDeleteConversationHistory() {
		isDeletingConversation = true;
		deleteError = null;
		deleteSuccess = null;

		try {
			if (onDeleteConversationHistory) {
				await onDeleteConversationHistory();
			}
			deleteSuccess = 'Conversation history deleted successfully';
			showDeleteConversationConfirm = false;
			if (successTimeout) clearTimeout(successTimeout);
			successTimeout = setTimeout(() => {
				deleteSuccess = null;
			}, 5000);
		} catch (error) {
			deleteError = error instanceof Error ? error.message : 'Failed to delete conversation history';
		} finally {
			isDeletingConversation = false;
		}
	}

	async function handleDeleteAllData() {
		isDeletingAllData = true;
		deleteError = null;
		deleteSuccess = null;

		try {
			if (onDeleteAllData) {
				await onDeleteAllData();
			}
			deleteSuccess = 'All AI assistant data deleted successfully';
			showDeleteAllDataConfirm = false;
			if (successTimeout) clearTimeout(successTimeout);
			successTimeout = setTimeout(() => {
				deleteSuccess = null;
			}, 5000);
		} catch (error) {
			deleteError = error instanceof Error ? error.message : 'Failed to delete AI assistant data';
		} finally {
			isDeletingAllData = false;
		}
	}

	function closeComponent() {
		if (onClose) {
			onClose();
		}
	}
</script>

<div class="w-full max-w-2xl mx-auto">
	<!-- Privacy Notice Section (First Activation) -->
	{#if isFirstActivation}
		<div class={`rounded-lg p-6 mb-6 border ${isRose ? 'bg-rose-500/10 border-rose-500/30' : 'bg-blue-500/10 border-blue-500/30'}`}>
			<div class="flex gap-4">
				<Shield class={`w-6 h-6 flex-shrink-0 mt-1 ${isRose ? 'text-rose-400' : 'text-blue-400'}`} />
				<div class="flex-1">
					<h2 class={`text-lg font-semibold mb-3 ${isRose ? 'text-rose-300' : 'text-blue-300'}`}>Privacy Notice</h2>
					<p class="text-gray-300 text-sm leading-relaxed mb-4">
						Before activating {assistantLabel}, please review how your data is used:
					</p>

					<!-- Data Usage Explanation -->
					<div class="space-y-3 mb-4">
						<div class="bg-gray-800/50 rounded p-3">
							<div class="flex gap-2 mb-2">
								<Database class="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
								<h3 class="font-medium text-gray-200 text-sm">Data Sent to Claude AI</h3>
							</div>
							<p class="text-gray-400 text-xs ml-6">
								Your {assistantType === 'bestie' ? 'preferences' : 'personality'} profile, match context (age range, dating app, relationship goal), and recent conversation messages are sent to Claude to generate personalized advice.
							</p>
						</div>

						<div class="bg-gray-800/50 rounded p-3">
							<div class="flex gap-2 mb-2">
								<Database class="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
								<h3 class="font-medium text-gray-200 text-sm">Data Storage</h3>
							</div>
							<p class="text-gray-400 text-xs ml-6">
								All conversation history and AI responses are stored securely in our Supabase database. You can delete this data at any time.
							</p>
						</div>

						<div class="bg-gray-800/50 rounded p-3">
							<div class="flex gap-2 mb-2">
								<Eye class="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
								<h3 class="font-medium text-gray-200 text-sm">Privacy Protection</h3>
							</div>
							<p class="text-gray-400 text-xs ml-6">
								We do not send personally identifiable information (names, phone numbers, etc.) to Claude. Only profile data necessary for advice is shared.
							</p>
						</div>
					</div>

					<!-- Acknowledgment Checkbox -->
					<div class="flex items-start gap-3 bg-gray-800/30 rounded p-3 mb-4">
						<input
							type="checkbox"
							id="privacy-acknowledge"
							bind:checked={acknowledged}
							class="w-4 h-4 rounded border-gray-600 text-rose-500 focus:ring-rose-500 mt-1 cursor-pointer"
						/>
						<label for="privacy-acknowledge" class="text-sm text-gray-300 cursor-pointer flex-1">
							I understand how my data is used and agree to activate {assistantLabel}
						</label>
					</div>

					<!-- Action Buttons -->
					<div class="flex gap-3 flex-col sm:flex-row">
						<button
							onclick={handleAcknowledge}
							disabled={!acknowledged || isAcknowledging}
							class={`flex-1 px-4 py-2.5 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 ${
								acknowledged && !isAcknowledging
									? isRose
										? 'bg-rose-600 hover:bg-rose-700 text-white'
										: 'bg-blue-600 hover:bg-blue-700 text-white'
									: 'bg-gray-700 text-gray-400 cursor-not-allowed opacity-50'
							}`}
						>
							{#if isAcknowledging}
								<Loader2 class="w-4 h-4 animate-spin" />
							{:else}
								<CheckCircle class="w-4 h-4" />
							{/if}
							<span>I Agree & Activate</span>
						</button>
						<button
							onclick={closeComponent}
							disabled={isAcknowledging}
							class="flex-1 px-4 py-2.5 rounded-lg font-medium text-sm transition-all bg-gray-800 hover:bg-gray-750 border border-gray-700 text-gray-300 hover:text-white disabled:opacity-50"
						>
							Cancel
						</button>
					</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- Data Management Section -->
	<div class="space-y-4">
		<h3 class="text-lg font-semibold text-gray-100 flex items-center gap-2">
			<Trash2 class="w-5 h-5 text-gray-400" />
			Data Management
		</h3>

		<!-- Error Message -->
		{#if deleteError}
			<div class="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex gap-3">
				<XCircle class="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
				<div>
					<p class="text-sm font-medium text-red-300">Error</p>
					<p class="text-sm text-red-200">{deleteError}</p>
				</div>
			</div>
		{/if}

		<!-- Success Message -->
		{#if deleteSuccess}
			<div class="bg-green-500/10 border border-green-500/30 rounded-lg p-4 flex gap-3">
				<CheckCircle class="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
				<div>
					<p class="text-sm font-medium text-green-300">Success</p>
					<p class="text-sm text-green-200">{deleteSuccess}</p>
				</div>
			</div>
		{/if}

		<!-- Delete Conversation History -->
		<div class="bg-gray-800 border border-gray-700 rounded-lg p-4">
			<div class="flex items-start justify-between mb-3">
				<div>
					<h4 class="font-medium text-gray-100 mb-1">Delete Conversation History</h4>
					<p class="text-sm text-gray-400">
						Remove all messages from this {assistantLabel} conversation session. This action cannot be undone.
					</p>
				</div>
			</div>

			{#if showDeleteConversationConfirm}
				<div class="bg-red-500/10 border border-red-500/30 rounded p-3 mb-3">
					<div class="flex gap-2 mb-3">
						<AlertCircle class="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
						<div>
							<p class="text-sm font-medium text-red-300 mb-1">Are you sure?</p>
							<p class="text-xs text-red-200">
								This will permanently delete all conversation history with {assistantLabel}. This cannot be undone.
							</p>
						</div>
					</div>
					<div class="flex gap-2">
						<button
							onclick={handleDeleteConversationHistory}
							disabled={isDeletingConversation}
							class="flex-1 px-3 py-2 rounded bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2"
						>
							{#if isDeletingConversation}
								<Loader2 class="w-4 h-4 animate-spin" />
							{:else}
								<Trash2 class="w-4 h-4" />
							{/if}
							<span>Delete</span>
						</button>
						<button
							onclick={() => (showDeleteConversationConfirm = false)}
							disabled={isDeletingConversation}
							class="flex-1 px-3 py-2 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm font-medium transition-all disabled:opacity-50"
						>
							Cancel
						</button>
					</div>
				</div>
			{:else}
				<button
					onclick={() => (showDeleteConversationConfirm = true)}
					disabled={isDeletingConversation || isDeletingAllData}
					class="w-full px-4 py-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white font-medium text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					<Trash2 class="w-4 h-4" />
					<span>Delete Conversation History</span>
				</button>
			{/if}
		</div>

		<!-- Delete All AI Assistant Data -->
		<div class="bg-gray-800 border border-gray-700 rounded-lg p-4">
			<div class="flex items-start justify-between mb-3">
				<div>
					<h4 class="font-medium text-gray-100 mb-1">Delete All {assistantLabel} Data</h4>
					<p class="text-sm text-gray-400">
						Remove all {assistantLabel} data including conversation history, preferences, and settings. This action cannot be undone.
					</p>
				</div>
			</div>

			{#if showDeleteAllDataConfirm}
				<div class="bg-red-500/10 border border-red-500/30 rounded p-3 mb-3">
					<div class="flex gap-2 mb-3">
						<AlertCircle class="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
						<div>
							<p class="text-sm font-medium text-red-300 mb-1">Delete all data?</p>
							<p class="text-xs text-red-200">
								This will permanently delete all {assistantLabel} data including conversation history, preferences, and settings. This cannot be undone.
							</p>
						</div>
					</div>
					<div class="flex gap-2">
						<button
							onclick={handleDeleteAllData}
							disabled={isDeletingAllData}
							class="flex-1 px-3 py-2 rounded bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2"
						>
							{#if isDeletingAllData}
								<Loader2 class="w-4 h-4 animate-spin" />
							{:else}
								<Trash2 class="w-4 h-4" />
							{/if}
							<span>Delete All Data</span>
						</button>
						<button
							onclick={() => (showDeleteAllDataConfirm = false)}
							disabled={isDeletingAllData}
							class="flex-1 px-3 py-2 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm font-medium transition-all disabled:opacity-50"
						>
							Cancel
						</button>
					</div>
				</div>
			{:else}
				<button
					onclick={() => (showDeleteAllDataConfirm = true)}
					disabled={isDeletingConversation || isDeletingAllData}
					class="w-full px-4 py-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white font-medium text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					<Trash2 class="w-4 h-4" />
					<span>Delete All {assistantLabel} Data</span>
				</button>
			{/if}
		</div>

		<!-- Information Box -->
		<div class="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 flex gap-3">
			<AlertCircle class="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
			<div>
				<p class="text-sm font-medium text-blue-300 mb-1">Data Retention</p>
				<p class="text-sm text-blue-200">
					Your data is retained for as long as your account is active. When you delete your account, all associated {assistantLabel} data is automatically deleted from our servers.
				</p>
			</div>
		</div>
	</div>
</div>

<style>
	:global(.bg-gray-750) {
		background-color: rgb(31, 41, 55);
	}
</style>
