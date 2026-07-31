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
	applyAdjudication,
	clusterVerdicts,
	shouldReanchor,
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

	it('rejects the whole set when nothing at all is publishable (the deity-poster case)', () => {
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

	// A verified owner may post faceless photos: they proved their face once at the
	// selfie check. This used to be a 422, which trapped real users (all six of one
	// woman's photos were side-on / distant / hands-only) in a re-upload loop.
	it('publishes a faceless set anyway once the selfie check is done', () => {
		const d = decidePhotoGate([cannotTell(), cannotTell()], true);
		expect(d.status).toBe('unconfirmed');    // recorded, but not a refusal
		expect(d.rejected).toEqual([]);          // no accusation
		expect(d.acceptedIndexes).toEqual([0, 1]); // and no deletion
		expect(d.message).toMatch(/posted as-is/i);
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

	it('drops only the impostor from a set whose other photos are faceless', () => {
		// One bad photo must not cost the user the good ones: the stranger goes, the
		// unconfirmable-but-real photo stays.
		const d = decidePhotoGate([cannotTell(), someoneElse()], true);
		expect(d.status).toBe('unconfirmed');
		expect(d.acceptedIndexes).toEqual([0]);
		expect(d.rejected.map((r) => r.index)).toEqual([1]);
		expect(d.message).toMatch(/removed 1 photo/);
	});

	it('keeps a faceless photo when a poster is mixed into the same batch', () => {
		const d = decidePhotoGate([notAPerson(), cannotTell()], true);
		expect(d.status).toBe('unconfirmed');
		expect(d.acceptedIndexes).toEqual([1]);
		expect(d.rejected.map((r) => r.index)).toEqual([0]);
	});
});

// Without a verified selfie the only identity signal is whether the uploads agree
// with each other, so this path is the stricter one: a face is mandatory and the
// odd one out is dropped. `sameAsAnchor` means "in the cluster" here.
describe('decidePhotoGate — no anchor selfie to compare against', () => {
	/** A face that agrees with the rest of the set. */
	const inCluster = (): AnchorPhotoVerdict => ({
		isRealPerson: true,
		sameAsAnchor: true,
		confidence: 90,
		reason: '',
	});

	it('keeps the photos that face-match one another, unverified', () => {
		const d = decidePhotoGate([inCluster(), inCluster()], false);
		expect(d.status).toBe('unverified');
		expect(d.acceptedIndexes).toEqual([0, 1]);
		expect(d.unverifiableIndexes).toEqual([0, 1]); // consistency is not identity
		expect(d.rejected).toEqual([]);
	});

	it('drops the one photo that is a different person from the rest', () => {
		const d = decidePhotoGate([inCluster(), someoneElse(), inCluster()], false);
		expect(d.status).toBe('unverified');
		expect(d.acceptedIndexes).toEqual([0, 2]);
		expect(d.rejected.map((r) => r.index)).toEqual([1]);
	});

	it('still rejects a set with no person in it at all', () => {
		const d = decidePhotoGate([notAPerson()], false);
		expect(d.status).toBe('rejected');
		expect(d.message).toMatch(/clear photo of you/i);
	});

	it('drops a face it could not cross-check — that grace needs the selfie check', () => {
		const d = decidePhotoGate([inCluster(), cannotTell()], false);
		expect(d.acceptedIndexes).toEqual([0]);
		expect(d.rejected.map((r) => r.index)).toEqual([1]);
		expect(d.rejected[0].reason).toMatch(/facing away/i); // model reason preferred
	});

	it('refuses a set of nothing but uncomparable photos', () => {
		const d = decidePhotoGate([cannotTell(), notAPerson()], false);
		expect(d.status).toBe('rejected');
		expect(d.acceptedIndexes).toEqual([]);
	});
});

describe('clusterVerdicts — building the no-anchor verdicts', () => {
	it('makes the reference photo the cluster and rejects the faceless ones', () => {
		const out = clusterVerdicts([true, false], 0, new Map());
		expect(out[0]).toMatchObject({ isRealPerson: true, sameAsAnchor: true });
		expect(out[1]).toMatchObject({ isRealPerson: false });
		const d = decidePhotoGate(out, false);
		expect(d.acceptedIndexes).toEqual([0]);
		expect(d.rejected.map((r) => r.index)).toEqual([1]);
	});

	it('passes a confident mismatch through so it gets dropped', () => {
		const out = clusterVerdicts([true, true], 0, new Map([[1, someoneElse(5)]]));
		expect(out[1].sameAsAnchor).toBe(false);
		expect(decidePhotoGate(out, false).rejected.map((r) => r.index)).toEqual([1]);
	});

	it('keeps an inconclusive comparison in the cluster rather than deleting on a maybe', () => {
		const weak = clusterVerdicts([true, true], 0, new Map([[1, someoneElse(MISMATCH_CONFIDENCE)]]));
		expect(decidePhotoGate(weak, false).rejected).toEqual([]);

		const noFace = clusterVerdicts([true, true], 0, new Map([[1, cannotTell()]]));
		expect(decidePhotoGate(noFace, false).rejected).toEqual([]);
	});

	it('fails open when a comparison is missing from the vision response', () => {
		const out = clusterVerdicts([true, true], 0, new Map());
		expect(decidePhotoGate(out, false).acceptedIndexes).toEqual([0, 1]);
	});
});

describe('shouldReanchor — "the rest" means the majority, not the first photo', () => {
	it('re-runs from the other camp when it is strictly larger', () => {
		// Reference + 1 agreeing vs 3 disagreeing → the reference is the odd one out.
		expect(shouldReanchor(1, [2, 3, 4])).toBe(2);
	});

	it('keeps the reference when its own camp is as big or bigger', () => {
		expect(shouldReanchor(1, [2, 3])).toBeNull();   // 2 vs 2 — no reason to flip
		expect(shouldReanchor(4, [5])).toBeNull();
		expect(shouldReanchor(0, [])).toBeNull();
	});

	it('flips on the lone-impostor-first case', () => {
		// One photo of Bob uploaded first, five of Alice after it.
		expect(shouldReanchor(0, [1, 2, 3, 4, 5])).toBe(1);
	});
});

// Nudity and distressing imagery are a separate question from "is this you", and
// they win: being yourself doesn't make a photo publishable.
describe('decidePhotoGate — content safety', () => {
	const ok = () => ({ category: 'ok' as const, reason: '' });
	const unsafe = (category: 'sexual' | 'graphic' | 'self_harm' | 'hateful' | 'minor_safety') => ({
		category,
		reason: 'model reason',
	});

	it('drops a nude even when it is confirmed to be the owner', () => {
		const d = decidePhotoGate([owner(), owner()], true, [unsafe('sexual'), ok()]);
		expect(d.acceptedIndexes).toEqual([1]);
		expect(d.rejected.map((r) => r.index)).toEqual([0]);
		expect(d.unsafeIndexes).toEqual([0]);
		expect(d.status).toBe('passed'); // photo 1 still proves who she is
	});

	it('drops distressing imagery on the no-anchor path too', () => {
		const inCluster = { isRealPerson: true, sameAsAnchor: true, confidence: 90, reason: '' };
		const d = decidePhotoGate([inCluster, inCluster], false, [ok(), unsafe('graphic')]);
		expect(d.acceptedIndexes).toEqual([0]);
		expect(d.unsafeIndexes).toEqual([1]);
	});

	it('never describes the imagery back at the user', () => {
		const d = decidePhotoGate([owner()], true, [unsafe('sexual')]);
		expect(d.rejected[0].reason).toMatch(/without nudity/i);
		expect(d.rejected[0].reason).not.toContain('model reason');
	});

	it('does not talk about the selfie check when content was the only problem', () => {
		const d = decidePhotoGate([owner()], true, [unsafe('sexual')]);
		expect(d.status).toBe('rejected');
		expect(d.message).not.toMatch(/selfie/i);
		expect(d.message).toMatch(/can't publish these photos/i);
	});

	it('counts identity and content drops separately in the notice', () => {
		const d = decidePhotoGate([owner(), someoneElse(), owner()], true, [ok(), ok(), unsafe('graphic')]);
		expect(d.message).toMatch(/removed 1 photo that isn't you/);
		expect(d.message).toMatch(/couldn't publish 1 photo/);
	});

	it('publishes normally when the safety pass did not run at all', () => {
		const d = decidePhotoGate([owner(), owner()], true, undefined);
		expect(d.acceptedIndexes).toEqual([0, 1]);
		expect(d.unsafeIndexes).toEqual([]);
	});

	it('treats a missing per-photo entry as ok rather than guessing', () => {
		const d = decidePhotoGate([owner(), owner()], true, [ok()]);
		expect(d.acceptedIndexes).toEqual([0, 1]);
	});

	it('records content drops on the persisted gate record', () => {
		const d = decidePhotoGate([owner(), owner()], true, [unsafe('sexual'), ok()]);
		expect(gateRecord(d, '2026-07-31T00:00:00.000Z')).toMatchObject({
			rejectedIndexes: [0],
			unsafeIndexes: [0],
		});
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

// Guards the "never delete a photo on one model's opinion" rule.
describe('applyAdjudication — a second opinion before condemning anyone', () => {
	it('keeps the mismatch only when the adjudicator agrees it is someone else', () => {
		const out = applyAdjudication([someoneElse()], new Map([[0, MISMATCH_CONFIDENCE - 1]]));
		expect(out[0].sameAsAnchor).toBe(false);
		expect(decidePhotoGate(out, true).status).toBe('rejected');
	});

	it('downgrades to "cannot tell" when the adjudicator is not convinced', () => {
		const out = applyAdjudication([someoneElse()], new Map([[0, MISMATCH_CONFIDENCE + 10]]));
		expect(out[0].sameAsAnchor).toBeNull();
		expect(decidePhotoGate(out, true).status).toBe('unconfirmed'); // not rejected
	});

	it('downgrades when no second opinion could be obtained', () => {
		const out = applyAdjudication([someoneElse()], new Map([[0, null]]));
		expect(out[0].sameAsAnchor).toBeNull();
		expect(decidePhotoGate(out, true).rejected).toEqual([]);
	});

	it('leaves confirmed, unconfirmable and not-a-person verdicts untouched', () => {
		const input = [owner(), cannotTell(), notAPerson()];
		expect(applyAdjudication(input, new Map())).toEqual(input);
	});

	it('adjudicates each flagged photo independently', () => {
		// Photo 1 is confirmed a stranger; photo 2 is spared by the second opinion.
		const out = applyAdjudication(
			[owner(), someoneElse(), someoneElse()],
			new Map([[1, 10], [2, 55]])
		);
		const d = decidePhotoGate(out, true);
		expect(d.rejected.map((r) => r.index)).toEqual([1]);
		expect(d.acceptedIndexes).toEqual([0, 2]);
		expect(d.status).toBe('passed');
	});
});
