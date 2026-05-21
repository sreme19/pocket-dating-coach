import { askClaude } from '../claude';
import {
	buildAIBestieSystemPrompt,
	buildAIWingmanSystemPrompt,
	buildAIAssistantContextPrompt
} from '../prompts';
import type { UserProfile, ChatMessage } from '../types';
import type { PreferencesProfile, PersonalityProfile } from './profile-service';
import { loadPreferences, loadPersonality, updatePreferences, updatePersonality } from './profile-service';

/**
 * Configuration for profile auto-update
 */
export interface AutoUpdateConfig {
	minMessagesForUpdate: number; // Minimum messages before attempting update
	deduplicateInsights: boolean; // Avoid duplicate insights
	maxInsightsPerUpdate: number; // Max new insights per update
}

const DEFAULT_CONFIG: AutoUpdateConfig = {
	minMessagesForUpdate: 3,
	deduplicateInsights: true,
	maxInsightsPerUpdate: 5
};

/**
 * Format recent messages for analysis
 */
function formatRecentMessages(messages: ChatMessage[]): string {
	if (messages.length === 0) {
		return 'No previous messages yet.';
	}

	return messages
		.map((msg) => {
			const role = msg.role === 'user' ? 'You' : 'Match';
			return `${role}: ${msg.content}`;
		})
		.join('\n');
}

/**
 * Deduplicate insights by checking if they already exist in the profile
 */
function deduplicateInsights(
	newInsights: string[],
	existingInsights: string[],
	similarityThreshold: number = 0.7
): string[] {
	if (!newInsights || newInsights.length === 0) {
		return [];
	}

	// Simple string similarity check (case-insensitive, substring matching)
	const filtered = newInsights.filter((newInsight) => {
		const lowerNew = newInsight.toLowerCase();
		return !existingInsights.some((existing) => {
			const lowerExisting = existing.toLowerCase();
			// Check if strings are similar (substring or exact match)
			return (
				lowerNew === lowerExisting ||
				lowerNew.includes(lowerExisting) ||
				lowerExisting.includes(lowerNew)
			);
		});
	});

	return filtered;
}

/**
 * Extract insights from user messages (for female users)
 * Analyzes what the user is saying to understand their preferences and signals
 */
