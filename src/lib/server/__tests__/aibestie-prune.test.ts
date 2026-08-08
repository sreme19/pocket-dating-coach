/**
 * aibestie-prune.test.ts
 *
 * This job's failure mode is irreversible deletion of real members' data, so the
 * tests are mostly about what it REFUSES to do. The one that matters most is the
 * abort: a session row whose user is not provisional means the predicate is wrong,
 * and the very next thing the job would otherwise do is cascade somebody's account.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockEnv: Record<string, string | undefined> = {};
vi.mock('$env/dynamic/private', () => ({ env: mockEnv }));

/** Rows the fake database returns, rewritten per test. */
let staleSessions: any[] = [];
let provisionalRows: any[] = [];
let bounceCount = 0;

/** Everything the job wrote, so a test can assert on the ORDER of operations. */
let ops: string[] = [];

/**
 * A PostgREST-shaped chain. It records the table and verb, and resolves to
 * whatever that combination should return.
 */
function fakeDb() {
	function chainFor(table: string) {
		let verb: 'select' | 'update' | 'delete' = 'select';
		let head = false;
		let recorded = false;

		const record = () => {
			if (verb === 'delete' && !recorded) {
				ops.push(`delete:${table}`);
				recorded = true;
			}
		};

		const settle = (): Promise<any> => {
			if (head) return Promise.resolve({ count: table === 'aibestie_lp_sessions' ? bounceCount : 0 });
			if (verb === 'delete') {
				record();
				return Promise.resolve({ data: [{ id: 'deleted' }] });
			}
			if (verb === 'update') return Promise.resolve({ data: [{ id: 'updated' }] });
			if (table === 'aibestie_lp_sessions') return Promise.resolve({ data: staleSessions });
			if (table === 'verified_vibe_users') return Promise.resolve({ data: provisionalRows });
			return Promise.resolve({ data: [] });
		};

		// Every filter is a builder step; only select()/limit()/await terminate. That
		// mirrors postgrest-js, where the builder is itself a thenable.
		const chain: any = {
			update: (patch: Record<string, unknown>) => {
				ops.push(`update:${table}:${Object.keys(patch).join(',')}`);
				verb = 'update';
				return chain;
			},
			delete: () => {
				verb = 'delete';
				return chain;
			},
			select: (_cols?: string, opts?: { head?: boolean }) => {
				if (opts?.head) head = true;
				// select() after delete() is the "return what you removed" form, which
				// terminates. On a plain read it is the first builder step.
				return verb === 'delete' ? settle() : chain;
			},
			eq: () => chain,
			in: () => chain,
			is: () => chain,
			not: () => chain,
			lt: () => chain,
			limit: () => settle(),
			then: (onFulfilled: any, onRejected?: any) => settle().then(onFulfilled, onRejected)
		};
		return chain;
	}
	return { from: (t: string) => chainFor(t) };
}
vi.mock('../supabase', () => ({ getSupabase: () => fakeDb() }));

const { runAibestiePrune } = await import('../aibestie-prune');

const PROVISIONAL = 'aaaaaaaa-0000-4000-8000-000000000001';
const REAL_MEMBER = 'bbbbbbbb-0000-4000-8000-000000000002';

beforeEach(() => {
	vi.clearAllMocks();
	ops = [];
	bounceCount = 0;
	staleSessions = [{ id: 'sess-1', user_id: PROVISIONAL, match_id: 'match-1' }];
	provisionalRows = [{ id: PROVISIONAL }];
	delete mockEnv.AIBESTIE_PRUNE_DAYS;
	mockEnv.AIBESTIE_LP_GATE = 'true';
	mockEnv.AIBESTIE_PRUNE_DRY_RUN = 'false'; // armed, except where a test says otherwise
});

describe('the gate', () => {
	it('does nothing before the provisional migration is switched on', async () => {
		delete mockEnv.AIBESTIE_LP_GATE;
		const r = await runAibestiePrune();
		expect(r.aborted).toBe('disabled');
		expect(ops).toEqual([]);
	});
});

