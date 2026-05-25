import { getSupabase } from './supabase';
import { getClaudeClient, CLAUDE_MODEL, MAX_TOKENS } from '../claude';
import { searchBookChunks } from '../vectorstore';
import { getEmbedding } from '../embeddings';
import { buildAIBestieSystemPrompt, buildAIWingmanSystemPrompt } from '../prompts';
import type { UserProfile, ChatMessage } from '../types';
import { loadPreferences, loadPersonality } from './profile-service';
import type { PreferencesProfile, PersonalityProfile } from './profile-service';

/**
 * Match summary with key insights and compatibility signals
 */
export interface MatchSummary {
	matchId: string;
	matchName?: string;
	matchProfile?: Partial<UserProfile>;
	keyInsights: string[];
	greenFlags: string[];
	yellowFlags: string[];
	redFlags: string[];
	recommendedNextMove: string;
	conversationMomentum: 'heating_up' | 'steady' | 'cooling_down';
	lastMessageTime: number;
	messageCount: number;
}

/**
 * Hourly summary data stored in Supabase
 */
export interface HourlySummaryData {
	userId: string;
	summaries: MatchSummary[];
	generatedAt: number;
	totalMatches: number;
	assistantType: 'bestie' | 'wingman';
}

/**
 * Configuration for summary generation
 */
export interface SummaryGenerationConfig {
	minMessagesForSummary: number;
	maxRecentMessages: number;
	maxInsightsPerCategory: number;
	bookContextChunks: number;
	includeYellowFlags: boolean;
	includeRedFlags: boolean;
}

const DEFAULT_CONFIG: SummaryGenerationConfig = {
	minMessagesForSummary: 2,
	maxRecentMessages: 10,
	maxInsightsPerCategory: 3,
	bookContextChunks: 5,
	includeYellowFlags: true,
	includeRedFlags: true
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
			const role = msg.role === 'user' ? 'You' : 'Match';
			return `${role}: ${msg.content}`;
		})
		.join('\n');
}

/**
 * Analyze conversation momentum based on message patterns
 */
function analyzeConversationMomentum(messages: ChatMessage[]): 'heating_up' | 'steady' | 'cooling_down' {
	if (messages.length < 3) {
		return 'steady';
	}

	// Get recent messages (last 5)
	const recentMessages = messages.slice(-5);

	// Count message lengths to detect engagement level
	const avgLength = recentMessages.reduce((sum, msg) => sum + msg.content.length, 0) / recentMessages.length;

	// Count questions to detect interest
	const questionCount = recentMessages.filter(msg => msg.content.includes('?')).length;

	// Count exclamation marks to detect enthusiasm
	const exclamationCount = recentMessages.filter(msg => msg.content.includes('!')).length;

	// Simple heuristic: if recent messages are longer and have more questions/exclamations, momentum is heating up
	if (avgLength > 150 && questionCount >= 2) {
		return 'heating_up';
	}

	// If messages are getting shorter or fewer questions, cooling down
	if (avgLength < 50 || questionCount === 0) {
		return 'cooling_down';
	}

	return 'steady';
}

/**
 * Generate a summary for a single conversation
 */
