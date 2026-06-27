import type { PageServerLoad, Actions } from './$types';
import { getSupabase } from '$lib/server/supabase';

async function sendManualCheckAlert(
	results: { check: string; status: string; ms: number; error: string | null }[]
): Promise<void> {
	const apiKey = process.env.RESEND_API_KEY;
	const alertEmail = process.env.ALERT_EMAIL;
	if (!apiKey || !alertEmail) return;

	const failed = results.filter((r) => r.status === 'FAIL');
	if (failed.length === 0) return;

	const now = new Date();
	const utcStr = now.toUTCString();
	const wibStr = new Date(now.getTime() + 7 * 3600 * 1000)
		.toISOString()
		.slice(11, 19) + ' WIB';

	const rows = results
		.map((r) => {
			const color = r.status === 'OK' ? '#16a34a' : '#dc2626';
			const emoji = r.status === 'OK' ? '✅' : '🔴';
			const err = r.error
				? `<br/><small style="color:#991b1b;font-size:11px">${r.error}</small>`
				: '';
			return `<tr>
        <td style="padding:8px 14px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#374151">${r.check}</td>
        <td style="padding:8px 14px;border-bottom:1px solid #e5e7eb;font-weight:700;color:${color}">${emoji} ${r.status}</td>
        <td style="padding:8px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#6b7280">${r.ms}ms${err}</td>
      </tr>`;
		})
		.join('');

	const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="font-family:sans-serif;background:#f9fafb;margin:0;padding:24px">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.12)">
  <div style="background:#dc2626;color:#fff;padding:20px 24px">
    <h2 style="margin:0;font-size:18px">🔴 Manual Health Check — Failures Detected</h2>
    <p style="margin:6px 0 0;font-size:13px;opacity:0.9">Triggered manually from the monitoring dashboard</p>
  </div>
  <div style="padding:16px 24px;background:#fef2f2;border-bottom:1px solid #fecaca">
    <p style="margin:0;font-size:14px;color:#991b1b">
      <strong>${failed.length} of ${results.length}</strong> health checks failed.
    </p>
    <p style="margin:6px 0 0;font-size:12px;color:#6b7280">${utcStr} &nbsp;·&nbsp; ${wibStr}</p>
  </div>
  <div style="padding:20px 24px;border-bottom:1px solid #e5e7eb">
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="background:#f9fafb">
        <th style="padding:8px 14px;text-align:left;font-size:11px;color:#9ca3af;font-weight:600">Check</th>
        <th style="padding:8px 14px;text-align:left;font-size:11px;color:#9ca3af;font-weight:600">Status</th>
        <th style="padding:8px 14px;text-align:left;font-size:11px;color:#9ca3af;font-weight:600">Latency / Error</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  <div style="padding:16px 24px;border-bottom:1px solid #e5e7eb">
    <a href="${process.env.APP_URL ?? 'https://riteangle.dating'}/admin/monitoring"
       style="display:inline-block;padding:10px 18px;background:#dc2626;color:#fff;text-decoration:none;border-radius:6px;font-size:13px;font-weight:600;margin-right:8px">
      View Monitoring Dashboard
    </a>
    <a href="${process.env.APP_URL ?? 'https://riteangle.dating'}/api/health"
       style="display:inline-block;padding:10px 18px;background:#f3f4f6;color:#374151;text-decoration:none;border-radius:6px;font-size:13px;font-weight:600">
      Live Health API
    </a>
  </div>
  <div style="padding:12px 24px;background:#f9fafb;color:#9ca3af;font-size:11px">
    Triggered manually · riteangle.dating
  </div>
</div>
</body></html>`;

	await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
		body: JSON.stringify({
			from: 'PDC Monitor <monitor@riteangle.dating>',
			to: [alertEmail],
			subject: `🔴 Manual check: ${failed.map((r) => r.check).join(', ')} FAILED — riteangle.dating`,
			html,
		}),
	});
}

export const load: PageServerLoad = async ({ depends }) => {
	depends('app:monitoring');
	const sb = getSupabase() as any;

	// Last 500 server health log entries
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
			http_code?: number;
			user_id?: string | null;
			match_id?: string | null;
			stack?: string | null;
			[key: string]: unknown;
		} | null;
		created_at: string;
	}[];

	// Last 300 mobile error events
	const { data: mobileErrors } = await sb
		.from('mobile_event_log')
		.select('id, user_id, event_type, screen, action, error_message, error_type, metadata, app_version, created_at')
		.eq('event_type', 'error')
		.order('created_at', { ascending: false })
		.limit(300);

	const mobileRows = (mobileErrors ?? []) as {
		id: string;
		user_id: string | null;
		event_type: string;
		screen: string | null;
		action: string | null;
		error_message: string | null;
		error_type: string | null;
		metadata: { stack?: string; [key: string]: unknown } | null;
		app_version: string | null;
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

	return { logs: rows, summary, mobileErrors: mobileRows };
};

// ── Manual health check action ─────────────────────────────────────────────
export const actions: Actions = {
	runHealthCheck: async ({ fetch }) => {
		const sb = getSupabase() as any;
		const now = new Date().toISOString();

		const log = async (
			checkName: string,
			status: 'OK' | 'FAIL',
			ms: number,
			errorMsg: string | null,
			meta?: Record<string, unknown>
		) => {
			await sb.from('monitor_log').insert({
				check_name: checkName,
				status,
				response_time_ms: ms,
				error_message: errorMsg,
				metadata: meta ?? null,
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
				await log('api_health_ping', status, ms, error, { feature: 'api', endpoint: '/api/health', http_code: r.status });
				results.push({ check: 'api_health_ping', status, ms, error });
			} catch (e) {
				const ms = Date.now() - start;
				error = e instanceof Error ? e.message : String(e);
				await log('api_health_ping', 'FAIL', ms, error, { feature: 'api', endpoint: '/api/health' });
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
			await log('db_read_integrity', status, ms, error, { feature: 'database', endpoint: 'supabase › rest/v1/verified_vibe_users' });
			results.push({ check: 'db_read_integrity', status, ms, error });
		}

		// 3. Synthetic login simulation
		{
			const start = Date.now();
			let status: 'OK' | 'FAIL' = 'FAIL';
			let error: string | null = null;
			let httpCode: number | undefined;
			try {
				const { SYNTHETIC_USER_EMAIL, SEED_ACCOUNT_PASSWORD } = await import('$env/static/private');
				const r = await fetch('/api/verified-vibe/seed-login', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ email: SYNTHETIC_USER_EMAIL, password: SEED_ACCOUNT_PASSWORD }),
				});
				httpCode = r.status;
				const ms = Date.now() - start;
				const body = await r.json().catch(() => ({}));
				if (r.ok && body.otp) {
					status = 'OK';
				} else {
					error = `HTTP ${r.status} — ${JSON.stringify(body)}`;
				}
				await log('synthetic_login_simulation', status, ms, error, { feature: 'auth', endpoint: '/api/verified-vibe/seed-login', http_code: httpCode });
				results.push({ check: 'synthetic_login_simulation', status, ms, error });
			} catch (e) {
				const ms = Date.now() - start;
				error = e instanceof Error ? e.message : String(e);
				await log('synthetic_login_simulation', 'FAIL', ms, error, { feature: 'auth', endpoint: '/api/verified-vibe/seed-login', http_code: httpCode });
				results.push({ check: 'synthetic_login_simulation', status: 'FAIL', ms, error });
			}
		}

		// Send alert email if any check failed
		await sendManualCheckAlert(results).catch((e) =>
			console.error('[manual health check] email send failed:', e)
		);

		return { triggered: true, results };
	},
};
