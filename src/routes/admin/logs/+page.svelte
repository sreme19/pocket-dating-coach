<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
	const { logs, filter, search } = data;

	function fmtDate(iso: string) {
		return new Date(iso).toLocaleString(undefined, {
			month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
		});
	}

	function typeColor(type: string) {
		if (type === 'error') return 'bg-red-500/20 text-red-400';
		if (type === 'action') return 'bg-blue-500/20 text-blue-400';
		if (type === 'navigation') return 'bg-slate-500/20 text-slate-400';
		return 'bg-slate-500/20 text-slate-400';
	}

	let expandedId = $state<string | null>(null);
</script>

<div class="min-h-screen bg-[#0b1120] px-6 py-8 text-slate-100">
	<div class="mx-auto max-w-6xl space-y-6">

		<div class="flex items-center justify-between">
			<div>
				<a href="/admin/analytics" class="text-sm text-slate-500 hover:text-slate-300">← Admin</a>
				<h1 class="mt-1 text-xl font-bold text-white">Mobile Event Logs</h1>
				<p class="text-sm text-slate-500">{logs.length} entries (newest first)</p>
			</div>
		</div>

		<!-- Filters -->
		<div class="flex flex-wrap items-center gap-3">
			{#each ['all', 'error', 'action', 'navigation'] as f}
				<a
					href="/admin/logs?filter={f}{search ? `&search=${encodeURIComponent(search)}` : ''}"
					class="rounded-full px-3 py-1 text-xs font-medium transition-colors
						{filter === f ? 'bg-pink-500/20 text-pink-300 border border-pink-500/30' : 'bg-white/[0.05] text-slate-400 border border-white/[0.08] hover:text-slate-200'}"
				>
					{f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
				</a>
			{/each}
			<form method="get" action="/admin/logs" class="ml-auto flex gap-2">
				<input type="hidden" name="filter" value={filter} />
				<input
					name="search"
					value={search}
					placeholder="Search error message…"
					class="rounded border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-pink-500/50 w-64"
				/>
				<button type="submit" class="rounded border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs text-slate-300 hover:text-white">Search</button>
				{#if search}<a href="/admin/logs?filter={filter}" class="rounded border border-white/[0.08] px-3 py-1 text-xs text-slate-500 hover:text-slate-300">Clear</a>{/if}
			</form>
		</div>

		<!-- Log table -->
		{#if logs.length === 0}
			<p class="text-slate-500 text-sm">No logs found.</p>
		{:else}
			<div class="rounded-lg border border-white/[0.08] bg-[#111a2e] overflow-hidden">
				<div class="overflow-x-auto">
					<table class="w-full text-left text-xs">
						<thead class="border-b border-white/[0.06] text-slate-500 uppercase tracking-wide text-[10px]">
							<tr>
								<th class="py-2.5 px-4">Time</th>
								<th class="py-2.5 px-3">Type</th>
								<th class="py-2.5 px-3">User</th>
								<th class="py-2.5 px-3">Screen</th>
								<th class="py-2.5 px-3">Action / Error</th>
								<th class="py-2.5 px-3">Version</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-white/[0.04]">
							{#each logs as log}
								<tr
									class="hover:bg-white/[0.02] cursor-pointer {log.eventType === 'error' ? 'bg-red-500/[0.03]' : ''}"
									onclick={() => expandedId = expandedId === log.id ? null : log.id}
								>
									<td class="py-2 px-4 text-slate-500 whitespace-nowrap">{fmtDate(log.createdAt)}</td>
									<td class="py-2 px-3">
										<span class="rounded px-1.5 py-0.5 text-[10px] font-medium {typeColor(log.eventType)}">{log.eventType}</span>
									</td>
									<td class="py-2 px-3 text-slate-400">{log.userName ?? '—'}</td>
									<td class="py-2 px-3 text-slate-400">{log.screen ?? '—'}</td>
									<td class="py-2 px-3 max-w-xs">
										{#if log.eventType === 'error'}
											<span class="text-red-300">{log.errorType ? `[${log.errorType}] ` : ''}</span>
											<span class="text-slate-300">{log.errorMessage?.slice(0, 120) ?? '—'}</span>
										{:else}
											<span class="text-slate-300">{log.action ?? '—'}</span>
										{/if}
									</td>
									<td class="py-2 px-3 text-slate-600">{log.appVersion ?? '—'}</td>
								</tr>
								{#if expandedId === log.id}
									<tr class="bg-black/20">
										<td colspan="6" class="px-4 py-3">
											<div class="space-y-2 text-xs">
												{#if log.errorMessage}
													<div>
														<span class="text-slate-500 uppercase text-[10px] tracking-wide">Error</span>
														<pre class="mt-1 text-red-300 whitespace-pre-wrap break-all">{log.errorMessage}</pre>
													</div>
												{/if}
												{#if log.metadata}
													<div>
														<span class="text-slate-500 uppercase text-[10px] tracking-wide">Metadata</span>
														<pre class="mt-1 text-slate-400 whitespace-pre-wrap break-all text-[11px]">{JSON.stringify(log.metadata, null, 2)}</pre>
													</div>
												{/if}
												{#if log.userId}
													<div class="flex items-center gap-2">
														<span class="text-slate-500">User ID:</span>
														<span class="font-mono text-slate-400">{log.userId}</span>
														<a href="/admin/users/{log.userId}" class="text-pink-400 hover:underline">View profile →</a>
													</div>
												{/if}
											</div>
										</td>
									</tr>
								{/if}
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}

	</div>
</div>
