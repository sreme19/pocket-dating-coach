import { ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY } from '$env/static/private';

export interface ServiceStatus {
  status: 'ok' | 'degraded' | 'down';
  latencyMs?: number;
  error?: string;
}

export interface HealthReport {
  status: 'ok' | 'degraded' | 'down';
  timestamp: string;
  uptimeSeconds: number;
  services: {
    claude: ServiceStatus;
    supabase: ServiceStatus;
    server: ServiceStatus;
  };
}

/**
 * Turns Anthropic's raw HTTP status (+ JSON error body, when present) into the
 * sentence a human should actually act on — "credits ran out" reads and gets
 * fixed a lot faster than "HTTP 400" ever will.
 */
async function claudeErrorMessage(resp: Response): Promise<string> {
  let body: { error?: { type?: string; message?: string } } | null = null;
  try { body = await resp.json(); } catch { /* non-JSON error body — fall through */ }
  const type = body?.error?.type;
  const msg = body?.error?.message ?? '';

  if (resp.status === 401) return 'Claude API key is invalid or has been revoked (401) — check ANTHROPIC_API_KEY in Vercel.';
  if (resp.status === 403) return 'Claude API key does not have permission for this request (403).';
  if (resp.status === 429) return 'Claude API rate limit hit (429) — too many requests right now.';
  if (type === 'invalid_request_error' && /credit/i.test(msg))
    return 'Claude API credit balance is exhausted — top up the Anthropic account.';
  if (resp.status >= 500) return `Claude API server error (HTTP ${resp.status}) — this is on Anthropic's side.`;
  return `Claude API error ${resp.status}${msg ? `: ${msg}` : ''}`;
}

async function checkClaude(): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'ping' }],
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const latencyMs = Date.now() - start;
    if (resp.status === 529) return { status: 'degraded', latencyMs, error: 'Anthropic is overloaded (529) — not our outage, should recover on its own.' };
    if (!resp.ok) return { status: 'down', latencyMs, error: await claudeErrorMessage(resp) };
    return { status: 'ok', latencyMs };
  } catch (e) {
    return { status: 'down', latencyMs: Date.now() - start, error: `Claude API unreachable — ${String(e)}` };
  }
}

/** Same idea as claudeErrorMessage, for Supabase's PostgREST error shape. */
async function supabaseErrorMessage(resp: Response): Promise<string> {
  let body: { message?: string; hint?: string } | null = null;
  try { body = await resp.json(); } catch { /* non-JSON error body — fall through */ }

  if (resp.status === 401 || resp.status === 403)
    return 'Supabase service key is invalid or has been revoked — check SUPABASE_SERVICE_KEY in Vercel.';
  if (resp.status === 404) return 'Supabase table not found (404) — schema may have changed or a migration is missing.';
  if (resp.status === 429) return 'Supabase connection pool or rate limit exhausted (429).';
  if (resp.status >= 500) return `Supabase internal error (HTTP ${resp.status}) — this is on Supabase's side, check their status page.`;
  return `Supabase error ${resp.status}${body?.message ? `: ${body.message}` : ''}`;
}

async function checkSupabase(): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/verified_vibe_users?select=count&limit=1`, {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Prefer': 'count=exact',
      },
      signal: AbortSignal.timeout(8_000),
    });
    const latencyMs = Date.now() - start;
    if (!resp.ok) return { status: 'down', latencyMs, error: await supabaseErrorMessage(resp) };
    return { status: 'ok', latencyMs };
  } catch (e) {
    return { status: 'down', latencyMs: Date.now() - start, error: `Supabase unreachable — ${String(e)}` };
  }
}

export async function runHealthCheck(): Promise<HealthReport> {
  const [claude, supabase] = await Promise.all([checkClaude(), checkSupabase()]);

  const anyDown = claude.status === 'down' || supabase.status === 'down';
  const anyDegraded = claude.status === 'degraded' || supabase.status === 'degraded';
  const overall = anyDown ? 'down' : anyDegraded ? 'degraded' : 'ok';

  return {
    status: overall,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime?.() ?? 0),
    services: {
      claude,
      supabase,
      server: { status: 'ok', latencyMs: 0 },
    },
  };
}
