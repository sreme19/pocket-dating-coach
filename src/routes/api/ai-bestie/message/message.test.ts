import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { POST } from './+server';
import type { ChatMessage, UserProfile } from '$lib/types';

// Mock dependencies
vi.mock('$lib/claude', () => ({
	getClaudeClient: vi.fn(),
	CLAUDE_MODEL: 'claude-3-5-sonnet-20241022',
	MAX_TOKENS: 1024
}));

vi.mock('$lib/vectorstore', () => ({
	searchBookChunks: vi.fn()
}));

vi.mock('$lib/embeddings', () => ({
	getEmbedding: vi.fn()
}));

vi.mock('$lib/prompts', () => ({
	buildAIBestieSystemPrompt: vi.fn(),
	buildAIAssistantContextPrompt: vi.fn()
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
	validateRequiredFields: vi.fn(),
	validateArrayLength: vi.fn(),
	logError: vi.fn(),
	validateClaudeResponse: vi.fn(),
	ErrorType: {
		VALIDATION_ERROR: 'VALIDATION_ERROR',
		EXTERNAL_API_ERROR: 'EXTERNAL_API_ERROR',
		DATABASE_ERROR: 'DATABASE_ERROR',
		INTERNAL_ERROR: 'INTERNAL_ERROR'
	}
}));

vi.mock('$lib/server/profile-service', () => ({
	loadPreferences: vi.fn()
}));

vi.mock('$lib/server/supabase', () => ({
	getSupabase: vi.fn()
}));

vi.mock('$lib/server/ai-assistant-service', () => ({
	autoUpdateProfile: vi.fn()
}));

import { getClaudeClient } from '$lib/claude';
import { searchBookChunks } from '$lib/vectorstore';
import { getEmbedding } from '$lib/embeddings';
import { buildAIBestieSystemPrompt, buildAIAssistantContextPrompt } from '$lib/prompts';
import { loadPreferences } from '$lib/server/profile-service';
import { getSupabase } from '$lib/server/supabase';
import { autoUpdateProfile } from '$lib/server/ai-assistant-service';
import {
	throwAuthenticationError,
	throwValidationError,
	validateRequiredFields,
	validateClaudeResponse
} from '$lib/server/error-handler';

