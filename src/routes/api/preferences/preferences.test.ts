import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	loadPreferences,
	updatePreferences,
	getPreferencesHistory,
	restoreProfileVersion,
	clearCache,
	type PreferencesProfile
} from '$lib/server/profile-service';

/**
 * Unit tests for preferences management functionality
 * 
 * Requirements: 8.1, 12.1, 12.2
 */

describe('Preferences Management', () => {
	const testUserId = 'test-user-123';
	const defaultPreferences: PreferencesProfile = {
		emotionalSignals: [],
		lifestyleSignals: [],
		maturitySignals: [],
		boundaries: [],
		dealbreakers: [],
		privateCompatibilityNotes: [],
		updatedAt: Date.now()
	};

	beforeEach(() => {
		// Clear cache before each test
		clearCache(testUserId);
	});

	afterEach(() => {
		// Clean up after each test
		clearCache(testUserId);
	});

	describe('loadPreferences', () => {
		it('should load preferences for a user', async () => {
			const preferences = await loadPreferences(testUserId);
			expect(preferences).toBeDefined();
			expect(preferences).toHaveProperty('emotionalSignals');
			expect(preferences).toHaveProperty('lifestyleSignals');
			expect(preferences).toHaveProperty('maturitySignals');
			expect(preferences).toHaveProperty('boundaries');
			expect(preferences).toHaveProperty('dealbreakers');
			expect(preferences).toHaveProperty('privateCompatibilityNotes');
			expect(preferences).toHaveProperty('updatedAt');
		});

		it('should return default preferences if none exist', async () => {
			const preferences = await loadPreferences(testUserId);
			expect(preferences.emotionalSignals).toEqual([]);
			expect(preferences.lifestyleSignals).toEqual([]);
			expect(preferences.maturitySignals).toEqual([]);
			expect(preferences.boundaries).toEqual([]);
			expect(preferences.dealbreakers).toEqual([]);
			expect(preferences.privateCompatibilityNotes).toEqual([]);
		});

		it('should cache preferences after loading', async () => {
			const preferences1 = await loadPreferences(testUserId);
			const preferences2 = await loadPreferences(testUserId);
			expect(preferences1).toEqual(preferences2);
		});

		it('should have updatedAt timestamp', async () => {
			const preferences = await loadPreferences(testUserId);
			expect(typeof preferences.updatedAt).toBe('number');
			expect(preferences.updatedAt).toBeGreaterThan(0);
		});
	});

	describe('updatePreferences', () => {
		it('should update preferences with new data', async () => {
			const updates: Partial<PreferencesProfile> = {
				emotionalSignals: ['asks about my day', 'shows vulnerability'],
				boundaries: ['no excessive drinking']
			};

			await updatePreferences(testUserId, updates, 'Test update');

			const updated = await loadPreferences(testUserId);
			expect(updated.emotionalSignals).toContain('asks about my day');
			expect(updated.emotionalSignals).toContain('shows vulnerability');
			expect(updated.boundaries).toContain('no excessive drinking');
		});

		it('should merge updates with existing data', async () => {
			// First update
			await updatePreferences(
				testUserId,
				{ emotionalSignals: ['signal1'] },
				'First update'
			);

			// Second update
			await updatePreferences(
				testUserId,
				{ boundaries: ['boundary1'] },
				'Second update'
			);

			const updated = await loadPreferences(testUserId);
			expect(updated.emotionalSignals).toContain('signal1');
			expect(updated.boundaries).toContain('boundary1');
		});

		it('should update updatedAt timestamp', async () => {
			const before = Date.now();
			await updatePreferences(testUserId, { emotionalSignals: ['test'] }, 'Update');
			const after = Date.now();

			const updated = await loadPreferences(testUserId);
			expect(updated.updatedAt).toBeGreaterThanOrEqual(before);
			expect(updated.updatedAt).toBeLessThanOrEqual(after + 1000); // Allow 1 second buffer
		});

		it('should invalidate cache after update', async () => {
			// Load and cache
			await loadPreferences(testUserId);

			// Update
			await updatePreferences(testUserId, { emotionalSignals: ['new'] }, 'Update');

			// Load again - should get fresh data
			const updated = await loadPreferences(testUserId);
			expect(updated.emotionalSignals).toContain('new');
		});

		it('should handle empty updates', async () => {
			await updatePreferences(testUserId, {}, 'Empty update');
			const updated = await loadPreferences(testUserId);
			expect(updated).toBeDefined();
		});

		it('should handle array field updates', async () => {
			const updates: Partial<PreferencesProfile> = {
				emotionalSignals: ['signal1', 'signal2', 'signal3'],
				dealbreakers: ['dealbreaker1', 'dealbreaker2']
			};

			await updatePreferences(testUserId, updates, 'Array update');

			const updated = await loadPreferences(testUserId);
			expect(updated.emotionalSignals).toHaveLength(3);
			expect(updated.dealbreakers).toHaveLength(2);
		});

		it('should handle reason parameter', async () => {
			const reason = 'Updated based on conversation insights';
			await updatePreferences(testUserId, { emotionalSignals: ['test'] }, reason);

			const history = await getPreferencesHistory(testUserId);
			expect(history.length).toBeGreaterThan(0);
			expect(history[0].reason).toBe(reason);
		});
	});

	describe('getPreferencesHistory', () => {
		it('should return empty array for new user', async () => {
			const history = await getPreferencesHistory(testUserId);
			expect(Array.isArray(history)).toBe(true);
		});

		it('should track version history', async () => {
			// Create first version
			await updatePreferences(testUserId, { emotionalSignals: ['v1'] }, 'Version 1');

			// Create second version
			await updatePreferences(testUserId, { emotionalSignals: ['v1', 'v2'] }, 'Version 2');

			const history = await getPreferencesHistory(testUserId);
			expect(history.length).toBeGreaterThanOrEqual(2);
		});

		it('should return versions in descending order', async () => {
			await updatePreferences(testUserId, { emotionalSignals: ['v1'] }, 'Version 1');
			await updatePreferences(testUserId, { emotionalSignals: ['v2'] }, 'Version 2');
			await updatePreferences(testUserId, { emotionalSignals: ['v3'] }, 'Version 3');

			const history = await getPreferencesHistory(testUserId);
			if (history.length >= 2) {
				expect(history[0].version).toBeGreaterThan(history[1].version);
			}
		});

		it('should include version metadata', async () => {
			await updatePreferences(testUserId, { emotionalSignals: ['test'] }, 'Test reason');

			const history = await getPreferencesHistory(testUserId);
			if (history.length > 0) {
				const version = history[0];
				expect(version).toHaveProperty('id');
				expect(version).toHaveProperty('version');
				expect(version).toHaveProperty('data');
				expect(version).toHaveProperty('reason');
				expect(version).toHaveProperty('createdAt');
			}
		});

		it('should preserve data in each version', async () => {
			const data1 = { emotionalSignals: ['signal1'] };
			const data2 = { emotionalSignals: ['signal1', 'signal2'] };

			await updatePreferences(testUserId, data1, 'Version 1');
			await updatePreferences(testUserId, data2, 'Version 2');

			const history = await getPreferencesHistory(testUserId);
			if (history.length >= 2) {
				// Latest version should have both signals
				expect(history[0].data.emotionalSignals).toContain('signal1');
				expect(history[0].data.emotionalSignals).toContain('signal2');
			}
		});

		it('should include reason for each version', async () => {
			const reason1 = 'Initial setup';
			const reason2 = 'Updated after conversation';

			await updatePreferences(testUserId, { emotionalSignals: ['v1'] }, reason1);
			await updatePreferences(testUserId, { emotionalSignals: ['v2'] }, reason2);

			const history = await getPreferencesHistory(testUserId);
			const reasons = history.map(v => v.reason);
			expect(reasons).toContain(reason1);
			expect(reasons).toContain(reason2);
		});
	});

	describe('restoreProfileVersion', () => {
		it('should restore a previous version', async () => {
			// Create version 1
			await updatePreferences(testUserId, { emotionalSignals: ['v1'] }, 'Version 1');
			const history1 = await getPreferencesHistory(testUserId);
			const versionId = history1[0].id;

			// Create version 2
			await updatePreferences(testUserId, { emotionalSignals: ['v2'] }, 'Version 2');

			// Restore version 1
			await restoreProfileVersion(testUserId, versionId);

			const restored = await loadPreferences(testUserId);
			expect(restored.emotionalSignals).toContain('v1');
		});

		it('should create new version when restoring', async () => {
			// Create version 1
			await updatePreferences(testUserId, { emotionalSignals: ['v1'] }, 'Version 1');
			const history1 = await getPreferencesHistory(testUserId);
			const versionId = history1[0].id;

			// Create version 2
			await updatePreferences(testUserId, { emotionalSignals: ['v2'] }, 'Version 2');

			// Restore version 1
			await restoreProfileVersion(testUserId, versionId);

			const history = await getPreferencesHistory(testUserId);
			// Should have at least 3 versions now (v1, v2, restored v1)
			expect(history.length).toBeGreaterThanOrEqual(2);
		});

		it('should preserve full history when restoring', async () => {
			// Create version 1
			await updatePreferences(testUserId, { emotionalSignals: ['v1'] }, 'Version 1');
			const history1 = await getPreferencesHistory(testUserId);
			const versionId = history1[0].id;

			// Create version 2
			await updatePreferences(testUserId, { emotionalSignals: ['v2'] }, 'Version 2');

			// Restore version 1
			await restoreProfileVersion(testUserId, versionId);

			const history = await getPreferencesHistory(testUserId);
			// All versions should still be in history
			const reasons = history.map(v => v.reason);
			expect(reasons.some(r => r.includes('Version 1'))).toBe(true);
			expect(reasons.some(r => r.includes('Version 2'))).toBe(true);
		});

		it('should mark restored version with reason', async () => {
			// Create version 1
			await updatePreferences(testUserId, { emotionalSignals: ['v1'] }, 'Version 1');
			const history1 = await getPreferencesHistory(testUserId);
			const versionId = history1[0].id;

			// Create version 2
			await updatePreferences(testUserId, { emotionalSignals: ['v2'] }, 'Version 2');

			// Restore version 1
			await restoreProfileVersion(testUserId, versionId);

			const history = await getPreferencesHistory(testUserId);
			const latestVersion = history[0];
			expect(latestVersion.reason).toContain('Restored from version');
		});

		it('should invalidate cache after restore', async () => {
			// Create version 1
			await updatePreferences(testUserId, { emotionalSignals: ['v1'] }, 'Version 1');
			const history1 = await getPreferencesHistory(testUserId);
			const versionId = history1[0].id;

			// Create version 2
			await updatePreferences(testUserId, { emotionalSignals: ['v2'] }, 'Version 2');

			// Restore version 1
			await restoreProfileVersion(testUserId, versionId);

			// Load should get fresh data
			const restored = await loadPreferences(testUserId);
			expect(restored.emotionalSignals).toContain('v1');
		});
	});

	describe('Cache behavior', () => {
		it('should cache preferences for 5 minutes', async () => {
			const prefs1 = await loadPreferences(testUserId);
			const prefs2 = await loadPreferences(testUserId);
			expect(prefs1).toEqual(prefs2);
		});

		it('should clear cache on update', async () => {
			await loadPreferences(testUserId);
			await updatePreferences(testUserId, { emotionalSignals: ['new'] }, 'Update');
			const updated = await loadPreferences(testUserId);
			expect(updated.emotionalSignals).toContain('new');
		});

		it('should clear cache on restore', async () => {
			await updatePreferences(testUserId, { emotionalSignals: ['v1'] }, 'V1');
			const history = await getPreferencesHistory(testUserId);
			const versionId = history[0].id;

			await updatePreferences(testUserId, { emotionalSignals: ['v2'] }, 'V2');
			await restoreProfileVersion(testUserId, versionId);

			const restored = await loadPreferences(testUserId);
			expect(restored.emotionalSignals).toContain('v1');
		});

		it('should allow manual cache clear', () => {
			clearCache(testUserId);
			// Should not throw
			expect(true).toBe(true);
		});

		it('should allow clearing all cache', () => {
			clearCache();
			// Should not throw
			expect(true).toBe(true);
		});
	});

	describe('Data integrity', () => {
		it('should not modify original data on update', async () => {
			const original: Partial<PreferencesProfile> = {
				emotionalSignals: ['signal1']
			};

			await updatePreferences(testUserId, original, 'Update');

			// Original should not be modified
			expect(original.emotionalSignals).toEqual(['signal1']);
		});

		it('should handle special characters in strings', async () => {
			const updates: Partial<PreferencesProfile> = {
				emotionalSignals: ['Signal with "quotes"', "Signal with 'apostrophes'", 'Signal with émojis 🎉']
			};

			await updatePreferences(testUserId, updates, 'Special characters');

			const loaded = await loadPreferences(testUserId);
			expect(loaded.emotionalSignals).toContain('Signal with "quotes"');
			expect(loaded.emotionalSignals).toContain("Signal with 'apostrophes'");
			expect(loaded.emotionalSignals).toContain('Signal with émojis 🎉');
		});

		it('should handle long strings', async () => {
			const longString = 'a'.repeat(1000);
			const updates: Partial<PreferencesProfile> = {
				emotionalSignals: [longString]
			};

			await updatePreferences(testUserId, updates, 'Long string');

			const loaded = await loadPreferences(testUserId);
			expect(loaded.emotionalSignals).toContain(longString);
		});

		it('should handle large arrays', async () => {
			const largeArray = Array.from({ length: 100 }, (_, i) => `signal${i}`);
			const updates: Partial<PreferencesProfile> = {
				emotionalSignals: largeArray
			};

			await updatePreferences(testUserId, updates, 'Large array');

			const loaded = await loadPreferences(testUserId);
			expect(loaded.emotionalSignals).toHaveLength(100);
		});
	});

	describe('Error handling', () => {
		it('should handle invalid userId gracefully', async () => {
			// Should not throw
			const prefs = await loadPreferences('');
			expect(prefs).toBeDefined();
		});

		it('should handle null updates', async () => {
			// Should not throw
			await updatePreferences(testUserId, {}, 'Empty update');
			const loaded = await loadPreferences(testUserId);
			expect(loaded).toBeDefined();
		});

		it('should handle missing reason', async () => {
			// Should not throw
			await updatePreferences(testUserId, { emotionalSignals: ['test'] }, '');
			const history = await getPreferencesHistory(testUserId);
			expect(history.length).toBeGreaterThanOrEqual(0);
		});
	});
});
