import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createClient } from '@supabase/supabase-js';
import type { AIAssistantMessage } from '$lib/types';

// Lazy-initialised client — avoids top-level throws that break vite build analysis
let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
	if (!_supabase) {
		const url = process.env.PUBLIC_SUPABASE_URL;
		const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
		if (!url || !key) {
			throw error(500, 'Missing Supabase environment variables');
		}
		_supabase = createClient(url, key);
	}
	return _supabase;
}

// GET: Fetch a specific AI assistant conversation
export const GET: RequestHandler = async ({ params, locals }) => {
	const session = await locals.auth.getSession();
	if (!session?.user) {
		throw error(401, 'Unauthorized');
	}

	const { conversationId } = params;

	if (!conversationId) {
		throw error(400, 'Missing conversationId');
	}

	try {
		const { data, error: dbError } = await supabase
			.from('ai_assistant_conversations')
			.select('*')
			.eq('id', conversationId)
			.eq('user_id', session.user.id)
			.single();

		if (dbError || !data) {
			throw error(404, 'Conversation not found');
		}

		return json(data);
	} catch (err) {
		console.error('Error fetching AI assistant conversation:', err);
		if (err instanceof Error && err.message.includes('404')) {
			throw error(404, 'Conversation not found');
		}
		throw error(500, 'Failed to fetch conversation');
	}
};

// PATCH: Update AI assistant conversation (add messages)
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	const session = await locals.auth.getSession();
	if (!session?.user) {
		throw error(401, 'Unauthorized');
	}

	const { conversationId } = params;

	if (!conversationId) {
		throw error(400, 'Missing conversationId');
	}

	let body: {
		messages: AIAssistantMessage[];
	};

	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}

	const { messages } = body;

	if (!messages || !Array.isArray(messages)) {
		throw error(400, 'Missing or invalid messages array');
	}

	try {
		// Fetch current conversation
		const { data: current, error: fetchError } = await supabase
			.from('ai_assistant_conversations')
			.select('messages')
			.eq('id', conversationId)
			.eq('user_id', session.user.id)
			.single();

		if (fetchError || !current) {
			throw error(404, 'Conversation not found');
		}

		// Merge messages
		const existingMessages = current.messages || [];
		const updatedMessages = [...existingMessages, ...messages];

		// Update conversation
		const { data, error: updateError } = await supabase
			.from('ai_assistant_conversations')
			.update({
				messages: updatedMessages,
				updated_at: new Date().toISOString()
			})
			.eq('id', conversationId)
			.eq('user_id', session.user.id)
			.select()
			.single();

		if (updateError) {
			console.error('Database error:', updateError);
			throw error(500, 'Failed to update conversation');
		}

		return json(data);
	} catch (err) {
		console.error('Error updating AI assistant conversation:', err);
		if (err instanceof Error && err.message.includes('404')) {
			throw error(404, 'Conversation not found');
		}
		throw error(500, 'Failed to update conversation');
	}
};

// DELETE: Delete an AI assistant conversation
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const session = await locals.auth.getSession();
	if (!session?.user) {
		throw error(401, 'Unauthorized');
	}

	const { conversationId } = params;

	if (!conversationId) {
		throw error(400, 'Missing conversationId');
	}

	try {
		const { error: dbError } = await supabase
			.from('ai_assistant_conversations')
			.delete()
			.eq('id', conversationId)
			.eq('user_id', session.user.id);

		if (dbError) {
			console.error('Database error:', dbError);
			throw error(500, 'Failed to delete conversation');
		}

		return json({ success: true });
	} catch (err) {
		console.error('Error deleting AI assistant conversation:', err);
		throw error(500, 'Failed to delete conversation');
	}
};
