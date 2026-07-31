/**
 * "Report issue" — the in-app escape hatch for anything our automated screens got
 * wrong, and the human backstop behind the photo content gate.
 *
 * The content screen (screenPhotoSafetyWithClaude) is told to answer 'ok' when it
 * is unsure, and it fails open on an API error, so some amount of nudity or
 * distressing imagery WILL reach a profile. That is a deliberate trade — the
 * alternative is blocking real users' onboarding on a model's hesitation — and it
 * is only defensible because there is a fast path for a human to say "this one is
 * wrong". This is that path.
 *
 * Two independent channels, same posture as the careers form: email the team AND
 * write a durable row. A Resend outage still leaves the row; a DB hiccup still
 * sends the mail. The caller only fails when BOTH fail.
 */

import { getSupabase } from './supabase';
import { sendEmail, escapeHtml } from './email';
import { TEAM_INBOX, PUBLIC_ORIGIN } from './beta-invite-email';

/**
 * Why they're reporting. Kept short and concrete — a long list makes people pick
 * 'other', which is the least actionable answer.
 */
export const ISSUE_CATEGORIES = [
  'nudity',
  'disturbing',
  'wrong_person',
  'bug',
  'other',
] as const;
export type IssueCategory = (typeof ISSUE_CATEGORIES)[number];

/** Human labels for the notification email + admin queue. */
const CATEGORY_LABEL: Record<IssueCategory, string> = {
  nudity: 'Nudity or sexual content',
  disturbing: 'Disturbing or graphic content',
  wrong_person: 'Photos are not the person',
  bug: 'Something is broken',
  other: 'Other',
};

/** Reports naming one of these jump the queue in the subject line. */
const URGENT: IssueCategory[] = ['nudity', 'disturbing'];

export const MAX_DESCRIPTION = 2000;
export const MAX_SURFACE = 60;
export const MAX_URL = 2000;

export interface IssueReportInput {
  reporterId: string | null;
  category: IssueCategory;
  surface: string;
  description: string;
  subjectUserId: string | null;
  subjectUrl: string;
  context: Record<string, unknown>;
}

export interface IssueReportResult {
  /** Row id when the insert landed. */
  reportId: string | null;
  emailSent: boolean;
}

export function isIssueCategory(v: unknown): v is IssueCategory {
  return typeof v === 'string' && (ISSUE_CATEGORIES as readonly string[]).includes(v);
}

/**
 * Subject line the team can triage from the notification list alone, without
 * opening anything.
 */
export function issueSubject(category: IssueCategory): string {
  const prefix = URGENT.includes(category) ? '🚨 URGENT' : 'Issue';
  return `${prefix} — ${CATEGORY_LABEL[category]} reported in riteangle`;
}

function row(label: string, value: string): string {
  return `<tr>
      <td style="padding:4px 16px 4px 0;color:#6b7280;font-size:14px;white-space:nowrap;vertical-align:top">${label}</td>
      <td style="padding:4px 0;font-size:15px;color:#111827">${value}</td>
    </tr>`;
}

export function buildIssueReportHtml(input: IssueReportInput, reportId: string | null): string {
  const missing = '<span style="color:#9ca3af">not provided</span>';
  const field = (v: string) => (v.trim() ? escapeHtml(v.trim()) : missing);
  const urgent = URGENT.includes(input.category);
  const subjectLink = input.subjectUserId
    ? `<a href="${escapeHtml(`${PUBLIC_ORIGIN}/admin/users/${encodeURIComponent(input.subjectUserId)}`)}">${escapeHtml(input.subjectUserId)}</a>`
    : missing;
  // Linked, not embedded: the whole point of a nudity report is that nobody
  // should have the image pushed at them before choosing to look.
  const urlCell = input.subjectUrl.trim()
    ? `<a href="${escapeHtml(input.subjectUrl.trim())}">open the reported image</a>`
    : missing;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#fdf6f0;margin:0;padding:24px;color:#1f2937">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08)">
    <div style="padding:28px 28px 4px">
      <h1 style="margin:0;font-size:20px;color:${urgent ? '#b91c1c' : '#111827'}">
        ${urgent ? 'Urgent content report' : 'Issue reported'}
      </h1>
      <p style="margin:12px 0 0;font-size:15px;line-height:1.55;color:#374151">
        <strong>${escapeHtml(CATEGORY_LABEL[input.category])}</strong>${
          urgent
            ? ' — a member says something on their screen should not be published. Please review now.'
            : '.'
        }
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:18px 0 0">
        ${row('Category', escapeHtml(CATEGORY_LABEL[input.category]))}
        ${row('Where', field(input.surface))}
        ${row('About user', subjectLink)}
        ${row('Image / page', urlCell)}
        ${row('Reported by', input.reporterId ? escapeHtml(input.reporterId) : '<span style="color:#9ca3af">signed out</span>')}
        ${row('What they said', field(input.description))}
        ${row('Report id', reportId ? escapeHtml(reportId) : '<span style="color:#9ca3af">DB write failed — this email is the only record</span>')}
      </table>
    </div>
    <div style="padding:16px 28px;border-top:1px solid #f3e4d9;color:#9ca3af;font-size:12px;line-height:1.5">
      Automatic alert for the riteangle team · sent from the in-app Report issue button.
    </div>
  </div>
</body>
</html>`;
}

/**
 * Record one report. Never throws for a single-channel failure — the caller wants
 * to thank the user as long as SOMETHING captured it.
 */
export async function recordIssueReport(input: IssueReportInput): Promise<IssueReportResult> {
  const db = getSupabase() as any;

  let reportId: string | null = null;
  try {
    const { data, error } = await db
      .from('issue_reports')
      .insert({
        reporter_id: input.reporterId,
        category: input.category,
        surface: input.surface,
        description: input.description || null,
        subject_user_id: input.subjectUserId,
        subject_url: input.subjectUrl || null,
        context: input.context,
        status: 'pending',
      })
      .select('id')
      .single();
    if (error) throw error;
    reportId = data?.id ?? null;
  } catch (e: any) {
    // Loud: the email below is now the only copy.
    console.error('[report-issue] DB write failed:', e?.message ?? e);
  }

  let emailSent = false;
  try {
    await sendEmail({
      to: TEAM_INBOX,
      subject: issueSubject(input.category),
      html: buildIssueReportHtml(input, reportId),
    });
    emailSent = true;
  } catch (e: any) {
    console.error('[report-issue] email failed:', e?.message ?? e);
  }

  if (reportId && emailSent) {
    // Best-effort bookkeeping so the admin queue shows which rows were mailed.
    await db.from('issue_reports').update({ email_sent: true }).eq('id', reportId);
  }

  return { reportId, emailSent };
}
