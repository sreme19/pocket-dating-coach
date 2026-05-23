# Kiro Handoff — Session May 23 2026
**Prepared by:** Claude Code  
**For execution by:** Kiro  
**Branch:** `main` (all code changes are already committed to disk — run the migrations manually)

---

## What Was Built This Session

Three feature areas were completed. All Svelte/TypeScript code is already written and in the repo. The only things Kiro needs to execute are **4 SQL migrations** in Supabase.

---

## Step 1 — Run SQL Migrations in Supabase

Go to: **https://supabase.com/dashboard/project/stikoktiaxqtcsohcxzp/sql/new**

Run each block below **in order**. Each is idempotent (`IF NOT EXISTS`) so safe to re-run.

---

### Migration A — `profile_tips` table

Anonymous tips left on profiles from discover. Submitted-by user is never stored (product guarantee of anonymity).

```sql
CREATE TABLE IF NOT EXISTS profile_tips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id UUID NOT NULL REFERENCES verified_vibe_users(id) ON DELETE CASCADE,
  submitted_by_gender TEXT NOT NULL CHECK (submitted_by_gender IN ('man', 'woman', 'prefer_not_to_say')),
  tip_tags TEXT[] NOT NULL DEFAULT '{}',
  tip_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profile_tips_target ON profile_tips(target_user_id);

ALTER TABLE profile_tips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_tips" ON profile_tips
  FOR ALL TO service_role USING (true);
```

---

### Migration B — `user_artifacts` table

Trust-evidence uploads (photos of salary slip, gym, travel, etc.). Used by AI Bestie and AI Wingman. **Never exposed to the match the artifact relates to** — privacy is enforced at the application layer.

```sql
CREATE TABLE IF NOT EXISTS user_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES verified_vibe_users(id) ON DELETE CASCADE,
  storage_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'image/jpeg',
  claim_tag TEXT NOT NULL,
  description TEXT,
  trust_points INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_artifacts_user_id ON user_artifacts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_artifacts_claim_tag ON user_artifacts(claim_tag);

ALTER TABLE user_artifacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_artifacts" ON user_artifacts
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "service_role_all_artifacts" ON user_artifacts
  FOR ALL TO service_role USING (true);
```

---

### Migration C — `attention_messages` table

Stores "Secret Admirer" (woman → man) and "Craving Attention" (man → woman) pre-match messages sent from the Discover feed. One message per sender/recipient pair — enforced at DB level.

```sql
CREATE TABLE IF NOT EXISTS attention_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES verified_vibe_users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES verified_vibe_users(id) ON DELETE CASCADE,
  message_type TEXT NOT NULL CHECK (message_type IN ('secret_admirer', 'craving_attention')),
  content TEXT NOT NULL,
  reply_content TEXT,
  reply_sent_at TIMESTAMPTZ,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sender_id, recipient_id)
);

CREATE INDEX IF NOT EXISTS idx_attention_messages_recipient ON attention_messages (recipient_id);
CREATE INDEX IF NOT EXISTS idx_attention_messages_sender    ON attention_messages (sender_id);

ALTER TABLE attention_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_role_all_attention ON attention_messages
  FOR ALL TO service_role USING (true);
```

---

### Migration D — `here_for_title`, `here_for_desc`, `hard_nos` on `verified_vibe_users`

Lets the male profile owner edit his "Here For" section and dealbreakers directly from the profile page UI, without re-running the onboarding quiz. Data is loaded from DB on mount and saved via the existing `upsertProfile` flow.

```sql
ALTER TABLE verified_vibe_users
  ADD COLUMN IF NOT EXISTS here_for_title TEXT,
  ADD COLUMN IF NOT EXISTS here_for_desc  TEXT,
  ADD COLUMN IF NOT EXISTS hard_nos       JSONB DEFAULT '[]'::jsonb;
```

---

## Step 2 — Verify Supabase Storage Bucket

The `user_artifacts` upload flow posts files to Supabase Storage. Confirm a bucket named **`user-artifacts`** (or check `src/routes/api/verified-vibe/artifacts/+server.ts` for the exact bucket name used) exists and has the right RLS policy:

