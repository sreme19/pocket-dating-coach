import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from './+server';
import * as aiAssistantManager from '$lib/server/ai-assistant-manager';
import * as profileService from '$lib/server/profile-service';
import type { RequestHandler } from './$types';

// Mock the modules
vi.mock('$lib/server/ai-assistant-manager');
vi.mock('$lib/server/profile-service');
vi.mock('$lib/server/error-handler', () => ({
	throwAuthenticationError: (msg: string) => {
		const err = new Error(`AUTH_ERROR: ${msg}`);
		(err as any).status = 401;
		throw err;
	},
	throwValidationError: (msg: string) => {
		const err = new Error(msg);
		(err as any).status = 400;
		throw err;
	},
	throwDatabaseError: (endpoint: string, err: any, msg: string) => {
		const error = new Error(msg);
		(error as any).status = 500;
		throw error;
	},
	logError: vi.fn(),
	ErrorType: {
		VALIDATION_ERROR: 'VALIDATION_ERROR',
		DATABASE_ERROR: 'DATABASE_ERROR'
	}
}));

describe('POST /api/ai-bestie/activate', () => {
	let mockRequest: any;
	let mockLocals: any;

	beforeEach(() => {
		vi.clearAllMocks();

		// Setup default mock implementations
		vi.mocked(profileService.loadPreferences).mockResolvedValue({
			emotionalSignals: ['Asks about my day'],
			lifestyleSignals: ['Active and outdoorsy'],
			maturitySignals: ['Takes responsibility'],
			boundaries: ['No excessive drinking'],
			dealbreakers: ['Disrespectful to service workers'],
			privateCompatibilityNotes: [],
			updatedAt: Date.now()
		});

		vi.mocked(aiAssistantManager.activateAssistant).mockResolvedValue(undefined);

		mockLocals = {
			auth: {
				getSession: vi.fn().mockResolvedValue({
					user: { id: 'user-123' }
				})
			}
		};
	});

	describe('Authentication', () => {
		it('should reject requests without authentication', async () => {
			mockLocals.auth.getSession.mockResolvedValue(null);

			mockRequest = {
				json: vi.fn().mockResolvedValue({
					matchId: 'match-123'
				})
			};

			try {
				await POST({ request: mockRequest, locals: mockLocals } as any);
				expect.fail('Should have thrown authentication error');
			} catch (err: any) {
				expect(err.message).toContain('AUTH_ERROR');
			}
		});

		it('should reject requests with missing user ID', async () => {
			mockLocals.auth.getSession.mockResolvedValue({
				user: { id: null }
			});

			mockRequest = {
				json: vi.fn().mockResolvedValue({
					matchId: 'match-123'
				})
			};

			try {
				await POST({ request: mockRequest, locals: mockLocals } as any);
				expect.fail('Should have thrown authentication error');
			} catch (err: any) {
				expect(err.message).toContain('AUTH_ERROR');
			}
		});
	});

	describe('Request Validation', () => {
		it('should reject invalid JSON', async () => {
			mockRequest = {
				json: vi.fn().mockRejectedValue(new Error('Invalid JSON'))
			};

			try {
				await POST({ request: mockRequest, locals: mockLocals } as any);
				expect.fail('Should have thrown validation error');
			} catch (err: any) {
				expect(err.status).toBe(400);
			}
		});

		it('should reject missing matchId', async () => {
			mockRequest = {
				json: vi.fn().mockResolvedValue({
					matchedUserProfile: { gender: 'man' }
				})
			};

			try {
				await POST({ request: mockRequest, locals: mockLocals } as any);
				expect.fail('Should have thrown validation error');
			} catch (err: any) {
				expect(err.status).toBe(400);
				expect(err.message).toContain('matchId');
			}
		});

		it('should reject empty matchId', async () => {
			mockRequest = {
				json: vi.fn().mockResolvedValue({
					matchId: '   '
				})
			};

			try {
				await POST({ request: mockRequest, locals: mockLocals } as any);
				expect.fail('Should have thrown validation error');
			} catch (err: any) {
				expect(err.status).toBe(400);
				expect(err.message).toContain('empty');
			}
		});

		it('should reject non-string matchId', async () => {
			mockRequest = {
				json: vi.fn().mockResolvedValue({
					matchId: 123
				})
			};

			try {
				await POST({ request: mockRequest, locals: mockLocals } as any);
				expect.fail('Should have thrown validation error');
			} catch (err: any) {
				expect(err.status).toBe(400);
			}
		});

		it('should reject invalid matchedUserProfile type', async () => {
			mockRequest = {
				json: vi.fn().mockResolvedValue({
					matchId: 'match-123',
					matchedUserProfile: 'not-an-object'
				})
			};

			try {
				await POST({ request: mockRequest, locals: mockLocals } as any);
				expect.fail('Should have thrown validation error');
			} catch (err: any) {
				expect(err.status).toBe(400);
				expect(err.message).toContain('matchedUserProfile');
			}
		});

		it('should reject invalid fields in matchedUserProfile', async () => {
			mockRequest = {
				json: vi.fn().mockResolvedValue({
					matchId: 'match-123',
					matchedUserProfile: {
						gender: 'man',
						invalidField: 'value'
					}
				})
			};

			try {
				await POST({ request: mockRequest, locals: mockLocals } as any);
				expect.fail('Should have thrown validation error');
			} catch (err: any) {
				expect(err.status).toBe(400);
				expect(err.message).toContain('invalidField');
			}
		});
	});

	describe('Profile Validation', () => {
		it('should reject if preferences are empty', async () => {
			vi.mocked(profileService.loadPreferences).mockResolvedValue({
				emotionalSignals: [],
				lifestyleSignals: [],
				maturitySignals: [],
				boundaries: [],
				dealbreakers: [],
				privateCompatibilityNotes: [],
				updatedAt: Date.now()
			});

			mockRequest = {
				json: vi.fn().mockResolvedValue({
					matchId: 'match-123'
				})
			};

			try {
				await POST({ request: mockRequest, locals: mockLocals } as any);
				expect.fail('Should have thrown error for empty preferences');
			} catch (err: any) {
				// throwValidationError throws a SvelteKit error with the message
				expect(err.message).toContain('incomplete');
			}
		});

		it('should accept if preferences have at least one field populated', async () => {
			mockRequest = {
				json: vi.fn().mockResolvedValue({
					matchId: 'match-123'
				})
			};

			const response = await POST({ request: mockRequest, locals: mockLocals } as any);
			const data = await response.json();

			expect(data.success).toBe(true);
			expect(data.message).toContain('AI Bestie activated');
		});
	});

	describe('Successful Activation', () => {
		it('should activate AI Bestie with valid request', async () => {
			mockRequest = {
				json: vi.fn().mockResolvedValue({
					matchId: 'match-123'
				})
			};

			const response = await POST({ request: mockRequest, locals: mockLocals } as any);
			const data = await response.json();

			expect(data.success).toBe(true);
			expect(data.conversationId).toBe('user-123:match-123:bestie');
			expect(data.message).toContain('AI Bestie activated');
		});

		it('should activate with matched user profile', async () => {
			mockRequest = {
				json: vi.fn().mockResolvedValue({
					matchId: 'match-123',
					matchedUserProfile: {
						gender: 'man',
						ageRange: '25-30',
						datingApp: 'hinge',
						relationshipGoal: 'serious'
					}
				})
			};

			const response = await POST({ request: mockRequest, locals: mockLocals } as any);
			const data = await response.json();

			expect(data.success).toBe(true);
			expect(vi.mocked(aiAssistantManager.activateAssistant)).toHaveBeenCalledWith(
				'user-123',
				'match-123',
				'bestie',
				expect.any(Object),
				expect.objectContaining({
					gender: 'man',
					ageRange: '25-30',
					datingApp: 'hinge',
					relationshipGoal: 'serious'
				})
			);
		});

		it('should load preferences before activation', async () => {
			mockRequest = {
				json: vi.fn().mockResolvedValue({
					matchId: 'match-123'
				})
			};

			await POST({ request: mockRequest, locals: mockLocals } as any);

			expect(vi.mocked(profileService.loadPreferences)).toHaveBeenCalledWith('user-123');
		});

		it('should call activateAssistant with correct parameters', async () => {
			mockRequest = {
				json: vi.fn().mockResolvedValue({
					matchId: 'match-123',
					matchedUserProfile: {
						gender: 'man',
						ageRange: '25-30'
					}
				})
			};

			await POST({ request: mockRequest, locals: mockLocals } as any);

			expect(vi.mocked(aiAssistantManager.activateAssistant)).toHaveBeenCalledWith(
				'user-123',
				'match-123',
				'bestie',
				expect.objectContaining({
					gender: 'woman'
				}),
				expect.objectContaining({
					gender: 'man',
					ageRange: '25-30'
				})
			);
		});

		it('should return correct response format', async () => {
			mockRequest = {
				json: vi.fn().mockResolvedValue({
					matchId: 'match-123'
				})
			};

			const response = await POST({ request: mockRequest, locals: mockLocals } as any);
			const data = await response.json();

			expect(data).toHaveProperty('success');
			expect(data).toHaveProperty('conversationId');
			expect(data).toHaveProperty('message');
			expect(typeof data.success).toBe('boolean');
			expect(typeof data.conversationId).toBe('string');
			expect(typeof data.message).toBe('string');
		});
	});

	describe('Error Handling', () => {
		it('should handle database errors gracefully', async () => {
			vi.mocked(aiAssistantManager.activateAssistant).mockRejectedValue(
				new Error('Database connection failed')
			);

			mockRequest = {
				json: vi.fn().mockResolvedValue({
					matchId: 'match-123'
				})
			};

			try {
				await POST({ request: mockRequest, locals: mockLocals } as any);
				expect.fail('Should have thrown database error');
			} catch (err: any) {
				expect(err.status).toBe(500);
			}
		});

		it('should handle profile loading errors gracefully', async () => {
			vi.mocked(profileService.loadPreferences).mockRejectedValue(
				new Error('Failed to load preferences')
			);

			mockRequest = {
				json: vi.fn().mockResolvedValue({
					matchId: 'match-123'
				})
			};

			try {
				await POST({ request: mockRequest, locals: mockLocals } as any);
				expect.fail('Should have thrown database error');
			} catch (err: any) {
				expect(err.status).toBe(500);
			}
		});
	});

	describe('Edge Cases', () => {
		it('should handle matchId with whitespace', async () => {
			mockRequest = {
				json: vi.fn().mockResolvedValue({
					matchId: '  match-123  '
				})
			};

			const response = await POST({ request: mockRequest, locals: mockLocals } as any);
			const data = await response.json();

			expect(data.success).toBe(true);
			expect(vi.mocked(aiAssistantManager.activateAssistant)).toHaveBeenCalledWith(
				'user-123',
				'match-123',
				'bestie',
				expect.any(Object),
				undefined
			);
		});

		it('should handle partial matchedUserProfile', async () => {
			mockRequest = {
				json: vi.fn().mockResolvedValue({
					matchId: 'match-123',
					matchedUserProfile: {
						gender: 'man'
					}
				})
			};

			const response = await POST({ request: mockRequest, locals: mockLocals } as any);
			const data = await response.json();

			expect(data.success).toBe(true);
		});

		it('should handle empty matchedUserProfile object', async () => {
			mockRequest = {
				json: vi.fn().mockResolvedValue({
					matchId: 'match-123',
					matchedUserProfile: {}
				})
			};

			const response = await POST({ request: mockRequest, locals: mockLocals } as any);
			const data = await response.json();

			expect(data.success).toBe(true);
		});

		it('should handle multiple activations for same match', async () => {
			mockRequest = {
				json: vi.fn().mockResolvedValue({
					matchId: 'match-123'
				})
			};

			// First activation
			const response1 = await POST({ request: mockRequest, locals: mockLocals } as any);
			const data1 = await response1.json();

			// Second activation (should reactivate)
			const response2 = await POST({ request: mockRequest, locals: mockLocals } as any);
			const data2 = await response2.json();

			expect(data1.success).toBe(true);
			expect(data2.success).toBe(true);
			expect(data1.conversationId).toBe(data2.conversationId);
		});
	});

	describe('Idempotence Property', () => {
		it('should be idempotent - activating twice returns same conversationId', async () => {
			mockRequest = {
				json: vi.fn().mockResolvedValue({
					matchId: 'match-123'
				})
			};

			// First activation
			const response1 = await POST({ request: mockRequest, locals: mockLocals } as any);
			const data1 = await response1.json();

			// Reset mocks for second call
			vi.clearAllMocks();
			vi.mocked(profileService.loadPreferences).mockResolvedValue({
				emotionalSignals: ['Asks about my day'],
				lifestyleSignals: ['Active and outdoorsy'],
				maturitySignals: ['Takes responsibility'],
				boundaries: ['No excessive drinking'],
				dealbreakers: ['Disrespectful to service workers'],
				privateCompatibilityNotes: [],
				updatedAt: Date.now()
			});
			vi.mocked(aiAssistantManager.activateAssistant).mockResolvedValue(undefined);
			mockLocals.auth.getSession.mockResolvedValue({
				user: { id: 'user-123' }
			});

			// Second activation
			const response2 = await POST({ request: mockRequest, locals: mockLocals } as any);
			const data2 = await response2.json();

			// Both should return the same conversationId
			expect(data1.conversationId).toBe(data2.conversationId);
			expect(data1.conversationId).toBe('user-123:match-123:bestie');
		});
	});
});
