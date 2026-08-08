/**
 * member-state.test.ts
 *
 * This module decides who counts as a real member, and two of its callers turn a
 * wrong answer into damage that is invisible until someone notices a number moved:
 * trust-normalize cohorts on it (so a leak silently re-scores every real man), and
 * new-member-alert reads it as "someone signed up" (so a leak emails the team on
 * every ad click). Both failures look like normal output.
 *
 * The gate is tested as hard as the predicate. `is_provisional` does not exist
 * until migration 20260807100000 has been run by hand, and PostgREST answers a
 * filter on a missing column by failing the whole query — the exact shape of the
 * missing-migration 500s that once took out the chat list. So "the column name
 * never appears while the flag is off" is a correctness property here, not tidiness.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockEnv: Record<string, string | undefined> = {};
vi.mock('$env/dynamic/private', () => ({ env: mockEnv }));

const { isRealMemberRow, memberStateColumns, provisionalMembersEnabled, realMembersOnly } =
	await import('../member-state');

/** Records every .eq() the helper applies, and stays chainable like PostgREST. */
function fakeQuery() {
	const calls: Array<[string, unknown]> = [];
	const q: any = {
		calls,
		eq(col: string, val: unknown) {
			calls.push([col, val]);
			return q;
		}
	};
	return q;
}

beforeEach(() => {
	delete mockEnv.AIBESTIE_LP_GATE;
});

describe('provisionalMembersEnabled', () => {
	it('is off unless the flag is exactly "true"', () => {
		expect(provisionalMembersEnabled()).toBe(false);
		mockEnv.AIBESTIE_LP_GATE = 'false';
		expect(provisionalMembersEnabled()).toBe(false);
		// A truthy-but-wrong value must NOT enable it: the cost of guessing wrong is a
		// query against a column that may not exist yet.
		mockEnv.AIBESTIE_LP_GATE = '1';
		expect(provisionalMembersEnabled()).toBe(false);
		mockEnv.AIBESTIE_LP_GATE = 'true';
		expect(provisionalMembersEnabled()).toBe(true);
	});
});

describe('realMembersOnly', () => {
	it('filters seeds only while the gate is off — the column is never named', () => {
		const q = fakeQuery();
		realMembersOnly(q);
		expect(q.calls).toEqual([['is_seed', false]]);
	});

	it('filters seeds AND provisional rows once the gate is on', () => {
		mockEnv.AIBESTIE_LP_GATE = 'true';
		const q = fakeQuery();
		realMembersOnly(q);
		expect(q.calls).toEqual([
			['is_seed', false],
			['is_provisional', false]
		]);
	});

	it('stays chainable so it drops into an existing query', () => {
		mockEnv.AIBESTIE_LP_GATE = 'true';
		const q = fakeQuery();
		realMembersOnly(q).eq('gender', 'man');
		expect(q.calls.at(-1)).toEqual(['gender', 'man']);
	});
});

describe('memberStateColumns', () => {
	it('omits is_provisional while the gate is off', () => {
		// Selecting a column that does not exist fails exactly as hard as filtering on
		// one, so the name must not appear in the select string either.
		expect(memberStateColumns()).toBe('is_seed');
		expect(memberStateColumns()).not.toContain('is_provisional');
	});

	it('includes it once the gate is on', () => {
		mockEnv.AIBESTIE_LP_GATE = 'true';
		expect(memberStateColumns()).toBe('is_seed, is_provisional');
	});
});

describe('isRealMemberRow', () => {
	it('treats an unknown is_seed as a seed', () => {
		// The column defaults to true and only upsertProfile writes an explicit false,
		// so "unknown" must not be admitted — that would let every pre-column row count.
		expect(isRealMemberRow({})).toBe(false);
		expect(isRealMemberRow({ is_seed: null })).toBe(false);
		expect(isRealMemberRow({ is_seed: true })).toBe(false);
	});

	it('admits an explicit non-seed', () => {
		expect(isRealMemberRow({ is_seed: false })).toBe(true);
	});

	it('excludes provisional rows once the gate is on', () => {
		mockEnv.AIBESTIE_LP_GATE = 'true';
		expect(isRealMemberRow({ is_seed: false, is_provisional: true })).toBe(false);
		expect(isRealMemberRow({ is_seed: false, is_provisional: false })).toBe(true);
	});

	it('treats an unknown is_provisional as NOT provisional', () => {
		// Mirror image of the is_seed default, and deliberately the opposite way round.
		// The column is `not null default false`, so the only way to read a null is to
		// read a row before the migration ran — during that window defaulting to
		// "provisional" would erase every real member from every count at once.
		mockEnv.AIBESTIE_LP_GATE = 'true';
		expect(isRealMemberRow({ is_seed: false, is_provisional: null })).toBe(true);
		expect(isRealMemberRow({ is_seed: false })).toBe(true);
	});

	it('ignores is_provisional entirely while the gate is off', () => {
		// Deploy-before-migrate: nothing can be provisional yet, and a stray true must
		// not start excluding real members before the feature is even live.
		expect(isRealMemberRow({ is_seed: false, is_provisional: true })).toBe(true);
	});
});
