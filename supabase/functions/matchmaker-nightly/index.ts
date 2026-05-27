/**
 * Supabase Edge Function: matchmaker-nightly
 *
 * Runs once per day via Supabase cron (configured in Supabase Dashboard >
 * Database > Cron Jobs, or via supabase/config.toml).
 *
 * Cron schedule: 0 2 * * *  (2:00 AM daily)
 *
 * All it does is POST to the app's /api/verified-vibe/matchmaker/run endpoint
 * with the shared secret. The actual matching logic runs inside the SvelteKit
 * app server (where the Claude API key is available).
 *
 * To deploy:
 *   supabase functions deploy matchmaker-nightly
 *
 * Environment variables required (set in Supabase Dashboard > Edge Functions):
 *   APP_URL              — e.g. https://your-app.netlify.app
 *   MATCHMAKER_RUN_SECRET — shared secret matching the one in .env
 */

Deno.serve(async () => {
  const appUrl    = Deno.env.get('APP_URL') ?? '';
  const secret    = Deno.env.get('MATCHMAKER_RUN_SECRET') ?? '';
  const cityScoped = Deno.env.get('CITY_SCOPED') === 'true'; // false in Phase 1

  if (!appUrl || !secret) {
    console.error('[matchmaker-nightly] Missing APP_URL or MATCHMAKER_RUN_SECRET');
    return new Response(
      JSON.stringify({ error: 'Configuration missing' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const res = await fetch(`${appUrl}/api/verified-vibe/matchmaker/run`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ secret, cityScoped }),
    });

    const data = await res.json();

    console.log('[matchmaker-nightly] run triggered:', data);

    return new Response(
      JSON.stringify({ triggered: true, response: data }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[matchmaker-nightly] fetch error:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
