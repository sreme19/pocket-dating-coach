/**
 * POST /api/verified-vibe/wingman
 *
 * Interprets a plain-English profile edit request and returns a structured
 * action the client can execute directly.
 *
 * Rules enforced by Claude:
 *  - Remove anything            → always allowed
 *  - Update non-proof fields    → always allowed (bio, tags, archetype, hard nos, money)
 *  - Add proof-gated content   → redirect to upload page instead
 *
 * Auth: Bearer token (required)
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { ANTHROPIC_API_KEY } from '$env/static/private';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL   = 'claude-sonnet-4-6';

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

const SYSTEM_PROMPT = `You are an AI profile editor for a dating app called Pocket Dating Coach.
The user wants to make a change to their profile using plain English.

RULES — follow strictly:
1. REMOVING anything is always allowed (proof exists or not).
2. UPDATING non-proof fields is always allowed:
   - about (bio)
   - personalityTags (array of short descriptors)
   - lifestyleTags (array of lifestyle tags)
   - intentTags (array of "looking for" phrases)
   - archetype (see valid values below)
   - hardNos (array of dealbreakers)
   - moneyMatters.annualIncome (string range)
   - moneyMatters.netWorth (string range)
3. ADDING content that requires uploaded proof is NOT allowed via chat.
   Instead, return action "redirect_upload" with the correct upload URL:
   - Travel / countries → /verified-vibe/proof-upload?category=lifestyle
   - Career / job / LinkedIn → /verified-vibe/proof-upload?category=linkedin
   - Spending / receipts → /verified-vibe/proof-upload?category=spending
   - Assets / cars → /verified-vibe/proof-upload?category=assets
   - Wealth / income docs → /verified-vibe/proof-upload?category=wealth
   - Instagram → /verified-vibe/proof-upload?category=instagram
   - Any other verified badge → /verified-vibe/proof-upload

Valid archetypes: casual_man, casual_generous_man, forever_focused_man, hopeless_romantic_man,
traditional_matrimony_man, second_chapter_man, untouched_heart_man, just_friends_man, rebound_healing_man

ACTION TYPES you can return:
- "update_field"   — update a non-proof profile field
- "remove_proof"   — remove an entire proof category (linkedin, instagram, wealth, assets, spending, lifestyle, hosting, discipline, social_proof, twitter, habit_tracker, intro)
- "remove_country" — remove a specific country/place from travel magnets
- "remove_tag"     — remove a single tag from personalityTags, lifestyleTags, intentTags, or hardNos
- "redirect_upload"— user wants to add something that needs proof
- "clarify"        — request is unclear or out of scope

Return ONLY raw JSON, no markdown, no code fences:
{
  "action": "<action_type>",
  "field": "<field_name>",          // for update_field or remove_tag
  "value": <new_value>,             // for update_field (string or array)
  "category": "<proof_category>",   // for remove_proof
  "country": "<place_name>",        // for remove_country
  "tag": "<tag_string>",            // for remove_tag
  "uploadUrl": "<path>",            // for redirect_upload
  "confirmation": "<friendly 6-10 word message shown in chat>",
  "redirectMessage": "<friendly message explaining why they need to upload>"
}`;

export const POST: RequestHandler = async ({ request }) => {
  const userId = await getUserId(request);
  if (!userId) return json({ error: 'Unauthorized' }, { status: 401 });

  let body: {
    message: string;
    profileSnapshot: Record<string, unknown>;
  };
  try { body = await request.json(); }
  catch { return json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { message, profileSnapshot } = body;
  if (!message?.trim()) return json({ error: 'Empty message' }, { status: 400 });

  const userContent = `Current profile snapshot:
${JSON.stringify(profileSnapshot, null, 2)}

User's request: "${message.trim()}"`;

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
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userContent }],
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!resp.ok) return json({ error: 'AI unavailable' }, { status: 502 });

    const data = await resp.json();
    let raw: string = data.content?.[0]?.text ?? '{}';
    raw = raw.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim();
    if (!raw.startsWith('{')) {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) raw = m[0];
    }

    const action = JSON.parse(raw);
    return json(action);
  } catch (err) {
    console.error('[wingman]', err);
    return json({ error: 'Failed to process request' }, { status: 500 });
  }
};
