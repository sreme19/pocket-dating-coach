import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { buildAdHealth, sortFindings, type Finding } from '$lib/server/ad-health';
import { sendEmail, escapeHtml } from '$lib/server/email';
import { TEAM_INBOX } from '$lib/server/beta-invite-email';

/**
 * Daily instrumentation check for the ad pipeline.
 *
 * SENDS ONLY WHEN SOMETHING IS WRONG. A daily "all healthy" mail is ignored
 * within a week, and the one that matters is ignored along with it. A message
 * arriving therefore always means there is something to do.
 *
 * Reports instrumentation, never strategy — the weekly report does that. The two
 * are separate because they call for different reactions on different clocks: a
 * dead token needs fixing this morning, a weak campaign needs a week of data and
 * a decision.
 *
 * `?dry=1` returns the findings as JSON without sending, so the checks can be
 * read before they are armed.
 *
 * Auth: Authorization: Bearer <CRON_SECRET>
 */

function authorized(request: Request): boolean {
	const secret = process.env.CRON_SECRET;
	if (!secret) return false;
	const header = request.headers.get('authorization') ?? '';
	return header.startsWith('Bearer ') && header.slice(7) === secret;
}

const LABEL: Record<Finding['severity'], string> = {
	broken: '🔴 Broken',
	warning: '🟠 Check',
	pending: '⚪ Not set up yet'
};

const COLOUR: Record<Finding['severity'], string> = {
	broken: '#dc2626',
	warning: '#ea580c',
	pending: '#64748b'
};

function buildHtml(report: Awaited<ReturnType<typeof buildAdHealth>>): string {
	const { stats } = report;
	const rows = sortFindings(report.findings)
		.map(
			(f) => `
      <tr>
        <td style="padding:12px 0;border-top:1px solid #e2e8f0;vertical-align:top;width:130px">
          <span style="color:${COLOUR[f.severity]};font-size:13px;font-weight:600">${LABEL[f.severity]}</span>
        </td>
        <td style="padding:12px 0;border-top:1px solid #e2e8f0">
          <div style="font-size:15px;font-weight:600;color:#0f172a">${escapeHtml(f.title)}</div>
          <div style="font-size:13px;line-height:1.55;color:#475569;margin-top:4px">${escapeHtml(f.detail)}</div>
        </td>
      </tr>`
		)
		.join('');

	return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:640px;margin:0 auto;padding:24px">
    <div style="font-size:20px;font-weight:700;color:#0f172a">Ad pipeline — ${report.findings.length} thing${report.findings.length === 1 ? '' : 's'} to look at</div>
    <div style="font-size:13px;color:#64748b;margin-top:4px">${report.day} · last 24 hours, IST</div>

    <div style="margin:20px 0;padding:14px 16px;background:#f8fafc;border-radius:10px;font-size:13px;color:#334155">
      <strong>${stats.views24h}</strong> page views ·
      <strong>${stats.taps24h}</strong> store taps ·
      <strong>${stats.signups24h}</strong> signups ·
      <strong>${stats.spend24h.toFixed(0)}</strong> spend ·
      <strong>${stats.attributedTotal}</strong> members ever attributed
    </div>

    <table style="width:100%;border-collapse:collapse">${rows}</table>

    <div style="margin-top:24px;font-size:12px;color:#94a3b8;line-height:1.5">
      Instrumentation only — nothing here is a campaign recommendation; the weekly
      report covers that. Items marked "Not set up yet" are missing configuration
      rather than faults.
    </div>
  </div>`;
}

const handle: RequestHandler = async ({ request, url }) => {
	if (!authorized(request)) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const report = await buildAdHealth();
		const dry = url.searchParams.get('dry') === '1';

		if (report.findings.length === 0) {
			return json({ ok: true, healthy: true, sent: false, ...report });
		}

		if (dry) {
			return json({ ok: true, healthy: false, sent: false, dry: true, ...report });
		}

		const broken = report.findings.filter((f) => f.severity === 'broken').length;
		await sendEmail({
			to: TEAM_INBOX,
			// Counts in the subject so the inbox itself says whether to open it now.
			subject: broken
				? `🔴 Ad pipeline: ${broken} broken — ${report.day}`
				: `Ad pipeline: ${report.findings.length} to check — ${report.day}`,
			html: buildHtml(report)
		});

		return json({ ok: true, healthy: false, sent: true, ...report });
	} catch (err: any) {
		console.error('ad-health cron failed:', err);
		return json({ ok: false, error: err?.message ?? String(err) }, { status: 500 });
	}
};

export const GET = handle;
export const POST = handle;
