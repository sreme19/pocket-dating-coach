/**
 * Comprehensive error handling utilities for API endpoints
 * Provides consistent error responses, logging, and validation
 * 
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
 */

import { error as svelteError } from '@sveltejs/kit';

/**
 * Error types for different scenarios
 */
export enum ErrorType {
	VALIDATION_ERROR = 'VALIDATION_ERROR',
	AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
	AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
	NOT_FOUND_ERROR = 'NOT_FOUND_ERROR',
	DATABASE_ERROR = 'DATABASE_ERROR',
	EXTERNAL_API_ERROR = 'EXTERNAL_API_ERROR',
	RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
	INTERNAL_ERROR = 'INTERNAL_ERROR'
}

/**
 * Standard error response structure
 */
export interface ErrorResponse {
	success: false;
	error: {
		type: ErrorType;
		message: string;
		code: number;
		details?: Record<string, unknown>;
		timestamp: number;
	};
}

/**
 * HTTP status code mapping for error types
 */
const ERROR_STATUS_CODES: Record<ErrorType, number> = {
	[ErrorType.VALIDATION_ERROR]: 400,
	[ErrorType.AUTHENTICATION_ERROR]: 401,
	[ErrorType.AUTHORIZATION_ERROR]: 403,
	[ErrorType.NOT_FOUND_ERROR]: 404,
	[ErrorType.DATABASE_ERROR]: 500,
	[ErrorType.EXTERNAL_API_ERROR]: 502,
	[ErrorType.RATE_LIMIT_ERROR]: 429,
	[ErrorType.INTERNAL_ERROR]: 500
};

/**
 * User-friendly error messages
 */
const USER_FRIENDLY_MESSAGES: Record<ErrorType, string> = {
	[ErrorType.VALIDATION_ERROR]: 'Invalid request parameters. Please check your input.',
	[ErrorType.AUTHENTICATION_ERROR]: 'Authentication required. Please log in.',
	[ErrorType.AUTHORIZATION_ERROR]: 'You do not have permission to access this resource.',
	[ErrorType.NOT_FOUND_ERROR]: 'The requested resource was not found.',
	[ErrorType.DATABASE_ERROR]: 'Database error occurred. Please try again later.',
	[ErrorType.EXTERNAL_API_ERROR]: 'External service error. Please try again later.',
	[ErrorType.RATE_LIMIT_ERROR]: 'Too many requests. Please wait before trying again.',
	[ErrorType.INTERNAL_ERROR]: 'An unexpected error occurred. Please try again later.'
};

/**
 * Log error with context
 */
export function logError(
	context: string,
	error: unknown,
	errorType: ErrorType,
	details?: Record<string, unknown>
): void {
	const timestamp = new Date().toISOString();
	const errorMessage = error instanceof Error ? error.message : String(error);
	const errorStack = error instanceof Error ? error.stack : undefined;

	console.error(`[${timestamp}] [${context}] [${errorType}]`, {
		message: errorMessage,
		stack: errorStack,
		details
	});
}

/**
 * Validate required fields in request body
 */
export function validateRequiredFields(
	body: Record<string, unknown>,
	requiredFields: string[]
): { valid: boolean; missingFields: string[] } {
	const missingFields = requiredFields.filter(field => {
		const value = body[field];
		return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
	});

	return {
		valid: missingFields.length === 0,
		missingFields
	};
}

/**
 * Validate field types
 */
export function validateFieldTypes(
	body: Record<string, unknown>,
	typeMap: Record<string, string>
): { valid: boolean; invalidFields: Array<{ field: string; expected: string; actual: string }> } {
	const invalidFields: Array<{ field: string; expected: string; actual: string }> = [];

	for (const [field, expectedType] of Object.entries(typeMap)) {
		const value = body[field];
		if (value === undefined || value === null) continue;

		const actualType = Array.isArray(value) ? 'array' : typeof value;
		if (actualType !== expectedType) {
			invalidFields.push({
				field,
				expected: expectedType,
				actual: actualType
			});
		}
	}

	return {
		valid: invalidFields.length === 0,
		invalidFields
	};
}

/**
 * Validate enum values
 */
export function validateEnumValue(
	value: unknown,
	allowedValues: string[]
): { valid: boolean; error?: string } {
	if (!allowedValues.includes(String(value))) {
		return {
			valid: false,
			error: `Value must be one of: ${allowedValues.join(', ')}`
		};
	}
	return { valid: true };
}

/**
 * Validate UUID format
 */
export function validateUUID(value: unknown): { valid: boolean; error?: string } {
	const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
	if (typeof value !== 'string' || !uuidRegex.test(value)) {
		return {
			valid: false,
			error: 'Invalid UUID format'
		};
	}
	return { valid: true };
}

/**
 * Validate string length
 */
export function validateStringLength(
	value: unknown,
	minLength?: number,
	maxLength?: number
): { valid: boolean; error?: string } {
	if (typeof value !== 'string') {
		return {
			valid: false,
			error: 'Value must be a string'
		};
	}

	if (minLength !== undefined && value.length < minLength) {
		return {
			valid: false,
			error: `String must be at least ${minLength} characters long`
		};
	}

	if (maxLength !== undefined && value.length > maxLength) {
		return {
			valid: false,
			error: `String must be at most ${maxLength} characters long`
		};
	}

	return { valid: true };
}

/**
 * Validate array length
 */
export function validateArrayLength(
	value: unknown,
	minLength?: number,
	maxLength?: number
): { valid: boolean; error?: string } {
	if (!Array.isArray(value)) {
		return {
			valid: false,
			error: 'Value must be an array'
		};
	}

	if (minLength !== undefined && value.length < minLength) {
		return {
			valid: false,
			error: `Array must have at least ${minLength} items`
		};
	}

	if (maxLength !== undefined && value.length > maxLength) {
		return {
			valid: false,
			error: `Array must have at most ${maxLength} items`
		};
	}

	return { valid: true };
}

