<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const tierColor = (rate: number) =>
		rate >= 55 ? 'text-emerald-400' : rate >= 40 ? 'text-amber-400' : 'text-rose-400';

	// Funnel bar widths are relative to the first stage (opened).
	let first = $derived(data.funnel[0]?.count ?? 0);
	function barPct(n: number) {
		return first > 0 ? Math.max(2, (n / first) * 100) : 2;
	}

	// Drop between consecutive stages (for the annotations under each bar).
	function drop(i: number) {
		const a = data.funnel[i].count;
		const b = data.funnel[i + 1]?.count ?? a;
		const d = a - b;
		return { d, pct: a > 0 ? Math.round((d / a) * 100) : 0 };
	}

	// Category labels → friendly names (mirrors the proof categories).
	const CAT_LABELS: Record<string, string> = {
		travel: 'Travel',
		lifestyle: 'Lifestyle',
		discipline: 'Discipline / fitness',
		social_proof: 'Social proof',
		wealth: 'Wealth',
		spending: 'Spending',
		assets: 'Assets',
		hosting: 'Hosting',
		linkedin: 'LinkedIn',
		instagram: 'Instagram',
		twitter: 'Twitter / X',
		habit_tracker: 'Habit tracker',
		intro: 'Video / voice intro',
		unknown: 'Uncategorised'
	};
	const catLabel = (c: string) => CAT_LABELS[c] ?? c;

	// Trend sparkline (opened vs verified) — inline SVG, no chart lib.
	const W = 640;
	const H = 130;
	const PAD = { t: 10, r: 8, b: 18, l: 8 };
	let trendMax = $derived(Math.max(1, ...data.trend.opened, ...data.trend.verified));
	function pointsFor(series: number[]) {
		const n = series.length;
		if (n === 0) return '';
		return series
			.map((v, i) => {
				const x = PAD.l + (i * (W - PAD.l - PAD.r)) / Math.max(1, n - 1);
				const y = H - PAD.b - (v / trendMax) * (H - PAD.t - PAD.b);
				return `${x.toFixed(1)},${y.toFixed(1)}`;
			})
			.join(' ');
	}
	let trendTotalOpened = $derived(data.trend.opened.reduce((s, v) => s + v, 0));
	let trendTotalVerified = $derived(data.trend.verified.reduce((s, v) => s + v, 0));
</script>

