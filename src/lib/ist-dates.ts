/**
 * Asia/Kolkata calendar-day arithmetic, shared by the ad-analytics aggregator
 * and the admin date-range picker.
 *
 * WHY THIS IS NOT IN $lib/server. The picker has to know what "today" is in IST
 * to build "This month" or to grey out tomorrow, and it runs in the browser. If
 * the client resolved a range against the browser's local day and the server
 * resolved it against the Indian one, the two would disagree for five and a half
 * hours out of every day — and the disagreement would be invisible, because both
 * sides would render a plausible date. One module, imported by both, is the only
 * version of this that stays correct.
 *
 * EVERY FUNCTION HERE WORKS IN UTC INTERNALLY. Dates are handled as 'YYYY-MM-DD'
 * strings anchored to T00:00:00Z and shifted by a fixed offset — never via local
 * getters like getDate(), which would reintroduce the machine's timezone.
 */

/** Asia/Kolkata is UTC+5:30 year-round — no daylight saving to track. */
export const IST_OFFSET_MINUTES = 330;

export const IST_TIMEZONE = 'Asia/Kolkata';

/**
 * Longest range the ad dashboard will aggregate, in IST days.
 *
 * The picker enforces the same number so a range it accepts is a range the
 * server will actually honour, rather than one it silently shortens.
 */
export const MAX_RANGE_DAYS = 180;

export const DEFAULT_RANGE_DAYS = 30;

const DAY_MS = 86_400_000;

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const MONTHS_LONG = [
	'January',
	'February',
	'March',
	'April',
	'May',
	'June',
	'July',
	'August',
	'September',
	'October',
	'November',
	'December'
];

/** Sunday first, matching the calendar grid this picker is modelled on. */
export const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * A real 'YYYY-MM-DD' day.
 *
 * Checked by round-trip rather than by Date.parse alone: V8 happily parses
 * '2026-02-31' and rolls it forward to 3 March, so parsing successfully proves
 * nothing about whether the date the caller typed exists. Re-serialising and
 * comparing catches the rollover.
 */
export function isIstDay(value: unknown): value is string {
	if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	const at = new Date(`${value}T00:00:00.000Z`);
	return !Number.isNaN(at.getTime()) && at.toISOString().slice(0, 10) === value;
}

/** The IST calendar day a UTC timestamp falls in. */
export function istDay(iso: string): string {
	const at = new Date(iso);
	if (Number.isNaN(at.getTime())) return '';
	return new Date(at.getTime() + IST_OFFSET_MINUTES * 60_000).toISOString().slice(0, 10);
}

/** Today in IST, so "last 30 days" means the last 30 Indian days. */
export function istToday(): string {
	return new Date(Date.now() + IST_OFFSET_MINUTES * 60_000).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
	const at = new Date(`${date}T00:00:00.000Z`);
	at.setUTCDate(at.getUTCDate() + days);
	return at.toISOString().slice(0, 10);
}

/** Inclusive span: a single day is 1, not 0. */
export function daysBetween(start: string, end: string): number {
	const a = Date.parse(`${start}T00:00:00.000Z`);
	const b = Date.parse(`${end}T00:00:00.000Z`);
	return Math.round((b - a) / DAY_MS) + 1;
}

/** Day of week, 0 = Sunday, read in UTC so the local machine cannot shift it. */
export function dayOfWeek(date: string): number {
	return new Date(`${date}T00:00:00.000Z`).getUTCDay();
}

export function yearOf(date: string): number {
	return Number(date.slice(0, 4));
}

/** 0-indexed, to match Date's month numbering. */
export function monthOf(date: string): number {
	return Number(date.slice(5, 7)) - 1;
}

export function firstOfMonth(year: number, month: number): string {
	const y = String(year).padStart(4, '0');
	const m = String(month + 1).padStart(2, '0');
	return `${y}-${m}-01`;
}

/** '10 Aug 2026'. Hand-rolled rather than Intl so no timezone can intervene. */
export function formatIstDay(date: string): string {
	if (!isIstDay(date)) return '—';
	return `${Number(date.slice(8, 10))} ${MONTHS_SHORT[monthOf(date)]} ${yearOf(date)}`;
}

/**
 * A range as a person reads it: '4 – 10 Aug 2026', collapsing the parts both
 * ends share. A single day renders once.
 */
