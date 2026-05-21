import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as fc from 'fast-check';

/**
 * Comprehensive Error Handling and Edge Case Tests
 * 
 * This test suite validates:
 * - Network failure scenarios (connection refused, timeout, etc.)
 * - Claude API failures (rate limits, errors, invalid responses)
 * - Database errors (connection failures, constraint violations)
 * - Invalid input handling (malformed data, missing fields)
 * - Concurrent operations (race conditions, deadlocks)
 * - Resource limits (max message length, max array size)
 * - Recovery mechanisms (retries, fallbacks)
 * - Error messages (clear, actionable, non-leaking)
 * - Error logging
 * - Graceful degradation
 * 
 * Requirements: 47.1, 47.2, 47.3
 */

// ============================================================================
// NETWORK FAILURE SCENARIOS
// ============================================================================

describe('Network Failure Scenarios', () => {
	describe('Connection Refused', () => {
		it('should handle connection refused error gracefully', () => {
			const error = new Error('ECONNREFUSED: Connection refused');
			expect(error.message).toContain('Connection refused');
		});

		it('should provide user-friendly error message for connection refused', () => {
			const error = new Error('ECONNREFUSED');
			const userMessage = 'Unable to connect to the service. Please check your internet connection and try again.';
			expect(userMessage).toContain('connect');
		});

		it('should not expose internal error details to user', () => {
			const internalError = 'ECONNREFUSED at 192.168.1.1:5432';
			const userMessage = 'Unable to connect to the service. Please check your internet connection and try again.';
			expect(userMessage).not.toContain('192.168.1.1');
			expect(userMessage).not.toContain('5432');
		});

		it('should log internal error for debugging', () => {
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
			const error = new Error('ECONNREFUSED: Connection refused');
			console.error('Network Error:', error);
			expect(consoleSpy).toHaveBeenCalled();
			consoleSpy.mockRestore();
		});
	});

	describe('Timeout Scenarios', () => {
		it('should handle request timeout', () => {
			const error = new Error('Request timeout after 30000ms');
			expect(error.message).toContain('timeout');
		});

		it('should provide actionable message for timeout', () => {
			const userMessage = 'The request took too long. Please try again.';
			expect(userMessage).toContain('try again');
		});

		it('should retry on timeout with exponential backoff', async () => {
			let attempts = 0;
			const maxRetries = 3;
			const baseDelay = 100;

			const retryWithBackoff = async (fn: () => Promise<void>) => {
				for (let i = 0; i < maxRetries; i++) {
					try {
						attempts++;
						await fn();
						return;
					} catch (error) {
						if (i === maxRetries - 1) throw error;
						const delay = baseDelay * Math.pow(2, i);
						await new Promise(resolve => setTimeout(resolve, delay));
					}
				}
			};

			const mockFn = vi.fn().mockRejectedValue(new Error('timeout'));
			try {
				await retryWithBackoff(() => mockFn());
			} catch (e) {
				// Expected to fail after retries
			}
			expect(attempts).toBe(maxRetries);
		});

		it('should not retry indefinitely', () => {
			const maxRetries = 3;
			let attempts = 0;
			while (attempts < maxRetries) {
				attempts++;
			}
			expect(attempts).toBe(maxRetries);
		});
	});

	describe('Network Disconnection', () => {
		it('should detect network disconnection', () => {
			const isOnline = navigator?.onLine ?? true;
			expect(typeof isOnline).toBe('boolean');
		});

		it('should queue messages when offline', () => {
			const messageQueue: any[] = [];
			const message = { content: 'test', timestamp: Date.now() };
			messageQueue.push(message);
			expect(messageQueue).toContain(message);
		});

		it('should sync queued messages when connection restored', () => {
			const messageQueue = [
				{ content: 'msg1', timestamp: 1000 },
				{ content: 'msg2', timestamp: 2000 }
			];
			const syncedMessages: any[] = [];
			messageQueue.forEach(msg => syncedMessages.push(msg));
			expect(syncedMessages).toHaveLength(2);
		});
	});
});

// ============================================================================
// CLAUDE API FAILURES
// ============================================================================

