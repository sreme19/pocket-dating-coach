import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createClient } from '@supabase/supabase-js';
import type { AIAssistantConversation, AssistantType } from '$lib/types';

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
	throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// POST: Create a new AI assistant conversation
export const POST: RequestHandler = async ({ request, locals }) => {
	const session = await locals.auth.getSession();
	if (!session?.user) {
		throw error(401, 'Unauthorized');
	}

	let body: {
		matchConversationId: string;
		assistantType: AssistantType;
	};

	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}

	const { matchConversationId, assistantType } = body;

	if (!matchConversationId || !assistantType) {
		throw error(400, 'Missing required fields: matchConversationId, assistantType');
	}

	if (assistantType !== 'bestie' && assistantType !== 'wingman') {
		throw error(400, 'Invalid assistantType');
	}

	try {
		// Check if conversation already exists
		const { data: existing } = await supabase
			.from('ai_assistant_conversations')
			.select('id')
			.eq('user_id', session.user.id)
			.eq('match_conversation_id', matchConversationId)
			.eq('assistant_type', assistantType)
			.single();

		if (existing) {
			return json(existing);
		}

		// Create new conversation
		const { data, error: dbError } = await supabase
			.from('ai_assistant_conversations')
			.insert({
				user_id: session.user.id,
				match_conversation_id: matchConversationId,
				assistant_type: assistantType,
				messages: []
			})
			.select()
			.single();

		if (dbError) {
			console.error('Database error:', dbError);
			throw error(500, 'Failed to create conversation');
		}

		return json(data);
	} catch (err) {
		console.error('Error creating AI assistant conversation:', err);
		throw error(500, 'Failed to create conversation');
	}
};

// GET: Fetch all AI assistant conversations for the user
export const GET: RequestHandler = async ({ locals }) => {
	const session = await locals.auth.getSession();
	if (!session?.user) {
		throw error(401, 'Unauthorized');
	}

	try {
		const { data, error: dbError } = await supabase
			.from('ai_assistant_conversations')
			.select('*')
			.eq('user_id', session.user.id)
			.order('updated_at', { ascending: false });

		if (dbError) {
			console.error('Database error:', dbError);
			throw error(500, 'Failed to fetch conversations');
		}

		return json(data || []);
	} catch (err) {
		console.error('Error fetching AI assistant conversations:', err);
		throw error(500, 'Failed to fetch conversations');
	}
};
