/**
 * POST /api/careers/apply
 *   Public endpoint behind the careers job-detail application form. Collects a
 *   candidate's application and emails it to the careers inbox via Resend.
 *
 *   Body (multipart/form-data):
 *     name    string   (required)
 *     phone   string   (required)
 *     email   string   (optional — used as reply-to so recruiters can respond)
 *     cover   string   (optional — short cover note)
 *     role    string   (role title, for the subject line)
 *     slug    string   (role slug, for reference)
 *     resume  File     (optional — PDF/DOC/DOCX, capped in size)
 *
 * No auth (public). No DB write — the application is delivered by email, so the
 * feature works without a schema change. Inputs are length-capped and the
 * resume is size/type-guarded so the endpoint can't be used to relay large or
 * arbitrary attachments.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sendEmail, escapeHtml } from '$lib/server/email';

const CAREERS_INBOX = 'chris@wardrobeofamonk.com';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Input caps (defense against overload / abuse of the public surface).
const MAX_NAME = 120;
const MAX_PHONE = 40;
const MAX_EMAIL = 160;
const MAX_COVER = 4000;
const MAX_ROLE = 160;
const MAX_RESUME_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_RESUME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const ALLOWED_RESUME_EXT = /\.(pdf|doc|docx)$/i;

const clean = (v: FormDataEntryValue | null, max: number): string =>
  typeof v === 'string' ? v.trim().slice(0, max) : '';

export const POST: RequestHandler = async ({ request }) => {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: 'Invalid request' }, { status: 400 });
  }

  const name = clean(form.get('name'), MAX_NAME);
  const phone = clean(form.get('phone'), MAX_PHONE);
  const email = clean(form.get('email'), MAX_EMAIL);
  const cover = clean(form.get('cover'), MAX_COVER);
  const role = clean(form.get('role'), MAX_ROLE) || 'a role';
  const slug = clean(form.get('slug'), MAX_ROLE);

  if (!name) return json({ error: 'Please enter your name.' }, { status: 400 });
  if (!phone) return json({ error: 'Please enter your phone number.' }, { status: 400 });
  if (email && !EMAIL_RE.test(email)) {
    return json({ error: 'That email address looks invalid.' }, { status: 400 });
  }

  // Optional resume → validate and prepare as a base64 attachment.
  const attachments: Array<{ filename: string; content: string }> = [];
  const resume = form.get('resume');
  if (resume && resume instanceof File && resume.size > 0) {
    if (resume.size > MAX_RESUME_BYTES) {
      return json({ error: 'Resume is too large (max 5 MB).' }, { status: 400 });
    }
    const typeOk = ALLOWED_RESUME_TYPES.has(resume.type) || ALLOWED_RESUME_EXT.test(resume.name);
    if (!typeOk) {
      return json({ error: 'Resume must be a PDF or Word document.' }, { status: 400 });
    }
    const buf = Buffer.from(await resume.arrayBuffer());
    const safeName = (resume.name || 'resume').replace(/[^\w.\-]+/g, '_').slice(0, 120);
    attachments.push({ filename: safeName, content: buf.toString('base64') });
  }

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1B1020;line-height:1.6">
      <h2 style="margin:0 0 4px">New application — ${escapeHtml(role)}</h2>
      ${slug ? `<p style="margin:0 0 16px;color:#6E5F64;font-size:13px">Role ID: ${escapeHtml(slug)}</p>` : ''}
      <table style="border-collapse:collapse;font-size:15px">
        <tr><td style="padding:4px 16px 4px 0;color:#6E5F64">Name</td><td style="padding:4px 0"><b>${escapeHtml(name)}</b></td></tr>
        <tr><td style="padding:4px 16px 4px 0;color:#6E5F64">Phone</td><td style="padding:4px 0">${escapeHtml(phone)}</td></tr>
        <tr><td style="padding:4px 16px 4px 0;color:#6E5F64">Email</td><td style="padding:4px 0">${email ? escapeHtml(email) : '<i>not provided</i>'}</td></tr>
        <tr><td style="padding:4px 16px 4px 0;color:#6E5F64;vertical-align:top">Resume</td><td style="padding:4px 0">${attachments.length ? 'Attached' : '<i>not provided</i>'}</td></tr>
      </table>
      ${
        cover
          ? `<div style="margin-top:18px"><div style="color:#6E5F64;font-size:13px;margin-bottom:4px">Cover note</div><div style="white-space:pre-wrap;background:#FBEEE9;border-radius:12px;padding:14px 16px">${escapeHtml(cover)}</div></div>`
          : ''
      }
    </div>`;

  try {
    await sendEmail({
      to: CAREERS_INBOX,
      subject: `Application — ${role} — ${name}`,
      html,
      replyTo: email || undefined,
      attachments: attachments.length ? attachments : undefined,
    });
  } catch (e) {
    console.error('[careers-apply] Email delivery failed:', e);
    return json({ error: 'Something went wrong sending your application. Please try again.' }, { status: 502 });
  }

  return json({ ok: true });
};
