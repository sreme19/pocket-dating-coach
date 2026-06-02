<script lang="ts">
	import Icon from './Icon.svelte';
	import type { ChatMsg } from './lib';
	import type { Snippet } from 'svelte';

	let {
		head,
		messages,
		generating,
		onSend,
		placeholder,
		emptyTitle,
		emptyDesc,
		disabled = false,
		genLabel = 'generating'
	}: {
		head?: Snippet;
		messages: ChatMsg[];
		generating: boolean;
		onSend: (text: string) => void;
		placeholder: string;
		emptyTitle: string;
		emptyDesc: string;
		disabled?: boolean;
		genLabel?: string;
	} = $props();

	let draft = $state('');
	let scrollEl: HTMLDivElement;
	let taEl: HTMLTextAreaElement;

	$effect(() => {
		messages;
		generating;
		if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
	});

	function send() {
		const v = draft.trim();
		if (!v || generating || disabled) return;
		draft = '';
		if (taEl) taEl.style.height = 'auto';
		onSend(v);
	}
	function onKey(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			send();
		}
	}
	function grow(e: Event) {
		const t = e.target as HTMLTextAreaElement;
		t.style.height = 'auto';
		t.style.height = Math.min(120, t.scrollHeight) + 'px';
	}

	function segments(line: string) {
		return line.split(/(\[\d+\])/g).map((p) => ({ cite: /^\[\d+\]$/.test(p), text: p }));
	}
</script>

<div class="card chat-wrap">
	<div class="chat-head">
		{#if head}{@render head()}{:else}<div style="color:var(--text-4); font-size:13px;">No profile loaded</div>{/if}
	</div>
	<div class="chat-scroll" bind:this={scrollEl}>
		{#if messages.length === 0 && !generating}
			<div class="chat-empty">
				<Icon name="msg" size={34} />
				<div class="t">{emptyTitle}</div>
				<div class="d">{emptyDesc}</div>
			</div>
		{/if}
		{#each messages as m, i (i)}
			<div class="msg {m.side}">
				<div class="msg-av" style="background:{m.color}">{m.initials}</div>
				<div style="min-width:0">
					<div class="msg-role">{m.label}</div>
					<div class="bubble">
						{#each m.text.split('\n') as line, li}
							<div style={li ? 'margin-top:8px' : ''}>
								{#each segments(line) as seg}
									{#if seg.cite}<span class="citation">{seg.text}</span>{:else}{seg.text}{/if}
								{/each}
							</div>
						{/each}
						{#if m.suggestions}
							<div class="suggestions">
								{#each m.suggestions as s}<span class="suggestion">{s}</span>{/each}
							</div>
						{/if}
						{#if m.coachingSignal}
							<div class="coaching {m.coachingSignal.color}">
								<span class="coaching-dot"></span>
								<span
									><span class="coaching-label">{m.coachingSignal.color} flag</span> · for
									{m.ownerName}'s private view — {m.coachingSignal.text}</span
								>
							</div>
						{/if}
					</div>
				</div>
			</div>
		{/each}
		{#if generating}
			<div class="msg left">
				<div class="msg-av" style="background:var(--indigo-strong)"><Icon name="spark" size={13} /></div>
				<div>
					<div class="msg-role">{genLabel}</div>
					<div class="bubble"><div class="typing"><span></span><span></span><span></span></div></div>
				</div>
			</div>
		{/if}
	</div>
	<div class="composer">
		<div class="composer-row">
			<textarea
				bind:this={taEl}
				rows="1"
				bind:value={draft}
				oninput={grow}
				onkeydown={onKey}
				placeholder={disabled ? 'Select a profile to begin…' : placeholder}
				{disabled}
			></textarea>
			<button class="send-btn" onclick={send} disabled={!draft.trim() || generating || disabled}>
				{#if generating}<Icon name="clock" size={17} spin />{:else}<Icon name="send" size={17} />{/if}
			</button>
		</div>
		<div class="composer-hint">
			<Icon name="shield" size={11} color="var(--emerald)" />
			Side-effect-free · <kbd>Enter</kbd> send · <kbd>Shift</kbd>+<kbd>Enter</kbd> newline
		</div>
	</div>
</div>
