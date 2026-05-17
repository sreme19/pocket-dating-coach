import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  try {
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // TODO: Get user from session
    // const session = await getSession(request);
    // if (!session) {
    //   return json({ error: 'Unauthorized' }, { status: 401 });
    // }

    // TODO: Fetch matches from Supabase
    // const { data, error } = await supabase
    //   .from('verified_vibe_matches')
    //   .select('*')
    //   .or(`user1_id.eq.${session.user.id},user2_id.eq.${session.user.id}`)
    //   .eq('status', 'mutual')
    //   .order('created_at', { ascending: false })
    //   .range(offset, offset + limit - 1);

    // Mock response
    const matches = [
      {
        id: 'match-1',
        user1Id: 'user-1',
        user2Id: 'user-2',
        user2: {
          id: 'user-2',
          name: 'Sarah',
          age: 26,
          city: 'Brooklyn, NY',
          avatar: 'https://example.com/avatar1.jpg',
          trustScore: 81
        },
        status: 'mutual',
        createdAt: new Date(Date.now() - 86400000).toISOString()
      },
      {
        id: 'match-2',
        user1Id: 'user-1',
        user2Id: 'user-3',
        user2: {
          id: 'user-3',
          name: 'Jessica',
          age: 28,
          city: 'Williamsburg, NY',
          avatar: 'https://example.com/avatar2.jpg',
          trustScore: 88
        },
        status: 'mutual',
        createdAt: new Date(Date.now() - 172800000).toISOString()
      }
    ];

    return json({
      matches,
      total: matches.length,
      hasMore: false
    });
  } catch (error) {
    console.error('Matches fetch error:', error);
    return json(
      { error: 'Failed to fetch matches' },
      { status: 500 }
    );
  }
};
