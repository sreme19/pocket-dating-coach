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
    if (resp.status === 529) return { status: 'degraded', latencyMs, error: 'Anthropic overloaded (529)' };
    if (!resp.ok) return { status: 'down', latencyMs, error: `HTTP ${resp.status}` };
    return { status: 'ok', latencyMs };
  } catch (e) {
    return { status: 'down', latencyMs: Date.now() - start, error: String(e) };
  }
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
    if (!resp.ok) return { status: 'down', latencyMs, error: `HTTP ${resp.status}` };
    return { status: 'ok', latencyMs };
  } catch (e) {
    return { status: 'down', latencyMs: Date.now() - start, error: String(e) };
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
