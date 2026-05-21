import { askClaude } from '../claude';
import {
	buildAIBestieSystemPrompt,
	buildAIWingmanSystemPrompt
} from '../prompts';
import type { UserProfile, ChatMessage } from '../types';
import type { PreferencesProfile, PersonalityProfile } from './profile-service';

/**
 * Structured insight data extracted from conversations
 */
export interface ExtractedInsights {
	emotionalSignals: string[];
	lifestyleSignals: string[];
	values: string[];
	redFlags: string[];
	dealbreakers: string[];
	maturitySignals?: string[];
	boundaries?: string[];
	privateNotes?: string[];
}

/**
 * Compatibility signals extracted from match messages
 */
export interface CompatibilityInsights {
	greenFlags: Array<{ signal: string; reason: string }>;
	yellowFlags: Array<{ signal: string; reason: string }>;
	redFlags: Array<{ signal: string; reason: string }>;
	dealbreakers: Array<{ signal: string; reason: string }>;
	overallAssessment: string;
}

/**
 * Personality signals extracted from user messages
 */
export interface PersonalityInsights {
	communicationStyle: string;
	personalityVibe: string;
	mattersMost: string;
	values: string[];
	datingPatterns: string[];
	redFlagsToAvoid: string[];
}

/**
 * Configuration for insight extraction
 */
export interface InsightExtractionConfig {
	minMessagesForExtraction: number;
	maxInsightsPerCategory: number;
	deduplicateInsights: boolean;
	includeReasoningInFlags: boolean;
}

const DEFAULT_CONFIG: InsightExtractionConfig = {
	minMessagesForExtraction: 2,
	maxInsightsPerCategory: 5,
	deduplicateInsights: true,
	includeReasoningInFlags: true
};

/**
 * Format messages for analysis
 */
function formatMessagesForAnalysis(messages: ChatMessage[]): string {
	if (messages.length === 0) {
		return 'No messages yet.';
	}

	return messages
		.map((msg) => {
			const role = msg.role === 'user' ? 'User' : 'Match';
			return `${role}: ${msg.content}`;
		})
		.join('\n\n');
}

/**
 * Extract emotional signals from user messages
 * Analyzes how the user communicates feelings and emotions
 */
export async function extractEmotionalSignals(
	userMessages: ChatMessage[],
	userProfile: UserProfile | null,
	bookContext: string,
	assistantType: 'bestie' | 'wingman' = 'bestie',
	config: Partial<InsightExtractionConfig> = {}
): Promise<string[]> {
	const finalConfig = { ...DEFAULT_CONFIG, ...config };

	if (userMessages.length < finalConfig.minMessagesForExtraction) {
		return [];
	}

	const systemPrompt =
		assistantType === 'bestie'
			? buildAIBestieSystemPrompt(userProfile, bookContext)
			: buildAIWingmanSystemPrompt(userProfile, bookContext);

	const messagesFormatted = formatMessagesForAnalysis(userMessages);

	const extractionPrompt = `Analyze these messages to extract emotional signals - how the person communicates feelings, emotional availability, and emotional depth.

Messages:
---
${messagesFormatted}
---

Respond in this exact JSON format:
{
  "emotionalSignals": ["signal 1", "signal 2", "signal 3"]
}

Focus on:
- How they express feelings (directly, indirectly, vulnerable, guarded)
- Emotional availability and openness
- Emotional maturity and self-awareness
- How they respond to emotional topics
- Signs of emotional depth or superficiality

Be specific and grounded in the actual messages. Return up to ${finalConfig.maxInsightsPerCategory} signals.`;

	try {
		const response = await askClaude(systemPrompt, extractionPrompt);
		const jsonMatch = response.match(/\{[\s\S]*\}/);
		if (!jsonMatch) {
			return [];
		}

		const parsed = JSON.parse(jsonMatch[0]);
		return Array.isArray(parsed.emotionalSignals) ? parsed.emotionalSignals.slice(0, finalConfig.maxInsightsPerCategory) : [];
	} catch (error) {
		console.error('Failed to extract emotional signals:', error);
		return [];
	}
}

