<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	type Woman = {
		id: string;
		first_name: string;
		age: number | null;
		city: string | null;
		is_seed: boolean;
		token: string | null;
	};

	// Local copy of the women list so a freshly-generated token shows immediately.
	let women = $state<Woman[]>(data.women.map((w: Woman) => ({ ...w })));

	let selectedId = $state('');
	let generating = $state(false);
	let genError = $state<string | null>(null);
	let copiedId = $state<string | null>(null);

	let origin = $derived(typeof window !== 'undefined' ? window.location.origin : '');

	function linkFor(token: string | null): string {
		if (!token) return '';
		return `${origin}/beta/${token}`;
	}

	async function generate() {
		if (!selectedId || generating) return;
		generating = true;
		genError = null;
		try {
			const res = await fetch('/admin/beta/link', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ referrerId: selectedId })
			});
			const body = await res.json().catch(() => ({}));
			if (!res.ok) {
				genError = body?.error ?? `Failed (${res.status})`;
				return;
			}
			women = women.map((w) => (w.id === selectedId ? { ...w, token: body.token } : w));
		} catch (err) {
			genError = err instanceof Error ? err.message : 'Network error';
		} finally {
			generating = false;
		}
	}

	async function copy(id: string, token: string | null) {
		if (!token) return;
		try {
			await navigator.clipboard.writeText(linkFor(token));
			copiedId = id;
			setTimeout(() => {
				if (copiedId === id) copiedId = null;
			}, 1500);
		} catch {
			// Clipboard blocked — no-op; the link is visible for manual copy.
		}
	}

	function fmtDate(iso: string | null): string {
		if (!iso) return '—';
		return new Date(iso).toLocaleString(undefined, {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	let withLink = $derived(women.filter((w) => w.token));
	let selectedWoman = $derived(women.find((w) => w.id === selectedId) ?? null);
</script>

<div class="min-h-screen bg-[#0b1120] px-6 py-8 text-slate-100">
	<div class="mx-auto max-w-5xl">
	<h1 class="text-xl font-bold text-white">Beta Invites</h1>
	<p class="mt-1 text-sm text-slate-400">
		Generate a shareable link for a female user. Anyone who opens it and submits their email is
		added to the beta list, and is instantly matched with her once they finish onboarding and enter
		the matchmaker pool.
	</p>

	<!-- Generate -->
	<section class="mt-6 rounded-lg border border-white/[0.08] bg-[#0b1120] p-5">
		<h2 class="text-sm font-semibold text-white">Generate a link</h2>
		<div class="mt-3 flex flex-wrap items-center gap-3">
			<select
				bind:value={selectedId}
				class="min-w-[220px] rounded border border-white/[0.1] bg-[#111a2e] px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-500"
			>
				<option value="">Select a female user…</option>
				{#each women as w}
					<option value={w.id}>
						{w.first_name}{w.age ? `, ${w.age}` : ''}{w.city ? ` · ${w.city}` : ''}{w.is_seed
							? ' (seed)'
							: ''}{w.token ? ' ✓ has link' : ''}
					</option>
				{/each}
			</select>

			<button
				onclick={generate}
				disabled={!selectedId || generating}
				class="rounded bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-40"
			>
				{generating ? 'Generating…' : selectedWoman?.token ? 'Show link' : 'Generate link'}
			</button>
		</div>

		{#if genError}
			<p class="mt-3 text-sm text-red-400">{genError}</p>
		{/if}

		{#if selectedWoman?.token}
			<div class="mt-4 flex flex-wrap items-center gap-2">
				<code class="rounded border border-white/[0.1] bg-black/40 px-3 py-2 text-xs text-emerald-300">
					{linkFor(selectedWoman.token)}
				</code>
				<button
					onclick={() => copy(selectedWoman!.id, selectedWoman!.token)}
					class="rounded border border-white/[0.1] px-3 py-2 text-xs text-slate-300 hover:text-white"
				>
					{copiedId === selectedWoman.id ? 'Copied!' : 'Copy'}
				</button>
			</div>
		{/if}
	</section>

	<!-- Existing links -->
	<section class="mt-8">
		<h2 class="text-sm font-semibold text-white">Active links ({withLink.length})</h2>
		{#if withLink.length === 0}
			<p class="mt-2 text-sm text-slate-500">No links generated yet.</p>
		{:else}
			<div class="mt-3 overflow-x-auto rounded-lg border border-white/[0.08]">
				<table class="w-full text-left text-sm">
					<thead class="bg-white/[0.03] text-xs uppercase tracking-wide text-slate-400">
						<tr>
							<th class="px-4 py-2.5">Female user</th>
							<th class="px-4 py-2.5">Link</th>
							<th class="px-4 py-2.5"></th>
						</tr>
					</thead>
					<tbody class="divide-y divide-white/[0.05]">
						{#each withLink as w}
							<tr>
								<td class="px-4 py-2.5 text-slate-200">
									{w.first_name}{w.age ? `, ${w.age}` : ''}
									{#if w.is_seed}<span class="ml-1 text-xs text-slate-500">seed</span>{/if}
								</td>
								<td class="px-4 py-2.5">
									<code class="text-xs text-emerald-300">{linkFor(w.token)}</code>
								</td>
								<td class="px-4 py-2.5 text-right">
									<button
										onclick={() => copy(w.id, w.token)}
										class="rounded border border-white/[0.1] px-2.5 py-1 text-xs text-slate-300 hover:text-white"
									>
										{copiedId === w.id ? 'Copied!' : 'Copy'}
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</section>

	<!-- Signups -->
	<section class="mt-8">
		<h2 class="text-sm font-semibold text-white">Collected emails ({data.signups.length})</h2>
		{#if data.signups.length === 0}
			<p class="mt-2 text-sm text-slate-500">No one has signed up through a link yet.</p>
		{:else}
			<div class="mt-3 overflow-x-auto rounded-lg border border-white/[0.08]">
				<table class="w-full text-left text-sm">
					<thead class="bg-white/[0.03] text-xs uppercase tracking-wide text-slate-400">
						<tr>
							<th class="px-4 py-2.5">Email</th>
							<th class="px-4 py-2.5">Referred by</th>
							<th class="px-4 py-2.5">Status</th>
							<th class="px-4 py-2.5">Submitted</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-white/[0.05]">
						{#each data.signups as s}
							<tr>
								<td class="px-4 py-2.5 text-slate-200">{s.email}</td>
								<td class="px-4 py-2.5 text-slate-300">{s.referrerName}</td>
								<td class="px-4 py-2.5">
									{#if s.status === 'matched'}
										<span class="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-400">
											matched{s.matchedName ? ` · ${s.matchedName}` : ''}
										</span>
									{:else}
										<span class="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-400">
											pending
										</span>
									{/if}
								</td>
								<td class="px-4 py-2.5 text-slate-400">{fmtDate(s.created_at)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</section>
	</div>
</div>
