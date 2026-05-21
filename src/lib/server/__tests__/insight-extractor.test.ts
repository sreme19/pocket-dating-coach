import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	extractEmotionalSignals,
	extractLifestyleSignals,
	extractValues,
	extractRedFlags,
	extractDealbreakers,
	extractCompatibilitySignals,
	extractAllUserInsights,
	extractPersonalityInsights,
	type ExtractedInsights,
	type CompatibilityInsights,
	type PersonalityInsights
} from '../insight-extractor';
import type { ChatMessage, UserProfile } from '../../types';

// Mock the Claude API
vi.mock('../../claude', () => ({
	askClaude: vi.fn()
}));

// Mock the prompts
vi.mock('../../prompts', () => ({
	buildAIBestieSystemPrompt: vi.fn(() => 'Bestie system prompt'),
	buildAIWingmanSystemPrompt: vi.fn(() => 'Wingman system prompt')
}));

import { askClaude } from '../../claude';

describe('Insight Extractor', () => {
	const mockUserProfile: UserProfile = {
		id: 'user-123',
		gender: 'woman',
		ageRange: '25-30',
		datingApp: 'hinge',
		relationshipGoal: 'serious',
		createdAt: Date.now(),
		updatedAt: Date.now()
	};

	const mockUserMessages: ChatMessage[] = [
		{
			id: '1',
			role: 'user',
			content: 'I really value honesty and authenticity in relationships. I need someone who can be vulnerable with me.',
			timestamp: Date.now()
		},
		{
			id: '2',
			role: 'user',
			content: 'I love hiking and traveling. Adventure is really important to me, but I also need stability in my career.',
			timestamp: Date.now()
		}
	];

	const mockMatchMessages: ChatMessage[] = [
		{
			id: '3',
			role: 'assistant',
			content: 'I love hiking too! I just got back from a trip to Colorado. What are your favorite hiking spots?',
			timestamp: Date.now()
		},
		{
			id: '4',
			role: 'assistant',
			content: 'I work in tech and I am really passionate about my career. I think balance is important though.',
			timestamp: Date.now()
		}
	];

	const bookContext = 'Sample book context about dating';

	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('extractEmotionalSignals', () => {
		it('should extract emotional signals from user messages', async () => {
			const mockResponse = JSON.stringify({
				emotionalSignals: [
					'Values vulnerability and emotional openness',
					'Seeks authentic connections',
					'Communicates feelings directly'
				]
			});

			vi.mocked(askClaude).mockResolvedValue(mockResponse);

			const signals = await extractEmotionalSignals(
				mockUserMessages,
				mockUserProfile,
				bookContext,
				'bestie'
			);

			expect(signals).toHaveLength(3);
			expect(signals[0]).toContain('vulnerability');
			expect(askClaude).toHaveBeenCalled();
		});

		it('should return empty array if not enough messages', async () => {
			const signals = await extractEmotionalSignals(
				[mockUserMessages[0]],
				mockUserProfile,
				bookContext,
				'bestie',
				{ minMessagesForExtraction: 3 }
			);

			expect(signals).toEqual([]);
			expect(askClaude).not.toHaveBeenCalled();
		});

		it('should handle Claude API errors gracefully', async () => {
			vi.mocked(askClaude).mockRejectedValue(new Error('API Error'));

			const signals = await extractEmotionalSignals(
				mockUserMessages,
				mockUserProfile,
				bookContext,
				'bestie'
			);

			expect(signals).toEqual([]);
		});

		it('should handle invalid JSON response', async () => {
			vi.mocked(askClaude).mockResolvedValue('Invalid JSON');

			const signals = await extractEmotionalSignals(
				mockUserMessages,
				mockUserProfile,
				bookContext,
				'bestie'
			);

			expect(signals).toEqual([]);
		});

		it('should respect maxInsightsPerCategory config', async () => {
			const mockResponse = JSON.stringify({
				emotionalSignals: [
					'Signal 1',
					'Signal 2',
					'Signal 3',
					'Signal 4',
					'Signal 5',
					'Signal 6'
				]
			});

			vi.mocked(askClaude).mockResolvedValue(mockResponse);

			const signals = await extractEmotionalSignals(
				mockUserMessages,
				mockUserProfile,
				bookContext,
				'bestie',
				{ maxInsightsPerCategory: 3 }
			);

			expect(signals).toHaveLength(3);
		});
	});

	describe('extractLifestyleSignals', () => {
		it('should extract lifestyle signals from user messages', async () => {
			const mockResponse = JSON.stringify({
				lifestyleSignals: [
					'Active and adventurous',
					'Career-focused',
					'Values work-life balance'
				]
			});

			vi.mocked(askClaude).mockResolvedValue(mockResponse);

			const signals = await extractLifestyleSignals(
				mockUserMessages,
				mockUserProfile,
				bookContext,
				'bestie'
			);

			expect(signals).toHaveLength(3);
			expect(signals[0]).toContain('Active');
		});

		it('should return empty array if not enough messages', async () => {
			const signals = await extractLifestyleSignals(
				[mockUserMessages[0]],
				mockUserProfile,
				bookContext,
				'bestie',
				{ minMessagesForExtraction: 3 }
			);

			expect(signals).toEqual([]);
		});

		it('should handle Claude API errors gracefully', async () => {
			vi.mocked(askClaude).mockRejectedValue(new Error('API Error'));

			const signals = await extractLifestyleSignals(
				mockUserMessages,
				mockUserProfile,
				bookContext,
				'bestie'
			);

			expect(signals).toEqual([]);
		});
	});

	describe('extractValues', () => {
		it('should extract values from user messages', async () => {
			const mockResponse = JSON.stringify({
				values: ['Authenticity', 'Adventure', 'Stability', 'Growth']
			});

			vi.mocked(askClaude).mockResolvedValue(mockResponse);

			const values = await extractValues(
				mockUserMessages,
				mockUserProfile,
				bookContext,
				'bestie'
			);

			expect(values).toHaveLength(4);
			expect(values).toContain('Authenticity');
		});

		it('should return empty array if not enough messages', async () => {
			const values = await extractValues(
				[mockUserMessages[0]],
				mockUserProfile,
				bookContext,
				'bestie',
				{ minMessagesForExtraction: 3 }
			);

			expect(values).toEqual([]);
		});

		it('should handle Claude API errors gracefully', async () => {
			vi.mocked(askClaude).mockRejectedValue(new Error('API Error'));

			const values = await extractValues(
				mockUserMessages,
				mockUserProfile,
				bookContext,
				'bestie'
			);

			expect(values).toEqual([]);
		});
	});

	describe('extractRedFlags', () => {
		it('should extract red flags from user messages', async () => {
			const mockResponse = JSON.stringify({
				redFlags: [
					'Dismissive of others opinions',
					'Unwilling to compromise',
					'Controlling behavior'
				]
			});

			vi.mocked(askClaude).mockResolvedValue(mockResponse);

			const flags = await extractRedFlags(
				mockUserMessages,
				mockUserProfile,
				bookContext,
				'bestie'
			);

			expect(flags).toHaveLength(3);
			expect(flags[0]).toContain('Dismissive');
		});

		it('should return empty array if not enough messages', async () => {
			const flags = await extractRedFlags(
				[mockUserMessages[0]],
				mockUserProfile,
				bookContext,
				'bestie',
				{ minMessagesForExtraction: 3 }
			);

			expect(flags).toEqual([]);
		});

		it('should handle Claude API errors gracefully', async () => {
			vi.mocked(askClaude).mockRejectedValue(new Error('API Error'));

			const flags = await extractRedFlags(
				mockUserMessages,
				mockUserProfile,
				bookContext,
				'bestie'
			);

			expect(flags).toEqual([]);
		});
	});

	describe('extractDealbreakers', () => {
		it('should extract dealbreakers from user messages', async () => {
			const mockResponse = JSON.stringify({
				dealbreakers: [
					'Disrespect to service workers',
					'Still hung up on ex',
					'Unwilling to discuss future'
				]
			});

			vi.mocked(askClaude).mockResolvedValue(mockResponse);

			const dealbreakers = await extractDealbreakers(
				mockUserMessages,
				mockUserProfile,
				bookContext,
				'bestie'
			);

			expect(dealbreakers).toHaveLength(3);
			expect(dealbreakers[0]).toContain('Disrespect');
		});

		it('should return empty array if not enough messages', async () => {
			const dealbreakers = await extractDealbreakers(
				[mockUserMessages[0]],
				mockUserProfile,
				bookContext,
				'bestie',
				{ minMessagesForExtraction: 3 }
			);

			expect(dealbreakers).toEqual([]);
		});

		it('should handle Claude API errors gracefully', async () => {
			vi.mocked(askClaude).mockRejectedValue(new Error('API Error'));

			const dealbreakers = await extractDealbreakers(
				mockUserMessages,
				mockUserProfile,
				bookContext,
				'bestie'
			);

			expect(dealbreakers).toEqual([]);
		});
	});

	describe('extractCompatibilitySignals', () => {
		it('should extract compatibility signals from match messages', async () => {
			const mockResponse = JSON.stringify({
				greenFlags: [
					{ signal: 'Shares hiking interest', reason: 'Shows common interests' },
					{ signal: 'Career-focused', reason: 'Values stability' }
				],
				yellowFlags: [
					{ signal: 'Tech industry', reason: 'May have demanding schedule' }
				],
				redFlags: [],
				dealbreakers: [],
				overallAssessment: 'This looks promising! Good compatibility so far.'
			});

			vi.mocked(askClaude).mockResolvedValue(mockResponse);

			const signals = await extractCompatibilitySignals(
				mockMatchMessages,
				mockUserProfile,
				bookContext,
				undefined,
				'bestie'
			);

			expect(signals.greenFlags).toHaveLength(2);
			expect(signals.yellowFlags).toHaveLength(1);
			expect(signals.redFlags).toHaveLength(0);
			expect(signals.overallAssessment).toContain('promising');
		});

		it('should return empty signals if not enough messages', async () => {
			const signals = await extractCompatibilitySignals(
				[mockMatchMessages[0]],
				mockUserProfile,
				bookContext,
				undefined,
				'bestie',
				{ minMessagesForExtraction: 3 }
			);

			expect(signals.greenFlags).toEqual([]);
			expect(signals.yellowFlags).toEqual([]);
			expect(signals.redFlags).toEqual([]);
			expect(signals.dealbreakers).toEqual([]);
		});

		it('should handle Claude API errors gracefully', async () => {
			vi.mocked(askClaude).mockRejectedValue(new Error('API Error'));

			const signals = await extractCompatibilitySignals(
				mockMatchMessages,
				mockUserProfile,
				bookContext,
				undefined,
				'bestie'
			);

			expect(signals.greenFlags).toEqual([]);
			expect(signals.redFlags).toEqual([]);
		});

		it('should handle invalid JSON response', async () => {
			vi.mocked(askClaude).mockResolvedValue('Invalid JSON');

			const signals = await extractCompatibilitySignals(
				mockMatchMessages,
				mockUserProfile,
				bookContext,
				undefined,
				'bestie'
			);

			expect(signals.greenFlags).toEqual([]);
			expect(signals.overallAssessment).toContain('Unable to analyze');
		});

		it('should respect maxInsightsPerCategory config', async () => {
			const mockResponse = JSON.stringify({
				greenFlags: [
					{ signal: 'Flag 1', reason: 'Reason 1' },
					{ signal: 'Flag 2', reason: 'Reason 2' },
					{ signal: 'Flag 3', reason: 'Reason 3' },
					{ signal: 'Flag 4', reason: 'Reason 4' }
				],
				yellowFlags: [],
				redFlags: [],
				dealbreakers: [],
				overallAssessment: 'Good'
			});

			vi.mocked(askClaude).mockResolvedValue(mockResponse);

			const signals = await extractCompatibilitySignals(
				mockMatchMessages,
				mockUserProfile,
				bookContext,
				undefined,
				'bestie',
				{ maxInsightsPerCategory: 2 }
			);

			expect(signals.greenFlags).toHaveLength(2);
		});
	});

	describe('extractAllUserInsights', () => {
		it('should extract all user insights in parallel', async () => {
			const mockResponse = JSON.stringify({
				emotionalSignals: ['Signal 1'],
				lifestyleSignals: ['Signal 2'],
				values: ['Value 1'],
				redFlags: ['Flag 1'],
				dealbreakers: ['Dealbreaker 1']
			});

			vi.mocked(askClaude).mockResolvedValue(mockResponse);

			const insights = await extractAllUserInsights(
				mockUserMessages,
				mockUserProfile,
				bookContext,
				'bestie'
			);

			expect(insights.emotionalSignals).toBeDefined();
			expect(insights.lifestyleSignals).toBeDefined();
			expect(insights.values).toBeDefined();
			expect(insights.redFlags).toBeDefined();
			expect(insights.dealbreakers).toBeDefined();
			// Should call askClaude 5 times (one for each insight type)
			expect(askClaude).toHaveBeenCalledTimes(5);
		});

		it('should return empty insights if not enough messages', async () => {
			const insights = await extractAllUserInsights(
				[mockUserMessages[0]],
				mockUserProfile,
				bookContext,
				'bestie',
				{ minMessagesForExtraction: 3 }
			);

			expect(insights.emotionalSignals).toEqual([]);
			expect(insights.lifestyleSignals).toEqual([]);
			expect(insights.values).toEqual([]);
			expect(insights.redFlags).toEqual([]);
			expect(insights.dealbreakers).toEqual([]);
		});

		it('should handle partial failures gracefully', async () => {
			vi.mocked(askClaude)
				.mockResolvedValueOnce(JSON.stringify({ emotionalSignals: ['Signal 1'] }))
				.mockRejectedValueOnce(new Error('API Error'))
				.mockResolvedValueOnce(JSON.stringify({ values: ['Value 1'] }))
				.mockRejectedValueOnce(new Error('API Error'))
				.mockResolvedValueOnce(JSON.stringify({ dealbreakers: ['Dealbreaker 1'] }));

			const insights = await extractAllUserInsights(
				mockUserMessages,
				mockUserProfile,
				bookContext,
				'bestie'
			);

			expect(insights.emotionalSignals).toHaveLength(1);
			expect(insights.lifestyleSignals).toEqual([]);
			expect(insights.values).toHaveLength(1);
			expect(insights.redFlags).toEqual([]);
			expect(insights.dealbreakers).toHaveLength(1);
		});
	});

	describe('extractPersonalityInsights', () => {
		it('should extract personality insights from user messages', async () => {
			const mockResponse = JSON.stringify({
				communicationStyle: 'direct',
				personalityVibe: 'ambitious',
				mattersMost: 'authenticity',
				values: ['Growth', 'Loyalty', 'Humor'],
				datingPatterns: ['Prefers genuine conversation', 'Moves quickly to meeting'],
				redFlagsToAvoid: ['Overly focused on appearance', 'Dismissive of career']
			});

			vi.mocked(askClaude).mockResolvedValue(mockResponse);

			const insights = await extractPersonalityInsights(
				mockUserMessages,
				mockUserProfile,
				bookContext
			);

			expect(insights.communicationStyle).toBe('direct');
			expect(insights.personalityVibe).toBe('ambitious');
			expect(insights.mattersMost).toBe('authenticity');
			expect(insights.values).toHaveLength(3);
			expect(insights.datingPatterns).toHaveLength(2);
			expect(insights.redFlagsToAvoid).toHaveLength(2);
		});

		it('should return empty insights if not enough messages', async () => {
			const insights = await extractPersonalityInsights(
				[mockUserMessages[0]],
				mockUserProfile,
				bookContext,
				{ minMessagesForExtraction: 3 }
			);

			expect(insights.communicationStyle).toBe('');
			expect(insights.personalityVibe).toBe('');
			expect(insights.mattersMost).toBe('');
			expect(insights.values).toEqual([]);
			expect(insights.datingPatterns).toEqual([]);
			expect(insights.redFlagsToAvoid).toEqual([]);
		});

		it('should handle Claude API errors gracefully', async () => {
			vi.mocked(askClaude).mockRejectedValue(new Error('API Error'));

			const insights = await extractPersonalityInsights(
				mockUserMessages,
				mockUserProfile,
				bookContext
			);

			expect(insights.communicationStyle).toBe('');
			expect(insights.values).toEqual([]);
		});

		it('should handle invalid JSON response', async () => {
			vi.mocked(askClaude).mockResolvedValue('Invalid JSON');

			const insights = await extractPersonalityInsights(
				mockUserMessages,
				mockUserProfile,
				bookContext
			);

			expect(insights.communicationStyle).toBe('');
			expect(insights.values).toEqual([]);
		});

		it('should respect maxInsightsPerCategory config', async () => {
			const mockResponse = JSON.stringify({
				communicationStyle: 'direct',
				personalityVibe: 'ambitious',
				mattersMost: 'authenticity',
				values: ['Value 1', 'Value 2', 'Value 3', 'Value 4'],
				datingPatterns: ['Pattern 1', 'Pattern 2', 'Pattern 3'],
				redFlagsToAvoid: ['Flag 1', 'Flag 2']
			});

			vi.mocked(askClaude).mockResolvedValue(mockResponse);

			const insights = await extractPersonalityInsights(
				mockUserMessages,
				mockUserProfile,
				bookContext,
				{ maxInsightsPerCategory: 2 }
			);

			expect(insights.values).toHaveLength(2);
			expect(insights.datingPatterns).toHaveLength(2);
		});
	});

	describe('Edge cases and error handling', () => {
		it('should handle empty message array', async () => {
			const signals = await extractEmotionalSignals([], mockUserProfile, bookContext, 'bestie');
			expect(signals).toEqual([]);
		});

		it('should handle null user profile', async () => {
			const mockResponse = JSON.stringify({
				emotionalSignals: ['Signal 1']
			});

			vi.mocked(askClaude).mockResolvedValue(mockResponse);

			const signals = await extractEmotionalSignals(
				mockUserMessages,
				null,
				bookContext,
				'bestie'
			);

			expect(signals).toHaveLength(1);
		});

		it('should handle missing JSON in response', async () => {
			vi.mocked(askClaude).mockResolvedValue('No JSON here');

			const signals = await extractEmotionalSignals(
				mockUserMessages,
				mockUserProfile,
				bookContext,
				'bestie'
			);

			expect(signals).toEqual([]);
		});

		it('should handle malformed JSON', async () => {
			vi.mocked(askClaude).mockResolvedValue('{ invalid json }');

			const signals = await extractEmotionalSignals(
				mockUserMessages,
				mockUserProfile,
				bookContext,
				'bestie'
			);

			expect(signals).toEqual([]);
		});

		it('should handle response with missing fields', async () => {
			const mockResponse = JSON.stringify({
				emotionalSignals: ['Signal 1']
				// Missing other fields
			});

			vi.mocked(askClaude).mockResolvedValue(mockResponse);

			const signals = await extractCompatibilitySignals(
				mockMatchMessages,
				mockUserProfile,
				bookContext,
				undefined,
				'bestie'
			);

			expect(signals.greenFlags).toEqual([]);
			expect(signals.yellowFlags).toEqual([]);
		});

		it('should handle non-array fields in response', async () => {
			const mockResponse = JSON.stringify({
				emotionalSignals: 'not an array'
			});

			vi.mocked(askClaude).mockResolvedValue(mockResponse);

			const signals = await extractEmotionalSignals(
				mockUserMessages,
				mockUserProfile,
				bookContext,
				'bestie'
			);

			expect(signals).toEqual([]);
		});
	});

	describe('Configuration options', () => {
		it('should respect minMessagesForExtraction config', async () => {
			const signals = await extractEmotionalSignals(
				[mockUserMessages[0]],
				mockUserProfile,
				bookContext,
				'bestie',
				{ minMessagesForExtraction: 5 }
			);

			expect(signals).toEqual([]);
			expect(askClaude).not.toHaveBeenCalled();
		});

		it('should respect maxInsightsPerCategory config', async () => {
			const mockResponse = JSON.stringify({
				emotionalSignals: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8']
			});

			vi.mocked(askClaude).mockResolvedValue(mockResponse);

			const signals = await extractEmotionalSignals(
				mockUserMessages,
				mockUserProfile,
				bookContext,
				'bestie',
				{ maxInsightsPerCategory: 3 }
			);

			expect(signals).toHaveLength(3);
		});

		it('should use default config when not provided', async () => {
			const mockResponse = JSON.stringify({
				emotionalSignals: ['Signal 1']
			});

			vi.mocked(askClaude).mockResolvedValue(mockResponse);

			const signals = await extractEmotionalSignals(
				mockUserMessages,
				mockUserProfile,
				bookContext,
				'bestie'
			);

			expect(signals).toHaveLength(1);
		});
	});

	describe('Assistant type handling', () => {
		it('should use bestie system prompt for bestie assistant type', async () => {
			const mockResponse = JSON.stringify({
				emotionalSignals: ['Signal 1']
			});

			vi.mocked(askClaude).mockResolvedValue(mockResponse);

			await extractEmotionalSignals(
				mockUserMessages,
				mockUserProfile,
				bookContext,
				'bestie'
			);

			expect(askClaude).toHaveBeenCalled();
		});

		it('should use wingman system prompt for wingman assistant type', async () => {
			const mockResponse = JSON.stringify({
				emotionalSignals: ['Signal 1']
			});

			vi.mocked(askClaude).mockResolvedValue(mockResponse);

			await extractEmotionalSignals(
				mockUserMessages,
				mockUserProfile,
				bookContext,
				'wingman'
			);

			expect(askClaude).toHaveBeenCalled();
		});
	});
});
