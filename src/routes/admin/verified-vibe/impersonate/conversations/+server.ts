/**
 * GET /admin/verified-vibe/impersonate/conversations?userId=<id>
 *
 * Admin "view-as-user" chat list. Returns the same payload the member endpoint
 * (/api/verified-vibe/chat/conversations) returns for `userId`, so the admin
 * preview can render the member chat list exactly as that user sees it.
 *
 * Auth: admin session cookie (pdc_admin). This route lives under /admin so the
 * path-scoped admin cookie is delivered even when fetched from a /verified-vibe
 * page. +server.ts handlers don't run the layout load, so the token is
 * validated explicitly here. READ-ONLY — no writes, no side effects.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ADMIN_COOKIE, tokenIsValid } from '$lib/server/admin-auth';
import { getSupabase } from '$lib/server/supabase';
import { buildConversations } from '$lib/server/chat-read';

export const GET: RequestHandler = async ({ url, cookies }) => {
  if (!tokenIsValid(cookies.get(ADMIN_COOKIE))) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = url.searchParams.get('userId');
  if (!userId) return json({ error: 'userId is required' }, { status: 400 });

  try {
    const conversations = await buildConversations(getSupabase(), userId);
    return json({ data: { conversations } });
  } catch (error) {
    console.error('Admin impersonate conversations error:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};
