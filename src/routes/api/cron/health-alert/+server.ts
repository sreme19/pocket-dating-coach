import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { runHealthCheck } from '$lib/server/health';

/**
 * Health alert cron — runs every 10 minutes via Vercel Cron.
 * Sends an email alert via Resend if any service is down or degraded.
 * Auth: Authorization: Bearer <CRON_SECRET>
 */

function authorized(request: Request): boolean {
	const secret = process.env.CRON_SECRET;
	if (!secret) return false;
	const header = request.headers.get('authorization') ?? '';
	return header.startsWith('Bearer ') && header.slice(7) === secret;
}

async function sendAlert(subject: string, html: string): Promise<void> {
	const apiKey = process.env.RESEND_API_KEY;
	const alertEmail = process.env.ALERT_EMAIL;
	if (!apiKey || !alertEmail) throw new Error('RESEND_API_KEY or ALERT_EMAIL not set');

	const resp = await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			from: 'Pocket Dating Coach Monitor <monitor@riteangle.app>',
			to: [alertEmail],
			subject,
			html,
		}),
	});
	if (!resp.ok) {
		const body = await resp.text();
		throw new Error(`Resend error ${resp.status}: ${body}`);
	}
}

function statusEmoji(status: string): string {
	if (status === 'ok') return '✅';
	if (status === 'degraded') return '⚠️';
	return '🔴';
}

function buildAlertHtml(report: Awaited<ReturnType<typeof runHealthCheck>>): string {
	const { status, timestamp, services } = report;
	const rows = Object.entries(services)
		.map(([name, s]) => {
			const emoji = statusEmoji(s.status);
			const latency = s.latencyMs != null ? `${s.latencyMs}ms` : '—';
			const error = s.error ? `<br/><small style="color:#b91c1c">${s.error}</small>` : '';
			return `<tr>
				<td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${emoji} <strong>${name}</strong></td>
				<td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${s.status.toUpperCase()}</td>
				<td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${latency}${error}</td>
			</tr>`;
		})
		.join('');

	const bgColor = status === 'down' ? '#fef2f2' : '#fffbeb';
	const headerColor = status === 'down' ? '#dc2626' : '#d97706';

	return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="font-family:sans-serif;background:#f9fafb;margin:0;padding:24px">
  <div style="max-width:540px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
    <div style="background:${headerColor};color:#fff;padding:20px 24px">
      <h2 style="margin:0;font-size:18px">${statusEmoji(status)} Pocket Dating Coach — Service Alert</h2>
    </div>
    <div style="padding:20px 24px;background:${bgColor};border-bottom:1px solid #e5e7eb">
      <p style="margin:0;font-size:15px">Overall status: <strong>${status.toUpperCase()}</strong></p>
      <p style="margin:4px 0 0;color:#6b7280;font-size:13px">${new Date(timestamp).toUTCString()}</p>
    </div>
    <div style="padding:16px 24px">
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead>
          <tr style="background:#f3f4f6">
            <th style="padding:8px 12px;text-align:left;color:#374151">Service</th>
            <th style="padding:8px 12px;text-align:left;color:#374151">Status</th>
            <th style="padding:8px 12px;text-align:left;color:#374151">Latency / Error</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div style="padding:16px 24px;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:12px">
      Sent by Vercel Cron · riteangle.app · <a href="https://riteangle.app/api/health" style="color:#6366f1">View live health</a>
    </div>
  </div>
</body>
</html>`;
}

const handle: RequestHandler = async ({ request }) => {
	if (!authorized(request)) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const report = await runHealthCheck();

	if (report.status === 'ok') {
		return json({ alerted: false, status: 'ok' });
	}

	const subject = report.status === 'down'
		? `🔴 ALERT: Service down — Pocket Dating Coach`
		: `⚠️ WARNING: Service degraded — Pocket Dating Coach`;

	try {
		await sendAlert(subject, buildAlertHtml(report));
		console.log(`[health-alert] Sent ${report.status} alert to ${process.env.ALERT_EMAIL}`);
		return json({ alerted: true, status: report.status, services: report.services });
	} catch (err) {
		console.error('[health-alert] Failed to send email:', err);
		return json(
			{ alerted: false, error: err instanceof Error ? err.message : String(err) },
			{ status: 500 }
		);
	}
};

export const GET = handle;
export const POST = handle;
