<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { enhance } from '$app/forms';
	import { invalidate } from '$app/navigation';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let running     = $state(false);
	let runResults  = $state<{ check: string; status: string; ms: number; error: string | null }[]>([]);
	let showResults = $state(false);

	// ── Section toggle ───────────────────────────────────────────────────────
	let activeSection = $state<'server' | 'mobile'>('server');

	// ── Server health filters & pagination ───────────────────────────────────
	let checkFilter  = $state('all');
	let statusFilter = $state('all');
	let serverPage   = $state(1);
	const SERVER_PAGE_SIZE = 50;

	let checkNames = $derived(['all', ...new Set(data.logs.map((l) => l.check_name))]);

	let serverFiltered = $derived(
		data.logs.filter((l) => {
			if (checkFilter !== 'all' && l.check_name !== checkFilter) return false;
			if (statusFilter !== 'all' && l.status !== statusFilter) return false;
			return true;
		})
	);
	let serverTotalPages = $derived(Math.max(1, Math.ceil(serverFiltered.length / SERVER_PAGE_SIZE)));
	let serverPage_      = $derived(Math.min(serverPage, serverTotalPages));
	let serverPaged      = $derived(
		serverFiltered.slice((serverPage_ - 1) * SERVER_PAGE_SIZE, serverPage_ * SERVER_PAGE_SIZE)
	);
	$effect(() => { checkFilter; statusFilter; serverPage = 1; });

	// ── Mobile error filters & pagination ────────────────────────────────────
	let mobileScreenFilter  = $state('all');
	let mobileErrTypeFilter = $state('all');
	let mobilePage          = $state(1);
	const MOBILE_PAGE_SIZE  = 50;

	let mobileScreenNames = $derived(['all', ...new Set(data.mobileErrors.map((e) => e.screen ?? '—'))]);
	let mobileErrTypes    = $derived(['all', ...new Set(data.mobileErrors.map((e) => e.error_type ?? '—'))]);

	let mobileFiltered = $derived(
		data.mobileErrors.filter((e) => {
			if (mobileScreenFilter !== 'all' && (e.screen ?? '—') !== mobileScreenFilter) return false;
			if (mobileErrTypeFilter !== 'all' && (e.error_type ?? '—') !== mobileErrTypeFilter) return false;
			return true;
		})
	);
	let mobileTotalPages = $derived(Math.max(1, Math.ceil(mobileFiltered.length / MOBILE_PAGE_SIZE)));
	let mobilePage_      = $derived(Math.min(mobilePage, mobileTotalPages));
	let mobilePaged      = $derived(
		mobileFiltered.slice((mobilePage_ - 1) * MOBILE_PAGE_SIZE, mobilePage_ * MOBILE_PAGE_SIZE)
	);
	$effect(() => { mobileScreenFilter; mobileErrTypeFilter; mobilePage = 1; });

	// ── Helpers ──────────────────────────────────────────────────────────────
	function statusBadge(s: string) {
		if (s === 'OK')   return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
		if (s === 'FAIL') return 'bg-red-500/20 text-red-400 border-red-500/30';
		return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
	}

	function fmtDate(ts: string) {
		return new Date(ts).toLocaleString('en-GB', {
			day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit'
		});
	}

	function fmtJson(obj: unknown) {
		return JSON.stringify(obj, null, 2);
	}

	// Server stats
	let totalOk       = $derived(data.logs.filter((l) => l.status === 'OK').length);
	let totalFail     = $derived(data.logs.filter((l) => l.status === 'FAIL').length);
	let totalWarn     = $derived(data.logs.filter((l) => l.status === 'WARN').length);
	let overallUptime = $derived(
		data.logs.length > 0 ? Math.round((totalOk / data.logs.length) * 100) : null
	);

	// Mobile stats
	let mobileTotal     = $derived(data.mobileErrors.length);
	let mobileScreenCnt = $derived(new Set(data.mobileErrors.map((e) => e.screen)).size);
	let mobileErrTypeCnt = $derived(new Set(data.mobileErrors.map((e) => e.error_type)).size);
	let mobileUserCnt   = $derived(new Set(data.mobileErrors.map((e) => e.user_id).filter(Boolean)).size);

	// ── Run Now — no full-page reload ────────────────────────────────────────
	async function runNow() {
		running = true;
		showResults = false;
		try {
			const fd = new FormData();
			const res = await fetch('?/runHealthCheck', {
				method: 'POST',
				body: fd,
				headers: { 'x-sveltekit-action': 'true' }
			});
			const json = await res.json();
			// SvelteKit action response is wrapped: { type, status, data }
			const results = json?.data?.results ?? json?.results ?? [];
			runResults  = results;
			showResults = true;
			// Re-fetch only server data (scroll position preserved)
			await invalidate('app:monitoring');
		} catch {
			// silent
		} finally {
			running = false;
		}
	}

	// ── Refresh table only (no scroll jump) ──────────────────────────────────
	let refreshing = $state(false);
	async function refreshTable() {
		refreshing = true;
		await invalidate('app:monitoring');
		refreshing = false;
	}
