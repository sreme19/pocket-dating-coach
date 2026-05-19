<script lang="ts">
	import type { AssistantType } from '$lib/types';

	interface Props {
		assistantType: AssistantType;
		isOpen: boolean;
		onToggle: () => void;
		hasUnread?: boolean;
	}

	let { assistantType, isOpen, onToggle, hasUnread = false }: Props = $props();

	const assistantName = assistantType === 'bestie' ? 'AI Bestie' : 'AI Wingman';
	const assistantEmoji = assistantType === 'bestie' ? '👯‍♀️' : '🤝';
</script>

<button
	class="ai-assistant-toggle"
	class:open={isOpen}
	class:has-unread={hasUnread}
	onclick={onToggle}
	title={assistantName}
	aria-label={`Toggle ${assistantName}`}
	aria-pressed={isOpen}
>
	<span class="emoji">{assistantEmoji}</span>
	<span class="label">{assistantName}</span>
	{#if hasUnread}
		<span class="unread-badge"></span>
	{/if}
</button>

<style>
	.ai-assistant-toggle {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
		border: none;
		border-radius: 0.5rem;
		cursor: pointer;
		font-size: 0.875rem;
		font-weight: 500;
		transition: all 0.2s;
		position: relative;
	}

	.ai-assistant-toggle:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
	}

	.ai-assistant-toggle.open {
		background: linear-gradient(135deg, #764ba2 0%, #667eea 100%);
		box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
	}

	.emoji {
		font-size: 1.25rem;
	}

	.label {
		display: none;
	}

	.unread-badge {
		position: absolute;
		top: -4px;
		right: -4px;
		width: 8px;
		height: 8px;
		background: #ef4444;
		border-radius: 50%;
		border: 2px solid white;
	}

	@media (min-width: 640px) {
		.label {
			display: inline;
		}
	}

	@media (max-width: 768px) {
		.ai-assistant-toggle {
			padding: 0.5rem;
			border-radius: 50%;
			width: 48px;
			height: 48px;
			justify-content: center;
		}

		.emoji {
			font-size: 1.5rem;
		}
	}
</style>
