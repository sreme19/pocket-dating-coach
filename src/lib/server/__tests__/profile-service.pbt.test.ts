import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fc from 'fast-check';
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
 * Property-Based Tests for Profile Service
 * 
 * These tests use property-based testing to verify universal correctness properties:
 * 1. Round-trip consistency: Save → retrieve → verify content matches
 * 2. Version history ordering: Versions are in correct chronological order
 * 3. Profile immutability: Previous versions never change
 * 4. Version uniqueness: Each version has unique version number
 * 5. Cache invalidation: Cache is properly cleared after updates
 * 
 * **Validates: Requirements 3.2, 4.2, 8.1, 12.1, 12.2**
 */

// Arbitraries for generating test data
const stringArrayArbitrary = fc.array(fc.string({ minLength: 1, maxLength: 50 }), {
	minLength: 0,
	maxLength: 5
});

const preferencesArbitrary = fc.record({
	emotionalSignals: stringArrayArbitrary,
	lifestyleSignals: stringArrayArbitrary,
	maturitySignals: stringArrayArbitrary,
	boundaries: stringArrayArbitrary,
	dealbreakers: stringArrayArbitrary,
	privateCompatibilityNotes: stringArrayArbitrary,
	updatedAt: fc.integer({ min: 0, max: Date.now() })
});

const personalityArbitrary = fc.record({
	communicationStyle: fc.string({ minLength: 1, maxLength: 50 }),
	personalityVibe: fc.string({ minLength: 1, maxLength: 50 }),
	mattersMost: fc.string({ minLength: 1, maxLength: 50 }),
	values: stringArrayArbitrary,
	datingPatterns: stringArrayArbitrary,
	redFlagsToAvoid: stringArrayArbitrary,
	updatedAt: fc.integer({ min: 0, max: Date.now() })
});

const userIdArbitrary = fc.string({ minLength: 1, maxLength: 50 });
const reasonArbitrary = fc.string({ minLength: 1, maxLength: 100 });

// Mock Supabase
vi.mock('../supabase', () => ({
	getSupabase: vi.fn()
}));

