import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request }) => {
  try {
    // TODO: Get user from session
    // const session = await getSession(request);
    // if (!session) {
    //   return json({ error: 'Unauthorized' }, { status: 401 });
    // }

    // TODO: Fetch from Supabase
    // const { data, error } = await supabase
    //   .from('verified_vibe_users')
    //   .select('*')
    //   .eq('id', session.user.id)
    //   .single();

    // Mock response
    const profile = {
      id: 'uuid-123',
      gender: 'man',
      archetype: 'casual_man',
      firstName: 'Alex',
      age: 28,
      city: 'Brooklyn, NY',
      avatar: null,
      about: null,
      looking: null,
      trustScore: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    return json(profile);
  } catch (error) {
    console.error('Profile fetch error:', error);
    return json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    );
  }
};

export const PUT: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();

    // TODO: Get user from session
    // const session = await getSession(request);
    // if (!session) {
    //   return json({ error: 'Unauthorized' }, { status: 401 });
    // }

    // TODO: Update in Supabase
    // const { data, error } = await supabase
    //   .from('verified_vibe_users')
    //   .update(body)
    //   .eq('id', session.user.id)
    //   .select()
    //   .single();

    // Mock response
    const updatedProfile = {
      ...body,
      id: 'uuid-123',
      updatedAt: new Date().toISOString()
    };

    return json(updatedProfile);
  } catch (error) {
    console.error('Profile update error:', error);
    return json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
};
