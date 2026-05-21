import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	extractUserMessageInsights,
	extractMatchMessageInsights,
	extractUserPersonalityInsights,
	extractMatchPersonalityInsights,
	autoUpdatePreferencesProfile,
	autoUpdatePersonalityProfile,
	type AutoUpdateConfig
} from '../profile-auto-updater';
import * as profileService from '../profile-service';
import { askClaude } from '../../claude';
import type { ChatMessage, UserProfile } from '../../types';
import type { PreferencesProfile, PersonalityProfile } from '../profile-service';

/**
 * Unit Tests for Profile Auto-Updater Service
 * 
 * These tests verify that the Profile Auto-Updater correctly:
 * 1. Extracts insights from user messages
 * 2. Extracts insights from match messages
 * 3. Deduplicates insights to avoid duplicates
 * 4. Updates preferences and personality profiles
 * 5. Tracks reasons for updates
 * 6. Handles errors gracefully
 * 
 * **Validates: Requirements 3.1, 4.1, 7.1, 7.2**
 */

// Mock data
const TEST_USER_ID = 'test-user-123';
const TEST_BOOK_CONTEXT = 'Chapter 1: Understanding Dating Signals';

const TEST_USER_PROFILE: UserProfile = {
	gender: 'woman',
	ageRange: '25-30',
	datingApp: 'hinge',
	relationshipGoal: 'serious'
};

const TEST_MALE_PROFILE: UserProfile = {
	gender: 'man',
	ageRange: '26-32',
	datingApp: 'hinge',
	relationshipGoal: 'serious'
};

const TEST_PREFERENCES: PreferencesProfile = {
	emotionalSignals: ['Asks about my day'],
	lifestyleSignals: ['Active and outdoorsy'],
	maturitySignals: ['Takes responsibility'],
	boundaries: ['No excessive drinking'],
	dealbreakers: ['Disrespectful to service workers'],
	privateCompatibilityNotes: ['Seems genuine'],
	updatedAt: Date.now()
};

const TEST_PERSONALITY: PersonalityProfile = {
	communicationStyle: 'direct',
	personalityVibe: 'ambitious',
	mattersMost: 'humor',
	values: ['Authenticity'],
	datingPatterns: ['Prefers genuine conversation'],
	redFlagsToAvoid: ['Overly focused on appearance'],
	updatedAt: Date.now()
};

const TEST_USER_MESSAGES: ChatMessage[] = [
	{
		id: '1',
		role: 'user',
		content: 'I really value someone who is emotionally available and can talk about feelings',
		timestamp: Date.now()
	},
	{
		id: '2',
		role: 'user',
		content: 'I love hiking and outdoor activities, that is really important to me',
		timestamp: Date.now()
	},
	{
		id: '3',
		role: 'user',
		content: 'I need someone who respects my boundaries and is honest about their intentions',
		timestamp: Date.now()
	}
];

const TEST_MATCH_MESSAGES: ChatMessage[] = [
	{
		id: '4',
		role: 'assistant',
		content: 'I love hiking too! I go every weekend. What is your favorite trail?',
		timestamp: Date.now()
	},
	{
		id: '5',
		role: 'assistant',
		content: 'I think it is important to be honest about what we are looking for',
		timestamp: Date.now()
	},
	{
		id: '6',
		role: 'assistant',
		content: 'I am looking for something serious and meaningful',
		timestamp: Date.now()
	}
];

// Mock modules
vi.mock('../../claude');
vi.mock('../profile-service');

