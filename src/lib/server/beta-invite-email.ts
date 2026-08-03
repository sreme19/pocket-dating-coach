/**
 * Beta-invite emails.
 *
 *  1. Confirmation — sent automatically when someone submits their email on
 *     /beta/{token}. Since open testing (2026-08-03) this IS the invite: it
 *     shows the woman's card and hands over both store links straight away.
 *     It used to promise that a personal invite would follow once an admin
 *     added the address as a tester; that step no longer exists, so promising
 *     it would leave people waiting for mail nobody is going to send.
 *  2. Early access — the same congratulations, sent by hand from the Beta
 *     Invites admin. Now a RE-SEND rather than the gate: everyone already got
 *     their links at signup, and this is for someone who lost the mail.
 *  3. New-signup alert — sent to the team (not the invitee) the moment a new row
 *     lands in the Collected emails list, so a referral shows up without anyone
 *     polling the admin tab. See section 4 below.
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
import { STORE_LINKS, storeChoices, storeUrlFor, type Platform } from '$lib/store-links';

export interface ReferrerCard {
  first_name: string | null;
  age: number | null;
  city: string | null;
  avatar_url: string | null;
  about: string | null;
}

/**
 * The store links live in $lib/store-links (client-safe, so the Svelte invite
 * pages share them). Re-exported here because the admin endpoints and the
 * /beta/{token}/app loader have always imported them from this module.
 */
export { STORE_LINKS, storeUrlFor };
export type { Platform };

/**
 * Everyone who gets a blind copy of each early-access invite, so the team has a
 * record of exactly what each tester was sent (including the referrer card and
 * the store link they actually got). BCC, not To — the invitee must never see
 * that a copy went anywhere, and this must not read as a group email.
 *
 * Confirmation emails are NOT copied: they fire automatically on every /beta
 * form submit and would flood the inbox. Only the manual invite is.
 */
/** Where team-facing beta mail goes — invite copies and new-signup alerts. */
export const TEAM_INBOX = 'chris@wardrobeofamonk.com';

const INVITE_BCC = [TEAM_INBOX];

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

const NO_REPLY_NOTE = "This is an automated message — please don't reply to this email.";

/**
 * Full HTML document shell — shared container + footer.
 *
 * `footerNote` defaults to the no-reply line the invitee-facing emails need. The
 * team alert overrides it: that one IS replyable (reply-to is the signup), so
 * telling the reader not to reply would be a lie.
 */
function emailShell(innerHtml: string, footerNote: string = NO_REPLY_NOTE): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#fdf6f0;margin:0;padding:24px;color:#1f2937">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08)">
    ${innerHtml}
    <div style="padding:14px 28px;border-top:1px solid #f1e7de;color:#9ca3af;font-size:12px;line-height:1.5">
      ${footerNote}<br/>
      riteangle · <a href="https://riteangle.dating" style="color:#ec4899;text-decoration:none">riteangle.dating</a>
    </div>
  </div>
