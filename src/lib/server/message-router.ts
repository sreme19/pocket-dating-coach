import type { ChatMessage, UserProfile } from '../types';
import {
	isAssistantActive,
	getAssistantConfig,
	activateAssistant,
	deactivateAssistant,
	incrementExchangeCount
} from './ai-assistant-manager';
import { canContinue } from './ai-loop-prevention';
import { generateResponse, autoUpdateProfile } from './ai-assistant-service';
import { loadPreferences, loadPersonality } from './profile-service';
import type { MatchContext } from './ai-assistant-service';

/**
 * Message routing result
 */
export interface MessageRouteResult {
	type: 'user' | 'ai-bestie' | 'ai-wingman' | 'regular-chat';
	assistantType?: 'bestie' | 'wingman';
	shouldActivate?: boolean;
	shouldDeactivate?: boolean;
	isActive?: boolean;
	canContinue?: boolean;
	warning?: string;
}

/**
 * Message routing context
 */
export interface MessageRoutingContext {
	userId: string;
	matchId: string;
	userMessage: string;
	conversationHistory: ChatMessage[];
	userProfile: UserProfile | null;
	matchedUserProfile?: Partial<UserProfile>;
	bookContext: string;
}

/**
 * Determine if a message is an AI activation/deactivation command
 * Looks for patterns like "activate ai bestie", "deactivate ai wingman", etc.
 */
function parseActivationCommand(message: string): {
	isCommand: boolean;
	action?: 'activate' | 'deactivate';
	assistantType?: 'bestie' | 'wingman';
} {
	const lowerMessage = message.toLowerCase().trim();

	// Check for deactivation commands FIRST (before activation)
	// because 'deactivate' contains 'activate'
	if (lowerMessage.includes('deactivate') && lowerMessage.includes('bestie')) {
		return { isCommand: true, action: 'deactivate', assistantType: 'bestie' };
	}
	if (lowerMessage.includes('deactivate') && lowerMessage.includes('wingman')) {
		return { isCommand: true, action: 'deactivate', assistantType: 'wingman' };
	}

	// Check for toggle commands
	if (lowerMessage.includes('turn off') && lowerMessage.includes('bestie')) {
		return { isCommand: true, action: 'deactivate', assistantType: 'bestie' };
	}
	if (lowerMessage.includes('turn off') && lowerMessage.includes('wingman')) {
		return { isCommand: true, action: 'deactivate', assistantType: 'wingman' };
	}

	// Check for activation commands
	if (lowerMessage.includes('activate') && lowerMessage.includes('bestie')) {
		return { isCommand: true, action: 'activate', assistantType: 'bestie' };
	}
	if (lowerMessage.includes('activate') && lowerMessage.includes('wingman')) {
		return { isCommand: true, action: 'activate', assistantType: 'wingman' };
	}

	return { isCommand: false };
}

/**
 * Route a message to the appropriate handler
 * Determines if it's a user message, AI activation, or regular chat
 *
 * Returns routing information that tells the caller how to handle the message
 */