export async function extractUserMessageInsights(
	userMessages: ChatMessage[],
	currentPreferences: PreferencesProfile,
	userProfile: UserProfile | null,
	bookContext: string,
	config: Partial<AutoUpdateConfig> = {}
): Promise<Partial<PreferencesProfile>> {
	const finalConfig = { ...DEFAULT_CONFIG, ...config };

	if (userMessages.length < finalConfig.minMessagesForUpdate) {
		return {};
	}

	// Build system prompt for analysis
	const systemPrompt = buildAIBestieSystemPrompt(userProfile, bookContext);

	// Format messages for analysis
	const messagesFormatted = formatRecentMessages(userMessages);

	// Create extraction prompt
	const extractionPrompt = `Analyze these messages from a female user to extract insights about her dating preferences, emotional signals, and compatibility criteria.

Messages:
---
${messagesFormatted}
---

Current preferences:
- Emotional signals: ${currentPreferences.emotionalSignals.join(', ') || 'None yet'}
- Lifestyle signals: ${currentPreferences.lifestyleSignals.join(', ') || 'None yet'}
- Maturity signals: ${currentPreferences.maturitySignals.join(', ') || 'None yet'}
- Boundaries: ${currentPreferences.boundaries.join(', ') || 'None yet'}
- Dealbreakers: ${currentPreferences.dealbreakers.join(', ') || 'None yet'}

Respond in this exact JSON format:
{
  "emotionalSignals": ["signal 1", "signal 2"],
  "lifestyleSignals": ["signal 1"],
  "maturitySignals": ["signal 1"],
  "boundaries": ["boundary 1"],
  "dealbreakers": ["dealbreaker 1"],
  "privateCompatibilityNotes": ["note 1"]
}

Only include NEW insights that are clearly evident from the messages and not already in her current preferences.
Be specific and grounded. Return empty arrays for categories with no new insights.`;

	try {
		// Call Claude
		const response = await askClaude(systemPrompt, extractionPrompt);

		// Parse JSON response
		const jsonMatch = response.match(/\{[\s\S]*\}/);
		if (!jsonMatch) {
			return {};
		}

		const parsed = JSON.parse(jsonMatch[0]);
		const updates: Partial<PreferencesProfile> = {};

		// Deduplicate and add insights
		if (parsed.emotionalSignals?.length > 0) {
			const deduped = deduplicateInsights(parsed.emotionalSignals, currentPreferences.emotionalSignals);
			if (deduped.length > 0) {
				updates.emotionalSignals = [
					...currentPreferences.emotionalSignals,
					...deduped.slice(0, finalConfig.maxInsightsPerUpdate)
				];
			}
		}

		if (parsed.lifestyleSignals?.length > 0) {
			const deduped = deduplicateInsights(parsed.lifestyleSignals, currentPreferences.lifestyleSignals);
			if (deduped.length > 0) {
				updates.lifestyleSignals = [
					...currentPreferences.lifestyleSignals,
					...deduped.slice(0, finalConfig.maxInsightsPerUpdate)
				];
			}
		}

		if (parsed.maturitySignals?.length > 0) {
			const deduped = deduplicateInsights(parsed.maturitySignals, currentPreferences.maturitySignals);
			if (deduped.length > 0) {
				updates.maturitySignals = [
					...currentPreferences.maturitySignals,
					...deduped.slice(0, finalConfig.maxInsightsPerUpdate)
				];
			}
		}

		if (parsed.boundaries?.length > 0) {
			const deduped = deduplicateInsights(parsed.boundaries, currentPreferences.boundaries);
			if (deduped.length > 0) {
				updates.boundaries = [
					...currentPreferences.boundaries,
					...deduped.slice(0, finalConfig.maxInsightsPerUpdate)
				];
			}
		}

		if (parsed.dealbreakers?.length > 0) {
			const deduped = deduplicateInsights(parsed.dealbreakers, currentPreferences.dealbreakers);
			if (deduped.length > 0) {
				updates.dealbreakers = [
					...currentPreferences.dealbreakers,
					...deduped.slice(0, finalConfig.maxInsightsPerUpdate)
				];
			}
		}

		if (parsed.privateCompatibilityNotes?.length > 0) {
			const deduped = deduplicateInsights(
				parsed.privateCompatibilityNotes,
				currentPreferences.privateCompatibilityNotes
			);
			if (deduped.length > 0) {
				updates.privateCompatibilityNotes = [
					...currentPreferences.privateCompatibilityNotes,
					...deduped.slice(0, finalConfig.maxInsightsPerUpdate)
				];
			}
		}

		return updates;
	} catch (error) {
		console.error('Failed to extract user message insights:', error);
		return {};
	}
}

/**
 * Extract insights from match messages (for female users)
 * Analyzes what the match is saying to understand compatibility signals
 */
