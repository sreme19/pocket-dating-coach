/**
 * Typing Service
 *
 * Manages typing indicator state with debouncing to prevent excessive API calls.
 * Automatically clears typing status after a timeout.
 */

import { writable, type Writable } from 'svelte/store';
import { publishTypingIndicator } from './realtimeService';

const TYPING_DEBOUNCE_DELAY = 300; // 300ms
const TYPING_TIMEOUT = 3000; // 3 seconds

interface TypingState {
  conversationId: string;
  isTyping: boolean;
  lastPublished: Date;
}

// Store for tracking typing state per conversation
const typingStates = new Map<string, TypingState>();
const typingTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
const typingDebounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Initialize typing service for a conversation
 */
export function initializeTypingService(conversationId: string): void {
  if (!typingStates.has(conversationId)) {
    typingStates.set(conversationId, {
      conversationId,
      isTyping: false,
      lastPublished: new Date()
    });
  }
}

/**
 * Handle user typing with debouncing
 *
 * This function should be called on every keystroke.
 * It will debounce the typing indicator to prevent excessive API calls.
 */
export function handleUserTyping(conversationId: string): void {
  initializeTypingService(conversationId);

  const state = typingStates.get(conversationId);
  if (!state) return;

  // Clear existing debounce timer
  if (typingDebounceTimers.has(conversationId)) {
    clearTimeout(typingDebounceTimers.get(conversationId)!);
  }

  // Clear existing timeout
  if (typingTimeouts.has(conversationId)) {
    clearTimeout(typingTimeouts.get(conversationId)!);
  }

  // Set debounce timer
  const debounceTimer = setTimeout(() => {
    // Only publish if not already published recently
    const now = new Date();
    const timeSinceLastPublish = now.getTime() - state.lastPublished.getTime();

    if (timeSinceLastPublish > TYPING_DEBOUNCE_DELAY) {
      publishTypingIndicator(conversationId, true);
      state.isTyping = true;
      state.lastPublished = now;
    }

    // Set timeout to clear typing status
    const timeout = setTimeout(() => {
      clearTypingStatus(conversationId);
    }, TYPING_TIMEOUT);

    typingTimeouts.set(conversationId, timeout);
  }, TYPING_DEBOUNCE_DELAY);

  typingDebounceTimers.set(conversationId, debounceTimer);
}

/**
 * Clear typing status for a conversation
 */
export function clearTypingStatus(conversationId: string): void {
  const state = typingStates.get(conversationId);
  if (!state || !state.isTyping) return;

  // Publish typing stopped
  publishTypingIndicator(conversationId, false);
  state.isTyping = false;

  // Clear timers
  if (typingTimeouts.has(conversationId)) {
    clearTimeout(typingTimeouts.get(conversationId)!);
    typingTimeouts.delete(conversationId);
  }

  if (typingDebounceTimers.has(conversationId)) {
    clearTimeout(typingDebounceTimers.get(conversationId)!);
    typingDebounceTimers.delete(conversationId);
  }
}

/**
 * Get typing state for a conversation
 */
export function getTypingState(conversationId: string): TypingState | undefined {
  return typingStates.get(conversationId);
}

/**
 * Check if user is typing in a conversation
 */
export function isUserTyping(conversationId: string): boolean {
  const state = typingStates.get(conversationId);
  return state?.isTyping ?? false;
}

/**
 * Clean up typing service for a conversation
 */
export function cleanupTypingService(conversationId: string): void {
  // Clear timers
  if (typingTimeouts.has(conversationId)) {
    clearTimeout(typingTimeouts.get(conversationId)!);
    typingTimeouts.delete(conversationId);
  }

  if (typingDebounceTimers.has(conversationId)) {
    clearTimeout(typingDebounceTimers.get(conversationId)!);
    typingDebounceTimers.delete(conversationId);
  }

  // Remove state
  typingStates.delete(conversationId);
}

/**
 * Clean up all typing services
 */
export function cleanupAllTypingServices(): void {
  // Clear all timers
  typingTimeouts.forEach((timeout) => clearTimeout(timeout));
  typingTimeouts.clear();

  typingDebounceTimers.forEach((timer) => clearTimeout(timer));
  typingDebounceTimers.clear();

  // Clear all states
  typingStates.clear();
}
