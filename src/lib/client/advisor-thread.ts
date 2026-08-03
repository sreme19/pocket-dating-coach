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

async function accessToken(): Promise<string | null> {
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