describe('Profile Auto-Updater Service', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('extractUserMessageInsights', () => {
		it('should extract insights from user messages', async () => {
			const mockResponse = JSON.stringify({
				emotionalSignals: ['Values emotional availability', 'Wants to discuss feelings'],
				lifestyleSignals: ['Loves hiking and outdoor activities'],
				maturitySignals: [],
				boundaries: ['Respects boundaries', 'Wants honesty'],
				dealbreakers: [],
				privateCompatibilityNotes: []
			});

			(askClaude as any).mockResolvedValue(mockResponse);

			const result = await extractUserMessageInsights(
				TEST_USER_MESSAGES,
				TEST_PREFERENCES,
				TEST_USER_PROFILE,
				TEST_BOOK_CONTEXT
			);

			expect(result.emotionalSignals).toBeDefined();
			expect(result.lifestyleSignals).toBeDefined();
			expect(result.boundaries).toBeDefined();
			expect(askClaude).toHaveBeenCalled();
		});

		it('should return empty object if minimum messages not reached', async () => {
			const fewMessages = TEST_USER_MESSAGES.slice(0, 1);

			const result = await extractUserMessageInsights(
				fewMessages,
				TEST_PREFERENCES,
				TEST_USER_PROFILE,
				TEST_BOOK_CONTEXT,
				{ minMessagesForUpdate: 3 }
			);

			expect(result).toEqual({});
			expect(askClaude).not.toHaveBeenCalled();
		});

		it('should deduplicate insights', async () => {
			const mockResponse = JSON.stringify({
				emotionalSignals: ['Asks about my day', 'Values emotional availability'],
				lifestyleSignals: [],
				maturitySignals: [],
				boundaries: [],
				dealbreakers: [],
				privateCompatibilityNotes: []
			});

			(askClaude as any).mockResolvedValue(mockResponse);

			const result = await extractUserMessageInsights(
				TEST_USER_MESSAGES,
				TEST_PREFERENCES,
				TEST_USER_PROFILE,
				TEST_BOOK_CONTEXT,
				{ deduplicateInsights: true }
			);

			// The deduplication filters out 'Asks about my day' from NEW insights
			// But the result includes original + new insights
			// So we should have the original 'Asks about my day' + new 'Values emotional availability'
			if (result.emotionalSignals) {
				expect(result.emotionalSignals).toContain('Asks about my day'); // Original
				expect(result.emotionalSignals).toContain('Values emotional availability'); // New
				// Should not have duplicates of the same insight
				const count = result.emotionalSignals.filter(s => s === 'Asks about my day').length;
				expect(count).toBe(1); // Only one instance
			}
		});

		it('should limit insights per update', async () => {
			const mockResponse = JSON.stringify({
				emotionalSignals: ['Signal 1', 'Signal 2', 'Signal 3', 'Signal 4', 'Signal 5', 'Signal 6'],
				lifestyleSignals: [],
				maturitySignals: [],
				boundaries: [],
				dealbreakers: [],
				privateCompatibilityNotes: []
			});

			(askClaude as any).mockResolvedValue(mockResponse);

			const result = await extractUserMessageInsights(
				TEST_USER_MESSAGES,
				TEST_PREFERENCES,
				TEST_USER_PROFILE,
				TEST_BOOK_CONTEXT,
				{ maxInsightsPerUpdate: 3 }
			);

			// Should have original + max 3 new insights
			expect(result.emotionalSignals?.length).toBeLessThanOrEqual(4); // 1 original + 3 new
		});

		it('should handle Claude API errors gracefully', async () => {
			(askClaude as any).mockRejectedValue(new Error('API Error'));

			const result = await extractUserMessageInsights(
				TEST_USER_MESSAGES,
				TEST_PREFERENCES,
				TEST_USER_PROFILE,
				TEST_BOOK_CONTEXT
			);

			expect(result).toEqual({});
		});

		it('should handle invalid JSON response', async () => {
			(askClaude as any).mockResolvedValue('Invalid JSON');

			const result = await extractUserMessageInsights(
				TEST_USER_MESSAGES,
				TEST_PREFERENCES,
				TEST_USER_PROFILE,
				TEST_BOOK_CONTEXT
			);

			expect(result).toEqual({});
		});
	});

	describe('extractMatchMessageInsights', () => {
		it('should extract insights from match messages', async () => {
			const mockResponse = JSON.stringify({
				emotionalSignals: ['Shows honesty about intentions'],
				lifestyleSignals: ['Active - hikes every weekend'],
				maturitySignals: [],
				boundaries: [],
				dealbreakers: [],
				privateCompatibilityNotes: ['Seems genuine and serious']
			});

			(askClaude as any).mockResolvedValue(mockResponse);

			const result = await extractMatchMessageInsights(
				TEST_MATCH_MESSAGES,
				TEST_PREFERENCES,
				TEST_USER_PROFILE,
				TEST_BOOK_CONTEXT
			);

			expect(result.emotionalSignals).toBeDefined();
			expect(result.lifestyleSignals).toBeDefined();
			expect(askClaude).toHaveBeenCalled();
		});

		it('should return empty object if minimum messages not reached', async () => {
			const fewMessages = TEST_MATCH_MESSAGES.slice(0, 1);

			const result = await extractMatchMessageInsights(
				fewMessages,
				TEST_PREFERENCES,
				TEST_USER_PROFILE,
				TEST_BOOK_CONTEXT,
				{ minMessagesForUpdate: 3 }
			);

			expect(result).toEqual({});
			expect(askClaude).not.toHaveBeenCalled();
		});

		it('should handle empty messages array', async () => {
			const result = await extractMatchMessageInsights(
				[],
				TEST_PREFERENCES,
				TEST_USER_PROFILE,
				TEST_BOOK_CONTEXT
			);

			expect(result).toEqual({});
		});
	});

	describe('extractUserPersonalityInsights', () => {
		it('should extract personality insights from user messages', async () => {
			const mockResponse = JSON.stringify({
				communicationStyle: 'direct',
				personalityVibe: 'ambitious',
				mattersMost: 'humor',
				values: ['Authenticity', 'Growth mindset'],
				datingPatterns: ['Prefers genuine conversation', 'Values honesty'],
				redFlagsToAvoid: []
			});

			(askClaude as any).mockResolvedValue(mockResponse);

			const result = await extractUserPersonalityInsights(
				TEST_USER_MESSAGES,
				TEST_PERSONALITY,
				TEST_MALE_PROFILE,
				TEST_BOOK_CONTEXT
			);

			expect(result.values).toBeDefined();
			expect(result.datingPatterns).toBeDefined();
			expect(askClaude).toHaveBeenCalled();
		});

		it('should update scalar fields if they differ', async () => {
			const mockResponse = JSON.stringify({
				communicationStyle: 'playful',
				personalityVibe: 'chill',
				mattersMost: 'compatibility',
				values: [],
				datingPatterns: [],
				redFlagsToAvoid: []
			});

			(askClaude as any).mockResolvedValue(mockResponse);

			const result = await extractUserPersonalityInsights(
				TEST_USER_MESSAGES,
				TEST_PERSONALITY,
				TEST_MALE_PROFILE,
				TEST_BOOK_CONTEXT
			);

			expect(result.communicationStyle).toBe('playful');
			expect(result.personalityVibe).toBe('chill');
			expect(result.mattersMost).toBe('compatibility');
		});

		it('should not update scalar fields if they are the same', async () => {
			const mockResponse = JSON.stringify({
				communicationStyle: 'direct',
				personalityVibe: 'ambitious',
				mattersMost: 'humor',
				values: [],
				datingPatterns: [],
				redFlagsToAvoid: []
			});

			(askClaude as any).mockResolvedValue(mockResponse);

			const result = await extractUserPersonalityInsights(
				TEST_USER_MESSAGES,
				TEST_PERSONALITY,
				TEST_MALE_PROFILE,
				TEST_BOOK_CONTEXT
			);

			expect(result.communicationStyle).toBeUndefined();
			expect(result.personalityVibe).toBeUndefined();
			expect(result.mattersMost).toBeUndefined();
		});

		it('should return empty object if minimum messages not reached', async () => {
			const fewMessages = TEST_USER_MESSAGES.slice(0, 1);

			const result = await extractUserPersonalityInsights(
				fewMessages,
				TEST_PERSONALITY,
				TEST_MALE_PROFILE,
				TEST_BOOK_CONTEXT,
				{ minMessagesForUpdate: 3 }
			);

			expect(result).toEqual({});
		});
	});

	describe('extractMatchPersonalityInsights', () => {
		it('should extract personality insights from match messages', async () => {
			const mockResponse = JSON.stringify({
				values: ['Honesty', 'Genuine connection'],
				datingPatterns: ['Looking for something serious'],
				redFlagsToAvoid: []
			});

			(askClaude as any).mockResolvedValue(mockResponse);

			const result = await extractMatchPersonalityInsights(
				TEST_MATCH_MESSAGES,
				TEST_PERSONALITY,
				TEST_MALE_PROFILE,
				TEST_BOOK_CONTEXT
			);

			expect(result.values).toBeDefined();
			expect(result.datingPatterns).toBeDefined();
			expect(askClaude).toHaveBeenCalled();
		});

		it('should return empty object if minimum messages not reached', async () => {
			const fewMessages = TEST_MATCH_MESSAGES.slice(0, 1);

			const result = await extractMatchPersonalityInsights(
				fewMessages,
				TEST_PERSONALITY,
				TEST_MALE_PROFILE,
				TEST_BOOK_CONTEXT,
				{ minMessagesForUpdate: 3 }
			);

			expect(result).toEqual({});
		});
	});

	describe('autoUpdatePreferencesProfile', () => {
		it('should auto-update preferences profile', async () => {
			(profileService.loadPreferences as any).mockResolvedValue(TEST_PREFERENCES);
			(profileService.updatePreferences as any).mockResolvedValue(undefined);

			// Mock askClaude to return insights
			(askClaude as any).mockResolvedValue(
				JSON.stringify({
					emotionalSignals: ['New emotional signal'],
					lifestyleSignals: ['New lifestyle signal'],
					maturitySignals: [],
					boundaries: [],
					dealbreakers: [],
					privateCompatibilityNotes: []
				})
			);

			const result = await autoUpdatePreferencesProfile(
				TEST_USER_ID,
				TEST_USER_MESSAGES,
				TEST_MATCH_MESSAGES,
				TEST_USER_PROFILE,
				TEST_BOOK_CONTEXT,
				'John'
			);

			expect(result).toBe(true);
			expect(profileService.updatePreferences).toHaveBeenCalledWith(
				TEST_USER_ID,
				expect.objectContaining({
					emotionalSignals: expect.any(Array),
					lifestyleSignals: expect.any(Array)
				}),
				'Extracted from conversation with John'
			);
		});

		it('should return false if no insights extracted', async () => {
			(profileService.loadPreferences as any).mockResolvedValue(TEST_PREFERENCES);

			// Mock askClaude to return empty insights
			(askClaude as any).mockResolvedValue(
				JSON.stringify({
					emotionalSignals: [],
					lifestyleSignals: [],
					maturitySignals: [],
					boundaries: [],
					dealbreakers: [],
					privateCompatibilityNotes: []
				})
			);

			const result = await autoUpdatePreferencesProfile(
				TEST_USER_ID,
				TEST_USER_MESSAGES,
				TEST_MATCH_MESSAGES,
				TEST_USER_PROFILE,
				TEST_BOOK_CONTEXT
			);

			expect(result).toBe(false);
			expect(profileService.updatePreferences).not.toHaveBeenCalled();
		});

		it('should handle errors gracefully', async () => {
			(profileService.loadPreferences as any).mockRejectedValue(new Error('Load failed'));

			const result = await autoUpdatePreferencesProfile(
				TEST_USER_ID,
				TEST_USER_MESSAGES,
				TEST_MATCH_MESSAGES,
				TEST_USER_PROFILE,
				TEST_BOOK_CONTEXT
			);

			expect(result).toBe(false);
		});

		it('should include match name in update reason', async () => {
			(profileService.loadPreferences as any).mockResolvedValue(TEST_PREFERENCES);
			(profileService.updatePreferences as any).mockResolvedValue(undefined);

			(askClaude as any).mockResolvedValue(
				JSON.stringify({
					emotionalSignals: ['New signal'],
					lifestyleSignals: [],
					maturitySignals: [],
					boundaries: [],
					dealbreakers: [],
					privateCompatibilityNotes: []
				})
			);

			await autoUpdatePreferencesProfile(
				TEST_USER_ID,
				TEST_USER_MESSAGES,
				TEST_MATCH_MESSAGES,
				TEST_USER_PROFILE,
				TEST_BOOK_CONTEXT,
				'Alice'
			);

			expect(profileService.updatePreferences).toHaveBeenCalledWith(
				TEST_USER_ID,
				expect.any(Object),
				'Extracted from conversation with Alice'
			);
		});
	});

	describe('autoUpdatePersonalityProfile', () => {
		it('should auto-update personality profile', async () => {
			(profileService.loadPersonality as any).mockResolvedValue(TEST_PERSONALITY);
			(profileService.updatePersonality as any).mockResolvedValue(undefined);

			(askClaude as any).mockResolvedValue(
				JSON.stringify({
					communicationStyle: 'playful',
					personalityVibe: 'ambitious',
					mattersMost: 'humor',
					values: ['New value'],
					datingPatterns: ['New pattern'],
					redFlagsToAvoid: []
				})
			);

			const result = await autoUpdatePersonalityProfile(
				TEST_USER_ID,
				TEST_USER_MESSAGES,
				TEST_MATCH_MESSAGES,
				TEST_MALE_PROFILE,
				TEST_BOOK_CONTEXT,
				'Sarah'
			);

			expect(result).toBe(true);
			expect(profileService.updatePersonality).toHaveBeenCalledWith(
				TEST_USER_ID,
				expect.objectContaining({
					communicationStyle: 'playful',
					values: expect.any(Array),
					datingPatterns: expect.any(Array)
				}),
				'Extracted from conversation with Sarah'
			);
		});

		it('should return false if no insights extracted', async () => {
			(profileService.loadPersonality as any).mockResolvedValue(TEST_PERSONALITY);

			(askClaude as any).mockResolvedValue(
				JSON.stringify({
					communicationStyle: 'direct',
					personalityVibe: 'ambitious',
					mattersMost: 'humor',
					values: [],
					datingPatterns: [],
					redFlagsToAvoid: []
				})
			);

			const result = await autoUpdatePersonalityProfile(
				TEST_USER_ID,
				TEST_USER_MESSAGES,
				TEST_MATCH_MESSAGES,
				TEST_MALE_PROFILE,
				TEST_BOOK_CONTEXT
			);

			expect(result).toBe(false);
			expect(profileService.updatePersonality).not.toHaveBeenCalled();
		});

		it('should handle errors gracefully', async () => {
			(profileService.loadPersonality as any).mockRejectedValue(new Error('Load failed'));

			const result = await autoUpdatePersonalityProfile(
				TEST_USER_ID,
				TEST_USER_MESSAGES,
				TEST_MATCH_MESSAGES,
				TEST_MALE_PROFILE,
				TEST_BOOK_CONTEXT
			);

			expect(result).toBe(false);
		});

		it('should prioritize user insights for scalar fields', async () => {
			(profileService.loadPersonality as any).mockResolvedValue(TEST_PERSONALITY);
			(profileService.updatePersonality as any).mockResolvedValue(undefined);

			// First call for user insights, second for match insights
			(askClaude as any)
				.mockResolvedValueOnce(
					JSON.stringify({
						communicationStyle: 'playful',
						personalityVibe: 'chill',
						mattersMost: 'humor',
						values: [],
						datingPatterns: [],
						redFlagsToAvoid: []
					})
				)
				.mockResolvedValueOnce(
					JSON.stringify({
						values: [],
						datingPatterns: [],
						redFlagsToAvoid: []
					})
				);

			await autoUpdatePersonalityProfile(
				TEST_USER_ID,
				TEST_USER_MESSAGES,
				TEST_MATCH_MESSAGES,
				TEST_MALE_PROFILE,
				TEST_BOOK_CONTEXT
			);

			// User insights should be used for scalar fields
			expect(profileService.updatePersonality).toHaveBeenCalledWith(
				TEST_USER_ID,
				expect.objectContaining({
					communicationStyle: 'playful',
					personalityVibe: 'chill'
				}),
				expect.any(String)
			);
		});
	});

	describe('Deduplication logic', () => {
		it('should handle case-insensitive deduplication', async () => {
			const mockResponse = JSON.stringify({
				emotionalSignals: ['ASKS ABOUT MY DAY', 'Shows vulnerability'],
				lifestyleSignals: [],
				maturitySignals: [],
				boundaries: [],
				dealbreakers: [],
				privateCompatibilityNotes: []
			});

			(askClaude as any).mockResolvedValue(mockResponse);

			const result = await extractUserMessageInsights(
				TEST_USER_MESSAGES,
				TEST_PREFERENCES,
				TEST_USER_PROFILE,
				TEST_BOOK_CONTEXT
			);

			// 'ASKS ABOUT MY DAY' should be deduplicated with 'Asks about my day'
			expect(result.emotionalSignals).not.toContain('ASKS ABOUT MY DAY');
		});

		it('should handle substring matching for deduplication', async () => {
			const mockResponse = JSON.stringify({
				emotionalSignals: ['Asks about my day and remembers details'],
				lifestyleSignals: [],
				maturitySignals: [],
				boundaries: [],
				dealbreakers: [],
				privateCompatibilityNotes: []
			});

			(askClaude as any).mockResolvedValue(mockResponse);

			const result = await extractUserMessageInsights(
				TEST_USER_MESSAGES,
				TEST_PREFERENCES,
				TEST_USER_PROFILE,
				TEST_BOOK_CONTEXT
			);

			// Should be deduplicated because it contains 'Asks about my day'
			if (result.emotionalSignals) {
				expect(result.emotionalSignals.filter(s => s === 'Asks about my day and remembers details').length).toBe(0);
			}
		});
	});

	describe('Empty and edge cases', () => {
		it('should handle empty user messages', async () => {
			const result = await extractUserMessageInsights(
				[],
				TEST_PREFERENCES,
				TEST_USER_PROFILE,
				TEST_BOOK_CONTEXT
			);

			expect(result).toEqual({});
		});

		it('should handle null user profile', async () => {
			const mockResponse = JSON.stringify({
				emotionalSignals: ['New signal'],
				lifestyleSignals: [],
				maturitySignals: [],
				boundaries: [],
				dealbreakers: [],
				privateCompatibilityNotes: []
			});

			(askClaude as any).mockResolvedValue(mockResponse);

			const result = await extractUserMessageInsights(
				TEST_USER_MESSAGES,
				TEST_PREFERENCES,
				null,
				TEST_BOOK_CONTEXT
			);

			expect(result.emotionalSignals).toBeDefined();
			expect(askClaude).toHaveBeenCalled();
		});

		it('should handle empty preferences profile', async () => {
			const emptyPreferences: PreferencesProfile = {
				emotionalSignals: [],
				lifestyleSignals: [],
				maturitySignals: [],
				boundaries: [],
				dealbreakers: [],
				privateCompatibilityNotes: [],
				updatedAt: Date.now()
			};

			const mockResponse = JSON.stringify({
				emotionalSignals: ['New signal'],
				lifestyleSignals: [],
				maturitySignals: [],
				boundaries: [],
				dealbreakers: [],
				privateCompatibilityNotes: []
			});

			(askClaude as any).mockResolvedValue(mockResponse);

			const result = await extractUserMessageInsights(
				TEST_USER_MESSAGES,
				emptyPreferences,
				TEST_USER_PROFILE,
				TEST_BOOK_CONTEXT
			);

			expect(result.emotionalSignals).toContain('New signal');
		});
	});
});
