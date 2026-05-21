<script lang="ts">
	import { goto } from '$app/navigation';
	import { Send, Loader2, ChevronRight, Sparkles } from 'lucide-svelte';
	import { onMount, tick } from 'svelte';
	import { getProfileChatHistory, addProfileChatMessage } from '$lib/male-profile';
	import type { ProfileChatMessage, UserProfile, AssistantType } from '$lib/types';
	import { createSessionStore } from '$lib/client/session-store';

	let messages = $state<ProfileChatMessage[]>([]);
	let input = $state('');
	let loading = $state(false);
	let userProfile = $state<UserProfile | null>(null);
	let messagesEl: HTMLDivElement;
	let activeAssistant = $state<AssistantType | null>(null);
	let sessionStore: ReturnType<typeof createSessionStore> | null = null;
	let userId = $state<string>('');
	let sessionLoading = $state(true);

	const MAX_EXCHANGES = 8;

	onMount(() => {
		const stored = localStorage.getItem('pdc_profile');
		if (stored) userProfile = JSON.parse(stored);

		// Get user ID from localStorage or auth
		const storedUserId = localStorage.getItem('pdc_user_id');
		userId = storedUserId || 'anonymous-user';

		// Initialize session store for profile chat
		sessionStore = createSessionStore(userId, 'profile-chat');
		sessionStore.load().then(() => {
			sessionStore?.subscribe((state) => {
				activeAssistant = state.activeAssistant;
			});
			sessionLoading = false;
		});

		const history = getProfileChatHistory();
		messages = history;

		if (messages.length === 0) {
			// First time - fetch initial question from API
			fetchInitialQuestion();
		}

		scrollToBottom();
	});

	function scrollToBottom() {
		setTimeout(() => {
			if (messagesEl) {
				messagesEl.scrollTop = messagesEl.scrollHeight;
			}
		}, 0);
	}

	async function fetchInitialQuestion() {
		loading = true;
		try {
			const response = await fetch('/api/profile-chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					mode: 'initial',
					userProfile
				})
			});

			const data = await response.json();
			if (data.error) throw new Error(data.error);

			const msg: ProfileChatMessage = {
				id: Math.random().toString(36),
				role: 'assistant',
				content: data.question,
				timestamp: Date.now()
			};
			messages = [...messages, msg];
			addProfileChatMessage(msg);
		} catch (err) {
			console.error('Failed to fetch initial question:', err);
			// Fallback question
			const msg: ProfileChatMessage = {
				id: Math.random().toString(36),
				role: 'assistant',
				content:
					'Looking at your photos and what you shared — what would your closest friends say is your biggest strength in relationships?',
				timestamp: Date.now()
			};
			messages = [...messages, msg];
			addProfileChatMessage(msg);
		} finally {
			loading = false;
			scrollToBottom();
		}
	}

	async function sendMessage() {
		if (!input.trim() || loading) return;

		const userMessage = input;
		input = '';

		const msg: ProfileChatMessage = {
			id: Math.random().toString(36),
			role: 'user',
			content: userMessage,
			timestamp: Date.now()
		};

		messages = [...messages, msg];
		addProfileChatMessage(msg);
		scrollToBottom();

		const totalExchanges = messages.filter((m) => m.role === 'user').length;

		if (totalExchanges >= MAX_EXCHANGES) {
			// Move to generation
			setTimeout(() => goto('/profile-review-male'), 500);
			return;
		}

		loading = true;
		try {
			const response = await fetch('/api/profile-chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					mode: 'continue',
					userProfile,
					chatHistory: messages
				})
			});

			const data = await response.json();
			if (data.error) throw new Error(data.error);

			const assistantMsg: ProfileChatMessage = {
				id: Math.random().toString(36),
				role: 'assistant',
				content: data.question,
				timestamp: Date.now()
			};

			messages = [...messages, assistantMsg];
			addProfileChatMessage(assistantMsg);
		} catch (err) {
			console.error('Failed to fetch next question:', err);
			const errorMsg: ProfileChatMessage = {
				id: Math.random().toString(36),
				role: 'assistant',
				content: "Sorry, I had trouble thinking of the next question. Ready to generate your profile?",
				timestamp: Date.now()
			};
			messages = [...messages, errorMsg];
		} finally {
			loading = false;
			scrollToBottom();
		}
	}

	function skipToGeneration() {
		goto('/profile-review-male');
	}

	let userQuestionCount = $derived(messages.filter((m) => m.role === 'user').length);
	let exchangeProgress = $derived((userQuestionCount / MAX_EXCHANGES) * 100);

	async function handleActivateAssistant(assistantType: AssistantType) {
		try {
			if (sessionStore) {
				await sessionStore.activateAssistant(assistantType);
			}
		} catch (error) {
			console.error('Failed to activate assistant:', error);
		}
	}

	async function handleDeactivateAssistant() {
		try {
			if (sessionStore) {
				await sessionStore.deactivateAssistant();
			}
		} catch (error) {
			console.error('Failed to deactivate assistant:', error);
		}
	}
