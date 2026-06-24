import { getSupabase } from './supabase';

export interface AppErrorContext {
  /** Human-readable feature name, e.g. "AI Bestie", "Matchmaker", "Face Verification" */
  feature: string;
  /** Relative file path, e.g. "src/routes/api/verified-vibe/ai-bestie/chat/+server.ts" */
  file: string;
  /** HTTP method + path, e.g. "POST /api/verified-vibe/ai-bestie/chat" */
  endpoint: string;
  userId?: string | null;
  matchId?: string | null;
  /** Any extra key-value pairs to log (request params, external API responses, etc.) */
  extra?: Record<string, unknown>;
}

/**
 * Log an application error to monitor_log with structured context.
 * Fire-and-forget — never throws, never blocks the response.
 */
export async function logAppError(error: unknown, ctx: AppErrorContext): Promise<void> {
  try {
    const sb = getSupabase();
    const message = error instanceof Error ? error.message : String(error);
    const stack =
      error instanceof Error
        ? error.stack
            ?.split('\n')
            .slice(0, 4)
            .join(' | ')
        : undefined;

    await sb.from('monitor_log').insert({
      check_name: 'app_error',
      status: 'FAIL',
      response_time_ms: null,
      error_message: message,
      metadata: {
        feature: ctx.feature,
        file: ctx.file,
        endpoint: ctx.endpoint,
        user_id: ctx.userId ?? null,
        match_id: ctx.matchId ?? null,
        stack: stack ?? null,
        ...ctx.extra,
      },
    });
  } catch {
    // intentionally swallowed — logging must never break request handling
  }
}
