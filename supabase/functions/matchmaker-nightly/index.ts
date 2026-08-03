/**
 * Supabase Edge Function: matchmaker-nightly
 *
 * ⚠️ SUPERSEDED — DO NOT RE-ARM. Replaced by the Vercel cron
 * `/api/cron/matchmaker-nightly` (schedule in vercel.json).
 *
 * This trigger never produced a single match. It POSTs and awaits the app's
 * response, but the app's nightly path answered `{ started: true }` immediately
 * and ran the batch fire-and-forget; Vercel freezes the invocation as soon as a
 * response is returned, killing the work mid-flight. All six `nightly` rows in
 * vv_matchmaker_runs (2026-06-10 → 2026-07-28) have completed_at NULL and
 * pairs_evaluated 0. Even with the app path now awaited, this trigger stays
 * wrong: a run can outlive this function's own limit, and when it is torn down
 * the dropped connection can take the run with it.
 *
 * If a Supabase cron job for this function still exists in the Dashboard
 * (Database > Cron Jobs), DELETE it — otherwise it double-fires the batch
 * alongside the Vercel cron.
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
