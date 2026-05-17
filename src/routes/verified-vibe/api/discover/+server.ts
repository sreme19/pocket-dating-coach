import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  try {
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // TODO: Get user from session
    // const session = await getSession(request);
    // if (!session) {
    //   return json({ error: 'Unauthorized' }, { status: 401 });
    // }

    // TODO: Fetch from Supabase with matching algorithm
    // - Get user's archetype and preferences
    // - Query compatible profiles
    // - Filter out already liked/passed profiles
    // - Sort by trust score and compatibility

    // Mock response
    const profiles = [
      {
        id: 'uuid-1',
        name: 'Sarah',
        age: 26,
        city: 'Brooklyn, NY',
        distance: '2 mi',
        archetype: 'spoilt_woman',
        photo: 'https://example.com/photo1.jpg',
        about: 'Looking for someone genuine and ambitious.',
        trustScore: 81,
        verified: ['ID', 'Photos', 'Spending']
      },
      {
        id: 'uuid-2',
        name: 'Emma',
        age: 24,
        city: 'Manhattan, NY',
        distance: '5 mi',
        archetype: 'spoilt_woman',
        photo: 'https://example.com/photo2.jpg',
        about: 'Creative professional seeking meaningful connections.',
        trustScore: 76,
        verified: ['ID', 'Photos']
      },
      {
        id: 'uuid-3',
        name: 'Jessica',
        age: 28,
        city: 'Williamsburg, NY',
        distance: '3 mi',
        archetype: 'spoilt_woman',
        photo: 'https://example.com/photo3.jpg',
        about: 'Entrepreneur with a passion for travel.',
        trustScore: 88,
        verified: ['ID', 'Photos', 'Spending', 'Q&A']
      }
    ];

    return json({
      profiles: profiles.slice(offset, offset + limit),
      total: profiles.length,
      hasMore: offset + limit < profiles.length
    });
  } catch (error) {
    console.error('Discover fetch error:', error);
    return json(
      { error: 'Failed to fetch discovery cards' },
      { status: 500 }
    );
  }
};