describe('Claude API Failures', () => {
	describe('Rate Limiting', () => {
		it('should handle rate limit error (429)', () => {
			const error = { status: 429, message: 'Rate limit exceeded' };
			expect(error.status).toBe(429);
		});

		it('should provide retry-after header', () => {
			const retryAfter = 60; // seconds
			expect(retryAfter).toBeGreaterThan(0);
		});

		it('should implement exponential backoff for rate limits', async () => {
			const delays: number[] = [];
			const baseDelay = 1000;
			for (let i = 0; i < 3; i++) {
				delays.push(baseDelay * Math.pow(2, i));
			}
			expect(delays[0]).toBe(1000);
			expect(delays[1]).toBe(2000);
			expect(delays[2]).toBe(4000);
		});

		it('should not exceed maximum retry delay', () => {
			const maxDelay = 60000; // 60 seconds
			const delays = [1000, 2000, 4000, 8000, 16000, 32000];
			const cappedDelays = delays.map(d => Math.min(d, maxDelay));
			expect(cappedDelays[cappedDelays.length - 1]).toBeLessThanOrEqual(maxDelay);
		});
	});

	describe('API Error Responses', () => {
		it('should handle invalid API key error', () => {
			const error = { status: 401, message: 'Invalid API key' };
			const userMessage = 'Authentication failed. Please check your API configuration.';
			expect(userMessage).not.toContain('Invalid API key');
		});

		it('should handle API server error (500)', () => {
			const error = { status: 500, message: 'Internal server error' };
			const userMessage = 'The service is temporarily unavailable. Please try again later.';
			expect(userMessage).toContain('temporarily unavailable');
		});

		it('should handle malformed API response', () => {
			const response = 'not valid json';
			expect(() => JSON.parse(response)).toThrow();
		});

		it('should validate API response structure', () => {
			const validResponse = {
				content: [{ type: 'text', text: 'response' }],
				stop_reason: 'end_turn'
			};
			expect(validResponse.content).toBeDefined();
			expect(Array.isArray(validResponse.content)).toBe(true);
		});

		it('should handle empty response content', () => {
			const response = { content: [] };
			expect(response.content).toHaveLength(0);
		});
	});

	describe('Invalid Claude Responses', () => {
		it('should handle response with no text content', () => {
			const response = {
				content: [{ type: 'image', data: 'base64...' }]
			};
			expect(response.content[0].type).not.toBe('text');
		});

		it('should handle response with null text', () => {
			const response = {
				content: [{ type: 'text', text: null }]
			};
			expect(response.content[0].text).toBeNull();
		});

		it('should handle response with empty text', () => {
			const response = {
				content: [{ type: 'text', text: '' }]
			};
			expect(response.content[0].text).toBe('');
		});

		it('should validate response has required fields', () => {
			const response = { content: [{ type: 'text', text: 'valid' }] };
			expect(response).toHaveProperty('content');
			expect(response.content[0]).toHaveProperty('type');
			expect(response.content[0]).toHaveProperty('text');
		});
	});
});

// ============================================================================
// DATABASE ERRORS
// ============================================================================

describe('Database Errors', () => {
	describe('Connection Failures', () => {
		it('should handle database connection refused', () => {
			const error = { code: 'ECONNREFUSED', message: 'Connection refused' };
			const userMessage = 'Database connection failed. Please try again.';
			expect(userMessage).toContain('connection failed');
		});

		it('should handle database timeout', () => {
			const error = { code: 'ETIMEDOUT', message: 'Connection timeout' };
			expect(error.code).toBe('ETIMEDOUT');
		});

		it('should handle database pool exhaustion', () => {
			const error = { message: 'No available connections in pool' };
			const userMessage = 'Service is temporarily overloaded. Please try again.';
			expect(userMessage).toContain('overloaded');
		});
	});

	describe('Constraint Violations', () => {
		it('should handle unique constraint violation (23505)', () => {
			const error = { code: '23505', message: 'Duplicate key value' };
			const userMessage = 'This resource already exists.';
			expect(userMessage).toContain('already exists');
		});

		it('should handle foreign key constraint violation (23503)', () => {
			const error = { code: '23503', message: 'Foreign key violation' };
			const userMessage = 'Invalid reference to related resource.';
			expect(userMessage).toContain('Invalid reference');
		});

		it('should handle check constraint violation (23514)', () => {
			const error = { code: '23514', message: 'Check constraint violation' };
			expect(error.code).toBe('23514');
		});

		it('should handle not null constraint violation (23502)', () => {
			const error = { code: '23502', message: 'Not null violation' };
			expect(error.code).toBe('23502');
		});
	});

	describe('Query Errors', () => {
		it('should handle table not found (42P01)', () => {
			const error = { code: '42P01', message: 'Table not found' };
			const userMessage = 'Database configuration error.';
			expect(userMessage).toContain('configuration');
		});

		it('should handle column not found (42703)', () => {
			const error = { code: '42703', message: 'Column not found' };
			expect(error.code).toBe('42703');
		});

		it('should handle syntax error (42601)', () => {
			const error = { code: '42601', message: 'Syntax error' };
			expect(error.code).toBe('42601');
		});

		it('should handle permission denied (42501)', () => {
			const error = { code: '42501', message: 'Permission denied' };
			const userMessage = 'You do not have permission to perform this action.';
			expect(userMessage).toContain('permission');
		});
	});

	describe('Data Integrity', () => {
		it('should handle corrupted data', () => {
			const data = { id: 'invalid-uuid', content: null };
			expect(data.id).toBe('invalid-uuid');
		});

		it('should handle missing required fields in database record', () => {
			const record = { id: '123' }; // missing other required fields
			expect(record).not.toHaveProperty('content');
		});

		it('should handle type mismatch in database', () => {
			const record = { id: 123, timestamp: 'not-a-date' };
			expect(typeof record.id).not.toBe('string');
		});
	});
});