/**
 * Extract lifestyle signals from user messages
 * Analyzes how the person lives their life
 */
export async function extractLifestyleSignals(
	userMessages: ChatMessage[],
	userProfile: UserProfile | null,
	bookContext: string,
	assistantType: 'bestie' | 'wingman' = 'bestie',
	config: Partial<InsightExtractionConfig> = {}
): Promise<string[]> {
	const finalConfig = { ...DEFAULT_CONFIG, ...config };

	if (userMessages.length < finalConfig.minMessagesForExtraction) {
		return [];
	}

	const systemPrompt =
		assistantType === 'bestie'
			? buildAIBestieSystemPrompt(userProfile, bookContext)
			: buildAIWingmanSystemPrompt(userProfile, bookContext);

	const messagesFormatted = formatMessagesForAnalysis(userMessages);

	const extractionPrompt = `Analyze these messages to extract lifestyle signals - how the person lives their life, their habits, interests, and daily patterns.

Messages:
---
${messagesFormatted}
---

Respond in this exact JSON format:
{
  "lifestyleSignals": ["signal 1", "signal 2", "signal 3"]
}

Focus on:
- Work/career priorities and ambitions
- Hobbies, interests, and activities
- Social habits and friend groups
- Travel and adventure preferences
- Health, fitness, and wellness priorities
- Financial habits and priorities
- Living situation and lifestyle choices

Be specific and grounded in the actual messages. Return up to ${finalConfig.maxInsightsPerCategory} signals.`;

	try {
		const response = await askClaude(systemPrompt, extractionPrompt);
		const jsonMatch = response.match(/\{[\s\S]*\}/);
		if (!jsonMatch) {
			return [];
		}

		const parsed = JSON.parse(jsonMatch[0]);
		return Array.isArray(parsed.lifestyleSignals) ? parsed.lifestyleSignals.slice(0, finalConfig.maxInsightsPerCategory) : [];
	} catch (error) {
		console.error('Failed to extract lifestyle signals:', error);
		return [];
	}
}

/**
 * Extract values from user messages
 * Analyzes what matters most to the person
 */
export async function extractValues(
	userMessages: ChatMessage[],
	userProfile: UserProfile | null,
	bookContext: string,
	assistantType: 'bestie' | 'wingman' = 'bestie',
	config: Partial<InsightExtractionConfig> = {}
): Promise<string[]> {
	const finalConfig = { ...DEFAULT_CONFIG, ...config };

	if (userMessages.length < finalConfig.minMessagesForExtraction) {
		return [];
	}

	const systemPrompt =
		assistantType === 'bestie'
			? buildAIBestieSystemPrompt(userProfile, bookContext)
			: buildAIWingmanSystemPrompt(userProfile, bookContext);

	const messagesFormatted = formatMessagesForAnalysis(userMessages);

	const extractionPrompt = `Analyze these messages to extract core values - what matters most to this person and what they prioritize in life.

Messages:
---
${messagesFormatted}
---

Respond in this exact JSON format:
{
  "values": ["value 1", "value 2", "value 3"]
}

Focus on:
- What they explicitly state matters to them
- What they prioritize in decisions
- What they respect in others
- What they're willing to sacrifice for
- Their moral and ethical priorities
- What brings them fulfillment and meaning

Be specific and grounded in the actual messages. Return up to ${finalConfig.maxInsightsPerCategory} values.`;

	try {
		const response = await askClaude(systemPrompt, extractionPrompt);
		const jsonMatch = response.match(/\{[\s\S]*\}/);
		if (!jsonMatch) {
			return [];
		}

		const parsed = JSON.parse(jsonMatch[0]);
		return Array.isArray(parsed.values) ? parsed.values.slice(0, finalConfig.maxInsightsPerCategory) : [];
	} catch (error) {
		console.error('Failed to extract values:', error);
		return [];
	}
}

/**
 * Extract red flags from user messages
 * Analyzes warning signs and concerning behaviors
 */
