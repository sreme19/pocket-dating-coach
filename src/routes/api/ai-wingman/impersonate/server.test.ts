import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from './+server';
import type { RequestHandler } from './$types';
import type { ChatMessage, UserProfile } from '$lib/types';

/**
 * Unit Tests for POST /api/ai-wingman/impersonate
 * 
 * These tests verify that the AI Wingman impersonation endpoint correctly:
 * 1. Validates user authentication
 * 2. Validates request parameters
 * 3. Checks for minimum 20 messages from match
 * 4. Generates response options using AI Assistant Service
 * 5. Updates conversation config to enable impersonation
 * 6. Handles errors gracefully
 * 7. Returns properly formatted response options
 * 
 * **Validates: Requirements 6.1, 6.2, 6.3, 6.4**
 */

// Mock modules
vi.mock('$lib/claude', () => ({
	getClaudeClient: vi.fn(),
	CLAUDE_MODEL: 'claude-3-5-sonnet-20241022',
	MAX_TOKENS: 2048
}));

vi.mock('$lib/vectorstore', () => ({
	searchBookChunks: vi.fn()
}));

vi.mock('$lib/embeddings', () => ({
	getEmbedding: vi.fn()
}));

vi.mock('$lib/prompts', () => ({
	buildAIWingmanSystemPrompt: vi.fn(),
	buildAIAssistantContextPrompt: vi.fn()
}));

vi.mock('$lib/server/error-handler', () => ({
	throwAuthenticationError: vi.fn((msg) => {
		const err = new Error(msg);
		(err as any).status = 401;
		throw err;
	}),
	throwValidationError: vi.fn((msg) => {
		const err = new Error(msg);
		(err as any).status = 400;
		throw err;
	}),
	throwExternalAPIError: vi.fn((endpoint, err, msg) => {
		const error = new Error(msg);
		(error as any).status = 502;
		throw error;
	}),
	throwInternalError: vi.fn((endpoint, err, msg) => {
		const error = new Error(msg);
		(error as any).status = 500;
		throw error;
	}),
	throwDatabaseError: vi.fn((endpoint, err, msg) => {
		const error = new Error(msg);
		(error as any).status = 500;
		throw error;
	}),
	validateRequiredFields: vi.fn((body, fields) => {
		const missingFields = fields.filter((f: string) => !body[f]);
		return { valid: missingFields.length === 0, missingFields };
	}),
	logError: vi.fn(),
	ErrorType: {
		VALIDATION_ERROR: 'VALIDATION_ERROR',
		AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
		DATABASE_ERROR: 'DATABASE_ERROR',
		EXTERNAL_API_ERROR: 'EXTERNAL_API_ERROR',
		INTERNAL_ERROR: 'INTERNAL_ERROR'
	},
	validateClaudeResponse: vi.fn()
}));

vi.mock('$lib/server/profile-service', () => ({
	loadPersonality: vi.fn()
}));

vi.mock('$lib/server/supabase', () => ({
	getSupabase: vi.fn()
}));

vi.mock('$lib/server/ai-assistant-service', () => ({
	generateResponseOptions: vi.fn()
}));

// Test data
const TEST_USER_ID = 'test-user-123';
const TEST_CONVERSATION_ID = 'conv-123';

const TEST_MATCH_PROFILE: Partial<UserProfile> = {
	gender: 'woman',
	ageRange: '23-28',
	datingApp: 'bumble',
	relationshipGoal: 'serious'
};

// Create 25 messages (more than 20 required)
const createTestMessages = (count: number): ChatMessage[] => {
	const messages: ChatMessage[] = [];
	for (let i = 0; i < count; i++) {
		messages.push({
			id: `msg-${i}`,
			role: i % 2 === 0 ? 'user' : 'assistant',
			content: `Message ${i}`,
			timestamp: Date.now() - (count - i) * 1000
		});
	}
	return messages;
};

const TEST_RESPONSE_OPTIONS = [
	{
		id: 'option-0',
		tone: 'playful' as const,
		message: 'That sounds amazing! I love hiking too.',
		why: 'Shows genuine interest and shared values',
		citation: 'Based on: Chapter 2 - Authentic Communication'
	},
	{
		id: 'option-1',
		tone: 'warm' as const,
		message: 'I really enjoy being outdoors. What\'s your favorite hiking spot?',
		why: 'Builds connection through shared interests',
		citation: 'Based on: Chapter 3 - Building Genuine Connection'
	},
	{
		id: 'option-2',
		tone: 'direct' as const,
		message: 'Hiking is great! I\'ve been wanting to explore more trails.',
		why: 'Authentic and forward-moving',
		citation: 'Based on: Chapter 2 - Authentic Communication'
	}
];

