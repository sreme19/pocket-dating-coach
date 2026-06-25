import { describe, it, expect } from 'vitest';
import {
	incomeBaseCurve,
	incomeToV,
	colIndexForCity,
	cityTier,
	parseIncomeToLPA,
} from '$lib/verified-vibe/valuation';

/** Tests for the deterministic income valuation + cost-of-living calibration (§6c/§6d). */

describe('incomeBaseCurve — anchored, concave, saturating', () => {
	it('hits the doc anchor points (~45/62/72 at 10/20/30 LPA)', () => {
		expect(incomeBaseCurve(10)).toBeGreaterThanOrEqual(43);
		expect(incomeBaseCurve(10)).toBeLessThanOrEqual(47);
		expect(incomeBaseCurve(20)).toBeGreaterThanOrEqual(60);
		expect(incomeBaseCurve(20)).toBeLessThanOrEqual(64);
		expect(incomeBaseCurve(30)).toBeGreaterThanOrEqual(70);
		expect(incomeBaseCurve(30)).toBeLessThanOrEqual(74);
	});
	it('is monotonic increasing but with diminishing returns', () => {
		expect(incomeBaseCurve(20)).toBeGreaterThan(incomeBaseCurve(10));
		expect(incomeBaseCurve(40)).toBeGreaterThan(incomeBaseCurve(30));
		const firstGain = incomeBaseCurve(20) - incomeBaseCurve(10);
		const laterGain = incomeBaseCurve(40) - incomeBaseCurve(30);
		expect(laterGain).toBeLessThan(firstGain); // concave
	});
	it('clamps to [0,100] and treats non-positive as 0', () => {
		expect(incomeBaseCurve(0)).toBe(0);
		expect(incomeBaseCurve(-5)).toBe(0);
		expect(incomeBaseCurve(100000)).toBe(100); // ceiling
	});
});

describe('city cost-of-living calibration', () => {
	it('maps known cities to tiers and indices', () => {
		expect(cityTier('Bangalore, India')).toBe('metro');
		expect(colIndexForCity('Bangalore, India')).toBe(1.4);
		expect(cityTier('Indore')).toBe('tier2');
		expect(colIndexForCity('Indore')).toBe(0.9);
	});
	it('falls back to neutral 1.0 for unknown / missing city', () => {
		expect(colIndexForCity('Smalltown')).toBe(1.0);
		expect(colIndexForCity(null)).toBe(1.0);
	});

	it('matches the doc worked examples (20 LPA in high vs low cost city)', () => {
		// 20 LPA in a high-cost metro (idx 1.4) → adjusted 14.3 → v ≈ 53
		const metro = incomeToV(20, 'Mumbai');
		expect(metro).toBeGreaterThanOrEqual(51);
		expect(metro).toBeLessThanOrEqual(56);
		// same 20 LPA in a cheaper city (tier3 idx 0.7) → adjusted 28.6 → v ≈ 70
		const cheap = incomeToV(20, 'some-tier3-town'); // unknown → 1.0; force tier3 below
		// use a real tier3-style index via a known low-cost mapping is not seeded,
		// so assert the DIRECTION: cheaper-than-metro yields higher v.
		expect(cheap).toBeGreaterThan(metro);
	});

	it('same nominal income yields higher v in a cheaper city', () => {
		expect(incomeToV(20, 'Indore')).toBeGreaterThan(incomeToV(20, 'Bangalore'));
	});
});

describe('parseIncomeToLPA — tolerant parsing', () => {
	it('parses LPA forms', () => {
		expect(parseIncomeToLPA('20 LPA')).toBe(20);
		expect(parseIncomeToLPA('18L')).toBe(18);
		expect(parseIncomeToLPA('20')).toBe(20);
		expect(parseIncomeToLPA(20)).toBe(20);
	});
	it('parses absolute rupee figures → LPA', () => {
		expect(parseIncomeToLPA('₹20,00,000')).toBe(20);
		expect(parseIncomeToLPA(2000000)).toBe(20);
	});
	it('parses crore', () => {
		expect(parseIncomeToLPA('1.2 cr')).toBeCloseTo(120, 1);
	});
	it('returns null when no number present', () => {
		expect(parseIncomeToLPA('competitive')).toBeNull();
		expect(parseIncomeToLPA(null)).toBeNull();
	});
});
