import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from './+server';
import * as aiAssistantManager from '$lib/server/ai-assistant-manager';
import * as errorHandler from '$lib/server/error-handler';
import type { RequestHandler } from './$types';

/**
 * Unit tests for POST /api/ai-bestie/deactivate endpoint
 * 
 * Validates: Requirements 20.1, 20.2, 20.3
 * - Deactivate assistant for match
 * - Clear cached profile data
 * - Return confirmation message
 */

// Mock the dependencies
vi.mock('$lib/server/ai-assistant-manager');
vi.mock('$lib/server/error-handler');

describe('POST /api/ai-bestie/deactivate', () => {
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
				getSession: vi.fn()
			}
		};
	});

	describe('Authentication Validation', () => {
		it('should throw authentication error when user is not authenticated', async () => {
			// Arrange
			mockLocals.auth.getSession.mockResolvedValue(null);
			vi.spyOn(errorHandler, 'throwAuthenticationError').mockImplementation((msg) => {
				throw new Error(msg);
			});

			// Act & Assert
			await expect(
				POST({ request: mockRequest, locals: mockLocals } as any)
			).rejects.toThrow('User authentication required');

			expect(errorHandler.throwAuthenticationError).toHaveBeenCalledWith(
				'User authentication required'
			);
		});

		it('should throw authentication error when session has no user ID', async () => {
			// Arrange
			mockLocals.auth.getSession.mockResolvedValue({ user: {} });
			vi.spyOn(errorHandler, 'throwAuthenticationError').mockImplementation((msg) => {
				throw new Error(msg);
			});

			// Act & Assert
			await expect(
				POST({ request: mockRequest, locals: mockLocals } as any)
			).rejects.toThrow('User authentication required');
		});

		it('should proceed when user is authenticated with valid session', async () => {
			// Arrange
			const userId = 'test-user-123';
			mockLocals.auth.getSession.mockResolvedValue({
				user: { id: userId }
			});
			mockRequest.json.mockResolvedValue({ matchId: 'match-123' });
			vi.spyOn(aiAssistantManager, 'deactivateAssistant').mockResolvedValue(undefined);

			// Act
			const response = await POST({ request: mockRequest, locals: mockLocals } as any);

			// Assert
			expect(response.status).toBe(200); // json() returns a Response with 200 status
			expect(aiAssistantManager.deactivateAssistant).toHaveBeenCalledWith(
				userId,
				'match-123',
				'bestie'
			);
		});
	});

	describe('Request Body Validation', () => {
		beforeEach(() => {
			mockLocals.auth.getSession.mockResolvedValue({
				user: { id: 'test-user-123' }
			});
		});

		it('should throw validation error for invalid JSON', async () => {
			// Arrange
			mockRequest.json.mockRejectedValue(new SyntaxError('Invalid JSON'));
			vi.spyOn(errorHandler, 'throwValidationError').mockImplementation((msg) => {
				throw new Error(msg);
			});

			// Act & Assert
			await expect(
				POST({ request: mockRequest, locals: mockLocals } as any)
			).rejects.toThrow('Invalid JSON in request body');

			expect(errorHandler.throwValidationError).toHaveBeenCalledWith(
				'Invalid JSON in request body'
			);
		});

		it('should throw validation error when matchId is missing', async () => {
			// Arrange
			mockRequest.json.mockResolvedValue({});
			vi.spyOn(errorHandler, 'throwValidationError').mockImplementation((msg) => {
				throw new Error(msg);
			});

			// Act & Assert
			await expect(
				POST({ request: mockRequest, locals: mockLocals } as any)
			).rejects.toThrow('matchId is required and must be a string');
		});

		it('should throw validation error when matchId is not a string', async () => {
			// Arrange
			mockRequest.json.mockResolvedValue({ matchId: 123 });
			vi.spyOn(errorHandler, 'throwValidationError').mockImplementation((msg) => {
				throw new Error(msg);
			});

			// Act & Assert
			await expect(
				POST({ request: mockRequest, locals: mockLocals } as any)
			).rejects.toThrow('matchId is required and must be a string');
		});

		it('should throw validation error when matchId is empty string', async () => {
			// Arrange
			mockRequest.json.mockResolvedValue({ matchId: '' });
			vi.spyOn(errorHandler, 'throwValidationError').mockImplementation((msg) => {
				throw new Error(msg);
			});

			// Act & Assert
			// Empty string is caught by the first check (not a string check fails for empty)
			// or by the trim check - either way it should throw validation error
			await expect(
				POST({ request: mockRequest, locals: mockLocals } as any)
			).rejects.toThrow();
		});

		it('should throw validation error when matchId is whitespace only', async () => {
			// Arrange
			mockRequest.json.mockResolvedValue({ matchId: '   ' });
			vi.spyOn(errorHandler, 'throwValidationError').mockImplementation((msg) => {
				throw new Error(msg);
			});

			// Act & Assert
			await expect(
				POST({ request: mockRequest, locals: mockLocals } as any)
			).rejects.toThrow('matchId cannot be empty');
		});

		it('should trim whitespace from matchId', async () => {
			// Arrange
			const userId = 'test-user-123';
			mockLocals.auth.getSession.mockResolvedValue({
				user: { id: userId }
			});
			mockRequest.json.mockResolvedValue({ matchId: '  match-123  ' });
			vi.spyOn(aiAssistantManager, 'deactivateAssistant').mockResolvedValue(undefined);

			// Act
			await POST({ request: mockRequest, locals: mockLocals } as any);

			// Assert
			expect(aiAssistantManager.deactivateAssistant).toHaveBeenCalledWith(
				userId,
				'match-123',
				'bestie'
			);
		});
	});

	describe('Deactivation Logic', () => {
		beforeEach(() => {
			mockLocals.auth.getSession.mockResolvedValue({
				user: { id: 'test-user-123' }
			});
		});

		it('should call deactivateAssistant with correct parameters', async () => {
			// Arrange
			const userId = 'test-user-123';
			const matchId = 'match-456';
			mockRequest.json.mockResolvedValue({ matchId });
			vi.spyOn(aiAssistantManager, 'deactivateAssistant').mockResolvedValue(undefined);

			// Act
			await POST({ request: mockRequest, locals: mockLocals } as any);

			// Assert
			expect(aiAssistantManager.deactivateAssistant).toHaveBeenCalledWith(
				userId,
				matchId,
				'bestie'
			);
			expect(aiAssistantManager.deactivateAssistant).toHaveBeenCalledTimes(1);
		});

		it('should handle deactivation for different match IDs', async () => {
			// Arrange
			const userId = 'test-user-123';
			const matchIds = ['match-1', 'match-2', 'match-3'];
			vi.spyOn(aiAssistantManager, 'deactivateAssistant').mockResolvedValue(undefined);

			// Act & Assert
			for (const matchId of matchIds) {
				mockRequest.json.mockResolvedValue({ matchId });
				await POST({ request: mockRequest, locals: mockLocals } as any);

				expect(aiAssistantManager.deactivateAssistant).toHaveBeenCalledWith(
					userId,
					matchId,
					'bestie'
				);
			}
		});
	});

	describe('Success Response', () => {
		beforeEach(() => {
			mockLocals.auth.getSession.mockResolvedValue({
				user: { id: 'test-user-123' }
			});
			mockRequest.json.mockResolvedValue({ matchId: 'match-123' });
			vi.spyOn(aiAssistantManager, 'deactivateAssistant').mockResolvedValue(undefined);
		});

		it('should return success response with correct structure', async () => {
			// Act
			const response = await POST({ request: mockRequest, locals: mockLocals } as any);
			const data = await response.json();

			// Assert
			expect(data).toEqual({
				success: true,
				message: 'AI Bestie deactivated. You can reactivate it anytime.'
			});
		});

		it('should return 200 status code on success', async () => {
			// Act
			const response = await POST({ request: mockRequest, locals: mockLocals } as any);

			// Assert
			expect(response.status).toBe(200);
		});

		it('should log successful deactivation', async () => {
			// Arrange
			const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

			// Act
			await POST({ request: mockRequest, locals: mockLocals } as any);

			// Assert
			expect(consoleSpy).toHaveBeenCalledWith(
				'[AI Bestie] Deactivated for user test-user-123, match match-123'
			);

			consoleSpy.mockRestore();
		});
	});

	describe('Error Handling', () => {
		beforeEach(() => {
			mockLocals.auth.getSession.mockResolvedValue({
				user: { id: 'test-user-123' }
			});
			mockRequest.json.mockResolvedValue({ matchId: 'match-123' });
		});

		it('should handle database errors from deactivateAssistant', async () => {
			// Arrange
			const dbError = new Error('Database connection failed');
			vi.spyOn(aiAssistantManager, 'deactivateAssistant').mockRejectedValue(dbError);
			vi.spyOn(errorHandler, 'throwDatabaseError').mockImplementation((endpoint, err, msg) => {
				throw new Error(msg);
			});

			// Act & Assert
			await expect(
				POST({ request: mockRequest, locals: mockLocals } as any)
			).rejects.toThrow('Failed to deactivate AI Bestie. Please try again.');

			expect(errorHandler.throwDatabaseError).toHaveBeenCalledWith(
				'POST /api/ai-bestie/deactivate',
				dbError,
				'Failed to deactivate AI Bestie. Please try again.'
			);
		});

		it('should handle HTTP errors from deactivateAssistant', async () => {
			// Arrange
			const httpError = new Error('Not Found');
			(httpError as any).status = 404;
			vi.spyOn(aiAssistantManager, 'deactivateAssistant').mockRejectedValue(httpError);

			// Act & Assert
			await expect(
				POST({ request: mockRequest, locals: mockLocals } as any)
			).rejects.toThrow('Not Found');
		});

		it('should log errors for debugging', async () => {
			// Arrange
			const dbError = new Error('Database error');
			vi.spyOn(aiAssistantManager, 'deactivateAssistant').mockRejectedValue(dbError);
			vi.spyOn(errorHandler, 'logError').mockImplementation(() => {});
			vi.spyOn(errorHandler, 'throwDatabaseError').mockImplementation((endpoint, err, msg) => {
				throw new Error(msg);
			});

			// Act & Assert
			await expect(
				POST({ request: mockRequest, locals: mockLocals } as any)
			).rejects.toThrow();

			expect(errorHandler.logError).toHaveBeenCalled();
		});
	});

	describe('Edge Cases', () => {
		beforeEach(() => {
			mockLocals.auth.getSession.mockResolvedValue({
				user: { id: 'test-user-123' }
			});
		});

		it('should handle matchId with special characters', async () => {
			// Arrange
			const matchId = 'match-123-abc_def.xyz';
			mockRequest.json.mockResolvedValue({ matchId });
			vi.spyOn(aiAssistantManager, 'deactivateAssistant').mockResolvedValue(undefined);

			// Act
			await POST({ request: mockRequest, locals: mockLocals } as any);

			// Assert
			expect(aiAssistantManager.deactivateAssistant).toHaveBeenCalledWith(
				'test-user-123',
				matchId,
				'bestie'
			);
		});

		it('should handle very long matchId', async () => {
			// Arrange
			const matchId = 'a'.repeat(1000);
			mockRequest.json.mockResolvedValue({ matchId });
			vi.spyOn(aiAssistantManager, 'deactivateAssistant').mockResolvedValue(undefined);

			// Act
			await POST({ request: mockRequest, locals: mockLocals } as any);

			// Assert
			expect(aiAssistantManager.deactivateAssistant).toHaveBeenCalledWith(
				'test-user-123',
				matchId,
				'bestie'
			);
		});

		it('should handle deactivation when already deactivated', async () => {
			// Arrange
			mockRequest.json.mockResolvedValue({ matchId: 'match-123' });
			vi.spyOn(aiAssistantManager, 'deactivateAssistant').mockResolvedValue(undefined);

			// Act - Call deactivate twice
			await POST({ request: mockRequest, locals: mockLocals } as any);
			const response = await POST({ request: mockRequest, locals: mockLocals } as any);
			const data = await response.json();

			// Assert - Should still return success
			expect(data.success).toBe(true);
			expect(aiAssistantManager.deactivateAssistant).toHaveBeenCalledTimes(2);
		});

		it('should handle request with extra fields in body', async () => {
			// Arrange
			mockRequest.json.mockResolvedValue({
				matchId: 'match-123',
				extraField: 'should be ignored',
				anotherField: 123
			});
			vi.spyOn(aiAssistantManager, 'deactivateAssistant').mockResolvedValue(undefined);

			// Act
			const response = await POST({ request: mockRequest, locals: mockLocals } as any);
			const data = await response.json();

			// Assert
			expect(data.success).toBe(true);
			expect(aiAssistantManager.deactivateAssistant).toHaveBeenCalledWith(
				'test-user-123',
				'match-123',
				'bestie'
			);
		});
	});

	describe('Integration Scenarios', () => {
		it('should handle multiple concurrent deactivation requests', async () => {
			// Arrange
			mockLocals.auth.getSession.mockResolvedValue({
				user: { id: 'test-user-123' }
			});
			vi.spyOn(aiAssistantManager, 'deactivateAssistant').mockResolvedValue(undefined);

			const matchIds = ['match-1', 'match-2', 'match-3'];

			// Act
			const promises = matchIds.map((matchId) => {
				mockRequest.json.mockResolvedValue({ matchId });
				return POST({ request: mockRequest, locals: mockLocals } as any);
			});

			const responses = await Promise.all(promises);

			// Assert
			expect(responses).toHaveLength(3);
			responses.forEach((response) => {
				expect(response.status).toBe(200);
			});
		});

		it('should handle deactivation for different users', async () => {
			// Arrange
			vi.spyOn(aiAssistantManager, 'deactivateAssistant').mockResolvedValue(undefined);

			const userIds = ['user-1', 'user-2', 'user-3'];
			const matchId = 'match-123';

			// Act & Assert
			for (const userId of userIds) {
				mockLocals.auth.getSession.mockResolvedValue({
					user: { id: userId }
				});
				mockRequest.json.mockResolvedValue({ matchId });

				await POST({ request: mockRequest, locals: mockLocals } as any);

				expect(aiAssistantManager.deactivateAssistant).toHaveBeenCalledWith(
					userId,
					matchId,
					'bestie'
				);
			}
		});
	});
});
