import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import {
  createErrorRecovery,
  withErrorHandling,
  withRetry,
  createSafeAsyncFunction,
  createRetryableAsyncFunction
} from './useErrorRecovery';
import { AppError } from './errorHandler';
import * as stores from '$lib/verified-vibe/stores';

// Helper to create a retryable error
function createNetworkError(message: string = 'Network error') {
  return new AppError(message, { category: 'network' });
}

vi.mock('$lib/verified-vibe/stores', () => ({
  setError: vi.fn(),
  clearError: vi.fn()
}));

describe('createErrorRecovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create error recovery state', () => {
    const { state } = createErrorRecovery();
    const current = get(state);

    expect(current.error).toBeNull();
    expect(current.isRetrying).toBe(false);
    expect(current.retryCount).toBe(0);
    expect(current.maxRetries).toBe(3);
  });

  it('should handle errors', () => {
    const { state, handleError } = createErrorRecovery();
    const error = new AppError('Test error', { userMessage: 'User friendly message' });

    handleError(error);

    const current = get(state);
    expect(current.error).toBeTruthy();
    expect(stores.setError).toHaveBeenCalled();
  });

  it('should clear errors', () => {
    const { state, handleError, clear } = createErrorRecovery();
    const error = new AppError('Test error');

    handleError(error);
    expect(get(state).error).toBeTruthy();

    clear();
    expect(get(state).error).toBeNull();
    expect(stores.clearError).toHaveBeenCalled();
  });

  it('should retry operations', async () => {
    const { state, retry } = createErrorRecovery();
    const operation = vi
      .fn()
      .mockRejectedValueOnce(createNetworkError())
      .mockResolvedValueOnce('success');

    const result = await retry(operation);

    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('should track retry count', async () => {
    const { state, retry } = createErrorRecovery();
    let retryCountDuringRetry = 0;
    const operation = vi
      .fn()
      .mockRejectedValueOnce(createNetworkError())
      .mockImplementationOnce(async () => {
        retryCountDuringRetry = get(state).retryCount;
        return 'success';
      });

    await retry(operation);

    expect(retryCountDuringRetry).toBeGreaterThan(0);
  });

  it('should set isRetrying flag', async () => {
    const { state, retry } = createErrorRecovery();
    const operation = vi.fn(
      () => new Promise((resolve) => setTimeout(() => resolve('success'), 50))
    );

    const promise = retry(operation);

    // Check during retry
    expect(get(state).isRetrying).toBe(true);

    await promise;

    // Check after retry
    expect(get(state).isRetrying).toBe(false);
  });

  it('should handle retry failure', async () => {
    const { state, retry } = createErrorRecovery();
    const operation = vi.fn().mockRejectedValue(new Error('Network error'));

    await expect(retry(operation)).rejects.toThrow();

    const current = get(state);
    expect(current.error).toBeTruthy();
  });

  it('should accept custom maxRetries', () => {
    const { state } = createErrorRecovery(5);
    const current = get(state);

    expect(current.maxRetries).toBe(5);
  });
});

describe('withErrorHandling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should execute successful operation', async () => {
    const operation = vi.fn().mockResolvedValue('success');

    const result = await withErrorHandling(operation);

    expect(result).toBe('success');
    expect(operation).toHaveBeenCalled();
  });

  it('should call onSuccess callback', async () => {
    const operation = vi.fn().mockResolvedValue('success');
    const onSuccess = vi.fn();

    await withErrorHandling(operation, { onSuccess });

    expect(onSuccess).toHaveBeenCalledWith('success');
  });

  it('should handle errors', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('Test error'));
    const onError = vi.fn();

    const result = await withErrorHandling(operation, { onError });

    expect(result).toBeNull();
    expect(onError).toHaveBeenCalled();
    expect(stores.setError).toHaveBeenCalled();
  });

  it('should call onError callback', async () => {
    const error = new Error('Test error');
    const operation = vi.fn().mockRejectedValue(error);
    const onError = vi.fn();

    await withErrorHandling(operation, { onError });

    expect(onError).toHaveBeenCalledWith(error);
  });

  it('should not retry by default', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('Test error'));

    await withErrorHandling(operation);

    expect(operation).toHaveBeenCalledTimes(1);
  });
});

describe('withRetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should retry failed operations', async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(createNetworkError())
      .mockResolvedValueOnce('success');

    const result = await withRetry(operation, { maxRetries: 2, baseDelay: 10 });

    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('should call onRetry callback', async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(createNetworkError())
      .mockResolvedValueOnce('success');
    const onRetry = vi.fn();

    await withRetry(operation, { maxRetries: 2, baseDelay: 10, onRetry });

    expect(onRetry).toHaveBeenCalledWith(1);
  });

  it('should throw after max retries', async () => {
    const operation = vi.fn().mockRejectedValue(createNetworkError());

    await expect(withRetry(operation, { maxRetries: 2, baseDelay: 10 })).rejects.toThrow();

    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('should call onError on final failure', async () => {
    const error = new Error('Network error');
    const operation = vi.fn().mockRejectedValue(error);
    const onError = vi.fn();

    await expect(
      withRetry(operation, { maxRetries: 1, baseDelay: 10, onError })
    ).rejects.toThrow();

    expect(onError).toHaveBeenCalledWith(error);
  });
});

describe('createSafeAsyncFunction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a safe async function', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const safeFn = createSafeAsyncFunction(fn);

    const result = await safeFn();

    expect(result).toBe('success');
  });

  it('should handle errors in safe function', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Test error'));
    const safeFn = createSafeAsyncFunction(fn);

    const result = await safeFn();

    expect(result).toBeNull();
    expect(stores.setError).toHaveBeenCalled();
  });

  it('should pass arguments to function', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const safeFn = createSafeAsyncFunction(fn);

    await safeFn('arg1', 'arg2');

    expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
  });

  it('should call onError callback', async () => {
    const error = new Error('Test error');
    const fn = vi.fn().mockRejectedValue(error);
    const onError = vi.fn();
    const safeFn = createSafeAsyncFunction(fn, { onError });

    await safeFn();

    expect(onError).toHaveBeenCalledWith(error);
  });
});

describe('createRetryableAsyncFunction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a retryable async function', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const retryableFn = createRetryableAsyncFunction(fn);

    const result = await retryableFn();

    expect(result).toBe('success');
  });

  it('should retry failed operations', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(createNetworkError())
      .mockResolvedValueOnce('success');
    const retryableFn = createRetryableAsyncFunction(fn, { maxRetries: 2, baseDelay: 10 });

    const result = await retryableFn();

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should pass arguments to function', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const retryableFn = createRetryableAsyncFunction(fn);

    await retryableFn('arg1', 'arg2');

    expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
  });

  it('should call onRetry callback', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(createNetworkError())
      .mockResolvedValueOnce('success');
    const onRetry = vi.fn();
    const retryableFn = createRetryableAsyncFunction(fn, { maxRetries: 2, baseDelay: 10, onRetry });

    await retryableFn();

    expect(onRetry).toHaveBeenCalledWith(1);
  });

  it('should throw after max retries', async () => {
    const fn = vi.fn().mockRejectedValue(createNetworkError());
    const retryableFn = createRetryableAsyncFunction(fn, { maxRetries: 2, baseDelay: 10 });

    await expect(retryableFn()).rejects.toThrow();
  });
});