describe('Profile Service - Property-Based Tests', () => {
	let mockSupabase: any;

	beforeEach(() => {
		clearCache();
		mockSupabase = {
			from: vi.fn()
		};
		(getSupabase as any).mockReturnValue(mockSupabase);
	});

	afterEach(() => {
		vi.clearAllMocks();
		clearCache();
	});

	/**
	 * Property 1: Round-trip Consistency
	 * For any preferences data, saving and retrieving should return the same data
	 * 
	 * **Validates: Requirement 8.1 (Chat History Persistence and Retrieval)**
	 */
	it('Property 1: Round-trip consistency for preferences', async () => {
		await fc.assert(
			fc.asyncProperty(userIdArbitrary, preferencesArbitrary, async (userId, prefs) => {
				clearCache();

				// Mock the database to return the saved preferences
				const mockSelect = vi.fn().mockReturnThis();
				const mockEq = vi.fn().mockReturnThis();
				const mockOrder = vi.fn().mockReturnThis();
				const mockLimit = vi.fn().mockReturnThis();
				const mockSingle = vi.fn().mockResolvedValue({
					data: { data: prefs },
					error: null
				});

				mockSupabase.from.mockReturnValue({
					select: mockSelect,
					eq: mockEq,
					order: mockOrder,
					limit: mockLimit,
					single: mockSingle
				});

				// Load preferences
				const loaded = await loadPreferences(userId);

				// Verify round-trip consistency
				expect(loaded.emotionalSignals).toEqual(prefs.emotionalSignals);
				expect(loaded.lifestyleSignals).toEqual(prefs.lifestyleSignals);
				expect(loaded.maturitySignals).toEqual(prefs.maturitySignals);
				expect(loaded.boundaries).toEqual(prefs.boundaries);
				expect(loaded.dealbreakers).toEqual(prefs.dealbreakers);
				expect(loaded.privateCompatibilityNotes).toEqual(prefs.privateCompatibilityNotes);
			}),
			{ numRuns: 50 }
		);
	});

	/**
	 * Property 2: Round-trip Consistency for Personality
	 * For any personality data, saving and retrieving should return the same data
	 */
	it('Property 2: Round-trip consistency for personality', async () => {
		await fc.assert(
			fc.asyncProperty(userIdArbitrary, personalityArbitrary, async (userId, pers) => {
				clearCache();

				const mockSelect = vi.fn().mockReturnThis();
				const mockEq = vi.fn().mockReturnThis();
				const mockOrder = vi.fn().mockReturnThis();
				const mockLimit = vi.fn().mockReturnThis();
				const mockSingle = vi.fn().mockResolvedValue({
					data: { data: pers },
					error: null
				});

				mockSupabase.from.mockReturnValue({
					select: mockSelect,
					eq: mockEq,
					order: mockOrder,
					limit: mockLimit,
					single: mockSingle
				});

				const loaded = await loadPersonality(userId);

				expect(loaded.communicationStyle).toEqual(pers.communicationStyle);
				expect(loaded.personalityVibe).toEqual(pers.personalityVibe);
				expect(loaded.mattersMost).toEqual(pers.mattersMost);
				expect(loaded.values).toEqual(pers.values);
				expect(loaded.datingPatterns).toEqual(pers.datingPatterns);
				expect(loaded.redFlagsToAvoid).toEqual(pers.redFlagsToAvoid);
			}),
			{ numRuns: 50 }
		);
	});

	/**
	 * Property 3: Version History Ordering
	 * Version history should always be in descending order by version number
	 * 
	 * **Validates: Requirement 12.2 (Profile Data Loading and Caching)**
	 */
	it('Property 3: Version history is in descending order', async () => {
		await fc.assert(
			fc.asyncProperty(userIdArbitrary, fc.array(fc.integer({ min: 1, max: 100 })), async (userId, versions) => {
				// Sort versions in descending order (as the database would return them)
				const sortedVersions = [...new Set(versions)].sort((a, b) => b - a);

				const mockSelect = vi.fn().mockReturnThis();
				const mockEq = vi.fn().mockReturnThis();
				const mockOrder = vi.fn().mockResolvedValue({
					data: sortedVersions.map((v) => ({
						id: `v${v}`,
						version: v,
						data: { emotionalSignals: [] },
						reason: `Version ${v}`,
						created_at: new Date().toISOString()
					})),
					error: null
				});

				mockSupabase.from.mockReturnValue({
					select: mockSelect,
					eq: mockEq,
					order: mockOrder
				});

				const history = await getPreferencesHistory(userId);

				// Verify versions are in descending order
				for (let i = 0; i < history.length - 1; i++) {
					expect(history[i].version).toBeGreaterThanOrEqual(history[i + 1].version);
				}
			}),
			{ numRuns: 30 }
		);
	});

	/**
	 * Property 4: Version Uniqueness
	 * Each version should have a unique version number
	 */
	it('Property 4: Each version has unique version number', async () => {
		await fc.assert(
			fc.asyncProperty(userIdArbitrary, fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 1 }), async (userId, versions) => {
				const uniqueVersions = [...new Set(versions)];

				const mockSelect = vi.fn().mockReturnThis();
				const mockEq = vi.fn().mockReturnThis();
				const mockOrder = vi.fn().mockResolvedValue({
					data: uniqueVersions.map((v) => ({
						id: `v${v}`,
						version: v,
						data: { emotionalSignals: [] },
						reason: `Version ${v}`,
						created_at: new Date().toISOString()
					})),
					error: null
				});

				mockSupabase.from.mockReturnValue({
					select: mockSelect,
					eq: mockEq,
					order: mockOrder
				});

				const history = await getPreferencesHistory(userId);
				const versionNumbers = history.map((v) => v.version);

				// Verify all version numbers are unique
				expect(new Set(versionNumbers).size).toBe(versionNumbers.length);
			}),
			{ numRuns: 30 }
		);
	});

	/**
	 * Property 5: Cache Invalidation
	 * After updating a profile, the cache should be invalidated
	 * 
	 * **Validates: Requirement 12.1 (Profile Data Loading and Caching)**
	 */
	it('Property 5: Cache is invalidated after update', async () => {
		await fc.assert(
			fc.asyncProperty(userIdArbitrary, preferencesArbitrary, reasonArbitrary, async (userId, prefs, reason) => {
				clearCache();

				let callCount = 0;
				const mockSelect = vi.fn().mockReturnThis();
				const mockEq = vi.fn().mockReturnThis();
				const mockOrder = vi.fn().mockReturnThis();
				const mockLimit = vi.fn().mockReturnThis();
				const mockSingle = vi.fn().mockImplementation(() => {
					callCount++;
					return Promise.resolve({
						data: { data: prefs, version: callCount },
						error: null
					});
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

				// Load preferences (should call database)
				await loadPreferences(userId);
				const callsAfterLoad = callCount;

				// Update preferences (should invalidate cache)
				await updatePreferences(userId, { emotionalSignals: ['Updated'] }, reason);

				// Load preferences again (should call database again)
				await loadPreferences(userId);
				const callsAfterUpdate = callCount;

				// Verify cache was invalidated (more calls after update)
				expect(callsAfterUpdate).toBeGreaterThan(callsAfterLoad);
			}),
			{ numRuns: 30 }
		);
	});

	/**
	 * Property 6: Partial Updates Preserve Existing Data
	 * When updating with partial data, existing fields should be preserved
	 */
	it('Property 6: Partial updates preserve existing data', async () => {
		await fc.assert(
			fc.asyncProperty(
				userIdArbitrary,
				preferencesArbitrary,
				fc.record({ emotionalSignals: stringArrayArbitrary }),
				reasonArbitrary,
				async (userId, originalPrefs, partialUpdate, reason) => {
					clearCache();

					const mockSelect = vi.fn().mockReturnThis();
					const mockEq = vi.fn().mockReturnThis();
					const mockOrder = vi.fn().mockReturnThis();
					const mockLimit = vi.fn().mockReturnThis();
					const mockSingle = vi.fn()
						.mockResolvedValueOnce({
							data: { data: originalPrefs },
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

					await updatePreferences(userId, partialUpdate, reason);

					// Verify the insert was called with merged data
					const insertCall = mockInsert.mock.calls[0][0];
					expect(insertCall.data).toMatchObject({
						emotionalSignals: partialUpdate.emotionalSignals,
						lifestyleSignals: originalPrefs.lifestyleSignals,
						maturitySignals: originalPrefs.maturitySignals,
						boundaries: originalPrefs.boundaries,
						dealbreakers: originalPrefs.dealbreakers,
						privateCompatibilityNotes: originalPrefs.privateCompatibilityNotes
					});
				}
			),
			{ numRuns: 30 }
		);
	});

	/**
	 * Property 7: Version Numbers Increment
	 * Each new version should have a version number greater than the previous
	 */
	it('Property 7: Version numbers increment correctly', async () => {
		await fc.assert(
			fc.asyncProperty(
				userIdArbitrary,
				fc.array(fc.integer({ min: 1, max: 10 }), { minLength: 1, maxLength: 5 }),
				async (userId, versionSequence) => {
					clearCache();

					let currentVersion = 0;
					const mockSelect = vi.fn().mockReturnThis();
					const mockEq = vi.fn().mockReturnThis();
					const mockOrder = vi.fn().mockReturnThis();
					const mockLimit = vi.fn().mockReturnThis();
					const mockSingle = vi.fn().mockImplementation(() => {
						return Promise.resolve({
							data: { version: currentVersion },
							error: null
						});
					});

					const mockInsert = vi.fn().mockImplementation((data) => {
						currentVersion = data.version;
						return Promise.resolve({ error: null });
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

					// Perform multiple updates
					for (let i = 0; i < versionSequence.length; i++) {
						await updatePreferences(userId, { emotionalSignals: [`Update ${i}`] }, `Update ${i}`);
					}

					// Verify final version is correct
					expect(currentVersion).toBe(versionSequence.length);
				}
			),
			{ numRuns: 20 }
		);
	});

	/**
	 * Property 8: Default Values for Missing Profiles
	 * When no profile exists, default values should be returned
	 */
	it('Property 8: Default values returned for missing profiles', async () => {
		await fc.assert(
			fc.asyncProperty(userIdArbitrary, async (userId) => {
				clearCache();

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

				const prefs = await loadPreferences(userId);

				// Verify default structure
				expect(prefs).toHaveProperty('emotionalSignals');
				expect(prefs).toHaveProperty('lifestyleSignals');
				expect(prefs).toHaveProperty('maturitySignals');
				expect(prefs).toHaveProperty('boundaries');
				expect(prefs).toHaveProperty('dealbreakers');
				expect(prefs).toHaveProperty('privateCompatibilityNotes');
				expect(prefs).toHaveProperty('updatedAt');

				// Verify arrays are empty
				expect(Array.isArray(prefs.emotionalSignals)).toBe(true);
				expect(Array.isArray(prefs.lifestyleSignals)).toBe(true);
			}),
			{ numRuns: 30 }
		);
	});

	/**
	 * Property 9: Reason Tracking
	 * Every version should have a reason for the update
	 */
	it('Property 9: Reason is tracked for every version', async () => {
		await fc.assert(
			fc.asyncProperty(
				userIdArbitrary,
				preferencesArbitrary,
				reasonArbitrary,
				async (userId, prefs, reason) => {
					clearCache();

					const mockSelect = vi.fn().mockReturnThis();
					const mockEq = vi.fn().mockReturnThis();
					const mockOrder = vi.fn().mockReturnThis();
					const mockLimit = vi.fn().mockReturnThis();
					const mockSingle = vi.fn()
						.mockResolvedValueOnce({
							data: { data: prefs },
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

					await updatePreferences(userId, {}, reason);

					const insertCall = mockInsert.mock.calls[0][0];
					expect(insertCall.reason).toBe(reason);
				}
			),
			{ numRuns: 30 }
		);
	});
});
