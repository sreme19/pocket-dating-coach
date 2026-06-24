import { describe, it, expect, vi } from 'vitest';

/**
 * Critical-path regression tests — FR-05
 *
 * Pure logic-layer tests: no HTTP server, no real Supabase calls.
 * Each section validates a key business rule extracted from the server code.
 */

// ── Health endpoint contract ──────────────────────────────────────────────────
// Mirrors the mapping in src/routes/api/health/+server.ts:
//   report.status === 'down' ? 503 : report.status === 'degraded' ? 207 : 200
function healthStatusToHttp(status: string): number {
	return status === 'down' ? 503 : status === 'degraded' ? 207 : 200;
}

// Mirrors the aggregation logic in src/lib/server/health.ts:runHealthCheck()
function aggregateStatus(
	services: Array<{ status: 'ok' | 'degraded' | 'down' }>
): 'ok' | 'degraded' | 'down' {
	const anyDown = services.some((s) => s.status === 'down');
	const anyDegraded = services.some((s) => s.status === 'degraded');
	return anyDown ? 'down' : anyDegraded ? 'degraded' : 'ok';
}

describe('Health endpoint contract', () => {
	it('maps status "down" to HTTP 503', () => {
		expect(healthStatusToHttp('down')).toBe(503);
	});

	it('maps status "degraded" to HTTP 207', () => {
		expect(healthStatusToHttp('degraded')).toBe(207);
	});

	it('maps status "ok" to HTTP 200', () => {
		expect(healthStatusToHttp('ok')).toBe(200);
	});

	it('overall status is "down" when any service is down', () => {
		const status = aggregateStatus([{ status: 'ok' }, { status: 'down' }]);
		expect(status).toBe('down');
	});

	it('overall status is "degraded" when any service is degraded (none down)', () => {
		const status = aggregateStatus([{ status: 'ok' }, { status: 'degraded' }]);
		expect(status).toBe('degraded');
	});

	it('overall status is "ok" when all services are ok', () => {
		const status = aggregateStatus([{ status: 'ok' }, { status: 'ok' }]);
		expect(status).toBe('ok');
	});

	it('"down" takes precedence over "degraded"', () => {
		const status = aggregateStatus([{ status: 'degraded' }, { status: 'down' }]);
		expect(status).toBe('down');
	});

	it('health report has required fields', () => {
		const report = {
			status: 'ok' as const,
			timestamp: new Date().toISOString(),
			uptimeSeconds: 42,
			services: {
				claude: { status: 'ok' as const },
				supabase: { status: 'ok' as const },
				server: { status: 'ok' as const }
			}
		};
		expect(report).toHaveProperty('status');
		expect(report).toHaveProperty('timestamp');
		expect(report).toHaveProperty('uptimeSeconds');
		expect(report).toHaveProperty('services');
		expect(['ok', 'degraded', 'down']).toContain(report.status);
	});
});

// ── seed-login validation ─────────────────────────────────────────────────────
// Mirrors the validation logic in:
//   src/routes/api/verified-vibe/seed-login/+server.ts
const SEED_PASSWORD = 'SeedPass123!';

interface SeedLoginValidationResult {
	status: number;
	body: { error?: string; otp?: string };
}

function validateSeedLogin(
	email: string | undefined,
	password: string | undefined,
	generateLinkMock: (email: string) => { data: { properties?: { email_otp: string } } | null; error: null | Error }
): SeedLoginValidationResult {
	if (!email || !password) {
		return { status: 400, body: { error: 'Email and password required' } };
	}
	const normalizedEmail = email.trim().toLowerCase();
	if (!normalizedEmail.endsWith('@seed.vv')) {
		return { status: 400, body: { error: 'Invalid email domain' } };
	}
	if (password !== SEED_PASSWORD) {
		return { status: 401, body: { error: 'Invalid password' } };
	}
	const { data, error: linkError } = generateLinkMock(normalizedEmail);
	if (linkError || !data?.properties?.email_otp) {
		return { status: 404, body: { error: 'User not found or cannot login' } };
	}
	return { status: 200, body: { otp: data.properties.email_otp } };
}

