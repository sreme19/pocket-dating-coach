import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getSupabase } from '$lib/server/supabase';
import { ARCHETYPES } from '$lib/verified-vibe/constants';

export const GET: RequestHandler = async ({ params }) => {
  try {
    const profileId = params.profileId;
    if (!profileId) return json({ error: 'Profile ID required' }, { status: 400 });

    const supabase = getSupabase();
    const db = supabase as any;

    const [profileRes, masterRes] = await Promise.all([
      db
        .from('verified_vibe_users')
        .select('id, first_name, age, city, avatar_url, about, looking, trust_score, archetype, gender')
        .eq('id', profileId)
        .single(),
      db
        .from('user_master_profile')
        .select('data')
        .eq('user_id', profileId)
        .maybeSingle(),
    ]);

    if (profileRes.error || !profileRes.data) return json({ error: 'Profile not found' }, { status: 404 });
    const profile = profileRes.data;

    const archetype: string = profile.archetype ?? 'casual_man';
    const archetypeDef = ARCHETYPES[archetype];

    // Extract garage cars from master profile's verified proofs
    const masterData = (masterRes.data?.data as Record<string, unknown>) ?? {};
    const verifiedProofs: Array<Record<string, unknown>> = Array.isArray(masterData.verifiedProofs)
      ? masterData.verifiedProofs as Array<Record<string, unknown>>
      : [];
    const assetsProof = verifiedProofs.find((p) => p.category === 'assets');
    const garageCars = Array.isArray(assetsProof?.assets)
      ? (assetsProof!.assets as Array<Record<string, string>>)
          .filter((a) => a.type === 'car' && a.make)
          .map((a) => ({ make: a.make, model: a.model ?? '', year: a.year, color: a.color, vehicleType: a.vehicleType }))
      : [];

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
        garageCars,
      },
    });
  } catch (err) {
    console.error('public-profile error:', err);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};
