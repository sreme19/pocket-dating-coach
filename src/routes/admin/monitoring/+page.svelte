<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let checkFilter = $state('all');
	let statusFilter = $state('all');

	let checkNames = $derived(['all', ...new Set(data.logs.map((l) => l.check_name))]);

	let filtered = $derived(
		data.logs.filter((l) => {
			if (checkFilter !== 'all' && l.check_name !== checkFilter) return false;
			if (statusFilter !== 'all' && l.status !== statusFilter) return false;
			return true;
		})
	);

	function statusColor(s: string) {
		if (s === 'OK') return 'text-emerald-400';
		if (s === 'FAIL') return 'text-red-400';
		return 'text-yellow-400'; // WARN
	}

	function statusBadge(s: string) {
		if (s === 'OK') return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
		if (s === 'FAIL') return 'bg-red-500/20 text-red-400 border-red-500/30';
		return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
	}

	function fmtDate(ts: string) {
		return new Date(ts).toLocaleString('en-GB', {
			day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit'
		});
	}

	// Overall stats
	let totalOk   = $derived(data.logs.filter((l) => l.status === 'OK').length);
	let totalFail = $derived(data.logs.filter((l) => l.status === 'FAIL').length);
	let totalWarn = $derived(data.logs.filter((l) => l.status === 'WARN').length);
	let overallUptime = $derived(
		data.logs.length > 0 ? Math.round((totalOk / data.logs.length) * 100) : null
	);
</script>

<div class="min-h-screen bg-[#060d1a] p-6 text-slate-100">
	<h1 class="mb-6 text-xl font-bold text-white">Log Monitoring</h1>

	<!-- Overall stats -->
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

	<!-- Per-check summary -->
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
								<span class="rounded border px-1.5 py-0.5 text-xs {statusBadge(s.lastStatus)}">
									{s.lastStatus}
								</span>
							</td>
							<td class="px-4 py-2.5 text-xs">
								{#if s.lastError}
									<span class="text-red-400">{s.lastError}</span>
									{#if s.lastStatus === 'OK'}
										<span class="ml-1 text-slate-500">(recovered)</span>
									{/if}
								{:else}
									<span class="text-slate-600">—</span>
								{/if}
							</td>
							<td class="px-4 py-2.5 {s.uptimePct != null && s.uptimePct < 90 ? 'text-red-400' : 'text-emerald-400'}">
								{s.uptimePct != null ? s.uptimePct + '%' : '—'}
							</td>
							<td class="px-4 py-2.5 text-xs">
								<span class="text-emerald-400">{s.ok}</span>
								<span class="mx-1 text-slate-600">/</span>
								<span class="text-red-400">{s.fail}</span>
								<span class="mx-1 text-slate-600">/</span>
								<span class="text-yellow-400">{s.warn}</span>
							</td>
							<td class="px-4 py-2.5 text-slate-400">
								{s.avgMs != null ? s.avgMs + ' ms' : '—'}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else}
		<div class="mb-6 rounded-xl border border-white/[0.06] bg-white/[0.03] p-8 text-center text-sm text-slate-500">
			No monitoring data yet. Run a health check to populate this table.
		</div>
	{/if}

	<!-- Filters -->
	<div class="mb-4 flex flex-wrap gap-2">
		<select
			bind:value={checkFilter}
			class="rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-sm text-slate-300 outline-none focus:border-emerald-500/50"
		>
			{#each checkNames as name}
				<option value={name}>{name === 'all' ? 'All checks' : name}</option>
			{/each}
		</select>
		<select
			bind:value={statusFilter}
			class="rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-sm text-slate-300 outline-none focus:border-emerald-500/50"
		>
			<option value="all">All statuses</option>
			<option value="OK">OK</option>
			<option value="FAIL">FAIL</option>
			<option value="WARN">WARN</option>
		</select>
		<span class="ml-auto self-center text-xs text-slate-500">{filtered.length} entries</span>
	</div>

	<!-- Log table -->
	<div class="overflow-x-auto rounded-xl border border-white/[0.06] bg-white/[0.03]">
		<table class="w-full text-sm">
			<thead>
				<tr class="border-b border-white/[0.06] text-left text-xs text-slate-500">
					<th class="px-4 py-3">Time</th>
					<th class="px-4 py-3">Check</th>
					<th class="px-4 py-3">Status</th>
					<th class="px-4 py-3">Response</th>
					<th class="px-4 py-3">Error</th>
				</tr>
			</thead>
			<tbody>
				{#each filtered as log}
					<tr class="border-b border-white/[0.04] {log.status === 'FAIL' ? 'bg-red-500/[0.04]' : ''} hover:bg-white/[0.02]">
						<td class="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-slate-400">
							{fmtDate(log.created_at)}
						</td>
						<td class="px-4 py-2.5 font-mono text-xs text-slate-300">{log.check_name}</td>
						<td class="px-4 py-2.5">
							<span class="rounded border px-1.5 py-0.5 text-xs {statusBadge(log.status)}">
								{log.status}
							</span>
						</td>
						<td class="px-4 py-2.5 text-xs text-slate-400">
							{log.response_time_ms != null ? log.response_time_ms + ' ms' : '—'}
						</td>
						<td class="px-4 py-2.5 text-xs">
							{#if log.check_name === 'app_error' && log.metadata}
								<div class="space-y-0.5">
									{#if log.metadata.feature}
										<div><span class="text-slate-500">feature:</span> <span class="text-orange-400">{log.metadata.feature}</span></div>
									{/if}
									{#if log.metadata.endpoint}
										<div><span class="text-slate-500">endpoint:</span> <span class="font-mono text-slate-300">{log.metadata.endpoint}</span></div>
									{/if}
									{#if log.metadata.file}
										<div><span class="text-slate-500">file:</span> <span class="font-mono text-sky-400">{log.metadata.file}</span></div>
									{/if}
									{#if log.error_message}
										<div><span class="text-slate-500">error:</span> <span class="text-red-400">{log.error_message}</span></div>
									{/if}
									{#if log.metadata.user_id}
										<div><span class="text-slate-500">user:</span> <span class="font-mono text-slate-400">{log.metadata.user_id}</span></div>
									{/if}
								</div>
							{:else}
								<span class="text-red-400">{log.error_message ?? ''}</span>
							{/if}
						</td>
					</tr>
				{:else}
					<tr>
						<td colspan="5" class="px-4 py-8 text-center text-sm text-slate-500">No entries match the current filter.</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
