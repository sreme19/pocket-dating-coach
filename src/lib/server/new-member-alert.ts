/**
 * "A new member joined" email alert.
 *
 * Mirrors the USERS list in /admin/analytics: a join is a fresh row in
 * verified_vibe_users that the admin table would render with Type = real.
 *
 * Why a sweep and not an inline hook: that row is written by the browser/app
 * itself (profileService.upsertProfile, anon key) rather than by any of our
 * server routes, so there is no request we could hang a send off. This runs on
 * a cron instead and reconciles what it finds against what it has already
 * announced.
 *
 * Idempotency: each announced member gets an `admin_new_member_notified` row in
 * verified_vibe_analytics. The marker is written BEFORE the send and deleted
 * again if Resend fails, so a failed run retries next tick instead of either
 * going silent or mailing the same member every 5 minutes.
 *
 * First run is a baseline: if no marker exists at all, every current candidate
 * is marked and NOTHING is sent — otherwise switching this on would blast an
 * email for each of the members who already joined this week.
 */

import { getSupabase } from './supabase';
import { sendEmail, escapeHtml } from './email';
// One definition of the team address and the public origin, shared with the
// beta emails — these alerts land in the same inbox.
import { TEAM_INBOX, PUBLIC_ORIGIN } from './beta-invite-email';

const NOTIFIED_EVENT = 'admin_new_member_notified';

/** How far back a run looks. Wide enough to recover from a few failed runs. */
const LOOKBACK_HOURS = 48;

/** Ceiling per run, so a seeding/import burst can't turn into 200 emails. */
const MAX_PER_RUN = 20;

export interface NewMember {
  id: string;
  /** Profile name, empty on a row saved before the name step. */
  name: string | null;
  /** Auth email — absent if the auth lookup fails. */
  email: string | null;
  age: number | null;
  city: string | null;
  gender: string | null;
  archetype: string | null;
  joinedAt: string;
}

export interface NewMemberAlertReport {
  /** Real (non-seed) members inside the lookback window. */
  candidates: number;
  /** Alerts actually emailed. */
  sent: number;
  /** Sends that failed — marker released, will retry next run. */
  failed: number;
  /** Fresh members held back by MAX_PER_RUN for the next run. */
  deferred: number;
  /** True when this run only recorded a baseline and deliberately sent nothing. */
  baseline: boolean;
}

interface MemberRow {
  id: string;
  first_name: string | null;
  age: number | null;
  city: string | null;
  gender: string | null;
  archetype: string | null;
  created_at: string;
  is_seed: boolean | null;
}

/**
 * Seed profiles must never trigger an alert. Matches how /admin/analytics
 * labels the Type column: a null is_seed counts as seed, only an explicit
 * false is a real signup (upsertProfile sets is_seed: false).
 */
export function isRealMember(row: { is_seed?: boolean | null }): boolean {
  return (row.is_seed ?? true) === false;
}

function toMember(row: MemberRow, email: string | null): NewMember {
  return {
    id: row.id,
    name: row.first_name,
    email,
    age: row.age,
    city: row.city,
    gender: row.gender,
    archetype: row.archetype,
    joinedAt: row.created_at,
  };
}

/** e.g. "28 Jul 2026, 7:42 pm IST" — the team reads these in India time. */
export function formatJoinedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const stamp = d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  });
  return `${stamp} IST`;
}

/** "Missi, 19 · Rudrapur" — whatever of it exists on a minutes-old profile. */
export function memberHeadline(m: NewMember): string {
  const name = (m.name ?? '').trim() || 'New member';
  const nameAge = m.age ? `${name}, ${m.age}` : name;
  const city = (m.city ?? '').trim();
  return city ? `${nameAge} · ${city}` : nameAge;
}

/**
 * Where "Open their profile" goes: the real member-facing profile, previewed as
 * the gender that would actually see it — the same link the admin Users table
 * builds. The raw /admin/users/[id] record page is a debugging view; the team
 * wants to see what the member looks like to the other side of the app.
 *
 * Gender is often still unset seconds after signup, so an unknown gender
 * previews as a man, matching /admin/analytics rather than dropping the `as`
 * param (the profile page needs a viewer gender to pick a photo set).
 */
export function memberProfilePath(m: Pick<NewMember, 'id' | 'gender'>): string {
  const viewer = (m.gender ?? '').trim().toLowerCase() === 'man' ? 'woman' : 'man';
  return `/verified-vibe/profile/${encodeURIComponent(m.id)}?adminPreview=1&as=${viewer}`;
}