/**
 * Handle validation error and throw SvelteKit error
 */
export function throwValidationError(
	message: string,
	details?: Record<string, unknown>
): never {
	logError('Validation', new Error(message), ErrorType.VALIDATION_ERROR, details);
	throw svelteError(400, message);
}

/**
 * Handle authentication error and throw SvelteKit error
 */
export function throwAuthenticationError(message: string = 'Authentication required'): never {
	logError('Authentication', new Error(message), ErrorType.AUTHENTICATION_ERROR);
	throw svelteError(401, message);
}

/**
 * Handle authorization error and throw SvelteKit error
 */
export function throwAuthorizationError(message: string = 'Access denied'): never {
	logError('Authorization', new Error(message), ErrorType.AUTHORIZATION_ERROR);
	throw svelteError(403, message);
}

/**
 * Handle not found error and throw SvelteKit error
 */
export function throwNotFoundError(resource: string): never {
	const message = `${resource} not found`;
	logError('Not Found', new Error(message), ErrorType.NOT_FOUND_ERROR);
	throw svelteError(404, message);
}

/**
 * Handle database error and throw SvelteKit error
 */
export function throwDatabaseError(
	context: string,
	error: unknown,
	userMessage: string = 'Database error occurred'
): never {
	logError(context, error, ErrorType.DATABASE_ERROR);
	throw svelteError(500, userMessage);
}

/**
 * Handle external API error and throw SvelteKit error
 */
export function throwExternalAPIError(
	context: string,
	error: unknown,
	userMessage: string = 'External service error'
): never {
	logError(context, error, ErrorType.EXTERNAL_API_ERROR);
	throw svelteError(502, userMessage);
}

/**
 * Handle rate limit error and throw SvelteKit error
 */
export function throwRateLimitError(message: string = 'Too many requests'): never {
	logError('Rate Limit', new Error(message), ErrorType.RATE_LIMIT_ERROR);
	throw svelteError(429, message);
}

/**
 * Handle internal error and throw SvelteKit error
 */
export function throwInternalError(
	context: string,
	error: unknown,
	userMessage: string = 'An unexpected error occurred'
): never {
	logError(context, error, ErrorType.INTERNAL_ERROR);
	throw svelteError(500, userMessage);
}

/**
 * Safe JSON parsing with error handling
 */
export function safeJsonParse(
	jsonString: string,
	context: string
): { success: boolean; data?: unknown; error?: string } {
	try {
		const data = JSON.parse(jsonString);
		return { success: true, data };
	} catch (err) {
		const message = `Invalid JSON in ${context}`;
		logError(context, err, ErrorType.VALIDATION_ERROR);
		return { success: false, error: message };
	}
}

/**
 * Validate Supabase error and provide user-friendly message
 */
export function handleSupabaseError(
	error: unknown,
	context: string,
	defaultMessage: string = 'Database operation failed'
): { userMessage: string; shouldThrow: boolean } {
	if (!error) {
		return { userMessage: defaultMessage, shouldThrow: false };
	}

	const errorObj = error as Record<string, unknown>;

	// Handle specific Supabase error codes
	if (errorObj.code === 'PGRST116') {
		// No rows found
		return { userMessage: 'Resource not found', shouldThrow: true };
	}

	if (errorObj.code === '23505') {
		// Unique constraint violation
		return { userMessage: 'This resource already exists', shouldThrow: true };
	}

	if (errorObj.code === '23503') {
		// Foreign key constraint violation
		return { userMessage: 'Invalid reference to related resource', shouldThrow: true };
	}

	if (errorObj.code === '42P01') {
		// Table does not exist
		return { userMessage: 'Database configuration error', shouldThrow: true };
	}

	// Generic database error
	logError(context, error, ErrorType.DATABASE_ERROR);
	return { userMessage: defaultMessage, shouldThrow: true };
}

/**
 * Validate Claude API response
 */
export function validateClaudeResponse(response: unknown): { valid: boolean; error?: string } {
	if (!response || typeof response !== 'object') {
		return { valid: false, error: 'Invalid response from Claude API' };
	}

	const responseObj = response as Record<string, unknown>;

	if (!Array.isArray(responseObj.content) || responseObj.content.length === 0) {
		return { valid: false, error: 'No content in Claude response' };
	}

	const firstBlock = (responseObj.content as unknown[])[0] as Record<string, unknown>;
	if (firstBlock.type !== 'text' || typeof firstBlock.text !== 'string') {
		return { valid: false, error: 'Invalid content type in Claude response' };
	}

	return { valid: true };
}

/**
 * Wrap async function with error handling
 */
export async function withErrorHandling<T>(
	fn: () => Promise<T>,
	context: string,
	errorType: ErrorType = ErrorType.INTERNAL_ERROR
): Promise<T | null> {
	try {
		return await fn();
	} catch (err) {
		logError(context, err, errorType);
		return null;
	}
}

/**
 * Create error response object
 */
export function createErrorResponse(
	errorType: ErrorType,
	message: string,
	details?: Record<string, unknown>
): ErrorResponse {
	return {
		success: false,
		error: {
			type: errorType,
			message,
			code: ERROR_STATUS_CODES[errorType],
			details,
			timestamp: Date.now()
		}
	};
}

/**
 * Get user-friendly message for error type
 */
export function getUserFriendlyMessage(errorType: ErrorType): string {
	return USER_FRIENDLY_MESSAGES[errorType];
}