</body>
</html>`;
}

// ── Store buttons (shared by both invitee-facing emails) ──────────────────────

/**
 * Both stores as buttons, with the device we believe they're on first.
 *
 * BOTH, always. An email is opened on a device this code never sees, and unlike
 * a web page it cannot re-detect anything — so a platform we got wrong (a
 * mis-tapped dropdown, a `platform` column captured weeks earlier) used to be a
 * dead end. The likely one leads and is the filled button; the other sits below
 * it as an outline, so the ordering still carries the guess.
 *
 * `primaryUrl` overrides the first button's href for callers that were handed a
 * specific link they already validated (sendEarlyAccessEmail).
 */
function storeButtonsHtml(platform: Platform | null, primaryUrl?: string): string {
  const [first, second] = storeChoices(platform);
  return `<div style="text-align:center;margin:6px 0 0">
      <a href="${escapeHtml(primaryUrl || first.url)}"
        style="display:inline-block;background:#ec4899;color:#fff;text-decoration:none;
               font-size:16px;font-weight:700;padding:14px 28px;border-radius:12px">
        ${first.label} →
      </a>
    </div>
    <div style="text-align:center;margin:10px 0 0">
      <a href="${escapeHtml(second.url)}"
        style="display:inline-block;background:#fff;color:#ec4899;text-decoration:none;
               border:1px solid #f9c0dc;font-size:15px;font-weight:700;
               padding:12px 24px;border-radius:12px">
        ${second.label} →
      </a>
    </div>`;
}

// ── 1. Confirmation email (auto, on form submit) ──────────────────────────────

/**
 * `platform` is what they picked on the form — an ordering hint for the buttons,
 * nothing more. Optional so the older two-argument call sites keep compiling;
 * a null just puts Android first.
 */
export function buildBetaConfirmationHtml(
  referrer: ReferrerCard | null,
  platform: Platform | null = null
): string {
  const name = (referrer?.first_name ?? '').trim() || 'your match';
  const safeName = escapeHtml(name);

  return emailShell(`
    <div style="padding:28px 28px 8px">
      <h1 style="margin:0;font-size:22px;color:#111827">You're in — get the app 🎉</h1>
      <p style="margin:12px 0 0;font-size:15px;line-height:1.55;color:#374151">
        Thanks for dropping your email. Your riteangle invite is live right now — nothing to wait
        for, no second email to watch out for.
      </p>
      <p style="margin:16px 0 0;font-size:15px;line-height:1.55;color:#374151">
        ${referrer ? "Here's who you'll be matched with once you're set up:" : 'We match on substance, not swipes — so the setup asks a little more of you, and gives back a lot more.'}
      </p>
    </div>
    ${referrerCardHtml(referrer)}
    <div style="padding:8px 28px 28px">
      <h2 style="margin:16px 0 10px;font-size:15px;color:#111827">Download riteangle</h2>
      ${storeButtonsHtml(platform)}
      <h2 style="margin:22px 0 6px;font-size:15px;color:#111827">What happens next?</h2>
      <p style="margin:0;font-size:15px;line-height:1.55;color:#374151">
        Install the app, sign in with <strong>this same email address</strong>, and finish a short
        setup — ${
          referrer
            ? `then you'll be matched with ${safeName} straight away.`
            : "then we'll introduce you to someone worth meeting."
        }
      </p>
      <p style="margin:16px 0 0;font-size:15px;line-height:1.55;color:#374151">
        See you inside.<br/>— The riteangle team
      </p>
    </div>`);
}

export async function sendBetaConfirmationEmail(
  toEmail: string,
  referrer: ReferrerCard | null,
  platform: Platform | null = null
): Promise<void> {
  const name = (referrer?.first_name ?? '').trim() || 'your match';
  await sendEmail({
    to: toEmail,
    subject: referrer
      ? `You're in — get the app and meet ${name}`
      : "You're in — get the riteangle app",
    html: buildBetaConfirmationHtml(referrer, platform),
  });
}

// ── 2. Early-access email (manual re-send, from admin) ─────────────────────────

/**
 * `platform` is an ordering hint and may be null (a signup collected before
 * device capture). `storeUrl` overrides the leading button for callers that
 * validated a link first; both stores are rendered either way.
 */