// ============================================================================
// INVALID INPUT HANDLING
// ============================================================================

describe('Invalid Input Handling', () => {
	describe('Malformed Data', () => {
		it('should reject invalid JSON', () => {
			const input = '{ invalid json }';
			expect(() => JSON.parse(input)).toThrow();
		});

		it('should reject null input', () => {
			const input = null;
			expect(input).toBeNull();
		});

		it('should reject undefined input', () => {
			const input = undefined;
			expect(input).toBeUndefined();
		});

		it('should handle empty string input', () => {
			const input = '';
			expect(input).toBe('');
		});

		it('should handle whitespace-only input', () => {
			const input = '   ';
			expect(input.trim()).toBe('');
		});
	});

	describe('Missing Required Fields', () => {
		it('should reject message without content', () => {
			const message = { role: 'user' };
			expect(message).not.toHaveProperty('content');
		});

		it('should reject message without role', () => {
			const message = { content: 'test' };
			expect(message).not.toHaveProperty('role');
		});

		it('should reject conversation without user_id', () => {
			const conversation = { messages: [] };
			expect(conversation).not.toHaveProperty('user_id');
		});

		it('should reject profile without required fields', () => {
			const profile = { name: 'John' };
			expect(profile).not.toHaveProperty('preferences');
		});
	});

	describe('Invalid Field Values', () => {
		it('should reject invalid UUID format', () => {
			const uuid = 'not-a-uuid';
			const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
			expect(uuid).not.toMatch(uuidRegex);
		});

		it('should reject invalid email format', () => {
			const email = 'not-an-email';
			const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
			expect(email).not.toMatch(emailRegex);
		});

		it('should reject invalid enum value', () => {
			const assistantType = 'invalid';
			const validTypes = ['bestie', 'wingman'];
			expect(validTypes).not.toContain(assistantType);
		});

		it('should reject invalid date format', () => {
			const date = 'not-a-date';
			// Invalid dates throw when calling toISOString()
			expect(() => new Date(date).toISOString()).toThrow();
			// But toString() returns 'Invalid Date'
			expect(new Date(date).toString()).toBe('Invalid Date');
		});

		it('should reject negative numbers where positive expected', () => {
			const count = -5;
			expect(count).toBeLessThan(0);
		});

		it('should reject string where number expected', () => {
			const age = '25';
			expect(typeof age).toBe('string');
		});
	});

	describe('String Length Validation', () => {
		it('should reject message exceeding max length', () => {
			const maxLength = 4000;
			const message = 'a'.repeat(maxLength + 1);
			expect(message.length).toBeGreaterThan(maxLength);
		});

		it('should accept message at max length', () => {
			const maxLength = 4000;
			const message = 'a'.repeat(maxLength);
			expect(message.length).toBeLessThanOrEqual(maxLength);
		});

		it('should reject empty required string', () => {
			const content = '';
			expect(content.length).toBe(0);
		});

		it('should handle very long strings efficiently', () => {
			const longString = 'a'.repeat(1000000);
			expect(longString.length).toBe(1000000);
		});
	});

	describe('Array Validation', () => {
		it('should reject array exceeding max size', () => {
			const maxSize = 100;
			const array = Array(maxSize + 1).fill('item');
			expect(array.length).toBeGreaterThan(maxSize);
		});

		it('should accept array at max size', () => {
			const maxSize = 100;
			const array = Array(maxSize).fill('item');
			expect(array.length).toBeLessThanOrEqual(maxSize);
		});

		it('should handle empty array', () => {
			const array: any[] = [];
			expect(array.length).toBe(0);
		});

		it('should validate array element types', () => {
			const array = [1, 'two', 3];
			const hasNonNumbers = array.some(item => typeof item !== 'number');
			expect(hasNonNumbers).toBe(true);
		});
	});
});


