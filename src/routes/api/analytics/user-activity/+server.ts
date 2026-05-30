import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSupabase } from '$lib/server/supabase';

export const GET: RequestHandler = async ({ url }) => {
	const userId = url.searchParams.get('userId');
	if (!userId) return json({ error: 'missing userId' }, { status: 400 });

	const sb = getSupabase();

	const [
		{ data: likes },
		{ data: passes },
		{ data: matchesAs1 },
		{ data: matchesAs2 },
		{ data: messages },
		{ data: events },
		{ data: actionHistory },
		{ data: bestieFeedback },
		{ data: attentionSent },
		{ data: attentionReceived },
		{ data: aiConvos },
	] = await Promise.all([
		// Profiles this user liked
		sb.from('verified_vibe_likes')
			.select('liked_user_id, created_at, verified_vibe_users!liked_user_id(first_name, archetype, gender)')
			.eq('user_id', userId)
			.order('created_at', { ascending: false }),

		// Profiles this user passed on
		sb.from('verified_vibe_passes')
			.select('passed_user_id, created_at, verified_vibe_users!passed_user_id(first_name, archetype, gender)')
			.eq('user_id', userId)
			.order('created_at', { ascending: false }),

		// Matches as user1
		sb.from('verified_vibe_matches')
			.select('id, status, created_at, ai_bestie_active, verified_vibe_users!user2_id(first_name, archetype, gender)')
			.eq('user1_id', userId)
			.order('created_at', { ascending: false }),

		// Matches as user2
		sb.from('verified_vibe_matches')
			.select('id, status, created_at, ai_bestie_active, verified_vibe_users!user1_id(first_name, archetype, gender)')
			.eq('user2_id', userId)
			.order('created_at', { ascending: false }),

		// Messages sent
		sb.from('verified_vibe_messages')
			.select('id, content, created_at, match_id')
			.eq('sender_id', userId)
			.order('created_at', { ascending: false })
			.limit(50),

		// Analytics events
		sb.from('verified_vibe_analytics')
			.select('event_type, metadata, created_at')
			.eq('user_id', userId)
			.order('created_at', { ascending: false }),

		// Action history (likes/passes/views)
		sb.from('verified_vibe_action_history')
			.select('action_type, profile_id, created_at, verified_vibe_users!profile_id(first_name, archetype)')
			.eq('user_id', userId)
			.order('created_at', { ascending: false })
			.limit(100),

		// AI Bestie feedback
		sb.from('ai_bestie_feedback')
			.select('feedback_type, message_content, created_at')
			.eq('user_id', userId)
			.order('created_at', { ascending: false }),

		// Attention messages sent
		sb.from('attention_messages')
			.select('message_type, content, created_at, is_read, verified_vibe_users!recipient_id(first_name)')
			.eq('sender_id', userId)
			.order('created_at', { ascending: false }),

		// Attention messages received
		sb.from('attention_messages')
			.select('message_type, content, created_at, is_read, reply_content, verified_vibe_users!sender_id(first_name)')
			.eq('recipient_id', userId)
			.order('created_at', { ascending: false }),

		// AI assistant conversations
		sb.from('ai_assistant_conversations')
			.select('assistant_type, exchange_count, is_active, created_at, updated_at')
			.eq('user_id', userId)
			.order('created_at', { ascending: false }),
	]);

	// Merge matches from both sides
	const allMatches = [
		...(matchesAs1 ?? []).map((m) => ({ ...m, otherUser: (m as any).verified_vibe_users })),
		...(matchesAs2 ?? []).map((m) => ({ ...m, otherUser: (m as any).verified_vibe_users })),
	].sort((a, b) => b.created_at.localeCompare(a.created_at));

	return json({
		likes: likes ?? [],
		passes: passes ?? [],
		matches: allMatches,
		messages: messages ?? [],
		events: events ?? [],
		actionHistory: actionHistory ?? [],
		bestieFeedback: bestieFeedback ?? [],
		attentionSent: attentionSent ?? [],
		attentionReceived: attentionReceived ?? [],
		aiConvos: aiConvos ?? [],
	});
};
