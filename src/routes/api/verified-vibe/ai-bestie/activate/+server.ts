import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getSupabase } from '$lib/server/supabase';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { conversationId } = await request.json();

		if (!conversationId) {
			return json({ error: 'Missing conversationId' }, { status: 400 });
		}

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

		const supabase = getSupabase();

		// Verify the requesting user is part of this match
		const { data: match, error: matchError } = await supabase
			.from('verified_vibe_matches')
			.select('user1_id, user2_id')
			.eq('id', conversationId)
			.single();

		if (matchError || !match) {
			return json({ error: 'Conversation not found' }, { status: 404 });
		}

		if (match.user1_id !== user.id && match.user2_id !== user.id) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { error: updateError } = await supabase
			.from('verified_vibe_matches')
			.update({ ai_bestie_active: true })
			.eq('id', conversationId);

		if (updateError) {
			console.error('Error activating AI Bestie:', updateError);
			return json({ error: 'Failed to activate AI Bestie' }, { status: 500 });
		}

		return json({ success: true });
	} catch (error) {
		console.error('AI Bestie activate error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Internal server error' },
			{ status: 500 }
		);
	}
};
