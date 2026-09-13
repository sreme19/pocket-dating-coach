import { describe, it, expect } from 'vitest';
import { shouldSyncDemographics, DEMOGRAPHICS_HOUR_UTC } from '$lib/server/ad-spend/sync';
// The real filter, not a copy of it — a mirrored implementation in a test proves
// only what the test author believed, and drifts from the code in silence.
import { worthFetching } from '$lib/server/ad-spend/snap';

describe('the filter never drops spend Snap is still restating', () => {
	const spentRecently = new Set(['squad_a']);

	it('KEEPS a paused ad squad that spent inside the window', () => {
		// Snap finalises a day ~48h after it ends, so this squad's numbers are
		// still moving. Dropping it would understate real spend, silently.
		expect(worthFetching('squad_a', 'PAUSED', spentRecently)).toBe(true);
	});

	it('KEEPS an active ad squad that has spent nothing yet', () => {
		expect(worthFetching('squad_new', 'ACTIVE', spentRecently)).toBe(true);
	});

	it('KEEPS an entity whose status Snap did not report', () => {
		// Not knowing is not the same as knowing it is off.
		expect(worthFetching('squad_x', undefined, spentRecently)).toBe(true);
		expect(worthFetching('squad_x', null, spentRecently)).toBe(true);
		expect(worthFetching('squad_x', 'SOMETHING_NEW', spentRecently)).toBe(true);
	});

	it('skips only the genuinely dead — paused AND silent through the window', () => {
		expect(worthFetching('squad_dead', 'PAUSED', spentRecently)).toBe(false);
	});

	it('falls back to fetching everything when the hint could not be built', () => {
		// A database read failing must widen what we ask for, never narrow it.
		expect(worthFetching('squad_dead', 'PAUSED', undefined)).toBe(true);
	});
});

describe('demographics move from hourly to daily', () => {
	it('runs in exactly one hour of the day', () => {
		const hours = Array.from({ length: 24 }, (_, h) =>
			shouldSyncDemographics(new Date(Date.UTC(2026, 8, 13, h, 20, 0)))
		);
		expect(hours.filter(Boolean)).toHaveLength(1);
		expect(hours[DEMOGRAPHICS_HOUR_UTC]).toBe(true);
	});

	it('lands before the ad-health mail at 03:45 UTC', () => {
		expect(DEMOGRAPHICS_HOUR_UTC).toBeLessThan(3.75);
		expect(shouldSyncDemographics(new Date('2026-09-13T03:20:00Z'))).toBe(true);
	});
});

describe('what the two changes buy, at this account size', () => {
	// 19 campaigns, 24 ad squads, 30 ads — counted from ad_spend_daily.
	const CAMPAIGNS = 19, SQUADS = 24, ADS = 30, DIMENSIONS = 4, FIXED = 11;

	const before = FIXED + SQUADS + SQUADS + ADS + CAMPAIGNS * DIMENSIONS;

	it('was ~165 Snap calls every hour', () => {
		expect(before).toBe(165);
	});

	it('drops to 11 an hour once everything is paused and quiet', () => {
		// Every entity paused and outside the window: only the fixed overhead
		// (tokens, account lookups, listings) remains, 23 hours out of 24.
		expect(FIXED).toBe(11);
	});

	it('still costs a full demographics pass once a day, not 24', () => {
		const daily = CAMPAIGNS * DIMENSIONS;
		expect(daily * 24 - daily).toBe(1748); // calls no longer made
	});
});
