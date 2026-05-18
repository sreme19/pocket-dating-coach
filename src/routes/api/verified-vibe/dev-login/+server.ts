/**
 * POST /api/verified-vibe/dev-login
 *
 * Dev-only endpoint — only active when VITE_SKIP_VERIFICATION=true.
 * Accepts a known test email, creates the Supabase user if needed,
 * generates an OTP via the admin API (no email sent), and returns the
 * 6-digit token so the auth page can verify it immediately.
 *
 * Test accounts:
 *   male@test.vv   → gender: man
 *   female@test.vv → gender: woman
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSupabase } from '$lib/server/supabase';

const TEST_ACCOUNTS: Record<string, 'man' | 'woman'> = {
  'male@test.vv':   'man',
  'female@test.vv': 'woman'
};

export const POST: RequestHandler = async ({ request }) => {
  // Hard gate — never available in production
  if (import.meta.env.VITE_SKIP_VERIFICATION !== 'true') {
    return json({ error: 'Not available in production' }, { status: 403 });
  }

  const { email } = await request.json();
  const normalised = (email ?? '').trim().toLowerCase();

  const gender = TEST_ACCOUNTS[normalised];
  if (!gender) {
    return json({ error: 'Not a recognised test account' }, { status: 400 });
  }

  const supabase = getSupabase();

  // Create the user if they don't exist yet (idempotent)
  await supabase.auth.admin.createUser({
    email: normalised,
    email_confirm: true
  });

  // Generate a magic-link — Supabase gives us the raw OTP in the response,
  // so we can verify it programmatically without sending any email.
  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: normalised
  });

  if (error) {
    console.error('dev-login generateLink error:', error);
    return json({ error: error.message }, { status: 500 });
  }

  return json({
    otp:    data.properties.email_otp,
    gender
  });
};
