import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApiClient, apiClient, fetchWithErrorHandling, postWithErrorHandling } from './apiClient';
import { AppError } from './errorHandler';

describe('ApiClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET requests', () => {
    it('should make a successful GET request', async () => {
      const mockData = { id: 1, name: 'Test' };
      global.fetch = vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify(mockData), { status: 200 })
      );

      const result = await apiClient.get('/api/test');

      expect(result).toEqual(mockData);
      expect(global.fetch).toHaveBeenCalledWith('/api/test', expect.any(Object));
    });

    it('should handle GET request errors', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })
      );

      await expect(apiClient.get('/api/test')).rejects.toThrow();
    });

    it('should retry failed GET requests', async () => {
      global.fetch = vi
        .fn()
        .mockRejectedValueOnce(new AppError('Network error', { category: 'network' }))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ id: 1 }), { status: 200 })
        );

      const result = await apiClient.get('/api/test', { maxRetries: 2, retryable: true });

      expect(result).toEqual({ id: 1 });
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('POST requests', () => {
    it('should make a successful POST request', async () => {
      const mockData = { id: 1, name: 'Test' };
      global.fetch = vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify(mockData), { status: 200 })
      );

      const result = await apiClient.post('/api/test', { name: 'Test' });

      expect(result).toEqual(mockData);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'Test' })
        })
      );
    });

    it('should set Content-Type header for POST', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 200 })
      );

      await apiClient.post('/api/test', { name: 'Test' });

      const callArgs = (global.fetch as any).mock.calls[0][1];
      expect(callArgs.headers['Content-Type']).toBe('application/json');
    });

    it('should handle POST request errors', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Bad request' }), { status: 400 })
      );

      await expect(apiClient.post('/api/test', {})).rejects.toThrow();
    });
  });

  describe('PUT requests', () => {
    it('should make a successful PUT request', async () => {
      const mockData = { id: 1, name: 'Updated' };
      global.fetch = vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify(mockData), { status: 200 })
      );

      const result = await apiClient.put('/api/test/1', { name: 'Updated' });

      expect(result).toEqual(mockData);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/test/1',
        expect.objectContaining({
          method: 'PUT'
        })
      );
    });
  });

  describe('DELETE requests', () => {
    it('should make a successful DELETE request', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      );

      const result = await apiClient.delete('/api/test/1');

      expect(result).toEqual({ success: true });
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/test/1',
        expect.objectContaining({
          method: 'DELETE'
        })
      );
    });
  });

  describe('Error handling', () => {
    it('should throw AppError on network failure', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'));

      await expect(apiClient.get('/api/test', { retryable: false })).rejects.toThrow();
    });

    it('should throw AppError on 5xx response', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Server error' }), { status: 500 })
      );

      await expect(apiClient.get('/api/test')).rejects.toThrow();
    });

    it('should throw AppError on 4xx response', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Bad request' }), { status: 400 })
      );

      await expect(apiClient.get('/api/test')).rejects.toThrow();
    });
  });

  describe('Retry logic', () => {
    it('should retry on network errors', async () => {
      global.fetch = vi
        .fn()
        .mockRejectedValueOnce(new AppError('Network error', { category: 'network' }))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ id: 1 }), { status: 200 })
        );

      const result = await apiClient.get('/api/test', { maxRetries: 2 });

      expect(result).toEqual({ id: 1 });
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should not retry when retryable is false', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'));

      await expect(apiClient.get('/api/test', { retryable: false })).rejects.toThrow();

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should respect maxRetries option', async () => {
      global.fetch = vi.fn().mockRejectedValue(new AppError('Network error', { category: 'network' }));

      await expect(apiClient.get('/api/test', { maxRetries: 2 })).rejects.toThrow();

      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Timeout handling', () => {
    it('should timeout after specified duration', async () => {
      global.fetch = vi.fn(
        () => new Promise((resolve) => setTimeout(resolve, 1000))
      );

      await expect(apiClient.get('/api/test', { timeout: 10 })).rejects.toThrow('timed out');
    });

    it('should use default timeout', async () => {
      const client = new ApiClient({ timeout: 100 });
      global.fetch = vi.fn(
        () => new Promise((resolve) => setTimeout(resolve, 1000))
      );

      await expect(client.get('/api/test')).rejects.toThrow('timed out');
    });
  });

  describe('Custom options', () => {
    it('should accept custom headers', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 200 })
      );

      await apiClient.get('/api/test', {
        headers: { 'X-Custom': 'value' }
      });

      const callArgs = (global.fetch as any).mock.calls[0][1];
      expect(callArgs.headers['X-Custom']).toBe('value');
    });

    it('should merge custom headers with defaults', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 200 })
      );

      await apiClient.post('/api/test', {}, {
        headers: { 'X-Custom': 'value' }
      });

      const callArgs = (global.fetch as any).mock.calls[0][1];
      expect(callArgs.headers['Content-Type']).toBe('application/json');
      expect(callArgs.headers['X-Custom']).toBe('value');
    });
  });
});

describe('Convenience functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch with error handling', async () => {
    const mockData = { id: 1 };
    global.fetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify(mockData), { status: 200 })
    );

    const result = await fetchWithErrorHandling('/api/test');

    expect(result).toEqual(mockData);
  });

  it('should post with error handling', async () => {
    const mockData = { id: 1 };
    global.fetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify(mockData), { status: 200 })
    );

    const result = await postWithErrorHandling('/api/test', { name: 'Test' });

    expect(result).toEqual(mockData);
  });
});
