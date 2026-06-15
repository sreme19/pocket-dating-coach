/**
 * POST /api/verified-vibe/ai-wingman/generate-response
 *
 * AI Bestie in-conversation reply suggestion for female users chatting with men.
 *
 * Body:
 *   conversationId  string
 *
 * Response: { data: { suggestion: string, coaching: string | null } }
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getSupabase } from '$lib/server/supabase';
import { getClaudeClient, CLAUDE_MODEL } from '$lib/claude';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const authHeader = request.headers.get('authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } = await import('$env/static/public');
    const userClient = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();

    if (userError || !user?.id) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as { conversationId: string };

    if (!body.conversationId) {
      return json({ error: 'conversationId is required' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Verify user is a participant in the conversation
    const { data: match, error: matchError } = await supabase
      .from('verified_vibe_matches')
      .select('id, user1_id, user2_id')
      .eq('id', body.conversationId)
      .single();

    if (matchError || !match) {
      return json({ error: 'Conversation not found' }, { status: 404 });
    }

    if (match.user1_id !== user.id && match.user2_id !== user.id) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    // The requesting user is the man; the other participant is the woman
    const manId = user.id;
    const womanId = match.user1_id === user.id ? match.user2_id : match.user1_id;

    // Load both profiles and messages in parallel
    const [manResult, womanResult, messagesResult] = await Promise.all([
      supabase
        .from('verified_vibe_users')
        .select('first_name')
        .eq('id', manId)
        .single(),
      supabase
        .from('verified_vibe_users')
        .select('first_name, about, looking')
        .eq('id', womanId)
        .single(),
      supabase
        .from('verified_vibe_messages')
        .select('sender_id, content, created_at')
        .eq('match_id', body.conversationId)
        .order('created_at', { ascending: false })
        .limit(15),
    ]);

    const manName = manResult.data?.first_name ?? 'him';
    const womanProfile = womanResult.data;
    const womanName = womanProfile?.first_name ?? 'her';

    // Build chronological transcript (skip image messages)
    const transcript = ((messagesResult.data ?? []) as Array<{ sender_id: string; content: string; created_at: string }>)
      .slice()
      .reverse()
      .filter(m => !m.content.startsWith('[IMG]'))
      .map(m => {
        const speaker = m.sender_id === manId ? manName : womanName;
        return `${speaker}: ${m.content}`;
      })
      .join('\n');

    const prompt = `You are ${womanName}'s AI Bestie giving ${manName} a hint on how to reply to her well.

Here is what ${womanName} is about:
- About: ${womanProfile?.about ?? 'Not provided'}
- Looking for: ${womanProfile?.looking ?? 'Not provided'}

Recent conversation:
${transcript || '(No messages yet — suggest a great opening line for him)'}

Write a natural, genuine reply for ${manName} to send to ${womanName}. Keep it concise (1-3 sentences), warm and engaging. Do NOT be cheesy or use pickup lines — match the tone of the conversation.

Respond with JSON only:
{
  "suggestion": "the reply text here",
  "coaching": "one brief tip on why this approach works well with her (optional, can be null)"
}`;

    const client = getClaudeClient();
    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    const block = response.content[0];
    if (block.type !== 'text') {
      return json({ error: 'Unexpected AI response' }, { status: 500 });
    }

    const raw = block.text.trim().replace(/^```json\s*/i, '').replace(/```$/, '').trim();
    const result = JSON.parse(raw);

    return json({
      data: {
        suggestion: (result.suggestion ?? '').toString(),
        coaching: result.coaching ? result.coaching.toString() : null,
      },
    });
  } catch (err) {
    console.error('[AI Wingman generate-response]', err);
    return json(
      { error: err instanceof Error ? err.message : 'Something went wrong' },
      { status: 500 }
    );
  }
};
