import { getSupabase } from './supabase';

/**
 * Profile data types for preferences (female users) and personality (male users)
 */
export interface PreferencesProfile {
	emotionalSignals: string[];
	lifestyleSignals: string[];
	maturitySignals: string[];
	boundaries: string[];
	dealbreakers: string[];
	privateCompatibilityNotes: string[];
	updatedAt: number;
}

export interface PersonalityProfile {
	communicationStyle: string;
	personalityVibe: string;
	mattersMost: string;
	values: string[];
	datingPatterns: string[];
	redFlagsToAvoid: string[];
	updatedAt: number;
}

export interface ProfileVersion {
	id: string;
	version: number;
	data: PreferencesProfile | PersonalityProfile;
	reason: string;
	createdAt: number;
}

/**
 * In-memory cache for profile data to reduce database queries
 */
const profileCache = new Map<string, { data: PreferencesProfile | PersonalityProfile; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Clear cache entry if it has expired
 */
function isCacheExpired(timestamp: number): boolean {
	return Date.now() - timestamp > CACHE_TTL;
}

/**
 * Get cache key for a user's profile
 */
function getCacheKey(userId: string, profileType: 'preferences' | 'personality'): string {
	return `${userId}:${profileType}`;
}

/**
 * Load preferences.md for a female user from Supabase with caching
 */
export async function loadPreferences(userId: string): Promise<PreferencesProfile> {
	const cacheKey = getCacheKey(userId, 'preferences');
	const cached = profileCache.get(cacheKey);

	// Return cached data if still valid
	if (cached && !isCacheExpired(cached.timestamp)) {
		return cached.data as PreferencesProfile;
	}

	const supabase = getSupabase();

	// Fetch the latest version from Supabase
	const { data, error } = await supabase
		.from('ai_assistant_profiles')
		.select('data')
		.eq('user_id', userId)
		.eq('profile_type', 'preferences')
		.order('version', { ascending: false })
		.limit(1)
		.single();

	if (error) {
		if (error.code === 'PGRST116') {
			// No rows found - return default preferences
			const defaultPreferences: PreferencesProfile = {
				emotionalSignals: [],
				lifestyleSignals: [],
				maturitySignals: [],
				boundaries: [],
				dealbreakers: [],
				privateCompatibilityNotes: [],
				updatedAt: Date.now()
			};
			profileCache.set(cacheKey, { data: defaultPreferences, timestamp: Date.now() });
			return defaultPreferences;
		}
		throw new Error(`Failed to load preferences: ${error.message}`);
	}

	const preferences = data.data as unknown as PreferencesProfile;

	// Cache the result
	profileCache.set(cacheKey, { data: preferences, timestamp: Date.now() });

	return preferences;
}

/**
 * Load personality.md for a male user from Supabase with caching
 */
export async function loadPersonality(userId: string): Promise<PersonalityProfile> {
	const cacheKey = getCacheKey(userId, 'personality');
	const cached = profileCache.get(cacheKey);

	// Return cached data if still valid
	if (cached && !isCacheExpired(cached.timestamp)) {
		return cached.data as PersonalityProfile;
	}

	const supabase = getSupabase();

	// Fetch the latest version from Supabase
	const { data, error } = await supabase
		.from('ai_assistant_profiles')
		.select('data')
		.eq('user_id', userId)
		.eq('profile_type', 'personality')
		.order('version', { ascending: false })
		.limit(1)
		.single();

	if (error) {
		if (error.code === 'PGRST116') {
			// No rows found - return default personality
			const defaultPersonality: PersonalityProfile = {
				communicationStyle: '',
				personalityVibe: '',
				mattersMost: '',
				values: [],
				datingPatterns: [],
				redFlagsToAvoid: [],
				updatedAt: Date.now()
			};
			profileCache.set(cacheKey, { data: defaultPersonality, timestamp: Date.now() });
			return defaultPersonality;
		}
		throw new Error(`Failed to load personality: ${error.message}`);
	}

	const personality = data.data as unknown as PersonalityProfile;

	// Cache the result
	profileCache.set(cacheKey, { data: personality, timestamp: Date.now() });

	return personality;
}

/**
 * Update preferences.md with new data and create a new version
 */
export async function updatePreferences(
	userId: string,
	updates: Partial<PreferencesProfile>,
	reason: string
): Promise<void> {
	const supabase = getSupabase();

	// Load current preferences to merge with updates
	const current = await loadPreferences(userId);
	const updated: PreferencesProfile = {
		...current,
		...updates,
		updatedAt: Date.now()
	};

	// Get the next version number
	const { data: lastVersion } = await supabase
		.from('ai_assistant_profiles')
		.select('version')
		.eq('user_id', userId)
		.eq('profile_type', 'preferences')
		.order('version', { ascending: false })
		.limit(1)
		.single();

	const nextVersion = (lastVersion?.version ?? 0) + 1;

	// Insert new version
	const { error } = await supabase.from('ai_assistant_profiles').insert({
		user_id: userId,
		profile_type: 'preferences',
		data: updated as unknown as Record<string, unknown>,
		version: nextVersion,
		reason
	});

	if (error) {
		throw new Error(`Failed to update preferences: ${error.message}`);
	}

	// Invalidate cache
	const cacheKey = getCacheKey(userId, 'preferences');
	profileCache.delete(cacheKey);
}

/**
 * Update personality.md with new data and create a new version
 */
export async function updatePersonality(
	userId: string,
	updates: Partial<PersonalityProfile>,
	reason: string
): Promise<void> {
	const supabase = getSupabase();

	// Load current personality to merge with updates
	const current = await loadPersonality(userId);
	const updated: PersonalityProfile = {
		...current,
		...updates,
		updatedAt: Date.now()
	};

	// Get the next version number
	const { data: lastVersion } = await supabase
		.from('ai_assistant_profiles')
		.select('version')
		.eq('user_id', userId)
		.eq('profile_type', 'personality')
		.order('version', { ascending: false })
		.limit(1)
		.single();

	const nextVersion = (lastVersion?.version ?? 0) + 1;

	// Insert new version
	const { error } = await supabase.from('ai_assistant_profiles').insert({
		user_id: userId,
		profile_type: 'personality',
		data: updated as unknown as Record<string, unknown>,
		version: nextVersion,
		reason
	});

	if (error) {
		throw new Error(`Failed to update personality: ${error.message}`);
	}

	// Invalidate cache
	const cacheKey = getCacheKey(userId, 'personality');
	profileCache.delete(cacheKey);
}

/**
 * Get version history for preferences.md
 */
export async function getPreferencesHistory(userId: string): Promise<ProfileVersion[]> {
	const supabase = getSupabase();

	const { data, error } = await supabase
		.from('ai_assistant_profiles')
		.select('id, version, data, reason, created_at')
		.eq('user_id', userId)
		.eq('profile_type', 'preferences')
		.order('version', { ascending: false });

	if (error) {
		throw new Error(`Failed to get preferences history: ${error.message}`);
	}

	return (data || []).map((row) => ({
		id: row.id,
		version: row.version,
		data: row.data as unknown as PreferencesProfile,
		reason: row.reason || 'No reason provided',
		createdAt: new Date(row.created_at).getTime()
	}));
}

/**
 * Get version history for personality.md
 */
export async function getPersonalityHistory(userId: string): Promise<ProfileVersion[]> {
	const supabase = getSupabase();

	const { data, error } = await supabase
		.from('ai_assistant_profiles')
		.select('id, version, data, reason, created_at')
		.eq('user_id', userId)
		.eq('profile_type', 'personality')
		.order('version', { ascending: false });

	if (error) {
		throw new Error(`Failed to get personality history: ${error.message}`);
	}

	return (data || []).map((row) => ({
		id: row.id,
		version: row.version,
		data: row.data as unknown as PersonalityProfile,
		reason: row.reason || 'No reason provided',
		createdAt: new Date(row.created_at).getTime()
	}));
}

/**
 * Restore a previous version of preferences or personality
 */
export async function restoreProfileVersion(userId: string, versionId: string): Promise<void> {
	const supabase = getSupabase();

	// Get the version to restore
	const { data: versionToRestore, error: fetchError } = await supabase
		.from('ai_assistant_profiles')
		.select('profile_type, data, version')
		.eq('id', versionId)
		.eq('user_id', userId)
		.single();

	if (fetchError) {
		throw new Error(`Failed to find version to restore: ${fetchError.message}`);
	}

	const profileType = versionToRestore.profile_type as 'preferences' | 'personality';
	const restoredData = versionToRestore.data;

	// Get the next version number
	const { data: lastVersion } = await supabase
		.from('ai_assistant_profiles')
		.select('version')
		.eq('user_id', userId)
		.eq('profile_type', profileType)
		.order('version', { ascending: false })
		.limit(1)
		.single();

	const nextVersion = (lastVersion?.version ?? 0) + 1;

	// Insert new version with restored data
	const { error: insertError } = await supabase.from('ai_assistant_profiles').insert({
		user_id: userId,
		profile_type: profileType,
		data: restoredData,
		version: nextVersion,
		reason: `Restored from version ${versionToRestore.version}`
	});

	if (insertError) {
		throw new Error(`Failed to restore version: ${insertError.message}`);
	}

	// Invalidate cache
	const cacheKey = getCacheKey(userId, profileType);
	profileCache.delete(cacheKey);
}

/**
 * Clear cache for a specific user (useful for testing or manual cache invalidation)
 */
export function clearCache(userId?: string): void {
	if (userId) {
		profileCache.delete(getCacheKey(userId, 'preferences'));
		profileCache.delete(getCacheKey(userId, 'personality'));
	} else {
		profileCache.clear();
	}
}
