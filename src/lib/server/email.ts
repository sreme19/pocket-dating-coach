/**
 * Transactional email via Resend.
 *
 * Thin wrapper over the Resend HTTP API (the same call the monitoring cron
 * makes inline). Reads RESEND_API_KEY from the environment; the from-domain
 * riteangle.dating is already verified in Resend.
 *
 * Throws on a non-2xx response so callers can decide whether a failure is
 * fatal. For user-facing flows (e.g. beta confirmation) callers should treat
 * a throw as non-fatal and swallow it.
 */

import { env } from '$env/dynamic/private';

const DEFAULT_FROM = 'riteangle <hello@riteangle.dating>';

/** A file to attach. `content` is base64-encoded per the Resend API. */
export interface EmailAttachment {
  filename: string;
  content: string;
}

export interface SendEmailArgs {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  /** Address replies go to. Omit for a no-reply message. */
  replyTo?: string;
  /** Optional file attachments (base64 content). */
  attachments?: EmailAttachment[];
}

export async function sendEmail({
  to,
  subject,
  html,
  from,
  replyTo,
  attachments,
}: SendEmailArgs): Promise<void> {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY not set');

  const body: Record<string, unknown> = {
    from: from ?? DEFAULT_FROM,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
  };
  if (replyTo) body.reply_to = replyTo;
  if (attachments && attachments.length) body.attachments = attachments;

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Resend error ${resp.status}: ${text}`);
  }
}

/** Escape user-supplied text before interpolating into email HTML. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
