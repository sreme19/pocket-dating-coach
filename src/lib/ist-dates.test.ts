import { describe, it, expect, vi, afterEach } from 'vitest';
import {
	GRANULARITIES,
	MAX_RANGE_DAYS,
	addDays,
	autoGranularity,
	bucketCount,
	dayOfWeek,
	daysBetween,
	formatBucket,
	formatBucketLong,
	formatIstDay,
	formatIstRange,
	granularityAllowed,
	isIstDay,
	istBucket,
	istBucketKeys,
	istDay,
	istMonthGrid,
	istPresetRange,
	istToday,
	matchIstPreset,
	resolveGranularity,
	resolveIstRange,
	shiftMonth,
	IST_PRESETS
} from './ist-dates';

afterEach(() => {
	vi.useRealTimers();
});

/** Freeze the clock at a UTC instant so IST-day math is checkable. */
function atUtc(iso: string) {
	vi.useFakeTimers();
	vi.setSystemTime(new Date(iso));
}

describe('istDay', () => {
	it('files a late-UTC-evening timestamp under the NEXT Indian day', () => {
		// 20:00 UTC is 01:30 the following morning in Kolkata. Bucketing this by
		// UTC is the bug the whole module exists to prevent.
		expect(istDay('2026-08-09T20:00:00.000Z')).toBe('2026-08-10');
	});

	it('keeps a timestamp just before the IST boundary on the earlier day', () => {
		expect(istDay('2026-08-09T18:29:59.000Z')).toBe('2026-08-09');
		expect(istDay('2026-08-09T18:30:00.000Z')).toBe('2026-08-10');
	});

	it('returns empty string for an unparseable timestamp rather than throwing', () => {
		expect(istDay('not a date')).toBe('');
	});
});

describe('istToday', () => {
	it('is already tomorrow in Kolkata late on a UTC evening', () => {
		atUtc('2026-08-09T19:00:00.000Z');
		expect(istToday()).toBe('2026-08-10');
	});

	it('is still yesterday in Kolkata early on a UTC morning', () => {
		atUtc('2026-08-10T02:00:00.000Z');
		expect(istToday()).toBe('2026-08-10');
	});
});

describe('addDays / daysBetween', () => {
	it('crosses month and year boundaries', () => {
		expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
		expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
	});

	it('handles a leap day', () => {
		expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
		expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
	});

	it('counts inclusively — one day is 1, not 0', () => {
		expect(daysBetween('2026-08-10', '2026-08-10')).toBe(1);
		expect(daysBetween('2026-08-04', '2026-08-10')).toBe(7);
	});
});

describe('isIstDay', () => {
	it('rejects a day that does not exist', () => {
		expect(isIstDay('2026-02-31')).toBe(false);
		expect(isIstDay('2026-13-01')).toBe(false);
	});

	it('rejects anything that is not a bare YYYY-MM-DD string', () => {
		expect(isIstDay('2026-08-10T00:00:00Z')).toBe(false);
		expect(isIstDay('10/08/2026')).toBe(false);
		expect(isIstDay(null)).toBe(false);
		expect(isIstDay(20260810)).toBe(false);
	});

	it('accepts a real day', () => {
		expect(isIstDay('2026-08-10')).toBe(true);
		expect(isIstDay('2028-02-29')).toBe(true);
	});
});

