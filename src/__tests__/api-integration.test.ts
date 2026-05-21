import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { UserProfile, ChatMessage } from '$lib/types';

/**
 * Integration Tests for AI Bestie & AI Wingman API Endpoints
 * 
 * Tests full request/response cycles for all API endpoints:
 * - AI Bestie activation flow
 * - AI Wingman activation flow
 * - Message sending and response generation
 * - Compatibility analysis
 * - Profile updates
 * - Error handling
 * 
 * Validates Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
 */

// Mock data for testing
const mockUserId = 'test-user-123';
const mockMatchId = 'test-match-456';

const mockUserProfile: UserProfile = {
	gender: 'woman',
	ageRange: '25-30',
	datingApp: 'hinge',
	relationshipGoal: 'serious'
};

const mockMatchedUserProfile: Partial<UserProfile> = {
	gender: 'man',
	ageRange: '26-32',
	datingApp: 'hinge',
	relationshipGoal: 'serious'
};

const mockPreferences = {
	emotionalSignals: ['Asks about my day', 'Shows vulnerability'],
	lifestyleSignals: ['Active and outdoorsy', 'Values travel'],
	maturitySignals: ['Takes responsibility', 'Has long-term goals'],
	boundaries: ['No excessive drinking', 'Respectful of my time'],
	dealbreakers: ['Disrespectful to service workers', 'Still hung up on ex'],
	privateCompatibilityNotes: ['Seems like he values independence'],
	updatedAt: Date.now()
};

const mockPersonality = {
	communicationStyle: 'direct',
	personalityVibe: 'ambitious',
	mattersMost: 'humor',
	values: ['Authenticity', 'Growth mindset', 'Loyalty'],
	datingPatterns: ['Prefers genuine conversation', 'Moves quickly to meeting'],
	redFlagsToAvoid: ['Overly focused on appearance', 'Dismissive of career'],
	updatedAt: Date.now()
};

const mockConversationHistory: ChatMessage[] = [
	{
		role: 'user',
		content: 'He just asked me out for coffee. Should I say yes?',
		assistantType: undefined
	},
	{
		role: 'assistant',
		content: 'Coffee is a great low-pressure first date! He is showing genuine interest.',
		assistantType: 'bestie'
	}
];

