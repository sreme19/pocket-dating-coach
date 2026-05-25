import { getSupabase } from './supabase';
import { loadPreferences, loadPersonality, clearCache } from './profile-service';
import type { UserProfile } from '../types';

/**
 * AI Assistant configuration stored in Supabase
 */
export interface AIAssistantConfig {
	id: string;
	userId: string;
	matchId: string;
	assistantType: 'bestie' | 'wingman';
	isActive: boolean;
	autoImpersonate: boolean; // For Wingman: auto-send after 20+ messages
	exchangeCount: number; // For loop prevention
	lastExchangeAt: number | null;
	createdAt: number;
	updatedAt: number;
}

/**
 * Session state for an active AI assistant
 */
export interface AIAssistantSession {
	matchId: string;
	assistantType: 'bestie' | 'wingman';
	userProfile: UserProfile | null;
	matchedUserProfile?: Partial<UserProfile>;
	isActive: boolean;
	activatedAt: number;
}

/**
 * In-memory cache for active sessions
 */
const sessionCache = new Map<string, AIAssistantSession>();

/**
 * Activate an AI assistant for a specific match
 * Initializes session, loads context, and stores configuration
 */
export async function activateAssistant(
	userId: string,
	matchId: string,
	assistantType: 'bestie' | 'wingman',
	userProfile: UserProfile | null,
	matchedUserProfile?: Partial<UserProfile>
): Promise<void> {
	const supabase = getSupabase();

	// Check if configuration already exists
	const { data: existingConfig } = await supabase
		.from('ai_assistant_match_configs')
		.select('id')
		.eq('user_id', userId)
		.eq('match_id', matchId)
		.eq('assistant_type', assistantType)
		.single();

	const now = Date.now();

	if (existingConfig) {
		// Update existing configuration to active
		const { error } = await supabase
			.from('ai_assistant_match_configs')
			.update({
				is_active: true,
				updated_at: new Date(now).toISOString()
			})
			.eq('id', existingConfig.id);

		if (error) {
			throw new Error(`Failed to activate assistant: ${error.message}`);
		}
	} else {
		// Create new configuration
		const { error } = await supabase.from('ai_assistant_match_configs').insert({
			user_id: userId,
			match_id: matchId,
			assistant_type: assistantType,
			is_active: true,
			auto_impersonate: false,
			exchange_count: 0,
			last_exchange_at: null,
			created_at: new Date(now).toISOString(),
			updated_at: new Date(now).toISOString()
		});

		if (error) {
			throw new Error(`Failed to create assistant config: ${error.message}`);
		}
	}

	// Load profile data to validate it exists
	if (assistantType === 'bestie') {
		await loadPreferences(userId);
	} else {
		await loadPersonality(userId);
	}

	// Create session in memory
	const sessionKey = `${userId}:${matchId}:${assistantType}`;
	const session: AIAssistantSession = {
		matchId,
		assistantType,
		userProfile,
		matchedUserProfile,
		isActive: true,
		activatedAt: now
	};

	sessionCache.set(sessionKey, session);
}

/**
 * Deactivate an AI assistant for a specific match
 * Clears session state and cached data
 */
export async function deactivateAssistant(
	userId: string,
	matchId: string,
	assistantType: 'bestie' | 'wingman'
): Promise<void> {
	const supabase = getSupabase();

	// Update configuration to inactive
	const { error } = await supabase
		.from('ai_assistant_match_configs')
		.update({
			is_active: false,
			updated_at: new Date().toISOString()
		})
		.eq('user_id', userId)
		.eq('match_id', matchId)
		.eq('assistant_type', assistantType);

	if (error) {
		throw new Error(`Failed to deactivate assistant: ${error.message}`);
	}

	// Clear session from memory
	const sessionKey = `${userId}:${matchId}:${assistantType}`;
	sessionCache.delete(sessionKey);

	// Clear profile cache for this user
	clearCache(userId);
}

/**
 * Check if an AI assistant is active for a specific match
 */
export async function isAssistantActive(
	userId: string,
	matchId: string,
	assistantType: 'bestie' | 'wingman'
): Promise<boolean> {
	// Check session cache first
	const sessionKey = `${userId}:${matchId}:${assistantType}`;
	const cachedSession = sessionCache.get(sessionKey);

	if (cachedSession) {
		return cachedSession.isActive;
	}

	// Check database
	const supabase = getSupabase();
	const { data, error } = await supabase
		.from('ai_assistant_match_configs')
		.select('is_active')
		.eq('user_id', userId)
		.eq('match_id', matchId)
		.eq('assistant_type', assistantType)
		.single();

	if (error) {
		if (error.code === 'PGRST116') {
			// No configuration found
			return false;
		}
		throw new Error(`Failed to check assistant status: ${error.message}`);
	}

	return data?.is_active ?? false;
}

/**
 * Get the current configuration for an AI assistant
 */
