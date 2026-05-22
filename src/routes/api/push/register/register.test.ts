import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from './+server';

/**
 * Unit tests for POST /api/push/register endpoint
 *
 * Validates: Requirements 5.3, 5.4, 5.5
 * - Register device token with valid session
 * - Reject unauthenticated requests (401)
 * - Reject invalid payload (400)
 * - Upsert behavior (replace existing token for same userId + platform)
 */

// Mock Supabase
const mockUpsert = vi.fn();
const mockFrom = vi.fn(() => ({
	upsert: mockUpsert
}));

vi.mock('$lib/server/supabase', () => ({
	getSupabase: () => ({
		from: mockFrom
	})
}));

describe('POST /api/push/register', () => {
	let mockLocals: any;

	beforeEach(() => {
		vi.clearAllMocks();

		mockLocals = {
			auth: {
				getSession: vi.fn()
			}
		};

		// Default: successful upsert
		mockUpsert.mockResolvedValue({ error: null });
	});

	function createRequest(body: unknown): Request {
		return new Request('http://localhost/api/push/register', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});
	}

	describe('Authentication', () => {
		it('should return 401 when session is null', async () => {
			mockLocals.auth.getSession.mockResolvedValue(null);

			const request = createRequest({ token: 'fcm-token-123', platform: 'android' });

			await expect(
				POST({ request, locals: mockLocals } as any)
			).rejects.toMatchObject({ status: 401 });
		});

		it('should return 401 when session has no user', async () => {
			mockLocals.auth.getSession.mockResolvedValue({ user: null });

			const request = createRequest({ token: 'fcm-token-123', platform: 'android' });

			await expect(
				POST({ request, locals: mockLocals } as any)
			).rejects.toMatchObject({ status: 401 });
		});

		it('should return 401 when session user has no id', async () => {
			mockLocals.auth.getSession.mockResolvedValue({ user: {} });

			const request = createRequest({ token: 'fcm-token-123', platform: 'android' });

			await expect(
				POST({ request, locals: mockLocals } as any)
			).rejects.toMatchObject({ status: 401 });
		});
	});

	describe('Payload Validation', () => {
		beforeEach(() => {
			mockLocals.auth.getSession.mockResolvedValue({
				user: { id: 'user-123' }
			});
		});

		it('should return 400 when token is missing', async () => {
			const request = createRequest({ platform: 'android' });

			await expect(
				POST({ request, locals: mockLocals } as any)
			).rejects.toMatchObject({ status: 400 });
		});

		it('should return 400 when token is empty string', async () => {
			const request = createRequest({ token: '', platform: 'android' });

			await expect(
				POST({ request, locals: mockLocals } as any)
			).rejects.toMatchObject({ status: 400 });
		});

		it('should return 400 when token is whitespace only', async () => {
			const request = createRequest({ token: '   ', platform: 'android' });

			await expect(
				POST({ request, locals: mockLocals } as any)
			).rejects.toMatchObject({ status: 400 });
		});

		it('should return 400 when token exceeds 256 characters', async () => {
			const longToken = 'a'.repeat(257);
			const request = createRequest({ token: longToken, platform: 'android' });

			await expect(
				POST({ request, locals: mockLocals } as any)
			).rejects.toMatchObject({ status: 400 });
		});

		it('should return 400 when platform is missing', async () => {
			const request = createRequest({ token: 'fcm-token-123' });

			await expect(
				POST({ request, locals: mockLocals } as any)
			).rejects.toMatchObject({ status: 400 });
		});

		it('should return 400 when platform is invalid', async () => {
			const request = createRequest({ token: 'fcm-token-123', platform: 'windows' });

			await expect(
				POST({ request, locals: mockLocals } as any)
			).rejects.toMatchObject({ status: 400 });
		});

		it('should return 400 when body is invalid JSON', async () => {
			const request = new Request('http://localhost/api/push/register', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: 'not-json'
			});

			await expect(
				POST({ request, locals: mockLocals } as any)
			).rejects.toMatchObject({ status: 400 });
		});
	});

	describe('Successful Registration', () => {
		beforeEach(() => {
			mockLocals.auth.getSession.mockResolvedValue({
				user: { id: 'user-123' }
			});
		});

		it('should return 200 on successful token registration for android', async () => {
			const request = createRequest({ token: 'fcm-token-abc', platform: 'android' });

			const response = await POST({ request, locals: mockLocals } as any);

			expect(response.status).toBe(200);
			const data = await response.json();
			expect(data).toEqual({ success: true });
		});

		it('should return 200 on successful token registration for ios', async () => {
			const request = createRequest({ token: 'apns-token-xyz', platform: 'ios' });

			const response = await POST({ request, locals: mockLocals } as any);

			expect(response.status).toBe(200);
			const data = await response.json();
			expect(data).toEqual({ success: true });
		});

		it('should upsert with correct parameters', async () => {
			const request = createRequest({ token: 'fcm-token-abc', platform: 'android' });

			await POST({ request, locals: mockLocals } as any);

			expect(mockFrom).toHaveBeenCalledWith('device_tokens');
			expect(mockUpsert).toHaveBeenCalledWith(
				expect.objectContaining({
					user_id: 'user-123',
					token: 'fcm-token-abc',
					platform: 'android'
				}),
				{ onConflict: 'user_id,platform' }
			);
		});

		it('should trim whitespace from token', async () => {
			const request = createRequest({ token: '  fcm-token-abc  ', platform: 'android' });

			await POST({ request, locals: mockLocals } as any);

			expect(mockUpsert).toHaveBeenCalledWith(
				expect.objectContaining({
					token: 'fcm-token-abc'
				}),
				expect.any(Object)
			);
		});

		it('should include created_at timestamp in upsert', async () => {
			const request = createRequest({ token: 'fcm-token-abc', platform: 'android' });

			await POST({ request, locals: mockLocals } as any);

			expect(mockUpsert).toHaveBeenCalledWith(
				expect.objectContaining({
					created_at: expect.any(String)
				}),
				expect.any(Object)
			);
		});
	});

	describe('Database Errors', () => {
		beforeEach(() => {
			mockLocals.auth.getSession.mockResolvedValue({
				user: { id: 'user-123' }
			});
		});

		it('should return 500 when database upsert fails', async () => {
			mockUpsert.mockResolvedValue({ error: { message: 'DB error', code: '42P01' } });

			const request = createRequest({ token: 'fcm-token-abc', platform: 'android' });

			await expect(
				POST({ request, locals: mockLocals } as any)
			).rejects.toMatchObject({ status: 500 });
		});
	});
});
