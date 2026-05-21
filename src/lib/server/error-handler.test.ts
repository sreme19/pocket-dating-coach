import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	validateRequiredFields,
	validateFieldTypes,
	validateEnumValue,
	validateUUID,
	validateStringLength,
	validateArrayLength,
	validateClaudeResponse,
	handleSupabaseError,
	logError,
	ErrorType
} from './error-handler';

describe('Error Handler Utilities', () => {
	describe('validateRequiredFields', () => {
		it('should return valid when all required fields are present', () => {
			const body = { name: 'John', email: 'john@example.com' };
			const result = validateRequiredFields(body, ['name', 'email']);
			expect(result.valid).toBe(true);
			expect(result.missingFields).toHaveLength(0);
		});

		it('should return invalid when required fields are missing', () => {
			const body = { name: 'John' };
			const result = validateRequiredFields(body, ['name', 'email']);
			expect(result.valid).toBe(false);
			expect(result.missingFields).toContain('email');
		});

		it('should treat empty strings as missing', () => {
			const body = { name: '', email: 'john@example.com' };
			const result = validateRequiredFields(body, ['name', 'email']);
			expect(result.valid).toBe(false);
			expect(result.missingFields).toContain('name');
		});

		it('should treat null and undefined as missing', () => {
			const body = { name: null, email: undefined };
			const result = validateRequiredFields(body, ['name', 'email']);
			expect(result.valid).toBe(false);
			expect(result.missingFields).toHaveLength(2);
		});
	});

	describe('validateFieldTypes', () => {
		it('should validate correct field types', () => {
			const body = { name: 'John', age: 30 };
			const typeMap = { name: 'string', age: 'number' };
			const result = validateFieldTypes(body, typeMap);
			expect(result.valid).toBe(true);
			expect(result.invalidFields).toHaveLength(0);
		});

		it('should detect invalid field types', () => {
			const body = { name: 'John', age: '30' };
			const typeMap = { name: 'string', age: 'number' };
			const result = validateFieldTypes(body, typeMap);
			expect(result.valid).toBe(false);
			expect(result.invalidFields).toHaveLength(1);
			expect(result.invalidFields[0].field).toBe('age');
		});

		it('should skip undefined fields', () => {
			const body = { name: 'John' };
			const typeMap = { name: 'string', age: 'number' };
			const result = validateFieldTypes(body, typeMap);
			expect(result.valid).toBe(true);
		});
	});

	describe('validateEnumValue', () => {
		it('should validate correct enum values', () => {
			const result = validateEnumValue('bestie', ['bestie', 'wingman']);
			expect(result.valid).toBe(true);
			expect(result.error).toBeUndefined();
		});

		it('should reject invalid enum values', () => {
			const result = validateEnumValue('invalid', ['bestie', 'wingman']);
			expect(result.valid).toBe(false);
			expect(result.error).toBeDefined();
		});

		it('should handle numeric enum values', () => {
			const result = validateEnumValue(1, ['0', '1', '2']);
			expect(result.valid).toBe(true);
		});
	});

	describe('validateUUID', () => {
		it('should validate correct UUID format', () => {
			const uuid = '550e8400-e29b-41d4-a716-446655440000';
			const result = validateUUID(uuid);
			expect(result.valid).toBe(true);
			expect(result.error).toBeUndefined();
		});

		it('should reject invalid UUID format', () => {
			const result = validateUUID('not-a-uuid');
			expect(result.valid).toBe(false);
			expect(result.error).toBeDefined();
		});

		it('should reject non-string values', () => {
			const result = validateUUID(12345);
			expect(result.valid).toBe(false);
		});
	});

	describe('validateStringLength', () => {
		it('should validate string within length constraints', () => {
			const result = validateStringLength('hello', 1, 10);
			expect(result.valid).toBe(true);
		});

		it('should reject string below minimum length', () => {
			const result = validateStringLength('hi', 5);
			expect(result.valid).toBe(false);
			expect(result.error).toContain('at least 5');
		});

		it('should reject string above maximum length', () => {
			const result = validateStringLength('hello world', undefined, 5);
			expect(result.valid).toBe(false);
			expect(result.error).toContain('at most 5');
		});

		it('should reject non-string values', () => {
			const result = validateStringLength(123, 1, 10);
			expect(result.valid).toBe(false);
		});
	});

	describe('validateArrayLength', () => {
		it('should validate array within length constraints', () => {
			const result = validateArrayLength([1, 2, 3], 1, 5);
			expect(result.valid).toBe(true);
		});

		it('should reject array below minimum length', () => {
			const result = validateArrayLength([1], 2);
			expect(result.valid).toBe(false);
			expect(result.error).toContain('at least 2');
		});

		it('should reject array above maximum length', () => {
			const result = validateArrayLength([1, 2, 3, 4, 5], undefined, 3);
			expect(result.valid).toBe(false);
			expect(result.error).toContain('at most 3');
		});

		it('should reject non-array values', () => {
			const result = validateArrayLength('not an array', 1);
			expect(result.valid).toBe(false);
		});
	});

	describe('validateClaudeResponse', () => {
		it('should validate correct Claude response', () => {
			const response = {
				content: [
					{
						type: 'text',
						text: 'This is a response'
					}
				]
			};
			const result = validateClaudeResponse(response);
			expect(result.valid).toBe(true);
			expect(result.error).toBeUndefined();
		});

		it('should reject response with empty content array', () => {
			const response = { content: [] };
			const result = validateClaudeResponse(response);
			expect(result.valid).toBe(false);
			expect(result.error).toBeDefined();
		});

		it('should reject response with non-text content', () => {
			const response = {
				content: [
					{
						type: 'image',
						data: 'base64...'
					}
				]
			};
			const result = validateClaudeResponse(response);
			expect(result.valid).toBe(false);
		});

		it('should reject invalid response structure', () => {
			const result = validateClaudeResponse(null);
			expect(result.valid).toBe(false);
		});
	});

	describe('handleSupabaseError', () => {
		it('should handle PGRST116 (no rows found) error', () => {
			const error = { code: 'PGRST116' };
			const result = handleSupabaseError(error, 'Test');
			expect(result.userMessage).toBe('Resource not found');
			expect(result.shouldThrow).toBe(true);
		});

		it('should handle unique constraint violation', () => {
			const error = { code: '23505' };
			const result = handleSupabaseError(error, 'Test');
			expect(result.userMessage).toBe('This resource already exists');
			expect(result.shouldThrow).toBe(true);
		});

		it('should handle foreign key constraint violation', () => {
			const error = { code: '23503' };
			const result = handleSupabaseError(error, 'Test');
			expect(result.userMessage).toBe('Invalid reference to related resource');
			expect(result.shouldThrow).toBe(true);
		});

		it('should handle table not found error', () => {
			const error = { code: '42P01' };
			const result = handleSupabaseError(error, 'Test');
			expect(result.userMessage).toBe('Database configuration error');
			expect(result.shouldThrow).toBe(true);
		});

		it('should return default message for unknown errors', () => {
			const error = { code: 'UNKNOWN' };
			const result = handleSupabaseError(error, 'Test');
			expect(result.userMessage).toBe('Database operation failed');
			expect(result.shouldThrow).toBe(true);
		});

		it('should handle null error gracefully', () => {
			const result = handleSupabaseError(null, 'Test');
			expect(result.userMessage).toBe('Database operation failed');
			expect(result.shouldThrow).toBe(false);
		});
	});

	describe('logError', () => {
		beforeEach(() => {
			vi.spyOn(console, 'error').mockImplementation(() => {});
		});

		it('should log error with context and type', () => {
			const testError = new Error('Test error');
			logError('TestContext', testError, ErrorType.VALIDATION_ERROR);
			expect(console.error).toHaveBeenCalled();
		});

		it('should include details in log', () => {
			const testError = new Error('Test error');
			const details = { userId: '123', field: 'email' };
			logError('TestContext', testError, ErrorType.DATABASE_ERROR, details);
			expect(console.error).toHaveBeenCalled();
		});
	});
});
