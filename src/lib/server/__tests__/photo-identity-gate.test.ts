import { describe, it, expect, vi } from 'vitest';

// The gate module reads the kill switch off dynamic private env at call time.
const { mockEnv } = vi.hoisted(() => ({ mockEnv: {} as Record<string, string> }));
vi.mock('$env/dynamic/private', () => ({ env: mockEnv }));

import {
	decidePhotoGate,
	photoIdentityGateEnabled,
	gateRecord,
	MATCH_CONFIDENCE,
} from '../photo-identity-gate';
import type { AnchorPhotoVerdict } from '$lib/verified-vibe/server/verification';

const owner = (confidence = 90): AnchorPhotoVerdict => ({
	isRealPerson: true,
	sameAsAnchor: true,
	confidence,
	reason: '',
});
const someoneElse = (): AnchorPhotoVerdict => ({
	isRealPerson: true,
	sameAsAnchor: false,
	confidence: 5,
	reason: 'A different person.',
});
const notAPerson = (): AnchorPhotoVerdict => ({
	isRealPerson: false,
	sameAsAnchor: null,
	confidence: 0,
	reason: 'This is a poster, not a person.',
});

describe('photoIdentityGateEnabled', () => {
	it('is on by default and only off for the explicit string "false"', () => {
		delete mockEnv.PHOTO_IDENTITY_GATE;
		expect(photoIdentityGateEnabled()).toBe(true);
		mockEnv.PHOTO_IDENTITY_GATE = 'true';
		expect(photoIdentityGateEnabled()).toBe(true);
		mockEnv.PHOTO_IDENTITY_GATE = 'false';
		expect(photoIdentityGateEnabled()).toBe(false);
		delete mockEnv.PHOTO_IDENTITY_GATE;
	});
});

describe('decidePhotoGate — with a verified anchor selfie', () => {
	it('accepts photos of the owner', () => {
		const d = decidePhotoGate([owner(), owner(72)], true);
		expect(d.status).toBe('passed');
		expect(d.acceptedIndexes).toEqual([0, 1]);
		expect(d.rejected).toEqual([]);
	});

	it('rejects the whole step when NOTHING is the owner (the poster case)', () => {
		const d = decidePhotoGate([notAPerson(), notAPerson(), someoneElse()], true);
		expect(d.status).toBe('rejected');
		expect(d.acceptedIndexes).toEqual([]);
		expect(d.rejected.map((r) => r.index)).toEqual([0, 1, 2]);
		expect(d.message).toMatch(/verification selfie/i);
	});

	it('keeps the owner photos and drops the rest, reporting original indexes', () => {
		const d = decidePhotoGate([notAPerson(), owner(), someoneElse(), owner(80)], true);
		expect(d.status).toBe('passed');
		expect(d.acceptedIndexes).toEqual([1, 3]);
		expect(d.rejected.map((r) => r.index)).toEqual([0, 2]);
		expect(d.message).toMatch(/removed 2/);
	});

	it('treats a low-confidence "same person" as a mismatch', () => {
		const below = decidePhotoGate([owner(MATCH_CONFIDENCE - 1)], true);
		expect(below.status).toBe('rejected');
		const at = decidePhotoGate([owner(MATCH_CONFIDENCE)], true);
		expect(at.status).toBe('passed');
	});

	it('rejects a non-person even when the model leaves sameAsAnchor true', () => {
		const d = decidePhotoGate(
			[{ isRealPerson: false, sameAsAnchor: true, confidence: 99, reason: '' }],
			true
		);
		expect(d.status).toBe('rejected');
	});

	it('surfaces the model reason to the user, falling back when it is empty', () => {
		const d = decidePhotoGate([{ ...notAPerson(), reason: '' }, someoneElse()], true);
		expect(d.rejected[0].reason).toMatch(/not a photo of you/i);
		expect(d.rejected[1].reason).toBe('A different person.');
	});
});

describe('decidePhotoGate — no anchor selfie to compare against', () => {
	it('accepts any real person but marks the set unverified', () => {
		const d = decidePhotoGate([{ isRealPerson: true, sameAsAnchor: null, confidence: 0, reason: '' }], false);
		expect(d.status).toBe('unverified');
		expect(d.acceptedIndexes).toEqual([0]);
	});

	it('still rejects a set with no person in it at all', () => {
		const d = decidePhotoGate([notAPerson()], false);
		expect(d.status).toBe('rejected');
		expect(d.message).toMatch(/photo of a person/i);
	});

	it('does not penalise a real person for failing the identity comparison', () => {
		// sameAsAnchor false is meaningless without an anchor — must not reject.
		const d = decidePhotoGate([someoneElse()], false);
		expect(d.status).toBe('unverified');
		expect(d.acceptedIndexes).toEqual([0]);
	});
});

describe('gateRecord', () => {
	it('summarises the decision for the verification row', () => {
		const d = decidePhotoGate([notAPerson(), owner(), someoneElse()], true);
		const rec = gateRecord(d, '2026-07-28T00:00:00.000Z');
		expect(rec).toEqual({
			status: 'passed',
			checked: 3,
			accepted: 1,
			rejectedIndexes: [0, 2],
			checkedAt: '2026-07-28T00:00:00.000Z',
		});
	});
});
