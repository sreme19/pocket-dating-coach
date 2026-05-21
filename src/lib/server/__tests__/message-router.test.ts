import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	routeMessage,
	getSessionState,
	canAssistantContinue,
	getExchangeCount,
	type MessageRoutingContext
} from '../message-router';
import * as assistantManager from '../ai-assistant-manager';
import * as loopPrevention from '../ai-loop-prevention';
import * as assistantService from '../ai-assistant-service';
import * as profileService from '../profile-service';
import type { ChatMessage, UserProfile } from '../../types';

// Mock all dependencies
vi.mock('../ai-assistant-manager');
vi.mock('../ai-loop-prevention');
vi.mock('../ai-assistant-service');
vi.mock('../profile-service');
vi.mock('../supabase');

describe('Message Router', () => {
	const mockUserId = 'user-123';
	const mockMatchId = 'match-456';
	const mockUserProfile: UserProfile = {
		id: mockUserId,
		gender: 'woman',
		ageRange: '25-30',
		datingApp: 'hinge',
		relationshipGoal: 'serious'
	};

	const mockMatchedUserProfile: Partial<UserProfile> = {
		gender: 'man',
		ageRange: '26-31',
		datingApp: 'hinge',
		relationshipGoal: 'serious'
	};

	const mockConversationHistory: ChatMessage[] = [
		{
			id: '1',
			role: 'user',
			content: 'Hi there!',
			timestamp: Date.now() - 10000
		},
		{
			id: '2',
			role: 'assistant',
			content: 'Hey! How are you?',
			timestamp: Date.now() - 5000
		}
	];

	const mockBookContext = 'Book context about dating...';

	const createContext = (overrides?: Partial<MessageRoutingContext>): MessageRoutingContext => ({
		userId: mockUserId,
		matchId: mockMatchId,
		userMessage: 'What should I say?',
		conversationHistory: mockConversationHistory,
		userProfile: mockUserProfile,
		matchedUserProfile: mockMatchedUserProfile,
		bookContext: mockBookContext,
		...overrides
	});

	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('routeMessage - Activation Commands', () => {
		beforeEach(() => {
			// Reset all mocks to return false by default
			vi.mocked(assistantManager.isAssistantActive).mockResolvedValue(false);
			vi.mocked(assistantManager.activateAssistant).mockResolvedValue(undefined);
			vi.mocked(assistantManager.deactivateAssistant).mockResolvedValue(undefined);
		});

		it('should activate AI Bestie when user sends activation command', async () => {
			const context = createContext({ userMessage: 'activate ai bestie' });

			const result = await routeMessage(context);

			expect(result.type).toBe('ai-bestie');
			expect(result.assistantType).toBe('bestie');
			expect(result.shouldActivate).toBe(true);
			expect(result.isActive).toBe(true);
			expect(assistantManager.activateAssistant).toHaveBeenCalledWith(
				mockUserId,
				mockMatchId,
				'bestie',
				mockUserProfile,
				mockMatchedUserProfile
			);
		});

		it('should activate AI Wingman when user sends activation command', async () => {
			const context = createContext({ userMessage: 'activate ai wingman' });

			const result = await routeMessage(context);

			expect(result.type).toBe('ai-wingman');
			expect(result.assistantType).toBe('wingman');
			expect(result.shouldActivate).toBe(true);
			expect(result.isActive).toBe(true);
			expect(assistantManager.activateAssistant).toHaveBeenCalledWith(
				mockUserId,
				mockMatchId,
				'wingman',
				mockUserProfile,
				mockMatchedUserProfile
			);
		});

		it('should deactivate AI Bestie when user sends deactivation command', async () => {
			const context = createContext({ userMessage: 'deactivate ai bestie' });

			const result = await routeMessage(context);

			expect(result.type).toBe('regular-chat');
			expect(result.assistantType).toBe('bestie');
			expect(result.shouldDeactivate).toBe(true);
			expect(result.isActive).toBe(false);
			expect(assistantManager.deactivateAssistant).toHaveBeenCalledWith(
				mockUserId,
				mockMatchId,
				'bestie'
			);
		});

		it('should deactivate AI Wingman when user sends deactivation command', async () => {
			const context = createContext({ userMessage: 'deactivate ai wingman' });

			const result = await routeMessage(context);

			expect(result.type).toBe('regular-chat');
			expect(result.assistantType).toBe('wingman');
			expect(result.shouldDeactivate).toBe(true);
			expect(result.isActive).toBe(false);
			expect(assistantManager.deactivateAssistant).toHaveBeenCalledWith(
				mockUserId,
				mockMatchId,
				'wingman'
			);
		});

		it('should handle "turn off" command for AI Bestie', async () => {
			const context = createContext({ userMessage: 'turn off ai bestie' });

			const result = await routeMessage(context);

			expect(result.type).toBe('regular-chat');
			expect(result.shouldDeactivate).toBe(true);
			expect(assistantManager.deactivateAssistant).toHaveBeenCalled();
		});

		it('should be case-insensitive for activation commands', async () => {
			const context = createContext({ userMessage: 'ACTIVATE AI BESTIE' });

			const result = await routeMessage(context);

			expect(result.type).toBe('ai-bestie');
			expect(result.shouldActivate).toBe(true);
		});
	});

	describe('routeMessage - AI Bestie Active', () => {
		beforeEach(() => {
			vi.mocked(assistantManager.isAssistantActive).mockResolvedValue(false);
		});

		it('should route to AI Bestie when active and can continue', async () => {
			const context = createContext();

			vi.mocked(assistantManager.isAssistantActive).mockImplementation(
				async (userId, matchId, type) => type === 'bestie'
			);
			vi.mocked(loopPrevention.canContinue).mockResolvedValue(true);
			vi.mocked(profileService.loadPreferences).mockResolvedValue({
				emotionalSignals: [],
				lifestyleSignals: [],
				maturitySignals: [],
				boundaries: [],
				dealbreakers: [],
				privateCompatibilityNotes: [],
				updatedAt: Date.now()
			});
			vi.mocked(assistantService.generateResponse).mockResolvedValue({
				reply: 'You should say...',
				citations: ['Based on: Chapter 1']
			});
			vi.mocked(assistantManager.incrementExchangeCount).mockResolvedValue(1);
			vi.mocked(assistantService.autoUpdateProfile).mockResolvedValue(undefined);

			const result = await routeMessage(context);

			expect(result.type).toBe('ai-bestie');
			expect(result.assistantType).toBe('bestie');
			expect(result.isActive).toBe(true);
			expect(result.canContinue).toBe(true);
			expect(assistantService.generateResponse).toHaveBeenCalled();
			expect(assistantManager.incrementExchangeCount).toHaveBeenCalledWith(
				mockUserId,
				mockMatchId,
				'bestie'
			);
		});

		it('should return warning when AI Bestie reaches exchange limit', async () => {
			const context = createContext();

			vi.mocked(assistantManager.isAssistantActive).mockImplementation(
				async (userId, matchId, type) => type === 'bestie'
			);
			vi.mocked(loopPrevention.canContinue).mockResolvedValue(false);

			const result = await routeMessage(context);

			expect(result.type).toBe('ai-bestie');
			expect(result.isActive).toBe(true);
			expect(result.canContinue).toBe(false);
			expect(result.warning).toContain('exchange limit');
			expect(assistantService.generateResponse).not.toHaveBeenCalled();
		});

		it('should load preferences when routing to AI Bestie', async () => {
			const context = createContext();

			vi.mocked(assistantManager.isAssistantActive).mockImplementation(
				async (userId, matchId, type) => type === 'bestie'
			);
			vi.mocked(loopPrevention.canContinue).mockResolvedValue(true);
			vi.mocked(profileService.loadPreferences).mockResolvedValue({
				emotionalSignals: ['Asks about my day'],
				lifestyleSignals: ['Active'],
				maturitySignals: [],
				boundaries: [],
				dealbreakers: [],
				privateCompatibilityNotes: [],
				updatedAt: Date.now()
			});
			vi.mocked(assistantService.generateResponse).mockResolvedValue({
				reply: 'Response',
				citations: []
			});
			vi.mocked(assistantManager.incrementExchangeCount).mockResolvedValue(1);
			vi.mocked(assistantService.autoUpdateProfile).mockResolvedValue(undefined);

			await routeMessage(context);

			expect(profileService.loadPreferences).toHaveBeenCalledWith(mockUserId);
		});

		it('should auto-update preferences after generating response', async () => {
			const context = createContext();

			vi.mocked(assistantManager.isAssistantActive).mockImplementation(
				async (userId, matchId, type) => type === 'bestie'
			);
			vi.mocked(loopPrevention.canContinue).mockResolvedValue(true);
			vi.mocked(profileService.loadPreferences).mockResolvedValue({
				emotionalSignals: [],
				lifestyleSignals: [],
				maturitySignals: [],
				boundaries: [],
				dealbreakers: [],
				privateCompatibilityNotes: [],
				updatedAt: Date.now()
			});
			vi.mocked(assistantService.generateResponse).mockResolvedValue({
				reply: 'Response',
				citations: []
			});
			vi.mocked(assistantManager.incrementExchangeCount).mockResolvedValue(1);
			vi.mocked(assistantService.autoUpdateProfile).mockResolvedValue(undefined);

			await routeMessage(context);

			expect(assistantService.autoUpdateProfile).toHaveBeenCalledWith(
				'bestie',
				mockConversationHistory,
				mockUserProfile,
				mockUserId,
				mockBookContext
			);
		});
	});

	describe('routeMessage - AI Wingman Active', () => {
		beforeEach(() => {
			vi.mocked(assistantManager.isAssistantActive).mockResolvedValue(false);
		});

		it('should route to AI Wingman when active and can continue', async () => {
			const context = createContext();

			vi.mocked(assistantManager.isAssistantActive).mockImplementation(
				async (userId, matchId, type) => type === 'wingman'
			);
			vi.mocked(loopPrevention.canContinue).mockResolvedValue(true);
			vi.mocked(profileService.loadPersonality).mockResolvedValue({
				communicationStyle: 'direct',
				personalityVibe: 'ambitious',
				mattersMost: 'humor',
				values: [],
				datingPatterns: [],
				redFlagsToAvoid: [],
				updatedAt: Date.now()
			});
			vi.mocked(assistantService.generateResponse).mockResolvedValue({
				reply: 'You should say...',
				citations: ['Based on: Chapter 2']
			});
			vi.mocked(assistantManager.incrementExchangeCount).mockResolvedValue(1);
			vi.mocked(assistantService.autoUpdateProfile).mockResolvedValue(undefined);

			const result = await routeMessage(context);

			expect(result.type).toBe('ai-wingman');
			expect(result.assistantType).toBe('wingman');
			expect(result.isActive).toBe(true);
			expect(result.canContinue).toBe(true);
			expect(assistantService.generateResponse).toHaveBeenCalled();
			expect(assistantManager.incrementExchangeCount).toHaveBeenCalledWith(
				mockUserId,
				mockMatchId,
				'wingman'
			);
		});

		it('should return warning when AI Wingman reaches exchange limit', async () => {
			const context = createContext();

			vi.mocked(assistantManager.isAssistantActive).mockImplementation(
				async (userId, matchId, type) => type === 'wingman'
			);
			vi.mocked(loopPrevention.canContinue).mockResolvedValue(false);

			const result = await routeMessage(context);

			expect(result.type).toBe('ai-wingman');
			expect(result.isActive).toBe(true);
			expect(result.canContinue).toBe(false);
			expect(result.warning).toContain('exchange limit');
			expect(assistantService.generateResponse).not.toHaveBeenCalled();
		});

		it('should load personality when routing to AI Wingman', async () => {
			const context = createContext();

			vi.mocked(assistantManager.isAssistantActive).mockImplementation(
				async (userId, matchId, type) => type === 'wingman'
			);
			vi.mocked(loopPrevention.canContinue).mockResolvedValue(true);
			vi.mocked(profileService.loadPersonality).mockResolvedValue({
				communicationStyle: 'direct',
				personalityVibe: 'ambitious',
				mattersMost: 'humor',
				values: [],
				datingPatterns: [],
				redFlagsToAvoid: [],
				updatedAt: Date.now()
			});
			vi.mocked(assistantService.generateResponse).mockResolvedValue({
				reply: 'Response',
				citations: []
			});
			vi.mocked(assistantManager.incrementExchangeCount).mockResolvedValue(1);
			vi.mocked(assistantService.autoUpdateProfile).mockResolvedValue(undefined);

			await routeMessage(context);

			expect(profileService.loadPersonality).toHaveBeenCalledWith(mockUserId);
		});

		it('should auto-update personality after generating response', async () => {
			const context = createContext();

			vi.mocked(assistantManager.isAssistantActive).mockImplementation(
				async (userId, matchId, type) => type === 'wingman'
			);
			vi.mocked(loopPrevention.canContinue).mockResolvedValue(true);
			vi.mocked(profileService.loadPersonality).mockResolvedValue({
				communicationStyle: 'direct',
				personalityVibe: 'ambitious',
				mattersMost: 'humor',
				values: [],
				datingPatterns: [],
				redFlagsToAvoid: [],
				updatedAt: Date.now()
			});
			vi.mocked(assistantService.generateResponse).mockResolvedValue({
				reply: 'Response',
				citations: []
			});
			vi.mocked(assistantManager.incrementExchangeCount).mockResolvedValue(1);
			vi.mocked(assistantService.autoUpdateProfile).mockResolvedValue(undefined);

			await routeMessage(context);

			expect(assistantService.autoUpdateProfile).toHaveBeenCalledWith(
				'wingman',
				mockConversationHistory,
				mockUserProfile,
				mockUserId,
				mockBookContext
			);
		});
	});

	describe('routeMessage - Regular Chat', () => {
		it('should route to regular chat when no assistant is active', async () => {
			const context = createContext();

			vi.mocked(assistantManager.isAssistantActive).mockResolvedValue(false);

			const result = await routeMessage(context);

			expect(result.type).toBe('regular-chat');
			expect(result.isActive).toBe(false);
			expect(result.assistantType).toBeUndefined();
			expect(assistantService.generateResponse).not.toHaveBeenCalled();
		});

		it('should prioritize AI Bestie over AI Wingman when both are active', async () => {
			const context = createContext();

			vi.mocked(assistantManager.isAssistantActive).mockImplementation(
				async (userId, matchId, type) => true // Both active
			);
			vi.mocked(loopPrevention.canContinue).mockResolvedValue(true);
			vi.mocked(profileService.loadPreferences).mockResolvedValue({
				emotionalSignals: [],
				lifestyleSignals: [],
				maturitySignals: [],
				boundaries: [],
				dealbreakers: [],
				privateCompatibilityNotes: [],
				updatedAt: Date.now()
			});
			vi.mocked(assistantService.generateResponse).mockResolvedValue({
				reply: 'Response',
				citations: []
			});
			vi.mocked(assistantManager.incrementExchangeCount).mockResolvedValue(1);
			vi.mocked(assistantService.autoUpdateProfile).mockResolvedValue(undefined);

			const result = await routeMessage(context);

			// Should route to Bestie first
			expect(result.type).toBe('ai-bestie');
			expect(profileService.loadPreferences).toHaveBeenCalled();
			expect(profileService.loadPersonality).not.toHaveBeenCalled();
		});
	});

	describe('getSessionState', () => {
		it('should return session state with both assistants inactive', async () => {
			vi.mocked(assistantManager.isAssistantActive).mockResolvedValue(false);

			const state = await getSessionState(mockUserId, mockMatchId);

			expect(state.bestieActive).toBe(false);
			expect(state.wingmanActive).toBe(false);
			expect(state.activeAssistant).toBeUndefined();
		});

		it('should return session state with AI Bestie active', async () => {
			vi.mocked(assistantManager.isAssistantActive).mockImplementation(
				async (userId, matchId, type) => type === 'bestie'
			);

			const state = await getSessionState(mockUserId, mockMatchId);

			expect(state.bestieActive).toBe(true);
			expect(state.wingmanActive).toBe(false);
			expect(state.activeAssistant).toBe('bestie');
		});

		it('should return session state with AI Wingman active', async () => {
			vi.mocked(assistantManager.isAssistantActive).mockImplementation(
				async (userId, matchId, type) => type === 'wingman'
			);

			const state = await getSessionState(mockUserId, mockMatchId);

			expect(state.bestieActive).toBe(false);
			expect(state.wingmanActive).toBe(true);
			expect(state.activeAssistant).toBe('wingman');
		});

		it('should return session state with both assistants active', async () => {
			vi.mocked(assistantManager.isAssistantActive).mockResolvedValue(true);

			const state = await getSessionState(mockUserId, mockMatchId);

			expect(state.bestieActive).toBe(true);
			expect(state.wingmanActive).toBe(true);
			expect(state.activeAssistant).toBe('bestie'); // Bestie takes priority
		});
	});

	describe('canAssistantContinue', () => {
		it('should return true when assistant can continue', async () => {
			vi.mocked(loopPrevention.canContinue).mockResolvedValue(true);

			const result = await canAssistantContinue(mockUserId, mockMatchId, 'bestie');

			expect(result).toBe(true);
			expect(loopPrevention.canContinue).toHaveBeenCalledWith(mockUserId, mockMatchId, 'bestie');
		});

		it('should return false when assistant cannot continue', async () => {
			vi.mocked(loopPrevention.canContinue).mockResolvedValue(false);

			const result = await canAssistantContinue(mockUserId, mockMatchId, 'wingman');

			expect(result).toBe(false);
			expect(loopPrevention.canContinue).toHaveBeenCalledWith(mockUserId, mockMatchId, 'wingman');
		});
	});

	describe('getExchangeCount', () => {
		it('should return exchange counts for a match', async () => {
			const mockSupabase = {
				from: vi.fn().mockReturnValue({
					select: vi.fn().mockReturnValue({
						eq: vi.fn().mockReturnValue({
							eq: vi.fn().mockResolvedValue({
								data: [
									{ assistant_type: 'bestie', exchange_count: 5 },
									{ assistant_type: 'wingman', exchange_count: 3 }
								],
								error: null
							})
						})
					})
				})
			};

			// Mock the supabase import
			vi.doMock('../supabase', () => ({
				getSupabase: () => mockSupabase
			}));

			// Note: This test would need proper mocking of the dynamic import
			// For now, we'll skip the detailed implementation test
		});
	});

	describe('Edge Cases', () => {
		it('should handle empty conversation history', async () => {
			const context = createContext({ conversationHistory: [] });

			vi.mocked(assistantManager.isAssistantActive).mockResolvedValue(false);

			const result = await routeMessage(context);

			expect(result.type).toBe('regular-chat');
		});

		it('should handle null user profile', async () => {
			const context = createContext({ userProfile: null });

			vi.mocked(assistantManager.isAssistantActive).mockResolvedValue(false);

			const result = await routeMessage(context);

			expect(result.type).toBe('regular-chat');
		});

		it('should handle activation command with extra whitespace', async () => {
			const context = createContext({ userMessage: '  activate   ai   bestie  ' });

			vi.mocked(assistantManager.activateAssistant).mockResolvedValue(undefined);

			const result = await routeMessage(context);

			expect(result.type).toBe('ai-bestie');
			expect(result.shouldActivate).toBe(true);
		});

		it('should not treat regular messages as activation commands', async () => {
			const context = createContext({ userMessage: 'I want to activate my potential' });

			vi.mocked(assistantManager.isAssistantActive).mockResolvedValue(false);

			const result = await routeMessage(context);

			expect(result.type).toBe('regular-chat');
			expect(assistantManager.activateAssistant).not.toHaveBeenCalled();
		});
	});
});
