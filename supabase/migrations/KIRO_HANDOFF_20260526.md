# Supabase Migration Handoff — 2026-05-26
**Project:** pocket-dating-coach  
**Supabase URL:** `https://stikoktiaxqtcsohcxzp.supabase.co`  
**Prepared for:** Kiro  
**Covers:** All migrations since the last handoff (20260522) through today

---

## ⚠️ CRITICAL BUG TO FIX FIRST (Step 1 below)

`verified_vibe_verification.step` has a CHECK constraint that only allows  
`('id', 'liveness', 'photos', 'spending_or_qa')`.  
The proof-upload server writes rows like `step = 'proof_lifestyle'`, `step = 'proof_assets'`, etc.  
Those inserts currently **silently fail** — the user sees success but DB rows are never written.  
**Fix this first, before anything else.**

---

## STATUS LEGEND
- `[LIKELY DONE]` — was in an earlier handoff; safe to re-run (all DDL is idempotent)
- `[NEW — RUN NOW]` — not yet applied

---

## Step 1 — Fix `verified_vibe_verification` step constraint `[NEW — RUN NOW]`

```sql
-- Drop the old restrictive constraint
ALTER TABLE verified_vibe_verification
  DROP CONSTRAINT IF EXISTS verified_vibe_verification_step_check;

-- Replace with a constraint that allows proof_* values
ALTER TABLE verified_vibe_verification
  ADD CONSTRAINT verified_vibe_verification_step_check
  CHECK (
    step IN ('id', 'liveness', 'photos', 'spending_or_qa')
    OR step LIKE 'proof_%'
  );
```

**Verify:**
```sql
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'verified_vibe_verification_step_check';
```
Expected: one row, clause should include `OR (step ~~ 'proof_%')`.

---

## Step 2 — Archetype overhaul (seed data update) `[LIKELY DONE]`

Updates seed profiles to the new 12-archetype system. Safe to re-run — UPDATE on name match.

```sql
UPDATE verified_vibe_users SET archetype = 'casual_generous_man'
  WHERE first_name IN ('Victor','Alex','Kai','Owen','Dante','Greg','Ryan','Tim');

UPDATE verified_vibe_users SET archetype = 'hopeless_romantic_man'
  WHERE first_name IN ('Adrian','Ethan','Tyler','Daniel');

UPDATE verified_vibe_users SET archetype = 'rebound_healing_man'
  WHERE first_name IN ('Michael','Jake','Luca','Marcus');

UPDATE verified_vibe_users SET archetype = 'untouched_heart_man'
  WHERE first_name IN ('John','Finn');

UPDATE verified_vibe_users SET archetype = 'forever_focused_man'
  WHERE first_name IN ('Arjun','Karan');

UPDATE verified_vibe_users SET archetype = 'traditional_matrimony_man'
  WHERE first_name IN ('Rohan');

UPDATE verified_vibe_users SET archetype = 'spoiled_casual_woman'
  WHERE first_name IN ('Jade','Zara','Aria','Stella','Freya','Dominique');

UPDATE verified_vibe_users SET archetype = 'hopeless_romantic_woman'
  WHERE first_name IN ('Emma','Luna','Sienna','Deepa');

UPDATE verified_vibe_users SET archetype = 'rebound_healing_woman'
  WHERE first_name IN ('Maya','Claire','Nicole');

UPDATE verified_vibe_users SET archetype = 'untouched_heart_woman'
  WHERE first_name IN ('Rachel');

UPDATE verified_vibe_users SET archetype = 'forever_focused_woman'
  WHERE first_name IN ('Diana','Jessica','Priya','Lauren','Sarah');

UPDATE verified_vibe_users SET archetype = 'traditional_matrimony_woman'
  WHERE first_name IN ('Anjali','Kavya','Neha');
```

---

## Step 3 — `attention_messages` table `[LIKELY DONE]`

Pre-match "Secret Admirer" and "Craving Attention" messages sent from the discover feed.