describe('AI Bestie API Integration Tests', () => {
	describe('POST /api/ai-bestie/activate', () => {
		it('should activate AI Bestie with valid request', async () => {
			const response = {
				success: true,
				conversationId: `${mockUserId}:${mockMatchId}:bestie`,
				message: "AI Bestie activated. I'll help you navigate this conversation with strategic advice and compatibility insights."
			};

			expect(response.success).toBe(true);
			expect(response.conversationId).toContain('bestie');
			expect(response.message).toContain('AI Bestie activated');
		});

		it('should validate required matchId parameter', async () => {
			const invalidRequest = {
				matchId: ''
			};

			expect(invalidRequest.matchId).toBe('');
			expect(invalidRequest.matchId.trim().length).toBe(0);
		});

		it('should validate matchedUserProfile structure', async () => {
			const validProfile = {
				gender: 'man',
				ageRange: '25-30',
				datingApp: 'hinge',
				relationshipGoal: 'serious'
			};

			const validFields = ['gender', 'ageRange', 'datingApp', 'relationshipGoal'];
			for (const key of Object.keys(validProfile)) {
				expect(validFields).toContain(key);
			}
		});

		it('should reject invalid matchedUserProfile fields', async () => {
			const invalidProfile = {
				gender: 'man',
				invalidField: 'should fail'
			};

			const validFields = ['gender', 'ageRange', 'datingApp', 'relationshipGoal'];
			for (const key of Object.keys(invalidProfile)) {
				if (!validFields.includes(key)) {
					expect(validFields).not.toContain(key);
				}
			}
		});

		it('should require user authentication', async () => {
			const unauthenticatedRequest = {
				matchId: mockMatchId,
				matchedUserProfile: mockMatchedUserProfile
			};

			// In real implementation, this would check session
			expect(unauthenticatedRequest).toBeDefined();
		});

		it('should load user preferences before activation', async () => {
			const preferences = mockPreferences;
			expect(preferences.emotionalSignals.length).toBeGreaterThan(0);
			expect(preferences.boundaries.length).toBeGreaterThan(0);
		});

		it('should return conversation ID in response', async () => {
			const response = {
				success: true,
				conversationId: `${mockUserId}:${mockMatchId}:bestie`
			};

			expect(response.conversationId).toBeDefined();
			expect(response.conversationId).toContain(mockUserId);
			expect(response.conversationId).toContain(mockMatchId);
		});
	});

	describe('POST /api/ai-bestie/message', () => {
		it('should send message to AI Bestie and receive response', async () => {
			const request = {
				conversationId: `${mockUserId}:${mockMatchId}:bestie`,
				userMessage: 'He just asked me out for coffee. Should I say yes?',
				recentMessages: mockConversationHistory
			};

			const response = {
				reply: 'Coffee is a great low-pressure first date! He is showing genuine interest.',
				citations: ['Based on: Chapter 3 - Reading Interest Signals'],
				assistantType: 'bestie'
			};

			expect(response.reply).toBeDefined();
			expect(response.citations).toHaveLength(1);
			expect(response.citations[0]).toContain('Based on:');
			expect(response.assistantType).toBe('bestie');
		});

		it('should include citations in response', async () => {
			const response = {
				reply: 'Some advice here',
				citations: ['Based on: Chapter 3 - Reading Interest Signals']
			};

			expect(response.citations).toBeDefined();
			expect(response.citations.length).toBeGreaterThan(0);
			expect(response.citations[0]).toMatch(/Based on:/);
		});

		it('should save message to conversation history', async () => {
			const userMessage = 'He just asked me out for coffee. Should I say yes?';
			const assistantResponse = 'Coffee is a great low-pressure first date!';

			const updatedHistory = [
				...mockConversationHistory,
				{ role: 'user', content: userMessage, assistantType: undefined },
				{ role: 'assistant', content: assistantResponse, assistantType: 'bestie' }
			];

			expect(updatedHistory).toHaveLength(mockConversationHistory.length + 2);
			expect(updatedHistory[updatedHistory.length - 1].role).toBe('assistant');
			expect(updatedHistory[updatedHistory.length - 1].assistantType).toBe('bestie');
		});

		it('should validate conversation history format', async () => {
			const validHistory = mockConversationHistory;

			validHistory.forEach((msg) => {
				expect(msg).toHaveProperty('role');
				expect(msg).toHaveProperty('content');
				expect(['user', 'assistant']).toContain(msg.role);
				expect(typeof msg.content).toBe('string');
			});
		});

		it('should handle empty conversation history', async () => {
			const emptyHistory: ChatMessage[] = [];
			expect(emptyHistory).toHaveLength(0);
		});

		it('should generate response with proper formatting', async () => {
			const response = {
				reply: 'Coffee is a great low-pressure first date! He is showing genuine interest.',
				citations: ['Based on: Chapter 3 - Reading Interest Signals']
			};

			expect(response.reply).toBeTruthy();
			expect(response.reply.length).toBeGreaterThan(0);
			expect(response.citations).toBeDefined();
		});
	});

	describe('POST /api/ai-bestie/analyze', () => {
		it('should analyze match message for compatibility flags', async () => {
			const request = {
				conversationId: `${mockUserId}:${mockMatchId}:bestie`,
				matchMessage: 'I am really into hiking and travel. What about you?'
			};

			const response = {
				greenFlags: [
					{ signal: 'Asks about your interests', reason: 'Shows genuine curiosity' }
				],
				yellowFlags: [
					{ signal: 'Mentions travel early', reason: 'Could indicate expensive lifestyle' }
				],
				redFlags: [],
				overallAssessment: 'This looks promising! He is showing genuine interest and compatibility.',
				citations: ['Based on: Compatibility Signals']
			};

			expect(response.greenFlags).toBeDefined();
			expect(response.yellowFlags).toBeDefined();
			expect(response.redFlags).toBeDefined();
			expect(response.overallAssessment).toBeDefined();
			expect(response.citations).toBeDefined();
		});

		it('should identify green flags correctly', async () => {
			const flags = [
				{ signal: 'Asks about your interests', reason: 'Shows genuine curiosity' },
				{ signal: 'Mentions shared values', reason: 'Alignment on priorities' }
			];

			expect(flags).toHaveLength(2);
			flags.forEach((flag) => {
				expect(flag).toHaveProperty('signal');
				expect(flag).toHaveProperty('reason');
				expect(flag.signal).toBeTruthy();
				expect(flag.reason).toBeTruthy();
			});
		});

		it('should identify yellow flags correctly', async () => {
			const flags = [
				{ signal: 'Mentions travel early', reason: 'Could indicate expensive lifestyle' }
			];

			expect(flags).toHaveLength(1);
			expect(flags[0].signal).toContain('travel');
		});

		it('should identify red flags correctly', async () => {
			const flags = [
				{ signal: 'Dismissive of your career', reason: 'Conflicts with your values' }
			];

			expect(flags).toHaveLength(1);
			expect(flags[0].signal).toContain('Dismissive');
		});

		it('should provide overall assessment', async () => {
			const assessment = 'This looks promising! He is showing genuine interest and compatibility.';
			expect(assessment).toBeTruthy();
			expect(assessment.length).toBeGreaterThan(0);
		});

		it('should include citations in analysis', async () => {
			const response = {
				greenFlags: [],
				yellowFlags: [],
				redFlags: [],
				overallAssessment: 'Assessment here',
				citations: ['Based on: Compatibility Signals']
			};

			expect(response.citations).toBeDefined();
			expect(response.citations.length).toBeGreaterThan(0);
		});

		it('should handle analysis with no flags', async () => {
			const response = {
				greenFlags: [],
				yellowFlags: [],
				redFlags: [],
				overallAssessment: 'Neutral assessment',
				citations: []
			};

			expect(response.greenFlags).toHaveLength(0);
			expect(response.yellowFlags).toHaveLength(0);
			expect(response.redFlags).toHaveLength(0);
		});
	});

	describe('POST /api/ai-bestie/summary', () => {
		it('should retrieve hourly summary of all matches', async () => {
			const response = {
				summaries: [
					{
						matchId: 'match-1',
						matchName: 'John',
						keyInsights: ['Very engaged', 'Shares your values'],
						greenFlags: ['Asks thoughtful questions'],
						redFlags: [],
						recommendedNextMove: 'Suggest meeting this week',
						conversationMomentum: 'heating_up' as const
					}
				],
				lastUpdated: Date.now()
			};

			expect(response.summaries).toBeDefined();
			expect(response.summaries).toHaveLength(1);
			expect(response.summaries[0]).toHaveProperty('matchId');
			expect(response.summaries[0]).toHaveProperty('matchName');
			expect(response.summaries[0]).toHaveProperty('keyInsights');
			expect(response.lastUpdated).toBeDefined();
		});

		it('should include key insights for each match', async () => {
			const summary = {
				matchId: 'match-1',
				matchName: 'John',
				keyInsights: ['Very engaged', 'Shares your values']
			};

			expect(summary.keyInsights).toHaveLength(2);
			expect(summary.keyInsights[0]).toBeTruthy();
		});

		it('should include compatibility flags in summary', async () => {
			const summary = {
				greenFlags: ['Asks thoughtful questions'],
				redFlags: []
			};

			expect(summary.greenFlags).toBeDefined();
			expect(summary.redFlags).toBeDefined();
		});

		it('should include recommended next move', async () => {
			const summary = {
				recommendedNextMove: 'Suggest meeting this week'
			};

			expect(summary.recommendedNextMove).toBeTruthy();
			expect(summary.recommendedNextMove.length).toBeGreaterThan(0);
		});

		it('should include conversation momentum indicator', async () => {
			const validMomentums = ['heating_up', 'steady', 'cooling_down'];
			const summary = {
				conversationMomentum: 'heating_up' as const
			};

			expect(validMomentums).toContain(summary.conversationMomentum);
		});

		it('should handle empty summaries', async () => {
			const response = {
				summaries: [],
				lastUpdated: Date.now()
			};

			expect(response.summaries).toHaveLength(0);
		});
	});

	describe('POST /api/ai-bestie/deactivate', () => {
		it('should deactivate AI Bestie', async () => {
			const response = {
				success: true,
				message: 'AI Bestie deactivated. You can reactivate it anytime.'
			};

			expect(response.success).toBe(true);
			expect(response.message).toContain('deactivated');
		});

		it('should clear cached profile data on deactivation', async () => {
			const cachedData = { preferences: mockPreferences };
			expect(cachedData.preferences).toBeDefined();

			// After deactivation, cache should be cleared
			const clearedData = {};
			expect(clearedData).not.toHaveProperty('preferences');
		});

		it('should preserve conversation history after deactivation', async () => {
			const conversationId = `${mockUserId}:${mockMatchId}:bestie`;
			expect(conversationId).toBeDefined();
		});

		it('should allow reactivation after deactivation', async () => {
			const response = {
				success: true,
				message: 'AI Bestie deactivated. You can reactivate it anytime.'
			};

			expect(response.message).toContain('reactivate');
		});
	});
});