export function formatIstRange(start: string, end: string): string {
	if (!isIstDay(start) || !isIstDay(end)) return '—';
	if (start === end) return formatIstDay(start);
	const sameYear = yearOf(start) === yearOf(end);
	const sameMonth = sameYear && monthOf(start) === monthOf(end);
	if (sameMonth) return `${Number(start.slice(8, 10))} – ${formatIstDay(end)}`;
	if (sameYear) {
		return `${Number(start.slice(8, 10))} ${MONTHS_SHORT[monthOf(start)]} – ${formatIstDay(end)}`;
	}
	return `${formatIstDay(start)} – ${formatIstDay(end)}`;
}

export interface IstRangeRequest {
	start?: string | null;
	end?: string | null;
	/** Fallback when no explicit dates are given: the last N IST days. */
	days?: number | string | null;
}

export interface IstRange {
	start: string;
	end: string;
	/** Inclusive day count of the resolved range. */
	days: number;
	/** True when the request was adjusted — a future end, or an over-long span. */
	clamped: boolean;
}

/**
 * Turn an untrusted range request into a range that is guaranteed usable.
 *
 * Explicit dates win over `days`, a reversed pair is swapped rather than
 * rejected, and a lone endpoint means a single day. The end never runs past
 * today in IST, and the span never exceeds MAX_RANGE_DAYS.
 *
 * `clamped` is returned rather than thrown so the caller can say what it did.
 * Silently shortening a range is how a dashboard ends up answering a question
 * nobody asked.
 */
export function resolveIstRange(req: IstRangeRequest, today: string = istToday()): IstRange {
	let clamped = false;
	let start = isIstDay(req.start) ? req.start : null;
	let end = isIstDay(req.end) ? req.end : null;

	if (start || end) {
		start ??= end;
		end ??= start;
		if (start! > end!) [start, end] = [end, start];
	} else {
		const requested = Number(req.days);
		const asked =
			Number.isFinite(requested) && requested >= 1 ? Math.round(requested) : DEFAULT_RANGE_DAYS;
		if (asked > MAX_RANGE_DAYS) clamped = true;
		end = today;
		start = addDays(end, -(Math.min(asked, MAX_RANGE_DAYS) - 1));
	}

	// No future. A partial today is legitimate; a tomorrow is not.
	if (end! > today) {
		end = today;
		clamped = true;
		if (start! > end) start = end;
	}

	if (daysBetween(start!, end!) > MAX_RANGE_DAYS) {
		start = addDays(end!, -(MAX_RANGE_DAYS - 1));
		clamped = true;
	}

	return { start: start!, end: end!, days: daysBetween(start!, end!), clamped };
}

/* ─────────────────────────── sub-daily buckets ───────────────────────────── */

/**
 * How finely a range is sliced for the trend charts.
 *
 * Every event table stores a full `created_at`, so none of this needs a schema
 * change — it only changes where the timestamp gets truncated. `auto` is
 * resolved to a real granularity by `resolveGranularity` before use.
 */
export type Granularity = 'day' | 'hour' | 'quarter' | 'minute';

export const GRANULARITIES: {
	id: Granularity;
	label: string;
	/** Minutes per bucket. */
	minutes: number;
	/** Longest range, in IST days, this granularity may be used over. */
	maxDays: number;
}[] = [
	{ id: 'day', label: 'Day', minutes: 1440, maxDays: MAX_RANGE_DAYS },
	{ id: 'hour', label: 'Hour', minutes: 60, maxDays: 31 },
	{ id: 'quarter', label: '15 min', minutes: 15, maxDays: 7 },
	{ id: 'minute', label: 'Minute', minutes: 1, maxDays: 2 }
];

/**
 * The caps above exist because bucket count is span ÷ granularity, and nothing
 * stops that from being absurd: minute buckets over 180 days is 259,200 points,
 * which is not a chart. Each cap keeps the worst case under ~3,000 buckets.
 *
 * They are enforced on the server as well as in the UI, so a hand-edited URL
 * cannot ask for the absurd version.
 */
export function granularityAllowed(g: Granularity, days: number): boolean {
	const spec = GRANULARITIES.find((x) => x.id === g);
	return spec ? days <= spec.maxDays : false;
}

/**
 * The finest granularity a span may use — what `auto` means.
 *
 * Deliberately NOT the finest that fits under the bucket cap. A 7-day range
 * sliced into minutes is 10,080 buckets of almost entirely zero, which hides the
 * shape it was meant to reveal. Auto picks the coarsest granularity that still
 * gives a useful number of buckets, and lets the reader go finer by hand.
 */