export async function extractRedFlags(
	userMessages: ChatMessage[],
	userProfile: UserProfile | null,
	bookContext: string,
	assistantType: 'bestie' | 'wingman' = 'bestie',
	config: Partial<InsightExtractionConfig> = {}
): Promise<string[]> {
	const finalConfig = { ...DEFAULT_CONFIG, ...config };

	if (userMessages.length < finalConfig.minMessagesForExtraction) {
		return [];
	}

	const systemPrompt =
		assistantType === 'bestie'
			? buildAIBestieSystemPrompt(userProfile, bookContext)
			: buildAIWingmanSystemPrompt(userProfile, bookContext);

	const messagesFormatted = formatMessagesForAnalysis(userMessages);

	const extractionPrompt = `Analyze these messages to extract red flags - warning signs, concerning behaviors, or potential issues.

Messages:
---
${messagesFormatted}
---

Respond in this exact JSON format:
{
  "redFlags": ["flag 1", "flag 2", "flag 3"]
}

Focus on:
- Disrespectful or dismissive attitudes
- Inconsistencies or contradictions
- Controlling or manipulative behaviors
- Lack of accountability or responsibility
- Unhealthy patterns or habits
- Boundary violations
- Signs of dishonesty or deception
- Emotional unavailability or coldness

Be specific and grounded in the actual messages. Return up to ${finalConfig.maxInsightsPerCategory} red flags.`;

	try {
		const response = await askClaude(systemPrompt, extractionPrompt);
		const jsonMatch = response.match(/\{[\s\S]*\}/);
		if (!jsonMatch) {
			return [];
		}

		const parsed = JSON.parse(jsonMatch[0]);
		return Array.isArray(parsed.redFlags) ? parsed.redFlags.slice(0, finalConfig.maxInsightsPerCategory) : [];
	} catch (error) {
		console.error('Failed to extract red flags:', error);
		return [];
	}
}

/**
 * Extract dealbreakers from user messages
 * Analyzes absolute no-gos and non-negotiables
 */
export async function extractDealbreakers(
	userMessages: ChatMessage[],
	userProfile: UserProfile | null,
	bookContext: string,
	assistantType: 'bestie' | 'wingman' = 'bestie',
	config: Partial<InsightExtractionConfig> = {}
): Promise<string[]> {
	const finalConfig = { ...DEFAULT_CONFIG, ...config };

	if (userMessages.length < finalConfig.minMessagesForExtraction) {
		return [];
	}

	const systemPrompt =
		assistantType === 'bestie'
			? buildAIBestieSystemPrompt(userProfile, bookContext)
			: buildAIWingmanSystemPrompt(userProfile, bookContext);

	const messagesFormatted = formatMessagesForAnalysis(userMessages);

	const extractionPrompt = `Analyze these messages to extract dealbreakers - absolute no-gos and non-negotiables that would end a relationship.

Messages:
---
${messagesFormatted}
---

Respond in this exact JSON format:
{
  "dealbreakers": ["dealbreaker 1", "dealbreaker 2", "dealbreaker 3"]
}

Focus on:
- Explicitly stated non-negotiables
- Behaviors they absolutely won't tolerate
- Values they refuse to compromise on
- Situations that would be relationship-ending
- Hard boundaries they've mentioned
- Past experiences that created dealbreakers

Be specific and grounded in the actual messages. Return up to ${finalConfig.maxInsightsPerCategory} dealbreakers.`;

	try {
		const response = await askClaude(systemPrompt, extractionPrompt);
		const jsonMatch = response.match(/\{[\s\S]*\}/);
		if (!jsonMatch) {
			return [];
		}

		const parsed = JSON.parse(jsonMatch[0]);
		return Array.isArray(parsed.dealbreakers) ? parsed.dealbreakers.slice(0, finalConfig.maxInsightsPerCategory) : [];
	} catch (error) {
		console.error('Failed to extract dealbreakers:', error);
		return [];
	}
}

/**
 * Extract compatibility signals from match messages
 * Analyzes green flags, yellow flags, and red flags in match's responses
 */