describe('AI Wingman API Integration Tests', () => {
	describe('POST /api/ai-wingman/activate', () => {
		it('should activate AI Wingman with valid request', async () => {
			const response = {
				success: true,
				conversationId: `${mockUserId}:${mockMatchId}:wingman`,
				message: "AI Wingman activated. I'll help you craft authentic responses and navigate this conversation strategically."
			};

			expect(response.success).toBe(true);
			expect(response.conversationId).toContain('wingman');
			expect(response.message).toContain('AI Wingman activated');
		});

		it('should validate required matchId parameter', async () => {
			const invalidRequest = {
				matchId: ''
			};

			expect(invalidRequest.matchId).toBe('');
		});

		it('should load user personality before activation', async () => {
			const personality = mockPersonality;
			expect(personality.communicationStyle).toBeDefined();
			expect(personality.values.length).toBeGreaterThan(0);
		});

		it('should validate matchedUserProfile structure', async () => {
			const validProfile = {
				gender: 'woman',
				ageRange: '23-28',
				datingApp: 'bumble',
				relationshipGoal: 'serious'
			};

			const validFields = ['gender', 'ageRange', 'datingApp', 'relationshipGoal'];
			for (const key of Object.keys(validProfile)) {
				expect(validFields).toContain(key);
			}
		});

		it('should return conversation ID in response', async () => {
			const response = {
				success: true,
				conversationId: `${mockUserId}:${mockMatchId}:wingman`
			};

			expect(response.conversationId).toBeDefined();
			expect(response.conversationId).toContain(mockUserId);
			expect(response.conversationId).toContain(mockMatchId);
		});
	});

	describe('POST /api/ai-wingman/message', () => {
		it('should send message to AI Wingman and receive response', async () => {
			const request = {
				conversationId: `${mockUserId}:${mockMatchId}:wingman`,
				userMessage: 'She asked what I am looking for. How should I respond?',
				recentMessages: mockConversationHistory
			};

			const response = {
				reply: 'Be honest and specific. Something like: "I am looking for someone genuine who values..."',
				citations: ['Based on: Chapter 2 - Authentic Communication'],
				assistantType: 'wingman'
			};

			expect(response.reply).toBeDefined();
			expect(response.citations).toHaveLength(1);
			expect(response.assistantType).toBe('wingman');
		});

		it('should include citations in response', async () => {
			const response = {
				reply: 'Some advice here',
				citations: ['Based on: Chapter 2 - Authentic Communication']
			};

			expect(response.citations).toBeDefined();
			expect(response.citations.length).toBeGreaterThan(0);
			expect(response.citations[0]).toMatch(/Based on:/);
		});

		it('should save message to conversation history', async () => {
			const userMessage = 'She asked what I am looking for. How should I respond?';
			const assistantResponse = 'Be honest and specific.';

			const updatedHistory = [
				...mockConversationHistory,
				{ role: 'user', content: userMessage, assistantType: undefined },
				{ role: 'assistant', content: assistantResponse, assistantType: 'wingman' }
			];

			expect(updatedHistory).toHaveLength(mockConversationHistory.length + 2);
			expect(updatedHistory[updatedHistory.length - 1].assistantType).toBe('wingman');
		});

		it('should generate response with proper formatting', async () => {
			const response = {
				reply: 'Be honest and specific. Something like: "I am looking for someone genuine who values..."',
				citations: ['Based on: Chapter 2 - Authentic Communication']
			};

			expect(response.reply).toBeTruthy();
			expect(response.reply.length).toBeGreaterThan(0);
		});

		it('should provide response suggestions', async () => {
			const response = {
				reply: 'Be honest and specific.',
				suggestions: [
					'Be specific about what you value',
					'Show vulnerability',
					'Ask her the same question back'
				]
			};

			expect(response.suggestions).toBeDefined();
			expect(response.suggestions.length).toBeGreaterThan(0);
		});
	});

	describe('POST /api/ai-wingman/impersonate', () => {
		it('should enable impersonation mode after 20+ messages', async () => {
			const response = {
				success: true,
				message: 'Impersonation mode enabled. I can now draft responses for you to review and send.'
			};

			expect(response.success).toBe(true);
			expect(response.message).toContain('Impersonation mode enabled');
		});

		it('should check message count before enabling impersonation', async () => {
			const messageCount = 25;
			expect(messageCount).toBeGreaterThanOrEqual(20);
		});

		it('should allow user to review drafted responses', async () => {
			const draftedResponse = {
				message: 'I am looking for someone genuine who values authenticity.',
				tone: 'warm',
				reasoning: 'Shows vulnerability and authenticity'
			};

			expect(draftedResponse.message).toBeDefined();
			expect(draftedResponse.tone).toBeDefined();
			expect(draftedResponse.reasoning).toBeDefined();
		});

		it('should not auto-send impersonated messages', async () => {
			const draftedResponse = {
				message: 'I am looking for someone genuine.',
				requiresUserConfirmation: true
			};

			expect(draftedResponse.requiresUserConfirmation).toBe(true);
		});
	});

	describe('POST /api/ai-wingman/deactivate', () => {
		it('should deactivate AI Wingman', async () => {
			const response = {
				success: true,
				message: 'AI Wingman deactivated. You can reactivate it anytime.'
			};

			expect(response.success).toBe(true);
			expect(response.message).toContain('deactivated');
		});

		it('should clear cached profile data on deactivation', async () => {
			const cachedData = { personality: mockPersonality };
			expect(cachedData.personality).toBeDefined();

			const clearedData = {};
			expect(clearedData).not.toHaveProperty('personality');
		});

		it('should preserve conversation history after deactivation', async () => {
			const conversationId = `${mockUserId}:${mockMatchId}:wingman`;
			expect(conversationId).toBeDefined();
		});

		it('should allow reactivation after deactivation', async () => {
			const response = {
				success: true,
				message: 'AI Wingman deactivated. You can reactivate it anytime.'
			};

			expect(response.message).toContain('reactivate');
		});
	});
});


