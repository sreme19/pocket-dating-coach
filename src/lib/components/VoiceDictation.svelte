<script lang="ts">
	import { onMount } from 'svelte';
	import { Mic, MicOff } from 'lucide-svelte';

	let { onUse, disabled = false }: { onUse: (text: string) => void; disabled?: boolean } = $props();

	let supported = $state(false);
	let recording = $state(false);
	let liveText = $state('');
	let errorMsg = $state<string | null>(null);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let recognition: any = null;

	onMount(() => {
		supported =
			typeof window !== 'undefined' &&
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			('SpeechRecognition' in window || 'webkitSpeechRecognition' in (window as any));
	});

	function startRecording() {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
		recognition = new SR();
		recognition.continuous = false;
		recognition.interimResults = true;
		recognition.lang = 'en-US';

		let finalText = '';
		errorMsg = null;
		liveText = '';

		recognition.onresult = (event: any) => {
			let interim = '';
			for (let i = event.resultIndex; i < event.results.length; i++) {
				if (event.results[i].isFinal) {
					finalText += event.results[i][0].transcript + ' ';
				} else {
					interim += event.results[i][0].transcript;
				}
			}
			liveText = (finalText + interim).trimStart();
		};

		recognition.onerror = (event: any) => {
			if (event.error === 'no-speech') {
				errorMsg = 'No speech detected.';
			} else if (event.error === 'not-allowed') {
				errorMsg = 'Microphone access denied.';
			} else {
				errorMsg = `Error: ${event.error}`;
			}
			recording = false;
			liveText = '';
		};

		recognition.onend = () => {
			recording = false;
			const text = liveText.trim();
			liveText = '';
			// Directly fill the input — no review step
			if (text) onUse(text);
		};

		recognition.start();
		recording = true;
	}

	function stopRecording() {
		recognition?.stop();
	}

	function toggleRecording() {
		if (recording) {
			stopRecording();
		} else {
			startRecording();
		}
	}
</script>

{#if supported}
	<div class="mic-wrap">
		<!-- Mic button -->
		<button
			onclick={toggleRecording}
			disabled={disabled}
			title={recording ? 'Stop — text will fill in' : 'Dictate message'}
			class="mic-btn {recording ? 'recording' : ''}"
			aria-label={recording ? 'Stop recording' : 'Start voice input'}
		>
			{#if recording}
				<MicOff class="w-4 h-4" />
			{:else}
				<Mic class="w-4 h-4" />
			{/if}
		</button>

		<!-- Live preview while speaking -->
		{#if recording && liveText}
			<div class="live-preview" aria-live="polite">
				{liveText}
			</div>
		{/if}

		<!-- Error tooltip -->
		{#if errorMsg}
			<div class="error-tip">
				{errorMsg}
				<button class="error-dismiss" onclick={() => { errorMsg = null; }} aria-label="Dismiss">✕</button>
			</div>
		{/if}
	</div>
{/if}

<style>
	.mic-wrap {
		position: relative;
		flex-shrink: 0;
	}

	.mic-btn {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		border: none;
		display: grid;
		place-items: center;
		cursor: pointer;
		transition: background 150ms, transform 150ms;
		color: var(--text-3, #888);
		background: var(--bg-3, #2a2a2a);
		flex-shrink: 0;
	}

	.mic-btn:hover:not(:disabled) {
		background: var(--bg-2, #333);
		color: var(--text-1, #fff);
	}

	.mic-btn.recording {
		background: #dc2626;
		color: #fff;
		animation: pulse-ring 1.2s ease-in-out infinite;
	}

	.mic-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	@keyframes pulse-ring {
		0%, 100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.4); }
		50%       { box-shadow: 0 0 0 6px rgba(220, 38, 38, 0); }
	}

	/* Live preview bubble */
	.live-preview {
		position: absolute;
		bottom: calc(100% + 8px);
		right: 0;
		min-width: 180px;
		max-width: 280px;
		background: var(--bg-3, #1e1e1e);
		border: 1px solid var(--border-1, #333);
		border-radius: 10px;
		padding: 8px 10px;
		font-size: 12px;
		color: var(--text-2, #ccc);
		font-style: italic;
		line-height: 1.45;
		pointer-events: none;
		white-space: pre-wrap;
		word-break: break-word;
		z-index: 20;
	}

	/* Error tooltip */
	.error-tip {
		position: absolute;
		bottom: calc(100% + 8px);
		right: 0;
		min-width: 160px;
		max-width: 240px;
		background: var(--bg-3, #1e1e1e);
		border: 1px solid rgba(239, 68, 68, 0.4);
		border-radius: 10px;
		padding: 7px 10px;
		font-size: 12px;
		color: #f87171;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		z-index: 20;
	}

	.error-dismiss {
		background: none;
		border: none;
		color: #f87171;
		cursor: pointer;
		font-size: 11px;
		padding: 0;
		flex-shrink: 0;
		opacity: 0.7;
	}
	.error-dismiss:hover { opacity: 1; }
</style>
