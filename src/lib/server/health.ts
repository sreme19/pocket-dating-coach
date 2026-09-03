import { ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY } from '$env/static/private';

export interface ServiceStatus {
  status: 'ok' | 'degraded' | 'down';
  latencyMs?: number;
  error?: string;
  /**
   * Set when the fault is a provider's and there is no action on our side —
   * Anthropic shedding load, say. The alert cron reads this to decide whether
   * the report is worth an email, so only set it where waiting genuinely is
   * the whole remedy. An upstream cause is NOT enough on its own: a Claude
   * outage still breaks our AI features and still has to wake someone.
   */
  upstream?: boolean;
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
    if (resp.status === 529) return { status: 'degraded', latencyMs, upstream: true, error: 'Anthropic is overloaded (529) — not our outage, should recover on its own.' };
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

/**
 * Is every fault in this report someone else's, with waiting as the only
 * remedy? Anthropic shedding load (529) is the case this exists for: the report
 * is accurate and worth having in Slack, but an email whose own body reads
 * "not our outage, should recover on its own" asks for a decision nobody can
 * make, and a monitor that cries wolf gets filtered into a folder.
 *
 * Deliberately strict. Anything `down` fails this even when the cause is
 * upstream, and one un-flagged degradation among several upstream ones fails it
 * too — a report is only skippable if there is nothing in it to act on.
 */
export function isUpstreamOnly(report: HealthReport): boolean {
  if (report.status === 'down') return false;
  const failing = Object.values(report.services).filter((s) => s.status !== 'ok');
  return failing.length > 0 && failing.every((s) => s.upstream === true);
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
