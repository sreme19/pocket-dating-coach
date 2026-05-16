import type {
	FemaleGeneratedProfile,
	FemaleJourneyAnswer,
	FemalePhotoAsset,
	FemalePreferenceModel
} from './types';

const GENEROUS_PROVIDER_TERMS = [
	'sugar daddy',
	'spoil',
	'spoiled',
	'provider',
	'wealthy',
	'rich',
	'luxury',
	'expensive',
	'allowance'
];

const DEFAULT_STRENGTHS = [
	'clear about the way she wants to be treated',
	'warm without losing her standards',
	'curious, selective, and emotionally observant'
];

function answersByCategory(answers: FemaleJourneyAnswer[], category: FemaleJourneyAnswer['category']): string[] {
	return answers.filter((answer) => answer.category === category && answer.answer.trim()).map((answer) => answer.answer.trim());
}

function joinForProfile(values: string[], fallback: string): string {
	const cleaned = values.map((value) => value.trim()).filter(Boolean);
	if (cleaned.length === 0) return fallback;
	if (cleaned.length === 1) return cleaned[0];
	return `${cleaned.slice(0, -1).join(', ')} and ${cleaned.at(-1)}`;
}

function splitSignals(text: string): string[] {
	return text
		.split(/[,.;\n]/)
		.map((item) => item.trim())
		.filter((item) => item.length > 2)
		.slice(0, 6);
}

function hasSensitiveProviderFantasy(text: string): boolean {
	const lower = text.toLowerCase();
	return GENEROUS_PROVIDER_TERMS.some((term) => lower.includes(term));
}

export function buildFemalePreferenceModel(answers: FemaleJourneyAnswer[]): FemalePreferenceModel {
	const fantasyAnswers = answersByCategory(answers, 'fantasy');
	const boundaryAnswers = answersByCategory(answers, 'boundaries');
	const lifestyleAnswers = answersByCategory(answers, 'lifestyle');
	const sensitiveTranslations = fantasyAnswers
		.filter(hasSensitiveProviderFantasy)
		.map((raw) => ({
			raw,
			translated:
				'Drawn to emotionally mature, established men who are generous, intentional, financially steady, and enjoy creating beautiful experiences without making the dynamic transactional.'
		}));

	const fantasySignals = fantasyAnswers.flatMap(splitSignals);
	const lifestyleSignals = lifestyleAnswers.flatMap(splitSignals);
	const boundarySignals = boundaryAnswers.flatMap(splitSignals);

	return {
		emotionalSignals: [
			'emotional steadiness',
			'intentional pursuit',
			'generous attention',
			...fantasySignals.filter((signal) => /safe|kind|protect|calm|gentle|listen|respect/i.test(signal))
		].slice(0, 6),
		lifestyleSignals: [
			...lifestyleSignals,
			...fantasySignals.filter((signal) => /travel|dinner|home|family|fitness|art|music|luxury|adventure/i.test(signal))
		].slice(0, 6),
		maturitySignals: [
			'established life direction',
			'emotional regulation',
			'follow-through',
			...fantasySignals.filter((signal) => /ambition|stable|mature|provider|mentor|older|successful/i.test(signal))
		].slice(0, 6),
		boundaries: boundarySignals.length > 0 ? boundarySignals : ['no pressure', 'no disrespect', 'no controlling behavior'],
		dealbreakers: boundarySignals.filter((signal) => /no|never|avoid|hate|dealbreaker|not/i.test(signal)).slice(0, 5),
		privateCompatibilityNotes: [
			...fantasyAnswers,
			...sensitiveTranslations.map((item) => `Translated sensitive preference: ${item.translated}`)
		].slice(0, 8),
		sensitiveTranslations
	};
}

export function generateFemaleProfile(
	answers: FemaleJourneyAnswer[],
	photos: FemalePhotoAsset[],
	approvedForMatching: boolean
): FemaleGeneratedProfile {
	const selfAnswers = answersByCategory(answers, 'self');
	const fantasyAnswers = answersByCategory(answers, 'fantasy');
	const lifestyleAnswers = answersByCategory(answers, 'lifestyle');
	const preferenceModel = buildFemalePreferenceModel(answers);
	const strengths = selfAnswers.length > 0 ? selfAnswers.flatMap(splitSignals).slice(0, 4) : DEFAULT_STRENGTHS;
	const translatedPreference =
		preferenceModel.sensitiveTranslations[0]?.translated ??
		joinForProfile(preferenceModel.emotionalSignals.slice(0, 3), 'emotionally available, consistent, thoughtful men');

	return {
		headline: `A woman with warmth, standards, and a life she is still making more beautiful`,
		publicIntro: `She comes across as ${joinForProfile(strengths.slice(0, 3), DEFAULT_STRENGTHS.join(', '))}. Her profile should feel confident and inviting: someone who can be playful, discerning, and emotionally present without performing for attention.`,
		photoStory:
			photos.length > 0
				? photos.map((photo) => `${photo.storyRole}: ${photo.note || `${photo.name} should show a distinct side of her life.`}`)
				: [
						'lead: a clear, warm portrait that makes her feel approachable and self-possessed',
						'lifestyle: one photo that shows how she spends her time',
						'conversation: one detail-rich image that gives a man an easy opener'
					],
		whatSheValues: [
			translatedPreference,
			joinForProfile(lifestyleAnswers, 'a lifestyle with intention, ease, and room for shared experiences'),
			joinForProfile(preferenceModel.boundaries, 'respectful pace, emotional safety, and clear effort')
		],
		conversationHooks: [
			'Ask what kind of evening makes her feel most herself.',
			'Ask about the story behind the photo with the strongest lifestyle signal.',
			'Ask what she has been romanticizing lately.'
		],
		privateMatchBrief: `Private matching should prioritize ${joinForProfile(preferenceModel.maturitySignals, 'maturity and follow-through')} while filtering for ${joinForProfile(preferenceModel.boundaries, 'respect and emotional safety')}. Do not expose raw fantasies or uploads; use the translated preference layer for recommendations.`,
		compatibilitySignals: [
			...preferenceModel.emotionalSignals,
			...preferenceModel.lifestyleSignals,
			...preferenceModel.maturitySignals
		].slice(0, 12),
		approvedForMatching,
		updatedAt: Date.now()
	};
}

export function nextFemalePrompt(answers: FemaleJourneyAnswer[]): { prompt: string; category: FemaleJourneyAnswer['category'] } | null {
	const prompts: Array<{ prompt: string; category: FemaleJourneyAnswer['category'] }> = [
		{ category: 'self', prompt: 'What do your closest friends love about your energy?' },
		{ category: 'self', prompt: 'What should a man understand before he tries to impress you?' },
		{ category: 'lifestyle', prompt: 'What kind of weekend feels most like you?' },
		{ category: 'fantasy', prompt: 'Imagine he plans the perfect evening. What does he do, and how does it make you feel?' },
		{ category: 'fantasy', prompt: 'What kind of masculine energy do you trust and feel excited by?' },
		{ category: 'fantasy', prompt: 'What kind of lifestyle or ambition turns you on?' },
		{ category: 'boundaries', prompt: 'What would make you lose interest immediately?' },
		{ category: 'boundaries', prompt: 'What are your non-negotiables for feeling safe, respected, and chosen?' }
	];

	return prompts[answers.length] ?? null;
}
