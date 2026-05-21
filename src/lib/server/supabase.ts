import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';

export type Database = {
	public: {
		Tables: {
			verified_vibe_users: {
				Row: {
					id: string;
					gender: 'man' | 'woman' | 'prefer_not_to_say';
					archetype: 'casual_man' | 'marriage_minded_man' | 'spoilt_woman' | 'safety_first_woman';
					first_name: string;
					age: number;
					city: string;
					avatar_url: string | null;
					about: string | null;
					looking: string | null;
					trust_score: number;
					preferences: Record<string, unknown> | null;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					gender: 'man' | 'woman' | 'prefer_not_to_say';
					archetype: 'casual_man' | 'marriage_minded_man' | 'spoilt_woman' | 'safety_first_woman';
					first_name: string;
					age: number;
					city: string;
					avatar_url?: string | null;
					about?: string | null;
					looking?: string | null;
					trust_score?: number;
					preferences?: Record<string, unknown> | null;
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
					created_at: string;
				};
				Insert: {
					id?: string;
					user_id: string;
					passed_user_id: string;
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
					created_at: string;
				};
				Insert: {
					id?: string;
					user1_id: string;
					user2_id: string;
					status?: 'pending' | 'mutual' | 'rejected';
					ai_bestie_active?: boolean;
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
					created_at: string;
				};
				Insert: {
					id?: string;
					match_id: string;
					sender_id: string;
					content: string;
					created_at?: string;
				};
				Update: Partial<Database['public']['Tables']['verified_vibe_messages']['Insert']>;
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
		client = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
	}
	return client;
}
