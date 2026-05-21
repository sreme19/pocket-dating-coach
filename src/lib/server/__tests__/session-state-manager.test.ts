import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	loadSessionState,
	saveConversationHistory,
	addMessageToHistory,
	switchAssistant,
	clearSessionState,
	clearAllSessionCache,
	getCachedSessionState,
	persistSessionStateToLocalStorage,
	loadSessionStateFromLocalStorage,
	clearSessionStateFromLocalStorage
} from '../session-state-manager';
import type { ChatMessage, AssistantType } from '../../types';

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

// Mock AI Assistant Manager
vi.mock('../ai-assistant-manager', () => ({
	getAssistantConfig: vi.fn().mockResolvedValue(null),
	getActiveAssistants: vi.fn().mockResolvedValue([])
}));

describe('Session State Manager', () => {
	beforeEach(() => {
		clearAllSessionCache();
		localStorage.clear();
	});

	describe('loadSessionState', () => {
		it('should load session state for a match', async () => {
			const userId = 'user-123';
			const matchId = 'match-456';

			const sessionState = await loadSessionState(userId, matchId);

			expect(sessionState).toBeDefined();
			expect(sessionState.userId).toBe(userId);
			expect(sessionState.matchId).toBe(matchId);
			expect(sessionState.activeAssistant).toBeNull();
			expect(Array.isArray(sessionState.conversationHistory)).toBe(true);
		});

		it('should cache session state', async () => {
			const userId = 'user-123';
			const matchId = 'match-456';

			const state1 = await loadSessionState(userId, matchId);
			const state2 = await loadSessionState(userId, matchId);

			expect(state1).toBe(state2);
		});

		it('should invalidate cache after 1 minute', async () => {
			const userId = 'user-123';
			const matchId = 'match-456';

			const state1 = await loadSessionState(userId, matchId);
			const originalTime = state1.lastLoadedAt;

			// Simulate time passing
			vi.useFakeTimers();
			vi.advanceTimersByTime(61000);

			const state2 = await loadSessionState(userId, matchId);

			expect(state2.lastLoadedAt).toBeGreaterThan(originalTime);

			vi.useRealTimers();
		});
	});

	describe('saveConversationHistory', () => {
		it('should save conversation history', async () => {
			const userId = 'user-123';
			const matchId = 'match-456';
			const assistantType: AssistantType = 'bestie';
			const messages: ChatMessage[] = [
				{
					id: '1',
					role: 'user',
					content: 'Hello',
					timestamp: Date.now()
				}
			];

			await saveConversationHistory(userId, matchId, assistantType, messages);

			// Cache should be invalidated
			const cached = getCachedSessionState(userId, matchId);
			expect(cached).toBeUndefined();
		});
	});

	describe('addMessageToHistory', () => {
		it('should add a message to conversation history', async () => {
			const userId = 'user-123';
			const matchId = 'match-456';
			const assistantType: AssistantType = 'bestie';
			const message: ChatMessage = {
				id: '1',
				role: 'user',
				content: 'Hello',
				timestamp: Date.now()
			};

			await addMessageToHistory(userId, matchId, assistantType, message);

			// Cache should be invalidated
			const cached = getCachedSessionState(userId, matchId);
			expect(cached).toBeUndefined();
		});
	});

	describe('switchAssistant', () => {
		it('should switch from one assistant to another', async () => {
			const userId = 'user-123';
			const matchId = 'match-456';

			await switchAssistant(userId, matchId, 'wingman');

			// Cache should be invalidated
			const cached = getCachedSessionState(userId, matchId);
			expect(cached).toBeUndefined();
		});
	});

	describe('clearSessionState', () => {
		it('should clear session state', async () => {
			const userId = 'user-123';
			const matchId = 'match-456';
			const assistantType: AssistantType = 'bestie';

			await clearSessionState(userId, matchId, assistantType);

			// Cache should be cleared
			const cached = getCachedSessionState(userId, matchId);
			expect(cached).toBeUndefined();
		});
	});

	describe('localStorage persistence', () => {
		it('should persist session state to localStorage', () => {
			const sessionState = {
				matchId: 'match-456',
				userId: 'user-123',
				activeAssistant: 'bestie' as AssistantType,
				conversationHistory: [],
				lastLoadedAt: Date.now()
			};

			persistSessionStateToLocalStorage(sessionState);

			const key = `pdc_session_user-123_match-456`;
			const stored = localStorage.getItem(key);
			expect(stored).toBeDefined();

			const parsed = JSON.parse(stored!);
			expect(parsed.userId).toBe('user-123');
			expect(parsed.matchId).toBe('match-456');
		});

		it('should load session state from localStorage', () => {
			const sessionState = {
				matchId: 'match-456',
				userId: 'user-123',
				activeAssistant: 'bestie' as AssistantType,
				conversationHistory: [],
				lastLoadedAt: Date.now()
			};

			persistSessionStateToLocalStorage(sessionState);

			const loaded = loadSessionStateFromLocalStorage('user-123', 'match-456');
			expect(loaded).toBeDefined();
			expect(loaded?.userId).toBe('user-123');
			expect(loaded?.matchId).toBe('match-456');
		});

		it('should return undefined for non-existent session', () => {
			const loaded = loadSessionStateFromLocalStorage('user-123', 'match-456');
			expect(loaded).toBeUndefined();
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

			const loaded = loadSessionStateFromLocalStorage('user-123', 'match-456');
			expect(loaded).toBeUndefined();
		});
	});

	describe('cache management', () => {
		it('should clear all session cache', async () => {
			const userId = 'user-123';
			const matchId = 'match-456';

			await loadSessionState(userId, matchId);

			let cached = getCachedSessionState(userId, matchId);
			expect(cached).toBeDefined();

			clearAllSessionCache();

			cached = getCachedSessionState(userId, matchId);
			expect(cached).toBeUndefined();
		});
	});
});