export async function extractMatchMessageInsights(
	matchMessages: ChatMessage[],
	currentPreferences: PreferencesProfile,
	userProfile: UserProfile | null,
	bookContext: string,
	config: Partial<AutoUpdateConfig> = {}
): Promise<Partial<PreferencesProfile>> {
	const finalConfig = { ...DEFAULT_CONFIG, ...config };

	if (matchMessages.length < finalConfig.minMessagesForUpdate) {
		return {};
	}

	// Build system prompt for analysis
	const systemPrompt = buildAIBestieSystemPrompt(userProfile, bookContext);

	// Format messages for analysis
	const messagesFormatted = formatRecentMessages(matchMessages);

	// Create extraction prompt
	const extractionPrompt = `Analyze these messages from a match to extract insights about compatibility signals, emotional availability, and potential dealbreakers.

Match messages:
---
${messagesFormatted}
---

Current preferences:
- Emotional signals valued: ${currentPreferences.emotionalSignals.join(', ') || 'None yet'}
- Lifestyle signals: ${currentPreferences.lifestyleSignals.join(', ') || 'None yet'}
- Boundaries: ${currentPreferences.boundaries.join(', ') || 'None yet'}
- Dealbreakers: ${currentPreferences.dealbreakers.join(', ') || 'None yet'}

Respond in this exact JSON format:
{
  "emotionalSignals": ["signal 1"],
  "lifestyleSignals": ["signal 1"],
  "boundaries": ["boundary 1"],
  "dealbreakers": ["dealbreaker 1"],
  "privateCompatibilityNotes": ["note 1"]
}

Only include NEW insights that are clearly evident from the match's messages and not already in her current preferences.
Focus on what this match is revealing about themselves and how it relates to her preferences.
Be specific and grounded. Return empty arrays for categories with no new insights.`;

	try {
		// Call Claude
		const response = await askClaude(systemPrompt, extractionPrompt);

		// Parse JSON response
		const jsonMatch = response.match(/\{[\s\S]*\}/);
		if (!jsonMatch) {
			return {};
		}

		const parsed = JSON.parse(jsonMatch[0]);
		const updates: Partial<PreferencesProfile> = {};

		// Deduplicate and add insights
		if (parsed.emotionalSignals?.length > 0) {
			const deduped = deduplicateInsights(parsed.emotionalSignals, currentPreferences.emotionalSignals);
			if (deduped.length > 0) {
				updates.emotionalSignals = [
					...currentPreferences.emotionalSignals,
					...deduped.slice(0, finalConfig.maxInsightsPerUpdate)
				];
			}
		}

		if (parsed.lifestyleSignals?.length > 0) {
			const deduped = deduplicateInsights(parsed.lifestyleSignals, currentPreferences.lifestyleSignals);
			if (deduped.length > 0) {
				updates.lifestyleSignals = [
					...currentPreferences.lifestyleSignals,
					...deduped.slice(0, finalConfig.maxInsightsPerUpdate)
				];
			}
		}

		if (parsed.boundaries?.length > 0) {
			const deduped = deduplicateInsights(parsed.boundaries, currentPreferences.boundaries);
			if (deduped.length > 0) {
				updates.boundaries = [
					...currentPreferences.boundaries,
					...deduped.slice(0, finalConfig.maxInsightsPerUpdate)
				];
			}
		}

		if (parsed.dealbreakers?.length > 0) {
			const deduped = deduplicateInsights(parsed.dealbreakers, currentPreferences.dealbreakers);
			if (deduped.length > 0) {
				updates.dealbreakers = [
					...currentPreferences.dealbreakers,
					...deduped.slice(0, finalConfig.maxInsightsPerUpdate)
				];
			}
		}

		if (parsed.privateCompatibilityNotes?.length > 0) {
			const deduped = deduplicateInsights(
				parsed.privateCompatibilityNotes,
				currentPreferences.privateCompatibilityNotes
			);
			if (deduped.length > 0) {
				updates.privateCompatibilityNotes = [
					...currentPreferences.privateCompatibilityNotes,
					...deduped.slice(0, finalConfig.maxInsightsPerUpdate)
				];
			}
		}

		return updates;
	} catch (error) {
		console.error('Failed to extract match message insights:', error);
		return {};
	}
}

/**
 * Extract insights from user messages (for male users)
 * Analyzes what the user is saying to understand their personality and values
 */
