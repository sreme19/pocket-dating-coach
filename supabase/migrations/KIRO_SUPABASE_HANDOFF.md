# Supabase Migration Handoff
**Project:** pocket-dating-coach
**Supabase project:** https://stikoktiaxqtcsohcxzp.supabase.co
**Generated:** 2026-05-22

Run every block below in the Supabase SQL editor in the order shown.
All statements use CREATE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS so
they are safe to re-run without error.

---

## STATUS LEGEND
- [LIKELY DONE] — was in an earlier handoff; safe to re-run (idempotent)
- [NEW]         — not yet applied; must be run now

---

## 1. Verified Vibe core tables [LIKELY DONE]

```sql
-- Users
CREATE TABLE IF NOT EXISTS verified_vibe_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  gender TEXT NOT NULL CHECK (gender IN ('man', 'woman', 'prefer_not_to_say')),
  archetype TEXT NOT NULL CHECK (archetype IN ('casual_man','marriage_minded_man','spoilt_woman','safety_first_woman')),
  first_name TEXT NOT NULL,
  age INTEGER NOT NULL,
  city TEXT NOT NULL,
  avatar_url TEXT,
  about TEXT,
  looking TEXT,
  trust_score INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Verification records
CREATE TABLE IF NOT EXISTS verified_vibe_verification (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES verified_vibe_users(id) ON DELETE CASCADE,
  step TEXT NOT NULL CHECK (step IN ('id','liveness','photos','spending_or_qa')),
  status TEXT NOT NULL CHECK (status IN ('pending','completed','failed')),
  data JSONB DEFAULT '{}',
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Likes
CREATE TABLE IF NOT EXISTS verified_vibe_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES verified_vibe_users(id) ON DELETE CASCADE,
  liked_user_id UUID NOT NULL REFERENCES verified_vibe_users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, liked_user_id)
);

-- Passes
CREATE TABLE IF NOT EXISTS verified_vibe_passes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES verified_vibe_users(id) ON DELETE CASCADE,
  passed_user_id UUID NOT NULL REFERENCES verified_vibe_users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, passed_user_id)
);

-- Matches
CREATE TABLE IF NOT EXISTS verified_vibe_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id UUID NOT NULL REFERENCES verified_vibe_users(id) ON DELETE CASCADE,
  user2_id UUID NOT NULL REFERENCES verified_vibe_users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','mutual','rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Messages
CREATE TABLE IF NOT EXISTS verified_vibe_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES verified_vibe_matches(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES verified_vibe_users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Typing indicators
CREATE TABLE IF NOT EXISTS verified_vibe_typing_indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES verified_vibe_matches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES verified_vibe_users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(match_id, user_id)
);

-- Core indexes
CREATE INDEX IF NOT EXISTS idx_verified_vibe_users_gender      ON verified_vibe_users(gender);
CREATE INDEX IF NOT EXISTS idx_verified_vibe_users_archetype   ON verified_vibe_users(archetype);
CREATE INDEX IF NOT EXISTS idx_verified_vibe_verification_user ON verified_vibe_verification(user_id);
CREATE INDEX IF NOT EXISTS idx_verified_vibe_likes_user        ON verified_vibe_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_verified_vibe_likes_liked       ON verified_vibe_likes(liked_user_id);
CREATE INDEX IF NOT EXISTS idx_verified_vibe_passes_user       ON verified_vibe_passes(user_id);
CREATE INDEX IF NOT EXISTS idx_verified_vibe_matches_user1     ON verified_vibe_matches(user1_id);
CREATE INDEX IF NOT EXISTS idx_verified_vibe_matches_user2     ON verified_vibe_matches(user2_id);
CREATE INDEX IF NOT EXISTS idx_verified_vibe_matches_status    ON verified_vibe_matches(status);
CREATE INDEX IF NOT EXISTS idx_verified_vibe_messages_match    ON verified_vibe_messages(match_id);
CREATE INDEX IF NOT EXISTS idx_verified_vibe_messages_sender   ON verified_vibe_messages(sender_id);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE verified_vibe_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE verified_vibe_typing_indicators;
```

---

## 2. AI assistant profiles table [LIKELY DONE]

```sql
CREATE TABLE IF NOT EXISTS ai_assistant_profiles (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_type TEXT NOT NULL CHECK (profile_type IN ('preferences', 'personality')),
  data         JSONB NOT NULL DEFAULT '{}',
  version      INTEGER NOT NULL DEFAULT 1,
  reason       TEXT NOT NULL DEFAULT 'Initial profile',
  created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_assistant_profiles_user_type_version
  ON ai_assistant_profiles (user_id, profile_type, version DESC);

ALTER TABLE ai_assistant_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profiles"
  ON ai_assistant_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profiles"
  ON ai_assistant_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

---

## 3. Add ai_bestie_active flag to matches [LIKELY DONE]

Tracks whether Neha has activated AI Bestie interview mode for a specific match.

```sql
ALTER TABLE verified_vibe_matches
  ADD COLUMN IF NOT EXISTS ai_bestie_active BOOLEAN NOT NULL DEFAULT FALSE;
```

---

## 4. Add preferences JSONB column to users [LIKELY DONE]

Stores the user's dating preferences as flexible JSON (injected into Claude prompts).

```sql
ALTER TABLE verified_vibe_users
  ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_verified_vibe_users_preferences
  ON verified_vibe_users USING GIN (preferences);
```

---

## 5. Profile section staleness trigger [NEW]

When ai_assistant_profiles is updated, marks the user's profile display as stale
so the app knows to regenerate the rich profile view on next load.

```sql
-- Add flag column
ALTER TABLE verified_vibe_users
  ADD COLUMN IF NOT EXISTS profile_section_stale BOOLEAN DEFAULT FALSE;

