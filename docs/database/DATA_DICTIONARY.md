# Data Dictionary

Database: Supabase (PostgreSQL). All timestamps are `timestamptz` unless noted. All `id` columns are `uuid` with `gen_random_uuid()` default unless noted. Row-level security (RLS) is enabled on most tables; service role bypasses it.

---

## Core

### `app_users`
Legacy user table. Current auth uses `auth.users` (Supabase built-in); this table may be used for display metadata.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `external_auth_id` | uuid | Unique. Links to auth provider. |
| `display_name` | text | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

---

## Female Profile Pipeline
Intake → answers/photos → AI-generated output. Raw intake (`female_profiles`, `female_profile_answers`, `female_profile_photos`) is kept separate from the shareable generated output (`female_generated_profiles`).

### `female_profiles`
One row per intake session. The root record for the female profile pipeline.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → `app_users.id` | |
| `session_id` | text | Unique. Client-assigned session token. |
| `display_name` | text | |
| `age_range` | text | e.g. `"25-30"` |
| `city` | text | |
| `intent` | text | What she's looking for. |
| `approved_for_matching` | boolean | Default false. Set true when profile passes review. |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### `female_profile_photos`
Photos attached to a profile. Each photo has a story role that determines how it's used in the generated profile.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `profile_id` | uuid FK → `female_profiles.id` | |
| `client_id` | text | Client-side dedup key. |
| `file_name` | text | |
| `storage_path` | text | Path in `profile-uploads` storage bucket. |
| `preview_url` | text | Signed URL (not permanent). |
| `story_role` | text | `lead` \| `warmth` \| `lifestyle` \| `conversation` \| `social` |
| `note` | text | Contextual note for this photo. |
| `sort_order` | integer | Display order. |
| `created_at` | timestamptz | |

### `female_profile_answers`
Free-text answers to intake prompts, grouped by category.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `profile_id` | uuid FK → `female_profiles.id` | |
| `client_id` | text | Client-side dedup key. |
| `prompt` | text | The prompt/question shown to the user. |
| `answer` | text | |
| `category` | text | `self` \| `photos` \| `fantasy` \| `boundaries` \| `lifestyle` |
| `sort_order` | integer | |
| `created_at` | timestamptz | |

### `female_generated_profiles`
AI-generated shareable profile, derived from `female_profile_answers` and `female_profile_photos`. One-to-one with `female_profiles`.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `profile_id` | uuid FK → `female_profiles.id` | |
| `headline` | text | Short profile headline. |
| `public_intro` | text | What is shown to potential matches. |
| `photo_story` | jsonb | Array of photo role assignments with captions. |
| `what_she_values` | jsonb | Array of value statements. |
| `conversation_hooks` | jsonb | Array of icebreaker topics. |
| `private_match_brief` | text | Private context shown only to matched males. |
| `compatibility_signals` | jsonb | Array of compatibility markers. |
| `preference_model` | jsonb | Structured preference data used by matching. |
| `approved_for_matching` | boolean | Default false. Copied from parent `female_profiles` on approval. |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### `female_profile_audit_events`
Append-only audit log for profile lifecycle events (e.g. submission, approval, rejection).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `profile_id` | uuid FK → `female_profiles.id` | |
| `session_id` | text | |
| `event_name` | text | e.g. `"profile_submitted"`, `"approved"` |
| `metadata` | jsonb | Event-specific payload. |
| `created_at` | timestamptz | |

---

## Verified Vibe (Matching)

### `verified_vibe_users`
Core user record for the Verified Vibe matching feature. References `auth.users` via application logic; not a direct FK.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `gender` | text | `man` \| `woman` \| `prefer_not_to_say` |
| `archetype` | text | See archetype values below. |
| `first_name` | text | |
| `age` | integer | |
| `city` | text | |
| `avatar_url` | text | |
| `about` | text | Bio/about section. |
| `looking` | text | What the user is looking for. |
| `trust_score` | integer | Default 0. Increases with verified artifacts. |
| `preferences` | jsonb | Dating preferences, values, lifestyle (set during onboarding). |
| `profile_section_stale` | boolean | Set true by trigger when `ai_assistant_profiles` is updated; cleared after regeneration. |
| `here_for_title` | text | Male profiles: "Here For" display title. |
| `here_for_desc` | text | Male profiles: "Here For" description. |
| `hard_nos` | jsonb | Male profiles: array of deal-breakers. |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**Archetype values (male):** `casual_generous_man`, `hopeless_romantic_man`, `rebound_healing_man`, `untouched_heart_man`, `forever_focused_man`, `traditional_matrimony_man`

**Archetype values (female):** `spoiled_casual_woman`, `hopeless_romantic_woman`, `rebound_healing_woman`, `untouched_heart_woman`, `forever_focused_woman`, `traditional_matrimony_woman`

