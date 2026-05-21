import { askClaude } from '../claude';
import {
	buildAIBestieSystemPrompt,
	buildAIWingmanSystemPrompt,
	buildAIAssistantContextPrompt
} from '../prompts';
import type { UserProfile, ChatMessage, ReplyOption } from '../types';
import type { PreferencesProfile, PersonalityProfile } from './profile-service';
import { loadPreferences, loadPersonality, updatePreferences, updatePersonality } from './profile-service';

/**
 * Match context information for AI assistant
 */
export interface MatchContext {
	matchedUserProfile?: Partial<UserProfile>;
	recentMessages: ChatMessage[];
	conversationDuration?: number;
	messageCount?: number;
}

/**
 * AI Assistant response with citations
 */
export interface AIAssistantResponse {
	reply: string;
	citations: string[];
	suggestions?: string[];
}

/**
 * Compatibility analysis with flags
 */
export interface CompatibilityAnalysis {
	greenFlags: Array<{ signal: string; reason: string }>;
	yellowFlags: Array<{ signal: string; reason: string }>;
	redFlags: Array<{ signal: string; reason: string }>;
	overallAssessment: string;
	citations: string[];
}

/**
 * Response option for user to choose from
 */
export interface ResponseOption extends ReplyOption {
	id?: string;
}

/**
 * Extract citations from Claude response text
 * Looks for patterns like "*Based on: [text]*"
 */
function extractCitations(text: string): string[] {
	const citationPattern = /\*Based on:\s*([^*]+)\*/g;
	const citations: string[] = [];
	let match;

	while ((match = citationPattern.exec(text)) !== null) {
		const citation = match[1].trim();
		if (citation && !citations.includes(citation)) {
			citations.push(citation);
		}
	}

	return citations;
}

/**
 * Format recent messages for context
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
 * Format matched user info for context
 */
function formatMatchedUserInfo(matchedUserProfile?: Partial<UserProfile>): string {
	if (!matchedUserProfile) {
		return 'No matched user profile information available.';
	}

	const parts: string[] = [];
	if (matchedUserProfile.gender) parts.push(`Gender: ${matchedUserProfile.gender}`);
	if (matchedUserProfile.ageRange) parts.push(`Age range: ${matchedUserProfile.ageRange}`);
	if (matchedUserProfile.datingApp) parts.push(`Dating app: ${matchedUserProfile.datingApp}`);
	if (matchedUserProfile.relationshipGoal)
		parts.push(`Relationship goal: ${matchedUserProfile.relationshipGoal}`);

	return parts.length > 0 ? parts.join('\n') : 'Limited matched user profile information.';
}

/**
 * Generate a response from AI Bestie or AI Wingman
 * Calls Claude with system prompt and conversation context
 */
export async function generateResponse(
	assistantType: 'bestie' | 'wingman',
	userMessage: string,
	conversationHistory: ChatMessage[],
	userProfile: UserProfile | null,
	matchContext: MatchContext,
	bookContext: string,
	userProfileData?: PreferencesProfile | PersonalityProfile
): Promise<AIAssistantResponse> {
	// Build system prompt based on assistant type
	const systemPrompt =
		assistantType === 'bestie'
			? buildAIBestieSystemPrompt(userProfile, bookContext, matchContext.matchedUserProfile, userProfileData as PreferencesProfile)
			: buildAIWingmanSystemPrompt(userProfile, bookContext, matchContext.matchedUserProfile, userProfileData as PersonalityProfile);

	// Format context for the message
	const recentMessagesFormatted = formatRecentMessages(matchContext.recentMessages);
	const matchedUserInfoFormatted = formatMatchedUserInfo(matchContext.matchedUserProfile);

	const contextPrompt = buildAIAssistantContextPrompt(
		assistantType,
		recentMessagesFormatted,
		matchedUserInfoFormatted
	);

	// Combine user message with context
	const fullUserMessage = `${contextPrompt}\n\nUser message: "${userMessage}"`;

	// Call Claude
	const reply = await askClaude(systemPrompt, fullUserMessage);

	// Extract citations from response
	const citations = extractCitations(reply);

	return {
		reply,
		citations
	};
}

/**
 * Generate 2-3 response options for the user to choose from
 * Returns options with tone, message, reasoning, and citations
 */
