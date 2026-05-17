import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();

    const { gender, archetype, firstName, age, city } = body;

    // Validate required fields
    if (!gender || !archetype || !firstName || !age || !city) {
      return json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // TODO: Save to Supabase
    // const { data, error } = await supabase
    //   .from('verified_vibe_users')
    //   .insert([
    //     {
    //       gender,
    //       archetype,
    //       first_name: firstName,
    //       age,
    //       city,
    //       trust_score: 0
    //     }
    //   ])
    //   .select()
    //   .single();

    // Mock response
    const user = {
      id: 'uuid-' + Math.random().toString(36).substr(2, 9),
      gender,
      archetype,
      firstName,
      age,
      city,
      trustScore: 0,
      createdAt: new Date().toISOString()
    };

    return json(user, { status: 201 });
  } catch (error) {
    console.error('Register error:', error);
    return json(
      { error: 'Failed to register user' },
      { status: 500 }
    );
  }
};
