<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';
	import QaRubricPanel from '$lib/components/QaRubricPanel.svelte';
	import QaFlagNote from '$lib/components/QaFlagNote.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let r = $derived(data.review);

	const initialFlags = data.review.existingReview?.flagged_message_ids ?? [];
	let flagged = $state<Record<string, boolean>>(Object.fromEntries(initialFlags.map((f) => [f.id, true])));
	let notes = $state<Record<string, string>>(Object.fromEntries(initialFlags.map((f) => [f.id, f.note])));

	let pendingNoteId = $state<string | null>(null);
	let savingNoteId = $state<string | null>(null);
	let savedNoteId = $state<string | null>(null);

	function requestNoteSave(id: string) {
		pendingNoteId = id;
	}

	const submitReview = () => {
		const noteId = pendingNoteId;
		if (noteId) savingNoteId = noteId;
		return async ({ result, update }: { result: { type: string }; update: (opts?: { reset?: boolean }) => Promise<void> }) => {
			await update({ reset: false });
			savingNoteId = null;
			if (noteId && result.type === 'success') savedNoteId = noteId;
			pendingNoteId = null;
		};
	};

	function fmtTime(ts: string | null): string {
		if (!ts) return '';
		return new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
	}
	function fmtDur(s: number | null): string {
		if (s == null) return '—';
		return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
	}
</script>

<div class="min-h-screen bg-[#0b1120] px-6 py-6 text-slate-100">
	<a href="/admin/qa" class="text-xs text-slate-500 hover:text-slate-300">← Back to queue</a>

	<div class="mt-2 mb-5">
		<h1 class="text-xl font-bold text-white">{r.ownerName}'s bestie ↔ {r.callerName} · voice call</h1>
		<p class="text-sm text-slate-500">
			{r.status} · {fmtDur(r.durationS)} · {r.usedClonedVoice ? 'cloned voice' : 'default voice'} · {fmtTime(r.startedAt)}
		</p>
	</div>

	<form method="POST" action="?/save" use:enhance={submitReview}>
		<div class="flex flex-col gap-6 lg:flex-row">
			<!-- LEFT: transcript + recap + drafts -->
			<div class="min-w-0 flex-1 space-y-6">
				<section>
					<h2 class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
						Call transcript ({r.ownerName}'s bestie ↔ {r.callerName})
					</h2>
					{#if r.turns.length === 0}
						<p class="text-sm text-slate-600">No transcript captured for this call.</p>
					{/if}
					<div class="space-y-3">
						{#each r.turns as t (t.id)}
							{@const isAi = t.role === 'agent'}
							<div class="flex {isAi ? 'justify-end' : 'justify-start'}">
								<div class="max-w-[78%]">
									<div class="mb-0.5 flex items-center gap-2 text-xs text-slate-500 {isAi ? 'justify-end' : ''}">
										<span class={isAi ? 'text-pink-400' : 'text-sky-400'}>{t.speaker}</span>
										<span>{fmtTime(t.ts)}</span>
									</div>
									<div
										class="rounded-2xl border px-3 py-2 text-sm {isAi
											? 'border-pink-500/30 bg-pink-500/10 text-slate-100'
											: 'border-white/[0.08] bg-[#0d1522] text-slate-200'}"
									>
										{t.text}
									</div>
									<div class="mt-1 {isAi ? 'flex flex-col items-end' : ''}">
										<QaFlagNote
											id={t.id}
											bind:flagged={flagged[t.id]}
											bind:note={notes[t.id]}
											saving={savingNoteId === t.id}
											saved={savedNoteId === t.id}
											onRequestSave={requestNoteSave}
										/>
									</div>
								</div>
							</div>
						{/each}
					</div>
				</section>

				<section>
					<h2 class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Recap posted to thread</h2>
					<p class="rounded-lg border border-white/[0.06] bg-[#0d1522] p-3 text-sm text-slate-200">{r.recap ?? '— none —'}</p>
				</section>

				<section>
					<h2 class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
						Private read for {r.ownerName} {r.signal ? `· ${r.signal}` : ''}
					</h2>
					<p class="rounded-lg border border-white/[0.06] bg-[#0d1522] p-3 text-sm text-slate-200">{r.read || '— none —'}</p>
				</section>

				{#if r.drafts.length}
					<section>
						<h2 class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Drafts left ({r.drafts.length})</h2>
						<ul class="space-y-1">
							{#each r.drafts as d}
								<li class="rounded bg-white/[0.04] px-2 py-1 text-sm text-slate-300">{d}</li>
							{/each}
						</ul>
					</section>
				{/if}
			</div>

			<!-- RIGHT: rubric (shared with match + advisor reviews) -->
			<QaRubricPanel existingReview={r.existingReview} {form} />
		</div>
	</form>
</div>
