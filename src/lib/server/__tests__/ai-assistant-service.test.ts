import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	generateResponse,
	generateResponseOptions,
	analyzeMatchCompatibility,
	autoUpdateProfile,
	extractCitationsFromResponse,
	type MatchContext,
	type AIAssistantResponse,
	type CompatibilityAnalysis,
	type ResponseOption
} from '../ai-assistant-service';
import { loadPreferences, loadPersonality, updatePreferences, updatePersonality } from '../profile-service';
import { askClaude } from '../../claude';
import type { UserProfile, ChatMessage } from '../../types';
import type { PreferencesProfile, PersonalityProfile } from '../profile-service';

/**
 * Unit Tests for AI Assistant Service
 * 
 * These tests verify that the AI Assistant Service correctly:
 * 1. Generates responses with citations from Claude
 * 2. Generates 2-3 response options for user selection
 * 3. Analyzes match compatibility and identifies flags
 * 4. Auto-updates user profiles based on conversation insights
 * 5. Extracts citations from Claude responses
 * 
 * **Validates: Requirements 3.1, 3.2, 4.1, 4.2, 5.1, 5.2**
 */

// Mock dependencies
vi.mock('../../claude');
vi.mock('../profile-service');

// Test data
const TEST_USER_ID = 'test-user-123';
const TEST_USER_PROFILE: UserProfile = {
	gender: 'woman',
	ageRange: '25-30',
	datingApp: 'hinge',
	relationshipGoal: 'serious'
};

const TEST_MALE_PROFILE: UserProfile = {
	gender: 'man',
	ageRange: '26-31',
	datingApp: 'hinge',
	relationshipGoal: 'serious'
};

const TEST_PREFERENCES: PreferencesProfile = {
	emotionalSignals: ['Asks about my day', 'Shows vulnerability'],
	lifestyleSignals: ['Active and outdoorsy', 'Values travel'],
	maturitySignals: ['Takes responsibility', 'Has long-term goals'],
	boundaries: ['No excessive drinking', 'Respectful of my time'],
	dealbreakers: ['Disrespectful to service workers', 'Still hung up on ex'],
	privateCompatibilityNotes: ['Seems like he values independence'],
	updatedAt: Date.now()
};

const TEST_PERSONALITY: PersonalityProfile = {
	communicationStyle: 'direct',
	personalityVibe: 'ambitious',
	mattersMost: 'humor',
	values: ['Authenticity', 'Growth mindset', 'Loyalty'],
	datingPatterns: ['Prefers genuine conversation', 'Moves quickly from messaging to meeting'],
	redFlagsToAvoid: ['Overly focused on appearance', 'Dismissive of my career'],
	updatedAt: Date.now()
};

const TEST_CHAT_MESSAGES: ChatMessage[] = [
	{
		id: '1',
		role: 'user',
		content: 'Hey! How was your day?',
		timestamp: Date.now() - 10000
	},
	{
		id: '2',
		role: 'assistant',
		content: 'It was great! I went hiking this morning.',
		timestamp: Date.now() - 5000
	}
];

const TEST_MATCH_CONTEXT: MatchContext = {
	matchedUserProfile: {
		gender: 'man',
		ageRange: '26-31',
		datingApp: 'hinge',
		relationshipGoal: 'serious'
	},
	recentMessages: TEST_CHAT_MESSAGES,
	conversationDuration: 3600000,
	messageCount: 15
};

const TEST_BOOK_CONTEXT = 'Chapter 1: Understanding Dating Principles...';

