/**
 * aibestie-session.test.ts — the pure parts of minting an ad visitor.
 *
 * startLpSession itself talks to the auth admin API and three tables, so it is
 * covered by the live smoke test rather than mocked into meaninglessness here.
 * What IS unit-testable is where the mistakes are cheap to make and expensive to
 * notice: a claim code a human cannot transcribe, an IP hash that is reversible,
 * and a feature that serves traffic before the provisional gate is on.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockEnv: Record<string, string | undefined> = {};
vi.mock('$env/dynamic/private', () => ({ env: mockEnv }));
vi.mock('../supabase', () => ({ getSupabase: () => ({}) }));

const { generateClaimCode, hashIp, lpEnabled, LP_MATCH_SOURCE } = await import(
	'../aibestie-session'
);

const OWNER = '5a37a177-f5fb-451f-a418-e4cfa8e85877';

beforeEach(() => {
	delete mockEnv.AIBESTIE_LP_GATE;
	delete mockEnv.AIBESTIE_LP_OWNER_IDS;
	delete mockEnv.AIBESTIE_IP_SALT;
});

describe('lpEnabled', () => {
	it('needs BOTH the provisional gate and a roster', () => {
		expect(lpEnabled()).toBe(false);

		mockEnv.AIBESTIE_LP_GATE = 'true';
		expect(lpEnabled()).toBe(false); // no roster

		delete mockEnv.AIBESTIE_LP_GATE;
		mockEnv.AIBESTIE_LP_OWNER_IDS = OWNER;
		expect(lpEnabled()).toBe(false); // no gate

		mockEnv.AIBESTIE_LP_GATE = 'true';
		expect(lpEnabled()).toBe(true);
	});

	it('refuses to serve while the provisional gate is off', () => {
		// Not a stylistic coupling. With the gate off realMembersOnly cannot exclude
		// anyone, so every visitor would count as a real member the moment the page
		// loaded — corrupting the trust cohort and emailing the team on every click.
		// Refusing to start is the correct failure.
		mockEnv.AIBESTIE_LP_OWNER_IDS = OWNER;
		expect(lpEnabled()).toBe(false);
	});
});

describe('generateClaimCode', () => {
	it('is prefixed and fixed-length', () => {
		expect(generateClaimCode()).toMatch(/^RA-[A-Z2-9]{6}$/);
	});

	it('never emits a glyph that is misread off a screen', () => {
		// The code exists to be read from a phone and typed into another app, so a
		// 0/O or 1/I/L confusion is a silently lost conversation.
		const banned = /[01OIL]/;
		for (let i = 0; i < 400; i++) {
			expect(generateClaimCode().slice(3)).not.toMatch(banned);
		}
	});

	it('does not collide over a realistic burst', () => {
		const seen = new Set(Array.from({ length: 2000 }, generateClaimCode));
		// 31^6 ≈ 887M, so duplicates in 2k draws would indicate a broken generator
		// rather than bad luck.
		expect(seen.size).toBe(2000);
	});
});

describe('hashIp', () => {
	it('passes null through', () => {
		expect(hashIp(null)).toBeNull();
	});

	it('is stable for the same address, so rate limiting can recognise a repeat', () => {
		mockEnv.AIBESTIE_IP_SALT = 'pepper';
		expect(hashIp('203.0.113.7')).toBe(hashIp('203.0.113.7'));
	});

	it('separates different addresses', () => {
		mockEnv.AIBESTIE_IP_SALT = 'pepper';
		expect(hashIp('203.0.113.7')).not.toBe(hashIp('203.0.113.8'));
	});

	it('changes completely with the salt', () => {
		// Unsalted, a SHA-256 over the 2^32 IPv4 space is brute-forced in seconds —
		// the salt is what makes this one-way rather than merely obfuscated.
		mockEnv.AIBESTIE_IP_SALT = 'pepper';
		const a = hashIp('203.0.113.7');
		mockEnv.AIBESTIE_IP_SALT = 'other';
		expect(hashIp('203.0.113.7')).not.toBe(a);
	});

	it('still hashes without a salt rather than storing the address', () => {
		const h = hashIp('203.0.113.7');
		expect(h).toMatch(/^[a-f0-9]{64}$/);
		expect(h).not.toContain('203.0.113.7');
	});
});

describe('LP_MATCH_SOURCE', () => {
	it('is distinct from the existing match sources', () => {
		// Bestie's opener branches on `source`, and her-inbox and analytics segment
		// on it — an LP thread must never be mistaken for a matchmaker or invite one.
		expect(['matchmaker', 'notice_me', 'beta_invite']).not.toContain(LP_MATCH_SOURCE);
	});
});
