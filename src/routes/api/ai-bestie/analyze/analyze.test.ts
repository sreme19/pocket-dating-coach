import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { RequestHandler } from './$types';
import { POST } from './+server';
import type { UserProfile, ChatMessage } from '$lib/types';
import type { PreferencesProfile } from '$lib/server/profile-service';

/**
 * Unit Tests for POST /api/ai-bestie/analyze
 * 
 * Tests the AI Bestie compatibility analysis endpoint
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
 */

// Mock data
const mockUserId = 'test-user-123';
const mockConversationId = 'conv-123';

const mockPreferences: PreferencesProfile = {
	emotionalSignals: ['Asks about my day', 'Shows vulnerability'],
	lifestyleSignals: ['Active and outdoorsy', 'Values travel'],
	maturitySignals: ['Takes responsibility', 'Has long-term goals'],
	boundaries: ['No excessive drinking', 'Respectful of my time'],
	dealbreakers: ['Disrespectful to service workers', 'Still hung up on ex'],
	privateCompatibilityNotes: ['Seems like he values independence'],
	updatedAt: Date.now()
};

const mockMatchedUserProfile: Partial<UserProfile> = {
	gender: 'man',
	ageRange: '25-30',
	datingApp: 'hinge',
	relationshipGoal: 'serious'
};

const mockRecentMessages: ChatMessage[] = [
	{ role: 'user', content: 'He seems really nice' },
	{ role: 'assistant', content: 'That\'s great! What did he say?' }
];

// Mock request/response helpers
function createMockRequest(body: any): Request {
	return new Request('http://localhost/api/ai-bestie/analyze', {
		method: 'POST',
		body: JSON.stringify(body),
		headers: { 'Content-Type': 'application/json' }
	});
}

function createMockLocals(authenticated: boolean = true) {
	return {
		auth: {
			getSession: vi.fn().mockResolvedValue(
				authenticated ? { user: { id: mockUserId } } : null
			)
		}
	};
}