describe('resolveIstRange', () => {
	const today = '2026-08-10';

	it('uses explicit dates as given', () => {
		expect(resolveIstRange({ start: '2026-08-01', end: '2026-08-05' }, today)).toEqual({
			start: '2026-08-01',
			end: '2026-08-05',
			days: 5,
			clamped: false
		});
	});

	it('swaps a backwards pair instead of returning nothing', () => {
		const r = resolveIstRange({ start: '2026-08-05', end: '2026-08-01' }, today);
		expect([r.start, r.end]).toEqual(['2026-08-01', '2026-08-05']);
	});

	it('treats a lone endpoint as a single day', () => {
		expect(resolveIstRange({ start: '2026-08-03' }, today)).toMatchObject({
			start: '2026-08-03',
			end: '2026-08-03',
			days: 1
		});
		expect(resolveIstRange({ end: '2026-08-03' }, today)).toMatchObject({
			start: '2026-08-03',
			end: '2026-08-03'
		});
	});

	it('pulls a future end back to today and says it did', () => {
		const r = resolveIstRange({ start: '2026-08-08', end: '2026-12-31' }, today);
		expect(r).toEqual({ start: '2026-08-08', end: today, days: 3, clamped: true });
	});

	it('never returns a range that starts after it ends, even when both are future', () => {
		const r = resolveIstRange({ start: '2027-01-01', end: '2027-02-01' }, today);
		expect(r.start).toBe(today);
		expect(r.end).toBe(today);
		expect(r.clamped).toBe(true);
	});

	it('shortens a span longer than the cap from the END, keeping the recent days', () => {
		const r = resolveIstRange({ start: '2020-01-01', end: today }, today);
		expect(r.days).toBe(MAX_RANGE_DAYS);
		expect(r.end).toBe(today);
		expect(r.start).toBe(addDays(today, -(MAX_RANGE_DAYS - 1)));
		expect(r.clamped).toBe(true);
	});

	it('falls back to the last N days when no dates are given', () => {
		expect(resolveIstRange({ days: 7 }, today)).toEqual({
			start: '2026-08-04',
			end: today,
			days: 7,
			clamped: false
		});
	});

	it('accepts days as the string a query param actually is', () => {
		expect(resolveIstRange({ days: '90' }, today).days).toBe(90);
	});

	it('defaults to 30 days on junk input', () => {
		expect(resolveIstRange({ days: 'banana' }, today).days).toBe(30);
		expect(resolveIstRange({ start: 'yesterday', end: '' }, today).days).toBe(30);
		expect(resolveIstRange({}, today).days).toBe(30);
	});

	it('caps an absurd day count and flags it', () => {
		const r = resolveIstRange({ days: 100000 }, today);
		expect(r.days).toBe(MAX_RANGE_DAYS);
		expect(r.clamped).toBe(true);
	});

	it('prefers explicit dates over days when both arrive', () => {
		expect(resolveIstRange({ start: '2026-07-01', end: '2026-07-02', days: 90 }, today)).toMatchObject(
			{ start: '2026-07-01', end: '2026-07-02', days: 2 }
		);
	});
});

describe('istPresetRange', () => {
	// 2026-08-10 is a Monday, which makes the Sunday-start week boundaries visible.
	const today = '2026-08-10';

	it('resolves single-day presets', () => {
		expect(istPresetRange('today', today)).toMatchObject({ start: today, end: today, days: 1 });
		expect(istPresetRange('yesterday', today)).toMatchObject({
			start: '2026-08-09',
			end: '2026-08-09',
			days: 1
		});
	});

	it('counts today inside "last N days", matching the 7d/30d/90d chips', () => {
		expect(istPresetRange('last7', today)).toMatchObject({ start: '2026-08-04', end: today });
		expect(istPresetRange('last30', today)).toMatchObject({ start: '2026-07-12', end: today });
		expect(istPresetRange('last90', today).days).toBe(90);
	});

	it('starts weeks on Sunday', () => {
		expect(dayOfWeek(today)).toBe(1); // Monday
		expect(istPresetRange('thisWeek', today)).toMatchObject({ start: '2026-08-09', end: today });
		expect(istPresetRange('lastWeek', today)).toMatchObject({
			start: '2026-08-02',
			end: '2026-08-08',
			days: 7
		});
	});

	it('ends "this month" at today, not at the month end', () => {
		expect(istPresetRange('thisMonth', today)).toMatchObject({ start: '2026-08-01', end: today });
	});

	it('spans the whole of last month', () => {
		expect(istPresetRange('lastMonth', today)).toMatchObject({
			start: '2026-07-01',
			end: '2026-07-31',
			days: 31
		});
	});

	it('handles a January "last month" without falling out of the year', () => {
		expect(istPresetRange('lastMonth', '2026-01-15')).toMatchObject({
			start: '2025-12-01',
			end: '2025-12-31'
		});
	});

	it('never proposes a range the aggregator would refuse', () => {
		for (const { id } of IST_PRESETS) {
			const r = istPresetRange(id, today);
			expect(r.days, id).toBeLessThanOrEqual(MAX_RANGE_DAYS);
			expect(r.end <= today, id).toBe(true);
			expect(r.start <= r.end, id).toBe(true);
		}
	});
});

describe('matchIstPreset', () => {
	const today = '2026-08-10';

	it('recognises every preset it produced', () => {
		for (const { id } of IST_PRESETS) {
			const r = istPresetRange(id, today);
			// Some presets coincide (a 2-day span is both "today and yesterday" and
			// nothing else here), so assert a match resolves to the same dates
			// rather than to the same id.
			const matched = matchIstPreset(r.start, r.end, today);
			expect(matched, id).not.toBeNull();
			expect(istPresetRange(matched!, today)).toMatchObject({ start: r.start, end: r.end });
		}
	});

	it('returns null for a hand-picked range', () => {
		expect(matchIstPreset('2026-08-03', '2026-08-07', today)).toBeNull();
	});
});

