import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createClient } from '@supabase/supabase-js';
import type { AIAssistantMessage } from '$lib/types';
import {
	throwAuthenticationError,
	throwValidationError,
	throwNotFoundError,
	throwDatabaseError,
	throwInternalError,
	validateArrayLength,
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
 * GET /api/ai-assistant/conversations/[conversationId]
 * Fetch a specific AI assistant conversation
 * 
 * Requirements: 8.1, 8.3, 8.4, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	// Validate authentication
	const session = await locals.auth.getSession();
	if (!session?.user) {
		throwAuthenticationError('User authentication required');
	}

	const { conversationId } = params;

	// Validate conversationId parameter
	if (!conversationId || typeof conversationId !== 'string' || conversationId.trim().length === 0) {
		throwValidationError('conversationId parameter is required and must be non-empty');
	}

	try {
		const { data, error: dbError } = await getSupabase()
			.from('ai_assistant_conversations')
			.select('*')
			.eq('id', conversationId)
			.eq('user_id', session.user.id)
			.single();

		if (dbError) {
			if (dbError.code === 'PGRST116') {
				// No rows found
				throwNotFoundError('Conversation');
			}
			const { userMessage, shouldThrow } = handleSupabaseError(dbError, 'Fetch Conversation');
			if (shouldThrow) {
				throwDatabaseError('Fetch Conversation', dbError, userMessage);
			}
		}

		if (!data) {
			throwNotFoundError('Conversation');
		}

		return json(data);
	} catch (err) {
		// If error is already a SvelteKit error, re-throw it
		if (err instanceof Error && err.message.includes('SvelteKit')) {
			throw err;
		}

		logError('Fetch Conversation', err, ErrorType.INTERNAL_ERROR);
		throwInternalError('Fetch Conversation', err, 'Failed to fetch conversation');
	}
};

/**
 * PATCH /api/ai-assistant/conversations/[conversationId]
 * Update AI assistant conversation (add messages)
 * 
 * Requirements: 3.6, 4.6, 8.1, 8.2, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
 */
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	// Validate authentication
	const session = await locals.auth.getSession();
	if (!session?.user) {
		throwAuthenticationError('User authentication required');
	}

	const { conversationId } = params;

	// Validate conversationId parameter
	if (!conversationId || typeof conversationId !== 'string' || conversationId.trim().length === 0) {
		throwValidationError('conversationId parameter is required and must be non-empty');
	}

	// Parse and validate request body
	let body: {
		messages: AIAssistantMessage[];
	};

	try {
		body = await request.json();
	} catch (err) {
		logError('Update Conversation', err, ErrorType.VALIDATION_ERROR);
		throwValidationError('Invalid JSON in request body');
	}

	const { messages } = body;

	// Validate messages field
	if (!messages) {
		throwValidationError('messages field is required');
	}

	if (!Array.isArray(messages)) {
		throwValidationError('messages must be an array');
	}

	// Validate messages array length
	const messagesValidation = validateArrayLength(messages, 1);
	if (!messagesValidation.valid) {
		throwValidationError(messagesValidation.error);
	}

	// Validate message structure
	for (let i = 0; i < messages.length; i++) {
		const msg = messages[i];
		if (!msg.role || !msg.content) {
			throwValidationError(`Message at index ${i} missing required fields: role, content`);
		}
		if (typeof msg.content !== 'string' || msg.content.trim().length === 0) {
			throwValidationError(`Message at index ${i} content must be a non-empty string`);
		}
	}

	try {
		// Fetch current conversation
		const { data: current, error: fetchError } = await getSupabase()
			.from('ai_assistant_conversations')
			.select('messages')
			.eq('id', conversationId)
			.eq('user_id', session.user.id)
			.single();

		if (fetchError) {
			if (fetchError.code === 'PGRST116') {
				// No rows found
				throwNotFoundError('Conversation');
			}
			const { userMessage, shouldThrow } = handleSupabaseError(fetchError, 'Update Conversation');
			if (shouldThrow) {
				throwDatabaseError('Update Conversation', fetchError, userMessage);
			}
		}

		if (!current) {
			throwNotFoundError('Conversation');
		}

		// Merge messages
		const existingMessages = current.messages || [];
		if (!Array.isArray(existingMessages)) {
			logError('Update Conversation', new Error('Invalid messages format'), ErrorType.DATABASE_ERROR);
			throwDatabaseError('Update Conversation', new Error('Invalid messages format'), 'Conversation data is corrupted');
		}

		const updatedMessages = [...existingMessages, ...messages];

		// Update conversation
		const { data, error: updateError } = await getSupabase()
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
			const { userMessage, shouldThrow } = handleSupabaseError(updateError, 'Update Conversation');
			if (shouldThrow) {
				throwDatabaseError('Update Conversation', updateError, userMessage);
			}
		}

		if (!data) {
			logError('Update Conversation', new Error('No data returned'), ErrorType.DATABASE_ERROR);
			throwDatabaseError('Update Conversation', new Error('No data returned'), 'Failed to update conversation');
		}

		return json(data);
	} catch (err) {
		// If error is already a SvelteKit error, re-throw it
		if (err instanceof Error && err.message.includes('SvelteKit')) {
			throw err;
		}

		logError('Update Conversation', err, ErrorType.INTERNAL_ERROR);
		throwInternalError('Update Conversation', err, 'Failed to update conversation');
	}
};

/**
 * DELETE /api/ai-assistant/conversations/[conversationId]
 * Delete an AI assistant conversation
 * 
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	// Validate authentication
	const session = await locals.auth.getSession();
	if (!session?.user) {
		throwAuthenticationError('User authentication required');
	}

	const { conversationId } = params;

	// Validate conversationId parameter
	if (!conversationId || typeof conversationId !== 'string' || conversationId.trim().length === 0) {
		throwValidationError('conversationId parameter is required and must be non-empty');
	}

	try {
		// Verify conversation exists and belongs to user before deleting
		const { data: existing, error: checkError } = await getSupabase()
			.from('ai_assistant_conversations')
			.select('id')
			.eq('id', conversationId)
			.eq('user_id', session.user.id)
			.single();

		if (checkError) {
			if (checkError.code === 'PGRST116') {
				// No rows found
				throwNotFoundError('Conversation');
			}
			const { userMessage, shouldThrow } = handleSupabaseError(checkError, 'Delete Conversation');
			if (shouldThrow) {
				throwDatabaseError('Delete Conversation', checkError, userMessage);
			}
		}

		if (!existing) {
			throwNotFoundError('Conversation');
		}

		// Delete conversation
		const { error: dbError } = await getSupabase()
			.from('ai_assistant_conversations')
			.delete()
			.eq('id', conversationId)
			.eq('user_id', session.user.id);

		if (dbError) {
			const { userMessage, shouldThrow } = handleSupabaseError(dbError, 'Delete Conversation');
			if (shouldThrow) {
				throwDatabaseError('Delete Conversation', dbError, userMessage);
			}
		}

		return json({ success: true });
	} catch (err) {
		// If error is already a SvelteKit error, re-throw it
		if (err instanceof Error && err.message.includes('SvelteKit')) {
			throw err;
		}

		logError('Delete Conversation', err, ErrorType.INTERNAL_ERROR);
		throwInternalError('Delete Conversation', err, 'Failed to delete conversation');
	}
};
