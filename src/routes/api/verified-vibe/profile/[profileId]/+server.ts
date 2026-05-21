import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getSupabase } from '$lib/server/supabase';

export const GET: RequestHandler = async ({ params, request }) => {
  try {
    const profileId = params.profileId;

    if (!profileId) {
      return json({ error: 'Profile ID is required' }, { status: 400 });
    }

    // Get auth token from header
    const authHeader = request.headers.get('authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user is authenticated
    const { createClient } = await import('@supabase/supabase-js');
    const { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } = await import('$env/static/public');
    const userClient = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();

    if (userError || !user?.id) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch the profile
    const supabase = getSupabase();

    const { data: profile, error: profileError } = await supabase
      .from('verified_vibe_users')
      .select('*')
      .eq('id', profileId)
      .single();

    if (profileError || !profile) {
      return json({ error: 'Profile not found' }, { status: 404 });
    }

    // Transform to match DiscoveryProfile type
    const transformedProfile = {
      id: profile.id,
      gender: profile.gender,
      firstName: profile.first_name,
      age: profile.age,
      city: profile.city,
      avatar: profile.avatar_url,
      about: profile.about,
      looking: profile.looking,
      trustScore: profile.trust_score,
      archetype: profile.archetype,
      createdAt: new Date(profile.created_at)
    };

    return json({ data: transformedProfile });
  } catch (error) {
    console.error('Profile fetch error:', error);
    return json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
};
