import type { PageServerLoad } from './$types';
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
			summaryMap.set(r.check_name, { lastStatus: r.status, lastError: r.error_message ?? null, ok: 0, fail: 0, warn: 0, avgMs: null });
		}
		const s = summaryMap.get(r.check_name)!;
		if (r.status === 'OK') s.ok++;
		else if (r.status === 'FAIL') s.fail++;
		else s.warn++;
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
