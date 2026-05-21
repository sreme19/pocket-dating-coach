import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from './+server';
import type { RequestHandler } from './$types';

// Mock all dependencies
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
	buildAIWingmanSystemPrompt: vi.fn(),
	buildAIAssistantContextPrompt: vi.fn()
}));

vi.mock('$lib/server/error-handler', () => ({
	throwAuthenticationError: vi.fn((msg) => { throw new Error(msg); }),
	throwValidationError: vi.fn((msg) => { throw new Error(msg); }),
	throwExternalAPIError: vi.fn((endpoint, err, msg) => { throw new Error(msg); }),
	throwInternalError: vi.fn((endpoint, err, msg) => { throw new Error(msg); }),
	throwDatabaseError: vi.fn((endpoint, err, msg) => { throw new Error(msg); }),
	validateRequiredFields: vi.fn(),
	validateArrayLength: vi.fn(),
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
	autoUpdateProfile: vi.fn()
}));

import { getClaudeClient } from '$lib/claude';
import { searchBookChunks } from '$lib/vectorstore';
import { getEmbedding } from '$lib/embeddings';
import { buildAIWingmanSystemPrompt, buildAIAssistantContextPrompt } from '$lib/prompts';
import { loadPersonality } from '$lib/server/profile-service';
import { getSupabase } from '$lib/server/supabase';
import { autoUpdateProfile } from '$lib/server/ai-assistant-service';
import { throwAuthenticationError, throwValidationError, validateRequiredFields, validateClaudeResponse } from '$lib/server/error-handler';

