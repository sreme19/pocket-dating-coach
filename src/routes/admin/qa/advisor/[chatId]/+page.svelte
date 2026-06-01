<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';
	import QaRubricPanel from '$lib/components/QaRubricPanel.svelte';
	import QaFlagNote from '$lib/components/QaFlagNote.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let r = $derived(data.review);

	// Per-message flag state + notes, seeded from any existing review.
	const initialFlags = data.review.existingReview?.flagged_message_ids ?? [];
	let flagged = $state<Record<string, boolean>>(
		Object.fromEntries(initialFlags.map((f) => [f.id, true]))
	);
	let notes = $state<Record<string, string>>(
		Object.fromEntries(initialFlags.map((f) => [f.id, f.note]))
	);

	// Per-note save: a "Save note" button submits the whole review form, but we track
	// which note triggered it so we can show local "Saving…/Saved ✓" feedback.
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
			// Keep the reviewer's in-progress scores/notes — don't reset the form.
			await update({ reset: false });
			savingNoteId = null;
			if (noteId && result.type === 'success') savedNoteId = noteId;
			pendingNoteId = null;
		};
	};

	function fmtTime(ts: string): string {
		if (!ts) return '';
		return new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
	}
</script>

<div class="min-h-screen bg-[#0b1120] px-6 py-6 text-slate-100">
	<a href="/admin/qa" class="text-xs text-slate-500 hover:text-slate-300">← Back to queue</a>

	<div class="mt-2 mb-5">
		<h1 class="text-xl font-bold text-white">{r.assistantLabel} ↔ {r.owner.name}</h1>
		<p class="text-sm text-slate-500">
			Global advisor chat · {r.owner.gender ?? '?'}, {r.owner.archetype ?? '—'}
		</p>
	</div>

	<form method="POST" action="?/save" use:enhance={submitReview}>
		<div class="flex flex-col gap-6 lg:flex-row">
			<!-- LEFT: reconstructed advisor conversation -->
			<div class="min-w-0 flex-1 space-y-6">
				<section>
					<h2 class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
						Advisor conversation ({r.assistantLabel} ↔ {r.owner.name})
					</h2>
					{#if r.timeline.length === 0}
						<p class="text-sm text-slate-600">No advisor messages recorded yet.</p>
					{/if}
					<div class="space-y-3">
						{#each r.timeline as m (m.id)}
							{@const isAi = m.role === 'assistant'}
							<div class="flex {isAi ? 'justify-end' : 'justify-start'}">
								<div class="max-w-[78%]">
									<div class="mb-0.5 flex items-center gap-2 text-xs text-slate-500 {isAi ? 'justify-end' : ''}">
										<span class={isAi ? 'text-indigo-400' : ''}>{isAi ? r.assistantLabel : r.owner.name}</span>
										<span>{fmtTime(m.createdAt)}</span>
										{#if m.source === 'greeting'}<span class="rounded bg-emerald-500/20 px-1.5 text-[10px] text-emerald-300">proactive</span>{/if}
									</div>
									<div
										class="rounded-2xl border px-3 py-2 text-sm {isAi
											? 'border-indigo-500/30 bg-indigo-500/10 text-slate-100'
											: 'border-white/[0.08] bg-[#0d1522] text-slate-200'}"
									>
										{m.content}
									</div>
									{#if m.topicTags && m.topicTags.length}
										<div class="mt-1 text-[11px] text-slate-600">{m.topicTags.join(' · ')}</div>
									{/if}
									<div class="mt-1 {isAi ? 'flex flex-col items-end' : ''}">
										<QaFlagNote
											id={m.id}
											bind:flagged={flagged[m.id]}
											bind:note={notes[m.id]}
											saving={savingNoteId === m.id}
											saved={savedNoteId === m.id}
											onRequestSave={requestNoteSave}
										/>
									</div>
								</div>
							</div>
						{/each}
					</div>
				</section>

				{#if r.feedback.length}
					<section>
						<h2 class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Owner feedback on advisor greetings</h2>
						<div class="space-y-2">
							{#each r.feedback as f (f.id)}
								<div class="rounded-lg border border-white/[0.06] bg-[#0d1522] p-3 text-sm">
									<div class="mb-1 text-xs">
										<span class={f.rating === 1 ? 'text-emerald-400' : 'text-rose-400'}
											>{f.rating === 1 ? '👍 helpful' : '👎 not helpful'}</span
										>
										{#if f.reasonChip}<span class="text-slate-500"> · {f.reasonChip}</span>{/if}
										<span class="text-slate-600"> · {fmtTime(f.createdAt)}</span>
									</div>
									{#if f.feedbackText}<div class="whitespace-pre-wrap text-slate-300">{f.feedbackText}</div>{/if}
								</div>
							{/each}
						</div>
					</section>
				{/if}
			</div>

			<!-- RIGHT: rubric (resizable, shared with match review) -->
			<QaRubricPanel existingReview={r.existingReview} {form} />
		</div>
	</form>
</div>
