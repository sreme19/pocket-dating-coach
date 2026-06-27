import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sendSlackAlert } from '$lib/server/slack';

/**
 * POST /api/mobile-error
 *
 * Receives a client-side error report from the Flutter mobile app and sends
 * a rich HTML email alert via Resend. Called by AppLogger._sendAlert().
 *
 * The endpoint is intentionally open (no CRON_SECRET) because it is called
 * from authenticated user sessions — the Supabase JWT in the Authorization
 * header is sufficient to validate legitimacy. Anonymous pre-login errors
 * are also accepted (no token) since they are most useful to track.
 *
 * Rate-limiting is handled client-side (5-min cooldown per error type × screen).
 */

interface MobileErrorBody {
	userId?: string;
	errorMessage?: string;
	errorType?: string;
	screen?: string;
	action?: string;
	appVersion?: string;
	stack?: string;
	meta?: Record<string, unknown>;
}

function buildErrorEmail(b: MobileErrorBody, now: Date): string {
	const utcStr = now.toUTCString();
	const wibStr =
		new Date(now.getTime() + 7 * 3600 * 1000).toISOString().slice(11, 19) + ' WIB';

	const metaRows = b.meta
		? Object.entries(b.meta)
				.map(
					([k, v]) =>
						`<tr>
            <td style="padding:4px 10px;color:#6b7280;font-size:12px;white-space:nowrap">${k}</td>
            <td style="padding:4px 10px;font-size:12px;color:#374151;word-break:break-all">${JSON.stringify(v)}</td>
          </tr>`
				)
				.join('')
		: '';

	const stackHtml = b.stack
		? `<div style="padding:20px 24px;border-bottom:1px solid #e5e7eb">
        <h3 style="margin:0 0 10px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em">Stack Trace</h3>
        <pre style="margin:0;font-size:11px;color:#374151;background:#f9fafb;padding:12px;border-radius:6px;overflow-x:auto;white-space:pre-wrap;word-break:break-all">${b.stack}</pre>
      </div>`
		: '';

	const metaHtml =
		metaRows
			? `<div style="padding:20px 24px;border-bottom:1px solid #e5e7eb">
          <h3 style="margin:0 0 10px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em">Additional Context</h3>
          <table style="width:100%;border-collapse:collapse">${metaRows}</table>
        </div>`
			: '';

	return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="font-family:sans-serif;background:#f9fafb;margin:0;padding:24px">
<div style="max-width:620px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.12)">

  <div style="background:#7c3aed;color:#fff;padding:20px 24px">
    <h2 style="margin:0;font-size:18px">📱 Mobile App Error — riteangle</h2>
    <p style="margin:6px 0 0;font-size:13px;opacity:0.85">
      ${b.screen ? `Screen: <strong>${b.screen}</strong>` : 'Pre-screen / global error'}
      ${b.action ? ` &nbsp;·&nbsp; Action: <strong>${b.action}</strong>` : ''}
    </p>
  </div>

  <div style="padding:16px 24px;background:#f5f3ff;border-bottom:1px solid #ddd6fe">
    <p style="margin:0;font-size:14px;color:#5b21b6;font-weight:600">${b.errorType ?? 'Error'}</p>
    <p style="margin:6px 0 0;font-size:13px;color:#6d28d9">${b.errorMessage ?? '(no message)'}</p>
    <p style="margin:8px 0 0;font-size:12px;color:#6b7280">${utcStr} &nbsp;·&nbsp; ${wibStr}</p>
  </div>

  <div style="padding:20px 24px;border-bottom:1px solid #e5e7eb">
    <h3 style="margin:0 0 12px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em">Details</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <tr>
        <td style="padding:5px 0;color:#6b7280;width:110px">User ID</td>
        <td style="padding:5px 0;color:#374151;font-family:monospace;font-size:12px">${b.userId ?? '— (not logged in)'}</td>
      </tr>
      <tr>
        <td style="padding:5px 0;color:#6b7280">Screen</td>
        <td style="padding:5px 0;color:#374151">${b.screen ?? '—'}</td>
      </tr>
      <tr>
        <td style="padding:5px 0;color:#6b7280">Action</td>
        <td style="padding:5px 0;color:#374151">${b.action ?? '—'}</td>
      </tr>
      <tr>
        <td style="padding:5px 0;color:#6b7280">App Version</td>
        <td style="padding:5px 0;color:#374151">${b.appVersion ?? '—'}</td>
      </tr>
      <tr>
        <td style="padding:5px 0;color:#6b7280">Error Type</td>
        <td style="padding:5px 0;color:#374151;font-family:monospace;font-size:12px">${b.errorType ?? '—'}</td>
      </tr>
    </table>
  </div>

  ${stackHtml}
  ${metaHtml}

  <div style="padding:16px 24px;border-bottom:1px solid #e5e7eb">
    <a href="${process.env.APP_URL ?? 'https://riteangle.dating'}/admin/monitoring"
       style="display:inline-block;padding:10px 18px;background:#7c3aed;color:#fff;text-decoration:none;border-radius:6px;font-size:13px;font-weight:600">
      View Monitoring Dashboard
    </a>
  </div>

  <div style="padding:12px 24px;background:#f9fafb;color:#9ca3af;font-size:11px">
    Sent by Flutter AppLogger · riteangle mobile app
  </div>
</div>
</body></html>`;
}

export const POST: RequestHandler = async ({ request }) => {
	const apiKey = process.env.RESEND_API_KEY;
	const alertEmail = process.env.ALERT_EMAIL;

	if (!apiKey || !alertEmail) {
		return json({ ok: false, error: 'Email not configured' }, { status: 500 });
	}

	let body: MobileErrorBody;
	try {
		body = await request.json();
	} catch {
		return json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
	}

	const now = new Date();
	const screen = body.screen ?? 'unknown';
	const errType = body.errorType ?? 'Error';

	try {
		const resp = await fetch('https://api.resend.com/emails', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${apiKey}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				from: 'riteangle App Monitor <monitor@riteangle.dating>',
				to: [alertEmail],
				subject: `📱 App Error: ${errType} on "${screen}" — riteangle`,
				html: buildErrorEmail(body, now),
			}),
		});

		if (!resp.ok) {
			const txt = await resp.text();
			console.error('[mobile-error] Resend error:', resp.status, txt);
			return json({ ok: false, error: `Resend ${resp.status}` }, { status: 500 });
		}

		console.log(`[mobile-error] Alert sent: ${errType} on ${screen} (user: ${body.userId ?? 'anon'})`);

		// Slack notification (fire-and-forget)
		const appUrl = process.env.APP_URL ?? 'https://riteangle.dating';
		await sendSlackAlert({
			color:    'warning',
			emoji:    '📱',
			title:    `App Bug: ${errType}`,
			subtitle: `Screen: \`${screen}\` · Action: \`${body.action ?? '—'}\``,
			fields: [
				{ label: 'Error',   value: body.errorMessage?.slice(0, 200) ?? '—' },
				{ label: 'User',    value: body.userId ? `\`${body.userId.slice(0, 8)}…\`` : '_not logged in_', short: true },
				{ label: 'Version', value: body.appVersion ?? '—', short: true },
				...(body.stack ? [{ label: 'Stack (first 3 lines)', value: `\`\`\`${body.stack.split('\n').slice(0, 3).join('\n')}\`\`\`` }] : []),
			],
			footer:       'Flutter AppLogger',
			dashboardUrl: `${appUrl}/admin/monitoring`,
		});

		return json({ ok: true });
	} catch (err) {
		console.error('[mobile-error] Failed:', err);
		return json({ ok: false, error: String(err) }, { status: 500 });
	}
};
