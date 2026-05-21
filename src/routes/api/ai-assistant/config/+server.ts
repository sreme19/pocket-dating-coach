import { json, type RequestHandler } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import type { AssistantType } from '$lib/types';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

let supabase: any = null;

// Initialize Supabase client only if environment variables are available
if (supabaseUrl && supabaseServiceKey) {
	supabase = createClient(supabaseUrl, supabaseServiceKey);
}

interface ConfigRequest {
	assistantType: AssistantType;
	isEnabled: boolean;
}

interface AssistantConfig {
	id: string;
	userId: string;
	assistantType: AssistantType;
	isEnabled: boolean;
	isActive: boolean;
	exchangeCount: number;
	createdAt: string;
	updatedAt: string;
}

/**
 * GET /api/ai-assistant/config
 * Retrieve current AI assistant configuration for the user
 */
export const GET: RequestHandler = async ({ request, locals }) => {
	try {
		// Check if Supabase is initialized
		if (!supabase) {
			return json({ error: 'Database not configured' }, { status: 500 });
		}

		// Get user from session
		const session = await locals.auth.getSession();
		if (!session?.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const userId = session.user.id;

		// Fetch configurations for both assistants
		const { data: configs, error } = await supabase
			.from('ai_assistant_configs')
			.select('*')
			.eq('user_id', userId);

		if (error) {
			console.error('Failed to fetch configs:', error);
			return json({ error: 'Failed to fetch configuration' }, { status: 500 });
		}

		// Organize configs by type
		const configMap: Record<AssistantType, AssistantConfig | null> = {
			bestie: null,
			wingman: null
		};

		configs?.forEach((config: any) => {
			if (config.assistant_type === 'bestie' || config.assistant_type === 'wingman') {
				configMap[config.assistant_type] = {
					id: config.id,
					userId: config.user_id,
					assistantType: config.assistant_type,
					isEnabled: config.is_enabled,
					isActive: config.is_active,
					exchangeCount: config.exchange_count,
					createdAt: config.created_at,
					updatedAt: config.updated_at
				};
			}
		});

		return json({
			bestie: configMap.bestie,
			wingman: configMap.wingman
		});
	} catch (error) {
		console.error('Error fetching configuration:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};

/**
 * POST /api/ai-assistant/config
 * Update AI assistant configuration
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// Check if Supabase is initialized
		if (!supabase) {
			return json({ error: 'Database not configured' }, { status: 500 });
		}

		// Get user from session
		const session = await locals.auth.getSession();
		if (!session?.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const userId = session.user.id;
		const body: ConfigRequest = await request.json();

		const { assistantType, isEnabled } = body;

		if (!assistantType || typeof isEnabled !== 'boolean') {
			return json({ error: 'Invalid request parameters' }, { status: 400 });
		}

		// Check if config exists
		const { data: existingConfig, error: fetchError } = await supabase
			.from('ai_assistant_configs')
			.select('*')
			.eq('user_id', userId)
			.eq('assistant_type', assistantType)
			.single();

		if (fetchError && fetchError.code !== 'PGRST116') {
			console.error('Error fetching existing config:', fetchError);
			return json({ error: 'Failed to fetch configuration' }, { status: 500 });
		}

		let config;

		if (existingConfig) {
			// Update existing config
			const { data: updated, error: updateError } = await supabase
				.from('ai_assistant_configs')
				.update({
					is_enabled: isEnabled,
					updated_at: new Date().toISOString()
				})
				.eq('id', existingConfig.id)
				.select()
				.single();

			if (updateError) {
				console.error('Error updating config:', updateError);
				return json({ error: 'Failed to update configuration' }, { status: 500 });
			}

			config = updated;
		} else {
			// Create new config
			const { data: created, error: createError } = await supabase
				.from('ai_assistant_configs')
				.insert({
					user_id: userId,
					assistant_type: assistantType,
					is_enabled: isEnabled,
					is_active: false,
					exchange_count: 0,
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString()
				})
				.select()
				.single();

			if (createError) {
				console.error('Error creating config:', createError);
				return json({ error: 'Failed to create configuration' }, { status: 500 });
			}

			config = created;
		}

		return json({
			success: true,
			config: {
				id: config.id,
				userId: config.user_id,
				assistantType: config.assistant_type,
				isEnabled: config.is_enabled,
				isActive: config.is_active,
				exchangeCount: config.exchange_count,
				createdAt: config.created_at,
				updatedAt: config.updated_at
			}
		});
	} catch (error) {
		console.error('Error updating configuration:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
