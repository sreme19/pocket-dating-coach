/**
 * Advisor thread — client half of the AI Wingman / AI Bestie transcript.
 *
 * The web advisor pages used to keep their transcript ONLY in localStorage, behind
 * a 7-day TTL that silently deleted real coaching history. `/api/verified-vibe/
 * advisor/*` is canonical now; localStorage survives purely as an offline cache and
 * an instant first paint while the fetch is in flight.
 *
 * Both advisor pages consume this so their hydrate / mark-read behaviour can't drift.
 */

import { getSupabaseClient } from '$lib/client/supabase';

export type AdvisorKind = 'chat' | 'greeting' | 'nudge' | 'task_ack' | 'task_result';

/** One stored turn, exactly as the history endpoint serialises it. */
export interface AdvisorHistoryMessage {
  id: string;
  role: 'user' | 'assistant';
  kind: AdvisorKind;
  content: string;
  payload: Record<string, unknown> | null;
  greetingId: string | null;
  taskId: string | null;
  createdAt: string;
  seq: number;
}

export interface AdvisorHistory {
  assistantType: 'wingman' | 'bestie';
  /** Already in display order (oldest → newest). */
  messages: AdvisorHistoryMessage[];
  unreadCount: number;
  lastReadAt: string | null;
}

export async function accessToken(): Promise<string | null> {
  try {
    const { data: { session } } = await getSupabaseClient().auth.getSession();
    return session?.access_token ?? null;
  } catch {
    return null;
  }
}

/**
 * The stored thread. Returns null on any failure — a flaky network must leave the
 * locally cached transcript on screen rather than blanking it.
 */
export async function fetchAdvisorHistory(limit = 200): Promise<AdvisorHistory | null> {
  try {
    const token = await accessToken();
    if (!token) return null;

    const res = await fetch(`/api/verified-vibe/advisor/history?limit=${limit}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) return null;

    const data = await res.json() as Partial<AdvisorHistory>;
    if (!Array.isArray(data.messages)) return null;

    return {
      assistantType: data.assistantType === 'bestie' ? 'bestie' : 'wingman',
      messages: data.messages,
      unreadCount: data.unreadCount ?? 0,
      lastReadAt: data.lastReadAt ?? null
    };
  } catch {
    return null;
  }
}

// ── Trust & Boost portfolio ──────────────────────────────────────────────────
// Feeds the card pinned above both advisor threads. See the endpoint's own header
// for why every number here is safe to state plainly: Profile Strength and appeal
// are ABSOLUTE (fixed weights / one evaluator's own preferences), not cohort
// percentiles, so nobody else uploading can erode them.

/** How much one upload would move a single named match's appeal. */
export interface PortfolioAppealGain {
  name: string;
  delta: number;
}

/**
 * One recommended upload, with what it is actually worth.
 *
 * Money categories are absent by construction — the endpoint passes
 * `excludeMoney`. They still count toward `done`/`completed`, but must never be
 * named to a member as something that makes them more appealing (App Store 1.1.4).
 */
export interface PortfolioAction {
  /** Proof category id, e.g. `linkedin` — matches $lib/verified-vibe/proof-categories. */
  id: string;
  label: string;
  /** How to ask for it in plain member language. */
  askPhrase: string;
  deltaPS: number;
  crossesBand: boolean;
  bandAfter: string | null;
  appealGains: PortfolioAppealGain[];
  matchesHelped: number;
}

export interface AdvisorPortfolio {
  done: number;
  total: number;
  /** Bare category ids (no `proof_` prefix). */
  completed: string[];
  /** Null until this member has vectors — the card then shows completion only. */
  profileStrength: number | null;
  band: string | null;
  nextBand: string | null;
  pointsToNextBand: number | null;
  actions: PortfolioAction[];
}

function finiteOr<T>(value: unknown, fallback: T): number | T {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Coerce one wire action, dropping anything without an id and a usable delta. */
function readAction(raw: unknown): PortfolioAction | null {
  const a = raw as Partial<PortfolioAction> | null;
  if (!a || typeof a.id !== 'string' || !a.id) return null;

  const deltaPS = finiteOr(a.deltaPS, null);
  if (deltaPS === null) return null;

  const gains = Array.isArray(a.appealGains) ? a.appealGains : [];
  return {
    id: a.id,
    label: typeof a.label === 'string' && a.label ? a.label : a.id,
    askPhrase: typeof a.askPhrase === 'string' ? a.askPhrase : '',
    deltaPS,
    crossesBand: a.crossesBand === true,
    bandAfter: typeof a.bandAfter === 'string' ? a.bandAfter : null,
    appealGains: gains.flatMap((g) => {
      const name = (g as PortfolioAppealGain | null)?.name;
      const delta = finiteOr((g as PortfolioAppealGain | null)?.delta, null);
      return typeof name === 'string' && name && delta !== null ? [{ name, delta }] : [];
    }),
    matchesHelped: Math.max(0, Math.round(finiteOr(a.matchesHelped, 0)))
  };
}

/**
 * Portfolio completion and the highest-value next uploads. Returns null on any
 * failure — the card is additive, so a flaky network must simply hide it rather
 * than blank or block the transcript underneath.
 */
export async function fetchAdvisorPortfolio(): Promise<AdvisorPortfolio | null> {
  try {
    const token = await accessToken();
    if (!token) return null;

    const res = await fetch('/api/verified-vibe/advisor/portfolio', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) return null;

    const data = await res.json() as Record<string, unknown>;

    // Completion is the one thing the card can't render without.
    const done = finiteOr(data.done, null);
    const total = finiteOr(data.total, null);
    if (done === null || total === null || total <= 0) return null;

    return {
      done,
      total,
      completed: Array.isArray(data.completed)
        ? data.completed.filter((c): c is string => typeof c === 'string')
        : [],
      profileStrength: finiteOr(data.profileStrength, null),
      band: typeof data.band === 'string' ? data.band : null,
      nextBand: typeof data.nextBand === 'string' ? data.nextBand : null,
      pointsToNextBand: finiteOr(data.pointsToNextBand, null),
      actions: Array.isArray(data.actions)
        ? data.actions.flatMap((a) => {
            const parsed = readAction(a);
            return parsed ? [parsed] : [];
          })
        : []
    };
  } catch {
    return null;
  }
}

/**
 * Stamp the thread read, clearing the chat-list badge. Fire-and-forget: reading a
 * transcript must never be blocked on this succeeding.
 */
export async function markAdvisorThreadRead(): Promise<void> {
  try {
    const token = await accessToken();
    if (!token) return;

    await fetch('/api/verified-vibe/advisor/mark-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({})
    });
  } catch { /* non-critical */ }
}
