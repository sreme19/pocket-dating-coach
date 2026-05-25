import { getSupabase } from './supabase';
import { getAssistantConfig, getActiveAssistants } from './ai-assistant-manager';
import type { ChatMessage, AssistantType } from '../types';

/**
 * Session state for a specific match conversation
 */
export interface MatchSessionState {
	matchId: string;
	userId: string;
	activeAssistant: AssistantType | null;
	conversationHistory: ChatMessage[];
	lastLoadedAt: number;
	assistantConfig?: {
		exchangeCount: number;
		lastExchangeAt: number | null;
		autoImpersonate: boolean;
	};
}

/**
 * In-memory cache for session states
 */
const sessionStateCache = new Map<string, MatchSessionState>();

/**
 * Load session state for a specific match
 * Retrieves active assistant status and conversation history from Supabase
 */
export async function loadSessionState(
	userId: string,
	matchId: string
): Promise<MatchSessionState> {
	const cacheKey = `${userId}:${matchId}`;

	// Check cache first
	const cached = sessionStateCache.get(cacheKey);
	if (cached && Date.now() - cached.lastLoadedAt < 60000) {
		// Cache valid for 1 minute
		return cached;
	}

	const supabase = getSupabase();

	// Load active assistant for this match
	let activeAssistant: AssistantType | null = null;
	let assistantConfig: MatchSessionState['assistantConfig'] | undefined;

	// Check for active bestie
	const bestieConfig = await getAssistantConfig(userId, matchId, 'bestie');
	if (bestieConfig?.isActive) {
		activeAssistant = 'bestie';
		assistantConfig = {
			exchangeCount: bestieConfig.exchangeCount,
			lastExchangeAt: bestieConfig.lastExchangeAt,
			autoImpersonate: bestieConfig.autoImpersonate
		};
	}

	// Check for active wingman (only if no bestie active)
	if (!activeAssistant) {
		const wingmanConfig = await getAssistantConfig(userId, matchId, 'wingman');
		if (wingmanConfig?.isActive) {
			activeAssistant = 'wingman';
			assistantConfig = {
				exchangeCount: wingmanConfig.exchangeCount,
				lastExchangeAt: wingmanConfig.lastExchangeAt,
				autoImpersonate: wingmanConfig.autoImpersonate
			};
		}
	}

	// Load conversation history from Supabase
	const { data: conversationData, error: conversationError } = await supabase
		.from('ai_assistant_conversations')
		.select('messages')
		.eq('user_id', userId)
		.eq('match_conversation_id', matchId)
		.eq('is_active', true)
		.single();

	if (conversationError && conversationError.code !== 'PGRST116') {
		// PGRST116 means no rows found, which is fine
		console.error('Error loading conversation history:', conversationError);
	}

	const conversationHistory: ChatMessage[] = (conversationData?.messages as ChatMessage[]) || [];

	// Create session state
	const sessionState: MatchSessionState = {
		matchId,
		userId,
		activeAssistant,
		conversationHistory,
		lastLoadedAt: Date.now(),
		assistantConfig
	};

	// Cache the session state
	sessionStateCache.set(cacheKey, sessionState);

	return sessionState;
}

/**
 * Save conversation history to Supabase
 * Updates the messages array for the active assistant conversation
 */
export async function saveConversationHistory(
	userId: string,
	matchId: string,
	assistantType: AssistantType,
	messages: ChatMessage[]
): Promise<void> {
	const supabase = getSupabase();

	// Check if conversation exists
	const { data: existingConversation } = await supabase
		.from('ai_assistant_conversations')
		.select('id')
		.eq('user_id', userId)
		.eq('match_conversation_id', matchId)
		.eq('assistant_type', assistantType)
		.single();

	if (existingConversation) {
		// Update existing conversation
		const { error } = await supabase
			.from('ai_assistant_conversations')
			.update({
				messages: messages,
				updated_at: new Date().toISOString()
			})
			.eq('id', existingConversation.id);

		if (error) {
			throw new Error(`Failed to save conversation history: ${error.message}`);
		}
	} else {
		// Create new conversation
		const { error } = await supabase.from('ai_assistant_conversations').insert({
			user_id: userId,
			match_conversation_id: matchId,
			assistant_type: assistantType,
			messages: messages,
			is_active: true,
			exchange_count: 0,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString()
		});

		if (error) {
			throw new Error(`Failed to create conversation: ${error.message}`);
		}
	}

	// Invalidate cache
	const cacheKey = `${userId}:${matchId}`;
	sessionStateCache.delete(cacheKey);
}

/**
 * Add a message to the conversation history
 * Appends to existing messages and saves to Supabase
 */
export async function addMessageToHistory(
	userId: string,
	matchId: string,
	assistantType: AssistantType,
	message: ChatMessage
): Promise<void> {
	const supabase = getSupabase();

	// Get current conversation
	const { data: conversation, error: fetchError } = await supabase
		.from('ai_assistant_conversations')
		.select('messages')
		.eq('user_id', userId)
		.eq('match_conversation_id', matchId)
		.eq('assistant_type', assistantType)
		.single();

	if (fetchError && fetchError.code !== 'PGRST116') {
		throw new Error(`Failed to fetch conversation: ${fetchError.message}`);
	}

	// Append message to existing messages or create new array
	const currentMessages = (conversation?.messages as ChatMessage[]) || [];
	const updatedMessages = [...currentMessages, message];

	// Save updated messages
	await saveConversationHistory(userId, matchId, assistantType, updatedMessages);
}

/**
 * Switch active assistant for a match
 * Deactivates current assistant and activates new one
 */