describe('arming', () => {
	it('deletes nothing until explicitly armed', async () => {
		// A job whose failure mode is irreversible deletion must not become live by
		// being deployed. Unset means dry run.
		delete mockEnv.AIBESTIE_PRUNE_DRY_RUN;
		const r = await runAibestiePrune();
		expect(r.dryRun).toBe(true);
		expect(ops).toEqual([]);
	});

	it('still reports what it would remove', async () => {
		delete mockEnv.AIBESTIE_PRUNE_DRY_RUN;
		bounceCount = 7;
		const r = await runAibestiePrune();
		expect(r.conversationsPruned).toBe(1);
		expect(r.bouncesPruned).toBe(7);
	});

	it('treats any value other than "false" as not armed', async () => {
		mockEnv.AIBESTIE_PRUNE_DRY_RUN = 'true';
		expect((await runAibestiePrune()).dryRun).toBe(true);
		mockEnv.AIBESTIE_PRUNE_DRY_RUN = 'no';
		expect((await runAibestiePrune()).dryRun).toBe(true);
	});
});

describe('the abort invariant', () => {
	it('refuses the whole run when a candidate is not provisional', async () => {
		// The exact shape of the catastrophe: after a claim, session.user_id IS a real
		// member's id, and deleting that row cascades their matches and messages.
		staleSessions = [{ id: 'sess-1', user_id: REAL_MEMBER, match_id: 'match-1' }];
		provisionalRows = []; // the users table says he is not provisional

		const r = await runAibestiePrune();
		expect(r.aborted).toBe('not_provisional');
		expect(r.conversationsPruned).toBe(0);
		expect(ops).toEqual([]);
	});

	it('aborts the bounce sweep too, not just the deletion that failed', async () => {
		// Deleting "only the safe ones" would hide a broken predicate behind a run that
		// looks successful. A wrong candidate means stop everything.
		staleSessions = [
			{ id: 'sess-1', user_id: PROVISIONAL, match_id: 'm1' },
			{ id: 'sess-2', user_id: REAL_MEMBER, match_id: 'm2' }
		];
		provisionalRows = [{ id: PROVISIONAL }];
		bounceCount = 5;

		const r = await runAibestiePrune();
		expect(r.aborted).toBe('not_provisional');
		expect(r.bouncesPruned).toBe(0);
		expect(ops).toEqual([]);
	});
});

describe('order of operations', () => {
	it('severs the session from the person BEFORE deleting him', async () => {
		// aibestie_lp_sessions.user_id is ON DELETE CASCADE, so deleting first would
		// take the funnel row — the utm set, the turn count, the bar he reached —
		// which is the campaign measurement this whole page exists to produce.
		await runAibestiePrune();

		const sever = ops.indexOf('update:aibestie_lp_sessions:user_id,match_id');
		const deleteUser = ops.indexOf('delete:verified_vibe_users');
		expect(sever).toBeGreaterThanOrEqual(0);
		expect(deleteUser).toBeGreaterThanOrEqual(0);
		expect(sever).toBeLessThan(deleteUser);
	});

	it('clears AI timing rows, which have no foreign key to cascade on', async () => {
		await runAibestiePrune();
		expect(ops).toContain('delete:vv_ai_response_timings');
	});
});

describe('the window', () => {
	it('defaults to 30 days', async () => {
		expect((await runAibestiePrune()).retentionDays).toBe(30);
	});

	it('is tunable without a deploy, and ignores junk', async () => {
		mockEnv.AIBESTIE_PRUNE_DAYS = '7';
		expect((await runAibestiePrune()).retentionDays).toBe(7);
		mockEnv.AIBESTIE_PRUNE_DAYS = 'soon';
		expect((await runAibestiePrune()).retentionDays).toBe(30);
		mockEnv.AIBESTIE_PRUNE_DAYS = '0'; // never means "delete everything now"
		expect((await runAibestiePrune()).retentionDays).toBe(30);
	});
});
