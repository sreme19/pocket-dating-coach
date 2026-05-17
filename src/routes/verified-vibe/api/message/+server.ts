import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  try {
    const matchId = url.searchParams.get('matchId');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Validate required fields
    if (!matchId) {
      return json(
        { error: 'Missing matchId' },
        { status: 400 }
      );
    }

    // TODO: Get user from session
    // const session = await getSession(request);
    // if (!session) {
    //   return json({ error: 'Unauthorized' }, { status: 401 });
    // }

    // TODO: Fetch messages from Supabase
    // const { data, error } = await supabase
    //   .from('verified_vibe_messages')
    //   .select('*')
    //   .eq('match_id', matchId)
    //   .order('created_at', { ascending: true })
    //   .range(offset, offset + limit - 1);

    // Mock response
    const messages = [
      {
        id: 'msg-1',
        matchId,
        senderId: 'user-2',
        content: 'Hey! How are you doing?',
        createdAt: new Date(Date.now() - 3600000).toISOString()
      },
      {
        id: 'msg-2',
        matchId,
        senderId: 'user-1',
        content: 'Hey! Doing great, thanks for asking.',
        createdAt: new Date(Date.now() - 3300000).toISOString()
      }
    ];

    return json({
      messages,
      total: messages.length,
      hasMore: false
    });
  } catch (error) {
    console.error('Message fetch error:', error);
    return json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
};

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();

    const { matchId, content } = body;

    // Validate required fields
    if (!matchId || !content) {
      return json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // TODO: Get user from session
    // const session = await getSession(request);
    // if (!session) {
    //   return json({ error: 'Unauthorized' }, { status: 401 });
    // }

    // TODO: Save message to Supabase
    // const { data, error } = await supabase
    //   .from('verified_vibe_messages')
    //   .insert([
    //     {
    //       match_id: matchId,
    //       sender_id: session.user.id,
    //       content,
    //       created_at: new Date().toISOString()
    //     }
    //   ])
    //   .select()
    //   .single();

    // Mock response
    const message = {
      id: 'msg-' + Math.random().toString(36).substr(2, 9),
      matchId,
      senderId: 'user-1',
      content,
      createdAt: new Date().toISOString()
    };

    return json(message, { status: 201 });
  } catch (error) {
    console.error('Message send error:', error);
    return json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
};
