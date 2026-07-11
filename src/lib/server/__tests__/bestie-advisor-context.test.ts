import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the two collaborators loadBestieAdvisorContext pulls in so the test can
// focus on the verification-status assembly (the regression under test).
vi.mock('../profile-service', () => ({
	loadPreferences: vi.fn(async () => ({
		dealbreakers: [],
		emotionalSignals: [],
		boundaries: [],
		maturitySignals: [],
		privateCompatibilityNotes: []
	})),
	loadPersonality: vi.fn(async () => ({
		communicationStyle: '',
		personalityVibe: '',
		mattersMost: '',
		values: []
	}))
}));

vi.mock('../proof-signals', () => ({
	loadProofSignals: vi.fn(async () => ({ categories: [], lines: [], latestVerifiedAt: null }))
}));

import { loadBestieAdvisorContext } from '../bestie-advisor-context';
import { loadWingmanAdvisorContext } from '../wingman-advisor-context';
import { loadVerificationStatusContext } from '../verification-status-context';

/**
 * Build a chainable Supabase stub. `verifyRows` is what
 * `verified_vibe_verification` returns; users/matches are fixed (no matches, so
 * the per-match loop is skipped and we isolate the verification block).
 */
function makeSupabase(verifyRows: Array<{ step: string; status: string }>) {
	function query(table: string) {
		const result =
			table === 'verified_vibe_users'
				? { data: { first_name: 'Neha', hard_nos: [] } }
				: table === 'verified_vibe_matches'
					? { data: [] }
					: table === 'verified_vibe_verification'
						? { data: verifyRows }
						: { data: null };
		const q: any = {};
		for (const m of ['select', 'eq', 'or', 'order', 'limit']) q[m] = () => q;
		q.single = () => Promise.resolve(result);
		q.maybeSingle = () => Promise.resolve(result);
		q.then = (res: any, rej: any) => Promise.resolve(result).then(res, rej);
		return q;
	}
	return { from: (table: string) => query(table) } as any;
}

describe('loadBestieAdvisorContext — verification ground truth', () => {
	beforeEach(() => vi.clearAllMocks());

	it('lists a partially-completed step as done and the rest as NOT done yet', async () => {
		const supabase = makeSupabase([
			{ step: 'liveness', status: 'completed' },
			{ step: 'photos', status: 'pending' } // pending must NOT count as done
		]);
		const ctx = await loadBestieAdvisorContext(supabase, 'user-1');

		expect(ctx.verificationContext).toContain('Identity (live selfie)');
		// photos is pending → still "NOT done yet", alongside the never-started Q&A
		expect(ctx.verificationContext).toMatch(/NOT done yet:.*Profile photos/);
		expect(ctx.verificationContext).toMatch(/NOT done yet:.*Dating-intent Q&A/);
		expect(ctx.verificationContext).toContain('NEVER claim her verification is finished');
	});

	it('reports honest completion only when all core steps are completed', async () => {
		const supabase = makeSupabase([
			{ step: 'liveness', status: 'completed' },
			{ step: 'photos', status: 'completed' },
			{ step: 'spending_or_qa', status: 'completed' }
		]);
		const ctx = await loadBestieAdvisorContext(supabase, 'user-1');

		expect(ctx.verificationContext).toContain('all core verification is complete');
		expect(ctx.verificationContext).toContain('her core verification is genuinely complete');
	});

	it('never returns an empty block when she has done nothing (prevents hallucination)', async () => {
		const supabase = makeSupabase([]);
		const ctx = await loadBestieAdvisorContext(supabase, 'user-1');

		expect(ctx.verificationContext).toContain('HER VERIFICATION STATUS');
		expect(ctx.verificationContext).toContain('none of the core steps yet');
	});
});

/**
 * Match-aware stub: one mutual match with a mixed transcript — a line she typed,
 * a line the AI Bestie sent on her behalf (is_ai), and one from the man.
 */
function makeMatchSupabase() {
	const womanId = 'user-1';
	const manId = 'man-9';
	function query(table: string) {
		let idFilter: string | undefined;
		const q: any = {};
		q.select = () => q;
		q.eq = (col: string, val: string) => {
			if (col === 'id') idFilter = val;
			return q;
		};
		q.or = () => q;
		q.order = () => q;
		q.limit = () => q;
		const resolve = () => {
			if (table === 'verified_vibe_users') {
				return idFilter === manId
					? { data: { first_name: 'Arjun', age: 31, about: 'loves climbing' } }
					: { data: { first_name: 'Neha', hard_nos: [] } };
			}
			if (table === 'verified_vibe_matches') {
				return {
					data: [
						{ id: 'match-1', user1_id: womanId, user2_id: manId, created_at: new Date().toISOString() }
					]
				};
			}
			if (table === 'verified_vibe_messages') {
				return {
					data: [
						{ content: 'hey, Neha here!', sender_id: womanId, created_at: new Date().toISOString(), is_ai: false },
						{ content: 'what do you do for fun?', sender_id: womanId, created_at: new Date().toISOString(), is_ai: true },
						{ content: 'I climb most weekends', sender_id: manId, created_at: new Date().toISOString(), is_ai: false }
					]
				};
			}
			if (table === 'verified_vibe_verification') return { data: [] };
			return { data: null };
		};
		q.single = () => Promise.resolve(resolve());
		q.maybeSingle = () => Promise.resolve(resolve());
		q.then = (res: any, rej: any) => Promise.resolve(resolve()).then(res, rej);
		return q;
	}
	return { from: query } as any;
}

