<script lang="ts">
	import Icon from './Icon.svelte';
	import { page } from '$app/stores';

	type IdentityVerdict = 'yes' | 'partial' | 'no' | '';
	type Review = {
		reviewer: string;
		identity_preserved: string | null;
		has_artifacts: boolean | null;
		quality: number | null;
		note: string | null;
		updated_at: string | null;
	};
	type Photo = {
		userId: string | null;
		userName: string;
		gender: string | null;
		archetype: string | null;
		url: string;
		role: string;
		scene: string;
		source: 'existing' | 'generated';
		updatedAt: string | null;
		reviews: Review[];
	};
	type Draft = { identity: IdentityVerdict; artifacts: boolean; quality: number; note: string };

	let reviewerName = $derived(($page.data as { reviewer?: string | null }).reviewer ?? null);

	let mode = $state<'existing' | 'generate'>('existing');

	// ── Existing photos ───────────────────────────────────────────────────────
	let photos = $state<Photo[]>([]);
	let loading = $state(false);
	let loadErr = $state('');
	let loaded = $state(false);
	let filter = $state<'all' | 'untagged' | 'tagged'>('all');
	let search = $state('');

	// ── Generate bench ────────────────────────────────────────────────────────
	let refs = $state<string[]>([]);
	let archetype = $state('casual_man');
	let genCount = $state(3);
	let generating = $state(false);
	let genErr = $state('');
	let generated = $state<Photo[]>([]);

	const ARCHETYPES = [
		{ id: 'casual_man', label: 'Casual man' },
		{ id: 'marriage_minded_man', label: 'Marriage-minded man' }
	];

	// ── Per-photo tag draft + save state (keyed by URL) ─────────────────────────
	let drafts = $state<Record<string, Draft>>({});
	let saving = $state<Record<string, boolean>>({});
	let savedAt = $state<Record<string, string>>({});
	let saveErr = $state<Record<string, string>>({});

	function myReview(p: Photo): Review | undefined {
		return p.reviews.find((r) => r.reviewer === (reviewerName ?? 'anonymous'));
	}

	function initDrafts(list: Photo[]) {
		for (const p of list) {
			if (drafts[p.url]) continue;
			const mine = myReview(p);
			drafts[p.url] = {
				identity: (mine?.identity_preserved as IdentityVerdict) ?? '',
				artifacts: mine?.has_artifacts ?? false,
				quality: mine?.quality ?? 0,
				note: mine?.note ?? ''
			};
		}
	}

	async function load() {
		loading = true;
		loadErr = '';
		try {
			const res = await fetch('/admin/photos/api/photos');
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'failed to load');
			photos = data.photos as Photo[];
			initDrafts(photos);
			loaded = true;
		} catch (e) {
			loadErr = e instanceof Error ? e.message : 'failed to load';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		if (mode === 'existing' && !loaded && !loading) load();
	});

	let filtered = $derived(
		photos.filter((p) => {
			const tagged = !!myReview(p);
			if (filter === 'tagged' && !tagged) return false;
			if (filter === 'untagged' && tagged) return false;
			if (search.trim()) {
				const q = search.trim().toLowerCase();
				if (!p.userName.toLowerCase().includes(q) && !(p.role || '').toLowerCase().includes(q))
					return false;
			}
			return true;
		})
	);
	let taggedCount = $derived(photos.filter((p) => !!myReview(p)).length);

	function canSave(p: Photo): boolean {
		const d = drafts[p.url];
		if (!d) return false;
		return !!d.identity || d.artifacts || d.quality > 0 || !!d.note.trim();
	}

	async function save(p: Photo) {
		const d = drafts[p.url];
		if (!d) return;
		saving[p.url] = true;
		saveErr[p.url] = '';
		try {
			const res = await fetch('/admin/photos/api/photos', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					photoUrl: p.url,
					userId: p.userId,
					role: p.role,
					scene: p.scene,
					source: p.source,
					identityPreserved: d.identity || null,
					hasArtifacts: d.artifacts,
					quality: d.quality || null,
					note: d.note
				})
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'save failed');
			const review = data.review as Review;
			p.reviews = [...p.reviews.filter((r) => r.reviewer !== review.reviewer), review];
			savedAt[p.url] = new Date().toLocaleTimeString();
		} catch (e) {
			saveErr[p.url] = e instanceof Error ? e.message : 'save failed';
		} finally {
			saving[p.url] = false;
		}
	}

	// ── Generate ────────────────────────────────────────────────────────────────
	function onFiles(e: Event) {
		const input = e.target as HTMLInputElement;
		const files = Array.from(input.files ?? []);
		for (const f of files) {
			const reader = new FileReader();
			reader.onload = () => {
				const url = String(reader.result || '');
				if (url.startsWith('data:image/')) refs = [...refs, url];
			};
			reader.readAsDataURL(f);
		}
		input.value = '';
	}
	function removeRef(i: number) {
		refs = refs.filter((_, idx) => idx !== i);
	}

	async function generate() {
		if (refs.length === 0) {
			genErr = 'Upload at least one reference photo (with a clear face).';
			return;
		}
		generating = true;
		genErr = '';
		try {
			const res = await fetch('/api/photo-enhance/generate', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ referenceDataUrls: refs, archetype, count: genCount })
			});
			const data = await res.json();
			if (!res.ok || data.error) {
				throw new Error(data.message || data.error || 'generation failed');
			}
			const fresh: Photo[] = (data.photos ?? []).map(
				(ph: { url: string; role?: string; scene?: string }) => ({
					userId: null,
					userName: '(generate bench)',
					gender: 'man',
					archetype,
					url: ph.url,
					role: ph.role ?? '',
					scene: ph.scene ?? '',
					source: 'generated' as const,
					updatedAt: null,
					reviews: []
				})
			);
			initDrafts(fresh);
			generated = [...fresh, ...generated];
			if ((data.errors ?? []).length) {
				genErr = `Completed with ${data.errors.length} provider error(s): ${data.errors.join('; ')}`;
			}
		} catch (e) {
			genErr = e instanceof Error ? e.message : 'generation failed';
		} finally {
			generating = false;
		}
	}
