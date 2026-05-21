import { writable, derived, type Readable } from 'svelte/store';
import type { ChatMessage, AssistantType } from '../types';

/**
 * Session state for a specific match conversation
 */
export interface SessionState {
	matchId: string;
	userId: string;
	activeAssistant: AssistantType | null;
	conversationHistory: ChatMessage[];
	lastLoadedAt: number;
	isLoading: boolean;
	error: string | null;
	assistantConfig?: {
		exchangeCount: number;
		lastExchangeAt: number | null;
		autoImpersonate: boolean;
	};
}

/**
 * Create a session store for a specific match
 */
export function createSessionStore(userId: string, matchId: string) {
	const initialState: SessionState = {
		matchId,
		userId,
		activeAssistant: null,
		conversationHistory: [],
		lastLoadedAt: 0,
		isLoading: false,
		error: null
	};

	const { subscribe, set, update } = writable<SessionState>(initialState);

	return {
		subscribe,

		/**
		 * Load session state from server
		 */
		async load() {
			update((state) => ({ ...state, isLoading: true, error: null }));

			try {
				const response = await fetch('/api/session/load', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ userId, matchId })
				});

				if (!response.ok) {
					throw new Error('Failed to load session state');
				}

				const data = await response.json();

				update((state) => ({
					...state,
					activeAssistant: data.activeAssistant,
					conversationHistory: data.conversationHistory,
					assistantConfig: data.assistantConfig,
					lastLoadedAt: Date.now(),
					isLoading: false
				}));
			} catch (err) {
				const errorMessage = err instanceof Error ? err.message : 'Unknown error';
				update((state) => ({
					...state,
					isLoading: false,
					error: errorMessage
				}));
			}
		},

		/**
		 * Activate an assistant
		 */
		async activateAssistant(assistantType: AssistantType) {
			update((state) => ({ ...state, isLoading: true, error: null }));

			try {
				const response = await fetch('/api/session/activate-assistant', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ userId, matchId, assistantType })
				});

				if (!response.ok) {
					throw new Error('Failed to activate assistant');
				}

				update((state) => ({
					...state,
					activeAssistant: assistantType,
					isLoading: false
				}));
			} catch (err) {
				const errorMessage = err instanceof Error ? err.message : 'Unknown error';
				update((state) => ({
					...state,
					isLoading: false,
					error: errorMessage
				}));
			}
		},

		/**
		 * Deactivate the active assistant
		 */
		async deactivateAssistant() {
			update((state) => ({ ...state, isLoading: true, error: null }));

			try {
				const response = await fetch('/api/session/deactivate-assistant', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ userId, matchId })
				});

				if (!response.ok) {
					throw new Error('Failed to deactivate assistant');
				}

				update((state) => ({
					...state,
					activeAssistant: null,
					isLoading: false
				}));
			} catch (err) {
				const errorMessage = err instanceof Error ? err.message : 'Unknown error';
				update((state) => ({
					...state,
					isLoading: false,
					error: errorMessage
				}));
			}
		},

		/**
		 * Switch to a different assistant
		 */
		async switchAssistant(newAssistantType: AssistantType) {
			update((state) => ({ ...state, isLoading: true, error: null }));

			try {
				const response = await fetch('/api/session/switch-assistant', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ userId, matchId, assistantType: newAssistantType })
				});

				if (!response.ok) {
					throw new Error('Failed to switch assistant');
				}

				update((state) => ({
					...state,
					activeAssistant: newAssistantType,
					isLoading: false
				}));
			} catch (err) {
				const errorMessage = err instanceof Error ? err.message : 'Unknown error';
				update((state) => ({
					...state,
					isLoading: false,
					error: errorMessage
				}));
			}
		},

		/**
		 * Add a message to the conversation history
		 */
		async addMessage(message: ChatMessage) {
			update((state) => ({
				...state,
				conversationHistory: [...state.conversationHistory, message]
			}));

			// Persist to server
			if (state.activeAssistant) {
				try {
					await fetch('/api/session/add-message', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							userId,
							matchId,
							assistantType: state.activeAssistant,
							message
						})
					});
				} catch (err) {
					console.error('Failed to persist message to server:', err);
				}
			}
		},

		/**
		 * Update conversation history
		 */
		updateConversationHistory(messages: ChatMessage[]) {
			update((state) => ({
				...state,
				conversationHistory: messages
			}));
		},

		/**
		 * Clear error
		 */
		clearError() {
			update((state) => ({ ...state, error: null }));
		},

		/**
		 * Reset to initial state
		 */
		reset() {
			set(initialState);
		}
	};
}

/**
 * Global session store for managing multiple match sessions
 */
export function createGlobalSessionStore() {
	const sessions = writable<Map<string, SessionState>>(new Map());

	return {
		subscribe: sessions.subscribe,

		/**
		 * Get or create a session for a match
		 */
		getOrCreateSession(userId: string, matchId: string): SessionState {
			let currentSessions: Map<string, SessionState>;
			sessions.subscribe((s) => {
				currentSessions = s;
			})();

			const key = `${userId}:${matchId}`;
			if (!currentSessions.has(key)) {
				const newSession: SessionState = {
					matchId,
					userId,
					activeAssistant: null,
					conversationHistory: [],
					lastLoadedAt: 0,
					isLoading: false,
					error: null
				};
				currentSessions.set(key, newSession);
				sessions.set(new Map(currentSessions));
			}

			return currentSessions.get(key)!;
		},

		/**
		 * Update a session
		 */
		updateSession(userId: string, matchId: string, updates: Partial<SessionState>) {
			sessions.update((s) => {
				const key = `${userId}:${matchId}`;
				const session = s.get(key);
				if (session) {
					s.set(key, { ...session, ...updates });
				}
				return new Map(s);
			});
		},

		/**
		 * Remove a session
		 */
		removeSession(userId: string, matchId: string) {
			sessions.update((s) => {
				const key = `${userId}:${matchId}`;
				s.delete(key);
				return new Map(s);
			});
		},

		/**
		 * Clear all sessions
		 */
		clearAll() {
			sessions.set(new Map());
		}
	};
}

/**
 * Derived store for checking if any assistant is active
 */
export function createHasActiveAssistantStore(sessionStore: Readable<SessionState>) {
	return derived(sessionStore, ($session) => $session.activeAssistant !== null);
}

/**
 * Derived store for getting the active assistant type
 */
export function createActiveAssistantStore(sessionStore: Readable<SessionState>) {
	return derived(sessionStore, ($session) => $session.activeAssistant);
}

/**
 * Derived store for getting conversation history
 */
export function createConversationHistoryStore(sessionStore: Readable<SessionState>) {
	return derived(sessionStore, ($session) => $session.conversationHistory);
}

/**
 * Derived store for getting exchange count
 */
export function createExchangeCountStore(sessionStore: Readable<SessionState>) {
	return derived(sessionStore, ($session) => $session.assistantConfig?.exchangeCount ?? 0);
}
