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

	// Render the markdown the AI advisors emit (headings, bold, lists, rules) so QA
	// reviewers see formatted prose instead of raw "##"/"**" syntax. Content is
	// HTML-escaped first; only our own tags are introduced afterwards.
	function escapeHtml(s: string): string {
		return s
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;');
	}

	function renderInline(text: string): string {
		return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
	}

	function renderMarkdown(raw: string): string {
		const text = escapeHtml(raw ?? '');
		const blocks = text.split(/\n{2,}/);
		return blocks
			.map((block) => {
				const trimmed = block.trim();
				if (!trimmed) return '';
				// Horizontal rule
				if (/^---+$/.test(trimmed)) return '<hr>';
				// Headings (###, ##, #)
				const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
				if (heading) {
					const level = Math.min(heading[1].length + 1, 6); // shift down so # → h2
					return `<h${level}>${renderInline(heading[2])}</h${level}>`;
				}
				// Bullet / dash lists. Any non-bullet lines before the first bullet
				// (e.g. a "**What's next:**" label) render as a lead-in paragraph.
				if (/^[-•*]\s+/m.test(trimmed)) {
					const lines = trimmed.split('\n').filter((l) => l.trim());
					const lead: string[] = [];
					const items: string[] = [];
					for (const l of lines) {
						if (/^[-•*]\s+/.test(l)) items.push(`<li>${renderInline(l.replace(/^[-•*]\s+/, ''))}</li>`);
						else if (!items.length) lead.push(renderInline(l));
						else items.push(`<li>${renderInline(l)}</li>`);
					}
					const leadHtml = lead.length ? `<p>${lead.join('<br>')}</p>` : '';
					return `${leadHtml}<ul>${items.join('')}</ul>`;
				}
				return `<p>${renderInline(trimmed.replace(/([^\n])\n([^\n])/g, '$1<br>$2'))}</p>`;
			})
			.filter(Boolean)
			.join('');
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
										class="qa-md rounded-2xl border px-3 py-2 text-sm {isAi
											? 'border-indigo-500/30 bg-indigo-500/10 text-slate-100'
											: 'border-white/[0.08] bg-[#0d1522] text-slate-200'}"
									>
										{#if isAi}
											{@html renderMarkdown(m.content)}
										{:else}
											{m.content}
										{/if}
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

<style>
	/* Formatting for the AI advisor markdown (rendered via {@html}). */
	.qa-md :global(h2),
	.qa-md :global(h3),
	.qa-md :global(h4) {
		font-weight: 600;
		color: #fff;
		line-height: 1.3;
		margin: 0.75em 0 0.25em;
	}
	.qa-md :global(h2) { font-size: 1rem; }
	.qa-md :global(h3) { font-size: 0.9375rem; }
	.qa-md :global(h4) { font-size: 0.875rem; }
	.qa-md :global(*:first-child) { margin-top: 0; }
	.qa-md :global(*:last-child) { margin-bottom: 0; }
	.qa-md :global(p) { margin: 0.5em 0; }
	.qa-md :global(strong) { font-weight: 600; color: #fff; }
	.qa-md :global(ul) {
		margin: 0.5em 0;
		padding-left: 1.25em;
		list-style: disc;
	}
	.qa-md :global(li) { margin: 0.15em 0; }
	.qa-md :global(hr) {
		margin: 0.75em 0;
		border: 0;
		border-top: 1px solid rgba(255, 255, 255, 0.12);
	}
</style>
