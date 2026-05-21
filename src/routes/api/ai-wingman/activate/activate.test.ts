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

describe('POST /api/ai-wingman/activate', () => {
	let mockRequest: any;
	let mockLocals: any;

	beforeEach(() => {
		vi.clearAllMocks();

		// Setup default mock implementations
		vi.mocked(profileService.loadPersonality).mockResolvedValue({
			communicationStyle: 'direct',
			personalityVibe: 'ambitious',
			mattersMost: 'humor',
			values: ['Authenticity', 'Growth mindset'],
			datingPatterns: ['Prefers genuine conversation'],
			redFlagsToAvoid: ['Overly focused on appearance'],
			updatedAt: Date.now()
		});

		vi.mocked(aiAssistantManager.activateAssistant).mockResolvedValue(undefined);

		mockLocals = {
			auth: {
				getSession: vi.fn().mockResolvedValue({
					user: { id: 'user-456' }
				})
			}
		};
	});

	describe('Authentication', () => {
		it('should reject requests without authentication', async () => {
			mockLocals.auth.getSession.mockResolvedValue(null);

			mockRequest = {
				json: vi.fn().mockResolvedValue({
					matchId: 'match-456'
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
					matchId: 'match-456'
				})
			};

			try {
				await POST({ request: mockRequest, locals: mockLocals } as any);
				expect.fail('Should have thrown authentication error');
			} catch (err: any) {
				expect(err.message).toContain('AUTH_ERROR');
			}
		});

		it('should reject requests with undefined user', async () => {
			mockLocals.auth.getSession.mockResolvedValue({
				user: undefined
			});

			mockRequest = {
				json: vi.fn().mockResolvedValue({
					matchId: 'match-456'
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
					matchedUserProfile: { gender: 'woman' }
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
					matchId: 456
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
					matchId: 'match-456',
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
					matchId: 'match-456',
					matchedUserProfile: {
						gender: 'woman',
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

		it('should accept null matchId in request body', async () => {
			mockRequest = {
				json: vi.fn().mockResolvedValue({
					matchId: null
				})
			};

			try {
				await POST({ request: mockRequest, locals: mockLocals } as any);
				expect.fail('Should have thrown validation error');
			} catch (err: any) {
				expect(err.status).toBe(400);
			}
		});
	});

	describe('Profile Validation', () => {
		it('should reject if personality is empty', async () => {
			vi.mocked(profileService.loadPersonality).mockResolvedValue({
				communicationStyle: '',
				personalityVibe: '',
				mattersMost: '',
				values: [],
				datingPatterns: [],
				redFlagsToAvoid: [],
				updatedAt: Date.now()
			});

			mockRequest = {
				json: vi.fn().mockResolvedValue({
					matchId: 'match-456'
				})
			};

			try {
				await POST({ request: mockRequest, locals: mockLocals } as any);
				expect.fail('Should have thrown error for empty personality');
			} catch (err: any) {
				expect(err.message).toContain('incomplete');
			}
		});

		it('should accept if personality has at least one field populated', async () => {
			mockRequest = {
				json: vi.fn().mockResolvedValue({
					matchId: 'match-456'
				})
			};

			const response = await POST({ request: mockRequest, locals: mockLocals } as any);
			const data = await response.json();

			expect(data.success).toBe(true);
			expect(data.message).toContain('AI Wingman activated');
		});

		it('should accept if personality has communicationStyle populated', async () => {
			vi.mocked(profileService.loadPersonality).mockResolvedValue({
				communicationStyle: 'direct',
				personalityVibe: '',
				mattersMost: '',
				values: [],
				datingPatterns: [],
				redFlagsToAvoid: [],
				updatedAt: Date.now()
			});

			mockRequest = {
				json: vi.fn().mockResolvedValue({
					matchId: 'match-456'
				})
			};

			const response = await POST({ request: mockRequest, locals: mockLocals } as any);
			const data = await response.json();

			expect(data.success).toBe(true);
		});

		it('should accept if personality has values populated', async () => {
			vi.mocked(profileService.loadPersonality).mockResolvedValue({
				communicationStyle: '',
				personalityVibe: '',
				mattersMost: '',
				values: ['Authenticity'],
				datingPatterns: [],
				redFlagsToAvoid: [],
				updatedAt: Date.now()
			});

			mockRequest = {
				json: vi.fn().mockResolvedValue({
					matchId: 'match-456'
				})
			};

			const response = await POST({ request: mockRequest, locals: mockLocals } as any);
			const data = await response.json();

			expect(data.success).toBe(true);
		});
	});

	describe('Successful Activation', () => {
		it('should activate AI Wingman with valid request', async () => {
			mockRequest = {
				json: vi.fn().mockResolvedValue({
					matchId: 'match-456'
				})
			};

			const response = await POST({ request: mockRequest, locals: mockLocals } as any);
			const data = await response.json();

			expect(data.success).toBe(true);
			expect(data.conversationId).toBe('user-456:match-456:wingman');
			expect(data.message).toContain('AI Wingman activated');
		});

		it('should activate with matched user profile', async () => {
			mockRequest = {
				json: vi.fn().mockResolvedValue({
					matchId: 'match-456',
					matchedUserProfile: {
						gender: 'woman',
						ageRange: '23-28',
						datingApp: 'bumble',
						relationshipGoal: 'serious'
					}
				})
			};

			const response = await POST({ request: mockRequest, locals: mockLocals } as any);
			const data = await response.json();

			expect(data.success).toBe(true);
			expect(vi.mocked(aiAssistantManager.activateAssistant)).toHaveBeenCalledWith(
				'user-456',
				'match-456',
				'wingman',
				expect.any(Object),
				expect.objectContaining({
					gender: 'woman',
					ageRange: '23-28',
					datingApp: 'bumble',
					relationshipGoal: 'serious'
				})
			);
		});

		it('should load personality before activation', async () => {
			mockRequest = {
				json: vi.fn().mockResolvedValue({
					matchId: 'match-456'
				})
			};

			await POST({ request: mockRequest, locals: mockLocals } as any);

			expect(vi.mocked(profileService.loadPersonality)).toHaveBeenCalledWith('user-456');
		});

		it('should call activateAssistant with correct parameters', async () => {
			mockRequest = {
				json: vi.fn().mockResolvedValue({
					matchId: 'match-456',
					matchedUserProfile: {
						gender: 'woman',
						ageRange: '23-28'
					}
				})
			};

			await POST({ request: mockRequest, locals: mockLocals } as any);

			expect(vi.mocked(aiAssistantManager.activateAssistant)).toHaveBeenCalledWith(
				'user-456',
				'match-456',
				'wingman',
				expect.objectContaining({
					gender: 'man'
				}),
				expect.objectContaining({
					gender: 'woman',
					ageRange: '23-28'
				})
			);
		});

		it('should return correct response format', async () => {
			mockRequest = {
				json: vi.fn().mockResolvedValue({
					matchId: 'match-456'
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

		it('should return wingman-specific message', async () => {
			mockRequest = {
				json: vi.fn().mockResolvedValue({
					matchId: 'match-456'
				})
			};

			const response = await POST({ request: mockRequest, locals: mockLocals } as any);
			const data = await response.json();

			expect(data.message).toContain('AI Wingman');
			expect(data.message).toContain('authentic responses');
			expect(data.message).toContain('strategically');
		});

		it('should set assistant type to wingman in conversationId', async () => {
			mockRequest = {
				json: vi.fn().mockResolvedValue({
					matchId: 'match-456'
				})
			};

			const response = await POST({ request: mockRequest, locals: mockLocals } as any);
			const data = await response.json();

			expect(data.conversationId).toContain('wingman');
			expect(data.conversationId).not.toContain('bestie');
		});
	});

	describe('Error Handling', () => {
		it('should handle database errors gracefully', async () => {
			vi.mocked(aiAssistantManager.activateAssistant).mockRejectedValue(
				new Error('Database connection failed')
			);

			mockRequest = {
				json: vi.fn().mockResolvedValue({
					matchId: 'match-456'
				})
			};

			try {
				await POST({ request: mockRequest, locals: mockLocals } as any);
				expect.fail('Should have thrown database error');
			} catch (err: any) {
				expect(err.status).toBe(500);
			}
		});

		it('should handle personality loading errors gracefully', async () => {
			vi.mocked(profileService.loadPersonality).mockRejectedValue(
				new Error('Failed to load personality')
			);

			mockRequest = {
				json: vi.fn().mockResolvedValue({
					matchId: 'match-456'
				})
			};

			try {
				await POST({ request: mockRequest, locals: mockLocals } as any);
				expect.fail('Should have thrown database error');
			} catch (err: any) {
				expect(err.status).toBe(500);
			}
		});

		it('should handle HTTP errors from activateAssistant', async () => {
			const httpError = new Error('Conflict');
			(httpError as any).status = 409;
			vi.mocked(aiAssistantManager.activateAssistant).mockRejectedValue(httpError);

			mockRequest = {
				json: vi.fn().mockResolvedValue({
					matchId: 'match-456'
				})
			};

			try {
				await POST({ request: mockRequest, locals: mockLocals } as any);
				expect.fail('Should have thrown error');
			} catch (err: any) {
				expect(err.status).toBe(409);
			}
		});
	});

	describe('Edge Cases', () => {
		it('should handle matchId with whitespace', async () => {
			mockRequest = {
				json: vi.fn().mockResolvedValue({
					matchId: '  match-456  '
				})
			};

			const response = await POST({ request: mockRequest, locals: mockLocals } as any);
			const data = await response.json();

			expect(data.success).toBe(true);
			expect(vi.mocked(aiAssistantManager.activateAssistant)).toHaveBeenCalledWith(
				'user-456',
				'match-456',
				'wingman',
				expect.any(Object),
				undefined
			);
		});

		it('should handle partial matchedUserProfile', async () => {
			mockRequest = {
				json: vi.fn().mockResolvedValue({
					matchId: 'match-456',
					matchedUserProfile: {
						gender: 'woman'
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
					matchId: 'match-456',
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
					matchId: 'match-456'
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

		it('should handle very long matchId', async () => {
			const longMatchId = 'match-' + 'x'.repeat(1000);
			mockRequest = {
				json: vi.fn().mockResolvedValue({
					matchId: longMatchId
				})
			};

			const response = await POST({ request: mockRequest, locals: mockLocals } as any);
			const data = await response.json();

			expect(data.success).toBe(true);
		});

		it('should handle special characters in matchId', async () => {
			mockRequest = {
				json: vi.fn().mockResolvedValue({
					matchId: 'match-456-!@#$%'
				})
			};

			const response = await POST({ request: mockRequest, locals: mockLocals } as any);
			const data = await response.json();

			expect(data.success).toBe(true);
		});
	});

	describe('Idempotence Property', () => {
		it('should be idempotent - activating twice returns same conversationId', async () => {
			mockRequest = {
				json: vi.fn().mockResolvedValue({
					matchId: 'match-456'
				})
			};

			// First activation
			const response1 = await POST({ request: mockRequest, locals: mockLocals } as any);
			const data1 = await response1.json();

			// Reset mocks for second call
			vi.clearAllMocks();
			vi.mocked(profileService.loadPersonality).mockResolvedValue({
				communicationStyle: 'direct',
				personalityVibe: 'ambitious',
				mattersMost: 'humor',
				values: ['Authenticity', 'Growth mindset'],
				datingPatterns: ['Prefers genuine conversation'],
				redFlagsToAvoid: ['Overly focused on appearance'],
				updatedAt: Date.now()
			});
			vi.mocked(aiAssistantManager.activateAssistant).mockResolvedValue(undefined);
			mockLocals.auth.getSession.mockResolvedValue({
				user: { id: 'user-456' }
			});

			// Second activation
			const response2 = await POST({ request: mockRequest, locals: mockLocals } as any);
			const data2 = await response2.json();

			// Both should return the same conversationId
			expect(data1.conversationId).toBe(data2.conversationId);
			expect(data1.conversationId).toBe('user-456:match-456:wingman');
		});

		it('should be idempotent with different matched user profiles', async () => {
			mockRequest = {
				json: vi.fn().mockResolvedValue({
					matchId: 'match-456',
					matchedUserProfile: {
						gender: 'woman',
						ageRange: '23-28'
					}
				})
			};

			// First activation
			const response1 = await POST({ request: mockRequest, locals: mockLocals } as any);
			const data1 = await response1.json();

			// Reset mocks for second call with different profile
			vi.clearAllMocks();
			vi.mocked(profileService.loadPersonality).mockResolvedValue({
				communicationStyle: 'direct',
				personalityVibe: 'ambitious',
				mattersMost: 'humor',
				values: ['Authenticity', 'Growth mindset'],
				datingPatterns: ['Prefers genuine conversation'],
				redFlagsToAvoid: ['Overly focused on appearance'],
				updatedAt: Date.now()
			});
			vi.mocked(aiAssistantManager.activateAssistant).mockResolvedValue(undefined);
			mockLocals.auth.getSession.mockResolvedValue({
				user: { id: 'user-456' }
			});

			mockRequest.json.mockResolvedValue({
				matchId: 'match-456',
				matchedUserProfile: {
					gender: 'woman',
					ageRange: '25-30'
				}
			});

			// Second activation with different profile
			const response2 = await POST({ request: mockRequest, locals: mockLocals } as any);
			const data2 = await response2.json();

			// ConversationId should be the same (idempotent)
			expect(data1.conversationId).toBe(data2.conversationId);
		});
	});

	describe('Comparison with AI Bestie', () => {
		it('should use wingman assistant type instead of bestie', async () => {
			mockRequest = {
				json: vi.fn().mockResolvedValue({
					matchId: 'match-456'
				})
			};

			await POST({ request: mockRequest, locals: mockLocals } as any);

			const calls = vi.mocked(aiAssistantManager.activateAssistant).mock.calls;
			expect(calls.length).toBeGreaterThan(0);
			const lastCall = calls[calls.length - 1];
			expect(lastCall[2]).toBe('wingman');
		});

		it('should use male gender in user profile', async () => {
			mockRequest = {
				json: vi.fn().mockResolvedValue({
					matchId: 'match-456'
				})
			};

			await POST({ request: mockRequest, locals: mockLocals } as any);

			const calls = vi.mocked(aiAssistantManager.activateAssistant).mock.calls;
			expect(calls.length).toBeGreaterThan(0);
			const lastCall = calls[calls.length - 1];
			const userProfile = lastCall[3];
			expect(userProfile).toHaveProperty('gender', 'man');
		});

		it('should load personality instead of preferences', async () => {
			mockRequest = {
				json: vi.fn().mockResolvedValue({
					matchId: 'match-456'
				})
			};

			await POST({ request: mockRequest, locals: mockLocals } as any);

			expect(vi.mocked(profileService.loadPersonality)).toHaveBeenCalled();
			expect(vi.mocked(profileService.loadPreferences)).not.toHaveBeenCalled();
		});
	});
});