<div class="min-h-screen bg-[#0b1120] px-6 py-6 text-slate-100">
	<div class="mx-auto max-w-5xl">
		<!-- Header -->
		<div class="mb-6">
			<h1 class="text-xl font-bold tracking-tight">Feature Usage</h1>
			<p class="mt-1 text-sm text-slate-400">
				Proof upload — do people open the screen, then actually upload? Last {data.windowDays} days · mobile app.
			</p>
		</div>

		{#if !data.instrumented}
			<div
				class="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm"
			>
				<span class="text-amber-400">ⓘ</span>
				<p class="text-slate-200">
					Upload-outcome tracking ships with the next mobile release, so
					<b>Completed upload</b> and <b>Verified</b> read 0 for now. The
					<b>Opened</b> and <b>Started</b> stages are live, and
					<b>{data.verifiedOnRecord.total}</b> verified proofs are already on record (below).
				</p>
			</div>
		{/if}

		<!-- Stat tiles -->
		<div class="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
			<div class="rounded-xl border border-white/[0.06] bg-[#101a30] p-4">
				<div class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Opened screen</div>
				<div class="mt-1.5 text-2xl font-bold tabular-nums">{data.funnel[0].count}</div>
				<div class="mt-0.5 text-xs text-slate-400">{data.funnel[0].users} unique users</div>
			</div>
			<div class="rounded-xl border border-white/[0.06] bg-[#101a30] p-4">
				<div class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Completed upload</div>
				<div class="mt-1.5 text-2xl font-bold tabular-nums">{data.funnel[2].count}</div>
				<div class="mt-0.5 text-xs text-slate-400">{data.funnel[2].users} unique users</div>
			</div>
			<div class="rounded-xl border border-white/[0.06] bg-[#101a30] p-4">
				<div class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Opened → uploaded</div>
				<div class="mt-1.5 text-2xl font-bold tabular-nums {data.headline.bailPct >= 50 ? 'text-rose-400' : ''}">
					{100 - data.headline.bailPct}%
				</div>
				<div class="mt-0.5 text-xs text-slate-400">{data.headline.bailed} opened but didn't upload</div>
			</div>
			<div class="rounded-xl border border-white/[0.06] bg-[#101a30] p-4">
				<div class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Verified on record</div>
				<div class="mt-1.5 text-2xl font-bold tabular-nums text-emerald-400">{data.verifiedOnRecord.total}</div>
				<div class="mt-0.5 text-xs text-slate-400">{data.verifiedOnRecord.users} users · all-time</div>
			</div>
		</div>

		<!-- Funnel -->
		<div class="mb-6 rounded-2xl border border-white/[0.06] bg-[#101a30] p-5">
			<div class="mb-1 flex items-baseline justify-between">
				<h2 class="text-sm font-semibold">Open → upload funnel</h2>
				<span class="text-xs text-slate-500">relative to opens</span>
			</div>

			{#if data.headline.opened > 0}
				<div class="my-4 flex items-center gap-3 rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3">
					<span class="text-2xl font-extrabold tabular-nums text-rose-400">{data.headline.bailPct}%</span>
					<span class="text-sm text-slate-200">
						of the <b>{data.headline.opened}</b> people who <b>opened</b> the proof screen
						<b>never completed an upload</b>.
					</span>
				</div>
			{:else}
				<p class="my-4 text-sm text-slate-500">No proof-screen opens recorded in this window yet.</p>
			{/if}

			<div class="flex flex-col gap-1">
				{#each data.funnel as s, i}
					<div class="grid grid-cols-[190px_1fr_120px] items-center gap-3">
						<div>
							<div class="text-[13px] font-medium text-slate-100">{s.label}</div>
							<div class="text-[11px] text-slate-500">{s.sub}</div>
						</div>
						<div class="flex items-center gap-3">
							<div
								class="h-8 rounded-md bg-emerald-500"
								style="width: {barPct(s.count)}%; opacity: {(1 - i * 0.14).toFixed(2)}"
							></div>
							<span class="text-sm font-bold tabular-nums">{s.count}</span>
						</div>
						<div class="text-right text-[11px] text-slate-400">
							{#if s.conv !== null}<b class="text-slate-200">{s.conv}%</b> of previous{:else}start{/if}
							<div class="text-slate-500">{s.users} users</div>
						</div>
					</div>
					{#if i < data.funnel.length - 1}
						{@const dr = drop(i)}
						<div
							class="ml-[178px] flex items-center gap-2 text-[11px] {i === 0
								? 'font-semibold text-rose-400'
								: 'text-slate-500'}"
						>
							<span>↳</span>
							<span
								class={i === 0 ? 'rounded-full bg-rose-500/10 px-2 py-0.5' : ''}
							>↓ {dr.d} dropped · {dr.pct}%</span>
						</div>
					{/if}
				{/each}
			</div>

			<p class="mt-4 text-xs text-slate-500">
				End-to-end: <b class="text-slate-300">{data.funnel[3].count}</b> of
				<b class="text-slate-300">{data.funnel[0].count}</b> opens reached a verified proof.
			</p>
		</div>

		<div class="grid gap-6 md:grid-cols-2">
			<!-- Per-category breakdown -->
			<div class="rounded-2xl border border-white/[0.06] bg-[#101a30] p-5">
				<h2 class="mb-3 text-sm font-semibold">By proof category</h2>
				{#if data.categories.length > 0}
					<div class="flex flex-col gap-2.5">
						{#each data.categories as c}
							<div class="grid grid-cols-[130px_1fr_86px] items-center gap-3">
								<span class="truncate text-[12.5px] text-slate-200" title={catLabel(c.cat)}>{catLabel(c.cat)}</span>
								<div class="h-3.5 overflow-hidden rounded bg-white/[0.06]">
									<div class="h-full rounded bg-emerald-500" style="width: {c.attempts ? (c.verified / c.attempts) * 100 : 0}%"></div>
								</div>
								<span class="text-right text-[12px] tabular-nums text-slate-400">
									{c.verified}/{c.attempts} · <b class={tierColor(c.rate)}>{c.rate}%</b>
								</span>
							</div>
						{/each}
					</div>
					<p class="mt-3 text-[11px] text-slate-500">Verified / attempts per category (from upload results).</p>
				{:else}
					<p class="mb-3 text-sm text-slate-500">
						No upload results in this window yet. Verified proofs already on record, by category:
					</p>
					<div class="flex flex-col gap-2">
						{#each data.verifiedOnRecord.byCategory as c}
							<div class="flex items-center justify-between text-[13px]">
								<span class="text-slate-200">{catLabel(c.cat)}</span>
								<span class="tabular-nums text-emerald-400">{c.n}</span>
							</div>
						{:else}
							<p class="text-sm text-slate-500">None yet.</p>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Trend -->
			<div class="rounded-2xl border border-white/[0.06] bg-[#101a30] p-5">
				<div class="mb-3 flex items-baseline justify-between">
					<h2 class="text-sm font-semibold">Opened vs. verified over time</h2>
					<span class="text-xs text-slate-500">per day</span>
				</div>
				<svg viewBox="0 0 {W} {H}" class="w-full" preserveAspectRatio="none" role="img" aria-label="Opened vs verified per day">
					{#each [0.25, 0.5, 0.75] as g}
						<line x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b - g * (H - PAD.t - PAD.b)} y2={H - PAD.b - g * (H - PAD.t - PAD.b)} stroke="rgba(255,255,255,0.06)" stroke-width="1" />
					{/each}
					<polyline points={pointsFor(data.trend.opened)} fill="none" stroke="#64748b" stroke-width="2" stroke-linejoin="round" />
					<polyline points={pointsFor(data.trend.verified)} fill="none" stroke="#34d399" stroke-width="2" stroke-linejoin="round" />
				</svg>
				<div class="mt-2 flex gap-4 text-xs text-slate-400">
					<span class="inline-flex items-center gap-1.5"><i class="inline-block h-2 w-2 rounded-sm bg-slate-500"></i>Opened ({trendTotalOpened})</span>
					<span class="inline-flex items-center gap-1.5"><i class="inline-block h-2 w-2 rounded-sm bg-emerald-400"></i>Verified ({trendTotalVerified})</span>
				</div>
			</div>
		</div>

		<p class="mt-6 text-xs text-slate-600">
			Source: mobile <code class="text-slate-500">mobile_event_log</code> (proof-upload screen) + verified_vibe_verification.
			{#if data.lastEventAt}Last event {new Date(data.lastEventAt).toLocaleString()}.{/if}
		</p>
	</div>
</div>
