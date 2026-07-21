<script lang="ts">
	/**
	 * Gemini image playground — free-form prompt testing.
	 *
	 * Nothing here is persisted: no DB writes, and the transcript lives only in
	 * this tab's memory. Generated images are megabytes of base64, so they'd blow
	 * sessionStorage's ~5 MB quota instantly — a reload deliberately clears
	 * everything. Download the ones worth keeping.
	 */

	type Turn = {
		id: string;
		prompt: string;
		model: string;
		temperature: number;
		refs: string[];
		state: 'pending' | 'done' | 'error';
		images: string[];
		text: string | null;
		finishReason: string | null;
		raw: unknown;
		ms: number | null;
		error: string | null;
	};

	const MODELS = [
		{ id: 'gemini-2.5-flash-image', label: 'Gemini 2.5 Flash Image' },
		{ id: 'gemini-2.0-flash-preview-image-generation', label: 'Gemini 2.0 Flash (preview)' }
	];

	let prompt = $state('');
	let model = $state(MODELS[0].id);
	let temperature = $state(1);
	let refs = $state<string[]>([]);
	let refError = $state<string | null>(null);
	let busy = $state(false);
	let turns = $state<Turn[]>([]);
	let showRawFor = $state<string | null>(null);
	let dragging = $state(false);

	let fileInput: HTMLInputElement | null = $state(null);

	async function addFiles(files: FileList | null) {
		if (!files) return;
		refError = null;
		const room = 6 - refs.length;
		if (room <= 0) {
			refError = 'Maximum 6 reference images.';
			return;
		}
		for (const file of Array.from(files).slice(0, room)) {
			if (!file.type.startsWith('image/')) {
				refError = `${file.name} is not an image.`;
				continue;
			}
			if (file.size > 6 * 1024 * 1024) {
				refError = `${file.name} is over 6 MB.`;
				continue;
			}
			const dataUrl = await new Promise<string>((resolve, reject) => {
				const r = new FileReader();
				r.onload = () => resolve(r.result as string);
				r.onerror = () => reject(r.error);
				r.readAsDataURL(file);
			});
			refs = [...refs, dataUrl];
		}
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		dragging = false;
		void addFiles(e.dataTransfer?.files ?? null);
	}

	function removeRef(i: number) {
		refs = refs.filter((_, idx) => idx !== i);
	}

	async function generate() {
		const text = prompt.trim();
		if (!text || busy) return;

		const turn: Turn = {
			id: crypto.randomUUID(),
			prompt: text,
			model,
			temperature,
			refs: [...refs],
			state: 'pending',
			images: [],
			text: null,
			finishReason: null,
			raw: null,
			ms: null,
			error: null
		};
		turns = [...turns, turn];
		busy = true;

		try {
			const res = await fetch('/admin/gemini/api', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ prompt: text, model, temperature, refs: turn.refs })
			});
			const body = await res.json().catch(() => ({}));
			const done: Partial<Turn> = res.ok
				? {
						state: 'done',
						images: body.images ?? [],
						text: body.text ?? null,
						finishReason: body.finishReason ?? null,
						raw: body.raw ?? null,
						ms: body.ms ?? null
					}
				: { state: 'error', error: body?.error ?? `Failed (${res.status})`, ms: body?.ms ?? null };
			turns = turns.map((t) => (t.id === turn.id ? { ...t, ...done } : t));
		} catch (e) {
			const msg = e instanceof Error ? e.message : 'request failed';
			turns = turns.map((t) => (t.id === turn.id ? { ...t, state: 'error', error: msg } : t));
		} finally {
			busy = false;
		}
	}

	function download(dataUrl: string, turnIndex: number, imgIndex: number) {
		const ext = /^data:image\/([a-z]+)/.exec(dataUrl)?.[1] ?? 'png';
		const a = document.createElement('a');
		a.href = dataUrl;
		a.download = `gemini-${turnIndex + 1}-${imgIndex + 1}.${ext === 'jpeg' ? 'jpg' : ext}`;
		document.body.appendChild(a);
		a.click();
		a.remove();
	}

	function reusePrompt(t: Turn) {
		prompt = t.prompt;
		model = t.model;
		temperature = t.temperature;
		refs = [...t.refs];
		window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
	}

	function clearAll() {
		if (turns.length && !confirm('Clear the whole session? Undownloaded images are lost.')) return;
		turns = [];
		showRawFor = null;
	}

	function onKeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
			e.preventDefault();
			void generate();
		}
	}
</script>

<svelte:head><title>Gemini Playground · PDC Admin</title></svelte:head>

