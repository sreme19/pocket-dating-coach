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
 * The referrer card is OPTIONAL in both: signups from an admin recruiting link
 * have no referrer (and a referrer row can always fail to load). A missing card
 * must never block the email — we drop the card and swap in copy that promises
 * a match after setup instead of naming one.
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

/**
 * Everyone who gets a blind copy of each early-access invite, so the team has a
 * record of exactly what each tester was sent (including the referrer card and
 * the store link they actually got). BCC, not To — the invitee must never see
 * that a copy went anywhere, and this must not read as a group email.
 *
 * Confirmation emails are NOT copied: they fire automatically on every /beta
 * form submit and would flood the inbox. Only the manual invite is.
 */
const INVITE_BCC = ['chris@wardrobeofamonk.com'];

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

/** The woman's card — shared by both emails. Empty string when there's no referrer. */
function referrerCardHtml(referrer: ReferrerCard | null): string {
  if (!referrer) return '';

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

export function buildBetaConfirmationHtml(referrer: ReferrerCard | null): string {
  const name = (referrer?.first_name ?? '').trim() || 'your match';
  const safeName = escapeHtml(name);

  return emailShell(`
    <div style="padding:28px 28px 8px">
      <h1 style="margin:0;font-size:22px;color:#111827">Thanks — you're in! 🎉</h1>
      <p style="margin:12px 0 0;font-size:15px;line-height:1.55;color:#374151">
        Thanks for dropping your email. You've been added to the riteangle beta list.
      </p>
      <p style="margin:16px 0 0;font-size:15px;line-height:1.55;color:#374151">
        ${referrer ? "Here's who you'll be matched with once you're set up:" : 'We match on substance, not swipes — so the setup asks a little more of you, and gives back a lot more.'}
      </p>
    </div>
    ${referrerCardHtml(referrer)}
    <div style="padding:8px 28px 28px">
      <h2 style="margin:16px 0 6px;font-size:15px;color:#111827">What happens next?</h2>
      <p style="margin:0;font-size:15px;line-height:1.55;color:#374151">
        Our team is rolling out invites in batches. You'll get a follow-up email from us with your
        personal invite to sign up — ${
          referrer
            ? `once you complete a quick setup, you'll be matched with ${safeName} straight away.`
            : "once you complete a quick setup, we'll introduce you to someone worth meeting."
        }
      </p>
      <p style="margin:16px 0 0;font-size:15px;line-height:1.55;color:#374151">
        Sit tight — we'll be in touch soon.<br/>— The riteangle team
      </p>
    </div>`);
}

export async function sendBetaConfirmationEmail(
  toEmail: string,
  referrer: ReferrerCard | null
): Promise<void> {
  const name = (referrer?.first_name ?? '').trim() || 'your match';
  await sendEmail({
    to: toEmail,
    subject: referrer ? `You're on the list — you'll be matched with ${name}` : "You're on the riteangle beta list",
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

export function buildEarlyAccessHtml(
  referrer: ReferrerCard | null,
  platform: Platform,
  storeUrl: string
): string {
  const name = (referrer?.first_name ?? '').trim() || 'your match';
  const safeName = escapeHtml(name);

  return emailShell(`
    <div style="padding:28px 28px 8px">
      <h1 style="margin:0;font-size:22px;color:#111827">Congratulations — you're in! 🎉</h1>
      <p style="margin:12px 0 0;font-size:15px;line-height:1.55;color:#374151">
        You've been accepted as an <strong>early access member</strong> of riteangle. Welcome!
      </p>
      <p style="margin:16px 0 0;font-size:15px;line-height:1.55;color:#374151">
        ${
          referrer
            ? `You've been matched with ${safeName} — she'll be waiting for you in the app:`
            : 'Set up your profile and we&rsquo;ll introduce you to someone worth meeting — real people, properly verified.'
        }
      </p>
    </div>
    ${referrerCardHtml(referrer)}
    <div style="padding:8px 28px 28px">
      <h2 style="margin:16px 0 10px;font-size:15px;color:#111827">
        ${referrer ? `Get the app to meet ${safeName}` : 'Get the app to get started'}
      </h2>
      <div style="text-align:center;margin:6px 0 10px">
        ${storeButton(platform, storeUrl)}
      </div>
      <p style="margin:16px 0 0;font-size:15px;line-height:1.55;color:#374151">
        See you inside.<br/>— The riteangle team
      </p>
    </div>`);
}

// ── 3. Hand-copied invite (for pasting into WhatsApp) ─────────────────────────

/**
 * Canonical public origin for links we hand to a human to paste. Hardcoded
 * rather than taken from the request, because an admin might be working on a
 * preview deployment and a tester must never receive a dev.riteangle URL.
 */
export const PUBLIC_ORIGIN = 'https://www.riteangle.dating';

/** The web twin of this email: /beta/{token}/app, device baked into ?d=. */
export function inviteUrlFor(token: string, platform: Platform): string {
  return `${PUBLIC_ORIGIN}/beta/${encodeURIComponent(token)}/app?d=${platform}`;
}

/**
 * The same invite as a message a human can paste into WhatsApp, now that the
 * /beta form collects a number. Returns BOTH clipboard flavours:
 *
 *   text — what WhatsApp (and every plain composer) will actually take.
 *   html — the same thing with her card rendered inline, for a rich composer
 *          (Gmail, WhatsApp Desktop, Notion).
 *
 * ONE link, and it's a riteangle URL. An earlier version pasted her raw Supabase
 * storage URL to win the photo preview plus the bare store URL — two long ugly
 * links in a message meant to feel personal. /beta/{token}/app carries the photo
 * itself via og:image and puts the store button on the page, so the message needs
 * exactly one short link and the preview still shows her.
 *
 * The link goes LAST: WhatsApp renders the preview card above the bubble text
 * wherever the URL sits, so trailing it means the message opens on words rather
 * than on a URL.
 *
 * Both flavours are built here rather than in the admin component so they reuse
 * the card, the store links and escapeHtml — one definition of the invite, not
 * two that drift. The caller is responsible for suppressing `referrer` on a
 * private link, exactly as the email paths do.
 */
export function buildWhatsappInvite(
  referrer: ReferrerCard | null,
  platform: Platform,
  inviteUrl: string
): { text: string; html: string } {
  const name = (referrer?.first_name ?? '').trim();

  // Her name, age and city on one line — the same summary the card shows.
  const bits = [name, referrer?.age ? `${referrer.age}` : '', referrer?.city ?? '']
    .map((b) => b.trim())
    .filter(Boolean);
  const summary = bits.join(' · ');

  const lines: string[] = [];
  lines.push("Congratulations — you're in! 🎉");
  lines.push('');
  lines.push("You've been accepted as an early access member of riteangle.");
  lines.push('');
  if (name) {
    lines.push(`You've been matched with ${summary || name} — she'll be waiting for you in the app.`);
  } else {
    lines.push(
      'Set up your profile and we’ll introduce you to someone worth meeting — real people, properly verified.'
    );
  }
  lines.push('');
  lines.push('Tap to get the app:');
  lines.push(inviteUrl);
  lines.push('');
  lines.push('See you inside — the riteangle team');

  const text = lines.join('\n');

  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1f2937;font-size:15px;line-height:1.55">
      <p style="margin:0 0 10px"><strong>Congratulations — you're in! 🎉</strong></p>
      <p style="margin:0 0 10px">You've been accepted as an <strong>early access member</strong> of riteangle.</p>
      <p style="margin:0 0 10px">${
        name
          ? `You've been matched with ${escapeHtml(name)} — she'll be waiting for you in the app:`
          : 'Set up your profile and we&rsquo;ll introduce you to someone worth meeting — real people, properly verified.'
      }</p>
      ${referrerCardHtml(referrer)}
      <p style="margin:10px 0 0">Tap to get the app:<br/>
        <a href="${escapeHtml(inviteUrl)}">${escapeHtml(inviteUrl)}</a></p>
      <p style="margin:10px 0 0">See you inside — the riteangle team</p>
    </div>`;

  return { text, html };
}

/**
 * Send the early-access invite. Throws on a bad/blank store link or a send
 * failure so the admin endpoint can report it (this email is admin-triggered,
 * not fire-and-forget).
 */
export async function sendEarlyAccessEmail(
  toEmail: string,
  referrer: ReferrerCard | null,
  platform: Platform
): Promise<void> {
  const storeUrl = storeUrlFor(platform);
  if (!storeUrl) {
    throw new Error(`No store link configured for platform "${platform}"`);
  }
  const name = (referrer?.first_name ?? '').trim() || 'your match';
  await sendEmail({
    to: toEmail,
    bcc: INVITE_BCC,
    subject: referrer
      ? `You're accepted! Get the app to meet ${name} 🎉`
      : "You're accepted! Get early access to riteangle 🎉",
    html: buildEarlyAccessHtml(referrer, platform, storeUrl),
  });
}
