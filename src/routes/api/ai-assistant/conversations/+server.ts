import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createClient } from '@supabase/supabase-js';
import type { AIAssistantConversation, AssistantType } from '$lib/types';
import {
	throwAuthenticationError,
	throwValidationError,
	throwDatabaseError,
	throwInternalError,
	validateRequiredFields,
	validateEnumValue,
	logError,
	ErrorType,
	handleSupabaseError
} from '$lib/server/error-handler';

// Lazy-initialised client — avoids top-level throws that break vite build analysis
let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
	if (!_supabase) {
		const url = process.env.PUBLIC_SUPABASE_URL;
		const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
		if (!url || !key) {
			logError('Supabase Init', new Error('Missing env vars'), ErrorType.INTERNAL_ERROR);
			throw error(500, 'Database configuration error');
		}
		_supabase = createClient(url, key);
	}
	return _supabase;
}

/**
 * POST /api/ai-assistant/conversations
 * Create a new AI assistant conversation
 * 
 * Requirements: 1.1, 1.2, 1.5, 2.1, 2.2, 2.5, 8.1, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	// Validate authentication
	const session = await locals.auth.getSession();
	if (!session?.user) {
		throwAuthenticationError('User authentication required');
	}

	// Parse and validate request body
	let body: {
		matchConversationId: string;
		assistantType: AssistantType;
	};

	try {
		body = await request.json();
	} catch (err) {
		logError('Create Conversation', err, ErrorType.VALIDATION_ERROR);
		throwValidationError('Invalid JSON in request body');
	}

	// Validate required fields
	const { valid, missingFields } = validateRequiredFields(body, [
		'matchConversationId',
		'assistantType'
	]);

	if (!valid) {
		throwValidationError(`Missing required fields: ${missingFields.join(', ')}`);
	}

	const { matchConversationId, assistantType } = body;

	// Validate matchConversationId
	if (typeof matchConversationId !== 'string' || matchConversationId.trim().length === 0) {
		throwValidationError('matchConversationId must be a non-empty string');
	}

	// Validate assistantType enum
	const assistantTypeValidation = validateEnumValue(assistantType, ['bestie', 'wingman']);
	if (!assistantTypeValidation.valid) {
		throwValidationError(`Invalid assistantType: ${assistantTypeValidation.error}`);
	}

	try {
		// Check if conversation already exists
		const { data: existing, error: checkError } = await getSupabase()
			.from('ai_assistant_conversations')
			.select('id')
			.eq('user_id', session.user.id)
			.eq('match_conversation_id', matchConversationId)
			.eq('assistant_type', assistantType)
			.single();

		if (checkError && checkError.code !== 'PGRST116') {
			// PGRST116 means no rows found, which is expected
			const { userMessage, shouldThrow } = handleSupabaseError(checkError, 'Create Conversation');
			if (shouldThrow) {
				throwDatabaseError('Create Conversation', checkError, userMessage);
			}
		}

		if (existing) {
			// Conversation already exists - return it (idempotent)
			return json(existing);
		}

		// Create new conversation
		const { data, error: insertError } = await getSupabase()
			.from('ai_assistant_conversations')
			.insert({
				user_id: session.user.id,
				match_conversation_id: matchConversationId,
				assistant_type: assistantType,
				messages: [],
				is_active: true,
				exchange_count: 0
			})
			.select()
			.single();

		if (insertError) {
			const { userMessage, shouldThrow } = handleSupabaseError(insertError, 'Create Conversation');
			if (shouldThrow) {
				throwDatabaseError('Create Conversation', insertError, userMessage);
			}
		}

		if (!data) {
			logError('Create Conversation', new Error('No data returned'), ErrorType.DATABASE_ERROR);
			throwDatabaseError('Create Conversation', new Error('No data returned'), 'Failed to create conversation');
		}

		return json(data);
	} catch (err) {
		// If error is already a SvelteKit error, re-throw it
		if (err instanceof Error && err.message.includes('SvelteKit')) {
			throw err;
		}

		logError('Create Conversation', err, ErrorType.INTERNAL_ERROR);
		throwInternalError('Create Conversation', err, 'Failed to create conversation');
	}
};

/**
 * GET /api/ai-assistant/conversations
 * Fetch all AI assistant conversations for the user
 * 
 * Requirements: 8.1, 8.3, 8.4, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
 */
export const GET: RequestHandler = async ({ locals }) => {
	// Validate authentication
	const session = await locals.auth.getSession();
	if (!session?.user) {
		throwAuthenticationError('User authentication required');
	}

	try {
		const { data, error: dbError } = await getSupabase()
			.from('ai_assistant_conversations')
			.select('*')
			.eq('user_id', session.user.id)
			.order('updated_at', { ascending: false });

		if (dbError) {
			const { userMessage, shouldThrow } = handleSupabaseError(dbError, 'Fetch Conversations');
			if (shouldThrow) {
				throwDatabaseError('Fetch Conversations', dbError, userMessage);
			}
		}

		// Return empty array if no conversations found
		return json(data || []);
	} catch (err) {
		// If error is already a SvelteKit error, re-throw it
		if (err instanceof Error && err.message.includes('SvelteKit')) {
			throw err;
		}

		logError('Fetch Conversations', err, ErrorType.INTERNAL_ERROR);
		throwInternalError('Fetch Conversations', err, 'Failed to fetch conversations');
	}
};
