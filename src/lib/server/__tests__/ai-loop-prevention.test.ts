import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	canContinue,
	recordExchange,
	getExchangeCount,
	resetExchangeCounter,
	areBothAssistantsActive,
	getMaxExchangesPerSide,
	hasReachedExchangeLimit,
	getRemainingExchanges,
	type ExchangeCount
} from '../ai-loop-prevention';
import * as aiAssistantManager from '../ai-assistant-manager';
import { getSupabase } from '../supabase';

/**
 * Unit Tests for AI Loop Prevention Module
 *
 * These tests verify that the AI Loop Prevention module correctly:
 * 1. Checks if conversation can continue
 * 2. Records exchanges for each assistant
 * 3. Retrieves exchange counts
 * 4. Resets exchange counters
 * 5. Detects when both assistants are active
 * 6. Enforces max 10 exchanges per side
 *
 * **Validates: Requirements 11.1, 11.2, 11.3**
 */

// Mock data
const TEST_USER_ID = 'test-user-123';
const TEST_MATCH_ID = 'match-456';

// Mock Supabase
vi.mock('../supabase', () => ({
	getSupabase: vi.fn()
}));

// Mock AI Assistant Manager
vi.mock('../ai-assistant-manager', () => ({
	getAssistantConfig: vi.fn()
}));

