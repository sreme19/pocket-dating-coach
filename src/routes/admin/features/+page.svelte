<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// ── Filters → URL query (re-runs the server load) ───────────────────────────
	function setFilter(patch: Record<string, string>) {
		const p = new URLSearchParams($page.url.searchParams);
		for (const [k, v] of Object.entries(patch)) p.set(k, v);
		goto(`?${p.toString()}`, { noScroll: true, keepFocus: true });
	}

	const GENDERS = [
		{ v: 'all', label: 'All' },
		{ v: 'woman', label: 'Women' },
		{ v: 'man', label: 'Men' }
	];
	const RANGES = [7, 30, 90];

	// ── Client-side sort (no reload) ────────────────────────────────────────────
	let sortK = $state<'pct' | 'users' | 'uses' | 'name'>('pct');
	let sortDir = $state(-1);
	function sortBy(k: typeof sortK) {
		if (k === sortK) sortDir = -sortDir as 1 | -1;
		else {
			sortK = k;
			sortDir = k === 'name' ? 1 : -1;
		}
	}
	let sorted = $derived(
		[...data.features].sort((a, b) => {
			const av = sortK === 'name' ? a.name : (a[sortK] as number);
			const bv = sortK === 'name' ? b.name : (b[sortK] as number);
			return typeof av === 'string' ? sortDir * av.localeCompare(bv as string) : sortDir * ((av as number) - (bv as number));
		})
	);

	let proofOpen = $state(false);

	const tierColor: Record<string, string> = { good: '#34d399', warn: '#fbbf24', crit: '#fb7185' };
	const tierLabel: Record<string, string> = { good: 'Healthy', warn: 'Low use', crit: 'Dormant' };
	const genderWord = (g: string) => (g === 'man' ? 'men' : g === 'woman' ? 'women' : 'users');

	// Tiles
	let mostUsed = $derived([...data.features].sort((a, b) => b.pct - a.pct)[0]);
	let dormantCount = $derived(data.features.filter((f) => f.tier === 'crit').length);

	// Sparkline path from a number[] series.
	function spark(series: number[]) {
		const w = 116, h = 28, p = 2;
		const max = Math.max(1, ...series);
		const n = series.length;
		const xs = (i: number) => p + (i * (w - 2 * p)) / Math.max(1, n - 1);
		const ys = (v: number) => h - p - (v / max) * (h - 2 * p);
		const line = series.map((v, i) => `${i ? 'L' : 'M'}${xs(i).toFixed(1)} ${ys(v).toFixed(1)}`).join(' ');
		const area = `M${xs(0).toFixed(1)} ${h} ` + series.map((v, i) => `L${xs(i).toFixed(1)} ${ys(v).toFixed(1)}`).join(' ') + ` L${xs(n - 1).toFixed(1)} ${h} Z`;
		return { line, area, ex: xs(n - 1).toFixed(1), ey: ys(series[n - 1]).toFixed(1) };
	}
	function ago(iso: string | null) {
		if (!iso) return 'never';
		const s = (Date.now() - new Date(iso).getTime()) / 1000;
		if (s < 60) return 'just now';
		if (s < 3600) return `${Math.floor(s / 60)}m ago`;
		if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
		return `${Math.floor(s / 86400)}d ago`;
	}

	const CAT_LABELS: Record<string, string> = {
		travel: 'Travel', lifestyle: 'Lifestyle', discipline: 'Discipline', social_proof: 'Social proof',
		wealth: 'Wealth', spending: 'Spending', assets: 'Assets', hosting: 'Hosting', linkedin: 'LinkedIn',
		instagram: 'Instagram', twitter: 'Twitter / X', habit_tracker: 'Habit tracker', intro: 'Intro', unknown: 'Uncategorised'
	};
	const catLabel = (c: string) => CAT_LABELS[c] ?? c;

	let maxPct = $derived(Math.max(1, ...data.features.map((f) => f.pct)));
</script>