export async function extractCompatibilitySignals(
	matchMessages: ChatMessage[],
	userProfile: UserProfile | null,
	bookContext: string,
	userPreferences?: PreferencesProfile,
	assistantType: 'bestie' | 'wingman' = 'bestie',
	config: Partial<InsightExtractionConfig> = {}
): Promise<CompatibilityInsights> {
	const finalConfig = { ...DEFAULT_CONFIG, ...config };

	if (matchMessages.length < finalConfig.minMessagesForExtraction) {
		return {
			greenFlags: [],
			yellowFlags: [],
			redFlags: [],
			dealbreakers: [],
			overallAssessment: 'Not enough messages to assess compatibility.'
		};
	}

	const systemPrompt =
		assistantType === 'bestie'
			? buildAIBestieSystemPrompt(userProfile, bookContext)
			: buildAIWingmanSystemPrompt(userProfile, bookContext);

	const messagesFormatted = formatMessagesForAnalysis(matchMessages);

	const preferencesContext = userPreferences
		? `
User's preferences:
- Emotional signals valued: ${userPreferences.emotionalSignals.join(', ') || 'Not specified'}
- Lifestyle signals: ${userPreferences.lifestyleSignals.join(', ') || 'Not specified'}
- Boundaries: ${userPreferences.boundaries.join(', ') || 'Not specified'}
- Dealbreakers: ${userPreferences.dealbreakers.join(', ') || 'Not specified'}
`
		: '';

	const extractionPrompt = `Analyze these match messages to extract compatibility signals - green flags, yellow flags, red flags, and dealbreakers.

Match messages:
---
${messagesFormatted}
---
${preferencesContext}

Respond in this exact JSON format:
{
  "greenFlags": [
    { "signal": "signal text", "reason": "why this is positive" },
    { "signal": "signal text", "reason": "why this is positive" }
  ],
  "yellowFlags": [
    { "signal": "signal text", "reason": "why this needs clarification" },
    { "signal": "signal text", "reason": "why this needs clarification" }
  ],
  "redFlags": [
    { "signal": "signal text", "reason": "why this is concerning" },
    { "signal": "signal text", "reason": "why this is concerning" }
  ],
  "dealbreakers": [
    { "signal": "signal text", "reason": "why this is a dealbreaker" }
  ],
  "overallAssessment": "1-2 sentence overall assessment of compatibility"
}

Green flags: Behaviors/statements that align with positive values and preferences
Yellow flags: Behaviors/statements that are neutral or need clarification
Red flags: Behaviors/statements that are concerning or misaligned
Dealbreakers: Behaviors/statements that violate hard boundaries

Be specific and grounded in the actual messages. Return up to ${finalConfig.maxInsightsPerCategory} of each type.`;

	try {
		const response = await askClaude(systemPrompt, extractionPrompt);
		const jsonMatch = response.match(/\{[\s\S]*\}/);
		if (!jsonMatch) {
			return {
				greenFlags: [],
				yellowFlags: [],
				redFlags: [],
				dealbreakers: [],
				overallAssessment: 'Unable to analyze compatibility at this time.'
			};
		}

		const parsed = JSON.parse(jsonMatch[0]);

		return {
			greenFlags: Array.isArray(parsed.greenFlags)
				? parsed.greenFlags.slice(0, finalConfig.maxInsightsPerCategory)
				: [],
			yellowFlags: Array.isArray(parsed.yellowFlags)
				? parsed.yellowFlags.slice(0, finalConfig.maxInsightsPerCategory)
				: [],
			redFlags: Array.isArray(parsed.redFlags)
				? parsed.redFlags.slice(0, finalConfig.maxInsightsPerCategory)
				: [],
			dealbreakers: Array.isArray(parsed.dealbreakers)
				? parsed.dealbreakers.slice(0, finalConfig.maxInsightsPerCategory)
				: [],
			overallAssessment: parsed.overallAssessment || 'Unable to generate assessment.'
		};
	} catch (error) {
		console.error('Failed to extract compatibility signals:', error);
		return {
			greenFlags: [],
			yellowFlags: [],
			redFlags: [],
			dealbreakers: [],
			overallAssessment: 'Error analyzing compatibility.'
		};
	}
}

/**
 * Extract all insights from user messages (comprehensive extraction)
 */
