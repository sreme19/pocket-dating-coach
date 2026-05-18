import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  AppError,
  errorLogger,
  categorizeError,
  getUserFriendlyMessage,
  isRetryable,
  getRetryDelay,
  retryOperation,
  handleApiError,
  checkNetworkConnectivity,
  waitForNetwork,
  createTimeout,
  withTimeout,
  type ErrorSeverity,
  type ErrorCategory
} from './errorHandler';

describe('AppError', () => {
  it('should create an error with default options', () => {
    const error = new AppError('Test error');
    expect(error.message).toBe('Test error');
    expect(error.severity).toBe('error');
    expect(error.category).toBe('unknown');
    expect(error.retryable).toBe(true);
  });

  it('should create an error with custom options', () => {
    const error = new AppError('Network error', {
      severity: 'critical',
      category: 'network',
      userMessage: 'Connection failed',
      retryable: true,
      context: { url: 'https://example.com' }
    });

    expect(error.message).toBe('Network error');
    expect(error.severity).toBe('critical');
    expect(error.category).toBe('network');
    expect(error.userMessage).toBe('Connection failed');
    expect(error.retryable).toBe(true);
    expect(error.context).toEqual({ url: 'https://example.com' });
  });

  it('should maintain proper prototype chain', () => {
    const error = new AppError('Test');
    expect(error instanceof AppError).toBe(true);
    expect(error instanceof Error).toBe(true);
  });
});

describe('ErrorLogger', () => {
  beforeEach(() => {
    errorLogger.clearLogs();
  });

  it('should log errors', () => {
    const error = new AppError('Test error', { category: 'network' });
    const log = errorLogger.log(error);

    expect(log.message).toBe('Test error');
    expect(log.category).toBe('network');
    expect(log.timestamp).toBeInstanceOf(Date);
    expect(log.id).toMatch(/^err_/);
  });

  it('should maintain max logs limit', () => {
    for (let i = 0; i < 150; i++) {
      const error = new AppError(`Error ${i}`);
      errorLogger.log(error);
    }

    const logs = errorLogger.getLogs();
    expect(logs.length).toBeLessThanOrEqual(100);
  });

  it('should export logs as JSON', () => {
    const error = new AppError('Test error');
    errorLogger.log(error);

    const exported = errorLogger.exportLogs();
    const parsed = JSON.parse(exported);

    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThan(0);
  });

  it('should clear logs', () => {
    const error = new AppError('Test error');
    errorLogger.log(error);
    expect(errorLogger.getLogs().length).toBeGreaterThan(0);

    errorLogger.clearLogs();
    expect(errorLogger.getLogs().length).toBe(0);
  });
});

describe('categorizeError', () => {
  it('should categorize AppError by its category', () => {
    const error = new AppError('Test', { category: 'network' });
    expect(categorizeError(error)).toBe('network');
  });

  it('should categorize TypeError as client error', () => {
    const error = new TypeError('Cannot read property');
    expect(categorizeError(error)).toBe('client');
  });

  it('should categorize SyntaxError as client error', () => {
    const error = new SyntaxError('Unexpected token');
    expect(categorizeError(error)).toBe('client');
  });

  it('should categorize 401/403 as auth error', () => {
    expect(categorizeError({ status: 401 })).toBe('auth');
    expect(categorizeError({ status: 403 })).toBe('auth');
  });

  it('should categorize 4xx as validation error', () => {
    expect(categorizeError({ status: 400 })).toBe('validation');
    expect(categorizeError({ status: 422 })).toBe('validation');
  });

  it('should categorize 5xx as server error', () => {
    expect(categorizeError({ status: 500 })).toBe('server');
    expect(categorizeError({ status: 503 })).toBe('server');
  });

  it('should categorize network errors', () => {
    expect(categorizeError({ message: 'network error' })).toBe('network');
    expect(categorizeError({ message: 'fetch failed' })).toBe('network');
  });

  it('should default to unknown category', () => {
    expect(categorizeError({})).toBe('unknown');
  });
});

describe('getUserFriendlyMessage', () => {
  it('should return AppError user message', () => {
    const error = new AppError('Technical error', {
      userMessage: 'Please try again later'
    });
    expect(getUserFriendlyMessage(error)).toBe('Please try again later');
  });

  it('should return network error message', () => {
    const message = getUserFriendlyMessage({ message: 'network error' });
    expect(message).toContain('Network connection failed');
  });

  it('should return validation error message', () => {
    const message = getUserFriendlyMessage({ status: 400 });
    expect(message).toContain('invalid');
  });

  it('should return auth error message', () => {
    const message = getUserFriendlyMessage({ status: 401 });
    expect(message).toContain('not authorized');
  });

  it('should return server error message', () => {
    const message = getUserFriendlyMessage({ status: 500 });
    expect(message).toContain('server');
  });

  it('should return client error message', () => {
    const message = getUserFriendlyMessage(new TypeError('test'));
    expect(message).toContain('device');
  });

  it('should return unknown error message', () => {
    const message = getUserFriendlyMessage({});
    expect(message).toContain('unexpected');
  });
});

