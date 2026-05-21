import { getSupabase } from './supabase';
import { getAssistantConfig } from './ai-assistant-manager';

/**
 * Exchange count tracking for loop prevention
 */
export interface ExchangeCount {
	bestieExchanges: number;
	wingmanExchanges: number;
	lastBestieExchange: number | null;
	lastWingmanExchange: number | null;
}

/**
 * Maximum exchanges per side when both assistants are active
 */
const MAX_EXCHANGES_PER_SIDE = 10;

/**
 * Check if conversation can continue with AI assistants
 * Returns false if either side has reached max exchanges when both are active
 */
export async function canContinue(
	userId: string,
	matchId: string,
	assistantType: 'bestie' | 'wingman'
): Promise<boolean> {
	try {
		// Check if both assistants are active
		const bothActive = await areBothAssistantsActive(userId, matchId);

		if (!bothActive) {
			// If only one assistant is active, no limit applies
			return true;
		}

		// Get current exchange counts
		const counts = await getExchangeCount(userId, matchId);

		// Check if the requesting assistant has reached the limit
		if (assistantType === 'bestie') {
			return counts.bestieExchanges < MAX_EXCHANGES_PER_SIDE;
		} else {
			return counts.wingmanExchanges < MAX_EXCHANGES_PER_SIDE;
		}
	} catch (error) {
		console.error('Error checking if conversation can continue:', error);
		// On error, allow continuation to avoid blocking the user
		return true;
	}
}

/**
 * Record an exchange for an assistant
 * Increments the exchange counter and updates the last exchange timestamp
 */
export async function recordExchange(
	userId: string,
	matchId: string,
	assistantType: 'bestie' | 'wingman'
): Promise<void> {
	try {
		const supabase = getSupabase();

		// Get current config
		const config = await getAssistantConfig(userId, matchId, assistantType);

		if (!config) {
			throw new Error(`Assistant config not found for ${assistantType}`);
		}

		// Increment exchange count
		const newExchangeCount = config.exchangeCount + 1;
		const now = new Date().toISOString();

		// Update the config with new exchange count
		const { error } = await supabase
			.from('ai_assistant_match_configs')
			.update({
				exchange_count: newExchangeCount,
				last_exchange_at: now,
				updated_at: now
			})
			.eq('id', config.id);

		if (error) {
			throw new Error(`Failed to record exchange: ${error.message}`);
		}
	} catch (error) {
		console.error('Error recording exchange:', error);
		throw error;
	}
}

/**
 * Get current exchange counts for a conversation
 * Returns the number of exchanges for each assistant type
 */
export async function getExchangeCount(
	userId: string,
	matchId: string
): Promise<ExchangeCount> {
	try {
		const supabase = getSupabase();

		// Get configs for both assistants
		const { data, error } = await supabase
			.from('ai_assistant_match_configs')
			.select('assistant_type, exchange_count, last_exchange_at')
			.eq('user_id', userId)
			.eq('match_id', matchId);

		if (error) {
			throw new Error(`Failed to get exchange count: ${error.message}`);
		}

		// Initialize counts
		let bestieExchanges = 0;
		let wingmanExchanges = 0;
		let lastBestieExchange: number | null = null;
		let lastWingmanExchange: number | null = null;

		// Process results
		if (data && data.length > 0) {
			for (const row of data) {
				if (row.assistant_type === 'bestie') {
					bestieExchanges = row.exchange_count;
					lastBestieExchange = row.last_exchange_at ? new Date(row.last_exchange_at).getTime() : null;
				} else if (row.assistant_type === 'wingman') {
					wingmanExchanges = row.exchange_count;
					lastWingmanExchange = row.last_exchange_at ? new Date(row.last_exchange_at).getTime() : null;
				}
			}
		}

		return {
			bestieExchanges,
			wingmanExchanges,
			lastBestieExchange,
			lastWingmanExchange
		};
	} catch (error) {
		console.error('Error getting exchange count:', error);
		// Return zero counts on error
		return {
			bestieExchanges: 0,
			wingmanExchanges: 0,
			lastBestieExchange: null,
			lastWingmanExchange: null
		};
	}
}

/**
 * Reset exchange counter for an assistant
 * Called when user takes over the conversation
 */
