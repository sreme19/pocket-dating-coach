import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	loadSessionState,
	clearAllSessionCache,
	getCachedSessionState,
	persistSessionStateToLocalStorage,
	loadSessionStateFromLocalStorage,
	clearSessionStateFromLocalStorage
} from '../session-state-manager';
import type { AssistantType } from '../../types';

// Mock Supabase
vi.mock('../supabase', () => ({
	getSupabase: vi.fn(() => ({
		from: vi.fn((table) => ({
			select: vi.fn().mockReturnThis(),
			insert: vi.fn().mockReturnThis(),
			update: vi.fn().mockReturnThis(),
			eq: vi.fn().mockReturnThis(),
			single: vi.fn().mockResolvedValue({ data: null, error: null })
		}))
	}))
}));

// Mock Profile Service
vi.mock('../profile-service', () => ({
	loadPreferences: vi.fn().mockResolvedValue({}),
	loadPersonality: vi.fn().mockResolvedValue({}),
	clearCache: vi.fn()
}));

// Mock AI Assistant Manager
vi.mock('../ai-assistant-manager', () => ({
	getAssistantConfig: vi.fn().mockResolvedValue(null),
	getActiveAssistants: vi.fn().mockResolvedValue([])
}));

describe('Session State Integration Tests', () => {
	beforeEach(() => {
		clearAllSessionCache();
		localStorage.clear();
	});

	describe('Session caching behavior', () => {
		it('should cache session state after first load', async () => {
			const userId = 'user-123';
			const matchId = 'match-456';

			// First load
			const state1 = await loadSessionState(userId, matchId);
			expect(state1).toBeDefined();

			// Second load should return cached instance
			const state2 = await loadSessionState(userId, matchId);
			expect(state1).toBe(state2);
		});

		it('should maintain separate caches for different matches', async () => {
			const userId = 'user-123';
			const matchId1 = 'match-456';
			const matchId2 = 'match-789';

			const state1 = await loadSessionState(userId, matchId1);
			const state2 = await loadSessionState(userId, matchId2);

			expect(state1).not.toBe(state2);
			expect(state1.matchId).toBe(matchId1);
			expect(state2.matchId).toBe(matchId2);
		});

		it('should clear cache when requested', async () => {
			const userId = 'user-123';
			const matchId = 'match-456';

			// Load and cache
			await loadSessionState(userId, matchId);
			let cached = getCachedSessionState(userId, matchId);
			expect(cached).toBeDefined();

			// Clear cache
			clearAllSessionCache();
			cached = getCachedSessionState(userId, matchId);
			expect(cached).toBeUndefined();
		});
	});

	describe('localStorage persistence', () => {
		it('should persist and restore session state from localStorage', () => {
			const sessionState = {
				matchId: 'match-456',
				userId: 'user-123',
				activeAssistant: 'bestie' as AssistantType,
				conversationHistory: [
					{
						id: '1',
						role: 'user' as const,
						content: 'Hello',
						timestamp: Date.now()
					}
				],
				lastLoadedAt: Date.now()
			};

			// Persist
			persistSessionStateToLocalStorage(sessionState);

			// Restore
			const restored = loadSessionStateFromLocalStorage('user-123', 'match-456');

			expect(restored).toBeDefined();
			expect(restored?.userId).toBe('user-123');
			expect(restored?.matchId).toBe('match-456');
			expect(restored?.activeAssistant).toBe('bestie');
			expect(restored?.conversationHistory).toHaveLength(1);
		});

		it('should clear session state from localStorage', () => {
			const sessionState = {
				matchId: 'match-456',
				userId: 'user-123',
				activeAssistant: 'bestie' as AssistantType,
				conversationHistory: [],
				lastLoadedAt: Date.now()
			};

			persistSessionStateToLocalStorage(sessionState);
			clearSessionStateFromLocalStorage('user-123', 'match-456');

			const restored = loadSessionStateFromLocalStorage('user-123', 'match-456');
			expect(restored).toBeUndefined();
		});

		it('should handle invalid localStorage data gracefully', () => {
			localStorage.setItem('pdc_session_user-123_match-456', 'invalid json');

			const restored = loadSessionStateFromLocalStorage('user-123', 'match-456');
			expect(restored).toBeUndefined();
		});

		it('should handle missing localStorage data gracefully', () => {
			const restored = loadSessionStateFromLocalStorage('user-123', 'match-456');
			expect(restored).toBeUndefined();
		});
	});

	describe('Session state structure', () => {
		it('should load session with correct structure', async () => {
			const userId = 'user-123';
			const matchId = 'match-456';

			const sessionState = await loadSessionState(userId, matchId);

			expect(sessionState).toHaveProperty('matchId');
			expect(sessionState).toHaveProperty('userId');
			expect(sessionState).toHaveProperty('activeAssistant');
			expect(sessionState).toHaveProperty('conversationHistory');
			expect(sessionState).toHaveProperty('lastLoadedAt');

			expect(sessionState.matchId).toBe(matchId);
			expect(sessionState.userId).toBe(userId);
			expect(sessionState.activeAssistant).toBeNull();
			expect(Array.isArray(sessionState.conversationHistory)).toBe(true);
			expect(typeof sessionState.lastLoadedAt).toBe('number');
		});

		it('should initialize with empty conversation history', async () => {
			const userId = 'user-123';
			const matchId = 'match-456';

			const sessionState = await loadSessionState(userId, matchId);

			expect(sessionState.conversationHistory).toEqual([]);
		});
	});

	describe('Error handling', () => {
		it('should handle missing session gracefully', async () => {
			const userId = 'user-123';
			const matchId = 'match-456';

			const sessionState = await loadSessionState(userId, matchId);

			expect(sessionState).toBeDefined();
			expect(sessionState.activeAssistant).toBeNull();
			expect(sessionState.conversationHistory).toEqual([]);
		});

		it('should handle concurrent session loads', async () => {
			const userId = 'user-123';
			const matchId = 'match-456';

			// Load sequentially to ensure cache is populated
			const state1 = await loadSessionState(userId, matchId);

			// Load concurrently - these should all get the cached instance
			const [state2, state3] = await Promise.all([
				loadSessionState(userId, matchId),
				loadSessionState(userId, matchId)
			]);

			// All should be the same cached instance
			expect(state1).toBe(state2);
			expect(state2).toBe(state3);
		});
	});
});
