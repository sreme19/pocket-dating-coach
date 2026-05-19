/**
 * Error Handling Utilities for Verified Vibe
 *
 * Provides comprehensive error handling, logging, and user-friendly error messages
 * for network errors, API errors, file upload errors, Claude API errors, and Supabase errors.
 */

export type ErrorType =
  | 'network'
  | 'api'
  | 'file_upload'
  | 'claude_api'
  | 'supabase'
  | 'validation'
  | 'unknown';

export interface AppError {
  type: ErrorType;
  message: string;
  userMessage: string;
  statusCode?: number;
  originalError?: Error;
  retryable: boolean;
  timestamp: Date;
}

/**
 * Error logger for debugging and monitoring
 */
export class ErrorLogger {
  private static logs: AppError[] = [];
  private static maxLogs = 100;

  /**
   * Log an error
   */
  static log(error: AppError): void {
    this.logs.push(error);

    // Keep only recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Log to console in development
    if (import.meta.env.DEV) {
      console.error(`[${error.type}] ${error.message}`, error);
    }

    // Send to error tracking service in production
    if (import.meta.env.PROD) {
      this.sendToErrorTracking(error);
    }
  }

  /**
   * Get all logged errors
   */
  static getLogs(): AppError[] {
    return [...this.logs];
  }

  /**
   * Clear logs
   */
  static clearLogs(): void {
    this.logs = [];
  }

  /**
   * Send error to tracking service (e.g., Sentry)
   */
  private static sendToErrorTracking(error: AppError): void {
    // TODO: Implement error tracking service integration
    // Example: Sentry.captureException(error.originalError);
  }
}

/**
 * Network error handler
 */
export function handleNetworkError(error: Error): AppError {
  const message = error.message || 'Network error occurred';
  let userMessage = 'Connection error. Please check your internet connection and try again.';
  let retryable = true;

  if (message.includes('timeout')) {
    userMessage = 'Request timed out. Please try again.';
  } else if (message.includes('refused')) {
    userMessage = 'Connection refused. Please check your internet connection.';
    retryable = false;
  } else if (message.includes('offline')) {
    userMessage = 'You are offline. Please check your internet connection.';
    retryable = false;
  }

  const appError: AppError = {
    type: 'network',
    message,
    userMessage,
    originalError: error,
    retryable,
    timestamp: new Date()
  };

  ErrorLogger.log(appError);
  return appError;
}

/**
 * API error handler
 */
export function handleAPIError(error: Error | Response, statusCode?: number): AppError {
  let message = 'API error occurred';
  let userMessage = 'Something went wrong. Please try again.';
  let retryable = true;
  let code = statusCode;

  if (error instanceof Response) {
    code = error.status;
    message = `API Error: ${error.status} ${error.statusText}`;
  } else {
    message = error.message || message;
  }

  // Handle specific status codes
  switch (code) {
    case 400:
      userMessage = 'Invalid request. Please check your input and try again.';
      retryable = false;
      break;
    case 401:
      userMessage = 'Authentication failed. Please log in again.';
      retryable = false;
      break;
    case 403:
      userMessage = 'You do not have permission to perform this action.';
      retryable = false;
      break;
    case 404:
      userMessage = 'The requested resource was not found.';
      retryable = false;
      break;
    case 429:
      userMessage = 'Too many requests. Please wait a moment and try again.';
      retryable = true;
      break;
    case 500:
      userMessage = 'Server error. Please try again later.';
      retryable = true;
      break;
    case 503:
      userMessage = 'Service unavailable. Please try again later.';
      retryable = true;
      break;
  }

  const appError: AppError = {
    type: 'api',
    message,
    userMessage,
    statusCode: code,
    originalError: error instanceof Error ? error : undefined,
    retryable,
    timestamp: new Date()
  };

  ErrorLogger.log(appError);
  return appError;
}

/**
 * File upload error handler
 */
export function handleFileUploadError(error: Error, fileName?: string): AppError {
  const message = error.message || 'File upload error occurred';
  const messageLower = message.toLowerCase();
  let userMessage = 'File upload failed. Please try again.';
  let retryable = true;

  if (messageLower.includes('too large')) {
    userMessage = 'File is too large. Please upload a smaller file.';
    retryable = false;
  } else if (messageLower.includes('invalid')) {
    userMessage = 'Invalid file type. Please upload a supported file format.';
    retryable = false;
  } else if (messageLower.includes('timeout')) {
    userMessage = 'Upload timed out. Please try again.';
    retryable = true;
  } else if (messageLower.includes('quota')) {
    userMessage = 'Storage quota exceeded. Please delete some files and try again.';
    retryable = false;
  }

  const appError: AppError = {
    type: 'file_upload',
    message: `${message}${fileName ? ` (${fileName})` : ''}`,
    userMessage,
    originalError: error,
    retryable,
    timestamp: new Date()
  };

  ErrorLogger.log(appError);
  return appError;
}

/**
 * Claude API error handler
 */