export async function resetExchangeCounter(
	userId: string,
	matchId: string,
	assistantType: 'bestie' | 'wingman'
): Promise<void> {
	try {
		const supabase = getSupabase();

		// Get current config
		const config = await getAssistantConfig(userId, matchId, assistantType);

		if (!config) {
			throw new Error(`Assistant config not found for ${assistantType}`);
		}

		const now = new Date().toISOString();

		// Reset exchange count to 0
		const { error } = await supabase
			.from('ai_assistant_match_configs')
			.update({
				exchange_count: 0,
				last_exchange_at: null,
				updated_at: now
			})
			.eq('id', config.id);

		if (error) {
			throw new Error(`Failed to reset exchange counter: ${error.message}`);
		}
	} catch (error) {
		console.error('Error resetting exchange counter:', error);
		throw error;
	}
}

/**
 * Check if both AI assistants are active for a conversation
 * Returns true only if both bestie and wingman are active
 */
export async function areBothAssistantsActive(
	userId: string,
	matchId: string
): Promise<boolean> {
	try {
		const supabase = getSupabase();

		// Get configs for both assistants
		const { data, error } = await supabase
			.from('ai_assistant_match_configs')
			.select('assistant_type, is_active')
			.eq('user_id', userId)
			.eq('match_id', matchId);

		if (error) {
			throw new Error(`Failed to check if both assistants are active: ${error.message}`);
		}

		if (!data || data.length === 0) {
			return false;
		}

		// Check if both assistants are present and active
		let bestieActive = false;
		let wingmanActive = false;

		for (const row of data) {
			if (row.assistant_type === 'bestie' && row.is_active) {
				bestieActive = true;
			} else if (row.assistant_type === 'wingman' && row.is_active) {
				wingmanActive = true;
			}
		}

		return bestieActive && wingmanActive;
	} catch (error) {
		console.error('Error checking if both assistants are active:', error);
		// Return false on error to be safe
		return false;
	}
}

/**
 * Get the maximum exchanges allowed per side
 * Useful for UI to display limits
 */
export function getMaxExchangesPerSide(): number {
	return MAX_EXCHANGES_PER_SIDE;
}

/**
 * Check if an assistant has reached the exchange limit
 * Only applies when both assistants are active
 */
export async function hasReachedExchangeLimit(
	userId: string,
	matchId: string,
	assistantType: 'bestie' | 'wingman'
): Promise<boolean> {
	try {
		// Check if both assistants are active
		const bothActive = await areBothAssistantsActive(userId, matchId);

		if (!bothActive) {
			// No limit if only one assistant is active
			return false;
		}

		// Get current exchange counts
		const counts = await getExchangeCount(userId, matchId);

		// Check if the assistant has reached the limit
		if (assistantType === 'bestie') {
			return counts.bestieExchanges >= MAX_EXCHANGES_PER_SIDE;
		} else {
			return counts.wingmanExchanges >= MAX_EXCHANGES_PER_SIDE;
		}
	} catch (error) {
		console.error('Error checking if exchange limit reached:', error);
		// Return false on error to avoid blocking the user
		return false;
	}
}

/**
 * Get remaining exchanges for an assistant
 * Only applies when both assistants are active
 */
export async function getRemainingExchanges(
	userId: string,
	matchId: string,
	assistantType: 'bestie' | 'wingman'
): Promise<number> {
	try {
		// Check if both assistants are active
		const bothActive = await areBothAssistantsActive(userId, matchId);

		if (!bothActive) {
			// No limit if only one assistant is active
			return MAX_EXCHANGES_PER_SIDE;
		}

		// Get current exchange counts
		const counts = await getExchangeCount(userId, matchId);

		// Calculate remaining exchanges
		if (assistantType === 'bestie') {
			return Math.max(0, MAX_EXCHANGES_PER_SIDE - counts.bestieExchanges);
		} else {
			return Math.max(0, MAX_EXCHANGES_PER_SIDE - counts.wingmanExchanges);
		}
	} catch (error) {
		console.error('Error getting remaining exchanges:', error);
		// Return max on error to avoid blocking the user
		return MAX_EXCHANGES_PER_SIDE;
	}
}
