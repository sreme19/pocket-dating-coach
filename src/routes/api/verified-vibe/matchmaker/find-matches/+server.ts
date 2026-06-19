/**
 * GET  /api/verified-vibe/matchmaker/find-matches
 *   Returns the current user's eligibility + remaining quota so the chat-page
 *   button can render its state. No AI, no charge.
 *   → { eligible, runsUsed, runsLimit }
 *
 * POST /api/verified-vibe/matchmaker/find-matches
 *   Runs the on-demand matchmaker for the current user only: scores them against
 *   the opposite-gender active pool and creates a match with the single highest-
 *   compatibility candidate (>= threshold). Consumes one lifetime run per press.
 *   → FindMatchResult (status: needs_verification | limit_reached | no_match | matched)
 *
 * Auth: Supabase bearer token (required for both).
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';
import { runMatchmakerForUser, getMatchmakerStatus } from '$lib/server/matchmaker-service';

async function getUserId(request: Request): Promise<string | null> {
  const authHeader = request.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;
  try {
    const client = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user } } = await client.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

export const GET: RequestHandler = async ({ request }) => {
  const userId = await getUserId(request);
  if (!userId) return json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const status = await getMatchmakerStatus(userId);
    return json(status);
  } catch (err) {
    console.error('[find-matches] GET error:', err);
    return json({ error: 'Failed to load matchmaker status' }, { status: 500 });
  }
};

export const POST: RequestHandler = async ({ request }) => {
  const userId = await getUserId(request);
  if (!userId) return json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const result = await runMatchmakerForUser(userId);
    return json(result);
  } catch (err) {
    console.error('[find-matches] POST error:', err);
    return json({ error: 'Matchmaker run failed' }, { status: 500 });
  }
};
