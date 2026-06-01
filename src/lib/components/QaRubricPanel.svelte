<script lang="ts">
	import { onMount } from 'svelte';
	import { RUBRIC } from '$lib/qa-rubric';
	import type { ReviewRecord } from '$lib/server/qa-service';

	let {
		existingReview,
		form
	}: {
		existingReview: ReviewRecord | null;
		form: { error?: string; saved?: boolean } | null;
	} = $props();

	const DEFAULT_RUBRIC_WIDTH = 480;
	const MIN_RUBRIC_WIDTH = 320;
	const MAX_RUBRIC_WIDTH = 900;

	let rubricWidth = $state(DEFAULT_RUBRIC_WIDTH);
	let resizing = $state(false);

	onMount(() => {
		const saved = Number(localStorage.getItem('qaRubricWidth'));
		if (saved >= MIN_RUBRIC_WIDTH && saved <= MAX_RUBRIC_WIDTH) rubricWidth = saved;
	});

	function startResize(e: PointerEvent) {
		e.preventDefault();
		resizing = true;
		const startX = e.clientX;
		const startW = rubricWidth;
		const move = (ev: PointerEvent) => {
			// Handle sits left of the panel — dragging left widens the panel.
			rubricWidth = Math.min(MAX_RUBRIC_WIDTH, Math.max(MIN_RUBRIC_WIDTH, startW + (startX - ev.clientX)));
		};
		const up = () => {
			resizing = false;
			localStorage.setItem('qaRubricWidth', String(Math.round(rubricWidth)));
			window.removeEventListener('pointermove', move);
			window.removeEventListener('pointerup', up);
		};
		window.addEventListener('pointermove', move);
		window.addEventListener('pointerup', up);
	}

	function resetWidth() {
		rubricWidth = DEFAULT_RUBRIC_WIDTH;
		localStorage.setItem('qaRubricWidth', String(DEFAULT_RUBRIC_WIDTH));
	}

	let ex = $derived(existingReview);
	const existingScore = (key: string): number | null => {
		if (!ex) return null;
		return (ex as unknown as Record<string, number | null>)[`score_${key}`] ?? null;
	};
	function fmtTime(ts: string): string {
		return new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
	}
</script>

<!-- Drag handle (lg only): resize the rubric panel -->
<div
	role="separator"
	aria-orientation="vertical"
	aria-label="Resize rubric panel"
	title="Drag to resize · double-click to reset"
	onpointerdown={startResize}
	ondblclick={resetWidth}
	class="hidden shrink-0 cursor-col-resize items-center justify-center lg:flex {resizing ? 'select-none' : ''}"
>
	<div class="h-16 w-1 rounded-full transition-colors {resizing ? 'bg-emerald-400' : 'bg-white/15 hover:bg-emerald-400/60'}"></div>
</div>

<aside class="w-full shrink-0 lg:sticky lg:top-6 lg:w-[var(--rw)] lg:self-start" style="--rw: {rubricWidth}px">
	<div class="rounded-xl border border-white/[0.06] bg-[#0d1522] p-4">
		<div class="mb-3 flex items-center justify-between">
			<h2 class="text-sm font-semibold text-white">Rubric · 1 (poor) – 5 (excellent)</h2>
			<span class="hidden text-[11px] text-slate-600 lg:inline">{Math.round(rubricWidth)}px · drag ‹ ›</span>
		</div>

		{#each RUBRIC as dim}
			<div class="mb-4">
				<div class="text-sm text-slate-200">{dim.label}</div>
				<div class="mb-1.5 text-[11px] text-slate-500">{dim.hint}</div>
				<div class="flex gap-1">
					{#each [1, 2, 3, 4, 5] as n}
						<label class="flex-1">
							<input type="radio" name="score_{dim.key}" value={n} checked={existingScore(dim.key) === n} class="peer sr-only" />
							<span
								class="block cursor-pointer rounded-md border border-white/[0.1] py-1 text-center text-xs text-slate-400 peer-checked:border-emerald-400 peer-checked:bg-emerald-500/20 peer-checked:text-emerald-300 hover:border-white/30"
								>{n}</span
							>
						</label>
					{/each}
					<label class="flex-1">
						<input type="radio" name="score_{dim.key}" value={0} checked={existingScore(dim.key) === 0} class="peer sr-only" />
						<span
							title="Not applicable — excluded from averages"
							class="block cursor-pointer rounded-md border border-white/[0.1] py-1 text-center text-xs text-slate-400 peer-checked:border-slate-400 peer-checked:bg-slate-500/20 peer-checked:text-slate-200 hover:border-white/30"
							>N/A</span
						>
					</label>
				</div>
			</div>
		{/each}

		<label class="mb-1 block text-sm text-slate-200" for="comments">Comments</label>
		<textarea
			id="comments"
			name="comments"
			rows="4"
			value={ex?.comments ?? ''}
			placeholder="What worked, what didn’t, anything to escalate…"
			class="mb-3 w-full rounded-lg border border-white/[0.1] bg-[#0b1120] px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/50"
		></textarea>

		<label class="mb-1 block text-xs text-slate-400" for="status">Verdict</label>
		<select
			id="status"
			name="status"
			value={ex?.status ?? 'reviewed'}
			class="mb-4 w-full rounded-lg border border-white/[0.1] bg-[#0b1120] px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/50"
		>
			<option value="reviewed">Reviewed — OK</option>
			<option value="needs_followup">Needs follow-up</option>
			<option value="escalated">Escalate</option>
		</select>

		{#if form?.error}<p class="mb-2 text-sm text-rose-400">{form.error}</p>{/if}
		{#if form?.saved}<p class="mb-2 text-sm text-emerald-400">Saved ✓</p>{/if}

		<button class="w-full rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-[#0b1120] hover:bg-emerald-400"
			>Save review</button
		>

		{#if ex}
			<p class="mt-2 text-center text-[11px] text-slate-600">
				Last reviewed by {ex.reviewer} · {fmtTime(ex.updated_at)}
			</p>
		{/if}
	</div>
</aside>
