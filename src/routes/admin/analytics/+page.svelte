<script lang="ts">
	import { onMount } from 'svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let Chart: typeof import('chart.js').Chart;
	let chartInstances: Record<string, import('chart.js').Chart> = {};
	let chartjsReady = $state(false);

	onMount(async () => {
		const chartjs = await import('chart.js');
		Chart = chartjs.Chart;
		Chart.register(...chartjs.registerables);
		chartjsReady = true;
	});

	// ── Client-side data helpers (mirror server-side but run on filteredUsers) ──

	function clientBucketByDay(rows: { joinedAt: string | null }[], days: number) {
		const labels: string[] = [];
		const counts: number[] = [];
		const now = new Date();
		for (let i = days - 1; i >= 0; i--) {
			const d = new Date(now);
			d.setDate(d.getDate() - i);
			const label = d.toISOString().slice(0, 10);
			labels.push(label);
			counts.push(rows.filter((r) => r.joinedAt?.slice(0, 10) === label).length);
		}
		return { labels, counts };
	}

	function clientCountBy<T>(rows: T[], key: (r: T) => string): Record<string, number> {
		const out: Record<string, number> = {};
		for (const r of rows) {
			const k = key(r) ?? 'unknown';
			out[k] = (out[k] ?? 0) + 1;
		}
		return out;
	}

	// ── Derived chart data — recomputed from filteredUsers on every filter change ──

	// Users deleted this session — filtered out client-side so the table updates
	// instantly without a full reload (the backend row is already gone).
	let deletedIds = $state<Set<string>>(new Set());

	let filteredBase = $derived(
		data.userList.filter((u) => {
			if (deletedIds.has(u.id)) return false;
			if (genderFilter !== 'all' && u.gender !== genderFilter) return false;
			if (typeFilter === 'real' && u.isSeed) return false;
			if (typeFilter === 'seed' && !u.isSeed) return false;
			return true;
		})
	);

	let filteredSignupsByDay = $derived(clientBucketByDay(filteredBase, 30));

	let filteredGenderCounts = $derived(clientCountBy(filteredBase, (u) => u.gender ?? 'unknown'));

	let filteredTopArchetypes = $derived(
		Object.entries(clientCountBy(filteredBase, (u) => u.archetype ?? 'unknown'))
			.sort((a, b) => b[1] - a[1])
			.slice(0, 8)
	);

	let filteredTrustBuckets = $derived.by(() => {
		const buckets = [0, 0, 0, 0, 0];
		for (const u of filteredBase) {
			const idx = Math.min(Math.floor((u.trustScore ?? 0) / 20), 4);
			buckets[idx]++;
		}
		return buckets;
	});

	// ── Reactive chart rendering ──────────────────────────────────────────────

	$effect(() => {
		if (!chartjsReady) return;
		// Touch reactive dependencies
		const signups = filteredSignupsByDay;
		const genders = filteredGenderCounts;
		const archetypes = filteredTopArchetypes;
		const trust = filteredTrustBuckets;

		destroyCharts(['signups-chart', 'gender-chart', 'archetype-chart', 'trust-chart']);

		renderLine('signups-chart', signups.labels, [
			{ label: 'Signups', data: signups.counts, borderColor: '#10b981', backgroundColor: '#10b98120' },
		]);
		renderDoughnut('gender-chart', Object.keys(genders), Object.values(genders), ['#6366f1', '#f472b6', '#94a3b8']);
		renderBar('archetype-chart', archetypes.map(([k]) => k), archetypes.map(([, v]) => v), '#10b981');
		renderBar('trust-chart', ['0–20', '21–40', '41–60', '61–80', '81–100'], trust, '#6366f1');
	});

	// Engagement/messages/events/bestie charts only run once (no user-level data to filter by)
	$effect(() => {
		if (!chartjsReady) return;

		destroyCharts(['engagement-chart', 'messages-chart', 'events-chart', 'bestie-chart']);

		renderLine('engagement-chart', data.likesByDay.labels, [
			{ label: 'Likes', data: data.likesByDay.counts, borderColor: '#6366f1', backgroundColor: '#6366f120' },
			{ label: 'Passes', data: data.passesByDay.counts, borderColor: '#f59e0b', backgroundColor: '#f59e0b20' },
		]);
		renderLine('messages-chart', data.messagesByDay.labels, [
			{ label: 'Messages', data: data.messagesByDay.counts, borderColor: '#3b82f6', backgroundColor: '#3b82f620' },
		]);
		if (Object.keys(data.eventCounts).length) {
			renderDoughnut('events-chart', Object.keys(data.eventCounts), Object.values(data.eventCounts),
				['#10b981', '#6366f1', '#f59e0b', '#3b82f6', '#f472b6', '#94a3b8', '#ec4899', '#14b8a6']);
		}
		if (Object.keys(data.bestieTypes).length) {
			renderBar('bestie-chart', Object.keys(data.bestieTypes), Object.values(data.bestieTypes), '#f472b6');
		}
	});

	function destroyCharts(ids: string[]) {
		for (const id of ids) {
			chartInstances[id]?.destroy();
			delete chartInstances[id];
		}
	}

	function renderLine(id: string, labels: string[], datasets: { label: string; data: number[]; borderColor: string; backgroundColor: string }[]) {
		const ctx = (document.getElementById(id) as HTMLCanvasElement)?.getContext('2d');
		if (!ctx) return;
		chartInstances[id] = new Chart(ctx, {
			type: 'line',
			data: {
				labels,
				datasets: datasets.map((d) => ({
					...d,
					fill: true,
					tension: 0.3,
					pointRadius: 2,
				})),
			},
			options: chartOptions(),
		});
	}

	function renderBar(id: string, labels: string[], data: number[], color: string) {
		const ctx = (document.getElementById(id) as HTMLCanvasElement)?.getContext('2d');
		if (!ctx) return;
		chartInstances[id] = new Chart(ctx, {
			type: 'bar',
			data: {
				labels,
				datasets: [{ data, backgroundColor: color + 'cc', borderColor: color, borderWidth: 1 }],
			},
			options: { ...chartOptions(), plugins: { legend: { display: false } } },
		});
	}

	function renderDoughnut(id: string, labels: string[], data: number[], colors: string[]) {
		const ctx = (document.getElementById(id) as HTMLCanvasElement)?.getContext('2d');
		if (!ctx) return;
		chartInstances[id] = new Chart(ctx, {
			type: 'doughnut',
			data: { labels, datasets: [{ data, backgroundColor: colors }] },
			options: {
				plugins: {
					legend: { labels: { color: '#94a3b8', font: { size: 11 } } },
				},
			},
		});
	}

	function chartOptions() {
		return {
			responsive: true,
			maintainAspectRatio: false,
			plugins: { legend: { labels: { color: '#94a3b8', font: { size: 11 } } } },
			scales: {
				x: { ticks: { color: '#64748b', maxRotation: 45, font: { size: 10 } }, grid: { color: '#ffffff08' } },
				y: { ticks: { color: '#64748b' }, grid: { color: '#ffffff08' } },
			},
		};
	}

	let genderFilter = $state<'all' | 'man' | 'woman'>('all');
	let typeFilter = $state<'all' | 'real' | 'seed'>('all');

	function resetUserSelection() { selectedUserId = ''; activity = null; }
	let sortCol = $state<'name' | 'age' | 'city' | 'gender' | 'archetype' | 'trustScore' | 'joinedAt'>('joinedAt');
	let sortDir = $state<'asc' | 'desc'>('desc');

	function toggleSort(col: typeof sortCol) {
		if (sortCol === col) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		else { sortCol = col; sortDir = col === 'joinedAt' || col === 'trustScore' ? 'desc' : 'asc'; }
	}

	// ── Delete user ────────────────────────────────────────────────────
	// Clicking a name opens a type-to-confirm modal; confirming permanently
	// purges the profile and every backend record via the admin endpoint.
	type DeleteTarget = { id: string; name: string | null };
	let deleteTarget = $state<DeleteTarget | null>(null);
	let deleteConfirmText = $state('');
	let deleting = $state(false);
	let deleteError = $state<string | null>(null);

	function askDelete(u: { id: string; name: string | null }) {
		deleteTarget = { id: u.id, name: u.name };
		deleteConfirmText = '';
		deleteError = null;
	}

	function cancelDelete() {
		if (deleting) return;
		deleteTarget = null;
		deleteConfirmText = '';
		deleteError = null;
	}

	async function confirmDelete() {
		if (!deleteTarget || deleting) return;
		deleting = true;
		deleteError = null;
		try {
			const res = await fetch('/admin/analytics/delete-user', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ userId: deleteTarget.id })
			});
			const body = await res.json().catch(() => ({}));
			if (!res.ok) {
				deleteError = body?.error ?? `Delete failed (${res.status})`;
				return;
			}
			// Hide the row immediately; the backend records are already gone.
			deletedIds = new Set([...deletedIds, deleteTarget.id]);
			deleteTarget = null;
			deleteConfirmText = '';
		} catch (err) {
			deleteError = err instanceof Error ? err.message : 'Network error';
		} finally {
			deleting = false;
		}
	}

	let filteredUsers = $derived.by(() => {
		return filteredBase.slice().sort((a, b) => {
			const av = a[sortCol] ?? '';
			const bv = b[sortCol] ?? '';
			const cmp = typeof av === 'number' && typeof bv === 'number'
				? av - bv
				: String(av).localeCompare(String(bv));
			return sortDir === 'asc' ? cmp : -cmp;
		});
	});

	// KPIs — user count is filter-aware; engagement metrics are global (no per-user breakdown available)
	let filteredTotals = $derived({
		users: filteredBase.length,
		likes: data.totals.likes,
		passes: data.totals.passes,
		matches: data.totals.matches,
		mutualMatches: data.totals.mutualMatches,
		messages: data.totals.messages,
		femaleProfiles: data.totals.femaleProfiles,
		approvedFemale: data.totals.approvedFemale,
	});

	let matchRate = $derived(
		filteredTotals.matches ? ((filteredTotals.mutualMatches / filteredTotals.matches) * 100).toFixed(1) : '0'
	);

	const femaleApprovalRate = data.totals.femaleProfiles
		? ((data.totals.approvedFemale / data.totals.femaleProfiles) * 100).toFixed(1)
		: '0';

	// ── User Activity tab ──────────────────────────────────────────────
	type Tab = 'overview' | 'activity' | 'ai_latency';
	let activeTab = $state<Tab>('overview');
	let selectedUserId = $state<string>('');
	let activity = $state<Record<string, any> | null>(null);
	let activityLoading = $state(false);

	async function loadActivity(userId: string) {
		if (!userId) return;
		activityLoading = true;
		activity = null;
		const res = await fetch(`/api/analytics/user-activity?userId=${userId}`);
		activity = await res.json();
		activityLoading = false;
	}

	function fmtDate(s: string) {
		return s ? new Date(s).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
	}

	// ── Toggle seed/real ───────────────────────────────────────────────
	let togglingId = $state<string | null>(null);

	async function toggleSeed(u: { id: string; isSeed: boolean }) {
		if (togglingId) return;
		const next = !u.isSeed;
		togglingId = u.id;
		try {
			const res = await fetch(`/admin/users/${u.id}/set-seed`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ isSeed: next }),
			});
			if (res.ok) {
				// Update in-place so the table reflects the change immediately
				const idx = data.userList.findIndex((r) => r.id === u.id);
				if (idx !== -1) data.userList[idx] = { ...data.userList[idx], isSeed: next };
			}
		} finally {
			togglingId = null;
		}
	}

	function fmtMs(v: number | null | undefined): string {
		if (v == null || !isFinite(v)) return '—';
		return v >= 1000 ? (v / 1000).toFixed(1) + 's' : Math.round(v) + 'ms';
	}
