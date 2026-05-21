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
	buildChatSystemPrompt: vi.fn(),
	buildAIBestieSystemPrompt: vi.fn(),
	buildAIWingmanSystemPrompt: vi.fn(),
	buildAIAssistantContextPrompt: vi.fn()
}));

vi.mock('$lib/server/message-router', () => ({
	routeMessage: vi.fn()
}));

vi.mock('$lib/server/ai-assistant-service', () => ({
	generateResponse: vi.fn()
}));

vi.mock('$lib/server/profile-service', () => ({
	loadPreferences: vi.fn(),
	loadPersonality: vi.fn()
}));

import { getClaudeClient } from '$lib/claude';
import { searchBookChunks } from '$lib/vectorstore';
import { getEmbedding } from '$lib/embeddings';
import { buildChatSystemPrompt } from '$lib/prompts';
import { routeMessage } from '$lib/server/message-router';
import { generateResponse } from '$lib/server/ai-assistant-service';
import { loadPreferences, loadPersonality } from '$lib/server/profile-service';

describe('POST /api/chat', () => {
	let mockRequest: Partial<Request>;
	let mockEvent: Partial<RequestEvent>;

	beforeEach(() => {
		vi.clearAllMocks();

		// Setup mock request
		mockRequest = {
			json: vi.fn()
		};

		// Setup mock event
		mockEvent = {
			request: mockRequest as Request
		} as Partial<RequestEvent>;

		// Setup default mocks
		(buildChatSystemPrompt as any).mockReturnValue('System prompt');
		(getEmbedding as any).mockResolvedValue([0.1, 0.2, 0.3]);
		(searchBookChunks as any).mockResolvedValue([
			{ chapter: 'Chapter 1', content: 'Book content' }
		]);
	});

	describe('Request Validation', () => {
		it('should reject invalid JSON', async () => {
			(mockRequest.json as any).mockRejectedValue(new Error('Invalid JSON'));

			try {
				await POST(mockEvent as RequestEvent);
				expect.fail('Should have thrown error');
			} catch (err: any) {
				expect(err.status).toBe(400);
				expect(err.body.message).toContain('Invalid JSON');
			}
		});

		it('should reject missing messages', async () => {
			(mockRequest.json as any).mockResolvedValue({
				userProfile: null
			});

			try {
				await POST(mockEvent as RequestEvent);
				expect.fail('Should have thrown error');
			} catch (err: any) {
				expect(err.status).toBe(400);
				expect(err.body.message).toContain('messages required');
			}
		});

		it('should reject empty messages array', async () => {
			(mockRequest.json as any).mockResolvedValue({
				messages: [],
				userProfile: null
			});

			try {
				await POST(mockEvent as RequestEvent);
				expect.fail('Should have thrown error');
			} catch (err: any) {
				expect(err.status).toBe(400);
				expect(err.body.message).toContain('messages required');
			}
		});

		it('should reject non-array messages', async () => {
			(mockRequest.json as any).mockResolvedValue({
				messages: 'not an array',
				userProfile: null
			});

			try {
				await POST(mockEvent as RequestEvent);
				expect.fail('Should have thrown error');
			} catch (err: any) {
				expect(err.status).toBe(400);
				expect(err.body.message).toContain('messages required');
			}
		});

		it('should reject messages with no user message', async () => {
			(mockRequest.json as any).mockResolvedValue({
				messages: [
					{ id: '1', role: 'assistant', content: 'Hello', timestamp: Date.now() }
				],
				userProfile: null
			});

			try {
				await POST(mockEvent as RequestEvent);
				expect.fail('Should have thrown error');
			} catch (err: any) {
				expect(err.status).toBe(400);
				expect(err.body.message).toContain('No user message found');
			}
		});

		it('should accept valid request with messages', async () => {
			const messages: ChatMessage[] = [
				{ id: '1', role: 'user', content: 'Hello', timestamp: Date.now() }
			];

			(mockRequest.json as any).mockResolvedValue({
				messages,
				userProfile: null
			});

			const mockClaudeClient = {
				messages: {
					create: vi.fn().mockResolvedValue({
						content: [{ type: 'text', text: 'Response' }]
					})
				}
			};
			(getClaudeClient as any).mockReturnValue(mockClaudeClient);

			const response = await POST(mockEvent as RequestEvent);
			expect(response.status).toBe(200);
		});
	});

	describe('Regular Chat Mode (No AI Assistant)', () => {
		beforeEach(() => {
			(routeMessage as any).mockResolvedValue({
				type: 'regular-chat',
				isActive: false
			});
		});

		it('should use regular chat system prompt when no AI assistant active', async () => {
			const messages: ChatMessage[] = [
				{ id: '1', role: 'user', content: 'Hello', timestamp: Date.now() }
			];

			(mockRequest.json as any).mockResolvedValue({
				messages,
				userProfile: { gender: 'woman', ageRange: '25-30', datingApp: 'hinge', relationshipGoal: 'serious' }
			});

			const mockClaudeClient = {
				messages: {
					create: vi.fn().mockResolvedValue({
						content: [{ type: 'text', text: 'Response' }]
					})
				}
			};
			(getClaudeClient as any).mockReturnValue(mockClaudeClient);

			await POST(mockEvent as RequestEvent);

			expect(buildChatSystemPrompt).toHaveBeenCalled();
			expect(mockClaudeClient.messages.create).toHaveBeenCalled();
		});

		it('should extract citations from regular chat response', async () => {
			const messages: ChatMessage[] = [
				{ id: '1', role: 'user', content: 'Hello', timestamp: Date.now() }
			];

			(mockRequest.json as any).mockResolvedValue({
				messages,
				userProfile: null
			});

			const mockClaudeClient = {
				messages: {
					create: vi.fn().mockResolvedValue({
						content: [
							{
								type: 'text',
								text: 'Great advice! *Based on:Chapter 1* Here is more info.'
							}
						]
					})
				}
			};
			(getClaudeClient as any).mockReturnValue(mockClaudeClient);

			const response = await POST(mockEvent as RequestEvent);
			const body = await response.json();

			expect(body.citations).toContain('Based on:Chapter 1');
			expect(body.reply).not.toContain('*Based on:');
		});

		it('should return 200 status on success', async () => {
			const messages: ChatMessage[] = [
				{ id: '1', role: 'user', content: 'Hello', timestamp: Date.now() }
			];

			(mockRequest.json as any).mockResolvedValue({
				messages,
				userProfile: null
			});

			const mockClaudeClient = {
				messages: {
					create: vi.fn().mockResolvedValue({
						content: [{ type: 'text', text: 'Response' }]
					})
				}
			};
			(getClaudeClient as any).mockReturnValue(mockClaudeClient);

			const response = await POST(mockEvent as RequestEvent);
			expect(response.status).toBe(200);
		});
	});

	describe('AI Assistant Integration', () => {
		it('should route message through message router when matchId provided', async () => {
			const messages: ChatMessage[] = [
				{ id: '1', role: 'user', content: 'Hello', timestamp: Date.now() }
			];

			(mockRequest.json as any).mockResolvedValue({
				messages,
				userProfile: { gender: 'woman', ageRange: '25-30', datingApp: 'hinge', relationshipGoal: 'serious' },
				matchId: 'match-123'
			});

			(routeMessage as any).mockResolvedValue({
				type: 'regular-chat',
				isActive: false
			});

			const mockClaudeClient = {
				messages: {
					create: vi.fn().mockResolvedValue({
						content: [{ type: 'text', text: 'Response' }]
					})
				}
			};
			(getClaudeClient as any).mockReturnValue(mockClaudeClient);

			await POST(mockEvent as RequestEvent);

			expect(routeMessage).toHaveBeenCalled();
		});

		it('should handle AI Bestie active response', async () => {
			const messages: ChatMessage[] = [
				{ id: '1', role: 'user', content: 'Should I say yes?', timestamp: Date.now() }
			];

			(mockRequest.json as any).mockResolvedValue({
				messages,
				userProfile: { gender: 'woman', ageRange: '25-30', datingApp: 'hinge', relationshipGoal: 'serious' },
				matchId: 'match-123'
			});

			(routeMessage as any).mockResolvedValue({
				type: 'ai-bestie',
				assistantType: 'bestie',
				isActive: true,
				canContinue: true
			});

			(loadPreferences as any).mockResolvedValue({
				emotionalSignals: ['Asks about my day'],
				lifestyleSignals: ['Active'],
				maturitySignals: [],
				boundaries: [],
				dealbreakers: [],
				privateCompatibilityNotes: [],
				updatedAt: Date.now()
			});

			(generateResponse as any).mockResolvedValue({
				reply: 'Yes, say yes!',
				citations: ['Based on: Chapter 1']
			});

			const response = await POST(mockEvent as RequestEvent);
			const body = await response.json();

			expect(body.assistantType).toBe('bestie');
			expect(body.reply).toBe('Yes, say yes!');
			expect(body.citations).toContain('Based on: Chapter 1');
		});

		it('should handle AI Wingman active response', async () => {
			const messages: ChatMessage[] = [
				{ id: '1', role: 'user', content: 'What should I say?', timestamp: Date.now() }
			];

			(mockRequest.json as any).mockResolvedValue({
				messages,
				userProfile: { gender: 'man', ageRange: '28-35', datingApp: 'bumble', relationshipGoal: 'serious' },
				matchId: 'match-456'
			});

			(routeMessage as any).mockResolvedValue({
				type: 'ai-wingman',
				assistantType: 'wingman',
				isActive: true,
				canContinue: true
			});

			(loadPersonality as any).mockResolvedValue({
				communicationStyle: 'direct',
				personalityVibe: 'ambitious',
				mattersMost: 'humor',
				values: ['Authenticity'],
				datingPatterns: ['Genuine conversation'],
				redFlagsToAvoid: ['Overly focused on appearance'],
				updatedAt: Date.now()
			});

			(generateResponse as any).mockResolvedValue({
				reply: 'Be authentic and genuine',
				citations: ['Based on: Chapter 2']
			});

			const response = await POST(mockEvent as RequestEvent);
			const body = await response.json();

			expect(body.assistantType).toBe('wingman');
			expect(body.reply).toBe('Be authentic and genuine');
			expect(body.citations).toContain('Based on: Chapter 2');
		});

		it('should handle AI assistant reaching exchange limit', async () => {
			const messages: ChatMessage[] = [
				{ id: '1', role: 'user', content: 'Hello', timestamp: Date.now() }
			];

			(mockRequest.json as any).mockResolvedValue({
				messages,
				userProfile: { gender: 'woman', ageRange: '25-30', datingApp: 'hinge', relationshipGoal: 'serious' },
				matchId: 'match-123'
			});

			(routeMessage as any).mockResolvedValue({
				type: 'ai-bestie',
				assistantType: 'bestie',
				isActive: true,
				canContinue: false,
				warning: 'AI Bestie has reached the exchange limit'
			});

			try {
				await POST(mockEvent as RequestEvent);
				expect.fail('Should have thrown error');
			} catch (err: any) {
				// Should throw an error when exchange limit is reached
				expect(err.status).toBe(429);
			}
		});

		it('should handle AI assistant deactivation', async () => {
			const messages: ChatMessage[] = [
				{ id: '1', role: 'user', content: 'deactivate ai bestie', timestamp: Date.now() }
			];

			(mockRequest.json as any).mockResolvedValue({
				messages,
				userProfile: { gender: 'woman', ageRange: '25-30', datingApp: 'hinge', relationshipGoal: 'serious' },
				matchId: 'match-123'
			});

			(routeMessage as any).mockResolvedValue({
				type: 'regular-chat',
				assistantType: 'bestie',
				shouldDeactivate: true,
				isActive: false
			});

			const response = await POST(mockEvent as RequestEvent);
			const body = await response.json();

			expect(body.reply).toContain('deactivated');
			expect(body.assistantType).toBeUndefined();
		});

		it('should handle AI assistant activation', async () => {
			const messages: ChatMessage[] = [
				{ id: '1', role: 'user', content: 'activate ai bestie', timestamp: Date.now() }
			];

			(mockRequest.json as any).mockResolvedValue({
				messages,
				userProfile: { gender: 'woman', ageRange: '25-30', datingApp: 'hinge', relationshipGoal: 'serious' },
				matchId: 'match-123'
			});

			// When activation command is detected, the router returns shouldActivate=true
			// canContinue should not be false (it can be undefined or true)
			(routeMessage as any).mockResolvedValue({
				type: 'regular-chat', // Not an AI type, so canContinue check is skipped
				shouldActivate: true,
				assistantType: 'bestie',
				isActive: true
			});

			const response = await POST(mockEvent as RequestEvent);
			const body = await response.json();

			expect(body.reply).toContain('activated');
			expect(body.assistantType).toBe('bestie');
		});
	});

	describe('Error Handling', () => {
		it('should handle Claude API errors', async () => {
			const messages: ChatMessage[] = [
				{ id: '1', role: 'user', content: 'Hello', timestamp: Date.now() }
			];

			(mockRequest.json as any).mockResolvedValue({
				messages,
				userProfile: null
			});

			const mockClaudeClient = {
				messages: {
					create: vi.fn().mockRejectedValue(new Error('Claude API Error'))
				}
			};
			(getClaudeClient as any).mockReturnValue(mockClaudeClient);

			try {
				await POST(mockEvent as RequestEvent);
				expect.fail('Should have thrown error');
			} catch (err: any) {
				expect(err.status).toBe(503);
				expect(err.body.message).toContain('couldn\'t generate a response');
			}
		});

		it('should handle database errors', async () => {
			const messages: ChatMessage[] = [
				{ id: '1', role: 'user', content: 'Hello', timestamp: Date.now() }
			];

			(mockRequest.json as any).mockResolvedValue({
				messages,
				userProfile: null
			});

			const mockClaudeClient = {
				messages: {
					create: vi.fn().mockRejectedValue(new Error('database connection failed'))
				}
			};
			(getClaudeClient as any).mockReturnValue(mockClaudeClient);

			try {
				await POST(mockEvent as RequestEvent);
				expect.fail('Should have thrown error');
			} catch (err: any) {
				expect(err.status).toBe(500);
				expect(err.body.message).toContain('wasn\'t saved');
			}
		});

		it('should handle profile loading errors', async () => {
			const messages: ChatMessage[] = [
				{ id: '1', role: 'user', content: 'Hello', timestamp: Date.now() }
			];

			(mockRequest.json as any).mockResolvedValue({
				messages,
				userProfile: null
			});

			const mockClaudeClient = {
				messages: {
					create: vi.fn().mockRejectedValue(new Error('profile not found'))
				}
			};
			(getClaudeClient as any).mockReturnValue(mockClaudeClient);

			try {
				await POST(mockEvent as RequestEvent);
				expect.fail('Should have thrown error');
			} catch (err: any) {
				expect(err.status).toBe(400);
				expect(err.body.message).toContain('profile data');
			}
		});

		it('should handle unexpected errors', async () => {
			const messages: ChatMessage[] = [
				{ id: '1', role: 'user', content: 'Hello', timestamp: Date.now() }
			];

			(mockRequest.json as any).mockResolvedValue({
				messages,
				userProfile: null
			});

			const mockClaudeClient = {
				messages: {
					create: vi.fn().mockRejectedValue(new Error('Unknown error'))
				}
			};
			(getClaudeClient as any).mockReturnValue(mockClaudeClient);

			try {
				await POST(mockEvent as RequestEvent);
				expect.fail('Should have thrown error');
			} catch (err: any) {
				expect(err.status).toBe(500);
				expect(err.body.message).toContain('unexpected error');
			}
		});
	});

	describe('Response Format', () => {
		it('should return reply and citations', async () => {
			const messages: ChatMessage[] = [
				{ id: '1', role: 'user', content: 'Hello', timestamp: Date.now() }
			];

			(mockRequest.json as any).mockResolvedValue({
				messages,
				userProfile: null
			});

			const mockClaudeClient = {
				messages: {
					create: vi.fn().mockResolvedValue({
						content: [
							{
								type: 'text',
								text: 'Great! *Based on: Chapter 1* Here is advice.'
							}
						]
					})
				}
			};
			(getClaudeClient as any).mockReturnValue(mockClaudeClient);

			const response = await POST(mockEvent as RequestEvent);
			const body = await response.json();

			expect(body).toHaveProperty('reply');
			expect(body).toHaveProperty('citations');
			expect(typeof body.reply).toBe('string');
			expect(Array.isArray(body.citations)).toBe(true);
		});

		it('should include assistantType when AI assistant responds', async () => {
			const messages: ChatMessage[] = [
				{ id: '1', role: 'user', content: 'Hello', timestamp: Date.now() }
			];

			(mockRequest.json as any).mockResolvedValue({
				messages,
				userProfile: { gender: 'woman', ageRange: '25-30', datingApp: 'hinge', relationshipGoal: 'serious' },
				matchId: 'match-123'
			});

			(routeMessage as any).mockResolvedValue({
				type: 'ai-bestie',
				assistantType: 'bestie',
				isActive: true,
				canContinue: true
			});

			(loadPreferences as any).mockResolvedValue({
				emotionalSignals: [],
				lifestyleSignals: [],
				maturitySignals: [],
				boundaries: [],
				dealbreakers: [],
				privateCompatibilityNotes: [],
				updatedAt: Date.now()
			});

			(generateResponse as any).mockResolvedValue({
				reply: 'Response',
				citations: []
			});

			const response = await POST(mockEvent as RequestEvent);
			const body = await response.json();

			expect(body).toHaveProperty('assistantType');
			expect(body.assistantType).toBe('bestie');
		});
	});

	describe('ChatMessage Type Integration', () => {
		it('should accept ChatMessage with assistantType field', async () => {
			const messages: ChatMessage[] = [
				{
					id: '1',
					role: 'user',
					content: 'Hello',
					timestamp: Date.now(),
					assistantType: undefined
				},
				{
					id: '2',
					role: 'assistant',
					content: 'Hi there',
					timestamp: Date.now(),
					assistantType: 'bestie'
				}
			];

			(mockRequest.json as any).mockResolvedValue({
				messages,
				userProfile: null
			});

			const mockClaudeClient = {
				messages: {
					create: vi.fn().mockResolvedValue({
						content: [{ type: 'text', text: 'Response' }]
					})
				}
			};
			(getClaudeClient as any).mockReturnValue(mockClaudeClient);

			const response = await POST(mockEvent as RequestEvent);
			expect(response.status).toBe(200);
		});
	});
});