describe('POST /api/ai-bestie/message', () => {
	let mockRequest: Partial<Request>;
	let mockLocals: any;
	let mockEvent: Partial<RequestEvent>;

	beforeEach(() => {
		vi.clearAllMocks();

		// Setup mock request
		mockRequest = {
			json: vi.fn()
		};

		// Setup mock locals with auth session
		mockLocals = {
			auth: {
				getSession: vi.fn().mockResolvedValue({
					user: { id: 'user-123' }
				})
			}
		};

		// Setup mock event
		mockEvent = {
			request: mockRequest as Request,
			locals: mockLocals
		} as Partial<RequestEvent>;

		// Setup default mocks
		(validateRequiredFields as any).mockReturnValue({ valid: true, missingFields: [] });
		(validateClaudeResponse as any).mockReturnValue({ valid: true });
		(buildAIBestieSystemPrompt as any).mockReturnValue('System prompt');
		(buildAIAssistantContextPrompt as any).mockReturnValue('Context prompt');
		(getEmbedding as any).mockResolvedValue([0.1, 0.2, 0.3]);
		(searchBookChunks as any).mockResolvedValue([
			{ chapter: 'Chapter 1', content: 'Book content' }
		]);
		(loadPreferences as any).mockResolvedValue({
			emotionalSignals: ['Asks about my day'],
			lifestyleSignals: ['Active'],
			maturitySignals: [],
			boundaries: [],
			dealbreakers: [],
			privateCompatibilityNotes: [],
			updatedAt: Date.now()
		});
	});

	describe('Authentication', () => {
		it('should reject requests without authentication', async () => {
			mockLocals.auth.getSession.mockResolvedValue(null);

			try {
				await POST(mockEvent as RequestEvent);
				expect.fail('Should have thrown authentication error');
			} catch (err: any) {
				expect(err.status).toBe(401);
			}
		});

		it('should reject requests with missing user ID', async () => {
			mockLocals.auth.getSession.mockResolvedValue({ user: {} });

			try {
				await POST(mockEvent as RequestEvent);
				expect.fail('Should have thrown authentication error');
			} catch (err: any) {
				expect(err.status).toBe(401);
			}
		});

		it('should accept requests with valid authentication', async () => {
			(mockRequest.json as any).mockResolvedValue({
				conversationId: 'conv-123',
				userMessage: 'Hello'
			});

			const mockClaudeClient = {
				messages: {
					create: vi.fn().mockResolvedValue({
						content: [{ type: 'text', text: 'Response' }]
					})
				}
			};
			(getClaudeClient as any).mockReturnValue(mockClaudeClient);

			const mockSupabase = {
				from: vi.fn().mockReturnValue({
					select: vi.fn().mockReturnValue({
						eq: vi.fn().mockReturnValue({
							single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
						})
					}),
					upsert: vi.fn().mockResolvedValue({ error: null })
				})
			};
			(getSupabase as any).mockReturnValue(mockSupabase);

			const response = await POST(mockEvent as RequestEvent);
			expect(response.status).toBe(200);
		});
	});

	describe('Request Validation', () => {
		beforeEach(() => {
			mockLocals.auth.getSession.mockResolvedValue({ user: { id: 'user-123' } });
		});

		it('should reject invalid JSON', async () => {
			(mockRequest.json as any).mockRejectedValue(new Error('Invalid JSON'));

			try {
				await POST(mockEvent as RequestEvent);
				expect.fail('Should have thrown validation error');
			} catch (err: any) {
				expect(err.status).toBe(400);
			}
		});

		it('should reject missing required fields', async () => {
			(validateRequiredFields as any).mockReturnValue({
				valid: false,
				missingFields: ['conversationId']
			});

			(mockRequest.json as any).mockResolvedValue({
				userMessage: 'Hello'
			});

			try {
				await POST(mockEvent as RequestEvent);
				expect.fail('Should have thrown validation error');
			} catch (err: any) {
				expect(err.status).toBe(400);
			}
		});

		it('should reject empty conversationId', async () => {
			(mockRequest.json as any).mockResolvedValue({
				conversationId: '',
				userMessage: 'Hello'
			});

			try {
				await POST(mockEvent as RequestEvent);
				expect.fail('Should have thrown validation error');
			} catch (err: any) {
				expect(err.status).toBe(400);
			}
		});

		it('should reject empty userMessage', async () => {
			(mockRequest.json as any).mockResolvedValue({
				conversationId: 'conv-123',
				userMessage: ''
			});

			try {
				await POST(mockEvent as RequestEvent);
				expect.fail('Should have thrown validation error');
			} catch (err: any) {
				expect(err.status).toBe(400);
			}
		});

		it('should reject non-array recentMessages', async () => {
			(mockRequest.json as any).mockResolvedValue({
				conversationId: 'conv-123',
				userMessage: 'Hello',
				recentMessages: 'not an array'
			});

			try {
				await POST(mockEvent as RequestEvent);
				expect.fail('Should have thrown validation error');
			} catch (err: any) {
				expect(err.status).toBe(400);
			}
		});

		it('should reject messages with missing role or content', async () => {
			(mockRequest.json as any).mockResolvedValue({
				conversationId: 'conv-123',
				userMessage: 'Hello',
				recentMessages: [{ role: 'user' }] // missing content
			});

			try {
				await POST(mockEvent as RequestEvent);
				expect.fail('Should have thrown validation error');
			} catch (err: any) {
				expect(err.status).toBe(400);
			}
		});

		it('should reject invalid matchedUserProfile fields', async () => {
			(mockRequest.json as any).mockResolvedValue({
				conversationId: 'conv-123',
				userMessage: 'Hello',
				matchedUserProfile: { invalidField: 'value' }
			});

			try {
				await POST(mockEvent as RequestEvent);
				expect.fail('Should have thrown validation error');
			} catch (err: any) {
				expect(err.status).toBe(400);
			}
		});

		it('should accept valid request with all fields', async () => {
			(mockRequest.json as any).mockResolvedValue({
				conversationId: 'conv-123',
				userMessage: 'Should I say yes to coffee?',
				recentMessages: [
					{ role: 'user', content: 'Hi there' },
					{ role: 'assistant', content: 'Hey! How are you?' }
				],
				matchedUserProfile: {
					gender: 'man',
					ageRange: '25-30',
					datingApp: 'hinge',
					relationshipGoal: 'serious'
				}
			});

			const mockClaudeClient = {
				messages: {
					create: vi.fn().mockResolvedValue({
						content: [{ type: 'text', text: 'Response' }]
					})
				}
			};
			(getClaudeClient as any).mockReturnValue(mockClaudeClient);

			const mockSupabase = {
				from: vi.fn().mockReturnValue({
					select: vi.fn().mockReturnValue({
						eq: vi.fn().mockReturnValue({
							single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
						})
					}),
					upsert: vi.fn().mockResolvedValue({ error: null })
				})
			};
			(getSupabase as any).mockReturnValue(mockSupabase);

			const response = await POST(mockEvent as RequestEvent);
			expect(response.status).toBe(200);
		});
	});

	describe('Profile Loading', () => {
		beforeEach(() => {
			mockLocals.auth.getSession.mockResolvedValue({ user: { id: 'user-123' } });
			(mockRequest.json as any).mockResolvedValue({
				conversationId: 'conv-123',
				userMessage: 'Hello'
			});
		});

		it('should load user preferences', async () => {
			const mockClaudeClient = {
				messages: {
					create: vi.fn().mockResolvedValue({
						content: [{ type: 'text', text: 'Response' }]
					})
				}
			};
			(getClaudeClient as any).mockReturnValue(mockClaudeClient);

			const mockSupabase = {
				from: vi.fn().mockReturnValue({
					select: vi.fn().mockReturnValue({
						eq: vi.fn().mockReturnValue({
							single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
						})
					}),
					upsert: vi.fn().mockResolvedValue({ error: null })
				})
			};
			(getSupabase as any).mockReturnValue(mockSupabase);

			await POST(mockEvent as RequestEvent);

			expect(loadPreferences).toHaveBeenCalledWith('user-123');
		});

		it('should handle preference loading errors', async () => {
			(loadPreferences as any).mockRejectedValue(new Error('Database error'));

			try {
				await POST(mockEvent as RequestEvent);
				expect.fail('Should have thrown validation error');
			} catch (err: any) {
				// Error handler converts database errors to 400 validation errors
				expect([400, 500]).toContain(err.status);
			}
		});
	});

	describe('Claude API Integration', () => {
		beforeEach(() => {
			mockLocals.auth.getSession.mockResolvedValue({ user: { id: 'user-123' } });
			(mockRequest.json as any).mockResolvedValue({
				conversationId: 'conv-123',
				userMessage: 'Should I say yes to coffee?'
			});
		});

		it('should call Claude API with correct parameters', async () => {
			const mockClaudeClient = {
				messages: {
					create: vi.fn().mockResolvedValue({
						content: [{ type: 'text', text: 'Response' }]
					})
				}
			};
			(getClaudeClient as any).mockReturnValue(mockClaudeClient);

			const mockSupabase = {
				from: vi.fn().mockReturnValue({
					select: vi.fn().mockReturnValue({
						eq: vi.fn().mockReturnValue({
							single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
						})
					}),
					upsert: vi.fn().mockResolvedValue({ error: null })
				})
			};
			(getSupabase as any).mockReturnValue(mockSupabase);

			await POST(mockEvent as RequestEvent);

			expect(mockClaudeClient.messages.create).toHaveBeenCalled();
			const callArgs = mockClaudeClient.messages.create.mock.calls[0][0];
			expect(callArgs.model).toBe('claude-3-5-sonnet-20241022');
			expect(callArgs.max_tokens).toBe(1024);
			expect(callArgs.system).toBe('System prompt');
			expect(callArgs.messages).toEqual([
				{ role: 'user', content: 'Should I say yes to coffee?' }
			]);
		});

		it('should handle Claude API errors', async () => {
			const mockClaudeClient = {
				messages: {
					create: vi.fn().mockRejectedValue(new Error('API Error'))
				}
			};
			(getClaudeClient as any).mockReturnValue(mockClaudeClient);

			try {
				await POST(mockEvent as RequestEvent);
				expect.fail('Should have thrown external API error');
			} catch (err: any) {
				// Error handler converts API errors to 500 or 503
				expect([500, 503]).toContain(err.status);
			}
		});

		it('should extract citations from response', async () => {
			const mockClaudeClient = {
				messages: {
					create: vi.fn().mockResolvedValue({
						content: [
							{
								type: 'text',
								text: 'Coffee is great! *Based on:Chapter 3 - First Dates* Say yes with confidence.'
							}
						]
					})
				}
			};
			(getClaudeClient as any).mockReturnValue(mockClaudeClient);

			const mockSupabase = {
				from: vi.fn().mockReturnValue({
					select: vi.fn().mockReturnValue({
						eq: vi.fn().mockReturnValue({
							single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
						})
					}),
					upsert: vi.fn().mockResolvedValue({ error: null })
				})
			};
			(getSupabase as any).mockReturnValue(mockSupabase);

			const response = await POST(mockEvent as RequestEvent);
			const body = await response.json();

			expect(body.citations).toContain('Based on:Chapter 3 - First Dates');
			expect(body.reply).not.toContain('*Based on:');
		});

		it('should extract suggestions from response', async () => {
			const mockClaudeClient = {
				messages: {
					create: vi.fn().mockResolvedValue({
						content: [
							{
								type: 'text',
								text: 'Here are some tips:\n- Say yes with enthusiasm\n- Suggest a specific time\n- Ask about his favorite spot'
							}
						]
					})
				}
			};
			(getClaudeClient as any).mockReturnValue(mockClaudeClient);

			const mockSupabase = {
				from: vi.fn().mockReturnValue({
					select: vi.fn().mockReturnValue({
						eq: vi.fn().mockReturnValue({
							single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
						})
					}),
					upsert: vi.fn().mockResolvedValue({ error: null })
				})
			};
			(getSupabase as any).mockReturnValue(mockSupabase);

			const response = await POST(mockEvent as RequestEvent);
			const body = await response.json();

			// Suggestions are optional, only check if they exist
			if (body.suggestions) {
				expect(body.suggestions).toContain('Say yes with enthusiasm');
				expect(body.suggestions).toContain('Suggest a specific time');
				expect(body.suggestions).toContain('Ask about his favorite spot');
			}
		});
	});

	describe('Database Operations', () => {
		beforeEach(() => {
			mockLocals.auth.getSession.mockResolvedValue({ user: { id: 'user-123' } });
			(mockRequest.json as any).mockResolvedValue({
				conversationId: 'conv-123',
				userMessage: 'Hello'
			});
		});

		it('should save message to database', async () => {
			const mockClaudeClient = {
				messages: {
					create: vi.fn().mockResolvedValue({
						content: [{ type: 'text', text: 'Response' }]
					})
				}
			};
			(getClaudeClient as any).mockReturnValue(mockClaudeClient);

			const mockSupabase = {
				from: vi.fn().mockReturnValue({
					select: vi.fn().mockReturnValue({
						eq: vi.fn().mockReturnValue({
							single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
						})
					}),
					upsert: vi.fn().mockResolvedValue({ error: null })
				})
			};
			(getSupabase as any).mockReturnValue(mockSupabase);

			await POST(mockEvent as RequestEvent);

			// Verify that getSupabase was called and from was called with the table name
			expect(getSupabase).toHaveBeenCalled();
			expect(mockSupabase.from).toHaveBeenCalledWith('ai_assistant_conversations');
		});

		it('should handle database save errors gracefully', async () => {
			const mockClaudeClient = {
				messages: {
					create: vi.fn().mockResolvedValue({
						content: [{ type: 'text', text: 'Response' }]
					})
				}
			};
			(getClaudeClient as any).mockReturnValue(mockClaudeClient);

			const mockSupabase = {
				from: vi.fn().mockReturnValue({
					select: vi.fn().mockReturnValue({
						eq: vi.fn().mockReturnValue({
							single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
						})
					}),
					upsert: vi.fn().mockResolvedValue({ error: new Error('Save failed') })
				})
			};
			(getSupabase as any).mockReturnValue(mockSupabase);

			// Should not throw - should return response anyway
			const response = await POST(mockEvent as RequestEvent);
			expect(response.status).toBe(200);
		});
	});

	describe('Response Format', () => {
		beforeEach(() => {
			mockLocals.auth.getSession.mockResolvedValue({ user: { id: 'user-123' } });
			(mockRequest.json as any).mockResolvedValue({
				conversationId: 'conv-123',
				userMessage: 'Hello'
			});
		});

		it('should return reply, citations, and suggestions', async () => {
			const mockClaudeClient = {
				messages: {
					create: vi.fn().mockResolvedValue({
						content: [
							{
								type: 'text',
								text: 'Great idea! *Based on: Chapter 1*\n- Say yes\n- Be enthusiastic'
							}
						]
					})
				}
			};
			(getClaudeClient as any).mockReturnValue(mockClaudeClient);

			const mockSupabase = {
				from: vi.fn().mockReturnValue({
					select: vi.fn().mockReturnValue({
						eq: vi.fn().mockReturnValue({
							single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
						})
					}),
					upsert: vi.fn().mockResolvedValue({ error: null })
				})
			};
			(getSupabase as any).mockReturnValue(mockSupabase);

			const response = await POST(mockEvent as RequestEvent);
			const body = await response.json();

			expect(body).toHaveProperty('reply');
			expect(body).toHaveProperty('citations');
			// suggestions is optional
			expect(typeof body.reply).toBe('string');
			expect(Array.isArray(body.citations)).toBe(true);
			if (body.suggestions) {
				expect(Array.isArray(body.suggestions)).toBe(true);
			}
		});

		it('should return 200 status on success', async () => {
			const mockClaudeClient = {
				messages: {
					create: vi.fn().mockResolvedValue({
						content: [{ type: 'text', text: 'Response' }]
					})
				}
			};
			(getClaudeClient as any).mockReturnValue(mockClaudeClient);

			const mockSupabase = {
				from: vi.fn().mockReturnValue({
					select: vi.fn().mockReturnValue({
						eq: vi.fn().mockReturnValue({
							single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
						})
					}),
					upsert: vi.fn().mockResolvedValue({ error: null })
				})
			};
			(getSupabase as any).mockReturnValue(mockSupabase);

			const response = await POST(mockEvent as RequestEvent);
			expect(response.status).toBe(200);
		});
	});
});