export async function extractUserPersonalityInsights(
	userMessages: ChatMessage[],
	currentPersonality: PersonalityProfile,
	userProfile: UserProfile | null,
	bookContext: string,
	config: Partial<AutoUpdateConfig> = {}
): Promise<Partial<PersonalityProfile>> {
	const finalConfig = { ...DEFAULT_CONFIG, ...config };

	if (userMessages.length < finalConfig.minMessagesForUpdate) {
		return {};
	}

	// Build system prompt for analysis
	const systemPrompt = buildAIWingmanSystemPrompt(userProfile, bookContext);

	// Format messages for analysis
	const messagesFormatted = formatRecentMessages(userMessages);

	// Create extraction prompt
	const extractionPrompt = `Analyze these messages from a male user to extract insights about his personality, communication style, values, and dating patterns.

Messages:
---
${messagesFormatted}
---

Current personality profile:
- Communication style: ${currentPersonality.communicationStyle || 'Not specified'}
- Personality vibe: ${currentPersonality.personalityVibe || 'Not specified'}
- What matters most: ${currentPersonality.mattersMost || 'Not specified'}
- Values: ${currentPersonality.values.join(', ') || 'None yet'}
- Dating patterns: ${currentPersonality.datingPatterns.join(', ') || 'None yet'}

Respond in this exact JSON format:
{
  "communicationStyle": "direct/playful/genuine",
  "personalityVibe": "ambitious/chill/adventurous",
  "mattersMost": "looks/humor/compatibility",
  "values": ["value 1", "value 2"],
  "datingPatterns": ["pattern 1"],
  "redFlagsToAvoid": ["flag 1"]
}

Only include NEW insights that are clearly evident from the messages and not already in his current profile.
Be specific and grounded. Return empty arrays/strings for categories with no new insights.`;

	try {
		// Call Claude
		const response = await askClaude(systemPrompt, extractionPrompt);

		// Parse JSON response
		const jsonMatch = response.match(/\{[\s\S]*\}/);
		if (!jsonMatch) {
			return {};
		}

		const parsed = JSON.parse(jsonMatch[0]);
		const updates: Partial<PersonalityProfile> = {};

		// Update scalar fields if they differ
		if (parsed.communicationStyle && parsed.communicationStyle !== currentPersonality.communicationStyle) {
			updates.communicationStyle = parsed.communicationStyle;
		}

		if (parsed.personalityVibe && parsed.personalityVibe !== currentPersonality.personalityVibe) {
			updates.personalityVibe = parsed.personalityVibe;
		}

		if (parsed.mattersMost && parsed.mattersMost !== currentPersonality.mattersMost) {
			updates.mattersMost = parsed.mattersMost;
		}

		// Deduplicate and add array insights
		if (parsed.values?.length > 0) {
			const deduped = deduplicateInsights(parsed.values, currentPersonality.values);
			if (deduped.length > 0) {
				updates.values = [
					...currentPersonality.values,
					...deduped.slice(0, finalConfig.maxInsightsPerUpdate)
				];
			}
		}

		if (parsed.datingPatterns?.length > 0) {
			const deduped = deduplicateInsights(parsed.datingPatterns, currentPersonality.datingPatterns);
			if (deduped.length > 0) {
				updates.datingPatterns = [
					...currentPersonality.datingPatterns,
					...deduped.slice(0, finalConfig.maxInsightsPerUpdate)
				];
			}
		}

		if (parsed.redFlagsToAvoid?.length > 0) {
			const deduped = deduplicateInsights(parsed.redFlagsToAvoid, currentPersonality.redFlagsToAvoid);
			if (deduped.length > 0) {
				updates.redFlagsToAvoid = [
					...currentPersonality.redFlagsToAvoid,
					...deduped.slice(0, finalConfig.maxInsightsPerUpdate)
				];
			}
		}

		return updates;
	} catch (error) {
		console.error('Failed to extract user personality insights:', error);
		return {};
	}
}

/**
 * Extract insights from match messages (for male users)
 * Analyzes what the match is saying to understand compatibility and dating patterns
 */
