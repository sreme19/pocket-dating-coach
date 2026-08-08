/**
 * aibestie-owner.test.ts
 *
 * The property under test is that an unstaffed owner cannot promise a human will
 * read the conversation. That claim is the whole conversion moment, it is the one
 * thing on the page that is either true or a lie depending on configuration, and
 * the failure is silent — a seed-owned thread telling a man a woman is about to
 * read him looks exactly like a working funnel.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockEnv: Record<string, string | undefined> = {};
vi.mock('$env/dynamic/private', () => ({ env: mockEnv }));

const {
	lpOwnerRoster,
	staffedOwners,
	isStaffedOwner,
	lpConfigured,
	pickOwner,
	terminusMode
} = await import('../aibestie-owner');

const SEED = '5a37a177-f5fb-451f-a418-e4cfa8e85877';
const REAL = '11111111-2222-3333-4444-555555555555';

beforeEach(() => {
	delete mockEnv.AIBESTIE_LP_OWNER_IDS;
	delete mockEnv.AIBESTIE_LP_STAFFED_IDS;
});

describe('roster configuration', () => {
	it('is unconfigured — and therefore disabled — when the roster is unset', () => {
		expect(lpOwnerRoster()).toEqual([]);
		expect(lpConfigured()).toBe(false);
		expect(pickOwner()).toBeNull();
	});

	it('parses a comma-separated roster, tolerating spacing and blanks', () => {
		mockEnv.AIBESTIE_LP_OWNER_IDS = ` ${SEED} , ${REAL} , `;
		expect(lpOwnerRoster()).toEqual([SEED, REAL]);
		expect(lpConfigured()).toBe(true);
	});
});

describe('staffed owners', () => {
	it('ignores a staffed id that is not on the roster', () => {
		// Otherwise a stale entry left behind after a roster change would keep
		// authorising the human promise for someone no longer serving traffic.
		mockEnv.AIBESTIE_LP_OWNER_IDS = SEED;
		mockEnv.AIBESTIE_LP_STAFFED_IDS = REAL;
		expect(staffedOwners()).toEqual([]);
		expect(isStaffedOwner(REAL)).toBe(false);
	});

	it('recognises a staffed id that is on the roster', () => {
		mockEnv.AIBESTIE_LP_OWNER_IDS = `${SEED},${REAL}`;
		mockEnv.AIBESTIE_LP_STAFFED_IDS = REAL;
		expect(staffedOwners()).toEqual([REAL]);
		expect(isStaffedOwner(REAL)).toBe(true);
		expect(isStaffedOwner(SEED)).toBe(false);
	});

	it('prefers a staffed owner when the roster mixes both', () => {
		mockEnv.AIBESTIE_LP_OWNER_IDS = `${SEED},${REAL}`;
		mockEnv.AIBESTIE_LP_STAFFED_IDS = REAL;
		for (let i = 0; i < 25; i++) expect(pickOwner()).toBe(REAL);
	});

	it('still serves an unstaffed roster', () => {
		mockEnv.AIBESTIE_LP_OWNER_IDS = SEED;
		expect(pickOwner()).toBe(SEED);
	});
});

describe('terminusMode — the promise gate', () => {
	it('never promises a human for an unstaffed owner', () => {
		mockEnv.AIBESTIE_LP_OWNER_IDS = SEED;
		expect(terminusMode(SEED)).toBe('artifact');
	});

	it('promises a human only for a staffed owner', () => {
		mockEnv.AIBESTIE_LP_OWNER_IDS = `${SEED},${REAL}`;
		mockEnv.AIBESTIE_LP_STAFFED_IDS = REAL;
		expect(terminusMode(REAL)).toBe('human');
		expect(terminusMode(SEED)).toBe('artifact');
	});

	it('falls back to artifact for anything unknown', () => {
		// Null, empty and off-roster ids all resolve to the claim that is true of
		// every owner. There is no input that defaults to the human promise.
		mockEnv.AIBESTIE_LP_OWNER_IDS = REAL;
		mockEnv.AIBESTIE_LP_STAFFED_IDS = REAL;
		expect(terminusMode(null)).toBe('artifact');
		expect(terminusMode(undefined)).toBe('artifact');
		expect(terminusMode('')).toBe('artifact');
		expect(terminusMode(SEED)).toBe('artifact');
	});

	it('drops back to artifact the moment the staffed list is cleared', () => {
		// The off-switch when a staffed woman stops replying or withdraws consent:
		// one env change, no deploy, and the promise stops being made immediately.
		mockEnv.AIBESTIE_LP_OWNER_IDS = REAL;
		mockEnv.AIBESTIE_LP_STAFFED_IDS = REAL;
		expect(terminusMode(REAL)).toBe('human');
		delete mockEnv.AIBESTIE_LP_STAFFED_IDS;
		expect(terminusMode(REAL)).toBe('artifact');
	});
});