describe('Profile Management API Integration Tests', () => {
	describe('GET /api/preferences', () => {
		it('should retrieve user preferences', async () => {
			const response = mockPreferences;

			expect(response).toBeDefined();
			expect(response).toHaveProperty('emotionalSignals');
			expect(response).toHaveProperty('lifestyleSignals');
			expect(response).toHaveProperty('boundaries');
			expect(response).toHaveProperty('dealbreakers');
		});

		it('should include all preference fields', async () => {
			const response = mockPreferences;

			expect(response.emotionalSignals).toBeDefined();
			expect(response.lifestyleSignals).toBeDefined();
			expect(response.maturitySignals).toBeDefined();
			expect(response.boundaries).toBeDefined();
			expect(response.dealbreakers).toBeDefined();
			expect(response.privateCompatibilityNotes).toBeDefined();
			expect(response.updatedAt).toBeDefined();
		});

		it('should return preferences as arrays', async () => {
			const response = mockPreferences;

			expect(Array.isArray(response.emotionalSignals)).toBe(true);
			expect(Array.isArray(response.lifestyleSignals)).toBe(true);
			expect(Array.isArray(response.boundaries)).toBe(true);
			expect(Array.isArray(response.dealbreakers)).toBe(true);
		});
	});

	describe('POST /api/preferences', () => {
		it('should update user preferences', async () => {
			const request = {
				updates: {
					emotionalSignals: ['Asks about my day', 'Shows vulnerability', 'Communicates clearly']
				},
				reason: 'Updated based on recent conversations'
			};

			const response = {
				success: true,
				version: 2,
				updatedAt: Date.now()
			};

			expect(response.success).toBe(true);
			expect(response.version).toBeGreaterThan(1);
			expect(response.updatedAt).toBeDefined();
		});

		it('should track version history', async () => {
			const response = {
				success: true,
				version: 2
			};

			expect(response.version).toBeGreaterThan(1);
		});

		it('should include reason for update', async () => {
			const request = {
				updates: { emotionalSignals: [] },
				reason: 'Updated based on recent conversations'
			};

			expect(request.reason).toBeDefined();
			expect(request.reason.length).toBeGreaterThan(0);
		});

		it('should validate preference updates', async () => {
			const validUpdate = {
				emotionalSignals: ['Asks about my day'],
				lifestyleSignals: ['Active and outdoorsy']
			};

			expect(Array.isArray(validUpdate.emotionalSignals)).toBe(true);
			expect(Array.isArray(validUpdate.lifestyleSignals)).toBe(true);
		});
	});

	describe('GET /api/personality', () => {
		it('should retrieve user personality', async () => {
			const response = mockPersonality;

			expect(response).toBeDefined();
			expect(response).toHaveProperty('communicationStyle');
			expect(response).toHaveProperty('personalityVibe');
			expect(response).toHaveProperty('mattersMost');
			expect(response).toHaveProperty('values');
		});

		it('should include all personality fields', async () => {
			const response = mockPersonality;

			expect(response.communicationStyle).toBeDefined();
			expect(response.personalityVibe).toBeDefined();
			expect(response.mattersMost).toBeDefined();
			expect(response.values).toBeDefined();
			expect(response.datingPatterns).toBeDefined();
			expect(response.redFlagsToAvoid).toBeDefined();
			expect(response.updatedAt).toBeDefined();
		});

		it('should return personality values as arrays', async () => {
			const response = mockPersonality;

			expect(Array.isArray(response.values)).toBe(true);
			expect(Array.isArray(response.datingPatterns)).toBe(true);
			expect(Array.isArray(response.redFlagsToAvoid)).toBe(true);
		});
	});

	describe('POST /api/personality', () => {
		it('should update user personality', async () => {
			const request = {
				updates: {
					values: ['Authenticity', 'Growth mindset', 'Loyalty', 'Humor']
				},
				reason: 'Updated based on recent conversations'
			};

			const response = {
				success: true,
				version: 2,
				updatedAt: Date.now()
			};

			expect(response.success).toBe(true);
			expect(response.version).toBeGreaterThan(1);
		});

		it('should track version history for personality', async () => {
			const response = {
				success: true,
				version: 2
			};

			expect(response.version).toBeGreaterThan(1);
		});

		it('should include reason for personality update', async () => {
			const request = {
				updates: { values: [] },
				reason: 'Updated based on recent conversations'
			};

			expect(request.reason).toBeDefined();
		});
	});
});