- Authenticated users can upload to their own folder (`{userId}/...`)
- Service role can read all

If the bucket doesn't exist, create it at: **https://supabase.com/dashboard/project/stikoktiaxqtcsohcxzp/storage/buckets** → New bucket → name: `user-artifacts`, public: false.

---

## What Each Feature Does (for QA)

### Feature 1 — Personalized Upload Panel in Chat (📎 button)

**Who sees it:** Male users chatting with a female match.

**Flow:**
1. Male taps the 📎 attach button in the chat
2. A bottom sheet slides up instead of opening the file picker directly
3. The sheet shows:
   - **Benefits callout** (green): trust score goes up, match's AI Bestie sees it, stays private
   - **Face verification note** (amber): "Your face must be visible in the photo — that's what makes it verifiable, not just a screenshot."
   - **"WHAT WOULD IMPRESS [HER NAME]?"** — 5 upload categories ranked by her archetype
   - Categories: Wealth & Success (+10 pts), Travel (+8), Fitness (+5), Lifestyle (+3), Other (+3)
   - The top 2 for her archetype show a "✨ Recommended" badge
4. User picks a category → file picker opens
5. After upload: a toast appears in the chat: "🔒 Stored as your trust proof — Neha can't see this. +10 trust pts"
6. The file is **never** sent as a chat message — it goes to `user_artifacts` table + Supabase Storage only

**Archetype → recommended categories mapping:**
| Female Archetype | Recommended |
|---|---|
| Spoilt Casual | Wealth, Travel |
| Hopeless Romantic | Lifestyle, Fitness |
| Rebound Healing | Fitness, Lifestyle |
| Untouched Heart | Lifestyle, Fitness |
| Forever Focused | Wealth, Lifestyle |
| Traditional Matrimony | Wealth, Lifestyle |

**File:** `src/routes/verified-vibe/chat/[conversationId]/+page.svelte`

---

### Feature 2 — AI Wingman Upload Panel: Face Note

**What changed:** The existing AI Wingman upload panel (shown when user taps "Upload proof" chip) now has an amber note between the benefits block and the category list:

> 🤳 Your face must be visible in the photo — that's what makes it **verifiable**, not just a screenshot.

**File:** `src/routes/verified-vibe/chat/ai-wingman/+page.svelte`

---

### Feature 3 — Editable HERE FOR + HARD NOS on Profile Page

**Who sees it:** Male profile owner on `/verified-vibe/profile`.

**Flow:**
- Both "Here For" and "Hard Nos" sections now have a ✏️ pencil button in their section header
- **HERE FOR edit:** Opens two text inputs (title + description), pre-populated with current values. Save → `upsertProfile({ here_for_title, here_for_desc })`
- **HARD NOS edit:** Opens the current list with ✕ to remove each item, plus an "Add a dealbreaker…" input. Enter key or "+ Add" button adds. Save → `upsertProfile({ hard_nos: [...] })`
- On page load: fetches `here_for_title`, `here_for_desc`, `hard_nos` from Supabase; falls back to sensible defaults if null
- No personality quiz needed — this is direct user input

**Requires:** Migration D above to be applied.

**File:** `src/routes/verified-vibe/profile/+page.svelte`

---

### Feature 4 — Correct Archetypes Shown During Female Onboarding

**Bug fixed:** When a user selected "Woman" on the gate page (`/verified-vibe/gate`) and landed on the archetype picker (`/verified-vibe/home`), they saw male archetypes (Casual-Generous, Hopeless-Romantic…) instead of female ones (Spoilt-Casual, Hopeless-Romantic…).

**Root cause:** The home page called `getProfile()` which returned the currently authenticated user's existing profile (e.g., Adrian/man), overriding the gate's localStorage selection.

**Fix:** The home page now checks `verified_vibe_pending_gender` first (set by the gate page), uses it, and clears it. Only then falls back to Supabase profile or general localStorage.

**File:** `src/routes/verified-vibe/home/+page.svelte`

---