describe('istMonthGrid', () => {
	it('pads the first week so the 1st lands on its real weekday', () => {
		// 1 Aug 2026 is a Saturday, so the first week is six nulls then the 1st.
		const weeks = istMonthGrid(2026, 7);
		expect(weeks[0]).toEqual([null, null, null, null, null, null, '2026-08-01']);
	});

	it('needs no leading padding when the month starts on a Sunday', () => {
		expect(dayOfWeek('2026-02-01')).toBe(0);
		expect(istMonthGrid(2026, 1)[0][0]).toBe('2026-02-01');
	});

	it('emits every day of the month exactly once, in seven-cell weeks', () => {
		const weeks = istMonthGrid(2026, 7);
		for (const week of weeks) expect(week).toHaveLength(7);
		const days = weeks.flat().filter(Boolean);
		expect(days).toHaveLength(31);
		expect(days[0]).toBe('2026-08-01');
		expect(days[30]).toBe('2026-08-31');
		expect(new Set(days).size).toBe(31);
	});

	it('includes 29 February in a leap year', () => {
		const days = istMonthGrid(2028, 1).flat().filter(Boolean);
		expect(days).toHaveLength(29);
		expect(days.at(-1)).toBe('2028-02-29');
	});

	it('rolls December into the next January', () => {
		const days = istMonthGrid(2026, 11).flat().filter(Boolean);
		expect(days.at(-1)).toBe('2026-12-31');
	});
});

describe('shiftMonth', () => {
	it('wraps across a year in both directions', () => {
		expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
		expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
		expect(shiftMonth(2026, 7, -8)).toEqual({ year: 2025, month: 11 });
	});
});

describe('istBucket', () => {
	it('keeps day granularity as a bare day, so daily consumers are unchanged', () => {
		expect(istBucket('2026-08-09T20:00:00.000Z', 'day')).toBe('2026-08-10');
		expect(istBucket('2026-08-09T20:00:00.000Z', 'day')).toBe(istDay('2026-08-09T20:00:00.000Z'));
	});

	it('floors to the IST hour, not the UTC one', () => {
		// 07:17 UTC is 12:47 IST — the hour bucket must be 12, not 07.
		expect(istBucket('2026-08-10T07:17:33.000Z', 'hour')).toBe('2026-08-10T12:00');
	});

	it('floors 15-minute buckets to :00/:15/:30/:45 on the Kolkata clock', () => {
		// IST is offset by a half hour, so this is the case a naive floor gets wrong.
		expect(istBucket('2026-08-10T07:17:33.000Z', 'quarter')).toBe('2026-08-10T12:45');
		expect(istBucket('2026-08-10T07:14:59.000Z', 'quarter')).toBe('2026-08-10T12:30');
		expect(istBucket('2026-08-10T07:15:00.000Z', 'quarter')).toBe('2026-08-10T12:45');
	});

	it('drops seconds for minute buckets', () => {
		expect(istBucket('2026-08-10T07:17:59.999Z', 'minute')).toBe('2026-08-10T12:47');
	});

	it('rolls an IST midnight boundary into the next day', () => {
		// 18:30 UTC is exactly 00:00 IST the following day.
		expect(istBucket('2026-08-09T18:29:00.000Z', 'hour')).toBe('2026-08-09T23:00');
		expect(istBucket('2026-08-09T18:30:00.000Z', 'hour')).toBe('2026-08-10T00:00');
		expect(istBucket('2026-08-09T18:30:00.000Z', 'minute')).toBe('2026-08-10T00:00');
	});

	it('returns empty string for an unparseable timestamp', () => {
		expect(istBucket('nonsense', 'hour')).toBe('');
	});
});

describe('istBucketKeys', () => {
	it('covers a single day exactly, with no bucket from the neighbouring days', () => {
		const hours = istBucketKeys('2026-08-10', '2026-08-10', 'hour');
		expect(hours).toHaveLength(24);
		expect(hours[0]).toBe('2026-08-10T00:00');
		expect(hours[23]).toBe('2026-08-10T23:00');
	});

	it('produces one key per bucket across a multi-day range', () => {
		expect(istBucketKeys('2026-08-09', '2026-08-10', 'hour')).toHaveLength(48);
		expect(istBucketKeys('2026-08-09', '2026-08-10', 'quarter')).toHaveLength(192);
		expect(istBucketKeys('2026-08-10', '2026-08-10', 'minute')).toHaveLength(1440);
		expect(istBucketKeys('2026-08-09', '2026-08-10', 'day')).toEqual(['2026-08-09', '2026-08-10']);
	});

	it('is sorted, unique, and matches bucketCount', () => {
		for (const g of GRANULARITIES) {
			const keys = istBucketKeys('2026-08-09', '2026-08-10', g.id);
			expect(new Set(keys).size, g.id).toBe(keys.length);
			expect([...keys].sort(), g.id).toEqual(keys);
			expect(keys.length, g.id).toBe(bucketCount('2026-08-09', '2026-08-10', g.id));
		}
	});

	it('contains the bucket every real timestamp in the range maps to', () => {
		// The zero-fill and the bucketing have to agree, or events land on keys the
		// chart never draws and silently vanish from the totals.
		const stamps = [
			'2026-08-09T18:30:00.000Z', // 00:00 IST on the 10th
			'2026-08-10T07:17:33.000Z', // 12:47 IST
			'2026-08-09T18:29:59.000Z', // 23:59 IST on the 9th
			'2026-08-10T18:29:00.000Z' // 23:59 IST on the 10th
		];
		for (const g of GRANULARITIES) {
			const keys = new Set(istBucketKeys('2026-08-09', '2026-08-10', g.id));
			for (const s of stamps) {
				expect(keys.has(istBucket(s, g.id)), `${g.id} ${s}`).toBe(true);
			}
		}
	});
});