export function autoGranularity(days: number): Granularity {
	if (days <= 1) return 'minute';
	if (days <= 2) return 'quarter';
	if (days <= 14) return 'hour';
	return 'day';
}

/** Validate a requested granularity against a span, falling back to auto. */
export function resolveGranularity(
	requested: string | null | undefined,
	days: number
): { granularity: Granularity; clamped: boolean } {
	if (requested && requested !== 'auto') {
		const g = GRANULARITIES.find((x) => x.id === requested)?.id;
		if (g && granularityAllowed(g, days)) return { granularity: g, clamped: false };
		// Asked for something real but too fine for the span, or asked for junk.
		// Coarsened rather than refused: the reader gets the chart they can have,
		// and `clamped` lets the UI say the granularity is not the one requested.
		if (g) return { granularity: autoGranularity(days), clamped: true };
	}
	return { granularity: autoGranularity(days), clamped: false };
}

/** Bucket count for a span. Cheap enough to call before building anything. */
export function bucketCount(start: string, end: string, g: Granularity): number {
	const minutes = GRANULARITIES.find((x) => x.id === g)?.minutes ?? 1440;
	return Math.round((daysBetween(start, end) * 1440) / minutes);
}

/**
 * The bucket key a UTC timestamp falls in, at the given granularity.
 *
 * Day keys stay bare 'YYYY-MM-DD' so nothing downstream of the existing daily
 * charts has to change. Finer keys are 'YYYY-MM-DDTHH:MM' — sortable as strings,
 * which is what every consumer here relies on.
 */
export function istBucket(iso: string, g: Granularity): string {
	const at = new Date(iso);
	if (Number.isNaN(at.getTime())) return '';
	const shifted = new Date(at.getTime() + IST_OFFSET_MINUTES * 60_000);
	if (g === 'day') return shifted.toISOString().slice(0, 10);

	const minutes = GRANULARITIES.find((x) => x.id === g)!.minutes;
	if (minutes > 1) {
		// Floor to the bucket boundary within the hour. Done on the shifted clock
		// so a 15-minute bucket lines up with :00/:15/:30/:45 in Kolkata, which is
		// what the axis labels claim it does.
		const m = shifted.getUTCMinutes();
		shifted.setUTCMinutes(m - (m % minutes), 0, 0);
	} else {
		shifted.setUTCSeconds(0, 0);
	}
	return shifted.toISOString().slice(0, 16);
}

/**
 * Every bucket key across a range, in order, including the empty ones.
 *
 * Zero-filling is the point. A chart built only from buckets that had events
 * draws a line straight across the gaps, which reads as steady low traffic
 * rather than as nothing happening — the opposite of the truth.
 */
export function istBucketKeys(start: string, end: string, g: Granularity): string[] {
	if (g === 'day') {
		const out: string[] = [];
		for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
		return out;
	}

	const minutes = GRANULARITIES.find((x) => x.id === g)!.minutes;
	const from = Date.parse(`${start}T00:00:00.000Z`);
	const to = Date.parse(`${addDays(end, 1)}T00:00:00.000Z`);
	const out: string[] = [];
	for (let t = from; t < to; t += minutes * 60_000) {
		out.push(new Date(t).toISOString().slice(0, 16));
	}
	return out;
}

/** A bucket key rendered for an axis: '14:30', or '10 Aug' at day grain. */
export function formatBucket(key: string, g: Granularity): string {
	if (g === 'day') {
		if (!isIstDay(key)) return key;
		return `${Number(key.slice(8, 10))} ${MONTHS_SHORT[monthOf(key)]}`;
	}
	return key.slice(11);
}

/**
 * A bucket key rendered in full, for tooltips: '10 Aug, 14:30'.
 *
 * The axis is allowed to be terse because the buckets are adjacent; a tooltip is
 * read in isolation and needs the day, or an hour label is ambiguous across a
 * multi-day range.
 */
export function formatBucketLong(key: string, g: Granularity): string {
	const day = key.slice(0, 10);
	const stamp = isIstDay(day) ? formatIstDay(day) : day;
	return g === 'day' ? stamp : `${stamp}, ${key.slice(11)}`;
}

