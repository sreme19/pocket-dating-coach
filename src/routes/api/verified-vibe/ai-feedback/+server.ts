/**
 * POST /api/verified-vibe/ai-feedback
 *
 * Records thumbs-up / thumbs-down feedback on a proactive AI greeting.
 * On thumbs-down, optionally captures a reason chip and free-text note.
 *
 * Escalation logic:
 *   - 3 or more consecutive thumbs-down  → needs_review = true
 *   - reason chip is 'factually_off'     → needs_review = true
 *   - feedbackText contains any trigger  → needs_review = true
 *
 * After a successful insert, asynchronously asks Claude Haiku to
 * re-summarise ALL feedback for this user and writes the result back
 * into ai_assistant_context.feedback_summary for use in the next greeting.
 *
 * Auth: Bearer token (required)
 *
 * Body: { greetingId, rating, reasonChip?, feedbackText? }
 * Response: { ok: true, needsReview: boolean }
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { ANTHROPIC_API_KEY } from '$env/static/private';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';
import { getSupabase } from '$lib/server/supabase';

// ── Auth ─────────────────────────────────────────────────────────────────────

async function resolveUser(request: Request): Promise<{ userId: string; assistantType: 'wingman' | 'bestie' } | null> {
  const token = (request.headers.get('authorization') ?? '').replace('Bearer ', '').trim();
  if (!token) return null;
  try {
    const client = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user } } = await client.auth.getUser();
    if (!user) return null;

    const supabase = getSupabase();
    const { data: profile } = await supabase
      .from('verified_vibe_users')
      .select('gender')
      .eq('id', user.id)
      .maybeSingle();

    const assistantType: 'wingman' | 'bestie' = profile?.gender === 'woman' ? 'bestie' : 'wingman';
    return { userId: user.id, assistantType };
  } catch { return null; }
}

// ── Escalation check ─────────────────────────────────────────────────────────

const ESCALATION_KEYWORDS = [
  'creepy', 'offensive', 'wrong', 'inappropriate', 'harassment',
  'dangerous', 'harmful', 'privacy', 'stalking', 'threatening',
];

function requiresEscalation(opts: {
  reasonChip: string | null;
  feedbackText: string | null;
  consecutiveDownvotes: number;
}): boolean {
  if (opts.consecutiveDownvotes >= 3) return true;
  if (opts.reasonChip === 'factually_off') return true;
  if (opts.feedbackText) {
    const lower = opts.feedbackText.toLowerCase();
    if (ESCALATION_KEYWORDS.some(kw => lower.includes(kw))) return true;
  }
  return false;
}

// ── Count consecutive downvotes ──────────────────────────────────────────────

async function countConsecutiveDownvotes(userId: string, supabase: ReturnType<typeof getSupabase>): Promise<number> {
  const { data } = await (supabase as any)
    .from('ai_assistant_feedback')
    .select('rating')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10) as { data: { rating: number }[] | null };

  if (!data) return 0;
  let count = 0;
  for (const row of data) {
    if (row.rating === -1) count++;
    else break;
  }
  return count;
}

// ── Haiku feedback summariser ─────────────────────────────────────────────────

const SUMMARISER_SYSTEM = `You are an optimisation assistant for a dating-app AI advisor.
Summarise the user's feedback history into a compact (3–5 sentence) personalisation guide.
Focus on:
- What topics or styles they found helpful (thumbs-up)
- What they disliked (thumbs-down, reason chips, free-text notes)
- Any patterns in what resonates vs. what falls flat
Output plain prose only — no bullet points, no markdown, no headers.
Be specific and actionable so the AI advisor can use this as a live briefing.`;

interface FeedbackRow {
  rating: number;
  reason_chip: string | null;
  feedback_text: string | null;
  greeting_content: string | null;
  created_at: string;
}

async function summariseFeedback(userId: string, supabase: ReturnType<typeof getSupabase>): Promise<void> {
  if (!ANTHROPIC_API_KEY) return;

  // Fetch all feedback for this user (most recent 50)
  const { data: rows } = await (supabase as any)
    .from('ai_assistant_feedback')
    .select('rating, reason_chip, feedback_text, greeting_content, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50) as { data: FeedbackRow[] | null };

  if (!rows || rows.length === 0) return;

  const lines = (rows as FeedbackRow[]).map(r => {
    const ago  = Math.round((Date.now() - new Date(r.created_at).getTime()) / (1000 * 60 * 60 * 24));
    const vote = r.rating === 1 ? '👍' : '👎';
    const chip = r.reason_chip ? ` [${r.reason_chip}]` : '';
    const note = r.feedback_text ? ` — "${r.feedback_text}"` : '';
    const preview = r.greeting_content ? ` | message: "${r.greeting_content.slice(0, 80)}…"` : '';
    return `${vote}${chip}${note}${preview} (${ago}d ago)`;
  }).join('\n');

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 300,
        system: SUMMARISER_SYSTEM,
        messages: [{ role: 'user', content: `FEEDBACK HISTORY:\n${lines}\n\nWrite the personalisation guide now.` }],
      }),
    });

    if (!res.ok) return;
    const data = await res.json() as { content: { text: string }[] };
    const summary = data.content?.[0]?.text?.trim() ?? '';
    if (!summary) return;

    await (supabase as any)
      .from('ai_assistant_context')
      .update({ feedback_summary: summary, updated_at: new Date().toISOString() })
      .eq('user_id', userId);
  } catch {
    // Fail silently — non-critical optimisation path
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

const VALID_REASON_CHIPS = [
  'too_generic',
  'not_relevant',
  'wrong_tone',
  'factually_off',
  'other',
] as const;
type ReasonChip = typeof VALID_REASON_CHIPS[number];

export const POST: RequestHandler = async ({ request }) => {
  const resolved = await resolveUser(request);
  if (!resolved) return json({ error: 'Unauthorized' }, { status: 401 });

  const { userId, assistantType } = resolved;

  const body = await request.json().catch(() => ({})) as {
    greetingId?: string;
    rating?: number;          // +1 or -1
    reasonChip?: string;
    feedbackText?: string;
  };

  const { greetingId, rating, reasonChip, feedbackText } = body;

  if (!greetingId) return json({ error: 'greetingId is required' }, { status: 400 });
  if (rating !== 1 && rating !== -1) return json({ error: 'rating must be 1 or -1' }, { status: 400 });

  const validatedChip: ReasonChip | null =
    reasonChip && (VALID_REASON_CHIPS as readonly string[]).includes(reasonChip)
      ? (reasonChip as ReasonChip)
      : null;

  const supabase = getSupabase();

  const sb = supabase as any;

  // Verify the greeting belongs to this user
  const { data: greeting } = await sb
    .from('ai_assistant_greetings')
    .select('id, content')
    .eq('id', greetingId)
    .eq('user_id', userId)
    .maybeSingle() as { data: { id: string; content: string } | null };

  if (!greeting) return json({ error: 'Greeting not found' }, { status: 404 });

  // Count existing consecutive downvotes BEFORE this one
  const priorConsecutive = await countConsecutiveDownvotes(userId, supabase);
  const totalConsecutive = rating === -1 ? priorConsecutive + 1 : 0;

  const needsReview = requiresEscalation({
    reasonChip: validatedChip,
    feedbackText: feedbackText ?? null,
    consecutiveDownvotes: totalConsecutive,
  });

  // Insert feedback row
  const { error: insertErr } = await sb
    .from('ai_assistant_feedback')
    .insert({
      user_id:          userId,
      greeting_id:      greetingId,
      assistant_type:   assistantType,
      rating,
      reason_chip:      validatedChip,
      feedback_text:    feedbackText ? feedbackText.slice(0, 1000) : null,
      greeting_content: greeting.content?.slice(0, 500) ?? null,
      needs_review:     needsReview,
    }) as { error: { message: string } | null };

  if (insertErr) {
    console.error('[ai-feedback] insert error:', insertErr);
    return json({ error: 'Failed to save feedback' }, { status: 500 });
  }

  // Kick off Haiku re-summarisation in the background (non-blocking)
  summariseFeedback(userId, sb as any).catch(() => {});

  return json({ ok: true, needsReview });
};