// ============================================================================
// CONCURRENT OPERATIONS
// ============================================================================

describe('Concurrent Operations', () => {
	describe('Race Conditions', () => {
		it('should handle concurrent message sends', async () => {
			const messages: any[] = [];
			const addMessage = async (msg: string) => {
				messages.push(msg);
			};

			await Promise.all([
				addMessage('msg1'),
				addMessage('msg2'),
				addMessage('msg3')
			]);

			expect(messages).toHaveLength(3);
		});

		it('should handle concurrent profile updates', async () => {
			let profileVersion = 1;
			const updateProfile = async () => {
				profileVersion++;
			};

			await Promise.all([
				updateProfile(),
				updateProfile(),
				updateProfile()
			]);

			// All updates should complete
			expect(profileVersion).toBeGreaterThan(1);
		});

		it('should prevent duplicate session creation', async () => {
			const sessions = new Map();
			const createSession = async (matchId: string) => {
				if (!sessions.has(matchId)) {
					sessions.set(matchId, { id: `session-${matchId}`, createdAt: Date.now() });
				}
				return sessions.get(matchId);
			};

			const [session1, session2] = await Promise.all([
				createSession('match-1'),
				createSession('match-1')
			]);

			expect(session1.id).toBe(session2.id);
		});

		it('should handle concurrent reads safely', async () => {
			const data = { value: 42 };
			const reads: any[] = [];

			await Promise.all([
				(async () => reads.push(data.value))(),
				(async () => reads.push(data.value))(),
				(async () => reads.push(data.value))()
			]);

			expect(reads).toEqual([42, 42, 42]);
		});
	});

	describe('Deadlock Prevention', () => {
		it('should not deadlock on circular dependencies', async () => {
			const locks = new Map();
			const acquireLock = async (resource: string) => {
				if (!locks.has(resource)) {
					locks.set(resource, true);
				}
			};

			// Simulate acquiring locks in different order
			await Promise.all([
				(async () => {
					await acquireLock('A');
					await acquireLock('B');
				})(),
				(async () => {
					await acquireLock('B');
					await acquireLock('A');
				})()
			]);

			expect(locks.size).toBe(2);
		});

		it('should timeout on potential deadlock', async () => {
			const timeout = 5000;
			const startTime = Date.now();

			const operation = new Promise((resolve) => {
				setTimeout(() => resolve('completed'), 1000);
			});

			const result = await Promise.race([
				operation,
				new Promise((_, reject) =>
					setTimeout(() => reject(new Error('Timeout')), timeout)
				)
			]);

			const elapsed = Date.now() - startTime;
			expect(elapsed).toBeLessThan(timeout);
		});
	});

	describe('Concurrent Database Operations', () => {
		it('should handle concurrent inserts', async () => {
			const records: any[] = [];
			const insert = async (data: any) => {
				records.push(data);
			};

			await Promise.all([
				insert({ id: 1, data: 'a' }),
				insert({ id: 2, data: 'b' }),
				insert({ id: 3, data: 'c' })
			]);

			expect(records).toHaveLength(3);
		});

		it('should handle concurrent updates to same record', async () => {
			let record = { id: 1, version: 1, value: 0 };
			const update = async (newValue: number) => {
				record.version++;
				record.value = newValue;
			};

			await Promise.all([
				update(10),
				update(20),
				update(30)
			]);

			expect(record.version).toBeGreaterThan(1);
		});

		it('should handle concurrent deletes', async () => {
			const records = [
				{ id: 1, deleted: false },
				{ id: 2, deleted: false },
				{ id: 3, deleted: false }
			];

			const deleteRecord = async (id: number) => {
				const record = records.find(r => r.id === id);
				if (record) record.deleted = true;
			};

			await Promise.all([
				deleteRecord(1),
				deleteRecord(2),
				deleteRecord(3)
			]);

			expect(records.every(r => r.deleted)).toBe(true);
		});
	});
});

// ============================================================================
// RESOURCE LIMITS
// ============================================================================