```sql
CREATE TABLE IF NOT EXISTS attention_messages (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id      UUID        NOT NULL REFERENCES verified_vibe_users(id) ON DELETE CASCADE,
  recipient_id   UUID        NOT NULL REFERENCES verified_vibe_users(id) ON DELETE CASCADE,
  message_type   TEXT        NOT NULL CHECK (message_type IN ('secret_admirer', 'craving_attention')),
  content        TEXT        NOT NULL,
  reply_content  TEXT,
  reply_sent_at  TIMESTAMPTZ,
  is_read        BOOLEAN     NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sender_id, recipient_id)
);

CREATE INDEX IF NOT EXISTS idx_attention_messages_recipient ON attention_messages (recipient_id);
CREATE INDEX IF NOT EXISTS idx_attention_messages_sender    ON attention_messages (sender_id);

ALTER TABLE attention_messages ENABLE ROW LEVEL SECURITY;

-- Service role only — app always uses service-role key server-side
CREATE POLICY "service_role_all_attention"
  ON attention_messages FOR ALL TO service_role USING (true);
```

---

## Step 4 — `here_for_title`, `here_for_desc`, `hard_nos` columns `[LIKELY DONE]`

Lets male profiles store their "Here For" intent and "Hard Nos" directly in the DB
rather than deriving from personality.md.

```sql
ALTER TABLE verified_vibe_users
  ADD COLUMN IF NOT EXISTS here_for_title TEXT,
  ADD COLUMN IF NOT EXISTS here_for_desc  TEXT,
  ADD COLUMN IF NOT EXISTS hard_nos       JSONB DEFAULT '[]'::jsonb;
```

---

## Step 5 — `profile_tips` table `[LIKELY DONE]`

Anonymous feedback from the discover feed — used by AI Wingman to surface
"community reads" about a profile.

```sql
CREATE TABLE IF NOT EXISTS profile_tips (
  id                   UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id       UUID      NOT NULL REFERENCES verified_vibe_users(id) ON DELETE CASCADE,
  submitted_by_gender  TEXT      NOT NULL CHECK (submitted_by_gender IN ('man', 'woman', 'prefer_not_to_say')),
  tip_tags             TEXT[]    NOT NULL DEFAULT '{}',
  tip_text             TEXT,
  created_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profile_tips_target ON profile_tips (target_user_id);

ALTER TABLE profile_tips ENABLE ROW LEVEL SECURITY;

-- Only service role can write/read — aggregates only exposed via API, never raw rows
CREATE POLICY "service_role_all_tips"
  ON profile_tips FOR ALL TO service_role USING (true);
```

---

## Step 6 — `user_artifacts` table `[LIKELY DONE]`

Trust-evidence uploads. Stores image/doc URLs with a claim_tag and trust_points
contribution. Read by AI Wingman to surface verified proof in chat.

```sql
CREATE TABLE IF NOT EXISTS user_artifacts (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID    NOT NULL REFERENCES verified_vibe_users(id) ON DELETE CASCADE,
  storage_url  TEXT    NOT NULL,
  file_name    TEXT    NOT NULL,
  mime_type    TEXT    NOT NULL DEFAULT 'image/jpeg',
  claim_tag    TEXT    NOT NULL,      -- 'wealthy' | 'well_traveled' | 'fitness' | 'general'
  description  TEXT,
  trust_points INTEGER NOT NULL DEFAULT 5,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_artifacts_user_id   ON user_artifacts (user_id);
CREATE INDEX IF NOT EXISTS idx_user_artifacts_claim_tag ON user_artifacts (claim_tag);

ALTER TABLE user_artifacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own artifacts"
  ON user_artifacts FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own artifacts"
  ON user_artifacts FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "service_role_all_artifacts"
  ON user_artifacts FOR ALL TO service_role USING (true);
```

---

## Step 7 — Security advisor fixes `[LIKELY DONE]`

RLS on `verified_vibe_typing_indicators` and `book_chunks`, plus `search_path`
hardening on shared trigger functions.

```sql
-- Typing indicators RLS
ALTER TABLE verified_vibe_typing_indicators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view typing indicators for their matches"
  ON verified_vibe_typing_indicators FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM verified_vibe_matches
      WHERE id = match_id
        AND (user1_id = auth.uid() OR user2_id = auth.uid())
    )
  );

CREATE POLICY "Users can insert own typing indicator"
  ON verified_vibe_typing_indicators FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own typing indicator"
  ON verified_vibe_typing_indicators FOR UPDATE
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own typing indicator"
  ON verified_vibe_typing_indicators FOR DELETE
  USING (auth.uid() = user_id);

-- book_chunks RLS (pgvector knowledge base)
ALTER TABLE book_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read book_chunks"
  ON book_chunks FOR SELECT TO authenticated USING (true);

-- Harden timestamp trigger function
CREATE OR REPLACE FUNCTION update_vv_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
```

---