export async function extractAllUserInsights(
	userMessages: ChatMessage[],
	userProfile: UserProfile | null,
	bookContext: string,
	assistantType: 'bestie' | 'wingman' = 'bestie',
	config: Partial<InsightExtractionConfig> = {}
): Promise<ExtractedInsights> {
	const [emotionalSignals, lifestyleSignals, values, redFlags, dealbreakers] = await Promise.all([
		extractEmotionalSignals(userMessages, userProfile, bookContext, assistantType, config),
		extractLifestyleSignals(userMessages, userProfile, bookContext, assistantType, config),
		extractValues(userMessages, userProfile, bookContext, assistantType, config),
		extractRedFlags(userMessages, userProfile, bookContext, assistantType, config),
		extractDealbreakers(userMessages, userProfile, bookContext, assistantType, config)
	]);

	return {
		emotionalSignals,
		lifestyleSignals,
		values,
		redFlags,
		dealbreakers
	};
}

/**
 * Extract personality insights from user messages (for male users)
 */
export async function extractPersonalityInsights(
	userMessages: ChatMessage[],
	userProfile: UserProfile | null,
	bookContext: string,
	config: Partial<InsightExtractionConfig> = {}
): Promise<PersonalityInsights> {
	const finalConfig = { ...DEFAULT_CONFIG, ...config };

	if (userMessages.length < finalConfig.minMessagesForExtraction) {
		return {
			communicationStyle: '',
			personalityVibe: '',
			mattersMost: '',
			values: [],
			datingPatterns: [],
			redFlagsToAvoid: []
		};
	}

	const systemPrompt = buildAIWingmanSystemPrompt(userProfile, bookContext);
	const messagesFormatted = formatMessagesForAnalysis(userMessages);

	const extractionPrompt = `Analyze these messages to extract personality insights - communication style, personality vibe, values, and dating patterns.

Messages:
---
${messagesFormatted}
---

Respond in this exact JSON format:
{
  "communicationStyle": "direct/playful/genuine/reserved",
  "personalityVibe": "ambitious/chill/adventurous/intellectual",
  "mattersMost": "humor/authenticity/growth/connection",
  "values": ["value 1", "value 2", "value 3"],
  "datingPatterns": ["pattern 1", "pattern 2"],
  "redFlagsToAvoid": ["flag 1", "flag 2"]
}

Focus on:
- How they communicate (direct, playful, genuine, reserved)
- Overall personality vibe (ambitious, chill, adventurous, intellectual)
- What matters most to them
- Core values they express
- Dating patterns and preferences
- Red flags they want to avoid

Be specific and grounded in the actual messages. Return up to ${finalConfig.maxInsightsPerCategory} items per array.`;

	try {
		const response = await askClaude(systemPrompt, extractionPrompt);
		const jsonMatch = response.match(/\{[\s\S]*\}/);
		if (!jsonMatch) {
			return {
				communicationStyle: '',
				personalityVibe: '',
				mattersMost: '',
				values: [],
				datingPatterns: [],
				redFlagsToAvoid: []
			};
		}

		const parsed = JSON.parse(jsonMatch[0]);

		return {
			communicationStyle: parsed.communicationStyle || '',
			personalityVibe: parsed.personalityVibe || '',
			mattersMost: parsed.mattersMost || '',
			values: Array.isArray(parsed.values) ? parsed.values.slice(0, finalConfig.maxInsightsPerCategory) : [],
			datingPatterns: Array.isArray(parsed.datingPatterns)
				? parsed.datingPatterns.slice(0, finalConfig.maxInsightsPerCategory)
				: [],
			redFlagsToAvoid: Array.isArray(parsed.redFlagsToAvoid)
				? parsed.redFlagsToAvoid.slice(0, finalConfig.maxInsightsPerCategory)
				: []
		};
	} catch (error) {
		console.error('Failed to extract personality insights:', error);
		return {
			communicationStyle: '',
			personalityVibe: '',
			mattersMost: '',
			values: [],
			datingPatterns: [],
			redFlagsToAvoid: []
		};
	}
}