<div class="mx-auto max-w-4xl px-6 py-6">
	<div class="mb-4 flex items-start justify-between gap-4">
		<div>
			<h1 class="text-lg font-bold text-white">Gemini Image Playground</h1>
			<p class="mt-1 text-xs text-slate-400">
				Your prompt is sent to Gemini exactly as typed — none of the production men's-photo
				prompt wrapping is applied. Nothing is saved to the database; this session is cleared on
				reload, so download anything worth keeping.
			</p>
		</div>
		{#if turns.length}
			<button
				onclick={clearAll}
				class="shrink-0 rounded border border-white/[0.1] px-2 py-1 text-xs text-slate-400 hover:text-slate-200"
				>Clear session</button
			>
		{/if}
	</div>

	<!-- Transcript -->
	<div class="space-y-4">
		{#each turns as t, ti (t.id)}
			<div class="rounded-lg border border-white/[0.06] bg-[#0b1120] p-4">
				<div class="flex items-start justify-between gap-3">
					<p class="whitespace-pre-wrap text-sm text-slate-200">{t.prompt}</p>
					<button
						onclick={() => reusePrompt(t)}
						class="shrink-0 rounded border border-white/[0.1] px-2 py-1 text-xs text-slate-400 hover:text-slate-200"
						title="Load this prompt back into the composer">Reuse</button
					>
				</div>

				<div class="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
					<span class="rounded bg-white/[0.05] px-1.5 py-0.5">{t.model}</span>
					<span class="rounded bg-white/[0.05] px-1.5 py-0.5">temp {t.temperature}</span>
					{#if t.refs.length}
						<span class="rounded bg-white/[0.05] px-1.5 py-0.5">{t.refs.length} ref</span>
					{/if}
					{#if t.ms !== null}<span>{(t.ms / 1000).toFixed(1)}s</span>{/if}
					{#if t.finishReason && t.finishReason !== 'STOP'}
						<span class="text-amber-400">{t.finishReason}</span>
					{/if}
				</div>

				{#if t.refs.length}
					<div class="mt-2 flex flex-wrap gap-1.5">
						{#each t.refs as r}
							<img src={r} alt="reference" class="h-10 w-10 rounded object-cover opacity-60" />
						{/each}
					</div>
				{/if}

				<div class="mt-3">
					{#if t.state === 'pending'}
						<div class="flex h-32 items-center justify-center rounded bg-white/[0.03] text-xs text-slate-500">
							Generating…
						</div>
					{:else if t.state === 'error'}
						<p class="rounded bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{t.error}</p>
					{:else}
						{#if t.text}
							<p class="mb-2 whitespace-pre-wrap text-xs text-slate-400">{t.text}</p>
						{/if}
						{#if t.images.length}
							<div class="grid gap-3 {t.images.length > 1 ? 'sm:grid-cols-2' : ''}">
								{#each t.images as img, ii}
									<div class="group relative">
										<img src={img} alt="generated" class="w-full rounded" />
										<button
											onclick={() => download(img, ti, ii)}
											class="absolute right-2 top-2 rounded bg-black/70 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
											>Download</button
										>
									</div>
								{/each}
							</div>
						{:else}
							<p class="text-xs text-slate-500">No image returned.</p>
						{/if}
						<button
							onclick={() => (showRawFor = showRawFor === t.id ? null : t.id)}
							class="mt-2 text-[11px] text-slate-500 hover:text-slate-300"
							>{showRawFor === t.id ? 'Hide' : 'Show'} raw response</button
						>
						{#if showRawFor === t.id}
							<pre class="mt-2 max-h-64 overflow-auto rounded bg-black/40 p-3 text-[11px] text-slate-400">{JSON.stringify(
									t.raw,
									null,
									2
								)}</pre>
						{/if}
					{/if}
				</div>
			</div>
		{/each}
	</div>

	<!-- Composer -->
	<div class="mt-4 rounded-lg border border-white/[0.06] bg-[#0b1120] p-4">
		{#if refs.length}
			<div class="mb-3 flex flex-wrap gap-2">
				{#each refs as r, i}
					<div class="relative">
						<img src={r} alt="reference" class="h-16 w-16 rounded object-cover" />
						<button
							onclick={() => removeRef(i)}
							class="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-700 text-xs text-white hover:bg-rose-600"
							aria-label="Remove reference">×</button
						>
					</div>
				{/each}
			</div>
		{/if}

		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			ondragover={(e) => {
				e.preventDefault();
				dragging = true;
			}}
			ondragleave={() => (dragging = false)}
			ondrop={onDrop}
			class="rounded border {dragging ? 'border-emerald-500/60' : 'border-transparent'}"
		>
			<textarea
				bind:value={prompt}
				onkeydown={onKeydown}
				rows="4"
				placeholder="Describe the image to generate. Drop reference images anywhere in this box. ⌘/Ctrl+Enter to run."
				class="w-full resize-y rounded bg-white/[0.04] px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
			></textarea>
		</div>

		{#if refError}<p class="mt-1 text-xs text-rose-400">{refError}</p>{/if}

		<div class="mt-3 flex flex-wrap items-center gap-3">
			<select
				bind:value={model}
				class="rounded bg-white/[0.04] px-2 py-1.5 text-xs text-slate-300 focus:outline-none"
			>
				{#each MODELS as m}<option value={m.id}>{m.label}</option>{/each}
			</select>

			<label class="flex items-center gap-2 text-xs text-slate-400">
				temp
				<input
					type="range"
					min="0"
					max="2"
					step="0.1"
					bind:value={temperature}
					class="w-24 accent-emerald-500"
				/>
				<span class="w-6 text-slate-300">{temperature}</span>
			</label>

			<input
				bind:this={fileInput}
				type="file"
				accept="image/*"
				multiple
				class="hidden"
				onchange={(e) => {
					void addFiles(e.currentTarget.files);
					e.currentTarget.value = '';
				}}
			/>
			<button
				onclick={() => fileInput?.click()}
				class="rounded border border-white/[0.1] px-2 py-1.5 text-xs text-slate-400 hover:text-slate-200"
				>Add image</button
			>

			<button
				onclick={generate}
				disabled={busy || !prompt.trim()}
				class="ml-auto rounded bg-emerald-500/20 px-4 py-1.5 text-sm font-medium text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-40"
				>{busy ? 'Generating…' : 'Generate'}</button
			>
		</div>
	</div>
</div>
