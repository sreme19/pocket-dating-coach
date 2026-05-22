import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getSupabase } from '$lib/server/supabase';
import { ARCHETYPES } from '$lib/verified-vibe/constants';

/**
 * Compute four personality trait scores (0–100) from the AI personality data.
 * Keywords are matched against all text fields concatenated together.
 */
function deriveTraitScores(personality: Record<string, unknown> | null, archetype: string) {
  const allText = [
    personality?.communicationStyle ?? '',
    personality?.personalityVibe ?? '',
    personality?.mattersMost ?? '',
    ...(Array.isArray(personality?.values) ? (personality.values as string[]) : []),
    ...(Array.isArray(personality?.datingPatterns) ? (personality.datingPatterns as string[]) : []),
  ]
    .join(' ')
    .toLowerCase();

  function score(keywords: string[], antiKeywords: string[] = []): number {
    const pos = keywords.filter((k) => allText.includes(k)).length;
    const neg = antiKeywords.filter((k) => allText.includes(k)).length;
    return Math.min(100, Math.max(0, 50 + pos * 15 - neg * 15));
  }

  // Archetype baseline defaults
  const base: Record<string, { dec: number; warm: number; open: number; pace: number }> = {
    casual_man:          { dec: 75, warm: 60, open: 70, pace: 70 },
    marriage_minded_man: { dec: 70, warm: 80, open: 60, pace: 55 },
    spoilt_woman:        { dec: 65, warm: 65, open: 65, pace: 60 },
    safety_first_woman:  { dec: 60, warm: 75, open: 55, pace: 45 },
  };

  const b = base[archetype] ?? { dec: 60, warm: 60, open: 60, pace: 60 };

  // Adjust using personality text (±15 per matching keyword)
  const dec = Math.min(100, Math.max(10,
    b.dec
    + score(['direct', 'decisive', 'clear', 'assertive', 'confident', 'takes charge', 'straightforward'], [])
    - 50 // neutralise the base shift from score()
  ));
  const warm = Math.min(100, Math.max(10,
    b.warm
    + score(['warm', 'caring', 'generous', 'emotional', 'empathetic', 'loving', 'affectionate'], [])
    - 50
  ));
  const open = Math.min(100, Math.max(10,
    b.open
    + score(['open', 'curious', 'adventurous', 'flexible', 'creative', 'spontaneous'], ['rigid', 'traditional only'])
    - 50
  ));
  const pace = Math.min(100, Math.max(10,
    b.pace
    + score(['busy', 'driven', 'ambitious', 'hustle', 'goal-oriented', 'fast-paced'], ['patient', 'relaxed', 'slow'])
    - 50
  ));

  return { decisiveness: dec, warmth: warm, openness: open, pace };
}

/**
 * Extract up to 5 "vibe words" from personality data.
 * Primary source: values array; fallback: tokenise personalityVibe string.
 */
function deriveVibeWords(personality: Record<string, unknown> | null): string[] {
  if (!personality) return ['Mysterious', 'Confident', 'Direct'];

  const values = Array.isArray(personality.values) ? (personality.values as string[]) : [];
  if (values.length >= 3) {
    // Capitalise first letter and take max 5
    return values.slice(0, 5).map((v) => v.charAt(0).toUpperCase() + v.slice(1));
  }

  // Fallback: split personalityVibe and pick short words
  const vibe = typeof personality.personalityVibe === 'string' ? personality.personalityVibe : '';
  const tokens = vibe
    .split(/[,\s]+/)
    .map((w) => w.replace(/[^a-z]/gi, ''))
    .filter((w) => w.length >= 4 && w.length <= 12)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

  const unique = [...new Set(tokens)];
  const result = [...values.map((v) => v.charAt(0).toUpperCase() + v.slice(1)), ...unique].slice(0, 5);
  return result.length >= 3 ? result : ['Confident', 'Direct', 'Driven'];
}

export const GET: RequestHandler = async ({ params, request }) => {
  try {
    const profileId = params.profileId;
    if (!profileId) return json({ error: 'Profile ID required' }, { status: 400 });

    // Authenticate caller
    const authHeader = request.headers.get('authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return json({ error: 'Unauthorized' }, { status: 401 });

    const { createClient } = await import('@supabase/supabase-js');
    const { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } = await import('$env/static/public');
    const userClient = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user?.id) return json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = getSupabase();

    // Fetch basic user profile + personality in parallel
    const [{ data: profile, error: profileErr }, { data: aiRow }] = await Promise.all([
      supabase.from('verified_vibe_users').select('*').eq('id', profileId).single(),
      supabase
        .from('ai_assistant_profiles')
        .select('data')
        .eq('user_id', profileId)
        .eq('profile_type', 'personality')
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (profileErr || !profile) return json({ error: 'Profile not found' }, { status: 404 });

    const personality = (aiRow?.data as Record<string, unknown>) ?? null;
    const archetype: string = profile.archetype ?? 'casual_man';
    const archetypeDef = ARCHETYPES[archetype];

    const traitScores = deriveTraitScores(personality, archetype);
    const vibeWords = deriveVibeWords(personality);

    // "What He Brings" — from archetype definition or personality.mattersMost
    const brings: string[] = archetypeDef?.brings ?? [
      'Financial stability',
      'Respect & safety',
      'Clear intent',
    ];

    // "Here For" — from the user's looking field
    const hereFor: string = profile.looking ?? archetypeDef?.tag ?? 'A real connection';

    // Communication style label
    const communicationStyle =
      typeof personality?.communicationStyle === 'string'
        ? personality.communicationStyle
        : null;

    return json({
      data: {
        id: profile.id,
        firstName: profile.first_name,
        age: profile.age,
        city: profile.city,
        avatar: profile.avatar_url,
        about: profile.about,
        looking: profile.looking,
        trustScore: profile.trust_score ?? 0,
        archetype,
        archetypeName: archetypeDef?.name ?? archetype,
        archetypeEmoji: archetypeDef?.emoji ?? '✨',
        gender: profile.gender,
        // Rich profile data
        vibeWords,
        traitScores,
        brings,
        hereFor,
        communicationStyle,
        mattersMost:
          typeof personality?.mattersMost === 'string' ? personality.mattersMost : null,
      },
    });
  } catch (err) {
    console.error('match-profile error:', err);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};
