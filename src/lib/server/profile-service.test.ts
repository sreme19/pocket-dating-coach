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
	type PersonalityProfile,
	type ProfileVersion
} from './profile-service';
import * as supabaseModule from './supabase';

// Mock Supabase
vi.mock('./supabase', () => ({
	getSupabase: vi.fn()
}));

// ============================================================================
// TEST DATA
// ============================================================================

const mockUserId = 'test-user-123';
const mockVersionId = 'version-uuid-1';

const mockPreferencesData: PreferencesProfile = {
	emotionalSignals: ['Asks about my day', 'Shows vulnerability'],
	lifestyleSignals: ['Active and outdoorsy', 'Ambitious about career'],
	maturitySignals: ['Takes responsibility', 'Has long-term goals'],
	boundaries: ['No excessive drinking', 'Respectful of my time'],
	dealbreakers: ['Disrespectful to service workers', 'Still hung up on ex'],
	privateCompatibilityNotes: ['Seems like he values independence', 'His humor matches mine'],
	updatedAt: Date.now()
};

const mockPersonalityData: PersonalityProfile = {
	communicationStyle: 'direct',
	personalityVibe: 'ambitious',
	mattersMost: 'humor',
	values: ['Authenticity', 'Growth mindset', 'Loyalty'],
	datingPatterns: ['Prefers genuine conversation', 'Moves quickly from messaging to meeting'],
	redFlagsToAvoid: ['Overly focused on appearance', 'Dismissive of my career'],
	updatedAt: Date.now()
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function createMockSupabaseClient() {
	return {
		from: vi.fn().mockReturnThis(),
		select: vi.fn().mockReturnThis(),
		eq: vi.fn().mockReturnThis(),
		order: vi.fn().mockReturnThis(),
		limit: vi.fn().mockReturnThis(),
		single: vi.fn(),
		insert: vi.fn(),
		data: null,
		error: null
	};
}

// ============================================================================
// TESTS: loadPreferences()
// ============================================================================

describe('loadPreferences()', () => {
	let mockSupabase: any;

	beforeEach(() => {
		clearCache();
		mockSupabase = createMockSupabaseClient();
		vi.mocked(supabaseModule.getSupabase).mockReturnValue(mockSupabase);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('should load preferences from Supabase', async () => {
		mockSupabase.single.mockResolvedValue({
			data: { data: mockPreferencesData },
			error: null
		});

		const result = await loadPreferences(mockUserId);

		expect(result).toEqual(mockPreferencesData);
		expect(mockSupabase.from).toHaveBeenCalledWith('ai_assistant_profiles');
		expect(mockSupabase.select).toHaveBeenCalledWith('data');
		expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', mockUserId);
		expect(mockSupabase.eq).toHaveBeenCalledWith('profile_type', 'preferences');
	});

	it('should return default preferences when no profile exists', async () => {
		mockSupabase.single.mockResolvedValue({
			data: null,
			error: { code: 'PGRST116', message: 'No rows found' }
		});

		const result = await loadPreferences(mockUserId);

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

	it('should cache preferences for subsequent calls', async () => {
		mockSupabase.single.mockResolvedValue({
			data: { data: mockPreferencesData },
			error: null
		});

		const result1 = await loadPreferences(mockUserId);
		const result2 = await loadPreferences(mockUserId);

		expect(result1).toEqual(result2);
		expect(mockSupabase.single).toHaveBeenCalledTimes(1);
	});

	it('should throw error on database failure', async () => {
		mockSupabase.single.mockResolvedValue({
			data: null,
			error: { code: 'PGRST999', message: 'Database error' }
		});

		await expect(loadPreferences(mockUserId)).rejects.toThrow('Failed to load preferences');
	});

	it('should order by version descending to get latest', async () => {
		mockSupabase.single.mockResolvedValue({
			data: { data: mockPreferencesData },
			error: null
		});

		await loadPreferences(mockUserId);

		expect(mockSupabase.order).toHaveBeenCalledWith('version', { ascending: false });
		expect(mockSupabase.limit).toHaveBeenCalledWith(1);
	});
});

// ============================================================================
// TESTS: loadPersonality()
// ============================================================================

describe('loadPersonality()', () => {
	let mockSupabase: any;

	beforeEach(() => {
		clearCache();
		mockSupabase = createMockSupabaseClient();
		vi.mocked(supabaseModule.getSupabase).mockReturnValue(mockSupabase);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('should load personality from Supabase', async () => {
		mockSupabase.single.mockResolvedValue({
			data: { data: mockPersonalityData },
			error: null
		});

		const result = await loadPersonality(mockUserId);

		expect(result).toEqual(mockPersonalityData);
		expect(mockSupabase.from).toHaveBeenCalledWith('ai_assistant_profiles');
		expect(mockSupabase.select).toHaveBeenCalledWith('data');
		expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', mockUserId);
		expect(mockSupabase.eq).toHaveBeenCalledWith('profile_type', 'personality');
	});

	it('should return default personality when no profile exists', async () => {
		mockSupabase.single.mockResolvedValue({
			data: null,
			error: { code: 'PGRST116', message: 'No rows found' }
		});

		const result = await loadPersonality(mockUserId);

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

	it('should cache personality for subsequent calls', async () => {
		mockSupabase.single.mockResolvedValue({
			data: { data: mockPersonalityData },
			error: null
		});

		const result1 = await loadPersonality(mockUserId);
		const result2 = await loadPersonality(mockUserId);

		expect(result1).toEqual(result2);
		expect(mockSupabase.single).toHaveBeenCalledTimes(1);
	});

	it('should throw error on database failure', async () => {
		mockSupabase.single.mockResolvedValue({
			data: null,
			error: { code: 'PGRST999', message: 'Database error' }
		});

		await expect(loadPersonality(mockUserId)).rejects.toThrow('Failed to load personality');
	});
});


// ============================================================================
// TESTS: updatePreferences()
// ============================================================================

describe('updatePreferences()', () => {
	let mockSupabase: any;

	beforeEach(() => {
		clearCache();
		mockSupabase = createMockSupabaseClient();
		vi.mocked(supabaseModule.getSupabase).mockReturnValue(mockSupabase);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('should create new version with updated preferences', async () => {
		// Mock loading current preferences
		mockSupabase.single.mockResolvedValueOnce({
			data: { data: mockPreferencesData },
			error: null
		});

		// Mock getting last version
		mockSupabase.single.mockResolvedValueOnce({
			data: { version: 1 },
			error: null
		});

		// Mock insert
		mockSupabase.insert.mockResolvedValue({
			data: null,
			error: null
		});

		const updates = { emotionalSignals: ['New signal'] };
		await updatePreferences(mockUserId, updates, 'Updated based on conversation');

		expect(mockSupabase.insert).toHaveBeenCalled();
		const insertCall = mockSupabase.insert.mock.calls[0][0];
		expect(insertCall.user_id).toBe(mockUserId);
		expect(insertCall.profile_type).toBe('preferences');
		expect(insertCall.version).toBe(2);
		expect(insertCall.reason).toBe('Updated based on conversation');
		expect(insertCall.data.emotionalSignals).toContain('New signal');
	});

	it('should merge updates with existing preferences', async () => {
		mockSupabase.single.mockResolvedValueOnce({
			data: { data: mockPreferencesData },
			error: null
		});

		mockSupabase.single.mockResolvedValueOnce({
			data: { version: 1 },
			error: null
		});

		mockSupabase.insert.mockResolvedValue({
			data: null,
			error: null
		});

		const updates = { boundaries: ['New boundary'] };
		await updatePreferences(mockUserId, updates, 'Updated boundaries');

		const insertCall = mockSupabase.insert.mock.calls[0][0];
		expect(insertCall.data.emotionalSignals).toEqual(mockPreferencesData.emotionalSignals);
		expect(insertCall.data.boundaries).toContain('New boundary');
	});

	it('should increment version number', async () => {
		mockSupabase.single.mockResolvedValueOnce({
			data: { data: mockPreferencesData },
			error: null
		});

		mockSupabase.single.mockResolvedValueOnce({
			data: { version: 5 },
			error: null
		});

		mockSupabase.insert.mockResolvedValue({
			data: null,
			error: null
		});

		await updatePreferences(mockUserId, {}, 'Test');

		const insertCall = mockSupabase.insert.mock.calls[0][0];
		expect(insertCall.version).toBe(6);
	});

	it('should start version at 1 if no previous version exists', async () => {
		mockSupabase.single.mockResolvedValueOnce({
			data: { data: mockPreferencesData },
			error: null
		});

		mockSupabase.single.mockResolvedValueOnce({
			data: null,
			error: { code: 'PGRST116' }
		});

		mockSupabase.insert.mockResolvedValue({
			data: null,
			error: null
		});

		await updatePreferences(mockUserId, {}, 'First update');

		const insertCall = mockSupabase.insert.mock.calls[0][0];
		expect(insertCall.version).toBe(1);
	});

	it('should invalidate cache after update', async () => {
		mockSupabase.single.mockResolvedValueOnce({
			data: { data: mockPreferencesData },
			error: null
		});

		mockSupabase.single.mockResolvedValueOnce({
			data: { version: 1 },
			error: null
		});

		mockSupabase.insert.mockResolvedValue({
			data: null,
			error: null
		});

		// Load to cache
		await loadPreferences(mockUserId);
		expect(mockSupabase.single).toHaveBeenCalledTimes(1);

		// Update should invalidate cache
		await updatePreferences(mockUserId, {}, 'Test');

		// Next load should query database again
		mockSupabase.single.mockResolvedValueOnce({
			data: { data: { ...mockPreferencesData, emotionalSignals: ['Updated'] } },
			error: null
		});

		await loadPreferences(mockUserId);
		expect(mockSupabase.single).toHaveBeenCalledTimes(3);
	});

	it('should throw error on insert failure', async () => {
		mockSupabase.single.mockResolvedValueOnce({
			data: { data: mockPreferencesData },
			error: null
		});

		mockSupabase.single.mockResolvedValueOnce({
			data: { version: 1 },
			error: null
		});

		mockSupabase.insert.mockResolvedValue({
			data: null,
			error: { message: 'Insert failed' }
		});

		await expect(updatePreferences(mockUserId, {}, 'Test')).rejects.toThrow(
			'Failed to update preferences'
		);
	});

	it('should update updatedAt timestamp', async () => {
		mockSupabase.single.mockResolvedValueOnce({
			data: { data: mockPreferencesData },
			error: null
		});

		mockSupabase.single.mockResolvedValueOnce({
			data: { version: 1 },
			error: null
		});

		mockSupabase.insert.mockResolvedValue({
			data: null,
			error: null
		});

		const beforeTime = Date.now();
		await updatePreferences(mockUserId, {}, 'Test');
		const afterTime = Date.now();

		const insertCall = mockSupabase.insert.mock.calls[0][0];
		expect(insertCall.data.updatedAt).toBeGreaterThanOrEqual(beforeTime);
		expect(insertCall.data.updatedAt).toBeLessThanOrEqual(afterTime);
	});
});

// ============================================================================
// TESTS: updatePersonality()
// ============================================================================

describe('updatePersonality()', () => {
	let mockSupabase: any;

	beforeEach(() => {
		clearCache();
		mockSupabase = createMockSupabaseClient();
		vi.mocked(supabaseModule.getSupabase).mockReturnValue(mockSupabase);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('should create new version with updated personality', async () => {
		mockSupabase.single.mockResolvedValueOnce({
			data: { data: mockPersonalityData },
			error: null
		});

		mockSupabase.single.mockResolvedValueOnce({
			data: { version: 1 },
			error: null
		});

		mockSupabase.insert.mockResolvedValue({
			data: null,
			error: null
		});

		const updates = { communicationStyle: 'indirect' };
		await updatePersonality(mockUserId, updates, 'Updated communication style');

		expect(mockSupabase.insert).toHaveBeenCalled();
		const insertCall = mockSupabase.insert.mock.calls[0][0];
		expect(insertCall.user_id).toBe(mockUserId);
		expect(insertCall.profile_type).toBe('personality');
		expect(insertCall.version).toBe(2);
		expect(insertCall.data.communicationStyle).toBe('indirect');
	});

	it('should merge updates with existing personality', async () => {
		mockSupabase.single.mockResolvedValueOnce({
			data: { data: mockPersonalityData },
			error: null
		});

		mockSupabase.single.mockResolvedValueOnce({
			data: { version: 1 },
			error: null
		});

		mockSupabase.insert.mockResolvedValue({
			data: null,
			error: null
		});

		const updates = { values: ['New value'] };
		await updatePersonality(mockUserId, updates, 'Updated values');

		const insertCall = mockSupabase.insert.mock.calls[0][0];
		expect(insertCall.data.communicationStyle).toBe(mockPersonalityData.communicationStyle);
		expect(insertCall.data.values).toContain('New value');
	});

	it('should invalidate cache after update', async () => {
		mockSupabase.single.mockResolvedValueOnce({
			data: { data: mockPersonalityData },
			error: null
		});

		mockSupabase.single.mockResolvedValueOnce({
			data: { version: 1 },
			error: null
		});

		mockSupabase.insert.mockResolvedValue({
			data: null,
			error: null
		});

		await loadPersonality(mockUserId);
		expect(mockSupabase.single).toHaveBeenCalledTimes(1);

		await updatePersonality(mockUserId, {}, 'Test');

		mockSupabase.single.mockResolvedValueOnce({
			data: { data: mockPersonalityData },
			error: null
		});

		await loadPersonality(mockUserId);
		expect(mockSupabase.single).toHaveBeenCalledTimes(3);
	});
});


// ============================================================================
// TESTS: getPreferencesHistory()
// ============================================================================

describe('getPreferencesHistory()', () => {
	let mockSupabase: any;

	beforeEach(() => {
		clearCache();
		mockSupabase = createMockSupabaseClient();
		vi.mocked(supabaseModule.getSupabase).mockReturnValue(mockSupabase);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('should retrieve all preference versions', async () => {
		const mockVersions = [
			{
				id: 'v1',
				version: 2,
				data: mockPreferencesData,
				reason: 'Updated signals',
				created_at: new Date().toISOString()
			},
			{
				id: 'v2',
				version: 1,
				data: mockPreferencesData,
				reason: 'Initial creation',
				created_at: new Date().toISOString()
			}
		];

		mockSupabase.select.mockReturnThis();
		mockSupabase.eq.mockReturnThis();
		mockSupabase.order.mockResolvedValue({
			data: mockVersions,
			error: null
		});

		const result = await getPreferencesHistory(mockUserId);

		expect(result).toHaveLength(2);
		expect(result[0].version).toBe(2);
		expect(result[1].version).toBe(1);
	});

	it('should order versions by version descending', async () => {
		mockSupabase.select.mockReturnThis();
		mockSupabase.eq.mockReturnThis();
		mockSupabase.order.mockResolvedValue({
			data: [],
			error: null
		});

		await getPreferencesHistory(mockUserId);

		expect(mockSupabase.order).toHaveBeenCalledWith('version', { ascending: false });
	});

	it('should return empty array when no history exists', async () => {
		mockSupabase.select.mockReturnThis();
		mockSupabase.eq.mockReturnThis();
		mockSupabase.order.mockResolvedValue({
			data: [],
			error: null
		});

		const result = await getPreferencesHistory(mockUserId);

		expect(result).toEqual([]);
	});

	it('should map database rows to ProfileVersion objects', async () => {
		const now = Date.now();
		const mockVersions = [
			{
				id: 'v1',
				version: 1,
				data: mockPreferencesData,
				reason: 'Initial',
				created_at: new Date(now).toISOString()
			}
		];

		mockSupabase.select.mockReturnThis();
		mockSupabase.eq.mockReturnThis();
		mockSupabase.order.mockResolvedValue({
			data: mockVersions,
			error: null
		});

		const result = await getPreferencesHistory(mockUserId);

		expect(result[0]).toEqual({
			id: 'v1',
			version: 1,
			data: mockPreferencesData,
			reason: 'Initial',
			createdAt: expect.any(Number)
		});
	});

	it('should use default reason if not provided', async () => {
		const mockVersions = [
			{
				id: 'v1',
				version: 1,
				data: mockPreferencesData,
				reason: null,
				created_at: new Date().toISOString()
			}
		];

		mockSupabase.select.mockReturnThis();
		mockSupabase.eq.mockReturnThis();
		mockSupabase.order.mockResolvedValue({
			data: mockVersions,
			error: null
		});

		const result = await getPreferencesHistory(mockUserId);

		expect(result[0].reason).toBe('No reason provided');
	});

	it('should throw error on database failure', async () => {
		mockSupabase.select.mockReturnThis();
		mockSupabase.eq.mockReturnThis();
		mockSupabase.order.mockResolvedValue({
			data: null,
			error: { message: 'Database error' }
		});

		await expect(getPreferencesHistory(mockUserId)).rejects.toThrow(
			'Failed to get preferences history'
		);
	});
});

// ============================================================================
// TESTS: getPersonalityHistory()
// ============================================================================

describe('getPersonalityHistory()', () => {
	let mockSupabase: any;

	beforeEach(() => {
		clearCache();
		mockSupabase = createMockSupabaseClient();
		vi.mocked(supabaseModule.getSupabase).mockReturnValue(mockSupabase);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('should retrieve all personality versions', async () => {
		const mockVersions = [
			{
				id: 'v1',
				version: 2,
				data: mockPersonalityData,
				reason: 'Updated values',
				created_at: new Date().toISOString()
			},
			{
				id: 'v2',
				version: 1,
				data: mockPersonalityData,
				reason: 'Initial creation',
				created_at: new Date().toISOString()
			}
		];

		mockSupabase.select.mockReturnThis();
		mockSupabase.eq.mockReturnThis();
		mockSupabase.order.mockResolvedValue({
			data: mockVersions,
			error: null
		});

		const result = await getPersonalityHistory(mockUserId);

		expect(result).toHaveLength(2);
		expect(result[0].version).toBe(2);
		expect(result[1].version).toBe(1);
	});

	it('should order versions by version descending', async () => {
		mockSupabase.select.mockReturnThis();
		mockSupabase.eq.mockReturnThis();
		mockSupabase.order.mockResolvedValue({
			data: [],
			error: null
		});

		await getPersonalityHistory(mockUserId);

		expect(mockSupabase.order).toHaveBeenCalledWith('version', { ascending: false });
	});

	it('should return empty array when no history exists', async () => {
		mockSupabase.select.mockReturnThis();
		mockSupabase.eq.mockReturnThis();
		mockSupabase.order.mockResolvedValue({
			data: [],
			error: null
		});

		const result = await getPersonalityHistory(mockUserId);

		expect(result).toEqual([]);
	});
});

// ============================================================================
// TESTS: restoreProfileVersion()
// ============================================================================

describe('restoreProfileVersion()', () => {
	let mockSupabase: any;

	beforeEach(() => {
		clearCache();
		mockSupabase = createMockSupabaseClient();
		vi.mocked(supabaseModule.getSupabase).mockReturnValue(mockSupabase);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('should restore a previous preferences version', async () => {
		const oldPreferences = {
			...mockPreferencesData,
			emotionalSignals: ['Old signal']
		};

		// Mock fetching version to restore
		mockSupabase.single.mockResolvedValueOnce({
			data: {
				profile_type: 'preferences',
				data: oldPreferences,
				version: 1
			},
			error: null
		});

		// Mock getting last version
		mockSupabase.single.mockResolvedValueOnce({
			data: { version: 2 },
			error: null
		});

		// Mock insert
		mockSupabase.insert.mockResolvedValue({
			data: null,
			error: null
		});

		await restoreProfileVersion(mockUserId, mockVersionId);

		const insertCall = mockSupabase.insert.mock.calls[0][0];
		expect(insertCall.data).toEqual(oldPreferences);
		expect(insertCall.version).toBe(3);
		expect(insertCall.reason).toContain('Restored from version 1');
	});

	it('should restore a previous personality version', async () => {
		const oldPersonality = {
			...mockPersonalityData,
			communicationStyle: 'indirect'
		};

		mockSupabase.single.mockResolvedValueOnce({
			data: {
				profile_type: 'personality',
				data: oldPersonality,
				version: 1
			},
			error: null
		});

		mockSupabase.single.mockResolvedValueOnce({
			data: { version: 2 },
			error: null
		});

		mockSupabase.insert.mockResolvedValue({
			data: null,
			error: null
		});

		await restoreProfileVersion(mockUserId, mockVersionId);

		const insertCall = mockSupabase.insert.mock.calls[0][0];
		expect(insertCall.profile_type).toBe('personality');
		expect(insertCall.data.communicationStyle).toBe('indirect');
	});

	it('should create new version with restored data', async () => {
		mockSupabase.single.mockResolvedValueOnce({
			data: {
				profile_type: 'preferences',
				data: mockPreferencesData,
				version: 1
			},
			error: null
		});

		mockSupabase.single.mockResolvedValueOnce({
			data: { version: 5 },
			error: null
		});

		mockSupabase.insert.mockResolvedValue({
			data: null,
			error: null
		});

		await restoreProfileVersion(mockUserId, mockVersionId);

		const insertCall = mockSupabase.insert.mock.calls[0][0];
		expect(insertCall.version).toBe(6);
		expect(insertCall.reason).toContain('Restored from version 1');
	});

	it('should invalidate cache after restore', async () => {
		mockSupabase.single.mockResolvedValueOnce({
			data: { data: mockPreferencesData },
			error: null
		});

		await loadPreferences(mockUserId);

		mockSupabase.single.mockResolvedValueOnce({
			data: {
				profile_type: 'preferences',
				data: mockPreferencesData,
				version: 1
			},
			error: null
		});

		mockSupabase.single.mockResolvedValueOnce({
			data: { version: 1 },
			error: null
		});

		mockSupabase.insert.mockResolvedValue({
			data: null,
			error: null
		});

		await restoreProfileVersion(mockUserId, mockVersionId);

		mockSupabase.single.mockResolvedValueOnce({
			data: { data: mockPreferencesData },
			error: null
		});

		await loadPreferences(mockUserId);
		expect(mockSupabase.single).toHaveBeenCalledTimes(4);
	});

	it('should throw error if version not found', async () => {
		mockSupabase.single.mockResolvedValueOnce({
			data: null,
			error: { message: 'Not found' }
		});

		await expect(restoreProfileVersion(mockUserId, mockVersionId)).rejects.toThrow(
			'Failed to find version to restore'
		);
	});

	it('should throw error on insert failure', async () => {
		mockSupabase.single.mockResolvedValueOnce({
			data: {
				profile_type: 'preferences',
				data: mockPreferencesData,
				version: 1
			},
			error: null
		});

		mockSupabase.single.mockResolvedValueOnce({
			data: { version: 1 },
			error: null
		});

		mockSupabase.insert.mockResolvedValue({
			data: null,
			error: { message: 'Insert failed' }
		});

		await expect(restoreProfileVersion(mockUserId, mockVersionId)).rejects.toThrow(
			'Failed to restore version'
		);
	});
});


// ============================================================================
// TESTS: Caching Behavior and TTL
// ============================================================================

describe('Caching Behavior and TTL', () => {
	let mockSupabase: any;

	beforeEach(() => {
		clearCache();
		mockSupabase = createMockSupabaseClient();
		vi.mocked(supabaseModule.getSupabase).mockReturnValue(mockSupabase);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('should cache preferences for 5 minutes', async () => {
		mockSupabase.single.mockResolvedValue({
			data: { data: mockPreferencesData },
			error: null
		});

		// First call - should hit database
		await loadPreferences(mockUserId);
		expect(mockSupabase.single).toHaveBeenCalledTimes(1);

		// Second call within 5 minutes - should use cache
		await loadPreferences(mockUserId);
		expect(mockSupabase.single).toHaveBeenCalledTimes(1);
	});

	it('should cache personality for 5 minutes', async () => {
		mockSupabase.single.mockResolvedValue({
			data: { data: mockPersonalityData },
			error: null
		});

		await loadPersonality(mockUserId);
		expect(mockSupabase.single).toHaveBeenCalledTimes(1);

		await loadPersonality(mockUserId);
		expect(mockSupabase.single).toHaveBeenCalledTimes(1);
	});

	it('should maintain separate caches for preferences and personality', async () => {
		mockSupabase.single.mockResolvedValueOnce({
			data: { data: mockPreferencesData },
			error: null
		});

		mockSupabase.single.mockResolvedValueOnce({
			data: { data: mockPersonalityData },
			error: null
		});

		await loadPreferences(mockUserId);
		await loadPersonality(mockUserId);

		expect(mockSupabase.single).toHaveBeenCalledTimes(2);
	});

	it('should maintain separate caches for different users', async () => {
		const userId2 = 'test-user-456';

		mockSupabase.single.mockResolvedValueOnce({
			data: { data: mockPreferencesData },
			error: null
		});

		mockSupabase.single.mockResolvedValueOnce({
			data: { data: mockPreferencesData },
			error: null
		});

		await loadPreferences(mockUserId);
		await loadPreferences(userId2);

		expect(mockSupabase.single).toHaveBeenCalledTimes(2);
	});
});

// ============================================================================
// TESTS: Edge Cases and Error Handling
// ============================================================================

describe('Edge Cases and Error Handling', () => {
	let mockSupabase: any;

	beforeEach(() => {
		clearCache();
		mockSupabase = createMockSupabaseClient();
		vi.mocked(supabaseModule.getSupabase).mockReturnValue(mockSupabase);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('should handle empty preferences arrays', async () => {
		const emptyPreferences: PreferencesProfile = {
			emotionalSignals: [],
			lifestyleSignals: [],
			maturitySignals: [],
			boundaries: [],
			dealbreakers: [],
			privateCompatibilityNotes: [],
			updatedAt: Date.now()
		};

		mockSupabase.single.mockResolvedValue({
			data: { data: emptyPreferences },
			error: null
		});

		const result = await loadPreferences(mockUserId);

		expect(result.emotionalSignals).toEqual([]);
		expect(result.boundaries).toEqual([]);
	});

	it('should handle empty personality arrays', async () => {
		const emptyPersonality: PersonalityProfile = {
			communicationStyle: '',
			personalityVibe: '',
			mattersMost: '',
			values: [],
			datingPatterns: [],
			redFlagsToAvoid: [],
			updatedAt: Date.now()
		};

		mockSupabase.single.mockResolvedValue({
			data: { data: emptyPersonality },
			error: null
		});

		const result = await loadPersonality(mockUserId);

		expect(result.values).toEqual([]);
		expect(result.communicationStyle).toBe('');
	});

	it('should handle missing profile data gracefully', async () => {
		mockSupabase.single.mockResolvedValue({
			data: null,
			error: { code: 'PGRST116' }
		});

		const prefs = await loadPreferences(mockUserId);
		const pers = await loadPersonality(mockUserId);

		expect(prefs).toBeDefined();
		expect(pers).toBeDefined();
		expect(prefs.emotionalSignals).toEqual([]);
		expect(pers.values).toEqual([]);
	});

	it('should handle partial updates', async () => {
		mockSupabase.single.mockResolvedValueOnce({
			data: { data: mockPreferencesData },
			error: null
		});

		mockSupabase.single.mockResolvedValueOnce({
			data: { version: 1 },
			error: null
		});

		mockSupabase.insert.mockResolvedValue({
			data: null,
			error: null
		});

		const partialUpdate = { emotionalSignals: ['New signal'] };
		await updatePreferences(mockUserId, partialUpdate, 'Partial update');

		const insertCall = mockSupabase.insert.mock.calls[0][0];
		expect(insertCall.data.emotionalSignals).toContain('New signal');
		expect(insertCall.data.lifestyleSignals).toEqual(mockPreferencesData.lifestyleSignals);
	});

	it('should handle very long arrays in preferences', async () => {
		const longPreferences: PreferencesProfile = {
			...mockPreferencesData,
			emotionalSignals: Array(100).fill('Signal')
		};

		mockSupabase.single.mockResolvedValue({
			data: { data: longPreferences },
			error: null
		});

		const result = await loadPreferences(mockUserId);

		expect(result.emotionalSignals).toHaveLength(100);
	});

	it('should handle special characters in strings', async () => {
		const specialPreferences: PreferencesProfile = {
			...mockPreferencesData,
			boundaries: ['No "excessive" drinking', "Respectful of my time's value"]
		};

		mockSupabase.single.mockResolvedValue({
			data: { data: specialPreferences },
			error: null
		});

		const result = await loadPreferences(mockUserId);

		expect(result.boundaries).toContain('No "excessive" drinking');
		expect(result.boundaries).toContain("Respectful of my time's value");
	});
});

// ============================================================================
// TESTS: Version History Ordering
// ============================================================================

describe('Version History Ordering', () => {
	let mockSupabase: any;

	beforeEach(() => {
		clearCache();
		mockSupabase = createMockSupabaseClient();
		vi.mocked(supabaseModule.getSupabase).mockReturnValue(mockSupabase);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('should return preferences history in descending version order', async () => {
		const mockVersions = [
			{
				id: 'v3',
				version: 3,
				data: mockPreferencesData,
				reason: 'Third update',
				created_at: new Date(Date.now() + 2000).toISOString()
			},
			{
				id: 'v2',
				version: 2,
				data: mockPreferencesData,
				reason: 'Second update',
				created_at: new Date(Date.now() + 1000).toISOString()
			},
			{
				id: 'v1',
				version: 1,
				data: mockPreferencesData,
				reason: 'First update',
				created_at: new Date().toISOString()
			}
		];

		mockSupabase.select.mockReturnThis();
		mockSupabase.eq.mockReturnThis();
		mockSupabase.order.mockResolvedValue({
			data: mockVersions,
			error: null
		});

		const result = await getPreferencesHistory(mockUserId);

		expect(result[0].version).toBe(3);
		expect(result[1].version).toBe(2);
		expect(result[2].version).toBe(1);
	});

	it('should return personality history in descending version order', async () => {
		const mockVersions = [
			{
				id: 'v2',
				version: 2,
				data: mockPersonalityData,
				reason: 'Second update',
				created_at: new Date(Date.now() + 1000).toISOString()
			},
			{
				id: 'v1',
				version: 1,
				data: mockPersonalityData,
				reason: 'First update',
				created_at: new Date().toISOString()
			}
		];

		mockSupabase.select.mockReturnThis();
		mockSupabase.eq.mockReturnThis();
		mockSupabase.order.mockResolvedValue({
			data: mockVersions,
			error: null
		});

		const result = await getPersonalityHistory(mockUserId);

		expect(result[0].version).toBe(2);
		expect(result[1].version).toBe(1);
	});
});

// ============================================================================
// TESTS: Profile Restoration Logic
// ============================================================================

describe('Profile Restoration Logic', () => {
	let mockSupabase: any;

	beforeEach(() => {
		clearCache();
		mockSupabase = createMockSupabaseClient();
		vi.mocked(supabaseModule.getSupabase).mockReturnValue(mockSupabase);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('should restore to exact previous state', async () => {
		const previousState: PreferencesProfile = {
			emotionalSignals: ['Old signal 1', 'Old signal 2'],
			lifestyleSignals: ['Old lifestyle'],
			maturitySignals: [],
			boundaries: ['Old boundary'],
			dealbreakers: [],
			privateCompatibilityNotes: [],
			updatedAt: 1000
		};

		mockSupabase.single.mockResolvedValueOnce({
			data: {
				profile_type: 'preferences',
				data: previousState,
				version: 1
			},
			error: null
		});

		mockSupabase.single.mockResolvedValueOnce({
			data: { version: 2 },
			error: null
		});

		mockSupabase.insert.mockResolvedValue({
			data: null,
			error: null
		});

		await restoreProfileVersion(mockUserId, mockVersionId);

		const insertCall = mockSupabase.insert.mock.calls[0][0];
		expect(insertCall.data).toEqual(previousState);
	});

	it('should create new version entry when restoring', async () => {
		mockSupabase.single.mockResolvedValueOnce({
			data: {
				profile_type: 'preferences',
				data: mockPreferencesData,
				version: 1
			},
			error: null
		});

		mockSupabase.single.mockResolvedValueOnce({
			data: { version: 5 },
			error: null
		});

		mockSupabase.insert.mockResolvedValue({
			data: null,
			error: null
		});

		await restoreProfileVersion(mockUserId, mockVersionId);

		const insertCall = mockSupabase.insert.mock.calls[0][0];
		expect(insertCall.version).toBe(6);
		expect(insertCall.reason).toContain('Restored from version 1');
	});

	it('should preserve original version data', async () => {
		const originalData: PreferencesProfile = {
			emotionalSignals: ['Original signal'],
			lifestyleSignals: [],
			maturitySignals: [],
			boundaries: [],
			dealbreakers: [],
			privateCompatibilityNotes: [],
			updatedAt: 1000
		};

		mockSupabase.single.mockResolvedValueOnce({
			data: {
				profile_type: 'preferences',
				data: originalData,
				version: 1
			},
			error: null
		});

		mockSupabase.single.mockResolvedValueOnce({
			data: { version: 2 },
			error: null
		});

		mockSupabase.insert.mockResolvedValue({
			data: null,
			error: null
		});

		await restoreProfileVersion(mockUserId, mockVersionId);

		const insertCall = mockSupabase.insert.mock.calls[0][0];
		expect(insertCall.data.emotionalSignals).toEqual(['Original signal']);
	});
});

// ============================================================================
// TESTS: Default Values for Missing Profiles
// ============================================================================

describe('Default Values for Missing Profiles', () => {
	let mockSupabase: any;

	beforeEach(() => {
		clearCache();
		mockSupabase = createMockSupabaseClient();
		vi.mocked(supabaseModule.getSupabase).mockReturnValue(mockSupabase);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('should return default preferences structure', async () => {
		mockSupabase.single.mockResolvedValue({
			data: null,
			error: { code: 'PGRST116' }
		});

		const result = await loadPreferences(mockUserId);

		expect(result).toHaveProperty('emotionalSignals');
		expect(result).toHaveProperty('lifestyleSignals');
		expect(result).toHaveProperty('maturitySignals');
		expect(result).toHaveProperty('boundaries');
		expect(result).toHaveProperty('dealbreakers');
		expect(result).toHaveProperty('privateCompatibilityNotes');
		expect(result).toHaveProperty('updatedAt');
	});

	it('should return default personality structure', async () => {
		mockSupabase.single.mockResolvedValue({
			data: null,
			error: { code: 'PGRST116' }
		});

		const result = await loadPersonality(mockUserId);

		expect(result).toHaveProperty('communicationStyle');
		expect(result).toHaveProperty('personalityVibe');
		expect(result).toHaveProperty('mattersMost');
		expect(result).toHaveProperty('values');
		expect(result).toHaveProperty('datingPatterns');
		expect(result).toHaveProperty('redFlagsToAvoid');
		expect(result).toHaveProperty('updatedAt');
	});

	it('should have empty arrays in default preferences', async () => {
		mockSupabase.single.mockResolvedValue({
			data: null,
			error: { code: 'PGRST116' }
		});

		const result = await loadPreferences(mockUserId);

		expect(Array.isArray(result.emotionalSignals)).toBe(true);
		expect(Array.isArray(result.lifestyleSignals)).toBe(true);
		expect(Array.isArray(result.boundaries)).toBe(true);
		expect(Array.isArray(result.dealbreakers)).toBe(true);
	});

	it('should have empty strings in default personality', async () => {
		mockSupabase.single.mockResolvedValue({
			data: null,
			error: { code: 'PGRST116' }
		});

		const result = await loadPersonality(mockUserId);

		expect(result.communicationStyle).toBe('');
		expect(result.personalityVibe).toBe('');
		expect(result.mattersMost).toBe('');
	});

	it('should have current timestamp in default profiles', async () => {
		mockSupabase.single.mockResolvedValue({
			data: null,
			error: { code: 'PGRST116' }
		});

		const beforeTime = Date.now();
		const result = await loadPreferences(mockUserId);
		const afterTime = Date.now();

		expect(result.updatedAt).toBeGreaterThanOrEqual(beforeTime);
		expect(result.updatedAt).toBeLessThanOrEqual(afterTime);
	});
});

// ============================================================================
// TESTS: Cache Invalidation
// ============================================================================

describe('Cache Invalidation', () => {
	let mockSupabase: any;

	beforeEach(() => {
		clearCache();
		mockSupabase = createMockSupabaseClient();
		vi.mocked(supabaseModule.getSupabase).mockReturnValue(mockSupabase);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('should clear specific user cache', async () => {
		mockSupabase.single.mockResolvedValue({
			data: { data: mockPreferencesData },
			error: null
		});

		await loadPreferences(mockUserId);
		expect(mockSupabase.single).toHaveBeenCalledTimes(1);

		clearCache(mockUserId);

		mockSupabase.single.mockResolvedValue({
			data: { data: mockPreferencesData },
			error: null
		});

		await loadPreferences(mockUserId);
		expect(mockSupabase.single).toHaveBeenCalledTimes(2);
	});

	it('should clear all cache when no user specified', async () => {
		const userId2 = 'test-user-456';

		mockSupabase.single.mockResolvedValue({
			data: { data: mockPreferencesData },
			error: null
		});

		await loadPreferences(mockUserId);
		await loadPreferences(userId2);
		expect(mockSupabase.single).toHaveBeenCalledTimes(2);

		clearCache();

		mockSupabase.single.mockResolvedValue({
			data: { data: mockPreferencesData },
			error: null
		});

		await loadPreferences(mockUserId);
		await loadPreferences(userId2);
		expect(mockSupabase.single).toHaveBeenCalledTimes(4);
	});

	it('should clear both preferences and personality cache for user', async () => {
		mockSupabase.single.mockResolvedValue({
			data: { data: mockPreferencesData },
			error: null
		});

		await loadPreferences(mockUserId);
		mockSupabase.single.mockResolvedValue({
			data: { data: mockPersonalityData },
			error: null
		});
		await loadPersonality(mockUserId);
		expect(mockSupabase.single).toHaveBeenCalledTimes(2);

		clearCache(mockUserId);

		mockSupabase.single.mockResolvedValue({
			data: { data: mockPreferencesData },
			error: null
		});
		await loadPreferences(mockUserId);
		mockSupabase.single.mockResolvedValue({
			data: { data: mockPersonalityData },
			error: null
		});
		await loadPersonality(mockUserId);
		expect(mockSupabase.single).toHaveBeenCalledTimes(4);
	});
});