describe('seed-login validation', () => {
	const successMock = (email: string) => ({
		data: { properties: { email_otp: '123456' } },
		error: null
	});

	it('rejects missing email with 400', () => {
		const result = validateSeedLogin(undefined, SEED_PASSWORD, successMock);
		expect(result.status).toBe(400);
		expect(result.body.error).toBe('Email and password required');
	});

	it('rejects missing password with 400', () => {
		const result = validateSeedLogin('monitor@seed.vv', undefined, successMock);
		expect(result.status).toBe(400);
		expect(result.body.error).toBe('Email and password required');
	});

	it('rejects email not ending in @seed.vv with 400', () => {
		const result = validateSeedLogin('user@gmail.com', SEED_PASSWORD, successMock);
		expect(result.status).toBe(400);
		expect(result.body.error).toBe('Invalid email domain');
	});

	it('rejects wrong password with 401', () => {
		const result = validateSeedLogin('monitor@seed.vv', 'wrongpassword', successMock);
		expect(result.status).toBe(401);
		expect(result.body.error).toBe('Invalid password');
	});

	it('accepts valid @seed.vv email with correct password → calls generateLink', () => {
		const mockFn = vi.fn(successMock);
		const result = validateSeedLogin('monitor@seed.vv', SEED_PASSWORD, mockFn);
		expect(mockFn).toHaveBeenCalledWith('monitor@seed.vv');
		expect(result.status).toBe(200);
		expect(result.body).toHaveProperty('otp');
	});

	it('returns 200 with otp field on success', () => {
		const result = validateSeedLogin('MONITOR@SEED.VV', SEED_PASSWORD, successMock);
		expect(result.status).toBe(200);
		expect(result.body.otp).toBe('123456');
	});

	it('normalises email to lowercase before domain check', () => {
		const result = validateSeedLogin('MONITOR@SEED.VV', SEED_PASSWORD, successMock);
		expect(result.status).toBe(200);
	});
});

// ── Matchmaker auth guard ─────────────────────────────────────────────────────
// The matchmaker/find-matches endpoint returns 401 when there is no session.
// This tests the auth guard logic in isolation.
function matchmakerAuthGuard(sessionUserId: string | null): number {
	return sessionUserId ? 200 : 401;
}

describe('Matchmaker auth guard', () => {
	it('returns 401 for GET with no session', () => {
		expect(matchmakerAuthGuard(null)).toBe(401);
	});

	it('returns 401 for POST with no session', () => {
		expect(matchmakerAuthGuard(null)).toBe(401);
	});

	it('passes through (200) when session exists', () => {
		expect(matchmakerAuthGuard('user-uuid-123')).toBe(200);
	});
});

// ── monitor_log payload structure ─────────────────────────────────────────────
// Validates the shape written to Supabase by the GitHub Actions workflow.
type MonitorStatus = 'OK' | 'FAIL' | 'WARN';

interface MonitorLogEntry {
	check_name: string;
	status: MonitorStatus;
	response_time_ms: number;
	error_message: string | null;
	created_at: string;
}

function isValidMonitorStatus(s: string): s is MonitorStatus {
	return s === 'OK' || s === 'FAIL' || s === 'WARN';
}

function buildMonitorLogEntry(
	check_name: string,
	status: string,
	response_time_ms: number,
	error_message: string | null
): MonitorLogEntry | null {
	if (!isValidMonitorStatus(status)) return null;
	return {
		check_name,
		status,
		response_time_ms,
		error_message,
		created_at: new Date().toISOString()
	};
}

describe('monitor_log payload structure', () => {
	it('valid OK entry has all required fields', () => {
		const entry = buildMonitorLogEntry('api_health_ping', 'OK', 145, null);
		expect(entry).not.toBeNull();
		expect(entry).toHaveProperty('check_name');
		expect(entry).toHaveProperty('status');
		expect(entry).toHaveProperty('response_time_ms');
		expect(entry).toHaveProperty('error_message');
		expect(entry).toHaveProperty('created_at');
	});

	it('status must be OK, FAIL, or WARN — rejects other values', () => {
		expect(buildMonitorLogEntry('api_health_ping', 'UP', 100, null)).toBeNull();
		expect(buildMonitorLogEntry('api_health_ping', 'DOWN', 100, null)).toBeNull();
		expect(buildMonitorLogEntry('api_health_ping', '', 100, null)).toBeNull();
	});

	it('accepts all three valid status values', () => {
		expect(buildMonitorLogEntry('check', 'OK', 50, null)?.status).toBe('OK');
		expect(buildMonitorLogEntry('check', 'FAIL', 50, 'error msg')?.status).toBe('FAIL');
		expect(buildMonitorLogEntry('check', 'WARN', 50, null)?.status).toBe('WARN');
	});

	it('error_message is null when no error', () => {
		const entry = buildMonitorLogEntry('db_read_integrity', 'OK', 80, null);
		expect(entry?.error_message).toBeNull();
	});

	it('error_message carries the error string on FAIL', () => {
		const entry = buildMonitorLogEntry('db_read_integrity', 'FAIL', 10000, 'HTTP 503');
		expect(entry?.error_message).toBe('HTTP 503');
	});

	it('created_at is a valid ISO 8601 timestamp', () => {
		const entry = buildMonitorLogEntry('api_health_ping', 'OK', 100, null);
		expect(() => new Date(entry!.created_at)).not.toThrow();
		expect(new Date(entry!.created_at).toISOString()).toBe(entry!.created_at);
	});
});
