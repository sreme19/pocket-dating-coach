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
import { readFileSync } from 'fs';
import { resolve } from 'path';

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

type Field = 'about' | 'personality' | 'looking' | 'lifestyle';

// Maps real user archetypes to the closest seed personality.md for style reference
const ARCHETYPE_PERSONALITY_MAP: Record<string, string> = {
  casual_man:                   'ryan_Serial_Dater_f4m2px',
  casual_generous_man:          'victor_Sugar_Daddy_e6p4rl',
  forever_focused_man:          'karan_Progressive_Traditional_u9j5ql',
  hopeless_romantic_man:        'ethan_Golden_Retriever_q7n5wc',
  traditional_matrimony_man:    'arjun_Progressive_Traditional_e2m8cw',
  second_chapter_man:           'jake_Serial_Monogamist_c3n7qr',
  untouched_heart_man:          'john_Young_Student_nsysor',
  just_friends_man:             'alex_Monogamish_t9n2cw',
  rebound_healing_man:          'daniel_Emotionally_Available_v2r6ys',
};

function loadPersonalityMd(archetype?: string): string | null {
  if (!archetype) return null;
  const folder = ARCHETYPE_PERSONALITY_MAP[archetype];
  if (!folder) return null;
  try {
    const filePath = resolve('static', 'male_profiles', folder, 'personality.md');
    return readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

// ─── Prompt builders ──────────────────────────────────────────────────────────

function buildVerifiedProofsSection(profileData: Record<string, unknown>): string {
  const proofs = profileData.verifiedProofs;
  if (!Array.isArray(proofs) || proofs.length === 0) return '';
  const lines = proofs.map((p: any) => {
    const agg = p.aggregated ? `"${p.aggregated}"` : '';
    const tags = Array.isArray(p.insights) ? p.insights.map((i: any) => i.label).join(', ') : '';
    const locs = Array.isArray(p.locations) && p.locations.length > 0 ? ` · Locations: ${p.locations.join(', ')}` : '';
    return `• ${p.category}: ${agg || tags}${locs}`;
  }).join('\n');
  return `\n\nVerified proof from their Trust & Boost uploads (REAL, confirmed facts — weave these in naturally):\n${lines}`;
}

function buildPrompt(
  field: Field,
  gender: string,
  about: string | null,
  profileData: Record<string, unknown>,
  archetype?: string,
  currentAbout?: string
): string {
  const context = JSON.stringify(profileData, null, 2).slice(0, 3000);
  const aboutText = about ?? '';
  const archetypeHint = archetype ? ` (archetype: ${archetype.replace(/_/g, ' ')})` : '';
  const verifiedSection = buildVerifiedProofsSection(profileData);

  if (field === 'about') {
    const personalityMd = loadPersonalityMd(archetype);
    const rawDraft = currentAbout?.trim() || aboutText.trim();

    const personalitySection = personalityMd
      ? `\n\nPersonality reference for this archetype (use for tone, authenticity signals, and what makes this type attractive — do NOT copy verbatim):\n${personalityMd.slice(0, 2000)}`
      : '';

    const draftSection = rawDraft
      ? `\n\nThe user's rough notes about themselves (treat as raw material to polish — keep their facts, fix the language):\n"${rawDraft}"`
      : '';

    return `You are writing a dating profile bio for a real man${archetypeHint}.
${draftSection}${verifiedSection}${personalitySection}

Write a genuine, engaging, first-person "About me" bio. Rules:
- Use the user's rough notes as the source of truth for facts — don't invent details they didn't mention
- If verified proof is provided above, you MUST weave at least one verified fact into the bio naturally
- Polish the language: fix grammar, capitalise "I", make it flow naturally
- Add 2-3 relevant emojis woven in naturally (not all at the end)
- Be 2-4 sentences, 60-120 words maximum
- Sound confident and specific — no generic clichés like "love to laugh" or "easy-going"
- Match the energy of the archetype: ${archetype?.replace(/_/g, ' ')}
- Write ONLY the bio text — no intro, no labels, no quotes around it

Example output: 💼 Work hard, play harder — I run my own business and I genuinely love the grind. But I know how to switch off: good food, good company, and the kind of evenings that don't need a plan. 🥃 I live well and I like having the right people around me. Looking for someone who actually enjoys the finer things without making it a personality.`;
  }

  if (field === 'personality') {
    return `You are writing a dating profile for a real person (gender: ${gender}).

Their bio: "${aboutText}"

Their profile data:
${context}
${verifiedSection}

Generate exactly 3 personality adjectives that describe THIS specific person — earned, not generic.
Rules:
- Single adjectives only (e.g. "Ambitious", "Grounded", "Direct")
- Reflect who they actually are based on the data above — if verified proofs exist, let them inform the adjectives
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
${verifiedSection}

Generate 5-6 lifestyle tags for this person's OWN life — not what they want in a partner.
Rules:
- Reflect THIS person's actual interests, identity, and daily life
- If verified proofs exist above, include tags that reflect those confirmed facts (e.g. "Solo traveler", "Bali explorer")
- Short and specific: 1-3 words per tag
- Think: where do they live, what do they love, how do they spend time
- Return ONLY the tags as a comma-separated string, nothing else

Example output: London life, Biryani runs, Tech career, Good food, Travel, Cultural festivals`;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const field: Field = body.field;
    const currentAbout: string | undefined = body.currentAbout;
    const clientGender: string = body.gender ?? 'man';
    const clientArchetype: string | undefined = body.archetype;
    // Client can pass localStorage onboarding data as profileData fallback
    const clientProfileData: Record<string, unknown> = body.profileData ?? {};

    if (!['about', 'personality', 'looking', 'lifestyle'].includes(field)) {
      return json({ error: 'Invalid field. Must be about, personality, looking, or lifestyle.' }, { status: 400 });
    }

    // Auth is optional — if a real session token is present, fetch DB profile for richer context
    let profileData: Record<string, unknown> = clientProfileData;
    try {
      const authHeader = request.headers.get('authorization') ?? '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
      if (token) {
        const { createClient } = await import('@supabase/supabase-js');
        const { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } = await import('$env/static/public');
        const userClient = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } }
        });
        const { data: { user } } = await userClient.auth.getUser();
        if (user?.id) {
          const supabase = getSupabase();
          const preferredType = clientGender === 'woman' ? 'preferences' : 'personality';
          const { data: aiRows } = await supabase
            .from('ai_assistant_profiles')
            .select('data, profile_type')
            .eq('user_id', user.id)
            .order('version', { ascending: false })
            .limit(2);
          const aiRow = aiRows?.find(r => r.profile_type === preferredType) ?? aiRows?.[0] ?? null;
          if (aiRow?.data) profileData = { ...clientProfileData, ...(aiRow.data as Record<string, unknown>) };
        }
      }
    } catch { /* non-critical — proceed with client-supplied data */ }

    const prompt = buildPrompt(field, clientGender, currentAbout ?? null, profileData, clientArchetype, currentAbout);

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: field === 'about' ? 400 : 150,
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
