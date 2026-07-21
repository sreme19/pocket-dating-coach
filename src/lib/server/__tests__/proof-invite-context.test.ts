import { describe, it, expect } from 'vitest';
import { buildProofInviteContext } from '../proof-invite-context';
import type { Vec } from '../vector-scoring';

// Sam ↔ valarie shape: her top value is financial (0.21), claimed v=65 but c=0.3.
const herWeights: Vec = {
	financial: 0.2083, looks: 0.1667, lifestyle: 0.1667, warmth: 0.125, humor: 0.10,
	presentation: 0.06, ambition: 0.06, intellect: 0.03, social_legitimacy: 0.02, family: 0.02,
};
const hisAttrs: Vec = { financial: 65, lifestyle: 55, presentation: 55, ambition: 50, social_legitimacy: 50, warmth: 60, humor: 60, intellect: 55, family: 50, looks: 55 };
const hisConf: Vec = { financial: 0.3, lifestyle: 0.3, presentation: 0.65, ambition: 0.3, social_legitimacy: 0.3, warmth: 0.3, humor: 0.3, intellect: 0.3, family: 0.3, looks: 0.4 };
const ALL_CATS = ['linkedin', 'discipline', 'travel', 'lifestyle', 'social_proof', 'assets', 'wealth', 'spending'];

describe('buildProofInviteContext — proactive, preference-targeted invites', () => {
	it('leads with the proof she values most (income), quantifies it, and never promises she steps in', () => {
		const { block, topCategory } = buildProofInviteContext({
			herWeights, hisAttrs, hisConf, rivalAppeals: [30, 20],
			allowed: ALL_CATS, matchName: 'Sam', userName: 'valarie',
		});
		expect(topCategory).toBe('wealth');          // financial is her top provable value
		expect(block).toContain('income');            // friendly phrase, not the raw dim label
		expect(block.toLowerCase()).toContain('#');    // concrete rank payoff present
		expect(block).toMatch(/NEVER promise|no guarantee|does not buy/i); // the hard rule
	});

	it('respects the allowed set — if money proofs are unavailable, moves to her next value', () => {
		const allowed = ALL_CATS.filter((c) => !['wealth', 'assets', 'spending'].includes(c));
		const { topCategory } = buildProofInviteContext({
			herWeights, hisAttrs, hisConf, rivalAppeals: [30, 20],
			allowed, matchName: 'Sam', userName: 'valarie',
		});
		expect(['travel', 'lifestyle']).toContain(topCategory); // her next provable value: lifestyle
	});

	it('can name more than one proof', () => {
		const { block } = buildProofInviteContext({
			herWeights, hisAttrs, hisConf, rivalAppeals: [30, 20],
			allowed: ALL_CATS, matchName: 'Sam', userName: 'valarie', max: 2,
		});
		expect((block.match(/proving it/g) ?? []).length).toBeGreaterThanOrEqual(2);
	});

	it('is empty when there are no vectors', () => {
		expect(buildProofInviteContext({ herWeights: null, hisAttrs: null, hisConf: null, rivalAppeals: [], allowed: ALL_CATS, matchName: 'Sam', userName: 'valarie' }).block).toBe('');
	});

	it('is empty when nothing is invitable', () => {
		expect(buildProofInviteContext({ herWeights, hisAttrs, hisConf, rivalAppeals: [], allowed: [], matchName: 'Sam', userName: 'valarie' }).topCategory).toBeNull();
	});
});