export async function extractMatchPersonalityInsights(
	matchMessages: ChatMessage[],
	currentPersonality: PersonalityProfile,
	userProfile: UserProfile | null,
	bookContext: string,
	config: Partial<AutoUpdateConfig> = {}
): Promise<Partial<PersonalityProfile>> {
	const finalConfig = { ...DEFAULT_CONFIG, ...config };

	if (matchMessages.length < finalConfig.minMessagesForUpdate) {
		return {};
	}

	// Build system prompt for analysis
	const systemPrompt = buildAIWingmanSystemPrompt(userProfile, bookContext);

	// Format messages for analysis
	const messagesFormatted = formatRecentMessages(matchMessages);

	// Create extraction prompt
	const extractionPrompt = `Analyze these messages from a match to extract insights about dating patterns, compatibility, and potential red flags.

Match messages:
---
${messagesFormatted}
---

Current personality profile:
- Values: ${currentPersonality.values.join(', ') || 'None yet'}
- Dating patterns: ${currentPersonality.datingPatterns.join(', ') || 'None yet'}
- Red flags to avoid: ${currentPersonality.redFlagsToAvoid.join(', ') || 'None yet'}

Respond in this exact JSON format:
{
  "values": ["value 1"],
  "datingPatterns": ["pattern 1"],
  "redFlagsToAvoid": ["flag 1"]
}

Only include NEW insights that are clearly evident from the match's messages and not already in his current profile.
Focus on what this match is revealing about themselves and how it relates to his values and patterns.
Be specific and grounded. Return empty arrays for categories with no new insights.`;

	try {
		// Call Claude
		const response = await askClaude(systemPrompt, extractionPrompt);

		// Parse JSON response
		const jsonMatch = response.match(/\{[\s\S]*\}/);
		if (!jsonMatch) {
			return {};
		}

		const parsed = JSON.parse(jsonMatch[0]);
		const updates: Partial<PersonalityProfile> = {};

		// Deduplicate and add insights
		if (parsed.values?.length > 0) {
			const deduped = deduplicateInsights(parsed.values, currentPersonality.values);
			if (deduped.length > 0) {
				updates.values = [
					...currentPersonality.values,
					...deduped.slice(0, finalConfig.maxInsightsPerUpdate)
				];
			}
		}

		if (parsed.datingPatterns?.length > 0) {
			const deduped = deduplicateInsights(parsed.datingPatterns, currentPersonality.datingPatterns);
			if (deduped.length > 0) {
				updates.datingPatterns = [
					...currentPersonality.datingPatterns,
					...deduped.slice(0, finalConfig.maxInsightsPerUpdate)
				];
			}
		}

		if (parsed.redFlagsToAvoid?.length > 0) {
			const deduped = deduplicateInsights(parsed.redFlagsToAvoid, currentPersonality.redFlagsToAvoid);
			if (deduped.length > 0) {
				updates.redFlagsToAvoid = [
					...currentPersonality.redFlagsToAvoid,
					...deduped.slice(0, finalConfig.maxInsightsPerUpdate)
				];
			}
		}

		return updates;
	} catch (error) {
		console.error('Failed to extract match personality insights:', error);
		return {};
	}
}

/**
 * Auto-update preferences profile for female user
 * Extracts insights from both user and match messages
 */
