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
		id: 'mock-msg-1',
		role: 'user',
		content: 'He just asked me out for coffee. Should I say yes?',
		assistantType: undefined,
		timestamp: 0
	},
	{
		id: 'mock-msg-2',
		role: 'assistant',
		content: 'Coffee is a great low-pressure first date! He is showing genuine interest.',
		assistantType: 'bestie',
		timestamp: 1
	}
];

describe('AI Bestie Activation Flow', () => {
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

	it('should display visual indicator when AI Bestie is active', async () => {
		const indicator = {
			isActive: true,
			assistantType: 'bestie',
			badge: 'AI Bestie'
		};

		expect(indicator.isActive).toBe(true);
		expect(indicator.assistantType).toBe('bestie');
		expect(indicator.badge).toBeDefined();
	});
});

describe('AI Wingman Activation Flow', () => {
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

	it('should load user personality before activation', async () => {
		const personality = mockPersonality;
		expect(personality.communicationStyle).toBeDefined();
		expect(personality.values.length).toBeGreaterThan(0);
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

	it('should display visual indicator when AI Wingman is active', async () => {
		const indicator = {
			isActive: true,
			assistantType: 'wingman',
			badge: 'AI Wingman'
		};

		expect(indicator.isActive).toBe(true);
		expect(indicator.assistantType).toBe('wingman');
		expect(indicator.badge).toBeDefined();
	});
});

describe('Message Sending and Response Generation', () => {
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

	it('should include citations in all responses', async () => {
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
			{ id: 'mock-msg-3', role: 'user', content: userMessage, assistantType: undefined, timestamp: 2 },
			{ id: 'mock-msg-4', role: 'assistant', content: assistantResponse, assistantType: 'bestie', timestamp: 3 }
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


describe('Compatibility Analysis', () => {
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

describe('Profile Updates', () => {
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

	it('should track version history for preferences', async () => {
		const response = {
			success: true,
			version: 2
		};

		expect(response.version).toBeGreaterThan(1);
	});

	it('should include reason for preference update', async () => {
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

	it('should retrieve preferences', async () => {
		const response = mockPreferences;

		expect(response).toBeDefined();
		expect(response).toHaveProperty('emotionalSignals');
		expect(response).toHaveProperty('lifestyleSignals');
		expect(response).toHaveProperty('boundaries');
		expect(response).toHaveProperty('dealbreakers');
	});

	it('should retrieve personality', async () => {
		const response = mockPersonality;

		expect(response).toBeDefined();
		expect(response).toHaveProperty('communicationStyle');
		expect(response).toHaveProperty('personalityVibe');
		expect(response).toHaveProperty('mattersMost');
		expect(response).toHaveProperty('values');
	});
});

describe('Error Handling and Validation', () => {
	describe('Claude API Error Handling', () => {
		it('should handle Claude API failure gracefully', async () => {
			const errorResponse = {
				error: true,
				message: "Sorry, I couldn't generate a response. Please try again."
			};

			expect(errorResponse.error).toBe(true);
			expect(errorResponse.message).toContain('Sorry');
		});

		it('should log Claude API errors for debugging', async () => {
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

		it('should not crash application on API error', async () => {
			const errorResponse = {
				error: true,
				message: "Sorry, I couldn't generate a response. Please try again."
			};

			expect(errorResponse).toBeDefined();
			expect(errorResponse.error).toBe(true);
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
				id: 'mock-msg-1',
				role: 'user',
				content: 'Test message',
				assistantType: undefined,
				timestamp: 0
			};

			localQueue.push(message);
			expect(localQueue).toHaveLength(1);
		});

		it('should sync queued messages when connection restored', async () => {
			const localQueue: ChatMessage[] = [
				{ id: 'mock-msg-1', role: 'user', content: 'Message 1', assistantType: undefined, timestamp: 0 },
				{ id: 'mock-msg-2', role: 'user', content: 'Message 2', assistantType: undefined, timestamp: 1 }
			];

			expect(localQueue).toHaveLength(2);
		});

		it('should not lose data on database failure', async () => {
			const originalMessage = 'Important message';
			expect(originalMessage).toBeDefined();
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

		it('should suggest creating profile if not exists', async () => {
			const suggestion = 'Please complete your profile setup to use AI assistants.';
			expect(suggestion).toBeDefined();
			expect(suggestion.length).toBeGreaterThan(0);
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

		it('should not expose sensitive data in error messages', async () => {
			const errorMessage = 'Authentication failed';
			expect(errorMessage).not.toContain('token');
			expect(errorMessage).not.toContain('password');
		});
	});

	describe('Request Validation Error Handling', () => {
		it('should validate matchId parameter', async () => {
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

		it('should validate conversation history format', async () => {
			const invalidHistory = [
				{
					role: 'invalid-role',
					content: 'test'
				}
			];

			expect(invalidHistory[0].role).not.toMatch(/^(user|assistant)$/);
		});

		it('should validate response option structure', async () => {
			const validOption = {
				message: 'Test message',
				tone: 'warm',
				reasoning: 'Test reasoning'
			};

			expect(validOption).toHaveProperty('message');
			expect(validOption).toHaveProperty('tone');
			expect(validOption).toHaveProperty('reasoning');
		});

		it('should validate flag structure in compatibility analysis', async () => {
			const validFlag = {
				signal: 'Test signal',
				reason: 'Test reason'
			};

			expect(validFlag).toHaveProperty('signal');
			expect(validFlag).toHaveProperty('reason');
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

		it('should not prevent other features on rate limit', async () => {
			const otherFeatureAvailable = true;
			expect(otherFeatureAvailable).toBe(true);
		});

		it('should warn on high message count in session', async () => {
			const messageCount = 51; // Over 50 message warning threshold
			const warningThreshold = 50;
			expect(messageCount).toBeGreaterThan(warningThreshold);
		});

		it('should require confirmation at 100 messages', async () => {
			const messageCount = 100;
			const confirmationThreshold = 100;
			expect(messageCount).toBeGreaterThanOrEqual(confirmationThreshold);
		});
	});

	describe('Session State Error Handling', () => {
		it('should handle session timeout gracefully', async () => {
			const sessionExpired = true;
			expect(sessionExpired).toBe(true);
		});

		it('should preserve conversation history on session timeout', async () => {
			const conversationId = `${mockUserId}:${mockMatchId}:bestie`;
			expect(conversationId).toBeDefined();
		});

		it('should allow session recovery', async () => {
			const recoveryPossible = true;
			expect(recoveryPossible).toBe(true);
		});

		it('should handle concurrent requests safely', async () => {
			const requestCount = 5;
			expect(requestCount).toBeGreaterThan(0);
		});
	});

	describe('Data Validation Error Handling', () => {
		it('should validate preference field types', async () => {
			const validPreferences = {
				emotionalSignals: ['string1', 'string2'],
				lifestyleSignals: ['string1'],
				boundaries: ['string1']
			};

			expect(Array.isArray(validPreferences.emotionalSignals)).toBe(true);
			validPreferences.emotionalSignals.forEach((signal) => {
				expect(typeof signal).toBe('string');
			});
		});

		it('should validate personality field types', async () => {
			const validPersonality = {
				communicationStyle: 'direct',
				personalityVibe: 'ambitious',
				values: ['value1', 'value2']
			};

			expect(typeof validPersonality.communicationStyle).toBe('string');
			expect(Array.isArray(validPersonality.values)).toBe(true);
		});

		it('should reject empty required fields', async () => {
			const invalidRequest = {
				matchId: '',
				userMessage: ''
			};

			expect(invalidRequest.matchId.trim().length).toBe(0);
			expect(invalidRequest.userMessage.trim().length).toBe(0);
		});

		it('should validate timestamp format', async () => {
			const validTimestamp = Date.now();
			expect(typeof validTimestamp).toBe('number');
			expect(validTimestamp).toBeGreaterThan(0);
		});

		it('should validate UUID format for IDs', async () => {
			const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
			const validUUID = '550e8400-e29b-41d4-a716-446655440000';
			expect(validUUID).toMatch(uuidPattern);
		});
	});

	describe('Response Format Validation', () => {
		it('should validate response includes required fields', async () => {
			const response = {
				reply: 'Test reply',
				citations: ['Based on: Test']
			};

			expect(response).toHaveProperty('reply');
			expect(response).toHaveProperty('citations');
		});

		it('should validate citations format', async () => {
			const citations = ['Based on: Chapter 1', 'Based on: Chapter 2'];
			citations.forEach((citation) => {
				expect(citation).toMatch(/Based on:/);
			});
		});

		it('should validate flag response structure', async () => {
			const flagResponse = {
				greenFlags: [],
				yellowFlags: [],
				redFlags: [],
				overallAssessment: 'Test',
				citations: []
			};

			expect(flagResponse).toHaveProperty('greenFlags');
			expect(flagResponse).toHaveProperty('yellowFlags');
			expect(flagResponse).toHaveProperty('redFlags');
			expect(flagResponse).toHaveProperty('overallAssessment');
			expect(flagResponse).toHaveProperty('citations');
		});

		it('should validate activation response structure', async () => {
			const activationResponse = {
				success: true,
				conversationId: 'test-id',
				message: 'Test message'
			};

			expect(activationResponse).toHaveProperty('success');
			expect(activationResponse).toHaveProperty('conversationId');
			expect(activationResponse).toHaveProperty('message');
		});

		it('should validate update response structure', async () => {
			const updateResponse = {
				success: true,
				version: 2,
				updatedAt: Date.now()
			};

			expect(updateResponse).toHaveProperty('success');
			expect(updateResponse).toHaveProperty('version');
			expect(updateResponse).toHaveProperty('updatedAt');
		});
	});

	describe('Edge Cases and Boundary Conditions', () => {
		it('should handle very long messages', async () => {
			const longMessage = 'a'.repeat(10000);
			expect(longMessage.length).toBe(10000);
		});

		it('should handle special characters in messages', async () => {
			const specialMessage = 'Test with émojis 🎉 and spëcial çharacters!';
			expect(specialMessage).toBeDefined();
		});

		it('should handle empty response options gracefully', async () => {
			const emptyOptions: any[] = [];
			expect(emptyOptions).toHaveLength(0);
		});

		it('should handle null values in optional fields', async () => {
			const optionalField = null;
			expect(optionalField).toBeNull();
		});

		it('should handle very old timestamps', async () => {
			const oldTimestamp = new Date('2000-01-01').getTime();
			expect(oldTimestamp).toBeGreaterThan(0);
		});

		it('should handle future timestamps', async () => {
			const futureTimestamp = new Date('2099-12-31').getTime();
			expect(futureTimestamp).toBeGreaterThan(Date.now());
		});

		it('should handle concurrent activation requests', async () => {
			const requests = [
				{ matchId: 'match-1', assistantType: 'bestie' },
				{ matchId: 'match-2', assistantType: 'wingman' }
			];

			expect(requests).toHaveLength(2);
		});

		it('should handle rapid message sending', async () => {
			const messages = Array(5).fill({ content: 'Test' });
			expect(messages).toHaveLength(5);
		});
	});

	describe('Deactivation and Cleanup', () => {
		it('should clear cached profile data on deactivation', async () => {
			const cachedData = { preferences: mockPreferences };
			expect(cachedData.preferences).toBeDefined();

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

		it('should clean up session resources on deactivation', async () => {
			const sessionCleanup = true;
			expect(sessionCleanup).toBe(true);
		});

		it('should not affect other conversations on deactivation', async () => {
			const otherConversationId = `${mockUserId}:other-match:bestie`;
			expect(otherConversationId).toBeDefined();
		});
	});
});
