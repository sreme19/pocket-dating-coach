import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ErrorLogger,
  handleNetworkError,
  handleAPIError,
  handleFileUploadError,
  handleClaudeAPIError,
  handleSupabaseError,
  handleValidationError,
  handleError,
  retryWithBackoff,
  validateFileUpload,
  validateFormInput,
  type AppError
} from './errorHandling';

describe('Error Handling Utilities', () => {
  beforeEach(() => {
    ErrorLogger.clearLogs();
  });

  describe('ErrorLogger', () => {
    it('should log errors', () => {
      const error: AppError = {
        type: 'network',
        message: 'Network error',
        userMessage: 'Connection error',
        retryable: true,
        timestamp: new Date()
      };

      ErrorLogger.log(error);
      const logs = ErrorLogger.getLogs();

      expect(logs.length).toBe(1);
      expect(logs[0]).toEqual(error);
    });

    it('should clear logs', () => {
      const error: AppError = {
        type: 'network',
        message: 'Network error',
        userMessage: 'Connection error',
        retryable: true,
        timestamp: new Date()
      };

      ErrorLogger.log(error);
      ErrorLogger.clearLogs();

      expect(ErrorLogger.getLogs().length).toBe(0);
    });

    it('should maintain max logs limit', () => {
      for (let i = 0; i < 150; i++) {
        const error: AppError = {
          type: 'network',
          message: `Error ${i}`,
          userMessage: 'Connection error',
          retryable: true,
          timestamp: new Date()
        };
        ErrorLogger.log(error);
      }

      const logs = ErrorLogger.getLogs();
      expect(logs.length).toBeLessThanOrEqual(100);
    });
  });

  describe('handleNetworkError', () => {
    it('should handle generic network error', () => {
      const error = new Error('Network error');
      const appError = handleNetworkError(error);

      expect(appError.type).toBe('network');
      expect(appError.retryable).toBe(true);
      expect(appError.userMessage).toContain('Connection error');
    });

    it('should handle timeout error', () => {
      const error = new Error('Request timeout');
      const appError = handleNetworkError(error);

      expect(appError.userMessage).toContain('timed out');
    });

    it('should handle offline error', () => {
      const error = new Error('You are offline');
      const appError = handleNetworkError(error);

      expect(appError.retryable).toBe(false);
    });
  });

  describe('handleAPIError', () => {
    it('should handle 400 Bad Request', () => {
      const error = new Error('Bad Request');
      const appError = handleAPIError(error, 400);

      expect(appError.type).toBe('api');
      expect(appError.statusCode).toBe(400);
      expect(appError.retryable).toBe(false);
      expect(appError.userMessage).toContain('Invalid request');
    });

    it('should handle 401 Unauthorized', () => {
      const error = new Error('Unauthorized');
      const appError = handleAPIError(error, 401);

      expect(appError.statusCode).toBe(401);
      expect(appError.retryable).toBe(false);
      expect(appError.userMessage).toContain('Authentication failed');
    });

    it('should handle 403 Forbidden', () => {
      const error = new Error('Forbidden');
      const appError = handleAPIError(error, 403);

      expect(appError.statusCode).toBe(403);
      expect(appError.retryable).toBe(false);
      expect(appError.userMessage).toContain('permission');
    });

    it('should handle 404 Not Found', () => {
      const error = new Error('Not Found');
      const appError = handleAPIError(error, 404);

      expect(appError.statusCode).toBe(404);
      expect(appError.retryable).toBe(false);
      expect(appError.userMessage).toContain('not found');
    });

    it('should handle 429 Too Many Requests', () => {
      const error = new Error('Too Many Requests');
      const appError = handleAPIError(error, 429);

      expect(appError.statusCode).toBe(429);
      expect(appError.retryable).toBe(true);
    });

    it('should handle 500 Server Error', () => {
      const error = new Error('Server Error');
      const appError = handleAPIError(error, 500);

      expect(appError.statusCode).toBe(500);
      expect(appError.retryable).toBe(true);
    });

    it('should handle 503 Service Unavailable', () => {
      const error = new Error('Service Unavailable');
      const appError = handleAPIError(error, 503);

      expect(appError.statusCode).toBe(503);
      expect(appError.retryable).toBe(true);
    });
  });

  describe('handleFileUploadError', () => {
    it('should handle file too large error', () => {
      const error = new Error('File is too large');
      const appError = handleFileUploadError(error, 'photo.jpg');

      expect(appError.type).toBe('file_upload');
      expect(appError.retryable).toBe(false);
      expect(appError.userMessage).toContain('too large');
    });

    it('should handle invalid file type error', () => {
      const error = new Error('Invalid file type');
      const appError = handleFileUploadError(error, 'document.pdf');

      expect(appError.retryable).toBe(false);
      expect(appError.userMessage).toContain('Invalid file type');
    });

    it('should handle upload timeout', () => {
      const error = new Error('Upload timeout');
      const appError = handleFileUploadError(error);

      expect(appError.retryable).toBe(true);
    });

    it('should handle quota exceeded', () => {
      const error = new Error('Storage quota exceeded');
      const appError = handleFileUploadError(error);

      expect(appError.retryable).toBe(false);
    });
  });

  describe('handleClaudeAPIError', () => {
    it('should handle rate limit error', () => {
      const error = new Error('Rate limit exceeded');
      const appError = handleClaudeAPIError(error);

      expect(appError.type).toBe('claude_api');
      expect(appError.retryable).toBe(true);
    });

    it('should handle invalid request error', () => {
      const error = new Error('Invalid request');
      const appError = handleClaudeAPIError(error);

      expect(appError.retryable).toBe(false);
    });

    it('should handle timeout error', () => {
      const error = new Error('Request timeout');
      const appError = handleClaudeAPIError(error);

      expect(appError.retryable).toBe(true);
    });

    it('should handle overloaded error', () => {
      const error = new Error('Service overloaded');
      const appError = handleClaudeAPIError(error);

      expect(appError.retryable).toBe(true);
    });
  });

  describe('handleSupabaseError', () => {
    it('should handle connection error', () => {
      const error = new Error('Connection failed');
      const appError = handleSupabaseError(error);

      expect(appError.type).toBe('supabase');
      expect(appError.retryable).toBe(true);
    });

    it('should handle authentication error', () => {
      const error = new Error('Authentication failed');
      const appError = handleSupabaseError(error);

      expect(appError.retryable).toBe(false);
    });

    it('should handle permission error', () => {
      const error = new Error('Permission denied');
      const appError = handleSupabaseError(error);

      expect(appError.retryable).toBe(false);
    });

    it('should handle constraint error', () => {
      const error = new Error('Constraint violation');
      const appError = handleSupabaseError(error);

      expect(appError.retryable).toBe(false);
    });
  });

  describe('handleValidationError', () => {
    it('should handle validation error', () => {
      const appError = handleValidationError('Email is required');

      expect(appError.type).toBe('validation');
      expect(appError.message).toBe('Email is required');
      expect(appError.userMessage).toBe('Email is required');
      expect(appError.retryable).toBe(false);
    });
  });

  describe('handleError', () => {
    it('should handle Error object', () => {
      const error = new Error('Something went wrong');
      const appError = handleError(error);

      expect(appError.type).toBe('unknown');
      expect(appError.message).toBe('Something went wrong');
    });

    it('should handle string error', () => {
      const appError = handleError('Error message');

      expect(appError.type).toBe('unknown');
      expect(appError.message).toBe('Error message');
    });

    it('should handle object error', () => {
      const appError = handleError({ code: 'ERROR_CODE' });

      expect(appError.type).toBe('unknown');
      expect(appError.message).toContain('ERROR_CODE');
    });

    it('should include context in message', () => {
      const error = new Error('Error');
      const appError = handleError(error, 'user registration');

      expect(appError.message).toContain('user registration');
    });
  });

  describe('retryWithBackoff', () => {
    it('should succeed on first attempt', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      const result = await retryWithBackoff(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'))
        .mockResolvedValueOnce('success');

      const result = await retryWithBackoff(fn, 3, 10);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should throw after max retries', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Persistent error'));

      await expect(retryWithBackoff(fn, 2, 10)).rejects.toThrow('Persistent error');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should use exponential backoff', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockResolvedValueOnce('success');

      const startTime = Date.now();
      await retryWithBackoff(fn, 2, 50);
      const elapsed = Date.now() - startTime;

      // Should wait at least 50ms (initial delay)
      expect(elapsed).toBeGreaterThanOrEqual(50);
    });
  });

  describe('validateFileUpload', () => {
    it('should validate correct file', () => {
      const file = new File(['content'], 'photo.jpg', { type: 'image/jpeg' });
      const result = validateFileUpload(file);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject file too large', () => {
      const file = new File(['x'.repeat(11 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' });
      const result = validateFileUpload(file, { maxSizeBytes: 10 * 1024 * 1024 });

      expect(result.valid).toBe(false);
      expect(result.error?.type).toBe('file_upload');
    });

    it('should reject invalid file type', () => {
      const file = new File(['content'], 'document.pdf', { type: 'application/pdf' });
      const result = validateFileUpload(file, { allowedTypes: ['image/jpeg', 'image/png'] });

      expect(result.valid).toBe(false);
      expect(result.error?.type).toBe('file_upload');
    });

    it('should accept custom allowed types', () => {
      const file = new File(['content'], 'document.pdf', { type: 'application/pdf' });
      const result = validateFileUpload(file, { allowedTypes: ['application/pdf'] });

      expect(result.valid).toBe(true);
    });
  });

  describe('validateFormInput', () => {
    it('should validate required field', () => {
      const result = validateFormInput('', { required: true });

      expect(result.valid).toBe(false);
      expect(result.error?.message).toContain('required');
    });

    it('should validate min length', () => {
      const result = validateFormInput('ab', { minLength: 3 });

      expect(result.valid).toBe(false);
      expect(result.error?.message).toContain('Minimum length');
    });

    it('should validate max length', () => {
      const result = validateFormInput('abcdef', { maxLength: 5 });

      expect(result.valid).toBe(false);
      expect(result.error?.message).toContain('Maximum length');
    });

    it('should validate pattern', () => {
      const result = validateFormInput('invalid-email', { pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ });

      expect(result.valid).toBe(false);
      expect(result.error?.message).toContain('Invalid format');
    });

    it('should pass all validations', () => {
      const result = validateFormInput('valid@email.com', {
        required: true,
        minLength: 5,
        maxLength: 50,
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      });

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });
});