describe('AI Assistant Service', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('generateResponse', () => {
		it('should generate a response with citations for AI Bestie', async () => {
			const userMessage = 'He asked me out for coffee. Should I say yes?';
			const mockResponse =
				'Coffee is a great low-pressure first date! *Based on: Chapter 2 - First Date Strategy* He seems genuinely interested.';

			(askClaude as any).mockResolvedValue(mockResponse);

			const result = await generateResponse(
				'bestie',
				userMessage,
				TEST_CHAT_MESSAGES,
				TEST_USER_PROFILE,
				TEST_MATCH_CONTEXT,
				TEST_BOOK_CONTEXT,
				TEST_PREFERENCES
			);

			expect(result).toEqual({
				reply: mockResponse,
				citations: ['Chapter 2 - First Date Strategy']
			});
			expect(askClaude).toHaveBeenCalled();
		});

		it('should generate a response with citations for AI Wingman', async () => {
			const userMessage = 'She asked what I am looking for. How should I respond?';
			const mockResponse =
				'Be honest and specific. *Based on: Chapter 3 - Authentic Communication* Show vulnerability.';

			(askClaude as any).mockResolvedValue(mockResponse);

			const result = await generateResponse(
				'wingman',
				userMessage,
				TEST_CHAT_MESSAGES,
				TEST_MALE_PROFILE,
				TEST_MATCH_CONTEXT,
				TEST_BOOK_CONTEXT,
				TEST_PERSONALITY
			);

			expect(result).toEqual({
				reply: mockResponse,
				citations: ['Chapter 3 - Authentic Communication']
			});
		});

		it('should handle multiple citations in response', async () => {
			const userMessage = 'What should I do next?';
			const mockResponse =
				'First, *Based on: Chapter 1 - Principles* be authentic. Second, *Based on: Chapter 2 - Strategy* move to meeting.';

			(askClaude as any).mockResolvedValue(mockResponse);

			const result = await generateResponse(
				'bestie',
				userMessage,
				TEST_CHAT_MESSAGES,
				TEST_USER_PROFILE,
				TEST_MATCH_CONTEXT,
				TEST_BOOK_CONTEXT,
				TEST_PREFERENCES
			);

			expect(result.citations).toHaveLength(2);
			expect(result.citations).toContain('Chapter 1 - Principles');
			expect(result.citations).toContain('Chapter 2 - Strategy');
		});

		it('should handle response without citations', async () => {
			const userMessage = 'What should I do?';
			const mockResponse = 'Just be yourself and have fun!';

			(askClaude as any).mockResolvedValue(mockResponse);

			const result = await generateResponse(
				'bestie',
				userMessage,
				TEST_CHAT_MESSAGES,
				TEST_USER_PROFILE,
				TEST_MATCH_CONTEXT,
				TEST_BOOK_CONTEXT,
				TEST_PREFERENCES
			);

			expect(result.citations).toEqual([]);
		});

		it('should include match context in the prompt', async () => {
			const userMessage = 'What do you think?';
			(askClaude as any).mockResolvedValue('Great question! *Based on: Chapter 1*');

			await generateResponse(
				'bestie',
				userMessage,
				TEST_CHAT_MESSAGES,
				TEST_USER_PROFILE,
				TEST_MATCH_CONTEXT,
				TEST_BOOK_CONTEXT,
				TEST_PREFERENCES
			);

			const callArgs = (askClaude as any).mock.calls[0];
			expect(callArgs[1]).toContain(userMessage);
			expect(callArgs[1]).toContain('Hey! How was your day?'); // From recent messages
		});
	});

	describe('generateResponseOptions', () => {
		it('should generate 3 response options with tones', async () => {
			const matchLastMessage = 'I love hiking too! Want to go this weekend?';
			const mockResponse = `[
				{
					"tone": "playful",
					"message": "That sounds amazing! I'm in!",
					"why": "Shows enthusiasm and matches his energy",
					"citation": "Based on: Chapter 2 - Matching Energy"
				},
				{
					"tone": "warm",
					"message": "I'd love to! What did you have in mind?",
					"why": "Shows interest while asking for details",
					"citation": "Based on: Chapter 3 - Building Connection"
				},
				{
					"tone": "direct",
					"message": "Yes, let's do it. When and where?",
					"why": "Clear and decisive",
					"citation": "Based on: Chapter 1 - Clarity"
				}
			]`;

			(askClaude as any).mockResolvedValue(mockResponse);

			const result = await generateResponseOptions(
				'bestie',
				matchLastMessage,
				TEST_CHAT_MESSAGES,
				TEST_USER_PROFILE,
				TEST_MATCH_CONTEXT,
				TEST_BOOK_CONTEXT,
				TEST_PREFERENCES
			);

			expect(result).toHaveLength(3);
			expect(result[0].tone).toBe('playful');
			expect(result[1].tone).toBe('warm');
			expect(result[2].tone).toBe('direct');
			expect(result[0].message).toBeTruthy();
			expect(result[0].why).toBeTruthy();
			expect(result[0].citation).toBeTruthy();
		});

		it('should handle malformed JSON response gracefully', async () => {
			const matchLastMessage = 'What do you think?';
			const mockResponse = 'This is not valid JSON';

			(askClaude as any).mockResolvedValue(mockResponse);

			const result = await generateResponseOptions(
				'bestie',
				matchLastMessage,
				TEST_CHAT_MESSAGES,
				TEST_USER_PROFILE,
				TEST_MATCH_CONTEXT,
				TEST_BOOK_CONTEXT,
				TEST_PREFERENCES
			);

			expect(result).toEqual([]);
		});

		it('should extract JSON from response with surrounding text', async () => {
			const matchLastMessage = 'What do you think?';
			const mockResponse = `Here are some options:
[
	{
		"tone": "playful",
		"message": "That sounds fun!",
		"why": "Shows enthusiasm",
		"citation": "Based on: Chapter 1"
	}
]
Hope this helps!`;

			(askClaude as any).mockResolvedValue(mockResponse);

			const result = await generateResponseOptions(
				'bestie',
				matchLastMessage,
				TEST_CHAT_MESSAGES,
				TEST_USER_PROFILE,
				TEST_MATCH_CONTEXT,
				TEST_BOOK_CONTEXT,
				TEST_PREFERENCES
			);

			expect(result).toHaveLength(1);
			expect(result[0].tone).toBe('playful');
		});

		it('should assign unique IDs to options', async () => {
			const matchLastMessage = 'What do you think?';
			const mockResponse = `[
				{
					"tone": "playful",
					"message": "Option 1",
					"why": "Why 1",
					"citation": "Based on: Chapter 1"
				},
				{
					"tone": "warm",
					"message": "Option 2",
					"why": "Why 2",
					"citation": "Based on: Chapter 2"
				}
			]`;

			(askClaude as any).mockResolvedValue(mockResponse);

			const result = await generateResponseOptions(
				'bestie',
				matchLastMessage,
				TEST_CHAT_MESSAGES,
				TEST_USER_PROFILE,
				TEST_MATCH_CONTEXT,
				TEST_BOOK_CONTEXT,
				TEST_PREFERENCES
			);

			expect(result[0].id).toBe('option-0');
			expect(result[1].id).toBe('option-1');
		});
	});

	describe('analyzeMatchCompatibility', () => {
		it('should identify green, yellow, and red flags', async () => {
			const matchMessage = 'I love hiking and travel. I value authenticity and genuine connection.';
			const mockResponse = `{
				"greenFlags": [
					{
						"signal": "Values authenticity",
						"reason": "Aligns with your preference for genuine connection"
					},
					{
						"signal": "Active lifestyle",
						"reason": "Matches your lifestyle signals"
					}
				],
				"yellowFlags": [
					{
						"signal": "Mentions travel early",
						"reason": "Could indicate expensive lifestyle preferences"
					}
				],
				"redFlags": [],
				"overallAssessment": "This looks very promising! He seems aligned with your values.",
				"citations": ["Based on: Compatibility Signals"]
			}`;

			(askClaude as any).mockResolvedValue(mockResponse);

			const result = await analyzeMatchCompatibility(
				'bestie',
				matchMessage,
				TEST_PREFERENCES,
				TEST_MATCH_CONTEXT,
				TEST_USER_PROFILE,
				TEST_BOOK_CONTEXT
			);

			expect(result.greenFlags).toHaveLength(2);
			expect(result.yellowFlags).toHaveLength(1);
			expect(result.redFlags).toHaveLength(0);
			expect(result.overallAssessment).toBeTruthy();
			expect(result.citations).toContain('Based on: Compatibility Signals');
		});

		it('should handle response with only red flags', async () => {
			const matchMessage = 'I am still not over my ex. She was amazing.';
			const mockResponse = `{
				"greenFlags": [],
				"yellowFlags": [],
				"redFlags": [
					{
						"signal": "Still hung up on ex",
						"reason": "This is a dealbreaker for you"
					}
				],
				"overallAssessment": "This is a dealbreaker. Move on.",
				"citations": ["Based on: Dealbreaker Detection"]
			}`;

			(askClaude as any).mockResolvedValue(mockResponse);

			const result = await analyzeMatchCompatibility(
				'bestie',
				matchMessage,
				TEST_PREFERENCES,
				TEST_MATCH_CONTEXT,
				TEST_USER_PROFILE,
				TEST_BOOK_CONTEXT
			);

			expect(result.redFlags).toHaveLength(1);
			expect(result.greenFlags).toHaveLength(0);
		});

		it('should handle malformed JSON response gracefully', async () => {
			const matchMessage = 'What do you think?';
			const mockResponse = 'This is not valid JSON';

			(askClaude as any).mockResolvedValue(mockResponse);

			const result = await analyzeMatchCompatibility(
				'bestie',
				matchMessage,
				TEST_PREFERENCES,
				TEST_MATCH_CONTEXT,
				TEST_USER_PROFILE,
				TEST_BOOK_CONTEXT
			);

			expect(result.greenFlags).toEqual([]);
			expect(result.yellowFlags).toEqual([]);
			expect(result.redFlags).toEqual([]);
			expect(result.overallAssessment).toBe('Unable to analyze compatibility at this time.');
		});

		it('should include user preferences in analysis prompt', async () => {
			const matchMessage = 'I love hiking!';
			(askClaude as any).mockResolvedValue(`{
				"greenFlags": [],
				"yellowFlags": [],
				"redFlags": [],
				"overallAssessment": "Good match",
				"citations": []
			}`);

			await analyzeMatchCompatibility(
				'bestie',
				matchMessage,
				TEST_PREFERENCES,
				TEST_MATCH_CONTEXT,
				TEST_USER_PROFILE,
				TEST_BOOK_CONTEXT
			);

			const callArgs = (askClaude as any).mock.calls[0];
			expect(callArgs[1]).toContain('Active and outdoorsy'); // From preferences
			expect(callArgs[1]).toContain('Disrespectful to service workers'); // From dealbreakers
		});
	});

	describe('autoUpdateProfile', () => {
		it('should extract and update preferences for AI Bestie', async () => {
			const conversationHistory: ChatMessage[] = [
				{
					id: '1',
					role: 'user',
					content: 'He seems really ambitious and has clear goals',
					timestamp: Date.now()
				},
				{
					id: '2',
					role: 'assistant',
					content: 'That is great! Ambition is attractive.',
					timestamp: Date.now()
				}
			];

			const mockResponse = `{
				"emotionalSignals": ["Shows ambition", "Has clear goals"],
				"lifestyleSignals": ["Career-focused"],
				"maturitySignals": ["Plans for the future"],
				"boundaries": [],
				"dealbreakers": [],
				"privateCompatibilityNotes": ["He seems really driven"]
			}`;

			(askClaude as any).mockResolvedValue(mockResponse);
			(updatePreferences as any).mockResolvedValue(undefined);

			await autoUpdateProfile(
				'bestie',
				conversationHistory,
				TEST_USER_PROFILE,
				TEST_USER_ID,
				TEST_BOOK_CONTEXT
			);

			expect(updatePreferences).toHaveBeenCalledWith(
				TEST_USER_ID,
				expect.objectContaining({
					emotionalSignals: ['Shows ambition', 'Has clear goals'],
					lifestyleSignals: ['Career-focused'],
					maturitySignals: ['Plans for the future']
				}),
				'Extracted from conversation'
			);
		});

		it('should extract and update personality for AI Wingman', async () => {
			const conversationHistory: ChatMessage[] = [
				{
					id: '1',
					role: 'user',
					content: 'She seems to value humor and authenticity',
					timestamp: Date.now()
				}
			];

			const mockResponse = `{
				"communicationStyle": "playful",
				"personalityVibe": "adventurous",
				"mattersMost": "humor",
				"values": ["Authenticity", "Adventure"],
				"datingPatterns": ["Prefers genuine conversation"],
				"redFlagsToAvoid": ["Overly serious"]
			}`;

			(askClaude as any).mockResolvedValue(mockResponse);
			(updatePersonality as any).mockResolvedValue(undefined);

			await autoUpdateProfile(
				'wingman',
				conversationHistory,
				TEST_MALE_PROFILE,
				TEST_USER_ID,
				TEST_BOOK_CONTEXT
			);

			expect(updatePersonality).toHaveBeenCalledWith(
				TEST_USER_ID,
				expect.objectContaining({
					communicationStyle: 'playful',
					personalityVibe: 'adventurous',
					mattersMost: 'humor'
				}),
				'Extracted from conversation'
			);
		});

		it('should not update profile if conversation is empty', async () => {
			await autoUpdateProfile('bestie', [], TEST_USER_PROFILE, TEST_USER_ID, TEST_BOOK_CONTEXT);

			expect(askClaude).not.toHaveBeenCalled();
			expect(updatePreferences).not.toHaveBeenCalled();
		});

		it('should only update fields with content', async () => {
			const conversationHistory: ChatMessage[] = [
				{
					id: '1',
					role: 'user',
					content: 'He seems nice',
					timestamp: Date.now()
				}
			];

			const mockResponse = `{
				"emotionalSignals": ["Nice"],
				"lifestyleSignals": [],
				"maturitySignals": [],
				"boundaries": [],
				"dealbreakers": [],
				"privateCompatibilityNotes": []
			}`;

			(askClaude as any).mockResolvedValue(mockResponse);
			(updatePreferences as any).mockResolvedValue(undefined);

			await autoUpdateProfile(
				'bestie',
				conversationHistory,
				TEST_USER_PROFILE,
				TEST_USER_ID,
				TEST_BOOK_CONTEXT
			);

			expect(updatePreferences).toHaveBeenCalledWith(
				TEST_USER_ID,
				expect.objectContaining({
					emotionalSignals: ['Nice']
				}),
				'Extracted from conversation'
			);

			// Should not include empty arrays
			const callArgs = (updatePreferences as any).mock.calls[0][1];
			expect(callArgs.lifestyleSignals).toBeUndefined();
		});

		it('should handle malformed JSON response gracefully', async () => {
			const conversationHistory: ChatMessage[] = [
				{
					id: '1',
					role: 'user',
					content: 'He seems nice',
					timestamp: Date.now()
				}
			];

			(askClaude as any).mockResolvedValue('This is not valid JSON');

			// Should not throw
			await autoUpdateProfile(
				'bestie',
				conversationHistory,
				TEST_USER_PROFILE,
				TEST_USER_ID,
				TEST_BOOK_CONTEXT
			);

			expect(updatePreferences).not.toHaveBeenCalled();
		});

		it('should handle update failures gracefully', async () => {
			const conversationHistory: ChatMessage[] = [
				{
					id: '1',
					role: 'user',
					content: 'He seems nice',
					timestamp: Date.now()
				}
			];

			const mockResponse = `{
				"emotionalSignals": ["Nice"],
				"lifestyleSignals": [],
				"maturitySignals": [],
				"boundaries": [],
				"dealbreakers": [],
				"privateCompatibilityNotes": []
			}`;

			(askClaude as any).mockResolvedValue(mockResponse);
			(updatePreferences as any).mockRejectedValue(new Error('Database error'));

			// Should not throw
			await autoUpdateProfile(
				'bestie',
				conversationHistory,
				TEST_USER_PROFILE,
				TEST_USER_ID,
				TEST_BOOK_CONTEXT
			);

			expect(updatePreferences).toHaveBeenCalled();
		});
	});

	describe('extractCitationsFromResponse', () => {
		it('should extract single citation', () => {
			const text = 'This is advice. *Based on: Chapter 1 - Principles*';
			const citations = extractCitationsFromResponse(text);

			expect(citations).toEqual(['Chapter 1 - Principles']);
		});

		it('should extract multiple citations', () => {
			const text =
				'First, *Based on: Chapter 1* do this. Second, *Based on: Chapter 2 - Strategy* do that.';
			const citations = extractCitationsFromResponse(text);

			expect(citations).toHaveLength(2);
			expect(citations).toContain('Chapter 1');
			expect(citations).toContain('Chapter 2 - Strategy');
		});

		it('should not include duplicate citations', () => {
			const text =
				'*Based on: Chapter 1* is important. *Based on: Chapter 1* is really important.';
			const citations = extractCitationsFromResponse(text);

			expect(citations).toEqual(['Chapter 1']);
		});

		it('should handle text without citations', () => {
			const text = 'This is just regular text without any citations.';
			const citations = extractCitationsFromResponse(text);

			expect(citations).toEqual([]);
		});

		it('should trim whitespace from citations', () => {
			const text = 'Advice here. *Based on:   Chapter 1 - Principles   *';
			const citations = extractCitationsFromResponse(text);

			expect(citations).toEqual(['Chapter 1 - Principles']);
		});

		it('should handle citations with special characters', () => {
			const text = 'Advice. *Based on: Chapter 1 - "The Art of Dating"*';
			const citations = extractCitationsFromResponse(text);

			expect(citations).toContain('Chapter 1 - "The Art of Dating"');
		});
	});
});
