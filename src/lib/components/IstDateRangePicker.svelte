<!--
	Date-range picker for the admin dashboard, modelled on the Ads Manager
	control: a preset rail on the left, two months of calendar on the right, and
	the resolved dates spelled out above Cancel / Update.

	EVERY DATE HERE IS AN IST DAY. "Today" is the Indian today, not the browser's,
	and the presets are built from it — see $lib/ist-dates for why that has to be
	shared with the server rather than recomputed here.

	NOTHING IS APPLIED UNTIL "Update". The draft range lives in this component, so
	clicking around the calendar does not fire a query per click. The parent only
	hears the range once, when the user says they mean it. Cancel discards the
	draft and restores whatever was applied.

	THE SELECTABLE WINDOW IS THE ONE THE SERVER HONOURS. Days before
	MAX_RANGE_DAYS ago and days after today are disabled rather than accepted and
	then quietly shortened — a picker that offers a range the aggregator will
	refuse is a picker that lies about what is on screen.
-->
<script lang="ts">
	import {
		IST_PRESETS,
		IST_TIMEZONE,
		MAX_RANGE_DAYS,
		MONTHS_LONG,
		WEEKDAYS_SHORT,
		addDays,
		daysBetween,
		firstOfMonth,
		formatIstRange,
		istMonthGrid,
		istPresetRange,
		istToday,
		matchIstPreset,
		monthOf,
		shiftMonth,
		yearOf,
		type IstPresetId
	} from '$lib/ist-dates';

	let {
		start,
		end,
		onapply,
		/** Overridable so this can be tested without waiting for midnight in Kolkata. */
		today = istToday()
	}: {
		start: string;
		end: string;
		onapply: (range: { start: string; end: string }) => void;
		today?: string;
	} = $props();

	let open = $state(false);
	let draftStart = $state(start);
	let draftEnd = $state(end);
	/** Held between the first and second click of a new selection. */
	let pending = $state<string | null>(null);
	let hovered = $state<string | null>(null);
	let viewYear = $state(yearOf(end));
	let viewMonth = $state(monthOf(end));
	let root: HTMLElement | undefined = $state();

	/** The earliest selectable day: the aggregator refuses longer spans. */
	const floor = $derived(addDays(today, -(MAX_RANGE_DAYS - 1)));

	const rightPane = $derived(shiftMonth(viewYear, viewMonth, 1));
	const leftWeeks = $derived(istMonthGrid(viewYear, viewMonth));
	const rightWeeks = $derived(istMonthGrid(rightPane.year, rightPane.month));

	/**
	 * What the calendar is currently showing as chosen.
	 *
	 * While a second click is pending, the hovered day stands in for the far end,
	 * so the highlight and the footer track the pointer instead of freezing on the
	 * single day that was clicked first.
	 */
	const previewStart = $derived(
		pending && hovered ? (pending <= hovered ? pending : hovered) : draftStart
	);
	const previewEnd = $derived(
		pending && hovered ? (pending <= hovered ? hovered : pending) : draftEnd
	);
	const previewDays = $derived(daysBetween(previewStart, previewEnd));
	const activePreset = $derived(pending ? null : matchIstPreset(draftStart, draftEnd, today));

	/** Both panes stay inside the selectable window; the right one ends at today's month. */
	const monthFloor = $derived(yearOf(floor) * 12 + monthOf(floor));
	const monthCeil = $derived(yearOf(today) * 12 + monthOf(today) - 1);
	const canGoBack = $derived(viewYear * 12 + viewMonth > monthFloor);
	const canGoForward = $derived(viewYear * 12 + viewMonth < monthCeil);

	const yearOptions = $derived(
		Array.from(
			{ length: yearOf(today) - yearOf(floor) + 1 },
			(_, i) => yearOf(floor) + i
		)
	);

	function setLeftMonth(year: number, month: number) {
		const clamped = Math.max(monthFloor, Math.min(monthCeil, year * 12 + month));
		viewYear = Math.floor(clamped / 12);
		viewMonth = ((clamped % 12) + 12) % 12;
	}

	function stepMonth(by: number) {
		setLeftMonth(viewYear, viewMonth + by);
	}

	/**
	 * Move whichever pane the dropdown belongs to, keeping the left one as the
	 * anchor: the right pane is always the left pane plus one month, so choosing
	 * "August" on the right means the left pane goes to July.
	 */
	function setPaneMonth(offset: number, year: number, month: number) {
		setLeftMonth(year, month - offset);
	}

	function selectable(day: string | null): day is string {
		return day !== null && day >= floor && day <= today;
	}

	function inPreview(day: string | null): boolean {
		return day !== null && day >= previewStart && day <= previewEnd;
	}

	function isEdge(day: string | null): boolean {
		return day !== null && (day === previewStart || day === previewEnd);
	}

	function pick(day: string | null) {
		if (!selectable(day)) return;
		if (pending === null) {
			// First click: collapse to the clicked day and wait for the far end.
			pending = day;
			draftStart = day;
			draftEnd = day;
		} else {
			const reversed = day < pending;
			draftStart = reversed ? day : pending;
			draftEnd = reversed ? pending : day;
			pending = null;
		}
		hovered = null;
	}

	function choosePreset(id: IstPresetId) {
		const r = istPresetRange(id, today);
		draftStart = r.start;
		draftEnd = r.end;
		pending = null;
		hovered = null;
		showMonthOf(r.end);
	}

	/** Put a day in the right-hand pane, the way the Ads Manager control does. */
	function showMonthOf(day: string) {
		const back = shiftMonth(yearOf(day), monthOf(day), -1);
		setLeftMonth(back.year, back.month);
	}

	function openPicker() {
		draftStart = start;
		draftEnd = end;
		pending = null;
		hovered = null;
		showMonthOf(end);
		open = true;
	}

	function cancel() {
		open = false;
		pending = null;
		hovered = null;
	}

	function apply() {
		// A half-finished selection applies as the one day that was clicked, which
		// is what the calendar has been showing highlighted the whole time.
		onapply({ start: draftStart, end: draftEnd });
		open = false;
		pending = null;
		hovered = null;
	}

	function onWindowPointerDown(event: MouseEvent) {
		if (!open || !root) return;
		if (!root.contains(event.target as Node)) cancel();
	}

	function onWindowKeydown(event: KeyboardEvent) {
		if (open && event.key === 'Escape') {
			event.stopPropagation();
			cancel();
		}
	}