export async function generateResponseOptions(
	assistantType: 'bestie' | 'wingman',
	matchLastMessage: string,
	conversationHistory: ChatMessage[],
	userProfile: UserProfile | null,
	matchContext: MatchContext,
	bookContext: string,
	userProfileData?: PreferencesProfile | PersonalityProfile
): Promise<ResponseOption[]> {
	// Build system prompt
	const systemPrompt =
		assistantType === 'bestie'
			? buildAIBestieSystemPrompt(userProfile, bookContext, matchContext.matchedUserProfile, userProfileData as PreferencesProfile)
			: buildAIWingmanSystemPrompt(userProfile, bookContext, matchContext.matchedUserProfile, userProfileData as PersonalityProfile);

	// Format conversation history
	const conversationFormatted = formatRecentMessages(conversationHistory);

	// Create prompt for generating options
	const optionsPrompt = `Based on this conversation:
---
${conversationFormatted}
---

Their latest message: "${matchLastMessage}"

Generate exactly 3 response options in this JSON format:
[
  {
    "tone": "playful",
    "message": "...",
    "why": "Why this works in one sentence.",
    "citation": "Based on: [book principle or preference]"
  },
  {
    "tone": "warm",
    "message": "...",
    "why": "Why this works in one sentence.",
    "citation": "Based on: [book principle or preference]"
  },
  {
    "tone": "direct",
    "message": "...",
    "why": "Why this works in one sentence.",
    "citation": "Based on: [book principle or preference]"
  }
]

Each reply should feel natural and human. No cringe. No pickup-artist lines.`;

	// Call Claude
	const response = await askClaude(systemPrompt, optionsPrompt);

	// Parse JSON response
	let options: ResponseOption[] = [];
	try {
		// Extract JSON array from response
		const jsonMatch = response.match(/\[[\s\S]*\]/);
		if (jsonMatch) {
			const parsed = JSON.parse(jsonMatch[0]);
			options = parsed.map((opt: any, index: number) => ({
				id: `option-${index}`,
				tone: opt.tone as 'playful' | 'warm' | 'direct',
				message: opt.message,
				why: opt.why,
				citation: opt.citation
			}));
		}
	} catch (error) {
		console.error('Failed to parse response options:', error);
		// Return empty array if parsing fails
		options = [];
	}

	return options;
}

/**
 * Analyze a match's message for compatibility flags
 * Returns green/yellow/red flags with reasoning
 */
export async function analyzeMatchCompatibility(
	assistantType: 'bestie',
	matchMessage: string,
	userPreferences: PreferencesProfile,
	matchContext: MatchContext,
	userProfile: UserProfile | null,
	bookContext: string
): Promise<CompatibilityAnalysis> {
	// Build system prompt for AI Bestie
	const systemPrompt = buildAIBestieSystemPrompt(userProfile, bookContext, matchContext.matchedUserProfile, userPreferences);

	// Create analysis prompt
	const analysisPrompt = `Analyze this message from a match for compatibility signals:

"${matchMessage}"

User's preferences:
- Emotional signals valued: ${userPreferences.emotionalSignals.join(', ') || 'Not specified'}
- Lifestyle signals: ${userPreferences.lifestyleSignals.join(', ') || 'Not specified'}
- Boundaries: ${userPreferences.boundaries.join(', ') || 'Not specified'}
- Dealbreakers: ${userPreferences.dealbreakers.join(', ') || 'Not specified'}

Respond in this exact JSON format:
{
  "greenFlags": [
    { "signal": "...", "reason": "..." },
    { "signal": "...", "reason": "..." }
  ],
  "yellowFlags": [
    { "signal": "...", "reason": "..." }
  ],
  "redFlags": [
    { "signal": "...", "reason": "..." }
  ],
  "overallAssessment": "One paragraph assessment of compatibility.",
  "citations": ["Based on: [preference or book principle]"]
}

Be specific and grounded in the user's actual preferences.`;

	// Call Claude
	const response = await askClaude(systemPrompt, analysisPrompt);

	// Parse JSON response
	let analysis: CompatibilityAnalysis = {
		greenFlags: [],
		yellowFlags: [],
		redFlags: [],
		overallAssessment: 'Unable to analyze compatibility at this time.',
		citations: []
	};

	try {
		// Extract JSON object from response
		const jsonMatch = response.match(/\{[\s\S]*\}/);
		if (jsonMatch) {
			const parsed = JSON.parse(jsonMatch[0]);
			analysis = {
				greenFlags: parsed.greenFlags || [],
				yellowFlags: parsed.yellowFlags || [],
				redFlags: parsed.redFlags || [],
				overallAssessment: parsed.overallAssessment || '',
				citations: parsed.citations || []
			};
		}
	} catch (error) {
		console.error('Failed to parse compatibility analysis:', error);
	}

	return analysis;
}