### `verified_vibe_verification`
One row per verification step per user. Steps must all reach `completed` before a user is fully verified.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → `verified_vibe_users.id` | |
| `step` | text | `id` \| `liveness` \| `photos` \| `spending_or_qa` |
| `status` | text | `pending` \| `completed` \| `failed` |
| `data` | jsonb | Step-specific result data. |
| `completed_at` | timestamptz | Null until step completes. |
| `created_at` | timestamptz | |

### `verified_vibe_likes`
Records when user A likes user B. A mutual like creates a match (handled at application level).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → `verified_vibe_users.id` | The user who liked. |
| `liked_user_id` | uuid FK → `verified_vibe_users.id` | The user who was liked. |
| `created_at` | timestamptz | |

Unique constraint: `(user_id, liked_user_id)`.

### `verified_vibe_passes`
Records when user A passes on user B. Passed users are excluded from future discover feeds.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → `verified_vibe_users.id` | |
| `passed_user_id` | uuid FK → `verified_vibe_users.id` | |
| `created_at` | timestamptz | |

Unique constraint: `(user_id, passed_user_id)`.

### `verified_vibe_matches`
Created when two users mutually like each other. The source of truth for active conversations.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user1_id` | uuid FK → `verified_vibe_users.id` | |
| `user2_id` | uuid FK → `verified_vibe_users.id` | |
| `status` | text | `pending` \| `mutual` \| `rejected`. Default `pending`. |
| `ai_bestie_active` | boolean | True when the female user has activated AI Bestie interview mode. The male sees an intro card. |
| `user1_last_read_at` | timestamptz | Used to compute unread counts. |
| `user2_last_read_at` | timestamptz | Used to compute unread counts. |
| `created_at` | timestamptz | |

### `verified_vibe_messages`
Chat messages within a match. Realtime-enabled via Supabase Realtime.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `match_id` | uuid FK → `verified_vibe_matches.id` | |
| `sender_id` | uuid FK → `verified_vibe_users.id` | |
| `content` | text | |
| `created_at` | timestamptz | |

### `verified_vibe_typing_indicators`
Ephemeral typing state. One row per (match, user); upserted while typing, deleted on stop. Realtime-enabled.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `match_id` | uuid FK → `verified_vibe_matches.id` | |
| `user_id` | uuid FK → `verified_vibe_users.id` | |
| `created_at` | timestamptz | |

Unique constraint: `(match_id, user_id)`.

---

## AI Assistants

AI Bestie (for female users) and AI Wingman (for male users). Both share these tables, distinguished by `assistant_type`.

### `ai_assistant_profiles`
Versioned personality/preference profiles. Append-only — never updated in place. To get the current profile: `ORDER BY version DESC LIMIT 1`. Inserting or updating `data` fires the `trg_profile_section_staleness` trigger on `verified_vibe_users`.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → `auth.users.id` | |
| `profile_type` | text | `preferences` (female) \| `personality` (male) |
| `data` | jsonb | Full profile content. |
| `version` | integer | Incremented with each write. |
| `reason` | text | Why this version was created. |
| `is_current` | boolean | Convenience flag; canonical truth is max version. |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

Unique constraint: `(user_id, profile_type, version)`.

### `ai_assistant_conversations`
One row per (user, match, assistant type). Stores the full message history for the AI Bestie/Wingman sidebar conversation.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → `auth.users.id` | |
| `match_conversation_id` | text | FK-by-convention to `verified_vibe_matches.id` (stored as text). |
| `assistant_type` | text | `bestie` \| `wingman` |
| `messages` | jsonb | Array of `{role, content}` message objects. |
| `is_active` | boolean | Whether this session is open. |
| `exchange_count` | integer | AI loop prevention counter. Resets per session. |
| `last_exchange_at` | timestamp | Used by loop prevention logic. |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

Unique constraint: `(user_id, match_conversation_id, assistant_type)`.

### `ai_assistant_summaries`
One row per user per day. Aggregated daily summary of all matches with insights and recommended next moves.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → `auth.users.id` | |
| `summary_data` | jsonb | Aggregated insights, compatibility signals, next-move recommendations. |
| `created_at` | timestamp | |

Unique constraint: `(user_id, DATE(created_at))`.

### `ai_assistant_configs`
Per-user, per-assistant settings (enabled/disabled, rate limits, etc.).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → `auth.users.id` | |
| `assistant_type` | text | `bestie` \| `wingman` |
| `config_data` | jsonb | Assistant-specific settings object. |
| `is_enabled` | boolean | Master kill-switch per user per assistant. |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

Unique constraint: `(user_id, assistant_type)`.

### `ai_assistant_match_configs`
Per-match, per-assistant state. Tracks whether the assistant is active for a specific conversation and controls auto-impersonation for Wingman.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → `auth.users.id` | |
| `match_id` | text | References `verified_vibe_matches.id` (stored as text). |
| `assistant_type` | text | `bestie` \| `wingman` |
| `is_active` | boolean | Whether this assistant is active for this match. |
| `auto_impersonate` | boolean | Wingman only: auto-send responses after 20+ messages. |
| `exchange_count` | integer | AI loop prevention counter for this match. |
| `last_exchange_at` | timestamp | |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

Unique constraint: `(user_id, match_id, assistant_type)`.

### `ai_bestie_feedback`
Thumbs up / down ratings on individual AI Bestie responses. Used to improve response quality over time.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → `verified_vibe_users.id` | |
| `feedback_type` | text | `positive` \| `negative` |
| `message_content` | text | The AI message that was rated. |
| `created_at` | timestamptz | |

---

## Engagement

### `attention_messages`
Pre-match messages sent from the discover feed. "Secret Admirer" (female → male) or "Craving Attention" (male → female). One message per sender–recipient pair; recipient can reply once.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `sender_id` | uuid FK → `verified_vibe_users.id` | |
| `recipient_id` | uuid FK → `verified_vibe_users.id` | |
| `message_type` | text | `secret_admirer` \| `craving_attention` |
| `content` | text | The message content. |
| `reply_content` | text | Recipient's one-time reply. Null until replied. |
| `reply_sent_at` | timestamptz | |
| `is_read` | boolean | Whether recipient has read the message. |
| `created_at` | timestamptz | |

Unique constraint: `(sender_id, recipient_id)`.

### `profile_tips`
Anonymous feedback left on profiles viewed in discover. Submitter identity is never stored — anonymity is a product guarantee.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `target_user_id` | uuid FK → `verified_vibe_users.id` | The profile being tipped. |
| `submitted_by_gender` | text | `man` \| `woman` \| `prefer_not_to_say` |
| `tip_tags` | text[] | Array of tag strings, e.g. `['handsome', 'trustworthy-vibes']`. |
| `tip_text` | text | Optional freetext, max 280 chars. |
| `created_at` | timestamptz | |

Only accessible via service role. Individual tips are never surfaced to users — only aggregates.

---

## Trust & Uploads

### `user_artifacts`
Images/screenshots uploaded by users as evidence for trust score claims (e.g. wealth, travel, fitness). Referenced by AI Bestie and Wingman prompts. Each artifact awards `trust_points` toward `verified_vibe_users.trust_score`.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → `verified_vibe_users.id` | |
| `storage_url` | text | URL in Supabase storage. |
| `file_name` | text | |
| `mime_type` | text | Default `image/jpeg`. |
| `claim_tag` | text | `wealthy` \| `well_traveled` \| `fitness` \| `general` |
| `description` | text | Short label assigned by user or AI. |
| `trust_points` | integer | Default 5. Added to trust score at application level. |
| `created_at` | timestamptz | |

---

## Notifications

### `device_tokens`
FCM push notification tokens. One token per user per platform, enforced by unique constraint.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → `auth.users.id` | |
| `token` | varchar(256) | FCM token. |
| `platform` | varchar(7) | `android` \| `ios` |
| `created_at` | timestamptz | |

Unique constraint: `(user_id, platform)`.

---

## Knowledge Base

### `book_chunks`
Chunked content from the coaching knowledge base, embedded for RAG (retrieval-augmented generation). Embeddings produced by Voyage AI `voyage-3-lite` (512 dimensions).

| Column | Type | Notes |
|---|---|---|
| `id` | bigserial PK | |
| `content` | text | The chunk text. |
| `chapter` | text | Source chapter. Default `Unknown`. |
| `chunk_index` | integer | Position of this chunk within its chapter. |
| `embedding` | vector(512) | pgvector column; indexed with IVFFlat cosine ops. |
| `created_at` | timestamptz | |

Similarity search: use the `match_book_chunks(query_embedding, match_count)` SQL function.

---

## Key Relationships

```
auth.users
  ├── verified_vibe_users (application-level join on user_id)
  │     ├── verified_vibe_verification
  │     ├── verified_vibe_likes / verified_vibe_passes
  │     ├── verified_vibe_matches (as user1 or user2)
  │     │     └── verified_vibe_messages
  │     │     └── verified_vibe_typing_indicators
  │     ├── attention_messages (as sender or recipient)
  │     ├── profile_tips (as target)
  │     ├── user_artifacts
  │     └── ai_bestie_feedback
  ├── ai_assistant_profiles
  ├── ai_assistant_conversations
  ├── ai_assistant_summaries
  ├── ai_assistant_configs
  ├── ai_assistant_match_configs
  └── device_tokens

app_users (legacy)
  └── female_profiles
        ├── female_profile_photos
        ├── female_profile_answers
        ├── female_generated_profiles
        └── female_profile_audit_events
```