async function generateConversationSummary(
	conversation: any,
	systemPrompt: string,
	config: SummaryGenerationConfig
): Promise<MatchSummary | null> {
	try {
		const messages: ChatMessage[] = conversation.messages || [];

		// Skip if not enough messages
		if (messages.length < config.minMessagesForSummary) {
			return null;
		}

		// Get the last message timestamp
		const lastMessage = messages[messages.length - 1];
		const lastMessageTime = lastMessage.timestamp || Date.now();

		// Extract match name from conversation ID or use generic name
		const matchId = conversation.match_conversation_id || conversation.id;
		const matchName = `Match ${matchId.substring(0, 8)}`;

		// Format recent messages for analysis
		const recentMessages = messages.slice(-config.maxRecentMessages);
		const messagesText = formatMessagesForAnalysis(recentMessages);

		// Analyze conversation momentum
		const conversationMomentum = analyzeConversationMomentum(messages);

		// Create summary generation prompt
		const summaryPrompt = `Analyze this conversation and provide a brief summary with key insights and compatibility signals.

Conversation (last ${config.maxRecentMessages} messages):
---
${messagesText}
---

Respond in this exact JSON format:
{
  "keyInsights": ["insight 1", "insight 2", "insight 3"],
  "greenFlags": ["flag 1", "flag 2"],
  "yellowFlags": ["flag 1"],
  "redFlags": [],
  "recommendedNextMove": "One sentence recommendation for next action",
  "conversationMomentum": "heating_up|steady|cooling_down"
}

Be concise and specific. Key insights should be 2-3 sentences max each.
${!config.includeYellowFlags ? 'Do not include yellow flags.' : ''}
${!config.includeRedFlags ? 'Do not include red flags.' : ''}`;

		// Call Claude API
		const client = getClaudeClient();
		const response = await client.messages.create({
			model: CLAUDE_MODEL,
			max_tokens: MAX_TOKENS,
			system: systemPrompt,
			messages: [
				{
					role: 'user',
					content: summaryPrompt
				}
			]
		});

		// Validate response
		if (!response.content || response.content.length === 0) {
			console.error('Empty response from Claude API');
			return null;
		}

		const block = response.content[0];
		if (block.type !== 'text') {
			console.error('Unexpected response type from Claude API:', block.type);
			return null;
		}

		const fullText = block.text;

		// Validate response text
		if (!fullText || typeof fullText !== 'string') {
			console.error('Empty response text from Claude API');
			return null;
		}

		// Parse JSON response
		let summaryData = {
			keyInsights: [],
			greenFlags: [],
			yellowFlags: [],
			redFlags: [],
			recommendedNextMove: 'Continue the conversation',
			conversationMomentum: conversationMomentum as 'heating_up' | 'steady' | 'cooling_down'
		};

		try {
			// Extract JSON object from response
			const jsonMatch = fullText.match(/\{[\s\S]*\}/);
			if (jsonMatch) {
				const parsed = JSON.parse(jsonMatch[0]);
				summaryData = {
					keyInsights: (parsed.keyInsights || []).slice(0, config.maxInsightsPerCategory),
					greenFlags: (parsed.greenFlags || []).slice(0, config.maxInsightsPerCategory),
					yellowFlags: config.includeYellowFlags
						? (parsed.yellowFlags || []).slice(0, config.maxInsightsPerCategory)
						: [],
					redFlags: config.includeRedFlags
						? (parsed.redFlags || []).slice(0, config.maxInsightsPerCategory)
						: [],
					recommendedNextMove: parsed.recommendedNextMove || 'Continue the conversation',
					conversationMomentum: parsed.conversationMomentum || conversationMomentum
				};
			}
		} catch (err) {
			console.error('Failed to parse summary JSON:', err);
			// Use default values if parsing fails
		}

		// Create match summary
		const matchSummary: MatchSummary = {
			matchId,
			matchName,
			keyInsights: summaryData.keyInsights,
			greenFlags: summaryData.greenFlags,
			yellowFlags: summaryData.yellowFlags,
			redFlags: summaryData.redFlags,
			recommendedNextMove: summaryData.recommendedNextMove,
			conversationMomentum: summaryData.conversationMomentum,
			lastMessageTime,
			messageCount: messages.length
		};

		return matchSummary;
	} catch (err) {
		console.error('Failed to generate conversation summary:', err);
		return null;
	}
}

/**
 * Generate hourly summaries for all active conversations of a user
 * This is the main function called by the scheduled job
 */