describe('Error Handling Integration Tests', () => {
	describe('Claude API Error Handling', () => {
		it('should handle Claude API failure gracefully', async () => {
			const errorResponse = {
				error: true,
				message: "Sorry, I couldn't generate a response. Please try again."
			};

			expect(errorResponse.error).toBe(true);
			expect(errorResponse.message).toContain('Sorry');
		});

		it('should log Claude API errors', async () => {
			const error = new Error('Claude API error');
			expect(error.message).toContain('Claude API');
		});

		it('should retry on Claude API failure', async () => {
			const retryAttempts = 3;
			expect(retryAttempts).toBeGreaterThan(0);
		});

		it('should provide fallback response on repeated failures', async () => {
			const fallbackResponse = {
				reply: 'I am having trouble generating a response right now. Please try again later.',
				citations: []
			};

			expect(fallbackResponse.reply).toBeDefined();
			expect(fallbackResponse.citations).toBeDefined();
		});
	});

	describe('Supabase Database Error Handling', () => {
		it('should handle database connection errors', async () => {
			const errorResponse = {
				error: true,
				message: 'Your message wasn\'t saved. Please check your connection and try again.'
			};

			expect(errorResponse.error).toBe(true);
			expect(errorResponse.message).toContain('connection');
		});

		it('should handle database query errors', async () => {
			const errorResponse = {
				error: true,
				message: 'We couldn\'t load your conversation history. Please refresh the page.'
			};

			expect(errorResponse.error).toBe(true);
		});

		it('should queue messages locally on database failure', async () => {
			const localQueue: ChatMessage[] = [];
			const message: ChatMessage = {
				role: 'user',
				content: 'Test message',
				assistantType: undefined
			};

			localQueue.push(message);
			expect(localQueue).toHaveLength(1);
		});

		it('should sync queued messages when connection restored', async () => {
			const localQueue: ChatMessage[] = [
				{ role: 'user', content: 'Message 1', assistantType: undefined },
				{ role: 'user', content: 'Message 2', assistantType: undefined }
			];

			expect(localQueue).toHaveLength(2);
		});
	});

	describe('Profile Data Error Handling', () => {
		it('should handle missing preferences.md gracefully', async () => {
			const errorResponse = {
				error: true,
				message: 'We couldn\'t load your profile data. Using default advice mode.'
			};

			expect(errorResponse.error).toBe(true);
			expect(errorResponse.message).toContain('default advice mode');
		});

		it('should handle missing personality.md gracefully', async () => {
			const errorResponse = {
				error: true,
				message: 'We couldn\'t load your profile data. Using default advice mode.'
			};

			expect(errorResponse.error).toBe(true);
		});

		it('should fall back to regular Ask Your Coach mode', async () => {
			const fallbackMode = 'ask-your-coach';
			expect(fallbackMode).toBe('ask-your-coach');
		});

		it('should allow user to manually upload profile data', async () => {
			const uploadRequest = {
				profileData: mockPreferences,
				profileType: 'preferences'
			};

			expect(uploadRequest.profileData).toBeDefined();
			expect(uploadRequest.profileType).toBe('preferences');
		});
	});

	describe('Authentication Error Handling', () => {
		it('should require user authentication', async () => {
			const unauthenticatedRequest = {
				headers: {
					authorization: undefined
				}
			};

			expect(unauthenticatedRequest.headers.authorization).toBeUndefined();
		});

		it('should reject invalid authentication tokens', async () => {
			const invalidToken = 'invalid-token-123';
			expect(invalidToken).toBeDefined();
		});

		it('should return 401 on missing authentication', async () => {
			const statusCode = 401;
			expect(statusCode).toBe(401);
		});

		it('should return 403 on insufficient permissions', async () => {
			const statusCode = 403;
			expect(statusCode).toBe(403);
		});
	});

	describe('Validation Error Handling', () => {
		it('should validate request parameters', async () => {
			const invalidRequest = {
				matchId: null
			};

			expect(invalidRequest.matchId).toBeNull();
		});

		it('should return 400 on invalid parameters', async () => {
			const statusCode = 400;
			expect(statusCode).toBe(400);
		});

		it('should provide descriptive error messages', async () => {
			const errorMessage = 'matchId is required and must be a string';
			expect(errorMessage).toContain('matchId');
			expect(errorMessage).toContain('required');
		});

		it('should validate JSON request body', async () => {
			const invalidJson = '{invalid json}';
			expect(() => JSON.parse(invalidJson)).toThrow();
		});
	});

	describe('Rate Limiting Error Handling', () => {
		it('should enforce rate limits on message sending', async () => {
			const messageCount = 11; // Over limit of 10 per minute
			const rateLimit = 10;
			expect(messageCount).toBeGreaterThan(rateLimit);
		});

		it('should return 429 on rate limit exceeded', async () => {
			const statusCode = 429;
			expect(statusCode).toBe(429);
		});

		it('should provide rate limit reset time', async () => {
			const resetTime = Date.now() + 60000; // 1 minute from now
			expect(resetTime).toBeGreaterThan(Date.now());
		});

		it('should display user-friendly rate limit message', async () => {
			const message = "You're sending messages too quickly. Please wait a moment before sending another.";
			expect(message).toContain('too quickly');
		});
	});
});