describe('POST /api/ai-wingman/impersonate', () => {
	let mockRequest: any;
	let mockLocals: any;

	beforeEach(() => {
		vi.clearAllMocks();

		// Setup mock request
		mockRequest = {
			json: vi.fn()
		};

		// Setup mock locals with authenticated session
		mockLocals = {
			auth: {
				getSession: vi.fn().mockResolvedValue({
					user: { id: TEST_USER_ID }
				})
			}
		};
	});

	describe('Authentication', () => {
		it('should reject requests without authentication', async () => {
			mockLocals.auth.getSession.mockResolvedValue(null);
			mockRequest.json.mockResolvedValue({
				conversationId: TEST_CONVERSATION_ID,
				matchLastMessage: 'Test message'
			});

			const { throwAuthenticationError } = await import('$lib/server/error-handler');

			try {
				await POST({ request: mockRequest, locals: mockLocals } as any);
				expect.fail('Should have thrown authentication error');
			} catch (err: any) {
				expect(err.status).toBe(401);
			}
		});

		it('should reject requests with missing user ID', async () => {
			mockLocals.auth.getSession.mockResolvedValue({ user: {} });
			mockRequest.json.mockResolvedValue({
				conversationId: TEST_CONVERSATION_ID,
				matchLastMessage: 'Test message'
			});

			try {
				await POST({ request: mockRequest, locals: mockLocals } as any);
				expect.fail('Should have thrown authentication error');
			} catch (err: any) {
				expect(err.status).toBe(401);
			}
		});
	});

	describe('Request Validation', () => {
		it('should reject invalid JSON', async () => {
			mockRequest.json.mockRejectedValue(new SyntaxError('Invalid JSON'));

			try {
				await POST({ request: mockRequest, locals: mockLocals } as any);
				expect.fail('Should have thrown validation error');
			} catch (err: any) {
				expect(err.status).toBe(400);
			}
		});

		it('should reject missing conversationId', async () => {
			mockRequest.json.mockResolvedValue({
				matchLastMessage: 'Test message'
			});

			try {
				await POST({ request: mockRequest, locals: mockLocals } as any);
				expect.fail('Should have thrown validation error');
			} catch (err: any) {
				expect(err.status).toBe(400);
			}
		});

		it('should reject missing matchLastMessage', async () => {
			mockRequest.json.mockResolvedValue({
				conversationId: TEST_CONVERSATION_ID
			});

			try {
				await POST({ request: mockRequest, locals: mockLocals } as any);
				expect.fail('Should have thrown validation error');
			} catch (err: any) {
				expect(err.status).toBe(400);
			}
		});

		it('should reject empty conversationId', async () => {
			mockRequest.json.mockResolvedValue({
				conversationId: '',
				matchLastMessage: 'Test message'
			});

			try {
				await POST({ request: mockRequest, locals: mockLocals } as any);
				expect.fail('Should have thrown validation error');
			} catch (err: any) {
				expect(err.status).toBe(400);
			}
		});

		it('should reject empty matchLastMessage', async () => {
			mockRequest.json.mockResolvedValue({
				conversationId: TEST_CONVERSATION_ID,
				matchLastMessage: ''
			});

			try {
				await POST({ request: mockRequest, locals: mockLocals } as any);
				expect.fail('Should have thrown validation error');
			} catch (err: any) {
				expect(err.status).toBe(400);
			}
		});

		it('should reject non-array recentMessages', async () => {
			mockRequest.json.mockResolvedValue({
				conversationId: TEST_CONVERSATION_ID,
				matchLastMessage: 'Test message',
				recentMessages: 'not an array'
			});

			try {
				await POST({ request: mockRequest, locals: mockLocals } as any);
				expect.fail('Should have thrown validation error');
			} catch (err: any) {
				expect(err.status).toBe(400);
			}
		});

		it('should reject messages with missing role', async () => {
			mockRequest.json.mockResolvedValue({
				conversationId: TEST_CONVERSATION_ID,
				matchLastMessage: 'Test message',
				recentMessages: [
					{ content: 'Test' } // Missing role
				]
			});

			try {
				await POST({ request: mockRequest, locals: mockLocals } as any);
				expect.fail('Should have thrown validation error');
			} catch (err: any) {
				expect(err.status).toBe(400);
			}
		});

		it('should reject messages with empty content', async () => {
			mockRequest.json.mockResolvedValue({
				conversationId: TEST_CONVERSATION_ID,
				matchLastMessage: 'Test message',
				recentMessages: [
					{ role: 'user', content: '' }
				]
			});

			try {
				await POST({ request: mockRequest, locals: mockLocals } as any);
				expect.fail('Should have thrown validation error');
			} catch (err: any) {
				expect(err.status).toBe(400);
			}
		});

		it('should reject invalid matchedUserProfile fields', async () => {
			mockRequest.json.mockResolvedValue({
				conversationId: TEST_CONVERSATION_ID,
				matchLastMessage: 'Test message',
				matchedUserProfile: {
					invalidField: 'value'
				}
			});

			try {
				await POST({ request: mockRequest, locals: mockLocals } as any);
				expect.fail('Should have thrown validation error');
			} catch (err: any) {
				expect(err.status).toBe(400);
			}
		});
	});

	describe('Message Count Validation', () => {
		it('should reject if fewer than 20 messages from match', async () => {
			const messages = createTestMessages(10); // Only 5 from match (every other)
			mockRequest.json.mockResolvedValue({
				conversationId: TEST_CONVERSATION_ID,
				matchLastMessage: 'Test message',
				recentMessages: messages
			});

			try {
				await POST({ request: mockRequest, locals: mockLocals } as any);
				expect.fail('Should have thrown validation error');
			} catch (err: any) {
				expect(err.status).toBe(400);
				expect(err.message).toContain('20+');
			}
		});

		it('should accept exactly 20 messages from match', async () => {
			const messages = createTestMessages(40); // 20 from match
			mockRequest.json.mockResolvedValue({
				conversationId: TEST_CONVERSATION_ID,
				matchLastMessage: 'Test message',
				recentMessages: messages,
				matchedUserProfile: TEST_MATCH_PROFILE
			});

			const { loadPersonality } = await import('$lib/server/profile-service');
			const { generateResponseOptions } = await import('$lib/server/ai-assistant-service');
			const { getSupabase } = await import('$lib/server/supabase');
			const { getEmbedding } = await import('$lib/embeddings');
			const { searchBookChunks } = await import('$lib/vectorstore');

			(loadPersonality as any).mockResolvedValue({
				communicationStyle: 'direct',
				personalityVibe: 'ambitious',
				mattersMost: 'humor',
				values: ['Authenticity'],
				datingPatterns: [],
				redFlagsToAvoid: [],
				updatedAt: Date.now()
			});

			(getEmbedding as any).mockResolvedValue([0.1, 0.2, 0.3]);
			(searchBookChunks as any).mockResolvedValue([
				{ chapter: 'Chapter 1', content: 'Test content' }
			]);
			(generateResponseOptions as any).mockResolvedValue(TEST_RESPONSE_OPTIONS);
			(getSupabase as any).mockReturnValue({
				from: vi.fn().mockReturnValue({
					update: vi.fn().mockReturnValue({
						eq: vi.fn().mockReturnValue({
							eq: vi.fn().mockResolvedValue({ error: null })
						})
					})
				})
			});

			const response = await POST({ request: mockRequest, locals: mockLocals } as any);
			const data = await response.json();

			expect(data.options).toBeDefined();
			expect(data.options.length).toBe(3);
		});

		it('should accept more than 20 messages from match', async () => {
			const messages = createTestMessages(50); // 25 from match
			mockRequest.json.mockResolvedValue({
				conversationId: TEST_CONVERSATION_ID,
				matchLastMessage: 'Test message',
				recentMessages: messages,
				matchedUserProfile: TEST_MATCH_PROFILE
			});

			const { loadPersonality } = await import('$lib/server/profile-service');
			const { generateResponseOptions } = await import('$lib/server/ai-assistant-service');
			const { getSupabase } = await import('$lib/server/supabase');
			const { getEmbedding } = await import('$lib/embeddings');
			const { searchBookChunks } = await import('$lib/vectorstore');

			(loadPersonality as any).mockResolvedValue({
				communicationStyle: 'direct',
				personalityVibe: 'ambitious',
				mattersMost: 'humor',
				values: ['Authenticity'],
				datingPatterns: [],
				redFlagsToAvoid: [],
				updatedAt: Date.now()
			});

			(getEmbedding as any).mockResolvedValue([0.1, 0.2, 0.3]);
			(searchBookChunks as any).mockResolvedValue([
				{ chapter: 'Chapter 1', content: 'Test content' }
			]);
			(generateResponseOptions as any).mockResolvedValue(TEST_RESPONSE_OPTIONS);
			(getSupabase as any).mockReturnValue({
				from: vi.fn().mockReturnValue({
					update: vi.fn().mockReturnValue({
						eq: vi.fn().mockReturnValue({
							eq: vi.fn().mockResolvedValue({ error: null })
						})
					})
				})
			});

			const response = await POST({ request: mockRequest, locals: mockLocals } as any);
			const data = await response.json();

			expect(data.options).toBeDefined();
			expect(data.options.length).toBe(3);
		});
	});

	describe('Response Generation', () => {
		it('should generate response options with correct structure', async () => {
			const messages = createTestMessages(40);
			mockRequest.json.mockResolvedValue({
				conversationId: TEST_CONVERSATION_ID,
				matchLastMessage: 'I love hiking!',
				recentMessages: messages,
				matchedUserProfile: TEST_MATCH_PROFILE
			});

			const { loadPersonality } = await import('$lib/server/profile-service');
			const { generateResponseOptions } = await import('$lib/server/ai-assistant-service');
			const { getSupabase } = await import('$lib/server/supabase');
			const { getEmbedding } = await import('$lib/embeddings');
			const { searchBookChunks } = await import('$lib/vectorstore');

			(loadPersonality as any).mockResolvedValue({
				communicationStyle: 'direct',
				personalityVibe: 'ambitious',
				mattersMost: 'humor',
				values: ['Authenticity'],
				datingPatterns: [],
				redFlagsToAvoid: [],
				updatedAt: Date.now()
			});

			(getEmbedding as any).mockResolvedValue([0.1, 0.2, 0.3]);
			(searchBookChunks as any).mockResolvedValue([
				{ chapter: 'Chapter 1', content: 'Test content' }
			]);
			(generateResponseOptions as any).mockResolvedValue(TEST_RESPONSE_OPTIONS);
			(getSupabase as any).mockReturnValue({
				from: vi.fn().mockReturnValue({
					update: vi.fn().mockReturnValue({
						eq: vi.fn().mockReturnValue({
							eq: vi.fn().mockResolvedValue({ error: null })
						})
					})
				})
			});

			const response = await POST({ request: mockRequest, locals: mockLocals } as any);
			const data = await response.json();

			expect(data.options).toHaveLength(3);
			expect(data.message).toBeDefined();

			// Verify each option has required fields
			data.options.forEach((option: any) => {
				expect(option.id).toBeDefined();
				expect(option.tone).toBeDefined();
				expect(option.message).toBeDefined();
				expect(option.why).toBeDefined();
				expect(option.citation).toBeDefined();
			});
		});

		it('should include confirmation message in response', async () => {
			const messages = createTestMessages(40);
			mockRequest.json.mockResolvedValue({
				conversationId: TEST_CONVERSATION_ID,
				matchLastMessage: 'Test message',
				recentMessages: messages,
				matchedUserProfile: TEST_MATCH_PROFILE
			});

			const { loadPersonality } = await import('$lib/server/profile-service');
			const { generateResponseOptions } = await import('$lib/server/ai-assistant-service');
			const { getSupabase } = await import('$lib/server/supabase');
			const { getEmbedding } = await import('$lib/embeddings');
			const { searchBookChunks } = await import('$lib/vectorstore');

			(loadPersonality as any).mockResolvedValue({
				communicationStyle: 'direct',
				personalityVibe: 'ambitious',
				mattersMost: 'humor',
				values: ['Authenticity'],
				datingPatterns: [],
				redFlagsToAvoid: [],
				updatedAt: Date.now()
			});

			(getEmbedding as any).mockResolvedValue([0.1, 0.2, 0.3]);
			(searchBookChunks as any).mockResolvedValue([
				{ chapter: 'Chapter 1', content: 'Test content' }
			]);
			(generateResponseOptions as any).mockResolvedValue(TEST_RESPONSE_OPTIONS);
			(getSupabase as any).mockReturnValue({
				from: vi.fn().mockReturnValue({
					update: vi.fn().mockReturnValue({
						eq: vi.fn().mockReturnValue({
							eq: vi.fn().mockResolvedValue({ error: null })
						})
					})
				})
			});

			const response = await POST({ request: mockRequest, locals: mockLocals } as any);
			const data = await response.json();

			expect(data.message).toBe('Here are 3 response options you can review and send:');
		});
	});

	describe('Error Handling', () => {
		it('should handle personality loading errors gracefully', async () => {
			const messages = createTestMessages(40);
			mockRequest.json.mockResolvedValue({
				conversationId: TEST_CONVERSATION_ID,
				matchLastMessage: 'Test message',
				recentMessages: messages
			});

			const { loadPersonality } = await import('$lib/server/profile-service');
			(loadPersonality as any).mockRejectedValue(new Error('Failed to load personality'));

			try {
				await POST({ request: mockRequest, locals: mockLocals } as any);
				expect.fail('Should have thrown error');
			} catch (err: any) {
				// Error handler returns 400 for validation errors when personality can't be loaded
				expect(err.status).toBe(400);
			}
		});

		it('should handle response option generation errors', async () => {
			const messages = createTestMessages(40);
			mockRequest.json.mockResolvedValue({
				conversationId: TEST_CONVERSATION_ID,
				matchLastMessage: 'Test message',
				recentMessages: messages
			});

			const { loadPersonality } = await import('$lib/server/profile-service');
			const { generateResponseOptions } = await import('$lib/server/ai-assistant-service');
			const { getEmbedding } = await import('$lib/embeddings');
			const { searchBookChunks } = await import('$lib/vectorstore');

			(loadPersonality as any).mockResolvedValue({
				communicationStyle: 'direct',
				personalityVibe: 'ambitious',
				mattersMost: 'humor',
				values: ['Authenticity'],
				datingPatterns: [],
				redFlagsToAvoid: [],
				updatedAt: Date.now()
			});

			(getEmbedding as any).mockResolvedValue([0.1, 0.2, 0.3]);
			(searchBookChunks as any).mockResolvedValue([
				{ chapter: 'Chapter 1', content: 'Test content' }
			]);
			(generateResponseOptions as any).mockRejectedValue(new Error('Claude API error'));

			try {
				await POST({ request: mockRequest, locals: mockLocals } as any);
				expect.fail('Should have thrown error');
			} catch (err: any) {
				// Error handler returns 502 for external API errors
				expect(err.status).toBe(502);
			}
		});

		it('should handle empty response options', async () => {
			const messages = createTestMessages(40);
			mockRequest.json.mockResolvedValue({
				conversationId: TEST_CONVERSATION_ID,
				matchLastMessage: 'Test message',
				recentMessages: messages
			});

			const { loadPersonality } = await import('$lib/server/profile-service');
			const { generateResponseOptions } = await import('$lib/server/ai-assistant-service');
			const { getEmbedding } = await import('$lib/embeddings');
			const { searchBookChunks } = await import('$lib/vectorstore');

			(loadPersonality as any).mockResolvedValue({
				communicationStyle: 'direct',
				personalityVibe: 'ambitious',
				mattersMost: 'humor',
				values: ['Authenticity'],
				datingPatterns: [],
				redFlagsToAvoid: [],
				updatedAt: Date.now()
			});

			(getEmbedding as any).mockResolvedValue([0.1, 0.2, 0.3]);
			(searchBookChunks as any).mockResolvedValue([
				{ chapter: 'Chapter 1', content: 'Test content' }
			]);
			(generateResponseOptions as any).mockResolvedValue([]); // Empty options

			try {
				await POST({ request: mockRequest, locals: mockLocals } as any);
				expect.fail('Should have thrown error');
			} catch (err: any) {
				// Error handler returns 502 for external API errors
				expect(err.status).toBe(502);
			}
		});

		it('should continue if database update fails', async () => {
			const messages = createTestMessages(40);
			mockRequest.json.mockResolvedValue({
				conversationId: TEST_CONVERSATION_ID,
				matchLastMessage: 'Test message',
				recentMessages: messages
			});

			const { loadPersonality } = await import('$lib/server/profile-service');
			const { generateResponseOptions } = await import('$lib/server/ai-assistant-service');
			const { getSupabase } = await import('$lib/server/supabase');
			const { getEmbedding } = await import('$lib/embeddings');
			const { searchBookChunks } = await import('$lib/vectorstore');

			(loadPersonality as any).mockResolvedValue({
				communicationStyle: 'direct',
				personalityVibe: 'ambitious',
				mattersMost: 'humor',
				values: ['Authenticity'],
				datingPatterns: [],
				redFlagsToAvoid: [],
				updatedAt: Date.now()
			});

			(getEmbedding as any).mockResolvedValue([0.1, 0.2, 0.3]);
			(searchBookChunks as any).mockResolvedValue([
				{ chapter: 'Chapter 1', content: 'Test content' }
			]);
			(generateResponseOptions as any).mockResolvedValue(TEST_RESPONSE_OPTIONS);
			(getSupabase as any).mockReturnValue({
				from: vi.fn().mockReturnValue({
					update: vi.fn().mockReturnValue({
						eq: vi.fn().mockReturnValue({
							eq: vi.fn().mockResolvedValue({ error: new Error('DB error') })
						})
					})
				})
			});

			// Should still return options even if DB update fails
			const response = await POST({ request: mockRequest, locals: mockLocals } as any);
			const data = await response.json();

			expect(data.options).toBeDefined();
			expect(data.options.length).toBe(3);
		});
	});

	describe('Edge Cases', () => {
		it('should handle whitespace-only conversationId', async () => {
			mockRequest.json.mockResolvedValue({
				conversationId: '   ',
				matchLastMessage: 'Test message'
			});

			try {
				await POST({ request: mockRequest, locals: mockLocals } as any);
				expect.fail('Should have thrown validation error');
			} catch (err: any) {
				expect(err.status).toBe(400);
			}
		});

		it('should handle whitespace-only matchLastMessage', async () => {
			mockRequest.json.mockResolvedValue({
				conversationId: TEST_CONVERSATION_ID,
				matchLastMessage: '   '
			});

			try {
				await POST({ request: mockRequest, locals: mockLocals } as any);
				expect.fail('Should have thrown validation error');
			} catch (err: any) {
				expect(err.status).toBe(400);
			}
		});

		it('should handle non-object matchedUserProfile', async () => {
			mockRequest.json.mockResolvedValue({
				conversationId: TEST_CONVERSATION_ID,
				matchLastMessage: 'Test message',
				matchedUserProfile: 'not an object'
			});

			try {
				await POST({ request: mockRequest, locals: mockLocals } as any);
				expect.fail('Should have thrown validation error');
			} catch (err: any) {
				expect(err.status).toBe(400);
			}
		});

		it('should handle missing book context gracefully', async () => {
			const messages = createTestMessages(40);
			mockRequest.json.mockResolvedValue({
				conversationId: TEST_CONVERSATION_ID,
				matchLastMessage: 'Test message',
				recentMessages: messages
			});

			const { loadPersonality } = await import('$lib/server/profile-service');
			const { generateResponseOptions } = await import('$lib/server/ai-assistant-service');
			const { getSupabase } = await import('$lib/server/supabase');
			const { getEmbedding } = await import('$lib/embeddings');
			const { searchBookChunks } = await import('$lib/vectorstore');

			(loadPersonality as any).mockResolvedValue({
				communicationStyle: 'direct',
				personalityVibe: 'ambitious',
				mattersMost: 'humor',
				values: ['Authenticity'],
				datingPatterns: [],
				redFlagsToAvoid: [],
				updatedAt: Date.now()
			});

			(getEmbedding as any).mockResolvedValue(null); // No embedding
			(searchBookChunks as any).mockRejectedValue(new Error('Search failed'));
			(generateResponseOptions as any).mockResolvedValue(TEST_RESPONSE_OPTIONS);
			(getSupabase as any).mockReturnValue({
				from: vi.fn().mockReturnValue({
					update: vi.fn().mockReturnValue({
						eq: vi.fn().mockReturnValue({
							eq: vi.fn().mockResolvedValue({ error: null })
						})
					})
				})
			});

			// Should still work with fallback book context
			const response = await POST({ request: mockRequest, locals: mockLocals } as any);
			const data = await response.json();

			expect(data.options).toBeDefined();
		});
	});
});