export async function autoUpdatePreferencesProfile(
	userId: string,
	userMessages: ChatMessage[],
	matchMessages: ChatMessage[],
	userProfile: UserProfile | null,
	bookContext: string,
	matchName?: string,
	config: Partial<AutoUpdateConfig> = {}
): Promise<boolean> {
	try {
		// Load current preferences
		const currentPreferences = await loadPreferences(userId);

		// Extract insights from both user and match messages
		const userInsights = await extractUserMessageInsights(
			userMessages,
			currentPreferences,
			userProfile,
			bookContext,
			config
		);

		const matchInsights = await extractMatchMessageInsights(
			matchMessages,
			currentPreferences,
			userProfile,
			bookContext,
			config
		);

		// Merge insights
		const mergedUpdates: Partial<PreferencesProfile> = {};

		// Merge arrays
		if (userInsights.emotionalSignals || matchInsights.emotionalSignals) {
			mergedUpdates.emotionalSignals = [
				...(userInsights.emotionalSignals || []),
				...(matchInsights.emotionalSignals || [])
			];
		}

		if (userInsights.lifestyleSignals || matchInsights.lifestyleSignals) {
			mergedUpdates.lifestyleSignals = [
				...(userInsights.lifestyleSignals || []),
				...(matchInsights.lifestyleSignals || [])
			];
		}

		if (userInsights.maturitySignals) {
			mergedUpdates.maturitySignals = userInsights.maturitySignals;
		}

		if (userInsights.boundaries || matchInsights.boundaries) {
			mergedUpdates.boundaries = [
				...(userInsights.boundaries || []),
				...(matchInsights.boundaries || [])
			];
		}

		if (userInsights.dealbreakers || matchInsights.dealbreakers) {
			mergedUpdates.dealbreakers = [
				...(userInsights.dealbreakers || []),
				...(matchInsights.dealbreakers || [])
			];
		}

		if (userInsights.privateCompatibilityNotes || matchInsights.privateCompatibilityNotes) {
			mergedUpdates.privateCompatibilityNotes = [
				...(userInsights.privateCompatibilityNotes || []),
				...(matchInsights.privateCompatibilityNotes || [])
			];
		}

		// Only update if there are changes
		if (Object.keys(mergedUpdates).length === 0) {
			return false;
		}

		// Update profile with reason
		const reason = matchName
			? `Extracted from conversation with ${matchName}`
			: 'Extracted from conversation';

		await updatePreferences(userId, mergedUpdates, reason);
		return true;
	} catch (error) {
		console.error('Failed to auto-update preferences profile:', error);
		return false;
	}
}

/**
 * Auto-update personality profile for male user
 * Extracts insights from both user and match messages
 */
export async function autoUpdatePersonalityProfile(
	userId: string,
	userMessages: ChatMessage[],
	matchMessages: ChatMessage[],
	userProfile: UserProfile | null,
	bookContext: string,
	matchName?: string,
	config: Partial<AutoUpdateConfig> = {}
): Promise<boolean> {
	try {
		// Load current personality
		const currentPersonality = await loadPersonality(userId);

		// Extract insights from both user and match messages
		const userInsights = await extractUserPersonalityInsights(
			userMessages,
			currentPersonality,
			userProfile,
			bookContext,
			config
		);

		const matchInsights = await extractMatchPersonalityInsights(
			matchMessages,
			currentPersonality,
			userProfile,
			bookContext,
			config
		);

		// Merge insights
		const mergedUpdates: Partial<PersonalityProfile> = {};

		// Use user insights for scalar fields (they're more authoritative)
		if (userInsights.communicationStyle) {
			mergedUpdates.communicationStyle = userInsights.communicationStyle;
		}

		if (userInsights.personalityVibe) {
			mergedUpdates.personalityVibe = userInsights.personalityVibe;
		}

		if (userInsights.mattersMost) {
			mergedUpdates.mattersMost = userInsights.mattersMost;
		}

		// Merge arrays
		if (userInsights.values || matchInsights.values) {
			mergedUpdates.values = [
				...(userInsights.values || []),
				...(matchInsights.values || [])
			];
		}

		if (userInsights.datingPatterns || matchInsights.datingPatterns) {
			mergedUpdates.datingPatterns = [
				...(userInsights.datingPatterns || []),
				...(matchInsights.datingPatterns || [])
			];
		}

		if (userInsights.redFlagsToAvoid || matchInsights.redFlagsToAvoid) {
			mergedUpdates.redFlagsToAvoid = [
				...(userInsights.redFlagsToAvoid || []),
				...(matchInsights.redFlagsToAvoid || [])
			];
		}

		// Only update if there are changes
		if (Object.keys(mergedUpdates).length === 0) {
			return false;
		}

		// Update profile with reason
		const reason = matchName
			? `Extracted from conversation with ${matchName}`
			: 'Extracted from conversation';

		await updatePersonality(userId, mergedUpdates, reason);
		return true;
	} catch (error) {
		console.error('Failed to auto-update personality profile:', error);
		return false;
	}
}
