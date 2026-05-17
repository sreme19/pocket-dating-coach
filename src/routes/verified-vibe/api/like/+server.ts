import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();

    const { profileId } = body;

    // Validate required fields
    if (!profileId) {
      return json(
        { error: 'Missing profileId' },
        { status: 400 }
      );
    }

    // TODO: Get user from session
    // const session = await getSession(request);
    // if (!session) {
    //   return json({ error: 'Unauthorized' }, { status: 401 });
    // }

    // TODO: Check if mutual match
    // 1. Save like to Supabase
    // 2. Check if target user has already liked current user
    // 3. If yes, create match record
    // 4. If no, just save the like

    // Mock response
    const response = {
      matched: true,
      matchId: 'match-uuid-' + Math.random().toString(36).substr(2, 9)
    };

    return json(response, { status: 201 });
  } catch (error) {
    console.error('Like error:', error);
    return json(
      { error: 'Failed to process like' },
      { status: 500 }
    );
  }
};
