/**
 * API Client with built-in error handling and retry logic
 */

import {
  AppError,
  errorLogger,
  handleApiError,
  retryOperation,
  withTimeout,
  type ErrorRecoveryOptions
} from './errorHandler';

export interface ApiClientOptions {
  timeout?: number;
  retryOptions?: {
    maxRetries?: number;
    baseDelay?: number;
  };
}

export interface ApiRequestOptions extends RequestInit {
  timeout?: number;
  retryable?: boolean;
  maxRetries?: number;
}

/**
 * API Client with error handling and retry logic
 */
export class ApiClient {
  private timeout: number;
  private retryOptions: { maxRetries: number; baseDelay: number };

  constructor(options: ApiClientOptions = {}) {
    this.timeout = options.timeout || 30000;
    this.retryOptions = {
      maxRetries: options.retryOptions?.maxRetries || 3,
      baseDelay: options.retryOptions?.baseDelay || 1000
    };
  }

  /**
   * Make a GET request
   */
  async get<T>(url: string, options: ApiRequestOptions = {}): Promise<T> {
    return this.request<T>(url, { ...options, method: 'GET' });
  }

  /**
   * Make a POST request
   */
  async post<T>(url: string, body?: any, options: ApiRequestOptions = {}): Promise<T> {
    return this.request<T>(url, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
  }

  /**
   * Make a PUT request
   */
  async put<T>(url: string, body?: any, options: ApiRequestOptions = {}): Promise<T> {
    return this.request<T>(url, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
  }

  /**
   * Make a DELETE request
   */
  async delete<T>(url: string, options: ApiRequestOptions = {}): Promise<T> {
    return this.request<T>(url, { ...options, method: 'DELETE' });
  }

  /**
   * Make a request with error handling and retry logic
   */
  private async request<T>(url: string, options: ApiRequestOptions = {}): Promise<T> {
    const timeout = options.timeout || this.timeout;
    const retryable = options.retryable !== false;
    const maxRetries = options.maxRetries || this.retryOptions.maxRetries;

    const operation = async (): Promise<T> => {
      try {
        const response = await withTimeout(fetch(url, options), timeout);

        if (!response.ok) {
          await handleApiError(response);
        }

        const data = await response.json();
        return data as T;
      } catch (error) {
        const appError = error instanceof AppError ? error : new AppError(String(error));
        errorLogger.log(appError, { retryable, maxRetries });
        throw error;
      }
    };

    if (retryable) {
      return retryOperation(operation, {
        maxRetries,
        baseDelay: this.retryOptions.baseDelay
      });
    }

    return operation();
  }
}

/**
 * Default API client instance
 */
export const apiClient = new ApiClient();

/**
 * Fetch with error handling (convenience function)
 */
export async function fetchWithErrorHandling<T>(
  url: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  return apiClient.get<T>(url, options);
}

/**
 * Post with error handling (convenience function)
 */
export async function postWithErrorHandling<T>(
  url: string,
  body?: any,
  options: ApiRequestOptions = {}
): Promise<T> {
  return apiClient.post<T>(url, body, options);
}