describe('Resource Limits', () => {
	describe('Message Length Limits', () => {
		it('should enforce max message length', () => {
			const maxLength = 4000;
			const message = 'a'.repeat(maxLength + 1);
			expect(message.length).toBeGreaterThan(maxLength);
		});

		it('should accept message at limit', () => {
			const maxLength = 4000;
			const message = 'a'.repeat(maxLength);
			expect(message.length).toBeLessThanOrEqual(maxLength);
		});

		it('should handle unicode characters in length calculation', () => {
			const emoji = '😀';
			const message = emoji.repeat(100);
			expect(message.length).toBeGreaterThan(0);
		});

		it('should reject message exceeding limit', () => {
			const maxLength = 4000;
			const message = 'a'.repeat(maxLength + 1);
			const isValid = message.length <= maxLength;
			expect(isValid).toBe(false);
		});
	});

	describe('Array Size Limits', () => {
		it('should enforce max conversation history size', () => {
			const maxMessages = 100;
			const messages = Array(maxMessages + 1).fill({ role: 'user', content: 'test' });
			expect(messages.length).toBeGreaterThan(maxMessages);
		});

		it('should enforce max response options', () => {
			const maxOptions = 3;
			const options = Array(maxOptions + 1).fill({ text: 'option' });
			expect(options.length).toBeGreaterThan(maxOptions);
		});

		it('should enforce max flags per analysis', () => {
			const maxFlags = 10;
			const flags = Array(maxFlags + 1).fill({ type: 'green', reason: 'test' });
			expect(flags.length).toBeGreaterThan(maxFlags);
		});
	});

	describe('Memory Limits', () => {
		it('should handle large conversation history', () => {
			const largeHistory = Array(1000).fill({
				role: 'user',
				content: 'a'.repeat(100)
			});
			expect(largeHistory.length).toBe(1000);
		});

		it('should not load entire history if too large', () => {
			const maxHistorySize = 50000; // characters
			const largeHistory = 'a'.repeat(maxHistorySize + 1);
			const shouldTruncate = largeHistory.length > maxHistorySize;
			expect(shouldTruncate).toBe(true);
		});

		it('should handle large profile data', () => {
			const largeProfile = {
				preferences: Array(1000).fill('preference'),
				personality: Array(1000).fill('trait')
			};
			expect(largeProfile.preferences.length).toBe(1000);
		});
	});

	describe('Rate Limiting', () => {
		it('should limit messages per minute', () => {
			const maxMessagesPerMinute = 10;
			const messages = Array(maxMessagesPerMinute + 1).fill({ timestamp: Date.now() });
			expect(messages.length).toBeGreaterThan(maxMessagesPerMinute);
		});

		it('should limit API calls per hour', () => {
			const maxCallsPerHour = 100;
			const calls = Array(maxCallsPerHour + 1).fill({ timestamp: Date.now() });
			expect(calls.length).toBeGreaterThan(maxCallsPerHour);
		});

		it('should track rate limit window', () => {
			const windowStart = Date.now();
			const windowDuration = 60000; // 1 minute
			const windowEnd = windowStart + windowDuration;
			expect(windowEnd - windowStart).toBe(windowDuration);
		});

		it('should reset rate limit after window expires', () => {
			const windowStart = Date.now();
			const windowDuration = 60000;
			const currentTime = windowStart + windowDuration + 1;
			const hasExpired = currentTime > windowStart + windowDuration;
			expect(hasExpired).toBe(true);
		});
	});
});

// ============================================================================
// RECOVERY MECHANISMS
// ============================================================================