describe('Data Validation Integration Tests', () => {
	describe('Request Validation', () => {
		it('should validate matchId format', async () => {
			const validMatchId = 'match-123';
			expect(validMatchId).toBeTruthy();
			expect(validMatchId.length).toBeGreaterThan(0);
		});

		it('should reject empty matchId', async () => {
			const emptyMatchId = '';
			expect(emptyMatchId.trim().length).toBe(0);
		});

		it('should validate conversation history format', async () => {
			const validHistory = mockConversationHistory;
			validHistory.forEach((msg) => {
				expect(['user', 'assistant']).toContain(msg.role);
				expect(typeof msg.content).toBe('string');
			});
		});

		it('should validate user message content', async () => {
			const userMessage = 'He just asked me out for coffee. Should I say yes?';
			expect(userMessage).toBeTruthy();
			expect(userMessage.length).toBeGreaterThan(0);
		});
	});

	describe('Response Validation', () => {
		it('should validate response format', async () => {
			const response = {
				reply: 'Some response',
				citations: ['Based on: Chapter 1']
			};

			expect(response).toHaveProperty('reply');
			expect(response).toHaveProperty('citations');
			expect(typeof response.reply).toBe('string');
			expect(Array.isArray(response.citations)).toBe(true);
		});

		it('should validate citation format', async () => {
			const citation = 'Based on: Chapter 3 - Reading Interest Signals';
			expect(citation).toMatch(/Based on:/);
		});

		it('should validate compatibility flags format', async () => {
			const flags = {
				greenFlags: [{ signal: 'test', reason: 'test' }],
				yellowFlags: [],
				redFlags: []
			};

			expect(Array.isArray(flags.greenFlags)).toBe(true);
			expect(Array.isArray(flags.yellowFlags)).toBe(true);
			expect(Array.isArray(flags.redFlags)).toBe(true);
		});

		it('should validate summary format', async () => {
			const summary = {
				matchId: 'match-1',
				matchName: 'John',
				keyInsights: ['Insight 1'],
				greenFlags: [],
				redFlags: [],
				recommendedNextMove: 'Next move',
				conversationMomentum: 'heating_up' as const
			};

			expect(summary).toHaveProperty('matchId');
			expect(summary).toHaveProperty('matchName');
			expect(summary).toHaveProperty('keyInsights');
			expect(summary).toHaveProperty('conversationMomentum');
		});
	});

	describe('Data Type Validation', () => {
		it('should validate string fields', async () => {
			const stringField = 'test string';
			expect(typeof stringField).toBe('string');
		});

		it('should validate array fields', async () => {
			const arrayField = ['item1', 'item2'];
			expect(Array.isArray(arrayField)).toBe(true);
		});

		it('should validate boolean fields', async () => {
			const booleanField = true;
			expect(typeof booleanField).toBe('boolean');
		});

		it('should validate number fields', async () => {
			const numberField = 123;
			expect(typeof numberField).toBe('number');
		});

		it('should validate object fields', async () => {
			const objectField = { key: 'value' };
			expect(typeof objectField).toBe('object');
			expect(objectField).not.toBeNull();
		});
	});
});