</script>

{#snippet stars(p: Photo)}
	<div class="pr-stars" role="radiogroup" aria-label="quality">
		{#each [1, 2, 3, 4, 5] as n}
			<button
				type="button"
				class="pr-star {drafts[p.url] && drafts[p.url].quality >= n ? 'on' : ''}"
				aria-label="{n} of 5"
				onclick={() => (drafts[p.url].quality = drafts[p.url].quality === n ? 0 : n)}>★</button
			>
		{/each}
	</div>
{/snippet}

{#snippet card(p: Photo)}
	{@const mine = myReview(p)}
	<div class="pr-card">
		<div class="pr-thumb">
			<img src={p.url} alt="{p.userName} · {p.role}" loading="lazy" />
			{#if mine}<span class="pr-tagged" title="you tagged this"><Icon name="check" size={12} /></span>{/if}
		</div>
		<div class="pr-body">
			<div class="pr-meta">
				<span class="pr-name">{p.userName}</span>
				{#if p.role}<span class="pr-chip">{p.role}</span>{/if}
				{#if p.scene}<span class="pr-chip ghost">{p.scene}</span>{/if}
			</div>

			<div class="pr-field">
				<span class="pr-flabel">Identity preserved</span>
				<div class="pr-seg">
					{#each [{ v: 'yes', t: 'Yes' }, { v: 'partial', t: 'Partial' }, { v: 'no', t: 'No' }] as o}
						<button
							type="button"
							class="{drafts[p.url]?.identity === o.v ? 'on ' + o.v : ''}"
							onclick={() =>
								(drafts[p.url].identity =
									drafts[p.url].identity === (o.v as IdentityVerdict) ? '' : (o.v as IdentityVerdict))}
							>{o.t}</button
						>
					{/each}
				</div>
			</div>

			<div class="pr-row">
				<label class="pr-check">
					<input type="checkbox" bind:checked={drafts[p.url].artifacts} />
					<span>Artifacts / distortion</span>
				</label>
				<div class="pr-field pr-qual">
					<span class="pr-flabel">Quality</span>
					{@render stars(p)}
				</div>
			</div>

			<textarea
				class="pr-note"
				rows="2"
				placeholder="Note (optional)…"
				bind:value={drafts[p.url].note}
			></textarea>

			<div class="pr-actions">
				<button class="pr-save" disabled={!canSave(p) || saving[p.url]} onclick={() => save(p)}>
					{#if saving[p.url]}<Icon name="clock" size={13} spin /> Saving…{:else}<Icon
							name="check"
							size={13}
						/> {mine ? 'Update tag' : 'Save tag'}{/if}
				</button>
				{#if savedAt[p.url]}<span class="pr-saved">saved {savedAt[p.url]}</span>
				{:else if mine?.updated_at}<span class="pr-saved muted">tagged earlier</span>{/if}
				{#if saveErr[p.url]}<span class="pr-err">{saveErr[p.url]}</span>{/if}
			</div>

			{#if p.reviews.length > (mine ? 1 : 0)}
				<div class="pr-others">{p.reviews.length} review{p.reviews.length === 1 ? '' : 's'} total</div>
			{/if}
		</div>
	</div>
{/snippet}

<div class="pr-root">
	<div class="pr-head">
		<div>
			<div class="eyebrow" style="margin-bottom:6px">AI photo review · human tagging</div>
			<p class="pr-sub">
				Tag AI-generated profile photos for <strong>identity fidelity</strong>, artifacts and overall
				quality. Browse everything already generated, or generate fresh on the bench and tag it.
				{#if reviewerName}<span class="pr-rev">Signed in as <strong>{reviewerName}</strong>.</span>{/if}
			</p>
		</div>
		<div class="pr-modes">
			<button class="pr-mode {mode === 'existing' ? 'on' : ''}" onclick={() => (mode = 'existing')}>
				<Icon name="eye" size={14} /> Existing
			</button>
			<button class="pr-mode {mode === 'generate' ? 'on' : ''}" onclick={() => (mode = 'generate')}>
				<Icon name="spark" size={14} /> Generate
			</button>
		</div>
	</div>

	{#if mode === 'existing'}
		<div class="card card-pad">
			<div class="pr-toolbar">
				<div class="pr-search">
					<Icon name="search" size={14} color="var(--text-3)" />
					<input placeholder="Search by name or role…" bind:value={search} />
				</div>
				<div class="pr-seg small">
					<button class={filter === 'all' ? 'on' : ''} onclick={() => (filter = 'all')}>All</button>
					<button class={filter === 'untagged' ? 'on' : ''} onclick={() => (filter = 'untagged')}
						>Untagged</button
					>
					<button class={filter === 'tagged' ? 'on' : ''} onclick={() => (filter = 'tagged')}
						>Tagged</button
					>
				</div>
				<button class="ghost-btn" onclick={load} disabled={loading}>
					{#if loading}<Icon name="clock" size={13} spin /> Loading…{:else}<Icon
							name="route"
							size={13}
						/> Refresh{/if}
				</button>
				<span class="pr-count">{taggedCount}/{photos.length} tagged by you</span>
			</div>

			{#if loadErr}
				<div class="errbox" style="margin-top:14px"><Icon name="alert" size={16} /><span>{loadErr}</span></div>
			{/if}
		</div>

		{#if loading && photos.length === 0}
			<div class="pr-empty"><Icon name="clock" size={18} spin /> Loading generated photos…</div>
		{:else if !loading && photos.length === 0}
			<div class="pr-empty"><Icon name="eye" size={18} /> No AI-generated photos found yet.</div>
		{:else if filtered.length === 0}
			<div class="pr-empty"><Icon name="search" size={18} /> No photos match this filter.</div>
		{:else}
			<div class="pr-grid">
				{#each filtered as p (p.url)}
					{@render card(p)}
				{/each}
			</div>
		{/if}
	{:else}
		<div class="card card-pad">
			<div class="eyebrow" style="margin-bottom:12px">Generate on the bench</div>
			<div class="pr-gen">
				<div class="pr-uploader">
					<label class="pr-uplabel">
						<Icon name="spark" size={16} color="var(--emerald)" />
						<span>Upload reference photo(s)</span>
						<input type="file" accept="image/*" multiple onchange={onFiles} hidden />
					</label>
					{#if refs.length}
						<div class="pr-refs">
							{#each refs as r, i}
								<div class="pr-ref">
									<img src={r} alt="reference {i + 1}" />
									<button class="pr-refx" aria-label="remove" onclick={() => removeRef(i)}
										><Icon name="x" size={12} /></button
									>
								</div>
							{/each}
						</div>
					{/if}
				</div>
				<div class="pr-genctrls">
					<div class="pr-field">
						<span class="pr-flabel">Archetype</span>
						<select bind:value={archetype}>
							{#each ARCHETYPES as a}<option value={a.id}>{a.label}</option>{/each}
						</select>
					</div>
					<div class="pr-field">
						<span class="pr-flabel">Count</span>
						<select bind:value={genCount}>
							{#each [1, 2, 3] as n}<option value={n}>{n}</option>{/each}
						</select>
					</div>
					<button class="pr-save gen" disabled={generating || refs.length === 0} onclick={generate}>
						{#if generating}<Icon name="clock" size={14} spin /> Generating…{:else}<Icon
								name="zap"
								size={14}
							/> Generate{/if}
					</button>
				</div>
			</div>
			{#if genErr}
				<div class="errbox" style="margin-top:14px"><Icon name="alert" size={16} /><span>{genErr}</span></div>
			{/if}
		</div>

		{#if generated.length}
			<div class="pr-grid">
				{#each generated as p (p.url)}
					{@render card(p)}
				{/each}
			</div>
		{:else}
			<div class="pr-empty">
				<Icon name="spark" size={18} /> Generated photos appear here for tagging.
			</div>
		{/if}
	{/if}
</div>

<style>
	.pr-root {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.pr-head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 16px;
		flex-wrap: wrap;
	}
	.pr-sub {
		font-size: 13px;
		color: var(--text-3);
		max-width: 640px;
		line-height: 1.5;
		margin: 0;
	}
	.pr-sub strong {
		color: var(--text-2);
	}
	.pr-rev {
		display: inline-block;
		margin-left: 4px;
		color: var(--text-3);
	}
	.pr-modes {
		display: flex;
		gap: 6px;
	}
	.pr-mode {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 7px 12px;
		border-radius: 9px;
		border: 1px solid rgba(255, 255, 255, 0.1);
		background: var(--bg-2);
		color: var(--text-3);
		font-size: 12.5px;
		font-weight: 500;
		cursor: pointer;
	}
	.pr-mode.on {
		border-color: var(--emerald);
		color: var(--emerald);
		background: color-mix(in srgb, var(--emerald) 12%, transparent);
	}

	.pr-toolbar {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
	}
	.pr-search {
		display: flex;
		align-items: center;
		gap: 7px;
		background: var(--bg-2);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 9px;
		padding: 7px 11px;
		flex: 1;
		min-width: 180px;
	}
	.pr-search input {
		background: none;
		border: none;
		outline: none;
		color: var(--text-2);
		font-size: 13px;
		width: 100%;
	}
	.pr-count {
		font-size: 11.5px;
		color: var(--text-3);
		margin-left: auto;
	}

	.pr-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 14px;
	}
	.pr-card {
		background: var(--bg-2);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 14px;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}
	.pr-thumb {
		position: relative;
		aspect-ratio: 4 / 5;
		background: #0b1120;
	}
	.pr-thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.pr-tagged {
		position: absolute;
		top: 8px;
		right: 8px;
		width: 22px;
		height: 22px;
		border-radius: 50%;
		background: var(--emerald);
		color: #04140d;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.pr-body {
		padding: 12px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.pr-meta {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
	}
	.pr-name {
		font-size: 13px;
		font-weight: 600;
		color: var(--text-2);
	}
	.pr-chip {
		font-size: 10.5px;
		padding: 2px 7px;
		border-radius: 999px;
		background: color-mix(in srgb, var(--emerald) 15%, transparent);
		color: var(--emerald);
		text-transform: capitalize;
	}
	.pr-chip.ghost {
		background: rgba(255, 255, 255, 0.06);
		color: var(--text-3);
	}
	.pr-field {
		display: flex;
		flex-direction: column;
		gap: 5px;
	}
	.pr-flabel {
		font-size: 10.5px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-3);
	}
	.pr-seg {
		display: inline-flex;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 8px;
		overflow: hidden;
	}
	.pr-seg button {
		flex: 1;
		padding: 6px 10px;
		background: var(--bg-2);
		border: none;
		border-right: 1px solid rgba(255, 255, 255, 0.08);
		color: var(--text-3);
		font-size: 12px;
		cursor: pointer;
	}
	.pr-seg button:last-child {
		border-right: none;
	}
	.pr-seg.small {
		align-self: center;
	}
	.pr-seg button.on {
		color: var(--text-2);
		background: rgba(255, 255, 255, 0.08);
	}
	.pr-seg button.on.yes {
		color: var(--emerald);
		background: color-mix(in srgb, var(--emerald) 16%, transparent);
	}
	.pr-seg button.on.partial {
		color: var(--amber);
		background: color-mix(in srgb, var(--amber) 16%, transparent);
	}
	.pr-seg button.on.no {
		color: var(--rose);
		background: color-mix(in srgb, var(--rose) 16%, transparent);
	}
	.pr-row {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		gap: 10px;
	}
	.pr-check {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		color: var(--text-3);
		cursor: pointer;
	}
	.pr-check input {
		accent-color: var(--rose);
	}
	.pr-qual {
		align-items: flex-end;
	}
	.pr-stars {
		display: flex;
		gap: 2px;
	}
	.pr-star {
		background: none;
		border: none;
		font-size: 17px;
		line-height: 1;
		color: rgba(255, 255, 255, 0.18);
		cursor: pointer;
		padding: 0;
	}
	.pr-star.on {
		color: var(--amber);
	}
	.pr-note {
		background: var(--bg-2);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 8px;
		padding: 7px 9px;
		color: var(--text-2);
		font-size: 12.5px;
		resize: vertical;
		font-family: inherit;
	}
	.pr-actions {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.pr-save {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 7px 13px;
		border-radius: 9px;
		border: none;
		background: var(--emerald);
		color: #04140d;
		font-size: 12.5px;
		font-weight: 600;
		cursor: pointer;
	}
	.pr-save:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.pr-save.gen {
		align-self: flex-end;
	}
	.pr-saved {
		font-size: 11px;
		color: var(--emerald);
	}
	.pr-saved.muted {
		color: var(--text-3);
	}
	.pr-err {
		font-size: 11px;
		color: var(--rose);
	}
	.pr-others {
		font-size: 10.5px;
		color: var(--text-3);
	}
	.pr-empty {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 40px;
		color: var(--text-3);
		font-size: 13px;
		border: 1px dashed rgba(255, 255, 255, 0.12);
		border-radius: 14px;
	}

	/* Generate bench */
	.pr-gen {
		display: flex;
		gap: 18px;
		flex-wrap: wrap;
		align-items: flex-start;
	}
	.pr-uploader {
		flex: 1;
		min-width: 220px;
	}
	.pr-uplabel {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 10px 14px;
		border: 1px dashed rgba(255, 255, 255, 0.2);
		border-radius: 10px;
		color: var(--text-2);
		font-size: 13px;
		cursor: pointer;
	}
	.pr-refs {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
		margin-top: 10px;
	}
	.pr-ref {
		position: relative;
		width: 64px;
		height: 80px;
		border-radius: 8px;
		overflow: hidden;
		border: 1px solid rgba(255, 255, 255, 0.1);
	}
	.pr-ref img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.pr-refx {
		position: absolute;
		top: 3px;
		right: 3px;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		border: none;
		background: rgba(0, 0, 0, 0.6);
		color: #fff;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
	}
	.pr-genctrls {
		display: flex;
		gap: 12px;
		align-items: flex-end;
	}
	.pr-genctrls select {
		background: var(--bg-2);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 8px;
		padding: 7px 10px;
		color: var(--text-2);
		font-size: 13px;
	}
</style>
