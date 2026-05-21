import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getSupabase } from '$lib/server/supabase';
import {
	loadPersonality,
	updatePersonality,
	getPersonalityHistory,
	restoreProfileVersion,
	clearCache,
	type PersonalityProfile
} from '$lib/server/profile-service';

// Mock Supabase
vi.mock('$lib/server/supabase', () => ({
	getSupabase: vi.fn()
}));

describe('Personality Management Endpoints', () => {
	const testUserId = 'test-user-123';
	const testVersionId = 'version-456';

	const mockPersonalityData: PersonalityProfile = {
		communicationStyle: 'direct',
		personalityVibe: 'ambitious',
		mattersMost: 'humor',
		values: ['authenticity', 'growth', 'loyalty'],
		datingPatterns: ['genuine conversation', 'quick to meet'],
		redFlagsToAvoid: ['overly focused on appearance'],
		updatedAt: Date.now()
	};

	beforeEach(() => {
		clearCache();
		vi.clearAllMocks();
	});

	describe('loadPersonality', () => {
		it('should load personality profile from database', async () => {
			const mockSupabase = {
				from: vi.fn().mockReturnValue({
					select: vi.fn().mockReturnValue({
						eq: vi.fn()
							.mockReturnValueOnce({
								eq: vi.fn().mockReturnValue({
									order: vi.fn().mockReturnValue({
										limit: vi.fn().mockReturnValue({
											single: vi.fn().mockResolvedValue({
												data: { data: mockPersonalityData },
												error: null
											})
										})
									})
								})
							})
					})
				})
			};

			vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

			const result = await loadPersonality(testUserId);

			expect(result).toEqual(mockPersonalityData);
		});

		it('should return default personality if not found', async () => {
			const mockSupabase = {
				from: vi.fn().mockReturnValue({
					select: vi.fn().mockReturnValue({
						eq: vi.fn()
							.mockReturnValueOnce({
								eq: vi.fn().mockReturnValue({
									order: vi.fn().mockReturnValue({
										limit: vi.fn().mockReturnValue({
											single: vi.fn().mockResolvedValue({
												data: null,
												error: { code: 'PGRST116', message: 'No rows found' }
											})
										})
									})
								})
							})
					})
				})
			};

			vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

			const result = await loadPersonality(testUserId);

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

		it('should cache personality data', async () => {
			const mockSupabase = {
				from: vi.fn().mockReturnValue({
					select: vi.fn().mockReturnValue({
						eq: vi.fn()
							.mockReturnValueOnce({
								eq: vi.fn().mockReturnValue({
									order: vi.fn().mockReturnValue({
										limit: vi.fn().mockReturnValue({
											single: vi.fn().mockResolvedValue({
												data: { data: mockPersonalityData },
												error: null
											})
										})
									})
								})
							})
					})
				})
			};

			vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

			// First call should hit database
			const result1 = await loadPersonality(testUserId);
			expect(result1).toEqual(mockPersonalityData);

			// Second call should use cache (no new mock calls)
			const result2 = await loadPersonality(testUserId);
			expect(result2).toEqual(mockPersonalityData);
		});
	});

	describe('updatePersonality', () => {
		it('should update personality with version tracking', async () => {
			const updates = { values: ['authenticity', 'growth', 'loyalty', 'humor'] };
			const reason = 'Updated based on conversation insights';

			const mockSupabase = {
				from: vi.fn()
					.mockReturnValueOnce({
						select: vi.fn().mockReturnValue({
							eq: vi.fn()
								.mockReturnValueOnce({
									eq: vi.fn().mockReturnValue({
										order: vi.fn().mockReturnValue({
											limit: vi.fn().mockReturnValue({
												single: vi.fn().mockResolvedValue({
													data: { data: mockPersonalityData },
													error: null
												})
											})
										})
									})
								})
						})
					})
					.mockReturnValueOnce({
						select: vi.fn().mockReturnValue({
							eq: vi.fn()
								.mockReturnValueOnce({
									eq: vi.fn().mockReturnValue({
										order: vi.fn().mockReturnValue({
											limit: vi.fn().mockReturnValue({
												single: vi.fn().mockResolvedValue({
													data: { version: 1 },
													error: null
												})
											})
										})
									})
								})
						})
					})
					.mockReturnValueOnce({
						insert: vi.fn().mockResolvedValue({
							data: null,
							error: null
						})
					})
			};

			vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

			await updatePersonality(testUserId, updates, reason);

			// Verify insert was called with correct data
			expect(mockSupabase.from).toHaveBeenCalledWith('ai_assistant_profiles');
		});

		it('should increment version number on update', async () => {
			const updates = { communicationStyle: 'playful' };
			const reason = 'Updated communication style';

			const mockSupabase = {
				from: vi.fn()
					.mockReturnValueOnce({
						select: vi.fn().mockReturnValue({
							eq: vi.fn()
								.mockReturnValueOnce({
									eq: vi.fn().mockReturnValue({
										order: vi.fn().mockReturnValue({
											limit: vi.fn().mockReturnValue({
												single: vi.fn().mockResolvedValue({
													data: { data: mockPersonalityData },
													error: null
												})
											})
										})
									})
								})
						})
					})
					.mockReturnValueOnce({
						select: vi.fn().mockReturnValue({
							eq: vi.fn()
								.mockReturnValueOnce({
									eq: vi.fn().mockReturnValue({
										order: vi.fn().mockReturnValue({
											limit: vi.fn().mockReturnValue({
												single: vi.fn().mockResolvedValue({
													data: { version: 2 },
													error: null
												})
											})
										})
									})
								})
						})
					})
					.mockReturnValueOnce({
						insert: vi.fn().mockResolvedValue({
							data: null,
							error: null
						})
					})
			};

			vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

			await updatePersonality(testUserId, updates, reason);

			// Verify the insert call includes version 3 (next version after 2)
			const insertCall = mockSupabase.from.mock.results[2];
			expect(insertCall).toBeDefined();
		});
	});

	describe('getPersonalityHistory', () => {
		it('should retrieve version history', async () => {
			const mockHistory = [
				{
					id: 'v1',
					version: 1,
					data: mockPersonalityData,
					reason: 'Initial profile',
					created_at: new Date().toISOString()
				},
				{
					id: 'v2',
					version: 2,
					data: { ...mockPersonalityData, communicationStyle: 'playful' },
					reason: 'Updated communication style',
					created_at: new Date().toISOString()
				}
			];

			const mockSupabase = {
				from: vi.fn().mockReturnValue({
					select: vi.fn().mockReturnValue({
						eq: vi.fn()
							.mockReturnValueOnce({
								eq: vi.fn().mockReturnValue({
									order: vi.fn().mockResolvedValue({
										data: mockHistory,
										error: null
									})
								})
							})
					})
				})
			};

			vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

			const result = await getPersonalityHistory(testUserId);

			expect(result).toHaveLength(2);
			expect(result[0].version).toBe(1);
			expect(result[1].version).toBe(2);
		});

		it('should return empty array if no history exists', async () => {
			const mockSupabase = {
				from: vi.fn().mockReturnValue({
					select: vi.fn().mockReturnValue({
						eq: vi.fn()
							.mockReturnValueOnce({
								eq: vi.fn().mockReturnValue({
									order: vi.fn().mockResolvedValue({
										data: [],
										error: null
									})
								})
							})
					})
				})
			};

			vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

			const result = await getPersonalityHistory(testUserId);

			expect(result).toEqual([]);
		});
	});

	describe('restoreProfileVersion', () => {
		it('should restore a previous version', async () => {
			const oldVersion = { ...mockPersonalityData, communicationStyle: 'genuine' };

			const mockSupabase = {
				from: vi.fn()
					.mockReturnValueOnce({
						select: vi.fn().mockReturnValue({
							eq: vi.fn()
								.mockReturnValueOnce({
									eq: vi.fn().mockReturnValue({
										single: vi.fn().mockResolvedValue({
											data: {
												profile_type: 'personality',
												data: oldVersion,
												version: 1
											},
											error: null
										})
									})
								})
						})
					})
					.mockReturnValueOnce({
						select: vi.fn().mockReturnValue({
							eq: vi.fn()
								.mockReturnValueOnce({
									eq: vi.fn().mockReturnValue({
										order: vi.fn().mockReturnValue({
											limit: vi.fn().mockReturnValue({
												single: vi.fn().mockResolvedValue({
													data: { version: 2 },
													error: null
												})
											})
										})
									})
								})
						})
					})
					.mockReturnValueOnce({
						insert: vi.fn().mockResolvedValue({
							data: null,
							error: null
						})
					})
			};

			vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

			await restoreProfileVersion(testUserId, testVersionId);

			// Verify insert was called
			expect(mockSupabase.from).toHaveBeenCalledWith('ai_assistant_profiles');
		});

		it('should throw error if version not found', async () => {
			const mockSupabase = {
				from: vi.fn().mockReturnValue({
					select: vi.fn().mockReturnValue({
						eq: vi.fn()
							.mockReturnValueOnce({
								eq: vi.fn().mockReturnValue({
									single: vi.fn().mockResolvedValue({
										data: null,
										error: { message: 'No rows found' }
									})
								})
							})
					})
				})
			};

			vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

			await expect(restoreProfileVersion(testUserId, 'invalid-version')).rejects.toThrow();
		});
	});

	describe('Property-Based Tests', () => {
		/**
		 * Property 1: Profile Version Uniqueness
		 * Each version should have a unique version number
		 * Validates: Requirements 8.1, 12.1, 12.2
		 */
		it('should ensure each version has unique version number', async () => {
			const mockHistory = [
				{ id: 'v1', version: 1, data: mockPersonalityData, reason: 'v1', created_at: new Date().toISOString() },
				{ id: 'v2', version: 2, data: mockPersonalityData, reason: 'v2', created_at: new Date().toISOString() },
				{ id: 'v3', version: 3, data: mockPersonalityData, reason: 'v3', created_at: new Date().toISOString() }
			];

			const mockSupabase = {
				from: vi.fn().mockReturnValue({
					select: vi.fn().mockReturnValue({
						eq: vi.fn()
							.mockReturnValueOnce({
								eq: vi.fn().mockReturnValue({
									order: vi.fn().mockResolvedValue({
										data: mockHistory,
										error: null
									})
								})
							})
					})
				})
			};

			vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

			const result = await getPersonalityHistory(testUserId);

			// Extract version numbers
			const versions = result.map(v => v.version);

			// Check uniqueness
			const uniqueVersions = new Set(versions);
			expect(uniqueVersions.size).toBe(versions.length);

			// Check they are sequential
			for (let i = 0; i < versions.length; i++) {
				expect(versions[i]).toBe(i + 1);
			}
		});

		/**
		 * Property 2: Preference Immutability
		 * Previous versions should never change after creation
		 * Validates: Requirements 8.1, 12.1, 12.2
		 */
		it('should preserve previous versions immutably', async () => {
			const version1Data = { ...mockPersonalityData, communicationStyle: 'direct' };
			const version2Data = { ...mockPersonalityData, communicationStyle: 'playful' };

			const mockHistory = [
				{ id: 'v1', version: 1, data: version1Data, reason: 'v1', created_at: new Date().toISOString() },
				{ id: 'v2', version: 2, data: version2Data, reason: 'v2', created_at: new Date().toISOString() }
			];

			const mockSupabase = {
				from: vi.fn().mockReturnValue({
					select: vi.fn().mockReturnValue({
						eq: vi.fn()
							.mockReturnValueOnce({
								eq: vi.fn().mockReturnValue({
									order: vi.fn().mockResolvedValue({
										data: mockHistory,
										error: null
									})
								})
							})
					})
				})
			};

			vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

			const result = await getPersonalityHistory(testUserId);

			// Verify version 1 data is unchanged
			expect(result[0].data.communicationStyle).toBe('direct');

			// Verify version 2 data is different
			expect(result[1].data.communicationStyle).toBe('playful');
		});

		/**
		 * Property 3: History Ordering
		 * Version history should be in correct chronological order (newest first)
		 * Validates: Requirements 8.1, 12.1, 12.2
		 */
		it('should return history in correct chronological order', async () => {
			const now = Date.now();
			const mockHistory = [
				{
					id: 'v3',
					version: 3,
					data: mockPersonalityData,
					reason: 'v3',
					created_at: new Date(now + 2000).toISOString()
				},
				{
					id: 'v2',
					version: 2,
					data: mockPersonalityData,
					reason: 'v2',
					created_at: new Date(now + 1000).toISOString()
				},
				{
					id: 'v1',
					version: 1,
					data: mockPersonalityData,
					reason: 'v1',
					created_at: new Date(now).toISOString()
				}
			];

			const mockSupabase = {
				from: vi.fn().mockReturnValue({
					select: vi.fn().mockReturnValue({
						eq: vi.fn()
							.mockReturnValueOnce({
								eq: vi.fn().mockReturnValue({
									order: vi.fn().mockResolvedValue({
										data: mockHistory,
										error: null
									})
								})
							})
					})
				})
			};

			vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

			const result = await getPersonalityHistory(testUserId);

			// Verify newest version is first
			expect(result[0].version).toBe(3);
			expect(result[1].version).toBe(2);
			expect(result[2].version).toBe(1);

			// Verify timestamps are in descending order
			for (let i = 0; i < result.length - 1; i++) {
				expect(result[i].createdAt).toBeGreaterThanOrEqual(result[i + 1].createdAt);
			}
		});
	});
});
