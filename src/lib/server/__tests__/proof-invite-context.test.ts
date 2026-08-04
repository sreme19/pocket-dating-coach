import { describe, it, expect } from 'vitest';
import { buildProofInviteContext } from '../proof-invite-context';
import { IN_CHAT_PROOF_CATEGORIES } from '../proof-signals';
import type { Vec } from '../vector-scoring';

// Sam ↔ valarie shape: her top value is financial (0.21), claimed v=65 but c=0.3.
const herWeights: Vec = {
	financial: 0.2083, looks: 0.1667, lifestyle: 0.1667, warmth: 0.125, humor: 0.10,
	presentation: 0.06, ambition: 0.06, intellect: 0.03, social_legitimacy: 0.02, family: 0.02,
};
const hisAttrs: Vec = { financial: 65, lifestyle: 55, presentation: 55, ambition: 50, social_legitimacy: 50, warmth: 60, humor: 60, intellect: 55, family: 50, looks: 55 };
const hisConf: Vec = { financial: 0.3, lifestyle: 0.3, presentation: 0.65, ambition: 0.3, social_legitimacy: 0.3, warmth: 0.3, humor: 0.3, intellect: 0.3, family: 0.3, looks: 0.4 };
const ALL_CATS = ['linkedin', 'discipline', 'travel', 'lifestyle', 'social_proof', 'assets', 'wealth', 'spending'];
// The set the in-chat 📎 surface actually offers (pictures only — no documents).
const IN_CHAT_CATS = [...IN_CHAT_PROOF_CATEGORIES];

describe('buildProofInviteContext — proactive, preference-targeted invites', () => {
	it('leads with the top PICTURE proof she values, quantifies it, and never promises she steps in', () => {
		// In chat she values financial most, but that's document-only and excluded from
		// the invitable set — so the lead is her next value, lifestyle → travel.
		const { block, topCategory } = buildProofInviteContext({
			herWeights, hisAttrs, hisConf, rivalAppeals: [30, 20],
			allowed: IN_CHAT_CATS, matchName: 'Sam', userName: 'valarie',
		});
		expect(topCategory).toBe('travel');           // lifestyle is her top picture-provable value
		expect(block).toContain('lifestyle');         // friendly phrase, not the raw dim label
		expect(block.toLowerCase()).toContain('#');    // concrete rank payoff present
		expect(block).toMatch(/NEVER promise|no guarantee|does not buy/i); // the hard rule
	});

	it('never invites a document proof (income/assets/spending) through the in-chat surface', () => {
		const { topCategory, block } = buildProofInviteContext({
			herWeights, hisAttrs, hisConf, rivalAppeals: [30, 20],
			allowed: IN_CHAT_CATS, matchName: 'Sam', userName: 'valarie', max: 2,
		});
		expect(['wealth', 'assets', 'spending']).not.toContain(topCategory);
		for (const doc of ['(wealth)', '(assets)', '(spending)']) expect(block).not.toContain(doc);
	});

	it('never invites money EVEN when handed the full taxonomy, and even when it is her top value', () => {
		// This is the strong form of the money rule and the reason `financial` is not in
		// PROVABLE_DIMS. It used to hold only incidentally: income proofs happen to be
		// documents, and the caller filtered documents out. So a picture-based money
		// category added later would have slipped straight through. Here the caller hands
		// over EVERYTHING including wealth/assets/spending, financial is her single
		// highest weight, and he is loudly claiming it (v=65) and unproven (c=0.3) — the
		// most tempting possible case. It must still come back with her next real value.
		const { topCategory, block } = buildProofInviteContext({
			herWeights, hisAttrs, hisConf, rivalAppeals: [30, 20],
			allowed: ALL_CATS, matchName: 'Sam', userName: 'valarie',
		});
		expect(topCategory).toBe('travel');
		for (const money of ['(wealth)', '(assets)', '(spending)']) expect(block).not.toContain(money);
		expect(block.toLowerCase()).not.toContain('income');
	});

	it('can name more than one proof', () => {
		// Needs TWO provable dims above MIN_WEIGHT. Her fixture above only clears it on
		// lifestyle once financial is excluded, so weight presentation up as well.
		const twoProvable: Vec = { ...herWeights, financial: 0.02, lifestyle: 0.25, presentation: 0.20 };
		const { block } = buildProofInviteContext({
			herWeights: twoProvable, hisAttrs, hisConf: { ...hisConf, presentation: 0.3 },
			rivalAppeals: [30, 20],
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