export async function generateHourlySummaries(
	userId: string,
	assistantType: 'bestie' | 'wingman' = 'bestie',
	config: Partial<SummaryGenerationConfig> = {}
): Promise<HourlySummaryData> {
	const finalConfig = { ...DEFAULT_CONFIG, ...config };

	try {
		// Load user's profile
		let userProfile: UserProfile | null = null;
		let profileData: PreferencesProfile | PersonalityProfile | null = null;

		try {
			if (assistantType === 'bestie') {
				profileData = await loadPreferences(userId);
			} else {
				profileData = await loadPersonality(userId);
			}

			userProfile = {
				gender: assistantType === 'bestie' ? 'woman' : 'man',
				ageRange: 'unknown',
				datingApp: 'other',
				relationshipGoal: 'not_sure'
			};
		} catch (err) {
			console.error(`Failed to load ${assistantType} profile for user ${userId}:`, err);
			// Continue without profile data - graceful fallback
		}

		// Search for relevant book chunks for context
		let bookContext = '';
		try {
			const queryEmbedding = await getEmbedding('dating advice compatibility signals');
			if (queryEmbedding) {
				const chunks = await searchBookChunks(queryEmbedding, finalConfig.bookContextChunks);
				bookContext = chunks.map(c => `[${c.chapter}]\n${c.content}`).join('\n\n---\n\n');
			}
		} catch (err) {
			console.error('Failed to search book chunks:', err);
			// Continue without book context - graceful fallback
			bookContext = 'No book context available.';
		}

		// Build system prompt for the assistant
		const systemPrompt =
			assistantType === 'bestie'
				? buildAIBestieSystemPrompt(userProfile, bookContext || 'No book context available.', undefined, profileData as PreferencesProfile)
				: buildAIWingmanSystemPrompt(userProfile, bookContext || 'No book context available.', undefined, profileData as PersonalityProfile);

		// Fetch all active conversations for the user
		const supabase = getSupabase();
		const { data: conversations, error: fetchError } = await supabase
			.from('ai_assistant_conversations')
			.select('*')
			.eq('user_id', userId)
			.eq('assistant_type', assistantType)
			.eq('is_active', true)
			.order('updated_at', { ascending: false });

		if (fetchError) {
			console.error('Failed to fetch conversations:', fetchError);
			throw new Error(`Failed to fetch conversations: ${fetchError.message}`);
		}

		// If no conversations, return empty summaries
		if (!conversations || conversations.length === 0) {
			return {
				userId,
				summaries: [],
				generatedAt: Date.now(),
				totalMatches: 0,
				assistantType
			};
		}

		// Generate summaries for each conversation
		const summaries: MatchSummary[] = [];

		for (const conversation of conversations) {
			try {
				const summary = await generateConversationSummary(conversation, systemPrompt, finalConfig);
				if (summary) {
					summaries.push(summary);
				}
			} catch (err) {
				console.error(`Failed to generate summary for conversation ${conversation.id}:`, err);
				// Continue with next conversation if this one fails
				continue;
			}
		}

		// Sort summaries by last message time (most recent first)
		summaries.sort((a, b) => b.lastMessageTime - a.lastMessageTime);

		// Store summaries in Supabase
		const summaryData: HourlySummaryData = {
			userId,
			summaries,
			generatedAt: Date.now(),
			totalMatches: summaries.length,
			assistantType
		};

		try {
			const { error: insertError } = await supabase.from('ai_assistant_summaries').insert({
				user_id: userId,
				summary_data: summaryData as unknown as Record<string, unknown>,
				created_at: new Date().toISOString()
			});

			if (insertError) {
				console.error('Failed to store summaries in Supabase:', insertError);
				// Don't throw - return the data even if storage fails
			}
		} catch (err) {
			console.error('Failed to store summaries:', err);
			// Don't throw - return the data even if storage fails
		}

		return summaryData;
	} catch (err) {
		console.error(`Failed to generate hourly summaries for user ${userId}:`, err);
		// Return empty summaries on error
		return {
			userId,
			summaries: [],
			generatedAt: Date.now(),
			totalMatches: 0,
			assistantType
		};
	}
}

/**
 * Generate summaries for all users with active conversations
 * This is called by the scheduled job to process all users
 */
