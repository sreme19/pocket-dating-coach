import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	loadPreferences,
	loadPersonality,
	updatePreferences,
	updatePersonality,
	getPreferencesHistory,
	getPersonalityHistory,
	restoreProfileVersion,
	clearCache,
	type PreferencesProfile,
	type PersonalityProfile
} from '../profile-service';
import { getSupabase } from '../supabase';

/**
 * Unit Tests for Profile Service
 * 
 * These tests verify that the Profile Service correctly:
 * 1. Loads preferences and personality data from Supabase
 * 2. Caches profile data to reduce database queries
 * 3. Updates profiles with version history tracking
 * 4. Retrieves version history
 * 5. Restores previous versions
 * 
 * **Validates: Requirements 3.2, 4.2, 8.1, 12.1, 12.2**
 */

// Mock data
const TEST_USER_ID = 'test-user-123';
const TEST_PREFERENCES: PreferencesProfile = {
	emotionalSignals: ['Asks about my day', 'Shows vulnerability'],
	lifestyleSignals: ['Active and outdoorsy', 'Values travel'],
	maturitySignals: ['Takes responsibility', 'Has long-term goals'],
	boundaries: ['No excessive drinking', 'Respectful of my time'],
	dealbreakers: ['Disrespectful to service workers', 'Still hung up on ex'],
	privateCompatibilityNotes: ['Seems like he values independence'],
	updatedAt: Date.now()
};

const TEST_PERSONALITY: PersonalityProfile = {
	communicationStyle: 'direct',
	personalityVibe: 'ambitious',
	mattersMost: 'humor',
	values: ['Authenticity', 'Growth mindset', 'Loyalty'],
	datingPatterns: ['Prefers genuine conversation', 'Moves quickly from messaging to meeting'],
	redFlagsToAvoid: ['Overly focused on appearance', 'Dismissive of my career'],
	updatedAt: Date.now()
};

// Mock Supabase client
vi.mock('../supabase', () => ({
	getSupabase: vi.fn()
}));

