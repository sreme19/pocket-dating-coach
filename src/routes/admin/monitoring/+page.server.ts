import type { PageServerLoad, Actions } from './$types';
import { getSupabase } from '$lib/server/supabase';

export const load: PageServerLoad = async () => {
	const sb = getSupabase() as any;

	// Last 500 log entries (include metadata for app_error detail)
	const { data: logs } = await sb
		.from('monitor_log')
		.select('id, check_name, status, response_time_ms, error_message, metadata, created_at')
		.order('created_at', { ascending: false })
		.limit(500);

	const rows = (logs ?? []) as {
		id: string;
		check_name: string;
		status: 'OK' | 'FAIL' | 'WARN';
		response_time_ms: number | null;
		error_message: string | null;
		metadata: {
			feature?: string;
			file?: string;
			endpoint?: string;
			user_id?: string | null;
			match_id?: string | null;
			stack?: string | null;
			[key: string]: unknown;
		} | null;
		created_at: string;
	}[];

	// Summary per check_name: last status + last error + uptime
	const summaryMap = new Map<
		string,
		{ lastStatus: string; lastError: string | null; ok: number; fail: number; warn: number; avgMs: number | null }
	>();
	for (const r of rows) {
		if (!summaryMap.has(r.check_name)) {
			summaryMap.set(r.check_name, { lastStatus: r.status, lastError: null, ok: 0, fail: 0, warn: 0, avgMs: null });
		}
		const s = summaryMap.get(r.check_name)!;
		if (r.status === 'OK') s.ok++;
		else if (r.status === 'FAIL') s.fail++;
		else s.warn++;
		// Track the most recent FAIL/WARN error message (rows are DESC so first non-OK wins)
		if (s.lastError === null && r.status !== 'OK' && r.error_message) {
			s.lastError = r.error_message;
		}
	}
	// Compute avg response time per check
	const msMap = new Map<string, number[]>();
	for (const r of rows) {
		if (r.response_time_ms != null) {
			if (!msMap.has(r.check_name)) msMap.set(r.check_name, []);
			msMap.get(r.check_name)!.push(r.response_time_ms);
		}
	}
	for (const [name, times] of msMap) {
		const s = summaryMap.get(name);
		if (s && times.length > 0) s.avgMs = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
	}

	const summary = [...summaryMap.entries()].map(([name, s]) => ({
		check_name: name,
		lastStatus: s.lastStatus,
		lastError: s.lastError,
		total: s.ok + s.fail + s.warn,
		ok: s.ok,
		fail: s.fail,
		warn: s.warn,
		uptimePct: s.ok + s.fail + s.warn > 0
			? Math.round((s.ok / (s.ok + s.fail + s.warn)) * 100)
			: null,
		avgMs: s.avgMs,
	}));

	return { logs: rows, summary };
};

// ── Manual health check action ─────────────────────────────────────────────
export const actions: Actions = {
	runHealthCheck: async ({ fetch }) => {
		const sb = getSupabase() as any;
		const now = new Date().toISOString();

		const log = async (checkName: string, status: 'OK' | 'FAIL', ms: number, errorMsg: string | null) => {
			await sb.from('monitor_log').insert({
				check_name: checkName,
				status,
				response_time_ms: ms,
				error_message: errorMsg,
				created_at: now,
			});
		};

		const results: { check: string; status: string; ms: number; error: string | null }[] = [];

		// 1. API health ping
		{
			const start = Date.now();
			let status: 'OK' | 'FAIL' = 'FAIL';
			let error: string | null = null;
			try {
				const r = await fetch('/api/health');
				const ms = Date.now() - start;
				status = r.ok ? 'OK' : 'FAIL';
				if (!r.ok) error = `HTTP ${r.status}`;
				await log('api_health_ping', status, ms, error);
				results.push({ check: 'api_health_ping', status, ms, error });
			} catch (e) {
				const ms = Date.now() - start;
				error = e instanceof Error ? e.message : String(e);
				await log('api_health_ping', 'FAIL', ms, error);
				results.push({ check: 'api_health_ping', status: 'FAIL', ms, error });
			}
		}

		// 2. DB read integrity
		{
			const start = Date.now();
			const { error: dbErr } = await sb.from('verified_vibe_users').select('id').limit(1);
			const ms = Date.now() - start;
			const status: 'OK' | 'FAIL' = dbErr ? 'FAIL' : 'OK';
			const error = dbErr ? `${dbErr.code}: ${dbErr.message}` : null;
			await log('db_read_integrity', status, ms, error);
			results.push({ check: 'db_read_integrity', status, ms, error });
		}

		// 3. Synthetic login simulation
		{
			const start = Date.now();
			let status: 'OK' | 'FAIL' = 'FAIL';
			let error: string | null = null;
			try {
				const { SYNTHETIC_USER_EMAIL, SEED_ACCOUNT_PASSWORD } = await import('$env/static/private');
				const r = await fetch('/api/verified-vibe/seed-login', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ email: SYNTHETIC_USER_EMAIL, password: SEED_ACCOUNT_PASSWORD }),
				});
				const ms = Date.now() - start;
				const body = await r.json().catch(() => ({}));
				if (r.ok && body.otp) {
					status = 'OK';
				} else {
					error = `HTTP ${r.status} — ${JSON.stringify(body)}`;
				}
				await log('synthetic_login_simulation', status, ms, error);
				results.push({ check: 'synthetic_login_simulation', status, ms, error });
			} catch (e) {
				const ms = Date.now() - start;
				error = e instanceof Error ? e.message : String(e);
				await log('synthetic_login_simulation', 'FAIL', ms, error);
				results.push({ check: 'synthetic_login_simulation', status: 'FAIL', ms, error });
			}
		}

		return { triggered: true, results };
	},
};