export function buildEarlyAccessHtml(
  referrer: ReferrerCard | null,
  platform: Platform | null,
  storeUrl?: string
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
      ${storeButtonsHtml(platform, storeUrl)}
      <p style="margin:20px 0 0;font-size:15px;line-height:1.55;color:#374151">
        Sign in with <strong>this same email address</strong> so we can connect you to your invite.
      </p>
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

/**
 * The web twin of this email: /beta/{token}/app, device baked into ?d= when we
 * know it. Without a device the page sniffs the User-Agent and offers both
 * stores anyway, so a device-less signup still gets a working link.
 */
export function inviteUrlFor(token: string, platform: Platform | null): string {
  const base = `${PUBLIC_ORIGIN}/beta/${encodeURIComponent(token)}/app`;
  return platform ? `${base}?d=${platform}` : base;
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
  platform: Platform | null,
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
 * Send the early-access invite. Throws on a send failure so the admin endpoint
 * can report it (this email is admin-triggered, not fire-and-forget).
 *
 * A null `platform` is fine — the email carries both stores and the platform
 * only orders them. It used to be a hard requirement, which meant a signup
 * collected before device capture could not be invited at all.
 */
export async function sendEarlyAccessEmail(
  toEmail: string,
  referrer: ReferrerCard | null,
  platform: Platform | null
): Promise<void> {
  const storeUrl = platform ? storeUrlFor(platform) : undefined;
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

// ── 4. New-signup alert (internal, to the team) ───────────────────────────────

/**
 * One new row in the Collected emails list, as the team needs to read it. The
 * fields mirror the admin table's columns so the alert and the tab agree.
 *
 * Since open testing this is FYI, not a to-do: the signup already has both store
 * links from their confirmation. It still goes out because a referral landing is
 * worth knowing about, and because the team follows people up on WhatsApp.
 *
 * `whatsapp` is the already-formatted number ('' when none is on file) and
 * `referrerName` is null for an admin recruiting link — the same "Admin" case
 * the tab shows. This is a TEAM email, so unlike the invitee-facing paths a
 * private link does NOT suppress the referrer: the admin tab already names her,
 * and an alert that hid who drove the signup would be useless for follow-up.
 */
export interface NewSignupAlert {
  email: string;
  whatsapp: string;
  platform: Platform | null;
  referrerName: string | null;
  linkLabel: string;
  mood: string | null;
  /** Position in the list (1-based), when we could count it. */
  total: number | null;
}

const DEVICE_LABEL: Record<Platform, string> = { ios: 'iOS', android: 'Android' };

function alertRow(label: string, value: string): string {
  return `<tr>
      <td style="padding:4px 16px 4px 0;color:#6b7280;font-size:14px;white-space:nowrap">${label}</td>
      <td style="padding:4px 0;font-size:15px;color:#111827">${value}</td>
    </tr>`;
}

export function buildNewSignupAlertHtml(signup: NewSignupAlert): string {
  const missing = '<span style="color:#9ca3af">not provided</span>';
  const referrer = signup.referrerName ? escapeHtml(signup.referrerName) : 'Admin link';
  const adminUrl = `${PUBLIC_ORIGIN}/admin/beta`;

  return emailShell(`
    <div style="padding:28px 28px 4px">
      <h1 style="margin:0;font-size:20px;color:#111827">New beta signup 📥</h1>
      <p style="margin:12px 0 0;font-size:15px;line-height:1.55;color:#374151">
        Someone just left their email on a /beta link${
          signup.total ? ` — that's <strong>#${signup.total}</strong> on the list` : ''
        }. Open testing, so nothing is blocking them: the confirmation already carried both store
        links. This is for the record and for follow-up.
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:18px 0 0">
        ${alertRow('Email', `<strong>${escapeHtml(signup.email)}</strong>`)}
        ${alertRow('WhatsApp', signup.whatsapp ? escapeHtml(signup.whatsapp) : missing)}
        ${alertRow('Device', signup.platform ? DEVICE_LABEL[signup.platform] : missing)}
        ${alertRow('Referred by', referrer)}
        ${alertRow('Link', escapeHtml(signup.linkLabel))}
        ${signup.mood ? alertRow('Looking for', escapeHtml(signup.mood)) : ''}
      </table>
    </div>
    <div style="padding:8px 28px 28px">
      <div style="text-align:center;margin:14px 0 6px">
        <a href="${adminUrl}"
           style="display:inline-block;background:#ec4899;color:#fff;text-decoration:none;
                  font-size:15px;font-weight:700;padding:13px 26px;border-radius:12px">
          Open Beta Invites →
        </a>
      </div>
    </div>`,
    'Automatic alert for the riteangle team · replies go to the signup.');
}

/**
 * Alert the team about a brand-new signup. Fire-and-forget from the caller's
 * point of view: throws are the caller's to swallow, because a Resend failure
 * must never fail the person's signup (the row is already saved, and the admin
 * tab remains the source of truth).
 *
 * Replies go to the signup itself, so the team can answer the person directly
 * from the alert.
 */
export async function sendNewSignupAlert(signup: NewSignupAlert): Promise<void> {
  const via = signup.referrerName ? `via ${signup.referrerName}` : 'via admin link';
  await sendEmail({
    to: TEAM_INBOX,
    subject: `New beta signup — ${signup.email} (${via})`,
    html: buildNewSignupAlertHtml(signup),
    replyTo: signup.email,
  });
}