/**
 * Auto-update user profile based on conversation insights
 * Extracts insights from conversation and updates preferences/personality
 */
export async function autoUpdateProfile(
	assistantType: 'bestie' | 'wingman',
	conversationHistory: ChatMessage[],
	userProfile: UserProfile | null,
	userId: string,
	bookContext: string
): Promise<void> {
	if (conversationHistory.length === 0) {
		return;
	}

	// Build system prompt
	const systemPrompt =
		assistantType === 'bestie'
			? buildAIBestieSystemPrompt(userProfile, bookContext)
			: buildAIWingmanSystemPrompt(userProfile, bookContext);

	// Format conversation for analysis
	const conversationFormatted = formatRecentMessages(conversationHistory);

	// Create extraction prompt
	const extractionPrompt =
		assistantType === 'bestie'
			? `Analyze this conversation and extract insights about the user's dating preferences and compatibility signals.

Conversation:
---
${conversationFormatted}
---

Respond in this exact JSON format:
{
  "emotionalSignals": ["signal 1", "signal 2"],
  "lifestyleSignals": ["signal 1", "signal 2"],
  "maturitySignals": ["signal 1"],
  "boundaries": ["boundary 1"],
  "dealbreakers": ["dealbreaker 1"],
  "privateCompatibilityNotes": ["note 1", "note 2"]
}

Only include insights that are clearly evident from the conversation. Be specific and grounded.`
			: `Analyze this conversation and extract insights about the user's personality, values, and dating patterns.

Conversation:
---
${conversationFormatted}
---

Respond in this exact JSON format:
{
  "communicationStyle": "direct/playful/genuine",
  "personalityVibe": "ambitious/chill/adventurous",
  "mattersMost": "humor/looks/compatibility",
  "values": ["value 1", "value 2"],
  "datingPatterns": ["pattern 1", "pattern 2"],
  "redFlagsToAvoid": ["flag 1"]
}

Only include insights that are clearly evident from the conversation. Be specific and grounded.`;

	// Call Claude
	const response = await askClaude(systemPrompt, extractionPrompt);

	// Parse JSON response
	try {
		// Extract JSON object from response
		const jsonMatch = response.match(/\{[\s\S]*\}/);
		if (jsonMatch) {
			const parsed = JSON.parse(jsonMatch[0]);

			// Update profile based on assistant type
			if (assistantType === 'bestie') {
				const updates: Partial<PreferencesProfile> = {};

				// Only add fields that have content
				if (parsed.emotionalSignals?.length > 0) updates.emotionalSignals = parsed.emotionalSignals;
				if (parsed.lifestyleSignals?.length > 0) updates.lifestyleSignals = parsed.lifestyleSignals;
				if (parsed.maturitySignals?.length > 0) updates.maturitySignals = parsed.maturitySignals;
				if (parsed.boundaries?.length > 0) updates.boundaries = parsed.boundaries;
				if (parsed.dealbreakers?.length > 0) updates.dealbreakers = parsed.dealbreakers;
				if (parsed.privateCompatibilityNotes?.length > 0)
					updates.privateCompatibilityNotes = parsed.privateCompatibilityNotes;

				if (Object.keys(updates).length > 0) {
					await updatePreferences(userId, updates, 'Extracted from conversation');
				}
			} else {
				const updates: Partial<PersonalityProfile> = {};

				// Only add fields that have content
				if (parsed.communicationStyle) updates.communicationStyle = parsed.communicationStyle;
				if (parsed.personalityVibe) updates.personalityVibe = parsed.personalityVibe;
				if (parsed.mattersMost) updates.mattersMost = parsed.mattersMost;
				if (parsed.values?.length > 0) updates.values = parsed.values;
				if (parsed.datingPatterns?.length > 0) updates.datingPatterns = parsed.datingPatterns;
				if (parsed.redFlagsToAvoid?.length > 0) updates.redFlagsToAvoid = parsed.redFlagsToAvoid;

				if (Object.keys(updates).length > 0) {
					await updatePersonality(userId, updates, 'Extracted from conversation');
				}
			}
		}
	} catch (error) {
		console.error('Failed to extract and update profile:', error);
		// Silently fail - don't break the conversation if auto-update fails
	}
}

/**
 * Extract citations from a response text
 * Public function for external use
 */
export function extractCitationsFromResponse(text: string): string[] {
	return extractCitations(text);
}