</script>

<div class="min-h-screen bg-slate-950 text-white flex flex-col">
	<!-- Header -->
	<div class="px-6 py-4 border-b border-slate-800 bg-slate-900/50">
		<div class="max-w-2xl mx-auto">
			<div class="flex items-center justify-between mb-3">
				<h1 class="text-xl font-bold">Let's Refine Your Profile</h1>
				<span class="text-xs text-slate-500">{userQuestionCount}/{MAX_EXCHANGES}</span>
			</div>
			<div class="w-full bg-slate-800 rounded-full h-1 overflow-hidden">
				<div
					class="bg-gradient-to-r from-rose-500 to-amber-500 h-full transition-all duration-300"
					style="width: {exchangeProgress}%"
				></div>
			</div>
		</div>
	</div>

	<!-- Messages -->
	<div class="flex-1 overflow-y-auto px-6 py-8" bind:this={messagesEl}>
		<div class="max-w-2xl mx-auto space-y-6">
			{#each messages as message (message.id)}
				<div class="flex {message.role === 'user' ? 'justify-end' : 'justify-start'}">
					<div
						class="{message.role === 'user'
							? 'bg-rose-600'
							: 'bg-slate-800'} rounded-xl px-6 py-4 max-w-[85%] break-words"
					>
						<p class="text-sm leading-relaxed">{message.content}</p>
						<p class="text-xs {message.role === 'user' ? 'text-rose-200' : 'text-slate-400'} mt-2">
							{new Date(message.timestamp).toLocaleTimeString([], {
								hour: '2-digit',
								minute: '2-digit'
							})}
						</p>
					</div>
				</div>
			{/each}

			{#if loading}
				<div class="flex justify-start">
					<div class="bg-slate-800 rounded-xl px-6 py-4">
						<div class="flex items-center gap-2">
							<Sparkles class="w-4 h-4 text-amber-400 animate-pulse" />
							<span class="text-sm text-slate-300">Thinking...</span>
						</div>
					</div>
				</div>
			{/if}
		</div>
	</div>

	<!-- Input -->
	<div class="px-6 py-6 border-t border-slate-800 bg-slate-900/50">
		<div class="max-w-2xl mx-auto space-y-3">
			{#if userQuestionCount >= MAX_EXCHANGES}
				<div class="bg-emerald-600/20 border border-emerald-600/30 rounded-lg p-4 text-center">
					<p class="text-emerald-300 font-medium">Ready! Let's generate your profile →</p>
				</div>
			{/if}

			<div class="flex gap-3">
				<input
					type="text"
					bind:value={input}
					placeholder={loading ? 'Waiting for next question...' : 'Answer the question...'}
					onkeydown={(e) => e.key === 'Enter' && sendMessage()}
					disabled={loading || userQuestionCount >= MAX_EXCHANGES}
					class="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-rose-500 outline-none disabled:opacity-50"
				/>
				<!-- AI Bestie Toggle Button -->
				{#if userProfile}
					<button
						onclick={() => {
							if (activeAssistant) {
								handleDeactivateAssistant();
							} else {
								handleActivateAssistant(userProfile?.gender === 'woman' ? 'bestie' : 'wingman');
							}
						}}
						disabled={loading || sessionLoading}
						title={activeAssistant ? 'Deactivate AI Assistant' : 'Activate AI Assistant'}
						class={`px-3 py-3 rounded-lg transition-all flex-shrink-0 ${
							activeAssistant
								? 'bg-rose-600 hover:bg-rose-700 text-white'
								: 'bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-slate-300'
						} disabled:opacity-40 disabled:cursor-not-allowed`}
					>
						<Sparkles class="w-4 h-4" />
					</button>
				{/if}
				<button
					onclick={sendMessage}
					disabled={loading || !input.trim() || userQuestionCount >= MAX_EXCHANGES}
					class="px-4 py-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
				>
					{#if loading}
						<Loader2 class="w-4 h-4 animate-spin" />
					{:else}
						<Send class="w-4 h-4" />
					{/if}
				</button>
			</div>

			<div class="flex gap-3 text-sm">
				<button
					onclick={skipToGeneration}
					class="flex-1 text-slate-400 hover:text-slate-300 py-2 transition-colors"
				>
					Skip ({MAX_EXCHANGES - userQuestionCount} left) →
				</button>
			</div>
		</div>
	</div>
</div>
