/**
 * POST /api/verified-vibe/profile/auto-fill
 *
 * Generates auto-filled content for a specific profile section using
 * Claude + the user's ai_assistant_profiles data.
 *
 * Body: { field: 'personality' | 'looking' | 'lifestyle' }
 * Auth: Bearer token
 *
 * Returns: { value: string }
 *   - personality → "Ambitious, Curious, Grounded"       (3 comma-sep adjectives)
 *   - looking     → "Serious long-term, Cultural fit, ..." (5-6 comma-sep phrases)
 *   - lifestyle   → "Travel, Good food, London life, ..."  (5-6 comma-sep tags)
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getSupabase } from '$lib/server/supabase';
import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY } from '$env/static/private';

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

type Field = 'about' | 'personality' | 'looking' | 'lifestyle';

// ─── Prompt builders ──────────────────────────────────────────────────────────

function buildPrompt(
  field: Field,
  gender: string,
  about: string | null,
  profileData: Record<string, unknown>,
  archetype?: string
): string {
  const context = JSON.stringify(profileData, null, 2).slice(0, 3000);
  const aboutText = about ?? '';
  const archetypeHint = archetype ? ` (archetype: ${archetype.replace(/_/g, ' ')})` : '';

  if (field === 'about') {
    return `You are writing a dating profile bio for a real person${archetypeHint} (gender: ${gender}).

Their profile data:
${context}

Write a genuine, first-person "About me" bio for this person's dating profile. The bio should:
- Sound natural and conversational, not stiff or salesy
- Be 2-4 sentences (80-150 words maximum)
- Reflect their values, lifestyle, and what makes them worth getting to know
- Avoid generic clichés like "love to laugh", "love adventures", "looking for my person"
- Be specific and honest — pull signals from the profile data above
- Suit the ${archetype?.includes('matrimony') ? 'matrimony-minded, serious, family-oriented' : 'contemporary dating'} context
- Write ONLY the bio text, no intro, no quotes, no labels

Example (matrimony context): I grew up in a home where Sunday dinners meant the whole family — and that's the kind of home I want to build. I work in finance, take my faith seriously, and still make time for the things that matter. I'm not here to waste anyone's time; I'm here because I'm ready.`;
  }

  if (field === 'personality') {
    return `You are writing a dating profile for a real person (gender: ${gender}).

Their bio: "${aboutText}"

Their profile data:
${context}

Generate exactly 3 personality adjectives that describe THIS specific person — earned, not generic.
Rules:
- Single adjectives only (e.g. "Ambitious", "Grounded", "Direct")
- Reflect who they actually are based on the data above
- Avoid clichés: no "Caring", "Funny", "Loyal", "Easy-going"
- Return ONLY the 3 adjectives as a comma-separated string, nothing else

Example output: Culturally fluent, Intentional, Warm`;
  }

  if (field === 'looking') {
    return `You are writing a dating profile for a real person (gender: ${gender}).

Their bio: "${aboutText}"

Their profile data (what they genuinely want in a partner and relationship):
${context}

Generate 5-6 "Looking for" points that describe what this person wants from a relationship.
Rules:
- Write from THEIR perspective (first-person implied: "Someone who..." or short noun phrases)
- Be specific to this person — no generic "kind and caring" type items
- Cover: relationship intent, key values, compatibility signals
- Each item should be concise: 3-7 words maximum
- Return ONLY the items as a comma-separated string, nothing else

Example output: Serious long-term commitment, Culturally aligned partner, Intentional pursuit, Mutual respect for standards, Ready to build something real, London-compatible`;
  }

  // lifestyle
  return `You are writing a dating profile for a real person (gender: ${gender}).

Their bio: "${aboutText}"

Their profile data:
${context}

Generate 5-6 lifestyle tags for this person's OWN life — not what they want in a partner.
Rules:
- Reflect THIS person's actual interests, identity, and daily life
- Read the bio and profile notes carefully for personal signals
- Short and specific: 1-3 words per tag
- Think: where do they live, what do they love, how do they spend time
- Return ONLY the tags as a comma-separated string, nothing else

Example output: London life, Biryani runs, Tech career, Good food, Travel, Cultural festivals`;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export const POST: RequestHandler = async ({ request }) => {
  try {
    // Auth
    const authHeader = request.headers.get('authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return json({ error: 'Unauthorized' }, { status: 401 });

    const { createClient } = await import('@supabase/supabase-js');
    const { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } = await import('$env/static/public');
    const userClient = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user?.id) return json({ error: 'Unauthorized' }, { status: 401 });

    // Validate field
    const body = await request.json();
    const field: Field = body.field;
    if (!['about', 'personality', 'looking', 'lifestyle'].includes(field)) {
      return json({ error: 'Invalid field. Must be about, personality, looking, or lifestyle.' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Fetch user profile + latest ai_assistant_profiles in parallel
    const profileType = field === 'personality'
      ? 'personality'
      : 'preferences';   // women use preferences, men use personality

    const [{ data: vvUser }, { data: aiRows }] = await Promise.all([
      supabase
        .from('verified_vibe_users')
        .select('gender, about, archetype')
        .eq('id', user.id)
        .single(),
      supabase
        .from('ai_assistant_profiles')
        .select('data, profile_type')
        .eq('user_id', user.id)
        .order('version', { ascending: false })
        .limit(2)            // grab both types if present
    ]);

    if (!vvUser) return json({ error: 'Profile not found' }, { status: 404 });

    // Pick the most relevant profile row
    const preferredType = vvUser.gender === 'woman' ? 'preferences' : 'personality';
    const aiRow = aiRows?.find(r => r.profile_type === preferredType) ?? aiRows?.[0] ?? null;
    const profileData = (aiRow?.data as Record<string, unknown>) ?? {};

    const prompt = buildPrompt(field, vvUser.gender, vvUser.about, profileData, (vvUser as any).archetype);

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: field === 'about' ? 300 : 150,
      messages: [{ role: 'user', content: prompt }]
    });

    let value = ((response.content[0] as { type: string; text: string }).text ?? '').trim();
    // Strip any accidental markdown / quotes
    value = value.replace(/^```[\w]*\n?/m, '').replace(/\n?```$/m, '').replace(/^["']|["']$/g, '').trim();

    return json({ value });
  } catch (err) {
    console.error('[auto-fill]', err);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};