export async function generateAllHourlySummaries(
	config: Partial<SummaryGenerationConfig> = {}
): Promise<{ processed: number; failed: number; errors: Array<{ userId: string; error: string }> }> {
	const supabase = getSupabase();
	const errors: Array<{ userId: string; error: string }> = [];
	let processed = 0;
	let failed = 0;

	try {
		// Get all unique user IDs with active conversations
		const { data: conversations, error: fetchError } = await supabase
			.from('ai_assistant_conversations')
			.select('user_id, assistant_type')
			.eq('is_active', true);

		if (fetchError) {
			console.error('Failed to fetch active conversations:', fetchError);
			throw new Error(`Failed to fetch active conversations: ${fetchError.message}`);
		}

		if (!conversations || conversations.length === 0) {
			console.log('No active conversations found');
			return { processed: 0, failed: 0, errors: [] };
		}

		// Get unique user IDs
		const userIds = Array.from(new Set(conversations.map(c => c.user_id)));

		// Process each user
		for (const userId of userIds) {
			try {
				// Get assistant types for this user
				const userConversations = conversations.filter(c => c.user_id === userId);
				const assistantTypes = Array.from(new Set(userConversations.map(c => c.assistant_type)));

				// Generate summaries for each assistant type
				for (const assistantType of assistantTypes) {
					try {
						await generateHourlySummaries(userId, assistantType as 'bestie' | 'wingman', config);
						processed++;
					} catch (err) {
						const errorMsg = err instanceof Error ? err.message : String(err);
						console.error(`Failed to generate summaries for user ${userId} (${assistantType}):`, err);
						errors.push({ userId, error: `${assistantType}: ${errorMsg}` });
						failed++;
					}
				}
			} catch (err) {
				const errorMsg = err instanceof Error ? err.message : String(err);
				console.error(`Failed to process user ${userId}:`, err);
				errors.push({ userId, error: errorMsg });
				failed++;
			}
		}

		console.log(`Hourly summary generation completed: ${processed} processed, ${failed} failed`);
		return { processed, failed, errors };
	} catch (err) {
		console.error('Failed to generate all hourly summaries:', err);
		throw err;
	}
}

/**
 * Get the most recent summary for a user
 */
export async function getLatestSummary(
	userId: string,
	assistantType: 'bestie' | 'wingman' = 'bestie'
): Promise<HourlySummaryData | null> {
	const supabase = getSupabase();

	try {
		const { data, error } = await supabase
			.from('ai_assistant_summaries')
			.select('summary_data')
			.eq('user_id', userId)
			.order('created_at', { ascending: false })
			.limit(1)
			.single();

		if (error) {
			if (error.code === 'PGRST116') {
				// No rows found
				return null;
			}
			console.error('Failed to fetch latest summary:', error);
			return null;
		}

		const summaryData = data?.summary_data as unknown as HourlySummaryData;

		// Filter by assistant type if needed
		if (summaryData && summaryData.assistantType === assistantType) {
			return summaryData;
		}

		return null;
	} catch (err) {
		console.error('Failed to get latest summary:', err);
		return null;
	}
}

/**
 * Get summary history for a user (last N summaries)
 */
export async function getSummaryHistory(
	userId: string,
	assistantType: 'bestie' | 'wingman' = 'bestie',
	limit: number = 24 // Last 24 hours of hourly summaries
): Promise<HourlySummaryData[]> {
	const supabase = getSupabase();

	try {
		const { data, error } = await supabase
			.from('ai_assistant_summaries')
			.select('summary_data')
			.eq('user_id', userId)
			.order('created_at', { ascending: false })
			.limit(limit);

		if (error) {
			console.error('Failed to fetch summary history:', error);
			return [];
		}

		if (!data) {
			return [];
		}

		// Filter by assistant type and extract summary data
		return data
			.map(row => row.summary_data as unknown as HourlySummaryData)
			.filter(summary => summary.assistantType === assistantType);
	} catch (err) {
		console.error('Failed to get summary history:', err);
		return [];
	}
}

/**
 * Delete old summaries (older than specified days)
 */
export async function deleteOldSummaries(daysOld: number = 30): Promise<{ deleted: number; error?: string }> {
	const supabase = getSupabase();

	try {
		const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000).toISOString();

		const { count, error } = await supabase
			.from('ai_assistant_summaries')
			.delete()
			.lt('created_at', cutoffDate);

		if (error) {
			console.error('Failed to delete old summaries:', error);
			return { deleted: 0, error: error.message };
		}

		console.log(`Deleted ${count} old summaries`);
		return { deleted: count || 0 };
	} catch (err) {
		const errorMsg = err instanceof Error ? err.message : String(err);
		console.error('Failed to delete old summaries:', err);
		return { deleted: 0, error: errorMsg };
	}
}