export type IstPresetId =
	| 'today'
	| 'yesterday'
	| 'todayAndYesterday'
	| 'last7'
	| 'last14'
	| 'last28'
	| 'last30'
	| 'last90'
	| 'thisWeek'
	| 'lastWeek'
	| 'thisMonth'
	| 'lastMonth'
	| 'maximum';

export const IST_PRESETS: { id: IstPresetId; label: string }[] = [
	{ id: 'today', label: 'Today' },
	{ id: 'yesterday', label: 'Yesterday' },
	{ id: 'todayAndYesterday', label: 'Today and yesterday' },
	{ id: 'last7', label: 'Last 7 days' },
	{ id: 'last14', label: 'Last 14 days' },
	{ id: 'last28', label: 'Last 28 days' },
	{ id: 'last30', label: 'Last 30 days' },
	{ id: 'last90', label: 'Last 90 days' },
	{ id: 'thisWeek', label: 'This week' },
	{ id: 'lastWeek', label: 'Last week' },
	{ id: 'thisMonth', label: 'This month' },
	{ id: 'lastMonth', label: 'Last month' },
	{ id: 'maximum', label: `Maximum (${MAX_RANGE_DAYS} days)` }
];

/**
 * The dates a preset means, in IST.
 *
 * "Last N days" INCLUDES today here, unlike Facebook's version of the same
 * label, which ends yesterday. That is deliberate: the 7d/30d/90d chips and
 * every chart on this tab have always counted today, and quietly redefining
 * them would move every number the dashboard has ever shown. The picker prints
 * the resolved dates underneath, so there is nothing left to guess at.
 */
export function istPresetRange(id: IstPresetId, today: string = istToday()): IstRange {
	const span = (days: number, end = today) => ({ start: addDays(end, -(days - 1)), end });

	let range: { start: string; end: string };
	switch (id) {
		case 'today':
			range = { start: today, end: today };
			break;
		case 'yesterday': {
			const y = addDays(today, -1);
			range = { start: y, end: y };
			break;
		}
		case 'todayAndYesterday':
			range = span(2);
			break;
		case 'last7':
			range = span(7);
			break;
		case 'last14':
			range = span(14);
			break;
		case 'last28':
			range = span(28);
			break;
		case 'last30':
			range = span(30);
			break;
		case 'last90':
			range = span(90);
			break;
		case 'thisWeek':
			range = { start: addDays(today, -dayOfWeek(today)), end: today };
			break;
		case 'lastWeek': {
			const end = addDays(today, -dayOfWeek(today) - 1);
			range = { start: addDays(end, -6), end };
			break;
		}
		case 'thisMonth':
			range = { start: firstOfMonth(yearOf(today), monthOf(today)), end: today };
			break;
		case 'lastMonth': {
			const end = addDays(firstOfMonth(yearOf(today), monthOf(today)), -1);
			range = { start: firstOfMonth(yearOf(end), monthOf(end)), end };
			break;
		}
		case 'maximum':
			range = span(MAX_RANGE_DAYS);
			break;
	}

	return resolveIstRange(range, today);
}

/** Which preset a range is, if any — so the right radio lights up. */
export function matchIstPreset(
	start: string,
	end: string,
	today: string = istToday()
): IstPresetId | null {
	for (const { id } of IST_PRESETS) {
		const r = istPresetRange(id, today);
		if (r.start === start && r.end === end) return id;
	}
	return null;
}

/**
 * A month laid out as weeks of IST days, Sunday first, with nulls for the
 * leading and trailing padding. Only the weeks the month actually touches.
 */
export function istMonthGrid(year: number, month: number): (string | null)[][] {
	const first = firstOfMonth(year, month);
	const nextMonth = month === 11 ? firstOfMonth(year + 1, 0) : firstOfMonth(year, month + 1);
	const weeks: (string | null)[][] = [];
	let week: (string | null)[] = new Array(dayOfWeek(first)).fill(null);

	for (let day = first; day < nextMonth; day = addDays(day, 1)) {
		week.push(day);
		if (week.length === 7) {
			weeks.push(week);
			week = [];
		}
	}
	if (week.length) {
		while (week.length < 7) week.push(null);
		weeks.push(week);
	}
	return weeks;
}

/** Step a (year, month) pair by whole months without wrapping wrong at 0/11. */
export function shiftMonth(year: number, month: number, by: number): { year: number; month: number } {
	const total = year * 12 + month + by;
	return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}