</script>

<svelte:head>
	<title>Analytics — Admin</title>
</svelte:head>

<div class="min-h-screen bg-[#0b1120] px-6 py-8 text-slate-100">
	<h1 class="mb-1 text-2xl font-bold text-white">Analytics Dashboard</h1>
	<p class="mb-4 text-sm text-slate-500">Verified Vibe · Pocket Dating Coach</p>

	<!-- Tab bar -->
	<div class="mb-8 flex gap-1 border-b border-white/[0.06]">
		{#each [['overview', 'Overview'], ['activity', 'User Activity'], ['ai_latency', 'AI Latency']] as [tab, label]}
			<button
				onclick={() => activeTab = tab as Tab}
				class="px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px {activeTab === tab ? 'border-emerald-400 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200'}"
			>{label}</button>
		{/each}
	</div>

	<!-- Global filters -->
	<div class="mb-6 flex flex-wrap gap-2">
		<div class="flex rounded-lg border border-white/[0.08] overflow-hidden text-xs">
			{#each [['all', 'All genders'], ['man', 'Men'], ['woman', 'Women']] as [val, label]}
				<button
					onclick={() => { genderFilter = val; resetUserSelection(); }}
					class="px-3 py-1.5 transition-colors {genderFilter === val ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:text-slate-200'}"
				>{label}</button>
			{/each}
		</div>
		<div class="flex rounded-lg border border-white/[0.08] overflow-hidden text-xs">
			{#each [['all', 'All users'], ['real', 'Real'], ['seed', 'Seed']] as [val, label]}
				<button
					onclick={() => { typeFilter = val; resetUserSelection(); }}
					class="px-3 py-1.5 transition-colors {typeFilter === val ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-400 hover:text-slate-200'}"
				>{label}</button>
			{/each}
		</div>
	</div>

{#if activeTab === 'overview'}
	<!-- KPI strip -->
	<div class="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
		{#each [
			{ label: 'Users', value: filteredTotals.users },
			{ label: 'Likes', value: filteredTotals.likes },
			{ label: 'Passes', value: filteredTotals.passes },
			{ label: 'Matches', value: filteredTotals.matches },
			{ label: 'Mutual', value: filteredTotals.mutualMatches },
			{ label: 'Match rate', value: matchRate + '%' },
			{ label: 'Messages', value: filteredTotals.messages },
			{ label: 'Her profiles', value: filteredTotals.femaleProfiles },
		] as kpi}
			<div class="rounded-xl border border-white/[0.06] bg-[#0d1522] p-4 text-center">
				<div class="text-xl font-bold text-emerald-400">{kpi.value}</div>
				<div class="mt-0.5 text-xs text-slate-500">{kpi.label}</div>
			</div>
		{/each}
	</div>

	<!-- Row 1: Signups + Engagement -->
	<div class="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
		<div class="card">
			<h2 class="chart-title">Signups — last 30 days</h2>
			<div class="h-52"><canvas id="signups-chart"></canvas></div>
		</div>
		<div class="card">
			<h2 class="chart-title">Likes vs Passes — last 30 days</h2>
			<div class="h-52"><canvas id="engagement-chart"></canvas></div>
		</div>
	</div>

	<!-- Row 2: Messages + Gender -->
	<div class="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
		<div class="card lg:col-span-2">
			<h2 class="chart-title">Messages sent — last 30 days</h2>
			<div class="h-52"><canvas id="messages-chart"></canvas></div>
		</div>
		<div class="card">
			<h2 class="chart-title">Gender split</h2>
			<div class="h-52"><canvas id="gender-chart"></canvas></div>
		</div>
	</div>

	<!-- Row 3: Archetypes + Trust scores -->
	<div class="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
		<div class="card">
			<h2 class="chart-title">Top archetypes</h2>
			<div class="h-52"><canvas id="archetype-chart"></canvas></div>
		</div>
		<div class="card">
			<h2 class="chart-title">Trust score distribution</h2>
			<div class="h-52"><canvas id="trust-chart"></canvas></div>
		</div>
	</div>

	<!-- Row 4: Analytics events + AI Bestie -->
	<div class="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
		{#if Object.keys(data.eventCounts).length}
			<div class="card">
				<h2 class="chart-title">Analytics events by type</h2>
				<div class="h-52"><canvas id="events-chart"></canvas></div>
			</div>
		{/if}
		{#if Object.keys(data.bestieTypes).length}
			<div class="card">
				<h2 class="chart-title">AI Bestie feedback types</h2>
				<div class="h-52"><canvas id="bestie-chart"></canvas></div>
			</div>
		{/if}
	</div>

	<!-- Female profile funnel -->
	<div class="card mb-6">
		<h2 class="chart-title">Female profile funnel</h2>
		<div class="mt-4 flex gap-6">
			<div class="text-center">
				<div class="text-3xl font-bold text-indigo-400">{data.totals.femaleProfiles}</div>
				<div class="text-xs text-slate-500">Total submitted</div>
			</div>
			<div class="text-center">
				<div class="text-3xl font-bold text-emerald-400">{data.totals.approvedFemale}</div>
				<div class="text-xs text-slate-500">Approved for matching</div>
			</div>
			<div class="text-center">
				<div class="text-3xl font-bold text-amber-400">{femaleApprovalRate}%</div>
				<div class="text-xs text-slate-500">Approval rate</div>
			</div>
		</div>
	</div>

	<!-- Users table -->
	<div class="card mb-6">
		<div class="mb-4">
			<h2 class="chart-title mb-0">Users ({filteredUsers.length})</h2>
			<p class="mt-0.5 text-xs text-slate-500">Click a name to permanently delete that profile and all of its data. Use <span class="text-slate-300">View</span> to open the public profile as members see it (opens in a new tab).</p>
		</div>
		<div class="overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-white/[0.06] text-left text-xs">
						{#each [
							['name', 'Name'],
							['age', 'Age'],
							['city', 'City'],
							['gender', 'Gender'],
							['archetype', 'Archetype'],
							['trustScore', 'Trust'],
							[null, 'Type'],
							['joinedAt', 'Joined'],
							[null, 'View'],
						] as [col, label]}
							<th class="pb-2 pr-4 font-medium last:pr-0">
								{#if col}
									<button
										onclick={() => toggleSort(col)}
										class="flex items-center gap-1 transition-colors {sortCol === col ? 'text-white' : 'text-slate-500 hover:text-slate-300'}"
									>
										{label}
										<span class="text-[10px]">{sortCol === col ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span>
									</button>
								{:else}
									<span class="text-slate-500">{label}</span>
								{/if}
							</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each filteredUsers as u}
						<tr class="border-b border-white/[0.04] hover:bg-white/[0.02]">
							<td class="py-2 pr-4 font-medium">
								<div class="inline-flex items-center gap-2">
									<a
										href="/admin/users/{u.id}"
										class="text-slate-200 hover:text-pink-400 underline decoration-dotted decoration-slate-600 underline-offset-2 hover:decoration-pink-400 transition-colors"
									>{u.name ?? '—'}</a>
									<button
										type="button"
										onclick={() => askDelete(u)}
										title="Delete this profile"
										class="text-slate-600 hover:text-red-400 transition-colors text-xs"
									>🗑</button>
								</div>
							</td>
							<td class="py-2 pr-4 text-slate-400">{u.age ?? '—'}</td>
							<td class="py-2 pr-4 text-slate-400">{u.city ?? '—'}</td>
							<td class="py-2 pr-4 text-slate-400 capitalize">{u.gender ?? '—'}</td>
							<td class="py-2 pr-4 text-slate-400">{u.archetype ?? '—'}</td>
							<td class="py-2 pr-4">
								<span class="rounded px-1.5 py-0.5 text-xs font-medium
									{(u.trustScore ?? 0) >= 70 ? 'bg-emerald-500/20 text-emerald-400' :
									 (u.trustScore ?? 0) >= 40 ? 'bg-amber-500/20 text-amber-400' :
									 'bg-red-500/20 text-red-400'}">
									{u.trustScore ?? 0}
								</span>
							</td>
							<td class="py-2 pr-4">
								<button
									onclick={() => toggleSeed(u)}
									disabled={togglingId === u.id}
									title="Click to toggle seed/real"
									class="rounded px-1.5 py-0.5 text-xs font-medium transition-colors disabled:opacity-40
										{u.isSeed
											? 'bg-slate-500/20 text-slate-400 hover:bg-amber-500/20 hover:text-amber-400'
											: 'bg-blue-500/20 text-blue-400 hover:bg-slate-500/20 hover:text-slate-400'}">
									{togglingId === u.id ? '…' : u.isSeed ? 'seed' : 'real'}
								</button>
							</td>
							<td class="py-2 pr-4 text-slate-500 text-xs">{u.joinedAt ? u.joinedAt.slice(0, 10) : '—'}</td>
							<td class="py-2">
								<a
									href={`/verified-vibe/profile/${u.id}?adminPreview=1&as=${u.gender === 'man' ? 'woman' : 'man'}`}
									target="_blank"
									rel="noopener"
									title="Open the public profile as members see it"
									class="inline-flex items-center gap-1 rounded border border-white/10 px-2 py-0.5 text-xs text-slate-300 transition-colors hover:border-emerald-400/40 hover:text-emerald-300"
								>
									View ↗
								</a>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>

{:else if activeTab === 'activity'}
	<!-- ── User Activity Tab ─────────────────────────────────────────── -->
	<div class="mb-6 card flex flex-wrap items-center gap-3">
		<label class="text-sm text-slate-400 font-medium whitespace-nowrap">Select user</label>
		<select
			bind:value={selectedUserId}
			onchange={() => loadActivity(selectedUserId)}
			class="flex-1 min-w-[200px] rounded-lg border border-white/[0.08] bg-[#0b1120] px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
		>
			<option value="">— choose a user —</option>
			{#each data.userList
				.filter(u => {
					if (deletedIds.has(u.id)) return false;
					if (genderFilter !== 'all' && u.gender !== genderFilter) return false;
					if (typeFilter === 'real' && u.isSeed) return false;
					if (typeFilter === 'seed' && !u.isSeed) return false;
					return true;
				})
				.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')) as u}
				<option value={u.id}>{u.name ?? u.id.slice(0, 8)} · {u.gender} · {u.isSeed ? 'seed' : 'real'}</option>
			{/each}
		</select>
		{#if selectedUserId}
			<span class="text-xs text-slate-500">{data.userList.find(u => u.id === selectedUserId)?.city ?? ''}</span>
		{/if}
	</div>

	{#if activityLoading}
		<div class="text-center py-16 text-slate-500 text-sm">Loading activity…</div>
	{:else if activity && selectedUserId}
		{@const user = data.userList.find(u => u.id === selectedUserId)}

		<!-- Summary strip -->
		<div class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
			{#each [
				{ label: 'Likes given', value: activity.likes.length },
				{ label: 'Passes given', value: activity.passes.length },
				{ label: 'Matches', value: activity.matches.length },
				{ label: 'Messages sent', value: activity.messages.length },
				{ label: 'Events logged', value: activity.events.length },
			] as kpi}
				<div class="card text-center">
					<div class="text-xl font-bold text-emerald-400">{kpi.value}</div>
					<div class="mt-0.5 text-xs text-slate-500">{kpi.label}</div>
				</div>
			{/each}
		</div>

		<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">

			<!-- Matches -->
			<div class="card">
				<h2 class="chart-title">Matches ({activity.matches.length})</h2>
				{#if activity.matches.length === 0}
					<p class="text-sm text-slate-600">No matches</p>
				{:else}
					<div class="space-y-2 max-h-64 overflow-y-auto pr-1">
						{#each activity.matches as m}
							<div class="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2 text-sm">
								<span class="font-medium text-slate-200">{m.otherUser?.first_name ?? '—'}</span>
								<span class="text-xs text-slate-500">{m.otherUser?.archetype ?? ''}</span>
								<span class="rounded px-1.5 py-0.5 text-xs {m.status === 'mutual' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}">{m.status}</span>
								<span class="text-xs text-slate-600">{fmtDate(m.created_at)}</span>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Likes given -->
			<div class="card">
				<h2 class="chart-title">Liked profiles ({activity.likes.length})</h2>
				{#if activity.likes.length === 0}
					<p class="text-sm text-slate-600">None</p>
				{:else}
					<div class="space-y-2 max-h-64 overflow-y-auto pr-1">
						{#each activity.likes as l}
							<div class="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2 text-sm">
								<span class="font-medium text-slate-200">{(l.verified_vibe_users as any)?.first_name ?? l.liked_user_id.slice(0,8)}</span>
								<span class="text-xs text-slate-500">{(l.verified_vibe_users as any)?.archetype ?? ''}</span>
								<span class="text-xs text-slate-600">{fmtDate(l.created_at)}</span>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Passes -->
			<div class="card">
				<h2 class="chart-title">Passed profiles ({activity.passes.length})</h2>
				{#if activity.passes.length === 0}
					<p class="text-sm text-slate-600">None</p>
				{:else}
					<div class="space-y-2 max-h-64 overflow-y-auto pr-1">
						{#each activity.passes as p}
							<div class="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2 text-sm">
								<span class="font-medium text-slate-200">{(p.verified_vibe_users as any)?.first_name ?? p.passed_user_id.slice(0,8)}</span>
								<span class="text-xs text-slate-500">{(p.verified_vibe_users as any)?.archetype ?? ''}</span>
								<span class="text-xs text-slate-600">{fmtDate(p.created_at)}</span>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Messages sent -->
			<div class="card">
				<h2 class="chart-title">Messages sent ({activity.messages.length})</h2>
				{#if activity.messages.length === 0}
					<p class="text-sm text-slate-600">No messages</p>
				{:else}
					<div class="space-y-2 max-h-64 overflow-y-auto pr-1">
						{#each activity.messages as m}
							<div class="rounded-lg bg-white/[0.03] px-3 py-2 text-sm">
								<div class="flex justify-between mb-1">
									<span class="text-xs text-slate-500">match {m.match_id.slice(0,8)}</span>
									<span class="text-xs text-slate-600">{fmtDate(m.created_at)}</span>
								</div>
								<p class="text-slate-300 truncate">{m.content}</p>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Analytics events -->
			{#if activity.events.length > 0}
			<div class="card">
				<h2 class="chart-title">Analytics events ({activity.events.length})</h2>
				<div class="space-y-2 max-h-64 overflow-y-auto pr-1">
					{#each activity.events as e}
						<div class="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2 text-sm">
							<span class="text-slate-300">{e.event_type}</span>
							<span class="text-xs text-slate-600">{fmtDate(e.created_at)}</span>
						</div>
					{/each}
				</div>
			</div>
			{/if}

			<!-- AI Bestie feedback -->
			{#if activity.bestieFeedback.length > 0}
			<div class="card">
				<h2 class="chart-title">AI Bestie feedback ({activity.bestieFeedback.length})</h2>
				<div class="space-y-2 max-h-64 overflow-y-auto pr-1">
					{#each activity.bestieFeedback as f}
						<div class="rounded-lg bg-white/[0.03] px-3 py-2 text-sm">
							<div class="flex justify-between mb-1">
								<span class="rounded px-1.5 py-0.5 text-xs bg-pink-500/20 text-pink-400">{f.feedback_type}</span>
								<span class="text-xs text-slate-600">{fmtDate(f.created_at)}</span>
							</div>
							{#if f.message_content}
								<p class="text-slate-400 text-xs truncate">{f.message_content}</p>
							{/if}
						</div>
					{/each}
				</div>
			</div>
			{/if}

			<!-- Attention messages sent -->
			{#if activity.attentionSent.length > 0}
			<div class="card">
				<h2 class="chart-title">Attention messages sent ({activity.attentionSent.length})</h2>
				<div class="space-y-2 max-h-64 overflow-y-auto pr-1">
					{#each activity.attentionSent as a}
						<div class="rounded-lg bg-white/[0.03] px-3 py-2 text-sm">
							<div class="flex justify-between mb-1">
								<span class="text-slate-300">→ {(a.verified_vibe_users as any)?.first_name ?? '?'}</span>
								<span class="text-xs text-slate-600">{fmtDate(a.created_at)}</span>
							</div>
							<p class="text-slate-400 text-xs truncate">{a.content}</p>
						</div>
					{/each}
				</div>
			</div>
			{/if}

			<!-- Attention messages received -->
			{#if activity.attentionReceived.length > 0}
			<div class="card">
				<h2 class="chart-title">Attention messages received ({activity.attentionReceived.length})</h2>
				<div class="space-y-2 max-h-64 overflow-y-auto pr-1">
					{#each activity.attentionReceived as a}
						<div class="rounded-lg bg-white/[0.03] px-3 py-2 text-sm">
							<div class="flex justify-between mb-1">
								<span class="text-slate-300">← {(a.verified_vibe_users as any)?.first_name ?? '?'}</span>
								<span class="text-xs {a.is_read ? 'text-slate-600' : 'text-amber-400'}">{a.is_read ? 'read' : 'unread'} · {fmtDate(a.created_at)}</span>
							</div>
							<p class="text-slate-400 text-xs truncate">{a.content}</p>
							{#if a.reply_content}
								<p class="text-emerald-400 text-xs mt-1 truncate">↩ {a.reply_content}</p>
							{/if}
						</div>
					{/each}
				</div>
			</div>
			{/if}

			<!-- AI conversations -->
			{#if activity.aiConvos.length > 0}
			<div class="card">
				<h2 class="chart-title">AI conversations ({activity.aiConvos.length})</h2>
				<div class="space-y-2 max-h-64 overflow-y-auto pr-1">
					{#each activity.aiConvos as c}
						<div class="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2 text-sm">
							<span class="rounded px-1.5 py-0.5 text-xs bg-indigo-500/20 text-indigo-400">{c.assistant_type}</span>
							<span class="text-slate-400">{c.exchange_count} exchanges</span>
							<span class="text-xs {c.is_active ? 'text-emerald-400' : 'text-slate-600'}">{c.is_active ? 'active' : 'ended'}</span>
							<span class="text-xs text-slate-600">{fmtDate(c.updated_at)}</span>
						</div>
					{/each}
				</div>
			</div>
			{/if}

		</div>
	{:else if !selectedUserId}
		<div class="text-center py-16 text-slate-600 text-sm">Select a user above to explore their activity</div>
	{/if}
{/if}

{#if activeTab === 'ai_latency'}
	<!-- ── AI Latency Tab ────────────────────────────────────────────────── -->
	<p class="mb-6 text-sm text-slate-500">
		Lag for AI Bestie auto-responses, measured end to end: from the user's message
		landing on the server, through generation, delivery, and paint on the recipient's screen.
		Tracked across {data.aiLatency.count} response{data.aiLatency.count === 1 ? '' : 's'}.
		<a
			href="https://github.com/sreme19/pocket-dating-coach/wiki/AI-Latency-Metrics"
			target="_blank"
			rel="noopener noreferrer"
			class="text-emerald-400 hover:text-emerald-300 hover:underline">How these metrics are derived →</a
		>
	</p>

	{#if data.aiLatency.count === 0}
		<div class="text-center py-16 text-slate-600 text-sm">
			No AI responses tracked yet. Send a message to a woman with AI Bestie active — its timing will appear here.
		</div>
	{:else}
		<!-- Stage KPI cards -->
		<div class="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
			{#each [
				{ key: 'endToEnd', label: 'End-to-end', hint: 'user message → on screen' },
				{ key: 'generation', label: 'Generation', hint: 'server: reads + Claude + write' },
				{ key: 'claude', label: 'Claude API', hint: 'model call only' },
				{ key: 'surface', label: 'Delivery', hint: 'generated → received (poll gap)' },
				{ key: 'render', label: 'Render', hint: 'received → painted' },
			] as s}
				{@const st = (data.aiLatency.stages as any)[s.key]}
				<div class="card">
					<div class="text-xs font-semibold uppercase tracking-wide text-slate-500">{s.label}</div>
					<div class="mt-1 text-2xl font-bold text-emerald-400">{fmtMs(st.avg)}</div>
					<div class="mt-0.5 text-xs text-slate-500">avg · {st.n} sample{st.n === 1 ? '' : 's'}</div>
					<div class="mt-2 flex justify-between text-xs text-slate-400">
						<span>p50 {fmtMs(st.p50)}</span>
						<span>p95 {fmtMs(st.p95)}</span>
						<span>max {fmtMs(st.max)}</span>
					</div>
					<div class="mt-1 text-[11px] text-slate-600">{s.hint}</div>
				</div>
			{/each}
		</div>

		<!-- Recent responses, grouped by chat session -->
		<div class="space-y-6">
			{#each data.aiLatency.sessions as session}
				<div class="card">
					<div class="mb-3 flex items-baseline justify-between">
						<h2 class="chart-title mb-0 normal-case tracking-normal text-sm text-slate-200">{session.label}</h2>
						<span class="text-xs text-slate-500">
							{session.count} response{session.count === 1 ? '' : 's'}
							{#if session.stages.endToEnd.avg != null}· avg e2e {fmtMs(session.stages.endToEnd.avg)}{/if}
							{#if session.stages.surface.avg != null}· avg delivery {fmtMs(session.stages.surface.avg)}{/if}
						</span>
					</div>
					<div class="overflow-x-auto">
						<table class="w-full text-sm">
							<thead>
								<tr class="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-white/[0.06]">
									<th class="py-2 pr-3 font-medium">When</th>
									<th class="py-2 pr-3 font-medium">Type</th>
									<th class="py-2 pr-3 font-medium">Message</th>
									<th class="py-2 pr-3 font-medium text-right">Generation</th>
									<th class="py-2 pr-3 font-medium text-right">Claude</th>
									<th class="py-2 pr-3 font-medium text-right">Delivery</th>
									<th class="py-2 pr-3 font-medium text-right">Render</th>
									<th class="py-2 font-medium text-right">End-to-end</th>
								</tr>
							</thead>
							<tbody>
								{#each session.recent as r}
									<tr class="border-b border-white/[0.03]">
										<td class="py-2 pr-3 text-slate-400 whitespace-nowrap">{fmtDate(r.at)}</td>
										<td class="py-2 pr-3">
											<span class="rounded px-1.5 py-0.5 text-xs bg-indigo-500/20 text-indigo-400">{r.responseType}</span>
										</td>
										<td class="py-2 pr-3 max-w-[28rem]">
											<div class="truncate text-slate-300" title={r.content ?? ''}>
												{r.content ?? '—'}
											</div>
											<div class="font-mono text-[10px] text-slate-600" title={r.replyMessageId}>{r.replyMessageId}</div>
										</td>
										<td class="py-2 pr-3 text-right text-slate-300">{fmtMs(r.generationMs)}</td>
										<td class="py-2 pr-3 text-right text-slate-300">{fmtMs(r.claudeMs)}</td>
										<td class="py-2 pr-3 text-right {r.surfaceMs != null && r.surfaceMs > 3000 ? 'text-amber-400' : 'text-slate-300'}">{fmtMs(r.surfaceMs)}</td>
										<td class="py-2 pr-3 text-right text-slate-300">{fmtMs(r.renderMs)}</td>
										<td class="py-2 text-right font-medium {r.endToEndMs != null && r.endToEndMs > 15000 ? 'text-rose-400' : 'text-emerald-400'}">{fmtMs(r.endToEndMs)}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			{/each}
			<p class="text-[11px] text-slate-600">
				Grouped by chat session. Dashes mean that stage wasn't recorded (e.g. the recipient's tab wasn't open to report delivery/render). Delivery is the poll gap for a live recipient; gaps over 60s are treated as staleness, not delivery, and dropped. End-to-end needs both server and client halves.
			</p>
		</div>
	{/if}
{/if}

{#if deleteTarget}
	{@const confirmed = deleteConfirmText.trim().toUpperCase() === 'DELETE'}
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
		onclick={cancelDelete}
	>
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
		<div
			class="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#0d1522] p-6 shadow-2xl"
			onclick={(e) => e.stopPropagation()}
		>
			<h3 class="text-lg font-bold text-white">Delete profile</h3>
			<p class="mt-2 text-sm text-slate-400">
				This permanently deletes
				<span class="font-semibold text-slate-200">{deleteTarget.name ?? 'this user'}</span>
				and <span class="font-semibold text-red-400">all of their data</span> — matches, messages,
				likes, AI conversations, photos and login. This cannot be undone.
			</p>

			<label class="mt-4 block text-xs font-medium text-slate-500">
				Type <span class="font-mono text-slate-300">DELETE</span> to confirm
			</label>
			<input
				type="text"
				bind:value={deleteConfirmText}
				autocomplete="off"
				disabled={deleting}
				placeholder="DELETE"
				class="mt-1 w-full rounded-lg border border-white/[0.08] bg-[#0b1120] px-3 py-2 text-sm text-slate-200 focus:border-red-500 focus:outline-none"
			/>

			{#if deleteError}
				<p class="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{deleteError}</p>
			{/if}

			<div class="mt-5 flex justify-end gap-2">
				<button
					type="button"
					onclick={cancelDelete}
					disabled={deleting}
					class="rounded-lg border border-white/[0.08] px-4 py-2 text-sm text-slate-300 transition-colors hover:bg-white/[0.04] disabled:opacity-50"
				>Cancel</button>
				<button
					type="button"
					onclick={confirmDelete}
					disabled={!confirmed || deleting}
					class="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
				>{deleting ? 'Deleting…' : 'Delete permanently'}</button>
			</div>
		</div>
	</div>
{/if}
</div>

<style>
	:global(.card) {
		border-radius: 0.75rem;
		border: 1px solid rgba(255, 255, 255, 0.06);
		background-color: #0d1522;
		padding: 1.25rem;
	}
	:global(.chart-title) {
		margin-bottom: 0.75rem;
		font-size: 0.8rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #64748b;
	}
</style>