describe('isRetryable', () => {
  it('should return retryable from AppError', () => {
    const retryable = new AppError('Test', { retryable: true });
    const notRetryable = new AppError('Test', { retryable: false });

    expect(isRetryable(retryable)).toBe(true);
    expect(isRetryable(notRetryable)).toBe(false);
  });

  it('should mark network errors as retryable', () => {
    expect(isRetryable({ message: 'network error' })).toBe(true);
  });

  it('should mark server errors as retryable', () => {
    expect(isRetryable({ status: 500 })).toBe(true);
    expect(isRetryable({ status: 503 })).toBe(true);
  });

  it('should not mark validation errors as retryable', () => {
    expect(isRetryable({ status: 400 })).toBe(false);
  });

  it('should not mark auth errors as retryable', () => {
    expect(isRetryable({ status: 401 })).toBe(false);
  });
});

describe('getRetryDelay', () => {
  it('should calculate exponential backoff', () => {
    const delay1 = getRetryDelay(1, 1000);
    const delay2 = getRetryDelay(2, 1000);
    const delay3 = getRetryDelay(3, 1000);

    expect(delay1).toBeLessThan(1100); // 1000 + jitter
    expect(delay2).toBeLessThan(2200); // 2000 + jitter
    expect(delay3).toBeLessThan(4400); // 4000 + jitter
  });

  it('should cap delay at 30 seconds', () => {
    const delay = getRetryDelay(10, 1000);
    expect(delay).toBeLessThanOrEqual(30000);
  });

  it('should add jitter to prevent thundering herd', () => {
    const delays = Array.from({ length: 10 }, () => getRetryDelay(1, 1000));
    const unique = new Set(delays);
    expect(unique.size).toBeGreaterThan(1); // Should have variation
  });
});

describe('retryOperation', () => {
  it('should succeed on first attempt', async () => {
    const operation = vi.fn().mockResolvedValueOnce('success');
    const result = await retryOperation(operation);

    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure', async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new AppError('Network error', { category: 'network' }))
      .mockResolvedValueOnce('success');

    const result = await retryOperation(operation, { maxRetries: 3, baseDelay: 10 });

    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('should fail after max retries', async () => {
    const operation = vi
      .fn()
      .mockRejectedValue(new AppError('Network error', { category: 'network' }));

    await expect(
      retryOperation(operation, { maxRetries: 2, baseDelay: 10 })
    ).rejects.toThrow();

    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('should not retry non-retryable errors', async () => {
    const operation = vi
      .fn()
      .mockRejectedValue(new AppError('Validation error', { category: 'validation', retryable: false }));

    await expect(retryOperation(operation, { maxRetries: 3, baseDelay: 10 })).rejects.toThrow();

    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('should call onRetry callback', async () => {
    const onRetry = vi.fn();
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new AppError('Network error', { category: 'network' }))
      .mockResolvedValueOnce('success');

    await retryOperation(operation, { maxRetries: 3, baseDelay: 10, onRetry });

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
  });
});

describe('handleApiError', () => {
  it('should throw AppError with JSON error data', async () => {
    const response = new Response(JSON.stringify({ error: 'Invalid request' }), {
      status: 400
    });

    await expect(handleApiError(response)).rejects.toThrow('Invalid request');
  });

  it('should throw AppError with message field', async () => {
    const response = new Response(JSON.stringify({ message: 'Server error' }), {
      status: 500
    });

    await expect(handleApiError(response)).rejects.toThrow('Server error');
  });

  it('should throw AppError with status code', async () => {
    const response = new Response('', { status: 404 });

    await expect(handleApiError(response)).rejects.toThrow('HTTP 404');
  });

  it('should set retryable for 5xx errors', async () => {
    const response = new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500
    });

    try {
      await handleApiError(response);
    } catch (error) {
      expect(error instanceof AppError).toBe(true);
      expect((error as AppError).retryable).toBe(true);
    }
  });

  it('should set retryable for 429 errors', async () => {
    const response = new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429
    });

    try {
      await handleApiError(response);
    } catch (error) {
      expect(error instanceof AppError).toBe(true);
      expect((error as AppError).retryable).toBe(true);
    }
  });
});

describe('checkNetworkConnectivity', () => {
  it('should return true when network is available', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(new Response(null, { status: 200 }));

    const result = await checkNetworkConnectivity();
    expect(result).toBe(true);
  });

  it('should return false when network is unavailable', async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'));

    const result = await checkNetworkConnectivity();
    expect(result).toBe(false);
  });

  it('should return false on non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(new Response(null, { status: 500 }));

    const result = await checkNetworkConnectivity();
    expect(result).toBe(false);
  });
});

describe('createTimeout', () => {
  it('should reject after specified time', async () => {
    await expect(createTimeout(10)).rejects.toThrow('timed out');
  });

  it('should throw AppError', async () => {
    try {
      await createTimeout(10);
    } catch (error) {
      expect(error instanceof AppError).toBe(true);
    }
  });
});

describe('withTimeout', () => {
  it('should resolve before timeout', async () => {
    const promise = Promise.resolve('success');
    const result = await withTimeout(promise, 1000);
    expect(result).toBe('success');
  });

  it('should reject on timeout', async () => {
    const promise = new Promise((resolve) => setTimeout(resolve, 1000));
    await expect(withTimeout(promise, 10)).rejects.toThrow('timed out');
  });
});
