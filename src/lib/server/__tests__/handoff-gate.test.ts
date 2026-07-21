import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Vec } from '../vector-scoring';

// Mutable mock env so we can toggle the kill switch per test.
const { mockEnv } = vi.hoisted(() => ({ mockEnv: {} as Record<string, string> }));
vi.mock('$env/dynamic/private', () => ({ env: mockEnv }));

import { assessHandoffReadiness } from '../handoff-gate';

// Real state from the reported conversation 05abca84… (Sam ↔ valarie):
// valarie's top weight is financial (0.21); Sam claims financial v=65 but c=0.3
// (the unproven floor), with only a `photos` proof — the exact gap.
const valarieWeights: Vec = {
	financial: 0.2083, looks: 0.1667, lifestyle: 0.1667, warmth: 0.125, humor: 0.10,
	presentation: 0.06, ambition: 0.06, intellect: 0.03, social_legitimacy: 0.02, family: 0.02,
};
const samAttrs: Vec = { financial: 65, lifestyle: 50, presentation: 55, ambition: 50, social_legitimacy: 50, warmth: 60, humor: 60, intellect: 55, family: 50, looks: 55 };
const samConf: Vec = { financial: 0.3, lifestyle: 0.3, presentation: 0.65, ambition: 0.3, social_legitimacy: 0.3, warmth: 0.3, humor: 0.3, intellect: 0.3, family: 0.3, looks: 0.4 };

beforeEach(() => { for (const k of Object.keys(mockEnv)) delete mockEnv[k]; });

describe('assessHandoffReadiness — the Sam ↔ valarie case', () => {
	it('BLOCKS the hand-off: her #1 value (financial) is claimed but unproven → ask for income proof', () => {
		const gate = assessHandoffReadiness({
			herWeights: valarieWeights, hisAttrs: samAttrs, hisConf: samConf,
			verifiedCategories: ['photos'], refusedCategories: [],
		});
		expect(gate.ready).toBe(false);
		expect(gate.blockingDim).toBe('financial'); // her highest-weighted provable dim
		expect(gate.requestCategory).toBe('wealth'); // strongest money proof he lacks
		expect(gate.blockingPhrase).toBe('income');
	});

	it('CLEARS once he has proven financial (c ≥ 0.55)', () => {
		const proven = { ...samConf, financial: 0.7 };
		const gate = assessHandoffReadiness({
			herWeights: valarieWeights, hisAttrs: samAttrs, hisConf: proven,
			verifiedCategories: ['photos', 'wealth'], refusedCategories: [],
		});
		// financial satisfied; next provable dim (lifestyle) is still unproven → still gated there.
		// That is correct: she also weights lifestyle. Verify the gate moved OFF financial.
		expect(gate.blockingDim).not.toBe('financial');
	});

	it('does not dead-end: if he DECLINED every money proof, financial no longer blocks', () => {
		const gate = assessHandoffReadiness({
			herWeights: valarieWeights, hisAttrs: samAttrs, hisConf: samConf,
			verifiedCategories: ['photos'], refusedCategories: ['wealth', 'assets', 'spending'],
		});
		expect(gate.blockingDim).not.toBe('financial'); // moves on rather than trapping the match
	});
});

describe('assessHandoffReadiness — guards', () => {
	it('degrades to ready when there are no vectors (old conversation-only behaviour)', () => {
		expect(assessHandoffReadiness({ herWeights: null, hisAttrs: null, hisConf: null, verifiedCategories: [] }).ready).toBe(true);
	});

	it('does not demand proof of a dimension she barely weights', () => {
		const lowFinancial: Vec = { ...valarieWeights, financial: 0.02, lifestyle: 0.02, presentation: 0.02, ambition: 0.02, social_legitimacy: 0.02 };
		expect(assessHandoffReadiness({ herWeights: lowFinancial, hisAttrs: samAttrs, hisConf: samConf, verifiedCategories: ['photos'] }).ready).toBe(true);
	});

	it('does not demand proof of a dimension he is not really claiming (v < 45)', () => {
		const thin = { ...samAttrs, financial: 20, lifestyle: 20, presentation: 20, ambition: 20, social_legitimacy: 20 };
		expect(assessHandoffReadiness({ herWeights: valarieWeights, hisAttrs: thin, hisConf: samConf, verifiedCategories: ['photos'] }).ready).toBe(true);
	});

	it('kill switch: HANDOFF_PROOF_GATE=false disables the gate', () => {
		mockEnv.HANDOFF_PROOF_GATE = 'false';
		expect(assessHandoffReadiness({ herWeights: valarieWeights, hisAttrs: samAttrs, hisConf: samConf, verifiedCategories: ['photos'] }).ready).toBe(true);
	});
});
