/**
 * aibestie-welcome-match.test.ts — the rules around requirement 9's free matches.
 *
 * The matchmaker itself is covered elsewhere; what matters here is everything that
 * decides WHETHER to call it. Each of these is a mistake that costs real money or
 * hands a member duplicate matches, and none of them fails loudly in production.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockEnv: Record<string, string | undefined> = {};
vi.mock('$env/dynamic/private', () => ({ env: mockEnv }));

const runMatchmakerForUser = vi.fn();
vi.mock('../matchmaker-service', () => ({ runMatchmakerForUser }));

/** The rows the fake database hands back, rewritten per test. */
let sessionRow: any = null;
let casRows: any[] = [];

/**
 * A PostgREST-shaped chain. `select` is a builder step on a read and the terminal
 * on an update, so it branches on whether update() has been called — the same
 * shape the real client has.
 */
function fakeDb() {
	let isUpdate = false;
	const chain: any = {
		from: () => chain,
		update: () => {
			isUpdate = true;
			return chain;
		},
		select: () => (isUpdate ? Promise.resolve({ data: casRows }) : chain),
		eq: () => chain,
		not: () => chain,
		is: () => chain,
		limit: () => chain,
		maybeSingle: () => Promise.resolve({ data: sessionRow })
	};
	return chain;
}
vi.mock('../supabase', () => ({ getSupabase: () => fakeDb() }));

const { runWelcomeMatchesIfClaimed } = await import('../aibestie-welcome-match');

const MAN = 'f0e1d2c3-b4a5-4967-8899-0a1b2c3d4e5f';
const matched = () => ({ status: 'matched' });

beforeEach(() => {
	vi.clearAllMocks();
	delete mockEnv.AIBESTIE_LP_GATE;
	delete mockEnv.AIBESTIE_WELCOME_MATCHES;
	sessionRow = { id: 'sess-1', match_id: 'match-1', welcome_matched_at: null };
	casRows = [{ id: 'sess-1' }];
});

describe('the gate', () => {
	it('does not read the column before the migration is on', async () => {
		// welcome_matched_at ships behind AIBESTIE_LP_GATE for the same reason
		// is_provisional does: PostgREST fails the WHOLE query on a filter against a
		// missing column, which is how the chat list broke once.
		const out = await runWelcomeMatchesIfClaimed(MAN);
		expect(out).toEqual({ eligible: false, created: 0 });
		expect(runMatchmakerForUser).not.toHaveBeenCalled();
	});
});

describe('who qualifies', () => {
	beforeEach(() => {
		mockEnv.AIBESTIE_LP_GATE = 'true';
	});

	it('ignores a member who never claimed a conversation', async () => {
		// This is not a "welcome every new member" hook. Making it one is a product
		// decision about every signup, not about ad traffic.
		sessionRow = null;
		const out = await runWelcomeMatchesIfClaimed(MAN);
		expect(out.eligible).toBe(false);
		expect(runMatchmakerForUser).not.toHaveBeenCalled();
	});

	it('runs for a man who carried a real conversation in', async () => {
		runMatchmakerForUser.mockResolvedValue(matched());
		const out = await runWelcomeMatchesIfClaimed(MAN);
		expect(out).toEqual({ eligible: true, created: 2, stoppedBecause: 'complete' });
		expect(runMatchmakerForUser).toHaveBeenCalledTimes(2);
	});

	it('never charges his quota', async () => {
		// He did not press anything. A charged run would also be REFUSED once his
		// quota ran out, so the free matches would silently stop arriving.
		runMatchmakerForUser.mockResolvedValue(matched());
		await runWelcomeMatchesIfClaimed(MAN);
		expect(runMatchmakerForUser).toHaveBeenCalledWith(MAN, { system: true });
	});
});

describe('firing exactly once', () => {
	beforeEach(() => {
		mockEnv.AIBESTIE_LP_GATE = 'true';
		runMatchmakerForUser.mockResolvedValue(matched());
	});

	it('stands down when another enrolment won the compare-and-set', async () => {
		// verify-step and the photo rescreen both call enrollInPoolIfVerified, so two
		// can land together. Reading first and writing second is not enough — the
		// winner is whoever's UPDATE still saw a null.
		casRows = [];
		const out = await runWelcomeMatchesIfClaimed(MAN);
		expect(out.created).toBe(0);
		expect(runMatchmakerForUser).not.toHaveBeenCalled();
	});
});

describe('how many', () => {
	beforeEach(() => {
		mockEnv.AIBESTIE_LP_GATE = 'true';
	});

	it('stops the moment the pool has nothing left', async () => {
		// Each attempt costs a soft-score Claude call per candidate, and an empty pool
		// will not fill between iterations.
		runMatchmakerForUser
			.mockResolvedValueOnce(matched())
			.mockResolvedValueOnce({ status: 'no_match' });
		const out = await runWelcomeMatchesIfClaimed(MAN);
		expect(out).toEqual({ eligible: true, created: 1, stoppedBecause: 'no_match' });
		expect(runMatchmakerForUser).toHaveBeenCalledTimes(2);
	});

	it('is clamped, so a typo in the env cannot spend the afternoon', async () => {
		runMatchmakerForUser.mockResolvedValue(matched());
		mockEnv.AIBESTIE_WELCOME_MATCHES = '500';
		const out = await runWelcomeMatchesIfClaimed(MAN);
		expect(out.created).toBe(5);
	});

	it('treats a junk value as the default rather than as zero', async () => {
		runMatchmakerForUser.mockResolvedValue(matched());
		mockEnv.AIBESTIE_WELCOME_MATCHES = 'two';
		const out = await runWelcomeMatchesIfClaimed(MAN);
		expect(out.created).toBe(2);
	});

	it('can be switched off without touching the deploy', async () => {
		mockEnv.AIBESTIE_WELCOME_MATCHES = '0';
		const out = await runWelcomeMatchesIfClaimed(MAN);
		expect(out.created).toBe(0);
		expect(runMatchmakerForUser).not.toHaveBeenCalled();
	});
});