describe('loadBestieAdvisorContext — AI-sent vs her own messages', () => {
	beforeEach(() => vi.clearAllMocks());

	it('labels Bestie hand-off messages distinctly from her own words', async () => {
		const ctx = await loadBestieAdvisorContext(makeMatchSupabase(), 'user-1');

		expect(ctx.matchContext).toContain('AI Bestie (sent for Neha): what do you do for fun?');
		expect(ctx.matchContext).toContain('Neha: hey, Neha here!');
		expect(ctx.matchContext).toContain('Arjun: I climb most weekends');
		// her own line must NOT be mislabeled as AI
		expect(ctx.matchContext).not.toContain('AI Bestie (sent for Neha): hey, Neha here!');
		// explicit reminder present so summaries keep them apart
		expect(ctx.matchContext).toContain('NOT her own words');
	});
});

/**
 * Wingman-side stub: the man has one match (a woman) whose thread mixes her AI
 * Bestie's proxy lines (is_ai) with her own words, plus one of his messages.
 */
function makeWingmanSupabase() {
	const manId = 'man-1';
	const womanId = 'woman-9';
	function query(table: string) {
		let idFilter: string | undefined;
		const q: any = {};
		q.select = () => q;
		q.eq = (col: string, val: string) => {
			if (col === 'id') idFilter = val;
			return q;
		};
		q.or = () => q;
		q.order = () => q;
		q.limit = () => q;
		const resolve = () => {
			if (table === 'user_master_profile') return { data: null }; // fall to legacy personality
			if (table === 'user_artifacts') return { data: [] };
			if (table === 'attention_messages') return { data: [] };
			if (table === 'ai_assistant_profiles') return { data: null };
			if (table === 'profile_tips') return { data: [] };
			if (table === 'verified_vibe_users') {
				return idFilter === womanId
					? { data: { first_name: 'Meera', age: 28, about: 'painter', archetype: 'creative' } }
					: { data: { first_name: 'Rohan', age: 30, about: 'engineer', archetype: 'builder' } };
			}
			if (table === 'verified_vibe_matches') {
				return {
					data: [
						{ id: 'm-1', user1_id: manId, user2_id: womanId, created_at: new Date().toISOString() }
					]
				};
			}
			if (table === 'verified_vibe_messages') {
				return {
					data: [
						{ content: 'Hi, tell me about your week', sender_id: womanId, created_at: new Date().toISOString(), is_ai: true },
						{ content: 'busy but good — you?', sender_id: manId, created_at: new Date().toISOString(), is_ai: false },
						{ content: 'honestly this made me smile', sender_id: womanId, created_at: new Date().toISOString(), is_ai: false }
					]
				};
			}
			if (table === 'verified_vibe_verification') return { data: [] };
			return { data: null };
		};
		q.single = () => Promise.resolve(resolve());
		q.maybeSingle = () => Promise.resolve(resolve());
		q.then = (res: any, rej: any) => Promise.resolve(resolve()).then(res, rej);
		return q;
	}
	return { from: query } as any;
}

describe('loadWingmanAdvisorContext — her AI Bestie vs her own messages', () => {
	beforeEach(() => vi.clearAllMocks());

	it('marks her Bestie proxy lines distinctly from her own words', async () => {
		const ctx = await loadWingmanAdvisorContext(makeWingmanSupabase(), 'man-1');

		expect(ctx.matchContext).toContain("Meera's AI Bestie: Hi, tell me about your week");
		expect(ctx.matchContext).toContain('Meera: honestly this made me smile');
		expect(ctx.matchContext).toContain('Him: busy but good — you?');
		// her own line must NOT be attributed to the Bestie
		expect(ctx.matchContext).not.toContain("Meera's AI Bestie: honestly this made me smile");
		expect(ctx.matchContext).toContain('signal she');
	});
});

describe('loadVerificationStatusContext — gender-generic (Wingman/Bestie share)', () => {
	beforeEach(() => vi.clearAllMocks());

	it('renders male pronouns and header for the man (Wingman) side', async () => {
		const supabase = makeSupabase([{ step: 'liveness', status: 'completed' }]);
		const block = await loadVerificationStatusContext(supabase, 'man-1', { subject: 'man' });

		expect(block).toContain('HIS VERIFICATION STATUS');
		expect(block).toContain('Identity (live selfie)');
		expect(block).toMatch(/NOT done yet:.*Profile photos/);
		expect(block).toMatch(/NEVER claim his verification is finished/);
		// no female pronouns leaked in
		expect(block).not.toContain('HER VERIFICATION STATUS');
	});
});
