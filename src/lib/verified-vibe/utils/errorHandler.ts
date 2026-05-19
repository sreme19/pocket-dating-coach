/**
 * Error Handler Utility
 * Provides centralized error handling, logging, and recovery mechanisms
 */

export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';
export type ErrorCategory = 'network' | 'validation' | 'auth' | 'server' | 'client' | 'unknown';

export interface ErrorLog {
  id: string;
  timestamp: Date;
  message: string;
  severity: ErrorSeverity;
  category: ErrorCategory;
  context?: Record<string, any>;
  stack?: string;
  userMessage: string;
  retryable: boolean;
  retryCount: number;
  maxRetries: number;
}

export interface ErrorRecoveryOptions {
  retryable?: boolean;
  maxRetries?: number;
  retryDelay?: number; // milliseconds
  fallbackAction?: () => Promise<any>;
  userMessage?: string;
}

/**
 * Custom error class with additional metadata
 */
export class AppError extends Error {
  public readonly severity: ErrorSeverity;
  public readonly category: ErrorCategory;
  public readonly userMessage: string;
  public readonly retryable: boolean;
  public readonly context?: Record<string, any>;

  constructor(
    message: string,
    options: {
      severity?: ErrorSeverity;
      category?: ErrorCategory;
      userMessage?: string;
      retryable?: boolean;
      context?: Record<string, any>;
    } = {}
  ) {
    super(message);
    this.name = 'AppError';
    this.severity = options.severity || 'error';
    this.category = options.category || 'unknown';
    this.userMessage = options.userMessage || 'Something went wrong. Please try again.';
    this.retryable = options.retryable !== false;
    this.context = options.context;

    // Maintain proper prototype chain
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * Error logger for debugging and monitoring
 */
class ErrorLogger {
  private logs: ErrorLog[] = [];
  private maxLogs = 100;

  log(error: Error | AppError, options: ErrorRecoveryOptions = {}): ErrorLog {
    const errorLog: ErrorLog = {
      id: this.generateId(),
      timestamp: new Date(),
      message: error.message,
      severity: error instanceof AppError ? error.severity : 'error',
      category: error instanceof AppError ? error.category : 'unknown',
      context: error instanceof AppError ? error.context : undefined,
      stack: error.stack,
      userMessage: error instanceof AppError ? error.userMessage : options.userMessage || 'An error occurred',
      retryable: options.retryable !== false,
      retryCount: 0,
      maxRetries: options.maxRetries || 3
    };

    this.logs.push(errorLog);

    // Keep logs manageable
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Log to console in development
    if (typeof window !== 'undefined' && import.meta.env.DEV) {
      console.error(`[${errorLog.severity.toUpperCase()}] ${errorLog.message}`, {
        category: errorLog.category,
        context: errorLog.context,
        stack: errorLog.stack
      });
    }

    return errorLog;
  }

  getLogs(): ErrorLog[] {
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs = [];
  }

  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  private generateId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const errorLogger = new ErrorLogger();

/**
 * Categorize error based on type and status code
 */
export function categorizeError(error: any): ErrorCategory {
  if (error instanceof AppError) {
    return error.category;
  }

  if (error instanceof TypeError) {
    return 'client';
  }

  if (error instanceof SyntaxError) {
    return 'client';
  }

  if (error?.status === 401 || error?.status === 403) {
    return 'auth';
  }

  if (error?.status && error.status >= 400 && error.status < 500) {
    return 'validation';
  }

  if (error?.status && error.status >= 500) {
    return 'server';
  }

  if (error?.message?.includes('network') || error?.message?.includes('fetch')) {
    return 'network';
  }

  return 'unknown';
}

/**
 * Get user-friendly error message based on error type
 */
export function getUserFriendlyMessage(error: any): string {
  if (error instanceof AppError) {
    return error.userMessage;
  }

  const category = categorizeError(error);

  const messages: Record<ErrorCategory, string> = {
    network: 'Network connection failed. Please check your internet and try again.',
    validation: 'The information you provided is invalid. Please check and try again.',
    auth: 'You are not authorized to perform this action. Please log in again.',
    server: 'The server is experiencing issues. Please try again later.',
    client: 'Something went wrong on your device. Please refresh and try again.',
    unknown: 'An unexpected error occurred. Please try again.'
  };

  return messages[category];
}

/**
 * Determine if error is retryable
 */
export function isRetryable(error: any): boolean {
  if (error instanceof AppError) {
    return error.retryable;
  }

  const category = categorizeError(error);

  // Retryable categories
  const retryableCategories: ErrorCategory[] = ['network', 'server'];

  return retryableCategories.includes(category);
}

/**
 * Get retry delay based on attempt number (exponential backoff)
 */
export function getRetryDelay(attemptNumber: number, baseDelay: number = 1000): number {
  // Exponential backoff: 1s, 2s, 4s, 8s, etc.
  const delay = baseDelay * Math.pow(2, attemptNumber - 1);
  // Add jitter to prevent thundering herd
  const jitter = Math.random() * 0.1 * delay;
  return Math.min(delay + jitter, 30000); // Cap at 30 seconds
}

/**
 * Retry a failed operation with exponential backoff
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelay?: number;
    onRetry?: (attempt: number, error: Error) => void;
  } = {}
): Promise<T> {
  const maxRetries = options.maxRetries || 3;
  const baseDelay = options.baseDelay || 1000;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries && isRetryable(error)) {
        const delay = getRetryDelay(attempt, baseDelay);
        options.onRetry?.(attempt, lastError);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }

  throw lastError || new Error('Operation failed after retries');
}

/**
 * Handle API errors with standardized response
 */
export async function handleApiError(response: Response): Promise<never> {
  let errorData: any = {};

  try {
    errorData = await response.json();
  } catch {
    // Response is not JSON
  }

  const message = errorData.error || errorData.message || `HTTP ${response.status}`;
  const category = categorizeError({ status: response.status });

  throw new AppError(message, {
    category,
    severity: response.status >= 500 ? 'critical' : 'error',
    userMessage: getUserFriendlyMessage({ status: response.status }),
    retryable: response.status >= 500 || response.status === 429,
    context: { status: response.status, errorData }
  });
}

/**
 * Validate network connectivity
 */
export async function checkNetworkConnectivity(): Promise<boolean> {
  try {
    const response = await fetch('/api/health', { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Wait for network to be available
 */
export async function waitForNetwork(maxWaitTime: number = 30000): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitTime) {
    if (await checkNetworkConnectivity()) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return false;
}

/**
 * Create a timeout promise
 */
export function createTimeout(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(
        new AppError('Operation timed out', {
          category: 'network',
          severity: 'warning',
          userMessage: 'The operation took too long. Please try again.',
          retryable: true
        })
      );
    }, ms);
  });
}

/**
 * Race a promise against a timeout
 */
export async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([promise, createTimeout(ms)]);
}