</script>

<div class="min-h-screen bg-[#060d1a] p-6 text-slate-100">

	<!-- Header -->
	<div class="mb-6 flex items-center justify-between">
		<h1 class="text-xl font-bold text-white">Monitoring</h1>
		<div class="flex items-center gap-2">
			<button
				onclick={refreshTable}
				disabled={refreshing}
				class="flex items-center gap-1.5 rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-xs text-slate-400 transition hover:bg-white/[0.06] disabled:opacity-40"
			>
				{#if refreshing}
					<span class="inline-block h-3 w-3 animate-spin rounded-full border-2 border-slate-400 border-t-transparent"></span>
				{:else}
					↻
				{/if}
				Refresh
			</button>
			<button
				onclick={runNow}
				disabled={running}
				class="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-400 transition hover:bg-emerald-500/20 disabled:opacity-50"
			>
				{#if running}
					<span class="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent"></span>
					Running…
				{:else}
					▶ Run Now
				{/if}
			</button>
		</div>
	</div>

	<!-- Run results (inline, no page reload) -->
	{#if showResults && runResults.length > 0}
		<div class="mb-6 rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
			<div class="mb-2 text-xs font-semibold text-slate-400">Manual run results</div>
			<div class="flex flex-wrap gap-3">
				{#each runResults as r}
					<div class="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs {r.status === 'OK' ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-red-500/30 bg-red-500/10'}">
						<span class="{r.status === 'OK' ? 'text-emerald-400' : 'text-red-400'} font-semibold">{r.status}</span>
						<span class="text-slate-400">{r.check}</span>
						<span class="text-slate-500">{r.ms}ms</span>
						{#if r.error}<span class="text-red-400">— {r.error}</span>{/if}
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Section tabs -->
	<div class="mb-6 flex gap-1 rounded-xl border border-white/[0.06] bg-white/[0.03] p-1 w-fit">
		<button
			onclick={() => activeSection = 'server'}
			class="rounded-lg px-5 py-2 text-sm font-semibold transition {activeSection === 'server' ? 'bg-white/[0.08] text-white' : 'text-slate-400 hover:text-slate-200'}"
		>
			Server Health
			{#if totalFail > 0}
				<span class="ml-1.5 rounded-full bg-red-500/30 px-1.5 py-0.5 text-xs text-red-400">{totalFail}</span>
			{/if}
		</button>
		<button
			onclick={() => activeSection = 'mobile'}
			class="rounded-lg px-5 py-2 text-sm font-semibold transition {activeSection === 'mobile' ? 'bg-white/[0.08] text-white' : 'text-slate-400 hover:text-slate-200'}"
		>
			Mobile Errors
			{#if mobileTotal > 0}
				<span class="ml-1.5 rounded-full bg-orange-500/30 px-1.5 py-0.5 text-xs text-orange-400">{mobileTotal}</span>
			{/if}
		</button>
	</div>

	<!-- ═══════════════════════════════════════════════════════════════════════
	     SECTION 1 — Server Health
	     ═══════════════════════════════════════════════════════════════════════ -->
	{#if activeSection === 'server'}

		<div class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
			<div class="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
				<div class="text-2xl font-bold text-white">{data.logs.length}</div>
				<div class="mt-1 text-xs text-slate-400">Total checks (last 500)</div>
			</div>
			<div class="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
				<div class="text-2xl font-bold text-emerald-400">{overallUptime != null ? overallUptime + '%' : '—'}</div>
				<div class="mt-1 text-xs text-slate-400">Overall uptime</div>
			</div>
			<div class="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
				<div class="text-2xl font-bold text-red-400">{totalFail}</div>
				<div class="mt-1 text-xs text-slate-400">Failures</div>
			</div>
			<div class="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
				<div class="text-2xl font-bold text-yellow-400">{totalWarn}</div>
				<div class="mt-1 text-xs text-slate-400">Warnings</div>
			</div>
		</div>

		{#if data.summary.length > 0}
			<div class="mb-6 overflow-x-auto rounded-xl border border-white/[0.06] bg-white/[0.03]">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-white/[0.06] text-left text-xs text-slate-500">
							<th class="px-4 py-3">Check</th>
							<th class="px-4 py-3">Last status</th>
							<th class="px-4 py-3">Last error</th>
							<th class="px-4 py-3">Uptime</th>
							<th class="px-4 py-3">OK / FAIL / WARN</th>
							<th class="px-4 py-3">Avg response</th>
						</tr>
					</thead>
					<tbody>
						{#each data.summary as s}
							<tr class="border-b border-white/[0.04] {s.lastStatus === 'FAIL' ? 'bg-red-500/[0.04]' : ''} hover:bg-white/[0.02]">
								<td class="px-4 py-2.5 font-mono text-xs text-slate-300">{s.check_name}</td>
								<td class="px-4 py-2.5">
									<span class="rounded border px-1.5 py-0.5 text-xs {statusBadge(s.lastStatus)}">{s.lastStatus}</span>
								</td>
								<td class="px-4 py-2.5 text-xs">
									{#if s.lastError}
										<span class="text-red-400">{s.lastError}</span>
										{#if s.lastStatus === 'OK'}<span class="ml-1 text-slate-500">(recovered)</span>{/if}
									{:else}
										<span class="text-slate-600">—</span>
									{/if}
								</td>
								<td class="px-4 py-2.5 {s.uptimePct != null && s.uptimePct < 90 ? 'text-red-400' : 'text-emerald-400'}">
									{s.uptimePct != null ? s.uptimePct + '%' : '—'}
								</td>
								<td class="px-4 py-2.5 text-xs">
									<span class="text-emerald-400">{s.ok}</span><span class="mx-1 text-slate-600">/</span><span class="text-red-400">{s.fail}</span><span class="mx-1 text-slate-600">/</span><span class="text-yellow-400">{s.warn}</span>
								</td>
								<td class="px-4 py-2.5 text-slate-400">{s.avgMs != null ? s.avgMs + ' ms' : '—'}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}

		<div class="mb-4 flex flex-wrap items-center gap-2">
			<select bind:value={checkFilter} class="rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-sm text-slate-300 outline-none focus:border-emerald-500/50">
				{#each checkNames as name}<option value={name}>{name === 'all' ? 'All checks' : name}</option>{/each}
			</select>
			<select bind:value={statusFilter} class="rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-sm text-slate-300 outline-none focus:border-emerald-500/50">
				<option value="all">All statuses</option>
				<option value="OK">OK</option>
				<option value="FAIL">FAIL</option>
				<option value="WARN">WARN</option>
			</select>
			<span class="ml-auto text-xs text-slate-500">{serverFiltered.length} entries · page {serverPage_}/{serverTotalPages}</span>
		</div>

		<div class="overflow-x-auto rounded-xl border border-white/[0.06] bg-white/[0.03]">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-white/[0.06] text-left text-xs text-slate-500">
						<th class="px-4 py-3">Time</th>
						<th class="px-4 py-3">Check</th>
						<th class="px-4 py-3">Status</th>
						<th class="px-4 py-3">Response</th>
						<th class="px-4 py-3">Error / Detail</th>
					</tr>
				</thead>
				<tbody>
					{#each serverPaged as log}
						<tr class="border-b border-white/[0.04] {log.status === 'FAIL' ? 'bg-red-500/[0.04]' : ''} hover:bg-white/[0.02]">
							<td class="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-slate-400">{fmtDate(log.created_at)}</td>
							<td class="px-4 py-2.5 font-mono text-xs text-slate-300">{log.check_name}</td>
							<td class="px-4 py-2.5">
								<span class="rounded border px-1.5 py-0.5 text-xs {statusBadge(log.status)}">{log.status}</span>
							</td>
							<td class="px-4 py-2.5 text-xs text-slate-400">{log.response_time_ms != null ? log.response_time_ms + ' ms' : '—'}</td>
							<td class="px-4 py-2.5 text-xs">
								{#if log.error_message || log.metadata}
									<div class="space-y-0.5">
										{#if log.metadata?.feature}
											<div><span class="text-slate-500">section:</span> <span class="text-orange-400">{log.metadata.feature}</span></div>
										{/if}
										{#if log.metadata?.endpoint}
											<div><span class="text-slate-500">endpoint:</span> <span class="font-mono text-slate-300">{log.metadata.endpoint}</span></div>
										{/if}
										{#if log.metadata?.http_code != null}
											<div><span class="text-slate-500">HTTP:</span> <span class="font-mono {Number(log.metadata.http_code) >= 400 ? 'text-red-400' : 'text-slate-300'}">{log.metadata.http_code}</span></div>
										{/if}
										{#if log.error_message}
											<div><span class="text-slate-500">error:</span> <span class="text-red-400">{log.error_message}</span></div>
										{/if}
									</div>
								{:else}
									<span class="text-slate-600">—</span>
								{/if}
							</td>
						</tr>
					{:else}
						<tr><td colspan="5" class="px-4 py-8 text-center text-sm text-slate-500">No entries match the current filter.</td></tr>
					{/each}
				</tbody>
			</table>
		</div>

		{#if serverTotalPages > 1}
			<div class="mt-4 flex items-center justify-center gap-2">
				<button onclick={() => serverPage = Math.max(1, serverPage_ - 1)} disabled={serverPage_ === 1}
					class="rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-1.5 text-xs text-slate-400 disabled:opacity-30 hover:bg-white/[0.06]">← Prev</button>
				{#each Array.from({length: serverTotalPages}, (_, i) => i + 1) as p}
					{#if Math.abs(p - serverPage_) <= 2 || p === 1 || p === serverTotalPages}
						<button onclick={() => serverPage = p}
							class="rounded-lg border px-3 py-1.5 text-xs {p === serverPage_ ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400' : 'border-white/[0.1] bg-white/[0.03] text-slate-400 hover:bg-white/[0.06]'}">{p}</button>
					{:else if Math.abs(p - serverPage_) === 3}
						<span class="text-slate-600 text-xs">…</span>
					{/if}
				{/each}
				<button onclick={() => serverPage = Math.min(serverTotalPages, serverPage_ + 1)} disabled={serverPage_ === serverTotalPages}
					class="rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-1.5 text-xs text-slate-400 disabled:opacity-30 hover:bg-white/[0.06]">Next →</button>
			</div>
		{/if}

	{/if}

	<!-- ═══════════════════════════════════════════════════════════════════════
	     SECTION 2 — Mobile Errors
	     ═══════════════════════════════════════════════════════════════════════ -->
	{#if activeSection === 'mobile'}

		<div class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
			<div class="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
				<div class="text-2xl font-bold text-white">{mobileTotal}</div>
				<div class="mt-1 text-xs text-slate-400">Total errors (last 300)</div>
			</div>
			<div class="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
				<div class="text-2xl font-bold text-orange-400">{mobileScreenCnt}</div>
				<div class="mt-1 text-xs text-slate-400">Screens affected</div>
			</div>
			<div class="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
				<div class="text-2xl font-bold text-purple-400">{mobileErrTypeCnt}</div>
				<div class="mt-1 text-xs text-slate-400">Error types</div>
			</div>
			<div class="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
				<div class="text-2xl font-bold text-slate-300">{mobileUserCnt}</div>
				<div class="mt-1 text-xs text-slate-400">Users affected</div>
			</div>
		</div>

		<div class="mb-4 flex flex-wrap items-center gap-2">
			<select bind:value={mobileScreenFilter} class="rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-sm text-slate-300 outline-none focus:border-orange-500/50">
				{#each mobileScreenNames as s}<option value={s}>{s === 'all' ? 'All screens' : s}</option>{/each}
			</select>
			<select bind:value={mobileErrTypeFilter} class="rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-sm text-slate-300 outline-none focus:border-orange-500/50">
				{#each mobileErrTypes as t}<option value={t}>{t === 'all' ? 'All error types' : t}</option>{/each}
			</select>
			<span class="ml-auto text-xs text-slate-500">{mobileFiltered.length} errors · page {mobilePage_}/{mobileTotalPages}</span>
		</div>

		<div class="overflow-x-auto rounded-xl border border-white/[0.06] bg-white/[0.03]">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-white/[0.06] text-left text-xs text-slate-500">
						<th class="px-4 py-3">Time</th>
						<th class="px-4 py-3">Screen</th>
						<th class="px-4 py-3">Action</th>
						<th class="px-4 py-3">Error type</th>
						<th class="px-4 py-3">Message &amp; Detail</th>
						<th class="px-4 py-3">User ID</th>
						<th class="px-4 py-3">v</th>
					</tr>
				</thead>
				<tbody>
					{#each mobilePaged as e}
						<tr class="border-b border-white/[0.04] bg-red-500/[0.03] hover:bg-white/[0.02]">
							<td class="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-slate-400">{fmtDate(e.created_at)}</td>
							<td class="px-4 py-2.5">
								{#if e.screen}
									<span class="rounded bg-orange-500/10 px-1.5 py-0.5 font-mono text-xs text-orange-300">{e.screen}</span>
								{:else}
									<span class="text-slate-600">—</span>
								{/if}
							</td>
							<td class="px-4 py-2.5 font-mono text-xs text-slate-400">{e.action ?? '—'}</td>
							<td class="px-4 py-2.5">
								{#if e.error_type}
									<span class="rounded bg-red-500/10 px-1.5 py-0.5 font-mono text-xs text-red-300">{e.error_type}</span>
								{:else}
									<span class="text-slate-600">—</span>
								{/if}
							</td>
							<td class="px-4 py-2.5 text-xs max-w-sm">
								{#if e.error_message}
									<div class="text-red-400">{e.error_message}</div>
								{/if}
								{#if e.metadata}
									<details class="mt-1">
										<summary class="cursor-pointer select-none text-slate-500 hover:text-slate-300 text-xs">
											detail JSON
										</summary>
										<pre class="mt-1.5 max-h-48 overflow-auto rounded-lg bg-black/30 p-2.5 text-xs text-slate-300 whitespace-pre-wrap break-all">{fmtJson(e.metadata)}</pre>
									</details>
								{/if}
							</td>
							<td class="px-4 py-2.5">
								{#if e.user_id}
									<span class="font-mono text-xs text-slate-400 select-all" title={e.user_id}>{e.user_id}</span>
								{:else}
									<span class="text-xs text-slate-600">anon</span>
								{/if}
							</td>
							<td class="px-4 py-2.5 text-xs text-slate-500">{e.app_version ?? '—'}</td>
						</tr>
					{:else}
						<tr>
							<td colspan="7" class="px-4 py-8 text-center text-sm text-slate-500">
								{mobileTotal === 0 ? 'No mobile errors recorded yet — great sign! 🎉' : 'No entries match the current filter.'}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		{#if mobileTotalPages > 1}
			<div class="mt-4 flex items-center justify-center gap-2">
				<button onclick={() => mobilePage = Math.max(1, mobilePage_ - 1)} disabled={mobilePage_ === 1}
					class="rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-1.5 text-xs text-slate-400 disabled:opacity-30 hover:bg-white/[0.06]">← Prev</button>
				{#each Array.from({length: mobileTotalPages}, (_, i) => i + 1) as p}
					{#if Math.abs(p - mobilePage_) <= 2 || p === 1 || p === mobileTotalPages}
						<button onclick={() => mobilePage = p}
							class="rounded-lg border px-3 py-1.5 text-xs {p === mobilePage_ ? 'border-orange-500/50 bg-orange-500/10 text-orange-400' : 'border-white/[0.1] bg-white/[0.03] text-slate-400 hover:bg-white/[0.06]'}">{p}</button>
					{:else if Math.abs(p - mobilePage_) === 3}
						<span class="text-slate-600 text-xs">…</span>
					{/if}
				{/each}
				<button onclick={() => mobilePage = Math.min(mobileTotalPages, mobilePage_ + 1)} disabled={mobilePage_ === mobileTotalPages}
					class="rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-1.5 text-xs text-slate-400 disabled:opacity-30 hover:bg-white/[0.06]">Next →</button>
			</div>
		{/if}

	{/if}

</div>