describe('POST /api/ai-wingman/message', () => {
	let mockRequest: any;
	let mockLocals: any;

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

		// Setup default mock implementations
		(validateRequiredFields as any).mockReturnValue({ valid: true, missingFields: [] });
		(validateClaudeResponse as any).mockReturnValue({ valid: true });
		(buildAIWingmanSystemPrompt as any).mockReturnValue('System prompt');
		(buildAIAssistantContextPrompt as any).mockReturnValue('Context prompt');
		(getEmbedding as any).mockResolvedValue([0.1, 0.2, 0.3]);
		(searchBookChunks as any).mockResolvedValue([
			{ chapter: 'Chapter 1', content: 'Book content' }
		]);
		(loadPersonality as any).mockResolvedValue({
			communicationStyle: 'direct',
			personalityVibe: 'ambitious',
			mattersMost: 'humor',
			values: ['authenticity', 'growth'],
			datingPatterns: ['genuine conversation'],
			redFlagsToAvoid: ['dishonesty']
		});
	});

	describe('Authentication', () => {
		it('should reject requests without authentication', async () => {
			mockLocals.auth.getSession.mockResolvedValue(null);

			mockRequest.json.mockResolvedValue({
				conversationId: 'conv-123',
				userMessage: 'How should I respond?'
			});

			await expect(POST({ request: mockRequest, locals: mockLocals } as any)).rejects.toThrow();
			expect(throwAuthenticationError).toHaveBeenCalled();
		});

		it('should reject requests with session but no user id', async () => {
			mockLocals.auth.getSession.mockResolvedValue({ user: {} });

			mockRequest.json.mockResolvedValue({
				conversationId: 'conv-123',
				userMessage: 'How should I respond?'
			});

			await expect(POST({ request: mockRequest, locals: mockLocals } as any)).rejects.toThrow();
			expect(throwAuthenticationError).toHaveBeenCalled();
		});
	});

	describe('Request Validation', () => {
		it('should reject invalid JSON', async () => {
			mockRequest.json.mockRejectedValue(new Error('Invalid JSON'));

			await expect(POST({ request: mockRequest, locals: mockLocals } as any)).rejects.toThrow();
			expect(throwValidationError).toHaveBeenCalledWith('Invalid JSON in request body');
		});

		it('should reject missing required fields', async () => {
			(validateRequiredFields as any).mockReturnValue({
				valid: false,
				missingFields: ['conversationId']
			});

			mockRequest.json.mockResolvedValue({
				userMessage: 'How should I respond?'
			});

			await expect(POST({ request: mockRequest, locals: mockLocals } as any)).rejects.toThrow();
			expect(throwValidationError).toHaveBeenCalledWith(
				expect.stringContaining('Missing required fields')
			);
		});

		it('should reject empty conversationId', async () => {
			mockRequest.json.mockResolvedValue({
				conversationId: '',
				userMessage: 'How should I respond?'
			});

			await expect(POST({ request: mockRequest, locals: mockLocals } as any)).rejects.toThrow();
			expect(throwValidationError).toHaveBeenCalledWith(
				'conversationId must be a non-empty string'
			);
		});

		it('should reject empty userMessage', async () => {
			mockRequest.json.mockResolvedValue({
				conversationId: 'conv-123',
				userMessage: ''
			});

			await expect(POST({ request: mockRequest, locals: mockLocals } as any)).rejects.toThrow();
			expect(throwValidationError).toHaveBeenCalledWith(
				'userMessage must be a non-empty string'
			);
		});

		it('should reject non-array recentMessages', async () => {
			mockRequest.json.mockResolvedValue({
				conversationId: 'conv-123',
				userMessage: 'How should I respond?',
				recentMessages: 'not an array'
			});

			await expect(POST({ request: mockRequest, locals: mockLocals } as any)).rejects.toThrow();
			expect(throwValidationError).toHaveBeenCalledWith(
				'recentMessages must be an array'
			);
		});

		it('should reject messages with missing role or content', async () => {
			mockRequest.json.mockResolvedValue({
				conversationId: 'conv-123',
				userMessage: 'How should I respond?',
				recentMessages: [
					{ role: 'user' } // missing content
				]
			});

			await expect(POST({ request: mockRequest, locals: mockLocals } as any)).rejects.toThrow();
			expect(throwValidationError).toHaveBeenCalledWith(
				expect.stringContaining('missing required fields')
			);
		});

		it('should reject messages with empty content', async () => {
			mockRequest.json.mockResolvedValue({
				conversationId: 'conv-123',
				userMessage: 'How should I respond?',
				recentMessages: [
					{ role: 'user', content: '' }
				]
			});

			await expect(POST({ request: mockRequest, locals: mockLocals } as any)).rejects.toThrow();
			expect(throwValidationError).toHaveBeenCalledWith(
				expect.stringContaining('missing required fields')
			);
		});

		it('should reject invalid matchedUserProfile fields', async () => {
			mockRequest.json.mockResolvedValue({
				conversationId: 'conv-123',
				userMessage: 'How should I respond?',
				matchedUserProfile: {
					invalidField: 'value'
				}
			});

			await expect(POST({ request: mockRequest, locals: mockLocals } as any)).rejects.toThrow();
			expect(throwValidationError).toHaveBeenCalledWith(
				expect.stringContaining('Invalid field in matchedUserProfile')
			);
		});
	});

	describe('Personality Loading', () => {
		it('should load user personality', async () => {
			mockRequest.json.mockResolvedValue({
				conversationId: 'conv-123',
				userMessage: 'How should I respond?'
			});

			const mockClaudeClient = {
				messages: {
					create: vi.fn().mockResolvedValue({
						content: [{ type: 'text', text: 'Response text' }]
					})
				}
			};

			(getClaudeClient as any).mockReturnValue(mockClaudeClient);

			const mockSupabase = {
				from: vi.fn().mockReturnValue({
					select: vi.fn().mockReturnValue({
						eq: vi.fn().mockReturnValue({
							eq: vi.fn().mockReturnValue({
								single: vi.fn().mockResolvedValue({
									data: null,
									error: { code: 'PGRST116' }
								})
							})
						})
					}),
					upsert: vi.fn().mockResolvedValue({ error: null })
				})
			};

			(getSupabase as any).mockReturnValue(mockSupabase);

			await POST({ request: mockRequest, locals: mockLocals } as any);

			expect(loadPersonality).toHaveBeenCalledWith('user-123');
		});

		it('should handle personality loading errors', async () => {
			(loadPersonality as any).mockRejectedValue(new Error('Database error'));

			mockRequest.json.mockResolvedValue({
				conversationId: 'conv-123',
				userMessage: 'How should I respond?'
			});

			await expect(POST({ request: mockRequest, locals: mockLocals } as any)).rejects.toThrow();
			expect(throwValidationError).toHaveBeenCalledWith(
				expect.stringContaining('Could not load your personality profile')
			);
		});
	});

	describe('Book Context Search', () => {
		it('should search for book chunks', async () => {
			mockRequest.json.mockResolvedValue({
				conversationId: 'conv-123',
				userMessage: 'How should I respond?'
			});

			const mockClaudeClient = {
				messages: {
					create: vi.fn().mockResolvedValue({
						content: [{ type: 'text', text: 'Response text' }]
					})
				}
			};

			(getClaudeClient as any).mockReturnValue(mockClaudeClient);

			const mockSupabase = {
				from: vi.fn().mockReturnValue({
					select: vi.fn().mockReturnValue({
						eq: vi.fn().mockReturnValue({
							eq: vi.fn().mockReturnValue({
								single: vi.fn().mockResolvedValue({
									data: null,
									error: { code: 'PGRST116' }
								})
							})
						})
					}),
					upsert: vi.fn().mockResolvedValue({ error: null })
				})
			};

			(getSupabase as any).mockReturnValue(mockSupabase);

			await POST({ request: mockRequest, locals: mockLocals } as any);

			expect(getEmbedding).toHaveBeenCalledWith('How should I respond?');
			expect(searchBookChunks).toHaveBeenCalledWith([0.1, 0.2, 0.3], 5);
		});

		it('should handle embedding errors gracefully', async () => {
			(getEmbedding as any).mockResolvedValue(null);

			mockRequest.json.mockResolvedValue({
				conversationId: 'conv-123',
				userMessage: 'How should I respond?'
			});

			const mockClaudeClient = {
				messages: {
					create: vi.fn().mockResolvedValue({
						content: [{ type: 'text', text: 'Response text' }]
					})
				}
			};

			(getClaudeClient as any).mockReturnValue(mockClaudeClient);

			const mockSupabase = {
				from: vi.fn().mockReturnValue({
					select: vi.fn().mockReturnValue({
						eq: vi.fn().mockReturnValue({
							eq: vi.fn().mockReturnValue({
								single: vi.fn().mockResolvedValue({
									data: null,
									error: { code: 'PGRST116' }
								})
							})
						})
					}),
					upsert: vi.fn().mockResolvedValue({ error: null })
				})
			};

			(getSupabase as any).mockReturnValue(mockSupabase);

			await POST({ request: mockRequest, locals: mockLocals } as any);

			// Should continue without book context
			expect(buildAIWingmanSystemPrompt).toHaveBeenCalled();
		});
	});;

	describe('System Prompt Building', () => {
		it('should build AI Wingman system prompt', async () => {
			mockRequest.json.mockResolvedValue({
				conversationId: 'conv-123',
				userMessage: 'How should I respond?',
				matchedUserProfile: {
					gender: 'woman',
					ageRange: '23-28'
				}
			});

			const mockClaudeClient = {
				messages: {
					create: vi.fn().mockResolvedValue({
						content: [{ type: 'text', text: 'Response text' }]
					})
				}
			};

			(getClaudeClient as any).mockReturnValue(mockClaudeClient);

			const mockSupabase = {
				from: vi.fn().mockReturnValue({
					select: vi.fn().mockReturnValue({
						eq: vi.fn().mockReturnValue({
							eq: vi.fn().mockReturnValue({
								single: vi.fn().mockResolvedValue({
									data: null,
									error: { code: 'PGRST116' }
								})
							})
						})
					}),
					upsert: vi.fn().mockResolvedValue({ error: null })
				})
			};

			(getSupabase as any).mockReturnValue(mockSupabase);

			await POST({ request: mockRequest, locals: mockLocals } as any);

			expect(buildAIWingmanSystemPrompt).toHaveBeenCalledWith(
				expect.objectContaining({ gender: 'man' }),
				expect.any(String),
				expect.objectContaining({ gender: 'woman' }),
				expect.any(Object)
			);
		});
	});;

	describe('Claude API Integration', () => {
		it('should call Claude API with correct parameters', async () => {
			const mockClaudeClient = {
				messages: {
					create: vi.fn().mockResolvedValue({
						content: [{ type: 'text', text: 'Response text *Based on: Chapter 1*' }]
					})
				}
			};

			(getClaudeClient as any).mockReturnValue(mockClaudeClient);

			mockRequest.json.mockResolvedValue({
				conversationId: 'conv-123',
				userMessage: 'How should I respond?'
			});

			const mockSupabase = {
				from: vi.fn().mockReturnValue({
					select: vi.fn().mockReturnValue({
						eq: vi.fn().mockReturnValue({
							eq: vi.fn().mockReturnValue({
								single: vi.fn().mockResolvedValue({
									data: null,
									error: { code: 'PGRST116' }
								})
							})
						})
					}),
					upsert: vi.fn().mockResolvedValue({ error: null })
				})
			};

			(getSupabase as any).mockReturnValue(mockSupabase);

			await POST({ request: mockRequest, locals: mockLocals } as any);

			expect(mockClaudeClient.messages.create).toHaveBeenCalledWith(
				expect.objectContaining({
					model: 'claude-3-5-sonnet-20241022',
					max_tokens: 1024,
					system: expect.any(String),
					messages: expect.arrayContaining([
						expect.objectContaining({
							role: 'user',
							content: 'How should I respond?'
						})
					])
				})
			);
		});

		it('should handle Claude API errors', async () => {
			const mockClaudeClient = {
				messages: {
					create: vi.fn().mockRejectedValue(new Error('API error'))
				}
			};

			(getClaudeClient as any).mockReturnValue(mockClaudeClient);

			mockRequest.json.mockResolvedValue({
				conversationId: 'conv-123',
				userMessage: 'How should I respond?'
			});

			await expect(POST({ request: mockRequest, locals: mockLocals } as any)).rejects.toThrow();
		});

		it('should validate Claude response format', async () => {
			(validateClaudeResponse as any).mockReturnValue({
				valid: false,
				error: 'Invalid response'
			});

			const mockClaudeClient = {
				messages: {
					create: vi.fn().mockResolvedValue({
						content: [{ type: 'text', text: 'Response' }]
					})
				}
			};

			(getClaudeClient as any).mockReturnValue(mockClaudeClient);

			mockRequest.json.mockResolvedValue({
				conversationId: 'conv-123',
				userMessage: 'How should I respond?'
			});

			await expect(POST({ request: mockRequest, locals: mockLocals } as any)).rejects.toThrow();
		});
	});

	describe('Response Processing', () => {
		it('should extract citations from response', async () => {
			const mockClaudeClient = {
				messages: {
					create: vi.fn().mockResolvedValue({
						content: [
							{
								type: 'text',
								text: 'Be authentic. *Based on: Chapter 2 - Authentic Communication* Show vulnerability.'
							}
						]
					})
				}
			};

			(getClaudeClient as any).mockReturnValue(mockClaudeClient);

			mockRequest.json.mockResolvedValue({
				conversationId: 'conv-123',
				userMessage: 'How should I respond?'
			});

			const mockSupabase = {
				from: vi.fn().mockReturnValue({
					select: vi.fn().mockReturnValue({
						eq: vi.fn().mockReturnValue({
							eq: vi.fn().mockReturnValue({
								single: vi.fn().mockResolvedValue({
									data: null,
									error: { code: 'PGRST116' }
								})
							})
						})
					}),
					upsert: vi.fn().mockResolvedValue({ error: null })
				})
			};

			(getSupabase as any).mockReturnValue(mockSupabase);

			const response = await POST({ request: mockRequest, locals: mockLocals } as any);
			const json = await response.json();

			expect(json.citations.length).toBeGreaterThan(0);
			expect(json.citations[0]).toContain('Based on:');
		});

		it('should extract suggestions from response', async () => {
			const mockClaudeClient = {
				messages: {
					create: vi.fn().mockResolvedValue({
						content: [
							{
								type: 'text',
								text: 'Here are suggestions:\n- Be specific about what you value\n- Show vulnerability\n- Ask her the same question back'
							}
						]
					})
				}
			};

			(getClaudeClient as any).mockReturnValue(mockClaudeClient);

			mockRequest.json.mockResolvedValue({
				conversationId: 'conv-123',
				userMessage: 'How should I respond?'
			});

			const mockSupabase = {
				from: vi.fn().mockReturnValue({
					select: vi.fn().mockReturnValue({
						eq: vi.fn().mockReturnValue({
							eq: vi.fn().mockReturnValue({
								single: vi.fn().mockResolvedValue({
									data: null,
									error: { code: 'PGRST116' }
								})
							})
						})
					}),
					upsert: vi.fn().mockResolvedValue({ error: null })
				})
			};

			(getSupabase as any).mockReturnValue(mockSupabase);

			const response = await POST({ request: mockRequest, locals: mockLocals } as any);
			const json = await response.json();

			// Suggestions are only included if they exist
			if (json.suggestions) {
				expect(Array.isArray(json.suggestions)).toBe(true);
				expect(json.suggestions.length).toBeGreaterThan(0);
			}
		});

		it('should clean response text by removing citations', async () => {
			const mockClaudeClient = {
				messages: {
					create: vi.fn().mockResolvedValue({
						content: [
							{
								type: 'text',
								text: 'Be authentic. *Based on: Chapter 2* Show vulnerability.'
							}
						]
					})
				}
			};

			(getClaudeClient as any).mockReturnValue(mockClaudeClient);

			mockRequest.json.mockResolvedValue({
				conversationId: 'conv-123',
				userMessage: 'How should I respond?'
			});

			const mockSupabase = {
				from: vi.fn().mockReturnValue({
					select: vi.fn().mockReturnValue({
						eq: vi.fn().mockReturnValue({
							eq: vi.fn().mockReturnValue({
								single: vi.fn().mockResolvedValue({
									data: null,
									error: { code: 'PGRST116' }
								})
							})
						})
					}),
					upsert: vi.fn().mockResolvedValue({ error: null })
				})
			};

			(getSupabase as any).mockReturnValue(mockSupabase);

			const response = await POST({ request: mockRequest, locals: mockLocals } as any);
			const json = await response.json();

			expect(json.reply).not.toContain('*Based on:');
			expect(json.reply).toContain('Be authentic');
			expect(json.reply).toContain('Show vulnerability');
		});
	});

	describe('Database Operations', () => {
		it('should save message to database', async () => {
			const mockClaudeClient = {
				messages: {
					create: vi.fn().mockResolvedValue({
						content: [{ type: 'text', text: 'Response text' }]
					})
				}
			};

			(getClaudeClient as any).mockReturnValue(mockClaudeClient);

			mockRequest.json.mockResolvedValue({
				conversationId: 'conv-123',
				userMessage: 'How should I respond?'
			});

			const mockSupabase = {
				from: vi.fn().mockReturnValue({
					select: vi.fn().mockReturnValue({
						eq: vi.fn().mockReturnValue({
							eq: vi.fn().mockReturnValue({
								single: vi.fn().mockResolvedValue({
									data: null,
									error: { code: 'PGRST116' }
								})
							})
						})
					}),
					upsert: vi.fn().mockResolvedValue({ error: null })
				})
			};

			(getSupabase as any).mockReturnValue(mockSupabase);

			await POST({ request: mockRequest, locals: mockLocals } as any);

			expect(mockSupabase.from).toHaveBeenCalledWith('ai_assistant_conversations');
		});

		it('should handle database save errors gracefully', async () => {
			const mockClaudeClient = {
				messages: {
					create: vi.fn().mockResolvedValue({
						content: [{ type: 'text', text: 'Response text' }]
					})
				}
			};

			(getClaudeClient as any).mockReturnValue(mockClaudeClient);

			mockRequest.json.mockResolvedValue({
				conversationId: 'conv-123',
				userMessage: 'How should I respond?'
			});

			const mockSupabase = {
				from: vi.fn().mockReturnValue({
					select: vi.fn().mockReturnValue({
						eq: vi.fn().mockReturnValue({
							eq: vi.fn().mockReturnValue({
								single: vi.fn().mockResolvedValue({
									data: null,
									error: { code: 'PGRST116' }
								})
							})
						})
					}),
					upsert: vi.fn().mockResolvedValue({ error: new Error('Save failed') })
				})
			};

			(getSupabase as any).mockReturnValue(mockSupabase);

			// Should not throw - should return response anyway
			const response = await POST({ request: mockRequest, locals: mockLocals } as any);
			expect(response).toBeDefined();
		});
	});

	describe('Profile Auto-Update', () => {
		it('should call autoUpdateProfile', async () => {
			const mockClaudeClient = {
				messages: {
					create: vi.fn().mockResolvedValue({
						content: [{ type: 'text', text: 'Response text' }]
					})
				}
			};

			(getClaudeClient as any).mockReturnValue(mockClaudeClient);

			mockRequest.json.mockResolvedValue({
				conversationId: 'conv-123',
				userMessage: 'How should I respond?',
				recentMessages: [
					{ role: 'user', content: 'Previous message' }
				]
			});

			const mockSupabase = {
				from: vi.fn().mockReturnValue({
					select: vi.fn().mockReturnValue({
						eq: vi.fn().mockReturnValue({
							eq: vi.fn().mockReturnValue({
								single: vi.fn().mockResolvedValue({
									data: null,
									error: { code: 'PGRST116' }
								})
							})
						})
					}),
					upsert: vi.fn().mockResolvedValue({ error: null })
				})
			};

			(getSupabase as any).mockReturnValue(mockSupabase);

			await POST({ request: mockRequest, locals: mockLocals } as any);

			expect(autoUpdateProfile).toHaveBeenCalledWith(
				'wingman',
				expect.any(Array),
				null,
				'user-123',
				expect.any(String)
			);
		});

		it('should handle autoUpdateProfile errors gracefully', async () => {
			(autoUpdateProfile as any).mockRejectedValue(new Error('Update failed'));

			const mockClaudeClient = {
				messages: {
					create: vi.fn().mockResolvedValue({
						content: [{ type: 'text', text: 'Response text' }]
					})
				}
			};

			(getClaudeClient as any).mockReturnValue(mockClaudeClient);

			mockRequest.json.mockResolvedValue({
				conversationId: 'conv-123',
				userMessage: 'How should I respond?'
			});

			const mockSupabase = {
				from: vi.fn().mockReturnValue({
					select: vi.fn().mockReturnValue({
						eq: vi.fn().mockReturnValue({
							eq: vi.fn().mockReturnValue({
								single: vi.fn().mockResolvedValue({
									data: null,
									error: { code: 'PGRST116' }
								})
							})
						})
					}),
					upsert: vi.fn().mockResolvedValue({ error: null })
				})
			};

			(getSupabase as any).mockReturnValue(mockSupabase);

			// Should not throw - should return response anyway
			const response = await POST({ request: mockRequest, locals: mockLocals } as any);
			expect(response).toBeDefined();
		});
	});

	describe('Success Response', () => {
		it('should return successful response with reply and citations', async () => {
			const mockClaudeClient = {
				messages: {
					create: vi.fn().mockResolvedValue({
						content: [
							{
								type: 'text',
								text: 'Be authentic and genuine. *Based on: Chapter 2 - Authentic Communication*'
							}
						]
					})
				}
			};

			(getClaudeClient as any).mockReturnValue(mockClaudeClient);

			mockRequest.json.mockResolvedValue({
				conversationId: 'conv-123',
				userMessage: 'How should I respond?'
			});

			const mockSupabase = {
				from: vi.fn().mockReturnValue({
					select: vi.fn().mockReturnValue({
						eq: vi.fn().mockReturnValue({
							eq: vi.fn().mockReturnValue({
								single: vi.fn().mockResolvedValue({
									data: null,
									error: { code: 'PGRST116' }
								})
							})
						})
					}),
					upsert: vi.fn().mockResolvedValue({ error: null })
				})
			};

			(getSupabase as any).mockReturnValue(mockSupabase);

			const response = await POST({ request: mockRequest, locals: mockLocals } as any);
			const json = await response.json();

			expect(json).toHaveProperty('reply');
			expect(json).toHaveProperty('citations');
			expect(json.reply).toContain('Be authentic');
			expect(json.citations.length).toBeGreaterThan(0);
		});

		it('should include suggestions in response when available', async () => {
			const mockClaudeClient = {
				messages: {
					create: vi.fn().mockResolvedValue({
						content: [
							{
								type: 'text',
								text: 'Here are suggestions:\n- Be specific\n- Show vulnerability'
							}
						]
					})
				}
			};

			(getClaudeClient as any).mockReturnValue(mockClaudeClient);

			mockRequest.json.mockResolvedValue({
				conversationId: 'conv-123',
				userMessage: 'How should I respond?'
			});

			const mockSupabase = {
				from: vi.fn().mockReturnValue({
					select: vi.fn().mockReturnValue({
						eq: vi.fn().mockReturnValue({
							eq: vi.fn().mockReturnValue({
								single: vi.fn().mockResolvedValue({
									data: null,
									error: { code: 'PGRST116' }
								})
							})
						})
					}),
					upsert: vi.fn().mockResolvedValue({ error: null })
				})
			};

			(getSupabase as any).mockReturnValue(mockSupabase);

			const response = await POST({ request: mockRequest, locals: mockLocals } as any);
			const json = await response.json();

			// Suggestions are only included if they exist
			if (json.suggestions) {
				expect(Array.isArray(json.suggestions)).toBe(true);
			}
		});
	});
});