export function handleClaudeAPIError(error: Error, statusCode?: number): AppError {
  const message = error.message || 'Claude API error occurred';
  const messageLower = message.toLowerCase();
  let userMessage = 'AI processing failed. Please try again.';
  let retryable = true;

  if (messageLower.includes('rate limit')) {
    userMessage = 'Too many requests. Please wait a moment and try again.';
    retryable = true;
  } else if (messageLower.includes('invalid request')) {
    userMessage = 'Invalid request. Please check your input and try again.';
    retryable = false;
  } else if (messageLower.includes('timeout')) {
    userMessage = 'Request timed out. Please try again.';
    retryable = true;
  } else if (messageLower.includes('overloaded')) {
    userMessage = 'Service is busy. Please try again later.';
    retryable = true;
  }

  const appError: AppError = {
    type: 'claude_api',
    message,
    userMessage,
    statusCode,
    originalError: error,
    retryable,
    timestamp: new Date()
  };

  ErrorLogger.log(appError);
  return appError;
}

/**
 * Supabase error handler
 */
export function handleSupabaseError(error: Error, operation?: string): AppError {
  const message = error.message || 'Database error occurred';
  const messageLower = message.toLowerCase();
  let userMessage = 'Database error. Please try again.';
  let retryable = true;

  if (messageLower.includes('connection')) {
    userMessage = 'Connection error. Please check your internet connection.';
    retryable = true;
  } else if (messageLower.includes('authentication')) {
    userMessage = 'Authentication failed. Please log in again.';
    retryable = false;
  } else if (messageLower.includes('permission')) {
    userMessage = 'You do not have permission to perform this action.';
    retryable = false;
  } else if (messageLower.includes('constraint')) {
    userMessage = 'Invalid data. Please check your input and try again.';
    retryable = false;
  } else if (messageLower.includes('timeout')) {
    userMessage = 'Request timed out. Please try again.';
    retryable = true;
  }

  const appError: AppError = {
    type: 'supabase',
    message: `${message}${operation ? ` (${operation})` : ''}`,
    userMessage,
    originalError: error,
    retryable,
    timestamp: new Date()
  };

  ErrorLogger.log(appError);
  return appError;
}

/**
 * Validation error handler
 */
export function handleValidationError(message: string): AppError {
  const appError: AppError = {
    type: 'validation',
    message,
    userMessage: message,
    originalError: new Error(message),
    retryable: false,
    timestamp: new Date()
  };

  ErrorLogger.log(appError);
  return appError;
}

/**
 * Generic error handler
 */
export function handleError(error: unknown, context?: string): AppError {
  let message = 'An unknown error occurred';
  let originalError: Error | undefined;

  if (error instanceof Error) {
    message = error.message;
    originalError = error;
  } else if (typeof error === 'string') {
    message = error;
  } else {
    message = JSON.stringify(error);
  }

  const appError: AppError = {
    type: 'unknown',
    message: `${message}${context ? ` (${context})` : ''}`,
    userMessage: 'An unexpected error occurred. Please try again.',
    originalError,
    retryable: true,
    timestamp: new Date()
  };

  ErrorLogger.log(appError);
  return appError;
}

/**
 * Retry logic with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelayMs: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if error is retryable
      const appError = handleError(error, `Retry attempt ${attempt + 1}/${maxRetries}`);
      if (!appError.retryable || attempt === maxRetries - 1) {
        throw lastError;
      }

      // Exponential backoff: 1s, 2s, 4s, etc.
      const delayMs = initialDelayMs * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

/**
 * Validate file upload
 */
export function validateFileUpload(
  file: File,
  options: {
    maxSizeBytes?: number;
    allowedTypes?: string[];
  } = {}
): { valid: boolean; error?: AppError } {
  const { maxSizeBytes = 10 * 1024 * 1024, allowedTypes = ['image/jpeg', 'image/png', 'image/webp'] } = options;

  // Check file size
  if (file.size > maxSizeBytes) {
    const error = handleFileUploadError(
      new Error(`File size exceeds maximum of ${maxSizeBytes / 1024 / 1024}MB`),
      file.name
    );
    return { valid: false, error };
  }

  // Check file type
  if (!allowedTypes.includes(file.type)) {
    const error = handleFileUploadError(
      new Error(`File type ${file.type} is not allowed`),
      file.name
    );
    return { valid: false, error };
  }

  return { valid: true };
}

/**
 * Validate form input
 */
export function validateFormInput(
  value: string,
  options: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
  } = {}
): { valid: boolean; error?: AppError } {
  const { required = false, minLength, maxLength, pattern } = options;

  // Check required
  if (required && !value) {
    return {
      valid: false,
      error: handleValidationError('This field is required')
    };
  }

  // Check min length
  if (minLength && value.length < minLength) {
    return {
      valid: false,
      error: handleValidationError(`Minimum length is ${minLength} characters`)
    };
  }

  // Check max length
  if (maxLength && value.length > maxLength) {
    return {
      valid: false,
      error: handleValidationError(`Maximum length is ${maxLength} characters`)
    };
  }

  // Check pattern
  if (pattern && !pattern.test(value)) {
    return {
      valid: false,
      error: handleValidationError('Invalid format')
    };
  }

  return { valid: true };
}

/**
 * Create error boundary for components
 */
export function createErrorBoundary(
  onError: (error: AppError) => void
): {
  captureError: (error: unknown, context?: string) => void;
  clearError: () => void;
} {
  return {
    captureError: (error: unknown, context?: string) => {
      const appError = handleError(error, context);
      onError(appError);
    },
    clearError: () => {
      // Clear error state
    }
  };
}
