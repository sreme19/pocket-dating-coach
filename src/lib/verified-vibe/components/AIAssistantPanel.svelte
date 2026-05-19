<script lang="ts">
	import { onMount } from 'svelte';
	import { fade, slide } from 'svelte/transition';
	import type { AIAssistantMessage, AssistantType, ChatMessage } from '$lib/types';

	interface Props {
		assistantType: AssistantType;
		matchConversationId: string;
		recentMessages: ChatMessage[];
		matchedUserProfile?: any;
		isOpen: boolean;
		onClose: () => void;
	}

	let {
		assistantType,
		matchConversationId,
		recentMessages,
		matchedUserProfile,
		isOpen,
		onClose
	}: Props = $props();

	let messages: AIAssistantMessage[] = $state([]);
	let inputValue = $state('');
	let isLoading = $state(false);
	let error = $state<string | null>(null);
	let messagesContainer: HTMLElement | undefined;
	let conversationId = $state<string | null>(null);

	const assistantName = assistantType === 'bestie' ? 'AI Bestie' : 'AI Wingman';
	const assistantEmoji = assistantType === 'bestie' ? '👯‍♀️' : '🤝';

	onMount(async () => {
		// Create or fetch AI assistant conversation
		try {
			const response = await fetch('/api/ai-assistant/conversations', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					matchConversationId,
					assistantType
				})
			});

			if (!response.ok) throw new Error('Failed to create conversation');

			const data = await response.json();
			conversationId = data.id;
			messages = data.messages || [];
		} catch (err) {
			console.error('Error initializing AI assistant:', err);
			error = 'Failed to initialize assistant';
		}
	});

	$effect(() => {
		if (messagesContainer) {
			setTimeout(() => {
				messagesContainer?.scrollTo({ top: messagesContainer.scrollHeight, behavior: 'smooth' });
			}, 0);
		}
	});

	async function sendMessage() {
		if (!inputValue.trim() || isLoading || !conversationId) return;

		const userMessage = inputValue.trim();
		inputValue = '';
		isLoading = true;
		error = null;

		try {
			// Add user message to local state
			const userMsg: AIAssistantMessage = {
				id: `msg-${Date.now()}`,
				role: 'user',
				content: userMessage,
				timestamp: Date.now()
			};

			messages = [...messages, userMsg];

			// Call AI assistant API
			const response = await fetch('/api/ai-assistant/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					conversationId,
					assistantType,
					messages: messages.map(m => ({
						role: m.role,
						content: m.content
					})),
					matchContext: {
						matchedUserProfile,
						recentMessages
					}
				})
			});

			if (!response.ok) {
				throw new Error('Failed to get response');
			}

			const data = await response.json();

			// Add assistant message
			const assistantMsg: AIAssistantMessage = {
				id: `msg-${Date.now()}-assistant`,
				role: 'assistant',
				content: data.reply,
				timestamp: Date.now(),
				citations: data.citations
			};

			messages = [...messages, assistantMsg];

			// Save to database
			if (conversationId) {
				await fetch(`/api/ai-assistant/conversations/${conversationId}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						messages: [userMsg, assistantMsg]
					})
				});
			}
		} catch (err) {
			console.error('Error sending message:', err);
			error = err instanceof Error ? err.message : 'Failed to send message';
			// Remove the user message if there was an error
			messages = messages.slice(0, -1);
		} finally {
			isLoading = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
	}
</script>

{#if isOpen}
	<div class="ai-assistant-panel" transition:slide={{ duration: 300 }}>
		<!-- Header -->
		<div class="panel-header">
			<div class="header-content">
				<span class="assistant-emoji">{assistantEmoji}</span>
				<h3>{assistantName}</h3>
			</div>
			<button class="close-btn" onclick={onClose} aria-label="Close assistant">
				<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
					<path d="M15 5L5 15M5 5L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
				</svg>
			</button>
		</div>

		<!-- Messages -->
		<div class="messages-container" bind:this={messagesContainer}>
			{#if messages.length === 0}
				<div class="empty-state">
					<p>Hi! I'm {assistantName}. Ask me anything about this conversation or dating strategy.</p>
				</div>
			{/if}

			{#each messages as message (message.id)}
				<div class="message" class:user={message.role === 'user'} transition:fade>
					<div class="message-content">
						<p>{message.content}</p>
						{#if message.citations && message.citations.length > 0}
							<div class="citations">
								{#each message.citations as citation}
									<small>{citation}</small>
								{/each}
							</div>
						{/if}
					</div>
				</div>
			{/each}

			{#if isLoading}
				<div class="message assistant" transition:fade>
					<div class="message-content">
						<div class="typing-indicator">
							<span></span>
							<span></span>
							<span></span>
						</div>
					</div>
				</div>
			{/if}
		</div>

		<!-- Error -->
		{#if error}
			<div class="error-message" transition:fade>
				{error}
			</div>
		{/if}

		<!-- Input -->
		<div class="input-area">
			<textarea
				bind:value={inputValue}
				placeholder="Ask me anything..."
				disabled={isLoading}
				onkeydown={handleKeydown}
				rows="2"
			></textarea>
			<button
				class="send-btn"
				onclick={sendMessage}
				disabled={isLoading || !inputValue.trim()}
				aria-label="Send message"
			>
				<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
					<path
						d="M2 10L18 2L10 18L8 11L2 10Z"
						fill="currentColor"
						stroke="currentColor"
						stroke-width="1"
						stroke-linejoin="round"
					/>
				</svg>
			</button>
		</div>
	</div>
{/if}

<style>
	.ai-assistant-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: white;
		border-left: 1px solid #e5e7eb;
		box-shadow: -2px 0 8px rgba(0, 0, 0, 0.1);
	}

	.panel-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem;
		border-bottom: 1px solid #e5e7eb;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
	}

	.header-content {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.assistant-emoji {
		font-size: 1.5rem;
	}

	.panel-header h3 {
		margin: 0;
		font-size: 1.125rem;
		font-weight: 600;
	}

	.close-btn {
		background: none;
		border: none;
		color: white;
		cursor: pointer;
		padding: 0.25rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		transition: background-color 0.2s;
	}

	.close-btn:hover {
		background-color: rgba(255, 255, 255, 0.2);
	}

	.messages-container {
		flex: 1;
		overflow-y: auto;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.empty-state {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		text-align: center;
		color: #6b7280;
	}

	.empty-state p {
		margin: 0;
		font-size: 0.875rem;
		line-height: 1.5;
	}

	.message {
		display: flex;
		justify-content: flex-start;
		gap: 0.5rem;
	}

	.message.user {
		justify-content: flex-end;
	}

	.message-content {
		max-width: 85%;
		padding: 0.75rem 1rem;
		border-radius: 0.75rem;
		background: #f3f4f6;
		color: #1f2937;
		font-size: 0.875rem;
		line-height: 1.5;
	}

	.message.user .message-content {
		background: #667eea;
		color: white;
	}

	.message-content p {
		margin: 0;
	}

	.citations {
		margin-top: 0.5rem;
		padding-top: 0.5rem;
		border-top: 1px solid rgba(0, 0, 0, 0.1);
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.citations small {
		font-size: 0.75rem;
		opacity: 0.8;
		font-style: italic;
	}

	.typing-indicator {
		display: flex;
		gap: 0.25rem;
		align-items: center;
		height: 1rem;
	}

	.typing-indicator span {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		background: #9ca3af;
		animation: typing 1.4s infinite;
	}

	.typing-indicator span:nth-child(2) {
		animation-delay: 0.2s;
	}

	.typing-indicator span:nth-child(3) {
		animation-delay: 0.4s;
	}

	@keyframes typing {
		0%,
		60%,
		100% {
			opacity: 0.5;
			transform: translateY(0);
		}
		30% {
			opacity: 1;
			transform: translateY(-0.5rem);
		}
	}

	.error-message {
		padding: 0.75rem 1rem;
		background: #fee2e2;
		color: #991b1b;
		font-size: 0.875rem;
		border-top: 1px solid #fecaca;
	}

	.input-area {
		display: flex;
		gap: 0.5rem;
		padding: 1rem;
		border-top: 1px solid #e5e7eb;
		background: #f9fafb;
	}

	textarea {
		flex: 1;
		padding: 0.5rem;
		border: 1px solid #d1d5db;
		border-radius: 0.5rem;
		font-family: inherit;
		font-size: 0.875rem;
		resize: none;
		transition: border-color 0.2s;
	}

	textarea:focus {
		outline: none;
		border-color: #667eea;
		box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
	}

	textarea:disabled {
		background: #f3f4f6;
		color: #9ca3af;
	}

	.send-btn {
		padding: 0.5rem;
		background: #667eea;
		color: white;
		border: none;
		border-radius: 0.5rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background-color 0.2s;
	}

	.send-btn:hover:not(:disabled) {
		background: #5568d3;
	}

	.send-btn:disabled {
		background: #d1d5db;
		cursor: not-allowed;
	}

	@media (max-width: 768px) {
		.ai-assistant-panel {
			position: fixed;
			bottom: 0;
			right: 0;
			width: 100%;
			height: 50vh;
			border-left: none;
			border-top: 1px solid #e5e7eb;
			border-radius: 1rem 1rem 0 0;
			z-index: 40;
		}

		.message-content {
			max-width: 90%;
		}
	}
</style>
