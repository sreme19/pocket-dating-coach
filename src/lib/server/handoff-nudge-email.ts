/**
 * handoff-nudge-email.ts — email fallback for the hand-off nudge ladder (spec B2).
 *
 * The nudge ladder was push + in-app only. A woman with no registered device token
 * (web-only, or she never granted notifications) therefore got NOTHING she could
 * see without opening the app — the stage-1/2/3 nudges landed in an in-app surface
 * she wasn't visiting, and `notifyWomanToStepIn` returns early with no token. Prod
 * case 2026-07-28: a man waited 24h+ at hand-off while both her nudges sat unseen
 * and the match ticked toward auto-expiry.
 *
 * So: when we cannot reach her by push, email her instead. Deliberately narrow —
 * only stages 2 and 3 (24h and ~45h), so at most two emails per match, and never
 * for the stage-1 nudge that fires within an hour of hand-off while she may well
 * still be in the app.
 *
 * Kill switch: HANDOFF_NUDGE_EMAIL=false.
 */

import { env } from '$env/dynamic/private';
import { sendEmail, escapeHtml } from './email';
import { PUBLIC_ORIGIN } from './beta-invite-email';
import { hoursLabel } from './handoff-clock';

/** Stages that may fall back to email. Stage 1 is too early to be worth an inbox. */
const EMAILABLE_STAGES = new Set([2, 3]);

export function handoffNudgeEmailEnabled(): boolean {
	return env.HANDOFF_NUDGE_EMAIL !== 'false';
}

export function buildHandoffNudgeEmail(args: {
	womanName: string;
	manName: string;
	stage: 2 | 3;
	hoursLeft: number;
}): { subject: string; html: string } {
	const { womanName, manName, stage, hoursLeft } = args;
	const man = escapeHtml(manName);
	const her = escapeHtml(womanName);
	const left = hoursLabel(hoursLeft);
	const final = stage === 3;

	const subject = final
		? `Last hours to step in with ${manName}`
		: `${manName} is waiting on you`;

	const lead = final
		? `Your AI bestie finished getting to know <strong>${man}</strong> for you, and he's been waiting.
			 There's only <strong>${left}</strong> left before this match closes and he's given someone new.`
		: `Your AI bestie finished getting to know <strong>${man}</strong> for you — he showed up on the
			 things you said matter. He's waiting on you now, and there's about <strong>${left}</strong> left
			 before he rolls to a new match.`;

	const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#fdf6f0;margin:0;padding:24px;color:#1f2937">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08)">
    <div style="padding:28px">
      <h1 style="margin:0;font-size:20px;color:#111827">${final ? `Last chance with ${man} ⏳` : `Your turn to step in ✨`}</h1>
      <p style="margin:14px 0 0;font-size:15px;line-height:1.6;color:#374151">Hey ${her},</p>
      <p style="margin:10px 0 0;font-size:15px;line-height:1.6;color:#374151">${lead}</p>
      <p style="margin:10px 0 0;font-size:15px;line-height:1.6;color:#374151">
        Nothing's lost if you'd rather not — the match just goes quiet and you can reopen it later.
      </p>
      <div style="text-align:center;margin:22px 0 4px">
        <a href="${PUBLIC_ORIGIN}/verified-vibe/chat"
           style="display:inline-block;background:#ec4899;color:#fff;text-decoration:none;
                  font-size:15px;font-weight:700;padding:13px 26px;border-radius:12px">
          Open the conversation →
        </a>
      </div>
      <p style="margin:20px 0 0;font-size:12px;line-height:1.5;color:#9ca3af">
        You're getting this because notifications aren't switched on for your device.
      </p>
    </div>
  </div>
</body>
</html>`;

	return { subject, html };
}

/**
 * Email her the nudge when push can't reach her. Non-fatal by contract: a mail
 * failure must never break the sweep. Returns whether an email was actually sent.
 */
export async function sendHandoffNudgeEmail(args: {
	to: string | null;
	womanName: string;
	manName: string;
	stage: number;
	hoursLeft: number;
}): Promise<boolean> {
	const { to, stage } = args;
	if (!to || !handoffNudgeEmailEnabled() || !EMAILABLE_STAGES.has(stage)) return false;
	try {
		const { subject, html } = buildHandoffNudgeEmail({
			womanName: args.womanName,
			manName: args.manName,
			stage: stage as 2 | 3,
			hoursLeft: args.hoursLeft
		});
		await sendEmail({ to, subject, html });
		return true;
	} catch (e) {
		console.warn('[handoff-timeout] nudge email failed (non-fatal):', e);
		return false;
	}
}