export async function getAssistantConfig(
	userId: string,
	matchId: string,
	assistantType: 'bestie' | 'wingman'
): Promise<AIAssistantConfig | null> {
	const supabase = getSupabase();

	const { data, error } = await supabase
		.from('ai_assistant_match_configs')
		.select('*')
		.eq('user_id', userId)
		.eq('match_id', matchId)
		.eq('assistant_type', assistantType)
		.single();

	if (error) {
		if (error.code === 'PGRST116') {
			// No configuration found
			return null;
		}
		throw new Error(`Failed to get assistant config: ${error.message}`);
	}

	if (!data) {
		return null;
	}

	return {
		id: data.id,
		userId: data.user_id,
		matchId: data.match_id,
		assistantType: data.assistant_type as 'bestie' | 'wingman',
		isActive: data.is_active,
		autoImpersonate: data.auto_impersonate,
		exchangeCount: data.exchange_count,
		lastExchangeAt: data.last_exchange_at ? new Date(data.last_exchange_at).getTime() : null,
		createdAt: new Date(data.created_at).getTime(),
		updatedAt: new Date(data.updated_at).getTime()
	};
}

/**
 * Update the configuration for an AI assistant
 */
export async function updateAssistantConfig(
	userId: string,
	matchId: string,
	assistantType: 'bestie' | 'wingman',
	updates: Partial<Omit<AIAssistantConfig, 'id' | 'userId' | 'matchId' | 'assistantType'>>
): Promise<void> {
	const supabase = getSupabase();

	// Build update object with snake_case keys
	const updateData: Record<string, any> = {
		updated_at: new Date().toISOString()
	};

	if (updates.isActive !== undefined) {
		updateData.is_active = updates.isActive;
	}
	if (updates.autoImpersonate !== undefined) {
		updateData.auto_impersonate = updates.autoImpersonate;
	}
	if (updates.exchangeCount !== undefined) {
		updateData.exchange_count = updates.exchangeCount;
	}
	if (updates.lastExchangeAt !== undefined) {
		updateData.last_exchange_at = updates.lastExchangeAt ? new Date(updates.lastExchangeAt).toISOString() : null;
	}

	const { error } = await supabase
		.from('ai_assistant_match_configs')
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		.update(updateData as any)
		.eq('user_id', userId)
		.eq('match_id', matchId)
		.eq('assistant_type', assistantType);

	if (error) {
		throw new Error(`Failed to update assistant config: ${error.message}`);
	}

	// Invalidate session cache
	const sessionKey = `${userId}:${matchId}:${assistantType}`;
	sessionCache.delete(sessionKey);
}

/**
 * Get all active assistants for a user
 */
export async function getActiveAssistants(userId: string): Promise<AIAssistantConfig[]> {
	const supabase = getSupabase();

	const { data, error } = await supabase
		.from('ai_assistant_match_configs')
		.select('*')
		.eq('user_id', userId)
		.eq('is_active', true);

	if (error) {
		throw new Error(`Failed to get active assistants: ${error.message}`);
	}

	return (data || []).map((row) => ({
		id: row.id,
		userId: row.user_id,
		matchId: row.match_id,
		assistantType: row.assistant_type as 'bestie' | 'wingman',
		isActive: row.is_active,
		autoImpersonate: row.auto_impersonate,
		exchangeCount: row.exchange_count,
		lastExchangeAt: row.last_exchange_at ? new Date(row.last_exchange_at).getTime() : null,
		createdAt: new Date(row.created_at).getTime(),
		updatedAt: new Date(row.updated_at).getTime()
	}));
}

/**
 * Get session for a specific match
 */
export function getSession(
	userId: string,
	matchId: string,
	assistantType: 'bestie' | 'wingman'
): AIAssistantSession | undefined {
	const sessionKey = `${userId}:${matchId}:${assistantType}`;
	return sessionCache.get(sessionKey);
}

/**
 * Clear all sessions (useful for testing or logout)
 */
export function clearAllSessions(): void {
	sessionCache.clear();
}

/**
 * Clear sessions for a specific user
 */
export function clearUserSessions(userId: string): void {
	const keysToDelete: string[] = [];

	for (const [key] of sessionCache) {
		if (key.startsWith(`${userId}:`)) {
			keysToDelete.push(key);
		}
	}

	keysToDelete.forEach((key) => sessionCache.delete(key));
}

/**
 * Increment exchange counter for loop prevention
 */
export async function incrementExchangeCount(
	userId: string,
	matchId: string,
	assistantType: 'bestie' | 'wingman'
): Promise<number> {
	const supabase = getSupabase();

	// Get current count
	const config = await getAssistantConfig(userId, matchId, assistantType);
	if (!config) {
		throw new Error('Assistant config not found');
	}

	const newCount = config.exchangeCount + 1;

	// Update count
	await updateAssistantConfig(userId, matchId, assistantType, {
		exchangeCount: newCount,
		lastExchangeAt: Date.now()
	});

	return newCount;
}

/**
 * Reset exchange counter (when user takes over)
 */
export async function resetExchangeCounter(
	userId: string,
	matchId: string,
	assistantType: 'bestie' | 'wingman'
): Promise<void> {
	await updateAssistantConfig(userId, matchId, assistantType, {
		exchangeCount: 0,
		lastExchangeAt: null
	});
}

