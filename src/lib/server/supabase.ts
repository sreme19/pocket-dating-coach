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
					/**
					 * A visitor the /aibestie landing page minted on his first message,
					 * before any signup. Must be excluded from signup counts — otherwise
					 * the ad funnel reports conversions that are not people.
					 */
					is_provisional: boolean;
					/** Topics the owner wants every Bestie to cover (G-27). Not a preference weight. */
					always_ask_topics: string[] | null;
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
					is_provisional?: boolean;
					always_ask_topics?: string[] | null;
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
					status: 'pending' | 'mutual' | 'rejected' | 'unmatched' | 'blocked' | 'expired';
					source: string | null;
					ai_bestie_active: boolean;
					proof_request: Record<string, unknown> | null;
					bestie_checklist: Record<string, unknown> | null;
					user1_last_read_at: string | null;
					user2_last_read_at: string | null;
					expired_at: string | null;
					replaced_by_match_id: string | null;
					handoff_nudge_stage: number;
					/** Man-facing gap-bar percentage (0–100, one decimal). Monotonic floor — display state only, never an input to scoring. NULL = never computed. */
					gap_bar_percent: number | null;
					/** Follow-up question rounds spent on this match (0–2, G-27). Counted at send. */
					bestie_question_rounds: number;
					/** Highest question round Bestie has already announced to him (G-27). */
					bestie_round_announced: number;
					created_at: string;
				};
				Insert: {
					id?: string;
					user1_id: string;
					user2_id: string;
					status?: 'pending' | 'mutual' | 'rejected' | 'unmatched' | 'blocked' | 'expired';
					source?: string | null;
					ai_bestie_active?: boolean;
					proof_request?: Record<string, unknown> | null;
					bestie_checklist?: Record<string, unknown> | null;
					user1_last_read_at?: string | null;
					user2_last_read_at?: string | null;
					expired_at?: string | null;
					replaced_by_match_id?: string | null;
					handoff_nudge_stage?: number;
					gap_bar_percent?: number | null;
					bestie_question_rounds?: number;
					bestie_round_announced?: number;
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
			advisor_messages: {
				Row: {
					id: string;
					user_id: string;
					assistant_type: string;
					role: string;
					kind: string;
					content: string;
					payload: unknown | null;
					greeting_id: string | null;
					task_id: string | null;
					created_at: string;
					seq: number;
				};
				Insert: {
					id?: string;
					user_id: string;
					assistant_type: string;
					role: string;
					kind?: string;
					content: string;
					payload?: unknown | null;
					greeting_id?: string | null;
					task_id?: string | null;
					created_at?: string;
				};
				Update: Partial<Database['public']['Tables']['advisor_messages']['Insert']>;
				Relationships: [];
			};
			advisor_read_state: {
				Row: {
					user_id: string;
					assistant_type: string;
					last_read_at: string;
					updated_at: string;
				};
				Insert: {
					user_id: string;
					assistant_type: string;
					last_read_at?: string;
					updated_at?: string;
				};
				Update: Partial<Database['public']['Tables']['advisor_read_state']['Insert']>;
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
			job_applications: {
				Row: {
					id: string;
					role_slug: string;
					role_title: string;
					name: string;
					phone: string;
					email: string | null;
					cover: string | null;
					resume_filename: string | null;
					resume_path: string | null;
					resume_mime: string | null;
					resume_size: number | null;
					email_sent: boolean;
					created_at: string;
				};
				Insert: {
					id?: string;
					role_slug?: string;
					role_title?: string;
					name: string;
					phone: string;
					email?: string | null;
					cover?: string | null;
					resume_filename?: string | null;
					resume_path?: string | null;
					resume_mime?: string | null;
					resume_size?: number | null;
					email_sent?: boolean;
					created_at?: string;
				};
				Update: Partial<Database['public']['Tables']['job_applications']['Insert']>;
				Relationships: [];
			};
			/** Server-side record of /get store-button taps. See marketing-conversions.ts. */
			marketing_store_clicks: {
				Row: {
					id: string;
					event_id: string;
					visit_id: string | null;
					page: string | null;
					cta: string;
					campaign: string | null;
					utm: Record<string, string>;
					user_agent: string | null;
					referrer: string | null;
					country: string | null;
					city: string | null;
					region: string | null;
					snap_forwarded: boolean | null;
					meta_forwarded: boolean | null;
					forward_error: string | null;
					created_at: string;
				};
				Insert: {
					id?: string;
					event_id: string;
					visit_id?: string | null;
					page?: string | null;
					cta: string;
					campaign?: string | null;
					utm?: Record<string, string>;
					user_agent?: string | null;
					referrer?: string | null;
					country?: string | null;
					city?: string | null;
					region?: string | null;
					snap_forwarded?: boolean | null;
					meta_forwarded?: boolean | null;
					forward_error?: string | null;
					created_at?: string;
				};
				Update: Partial<Database['public']['Tables']['marketing_store_clicks']['Insert']>;
				Relationships: [];
			};
			/** /aibestie landing-page conversations. See aibestie-session.ts. */
			aibestie_lp_sessions: {
				Row: {
					id: string;
					user_id: string | null;
					owner_id: string;
					match_id: string | null;
					ip_hash: string | null;
					user_agent: string | null;
					turns: number;
					bar_percent: number;
					claim_code: string | null;
					claimed_by_user_id: string | null;
					claimed_at: string | null;
					utm: Record<string, string> | null;
					first_message_at: string | null;
					cta_shown_at: string | null;
					cta_clicked_at: string | null;
					token_hash: string | null;
					materialized_at: string | null;
					welcome_matched_at: string | null;
					created_at: string;
					last_active_at: string;
				};
				Insert: {
					id?: string;
					user_id?: string | null;
					owner_id: string;
					match_id?: string | null;
					ip_hash?: string | null;
					user_agent?: string | null;
					turns?: number;
					bar_percent?: number;
					claim_code?: string | null;
					claimed_by_user_id?: string | null;
					claimed_at?: string | null;
					utm?: Record<string, string> | null;
					first_message_at?: string | null;
					cta_shown_at?: string | null;
					cta_clicked_at?: string | null;
					token_hash?: string | null;
					materialized_at?: string | null;
					welcome_matched_at?: string | null;
					created_at?: string;
					last_active_at?: string;
				};
				Update: Partial<Database['public']['Tables']['aibestie_lp_sessions']['Insert']>;
				Relationships: [];
			};
			/** Daily ad spend per network/campaign. See ad-spend/sync.ts. */
			ad_spend_daily: {
				Row: {
					network: string;
					date: string;
					campaign_id: string;
					campaign_name: string | null;
					ad_set_id: string;
					ad_set_name: string | null;
					creative_id: string;
					creative_name: string | null;
					spend: string;
					currency: string;
					impressions: number;
					clicks: number;
					network_conversions: number;
					account_timezone: string | null;
					fetched_at: string;
					source: string;
					status: string | null;
				};
				Insert: {
					network: string;
					date: string;
					campaign_id?: string;
					campaign_name?: string | null;
					ad_set_id?: string;
					ad_set_name?: string | null;
					creative_id?: string;
					creative_name?: string | null;
					spend?: string | number;
					currency: string;
					impressions?: number;
					clicks?: number;
					network_conversions?: number;
					account_timezone?: string | null;
					fetched_at?: string;
					source?: string;
					status?: string | null;
				};
				Update: Partial<Database['public']['Tables']['ad_spend_daily']['Insert']>;
				Relationships: [];
			};
			/**
			 * Network-reported delivery demographics per campaign-day.
			 * AGGREGATE BUCKETS ONLY — never per person. See ad-spend/sync.ts.
			 */
			ad_demographics_daily: {
				Row: {
					network: string;
					date: string;
					campaign_id: string;
					campaign_name: string | null;
					dimension: string;
					bucket: string;
					spend: string;
					currency: string;
					impressions: number;
					clicks: number;
					account_timezone: string | null;
					fetched_at: string;
					source: string;
				};
				Insert: {
					network: string;
					date: string;
					campaign_id?: string;
					campaign_name?: string | null;
					dimension: string;
					bucket: string;
					spend?: string | number;
					currency: string;
					impressions?: number;
					clicks?: number;
					account_timezone?: string | null;
					fetched_at?: string;
					source?: string;
				};
				Update: Partial<Database['public']['Tables']['ad_demographics_daily']['Insert']>;
				Relationships: [];
			};
			/** Daily FX rates for reporting spend in INR or USD. See ad-spend/sync.ts. */
			ad_fx_rates: {
				Row: {
					date: string;
					base: string;
					quote: string;
					rate: string;
					source: string;
					fetched_at: string;
				};
				Insert: {
					date: string;
					base: string;
					quote: string;
					rate: string | number;
					source?: string;
					fetched_at?: string;
				};
				Update: Partial<Database['public']['Tables']['ad_fx_rates']['Insert']>;
				Relationships: [];
			};
			/** Which advert produced each member. See user-acquisition.ts. */
			user_acquisition: {
				Row: {
					user_id: string;
					network: string | null;
					medium: string | null;
					campaign: string | null;
					ad_set: string | null;
					creative: string | null;
					utm: Record<string, string>;
					referrer_raw: string | null;
					landing_page: string | null;
					claim_code: string | null;
					platform: string | null;
					captured_at: string | null;
					created_at: string;
				};
				Insert: {
					user_id: string;
					network?: string | null;
					medium?: string | null;
					campaign?: string | null;
					ad_set?: string | null;
					creative?: string | null;
					utm?: Record<string, string>;
					referrer_raw?: string | null;
					landing_page?: string | null;
					claim_code?: string | null;
					platform?: string | null;
					captured_at?: string | null;
					created_at?: string;
				};
				Update: Partial<Database['public']['Tables']['user_acquisition']['Insert']>;
				Relationships: [];
			};
			/** Landing page arrivals — the denominator for tap rate. See marketing-page-views.ts. */
			marketing_page_views: {
				Row: {
					id: string;
					visit_id: string;
					page: string;
					campaign: string | null;
					utm: Record<string, string>;
					user_agent: string | null;
					referrer: string | null;
					country: string | null;
					city: string | null;
					region: string | null;
					created_at: string;
				};
				Insert: {
					id?: string;
					visit_id: string;
					page: string;
					campaign?: string | null;
					utm?: Record<string, string>;
					user_agent?: string | null;
					referrer?: string | null;
					country?: string | null;
					city?: string | null;
					region?: string | null;
					created_at?: string;
				};
				Update: Partial<Database['public']['Tables']['marketing_page_views']['Insert']>;
				Relationships: [];
			};
			/**
			 * Contactable leads from the paid landing pages.
			 *
			 * The table has existed since 20260815063021 with a dialer and an email
			 * drip already wired to it, and until now nothing wrote a single row —
			 * /get and /get/w captured no contact at all, which is the gap the ad
			 * research kept flagging. `page` and `audience` are constrained in the
			 * database (see 20260825120000_add_get_w_landing_page.sql); the unions
			 * here mirror those constraints so a bad value fails at compile time
			 * rather than as a 400 from PostgREST on a form the visitor is watching.
			 */
			marketing_leads: {
				Row: {
					id: string;
					visit_id: string | null;
					page: string;
					audience: string | null;
					contact_kind: string;
					whatsapp_e164: string | null;
					email: string | null;
					campaign: string | null;
					utm: Record<string, string>;
					country: string | null;
					city: string | null;
					region: string | null;
					user_agent: string | null;
					status: string;
					note: string | null;
					created_at: string;
					source: string;
					ad_lead_id: string | null;
					ad_form_id: string | null;
					first_name: string | null;
					last_name: string | null;
					ad_campaign_id: string | null;
					ad_group_id: string | null;
					ad_group_name: string | null;
					ad_id: string | null;
					ad_name: string | null;
					submitted_at: string | null;
				};
				Insert: {
					id?: string;
					visit_id?: string | null;
					/**
					 * The two *_lead_form values are reachable ONLY from the webhook routes.
					 * The browser beacons keep their own narrower ALLOWED_PAGES set on
					 * purpose — see 20260829144332, on why widening those would be a bug.
					 */
					page: 'get' | 'get_w' | 'get_photos' | 'aibestie' | 'get_w_apply' | 'snap_lead_form' | 'meta_lead_form';
					audience?: 'man' | 'woman' | null;
					/** 'phone' is a number Snap prefilled, not a WhatsApp opt-in. */
					contact_kind: 'whatsapp' | 'email' | 'phone';
					whatsapp_e164?: string | null;
					email?: string | null;
					campaign?: string | null;
					utm?: Record<string, string>;
					country?: string | null;
					city?: string | null;
					region?: string | null;
					user_agent?: string | null;
					status?: string;
					note?: string | null;
					created_at?: string;
					source?: 'landing_page' | 'snap_lead_form' | 'meta_lead_form';
					ad_lead_id?: string | null;
					ad_form_id?: string | null;
					first_name?: string | null;
					last_name?: string | null;
					ad_campaign_id?: string | null;
					ad_group_id?: string | null;
					ad_group_name?: string | null;
					ad_id?: string | null;
					ad_name?: string | null;
					submitted_at?: string | null;
				};
				Update: Partial<Database['public']['Tables']['marketing_leads']['Insert']>;
				Relationships: [];
			};

			/**
			 * The age answer given on /get/w-apply, the qualification step between
			 * Meta's instant form and the Play handoff.
			 *
			 * Separate from marketing_leads because on that funnel the contact
			 * details never reach us at submit time — they sit in Meta until someone
			 * exports them — so there is no lead row to hang an age off. This holds
			 * Meta's own `ra_lead` id, the band, and the verdict; the export joins to
			 * it. Deliberately carries no contact details: see
			 * 20260828140000_add_get_w_apply_landing_page.sql.
			 *
			 * `age_band` is constrained in the database; the union here mirrors it so
			 * a bad value fails at compile time rather than as a PostgREST 400 on a
			 * page the visitor is watching.
			 */
			marketing_apply_gate: {
				Row: {
					id: string;
					created_at: string;
					ra_lead: string | null;
					visit_id: string | null;
					age_band: string;
					qualified: boolean;
					campaign: string | null;
					utm: Record<string, string>;
					user_agent: string | null;
					country: string | null;
					city: string | null;
					region: string | null;
				};
				Insert: {
					id?: string;
					created_at?: string;
					ra_lead?: string | null;
					visit_id?: string | null;
					age_band: '18-20' | '21-24' | '25-30' | '31+' | 'under-18';
					qualified: boolean;
					campaign?: string | null;
					utm?: Record<string, string>;
					user_agent?: string | null;
					country?: string | null;
					city?: string | null;
					region?: string | null;
				};
				Update: Partial<Database['public']['Tables']['marketing_apply_gate']['Insert']>;
				Relationships: [];
			};
			/**
			 * One row per lead-form submission a network actually delivered.
			 *
			 * The count of leads lives here; the person lives in marketing_leads.
			 * They disagree on purpose: marketing_leads dedupes on phone and
			 * lower(email) so the dialer never calls one person twice, which on
			 * 2026-08-29 silently turned Snap's 9 leads into 7 rows with no error
			 * anywhere. See 20260830120000_create_marketing_lead_submissions.sql.
			 *
			 * Carries no contact details, so it is safe to grant to a read-only
			 * analytics role and safe to write for an under-18 submission.
			 *
			 * `outcome` and `network` are constrained in the database; the unions
			 * here mirror them so a bad value fails at compile time.
			 */
			marketing_lead_submissions: {
				Row: {
					id: string;
					created_at: string;
					network: string;
					ad_lead_id: string;
					ad_form_id: string | null;
					outcome: string;
					campaign: string | null;
					ad_campaign_id: string | null;
					ad_group_id: string | null;
					ad_group_name: string | null;
					ad_id: string | null;
					ad_name: string | null;
					submitted_at: string | null;
				};
				Insert: {
					id?: string;
					created_at?: string;
					network: 'snap_lead_form' | 'meta_lead_form';
					ad_lead_id: string;
					ad_form_id?: string | null;
					outcome: 'stored' | 'duplicate' | 'no_usable_contact' | 'under_18';
					campaign?: string | null;
					ad_campaign_id?: string | null;
					ad_group_id?: string | null;
					ad_group_name?: string | null;
					ad_id?: string | null;
					ad_name?: string | null;
					submitted_at?: string | null;
				};
				Update: Partial<Database['public']['Tables']['marketing_lead_submissions']['Insert']>;
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
