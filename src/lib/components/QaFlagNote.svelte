<script lang="ts">
	// Per-message flag + QA note, with a local "Save note" button so a reviewer can
	// persist a single annotation without scrolling to the rubric — handy when adding
	// notes to an already-reviewed thread. The button is a plain submit inside the
	// page's review form; the parent's enhance handler tracks which note was saved.
	let {
		id,
		flagged = $bindable(),
		note = $bindable(),
		saving = false,
		saved = false,
		onRequestSave
	}: {
		id: string;
		flagged: boolean;
		note: string;
		saving?: boolean;
		saved?: boolean;
		onRequestSave: (id: string) => void;
	} = $props();

	// Grow a textarea to fit its content as the reviewer types.
	function autogrow(node: HTMLTextAreaElement) {
		const resize = () => {
			node.style.height = 'auto';
			node.style.height = `${node.scrollHeight}px`;
		};
		resize();
		node.addEventListener('input', resize);
		return { destroy: () => node.removeEventListener('input', resize) };
	}
</script>

<label class="flex items-center gap-1.5 text-[11px] text-slate-500">
	<input type="checkbox" name="flagged" value={id} bind:checked={flagged} class="accent-rose-500" />
	{flagged ? '🚩 flagged' : 'flag this message'}
</label>
{#if flagged}
	<textarea
		name="flagnote_{id}"
		bind:value={note}
		rows="2"
		use:autogrow
		placeholder="QA note on this message — what's wrong with it?"
		class="mt-1 min-h-[3rem] w-[27rem] max-w-full resize-none overflow-hidden rounded-md border border-rose-500/30 bg-[#0b1120] px-2 py-1 text-xs leading-relaxed text-slate-200 outline-none focus:border-rose-400"
	></textarea>
	<div class="mt-1 flex items-center gap-2">
		<button
			type="submit"
			onclick={() => onRequestSave(id)}
			disabled={saving}
			class="rounded-md border border-emerald-500/40 px-2.5 py-1 text-[11px] font-medium text-emerald-400 transition-colors hover:bg-emerald-500/10 disabled:opacity-50"
			>{saving ? 'Saving…' : 'Save note'}</button
		>
		{#if saved}<span class="text-[11px] text-emerald-400">Saved ✓</span>{/if}
	</div>
{/if}
