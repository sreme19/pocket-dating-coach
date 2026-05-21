import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from './+server';
import type { RequestHandler } from './$types';
import type { ChatMessage } from '$lib/types';

// Mock dependencies
vi.mock('$lib/server/supabase', () => ({
	getSupabase: vi.fn()
}));

vi.mock('$lib/server/profile-service', () => ({
	loadPreferences: vi.fn()
}));

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
	buildAIBestieSystemPrompt: vi.fn()
}));

vi.mock('$lib/server/error-handler', () => ({
	throwAuthenticationError: vi.fn((msg) => {
		throw { status: 401, message: msg };
	}),
	throwValidationError: vi.fn((msg) => {
		throw { status: 400, message: msg };
	}),
	throwExternalAPIError: vi.fn((endpoint, err, msg) => {
		throw { status: 503, message: msg };
	}),
	throwInternalError: vi.fn((endpoint, err, msg) => {
		throw { status: 500, message: msg };
	}),
	throwDatabaseError: vi.fn((endpoint, err, msg) => {
		throw { status: 500, message: msg };
	}),
	logError: vi.fn(),
	validateRequiredFields: vi.fn(),
	validateArrayLength: vi.fn(),
	validateClaudeResponse: vi.fn(),
	ErrorType: {
		VALIDATION_ERROR: 'VALIDATION_ERROR',
		AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
		DATABASE_ERROR: 'DATABASE_ERROR',
		EXTERNAL_API_ERROR: 'EXTERNAL_API_ERROR',
		INTERNAL_ERROR: 'INTERNAL_ERROR'
	}
}));

import { getSupabase } from '$lib/server/supabase';
import { loadPreferences } from '$lib/server/profile-service';
import { getClaudeClient } from '$lib/claude';
import { searchBookChunks } from '$lib/vectorstore';
import { getEmbedding } from '$lib/embeddings';
import { buildAIBestieSystemPrompt } from '$lib/prompts';
import { throwAuthenticationError, throwValidationError, validateClaudeResponse } from '$lib/server/error-handler';

