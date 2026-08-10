import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { buildWeeklyReport, sortFlags, type Flag, type Metric, type WeeklyReport } from '$lib/server/ad-weekly';
import { sendEmail, escapeHtml } from '$lib/server/email';
import { TEAM_INBOX } from '$lib/server/beta-invite-email';

/**
 * Weekly ad strategy report — Monday morning, over the previous 7 IST days.
 *
 * Unlike the daily health check this ALWAYS sends: the weekly report is a
 * standing review, and a silent week would read as "no campaigns" rather than
 * "nothing broke". The daily mail is an alarm; this one is a meeting.
 *
 * `?dry=1` returns JSON without sending.
 *
 * Auth: Authorization: Bearer <CRON_SECRET>
 */

function authorized(request: Request): boolean {
	const secret = process.env.CRON_SECRET;
	if (!secret) return false;
	const header = request.headers.get('authorization') ?? '';
	return header.startsWith('Bearer ') && header.slice(7) === secret;
}

const FLAG_STYLE: Record<Flag['kind'], { label: string; colour: string }> = {
	pause: { label: 'Consider pausing', colour: '#dc2626' },
	broken_funnel: { label: 'Funnel breaking', colour: '#ea580c' },
	investigate: { label: 'Investigate', colour: '#d97706' },
	scale: { label: 'Consider scaling', colour: '#059669' },
	insufficient: { label: 'Too little data', colour: '#64748b' }
};

function money(n: number, currency: string): string {
	return new Intl.NumberFormat('en-IN', {
		style: 'currency',
		currency,
		maximumFractionDigits: 0
	}).format(n || 0);
}

function fmtMetric(m: Metric, currency: string): string {
	return m.money ? money(m.now, currency) : String(Math.round(m.now));
}

/** A delta, or an honest dash. Never a percentage against a zero baseline. */
function fmtDelta(m: Metric): string {
	if (m.deltaPct === null) {
		return m.now > 0 && m.prior === 0
			? '<span style="color:#64748b">new</span>'
			: '<span style="color:#64748b">—</span>';
	}
	const pct = (m.deltaPct * 100).toFixed(0);
	// Cost going DOWN is good; everything else going up is good. Colouring these
	// the same way would make a cheaper signup look like a problem.
	const goodWhenDown = m.label.startsWith('Cost');
	const good = goodWhenDown ? m.deltaPct < 0 : m.deltaPct > 0;
	const colour = m.deltaPct === 0 ? '#64748b' : good ? '#059669' : '#dc2626';
	const arrow = m.deltaPct > 0 ? '▲' : m.deltaPct < 0 ? '▼' : '';
	return `<span style="color:${colour}">${arrow} ${Math.abs(Number(pct))}%</span>`;
}