## Step 8 — `user_master_profile` table `[NEW — RUN NOW]`

**This is the main new table.** A single JSONB document per user — the authoritative
source of truth for everything the platform knows about them. Consolidates data
previously scattered across localStorage, `ai_assistant_profiles`, and
`verified_vibe_verification`.

Read by: AI Wingman (full context), auto-fill endpoint (profile copy),
master-profile sync endpoint (cross-device hydration).

```sql
CREATE TABLE IF NOT EXISTS user_master_profile (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES verified_vibe_users(id) ON DELETE CASCADE,
  data       JSONB       NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_master_profile_user_id_unique UNIQUE (user_id)
);

-- Fast lookup by user
CREATE INDEX IF NOT EXISTS idx_user_master_profile_user_id
  ON user_master_profile (user_id);

-- GIN index for efficient JSONB field queries
CREATE INDEX IF NOT EXISTS idx_user_master_profile_data
  ON user_master_profile USING GIN (data);

-- RLS
ALTER TABLE user_master_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_master_profile_self_select"
  ON user_master_profile FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "user_master_profile_self_insert"
  ON user_master_profile FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_master_profile_self_update"
  ON user_master_profile FOR UPDATE
  USING (auth.uid() = user_id);

-- Service role bypasses RLS — needed for AI Wingman, auto-fill, proof-upload
CREATE POLICY "user_master_profile_service_all"
  ON user_master_profile FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_user_master_profile_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_user_master_profile_updated_at
  BEFORE UPDATE ON user_master_profile
  FOR EACH ROW EXECUTE FUNCTION update_user_master_profile_updated_at();
```

### JSON blob structure (reference)

All fields are optional and additive — the blob evolves as more data arrives:

```jsonc
{
  // Written by: profile page sync on every load
  "identity": {
    "firstName": "Arjun",
    "age": 34,
    "city": "London",
    "archetype": "casual_generous_man",
    "gender": "man"
  },

  // Written by: profile page sync
  "profileDraft": {
    // All ProfileIntakeData fields (name, age, city, about, interests, etc.)
  },

  // Written by: profile page save (edit mode) + auto-fill
  "generatedProfile": {
    "about": "💼 Work hard, play harder...",
    "personalityDescriptors": ["Ambitious", "Grounded", "Direct"],
    "intentStatement": "Serious long-term commitment, Culturally aligned partner",
    "lifestyleTags": ["London life", "Biryani runs", "Tech career", "Travel"]
  },

  // Written by: profile page sync — all 20 archetype QA localStorage keys merged
  "onboarding": {
    "vv_qa_responses": { "spending_comfort": "generous", ... },
    "vv_casual_generous_profile": { "what_i_bring": "...", ... },
    "vv_casual_generous_preferences": { "ideal_woman": "...", ... }
    // + all other vv_* QA keys
  },

  // Written by: proof-upload server after every successful verification
  // THIS IS THE AUTHORITATIVE PROOF STORE — never overwritten by client sync
  "verifiedProofs": [
    {
      "category": "lifestyle",
      "insights": [
        { "label": "Business-class traveler", "emoji": "✈️" },
        { "label": "Fine dining regular", "emoji": "🍽️" }
      ],
      "aggregated": "Travels internationally, explores cultural landmarks, and adventures solo",
      "locations": ["Japan", "Bali", "Dubai"],
      "verified_at": "2026-05-26T..."
    }
    // One entry per category — re-uploading replaces the existing category entry
  ],

  // Written by: proof-upload server (from lifestyle photo locations)
  //             + client sync from localStorage
  "countriesTraveled": ["Japan", "Bali", "Dubai", "New York"],

  "lastSynced": "2026-05-26T12:34:56.000Z"
}
```

---

## Verification queries (run after all steps)

```sql
-- 1. All new tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'attention_messages', 'profile_tips', 'user_artifacts',
    'user_master_profile'
  )
ORDER BY table_name;
-- Expected: 4 rows

-- 2. New columns on verified_vibe_users
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'verified_vibe_users'
  AND column_name IN ('here_for_title', 'here_for_desc', 'hard_nos')
ORDER BY column_name;
-- Expected: 3 rows

-- 3. Step constraint now allows proof_*
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'verified_vibe_verification_step_check';
-- Expected: clause includes "proof_%"

-- 4. user_master_profile has both indexes
SELECT indexname FROM pg_indexes
WHERE tablename = 'user_master_profile'
ORDER BY indexname;
-- Expected: idx_user_master_profile_data, idx_user_master_profile_user_id

-- 5. RLS enabled on all new tables
SELECT tablename, rowsecurity FROM pg_tables
WHERE tablename IN (
  'attention_messages', 'profile_tips', 'user_artifacts', 'user_master_profile'
) AND schemaname = 'public'
ORDER BY tablename;
-- Expected: rowsecurity = true on all 4

-- 6. updated_at trigger on user_master_profile
SELECT trigger_name, event_object_table, action_timing
FROM information_schema.triggers
WHERE trigger_name = 'trg_user_master_profile_updated_at';
-- Expected: 1 row (BEFORE UPDATE)
```

