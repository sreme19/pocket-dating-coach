import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';
import {
	routeMessage,
	getSessionState,
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

describe('Message Router - Property-Based Tests', () => {
	const mockUserProfile: UserProfile = {
		id: 'user-123',
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

	const createContext = (overrides?: Partial<MessageRoutingContext>): MessageRoutingContext => ({
		userId: 'user-123',
		matchId: 'match-456',
		userMessage: 'What should I say?',
		conversationHistory: [],
		userProfile: mockUserProfile,
		matchedUserProfile: mockMatchedUserProfile,
		bookContext: 'Book context...',
		...overrides
	});

	beforeEach(() => {
		vi.clearAllMocks();
	});

	/**
	 * **Validates: Requirements 1.1, 2.1, 3.1, 4.1**
	 *
	 * Property: Activation Idempotence
	 * When a user sends an activation command, the system should consistently
	 * activate the requested assistant and return the correct routing type.
	 * Sending the same activation command multiple times should always result
	 * in the same assistant being active.
	 */
	it('should consistently activate the correct assistant regardless of case', async () => {
		await fc.assert(
			fc.asyncProperty(
				fc.constantFrom('activate ai bestie', 'ACTIVATE AI BESTIE', 'Activate AI Bestie', 'activate ai wingman', 'ACTIVATE AI WINGMAN', 'Activate AI Wingman'),
				async (activationCommand) => {
					const context = createContext({ userMessage: activationCommand });

					vi.mocked(assistantManager.activateAssistant).mockResolvedValue(undefined);
					vi.mocked(assistantManager.isAssistantActive).mockResolvedValue(false);

					const result = await routeMessage(context);

					// Verify the correct assistant type is returned
					if (activationCommand.toLowerCase().includes('bestie')) {
						expect(result.type).toBe('ai-bestie');
						expect(result.assistantType).toBe('bestie');
					} else {
						expect(result.type).toBe('ai-wingman');
						expect(result.assistantType).toBe('wingman');
					}

					// Verify activation flag is set
					expect(result.shouldActivate).toBe(true);
					expect(result.isActive).toBe(true);

					// Verify the manager was called
					expect(assistantManager.activateAssistant).toHaveBeenCalled();
				}
			)
		);
	});

	/**
	 * **Validates: Requirements 1.1, 2.1, 3.1, 4.1**
	 *
	 * Property: Deactivation Idempotence
	 * When a user sends a deactivation command, the system should consistently
	 * deactivate the requested assistant and return regular-chat routing type.
	 * Sending the same deactivation command multiple times should always result
	 * in the same assistant being inactive.
	 */
	it('should consistently deactivate the correct assistant regardless of case', async () => {
		await fc.assert(
			fc.asyncProperty(
				fc.constantFrom('deactivate ai bestie', 'DEACTIVATE AI BESTIE', 'Deactivate AI Bestie', 'deactivate ai wingman', 'DEACTIVATE AI WINGMAN', 'Deactivate AI Wingman'),
				async (deactivationCommand) => {
					const context = createContext({ userMessage: deactivationCommand });

					vi.mocked(assistantManager.deactivateAssistant).mockResolvedValue(undefined);
					vi.mocked(assistantManager.isAssistantActive).mockResolvedValue(false);

					const result = await routeMessage(context);

					// Verify regular-chat routing
					expect(result.type).toBe('regular-chat');
					expect(result.shouldDeactivate).toBe(true);
					expect(result.isActive).toBe(false);

					// Verify the manager was called
					expect(assistantManager.deactivateAssistant).toHaveBeenCalled();
				}
			)
		);
	});

	/**
	 * **Validates: Requirements 3.1, 4.1**
	 *
	 * Property: Session State Consistency
	 * The session state should always reflect the actual active assistants.
	 * If an assistant is active, getSessionState should return true for that assistant.
	 * If an assistant is inactive, getSessionState should return false for that assistant.
	 */
	it('should return consistent session state for any combination of active assistants', async () => {
		await fc.assert(
			fc.asyncProperty(
				fc.tuple(fc.boolean(), fc.boolean()),
				async ([bestieActive, wingmanActive]) => {
					vi.mocked(assistantManager.isAssistantActive).mockImplementation(
						async (userId, matchId, type) => {
							if (type === 'bestie') return bestieActive;
							if (type === 'wingman') return wingmanActive;
							return false;
						}
					);

					const state = await getSessionState('user-123', 'match-456');

					// Verify state matches the mocked values
					expect(state.bestieActive).toBe(bestieActive);
					expect(state.wingmanActive).toBe(wingmanActive);

					// Verify activeAssistant is set correctly
					if (bestieActive) {
						expect(state.activeAssistant).toBe('bestie');
					} else if (wingmanActive) {
						expect(state.activeAssistant).toBe('wingman');
					} else {
						expect(state.activeAssistant).toBeUndefined();
					}
				}
			)
		);
	});

	/**
	 * **Validates: Requirements 1.1, 2.1, 3.1, 4.1**
	 *
	 * Property: Non-Activation Messages Don't Activate
	 * Regular user messages (that don't contain activation keywords) should never
	 * trigger assistant activation. The system should route to regular-chat or
	 * the currently active assistant, but never activate a new one.
	 */
	it('should not activate assistants for regular messages', async () => {
		await fc.assert(
			fc.asyncProperty(
				fc.stringMatching(/^[a-z\s]+$/).filter(
					(s) =>
						!s.toLowerCase().includes('activate') &&
						!s.toLowerCase().includes('deactivate') &&
						!s.toLowerCase().includes('turn off')
				),
				async (regularMessage) => {
					vi.clearAllMocks();

					vi.mocked(assistantManager.isAssistantActive).mockResolvedValue(false);

					const context = createContext({ userMessage: regularMessage });

					const result = await routeMessage(context);

					// Should route to regular chat
					expect(result.type).toBe('regular-chat');

					// Should not activate any assistant
					expect(result.shouldActivate).toBeUndefined();
					expect(assistantManager.activateAssistant).not.toHaveBeenCalled();
				}
			)
		);
	});

	/**
	 * **Validates: Requirements 3.1, 4.1**
	 *
	 * Property: Exchange Counter Increment
	 * When an AI assistant generates a response, the exchange counter should
	 * always be incremented by exactly 1. Multiple responses should result in
	 * monotonically increasing exchange counts.
	 */
	it('should increment exchange counter for each AI response', async () => {
		await fc.assert(
			fc.asyncProperty(
				fc.integer({ min: 0, max: 5 }),
				async (responseCount) => {
					vi.clearAllMocks();

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

					const context = createContext();

					// Generate multiple responses
					for (let i = 0; i < responseCount; i++) {
						await routeMessage(context);
					}

					// Verify incrementExchangeCount was called the correct number of times
					expect(assistantManager.incrementExchangeCount).toHaveBeenCalledTimes(responseCount);

					// Verify it was called with the correct parameters
					for (let i = 0; i < responseCount; i++) {
						expect(assistantManager.incrementExchangeCount).toHaveBeenNthCalledWith(
							i + 1,
							'user-123',
							'match-456',
							'bestie'
						);
					}
				}
			)
		);
	});

	/**
	 * **Validates: Requirements 1.1, 2.1**
	 *
	 * Property: Activation Preserves Context
	 * When activating an assistant, the system should preserve all context
	 * (user profile, matched user profile, book context) and pass it correctly
	 * to the assistant manager.
	 */
	it('should preserve all context when activating assistants', async () => {
		await fc.assert(
			fc.asyncProperty(
				fc.record({
					userId: fc.uuid(),
					matchId: fc.uuid(),
					userMessage: fc.constantFrom('activate ai bestie', 'activate ai wingman')
				}),
				async (testData) => {
					const context = createContext({
						userId: testData.userId,
						matchId: testData.matchId,
						userMessage: testData.userMessage
					});

					vi.mocked(assistantManager.activateAssistant).mockResolvedValue(undefined);
					vi.mocked(assistantManager.isAssistantActive).mockResolvedValue(false);

					await routeMessage(context);

					// Verify the manager was called with the correct context
					expect(assistantManager.activateAssistant).toHaveBeenCalledWith(
						testData.userId,
						testData.matchId,
						expect.any(String),
						mockUserProfile,
						mockMatchedUserProfile
					);
				}
			)
		);
	});

	/**
	 * **Validates: Requirements 3.1, 4.1**
	 *
	 * Property: Profile Loading Consistency
	 * When routing to an AI assistant, the correct profile (preferences for Bestie,
	 * personality for Wingman) should always be loaded. The profile should be
	 * loaded exactly once per message.
	 */
	it('should load the correct profile type for each assistant', async () => {
		await fc.assert(
			fc.asyncProperty(
				fc.constantFrom('bestie', 'wingman'),
				async (assistantType) => {
					vi.clearAllMocks();

					vi.mocked(assistantManager.isAssistantActive).mockImplementation(
						async (userId, matchId, type) => type === assistantType
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

					const context = createContext();

					await routeMessage(context);

					// Verify the correct profile was loaded
					if (assistantType === 'bestie') {
						expect(profileService.loadPreferences).toHaveBeenCalledWith('user-123');
						expect(profileService.loadPersonality).not.toHaveBeenCalled();
					} else {
						expect(profileService.loadPersonality).toHaveBeenCalledWith('user-123');
						expect(profileService.loadPreferences).not.toHaveBeenCalled();
					}
				}
			)
		);
	});

	/**
	 * **Validates: Requirements 3.1, 4.1**
	 *
	 * Property: Auto-Update Always Called
	 * When an AI assistant generates a response, the auto-update function should
	 * always be called with the correct parameters (assistant type, conversation
	 * history, user profile, user ID, book context).
	 */
	it('should always call auto-update after generating response', async () => {
		await fc.assert(
			fc.asyncProperty(
				fc.constantFrom('bestie', 'wingman'),
				async (assistantType) => {
					vi.clearAllMocks();

					vi.mocked(assistantManager.isAssistantActive).mockImplementation(
						async (userId, matchId, type) => type === assistantType
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

					const context = createContext();

					await routeMessage(context);

					// Verify auto-update was called
					expect(assistantService.autoUpdateProfile).toHaveBeenCalledWith(
						assistantType,
						context.conversationHistory,
						mockUserProfile,
						'user-123',
						'Book context...'
					);
				}
			)
		);
	});

	/**
	 * **Validates: Requirements 1.1, 2.1**
	 *
	 * Property: Bestie Priority Over Wingman
	 * When both AI Bestie and AI Wingman are active, the system should always
	 * prioritize routing to AI Bestie. This ensures consistent behavior when
	 * both assistants are active.
	 */
	it('should always prioritize AI Bestie when both assistants are active', async () => {
		await fc.assert(
			fc.asyncProperty(
				fc.constant(true),
				async (bothActive) => {
					vi.clearAllMocks();

					vi.mocked(assistantManager.isAssistantActive).mockResolvedValue(true);
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

					const context = createContext();

					const result = await routeMessage(context);

					// Should route to Bestie
					expect(result.type).toBe('ai-bestie');
					expect(result.assistantType).toBe('bestie');

					// Should load preferences (not personality)
					expect(profileService.loadPreferences).toHaveBeenCalled();
					expect(profileService.loadPersonality).not.toHaveBeenCalled();
				}
			)
		);
	});

	/**
	 * **Validates: Requirements 1.1, 2.1, 3.1, 4.1**
	 *
	 * Property: Exchange Limit Prevents Response Generation
	 * When an assistant reaches the exchange limit (canContinue returns false),
	 * the system should NOT generate a response. It should return a warning
	 * instead and not call generateResponse.
	 */
	it('should not generate response when exchange limit is reached', async () => {
		await fc.assert(
			fc.asyncProperty(
				fc.constantFrom('bestie', 'wingman'),
				async (assistantType) => {
					vi.mocked(assistantManager.isAssistantActive).mockImplementation(
						async (userId, matchId, type) => type === assistantType
					);
					vi.mocked(loopPrevention.canContinue).mockResolvedValue(false);

					const context = createContext();

					const result = await routeMessage(context);

					// Should indicate limit reached
					expect(result.canContinue).toBe(false);
					expect(result.warning).toBeDefined();

					// Should NOT generate response
					expect(assistantService.generateResponse).not.toHaveBeenCalled();
					expect(assistantManager.incrementExchangeCount).not.toHaveBeenCalled();
					expect(assistantService.autoUpdateProfile).not.toHaveBeenCalled();
				}
			)
		);
	});
});