export async function routeMessage(context: MessageRoutingContext): Promise<MessageRouteResult> {
	const { userId, matchId, userMessage, conversationHistory, userProfile, matchedUserProfile, bookContext } = context;

	// Check for activation/deactivation commands
	const command = parseActivationCommand(userMessage);

	if (command.isCommand && command.action && command.assistantType) {
		if (command.action === 'activate') {
			// Activate the requested assistant
			await activateAssistant(userId, matchId, command.assistantType, userProfile, matchedUserProfile);

			return {
				type: `ai-${command.assistantType}`,
				assistantType: command.assistantType,
				shouldActivate: true,
				isActive: true
			};
		} else if (command.action === 'deactivate') {
			// Deactivate the requested assistant
			await deactivateAssistant(userId, matchId, command.assistantType);

			return {
				type: 'regular-chat',
				assistantType: command.assistantType,
				shouldDeactivate: true,
				isActive: false
			};
		}
	}

	// Check if AI Bestie is active for this match
	const bestieActive = await isAssistantActive(userId, matchId, 'bestie');
	if (bestieActive) {
		// Check if conversation can continue (loop prevention)
		const canContinueBestie = await canContinue(userId, matchId, 'bestie');

		if (!canContinueBestie) {
			return {
				type: 'ai-bestie',
				assistantType: 'bestie',
				isActive: true,
				canContinue: false,
				warning: 'AI Bestie has reached the exchange limit. Please take over the conversation or wait for the limit to reset.'
			};
		}

		// Load preferences for context
		const preferences = await loadPreferences(userId);

		// Prepare match context
		const matchContext: MatchContext = {
			matchedUserProfile,
			recentMessages: conversationHistory.slice(-10), // Last 10 messages
			messageCount: conversationHistory.length
		};

		// Generate response from AI Bestie
		const response = await generateResponse(
			'bestie',
			userMessage,
			conversationHistory,
			userProfile,
			matchContext,
			bookContext,
			preferences
		);

		// Increment exchange counter for loop prevention
		await incrementExchangeCount(userId, matchId, 'bestie');

		// Auto-update preferences based on conversation
		await autoUpdateProfile('bestie', conversationHistory, userProfile, userId, bookContext);

		return {
			type: 'ai-bestie',
			assistantType: 'bestie',
			isActive: true,
			canContinue: true
		};
	}

	// Check if AI Wingman is active for this match
	const wingmanActive = await isAssistantActive(userId, matchId, 'wingman');
	if (wingmanActive) {
		// Check if conversation can continue (loop prevention)
		const canContinueWingman = await canContinue(userId, matchId, 'wingman');

		if (!canContinueWingman) {
			return {
				type: 'ai-wingman',
				assistantType: 'wingman',
				isActive: true,
				canContinue: false,
				warning: 'AI Wingman has reached the exchange limit. Please take over the conversation or wait for the limit to reset.'
			};
		}

		// Load personality for context
		const personality = await loadPersonality(userId);

		// Prepare match context
		const matchContext: MatchContext = {
			matchedUserProfile,
			recentMessages: conversationHistory.slice(-10), // Last 10 messages
			messageCount: conversationHistory.length
		};

		// Generate response from AI Wingman
		const response = await generateResponse(
			'wingman',
			userMessage,
			conversationHistory,
			userProfile,
			matchContext,
			bookContext,
			personality
		);

		// Increment exchange counter for loop prevention
		await incrementExchangeCount(userId, matchId, 'wingman');

		// Auto-update personality based on conversation
		await autoUpdateProfile('wingman', conversationHistory, userProfile, userId, bookContext);

		return {
			type: 'ai-wingman',
			assistantType: 'wingman',
			isActive: true,
			canContinue: true
		};
	}

	// No AI assistant is active - route to regular chat
	return {
		type: 'regular-chat',
		isActive: false
	};
}

/**
 * Get the current session state for a match
 * Returns which assistant (if any) is active
 */
export async function getSessionState(
	userId: string,
	matchId: string
): Promise<{
	bestieActive: boolean;
	wingmanActive: boolean;
	activeAssistant?: 'bestie' | 'wingman';
}> {
	const bestieActive = await isAssistantActive(userId, matchId, 'bestie');
	const wingmanActive = await isAssistantActive(userId, matchId, 'wingman');

	return {
		bestieActive,
		wingmanActive,
		activeAssistant: bestieActive ? 'bestie' : wingmanActive ? 'wingman' : undefined
	};
}

/**
 * Check if an assistant can continue (respects loop prevention limits)
 */
export async function canAssistantContinue(
	userId: string,
	matchId: string,
	assistantType: 'bestie' | 'wingman'
): Promise<boolean> {
	return await canContinue(userId, matchId, assistantType);
}

/**
 * Get the current exchange count for loop prevention
 */
export async function getExchangeCount(userId: string, matchId: string): Promise<{
	bestieExchanges: number;
	wingmanExchanges: number;
}> {
	const supabase = (await import('./supabase')).getSupabase();

	const { data, error } = await supabase
		.from('ai_assistant_match_configs')
		.select('assistant_type, exchange_count')
		.eq('user_id', userId)
		.eq('match_id', matchId);

	if (error) {
		console.error('Failed to get exchange counts:', error);
		return { bestieExchanges: 0, wingmanExchanges: 0 };
	}

	const counts = { bestieExchanges: 0, wingmanExchanges: 0 };

	(data || []).forEach((row) => {
		if (row.assistant_type === 'bestie') {
			counts.bestieExchanges = row.exchange_count;
		} else if (row.assistant_type === 'wingman') {
			counts.wingmanExchanges = row.exchange_count;
		}
	});

	return counts;
}