---

## Rollback (if needed — reverse order)

```sql
-- Step 8 rollback
DROP TRIGGER IF EXISTS trg_user_master_profile_updated_at ON user_master_profile;
DROP FUNCTION IF EXISTS update_user_master_profile_updated_at();
DROP TABLE IF EXISTS user_master_profile;

-- Step 6 rollback
DROP TABLE IF EXISTS user_artifacts;

-- Step 5 rollback
DROP TABLE IF EXISTS profile_tips;

-- Step 3 rollback
DROP TABLE IF EXISTS attention_messages;

-- Step 4 rollback
ALTER TABLE verified_vibe_users
  DROP COLUMN IF EXISTS here_for_title,
  DROP COLUMN IF EXISTS here_for_desc,
  DROP COLUMN IF EXISTS hard_nos;

-- Step 1 rollback (restore old constraint)
ALTER TABLE verified_vibe_verification
  DROP CONSTRAINT IF EXISTS verified_vibe_verification_step_check;
ALTER TABLE verified_vibe_verification
  ADD CONSTRAINT verified_vibe_verification_step_check
  CHECK (step IN ('id', 'liveness', 'photos', 'spending_or_qa'));
```

---

## Architecture notes for Kiro

### How `user_master_profile` fits in

```
[Client localStorage]  ←──hydrate on load──  [user_master_profile]
        │                                              ↑
        └──push on save/onboarding──────────────────►─┘
                                                       ↑
[proof-upload server] ──writes verifiedProofs──────────┘
                                                       │
[AI Wingman backend] ─────reads full context from──────┘
[auto-fill endpoint] ─────reads for Claude prompts─────┘
```

### Write ownership — who writes what

| Field | Writer | Never overwritten by |
|-------|--------|----------------------|
| `identity` | Profile page sync | Nothing — latest always wins |
| `generatedProfile` | Profile page save / auto-fill | Client hydration (only fills if empty) |
| `profileDraft` | Profile page sync | Client hydration (only fills if empty) |
| `onboarding.*` | Profile page sync (deep-merge) | Keys present on both sides: DB wins |
| `verifiedProofs` | Proof-upload server ONLY | Client sync never touches this |
| `countriesTraveled` | Proof-upload server + client sync | Union-merged, no data ever lost |

### `ai_assistant_profiles` — still used for

- `profile_type = 'personality'` → still written by proof-upload (backward compat with auto-fill)
- `profile_type = 'preferences'` → still written by AI Bestie onboarding (women)
- `profile_type = 'master'` → **no longer used** — all master data is now in `user_master_profile`

### `verified_vibe_verification` — still used for

Base verification steps (`id`, `liveness`, `photos`, `spending_or_qa`) AND now all
proof-upload records (`proof_lifestyle`, `proof_hosting`, `proof_discipline`,
`proof_social_proof`, `proof_linkedin`, `proof_instagram`, `proof_twitter`,
`proof_habit_tracker`, `proof_intro`, `proof_spending`, `proof_assets`).
Trust score recalculation reads all `proof_*` rows for a user.

---

## Files committed to main (reference)

| File | What it does |
|------|-------------|
| `supabase/migrations/20260526_user_master_profile.sql` | New table DDL (this handoff) |
| `src/routes/api/verified-vibe/master-profile/+server.ts` | GET/POST sync endpoint |
| `src/routes/api/verified-vibe/proof-upload/+server.ts` | Now writes to `user_master_profile` |
| `src/routes/api/verified-vibe/ai-wingman/chat/+server.ts` | Reads master profile for full context |
| `src/routes/verified-vibe/profile/+page.svelte` | Hydrates + pushes on every load |
| `src/routes/verified-vibe/proof-upload/+page.svelte` | Pushes countries after proof upload |
