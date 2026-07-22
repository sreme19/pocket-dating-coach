import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Vec } from '../vector-scoring';

// Mutable mock env so we can toggle the kill switch per test.
const { mockEnv } = vi.hoisted(() => ({ mockEnv: {} as Record<string, string> }));
vi.mock('$env/dynamic/private', () => ({ env: mockEnv }));

import { assessHandoffReadiness } from '../handoff-gate';

// Real state from the reported conversation 05abca84… (Sam ↔ valarie):
// valarie's top weight is financial (0.21); Sam claims financial v=65 but c=0.3
// (the unproven floor), with only a `photos` proof — the exact gap.
//
// NOTE (2026-07-22): the in-chat 📎 surface is picture-upload only, so income /
// wealth / assets / spending (document + ID-gated) can NO LONGER be requested in
// chat. The hand-off gate therefore skips financial (document-only) and falls
// through to the next PICTURE-provable dimension she values (here: lifestyle →
// travel). Document proofs still live on the /proof-upload screen.
const valarieWeights: Vec = {
	financial: 0.2083, looks: 0.1667, lifestyle: 0.1667, warmth: 0.125, humor: 0.10,
	presentation: 0.06, ambition: 0.06, intellect: 0.03, social_legitimacy: 0.02, family: 0.02,
};
const samAttrs: Vec = { financial: 65, lifestyle: 50, presentation: 55, ambition: 50, social_legitimacy: 50, warmth: 60, humor: 60, intellect: 55, family: 50, looks: 55 };
const samConf: Vec = { financial: 0.3, lifestyle: 0.3, presentation: 0.65, ambition: 0.3, social_legitimacy: 0.3, warmth: 0.3, humor: 0.3, intellect: 0.3, family: 0.3, looks: 0.4 };

beforeEach(() => { for (const k of Object.keys(mockEnv)) delete mockEnv[k]; });

describe('assessHandoffReadiness — the Sam ↔ valarie case', () => {
	it('SKIPS financial (document-only) and blocks on the next picture-provable dim she values', () => {
		const gate = assessHandoffReadiness({
			herWeights: valarieWeights, hisAttrs: samAttrs, hisConf: samConf,
			verifiedCategories: ['photos'], refusedCategories: [],
		});
		expect(gate.ready).toBe(false);
		// financial is her #1 value but its only proofs (wealth/assets/spending) are
		// documents — never requested in chat — so the gate falls through to lifestyle.
		expect(gate.blockingDim).toBe('lifestyle');
		expect(gate.requestCategory).toBe('travel'); // a picture proof, not a document
		expect(gate.blockingPhrase).toBe('lifestyle');
	});

	it('NEVER requests a document category in chat, even when financial is her top value', () => {
		const gate = assessHandoffReadiness({
			herWeights: valarieWeights, hisAttrs: samAttrs, hisConf: samConf,
			verifiedCategories: ['photos'], refusedCategories: [],
		});
		expect(['wealth', 'assets', 'spending']).not.toContain(gate.requestCategory);
	});

	it('CLEARS once he has proven the picture dims she values (lifestyle + presentation)', () => {
		// financial is document-only (irrelevant to the chat gate); her other provable
		// weights ≥ 0.10 are lifestyle. Prove it and the gate lets him through.
		const proven = { ...samConf, lifestyle: 0.7 };
		const gate = assessHandoffReadiness({
			herWeights: valarieWeights, hisAttrs: samAttrs, hisConf: proven,
			verifiedCategories: ['photos', 'travel'], refusedCategories: [],
		});
		expect(gate.ready).toBe(true);
	});

	it('does not dead-end: if he DECLINED every picture proof she values, he is let through', () => {
		const gate = assessHandoffReadiness({
			herWeights: valarieWeights, hisAttrs: samAttrs, hisConf: samConf,
			verifiedCategories: ['photos'],
			refusedCategories: ['travel', 'lifestyle', 'discipline', 'linkedin', 'social_proof'],
		});
		expect(gate.ready).toBe(true); // moves on rather than trapping the match
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

	it('does not demand proof of a dimension he is not really claiming (v < 45) — isolated from the substance floor by giving him one substantive proof already', () => {
		const thin = { ...samAttrs, financial: 20, lifestyle: 20, presentation: 20, ambition: 20, social_legitimacy: 20 };
		expect(assessHandoffReadiness({ herWeights: valarieWeights, hisAttrs: thin, hisConf: samConf, verifiedCategories: ['photos', 'discipline'] }).ready).toBe(true);
	});

	it('kill switch: HANDOFF_PROOF_GATE=false disables the gate', () => {
		mockEnv.HANDOFF_PROOF_GATE = 'false';
		expect(assessHandoffReadiness({ herWeights: valarieWeights, hisAttrs: samAttrs, hisConf: samConf, verifiedCategories: ['photos'] }).ready).toBe(true);
	});
});

describe('assessHandoffReadiness — substance floor (hand-offs are not lightweight)', () => {
	// A man who isn't loudly claiming anything (all v<45) and has only a selfie.
	const quietAttrs: Vec = { financial: 30, lifestyle: 30, presentation: 30, ambition: 30, social_legitimacy: 30, warmth: 60, humor: 60, intellect: 55, family: 40, looks: 50 };
	const floorConf: Vec = { financial: 0.3, lifestyle: 0.3, presentation: 0.3, ambition: 0.3, social_legitimacy: 0.3, warmth: 0.3, humor: 0.3, intellect: 0.3, family: 0.3, looks: 0.3 };

	it('BLOCKS a man with only a base photo and zero substantive proof of what she values', () => {
		const gate = assessHandoffReadiness({
			herWeights: valarieWeights, hisAttrs: quietAttrs, hisConf: floorConf,
			verifiedCategories: ['photos'], refusedCategories: [],
		});
		expect(gate.ready).toBe(false);
		expect(gate.reason).toContain('substance floor');
		// Her top provable value is financial, but that's document-only (not askable in
		// chat), so the floor lands on her next picture-provable dim, lifestyle.
		expect(gate.blockingDim).toBe('lifestyle');
		expect(['wealth', 'assets', 'spending']).not.toContain(gate.requestCategory);
	});

	it('CLEARS once he has ANY substantive verified proof of a valued dimension', () => {
		const gate = assessHandoffReadiness({
			herWeights: valarieWeights, hisAttrs: quietAttrs, hisConf: floorConf,
			verifiedCategories: ['photos', 'lifestyle'], refusedCategories: [],
		});
		expect(gate.ready).toBe(true);
	});

	it('does not dead-end: quiet man who declined every valued proof is let through', () => {
		const gate = assessHandoffReadiness({
			herWeights: valarieWeights, hisAttrs: quietAttrs, hisConf: floorConf,
			verifiedCategories: ['photos'],
			refusedCategories: ['wealth', 'assets', 'spending', 'travel', 'lifestyle', 'discipline', 'linkedin', 'social_proof'],
		});
		expect(gate.ready).toBe(true);
	});
});
