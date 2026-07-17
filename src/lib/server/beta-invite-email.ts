/**
 * Beta-invite emails.
 *
 *  1. Confirmation — sent automatically when someone submits their email on
 *     /beta/{token}: thanks them + shows the woman's card + sets the
 *     expectation that a personal invite follows.
 *  2. Early access — sent manually from the Beta Invites admin once a human has
 *     added the person as an iOS/Android tester: congratulates them, shows the
 *     woman's card (now framed as "you've been matched"), and gives a
 *     platform-specific store button.
 *
 * Both are no-reply messages (sent from hello@, footer says so, replies not
 * routed anywhere).
 */

import { sendEmail, escapeHtml } from './email';

export interface ReferrerCard {
  first_name: string | null;
  age: number | null;
  city: string | null;
  avatar_url: string | null;
  about: string | null;
}

export type Platform = 'ios' | 'android';

// App store links. iOS is pending — leave '' until we have it; sendEarlyAccessEmail
// refuses to send an iOS invite while it's blank so we never mail a dead link.
export const STORE_LINKS: Record<Platform, string> = {
  android: 'https://play.google.com/store/apps/details?id=com.riteangle.app',
  ios: 'https://testflight.apple.com/join/FxGV4VrC',
};

export function storeUrlFor(platform: Platform): string {
  return STORE_LINKS[platform] ?? '';
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

/** The woman's card — shared by both emails. */
function referrerCardHtml(referrer: ReferrerCard): string {
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

  return `<div style="margin:16px 28px;padding:16px;border:1px solid #f3e4d9;border-radius:12px;background:#fdfaf7">
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
    </div>`;
}

/** Full HTML document shell — shared container + no-reply footer. */
function emailShell(innerHtml: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#fdf6f0;margin:0;padding:24px;color:#1f2937">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08)">
    ${innerHtml}
    <div style="padding:14px 28px;border-top:1px solid #f1e7de;color:#9ca3af;font-size:12px;line-height:1.5">
      This is an automated message — please don't reply to this email.<br/>
      riteangle · <a href="https://riteangle.dating" style="color:#ec4899;text-decoration:none">riteangle.dating</a>
    </div>
  </div>
</body>
</html>`;
}

// ── 1. Confirmation email (auto, on form submit) ──────────────────────────────

export function buildBetaConfirmationHtml(referrer: ReferrerCard): string {
  const name = (referrer.first_name ?? '').trim() || 'your match';
  const safeName = escapeHtml(name);

  return emailShell(`
    <div style="padding:28px 28px 8px">
      <h1 style="margin:0;font-size:22px;color:#111827">Thanks — you're in! 🎉</h1>
      <p style="margin:12px 0 0;font-size:15px;line-height:1.55;color:#374151">
        Thanks for dropping your email. You've been added to the riteangle beta list.
      </p>
      <p style="margin:16px 0 0;font-size:15px;line-height:1.55;color:#374151">
        Here's who you'll be matched with once you're set up:
      </p>
    </div>
    ${referrerCardHtml(referrer)}
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
    </div>`);
}

export async function sendBetaConfirmationEmail(toEmail: string, referrer: ReferrerCard): Promise<void> {
  const name = (referrer.first_name ?? '').trim() || 'your match';
  await sendEmail({
    to: toEmail,
    subject: `You're on the list — you'll be matched with ${name}`,
    html: buildBetaConfirmationHtml(referrer),
  });
}

// ── 2. Early-access email (manual, from admin) ────────────────────────────────

function storeButton(platform: Platform, url: string): string {
  const label = platform === 'ios' ? 'Join the beta on TestFlight' : 'Get it on Google Play';
  return `<a href="${escapeHtml(url)}"
      style="display:inline-block;background:#ec4899;color:#fff;text-decoration:none;
             font-size:16px;font-weight:700;padding:14px 28px;border-radius:12px">
      ${label} →
    </a>`;
}

export function buildEarlyAccessHtml(referrer: ReferrerCard, platform: Platform, storeUrl: string): string {
  const name = (referrer.first_name ?? '').trim() || 'your match';
  const safeName = escapeHtml(name);

  return emailShell(`
    <div style="padding:28px 28px 8px">
      <h1 style="margin:0;font-size:22px;color:#111827">Congratulations — you're in! 🎉</h1>
      <p style="margin:12px 0 0;font-size:15px;line-height:1.55;color:#374151">
        You've been accepted as an <strong>early access member</strong> of riteangle. Welcome!
      </p>
      <p style="margin:16px 0 0;font-size:15px;line-height:1.55;color:#374151">
        You've been matched with ${safeName} — she'll be waiting for you in the app:
      </p>
    </div>
    ${referrerCardHtml(referrer)}
    <div style="padding:8px 28px 28px">
      <h2 style="margin:16px 0 10px;font-size:15px;color:#111827">Get the app to meet ${safeName}</h2>
      <div style="text-align:center;margin:6px 0 10px">
        ${storeButton(platform, storeUrl)}
      </div>
      <p style="margin:16px 0 0;font-size:15px;line-height:1.55;color:#374151">
        See you inside.<br/>— The riteangle team
      </p>
    </div>`);
}

/**
 * Send the early-access invite. Throws on a bad/blank store link or a send
 * failure so the admin endpoint can report it (this email is admin-triggered,
 * not fire-and-forget).
 */
export async function sendEarlyAccessEmail(
  toEmail: string,
  referrer: ReferrerCard,
  platform: Platform
): Promise<void> {
  const storeUrl = storeUrlFor(platform);
  if (!storeUrl) {
    throw new Error(`No store link configured for platform "${platform}"`);
  }
  const name = (referrer.first_name ?? '').trim() || 'your match';
  await sendEmail({
    to: toEmail,
    subject: `You're accepted! Get the app to meet ${name} 🎉`,
    html: buildEarlyAccessHtml(referrer, platform, storeUrl),
  });
}