-- Trigger function
CREATE OR REPLACE FUNCTION mark_profile_section_stale()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE verified_vibe_users
  SET profile_section_stale = true
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

-- Attach trigger
DROP TRIGGER IF EXISTS trg_profile_section_staleness ON ai_assistant_profiles;

CREATE TRIGGER trg_profile_section_staleness
  AFTER INSERT OR UPDATE OF data
  ON ai_assistant_profiles
  FOR EACH ROW
  EXECUTE FUNCTION mark_profile_section_stale();
```

---

## 6. Device tokens table [NEW]

Stores FCM push notification tokens per user per platform.

```sql
CREATE TABLE IF NOT EXISTS public.device_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token      VARCHAR(256) NOT NULL,
  platform   VARCHAR(7) NOT NULL CHECK (platform IN ('android', 'ios')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.device_tokens
  ADD CONSTRAINT device_tokens_user_platform_unique UNIQUE (user_id, platform);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id ON public.device_tokens(user_id);

ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own device tokens"
  ON public.device_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own device tokens"
  ON public.device_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own device tokens"
  ON public.device_tokens FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own device tokens"
  ON public.device_tokens FOR DELETE
  USING (auth.uid() = user_id);
```

---

## 7. Unread message tracking — last_read_at [NEW]

Adds per-user read timestamps to each match row. The conversations API
counts messages from the other user that arrived after this timestamp
to produce accurate unread counts. Defaults to NOW() so existing matches
don't show a flood of "unread" messages on first deploy.

```sql
ALTER TABLE verified_vibe_matches
  ADD COLUMN IF NOT EXISTS user1_last_read_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS user2_last_read_at TIMESTAMPTZ DEFAULT NOW();
```

---

## 8. AI Bestie feedback table [NEW]

Stores thumbs-up / thumbs-down ratings on individual AI Bestie chat messages.
Inserted whenever a user clicks 👍 or 👎 in the Bestie chat.

```sql
CREATE TABLE IF NOT EXISTS ai_bestie_feedback (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES verified_vibe_users(id) ON DELETE CASCADE,
  feedback_type    TEXT NOT NULL CHECK (feedback_type IN ('positive', 'negative')),
  message_content  TEXT NOT NULL,
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_bestie_feedback_user_id ON ai_bestie_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_bestie_feedback_type    ON ai_bestie_feedback(feedback_type);

ALTER TABLE ai_bestie_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own feedback"
  ON ai_bestie_feedback FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can read own feedback"
  ON ai_bestie_feedback FOR SELECT
  USING (user_id = auth.uid());
```

---

## VERIFICATION QUERIES

Run these after each section to confirm success.

```sql
-- 1. Check core tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'verified_vibe_users', 'verified_vibe_matches', 'verified_vibe_messages',
    'verified_vibe_likes', 'verified_vibe_passes', 'verified_vibe_verification',
    'verified_vibe_typing_indicators', 'ai_assistant_profiles',
    'device_tokens', 'ai_bestie_feedback'
  )
ORDER BY table_name;
-- Expected: 10 rows

-- 2. Check columns added in steps 3–5
SELECT table_name, column_name, data_type, column_default
FROM information_schema.columns
WHERE (table_name = 'verified_vibe_matches' AND column_name = 'ai_bestie_active')
   OR (table_name = 'verified_vibe_users'   AND column_name IN ('preferences', 'profile_section_stale'))
ORDER BY table_name, column_name;
-- Expected: 3 rows

-- 3. Check trigger exists
SELECT trigger_name, event_object_table, action_timing, event_manipulation
FROM information_schema.triggers
WHERE trigger_name = 'trg_profile_section_staleness';
-- Expected: 1 row (AFTER INSERT and 1 row AFTER UPDATE)

-- 4. Check RLS is enabled on new tables
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename IN ('ai_bestie_feedback', 'device_tokens', 'ai_assistant_profiles')
  AND schemaname = 'public';
-- Expected: rowsecurity = true on all 3

-- 5. Spot-check feedback table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'ai_bestie_feedback'
ORDER BY ordinal_position;
-- Expected: id, user_id, feedback_type, message_content, created_at
```

---

## ROLLBACK (if anything goes wrong)

```sql
-- Step 7 rollback
DROP TABLE IF EXISTS ai_bestie_feedback;

-- Step 6 rollback
DROP TABLE IF EXISTS device_tokens;

-- Step 5 rollback
DROP TRIGGER IF EXISTS trg_profile_section_staleness ON ai_assistant_profiles;
DROP FUNCTION IF EXISTS mark_profile_section_stale();
ALTER TABLE verified_vibe_users DROP COLUMN IF EXISTS profile_section_stale;

-- Steps 3–4 rollback (only if needed)
ALTER TABLE verified_vibe_matches DROP COLUMN IF EXISTS ai_bestie_active;
DROP INDEX IF EXISTS idx_verified_vibe_users_preferences;
ALTER TABLE verified_vibe_users DROP COLUMN IF EXISTS preferences;
```

---

## NOTES

- All server-side API routes use the **service role key** — they bypass RLS entirely.
  RLS policies exist to protect direct client-side Supabase access only.

- The ai_assistant_profiles table is append-only by design. The app always reads
  the row with the highest version number (ORDER BY version DESC LIMIT 1).

- ai_bestie_feedback.user_id references verified_vibe_users, NOT auth.users.
  This is intentional — feedback is scoped to the VV user profile, not the auth identity.

- Steps 1 and 2 (core tables + ai_assistant_profiles) are almost certainly already
  applied from earlier sessions. The [LIKELY DONE] label means re-running them is
  safe but not required — all DDL uses IF NOT EXISTS guards.