</script>

<svelte:window onmousedown={onWindowPointerDown} onkeydown={onWindowKeydown} />

{#snippet monthPane(weeks: (string | null)[][], year: number, month: number, offset: number)}
	<div class="w-[15.5rem]">
		<div class="mb-2 flex h-7 items-center justify-center gap-1">
			{#if offset === 0}
				<button
					type="button"
					aria-label="Previous month"
					disabled={!canGoBack}
					onclick={() => stepMonth(-1)}
					class="mr-auto rounded px-1.5 py-0.5 text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-100 disabled:pointer-events-none disabled:opacity-25"
					>&lsaquo;</button
				>
			{/if}
			<select
				aria-label="Month"
				value={month}
				onchange={(e) => setPaneMonth(offset, year, Number(e.currentTarget.value))}
				class="rounded bg-transparent px-1 py-0.5 text-xs font-semibold text-slate-100 outline-none hover:bg-white/5"
			>
				{#each MONTHS_LONG as name, i}
					<option value={i} class="bg-slate-900">{name}</option>
				{/each}
			</select>
			<select
				aria-label="Year"
				value={year}
				onchange={(e) => setPaneMonth(offset, Number(e.currentTarget.value), month)}
				class="rounded bg-transparent px-1 py-0.5 text-xs font-semibold text-slate-100 outline-none hover:bg-white/5"
			>
				{#each yearOptions as y}
					<option value={y} class="bg-slate-900">{y}</option>
				{/each}
			</select>
			{#if offset === 1}
				<button
					type="button"
					aria-label="Next month"
					disabled={!canGoForward}
					onclick={() => stepMonth(1)}
					class="ml-auto rounded px-1.5 py-0.5 text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-100 disabled:pointer-events-none disabled:opacity-25"
					>&rsaquo;</button
				>
			{/if}
		</div>

		<div class="grid grid-cols-7 gap-y-1 text-center">
			{#each WEEKDAYS_SHORT as w}
				<div class="pb-1 text-[10px] font-medium uppercase tracking-wide text-slate-500">
					{w.slice(0, 3)}
				</div>
			{/each}
			{#each weeks as week}
				{#each week as day}
					{#if day === null}
						<div></div>
					{:else}
						<button
							type="button"
							disabled={!selectable(day)}
							onclick={() => pick(day)}
							onmouseenter={() => (hovered = selectable(day) ? day : null)}
							aria-label={day}
							aria-current={day === today ? 'date' : undefined}
							class="mx-auto flex h-7 w-7 items-center justify-center text-xs tabular-nums transition-colors
								{isEdge(day)
								? 'rounded bg-emerald-500 font-semibold text-slate-950'
								: inPreview(day)
									? 'bg-emerald-500/15 text-emerald-200'
									: 'rounded text-slate-300 hover:bg-white/10'}
								{day === today && !isEdge(day) ? 'ring-1 ring-inset ring-emerald-500/50' : ''}
								disabled:pointer-events-none disabled:bg-transparent disabled:text-slate-700"
						>
							{Number(day.slice(8, 10))}
						</button>
					{/if}
				{/each}
			{/each}
		</div>
	</div>
{/snippet}

<div class="relative" bind:this={root}>
	<button
		type="button"
		onclick={() => (open ? cancel() : openPicker())}
		aria-expanded={open}
		class="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[15px] transition-colors
			{open
			? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
			: 'border-white/[0.08] text-slate-300 hover:border-white/20 hover:text-slate-100'}"
	>
		<span aria-hidden="true">🗓</span>
		<span class="font-medium">{formatIstRange(start, end)}</span>
		<span class="text-slate-500">▾</span>
	</button>

	{#if open}
		<div
			class="absolute left-0 z-40 mt-2 flex overflow-hidden rounded-xl border border-white/10 bg-slate-900 shadow-2xl shadow-black/60"
			role="dialog"
			aria-label="Choose a date range"
		>
			<!-- Preset rail. Ranges people actually ask for, so the common case is
			     one click rather than two calendar hunts. -->
			<div
				class="max-h-[22rem] w-44 shrink-0 overflow-y-auto border-r border-white/10 bg-black/20 py-2"
			>
				{#each IST_PRESETS as preset}
					<button
						type="button"
						onclick={() => choosePreset(preset.id)}
						aria-pressed={activePreset === preset.id}
						class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors
							{activePreset === preset.id
							? 'text-emerald-300'
							: 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}"
					>
						<span
							class="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border
								{activePreset === preset.id ? 'border-emerald-400' : 'border-slate-600'}"
						>
							{#if activePreset === preset.id}
								<span class="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
							{/if}
						</span>
						{preset.label}
					</button>
				{/each}
			</div>

			<div class="p-4">
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div class="flex gap-6" onmouseleave={() => (hovered = null)}>
					{@render monthPane(leftWeeks, viewYear, viewMonth, 0)}
					{@render monthPane(rightWeeks, rightPane.year, rightPane.month, 1)}
				</div>

				<div class="mt-4 flex items-end justify-between gap-6 border-t border-white/10 pt-3">
					<div class="text-xs">
						<div class="font-medium text-slate-100">
							{formatIstRange(previewStart, previewEnd)}
							<span class="text-slate-500"
								>· {previewDays} {previewDays === 1 ? 'day' : 'days'}</span
							>
						</div>
						<div class="mt-0.5 text-[11px] text-slate-500">
							Dates are shown in Kolkata time ({IST_TIMEZONE}) · up to {MAX_RANGE_DAYS} days
						</div>
					</div>
					<div class="flex shrink-0 gap-2">
						<button
							type="button"
							onclick={cancel}
							class="rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs text-slate-300 transition-colors hover:border-white/20 hover:text-slate-100"
							>Cancel</button
						>
						<button
							type="button"
							onclick={apply}
							class="rounded-lg bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-slate-950 transition-colors hover:bg-emerald-400"
							>Update</button
						>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>