describe('AI Loop Prevention Module', () => {
	let mockSupabase: any;

	beforeEach(() => {
		mockSupabase = {
			from: vi.fn()
		};
		(getSupabase as any).mockReturnValue(mockSupabase);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('canContinue()', () => {
		it('should return true when only one assistant is active', async () => {
			// Mock: only bestie is active
			const mockSelect = vi.fn().mockReturnThis();
			const mockEq1 = vi.fn().mockReturnThis();
			const mockEq2 = vi.fn().mockResolvedValue({
				data: [{ assistant_type: 'bestie', is_active: true }],
				error: null
			});

			mockSupabase.from.mockReturnValue({
				select: mockSelect,
				eq: mockEq1
			});

			mockEq1.mockReturnValue({
				eq: mockEq2
			});

			const result = await canContinue(TEST_USER_ID, TEST_MATCH_ID, 'bestie');
			expect(result).toBe(true);
		});

		it('should return true when both assistants are active but under limit', async () => {
			// Mock: both assistants active with low exchange counts
			const mockSelect = vi.fn().mockReturnThis();
			const mockEq1 = vi.fn().mockReturnThis();
			const mockEq2 = vi.fn().mockReturnThis();
			const mockEq3 = vi.fn().mockResolvedValue({
				data: [
					{ assistant_type: 'bestie', exchange_count: 5, last_exchange_at: null },
					{ assistant_type: 'wingman', exchange_count: 3, last_exchange_at: null }
				],
				error: null
			});

			mockSupabase.from.mockReturnValue({
				select: mockSelect,
				eq: mockEq1
			});

			let callCount = 0;
			mockEq1.mockImplementation(() => {
				callCount++;
				if (callCount === 1) {
					return {
						eq: vi.fn().mockResolvedValue({
							data: [
								{ assistant_type: 'bestie', is_active: true },
								{ assistant_type: 'wingman', is_active: true }
							],
							error: null
						})
					};
				} else {
					return {
						eq: mockEq3
					};
				}
			});

			const result = await canContinue(TEST_USER_ID, TEST_MATCH_ID, 'bestie');
			expect(result).toBe(true);
		});

		it('should return false when bestie has reached limit and both active', async () => {
			// Mock: both assistants active, bestie at limit
			const mockSelect = vi.fn().mockReturnThis();
			const mockEq1 = vi.fn().mockReturnThis();

			mockSupabase.from.mockReturnValue({
				select: mockSelect,
				eq: mockEq1
			});

			let callCount = 0;
			mockEq1.mockImplementation(() => {
				callCount++;
				if (callCount === 1) {
					return {
						eq: vi.fn().mockResolvedValue({
							data: [
								{ assistant_type: 'bestie', is_active: true },
								{ assistant_type: 'wingman', is_active: true }
							],
							error: null
						})
					};
				} else {
					return {
						eq: vi.fn().mockResolvedValue({
							data: [
								{ assistant_type: 'bestie', exchange_count: 10, last_exchange_at: null },
								{ assistant_type: 'wingman', exchange_count: 5, last_exchange_at: null }
							],
							error: null
						})
					};
				}
			});

			const result = await canContinue(TEST_USER_ID, TEST_MATCH_ID, 'bestie');
			expect(result).toBe(false);
		});

		it('should return false when wingman has reached limit and both active', async () => {
			// Mock: both assistants active, wingman at limit
			const mockSelect = vi.fn().mockReturnThis();
			const mockEq1 = vi.fn().mockReturnThis();

			mockSupabase.from.mockReturnValue({
				select: mockSelect,
				eq: mockEq1
			});

			let callCount = 0;
			mockEq1.mockImplementation(() => {
				callCount++;
				if (callCount === 1) {
					return {
						eq: vi.fn().mockResolvedValue({
							data: [
								{ assistant_type: 'bestie', is_active: true },
								{ assistant_type: 'wingman', is_active: true }
							],
							error: null
						})
					};
				} else {
					return {
						eq: vi.fn().mockResolvedValue({
							data: [
								{ assistant_type: 'bestie', exchange_count: 5, last_exchange_at: null },
								{ assistant_type: 'wingman', exchange_count: 10, last_exchange_at: null }
							],
							error: null
						})
					};
				}
			});

			const result = await canContinue(TEST_USER_ID, TEST_MATCH_ID, 'wingman');
			expect(result).toBe(false);
		});

		it('should return true on error to avoid blocking user', async () => {
			mockSupabase.from.mockReturnValue({
				select: vi.fn().mockReturnThis(),
				eq: vi.fn().mockRejectedValue(new Error('Database error'))
			});

			const result = await canContinue(TEST_USER_ID, TEST_MATCH_ID, 'bestie');
			expect(result).toBe(true);
		});
	});

	describe('recordExchange()', () => {
		it('should increment exchange count', async () => {
			const mockConfig = {
				id: 'config-123',
				exchangeCount: 5
			};

			(aiAssistantManager.getAssistantConfig as any).mockResolvedValue(mockConfig);

			const mockUpdate = vi.fn().mockReturnThis();
			const mockEq = vi.fn().mockResolvedValue({ error: null });

			mockSupabase.from.mockReturnValue({
				update: mockUpdate,
				eq: mockEq
			});

			await recordExchange(TEST_USER_ID, TEST_MATCH_ID, 'bestie');

			expect(mockUpdate).toHaveBeenCalledWith(
				expect.objectContaining({
					exchange_count: 6
				})
			);
		});

		it('should update last_exchange_at timestamp', async () => {
			const mockConfig = {
				id: 'config-123',
				exchangeCount: 5
			};

			(aiAssistantManager.getAssistantConfig as any).mockResolvedValue(mockConfig);

			const mockUpdate = vi.fn().mockReturnThis();
			const mockEq = vi.fn().mockResolvedValue({ error: null });

			mockSupabase.from.mockReturnValue({
				update: mockUpdate,
				eq: mockEq
			});

			await recordExchange(TEST_USER_ID, TEST_MATCH_ID, 'bestie');

			expect(mockUpdate).toHaveBeenCalledWith(
				expect.objectContaining({
					last_exchange_at: expect.any(String)
				})
			);
		});

		it('should throw error if config not found', async () => {
			(aiAssistantManager.getAssistantConfig as any).mockResolvedValue(null);

			await expect(recordExchange(TEST_USER_ID, TEST_MATCH_ID, 'bestie')).rejects.toThrow(
				'Assistant config not found'
			);
		});

		it('should throw error if database update fails', async () => {
			const mockConfig = {
				id: 'config-123',
				exchangeCount: 5
			};

			(aiAssistantManager.getAssistantConfig as any).mockResolvedValue(mockConfig);

			const mockUpdate = vi.fn().mockReturnThis();
			const mockEq = vi.fn().mockResolvedValue({ error: { message: 'Update failed' } });

			mockSupabase.from.mockReturnValue({
				update: mockUpdate,
				eq: mockEq
			});

			await expect(recordExchange(TEST_USER_ID, TEST_MATCH_ID, 'bestie')).rejects.toThrow(
				'Failed to record exchange'
			);
		});
	});

	describe('getExchangeCount()', () => {
		it('should return exchange counts for both assistants', async () => {
			const mockData = [
				{ assistant_type: 'bestie', exchange_count: 5, last_exchange_at: '2024-01-01T00:00:00Z' },
				{ assistant_type: 'wingman', exchange_count: 3, last_exchange_at: '2024-01-01T00:00:00Z' }
			];

			const mockSelect = vi.fn().mockReturnThis();
			const mockEq1 = vi.fn().mockReturnThis();
			const mockEq2 = vi.fn().mockResolvedValue({ data: mockData, error: null });

			mockSupabase.from.mockReturnValue({
				select: mockSelect,
				eq: mockEq1
			});

			mockEq1.mockReturnValue({
				eq: mockEq2
			});

			const result = await getExchangeCount(TEST_USER_ID, TEST_MATCH_ID);

			expect(result.bestieExchanges).toBe(5);
			expect(result.wingmanExchanges).toBe(3);
			expect(result.lastBestieExchange).toBeDefined();
			expect(result.lastWingmanExchange).toBeDefined();
		});

		it('should return zero counts if no data found', async () => {
			const mockSelect = vi.fn().mockReturnThis();
			const mockEq = vi.fn().mockReturnThis();

			mockSupabase.from.mockReturnValue({
				select: mockSelect,
				eq: mockEq
			});

			mockEq.mockResolvedValue({ data: [], error: null });

			const result = await getExchangeCount(TEST_USER_ID, TEST_MATCH_ID);

			expect(result.bestieExchanges).toBe(0);
			expect(result.wingmanExchanges).toBe(0);
			expect(result.lastBestieExchange).toBeNull();
			expect(result.lastWingmanExchange).toBeNull();
		});

		it('should return zero counts on error', async () => {
			const mockSelect = vi.fn().mockReturnThis();
			const mockEq = vi.fn().mockRejectedValue(new Error('Database error'));

			mockSupabase.from.mockReturnValue({
				select: mockSelect,
				eq: mockEq
			});

			const result = await getExchangeCount(TEST_USER_ID, TEST_MATCH_ID);

			expect(result.bestieExchanges).toBe(0);
			expect(result.wingmanExchanges).toBe(0);
		});

		it('should handle null last_exchange_at', async () => {
			const mockData = [
				{ assistant_type: 'bestie', exchange_count: 5, last_exchange_at: null },
				{ assistant_type: 'wingman', exchange_count: 3, last_exchange_at: null }
			];

			const mockSelect = vi.fn().mockReturnThis();
			const mockEq = vi.fn().mockReturnThis();

			mockSupabase.from.mockReturnValue({
				select: mockSelect,
				eq: mockEq
			});

			mockEq.mockResolvedValue({ data: mockData, error: null });

			const result = await getExchangeCount(TEST_USER_ID, TEST_MATCH_ID);

			expect(result.lastBestieExchange).toBeNull();
			expect(result.lastWingmanExchange).toBeNull();
		});
	});

	describe('resetExchangeCounter()', () => {
		it('should reset exchange count to zero', async () => {
			const mockConfig = {
				id: 'config-123',
				exchangeCount: 10
			};

			(aiAssistantManager.getAssistantConfig as any).mockResolvedValue(mockConfig);

			const mockUpdate = vi.fn().mockReturnThis();
			const mockEq = vi.fn().mockResolvedValue({ error: null });

			mockSupabase.from.mockReturnValue({
				update: mockUpdate,
				eq: mockEq
			});

			await resetExchangeCounter(TEST_USER_ID, TEST_MATCH_ID, 'bestie');

			expect(mockUpdate).toHaveBeenCalledWith(
				expect.objectContaining({
					exchange_count: 0,
					last_exchange_at: null
				})
			);
		});

		it('should throw error if config not found', async () => {
			(aiAssistantManager.getAssistantConfig as any).mockResolvedValue(null);

			await expect(resetExchangeCounter(TEST_USER_ID, TEST_MATCH_ID, 'bestie')).rejects.toThrow(
				'Assistant config not found'
			);
		});

		it('should throw error if database update fails', async () => {
			const mockConfig = {
				id: 'config-123',
				exchangeCount: 10
			};

			(aiAssistantManager.getAssistantConfig as any).mockResolvedValue(mockConfig);

			const mockUpdate = vi.fn().mockReturnThis();
			const mockEq = vi.fn().mockResolvedValue({ error: { message: 'Update failed' } });

			mockSupabase.from.mockReturnValue({
				update: mockUpdate,
				eq: mockEq
			});

			await expect(resetExchangeCounter(TEST_USER_ID, TEST_MATCH_ID, 'bestie')).rejects.toThrow(
				'Failed to reset exchange counter'
			);
		});
	});

	describe('areBothAssistantsActive()', () => {
		it('should return true when both assistants are active', async () => {
			const mockData = [
				{ assistant_type: 'bestie', is_active: true },
				{ assistant_type: 'wingman', is_active: true }
			];

			const mockSelect = vi.fn().mockReturnThis();
			const mockEq1 = vi.fn().mockReturnThis();
			const mockEq2 = vi.fn().mockResolvedValue({ data: mockData, error: null });

			mockSupabase.from.mockReturnValue({
				select: mockSelect,
				eq: mockEq1
			});

			mockEq1.mockReturnValue({
				eq: mockEq2
			});

			const result = await areBothAssistantsActive(TEST_USER_ID, TEST_MATCH_ID);
			expect(result).toBe(true);
		});

		it('should return false when only bestie is active', async () => {
			const mockData = [{ assistant_type: 'bestie', is_active: true }];

			const mockSelect = vi.fn().mockReturnThis();
			const mockEq = vi.fn().mockReturnThis();

			mockSupabase.from.mockReturnValue({
				select: mockSelect,
				eq: mockEq
			});

			mockEq.mockResolvedValue({ data: mockData, error: null });

			const result = await areBothAssistantsActive(TEST_USER_ID, TEST_MATCH_ID);
			expect(result).toBe(false);
		});

		it('should return false when only wingman is active', async () => {
			const mockData = [{ assistant_type: 'wingman', is_active: true }];

			const mockSelect = vi.fn().mockReturnThis();
			const mockEq = vi.fn().mockReturnThis();

			mockSupabase.from.mockReturnValue({
				select: mockSelect,
				eq: mockEq
			});

			mockEq.mockResolvedValue({ data: mockData, error: null });

			const result = await areBothAssistantsActive(TEST_USER_ID, TEST_MATCH_ID);
			expect(result).toBe(false);
		});

		it('should return false when both are inactive', async () => {
			const mockData = [
				{ assistant_type: 'bestie', is_active: false },
				{ assistant_type: 'wingman', is_active: false }
			];

			const mockSelect = vi.fn().mockReturnThis();
			const mockEq = vi.fn().mockReturnThis();

			mockSupabase.from.mockReturnValue({
				select: mockSelect,
				eq: mockEq
			});

			mockEq.mockResolvedValue({ data: mockData, error: null });

			const result = await areBothAssistantsActive(TEST_USER_ID, TEST_MATCH_ID);
			expect(result).toBe(false);
		});

		it('should return false when no data found', async () => {
			const mockSelect = vi.fn().mockReturnThis();
			const mockEq = vi.fn().mockReturnThis();

			mockSupabase.from.mockReturnValue({
				select: mockSelect,
				eq: mockEq
			});

			mockEq.mockResolvedValue({ data: [], error: null });

			const result = await areBothAssistantsActive(TEST_USER_ID, TEST_MATCH_ID);
			expect(result).toBe(false);
		});

		it('should return false on error', async () => {
			const mockSelect = vi.fn().mockReturnThis();
			const mockEq = vi.fn().mockRejectedValue(new Error('Database error'));

			mockSupabase.from.mockReturnValue({
				select: mockSelect,
				eq: mockEq
			});

			const result = await areBothAssistantsActive(TEST_USER_ID, TEST_MATCH_ID);
			expect(result).toBe(false);
		});
	});

	describe('getMaxExchangesPerSide()', () => {
		it('should return 10', () => {
			const max = getMaxExchangesPerSide();
			expect(max).toBe(10);
		});
	});

	describe('hasReachedExchangeLimit()', () => {
		it('should return false when only one assistant is active', async () => {
			const mockSelect = vi.fn().mockReturnThis();
			const mockEq1 = vi.fn().mockReturnThis();
			const mockEq2 = vi.fn().mockResolvedValue({
				data: [{ assistant_type: 'bestie', is_active: true }],
				error: null
			});

			mockSupabase.from.mockReturnValue({
				select: mockSelect,
				eq: mockEq1
			});

			mockEq1.mockReturnValue({
				eq: mockEq2
			});

			const result = await hasReachedExchangeLimit(TEST_USER_ID, TEST_MATCH_ID, 'bestie');
			expect(result).toBe(false);
		});

		it('should return true when bestie has reached limit and both active', async () => {
			const mockSelect = vi.fn().mockReturnThis();
			const mockEq1 = vi.fn().mockReturnThis();
			const mockEq2 = vi.fn().mockReturnThis();
			const mockEq3 = vi.fn().mockResolvedValue({
				data: [
					{ assistant_type: 'bestie', exchange_count: 10, last_exchange_at: null },
					{ assistant_type: 'wingman', exchange_count: 5, last_exchange_at: null }
				],
				error: null
			});

			mockSupabase.from.mockReturnValue({
				select: mockSelect,
				eq: mockEq1
			});

			mockEq1.mockReturnValue({
				eq: mockEq2
			});

			mockEq2.mockReturnValue({
				eq: mockEq3
			});

			// Mock the first call to check if both active
			let callCount = 0;
			mockEq1.mockImplementation(() => {
				callCount++;
				if (callCount === 1) {
					return {
						eq: vi.fn().mockResolvedValue({
							data: [
								{ assistant_type: 'bestie', is_active: true },
								{ assistant_type: 'wingman', is_active: true }
							],
							error: null
						})
					};
				}
				return {
					eq: mockEq3
				};
			});

			const result = await hasReachedExchangeLimit(TEST_USER_ID, TEST_MATCH_ID, 'bestie');
			expect(result).toBe(true);
		});

		it('should return false when bestie has not reached limit and both active', async () => {
			const mockSelect = vi.fn().mockReturnThis();
			const mockEq1 = vi.fn().mockReturnThis();
			const mockEq2 = vi.fn().mockReturnThis();
			const mockEq3 = vi.fn().mockResolvedValue({
				data: [
					{ assistant_type: 'bestie', exchange_count: 5, last_exchange_at: null },
					{ assistant_type: 'wingman', exchange_count: 5, last_exchange_at: null }
				],
				error: null
			});

			mockSupabase.from.mockReturnValue({
				select: mockSelect,
				eq: mockEq1
			});

			let callCount = 0;
			mockEq1.mockImplementation(() => {
				callCount++;
				if (callCount === 1) {
					return {
						eq: vi.fn().mockResolvedValue({
							data: [
								{ assistant_type: 'bestie', is_active: true },
								{ assistant_type: 'wingman', is_active: true }
							],
							error: null
						})
					};
				}
				return {
					eq: mockEq3
				};
			});

			const result = await hasReachedExchangeLimit(TEST_USER_ID, TEST_MATCH_ID, 'bestie');
			expect(result).toBe(false);
		});
	});

	describe('getRemainingExchanges()', () => {
		it('should return max when only one assistant is active', async () => {
			const mockSelect = vi.fn().mockReturnThis();
			const mockEq1 = vi.fn().mockReturnThis();
			const mockEq2 = vi.fn().mockResolvedValue({
				data: [{ assistant_type: 'bestie', is_active: true }],
				error: null
			});

			mockSupabase.from.mockReturnValue({
				select: mockSelect,
				eq: mockEq1
			});

			mockEq1.mockReturnValue({
				eq: mockEq2
			});

			const result = await getRemainingExchanges(TEST_USER_ID, TEST_MATCH_ID, 'bestie');
			expect(result).toBe(10);
		});

		it('should return correct remaining exchanges when both active', async () => {
			const mockSelect = vi.fn().mockReturnThis();
			const mockEq1 = vi.fn().mockReturnThis();

			mockSupabase.from.mockReturnValue({
				select: mockSelect,
				eq: mockEq1
			});

			let callCount = 0;
			mockEq1.mockImplementation(() => {
				callCount++;
				if (callCount === 1) {
					return {
						eq: vi.fn().mockResolvedValue({
							data: [
								{ assistant_type: 'bestie', is_active: true },
								{ assistant_type: 'wingman', is_active: true }
							],
							error: null
						})
					};
				} else {
					return {
						eq: vi.fn().mockResolvedValue({
							data: [
								{ assistant_type: 'bestie', exchange_count: 7, last_exchange_at: null },
								{ assistant_type: 'wingman', exchange_count: 5, last_exchange_at: null }
							],
							error: null
						})
					};
				}
			});

			const result = await getRemainingExchanges(TEST_USER_ID, TEST_MATCH_ID, 'bestie');
			expect(result).toBe(3); // 10 - 7
		});

		it('should return 0 when at limit', async () => {
			const mockSelect = vi.fn().mockReturnThis();
			const mockEq1 = vi.fn().mockReturnThis();

			mockSupabase.from.mockReturnValue({
				select: mockSelect,
				eq: mockEq1
			});

			let callCount = 0;
			mockEq1.mockImplementation(() => {
				callCount++;
				if (callCount === 1) {
					return {
						eq: vi.fn().mockResolvedValue({
							data: [
								{ assistant_type: 'bestie', is_active: true },
								{ assistant_type: 'wingman', is_active: true }
							],
							error: null
						})
					};
				} else {
					return {
						eq: vi.fn().mockResolvedValue({
							data: [
								{ assistant_type: 'bestie', exchange_count: 10, last_exchange_at: null },
								{ assistant_type: 'wingman', exchange_count: 5, last_exchange_at: null }
							],
							error: null
						})
					};
				}
			});

			const result = await getRemainingExchanges(TEST_USER_ID, TEST_MATCH_ID, 'bestie');
			expect(result).toBe(0);
		});

		it('should return max on error', async () => {
			const mockSelect = vi.fn().mockReturnThis();
			const mockEq = vi.fn().mockRejectedValue(new Error('Database error'));

			mockSupabase.from.mockReturnValue({
				select: mockSelect,
				eq: mockEq
			});

			const result = await getRemainingExchanges(TEST_USER_ID, TEST_MATCH_ID, 'bestie');
			expect(result).toBe(10);
		});
	});

	describe('ExchangeCount Interface', () => {
		it('should have correct structure', () => {
			const count: ExchangeCount = {
				bestieExchanges: 5,
				wingmanExchanges: 3,
				lastBestieExchange: Date.now(),
				lastWingmanExchange: Date.now()
			};

			expect(count.bestieExchanges).toBe(5);
			expect(count.wingmanExchanges).toBe(3);
			expect(typeof count.lastBestieExchange).toBe('number');
			expect(typeof count.lastWingmanExchange).toBe('number');
		});

		it('should support null timestamps', () => {
			const count: ExchangeCount = {
				bestieExchanges: 0,
				wingmanExchanges: 0,
				lastBestieExchange: null,
				lastWingmanExchange: null
			};

			expect(count.lastBestieExchange).toBeNull();
			expect(count.lastWingmanExchange).toBeNull();
		});
	});
});