function alertRow(label: string, value: string): string {
  return `<tr>
      <td style="padding:4px 16px 4px 0;color:#6b7280;font-size:14px;white-space:nowrap">${label}</td>
      <td style="padding:4px 0;font-size:15px;color:#111827">${value}</td>
    </tr>`;
}

export function buildNewMemberAlertHtml(m: NewMember, total: number | null): string {
  const missing = '<span style="color:#9ca3af">not set yet</span>';
  const field = (v: string | null | undefined) => {
    const t = (v ?? '').toString().trim();
    return t ? escapeHtml(t) : missing;
  };
  // escapeHtml so the two-param query string carries a literal `&amp;` — a bare
  // `&` in an href is the classic way an email client eats the second param.
  const userUrl = escapeHtml(`${PUBLIC_ORIGIN}${memberProfilePath(m)}`);
  const listUrl = `${PUBLIC_ORIGIN}/admin/analytics`;
  const footer = m.email
    ? 'Automatic alert for the riteangle team · replies go to the new member.'
    : "Automatic alert for the riteangle team · this member has no email on file, so replies aren't routed anywhere.";

  // Most alerts fire seconds after the OTP, so half the profile is usually still
  // empty. Explain that only when something IS empty — on a filled-in profile
  // the sentence just reads as noise.
  const incomplete = [m.name, m.email, m.age, m.city, m.gender, m.archetype].some(
    (v) => !(v ?? '').toString().trim()
  );
  const blanksNote = incomplete
    ? " Fields marked <em>not set yet</em> just mean they haven't reached that onboarding step."
    : '';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#fdf6f0;margin:0;padding:24px;color:#1f2937">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08)">
    <div style="padding:28px 28px 4px">
      <h1 style="margin:0;font-size:20px;color:#111827">New member joined 🎉</h1>
      <p style="margin:12px 0 0;font-size:15px;line-height:1.55;color:#374151">
        <strong>${escapeHtml(memberHeadline(m))}</strong> just signed up${
          total ? ` — that's member <strong>#${total}</strong>` : ''
        }.${blanksNote}
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:18px 0 0">
        ${alertRow('Name', field(m.name))}
        ${alertRow('Email', m.email ? `<strong>${escapeHtml(m.email)}</strong>` : missing)}
        ${alertRow('Age', m.age ? String(m.age) : missing)}
        ${alertRow('City', field(m.city))}
        ${alertRow('Gender', field(m.gender))}
        ${alertRow('Archetype', field(m.archetype))}
        ${alertRow('Joined', escapeHtml(formatJoinedAt(m.joinedAt)))}
      </table>
    </div>
    <div style="padding:8px 28px 28px">
      <div style="text-align:center;margin:14px 0 6px">
        <a href="${userUrl}"
           style="display:inline-block;background:#ec4899;color:#fff;text-decoration:none;
                  font-size:15px;font-weight:700;padding:13px 26px;border-radius:12px">
          Open their profile →
        </a>
      </div>
      <p style="margin:14px 0 0;text-align:center;font-size:13px;color:#6b7280">
        <a href="${listUrl}" style="color:#ec4899">See all members</a>
      </p>
    </div>
    <div style="padding:16px 28px;border-top:1px solid #f3e4d9;color:#9ca3af;font-size:12px;line-height:1.5">
      ${footer}
    </div>
  </div>
</body>
</html>`;
}

export function newMemberSubject(m: NewMember, total: number | null): string {
  const suffix = total ? ` (#${total})` : '';
  return `New member joined — ${memberHeadline(m)}${suffix}`;
}

/**
 * Mail one join to the team. Replies go to the member when we know their
 * address, so the team can reach out straight from the alert.
 */
export async function sendNewMemberAlert(m: NewMember, total: number | null): Promise<void> {
  await sendEmail({
    to: TEAM_INBOX,
    subject: newMemberSubject(m, total),
    html: buildNewMemberAlertHtml(m, total),
    ...(m.email ? { replyTo: m.email } : {}),
  });
}

/** Total real members on the platform — the "#44" in the subject. Best-effort. */
async function countMembers(db: any): Promise<number | null> {
  const { count, error } = await db
    .from('verified_vibe_users')
    .select('count', { count: 'exact', head: true })
    .is('deleted_at', null)
    .eq('is_seed', false);
  return error ? null : (count ?? null);
}

/**
 * Emails live in Supabase Auth, not on verified_vibe_users. The bulk
 * admin.listUsers endpoint 500s on this project (see /admin/analytics), so
 * resolve ids one at a time — the batches here are tiny.
 */
async function emailFor(db: any, id: string): Promise<string | null> {
  try {
    const { data } = await db.auth.admin.getUserById(id);
    return data?.user?.email ?? null;
  } catch (err: any) {
    console.warn(`[new-member-alert] email lookup failed for ${id}:`, err?.message ?? err);
    return null;
  }
}

/** Claim a member so a concurrent/next run won't mail them twice. Returns the marker id. */
async function claim(db: any, m: NewMember): Promise<string | null> {
  const { data, error } = await db
    .from('verified_vibe_analytics')
    .insert({
      user_id: m.id,
      event_type: NOTIFIED_EVENT,
      metadata: { email: m.email, name: m.name, joined_at: m.joinedAt },
    })
    .select('id')
    .single();
  if (error) {
    console.warn(`[new-member-alert] could not claim ${m.id}:`, error.message ?? error);
    return null;
  }
  return data?.id ?? null;
}

async function release(db: any, markerId: string): Promise<void> {
  const { error } = await db.from('verified_vibe_analytics').delete().eq('id', markerId);
  if (error) {
    // Worst case the member is never announced — loud, because it's silent otherwise.
    console.error(`[new-member-alert] marker ${markerId} stuck after a failed send:`, error.message ?? error);
  }
}

/**
 * One reconciliation pass. Idempotent — safe to re-run at any frequency.
 */
export async function runNewMemberAlert(): Promise<NewMemberAlertReport> {
  const db = getSupabase() as any;
  const empty: NewMemberAlertReport = { candidates: 0, sent: 0, failed: 0, deferred: 0, baseline: false };

  const since = new Date(Date.now() - LOOKBACK_HOURS * 3600_000).toISOString();
  const { data: rows, error } = await db
    .from('verified_vibe_users')
    .select('id, first_name, age, city, gender, archetype, created_at, is_seed')
    .gte('created_at', since)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(200);
  if (error) throw new Error(error.message ?? String(error));

  const candidates = ((rows ?? []) as MemberRow[]).filter(isRealMember);
  if (candidates.length === 0) return empty;

  const { data: marks, error: markErr } = await db
    .from('verified_vibe_analytics')
    .select('user_id')
    .eq('event_type', NOTIFIED_EVENT)
    .in('user_id', candidates.map((c) => c.id));
  if (markErr) throw new Error(markErr.message ?? String(markErr));

  const notified = new Set(((marks ?? []) as { user_id: string }[]).map((m) => m.user_id));
  const fresh = candidates.filter((c) => !notified.has(c.id));
  if (fresh.length === 0) return { ...empty, candidates: candidates.length };

  // Baseline: nothing has ever been announced, so this is the switch-on run.
  // Record everyone and stay quiet rather than mailing the existing backlog.
  const { count: everNotified } = await db
    .from('verified_vibe_analytics')
    .select('count', { count: 'exact', head: true })
    .eq('event_type', NOTIFIED_EVENT);
  if (!everNotified) {
    for (const row of fresh) await claim(db, toMember(row, null));
    console.log(`[new-member-alert] baseline run — marked ${fresh.length} existing member(s), sent nothing`);
    return { candidates: candidates.length, sent: 0, failed: 0, deferred: 0, baseline: true };
  }

  const batch = fresh.slice(0, MAX_PER_RUN);
  const deferred = fresh.length - batch.length;
  if (deferred > 0) {
    console.log(`[new-member-alert] ${deferred} member(s) deferred to the next run (cap ${MAX_PER_RUN})`);
  }

  const total = await countMembers(db);
  let sent = 0;
  let failed = 0;

  for (const row of batch) {
    const member = toMember(row, await emailFor(db, row.id));
    const markerId = await claim(db, member);
    if (!markerId) {
      failed++;
      continue; // Un-claimed: retried next run rather than risking a duplicate.
    }
    try {
      await sendNewMemberAlert(member, total);
      sent++;
    } catch (err: any) {
      console.error(`[new-member-alert] send failed for ${row.id}:`, err?.message ?? err);
      await release(db, markerId);
      failed++;
    }
  }

  console.log(`[new-member-alert] candidates=${candidates.length} sent=${sent} failed=${failed} deferred=${deferred}`);
  return { candidates: candidates.length, sent, failed, deferred, baseline: false };
}
