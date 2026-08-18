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

	// ── Lead source ───────────────────────────────────────────────────────────
	// Resolved server-side (see lib/server/lead-source.ts). Snap and Meta keep
	// their brand colours so a glance down the column separates paid from earned.
	const LEAD_SOURCE_LABEL: Record<string, string> = {
		snap: 'snap',
		meta: 'meta',
		referral: 'referral',
		organic: 'organic',
		unknown: '—'
	};
	const LEAD_SOURCE_STYLE: Record<string, string> = {
		snap: 'bg-yellow-400/20 text-yellow-300',
		meta: 'bg-blue-500/20 text-blue-400',
		referral: 'bg-pink-500/20 text-pink-400',
		organic: 'bg-emerald-500/20 text-emerald-400',
		unknown: 'bg-white/[0.04] text-slate-500'
	};
	// Which record decided the label, in words. A source that looks wrong is
	// almost always a question about the evidence, so put it one hover away
	// instead of behind a query.
	const LEAD_SOURCE_EVIDENCE: Record<string, string> = {
		install_referrer: 'from the store install referrer',
		landing_session: 'from the landing-page visit that created this account',
		referral_invite: 'from the invite a member sent',
		referral_reward: 'from a paid referral reward',
		none: 'no arrival record exists for this member'
	};
	function leadSourceTitle(u: { leadSource: string; leadSourceDetail: string | null; leadSourceEvidence: string }) {
		const head = u.leadSource === 'unknown' ? 'Source unknown' : `Source: ${u.leadSource}`;
		const evidence = LEAD_SOURCE_EVIDENCE[u.leadSourceEvidence] ?? '';
		return [head, u.leadSourceDetail, evidence].filter(Boolean).join(' — ');
	}

	let sortCol = $state<'name' | 'age' | 'city' | 'gender' | 'archetype' | 'trustScore' | 'leadSource' | 'joinedAt'>('joinedAt');
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
	/**
	 * Leaderboard-only, and applied CLIENT-SIDE on purpose.
	 *
	 * Unlike network and audience, delivery is a property of an ad set rather than
	 * of a traffic row, so it filters table rows and must not touch the trend chart
	 * or the totals. Everything it needs is already in the response, so there is no
	 * refetch and no round trip.
	 */
	let adsDelivery = $state<'all' | 'delivering' | 'idle'>('all');

	/** When the last successful fetch landed, for the freshness stamp. */
	let adsFetchedAt = $state<number | null>(null);
	/**
	 * Ticks the stamp, and only the stamp.
	 *
	 * Nothing is refetched on this interval. A dashboard left open for an hour
	 * saying "updated 1m ago" is lying, but one that silently redraws underneath a
	 * reader is worse — so the label ages honestly and the data waits to be asked.
	 */
	let adsClock = $state(Date.now());

	$effect(() => {
		if (activeTab !== 'ads') return;
		const tick = setInterval(() => (adsClock = Date.now()), 30_000);
		return () => clearInterval(tick);
	});

	const adsFreshness = $derived.by(() => {
		if (adsFetchedAt === null) return null;
		const secs = Math.max(0, Math.round((adsClock - adsFetchedAt) / 1000));
		if (secs < 45) return 'just now';
		const mins = Math.round(secs / 60);
		if (mins < 60) return `${mins}m ago`;
		const hrs = Math.round(mins / 60);
		return hrs < 24 ? `${hrs}h ago` : `${Math.round(hrs / 24)}d ago`;
	});

	/**
	 * The newest spend sync across networks — the real freshness ceiling for every
	 * money column, and slower than the page fetch by up to an hour.
	 */
	const adsSpendSyncedAt = $derived.by(() => {
		const seen = Object.values((ads?.health?.lastSpendFetch ?? {}) as Record<string, string | null>)
			.filter((v): v is string => Boolean(v))
			.sort();
		return seen.length ? seen[seen.length - 1] : null;
	});

	/**
	 * Assembled as one string rather than interpolated around an {#if} in the
	 * markup — Svelte trims the leading whitespace inside a block, which glued the
	 * separator to the previous word as "6m ago· spend synced".
	 *
	 * Reads adsClock so the spend half ages with the tick too; fmtAgo reaches for
	 * Date.now() on its own and would otherwise freeze at whatever it first
	 * rendered.
	 */
	const adsStamp = $derived.by(() => {
		if (!adsFreshness) return null;
		void adsClock;
		return adsSpendSyncedAt
			? `updated ${adsFreshness} · spend synced ${fmtAgo(adsSpendSyncedAt)}`
			: `updated ${adsFreshness}`;
	});

	/**
	 * The network's OWN status (`deliveringNow`) wins whenever it's known — that
	 * is the real answer to "is this live right now". `delivering` (had ANY
	 * activity in the selected range) is only a fallback for rows where status
	 * has never synced, which today is every row: the migration adding the
	 * column ships alongside this UI change, not before it.
	 */
	function isCurrentlyDelivering(r: any): boolean {
		return r.deliveringNow ?? r.delivering;
	}

	const adsLeaderboard = $derived(
		((ads?.leaderboard ?? []) as any[]).filter(
			(r) =>
				adsDelivery === 'all' ||
				(adsDelivery === 'delivering' ? isCurrentlyDelivering(r) : !isCurrentlyDelivering(r))
		)
	);
	const adsDeliveryCounts = $derived({
		all: ((ads?.leaderboard ?? []) as any[]).length,
		delivering: ((ads?.leaderboard ?? []) as any[]).filter((r) => isCurrentlyDelivering(r)).length,
		idle: ((ads?.leaderboard ?? []) as any[]).filter((r) => !isCurrentlyDelivering(r)).length
	});

	/**
	 * The third dimension (ad/creative) is a per-row drill-down rather than a
	 * separate flat table — most rows have no per-ad data yet (it needs
	 * fetchSnapCreativeSpend or Meta's ad-level fetch to have run), and a
	 * column that's empty for every row except a handful reads as broken.
	 * Expansion state is keyed the same way "no ad set id" rows already
	 * distinguish themselves elsewhere on this table.
	 */
	let expandedAdSetRows = $state(new Set<string>());
	function adSetRowKey(c: any): string {
		return c.adSetId ?? c.campaign;
	}
	function toggleAdSetRow(key: string) {
		const next = new Set(expandedAdSetRows);
		if (next.has(key)) next.delete(key);
		else next.add(key);
		expandedAdSetRows = next;
	}

	/**
	 * Anomalies arrive as plain strings from the server — see ad-analytics.ts.
	 * Classified here, client-side, against the handful of fixed templates that
	 * file actually emits, so a dismiss survives an in-page Refresh (the numbers
	 * inside a message change every fetch; the ISSUE it names does not) while a
	 * real reload of the page clears the dismiss set and brings everything back.
	 *
	 * Severity governs sort order and which few show by default — six warning
	 * banners stacked above the charts is the thing being fixed here, not the
	 * anomalies themselves.
	 */
	const ANOMALY_RULES: Array<{ test: RegExp; severity: 0 | 1 | 2; key: (m: RegExpMatchArray) => string }> = [
		{ test: /^Landing page views down/, severity: 0, key: () => 'decline' },
		{ test: /^Every Snap conversion forward failed/, severity: 0, key: () => 'snap-capi' },
		{ test: /^Every Meta conversion forward failed/, severity: 0, key: () => 'meta-capi' },
		{
			test: /^(.+?): \d+ clicks charged for and zero landing page views/,
			severity: 0,
			key: (m) => `spend-leak:${m[1]}`
		},
		{ test: /^Spend in a currency with no/, severity: 1, key: () => 'fx-missing' },
		{ test: /^(.+?): \d+ store taps and zero attributed signups\./, severity: 1, key: (m) => `zero-signup:${m[1]}` },
		{ test: /arrived in the single minute/, severity: 2, key: () => 'burst' }
	];
	function classifyAnomaly(note: string): { key: string; severity: 0 | 1 | 2 } {
		for (const rule of ANOMALY_RULES) {
			const m = note.match(rule.test);
			if (m) return { key: rule.key(m), severity: rule.severity };
		}
		return { key: note, severity: 1 };
	}

	/** In-memory only — a fresh page load is what brings a dismissed anomaly back. */
	let dismissedAnomalies = $state(new Set<string>());
	/** How many surface before the reader has to ask for more. */
	const ANOMALIES_SHOWN_BY_DEFAULT = 3;
	let anomaliesExpanded = $state(false);

	const adsAnomalies = $derived.by(() => {
		const notes = (ads?.anomalies ?? []) as string[];
		return notes
			.map((note) => ({ note, ...classifyAnomaly(note) }))
			.filter((a) => !dismissedAnomalies.has(a.key))
			.sort((a, b) => a.severity - b.severity);
	});
	const adsAnomaliesVisible = $derived(
		anomaliesExpanded ? adsAnomalies : adsAnomalies.slice(0, ANOMALIES_SHOWN_BY_DEFAULT)
	);
	const adsAnomaliesHiddenCount = $derived(Math.max(0, adsAnomalies.length - adsAnomaliesVisible.length));

	function dismissAnomaly(key: string) {
		dismissedAnomalies = new Set(dismissedAnomalies).add(key);
	}

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
			// Stamped on success only, so a failed refresh does not make stale data
			// look freshly confirmed.
			adsFetchedAt = Date.now();
			adsClock = adsFetchedAt;
		} catch (e: any) {
			adsError = e?.message ?? String(e);
			// The last good numbers are deliberately NOT discarded. A failed refresh
			// used to blank the tab, which turns one transient error into losing the
			// data you were reading; the error shows as a banner above it instead.
			// A failed first load has nothing to keep, and `ads` is already null.
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

	/**
	 * Object.entries with the value type kept.
	 *
	 * `ads` is a Record<string, any>, so entries off it come back with values the
	 * template cannot see into. Naming the shape at the call site is the smallest
	 * thing that makes a breakdown table type-check instead of silently accepting
	 * `s.tpas`.
	 */
	function entriesOf<T>(source: unknown): Array<[string, T]> {
		return Object.entries((source ?? {}) as Record<string, T>);
	}

	type GeoCell = { views: number; taps: number };
	type DemoBucket = { bucket: string; spend: number; impressions: number; clicks: number };

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
			<table class="w-full min-w-[1040px] text-sm">
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
							['leadSource', 'Source'],
							[null, 'Ad'],
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
								<!--
									Lead source. Unknown prints a dash rather than a channel name:
									install attribution only starts arriving with the build that reads
									the Play referrer, so members who predate it have no record of
									where they came from — and calling that "organic" would invent a
									channel nobody bought or earned. Hover cites the record that
									decided it.
								-->
								<span
									title={leadSourceTitle(u)}
									class="rounded px-1.5 py-0.5 text-xs font-medium {LEAD_SOURCE_STYLE[u.leadSource] ?? LEAD_SOURCE_STYLE.unknown}"
								>{LEAD_SOURCE_LABEL[u.leadSource] ?? '—'}</span>
							</td>
							<td class="py-2 pr-4 text-slate-400 max-w-[220px] truncate" title={u.adName ?? ''}>
								{u.adName ?? '—'}
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
								<!--
									A provisional row is an /aibestie landing-page visitor: no signup, no
									photos, no archetype, so the public profile preview shows an empty
									shell. The one thing there IS to look at is what he said to her
									Bestie — so View goes straight to that transcript instead.
								-->
								{#if u.isProvisional}
									<a
										href={`/admin/users/${u.id}?chat=1`}
										target="_blank"
										rel="noopener"
										title="Landing-page visitor — open the conversation he had with her AI bestie"
										class="inline-flex items-center gap-1 rounded border border-purple-400/20 px-2 py-0.5 text-xs text-purple-300 transition-colors hover:border-purple-400/50 hover:text-purple-200"
									>
										Chat ↗
									</a>
								{:else}
									<a
										href={`/verified-vibe/profile/${u.id}?adminPreview=1&as=${u.gender === 'man' ? 'woman' : 'man'}`}
										target="_blank"
										rel="noopener"
										title="Open the public profile as members see it"
										class="inline-flex items-center gap-1 rounded border border-white/10 px-2 py-0.5 text-xs text-slate-300 transition-colors hover:border-emerald-400/40 hover:text-emerald-300"
									>
										View ↗
									</a>
								{/if}
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
	<!-- ads-scale exists for one reason: .chart-title is a :global rule shared
	     with Overview, User Activity and AI Latency, so its size cannot be bumped
	     in place without moving three tabs nobody asked to change. Scoping it to
	     this wrapper keeps the 1.25 confined to the tab it was asked for. -->
	<div class="ads-scale">
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
		<div class="flex overflow-hidden rounded-lg border border-white/[0.08] text-[15px]">
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
		<div class="flex overflow-hidden rounded-lg border border-white/[0.08] text-[15px]">
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
		<div class="flex overflow-hidden rounded-lg border border-white/[0.08] text-[15px]">
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
		<div class="flex overflow-hidden rounded-lg border border-white/[0.08] text-[15px]">
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
		<!-- Manual, not polled. Keeps the old numbers on screen while it refetches,
		     so a refresh is not a blank page. -->
		<button
			onclick={loadAds}
			disabled={adsLoading}
			title={adsSpendSyncedAt
				? `Spend last synced ${fmtAgo(adsSpendSyncedAt)} — the cron runs hourly at :20`
				: 'Spend has never synced'}
			class="flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-3 py-1.5 text-[15px] text-slate-300 transition-colors hover:border-white/20 hover:text-slate-100 disabled:cursor-not-allowed disabled:text-slate-600"
		>
			<span class={adsLoading ? 'animate-spin' : ''} aria-hidden="true">↻</span>
			{adsLoading ? 'Refreshing…' : 'Refresh'}
		</button>
		{#if adsStamp}
			<span class="text-[14px] text-slate-600">{adsStamp}</span>
		{/if}
		{#if ads}
			<!-- The range the server actually aggregated, which is the only one the
			     numbers below describe. Says so out loud when it had to adjust the
			     request rather than letting the picker and the charts disagree. -->
			<span class="text-[14px] {ads.rangeClamped ? 'text-amber-400' : 'text-slate-600'}"
				>{ads.rangeClamped ? '⚠ shortened to ' : ''}{ads.range.start} → {ads.range.end} · {ads
					.range.days} days in {ads.range.buckets.toLocaleString('en-IN')}
				{ads.range.granularity} bucket{ads.range.buckets === 1 ? '' : 's'} ({ads.range
					.timezone}){ads.granularityClamped ? ' · granularity coarsened to fit the range' : ''}</span
			>
		{/if}
	</div>

	<!-- The full-page loader is for the FIRST load only. On a refresh the previous
	     numbers stay on screen — blanking a dashboard you asked to update is how a
	     refresh button becomes something you avoid pressing. -->
	{#if adsLoading && !ads}
		<div class="py-16 text-center text-[17px] text-slate-600">Loading campaign data…</div>
	{:else if adsError && !ads}
		<div class="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-[17px] text-red-300">
			Could not load ad analytics: {adsError}
		</div>
	{:else if ads}
		{#if adsError}
			<!-- Refresh failed but the previous numbers are still on screen. Says which
			     they are, so nothing below is mistaken for current. -->
			<div
				class="mb-6 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[15px] text-amber-300"
			>
				⚠ Refresh failed ({adsError}). Showing the last successful load{adsFreshness
					? `, from ${adsFreshness}`
					: ''}.
			</div>
		{/if}
		<!-- Anomalies. Deliberately above every chart: on a day when something is
		     broken, this is the only thing on the page worth reading. Capped and
		     dismissible so that "something is broken" does not itself become the
		     thing crowding the rest of the page out — see classifyAnomaly above. -->
		{#if adsAnomalies.length}
			<div class="mb-6 space-y-2">
				{#each adsAnomaliesVisible as a (a.key)}
					<div
						class="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[15px] text-amber-300"
					>
						<span class="flex-1">⚠ {a.note}</span>
						<button
							onclick={() => dismissAnomaly(a.key)}
							title="Dismiss — reappears next time this dashboard is opened"
							class="shrink-0 rounded px-1.5 text-amber-300/60 transition-colors hover:bg-amber-500/10 hover:text-amber-200"
							>✕</button
						>
					</div>
				{/each}
				{#if adsAnomaliesHiddenCount > 0}
					<button
						onclick={() => (anomaliesExpanded = true)}
						class="text-[14px] text-amber-300/70 transition-colors hover:text-amber-200"
						>Show {adsAnomaliesHiddenCount} more issue{adsAnomaliesHiddenCount === 1 ? '' : 's'}</button
					>
				{:else if anomaliesExpanded && adsAnomalies.length > ANOMALIES_SHOWN_BY_DEFAULT}
					<button
						onclick={() => (anomaliesExpanded = false)}
						class="text-[14px] text-amber-300/70 transition-colors hover:text-amber-200">Show fewer</button
					>
				{/if}
			</div>
		{/if}

		<!-- Data health. First, not last: at these volumes the instrumentation is
		     likelier to be wrong than the campaign, and every number below is
		     worthless if the pipes are not running. -->
		<div class="card mb-6">
			<div class="chart-title">Data health</div>
			<div class="grid grid-cols-2 gap-4 text-[15px] sm:grid-cols-4">
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
					<div class="text-[14px] text-slate-600">
						{fmtRate(ads.health.attributionCoverage, ads.health.counts.totalSignups)} coverage
					</div>
				</div>
				<div>
					<div class="text-slate-500">Spend rows</div>
					<div class="text-lg font-semibold text-white">{ads.health.counts.spendRows}</div>
					<div class="text-[14px] text-slate-600">
						snap {fmtAgo(ads.health.lastSpendFetch.snap)} · meta {fmtAgo(
							ads.health.lastSpendFetch.meta
						)}
					</div>
				</div>
			</div>

			<div class="mt-4 grid gap-2 text-[14px] text-slate-500 sm:grid-cols-2">
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
				<span class="text-[14px] text-slate-600">whole range, ignores the filters above</span>
			</div>
			<p class="mb-4 text-[14px] text-slate-600">
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
						<div class="mb-2 text-[14px] uppercase tracking-wide text-slate-500">
							{group.facet === 'network' ? 'Ad network' : 'Targeted audience'}
						</div>
						{#each rows as chip}
							{@const real = Number(f.views[chip.id] ?? 0)}
							{@const excl = Number(f.viewsExcluded[chip.id] ?? 0)}
							{@const taps = Number(f.taps[chip.id] ?? 0)}
							{@const dim = group.active !== 'all' && group.active !== chip.id}
							<div class="mb-3 {dim ? 'opacity-40' : ''}">
								<div class="flex items-baseline gap-2 text-[15px]">
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
									<div class="mt-1 text-[12px] text-amber-500/80">
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
				<div class="mb-2 text-[14px] uppercase tracking-wide text-slate-500">
					Set aside, and how the rest was placed
				</div>
				<div class="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-[15px]">
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
					<div class="mt-1.5 flex flex-wrap items-baseline gap-x-5 gap-y-1 text-[15px]">
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
				<div class="mb-2 text-[14px] uppercase tracking-wide text-slate-500">
					Signups by actual gender
				</div>
				<div class="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-[15px] text-slate-300">
					<span>{ads.signupGender.man} men</span>
					<span>{ads.signupGender.woman} women</span>
					{#if ads.signupGender.unknown > 0}
						<span class="text-slate-500">{ads.signupGender.unknown} unstated</span>
					{/if}
				</div>
				<p class="mt-2 text-[14px] {ads.signupGender.joinableToCampaign ? 'text-slate-600' : 'text-amber-400/80'}">
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
			{#if ads.range.filtersActive}
				<!-- A filtered page must not draw conversions the filtered slice did not
				     produce. Said here rather than left to be inferred from a flat line. -->
				<p class="mb-2 text-[14px] text-amber-400/80">
					Filtered to {ads.range.network === 'all' ? '' : ads.range.network}{ads.range.network !==
						'all' && ads.range.audience !== 'all'
						? ' · '
						: ''}{ads.range.audience === 'all' ? '' : ads.range.audience}. The signups series counts
					only signups attributable to that slice, which needs <code>user_acquisition</code> — empty
					until the new Flutter build ships, so it reads zero rather than showing signups this slice
					may not have produced.
				</p>
			{/if}
			<div class="chart-box"><canvas id="adsTrend"></canvas></div>
			{#if ads.range.granularity !== 'day'}
				<!-- Said here rather than left to be inferred from a missing series:
				     spend has no time of day in it, so nothing below daily can carry a
				     cost line without inventing one. -->
				<p class="mt-2 text-[14px] text-slate-600">
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
					<div class="text-[15px] text-slate-500">
						{ads.visitFunnel.tapped} of {ads.visitFunnel.visits} visits
					</div>
				</div>
				<p class="mt-3 text-[14px] leading-relaxed text-slate-600">
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

		<!-- Landing page variants + country + city -->
		<div class="mb-6 grid gap-4 lg:grid-cols-3">
			<div class="card">
				<div class="chart-title">Landing page variants</div>
				<table class="w-full text-[15px]">
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
				<table class="w-full text-[15px]">
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
			<!-- City. The coverage line under the title is not decoration: until the
			     2026-08-11 migration ran, every row here was 'unknown', and a city
			     table read without knowing its coverage says the wrong thing most
			     confidently in exactly the days it is least complete. -->
			<div class="card">
				<div class="chart-title">By city</div>
				{#if ads.cityCoverage}
					<div class="mb-2 text-[13px] text-slate-500">
						Resolved for {ads.cityCoverage.views}/{ads.cityCoverage.totalViews} views · {ads
							.cityCoverage.taps}/{ads.cityCoverage.totalTaps} taps.
						{#if ads.cityCoverage.views < ads.cityCoverage.totalViews}
							<span class="text-amber-400/80">Unresolved rows show as “unknown”, never as zero.</span>
						{/if}
					</div>
				{/if}
				<table class="w-full text-[15px]">
					<thead class="text-slate-500">
						<tr><th class="py-1 text-left">City</th><th class="text-right">Views</th><th class="text-right">Taps</th><th class="text-right">Tap rate</th></tr>
					</thead>
					<tbody>
						{#each entriesOf<GeoCell>(ads.byCity)
							.sort((a, b) => b[1].views - a[1].views)
							.slice(0, 12) as [city, s]}
							<tr class="border-t border-white/[0.04]">
								<td class="py-1.5 text-slate-300">{city}</td>
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

		<!-- ── Network-reported delivery demographics ──────────────────────────
		     Kept visually apart from everything above it, because everything above
		     is first-party and this is not. These buckets are Snap's and Meta's
		     account of who they SHOWED the advert to. The caption says so in the
		     UI rather than only in the migration, because the natural reading of an
		     age chart on an ad dashboard is "our traffic", and that reading is
		     wrong in a way that changes decisions. -->
		<div class="card mb-6">
			<div class="chart-title">Who the networks say they reached</div>
			<div class="mb-3 text-[13px] leading-relaxed text-slate-500">
				Reported by Snap and Meta, per campaign-day. These describe <strong class="text-slate-400"
					>impressions — everyone the ad was shown to</strong
				>, not the people who arrived on the landing page, and not who the ad set was targeting.
				Percentages are within one row only: age and gender split the same money, so they never add
				across sections.
			</div>

			{#if !ads.demographicsPresent}
				<div class="rounded border border-white/[0.06] bg-white/[0.02] p-3 text-[14px] text-slate-400">
					No demographic rows yet. This fills once the spend sync has run against a network that
					answers breakdowns — Meta needs <code class="text-slate-300">META_MARKETING_TOKEN</code> set
					at all, and Snap's dimension parameter should be confirmed with
					<code class="text-slate-300">/admin/analytics/demographics-probe</code>. Empty here means
					“not fetched”, not “no audience”.
				</div>
			{:else}
				<div class="grid gap-5 lg:grid-cols-3">
					{#each entriesOf<DemoBucket[]>(ads.byDemographic) as [dimension, buckets]}
						{@const totalImpressions = buckets.reduce((sum, b) => sum + b.impressions, 0)}
						<div>
							<div class="mb-1.5 text-[13px] font-medium uppercase tracking-wide text-slate-400">
								{dimension}
							</div>
							<table class="w-full text-[15px]">
								<thead class="text-slate-500">
									<tr
										><th class="py-1 text-left">Bucket</th><th class="text-right">Impr.</th><th
											class="text-right">Share</th
										><th class="text-right">Spend</th></tr
									>
								</thead>
								<tbody>
									{#each buckets.slice(0, 10) as b}
										<tr class="border-t border-white/[0.04]">
											<td class="py-1.5 text-slate-300">{b.bucket}</td>
											<td class="text-right text-slate-400">{b.impressions.toLocaleString()}</td>
											<td class="text-right text-slate-400"
												>{fmtRate(totalImpressions ? b.impressions / totalImpressions : null)}</td
											>
											<td class="text-right text-slate-400">{fmtMoney(b.spend)}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Ad set leaderboard. Named for what the rows actually are: the rollup is
		     keyed on ad set, because that is the only key spend and traffic share. -->
		<div class="card mb-6 overflow-x-auto">
			<div class="mb-3 flex flex-wrap items-center justify-between gap-3">
				<div class="chart-title mb-0">Ad set leaderboard · spend in {adsCurrency}</div>
				<!-- Delivery. Filters rows only — a not-delivering ad set contributes no
				     traffic by definition, so hiding it must not move the charts above.
				     Prefers the network's OWN status where it's known (isCurrentlyDelivering);
				     falls back to "had any activity in this range" only for rows synced
				     before the status column existed. -->
				<div class="flex overflow-hidden rounded-lg border border-white/[0.08] text-[15px]">
					{#each [{ id: 'all', label: 'All' }, { id: 'delivering', label: 'Delivering' }, { id: 'idle', label: 'Not delivering' }] as chip}
						<button
							onclick={() => (adsDelivery = chip.id as typeof adsDelivery)}
							title={chip.id === 'idle'
								? 'Paused on the network, or — where status has not synced yet — nothing served, charged, or arrived in this range'
								: chip.id === 'delivering'
									? 'Active on the network right now, or — where status has not synced yet — any activity in this range'
									: 'Every ad set either side has seen'}
							class="px-3 py-1.5 transition-colors {adsDelivery === chip.id
								? 'bg-emerald-500/20 text-emerald-400'
								: 'text-slate-400 hover:text-slate-200'}"
							>{chip.label}<span class="ml-1 opacity-50"
								>{adsDeliveryCounts[chip.id as keyof typeof adsDeliveryCounts]}</span
							></button
						>
					{/each}
				</div>
			</div>
			<!-- 16px, not 13: 13 was legible only at 125% browser zoom, which is a
			     reader telling you the type is too small. The whole card is scaled by
			     that same 1.25 — badges and the footnote too — so the proportions the
			     zoom produced are what ships, rather than one row of bigger numbers
			     against unchanged chrome.
			     Values at slate-200 rather than slate-400: slate-400 on this
			     background is about 4:1, under the 4.5:1 threshold, and it failed
			     worst on the numeric columns where it matters most. Headers stay
			     dimmer — the hierarchy was never the problem.
			     min-width grows with the type or eight columns of 16px crush. -->
			<table class="w-full min-w-[70rem] text-[16px]">
				<thead class="text-slate-500">
					<tr>
						<!-- Blank header for the expand toggle column — nothing to label,
						     it exists only where a row has ads to drill into. -->
						<th class="w-6"></th>
						<th class="py-1 text-left">Campaign</th>
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
					{#each adsLeaderboard as c}
						{@const rowKey = adSetRowKey(c)}
						{@const expanded = expandedAdSetRows.has(rowKey)}
						<tr class="border-t border-white/[0.04]">
							<td class="py-2 text-center">
								{#if c.ads.length > 0}
									<button
										onclick={() => toggleAdSetRow(rowKey)}
										title="{c.ads.length} ad{c.ads.length === 1 ? '' : 's'} — {expanded
											? 'collapse'
											: 'show the ad-level breakdown'}"
										class="text-slate-500 transition-colors hover:text-slate-200"
										>{expanded ? '▾' : '▸'}</button
									>
								{/if}
							</td>
							<td class="py-2 text-slate-400">{c.campaignName ?? '—'}</td>
							<td class="py-2 text-slate-200"
								>{c.campaign}
								{#if c.paidButNoTraffic && c.networkClicks >= ads.paidNoTrafficMinClicks}
									<!-- Said on the row, not left to be inferred from a line of
									     zeros: this one is being billed for clicks that never
									     arrive, which reads as "quiet" without the badge. Gated on
									     the same threshold as the anomaly, so a single click with no
									     view does not get a red badge it has not earned. -->
									<span
										class="ml-1.5 whitespace-nowrap rounded bg-rose-500/15 px-2 py-0.5 text-[12px] text-rose-300"
										title="{c.networkClicks} clicks charged for, zero landing page views — check where this ad set points"
										>no arrivals</span
									>
								{:else if c.deliveringNow === false}
									<!-- The network's OWN status, not a guess from activity — this row
									     may still show real spend and impressions from before it was
									     paused. Kept visually distinct from "idle" below: this ad set
									     ran, it was simply turned off, which is a different fact from
									     "nothing ever happened here". -->
									<span
										class="ml-1.5 whitespace-nowrap rounded bg-white/[0.06] px-2 py-0.5 text-[12px] text-slate-500"
										title="Paused on the network as of the last sync — may still show spend and impressions from before it was paused"
										>paused</span
									>
								{:else if !c.delivering}
									<span
										class="ml-1.5 whitespace-nowrap rounded bg-white/[0.06] px-2 py-0.5 text-[12px] text-slate-500"
										title="Nothing served, nothing charged, nobody arrived in this range"
										>idle</span
									>
								{/if}
								{#if !c.adSetId}
									<!-- Two rows can share a label and still be different keys: one
									     carries an ad set id, the other never had a utm_term. They are
									     not merged, because only spend can confirm an id — so the
									     difference is shown instead of looking like a duplicate. -->
									<span
										class="ml-1.5 whitespace-nowrap rounded bg-white/[0.06] px-2 py-0.5 text-[12px] text-slate-500"
										title="No ad set id on these rows, so they cannot be keyed to an ad set or joined to spend"
										>no ad set id</span
									>
								{/if}
							</td>
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
						{#if expanded}
							{#each c.ads as ad}
								<!-- The ad (creative) row — one level below the ad set. Signups and
								     cost/signup stay blank rather than 0 or a computed number: neither
								     is tracked at this grain, and a number here would look measured
								     rather than simply absent. -->
								<tr class="border-t border-white/[0.02] bg-white/[0.015] text-[15px]">
									<td></td>
									<td class="py-1.5"></td>
									<td class="py-1.5 pl-4 text-slate-400">↳ {ad.creativeName ?? ad.creativeId}</td>
									<td class="text-right tabular-nums text-slate-400"
										>{ad.spend ? fmtMoney(ad.spend) : '—'}</td
									>
									<td class="text-right tabular-nums text-slate-400">{ad.impressions || '—'}</td>
									<td class="text-right tabular-nums {ad.views ? 'text-slate-400' : 'text-slate-600'}"
										>{ad.views}</td
									>
									<td class="text-right tabular-nums {ad.taps ? 'text-slate-400' : 'text-slate-600'}"
										>{ad.taps}</td
									>
									<td
										class="text-right tabular-nums {ad.tapRate == null
											? 'text-slate-600'
											: 'text-slate-400'}">{fmtRate(ad.tapRate, ad.views)}</td
									>
									<td class="text-right text-slate-600">—</td>
									<td class="text-right text-slate-600">—</td>
								</tr>
							{/each}
						{/if}
					{:else}
						<!-- Distinguishes "the filter hid everything" from "there is nothing
						     here", which look identical as an empty table. -->
						<tr
							><td colspan="10" class="py-6 text-center text-slate-600"
								>{adsDelivery === 'all'
									? 'No ad set data in this window.'
									: `No ad set is ${adsDelivery === 'delivering' ? 'delivering' : 'idle'} in this window.`}</td
							></tr
						>
					{/each}
				</tbody>
			</table>
			<p class="mt-3 text-[14px] text-slate-600">
				Rates are withheld below {ads.minSample} observations and shown as the raw count instead — at
				current volumes most per-campaign differences are noise, and a percentage off a handful of
				visitors invites a decision the data cannot support.
			</p>
		</div>

		<!-- /aibestie conversation depth -->
		<div class="grid gap-4 lg:grid-cols-2">
			<div class="card">
				<div class="chart-title">/aibestie funnel</div>
				<table class="w-full text-[15px]">
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
				<p class="mt-3 text-[14px] leading-relaxed text-slate-600">
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
	</div>
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
	/* The same 1.25 applied to every other size in the Ad Analytics tab. Scoped to
	   .ads-scale because .chart-title is global and shared with the other three
	   tabs, which were not part of the ask. */
	:global(.ads-scale .chart-title) {
		font-size: 1rem;
	}
</style>