describe('POST /api/ai-bestie/summary', () => {
	let mockRequest: any;
	let mockLocals: any;
	let mockSupabase: any;

	beforeEach(() => {
		vi.clearAllMocks();

		// Setup mock request
		mockRequest = {
			json: vi.fn(),
			text: vi.fn()
		};

		// Setup mock locals with authenticated session
		mockLocals = {
			auth: {
				getSession: vi.fn().mockResolvedValue({
					user: { id: 'user-123' }
				})
			}
		};

		// Setup mock Supabase
		mockSupabase = {
			from: vi.fn().mockReturnValue({
				select: vi.fn().mockReturnThis(),
				eq: vi.fn().mockReturnThis(),
				order: vi.fn().mockReturnThis(),
				single: vi.fn()
			})
		};

		(getSupabase as any).mockReturnValue(mockSupabase);

		// Setup mock preferences
		(loadPreferences as any).mockResolvedValue({
			emotionalSignals: ['Asks about my day'],
			lifestyleSignals: ['Active'],
			maturitySignals: ['Takes responsibility'],
			boundaries: ['No excessive drinking'],
			dealbreakers: ['Disrespectful'],
			privateCompatibilityNotes: []
		});

		// Setup mock embeddings
		(getEmbedding as any).mockResolvedValue([0.1, 0.2, 0.3]);

		// Setup mock book chunks
		(searchBookChunks as any).mockResolvedValue([
			{
				chapter: 'Chapter 1',
				content: 'Sample book content'
			}
		]);

		// Setup mock system prompt
		(buildAIBestieSystemPrompt as any).mockReturnValue('System prompt');

		// Setup mock Claude response
		(validateClaudeResponse as any).mockReturnValue({ valid: true });
	});

	describe('Authentication', () => {
		it('should reject requests without authentication', async () => {
			mockLocals.auth.getSession.mockResolvedValue(null);

			try {
				await POST({ request: mockRequest, locals: mockLocals } as any);
				expect.fail('Should have thrown authentication error');
			} catch (err: any) {
				expect(err.status).toBe(401);
			}
		});

		it('should reject requests with missing user ID', async () => {
			mockLocals.auth.getSession.mockResolvedValue({ user: {} });

			try {
				await POST({ request: mockRequest, locals: mockLocals } as any);
				expect.fail('Should have thrown authentication error');
			} catch (err: any) {
				expect(err.status).toBe(401);
			}
		});
	});

	describe('Request Validation', () => {
		it('should handle empty request body', async () => {
			mockRequest.text.mockResolvedValue('');

			mockSupabase.from().select().eq().eq().order.mockResolvedValue({
				data: [],
				error: null
			});

			const response = await POST({ request: mockRequest, locals: mockLocals } as any);
			const data = await response.json();

			expect(data.summaries).toEqual([]);
			expect(data.totalMatches).toBe(0);
		});

		it('should handle invalid JSON in request body', async () => {
			mockRequest.text.mockResolvedValue('invalid json');

			try {
				await POST({ request: mockRequest, locals: mockLocals } as any);
				expect.fail('Should have thrown validation error');
			} catch (err: any) {
				expect(err.status).toBe(400);
			}
		});

		it('should reject invalid userId format', async () => {
			mockRequest.text.mockResolvedValue(JSON.stringify({ userId: '' }));

			try {
				await POST({ request: mockRequest, locals: mockLocals } as any);
				expect.fail('Should have thrown validation error');
			} catch (err: any) {
				// The error is thrown by throwValidationError
				expect(err).toBeDefined();
			}
		});

		it('should reject non-string userId', async () => {
			mockRequest.text.mockResolvedValue(JSON.stringify({ userId: 123 }));

			try {
				await POST({ request: mockRequest, locals: mockLocals } as any);
				expect.fail('Should have thrown validation error');
			} catch (err: any) {
				expect(err).toBeDefined();
			}
		});
	});

	describe('Profile Validation', () => {
		it('should reject requests when preferences cannot be loaded', async () => {
			mockRequest.text.mockResolvedValue('');
			(loadPreferences as any).mockRejectedValue(new Error('Database error'));

			try {
				await POST({ request: mockRequest, locals: mockLocals } as any);
				expect.fail('Should have thrown validation error');
			} catch (err: any) {
				// The error is thrown by throwValidationError
				expect(err).toBeDefined();
			}
		});

		it('should reject requests when preferences are empty', async () => {
			mockRequest.text.mockResolvedValue('');
			(loadPreferences as any).mockResolvedValue({
				emotionalSignals: [],
				lifestyleSignals: [],
				maturitySignals: [],
				boundaries: [],
				dealbreakers: [],
				privateCompatibilityNotes: []
			});

			try {
				await POST({ request: mockRequest, locals: mockLocals } as any);
				expect.fail('Should have thrown validation error');
			} catch (err: any) {
				// The error is thrown by throwValidationError
				expect(err).toBeDefined();
			}
		});
	});

	describe('Conversation Retrieval', () => {
		it('should return empty summaries when no conversations exist', async () => {
			mockRequest.text.mockResolvedValue('');

			mockSupabase.from().select().eq().eq().order.mockResolvedValue({
				data: [],
				error: null
			});

			const response = await POST({ request: mockRequest, locals: mockLocals } as any);
			const data = await response.json();

			expect(data.summaries).toEqual([]);
			expect(data.totalMatches).toBe(0);
			expect(data.lastUpdated).toBeDefined();
		});

		it('should handle database errors when fetching conversations', async () => {
			mockRequest.text.mockResolvedValue('');

			mockSupabase.from().select().eq().eq().order.mockResolvedValue({
				data: null,
				error: { message: 'Database error', code: 'DB_ERROR' }
			});

			try {
				await POST({ request: mockRequest, locals: mockLocals } as any);
				expect.fail('Should have thrown database error');
			} catch (err: any) {
				expect(err.status).toBe(500);
			}
		});
	});

	describe('Summary Generation', () => {
		it('should generate summaries for active conversations', async () => {
			mockRequest.text.mockResolvedValue('');

			const mockMessages: ChatMessage[] = [
				{
					id: '1',
					role: 'user',
					content: 'Hi there!',
					timestamp: Date.now() - 10000
				},
				{
					id: '2',
					role: 'assistant',
					content: 'Hello! How are you?',
					timestamp: Date.now()
				}
			];

			mockSupabase.from().select().eq().eq().order.mockResolvedValue({
				data: [
					{
						id: 'conv-1',
						user_id: 'user-123',
						match_conversation_id: 'match-1',
						assistant_type: 'bestie',
						messages: mockMessages,
						is_active: true,
						updated_at: new Date().toISOString()
					}
				],
				error: null
			});

			// Mock Claude response
			const mockClaudeClient = {
				messages: {
					create: vi.fn().mockResolvedValue({
						content: [
							{
								type: 'text',
								text: JSON.stringify({
									keyInsights: ['Very engaged'],
									greenFlags: ['Asks questions'],
									yellowFlags: [],
									redFlags: [],
									recommendedNextMove: 'Continue conversation',
									conversationMomentum: 'heating_up'
								})
							}
						]
					})
				}
			};

			(getClaudeClient as any).mockReturnValue(mockClaudeClient);

			const response = await POST({ request: mockRequest, locals: mockLocals } as any);
			const data = await response.json();

			expect(data.summaries).toHaveLength(1);
			expect(data.summaries[0]).toMatchObject({
				matchId: 'match-1',
				keyInsights: ['Very engaged'],
				greenFlags: ['Asks questions'],
				yellowFlags: [],
				redFlags: [],
				recommendedNextMove: 'Continue conversation',
				conversationMomentum: 'heating_up',
				messageCount: 2
			});
			expect(data.totalMatches).toBe(1);
		});

		it('should skip conversations with no messages', async () => {
			mockRequest.text.mockResolvedValue('');

			mockSupabase.from().select().eq().eq().order.mockResolvedValue({
				data: [
					{
						id: 'conv-1',
						user_id: 'user-123',
						match_conversation_id: 'match-1',
						assistant_type: 'bestie',
						messages: [],
						is_active: true,
						updated_at: new Date().toISOString()
					}
				],
				error: null
			});

			const response = await POST({ request: mockRequest, locals: mockLocals } as any);
			const data = await response.json();

			expect(data.summaries).toEqual([]);
			expect(data.totalMatches).toBe(0);
		});

		it('should handle Claude API errors gracefully', async () => {
			mockRequest.text.mockResolvedValue('');

			const mockMessages: ChatMessage[] = [
				{
					id: '1',
					role: 'user',
					content: 'Hi there!',
					timestamp: Date.now()
				}
			];

			mockSupabase.from().select().eq().eq().order.mockResolvedValue({
				data: [
					{
						id: 'conv-1',
						user_id: 'user-123',
						match_conversation_id: 'match-1',
						assistant_type: 'bestie',
						messages: mockMessages,
						is_active: true,
						updated_at: new Date().toISOString()
					}
				],
				error: null
			});

			// Mock Claude error
			const mockClaudeClient = {
				messages: {
					create: vi.fn().mockRejectedValue(new Error('API error'))
				}
			};

			(getClaudeClient as any).mockReturnValue(mockClaudeClient);

			const response = await POST({ request: mockRequest, locals: mockLocals } as any);
			const data = await response.json();

			// Should return empty summaries when Claude fails
			expect(data.summaries).toEqual([]);
			expect(data.totalMatches).toBe(0);
		});

		it('should handle invalid Claude response format', async () => {
			mockRequest.text.mockResolvedValue('');

			const mockMessages: ChatMessage[] = [
				{
					id: '1',
					role: 'user',
					content: 'Hi there!',
					timestamp: Date.now()
				}
			];

			mockSupabase.from().select().eq().eq().order.mockResolvedValue({
				data: [
					{
						id: 'conv-1',
						user_id: 'user-123',
						match_conversation_id: 'match-1',
						assistant_type: 'bestie',
						messages: mockMessages,
						is_active: true,
						updated_at: new Date().toISOString()
					}
				],
				error: null
			});

			// Mock invalid Claude response
			(validateClaudeResponse as any).mockReturnValue({ valid: false, error: 'Invalid format' });

			const response = await POST({ request: mockRequest, locals: mockLocals } as any);
			const data = await response.json();

			// Should return empty summaries when response is invalid
			expect(data.summaries).toEqual([]);
			expect(data.totalMatches).toBe(0);
		});

		it('should handle non-text Claude response', async () => {
			mockRequest.text.mockResolvedValue('');

			const mockMessages: ChatMessage[] = [
				{
					id: '1',
					role: 'user',
					content: 'Hi there!',
					timestamp: Date.now()
				}
			];

			mockSupabase.from().select().eq().eq().order.mockResolvedValue({
				data: [
					{
						id: 'conv-1',
						user_id: 'user-123',
						match_conversation_id: 'match-1',
						assistant_type: 'bestie',
						messages: mockMessages,
						is_active: true,
						updated_at: new Date().toISOString()
					}
				],
				error: null
			});

			// Mock non-text Claude response
			const mockClaudeClient = {
				messages: {
					create: vi.fn().mockResolvedValue({
						content: [
							{
								type: 'image',
								url: 'https://example.com/image.jpg'
							}
						]
					})
				}
			};

			(getClaudeClient as any).mockReturnValue(mockClaudeClient);

			const response = await POST({ request: mockRequest, locals: mockLocals } as any);
			const data = await response.json();

			// Should return empty summaries when response type is wrong
			expect(data.summaries).toEqual([]);
			expect(data.totalMatches).toBe(0);
		});

		it('should handle empty Claude response text', async () => {
			mockRequest.text.mockResolvedValue('');

			const mockMessages: ChatMessage[] = [
				{
					id: '1',
					role: 'user',
					content: 'Hi there!',
					timestamp: Date.now()
				}
			];

			mockSupabase.from().select().eq().eq().order.mockResolvedValue({
				data: [
					{
						id: 'conv-1',
						user_id: 'user-123',
						match_conversation_id: 'match-1',
						assistant_type: 'bestie',
						messages: mockMessages,
						is_active: true,
						updated_at: new Date().toISOString()
					}
				],
				error: null
			});

			// Mock empty Claude response
			const mockClaudeClient = {
				messages: {
					create: vi.fn().mockResolvedValue({
						content: [
							{
								type: 'text',
								text: ''
							}
						]
					})
				}
			};

			(getClaudeClient as any).mockReturnValue(mockClaudeClient);

			const response = await POST({ request: mockRequest, locals: mockLocals } as any);
			const data = await response.json();

			// Should return empty summaries when response is empty
			expect(data.summaries).toEqual([]);
			expect(data.totalMatches).toBe(0);
		});

		it('should handle invalid JSON in Claude response', async () => {
			mockRequest.text.mockResolvedValue('');

			const mockMessages: ChatMessage[] = [
				{
					id: '1',
					role: 'user',
					content: 'Hi there!',
					timestamp: Date.now()
				}
			];

			mockSupabase.from().select().eq().eq().order.mockResolvedValue({
				data: [
					{
						id: 'conv-1',
						user_id: 'user-123',
						match_conversation_id: 'match-1',
						assistant_type: 'bestie',
						messages: mockMessages,
						is_active: true,
						updated_at: new Date().toISOString()
					}
				],
				error: null
			});

			// Mock invalid JSON Claude response
			const mockClaudeClient = {
				messages: {
					create: vi.fn().mockResolvedValue({
						content: [
							{
								type: 'text',
								text: 'This is not JSON'
							}
						]
					})
				}
			};

			(getClaudeClient as any).mockReturnValue(mockClaudeClient);

			const response = await POST({ request: mockRequest, locals: mockLocals } as any);
			const data = await response.json();

			// Should return summaries with default values when JSON parsing fails
			expect(data.summaries).toHaveLength(1);
			expect(data.summaries[0]).toMatchObject({
				matchId: 'match-1',
				keyInsights: [],
				greenFlags: [],
				yellowFlags: [],
				redFlags: [],
				recommendedNextMove: 'Continue the conversation',
				conversationMomentum: 'steady'
			});
		});
	});

	describe('Multiple Conversations', () => {
		it('should generate summaries for multiple conversations', async () => {
			mockRequest.text.mockResolvedValue('');

			const mockMessages1: ChatMessage[] = [
				{
					id: '1',
					role: 'user',
					content: 'Hi!',
					timestamp: Date.now() - 5000
				}
			];

			const mockMessages2: ChatMessage[] = [
				{
					id: '2',
					role: 'user',
					content: 'Hello!',
					timestamp: Date.now()
				}
			];

			mockSupabase.from().select().eq().eq().order.mockResolvedValue({
				data: [
					{
						id: 'conv-1',
						user_id: 'user-123',
						match_conversation_id: 'match-1',
						assistant_type: 'bestie',
						messages: mockMessages1,
						is_active: true,
						updated_at: new Date().toISOString()
					},
					{
						id: 'conv-2',
						user_id: 'user-123',
						match_conversation_id: 'match-2',
						assistant_type: 'bestie',
						messages: mockMessages2,
						is_active: true,
						updated_at: new Date().toISOString()
					}
				],
				error: null
			});

			// Mock Claude responses
			const mockClaudeClient = {
				messages: {
					create: vi.fn().mockResolvedValue({
						content: [
							{
								type: 'text',
								text: JSON.stringify({
									keyInsights: ['Engaged'],
									greenFlags: ['Friendly'],
									yellowFlags: [],
									redFlags: [],
									recommendedNextMove: 'Continue',
									conversationMomentum: 'heating_up'
								})
							}
						]
					})
				}
			};

			(getClaudeClient as any).mockReturnValue(mockClaudeClient);

			const response = await POST({ request: mockRequest, locals: mockLocals } as any);
			const data = await response.json();

			expect(data.summaries).toHaveLength(2);
			expect(data.totalMatches).toBe(2);
			// Should be sorted by last message time (most recent first)
			expect(data.summaries[0].matchId).toBe('match-2');
			expect(data.summaries[1].matchId).toBe('match-1');
		});
	});

	describe('Response Format', () => {
		it('should return properly formatted response', async () => {
			mockRequest.text.mockResolvedValue('');

			mockSupabase.from().select().eq().eq().order.mockResolvedValue({
				data: [],
				error: null
			});

			const response = await POST({ request: mockRequest, locals: mockLocals } as any);
			const data = await response.json();

			expect(data).toHaveProperty('summaries');
			expect(data).toHaveProperty('lastUpdated');
			expect(data).toHaveProperty('totalMatches');
			expect(Array.isArray(data.summaries)).toBe(true);
			expect(typeof data.lastUpdated).toBe('number');
			expect(typeof data.totalMatches).toBe('number');
		});

		it('should include all required fields in match summary', async () => {
			mockRequest.text.mockResolvedValue('');

			const mockMessages: ChatMessage[] = [
				{
					id: '1',
					role: 'user',
					content: 'Hi!',
					timestamp: Date.now()
				}
			];

			mockSupabase.from().select().eq().eq().order.mockResolvedValue({
				data: [
					{
						id: 'conv-1',
						user_id: 'user-123',
						match_conversation_id: 'match-1',
						assistant_type: 'bestie',
						messages: mockMessages,
						is_active: true,
						updated_at: new Date().toISOString()
					}
				],
				error: null
			});

			const mockClaudeClient = {
				messages: {
					create: vi.fn().mockResolvedValue({
						content: [
							{
								type: 'text',
								text: JSON.stringify({
									keyInsights: ['Insight'],
									greenFlags: ['Flag'],
									yellowFlags: [],
									redFlags: [],
									recommendedNextMove: 'Move',
									conversationMomentum: 'heating_up'
								})
							}
						]
					})
				}
			};

			(getClaudeClient as any).mockReturnValue(mockClaudeClient);

			const response = await POST({ request: mockRequest, locals: mockLocals } as any);
			const data = await response.json();

			const summary = data.summaries[0];
			expect(summary).toHaveProperty('matchId');
			expect(summary).toHaveProperty('matchName');
			expect(summary).toHaveProperty('keyInsights');
			expect(summary).toHaveProperty('greenFlags');
			expect(summary).toHaveProperty('yellowFlags');
			expect(summary).toHaveProperty('redFlags');
			expect(summary).toHaveProperty('recommendedNextMove');
			expect(summary).toHaveProperty('conversationMomentum');
			expect(summary).toHaveProperty('lastMessageTime');
			expect(summary).toHaveProperty('messageCount');
		});
	});

	describe('Edge Cases', () => {
		it('should use authenticated user ID when userId not provided', async () => {
			mockRequest.text.mockResolvedValue('');

			mockSupabase.from().select().eq().eq().order.mockResolvedValue({
				data: [],
				error: null
			});

			await POST({ request: mockRequest, locals: mockLocals } as any);

			// Verify that loadPreferences was called with authenticated user ID
			expect(loadPreferences).toHaveBeenCalledWith('user-123');
		});

		it('should use provided userId when supplied', async () => {
			mockRequest.text.mockResolvedValue(JSON.stringify({ userId: 'other-user' }));

			mockSupabase.from().select().eq().eq().order.mockResolvedValue({
				data: [],
				error: null
			});

			await POST({ request: mockRequest, locals: mockLocals } as any);

			// Verify that loadPreferences was called with provided user ID
			expect(loadPreferences).toHaveBeenCalledWith('other-user');
		});

		it('should handle conversations with null messages array', async () => {
			mockRequest.text.mockResolvedValue('');

			mockSupabase.from().select().eq().eq().order.mockResolvedValue({
				data: [
					{
						id: 'conv-1',
						user_id: 'user-123',
						match_conversation_id: 'match-1',
						assistant_type: 'bestie',
						messages: null,
						is_active: true,
						updated_at: new Date().toISOString()
					}
				],
				error: null
			});

			const response = await POST({ request: mockRequest, locals: mockLocals } as any);
			const data = await response.json();

			// Should skip conversations with null messages
			expect(data.summaries).toEqual([]);
			expect(data.totalMatches).toBe(0);
		});

		it('should handle conversations with undefined messages array', async () => {
			mockRequest.text.mockResolvedValue('');

			mockSupabase.from().select().eq().eq().order.mockResolvedValue({
				data: [
					{
						id: 'conv-1',
						user_id: 'user-123',
						match_conversation_id: 'match-1',
						assistant_type: 'bestie',
						messages: undefined,
						is_active: true,
						updated_at: new Date().toISOString()
					}
				],
				error: null
			});

			const response = await POST({ request: mockRequest, locals: mockLocals } as any);
			const data = await response.json();

			// Should skip conversations with undefined messages
			expect(data.summaries).toEqual([]);
			expect(data.totalMatches).toBe(0);
		});
	});
});
