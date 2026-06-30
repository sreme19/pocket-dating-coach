/**
 * POST /api/verified-vibe/cleanup-text
 *
 * Takes a raw user-typed string and returns a cleaned, concise version.
 * Used for Hard Nos dealbreaker chips before they're added to the profile.
 *
 * Auth: Bearer token (required)
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { ANTHROPIC_API_KEY } from '$env/static/private';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL   = 'claude-haiku-4-5-20251001';

async function getUserId(request: Request): Promise<string | null> {
  const authHeader = request.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;
  try {
    const client = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user } } = await client.auth.getUser();
    return user?.id ?? null;
  } catch { return null; }
}

const SYSTEM_PROMPT = `You clean up short dealbreaker phrases for a dating profile.

A valid dealbreaker names a trait, behaviour, or quality the user wants to avoid
in a partner (e.g. "smoking", "dishonesty", "no kids").

If the input IS a usable dealbreaker, clean it up:
- Convert first-person phrasing to a concise noun phrase (e.g. "I don't like liars" → "Dishonesty")
- Fix typos and capitalise properly (title case for nouns, lowercase for adjectives/gerunds)
- Keep it to 1–5 words — trim any filler
- Preserve the user's intent exactly; never soften or rephrase meaning
- Return ONLY the cleaned phrase, nothing else — no quotes, no punctuation at end

If the input is NOT a usable dealbreaker — gibberish, empty of meaning, a slur or
hateful term, an instruction/question, or otherwise unparseable — do NOT invent a
phrase. Instead respond with exactly one line beginning with "REJECT:" followed by
a short, friendly user-facing reason. Examples:
- REJECT: That doesn't look like a dealbreaker — try naming a trait you'd want to avoid.
- REJECT: We can't add that wording. Try describing the behaviour instead.`;

const DEFAULT_REJECT_REASON =
  "That doesn't look like a dealbreaker — try naming a trait you'd want to avoid.";

export const POST: RequestHandler = async ({ request }) => {
  const userId = await getUserId(request);
  if (!userId) return json({ error: 'Unauthorized' }, { status: 401 });

  let body: { text: string };
  try { body = await request.json(); }
  catch { return json({ error: 'Invalid JSON' }, { status: 400 }); }

  const raw = body.text?.trim();
  if (!raw) return json({ error: 'Empty text' }, { status: 400 });

  try {
    const resp = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 64,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: raw }],
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!resp.ok) return json({ cleaned: raw }); // fallback to original on API error

    const data = await resp.json();
    const text = (data.content?.[0]?.text ?? '').trim();

    // The model signals an unusable input (gibberish, slur, question, etc.) with a
    // "REJECT:" line. Surface the reason but do NOT return a phrase, so the client
    // shows the message and skips adding it as a dealbreaker.
    if (/^REJECT:/i.test(text)) {
      const reason = text.replace(/^REJECT:/i, '').trim() || DEFAULT_REJECT_REASON;
      return json({ rejected: true, reason });
    }

    const cleaned = text.replace(/['"]/g, '').trim() || raw;
    return json({ cleaned });
  } catch {
    return json({ cleaned: raw }); // fallback to original on timeout/error
  }
};