export async function switchAssistant(
	userId: string,
	matchId: string,
	newAssistantType: AssistantType
): Promise<void> {
	const supabase = getSupabase();

	// Get current session state
	const sessionState = await loadSessionState(userId, matchId);

	// If there's an active assistant, deactivate it
	if (sessionState.activeAssistant) {
		const { error: deactivateError } = await supabase
			.from('ai_assistant_match_configs')
			.update({
				is_active: false,
				updated_at: new Date().toISOString()
			})
			.eq('user_id', userId)
			.eq('match_id', matchId)
			.eq('assistant_type', sessionState.activeAssistant);

		if (deactivateError) {
			throw new Error(`Failed to deactivate current assistant: ${deactivateError.message}`);
		}
	}

	// Activate new assistant
	const { data: existingConfig } = await supabase
		.from('ai_assistant_match_configs')
		.select('id')
		.eq('user_id', userId)
		.eq('match_id', matchId)
		.eq('assistant_type', newAssistantType)
		.single();

	if (existingConfig) {
		// Update existing config to active
		const { error: activateError } = await supabase
			.from('ai_assistant_match_configs')
			.update({
				is_active: true,
				updated_at: new Date().toISOString()
			})
			.eq('id', existingConfig.id);

		if (activateError) {
			throw new Error(`Failed to activate new assistant: ${activateError.message}`);
		}
	} else {
		// Create new config
		const { error: createError } = await supabase.from('ai_assistant_match_configs').insert({
			user_id: userId,
			match_id: matchId,
			assistant_type: newAssistantType,
			is_active: true,
			auto_impersonate: false,
			exchange_count: 0,
			last_exchange_at: null,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString()
		});

		if (createError) {
			throw new Error(`Failed to create new assistant config: ${createError.message}`);
		}
	}

	// Invalidate cache
	const cacheKey = `${userId}:${matchId}`;
	sessionStateCache.delete(cacheKey);
}

/**
 * Get all active sessions for a user
 * Returns list of matches with active assistants
 */
export async function getActiveSessionsForUser(userId: string): Promise<MatchSessionState[]> {
	const activeConfigs = await getActiveAssistants(userId);

	const sessions: MatchSessionState[] = [];

	for (const config of activeConfigs) {
		const sessionState = await loadSessionState(userId, config.matchId);
		sessions.push(sessionState);
	}

	return sessions;
}

/**
 * Clear session state for a specific match
 * Removes from cache and marks as inactive in database
 */
export async function clearSessionState(
	userId: string,
	matchId: string,
	assistantType: AssistantType
): Promise<void> {
	const supabase = getSupabase();

	// Mark conversation as inactive
	const { error } = await supabase
		.from('ai_assistant_conversations')
		.update({
			is_active: false,
			updated_at: new Date().toISOString()
		})
		.eq('user_id', userId)
		.eq('match_conversation_id', matchId)
		.eq('assistant_type', assistantType);

	if (error && error.code !== 'PGRST116') {
		console.error('Error clearing session state:', error);
	}

	// Invalidate cache
	const cacheKey = `${userId}:${matchId}`;
	sessionStateCache.delete(cacheKey);
}

/**
 * Clear all session state cache
 * Useful for testing or logout
 */
export function clearAllSessionCache(): void {
	sessionStateCache.clear();
}

/**
 * Clear session cache for a specific user
 */
export function clearUserSessionCache(userId: string): void {
	const keysToDelete: string[] = [];

	for (const [key] of sessionStateCache) {
		if (key.startsWith(`${userId}:`)) {
			keysToDelete.push(key);
		}
	}

	keysToDelete.forEach((key) => sessionStateCache.delete(key));
}

/**
 * Get cached session state without loading from database
 * Returns undefined if not in cache
 */
export function getCachedSessionState(userId: string, matchId: string): MatchSessionState | undefined {
	const cacheKey = `${userId}:${matchId}`;
	return sessionStateCache.get(cacheKey);
}

/**
 * Persist session state to localStorage for client-side access
 * Allows session to survive page refreshes
 */
export function persistSessionStateToLocalStorage(sessionState: MatchSessionState): void {
	try {
		const key = `pdc_session_${sessionState.userId}_${sessionState.matchId}`;
		localStorage.setItem(key, JSON.stringify(sessionState));
	} catch (err) {
		console.error('Failed to persist session state to localStorage:', err);
	}
}

/**
 * Load session state from localStorage
 * Returns undefined if not found or invalid
 */
export function loadSessionStateFromLocalStorage(
	userId: string,
	matchId: string
): MatchSessionState | undefined {
	try {
		const key = `pdc_session_${userId}_${matchId}`;
		const stored = localStorage.getItem(key);
		if (!stored) return undefined;

		const parsed = JSON.parse(stored) as MatchSessionState;

		// Validate the structure
		if (
			parsed.matchId === matchId &&
			parsed.userId === userId &&
			Array.isArray(parsed.conversationHistory)
		) {
			return parsed;
		}

		return undefined;
	} catch (err) {
		console.error('Failed to load session state from localStorage:', err);
		return undefined;
	}
}

/**
 * Clear session state from localStorage
 */
export function clearSessionStateFromLocalStorage(userId: string, matchId: string): void {
	try {
		const key = `pdc_session_${userId}_${matchId}`;
		localStorage.removeItem(key);
	} catch (err) {
		console.error('Failed to clear session state from localStorage:', err);
	}
}

/**
 * Sync session state between server and client
 * Ensures consistency across page refreshes
 */
export async function syncSessionState(
	userId: string,
	matchId: string
): Promise<MatchSessionState> {
	// Load from server
	const serverState = await loadSessionState(userId, matchId);

	// Persist to localStorage for client-side access
	persistSessionStateToLocalStorage(serverState);

	return serverState;
}