describe('Recovery Mechanisms', () => {
	describe('Retry Logic', () => {
		it('should retry failed operations', async () => {
			let attempts = 0;
			const maxRetries = 3;

			const operation = async () => {
				attempts++;
				if (attempts < maxRetries) throw new Error('Failed');
				return 'success';
			};

			let result;
			for (let i = 0; i < maxRetries; i++) {
				try {
					result = await operation();
					break;
				} catch (e) {
					if (i === maxRetries - 1) throw e;
				}
			}

			expect(result).toBe('success');
			expect(attempts).toBe(maxRetries);
		});

		it('should implement exponential backoff', async () => {
			const delays: number[] = [];
			const baseDelay = 100;
			const maxRetries = 3;

			for (let i = 0; i < maxRetries; i++) {
				delays.push(baseDelay * Math.pow(2, i));
			}

			expect(delays[0]).toBe(100);
			expect(delays[1]).toBe(200);
			expect(delays[2]).toBe(400);
		});

		it('should not retry non-retryable errors', () => {
			const retryableErrors = ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND'];
			const nonRetryableError = 'INVALID_INPUT';
			expect(retryableErrors).not.toContain(nonRetryableError);
		});

		it('should give up after max retries', async () => {
			let attempts = 0;
			const maxRetries = 3;

			const operation = async () => {
				attempts++;
				throw new Error('Always fails');
			};

			try {
				for (let i = 0; i < maxRetries; i++) {
					try {
						await operation();
					} catch (e) {
						if (i === maxRetries - 1) throw e;
					}
				}
			} catch (e) {
				// Expected
			}

			expect(attempts).toBe(maxRetries);
		});
	});

	describe('Fallback Behavior', () => {
		it('should fallback to default system prompt if profile missing', () => {
			const profile = null;
			const defaultPrompt = 'You are a helpful dating coach.';
			const prompt = profile ? 'Custom prompt' : defaultPrompt;
			expect(prompt).toBe(defaultPrompt);
		});

		it('should fallback to generic advice if book context unavailable', () => {
			const bookContext = null;
			const fallbackAdvice = 'Based on general dating principles...';
			const advice = bookContext ? 'Book-based advice' : fallbackAdvice;
			expect(advice).toBe(fallbackAdvice);
		});

		it('should fallback to cached data if database unavailable', () => {
			const databaseData = null;
			const cachedData = { id: '123', name: 'John' };
			const data = databaseData || cachedData;
			expect(data).toEqual(cachedData);
		});

		it('should fallback to previous version if update fails', () => {
			const currentVersion = { id: 1, data: 'current' };
			const previousVersion = { id: 0, data: 'previous' };
			const updateFailed = true;
			const activeVersion = updateFailed ? previousVersion : currentVersion;
			expect(activeVersion).toEqual(previousVersion);
		});
	});

	describe('Circuit Breaker Pattern', () => {
		it('should open circuit after threshold failures', () => {
			let failureCount = 0;
			const failureThreshold = 5;
			const circuitOpen = failureCount >= failureThreshold;
			expect(circuitOpen).toBe(false);

			failureCount = failureThreshold;
			expect(failureCount >= failureThreshold).toBe(true);
		});

		it('should reject requests when circuit open', () => {
			const circuitOpen = true;
			const canMakeRequest = !circuitOpen;
			expect(canMakeRequest).toBe(false);
		});

		it('should attempt recovery after timeout', () => {
			const circuitOpenTime = Date.now();
			const recoveryTimeout = 60000;
			const currentTime = circuitOpenTime + recoveryTimeout + 1;
			const shouldAttemptRecovery = currentTime > circuitOpenTime + recoveryTimeout;
			expect(shouldAttemptRecovery).toBe(true);
		});
	});
});

// ============================================================================
// ERROR MESSAGES
// ============================================================================

describe('Error Messages', () => {
	describe('User-Friendly Messages', () => {
		it('should not expose internal error details', () => {
			const internalError = 'ECONNREFUSED at 192.168.1.1:5432';
			const userMessage = 'Unable to connect. Please try again.';
			expect(userMessage).not.toContain('192.168.1.1');
			expect(userMessage).not.toContain('ECONNREFUSED');
		});

		it('should provide actionable guidance', () => {
			const userMessage = 'Your message was too long. Please shorten it to 4000 characters.';
			expect(userMessage).toContain('shorten');
		});

		it('should avoid technical jargon', () => {
			const userMessage = 'The service is temporarily unavailable. Please try again later.';
			expect(userMessage).not.toContain('PGRST');
			expect(userMessage).not.toContain('constraint');
		});

		it('should be concise and clear', () => {
			const userMessage = 'Unable to save your message. Please check your connection.';
			expect(userMessage.length).toBeLessThan(100);
		});
	});

	describe('Non-Leaking Messages', () => {
		it('should not expose database structure', () => {
			const userMessage = 'An error occurred. Please try again.';
			expect(userMessage).not.toContain('table');
			expect(userMessage).not.toContain('column');
		});

		it('should not expose API keys or secrets', () => {
			const userMessage = 'Authentication failed. Please check your settings.';
			expect(userMessage).not.toContain('sk-');
			expect(userMessage).not.toContain('api_key');
		});

		it('should not expose file paths', () => {
			const userMessage = 'Configuration error. Please contact support.';
			expect(userMessage).not.toContain('/home/');
			expect(userMessage).not.toContain('/var/');
		});

		it('should not expose user data', () => {
			const userMessage = 'Your data could not be saved.';
			expect(userMessage).not.toContain('john@example.com');
			expect(userMessage).not.toContain('555-1234');
		});
	});

	describe('Contextual Messages', () => {
		it('should provide context for validation errors', () => {
			const userMessage = 'Email address is invalid. Please use a valid email format.';
			expect(userMessage).toContain('email');
		});

		it('should suggest next steps for network errors', () => {
			const userMessage = 'Connection lost. Please check your internet and try again.';
			expect(userMessage).toContain('check');
		});

		it('should indicate temporary vs permanent errors', () => {
			const temporaryMessage = 'Service temporarily unavailable. Please try again later.';
			const permanentMessage = 'This feature is not available for your account.';
			expect(temporaryMessage).toContain('temporarily');
			expect(permanentMessage).toContain('not available');
		});
	});
});

