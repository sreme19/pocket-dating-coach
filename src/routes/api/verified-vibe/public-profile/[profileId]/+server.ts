import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getSupabase } from '$lib/server/supabase';
import { ARCHETYPES } from '$lib/verified-vibe/constants';

export const GET: RequestHandler = async ({ params }) => {
  try {
    const profileId = params.profileId;
    if (!profileId) return json({ error: 'Profile ID required' }, { status: 400 });

    const supabase = getSupabase();

    const { data: profile, error: profileErr } = await supabase
      .from('verified_vibe_users')
      .select('id, first_name, age, city, avatar_url, about, looking, trust_score, archetype, gender')
      .eq('id', profileId)
      .single();

    if (profileErr || !profile) return json({ error: 'Profile not found' }, { status: 404 });

    const archetype: string = profile.archetype ?? 'casual_man';
    const archetypeDef = ARCHETYPES[archetype];

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
      },
    });
  } catch (err) {
    console.error('public-profile error:', err);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};