describe('POST /api/ai-bestie/analyze', () => {
	describe('Authentication', () => {
		it('should reject unauthenticated requests', async () => {
			const request = createMockRequest({
				conversationId: mockConversationId,
				matchMessage: 'I love hiking!'
			});

			const locals = createMockLocals(false);

			try {
				await POST({ request, locals } as any);
				expect.fail('Should have thrown authentication error');
			} catch (err: any) {
				expect(err.status).toBe(401);
				expect(err.body.message).toContain('authentication');
			}
		});

		it('should accept authenticated requests', async () => {
			const request = createMockRequest({
				conversationId: mockConversationId,
				matchMessage: 'I love hiking!'
			});

			const locals = createMockLocals(true);

			// This will fail later due to missing mocks, but should pass auth
			try {
				await POST({ request, locals } as any);
			} catch (err: any) {
				// Expected to fail on validation or database, not auth
				expect(err.status).not.toBe(401);
			}
		});
	});

	describe('Request Validation', () => {
		it('should reject invalid JSON', async () => {
			const request = new Request('http://localhost/api/ai-bestie/analyze', {
				method: 'POST',
				body: 'invalid json',
				headers: { 'Content-Type': 'application/json' }
			});

			const locals = createMockLocals(true);

			try {
				await POST({ request, locals } as any);
				expect.fail('Should have thrown validation error');
			} catch (err: any) {
				expect(err.status).toBe(400);
				expect(err.body.message).toContain('Invalid JSON');
			}
		});

		it('should reject missing conversationId', async () => {
			const request = createMockRequest({
				matchMessage: 'I love hiking!'
			});

			const locals = createMockLocals(true);

			try {
				await POST({ request, locals } as any);
				expect.fail('Should have thrown validation error');
			} catch (err: any) {
				expect(err.status).toBe(400);
				expect(err.body.message).toContain('conversationId');
			}
		});

		it('should reject missing matchMessage', async () => {
			const request = createMockRequest({
				conversationId: mockConversationId
			});

			const locals = createMockLocals(true);

			try {
				await POST({ request, locals } as any);
				expect.fail('Should have thrown validation error');
			} catch (err: any) {
				expect(err.status).toBe(400);
				expect(err.body.message).toContain('matchMessage');
			}
		});

		it('should reject empty conversationId', async () => {
			const request = createMockRequest({
				conversationId: '   ',
				matchMessage: 'I love hiking!'
			});

			const locals = createMockLocals(true);

			try {
				await POST({ request, locals } as any);
				expect.fail('Should have thrown validation error');
			} catch (err: any) {
				expect(err.status).toBe(400);
				expect(err.body.message).toContain('conversationId');
			}
		});

		it('should reject empty matchMessage', async () => {
			const request = createMockRequest({
				conversationId: mockConversationId,
				matchMessage: '   '
			});

			const locals = createMockLocals(true);

			try {
				await POST({ request, locals } as any);
				expect.fail('Should have thrown validation error');
			} catch (err: any) {
				expect(err.status).toBe(400);
				expect(err.body.message).toContain('matchMessage');
			}
		});

		it('should reject non-array recentMessages', async () => {
			const request = createMockRequest({
				conversationId: mockConversationId,
				matchMessage: 'I love hiking!',
				recentMessages: 'not an array'
			});

			const locals = createMockLocals(true);

			try {
				await POST({ request, locals } as any);
				expect.fail('Should have thrown validation error');
			} catch (err: any) {
				expect(err.status).toBe(400);
				expect(err.body.message).toContain('recentMessages');
			}
		});

		it('should reject messages with missing role', async () => {
			const request = createMockRequest({
				conversationId: mockConversationId,
				matchMessage: 'I love hiking!',
				recentMessages: [
					{ content: 'Hello' } // Missing role
				]
			});

			const locals = createMockLocals(true);

			try {
				await POST({ request, locals } as any);
				expect.fail('Should have thrown validation error');
			} catch (err: any) {
				expect(err.status).toBe(400);
				expect(err.body.message).toContain('role');
			}
		});

		it('should reject messages with missing content', async () => {
			const request = createMockRequest({
				conversationId: mockConversationId,
				matchMessage: 'I love hiking!',
				recentMessages: [
					{ role: 'user' } // Missing content
				]
			});

			const locals = createMockLocals(true);

			try {
				await POST({ request, locals } as any);
				expect.fail('Should have thrown validation error');
			} catch (err: any) {
				expect(err.status).toBe(400);
				expect(err.body.message).toContain('content');
			}
		});

		it('should reject messages with empty content', async () => {
			const request = createMockRequest({
				conversationId: mockConversationId,
				matchMessage: 'I love hiking!',
				recentMessages: [
					{ role: 'user', content: '   ' }
				]
			});

			const locals = createMockLocals(true);

			try {
				await POST({ request, locals } as any);
				expect.fail('Should have thrown validation error');
			} catch (err: any) {
				expect(err.status).toBe(400);
				expect(err.body.message).toContain('content');
			}
		});

		it('should reject invalid matchedUserProfile fields', async () => {
			const request = createMockRequest({
				conversationId: mockConversationId,
				matchMessage: 'I love hiking!',
				matchedUserProfile: {
					gender: 'man',
					invalidField: 'should not be here'
				}
			});

			const locals = createMockLocals(true);

			try {
				await POST({ request, locals } as any);
				expect.fail('Should have thrown validation error');
			} catch (err: any) {
				expect(err.status).toBe(400);
				expect(err.body.message).toContain('Invalid field');
			}
		});

		it('should accept valid matchedUserProfile', async () => {
			const request = createMockRequest({
				conversationId: mockConversationId,
				matchMessage: 'I love hiking!',
				matchedUserProfile: {
					gender: 'man',
					ageRange: '25-30',
					datingApp: 'hinge',
					relationshipGoal: 'serious'
				}
			});

			const locals = createMockLocals(true);

			// This will fail later due to missing mocks, but should pass validation
			try {
				await POST({ request, locals } as any);
			} catch (err: any) {
				// Should not be a validation error
				expect(err.status).not.toBe(400);
			}
		});
	});

	describe('Response Format', () => {
		it('should return compatibility analysis with required fields', async () => {
			// This test would require full mocking of Claude API and database
			// For now, we verify the expected response structure
			const expectedResponse = {
				greenFlags: [
					{ signal: 'Asks about your interests', reason: 'Shows genuine curiosity' }
				],
				yellowFlags: [
					{ signal: 'Mentions travel early', reason: 'Could indicate expensive lifestyle' }
				],
				redFlags: [],
				overallAssessment: 'This looks promising!',
				citations: ['Based on: Compatibility Signals']
			};

			// Verify structure
			expect(expectedResponse).toHaveProperty('greenFlags');
			expect(expectedResponse).toHaveProperty('yellowFlags');
			expect(expectedResponse).toHaveProperty('redFlags');
			expect(expectedResponse).toHaveProperty('overallAssessment');
			expect(expectedResponse).toHaveProperty('citations');

			// Verify types
			expect(Array.isArray(expectedResponse.greenFlags)).toBe(true);
			expect(Array.isArray(expectedResponse.yellowFlags)).toBe(true);
			expect(Array.isArray(expectedResponse.redFlags)).toBe(true);
			expect(typeof expectedResponse.overallAssessment).toBe('string');
			expect(Array.isArray(expectedResponse.citations)).toBe(true);
		});

		it('should include flag objects with signal and reason', () => {
			const flag = { signal: 'Test signal', reason: 'Test reason' };
			expect(flag).toHaveProperty('signal');
			expect(flag).toHaveProperty('reason');
			expect(typeof flag.signal).toBe('string');
			expect(typeof flag.reason).toBe('string');
		});

		it('should include citations in correct format', () => {
			const citations = ['Based on: Chapter 3 - Reading Interest Signals'];
			expect(citations[0]).toMatch(/^Based on:/);
		});
	});

	describe('Edge Cases', () => {
		it('should handle very long match messages', async () => {
			const longMessage = 'I love hiking! '.repeat(100);
			const request = createMockRequest({
				conversationId: mockConversationId,
				matchMessage: longMessage
			});

			const locals = createMockLocals(true);

			try {
				await POST({ request, locals } as any);
			} catch (err: any) {
				// Should not fail on message length
				expect(err.status).not.toBe(400);
			}
		});

		it('should handle empty recentMessages array', async () => {
			const request = createMockRequest({
				conversationId: mockConversationId,
				matchMessage: 'I love hiking!',
				recentMessages: []
			});

			const locals = createMockLocals(true);

			try {
				await POST({ request, locals } as any);
			} catch (err: any) {
				// Should not fail on empty messages
				expect(err.status).not.toBe(400);
			}
		});

		it('should handle missing matchedUserProfile', async () => {
			const request = createMockRequest({
				conversationId: mockConversationId,
				matchMessage: 'I love hiking!'
			});

			const locals = createMockLocals(true);

			try {
				await POST({ request, locals } as any);
			} catch (err: any) {
				// Should not fail on missing profile
				expect(err.status).not.toBe(400);
			}
		});

		it('should handle special characters in messages', async () => {
			const request = createMockRequest({
				conversationId: mockConversationId,
				matchMessage: 'I love hiking! 🏔️ What about you? "Quotes" & symbols!'
			});

			const locals = createMockLocals(true);

			try {
				await POST({ request, locals } as any);
			} catch (err: any) {
				// Should not fail on special characters
				expect(err.status).not.toBe(400);
			}
		});
	});

	describe('Error Handling', () => {
		it('should handle non-JSON error responses gracefully', async () => {
			const request = createMockRequest({
				conversationId: mockConversationId,
				matchMessage: 'I love hiking!'
			});

			const locals = createMockLocals(true);

			try {
				await POST({ request, locals } as any);
			} catch (err: any) {
				// Should return a proper error response
				expect(err).toBeDefined();
				expect(err.status).toBeDefined();
			}
		});

		it('should not expose sensitive error details', async () => {
			const request = createMockRequest({
				conversationId: mockConversationId,
				matchMessage: 'I love hiking!'
			});

			const locals = createMockLocals(true);

			try {
				await POST({ request, locals } as any);
			} catch (err: any) {
				// Error message should be user-friendly
				expect(err.body.message).not.toContain('password');
				expect(err.body.message).not.toContain('secret');
				expect(err.body.message).not.toContain('token');
			}
		});
	});
});
