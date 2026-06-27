/**
 * Supabase Edge Function: demo-login
 *
 * Provides a static credential bypass for App Store review accounts.
 * Apple reviewers cannot receive OTP emails, so this function creates
 * a real Supabase session for a pre-configured demo account when the
 * reviewer enters the hardcoded email + code in the app.
 *
 * To deploy:
 *   supabase functions deploy demo-login
 *
 * Environment variables required (set in Supabase Dashboard > Edge Functions):
 *   SUPABASE_URL              — auto-injected by Supabase
 *   SUPABASE_SERVICE_ROLE_KEY — auto-injected by Supabase
 *   SUPABASE_ANON_KEY         — auto-injected by Supabase
 *   DEMO_INTERNAL_PASSWORD    — a long random password, only used server-side
 *                               (e.g. generate with: openssl rand -base64 32)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const DEMO_EMAIL = 'review@riteangle.com';
const DEMO_CODE  = '123456';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Content-Type': 'application/json',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  const supabaseUrl      = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const anonKey          = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const internalPassword = Deno.env.get('DEMO_INTERNAL_PASSWORD') ?? '';

  if (!supabaseUrl || !serviceRoleKey || !anonKey || !internalPassword) {
    console.error('[demo-login] Missing required env vars');
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }

  let body: { email?: string; code?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid request body' }),
      { status: 400, headers: CORS_HEADERS }
    );
  }

  // Validate hardcoded credentials
  if (body.email !== DEMO_EMAIL || body.code !== DEMO_CODE) {
    return new Response(
      JSON.stringify({ error: 'Invalid credentials' }),
      { status: 401, headers: CORS_HEADERS }
    );
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const anonClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // Ensure demo user exists with the internal password
    const { data: { users } } = await adminClient.auth.admin.listUsers();
    const existing = users.find((u) => u.email === DEMO_EMAIL);

    if (existing) {
      await adminClient.auth.admin.updateUserById(existing.id, {
        password: internalPassword,
        email_confirm: true,
      });
    } else {
      const { error: createErr } = await adminClient.auth.admin.createUser({
        email: DEMO_EMAIL,
        password: internalPassword,
        email_confirm: true,
      });
      if (createErr) throw createErr;
    }

    // Sign in with password to get a real session
    const { data: sessionData, error: signInErr } =
      await anonClient.auth.signInWithPassword({
        email: DEMO_EMAIL,
        password: internalPassword,
      });

    if (signInErr || !sessionData.session) {
      throw signInErr ?? new Error('No session returned');
    }

    console.log('[demo-login] Demo session created successfully');

    return new Response(
      JSON.stringify({
        access_token:  sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error('[demo-login] Error:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
});