<div class="min-h-screen bg-[#0b1120] px-6 py-6 text-slate-100">
	<div class="mx-auto max-w-5xl">
		<!-- Header + filters -->
		<div class="mb-5 flex flex-wrap items-end justify-between gap-4">
			<div>
				<h1 class="text-xl font-bold tracking-tight">Feature Usage</h1>
				<p class="mt-1 text-sm text-slate-400">Which features are used, and which are ignored. Last {data.filter.days} days.</p>
			</div>
			<div class="flex flex-wrap items-center gap-2">
				<div class="inline-flex rounded-lg border border-white/[0.08] bg-[#0d1526] p-0.5">
					{#each GENDERS as g}
						<button
							onclick={() => setFilter({ gender: g.v })}
							class="rounded-md px-3 py-1.5 text-xs transition-colors {data.filter.gender === g.v ? 'bg-emerald-500/15 font-semibold text-emerald-400' : 'text-slate-400 hover:text-slate-200'}"
						>{g.label}</button>
					{/each}
				</div>
				<div class="inline-flex rounded-lg border border-white/[0.08] bg-[#0d1526] p-0.5">
					{#each RANGES as r}
						<button
							onclick={() => setFilter({ days: String(r) })}
							class="rounded-md px-3 py-1.5 text-xs transition-colors {data.filter.days === r ? 'bg-emerald-500/15 font-semibold text-emerald-400' : 'text-slate-400 hover:text-slate-200'}"
						>{r}d</button>
					{/each}
				</div>
				<button
					onclick={() => setFilter({ seed: data.filter.seed === 'exclude' ? 'include' : 'exclude' })}
					class="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-[#0d1526] px-3 py-1.5 text-xs text-slate-300"
					aria-pressed={data.filter.seed === 'exclude'}
				>
					<span class="relative h-[17px] w-[30px] rounded-full transition-colors {data.filter.seed === 'exclude' ? 'bg-emerald-500' : 'bg-white/20'}">
						<span class="absolute top-0.5 h-[13px] w-[13px] rounded-full bg-white transition-all {data.filter.seed === 'exclude' ? 'left-[15px]' : 'left-0.5'}"></span>
					</span>
					Exclude seed
				</button>
			</div>
		</div>

		<!-- Stat tiles -->
		<div class="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
			<div class="rounded-xl border border-white/[0.06] bg-[#101a30] p-4">
				<div class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{data.filter.gender === 'all' ? 'Users in scope' : genderWord(data.filter.gender) + ' in scope'}</div>
				<div class="mt-1.5 text-2xl font-bold tabular-nums">{data.base}</div>
				<div class="mt-0.5 text-xs text-slate-400">{data.filter.seed === 'exclude' ? 'real users' : 'incl. seed'} · of {data.totalUsers} total</div>
			</div>
			<div class="rounded-xl border border-white/[0.06] bg-[#101a30] p-4">
				<div class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Features tracked</div>
				<div class="mt-1.5 text-2xl font-bold tabular-nums">{data.features.length}</div>
				<div class="mt-0.5 text-xs text-slate-400">across 5 product areas</div>
			</div>
			<div class="rounded-xl border border-white/[0.06] bg-[#101a30] p-4">
				<div class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Most used</div>
				<div class="mt-1.5 truncate text-xl font-bold">{mostUsed?.name ?? '—'}</div>
				<div class="mt-0.5 text-xs text-slate-400">{mostUsed ? mostUsed.pct + '% of ' + genderWord(data.filter.gender) : ''}</div>
			</div>
			<div class="rounded-xl border border-white/[0.06] bg-[#101a30] p-4">
				<div class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Dormant features</div>
				<div class="mt-1.5 text-2xl font-bold tabular-nums {dormantCount ? 'text-rose-400' : ''}">{dormantCount}</div>
				<div class="mt-0.5 text-xs text-slate-400">under 5% adoption</div>
			</div>
		</div>

		<!-- Adoption table -->
		<div class="mb-5 overflow-hidden rounded-2xl border border-white/[0.06] bg-[#101a30]">
			<div class="flex items-baseline justify-between px-5 pb-2 pt-4">
				<h2 class="text-sm font-semibold">Feature adoption</h2>
				<span class="text-xs text-slate-500">click a column to sort · click Proof upload to expand</span>
			</div>
			<div class="overflow-x-auto">
				<table class="w-full min-w-[780px] border-collapse text-sm">
					<thead>
						<tr class="text-[10.5px] uppercase tracking-wider text-slate-500">
							{#each [['name', 'Feature', 'text-left'], ['users', 'Unique users', 'text-right'], ['uses', 'Total uses', 'text-right'], ['pct', '% of scope', 'text-right']] as col}
								<th class="cursor-pointer border-b border-white/[0.06] px-4 py-2 font-semibold {col[2]}" onclick={() => sortBy(col[0] as any)}>
									{col[1]}{#if sortK === col[0]}<span class="ml-1 text-emerald-400">{sortDir < 0 ? '▼' : '▲'}</span>{/if}
								</th>
							{/each}
							<th class="border-b border-white/[0.06] px-4 py-2 text-left font-semibold">Trend</th>
							<th class="border-b border-white/[0.06] px-4 py-2 text-left font-semibold">Last used</th>
							<th class="border-b border-white/[0.06] px-4 py-2 text-left font-semibold">Status</th>
						</tr>
					</thead>
					<tbody>
						{#each sorted as f}
							{@const sp = spark(f.spark)}
							<tr
								class="border-b border-white/[0.06] {f.key === 'proof' ? 'cursor-pointer' : ''} hover:bg-white/[0.02]"
								onclick={() => f.key === 'proof' && (proofOpen = !proofOpen)}
							>
								<td class="px-4 py-2.5">
									<div class="flex items-center gap-2">
										{#if f.key === 'proof'}<span class="text-[10px] text-emerald-400">{proofOpen ? '▼' : '▶'}</span>{:else}<span class="w-[10px]"></span>{/if}
										<span class="font-semibold text-slate-100">{f.name}</span>
										<span class="rounded-full border border-white/[0.08] px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-500">{f.group}</span>
									</div>
								</td>
								<td class="px-4 py-2.5 text-right tabular-nums">{f.users}</td>
								<td class="px-4 py-2.5 text-right tabular-nums">{f.uses}</td>
								<td class="px-4 py-2.5">
									<div class="flex items-center justify-end gap-2">
										<span class="h-1.5 w-20 overflow-hidden rounded-full bg-white/[0.08]">
											<span class="block h-full rounded-full" style="width:{Math.min(100, f.pct)}%;background:{tierColor[f.tier]}"></span>
										</span>
										<span class="w-12 text-right tabular-nums">{f.pct}%</span>
									</div>
								</td>
								<td class="px-4 py-2.5">
									<svg width="116" height="28" viewBox="0 0 116 28" aria-hidden="true">
										<path d={sp.area} fill={tierColor[f.tier]} opacity="0.14" />
										<path d={sp.line} fill="none" stroke={tierColor[f.tier]} stroke-width="1.6" stroke-linejoin="round" />
										<circle cx={sp.ex} cy={sp.ey} r="2.2" fill={tierColor[f.tier]} />
									</svg>
								</td>
								<td class="px-4 py-2.5 text-slate-400">{ago(f.lastUsed)}</td>
								<td class="px-4 py-2.5">
									<span class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold" style="color:{tierColor[f.tier]};background:{tierColor[f.tier]}22">
										<span class="h-1.5 w-1.5 rounded-full" style="background:{tierColor[f.tier]}"></span>{tierLabel[f.tier]}
									</span>
								</td>
							</tr>
							{#if f.key === 'proof' && proofOpen}
								<tr class="bg-white/[0.015]">
									<td colspan="7" class="px-4 py-4">
										{@render proofDrill()}
									</td>
								</tr>
							{/if}
						{/each}
					</tbody>
				</table>
			</div>
		</div>

		<!-- Ranked bars -->
		<div class="rounded-2xl border border-white/[0.06] bg-[#101a30] p-5">
			<div class="mb-3 flex items-baseline justify-between">
				<h2 class="text-sm font-semibold">Adoption across features</h2>
				<span class="text-xs text-slate-500">used vs. ignored</span>
			</div>
			<div class="flex flex-col gap-2">
				{#each [...data.features].sort((a, b) => b.pct - a.pct) as f}
					<div class="grid grid-cols-[150px_1fr_46px] items-center gap-3">
						<span class="truncate text-xs text-slate-300" title={f.name}>{f.name}</span>
						<span class="h-3.5 overflow-hidden rounded bg-white/[0.06]">
							<span class="block h-full rounded" style="width:{(f.pct / maxPct) * 100}%;min-width:2px;background:{tierColor[f.tier]}"></span>
						</span>
						<span class="text-right text-xs tabular-nums text-slate-300">{f.pct}%</span>
					</div>
				{/each}
			</div>
		</div>

		<p class="mt-5 text-xs text-slate-600">
			Derived from domain tables (likes, passes, messages, matches, advisor chats, attention, verification) + mobile proof-upload events.
			Filter: {data.filter.gender} · {data.filter.days}d · seed {data.filter.seed}.
		</p>
	</div>
</div>

{#snippet proofDrill()}
	<div class="rounded-xl border border-white/[0.06] bg-[#0d1526] p-4">
		<div class="mb-1 flex items-baseline justify-between">
			<h3 class="text-[13px] font-semibold text-slate-100">Open → upload funnel <span class="ml-1 rounded-full border border-sky-400/30 px-1.5 py-0.5 text-[9.5px] uppercase text-sky-300">men only</span></h3>
			<span class="text-[11px] text-slate-500">mobile app · {data.proof.days}d</span>
		</div>

		{#if !data.proof.instrumented}
			<p class="my-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[12px] text-slate-200">
				Proof-screen tracking isn't in the shipped build yet, so these stages read 0. Verified proofs on record ({data.proof.onRecord.total}) come from the verification table.
			</p>
		{:else if data.proof.headline.opened > 0}
			<div class="my-2 flex items-center gap-3 rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2">
				<span class="text-lg font-extrabold tabular-nums text-rose-400">{data.proof.headline.bailPct}%</span>
				<span class="text-[12.5px] text-slate-200">of the <b>{data.proof.headline.opened}</b> who opened <b>never completed an upload</b>.</span>
			</div>
		{/if}

		<div class="mt-3 flex flex-col gap-1">
			{#each data.proof.funnel as s, i}
				{@const first = data.proof.funnel[0].count || 1}
				<div class="grid grid-cols-[180px_1fr_110px] items-center gap-3">
					<div>
						<div class="text-[12.5px] text-slate-100">{s.label}</div>
						<div class="text-[10.5px] text-slate-500">{s.sub}</div>
					</div>
					<div class="flex items-center gap-2">
						<div class="h-6 rounded bg-emerald-500" style="width:{Math.max(2, (s.count / first) * 100)}%;opacity:{(1 - i * 0.14).toFixed(2)}"></div>
						<span class="text-[13px] font-bold tabular-nums">{s.count}</span>
					</div>
					<div class="text-right text-[10.5px] text-slate-400">{#if s.conv !== null}<b class="text-slate-200">{s.conv}%</b> of prev{:else}start{/if}<div class="text-slate-600">{s.users} users</div></div>
				</div>
			{/each}
		</div>

		<div class="mt-4">
			<div class="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
				{data.proof.categories.length ? 'By category (verified / attempts)' : 'Verified proofs on record, by category'}
			</div>
			{#if data.proof.categories.length}
				<div class="flex flex-col gap-1.5">
					{#each data.proof.categories as c}
						<div class="flex items-center justify-between text-[12.5px]">
							<span class="text-slate-200">{catLabel(c.cat)}</span>
							<span class="tabular-nums text-slate-400">{c.verified}/{c.attempts} · <b class="text-emerald-400">{c.rate}%</b></span>
						</div>
					{/each}
				</div>
			{:else if data.proof.onRecord.byCategory.length}
				<div class="grid grid-cols-2 gap-x-6 gap-y-1">
					{#each data.proof.onRecord.byCategory as c}
						<div class="flex items-center justify-between text-[12.5px]"><span class="text-slate-200">{catLabel(c.cat)}</span><span class="tabular-nums text-emerald-400">{c.n}</span></div>
					{/each}
				</div>
			{:else}
				<p class="text-[12.5px] text-slate-500">No proofs in this window.</p>
			{/if}
		</div>
	</div>
{/snippet}
