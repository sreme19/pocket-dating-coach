import { createClient } from '@supabase/supabase-js';
import { SUPABASE_SERVICE_KEY, SUPABASE_URL } from '$env/static/private';

export type Database = {
	public: {
		Tables: {
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

export function getSupabase() {
	if (!client) {
		client = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_KEY);
	}
	return client;
}