describe('granularity limits', () => {
	it('caps every granularity under ~3000 buckets at its longest allowed span', () => {
		for (const g of GRANULARITIES) {
			const end = '2026-08-10';
			const start = addDays(end, -(g.maxDays - 1));
			expect(bucketCount(start, end, g.id), g.id).toBeLessThanOrEqual(3000);
		}
	});

	it('allows a granularity only within its span', () => {
		expect(granularityAllowed('minute', 2)).toBe(true);
		expect(granularityAllowed('minute', 3)).toBe(false);
		expect(granularityAllowed('hour', 31)).toBe(true);
		expect(granularityAllowed('hour', 32)).toBe(false);
		expect(granularityAllowed('day', MAX_RANGE_DAYS)).toBe(true);
	});

	it('picks a coarser auto than the cap would permit, so buckets stay meaningful', () => {
		// 7 days of minutes fits under the caps arithmetic but is 10,080 mostly-empty
		// buckets — auto deliberately does not go there.
		expect(autoGranularity(1)).toBe('minute');
		expect(autoGranularity(2)).toBe('quarter');
		expect(autoGranularity(7)).toBe('hour');
		expect(autoGranularity(14)).toBe('hour');
		expect(autoGranularity(30)).toBe('day');
		expect(autoGranularity(MAX_RANGE_DAYS)).toBe('day');
	});

	it('never auto-picks a granularity it would then disallow', () => {
		for (let days = 1; days <= MAX_RANGE_DAYS; days++) {
			const g = autoGranularity(days);
			expect(granularityAllowed(g, days), `${days}d → ${g}`).toBe(true);
		}
	});
});

describe('resolveGranularity', () => {
	it('honours an explicit granularity that fits', () => {
		expect(resolveGranularity('hour', 7)).toEqual({ granularity: 'hour', clamped: false });
	});

	it('coarsens a granularity too fine for the span, and admits it', () => {
		expect(resolveGranularity('minute', 30)).toEqual({ granularity: 'day', clamped: true });
		expect(resolveGranularity('quarter', 14)).toEqual({ granularity: 'hour', clamped: true });
	});

	it('treats auto and absent as auto, without flagging a clamp', () => {
		expect(resolveGranularity('auto', 30)).toEqual({ granularity: 'day', clamped: false });
		expect(resolveGranularity(null, 2)).toEqual({ granularity: 'quarter', clamped: false });
		expect(resolveGranularity(undefined, 1)).toEqual({ granularity: 'minute', clamped: false });
	});

	it('falls back to auto on junk rather than throwing', () => {
		expect(resolveGranularity('fortnight', 7)).toEqual({ granularity: 'hour', clamped: false });
		expect(resolveGranularity('', 7)).toEqual({ granularity: 'hour', clamped: false });
	});
});

describe('bucket labels', () => {
	it('shows only the clock on the axis, and the day too in a tooltip', () => {
		expect(formatBucket('2026-08-10T12:45', 'quarter')).toBe('12:45');
		expect(formatBucketLong('2026-08-10T12:45', 'quarter')).toBe('10 Aug 2026, 12:45');
	});

	it('labels day buckets as a date, not a time', () => {
		expect(formatBucket('2026-08-10', 'day')).toBe('10 Aug');
		expect(formatBucketLong('2026-08-10', 'day')).toBe('10 Aug 2026');
	});
});

describe('formatting', () => {
	it('writes a single day the way a person reads it', () => {
		expect(formatIstDay('2026-08-10')).toBe('10 Aug 2026');
		expect(formatIstDay('2026-08-01')).toBe('1 Aug 2026');
	});

	it('collapses the parts both ends of a range share', () => {
		expect(formatIstRange('2026-08-04', '2026-08-10')).toBe('4 – 10 Aug 2026');
		expect(formatIstRange('2026-07-28', '2026-08-10')).toBe('28 Jul – 10 Aug 2026');
		expect(formatIstRange('2025-12-30', '2026-01-02')).toBe('30 Dec 2025 – 2 Jan 2026');
	});

	it('writes a one-day range once', () => {
		expect(formatIstRange('2026-08-10', '2026-08-10')).toBe('10 Aug 2026');
	});
});