describe('Profile Service', () => {
	let mockSupabase: any;

	beforeEach(() => {
		// Clear cache before each test
		clearCache();

		// Setup mock Supabase
		mockSupabase = {
			from: vi.fn()
		};
		(getSupabase as any).mockReturnValue(mockSupabase);
	});

	afterEach(() => {
		vi.clearAllMocks();
		clearCache();
	});

	describe('loadPreferences', () => {
		it('should load preferences from Supabase', async () => {
			const mockSelect = vi.fn().mockReturnThis();
			const mockEq = vi.fn().mockReturnThis();
			const mockOrder = vi.fn().mockReturnThis();
			const mockLimit = vi.fn().mockReturnThis();
			const mockSingle = vi.fn().mockResolvedValue({
				data: { data: TEST_PREFERENCES },
				error: null
			});

			mockSupabase.from.mockReturnValue({
				select: mockSelect,
				eq: mockEq,
				order: mockOrder,
				limit: mockLimit,
				single: mockSingle
			});

			const result = await loadPreferences(TEST_USER_ID);

			expect(result).toEqual(TEST_PREFERENCES);
			expect(mockSupabase.from).toHaveBeenCalledWith('ai_assistant_profiles');
			expect(mockSelect).toHaveBeenCalledWith('data');
			expect(mockEq).toHaveBeenCalledWith('user_id', TEST_USER_ID);
			expect(mockEq).toHaveBeenCalledWith('profile_type', 'preferences');
		});

		it('should return default preferences if none exist', async () => {
			const mockSelect = vi.fn().mockReturnThis();
			const mockEq = vi.fn().mockReturnThis();
			const mockOrder = vi.fn().mockReturnThis();
			const mockLimit = vi.fn().mockReturnThis();
			const mockSingle = vi.fn().mockResolvedValue({
				data: null,
				error: { code: 'PGRST116', message: 'No rows found' }
			});

			mockSupabase.from.mockReturnValue({
				select: mockSelect,
				eq: mockEq,
				order: mockOrder,
				limit: mockLimit,
				single: mockSingle
			});

			const result = await loadPreferences(TEST_USER_ID);

			expect(result).toEqual({
				emotionalSignals: [],
				lifestyleSignals: [],
				maturitySignals: [],
				boundaries: [],
				dealbreakers: [],
				privateCompatibilityNotes: [],
				updatedAt: expect.any(Number)
			});
		});

		it('should cache preferences to reduce database queries', async () => {
			const mockSelect = vi.fn().mockReturnThis();
			const mockEq = vi.fn().mockReturnThis();
			const mockOrder = vi.fn().mockReturnThis();
			const mockLimit = vi.fn().mockReturnThis();
			const mockSingle = vi.fn().mockResolvedValue({
				data: { data: TEST_PREFERENCES },
				error: null
			});

			mockSupabase.from.mockReturnValue({
				select: mockSelect,
				eq: mockEq,
				order: mockOrder,
				limit: mockLimit,
				single: mockSingle
			});

			// First call should hit database
			const result1 = await loadPreferences(TEST_USER_ID);
			expect(mockSingle).toHaveBeenCalledTimes(1);

			// Second call should use cache
			const result2 = await loadPreferences(TEST_USER_ID);
			expect(mockSingle).toHaveBeenCalledTimes(1); // Still 1, not 2

			expect(result1).toEqual(result2);
		});

		it('should throw error if database query fails', async () => {
			const mockSelect = vi.fn().mockReturnThis();
			const mockEq = vi.fn().mockReturnThis();
			const mockOrder = vi.fn().mockReturnThis();
			const mockLimit = vi.fn().mockReturnThis();
			const mockSingle = vi.fn().mockResolvedValue({
				data: null,
				error: { message: 'Database connection failed' }
			});

			mockSupabase.from.mockReturnValue({
				select: mockSelect,
				eq: mockEq,
				order: mockOrder,
				limit: mockLimit,
				single: mockSingle
			});

			await expect(loadPreferences(TEST_USER_ID)).rejects.toThrow('Failed to load preferences');
		});
	});

	describe('loadPersonality', () => {
		it('should load personality from Supabase', async () => {
			const mockSelect = vi.fn().mockReturnThis();
			const mockEq = vi.fn().mockReturnThis();
			const mockOrder = vi.fn().mockReturnThis();
			const mockLimit = vi.fn().mockReturnThis();
			const mockSingle = vi.fn().mockResolvedValue({
				data: { data: TEST_PERSONALITY },
				error: null
			});

			mockSupabase.from.mockReturnValue({
				select: mockSelect,
				eq: mockEq,
				order: mockOrder,
				limit: mockLimit,
				single: mockSingle
			});

			const result = await loadPersonality(TEST_USER_ID);

			expect(result).toEqual(TEST_PERSONALITY);
			expect(mockSupabase.from).toHaveBeenCalledWith('ai_assistant_profiles');
			expect(mockEq).toHaveBeenCalledWith('profile_type', 'personality');
		});

		it('should return default personality if none exist', async () => {
			const mockSelect = vi.fn().mockReturnThis();
			const mockEq = vi.fn().mockReturnThis();
			const mockOrder = vi.fn().mockReturnThis();
			const mockLimit = vi.fn().mockReturnThis();
			const mockSingle = vi.fn().mockResolvedValue({
				data: null,
				error: { code: 'PGRST116', message: 'No rows found' }
			});

			mockSupabase.from.mockReturnValue({
				select: mockSelect,
				eq: mockEq,
				order: mockOrder,
				limit: mockLimit,
				single: mockSingle
			});

			const result = await loadPersonality(TEST_USER_ID);

			expect(result).toEqual({
				communicationStyle: '',
				personalityVibe: '',
				mattersMost: '',
				values: [],
				datingPatterns: [],
				redFlagsToAvoid: [],
				updatedAt: expect.any(Number)
			});
		});

		it('should cache personality to reduce database queries', async () => {
			const mockSelect = vi.fn().mockReturnThis();
			const mockEq = vi.fn().mockReturnThis();
			const mockOrder = vi.fn().mockReturnThis();
			const mockLimit = vi.fn().mockReturnThis();
			const mockSingle = vi.fn().mockResolvedValue({
				data: { data: TEST_PERSONALITY },
				error: null
			});

			mockSupabase.from.mockReturnValue({
				select: mockSelect,
				eq: mockEq,
				order: mockOrder,
				limit: mockLimit,
				single: mockSingle
			});

			// First call should hit database
			const result1 = await loadPersonality(TEST_USER_ID);
			expect(mockSingle).toHaveBeenCalledTimes(1);

			// Second call should use cache
			const result2 = await loadPersonality(TEST_USER_ID);
			expect(mockSingle).toHaveBeenCalledTimes(1); // Still 1, not 2

			expect(result1).toEqual(result2);
		});
	});

	describe('updatePreferences', () => {
		it('should update preferences and create new version', async () => {
			const mockSelect = vi.fn().mockReturnThis();
			const mockEq = vi.fn().mockReturnThis();
			const mockOrder = vi.fn().mockReturnThis();
			const mockLimit = vi.fn().mockReturnThis();
			const mockSingle = vi.fn()
				.mockResolvedValueOnce({
					data: { data: TEST_PREFERENCES },
					error: null
				})
				.mockResolvedValueOnce({
					data: { version: 1 },
					error: null
				});

			const mockInsert = vi.fn().mockResolvedValue({ error: null });

			mockSupabase.from.mockImplementation((table: string) => {
				if (table === 'ai_assistant_profiles') {
					return {
						select: mockSelect,
						eq: mockEq,
						order: mockOrder,
						limit: mockLimit,
						single: mockSingle,
						insert: mockInsert
					};
				}
			});

			const updates = { emotionalSignals: ['New signal'] };
			await updatePreferences(TEST_USER_ID, updates, 'Test update');

			expect(mockInsert).toHaveBeenCalledWith(
				expect.objectContaining({
					user_id: TEST_USER_ID,
					profile_type: 'preferences',
					version: 2,
					reason: 'Test update',
					data: expect.objectContaining({
						emotionalSignals: ['New signal']
					})
				})
			);
		});

		it('should invalidate cache after update', async () => {
			const mockSelect = vi.fn().mockReturnThis();
			const mockEq = vi.fn().mockReturnThis();
			const mockOrder = vi.fn().mockReturnThis();
			const mockLimit = vi.fn().mockReturnThis();
			const mockSingle = vi.fn()
				.mockResolvedValueOnce({
					data: { data: TEST_PREFERENCES },
					error: null
				})
				.mockResolvedValueOnce({
					data: { version: 1 },
					error: null
				})
				.mockResolvedValueOnce({
					data: { data: TEST_PREFERENCES },
					error: null
				});

			const mockInsert = vi.fn().mockResolvedValue({ error: null });

			mockSupabase.from.mockImplementation((table: string) => {
				if (table === 'ai_assistant_profiles') {
					return {
						select: mockSelect,
						eq: mockEq,
						order: mockOrder,
						limit: mockLimit,
						single: mockSingle,
						insert: mockInsert
					};
				}
			});

			// Load preferences to populate cache
			await loadPreferences(TEST_USER_ID);
			expect(mockSingle).toHaveBeenCalledTimes(1);

			// Update preferences
			await updatePreferences(TEST_USER_ID, { emotionalSignals: ['New'] }, 'Update');

			// Load preferences again - should hit database again (cache invalidated)
			await loadPreferences(TEST_USER_ID);
			expect(mockSingle).toHaveBeenCalledTimes(3); // 1 + 1 (for version) + 1 (after cache invalidation)
		});

		it('should throw error if update fails', async () => {
			const mockSelect = vi.fn().mockReturnThis();
			const mockEq = vi.fn().mockReturnThis();
			const mockOrder = vi.fn().mockReturnThis();
			const mockLimit = vi.fn().mockReturnThis();
			const mockSingle = vi.fn()
				.mockResolvedValueOnce({
					data: { data: TEST_PREFERENCES },
					error: null
				})
				.mockResolvedValueOnce({
					data: { version: 1 },
					error: null
				});

			const mockInsert = vi.fn().mockResolvedValue({
				error: { message: 'Insert failed' }
			});

			mockSupabase.from.mockImplementation((table: string) => {
				if (table === 'ai_assistant_profiles') {
					return {
						select: mockSelect,
						eq: mockEq,
						order: mockOrder,
						limit: mockLimit,
						single: mockSingle,
						insert: mockInsert
					};
				}
			});

			await expect(updatePreferences(TEST_USER_ID, {}, 'Test')).rejects.toThrow(
				'Failed to update preferences'
			);
		});
	});

	describe('updatePersonality', () => {
		it('should update personality and create new version', async () => {
			const mockSelect = vi.fn().mockReturnThis();
			const mockEq = vi.fn().mockReturnThis();
			const mockOrder = vi.fn().mockReturnThis();
			const mockLimit = vi.fn().mockReturnThis();
			const mockSingle = vi.fn()
				.mockResolvedValueOnce({
					data: { data: TEST_PERSONALITY },
					error: null
				})
				.mockResolvedValueOnce({
					data: { version: 1 },
					error: null
				});

			const mockInsert = vi.fn().mockResolvedValue({ error: null });

			mockSupabase.from.mockImplementation((table: string) => {
				if (table === 'ai_assistant_profiles') {
					return {
						select: mockSelect,
						eq: mockEq,
						order: mockOrder,
						limit: mockLimit,
						single: mockSingle,
						insert: mockInsert
					};
				}
			});

			const updates = { communicationStyle: 'playful' };
			await updatePersonality(TEST_USER_ID, updates, 'Test update');

			expect(mockInsert).toHaveBeenCalledWith(
				expect.objectContaining({
					user_id: TEST_USER_ID,
					profile_type: 'personality',
					version: 2,
					reason: 'Test update',
					data: expect.objectContaining({
						communicationStyle: 'playful'
					})
				})
			);
		});
	});

	describe('getPreferencesHistory', () => {
		it('should retrieve preferences version history', async () => {
			const mockSelect = vi.fn().mockReturnThis();
			const mockEq = vi.fn().mockReturnThis();
			const mockOrder = vi.fn().mockResolvedValue({
				data: [
					{
						id: 'v1',
						version: 1,
						data: TEST_PREFERENCES,
						reason: 'Initial',
						created_at: new Date().toISOString()
					},
					{
						id: 'v2',
						version: 2,
						data: { ...TEST_PREFERENCES, emotionalSignals: ['Updated'] },
						reason: 'Updated signals',
						created_at: new Date().toISOString()
					}
				],
				error: null
			});

			mockSupabase.from.mockReturnValue({
				select: mockSelect,
				eq: mockEq,
				order: mockOrder
			});

			const history = await getPreferencesHistory(TEST_USER_ID);

			expect(history).toHaveLength(2);
			expect(history[0].version).toBe(1);
			expect(history[1].version).toBe(2);
			expect(history[1].reason).toBe('Updated signals');
		});

		it('should return empty array if no history exists', async () => {
			const mockSelect = vi.fn().mockReturnThis();
			const mockEq = vi.fn().mockReturnThis();
			const mockOrder = vi.fn().mockResolvedValue({
				data: [],
				error: null
			});

			mockSupabase.from.mockReturnValue({
				select: mockSelect,
				eq: mockEq,
				order: mockOrder
			});

			const history = await getPreferencesHistory(TEST_USER_ID);

			expect(history).toEqual([]);
		});
	});

	describe('getPersonalityHistory', () => {
		it('should retrieve personality version history', async () => {
			const mockSelect = vi.fn().mockReturnThis();
			const mockEq = vi.fn().mockReturnThis();
			const mockOrder = vi.fn().mockResolvedValue({
				data: [
					{
						id: 'v1',
						version: 1,
						data: TEST_PERSONALITY,
						reason: 'Initial',
						created_at: new Date().toISOString()
					}
				],
				error: null
			});

			mockSupabase.from.mockReturnValue({
				select: mockSelect,
				eq: mockEq,
				order: mockOrder
			});

			const history = await getPersonalityHistory(TEST_USER_ID);

			expect(history).toHaveLength(1);
			expect(history[0].version).toBe(1);
		});
	});

	describe('restoreProfileVersion', () => {
		it('should restore a previous version', async () => {
			const versionId = 'v1';
			const mockSelect = vi.fn().mockReturnThis();
			const mockEq = vi.fn().mockReturnThis();
			const mockOrder = vi.fn().mockReturnThis();
			const mockLimit = vi.fn().mockReturnThis();
			const mockSingle = vi.fn()
				.mockResolvedValueOnce({
					data: {
						profile_type: 'preferences',
						data: TEST_PREFERENCES,
						version: 1
					},
					error: null
				})
				.mockResolvedValueOnce({
					data: { version: 2 },
					error: null
				});

			const mockInsert = vi.fn().mockResolvedValue({ error: null });

			mockSupabase.from.mockImplementation((table: string) => {
				if (table === 'ai_assistant_profiles') {
					return {
						select: mockSelect,
						eq: mockEq,
						order: mockOrder,
						limit: mockLimit,
						single: mockSingle,
						insert: mockInsert
					};
				}
			});

			await restoreProfileVersion(TEST_USER_ID, versionId);

			expect(mockInsert).toHaveBeenCalledWith(
				expect.objectContaining({
					user_id: TEST_USER_ID,
					profile_type: 'preferences',
					version: 3,
					reason: 'Restored from version 1',
					data: TEST_PREFERENCES
				})
			);
		});

		it('should throw error if version not found', async () => {
			const versionId = 'nonexistent';
			const mockSelect = vi.fn().mockReturnThis();
			const mockEq = vi.fn().mockReturnThis();
			const mockSingle = vi.fn().mockResolvedValue({
				data: null,
				error: { message: 'Not found' }
			});

			mockSupabase.from.mockReturnValue({
				select: mockSelect,
				eq: mockEq,
				single: mockSingle
			});

			await expect(restoreProfileVersion(TEST_USER_ID, versionId)).rejects.toThrow(
				'Failed to find version to restore'
			);
		});
	});

	describe('clearCache', () => {
		it('should clear cache for specific user', async () => {
			const mockSelect = vi.fn().mockReturnThis();
			const mockEq = vi.fn().mockReturnThis();
			const mockOrder = vi.fn().mockReturnThis();
			const mockLimit = vi.fn().mockReturnThis();
			const mockSingle = vi.fn().mockResolvedValue({
				data: { data: TEST_PREFERENCES },
				error: null
			});

			mockSupabase.from.mockReturnValue({
				select: mockSelect,
				eq: mockEq,
				order: mockOrder,
				limit: mockLimit,
				single: mockSingle
			});

			// Load to populate cache
			await loadPreferences(TEST_USER_ID);
			expect(mockSingle).toHaveBeenCalledTimes(1);

			// Clear cache
			clearCache(TEST_USER_ID);

			// Load again - should hit database
			await loadPreferences(TEST_USER_ID);
			expect(mockSingle).toHaveBeenCalledTimes(2);
		});

		it('should clear all cache when no user specified', async () => {
			const mockSelect = vi.fn().mockReturnThis();
			const mockEq = vi.fn().mockReturnThis();
			const mockOrder = vi.fn().mockReturnThis();
			const mockLimit = vi.fn().mockReturnThis();
			const mockSingle = vi.fn().mockResolvedValue({
				data: { data: TEST_PREFERENCES },
				error: null
			});

			mockSupabase.from.mockReturnValue({
				select: mockSelect,
				eq: mockEq,
				order: mockOrder,
				limit: mockLimit,
				single: mockSingle
			});

			// Load to populate cache
			await loadPreferences(TEST_USER_ID);
			expect(mockSingle).toHaveBeenCalledTimes(1);

			// Clear all cache
			clearCache();

			// Load again - should hit database
			await loadPreferences(TEST_USER_ID);
			expect(mockSingle).toHaveBeenCalledTimes(2);
		});
	});
});
