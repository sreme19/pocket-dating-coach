import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { NotificationPayload } from './notifications';

/**
 * Unit tests for sendNotification function
 *
 * Validates: Requirements 6.5, 5.6
 * - Only sends to tokens that exist in storage
 * - On FCM delivery failure due to invalid token, removes token from database
 * - Returns success/failure status
 */

// Mock environment variables
vi.mock('$env/dynamic/private', () => ({
	env: {
		FCM_SERVER_KEY: 'test-fcm-server-key',
		SUPABASE_URL: 'https://test.supabase.co',
		SUPABASE_SERVICE_KEY: 'test-service-key'
	}
}));

// Mock Supabase with proper chaining
const mockMaybeSingle = vi.fn();
const mockDeleteEq = vi.fn();

vi.mock('$lib/server/supabase', () => ({
	getSupabase: () => ({
		from: (table: string) => ({
			select: (columns: string) => ({
				eq: (col: string, val: string) => ({
					maybeSingle: mockMaybeSingle
				})
			}),
			delete: () => ({
				eq: mockDeleteEq
			})
		})
	})
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Import after mocks are set up
const { sendNotification } = await import('./notifications');

const TEST_PAYLOAD: NotificationPayload = {
	to: 'valid-fcm-token-123',
	notification: {
		title: 'Test notification',
		body: 'This is a test'
	},
	data: {
		type: 'conversation_reminder'
	}
};

describe('sendNotification', () => {
	beforeEach(() => {
		vi.clearAllMocks();

		// Default: token exists in database
		mockMaybeSingle.mockResolvedValue({
			data: { id: 'token-id-1', token: 'valid-fcm-token-123' },
			error: null
		});

		// Default: delete succeeds
		mockDeleteEq.mockResolvedValue({ error: null });

		// Default: FCM returns success
		mockFetch.mockResolvedValue({
			ok: true,
			status: 200,
			json: () => Promise.resolve({
				multicast_id: 123456,
				success: 1,
				failure: 0,
				results: [{ message_id: 'msg-123' }]
			})
		});
	});

	describe('Successful delivery', () => {
		it('should return success when FCM delivers successfully', async () => {
			const result = await sendNotification(TEST_PAYLOAD);

			expect(result.success).toBe(true);
			expect(result.error).toBeUndefined();
			expect(result.tokenRemoved).toBeUndefined();
		});

		it('should send correct payload to FCM endpoint', async () => {
			await sendNotification(TEST_PAYLOAD);

			expect(mockFetch).toHaveBeenCalledWith(
				'https://fcm.googleapis.com/fcm/send',
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: 'key=test-fcm-server-key'
					},
					body: JSON.stringify(TEST_PAYLOAD)
				}
			);
		});

		it('should verify token exists in database before sending', async () => {
			await sendNotification(TEST_PAYLOAD);

			// mockMaybeSingle being called means the chain select().eq().maybeSingle() was invoked
			expect(mockMaybeSingle).toHaveBeenCalled();
		});
	});

	describe('Token validation', () => {
		it('should fail when token does not exist in database', async () => {
			mockMaybeSingle.mockResolvedValue({ data: null, error: null });

			const result = await sendNotification(TEST_PAYLOAD);

			expect(result.success).toBe(false);
			expect(result.error).toContain('Token does not exist in storage');
			expect(mockFetch).not.toHaveBeenCalled();
		});

		it('should fail when database lookup errors', async () => {
			mockMaybeSingle.mockResolvedValue({
				data: null,
				error: { message: 'Connection timeout' }
			});

			const result = await sendNotification(TEST_PAYLOAD);

			expect(result.success).toBe(false);
			expect(result.error).toContain('Failed to verify token in database');
			expect(mockFetch).not.toHaveBeenCalled();
		});
	});

	describe('Invalid token handling', () => {
		it('should remove token from database on NotRegistered error', async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				status: 200,
				json: () => Promise.resolve({
					multicast_id: 123456,
					success: 0,
					failure: 1,
					results: [{ error: 'NotRegistered' }]
				})
			});

			const result = await sendNotification(TEST_PAYLOAD);

			expect(result.success).toBe(false);
			expect(result.error).toContain('NotRegistered');
			expect(result.tokenRemoved).toBe(true);
			expect(mockDeleteEq).toHaveBeenCalledWith('token', 'valid-fcm-token-123');
		});

		it('should remove token from database on InvalidRegistration error', async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				status: 200,
				json: () => Promise.resolve({
					multicast_id: 123456,
					success: 0,
					failure: 1,
					results: [{ error: 'InvalidRegistration' }]
				})
			});

			const result = await sendNotification(TEST_PAYLOAD);

			expect(result.success).toBe(false);
			expect(result.tokenRemoved).toBe(true);
			expect(mockDeleteEq).toHaveBeenCalledWith('token', 'valid-fcm-token-123');
		});

		it('should remove token from database on MismatchSenderId error', async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				status: 200,
				json: () => Promise.resolve({
					multicast_id: 123456,
					success: 0,
					failure: 1,
					results: [{ error: 'MismatchSenderId' }]
				})
			});

			const result = await sendNotification(TEST_PAYLOAD);

			expect(result.success).toBe(false);
			expect(result.tokenRemoved).toBe(true);
		});

		it('should not remove token on non-invalid-token FCM errors', async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				status: 200,
				json: () => Promise.resolve({
					multicast_id: 123456,
					success: 0,
					failure: 1,
					results: [{ error: 'InternalServerError' }]
				})
			});

			const result = await sendNotification(TEST_PAYLOAD);

			expect(result.success).toBe(false);
			expect(result.error).toContain('InternalServerError');
			expect(result.tokenRemoved).toBeUndefined();
			expect(mockDeleteEq).not.toHaveBeenCalled();
		});
	});

	describe('FCM API errors', () => {
		it('should fail when FCM returns non-OK HTTP status', async () => {
			mockFetch.mockResolvedValue({
				ok: false,
				status: 401,
				statusText: 'Unauthorized'
			});

			const result = await sendNotification(TEST_PAYLOAD);

			expect(result.success).toBe(false);
			expect(result.error).toContain('HTTP 401');
		});

		it('should fail when fetch throws a network error', async () => {
			mockFetch.mockRejectedValue(new Error('Network unreachable'));

			const result = await sendNotification(TEST_PAYLOAD);

			expect(result.success).toBe(false);
			expect(result.error).toContain('Network unreachable');
		});

		it('should fail when FCM response is not valid JSON', async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				status: 200,
				json: () => Promise.reject(new Error('Invalid JSON'))
			});

			const result = await sendNotification(TEST_PAYLOAD);

			expect(result.success).toBe(false);
			expect(result.error).toContain('Failed to parse FCM response');
		});
	});
});
