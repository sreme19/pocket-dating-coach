/**
 * POST /api/verified-vibe/report-issue
 *
 * The in-app "Report issue" button. Emails the team AND writes a durable row (see
 * $lib/server/issue-report for why both). This is the human backstop behind the
 * automated photo content screen, which deliberately errs toward publishing.
 *
 * Distinct from /report-user: that one is "I am reporting this person" and feeds
 * moderation of an account. This one is "something on my screen is wrong" and may
 * have no subject at all.
 *
 * Body (JSON):
 *   category    'nudity' | 'disturbing' | 'wrong_person' | 'bug' | 'other'  (required)
 *   description string   (optional, capped)
 *   surface     string   (optional — where they were, e.g. 'discover')
 *   subjectUserId string (optional — the profile being viewed)
 *   subjectUrl  string   (optional — the specific image complained about)
 *   context     object   (optional — small bag of client detail)
 *
 * Auth: Bearer token optional. A signed-out report is still worth having; it is
 * recorded with a null reporter rather than refused.
 *
 * Returns 200 whenever ANY channel captured the report, 502 only if both failed.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import {
  recordIssueReport,
  isIssueCategory,
  MAX_DESCRIPTION,
  MAX_SURFACE,
  MAX_URL,
} from '$lib/server/issue-report';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const cap = (v: unknown, max: number): string =>
  typeof v === 'string' ? v.trim().slice(0, max) : '';

export const POST: RequestHandler = async ({ request }) => {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!isIssueCategory(body?.category)) {
    return json({ error: 'category is required and must be a known issue type' }, { status: 400 });
  }

  // Signed-out reports are accepted — we would rather hear about a bad photo from
  // someone whose session expired than not hear about it.
  let reporterId: string | null = null;
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const authClient = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);
      const { data } = await authClient.auth.getUser(authHeader.replace('Bearer ', ''));
      reporterId = data?.user?.id ?? null;
    } catch {
      // Bad/expired token — treat as signed out rather than dropping the report.
    }
  }

  // Only accept a UUID as the subject: this value is rendered into an admin link,
  // so it must not be arbitrary client text.
  const rawSubject = cap(body.subjectUserId, 64);
  const subjectUserId = UUID_RE.test(rawSubject) ? rawSubject : null;

  // Same for the URL — the email links it, so keep it to our own http(s) origins
  // and never a data:/javascript: payload.
  const rawUrl = cap(body.subjectUrl, MAX_URL);
  const subjectUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : '';

  const context =
    body.context && typeof body.context === 'object' && !Array.isArray(body.context)
      ? // Cap the bag so a client can't post an unbounded blob into the row.
        Object.fromEntries(
          Object.entries(body.context)
            .slice(0, 12)
            .map(([k, v]) => [k.slice(0, 40), typeof v === 'string' ? v.slice(0, 200) : v])
        )
      : {};

  const { reportId, emailSent } = await recordIssueReport({
    reporterId,
    category: body.category,
    surface: cap(body.surface, MAX_SURFACE),
    description: cap(body.description, MAX_DESCRIPTION),
    subjectUserId,
    subjectUrl,
    context,
  });

  if (!reportId && !emailSent) {
    return json(
      { error: "We couldn't submit that report. Please try again in a moment." },
      { status: 502 }
    );
  }

  return json({
    data: {
      success: true,
      reportId,
      message: 'Thanks — we got it. Someone on our team reviews every report, and we act on anything that breaks our rules.',
    },
  });
};
