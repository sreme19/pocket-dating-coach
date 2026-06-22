import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSupabase } from '$lib/server/supabase';
import { runHealthCheck } from '$lib/server/health';

/**
 * Daily report cron — runs at 08:00 UTC every day.
 * Sends a summary email with health status + key user metrics.
 * Auth: Authorization: Bearer <CRON_SECRET>
 */

function authorized(request: Request): boolean {
	const secret = process.env.CRON_SECRET;
	if (!secret) return false;
	const header = request.headers.get('authorization') ?? '';
	return header.startsWith('Bearer ') && header.slice(7) === secret;
}

interface DailyStats {
	totalUsers: number;
	newUsersToday: number;
	activeUsersToday: number;
	proofUploadsToday: number;
	matchesToday: number;
}

async function gatherStats(): Promise<DailyStats> {
	const supabase = getSupabase();
	const todayStart = new Date();
	todayStart.setUTCHours(0, 0, 0, 0);
	const since = todayStart.toISOString();

	const [
		totalRes,
		newRes,
		activeRes,
		proofsRes,
		matchesRes,
	] = await Promise.allSettled([
		(supabase as any).from('verified_vibe_users').select('count', { count: 'exact', head: true }),
		(supabase as any).from('verified_vibe_users').select('count', { count: 'exact', head: true }).gte('created_at', since),
		(supabase as any).from('verified_vibe_users').select('count', { count: 'exact', head: true }).gte('updated_at', since),
		(supabase as any).from('vv_proofs').select('count', { count: 'exact', head: true }).gte('created_at', since),
		(supabase as any).from('vv_matches').select('count', { count: 'exact', head: true }).gte('created_at', since),
	]);

	function countOf(res: PromiseSettledResult<any>): number {
		return res.status === 'fulfilled' ? (res.value.count ?? 0) : 0;
	}

	return {
		totalUsers: countOf(totalRes),
		newUsersToday: countOf(newRes),
		activeUsersToday: countOf(activeRes),
		proofUploadsToday: countOf(proofsRes),
		matchesToday: countOf(matchesRes),
	};
}

function statusEmoji(status: string): string {
	if (status === 'ok') return '✅';
	if (status === 'degraded') return '⚠️';
	return '🔴';
}

function buildReportHtml(
	stats: DailyStats,
	health: Awaited<ReturnType<typeof runHealthCheck>>
): string {
	const date = new Date().toLocaleDateString('en-GB', {
		weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'
	});

	const serviceRows = Object.entries(health.services)
		.map(([name, s]) => {
			const latency = s.latencyMs != null ? `${s.latencyMs}ms` : '—';
			const error = s.error ? ` · <span style="color:#b91c1c">${s.error}</span>` : '';
			return `<tr>
				<td style="padding:6px 12px;border-bottom:1px solid #f3f4f6">${statusEmoji(s.status)} ${name}</td>
				<td style="padding:6px 12px;border-bottom:1px solid #f3f4f6;color:#6b7280">${latency}${error}</td>
			</tr>`;
		})
		.join('');

	const statRows = [
		['Total users', stats.totalUsers.toLocaleString()],
		['New users today', stats.newUsersToday.toLocaleString()],
		['Active users today', stats.activeUsersToday.toLocaleString()],
		['Proof uploads today', stats.proofUploadsToday.toLocaleString()],
		['Matches today', stats.matchesToday.toLocaleString()],
	].map(([label, value]) => `<tr>
		<td style="padding:6px 12px;border-bottom:1px solid #f3f4f6;color:#374151">${label}</td>
		<td style="padding:6px 12px;border-bottom:1px solid #f3f4f6;font-weight:600">${value}</td>
	</tr>`).join('');

	const overallColor = health.status === 'ok' ? '#059669' : health.status === 'degraded' ? '#d97706' : '#dc2626';

	return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="font-family:sans-serif;background:#f9fafb;margin:0;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
    <div style="background:#6366f1;color:#fff;padding:20px 24px">
      <h2 style="margin:0;font-size:18px">📊 Daily Report — Pocket Dating Coach</h2>
      <p style="margin:4px 0 0;opacity:0.85;font-size:13px">${date}</p>
    </div>

    <div style="padding:20px 24px">
      <h3 style="margin:0 0 12px;font-size:15px;color:#111827">System Health</h3>
      <p style="margin:0 0 12px;font-size:14px">
        Overall: <strong style="color:${overallColor}">${statusEmoji(health.status)} ${health.status.toUpperCase()}</strong>
        · Uptime: ${Math.floor(health.uptimeSeconds / 3600)}h ${Math.floor((health.uptimeSeconds % 3600) / 60)}m
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        ${serviceRows}
      </table>
    </div>

    <div style="padding:0 24px 20px">
      <h3 style="margin:0 0 12px;font-size:15px;color:#111827">Today's Activity</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        ${statRows}
      </table>
    </div>

    <div style="padding:16px 24px;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:12px">
      Sent by Vercel Cron · riteangle.dating · <a href="https://riteangle.dating/api/health" style="color:#6366f1">View live health</a>
    </div>
  </div>
</body>
</html>`;
}

const handle: RequestHandler = async ({ request }) => {
	if (!authorized(request)) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const [health, stats] = await Promise.all([runHealthCheck(), gatherStats()]);

	const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
	const healthLabel = health.status === 'ok' ? '✅ All systems operational' : health.status === 'degraded' ? '⚠️ Degraded' : '🔴 Outage detected';
	const subject = `📊 Daily Report ${today} — ${healthLabel}`;

	const html = buildReportHtml(stats, health);

	const apiKey = process.env.RESEND_API_KEY;
	const alertEmail = process.env.ALERT_EMAIL;
	if (!apiKey || !alertEmail) {
		return json({ error: 'RESEND_API_KEY or ALERT_EMAIL not configured' }, { status: 500 });
	}

	const resp = await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			from: 'Pocket Dating Coach Monitor <monitor@riteangle.dating>',
			to: [alertEmail],
			subject,
			html,
		}),
	});

	if (!resp.ok) {
		const body = await resp.text();
		console.error('[daily-report] Resend error:', resp.status, body);
		return json({ error: `Resend ${resp.status}` }, { status: 500 });
	}

	console.log(`[daily-report] Sent daily report to ${alertEmail}`);
	return json({ sent: true, health: health.status, stats });
};

export const GET = handle;
export const POST = handle;