function buildHtml(r: WeeklyReport): string {
	const cur = r.currency;

	const headlineRows = r.headline
		.map(
			(m) => `<tr>
        <td style="padding:8px 0;border-top:1px solid #e2e8f0;font-size:13px;color:#475569">${escapeHtml(m.label)}</td>
        <td style="padding:8px 0;border-top:1px solid #e2e8f0;font-size:15px;font-weight:600;color:#0f172a;text-align:right">${fmtMetric(m, cur)}</td>
        <td style="padding:8px 0 8px 14px;border-top:1px solid #e2e8f0;font-size:13px;text-align:right">${fmtDelta(m)}</td>
      </tr>`
		)
		.join('');

	const flagRows = sortFlags(r.flags)
		.map((f) => {
			const s = FLAG_STYLE[f.kind];
			return `<tr>
        <td style="padding:12px 0;border-top:1px solid #e2e8f0;vertical-align:top;width:150px">
          <span style="color:${s.colour};font-size:13px;font-weight:600">${s.label}</span>
        </td>
        <td style="padding:12px 0;border-top:1px solid #e2e8f0">
          <div style="font-size:14px;font-weight:600;color:#0f172a">${escapeHtml(f.campaign)}</div>
          <div style="font-size:12px;color:#94a3b8;margin-top:2px">Rule: ${escapeHtml(f.rule)}</div>
          <div style="font-size:13px;line-height:1.5;color:#475569;margin-top:4px">${escapeHtml(f.evidence)}</div>
        </td>
      </tr>`;
		})
		.join('');

	const campaignRows = r.campaigns
		.map(
			(c) => `<tr>
        <td style="padding:10px 8px 10px 0;border-top:1px solid #e2e8f0;font-size:13px;color:#0f172a">
          ${escapeHtml(c.campaign)}
          <div style="font-size:11px;color:#94a3b8;margin-top:2px">
            bidding on: ${escapeHtml(c.objective)}${c.objectiveInferred ? ' <em>(inferred from name)</em>' : ''}
          </div>
        </td>
        <td style="padding:10px 8px;border-top:1px solid #e2e8f0;font-size:13px;text-align:right;color:#475569">${c.spend ? money(c.spend, cur) : '—'}</td>
        <td style="padding:10px 8px;border-top:1px solid #e2e8f0;font-size:13px;text-align:right;color:#475569">${c.views}</td>
        <td style="padding:10px 8px;border-top:1px solid #e2e8f0;font-size:13px;text-align:right;color:#475569">${c.taps}</td>
        <td style="padding:10px 8px;border-top:1px solid #e2e8f0;font-size:13px;text-align:right;color:#475569">${c.tapRate === null ? `n=${c.views}` : `${(c.tapRate * 100).toFixed(1)}%`}</td>
        <td style="padding:10px 0 10px 8px;border-top:1px solid #e2e8f0;font-size:13px;text-align:right;color:#475569">${c.signups}</td>
      </tr>`
		)
		.join('');

	const caveatItems = r.caveats
		.map((c) => `<li style="margin-bottom:6px">${escapeHtml(c)}</li>`)
		.join('');

	const ctaRows = Object.entries(r.segments.byCta)
		.sort((a, b) => b[1] - a[1])
		.map(([k, v]) => `<span style="margin-right:14px">${escapeHtml(k)}: <strong>${v}</strong></span>`)
		.join('');

	const countryRows = Object.entries(r.segments.byCountry)
		.sort((a, b) => b[1].views - a[1].views)
		.slice(0, 6)
		.map(([k, v]) => `<span style="margin-right:14px">${escapeHtml(k)}: <strong>${v.views}</strong> views / ${v.taps} taps</span>`)
		.join('');

	return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:680px;margin:0 auto;padding:24px;color:#0f172a">
    <div style="font-size:21px;font-weight:700">Ad campaigns — week in review</div>
    <div style="font-size:13px;color:#64748b;margin-top:4px">
      ${escapeHtml(r.range.label)} · vs ${escapeHtml(r.priorRange.start)} → ${escapeHtml(r.priorRange.end)} · IST · ${cur}
    </div>

    ${
			r.caveats.length
				? `<div style="margin:20px 0;padding:14px 16px;background:#fffbeb;border:1px solid #fde68a;border-radius:10px">
      <div style="font-size:13px;font-weight:600;color:#92400e">Read these first — what this week could not measure</div>
      <ul style="margin:8px 0 0;padding-left:18px;font-size:13px;line-height:1.55;color:#78350f">${caveatItems}</ul>
    </div>`
				: ''
		}

    <div style="font-size:15px;font-weight:700;margin:24px 0 4px">Headline</div>
    <table style="width:100%;border-collapse:collapse">${headlineRows}</table>

    <div style="font-size:15px;font-weight:700;margin:28px 0 4px">Decisions to consider</div>
    ${
			flagRows
				? `<table style="width:100%;border-collapse:collapse">${flagRows}</table>
           <p style="font-size:12px;color:#94a3b8;line-height:1.5;margin-top:10px">
             Each flag names the rule it fired on and the sample behind it. They are candidates for a
             decision, not instructions — and note what a campaign is bidding on before judging its
             cost per signup.
           </p>`
				: `<p style="font-size:13px;color:#64748b">Nothing crossed a threshold this week.</p>`
		}

    <div style="font-size:15px;font-weight:700;margin:28px 0 4px">By campaign</div>
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr style="font-size:11px;text-transform:uppercase;letter-spacing:0.04em;color:#94a3b8">
          <th style="text-align:left;padding-bottom:4px">Campaign</th>
          <th style="text-align:right;padding-bottom:4px">Spend</th>
          <th style="text-align:right;padding-bottom:4px">Views</th>
          <th style="text-align:right;padding-bottom:4px">Taps</th>
          <th style="text-align:right;padding-bottom:4px">Tap rate</th>
          <th style="text-align:right;padding-bottom:4px">Signups</th>
        </tr>
      </thead>
      <tbody>${campaignRows || `<tr><td colspan="6" style="padding:14px 0;font-size:13px;color:#64748b">No campaign data this week.</td></tr>`}</tbody>
    </table>

    <div style="font-size:15px;font-weight:700;margin:28px 0 6px">Segments</div>
    <div style="font-size:13px;color:#475569;line-height:1.8">
      <div><strong style="color:#0f172a">CTA position</strong> — ${ctaRows || '—'}</div>
      <div><strong style="color:#0f172a">Country</strong> — ${countryRows || '—'}</div>
    </div>

    <div style="margin-top:28px;font-size:12px;color:#94a3b8;line-height:1.5">
      Rates on fewer than 30 observations are shown as a raw count instead, because a percentage off
      a handful of visitors invites a decision the data cannot support. Days are IST.
    </div>
  </div>`;
}

const handle: RequestHandler = async ({ request, url }) => {
	if (!authorized(request)) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const currency = url.searchParams.get('currency') === 'USD' ? 'USD' : 'INR';
		const report = await buildWeeklyReport(currency);

		if (url.searchParams.get('dry') === '1') {
			return json({ ok: true, sent: false, dry: true, ...report });
		}

		const actionable = report.flags.filter((f) => f.kind !== 'insufficient').length;
		await sendEmail({
			to: TEAM_INBOX,
			subject: actionable
				? `Ad week in review — ${actionable} decision${actionable === 1 ? '' : 's'} to consider · ${report.range.label}`
				: `Ad week in review — ${report.range.label}`,
			html: buildHtml(report)
		});

		return json({ ok: true, sent: true, flags: report.flags.length, range: report.range });
	} catch (err: any) {
		console.error('ad-weekly cron failed:', err);
		return json({ ok: false, error: err?.message ?? String(err) }, { status: 500 });
	}
};

export const GET = handle;
export const POST = handle;