### Feature 5 — Secret Admirer Button Visible for Female Users in Discover

**Bug fixed:** Female users like Neha logged into the Discover page and didn't see the "🌹 Admire" Secret Admirer button on male profiles.

**Root cause:** `currentUserGender` in the Discover page was loaded from `localStorage.getItem('verified_vibe_gender')`. If a male user (Adrian) had used the app previously on the same browser, localStorage held `'man'`. When Neha logged in, localStorage wasn't updated, so the page thought Neha was a man — and the attention button logic required opposite-gender match to show.

**Fix:** `currentUserGender` now reads from `$user.gender` (the authoritative Svelte store, populated from Supabase profile) with localStorage only as a fallback for unauthenticated states.

**File:** `src/routes/verified-vibe/discover/+page.svelte`

---

## Files Changed Summary

| File | Change |
|---|---|
| `supabase/migrations/20260523_profile_tips.sql` | New table |
| `supabase/migrations/20260523_user_artifacts.sql` | New table |
| `supabase/migrations/20260523_attention_messages.sql` | New table |
| `supabase/migrations/20260523_here_for_hard_nos.sql` | 3 new columns on `verified_vibe_users` |
| `src/lib/verified-vibe/services/profileService.ts` | Added `here_for_title`, `here_for_desc`, `hard_nos` to `VVProfile` interface |
| `src/routes/verified-vibe/chat/[conversationId]/+page.svelte` | Chat upload panel, personalized categories, face note, privacy logic |
| `src/routes/verified-vibe/chat/ai-wingman/+page.svelte` | Face verification note added to upload panel |
| `src/routes/verified-vibe/profile/+page.svelte` | HERE FOR + HARD NOS editable with pencil buttons, inline forms, Supabase save |
| `src/routes/verified-vibe/home/+page.svelte` | Gate's `verified_vibe_pending_gender` takes priority in archetype picker |
| `src/routes/verified-vibe/discover/+page.svelte` | `currentUserGender` reads from `$user.gender` store (not stale localStorage) |

---

## QA Checklist for Kiro

After running the 4 migrations, test these flows:

- [ ] **Male → female chat:** Tap 📎 → see upload panel (not file picker) → see "WHAT WOULD IMPRESS [NAME]?" → pick a category → upload a photo → see the private toast notification in chat → confirm Neha does NOT see the photo in her chat thread
- [ ] **AI Wingman:** Tap "Upload proof" chip → see upload panel → confirm amber face-note appears between benefits and categories
- [ ] **Profile page (male):** Go to Profile → scroll to "Here For" → tap pencil → edit title + description → Save → confirm changes persist on page refresh
- [ ] **Profile page (male):** Tap Hard Nos pencil → remove one item → add a new dealbreaker → Save → confirm changes persist
- [ ] **Female onboarding:** Open incognito → go to `/verified-vibe/gate` → select Woman + 18+ → Continue → confirm home page shows "Spoilt-Casual", "Hopeless-Romantic" etc. (female set), NOT "Casual-Generous"
- [ ] **Neha on Discover:** Log in as Neha → go to Discover → view a male profile → confirm "🌹 Admire" button appears → tap it → confirm Secret Admirer sheet opens → send a message → confirm it appears in the male user's attention inbox

---

## Gotchas

1. **`hard_nos` is JSONB in Postgres** — the TypeScript type is `string[] | null`. When reading, always check `Array.isArray(data.hard_nos)` before spreading.
2. **`verified_vibe_pending_gender` is a one-time key** — the home page clears it after reading. This is intentional so it doesn't persist across sessions.
3. **Upload panel gender gate** — the chat panel only shows for `currentUserGender === 'man' && $currentMatch?.gender === 'woman'`. If this check fails (gender not loaded yet), the panel falls back to opening the file picker directly. This is safe.
4. **Archetype archetype-to-recommendation mapping** is client-side only (in the chat page's `ARCHETYPE_TOP_CATS` constant). No DB call needed for the recommendations themselves — only the match's archetype is fetched from `/api/verified-vibe/match-profile/[id]`.
