/**
 * Error Recovery Hook
 * Provides error handling and recovery utilities for components
 */

import { writable, type Writable } from 'svelte/store';
import { setError, clearError } from '$lib/verified-vibe/stores';
import {
  AppError,
  errorLogger,
  retryOperation,
  isRetryable,
  getUserFriendlyMessage,
  type ErrorRecoveryOptions
} from './errorHandler';

export interface ErrorRecoveryState {
  error: string | null;
  isRetrying: boolean;
  retryCount: number;
  maxRetries: number;
}

/**
 * Create an error recovery store for a component
 */
export function createErrorRecovery(
  maxRetries: number = 3
): {
  state: Writable<ErrorRecoveryState>;
  handleError: (error: any, options?: ErrorRecoveryOptions) => void;
  retry: (operation: () => Promise<any>) => Promise<any>;
  clear: () => void;
} {
  const state = writable<ErrorRecoveryState>({
    error: null,
    isRetrying: false,
    retryCount: 0,
    maxRetries
  });

  function handleError(error: any, options: ErrorRecoveryOptions = {}) {
    const appError = error instanceof AppError ? error : new AppError(String(error));
    const userMessage = getUserFriendlyMessage(appError);

    errorLogger.log(appError, options);

    state.update((s) => ({
      ...s,
      error: userMessage
    }));

    setError(userMessage);
  }

  async function retry(operation: () => Promise<any>) {
    state.update((s) => ({
      ...s,
      isRetrying: true
    }));

    try {
      const result = await retryOperation(operation, {
        maxRetries,
        baseDelay: 1000,
        onRetry: (attempt) => {
          state.update((s) => ({
            ...s,
            retryCount: attempt
          }));
        }
      });

      clear();
      return result;
    } catch (error) {
      handleError(error);
      throw error;
    } finally {
      state.update((s) => ({
        ...s,
        isRetrying: false
      }));
    }
  }

  function clear() {
    state.set({
      error: null,
      isRetrying: false,
      retryCount: 0,
      maxRetries
    });
    clearError();
  }

  return { state, handleError, retry, clear };
}

/**
 * Wrap an async operation with error handling
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  options: {
    onError?: (error: any) => void;
    onSuccess?: (result: T) => void;
    retryable?: boolean;
    maxRetries?: number;
  } = {}
): Promise<T | null> {
  try {
    const result = await operation();
    options.onSuccess?.(result);
    return result;
  } catch (error) {
    const appError = error instanceof AppError ? error : new AppError(String(error));
    const userMessage = getUserFriendlyMessage(appError);

    errorLogger.log(appError, {
      retryable: options.retryable !== false,
      maxRetries: options.maxRetries
    });

    options.onError?.(error);
    setError(userMessage);

    return null;
  }
}

/**
 * Wrap an async operation with retry logic
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelay?: number;
    onRetry?: (attempt: number) => void;
    onError?: (error: any) => void;
  } = {}
): Promise<T> {
  const maxRetries = options.maxRetries || 3;
  const baseDelay = options.baseDelay || 1000;

  try {
    return await retryOperation(operation, {
      maxRetries,
      baseDelay,
      onRetry: (attempt, error) => {
        options.onRetry?.(attempt);
      }
    });
  } catch (error) {
    const appError = error instanceof AppError ? error : new AppError(String(error));
    const userMessage = getUserFriendlyMessage(appError);

    errorLogger.log(appError, { retryable: false });
    options.onError?.(error);
    setError(userMessage);

    throw error;
  }
}

/**
 * Create a safe async function that handles errors
 */
export function createSafeAsyncFunction<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  options: {
    onError?: (error: any) => void;
    retryable?: boolean;
    maxRetries?: number;
  } = {}
) {
  return async (...args: T): Promise<R | null> => {
    return withErrorHandling(() => fn(...args), options);
  };
}

/**
 * Create a safe async function with retry logic
 */
export function createRetryableAsyncFunction<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  options: {
    maxRetries?: number;
    baseDelay?: number;
    onRetry?: (attempt: number) => void;
    onError?: (error: any) => void;
  } = {}
) {
  return async (...args: T): Promise<R> => {
    return withRetry(() => fn(...args), options);
  };
}
