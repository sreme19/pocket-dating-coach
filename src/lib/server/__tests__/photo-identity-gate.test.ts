import { describe, it, expect, vi } from 'vitest';

// The gate module reads the kill switch off dynamic private env at call time.
const { mockEnv } = vi.hoisted(() => ({ mockEnv: {} as Record<string, string> }));
vi.mock('$env/dynamic/private', () => ({ env: mockEnv }));

import {
	decidePhotoGate,
	photoIdentityGateEnabled,
	gateRecord,
	MATCH_CONFIDENCE,
	MISMATCH_CONFIDENCE,
} from '../photo-identity-gate';
import type { AnchorPhotoVerdict } from '$lib/verified-vibe/server/verification';

/** Confirmed to be the account owner. */
const owner = (confidence = 90): AnchorPhotoVerdict => ({
	isRealPerson: true,
	sameAsAnchor: true,
	confidence,
	reason: '',
});
/** Confidently a different human being. */
const someoneElse = (confidence = 5): AnchorPhotoVerdict => ({
	isRealPerson: true,
	sameAsAnchor: false,
	confidence,
	reason: 'Face shape, nose and jaw differ from your verified selfie.',
});
/** A real person, but no face to compare — turned away, distant, obscured. */
const cannotTell = (reason = 'Person is facing away; no face visible for comparison.'): AnchorPhotoVerdict => ({
	isRealPerson: true,
	sameAsAnchor: null,
	confidence: 0,
	reason,
});
/** Not a photo of a human at all. */
const notAPerson = (): AnchorPhotoVerdict => ({
	isRealPerson: false,
	sameAsAnchor: null,
	confidence: 0,
	reason: 'This is a religious/deity artwork graphic, not a real photo.',
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

	it('rejects the whole set when nothing is the owner (the deity-poster case)', () => {
		const d = decidePhotoGate([notAPerson(), notAPerson(), someoneElse()], true);
		expect(d.status).toBe('rejected');
		expect(d.acceptedIndexes).toEqual([]);
		expect(d.rejected.map((r) => r.index)).toEqual([0, 1, 2]);
		expect(d.message).toMatch(/verification selfie/i);
	});

	it('keeps the owner photos and drops the impostors, reporting original indexes', () => {
		const d = decidePhotoGate([notAPerson(), owner(), someoneElse(), owner(80)], true);
		expect(d.status).toBe('passed');
		expect(d.acceptedIndexes).toEqual([1, 3]);
		expect(d.rejected.map((r) => r.index)).toEqual([0, 2]);
		expect(d.message).toMatch(/removed 2 photos/);
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
		expect(d.rejected[1].reason).toMatch(/differ from your verified selfie/);
	});
});

// The bug this guards: an earlier version rejected anything not positively confirmed,
// which deleted back-turned / distant / filtered photos out of real users' galleries.
describe('decidePhotoGate — "cannot tell" is not "not you"', () => {
	it('keeps an unconfirmable photo alongside a confirmed one', () => {
		const d = decidePhotoGate([owner(), cannotTell(), cannotTell('Distant shot limits face comparison.')], true);
		expect(d.status).toBe('passed');
		expect(d.acceptedIndexes).toEqual([0, 1, 2]);
		expect(d.unverifiableIndexes).toEqual([1, 2]);
		expect(d.rejected).toEqual([]);
		expect(d.message).toBe(''); // nothing removed → nothing to apologise for
	});

	it('asks for a clearer photo when NOTHING could be compared', () => {
		const d = decidePhotoGate([cannotTell(), cannotTell()], true);
		expect(d.status).toBe('unconfirmed');
		expect(d.rejected).toEqual([]);         // no accusation
		expect(d.acceptedIndexes).toEqual([0, 1]); // and no deletion
		expect(d.message).toMatch(/face is clearly visible/i);
	});

	it('treats the uncertain confidence band as "cannot tell", not as a mismatch', () => {
		// A "same person" claim below the accept bar, and a "different person" claim
		// that is not confident enough to act on, both land in the middle.
		const weakYes = decidePhotoGate([{ ...owner(MATCH_CONFIDENCE - 1) }], true);
		expect(weakYes.status).toBe('unconfirmed');
		expect(weakYes.rejected).toEqual([]);

		const weakNo = decidePhotoGate([someoneElse(MISMATCH_CONFIDENCE + 5)], true);
		expect(weakNo.status).toBe('unconfirmed');
		expect(weakNo.rejected).toEqual([]);
	});

	it('holds the accept and reject bars exactly where documented', () => {
		expect(decidePhotoGate([owner(MATCH_CONFIDENCE)], true).status).toBe('passed');
		expect(decidePhotoGate([someoneElse(MISMATCH_CONFIDENCE - 1)], true).status).toBe('rejected');
		expect(decidePhotoGate([someoneElse(MISMATCH_CONFIDENCE)], true).status).toBe('unconfirmed');
	});

	it('still refuses a set that mixes unconfirmable photos with a proven impostor', () => {
		// Nothing proves the owner, and something proves a stranger → refuse, and list
		// the unconfirmable ones too so the client can ask for a full re-upload.
		const d = decidePhotoGate([cannotTell(), someoneElse()], true);
		expect(d.status).toBe('rejected');
		expect(d.rejected.map((r) => r.index).sort()).toEqual([0, 1]);
	});
});

describe('decidePhotoGate — no anchor selfie to compare against', () => {
	it('accepts any real person but marks the set unverified', () => {
		const d = decidePhotoGate([cannotTell('')], false);
		expect(d.status).toBe('unverified');
		expect(d.acceptedIndexes).toEqual([0]);
		expect(d.unverifiableIndexes).toEqual([0]);
	});

	it('still rejects a set with no person in it at all', () => {
		const d = decidePhotoGate([notAPerson()], false);
		expect(d.status).toBe('rejected');
		expect(d.message).toMatch(/photo of a person/i);
	});

	it('does not penalise a real person for failing a comparison that never happened', () => {
		const d = decidePhotoGate([someoneElse()], false);
		expect(d.status).toBe('unverified');
		expect(d.acceptedIndexes).toEqual([0]);
	});
});

describe('gateRecord', () => {
	it('summarises the decision for the verification row', () => {
		const d = decidePhotoGate([notAPerson(), owner(), someoneElse(), cannotTell()], true);
		expect(gateRecord(d, '2026-07-28T00:00:00.000Z')).toEqual({
			status: 'passed',
			checked: 4,
			accepted: 2,      // the owner photo + the unconfirmable one
			unverifiable: 1,
			rejectedIndexes: [0, 2],
			checkedAt: '2026-07-28T00:00:00.000Z',
		});
	});
});
