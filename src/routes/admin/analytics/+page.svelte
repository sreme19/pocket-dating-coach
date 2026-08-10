<script lang="ts">
	import { onMount } from 'svelte';
	import type { PageData } from './$types';
	import IstDateRangePicker from '$lib/components/IstDateRangePicker.svelte';
	import {
		GRANULARITIES,
		autoGranularity,
		bucketCount,
		formatBucket,
		formatBucketLong,
		granularityAllowed,
		istPresetRange,
		istToday,
		type Granularity
	} from '$lib/ist-dates';

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
			const seed = effectiveSeed(u);
			if (typeFilter === 'real' && seed) return false;
			if (typeFilter === 'seed' && !seed) return false;
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

	/**
	 * Several series as side-by-side bars — the sub-daily trend chart.
	 *
	 * Bar gaps are squeezed to nothing because a 2,880-bucket minute view has
	 * well under a pixel per bar, and Chart.js's default padding would drop half
	 * of them to nothing visible. `fullTitles` carries the unabbreviated bucket
	 * label for the tooltip.
	 */
	function renderGroupedBars(
		id: string,
		labels: string[],
		datasets: { label: string; data: number[]; color: string }[],
		fullTitles: string[]
	) {
		const ctx = (document.getElementById(id) as HTMLCanvasElement)?.getContext('2d');
		if (!ctx) return;
		const base = chartOptions();
		chartInstances[id] = new Chart(ctx, {
			type: 'bar',
			data: {
				labels,
				datasets: datasets.map((d) => ({
					label: d.label,
					data: d.data,
					backgroundColor: d.color,
					borderWidth: 0,
					barPercentage: 1,
					categoryPercentage: 0.98
				}))
			},
			options: {
				...base,
				plugins: {
					...base.plugins,
					tooltip: {
						callbacks: { title: (items: any[]) => fullTitles[items[0].dataIndex] ?? items[0].label }
					}
				},
				scales: {
					...base.scales,
					x: { ...base.scales?.x, ticks: { ...base.scales?.x?.ticks, maxRotation: 0, autoSkip: true, maxTicksLimit: 14 } },
					y: { ...base.scales?.y, beginAtZero: true, ticks: { ...base.scales?.y?.ticks, precision: 0 } }
				}
			}
		});
	}

	function renderDoughnut(id: string, labels: string[], data: number[], colors: string[]) {
		const ctx = (document.getElementById(id) as HTMLCanvasElement)?.getContext('2d');
		if (!ctx) return;
		chartInstances[id] = new Chart(ctx, {
			type: 'doughnut',
			data: { labels, datasets: [{ data, backgroundColor: colors }] },
			options: {
				responsive: true,
				maintainAspectRatio: false,
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
	type Tab = 'overview' | 'activity' | 'ai_latency' | 'ads';
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

	// ── Ad Analytics tab ───────────────────────────────────────────────
	//
	// Fetched on first open rather than in the page load, which already runs ten
	// queries plus a batched auth lookup per user. The other two tabs should not
	// pay for this one.
	let ads = $state<Record<string, any> | null>(null);
	let adsLoading = $state(false);
	let adsError = $state<string | null>(null);
	/**
	 * The range as explicit IST days rather than a day count, sent as start/end on
	 * every request. The picker's "Last 7/30/90 days" presets are the only way to
	 * set one — there is no second control that could disagree with it about where
	 * the window ends.
	 */
	let adsToday = $state(istToday());
	let adsStart = $state(istPresetRange('last30').start);
	let adsEnd = $state(istPresetRange('last30').end);
	/** Rupees by default; the toggle converts at display time via ad_fx_rates. */
	let adsCurrency = $state<'INR' | 'USD'>('INR');
	/**
	 * Trend bucket size. 'auto' follows the span, which is what it should be left
	 * on — the explicit options exist for going finer than auto would, to check
	 * whether a number arrived gradually or all at once.
	 */
	let adsGranularity = $state<Granularity | 'auto'>('auto');
	/** Restricts views and taps to one ad network. Composes with the audience filter. */
	let adsNetwork = $state<'all' | 'snap' | 'meta' | 'other'>('all');
	/**
	 * Restricts views and taps to one TARGETED audience, read off campaign naming.
	 * Not the gender of whoever arrived — a landing page cannot know that. Signup
	 * gender is reported separately and is deliberately not tied to this.
	 */
	let adsAudience = $state<'all' | 'men' | 'women' | 'unknown'>('all');

	const NETWORK_CHIPS = [
		{ id: 'all', label: 'All' },
		{ id: 'snap', label: 'Snap' },
		{ id: 'meta', label: 'Meta' },
		{ id: 'other', label: 'Direct' }
	] as const;
	const AUDIENCE_CHIPS = [
		{ id: 'all', label: 'All' },
		{ id: 'men', label: 'Men' },
		{ id: 'women', label: 'Women' },
		{ id: 'unknown', label: 'Untagged' }
	] as const;

	/** Real views behind a chip, from the unfiltered facets the server always returns. */
	function facetCount(facet: 'network' | 'audience', id: string): number | null {
		const f = ads?.facets?.[facet]?.views;
		if (!f) return null;
		if (id === 'all') return Object.values(f).reduce((a: number, b: any) => a + Number(b), 0);
		return Number(f[id] ?? 0);
	}

	const adsSpanDays = $derived(
		Math.round(
			(Date.parse(`${adsEnd}T00:00:00Z`) - Date.parse(`${adsStart}T00:00:00Z`)) / 86_400_000
		) + 1
	);
	/** What 'auto' currently resolves to, so the button can name it. */
	const adsAutoGranularity = $derived(autoGranularity(adsSpanDays));
	/**
	 * The granularity the server actually used, for the chart heading — which is
	 * not necessarily the one requested, since too fine a request gets coarsened.
	 */
	const adsGranularityLabel = $derived(
		GRANULARITIES.find((x) => x.id === ads?.range?.granularity)?.label.toLowerCase() ?? 'day'
	);

	async function loadAds() {
		adsLoading = true;
		adsError = null;
		try {
			// Under /admin deliberately: the session cookie is scoped to that path,
			// so an endpoint anywhere else never receives it. See the note in
			// ads-data/+server.ts.
			const res = await fetch(
				`/admin/analytics/ads-data?start=${adsStart}&end=${adsEnd}&currency=${adsCurrency}` +
					`&granularity=${adsGranularity}&network=${adsNetwork}&audience=${adsAudience}`
			);
			const body = await res.json();
			if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
			ads = body;
		} catch (e: any) {
			adsError = e?.message ?? String(e);
			ads = null;
		} finally {
			adsLoading = false;
		}
	}

	// Load once when the tab is first opened, and again whenever the range or
	// currency changes — both are server-side, so neither can be done client-side.
	$effect(() => {
		if (activeTab !== 'ads') return;
		// Referenced so the effect re-runs when either control moves.
		void adsStart;
		void adsEnd;
		void adsCurrency;
		void adsGranularity;
		void adsNetwork;
		void adsAudience;
		// Re-read the Indian day on every fetch. This dashboard gets left open for
		// days, and a stale "today" would quietly anchor the 7d/30d chips to
		// yesterday — the numbers would still look plausible.
		adsToday = istToday();
		loadAds();
	});

	/** Money, in whichever currency is selected. */
	function fmtMoney(n: number): string {
		return new Intl.NumberFormat('en-IN', {
			style: 'currency',
			currency: adsCurrency,
			maximumFractionDigits: 0
		}).format(n || 0);
	}

	/**
	 * A rate, or an explicit "too few" — never a number the sample cannot support.
	 *
	 * The server returns null below its minimum sample rather than a percentage.
	 * Rendering that as 0% would read as "nobody converted" when it means "we
	 * cannot tell yet", and those call for opposite decisions.
	 */
	function fmtRate(v: number | null, sample?: number): string {
		if (v === null || v === undefined) {
			return sample !== undefined ? `n=${sample}` : '—';
		}
		return `${(v * 100).toFixed(1)}%`;
	}

	function fmtAgo(iso: string | null): string {
		if (!iso) return 'never';
		const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
		if (mins < 60) return `${mins}m ago`;
		if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
		return `${Math.round(mins / 1440)}d ago`;
	}

	// Charts for the ads tab. Kept in their own effect so they redraw when the
	// data arrives, and are destroyed first — Chart.js leaks a canvas otherwise.
	$effect(() => {
		if (!chartjsReady || activeTab !== 'ads' || !ads) return;

		const ids = ['adsTrend', 'adsCta', 'adsTurns'];
		destroyCharts(ids);

		const keys = Object.keys(ads.trends.views);
		const g: Granularity = ads.range.granularity;
		const series = [
			{ label: 'Page views', map: ads.trends.views, color: '#10b981' },
			{ label: 'Store taps', map: ads.trends.taps, color: '#6366f1' },
			{ label: 'Signups', map: ads.trends.signups, color: '#f59e0b' }
		];

		// BARS BELOW DAILY, LINES AT DAILY. A line between sparse integer buckets
		// draws a slope that did not happen: two points a day apart become a
		// diagonal implying steady change, and an hourly series of mostly zeros
		// becomes a row of spikes joined by fiction. Bars only claim the count.
		if (g === 'day') {
			renderLine(
				'adsTrend',
				keys.map((k) => formatBucket(k, g)),
				series.map((s) => ({
					label: s.label,
					data: keys.map((k) => s.map[k] ?? 0),
					borderColor: s.color,
					backgroundColor: s.color === '#10b981' ? 'rgba(16,185,129,0.12)' : s.color === '#6366f1' ? 'rgba(99,102,241,0.12)' : 'rgba(245,158,11,0.12)'
				}))
			);
		} else {
			renderGroupedBars(
				'adsTrend',
				keys.map((k) => formatBucket(k, g)),
				series.map((s) => ({
					label: s.label,
					data: keys.map((k) => s.map[k] ?? 0),
					color: s.color
				})),
				// The axis is terse because buckets are adjacent; a tooltip is read on
				// its own and needs the day, or '14:30' is ambiguous across a range.
				keys.map((k) => formatBucketLong(k, g))
			);
		}

		const ctaLabels = Object.keys(ads.byCta);
		if (ctaLabels.length) {
			renderBar('adsCta', ctaLabels, ctaLabels.map((k) => ads!.byCta[k]), '#10b981');
		}

		const turnLabels = Object.keys(ads.lpFunnel.turnHistogram);
		renderBar('adsTurns', turnLabels, turnLabels.map((k) => ads!.lpFunnel.turnHistogram[k]), '#6366f1');

		return () => destroyCharts(ids);
	});

	// ── Toggle seed/real ───────────────────────────────────────────────
	// Local override map so changes reflect immediately without a page reload.
	let seedOverrides = $state<Record<string, boolean>>({});
	let togglingId = $state<string | null>(null);

	function effectiveSeed(u: { id: string; isSeed: boolean }): boolean {
		return u.id in seedOverrides ? seedOverrides[u.id] : u.isSeed;
	}

	async function toggleSeed(u: { id: string; isSeed: boolean }) {
		if (togglingId) return;
		const current = effectiveSeed(u);
		const next = !current;
		togglingId = u.id;
		try {
			const res = await fetch(`/admin/users/${u.id}/set-seed`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ isSeed: next }),
			});
			if (res.ok) seedOverrides = { ...seedOverrides, [u.id]: next };
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

<div class="min-h-screen bg-[#0b1120] px-4 py-6 text-slate-100 sm:px-6 sm:py-8">
	<h1 class="mb-1 text-2xl font-bold text-white">Analytics Dashboard</h1>
	<p class="mb-4 text-sm text-slate-500">Verified Vibe · Pocket Dating Coach</p>

	<!-- Tab bar -->
	<div class="mb-8 flex gap-1 overflow-x-auto border-b border-white/[0.06]">
		{#each [['overview', 'Overview'], ['activity', 'User Activity'], ['ai_latency', 'AI Latency'], ['ads', 'Ad Analytics']] as [tab, label]}
			<button
				onclick={() => activeTab = tab as Tab}
				class="whitespace-nowrap px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px {activeTab === tab ? 'border-emerald-400 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200'}"
			>{label}</button>
		{/each}
	</div>

	<!-- Global filters. Hidden on Ad Analytics, which filters by campaign, country
	     and landing page instead — leaving a gender toggle visible that silently
	     does nothing is worse than not offering one. -->
	<div class="mb-6 flex flex-wrap gap-2" class:hidden={activeTab === 'ads'}>
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
			<div class="chart-box"><canvas id="signups-chart"></canvas></div>
		</div>
		<div class="card">
			<h2 class="chart-title">Likes vs Passes — last 30 days</h2>
			<div class="chart-box"><canvas id="engagement-chart"></canvas></div>
		</div>
	</div>

	<!-- Row 2: Messages + Gender -->
	<div class="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
		<div class="card lg:col-span-2">
			<h2 class="chart-title">Messages sent — last 30 days</h2>
			<div class="chart-box"><canvas id="messages-chart"></canvas></div>
		</div>
		<div class="card">
			<h2 class="chart-title">Gender split</h2>
			<div class="chart-box"><canvas id="gender-chart"></canvas></div>
		</div>
	</div>

	<!-- Row 3: Archetypes + Trust scores -->
	<div class="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
		<div class="card">
			<h2 class="chart-title">Top archetypes</h2>
			<div class="chart-box"><canvas id="archetype-chart"></canvas></div>
		</div>
		<div class="card">
			<h2 class="chart-title">Trust score distribution</h2>
			<div class="chart-box"><canvas id="trust-chart"></canvas></div>
		</div>
	</div>

	<!-- Row 4: Analytics events + AI Bestie -->
	<div class="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
		{#if Object.keys(data.eventCounts).length}
			<div class="card">
				<h2 class="chart-title">Analytics events by type</h2>
				<div class="chart-box"><canvas id="events-chart"></canvas></div>
			</div>
		{/if}
		{#if Object.keys(data.bestieTypes).length}
			<div class="card">
				<h2 class="chart-title">AI Bestie feedback types</h2>
				<div class="chart-box"><canvas id="bestie-chart"></canvas></div>
			</div>
		{/if}
	</div>

	<!-- Female profile funnel -->
	<div class="card mb-6">
		<h2 class="chart-title">Female profile funnel</h2>
		<div class="mt-4 flex flex-wrap gap-6">
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
			<p class="mt-0.5 text-xs text-slate-500">Click a name to open user detail. Use <span class="text-slate-300">View</span> to open the public profile as members see it (opens in a new tab).</p>
		</div>
		<div class="overflow-x-auto">
			<table class="w-full min-w-[940px] text-sm">
				<thead>
					<tr class="border-b border-white/[0.06] text-left text-xs">
						{#each [
							['name', 'Name'],
							[null, 'Email'],
							['age', 'Age'],
							['city', 'City'],
							['gender', 'Gender'],
							['archetype', 'Archetype'],
							['trustScore', 'Trust'],
							[null, 'Type'],
							['joinedAt', 'Joined'],
							[null, 'View'],
							[null, ''],
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
								<a
									href="/admin/users/{u.id}"
									class="text-slate-200 hover:text-pink-400 underline decoration-dotted decoration-slate-600 underline-offset-2 hover:decoration-pink-400 transition-colors"
								>{u.name ?? '—'}</a>
							</td>
							<td class="py-2 pr-4 text-slate-400">
								{#if u.email}
									<a href={`mailto:${u.email}`} class="hover:text-pink-400 transition-colors">{u.email}</a>
								{:else}
									—
								{/if}
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
										{effectiveSeed(u)
											? 'bg-slate-500/20 text-slate-400 hover:bg-amber-500/20 hover:text-amber-400'
											: 'bg-blue-500/20 text-blue-400 hover:bg-slate-500/20 hover:text-slate-400'}">
									{togglingId === u.id ? '…' : effectiveSeed(u) ? 'seed' : 'real'}
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
							<td class="py-2 pl-2">
								<button
									onclick={() => askDelete(u)}
									title="Delete user"
									class="rounded px-1.5 py-0.5 text-xs text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
								>🗑</button>
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
						<table class="w-full min-w-[820px] text-sm">
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

{#if activeTab === 'ads'}
	<!-- ── Ad Analytics Tab ──────────────────────────────────────────────── -->
	<div class="mb-6 flex flex-wrap items-center gap-2">
		<!-- The only range control. Nothing is refetched until Update, so picking a
		     range is one query rather than one per click. -->
		<IstDateRangePicker
			start={adsStart}
			end={adsEnd}
			today={adsToday}
			onapply={({ start, end }) => {
				adsStart = start;
				adsEnd = end;
			}}
		/>
		<!-- Bucket size. Options too fine for the current span are disabled rather
		     than silently coarsened, so what is offered is what you get. -->
		<div class="flex overflow-hidden rounded-lg border border-white/[0.08] text-xs">
			<button
				onclick={() => (adsGranularity = 'auto')}
				title="Follows the range — currently {adsAutoGranularity}"
				class="px-3 py-1.5 transition-colors {adsGranularity === 'auto'
					? 'bg-emerald-500/20 text-emerald-400'
					: 'text-slate-400 hover:text-slate-200'}">Auto</button
			>
			{#each GRANULARITIES as gr}
				{@const allowed = granularityAllowed(gr.id, adsSpanDays)}
				<button
					disabled={!allowed}
					onclick={() => (adsGranularity = gr.id)}
					title={allowed
						? `${bucketCount(adsStart, adsEnd, gr.id).toLocaleString('en-IN')} buckets`
						: `Needs a range of ${gr.maxDays} day${gr.maxDays === 1 ? '' : 's'} or less`}
					class="px-3 py-1.5 transition-colors {adsGranularity === gr.id
						? 'bg-emerald-500/20 text-emerald-400'
						: 'text-slate-400 hover:text-slate-200'} disabled:cursor-not-allowed disabled:text-slate-700 disabled:hover:text-slate-700"
					>{gr.label}</button
				>
			{/each}
		</div>
		<div class="flex overflow-hidden rounded-lg border border-white/[0.08] text-xs">
			{#each ['INR', 'USD'] as c}
				<button
					onclick={() => (adsCurrency = c as 'INR' | 'USD')}
					class="px-3 py-1.5 transition-colors {adsCurrency === c
						? 'bg-indigo-500/20 text-indigo-400'
						: 'text-slate-400 hover:text-slate-200'}">{c}</button
				>
			{/each}
		</div>
		<!-- Network. Composes with the quality filter rather than replacing it: the
		     counts on these chips are already crawler-free. -->
		<div class="flex overflow-hidden rounded-lg border border-white/[0.08] text-xs">
			{#each NETWORK_CHIPS as chip}
				{@const n = facetCount('network', chip.id)}
				<button
					onclick={() => (adsNetwork = chip.id)}
					class="px-3 py-1.5 transition-colors {adsNetwork === chip.id
						? 'bg-sky-500/20 text-sky-300'
						: 'text-slate-400 hover:text-slate-200'}"
					>{chip.label}{#if n !== null}<span class="ml-1 opacity-50">{n}</span>{/if}</button
				>
			{/each}
		</div>
		<!-- Audience TARGETED, read off campaign naming — not the gender of whoever
		     arrived, which the landing page cannot know. Signup gender is a separate
		     population and is reported separately below. -->
		<div class="flex overflow-hidden rounded-lg border border-white/[0.08] text-xs">
			{#each AUDIENCE_CHIPS as chip}
				{@const n = facetCount('audience', chip.id)}
				<button
					onclick={() => (adsAudience = chip.id)}
					title={chip.id === 'unknown'
						? 'Campaign naming carries no audience — Meta sends a numeric campaign id'
						: 'Audience the campaign targeted, from its name'}
					class="px-3 py-1.5 transition-colors {adsAudience === chip.id
						? 'bg-fuchsia-500/20 text-fuchsia-300'
						: 'text-slate-400 hover:text-slate-200'}"
					>{chip.label}{#if n !== null}<span class="ml-1 opacity-50">{n}</span>{/if}</button
				>
			{/each}
		</div>
		{#if ads}
			<!-- The range the server actually aggregated, which is the only one the
			     numbers below describe. Says so out loud when it had to adjust the
			     request rather than letting the picker and the charts disagree. -->
			<span class="text-[11px] {ads.rangeClamped ? 'text-amber-400' : 'text-slate-600'}"
				>{ads.rangeClamped ? '⚠ shortened to ' : ''}{ads.range.start} → {ads.range.end} · {ads
					.range.days} days in {ads.range.buckets.toLocaleString('en-IN')}
				{ads.range.granularity} bucket{ads.range.buckets === 1 ? '' : 's'} ({ads.range
					.timezone}){ads.granularityClamped ? ' · granularity coarsened to fit the range' : ''}</span
			>
		{/if}
	</div>

	{#if adsLoading}
		<div class="py-16 text-center text-sm text-slate-600">Loading campaign data…</div>
	{:else if adsError}
		<div class="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">
			Could not load ad analytics: {adsError}
		</div>
	{:else if ads}
		<!-- Anomalies. Deliberately above every chart: on a day when something is
		     broken, this is the only thing on the page worth reading. -->
		{#if ads.anomalies.length}
			<div class="mb-6 space-y-2">
				{#each ads.anomalies as note}
					<div
						class="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-300"
					>
						⚠ {note}
					</div>
				{/each}
			</div>
		{/if}

		<!-- Data health. First, not last: at these volumes the instrumentation is
		     likelier to be wrong than the campaign, and every number below is
		     worthless if the pipes are not running. -->
		<div class="card mb-6">
			<div class="chart-title">Data health</div>
			<div class="grid grid-cols-2 gap-4 text-xs sm:grid-cols-4">
				<div>
					<div class="text-slate-500">Page views recorded</div>
					<div class="text-lg font-semibold text-white">{ads.health.counts.views}</div>
				</div>
				<div>
					<div class="text-slate-500">Store taps recorded</div>
					<div class="text-lg font-semibold text-white">{ads.health.counts.taps}</div>
				</div>
				<div>
					<div class="text-slate-500">Signups attributed</div>
					<div class="text-lg font-semibold text-white">
						{ads.health.counts.attributedSignups}/{ads.health.counts.totalSignups}
					</div>
					<div class="text-[11px] text-slate-600">
						{fmtRate(ads.health.attributionCoverage, ads.health.counts.totalSignups)} coverage
					</div>
				</div>
				<div>
					<div class="text-slate-500">Spend rows</div>
					<div class="text-lg font-semibold text-white">{ads.health.counts.spendRows}</div>
					<div class="text-[11px] text-slate-600">
						snap {fmtAgo(ads.health.lastSpendFetch.snap)} · meta {fmtAgo(
							ads.health.lastSpendFetch.meta
						)}
					</div>
				</div>
			</div>

			<div class="mt-4 grid gap-2 text-[11px] text-slate-500 sm:grid-cols-2">
				<div>
					Conversion forwards — Snap {ads.health.snapForwardOk} ok / {ads.health
						.snapForwardFailed} failed · Meta {ads.health.metaForwardOk} ok / {ads.health
						.metaForwardFailed} failed
				</div>
				<div>
					Credentials present — Snap:
					{Object.entries(ads.spendConfig.snap)
						.filter(([, v]) => v)
						.map(([k]) => k)
						.join(', ') || 'none'} · Meta:
					{Object.entries(ads.spendConfig.meta)
						.filter(([, v]) => v)
						.map(([k]) => k)
						.join(', ') || 'none'}
				</div>
				{#if ads.health.tapsWithoutVisit > 0}
					<div class="text-amber-400/80">
						{ads.health.tapsWithoutVisit} tap{ads.health.tapsWithoutVisit === 1 ? '' : 's'} carried no
						visit id and sit outside the per-visit rate (blocked sessionStorage, or recorded before
						the beacon shipped).
					</div>
				{/if}
				{#if ads.health.iosMembers > 0}
					<div class="text-amber-400/80">
						{ads.health.iosMembers} iOS member{ads.health.iosMembers === 1 ? '' : 's'} — iOS has no
						install referrer, so these are unattributable, not organic.
					</div>
				{/if}
				{#each Object.entries(ads.health.tables) as [name, err]}
					{#if err}
						<div class="text-red-400">{name}: {err}</div>
					{/if}
				{/each}
			</div>
		</div>

		<!-- Network and audience split. ALWAYS THE FULL PICTURE, never narrowed by
		     the chips above: the moment you filter to one network, the thing you
		     most need is the denominator you just filtered away. -->
		<div class="card mb-6">
			<div class="mb-1 flex flex-wrap items-baseline justify-between gap-3">
				<div class="chart-title mb-0">Split by network and targeted audience</div>
				<span class="text-[11px] text-slate-600">whole range, ignores the filters above</span>
			</div>
			<p class="mb-4 text-[11px] text-slate-600">
				Real views are what survives the quality filter; excluded rows are shown beside them, not
				dropped. Audience is what the campaign <em>targeted</em>, read off its name — not who
				arrived. Rates are withheld below n={ads.minSample}.
			</p>

			<div class="grid gap-6 lg:grid-cols-2">
				{#each [{ facet: 'network', chips: NETWORK_CHIPS, active: adsNetwork }, { facet: 'audience', chips: AUDIENCE_CHIPS, active: adsAudience }] as group}
					{@const f = ads.facets[group.facet]}
					{@const rows = group.chips.filter((c) => c.id !== 'all')}
					<!-- Bars are scaled to the biggest raw total in this group, so the two
					     groups stay independently readable rather than one dwarfing the other. -->
					{@const scale = Math.max(
						1,
						...rows.map((c) => Number(f.views[c.id] ?? 0) + Number(f.viewsExcluded[c.id] ?? 0))
					)}
					<div>
						<div class="mb-2 text-[11px] uppercase tracking-wide text-slate-500">
							{group.facet === 'network' ? 'Ad network' : 'Targeted audience'}
						</div>
						{#each rows as chip}
							{@const real = Number(f.views[chip.id] ?? 0)}
							{@const excl = Number(f.viewsExcluded[chip.id] ?? 0)}
							{@const taps = Number(f.taps[chip.id] ?? 0)}
							{@const dim = group.active !== 'all' && group.active !== chip.id}
							<div class="mb-3 {dim ? 'opacity-40' : ''}">
								<div class="flex items-baseline gap-2 text-xs">
									<span class="min-w-[3.5rem] font-medium text-slate-200">{chip.label}</span>
									<span class="text-slate-400">{real} real</span>
									{#if excl > 0}
										<span class="text-slate-600">of {real + excl} raw</span>
									{/if}
									<span class="ml-auto text-slate-400"
										>{taps} tap{taps === 1 ? '' : 's'} ·
										{#if real >= ads.minSample}
											{((100 * taps) / real).toFixed(1)}%
										{:else}
											<span class="text-slate-600" title="{real} views is below the minimum sample"
												>n&lt;{ads.minSample}</span
											>
										{/if}
									</span>
								</div>
								<!-- Solid = counted, faded = set aside. One bar so the ratio is
								     readable without doing the subtraction. -->
								<div class="mt-1 flex h-1.5 overflow-hidden rounded bg-white/[0.04]">
									<div
										class={group.facet === 'network' ? 'bg-sky-400' : 'bg-fuchsia-400'}
										style="width:{(100 * real) / scale}%"
									></div>
									<div
										class={group.facet === 'network' ? 'bg-sky-400/25' : 'bg-fuchsia-400/25'}
										style="width:{(100 * excl) / scale}%"
									></div>
								</div>
								{#if taps > 0 && real === 0}
									<!-- A tap can outlive its view when the view was excluded. Said
									     rather than divided, or the rate reads above 100%. -->
									<div class="mt-1 text-[10px] text-amber-500/80">
										{taps} tap{taps === 1 ? '' : 's'} with no surviving view — no rate possible
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{/each}
			</div>

			<!-- Why rows were set aside, and how confidently the rest was placed. The
			     server has always returned this; it had nowhere to be shown. -->
			<div class="mt-2 border-t border-white/[0.06] pt-3">
				<div class="mb-2 text-[11px] uppercase tracking-wide text-slate-500">
					Set aside, and how the rest was placed
				</div>
				<div class="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-xs">
					{#each Object.entries(ads.traffic.byReason) as [, info]}
						<span class="text-slate-400"
							>{(info as any).count}
							<span class="text-slate-600">{(info as any).label.toLowerCase()}</span></span
						>
					{:else}
						<span class="text-slate-600">nothing excluded in this window</span>
					{/each}
				</div>
				{#if ads.traffic.viewsReconciledByName || ads.traffic.viewsUnattributed}
					<!-- Two different confidence levels, kept apart: a name match is placed
					     and countable, an unattributed row is neither, and only the second
					     needs chasing. -->
					<div class="mt-1.5 flex flex-wrap items-baseline gap-x-5 gap-y-1 text-xs">
						{#if ads.traffic.viewsReconciledByName}
							<span
								class="text-slate-400"
								title="No ad set id in utm_term, but the campaign name matched an ad set that spend gave an id to"
								>{ads.traffic.viewsReconciledByName}
								<span class="text-slate-600">matched to an ad set by name</span></span
							>
						{/if}
						{#if ads.traffic.viewsUnattributed}
							<span
								class="text-amber-400/80"
								title="No ad set id and no name match — these cannot be tied to spend"
								>{ads.traffic.viewsUnattributed}
								<span class="text-amber-400/60">could not be placed at all</span></span
							>
						{/if}
					</div>
				{/if}
			</div>

			<!-- Actual signup gender. A DIFFERENT POPULATION from the audience filter,
			     so it is kept in its own block with the join gap stated. -->
			<div class="mt-3 border-t border-white/[0.06] pt-3">
				<div class="mb-2 text-[11px] uppercase tracking-wide text-slate-500">
					Signups by actual gender
				</div>
				<div class="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-xs text-slate-300">
					<span>{ads.signupGender.man} men</span>
					<span>{ads.signupGender.woman} women</span>
					{#if ads.signupGender.unknown > 0}
						<span class="text-slate-500">{ads.signupGender.unknown} unstated</span>
					{/if}
				</div>
				<p class="mt-2 text-[11px] {ads.signupGender.joinableToCampaign ? 'text-slate-600' : 'text-amber-400/80'}">
					{#if ads.signupGender.joinableToCampaign}
						Whole range. This is who signed up, not who the ads targeted — a men-targeted campaign
						producing women signups is normal, and the two columns are meant to differ.
					{:else}
						Whole range, and <strong>not</strong> narrowed by the filters above — no signup can be
						joined to a campaign yet, because <code>user_acquisition</code> has no rows until the new
						Flutter build ships. Until then these totals cannot be attributed to a network or an
						audience.
					{/if}
				</p>
			</div>
		</div>

		<!-- Trends -->
		<div class="card mb-6">
			<div class="chart-title">Views, store taps and signups — per {adsGranularityLabel}</div>
			<div class="chart-box"><canvas id="adsTrend"></canvas></div>
			{#if ads.range.granularity !== 'day'}
				<!-- Said here rather than left to be inferred from a missing series:
				     spend has no time of day in it, so nothing below daily can carry a
				     cost line without inventing one. -->
				<p class="mt-2 text-[11px] text-slate-600">
					Counts only below daily. Conversion rates need n≥{ads.minSample} and almost no bucket
					reaches it; spend is reported by the ad networks one day at a time, so there is no
					honest way to split it finer.
				</p>
			{/if}
		</div>

		<!-- Per-visit funnel + CTA breakdown -->
		<div class="mb-6 grid gap-4 lg:grid-cols-2">
			<div class="card">
				<div class="chart-title">Visit → store tap</div>
				<div class="flex items-baseline gap-3">
					<div class="text-3xl font-bold text-white">
						{fmtRate(ads.visitFunnel.tapRate, ads.visitFunnel.visits)}
					</div>
					<div class="text-xs text-slate-500">
						{ads.visitFunnel.tapped} of {ads.visitFunnel.visits} visits
					</div>
				</div>
				<p class="mt-3 text-[11px] leading-relaxed text-slate-600">
					A join on visit id, not two totals divided by each other — so a visitor who tapped three
					times counts once, and a reload cannot push this over 100%.
					{#if ads.visitFunnel.visits < ads.minSample}
						Below {ads.minSample} visits the rate is withheld rather than shown as a number the
						sample cannot support.
					{/if}
				</p>
			</div>
			<div class="card">
				<div class="chart-title">Taps by CTA position</div>
				<div class="chart-box"><canvas id="adsCta"></canvas></div>
			</div>
		</div>

		<!-- Landing page variants + country -->
		<div class="mb-6 grid gap-4 lg:grid-cols-2">
			<div class="card">
				<div class="chart-title">Landing page variants</div>
				<table class="w-full text-xs">
					<thead class="text-slate-500">
						<tr><th class="py-1 text-left">Page</th><th class="text-right">Views</th><th class="text-right">Taps</th><th class="text-right">Tap rate</th></tr>
					</thead>
					<tbody>
						{#each Object.entries(ads.byPage) as [pageName, s]}
							<tr class="border-t border-white/[0.04]">
								<td class="py-1.5 text-slate-300">{pageName}</td>
								<td class="text-right text-slate-400">{s.views}</td>
								<td class="text-right text-slate-400">{s.taps}</td>
								<td class="text-right text-slate-400"
									>{fmtRate(s.views >= ads.minSample ? s.taps / s.views : null, s.views)}</td
								>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<div class="card">
				<div class="chart-title">By country</div>
				<table class="w-full text-xs">
					<thead class="text-slate-500">
						<tr><th class="py-1 text-left">Country</th><th class="text-right">Views</th><th class="text-right">Taps</th><th class="text-right">Tap rate</th></tr>
					</thead>
					<tbody>
						{#each Object.entries(ads.byCountry).sort((a, b) => b[1].views - a[1].views) as [code, s]}
							<tr class="border-t border-white/[0.04]">
								<td class="py-1.5 text-slate-300">{code}</td>
								<td class="text-right text-slate-400">{s.views}</td>
								<td class="text-right text-slate-400">{s.taps}</td>
								<td class="text-right text-slate-400"
									>{fmtRate(s.views >= ads.minSample ? s.taps / s.views : null, s.views)}</td
								>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>

		<!-- Ad set leaderboard. Named for what the rows actually are: the rollup is
		     keyed on ad set, because that is the only key spend and traffic share. -->
		<div class="card mb-6 overflow-x-auto">
			<div class="chart-title">Ad set leaderboard · spend in {adsCurrency}</div>
			<!-- 13px over text-xs, and values at slate-200 rather than slate-400:
			     slate-400 on this background is about 4:1, under the 4.5:1 threshold,
			     and it failed worst on the numeric columns where it matters most.
			     Headers stay dimmer — the hierarchy was never the problem. -->
			<table class="w-full min-w-[52rem] text-[13px]">
				<thead class="text-slate-500">
					<tr>
						<th class="py-1 text-left">Ad set</th>
						<th class="text-right">Spend</th>
						<th class="text-right">Impr.</th>
						<th class="text-right">Views</th>
						<th class="text-right">Taps</th>
						<th class="text-right">Tap rate</th>
						<th class="text-right">Signups</th>
						<th class="text-right">Cost/signup</th>
					</tr>
				</thead>
				<tbody>
					{#each ads.leaderboard as c}
						<tr class="border-t border-white/[0.04]">
							<td class="py-1.5 text-slate-200">{c.campaign}</td>
							<!-- A literal zero stays dim so a row of zeros does not compete with
							     the rows that actually have data. -->
							<td class="text-right tabular-nums text-slate-200"
								>{c.spend ? fmtMoney(c.spend) : '—'}</td
							>
							<td class="text-right tabular-nums text-slate-200">{c.impressions || '—'}</td>
							<td class="text-right tabular-nums {c.views ? 'text-slate-200' : 'text-slate-500'}"
								>{c.views}</td
							>
							<td class="text-right tabular-nums {c.taps ? 'text-slate-200' : 'text-slate-500'}"
								>{c.taps}</td
							>
							<!-- Suppressed rates keep the dimmer treatment: they are deliberately
							     de-emphasised, and that reads as intentional now the real numbers
							     beside them are legible. -->
							<td
								class="text-right tabular-nums {c.tapRate == null
									? 'text-slate-500'
									: 'text-slate-200'}">{fmtRate(c.tapRate, c.views)}</td
							>
							<td class="text-right tabular-nums {c.signups ? 'text-slate-200' : 'text-slate-500'}"
								>{c.signups}</td
							>
							<td class="text-right tabular-nums text-slate-200"
								>{c.costPerSignup ? fmtMoney(c.costPerSignup) : '—'}</td
							>
						</tr>
					{:else}
						<tr><td colspan="8" class="py-6 text-center text-slate-600">No ad set data in this window.</td></tr>
					{/each}
				</tbody>
			</table>
			<p class="mt-3 text-[11px] text-slate-600">
				Rates are withheld below {ads.minSample} observations and shown as the raw count instead — at
				current volumes most per-campaign differences are noise, and a percentage off a handful of
				visitors invites a decision the data cannot support.
			</p>
		</div>

		<!-- /aibestie conversation depth -->
		<div class="grid gap-4 lg:grid-cols-2">
			<div class="card">
				<div class="chart-title">/aibestie funnel</div>
				<table class="w-full text-xs">
					<tbody>
						{#each [['Opened the page', ads.lpFunnel.opened], ['Sent a message', ads.lpFunnel.spoke], ['Reached 3+ turns', ads.lpFunnel.reached3Turns], ['Tapped the store CTA', ads.lpFunnel.tappedCta], ['Claimed after install', ads.lpFunnel.claimed]] as [label, n]}
							<tr class="border-t border-white/[0.04]">
								<td class="py-1.5 text-slate-300">{label}</td>
								<td class="text-right font-semibold text-white">{n}</td>
								<td class="w-24 text-right text-slate-500"
									>{ads.lpFunnel.opened ? `${Math.round((Number(n) / ads.lpFunnel.opened) * 100)}%` : '—'}</td
								>
							</tr>
						{/each}
					</tbody>
				</table>
				<p class="mt-3 text-[11px] leading-relaxed text-slate-600">
					This page's mid-funnel metric is conversation depth, not clicks. Note the CTA-seen step is
					missing: <code class="text-slate-500">cta_shown_at</code> is declared in the schema and never
					written, so "tapped" cannot yet be divided by "was shown".
				</p>
			</div>
			<div class="card">
				<div class="chart-title">Turns before drop-off</div>
				<div class="chart-box"><canvas id="adsTurns"></canvas></div>
			</div>
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
		padding: 1rem;
	}
	@media (min-width: 640px) {
		:global(.card) {
			padding: 1.25rem;
		}
	}
	:global(.chart-title) {
		margin-bottom: 0.75rem;
		font-size: 0.8rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #64748b;
	}
	/*
	 * Chart canvas wrapper. Chart.js responsive mode sizes the canvas to this
	 * box, so it MUST have a definite height and be position:relative (per the
	 * Chart.js docs). We set the height here in scoped CSS rather than relying on
	 * a Tailwind height utility — if that utility ever fails to emit in a build,
	 * the box collapses to auto height and doughnut charts (aspect-ratio driven)
	 * balloon to fill the card width. This guarantees the box regardless.
	 */
	:global(.chart-box) {
		position: relative;
		height: 13rem;
	}
</style>