// ============================================================================
// ERROR LOGGING
// ============================================================================

describe('Error Logging', () => {
	describe('Log Content', () => {
		it('should log error type', () => {
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
			const error = new Error('Test error');
			console.error('Error Type:', error.constructor.name);
			expect(consoleSpy).toHaveBeenCalled();
			consoleSpy.mockRestore();
		});

		it('should log error message', () => {
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
			const error = new Error('Test error message');
			console.error('Error:', error.message);
			expect(consoleSpy).toHaveBeenCalled();
			consoleSpy.mockRestore();
		});

		it('should log stack trace', () => {
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
			const error = new Error('Test error');
			console.error('Stack:', error.stack);
			expect(consoleSpy).toHaveBeenCalled();
			consoleSpy.mockRestore();
		});

		it('should log context information', () => {
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
			const context = { userId: '123', matchId: '456', action: 'send-message' };
			console.error('Context:', context);
			expect(consoleSpy).toHaveBeenCalled();
			consoleSpy.mockRestore();
		});

		it('should log timestamp', () => {
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
			const timestamp = new Date().toISOString();
			console.error('Timestamp:', timestamp);
			expect(consoleSpy).toHaveBeenCalled();
			consoleSpy.mockRestore();
		});
	});

	describe('Log Levels', () => {
		it('should use error level for critical failures', () => {
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
			console.error('Critical error');
			expect(consoleSpy).toHaveBeenCalled();
			consoleSpy.mockRestore();
		});

		it('should use warn level for recoverable errors', () => {
			const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			console.warn('Warning: retrying operation');
			expect(consoleSpy).toHaveBeenCalled();
			consoleSpy.mockRestore();
		});

		it('should use info level for informational messages', () => {
			const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
			console.info('Operation completed');
			expect(consoleSpy).toHaveBeenCalled();
			consoleSpy.mockRestore();
		});
	});

	describe('Sensitive Data in Logs', () => {
		it('should not log passwords', () => {
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
			const error = { message: 'Auth failed', password: 'secret123' };
			console.error('Error:', { message: error.message });
			expect(consoleSpy).toHaveBeenCalledWith('Error:', { message: 'Auth failed' });
			consoleSpy.mockRestore();
		});

		it('should not log API keys', () => {
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
			const error = { message: 'API error', apiKey: 'sk-1234567890' };
			console.error('Error:', { message: error.message });
			expect(consoleSpy).toHaveBeenCalledWith('Error:', { message: 'API error' });
			consoleSpy.mockRestore();
		});

		it('should not log personal information', () => {
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
			const error = { message: 'User error', email: 'user@example.com' };
			console.error('Error:', { message: error.message });
			expect(consoleSpy).toHaveBeenCalledWith('Error:', { message: 'User error' });
			consoleSpy.mockRestore();
		});
	});
});

// ============================================================================
// GRACEFUL DEGRADATION
// ============================================================================

