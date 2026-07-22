import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mutable mock env so we can toggle the kill switch per test.
const { mockEnv } = vi.hoisted(() => ({ mockEnv: {} as Record<string, string> }));
vi.mock('$env/dynamic/private', () => ({ env: mockEnv }));

import {
	photoSignalsEnabled,
	photoSetHash,
	photoAuthenticityPasses,
	photoConfidenceContribution,
	photoTrustContribution,
	PHOTO_SIGNAL_VERSION,
	type PhotoSignals,
	type PhotoAuthenticity,
} from '../photo-signals';

const authOK: PhotoAuthenticity = {
	identityConsistent: true, realNotAi: true, artifactFree: true, faceClear: true, quality: 4,
};
const authFail: PhotoAuthenticity = { ...authOK, realNotAi: false };

function sig(over: Partial<PhotoSignals> = {}): PhotoSignals {
	return {
		dims: {},
		scenes: [],
		authenticity: authOK,
		photoCount: 3,
		photoHash: 'abc',
		analyzedAt: '2026-07-23T00:00:00Z',
		version: PHOTO_SIGNAL_VERSION,
		...over,
	};
}

beforeEach(() => { for (const k of Object.keys(mockEnv)) delete mockEnv[k]; });

describe('photoSignalsEnabled — kill switch', () => {
	it('is OFF by default (shadow rollout)', () => {
		expect(photoSignalsEnabled()).toBe(false);
	});
	it('is ON only when PHOTO_SIGNAL_GATE === "true"', () => {
		mockEnv.PHOTO_SIGNAL_GATE = 'true';
		expect(photoSignalsEnabled()).toBe(true);
		mockEnv.PHOTO_SIGNAL_GATE = 'false';
		expect(photoSignalsEnabled()).toBe(false);
		mockEnv.PHOTO_SIGNAL_GATE = '1';
		expect(photoSignalsEnabled()).toBe(false);
	});
});

describe('photoSetHash — stable & change-sensitive', () => {
	const set = [
		{ label: 'lead', url: 'https://x/a.jpg?v=1' },
		{ label: 'warmth', url: 'https://x/b.jpg?v=2' },
	];
	it('is order-insensitive', () => {
		expect(photoSetHash(set)).toBe(photoSetHash([...set].reverse()));
	});
	it('changes when a photo url changes', () => {
		const changed = [{ ...set[0], url: 'https://x/a.jpg?v=9' }, set[1]];
		expect(photoSetHash(changed)).not.toBe(photoSetHash(set));
	});
	it('changes when a label changes', () => {
		const changed = [{ ...set[0], label: 'lifestyle' }, set[1]];
		expect(photoSetHash(changed)).not.toBe(photoSetHash(set));
	});
});

describe('photoAuthenticityPasses — the trust/confidence pre-condition', () => {
	it('passes only when every flag holds', () => {
		expect(photoAuthenticityPasses(authOK)).toBe(true);
	});
	it('fails if any flag is false', () => {
		expect(photoAuthenticityPasses(authFail)).toBe(false);
		expect(photoAuthenticityPasses({ ...authOK, faceClear: false })).toBe(false);
		expect(photoAuthenticityPasses(null)).toBe(false);
	});
});

describe('photoConfidenceContribution — deterministic c', () => {
	it('returns {} when authenticity fails (AI/unverifiable photos never move c)', () => {
		expect(photoConfidenceContribution(sig({ authenticity: authFail }))).toEqual({});
	});
	it('credits presentation/looks/warmth on a clean set, capped', () => {
		const c = photoConfidenceContribution(sig({ authenticity: { ...authOK, quality: 5 } }));
		expect(c.presentation).toBeGreaterThan(0);
		expect(c.presentation).toBeLessThanOrEqual(0.5);
		expect(c.looks).toBeGreaterThan(0);
	});
	it('adds lifestyle confidence for lived-in scenes, capped at 0.3', () => {
		const c = photoConfidenceContribution(sig({ scenes: ['travel', 'outdoors', 'gym', 'restaurant'] }));
		expect(c.lifestyle).toBeGreaterThan(0);
		expect(c.lifestyle).toBeLessThanOrEqual(0.3);
	});
});

describe('photoTrustContribution — capped, authenticity-gated CG boosts', () => {
	it('returns [] when authenticity fails', () => {
		expect(photoTrustContribution(sig({ authenticity: authFail }))).toEqual([]);
	});
	it('always credits identity (unconditional) scaled by quality', () => {
		const boosts = photoTrustContribution(sig());
		const id = boosts.find((b) => b.key === 'identity');
		expect(id).toBeTruthy();
		expect(id!.crossOnly).toBe(false);
		expect(id!.boost).toBe(16); // 4 * quality(4)
	});
	it('marks lifestyle/social boosts crossOnly and caps them', () => {
		const boosts = photoTrustContribution(sig({ scenes: ['travel', 'outdoors', 'gym', 'group', 'party'] }));
		const life = boosts.find((b) => b.key === 'lifestyleDepth');
		const social = boosts.find((b) => b.key === 'socialLegitimacy');
		expect(life?.crossOnly).toBe(true);
		expect(life!.boost).toBeLessThanOrEqual(25);
		expect(social?.crossOnly).toBe(true);
		expect(social!.boost).toBeLessThanOrEqual(15);
	});
	it('omits scene boosts when no relevant scenes', () => {
		const boosts = photoTrustContribution(sig({ scenes: ['home'] }));
		expect(boosts.some((b) => b.key === 'lifestyleDepth')).toBe(false);
		expect(boosts.some((b) => b.key === 'socialLegitimacy')).toBe(false);
	});
});
