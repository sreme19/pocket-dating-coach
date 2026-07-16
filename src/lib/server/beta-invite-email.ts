/**
 * Beta-invite confirmation email.
 *
 * Sent the moment someone submits their email on /beta/{token}. It (1) thanks
 * them, (2) shows the card of the woman they'll be matched with, and (3) sets
 * the expectation that a personal sign-up invite follows from the team.
 *
 * This is a no-reply message: sent from hello@ but replies are not routed
 * anywhere, and the footer says so.
 */

import { sendEmail, escapeHtml } from './email';

export interface ReferrerCard {
  first_name: string | null;
  age: number | null;
  city: string | null;
  avatar_url: string | null;
  about: string | null;
}

const ABOUT_MAX = 140;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts.slice(0, 2).map((p) => p[0]!.toUpperCase()).join('');
}

function truncate(text: string, max: number): string {
  const t = text.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

export function buildBetaConfirmationHtml(referrer: ReferrerCard): string {
  const name = (referrer.first_name ?? '').trim() || 'your match';
  const safeName = escapeHtml(name);
  const nameAge = referrer.age ? `${safeName}, ${referrer.age}` : safeName;
  const city = referrer.city ? escapeHtml(referrer.city) : '';
  const about = referrer.about ? escapeHtml(truncate(referrer.about, ABOUT_MAX)) : '';

  const hasAbsoluteAvatar =
    typeof referrer.avatar_url === 'string' && /^https?:\/\//.test(referrer.avatar_url);

  // Email clients need absolute image URLs and often block them anyway, so the
  // initials avatar is both the fallback and the default when no photo exists.
  const avatarCell = hasAbsoluteAvatar
    ? `<img src="${escapeHtml(referrer.avatar_url!)}" width="72" height="72" alt="${safeName}"
           style="width:72px;height:72px;border-radius:50%;object-fit:cover;display:block" />`
    : `<div style="width:72px;height:72px;border-radius:50%;background:#ec4899;color:#fff;
           font-size:26px;font-weight:700;line-height:72px;text-align:center">${escapeHtml(initials(name))}</div>`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#fdf6f0;margin:0;padding:24px;color:#1f2937">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08)">
    <div style="padding:28px 28px 8px">
      <h1 style="margin:0;font-size:22px;color:#111827">Thanks — you're in! 🎉</h1>
      <p style="margin:12px 0 0;font-size:15px;line-height:1.55;color:#374151">
        Thanks for dropping your email. You've been added to the riteangle beta list.
      </p>
      <p style="margin:16px 0 0;font-size:15px;line-height:1.55;color:#374151">
        Here's who you'll be matched with once you're set up:
      </p>
    </div>

    <div style="margin:16px 28px;padding:16px;border:1px solid #f3e4d9;border-radius:12px;background:#fdfaf7">
      <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
        <tr>
          <td style="vertical-align:top;padding-right:14px">${avatarCell}</td>
          <td style="vertical-align:top">
            <div style="font-size:17px;font-weight:700;color:#111827">${nameAge}</div>
            ${city ? `<div style="font-size:14px;color:#6b7280;margin-top:2px">${city}</div>` : ''}
            ${about ? `<div style="font-size:14px;color:#374151;margin-top:8px;line-height:1.5">“${about}”</div>` : ''}
          </td>
        </tr>
      </table>
    </div>

    <div style="padding:8px 28px 28px">
      <h2 style="margin:16px 0 6px;font-size:15px;color:#111827">What happens next?</h2>
      <p style="margin:0;font-size:15px;line-height:1.55;color:#374151">
        Our team is rolling out invites in batches. You'll get a follow-up email from us with your
        personal invite to sign up — once you complete a quick setup, you'll be matched with
        ${safeName} straight away.
      </p>
      <p style="margin:16px 0 0;font-size:15px;line-height:1.55;color:#374151">
        Sit tight — we'll be in touch soon.<br/>— The riteangle team
      </p>
    </div>

    <div style="padding:14px 28px;border-top:1px solid #f1e7de;color:#9ca3af;font-size:12px;line-height:1.5">
      This is an automated message — please don't reply to this email.<br/>
      riteangle · <a href="https://riteangle.dating" style="color:#ec4899;text-decoration:none">riteangle.dating</a>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Send the confirmation. Callers should treat a throw as non-fatal — the
 * signup has already been recorded, so a mail failure must not fail the request.
 */
export async function sendBetaConfirmationEmail(toEmail: string, referrer: ReferrerCard): Promise<void> {
  const name = (referrer.first_name ?? '').trim() || 'your match';
  await sendEmail({
    to: toEmail,
    subject: `You're on the list — you'll be matched with ${name}`,
    html: buildBetaConfirmationHtml(referrer),
  });
}

export type Platform = 'ios' | 'android';

const ANDROID_STORE_URL = 'https://play.google.com/store/apps/details?id=com.riteangle.app';

export function buildEarlyAccessHtml(referrer: ReferrerCard, platform: Platform): string {
  const name = (referrer.first_name ?? '').trim() || 'your match';
  const safeName = escapeHtml(name);
  const nameAge = referrer.age ? `${safeName}, ${referrer.age}` : safeName;
  const city = referrer.city ? escapeHtml(referrer.city) : '';
  const about = referrer.about ? escapeHtml(truncate(referrer.about, ABOUT_MAX)) : '';

  const hasAbsoluteAvatar =
    typeof referrer.avatar_url === 'string' && /^https?:\/\//.test(referrer.avatar_url);

  const avatarCell = hasAbsoluteAvatar
    ? `<img src="${escapeHtml(referrer.avatar_url!)}" width="72" height="72" alt="${safeName}"
           style="width:72px;height:72px;border-radius:50%;object-fit:cover;display:block" />`
    : `<div style="width:72px;height:72px;border-radius:50%;background:#ec4899;color:#fff;
           font-size:26px;font-weight:700;line-height:72px;text-align:center">${escapeHtml(initials(name))}</div>`;

  const iosSteps = `
    <h2 style="margin:20px 0 10px;font-size:15px;color:#111827">How to get the app (3 steps):</h2>
    <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%">
      <tr>
        <td style="vertical-align:top;padding-right:12px;padding-bottom:14px">
          <div style="width:28px;height:28px;border-radius:50%;background:#ec4899;color:#fff;font-size:13px;font-weight:700;line-height:28px;text-align:center">1</div>
        </td>
        <td style="vertical-align:top;padding-bottom:14px">
          <div style="font-size:14px;font-weight:600;color:#111827">Check your email from Apple</div>
          <div style="font-size:14px;color:#6b7280;margin-top:2px">Look for an invite from <strong>noreply@email.apple.com</strong> (check spam too). <strong>Important:</strong> the invite is sent to this email address — make sure it matches your Apple ID, or you won't be able to accept it.</div>
        </td>
      </tr>
      <tr>
        <td style="vertical-align:top;padding-right:12px;padding-bottom:14px">
          <div style="width:28px;height:28px;border-radius:50%;background:#ec4899;color:#fff;font-size:13px;font-weight:700;line-height:28px;text-align:center">2</div>
        </td>
        <td style="vertical-align:top;padding-bottom:14px">
          <div style="font-size:14px;font-weight:600;color:#111827">Install TestFlight</div>
          <div style="font-size:14px;color:#6b7280;margin-top:2px">Download <a href="https://apps.apple.com/app/testflight/id899247664" style="color:#ec4899;text-decoration:none">TestFlight</a> from the App Store if you don't have it yet. It's free.</div>
        </td>
      </tr>
      <tr>
        <td style="vertical-align:top;padding-right:12px">
          <div style="width:28px;height:28px;border-radius:50%;background:#ec4899;color:#fff;font-size:13px;font-weight:700;line-height:28px;text-align:center">3</div>
        </td>
        <td style="vertical-align:top">
          <div style="font-size:14px;font-weight:600;color:#111827">Tap "View in TestFlight" → Install</div>
          <div style="font-size:14px;color:#6b7280;margin-top:2px">Open Apple's invite email, tap the button, accept in TestFlight, then tap <strong>Install</strong>. riteangle will appear on your home screen.</div>
        </td>
      </tr>
    </table>`;

  const androidButton = `
    <div style="text-align:center;margin:20px 0 8px">
      <a href="${ANDROID_STORE_URL}" style="display:inline-block;background:#ec4899;color:#fff;font-size:15px;font-weight:600;padding:13px 28px;border-radius:10px;text-decoration:none">
        Get it on Google Play →
      </a>
    </div>`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#fdf6f0;margin:0;padding:24px;color:#1f2937">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08)">
    <div style="padding:28px 28px 8px">
      <h1 style="margin:0;font-size:22px;color:#111827">Congratulations — you're in! 🎉</h1>
      <p style="margin:12px 0 0;font-size:15px;line-height:1.55;color:#374151">
        You've been accepted as an early access member of riteangle. Welcome!
      </p>
      <p style="margin:10px 0 0;font-size:15px;line-height:1.55;color:#374151">
        You've been matched with ${safeName} — she'll be waiting for you in the app.
      </p>
    </div>

    <div style="margin:16px 28px;padding:16px;border:1px solid #f3e4d9;border-radius:12px;background:#fdfaf7">
      <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
        <tr>
          <td style="vertical-align:top;padding-right:14px">${avatarCell}</td>
          <td style="vertical-align:top">
            <div style="font-size:17px;font-weight:700;color:#111827">${nameAge}</div>
            ${city ? `<div style="font-size:14px;color:#6b7280;margin-top:2px">${city}</div>` : ''}
            ${about ? `<div style="font-size:14px;color:#374151;margin-top:8px;line-height:1.5">"${about}"</div>` : ''}
          </td>
        </tr>
      </table>
    </div>

    <div style="padding:4px 28px 28px">
      ${platform === 'ios' ? iosSteps : androidButton}
      <p style="margin:16px 0 0;font-size:14px;line-height:1.55;color:#6b7280">
        See you inside.<br/>— The riteangle team
      </p>
    </div>

    <div style="padding:14px 28px;border-top:1px solid #f1e7de;color:#9ca3af;font-size:12px;line-height:1.5">
      This is an automated message — please don't reply to this email.<br/>
      riteangle · <a href="https://riteangle.dating" style="color:#ec4899;text-decoration:none">riteangle.dating</a>
    </div>
  </div>
</body>
</html>`;
}

export async function sendEarlyAccessEmail(
  toEmail: string,
  referrer: ReferrerCard,
  platform: Platform
): Promise<void> {
  const name = (referrer.first_name ?? '').trim() || 'your match';
  await sendEmail({
    to: toEmail,
    subject: `You're accepted! Get the app to meet ${name} 🎉`,
    html: buildEarlyAccessHtml(referrer, platform),
  });
}