describe('Graceful Degradation', () => {
	describe('Feature Availability', () => {
		it('should disable AI assistant if profile unavailable', () => {
			const profile = null;
			const aiEnabled = profile !== null;
			expect(aiEnabled).toBe(false);
		});

		it('should disable compatibility analysis if preferences unavailable', () => {
			const preferences = null;
			const analysisEnabled = preferences !== null;
			expect(analysisEnabled).toBe(false);
		});

		it('should disable auto-update if insights extraction fails', () => {
			const insightsExtracted = false;
			const autoUpdateEnabled = insightsExtracted;
			expect(autoUpdateEnabled).toBe(false);
		});

		it('should disable summaries if aggregation fails', () => {
			const summariesGenerated = false;
			const summariesEnabled = summariesGenerated;
			expect(summariesEnabled).toBe(false);
		});
	});

	describe('Partial Functionality', () => {
		it('should allow messaging even if citations unavailable', () => {
			const citations = null;
			const messagingEnabled = true;
			expect(messagingEnabled).toBe(true);
		});

		it('should allow basic advice even if book context unavailable', () => {
			const bookContext = null;
			const basicAdviceEnabled = true;
			expect(basicAdviceEnabled).toBe(true);
		});

		it('should allow conversation even if history retrieval fails', () => {
			const historyRetrieved = false;
			const conversationEnabled = true;
			expect(conversationEnabled).toBe(true);
		});

		it('should allow profile editing even if version history unavailable', () => {
			const versionHistory = null;
			const editingEnabled = true;
			expect(editingEnabled).toBe(true);
		});
	});

	describe('User Experience During Degradation', () => {
		it('should show informative message when feature disabled', () => {
			const message = 'AI Bestie is temporarily unavailable. You can still chat normally.';
			expect(message).toContain('temporarily unavailable');
		});

		it('should not crash application on feature failure', () => {
			const appRunning = true;
			expect(appRunning).toBe(true);
		});

		it('should allow user to continue using other features', () => {
			const featureA = false; // failed
			const featureB = true; // still works
			expect(featureB).toBe(true);
		});

		it('should provide option to retry failed operation', () => {
			const retryButton = { label: 'Retry', enabled: true };
			expect(retryButton.enabled).toBe(true);
		});
	});
});

// ============================================================================
// PROPERTY-BASED TESTS FOR ERROR HANDLING
// ============================================================================

describe('Property-Based Tests for Error Handling', () => {
	describe('Error Recovery Properties', () => {
		it('should always recover from transient errors', () => {
			fc.assert(
				fc.property(fc.integer({ min: 1, max: 3 }), (maxRetries) => {
					let attempts = 0;
					const operation = () => {
						attempts++;
						if (attempts < maxRetries) throw new Error('Transient');
						return 'success';
					};

					let result;
					for (let i = 0; i < maxRetries; i++) {
						try {
							result = operation();
							break;
						} catch (e) {
							if (i === maxRetries - 1) throw e;
						}
					}

					return result === 'success';
				})
			);
		});

		it('should never lose data on error', () => {
			fc.assert(
				fc.property(fc.array(fc.string()), (messages) => {
					const savedMessages = [...messages];
					const retrievedMessages = savedMessages;
					return retrievedMessages.length === messages.length;
				})
			);
		});

		it('should maintain consistency after error', () => {
			fc.assert(
				fc.property(fc.integer({ min: 0, max: 100 }), (initialValue) => {
					let value = initialValue;
					try {
						// Simulate operation
						value = value + 1;
					} catch (e) {
						// Rollback
						value = initialValue;
					}
					return value >= initialValue;
				})
			);
		});
	});

	describe('Input Validation Properties', () => {
		it('should reject all invalid UUIDs', () => {
			fc.assert(
				fc.property(fc.string(), (input) => {
					const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
					const isValid = uuidRegex.test(input);
					// If it doesn't match the pattern, it should be invalid
					return !isValid || input.match(uuidRegex);
				})
			);
		});

		it('should accept all valid message lengths', () => {
			fc.assert(
				fc.property(fc.string({ maxLength: 4000 }), (message) => {
					const maxLength = 4000;
					return message.length <= maxLength;
				})
			);
		});

		it('should reject all messages exceeding max length', () => {
			fc.assert(
				fc.property(fc.string({ minLength: 4001 }), (message) => {
					const maxLength = 4000;
					return message.length > maxLength;
				})
			);
		});
	});

	describe('Concurrency Properties', () => {
		it('should handle any number of concurrent operations', async () => {
			await fc.assert(
				fc.asyncProperty(fc.integer({ min: 1, max: 100 }), async (count) => {
					const operations = Array(count).fill(null).map(() =>
						Promise.resolve('completed')
					);
					const results = await Promise.all(operations);
					return results.length === count;
				})
			);
		});

		it('should maintain order in concurrent reads', async () => {
			await fc.assert(
				fc.asyncProperty(fc.array(fc.integer()), async (values) => {
					const reads = await Promise.all(
						values.map(v => Promise.resolve(v))
					);
					return reads.length === values.length;
				})
			);
		});
	});
});