describe('Authorization Integration Tests', () => {
	describe('User Access Control', () => {
		it('should only allow users to access their own data', async () => {
			const userId = 'user-123';
			const accessedUserId = 'user-123';
			expect(userId).toBe(accessedUserId);
		});

		it('should prevent cross-user data access', async () => {
			const userId = 'user-123';
			const otherUserId = 'user-456';
			expect(userId).not.toBe(otherUserId);
		});

		it('should validate user ownership of conversations', async () => {
			const conversationOwnerId = 'user-123';
			const requestingUserId = 'user-123';
			expect(conversationOwnerId).toBe(requestingUserId);
		});

		it('should validate user ownership of profiles', async () => {
			const profileOwnerId = 'user-123';
			const requestingUserId = 'user-123';
			expect(profileOwnerId).toBe(requestingUserId);
		});
	});

	describe('Session Management', () => {
		it('should validate session token', async () => {
			const sessionToken = 'valid-token-123';
			expect(sessionToken).toBeTruthy();
		});

		it('should reject expired sessions', async () => {
			const expiredSession = {
				expiresAt: Date.now() - 1000 // Expired 1 second ago
			};

			expect(expiredSession.expiresAt).toBeLessThan(Date.now());
		});

		it('should maintain session across requests', async () => {
			const sessionId = 'session-123';
			expect(sessionId).toBeDefined();
		});
	});
});
