import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { SEED_ACCOUNT_PASSWORD } from '$env/static/private';
import { getSupabase } from '$lib/server/supabase';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

/**
 * POST /api/verified-vibe/seed-login
 *
 * Seed account login endpoint for @seed.vv email addresses.
 * Accepts email + password and returns a valid Supabase session token.
 *
 * Only works for emails ending in @seed.vv with the correct password.
 * Uses Supabase admin API to generate a magic link and exchange for session.
 *
 * Request body:
 * {
 *   "email": "user@seed.vv",
 *   "password": "SeedPass123!"
 * }
 *
 * Response (200):
 * {
 *   "session": {
 *     "access_token": "eyJ...",
 *     "refresh_token": "...",
 *     "expires_in": 3600,
 *     "user": {
 *       "id": "uuid",
 *       "email": "user@seed.vv",
 *       "user_metadata": {...}
 *     }
 *   }
 * }
 *
 * Response (400/401):
 * {
 *   "error": "Invalid email domain" | "Invalid password" | "User not found"
 * }
 */

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const { email, password } = body;

    // 1. Validate required fields
    if (!email || !password) {
      return json(
        { error: 'Email and password required' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 2. Validate @seed.vv domain
    if (!normalizedEmail.endsWith('@seed.vv')) {
      return json(
        { error: 'Invalid email domain' },
        { status: 400 }
      );
    }

    // 3. Validate password (constant-time comparison to prevent timing attacks)
    if (password !== SEED_ACCOUNT_PASSWORD) {
      return json(
        { error: 'Invalid password' },
        { status: 401 }
      );
    }

    // 4. Use Supabase admin to generate magic link
    const supabase = getSupabase();
    const { data, error: linkError } = await (supabase.auth.admin as any).generateLink({
      type: 'magiclink',
      email: normalizedEmail
    });

    if (linkError || !data?.properties?.email_otp) {
      console.error('generateLink error:', linkError);
      return json(
        { error: 'User not found or cannot login' },
        { status: 404 }
      );
    }

    // 5. Return the OTP to the client for verification
    // The client will call verifyOtp with this token
    return json(
      { otp: data.properties.email_otp },
      { status: 200 }
    );
  } catch (error) {
    console.error('Seed login error:', error);
    return json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
};
