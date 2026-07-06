import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';

export type Database = {
	public: {
		Tables: {
			verified_vibe_users: {
				Row: {
					id: string;
					gender: 'man' | 'woman' | 'prefer_not_to_say';
					archetype: string;
					first_name: string;
					age: number;
					city: string;
					avatar_url: string | null;
					about: string | null;
					looking: string | null;
					trust_score: number;
					preferences: Record<string, unknown> | null;
					hard_nos: string[] | null;
					is_seed: boolean;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					gender: 'man' | 'woman' | 'prefer_not_to_say';
					archetype: string;
					first_name: string;
					age: number;
					city: string;
					avatar_url?: string | null;
					about?: string | null;
					looking?: string | null;
					trust_score?: number;
					preferences?: Record<string, unknown> | null;
					hard_nos?: string[] | null;
					is_seed?: boolean;
					created_at?: string;
					updated_at?: string;
				};
				Update: Partial<Database['public']['Tables']['verified_vibe_users']['Insert']>;
				Relationships: [];
			};
			verified_vibe_likes: {
				Row: {
					id: string;
					user_id: string;
					liked_user_id: string;
					created_at: string;
				};
				Insert: {
					id?: string;
					user_id: string;
					liked_user_id: string;
					created_at?: string;
				};
				Update: Partial<Database['public']['Tables']['verified_vibe_likes']['Insert']>;
				Relationships: [];
			};
			verified_vibe_passes: {
				Row: {
					id: string;
					user_id: string;
					passed_user_id: string;
					reason: string;
					created_at: string;
				};
				Insert: {
					id?: string;
					user_id: string;
					passed_user_id: string;
					reason?: string;
					created_at?: string;
				};
				Update: Partial<Database['public']['Tables']['verified_vibe_passes']['Insert']>;
				Relationships: [];
			};
			verified_vibe_matches: {
				Row: {
					id: string;
					user1_id: string;
					user2_id: string;
					status: 'pending' | 'mutual' | 'rejected';
					ai_bestie_active: boolean;
					user1_last_read_at: string | null;
					user2_last_read_at: string | null;
					created_at: string;
				};
				Insert: {
					id?: string;
					user1_id: string;
					user2_id: string;
					status?: 'pending' | 'mutual' | 'rejected';
					ai_bestie_active?: boolean;
					user1_last_read_at?: string | null;
					user2_last_read_at?: string | null;
					created_at?: string;
				};
				Update: Partial<Database['public']['Tables']['verified_vibe_matches']['Insert']>;
				Relationships: [];
			};
			verified_vibe_messages: {
				Row: {
					id: string;
					match_id: string;
					sender_id: string;
					content: string;
					is_ai: boolean;
					ai_signal: string | null;
					ai_read: string | null;
					created_at: string;
				};
				Insert: {
					id?: string;
					match_id: string;
					sender_id: string;
					content: string;
					is_ai?: boolean;
					ai_signal?: string | null;
					ai_read?: string | null;
					created_at?: string;
				};
				Update: Partial<Database['public']['Tables']['verified_vibe_messages']['Insert']>;
				Relationships: [];
			};
			ai_qa_reviews: {
				Row: {
					id: string;
					match_id: string | null;
					advisor_chat_id: string | null;
					voice_call_id: string | null;
					reviewer: string;
					score_accuracy: number | null;
					score_tone: number | null;
					score_safety: number | null;
					score_helpfulness: number | null;
					flagged_message_ids: unknown[];
					comments: string | null;
					status: string;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					match_id?: string | null;
					advisor_chat_id?: string | null;
					voice_call_id?: string | null;
					reviewer: string;
					score_accuracy?: number | null;
					score_tone?: number | null;
					score_safety?: number | null;
					score_helpfulness?: number | null;
					flagged_message_ids?: unknown[];
					comments?: string | null;
					status?: string;
					created_at?: string;
					updated_at?: string;
				};
				Update: Partial<Database['public']['Tables']['ai_qa_reviews']['Insert']>;
				Relationships: [];
			};
			ai_assistant_advisor_chats: {
				Row: {
					id: string;
					user_id: string;
					assistant_type: string;
					messages: unknown[];
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					user_id: string;
					assistant_type: string;
					messages?: unknown[];
					created_at?: string;
					updated_at?: string;
				};
				Update: Partial<Database['public']['Tables']['ai_assistant_advisor_chats']['Insert']>;
				Relationships: [];
			};
			verified_vibe_typing_indicators: {
				Row: {
					id: string;
					match_id: string;
					user_id: string;
					created_at: string;
				};
				Insert: {
					id?: string;
					match_id: string;
					user_id: string;
					created_at?: string;
				};
				Update: Partial<Database['public']['Tables']['verified_vibe_typing_indicators']['Insert']>;
				Relationships: [];
			};
			ai_assistant_profiles: {
				Row: {
					id: string;
					user_id: string;
					profile_type: 'preferences' | 'personality';
					data: Record<string, unknown>;
					version: number;
					reason: string;
					created_at: string;
				};
				Insert: {
					id?: string;
					user_id: string;
					profile_type: 'preferences' | 'personality';
					data: Record<string, unknown>;
					version: number;
					reason?: string;
					created_at?: string;
				};
				Update: Partial<{
					id?: string;
					user_id: string;
					profile_type: 'preferences' | 'personality';
					data: Record<string, unknown>;
					version: number;
					reason?: string;
					created_at?: string;
				}>;
				Relationships: [];
			};
			book_chunks: {
				Row: {
					id: string;
					content: string;
					chapter: string;
					chunk_index: number;
					embedding: number[];
				};
				Insert: {
					content: string;
					chapter: string;
					chunk_index: number;
					embedding: number[];
				};
				Update: Partial<Database['public']['Tables']['book_chunks']['Insert']>;
				Relationships: [];
			};
			female_profiles: {
				Row: {
					id: string;
					user_id: string | null;
					session_id: string;
					display_name: string | null;
					age_range: string | null;
					city: string | null;
					intent: string | null;
					approved_for_matching: boolean;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					user_id?: string | null;
					session_id: string;
					display_name?: string | null;
					age_range?: string | null;
					city?: string | null;
					intent?: string | null;
					approved_for_matching?: boolean;
				};
				Update: Partial<Database['public']['Tables']['female_profiles']['Insert']>;
				Relationships: [];
			};
			female_profile_photos: {
				Row: {
					id: string;
					profile_id: string;
					client_id: string | null;
					file_name: string;
					storage_path: string | null;
					preview_url: string | null;
					story_role: 'lead' | 'warmth' | 'lifestyle' | 'conversation' | 'social';
					note: string;
					sort_order: number;
					created_at: string;
				};
				Insert: {
					profile_id: string;
					client_id?: string | null;
					file_name: string;
					storage_path?: string | null;
					preview_url?: string | null;
					story_role: 'lead' | 'warmth' | 'lifestyle' | 'conversation' | 'social';
					note?: string;
					sort_order?: number;
				};
				Update: Partial<Database['public']['Tables']['female_profile_photos']['Insert']>;
				Relationships: [];
			};
			female_profile_answers: {
				Row: {
					id: string;
					profile_id: string;
					client_id: string | null;
					prompt: string;
					answer: string;
					category: 'self' | 'photos' | 'fantasy' | 'boundaries' | 'lifestyle';
					sort_order: number;
					created_at: string;
				};
				Insert: {
					profile_id: string;
					client_id?: string | null;
					prompt: string;
					answer: string;
					category: 'self' | 'photos' | 'fantasy' | 'boundaries' | 'lifestyle';
					sort_order?: number;
				};
				Update: Partial<Database['public']['Tables']['female_profile_answers']['Insert']>;
				Relationships: [];
			};
			female_generated_profiles: {
				Row: {
					id: string;
					profile_id: string;
					headline: string;
					public_intro: string;
					photo_story: string[];
					what_she_values: string[];
					conversation_hooks: string[];
					private_match_brief: string;
					compatibility_signals: string[];
					preference_model: Record<string, unknown>;
					approved_for_matching: boolean;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					profile_id: string;
					headline: string;
					public_intro: string;
					photo_story?: string[];
					what_she_values?: string[];
					conversation_hooks?: string[];
					private_match_brief: string;
					compatibility_signals?: string[];
					preference_model?: Record<string, unknown>;
					approved_for_matching?: boolean;
				};
				Update: Partial<Database['public']['Tables']['female_generated_profiles']['Insert']>;
				Relationships: [];
			};
			female_profile_audit_events: {
				Row: {
					id: string;
					profile_id: string | null;
					session_id: string;
					event_name: string;
					metadata: Record<string, unknown>;
					created_at: string;
				};
				Insert: {
					profile_id?: string | null;
					session_id: string;
					event_name: string;
					metadata?: Record<string, unknown>;
				};
				Update: Partial<Database['public']['Tables']['female_profile_audit_events']['Insert']>;
				Relationships: [];
			};
			ai_assistant_match_configs: {
				Row: {
					id: string;
					user_id: string;
					match_id: string;
					assistant_type: 'bestie' | 'wingman';
					is_active: boolean;
					auto_impersonate: boolean;
					exchange_count: number;
					last_exchange_at: string | null;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					user_id: string;
					match_id: string;
					assistant_type: 'bestie' | 'wingman';
					is_active?: boolean;
					auto_impersonate?: boolean;
					exchange_count?: number;
					last_exchange_at?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Update: Partial<Database['public']['Tables']['ai_assistant_match_configs']['Insert']>;
				Relationships: [];
			};
			ai_assistant_conversations: {
				Row: {
					id: string;
					user_id: string;
					match_conversation_id: string;
					assistant_type: 'bestie' | 'wingman';
					messages: unknown[];
					is_active: boolean;
					exchange_count: number;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					user_id: string;
					match_conversation_id: string;
					assistant_type: 'bestie' | 'wingman';
					messages?: unknown[];
					is_active?: boolean;
					exchange_count?: number;
					created_at?: string;
					updated_at?: string;
				};
				Update: Partial<Database['public']['Tables']['ai_assistant_conversations']['Insert']>;
				Relationships: [];
			};
			ai_assistant_summaries: {
				Row: {
					id: string;
					user_id: string;
					summary_data: Record<string, unknown>;
					created_at: string;
				};
				Insert: {
					id?: string;
					user_id: string;
					summary_data: Record<string, unknown>;
					created_at?: string;
				};
				Update: Partial<Database['public']['Tables']['ai_assistant_summaries']['Insert']>;
				Relationships: [];
			};
			verified_vibe_action_history: {
				Row: {
					id: string;
					user_id: string;
					action_type: string;
					profile_id: string;
					created_at: string;
				};
				Insert: {
					id?: string;
					user_id: string;
					action_type: string;
					profile_id: string;
					created_at?: string;
				};
				Update: Partial<Database['public']['Tables']['verified_vibe_action_history']['Insert']>;
				Relationships: [];
			};
			verified_vibe_analytics: {
				Row: {
					id: string;
					user_id: string;
					event_type: string;
					profile_id: string | null;
					metadata: Record<string, unknown>;
					created_at: string;
				};
				Insert: {
					id?: string;
					user_id: string;
					event_type: string;
					profile_id?: string | null;
					metadata?: Record<string, unknown>;
					created_at?: string;
				};
				Update: Partial<Database['public']['Tables']['verified_vibe_analytics']['Insert']>;
				Relationships: [];
			};
			ai_bestie_feedback: {
				Row: {
					id: string;
					user_id: string;
					feedback_type: string;
					message_content: string | null;
					created_at: string;
				};
				Insert: {
					id?: string;
					user_id: string;
					feedback_type: string;
					message_content?: string | null;
					created_at?: string;
				};
				Update: Partial<Database['public']['Tables']['ai_bestie_feedback']['Insert']>;
				Relationships: [];
			};
			attention_messages: {
				Row: {
					id: string;
					sender_id: string;
					recipient_id: string;
					message_type: string;
					content: string;
					reply_content: string | null;
					reply_sent_at: string | null;
					is_read: boolean;
					created_at: string;
				};
				Insert: {
					id?: string;
					sender_id: string;
					recipient_id: string;
					message_type: string;
					content: string;
					reply_content?: string | null;
					reply_sent_at?: string | null;
					is_read?: boolean;
					created_at?: string;
				};
				Update: Partial<Database['public']['Tables']['attention_messages']['Insert']>;
				Relationships: [];
			};
			device_tokens: {
				Row: {
					id: string;
					user_id: string;
					token: string;
					platform: 'android' | 'ios';
					created_at: string;
				};
				Insert: {
					id?: string;
					user_id: string;
					token: string;
					platform: 'android' | 'ios';
					created_at?: string;
				};
				Update: Partial<Database['public']['Tables']['device_tokens']['Insert']>;
				Relationships: [];
			};
		};
		Functions: {
			match_book_chunks: {
				Args: {
					query_embedding: number[];
					match_count: number;
				};
				Returns: Array<{
					content: string;
					chapter: string;
					similarity: number;
				}>;
			};
		};
		Views: Record<string, never>;
		Enums: Record<string, never>;
		CompositeTypes: Record<string, never>;
	};
};

let client: ReturnType<typeof createClient<Database>> | null = null;

export function getSupabase(): ReturnType<typeof createClient<Database>> {
	if (!client) {
		client = createClient<Database>(env.SUPABASE_URL as string, env.SUPABASE_SERVICE_KEY as string);
	}
	return client!;
}
