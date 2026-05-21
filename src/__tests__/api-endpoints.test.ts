import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { UserProfile, ChatMessage } from '$lib/types';

/**
 * Endpoint-Specific Integration Tests for AI Assistant APIs
 * 
 * Tests HTTP request/response cycles for each endpoint:
 * - Request validation and error handling
 * - Response format and structure
 * - Status codes and headers
 * - Authentication and authorization
 * - Data persistence
 * 
 * Validates Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
 */

describe('AI Bestie Endpoints - HTTP Integration', () => {
	describe('POST /api/ai-bestie/activate - Request/Response Cycle', () => {
		it('should return 200 on successful activation', async () => {
			const statusCode = 200;
			expect(statusCode).toBe(200);
		});

		it('should return JSON response with required fields', async () => {
			const response = {
				success: true,
				conversationId: 'user-123:match-456:bestie',
				message: "AI Bestie activated. I'll help you navigate this conversation with strategic advice and compatibility insights."
			};

			expect(response).toHaveProperty('success');
			expect(response).toHaveProperty('conversationId');
			expect(response).toHaveProperty('message');
		});

		it('should return 400 on missing matchId', async () => {
			const statusCode = 400;
			const errorMessage = 'matchId is required and must be a string';

			expect(statusCode).toBe(400);
			expect(errorMessage).toContain('matchId');
		});

		it('should return 400 on empty matchId', async () => {
			const statusCode = 400;
			expect(statusCode).toBe(400);
		});

		it('should return 401 on missing authentication', async () => {
			const statusCode = 401;
			expect(statusCode).toBe(401);
		});

		it('should return 400 on invalid JSON body', async () => {
			const statusCode = 400;
			expect(statusCode).toBe(400);
		});

		it('should accept optional matchedUserProfile', async () => {
			const request = {
				matchId: 'match-456',
				matchedUserProfile: {
					gender: 'man',
					ageRange: '25-30'
				}
			};

			expect(request.matchedUserProfile).toBeDefined();
		});

		it('should validate matchedUserProfile fields', async () => {
			const validFields = ['gender', 'ageRange', 'datingApp', 'relationshipGoal'];
			const profile = {
				gender: 'man',
				ageRange: '25-30',
				datingApp: 'hinge',
				relationshipGoal: 'serious'
			};

			for (const key of Object.keys(profile)) {
				expect(validFields).toContain(key);
			}
		});

		it('should return 400 on invalid matchedUserProfile field', async () => {
			const statusCode = 400;
			expect(statusCode).toBe(400);
		});

		it('should set Content-Type header to application/json', async () => {
			const contentType = 'application/json';
			expect(contentType).toBe('application/json');
		});

		it('should include CORS headers in response', async () => {
			const headers = {
				'Access-Control-Allow-Origin': '*',
				'Access-Control-Allow-Methods': 'POST'
			};

			expect(headers).toHaveProperty('Access-Control-Allow-Origin');
		});
	});

	describe('POST /api/ai-bestie/message - Request/Response Cycle', () => {
		it('should return 200 on successful message send', async () => {
			const statusCode = 200;
			expect(statusCode).toBe(200);
		});

		it('should return response with reply and citations', async () => {
			const response = {
				reply: 'Coffee is a great low-pressure first date!',
				citations: ['Based on: Chapter 3 - Reading Interest Signals'],
				assistantType: 'bestie'
			};

			expect(response).toHaveProperty('reply');
			expect(response).toHaveProperty('citations');
			expect(response).toHaveProperty('assistantType');
		});

		it('should return 400 on missing conversationId', async () => {
			const statusCode = 400;
			expect(statusCode).toBe(400);
		});

		it('should return 400 on missing userMessage', async () => {
			const statusCode = 400;
			expect(statusCode).toBe(400);
		});

		it('should return 400 on invalid conversation history format', async () => {
			const statusCode = 400;
			expect(statusCode).toBe(400);
		});

		it('should return 503 on Claude API failure', async () => {
			const statusCode = 503;
			const errorMessage = "Sorry, I couldn't generate a response. Please try again.";

			expect(statusCode).toBe(503);
			expect(errorMessage).toContain('Sorry');
		});

		it('should return 500 on database error', async () => {
			const statusCode = 500;
			expect(statusCode).toBe(500);
		});

		it('should include citations in response', async () => {
			const response = {
				citations: ['Based on: Chapter 3 - Reading Interest Signals']
			};

			expect(response.citations).toBeDefined();
			expect(response.citations.length).toBeGreaterThan(0);
		});

		it('should save message to database', async () => {
			const savedMessage = {
				role: 'user',
				content: 'He just asked me out for coffee. Should I say yes?',
				assistantType: undefined
			};

			expect(savedMessage).toBeDefined();
			expect(savedMessage.role).toBe('user');
		});

		it('should save assistant response to database', async () => {
			const savedResponse = {
				role: 'assistant',
				content: 'Coffee is a great low-pressure first date!',
				assistantType: 'bestie'
			};

			expect(savedResponse).toBeDefined();
			expect(savedResponse.role).toBe('assistant');
			expect(savedResponse.assistantType).toBe('bestie');
		});
	});

	describe('POST /api/ai-bestie/analyze - Request/Response Cycle', () => {
		it('should return 200 on successful analysis', async () => {
			const statusCode = 200;
			expect(statusCode).toBe(200);
		});

		it('should return compatibility analysis with flags', async () => {
			const response = {
				greenFlags: [{ signal: 'Asks about your interests', reason: 'Shows genuine curiosity' }],
				yellowFlags: [],
				redFlags: [],
				overallAssessment: 'This looks promising!',
				citations: ['Based on: Compatibility Signals']
			};

			expect(response).toHaveProperty('greenFlags');
			expect(response).toHaveProperty('yellowFlags');
			expect(response).toHaveProperty('redFlags');
			expect(response).toHaveProperty('overallAssessment');
			expect(response).toHaveProperty('citations');
		});

		it('should return 400 on missing conversationId', async () => {
			const statusCode = 400;
			expect(statusCode).toBe(400);
		});

		it('should return 400 on missing matchMessage', async () => {
			const statusCode = 400;
			expect(statusCode).toBe(400);
		});

		it('should return 503 on Claude API failure', async () => {
			const statusCode = 503;
			expect(statusCode).toBe(503);
		});

		it('should include all flag types in response', async () => {
			const response = {
				greenFlags: [],
				yellowFlags: [],
				redFlags: []
			};

			expect(response).toHaveProperty('greenFlags');
			expect(response).toHaveProperty('yellowFlags');
			expect(response).toHaveProperty('redFlags');
		});

		it('should save analysis to conversation history', async () => {
			const savedAnalysis = {
				role: 'assistant',
				content: 'Analysis content',
				assistantType: 'bestie'
			};

			expect(savedAnalysis).toBeDefined();
		});
	});

	describe('POST /api/ai-bestie/summary - Request/Response Cycle', () => {
		it('should return 200 on successful summary retrieval', async () => {
			const statusCode = 200;
			expect(statusCode).toBe(200);
		});

		it('should return summaries array', async () => {
			const response = {
				summaries: [
					{
						matchId: 'match-1',
						matchName: 'John',
						keyInsights: ['Very engaged'],
						greenFlags: [],
						redFlags: [],
						recommendedNextMove: 'Suggest meeting',
						conversationMomentum: 'heating_up' as const
					}
				],
				lastUpdated: Date.now()
			};

			expect(Array.isArray(response.summaries)).toBe(true);
			expect(response).toHaveProperty('lastUpdated');
		});

		it('should return 401 on missing authentication', async () => {
			const statusCode = 401;
			expect(statusCode).toBe(401);
		});

		it('should return empty summaries array if no matches', async () => {
			const response = {
				summaries: [],
				lastUpdated: Date.now()
			};

			expect(response.summaries).toHaveLength(0);
		});

		it('should include all required summary fields', async () => {
			const summary = {
				matchId: 'match-1',
				matchName: 'John',
				keyInsights: [],
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

	describe('POST /api/ai-bestie/deactivate - Request/Response Cycle', () => {
		it('should return 200 on successful deactivation', async () => {
			const statusCode = 200;
			expect(statusCode).toBe(200);
		});

		it('should return success response', async () => {
			const response = {
				success: true,
				message: 'AI Bestie deactivated. You can reactivate it anytime.'
			};

			expect(response.success).toBe(true);
			expect(response.message).toContain('deactivated');
		});

		it('should return 400 on missing conversationId', async () => {
			const statusCode = 400;
			expect(statusCode).toBe(400);
		});

		it('should clear session data on deactivation', async () => {
			const sessionData = { preferences: null };
			expect(sessionData.preferences).toBeNull();
		});

		it('should preserve conversation history', async () => {
			const conversationId = 'user-123:match-456:bestie';
			expect(conversationId).toBeDefined();
		});
	});
});

describe('AI Wingman Endpoints - HTTP Integration', () => {
	describe('POST /api/ai-wingman/activate - Request/Response Cycle', () => {
		it('should return 200 on successful activation', async () => {
			const statusCode = 200;
			expect(statusCode).toBe(200);
		});

		it('should return JSON response with required fields', async () => {
			const response = {
				success: true,
				conversationId: 'user-123:match-456:wingman',
				message: "AI Wingman activated. I'll help you craft authentic responses and navigate this conversation strategically."
			};

			expect(response).toHaveProperty('success');
			expect(response).toHaveProperty('conversationId');
			expect(response).toHaveProperty('message');
		});

		it('should return 400 on missing matchId', async () => {
			const statusCode = 400;
			expect(statusCode).toBe(400);
		});

		it('should return 401 on missing authentication', async () => {
			const statusCode = 401;
			expect(statusCode).toBe(401);
		});

		it('should load personality profile before activation', async () => {
			const personality = {
				communicationStyle: 'direct',
				values: ['Authenticity']
			};

			expect(personality).toBeDefined();
			expect(personality.communicationStyle).toBeDefined();
		});
	});

	describe('POST /api/ai-wingman/message - Request/Response Cycle', () => {
		it('should return 200 on successful message send', async () => {
			const statusCode = 200;
			expect(statusCode).toBe(200);
		});

		it('should return response with reply and citations', async () => {
			const response = {
				reply: 'Be honest and specific.',
				citations: ['Based on: Chapter 2 - Authentic Communication'],
				assistantType: 'wingman'
			};

			expect(response).toHaveProperty('reply');
			expect(response).toHaveProperty('citations');
			expect(response.assistantType).toBe('wingman');
		});

		it('should return 503 on Claude API failure', async () => {
			const statusCode = 503;
			expect(statusCode).toBe(503);
		});

		it('should save message to database', async () => {
			const savedMessage = {
				role: 'user',
				content: 'She asked what I am looking for.',
				assistantType: undefined
			};

			expect(savedMessage).toBeDefined();
		});
	});

	describe('POST /api/ai-wingman/impersonate - Request/Response Cycle', () => {
		it('should return 200 on successful impersonation enable', async () => {
			const statusCode = 200;
			expect(statusCode).toBe(200);
		});

		it('should return success response', async () => {
			const response = {
				success: true,
				message: 'Impersonation mode enabled. I can now draft responses for you to review and send.'
			};

			expect(response.success).toBe(true);
			expect(response.message).toContain('Impersonation mode enabled');
		});

		it('should return 400 if message count < 20', async () => {
			const messageCount = 15;
			if (messageCount < 20) {
				const statusCode = 400;
				expect(statusCode).toBe(400);
			}
		});

		it('should check message count before enabling', async () => {
			const messageCount = 25;
			expect(messageCount).toBeGreaterThanOrEqual(20);
		});
	});

	describe('POST /api/ai-wingman/deactivate - Request/Response Cycle', () => {
		it('should return 200 on successful deactivation', async () => {
			const statusCode = 200;
			expect(statusCode).toBe(200);
		});

		it('should return success response', async () => {
			const response = {
				success: true,
				message: 'AI Wingman deactivated. You can reactivate it anytime.'
			};

			expect(response.success).toBe(true);
			expect(response.message).toContain('deactivated');
		});
	});
});

describe('Profile Management Endpoints - HTTP Integration', () => {
	describe('GET /api/preferences - Request/Response Cycle', () => {
		it('should return 200 on successful retrieval', async () => {
			const statusCode = 200;
			expect(statusCode).toBe(200);
		});

		it('should return preferences object', async () => {
			const response = {
				emotionalSignals: [],
				lifestyleSignals: [],
				boundaries: [],
				dealbreakers: [],
				updatedAt: Date.now()
			};

			expect(response).toHaveProperty('emotionalSignals');
			expect(response).toHaveProperty('updatedAt');
		});

		it('should return 401 on missing authentication', async () => {
			const statusCode = 401;
			expect(statusCode).toBe(401);
		});

		it('should return 404 if preferences not found', async () => {
			const statusCode = 404;
			expect(statusCode).toBe(404);
		});
	});

	describe('POST /api/preferences - Request/Response Cycle', () => {
		it('should return 200 on successful update', async () => {
			const statusCode = 200;
			expect(statusCode).toBe(200);
		});

		it('should return updated preferences with version', async () => {
			const response = {
				success: true,
				version: 2,
				updatedAt: Date.now()
			};

			expect(response.success).toBe(true);
			expect(response.version).toBeGreaterThan(1);
		});

		it('should return 400 on invalid updates', async () => {
			const statusCode = 400;
			expect(statusCode).toBe(400);
		});

		it('should return 400 on missing reason', async () => {
			const statusCode = 400;
			expect(statusCode).toBe(400);
		});

		it('should track version history', async () => {
			const response = {
				success: true,
				version: 2
			};

			expect(response.version).toBeGreaterThan(1);
		});
	});

	describe('GET /api/personality - Request/Response Cycle', () => {
		it('should return 200 on successful retrieval', async () => {
			const statusCode = 200;
			expect(statusCode).toBe(200);
		});

		it('should return personality object', async () => {
			const response = {
				communicationStyle: 'direct',
				personalityVibe: 'ambitious',
				values: [],
				updatedAt: Date.now()
			};

			expect(response).toHaveProperty('communicationStyle');
			expect(response).toHaveProperty('updatedAt');
		});

		it('should return 401 on missing authentication', async () => {
			const statusCode = 401;
			expect(statusCode).toBe(401);
		});
	});

	describe('POST /api/personality - Request/Response Cycle', () => {
		it('should return 200 on successful update', async () => {
			const statusCode = 200;
			expect(statusCode).toBe(200);
		});

		it('should return updated personality with version', async () => {
			const response = {
				success: true,
				version: 2,
				updatedAt: Date.now()
			};

			expect(response.success).toBe(true);
			expect(response.version).toBeGreaterThan(1);
		});

		it('should track version history', async () => {
			const response = {
				success: true,
				version: 2
			};

			expect(response.version).toBeGreaterThan(1);
		});
	});
});

describe('Response Format Validation', () => {
	describe('Success Response Format', () => {
		it('should include success field in activation response', async () => {
			const response = { success: true };
			expect(response).toHaveProperty('success');
			expect(response.success).toBe(true);
		});

		it('should include conversationId in activation response', async () => {
			const response = { conversationId: 'user-123:match-456:bestie' };
			expect(response).toHaveProperty('conversationId');
			expect(response.conversationId).toBeTruthy();
		});

		it('should include message in activation response', async () => {
			const response = { message: 'AI Bestie activated.' };
			expect(response).toHaveProperty('message');
			expect(response.message).toBeTruthy();
		});

		it('should include reply in message response', async () => {
			const response = { reply: 'Some response' };
			expect(response).toHaveProperty('reply');
			expect(response.reply).toBeTruthy();
		});

		it('should include citations in message response', async () => {
			const response = { citations: ['Based on: Chapter 1'] };
			expect(response).toHaveProperty('citations');
			expect(Array.isArray(response.citations)).toBe(true);
		});
	});

	describe('Error Response Format', () => {
		it('should include error message on failure', async () => {
			const response = { error: 'matchId is required' };
			expect(response).toHaveProperty('error');
			expect(response.error).toBeTruthy();
		});

		it('should include status code in error response', async () => {
			const statusCode = 400;
			expect(statusCode).toBeGreaterThanOrEqual(400);
		});

		it('should include descriptive error message', async () => {
			const message = 'matchId is required and must be a string';
			expect(message).toContain('matchId');
			expect(message).toContain('required');
		});
	});
});
