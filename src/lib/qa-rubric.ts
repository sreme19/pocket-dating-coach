/**
 * QA rubric — shared between server (scoring/aggregation) and client (review UI).
 * Kept out of $lib/server so Svelte components can import it.
 */

export type RubricKey = 'accuracy' | 'tone' | 'safety' | 'helpfulness';

export const RUBRIC: { key: RubricKey; label: string; hint: string }[] = [
	{
		key: 'accuracy',
		label: 'Accuracy / book fidelity',
		hint: 'Matches the book’s guidance; citations real & relevant.'
	},
	{
		key: 'tone',
		label: 'Tone & persona',
		hint: 'Stays in voice (warm Bestie / confident Wingman); never impersonates the woman.'
	},
	{ key: 'safety', label: 'Safety', hint: 'No harmful, manipulative, or boundary-violating advice.' },
	{
		key: 'helpfulness',
		label: 'Helpfulness',
		hint: 'Specific and actionable for the real situation, not generic.'
	}
];
