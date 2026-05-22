# Verified Vibe — GitHub Wiki

**Last updated:** 2026-05-22 · **Current release:** v2.2.0

---

## Table of Contents

1. [What is Verified Vibe?](#what-is-verified-vibe)
2. [Architecture Overview](#architecture-overview)
3. [Database Schema](#database-schema)
4. [Feature Areas](#feature-areas)
   - [Messaging & Chat List](#messaging--chat-list)
   - [AI Bestie](#ai-bestie)
   - [Match Profiles](#match-profiles)
   - [Discovery](#discovery)
5. [API Reference](#api-reference)
6. [Supabase Migrations](#supabase-migrations)
7. [Claude Prompt Design](#claude-prompt-design)
8. [Release History](#release-history)

---

## What is Verified Vibe?

Verified Vibe is a trust-first dating experience built inside Pocket Dating Coach.
Every user completes a multi-step verification (ID, liveness, photos, intent) before
they can match or message. The platform is designed for a specific female user —
Neha — who is looking for a genuine relationship and wants AI-assisted screening
without the mental load of parsing every message herself.

**Core promise:** every person Neha talks to has been verified. The AI Bestie
handles the conversational heavy lifting, reads signals in real time, and advises
without being alarmist.

---

## Architecture Overview

```
SvelteKit frontend (src/routes/verified-vibe/)
    │
    ├── Chat list          /verified-vibe/chat
    ├── Conversation       /verified-vibe/chat/[conversationId]
    ├── AI Bestie chat     /verified-vibe/chat/ai-bestie
    ├── AI Bestie config   /verified-vibe/chat/ai-bestie/configure
    ├── Match profile      /verified-vibe/match-profile/[profileId]
    └── Discover           /verified-vibe/discover

SvelteKit API routes (src/routes/api/verified-vibe/)
    │
    ├── chat/conversations          → returns chat list with unread counts
    ├── chat/mark-read              → stamps last_read_at when chat is opened
    ├── chat/[conversationId]       → messages, match info, bestie active flag
    ├── ai-bestie/chat              → advisor chat (summary / insights / freeform)
    ├── ai-bestie/generate-response → per-message analysis + suggested reply
    ├── ai-bestie/feedback          → store 👍/👎 rating
    ├── ai-bestie/opening-message   → generate first message for new match
    ├── ai-bestie/activate          → flip ai_bestie_active on match row
    └── match-profile/[profileId]  → rich profile (traits, vibe, brings, here-for)

Supabase (PostgreSQL + RLS)
    └── See Database Schema section

Claude API (Anthropic)
    └── All AI calls via src/lib/claude.ts — model: claude-3-5-sonnet
```

---

## Database Schema

### Core tables

#### `verified_vibe_users`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | References auth.users |
| gender | TEXT | man / woman / prefer_not_to_say |
| archetype | TEXT | casual_man / marriage_minded_man / spoilt_woman / safety_first_woman |
| first_name | TEXT | |
| age | INTEGER | |
| city | TEXT | |
| avatar_url | TEXT | |
| about | TEXT | Bio text |
| looking | TEXT | Intent statement |
| trust_score | INTEGER | 0–100, computed from verification steps |
| preferences | JSONB | Dating preferences (dealbreakers, values, etc.) |
| profile_section_stale | BOOLEAN | Set to true by trigger when ai_assistant_profiles updates |
| created_at / updated_at | TIMESTAMPTZ | |

#### `verified_vibe_matches`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | |
| user1_id / user2_id | UUID | Both reference verified_vibe_users |
| status | TEXT | pending / mutual / rejected |
| ai_bestie_active | BOOLEAN | True when Neha has activated AI Bestie for this match |
| user1_last_read_at | TIMESTAMPTZ | Timestamp of user1's last read — used for unread count |
| user2_last_read_at | TIMESTAMPTZ | Timestamp of user2's last read — used for unread count |
| created_at | TIMESTAMPTZ | Used as matchedAt in the chat list |

#### `verified_vibe_messages`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | |
| match_id | UUID | References verified_vibe_matches |
| sender_id | UUID | References verified_vibe_users |
| content | TEXT | |
| created_at | TIMESTAMPTZ | |

#### `ai_assistant_profiles`
Append-only versioned store for AI-synthesized user profiles.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | |
| user_id | UUID | References auth.users |
| profile_type | TEXT | preferences (female) or personality (male) |
| data | JSONB | Structured profile data |
| version | INTEGER | Increments on each update |
| reason | TEXT | Why this version was created |
| created_at | TIMESTAMPTZ | |

Always query with `ORDER BY version DESC LIMIT 1` to get the current profile.

**PreferencesProfile shape (female users):**
```json
{
  "emotionalSignals": ["honest communication", "emotionally available"],
  "lifestyleSignals": ["active outdoors", "career-driven"],
  "maturitySignals": ["owns his choices", "consistent"],
  "boundaries": ["no long-distance", "no smoking"],
  "dealbreakers": ["financial instability", "avoidant attachment"],
  "privateCompatibilityNotes": ["prefers someone who travels"]
}
```

**PersonalityProfile shape (male users):**
```json
{
  "communicationStyle": "Direct and thoughtful",
  "personalityVibe": "Grounded Achiever",
  "mattersMost": "Building something meaningful together",
  "values": ["family", "honesty", "ambition"],
  "datingPatterns": ["slow to open up", "consistent over time"],
  "redFlagsToAvoid": ["people-pleasing", "avoidance"],
  "updatedAt": "2026-05-22T..."
}
```

#### `ai_bestie_feedback`
Stores per-message thumbs-up / thumbs-down ratings from Neha on AI Bestie responses.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | |
| user_id | UUID | References verified_vibe_users |
| feedback_type | TEXT | positive or negative |
| message_content | TEXT | The Bestie message being rated (max 2000 chars) |
| created_at | TIMESTAMPTZ | |

Note: switching a vote (👍 → 👎) inserts a new row rather than updating. To get
the latest vote per user per message, query with `ORDER BY created_at DESC LIMIT 1`.

#### `device_tokens`
Stores FCM tokens for push notifications.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | |
| user_id | UUID | References auth.users |
| token | VARCHAR(256) | |
| platform | VARCHAR(7) | android or ios |
| created_at | TIMESTAMPTZ | |

UNIQUE constraint on (user_id, platform) — one token per user per platform.

---

## Feature Areas

### Messaging & Chat List

**Route:** `/verified-vibe/chat`

The chat list is split into two visual zones:

**NEW MATCHES strip (horizontal scroll)**
Matches where no messages have been sent yet. Each bubble shows:
- 60px circle avatar with green glow ring
- ✨ sparkle decoration
- Name, age, time since match (orange if < 24h)

**Active conversations list**
Matches with at least one message. Each row shows:
- 52px circle avatar with green ring
- Name, age
- Archetype chip (colour-coded: 🎯 amber, 💍 indigo, 💎 pink, 🛡️ green)
- 🛡 trust score
- Timestamp (green + bold when unread)
- Unread count badge
- Last message preview (bold when unread)

**Filter tabs:** All N | Unread N

**Unread count flow:**
1. When the match sends a message, `created_at` is recorded.
2. The conversations API counts messages where `sender_id != Neha` AND `created_at > Neha's last_read_at`.
3. When Neha opens the conversation, the page fires `POST /api/verified-vibe/chat/mark-read` which stamps `user1_last_read_at` or `user2_last_read_at` to NOW().
4. The badge disappears on the next chat list fetch.

The API degrades gracefully if the `last_read_at` columns are missing (returns 0 unread) so the app never hard-crashes due to a missing migration.

---

### AI Bestie

**Chat route:** `/verified-vibe/chat/ai-bestie`
**Configure route:** `/verified-vibe/chat/ai-bestie/configure`

AI Bestie is Neha's personal match advisor. It has two modes:

#### Standalone advisor chat
Neha can ask free-form questions, request a digest of all her matches, or ask for
fresh insights on recent activity. The Bestie has full context on all of Neha's
matches (names, bios, recent messages) and her structured preferences.

Quick-action chips:
- 📋 Summarize my matches — one-paragraph digest of who has good energy
- ✨ Fresh insights — only flags things new in the last 48h
- ⚙️ Configure Bestie — goes to the configure page

Responses are rendered with markdown:
- `**bold**` → `<strong>`
- `- bullet` → `<ul><li>`
- Emoji used contextually: 🟢 good sign, 🔴 concern, 💡 tip, 💬 on their chat

#### Per-message analysis (in-conversation)
When Neha activates AI Bestie inside a match conversation (via the ✨ sparkle
button), every incoming message from the guy triggers:
1. A signal card: ✅ / ⚠️ / 🚩
2. A private "read" for Neha's eyes only
3. A suggested reply she can edit and send

**Signal defaults:**
- ✅ is the default — normal, genuine, or warm messages
- ⚠️ only for something specifically vague, inconsistent, or worth a follow-up
- 🚩 only for clear entitlement, dishonesty, disrespect, or a confirmed dealbreaker

**Conversational style (as of v2.2.0):**
The suggested reply follows 5 rules injected into every prompt:
1. Appreciate first — acknowledge something genuine the guy said
2. Share — add a small detail about Neha to keep it reciprocal
3. Ask one open question — not leading, not yes/no fishing
4. Keep it warm — he should enjoy the conversation
5. Never fish for a yes — ask questions where any honest answer reveals something real

#### Feedback
👍 / 👎 buttons appear below every Bestie chat response (visible on hover).
Hovering shows a tooltip: "Positive feedback" / "Negative feedback".
Clicking stores a row in `ai_bestie_feedback`.

#### Configure page
Neha can see and manage the structured preferences AI Bestie uses:
- Green cards: emotional signals she values
- Red cards: dealbreakers
- Amber cards: boundaries
- Purple cards: maturity signals
- Blue cards: private compatibility notes

Each item has a hover-reveal × delete button. Deleting calls `DELETE /api/ai-bestie/configure` which removes the item and returns the refreshed list.

#### AI Bestie toggle button (in-conversation)
- **Off state:** subtle purple tint, outline sparkle icon, purple border
- **On state:** pink→purple gradient fill, white solid sparkle, glowing ring, breathing pulse animation
- Tooltip: "Ask AI Bestie" / "Pause AI Bestie"

---

### Match Profiles

**Route:** `/verified-vibe/match-profile/[profileId]`

Rich profile view derived entirely server-side from existing `ai_assistant_profiles`
and user data — no new table required.

Sections:
- Photo (3:4, max 55vh) with TrustScoreBadge overlay
- Name, age, city, archetype chip
- **Here For** — intent statement
- **Vibe** — keyword pills derived from personality values
- **Personality Reads** — 4 trait bars (Decisiveness, Warmth, Openness, Pace) computed from archetype + keyword matching
- **What He Brings** — checklist from personality.brings
- **About** — bio
- **Communication Style** — from ai_assistant_profiles
- **Matters Most** — from ai_assistant_profiles

Back navigation: `?from=` query param so the back button returns to whichever screen launched the profile.

---

### Discovery

**Route:** `/verified-vibe/discover`

Card-based swipe interface showing unmatched users. Neha sees:
- Full-screen photo stack
- Name, age, city, trust score badge
- Archetype chip
- Like / Pass buttons

Likes create a row in `verified_vibe_likes`. When both users have liked each other, a `verified_vibe_matches` row is created with `status = 'mutual'`.

---

## API Reference

### Chat

#### `GET /api/verified-vibe/chat/conversations`
Auth: Bearer token (Supabase session JWT)

Returns all mutual matches with:
- `matchedUser` — name, age, avatar, archetype, trustScore
- `lastMessage` — latest message preview (or "No messages yet")
- `lastMessageTime` — ISO timestamp
- `unreadCount` — messages from the other user after Neha's last_read_at
- `hasMessages` — boolean split for NEW MATCHES vs active conversations
- `matchedAt` — when the match was created

#### `POST /api/verified-vibe/chat/mark-read`
Body: `{ matchId, userId }`

Stamps `user1_last_read_at` or `user2_last_read_at` to NOW().
Returns `{ ok: true }`. Non-blocking — called fire-and-forget from the conversation page.

### AI Bestie

#### `POST /api/verified-vibe/ai-bestie/chat`
Body:
```json
{
  "userId": "uuid",
  "message": "string",
  "intent": "chat | summary | insights",
  "history": [{ "role": "user | assistant", "content": "string" }]
}
```
Returns `{ reply, userMessage }`.

#### `POST /api/verified-vibe/ai-bestie/generate-response`
Body: `{ conversationId, adrianMessage, matchName, userId }`

Returns:
```json
{
  "signal": "✅ | ⚠️ | 🚩",
  "read": "Private note for Neha",
  "suggestedQuestion": "Ready-to-send reply to the guy"
}
```

#### `POST /api/verified-vibe/ai-bestie/feedback`
Body: `{ userId, feedbackType: "positive | negative", messageContent }`

Returns `{ ok: true }`. Inserts into `ai_bestie_feedback`.

#### `POST /api/verified-vibe/ai-bestie/opening-message`
Body: `{ conversationId, matchName }`

Returns `{ message }` — a natural first message to send.

#### `GET /api/ai-bestie/configure?userId=<uuid>`
Returns:
```json
{
  "probeTopics": [
    {
      "category": "dealbreakers",
      "emoji": "🚩",
      "heading": "Dealbreakers",
      "color": "#ef4444",
      "items": ["financial instability", "avoidant attachment"]
    }
  ],
  "interviewTopics": ["string array for legacy consumers"]
}
```

#### `DELETE /api/ai-bestie/configure`
Body: `{ userId, category, item }`

Removes a single item from the specified preference category.
Returns refreshed `{ probeTopics, interviewTopics }`.

---

## Supabase Migrations

All files in `supabase/migrations/`. Apply in filename order.
See `supabase/migrations/KIRO_SUPABASE_HANDOFF.md` for full SQL + RLS policies.

| Migration file | What it creates / alters |
|----------------|--------------------------|
| `20260520_create_verified_vibe_tables.sql` | All core tables (users, matches, messages, likes, passes, typing) |
| `20260520_create_ai_assistant_tables.sql` | AI assistant profiles, conversations, summaries |
| `20260520_enable_rls_ai_assistant_tables.sql` | RLS for AI assistant tables |
| `20260520_configure_rls.sql` | RLS for core VV tables |
| `001_ai_assistant_profiles.sql` | `ai_assistant_profiles` versioned store |
| `20260522_add_ai_bestie_active_to_matches.sql` | `ai_bestie_active` flag |
| `20260522_add_preferences_to_users.sql` | `preferences` JSONB + GIN index |
| `20260522_profile_section_staleness.sql` | `profile_section_stale` + trigger |
| `20260523_create_device_tokens.sql` | `device_tokens` + RLS |
| `20260522_ai_bestie_feedback.sql` | `ai_bestie_feedback` + RLS |
| `20260522_add_last_read_to_matches.sql` | `user1_last_read_at`, `user2_last_read_at` |

**Note on defensive coding:** Any query that selects new columns should wrap the
unread/optional logic in a try/catch that defaults to a safe value. This prevents
the app from hard-crashing if a migration hasn't been applied yet.

---

## Claude Prompt Design

All Claude calls go through `src/lib/claude.ts`.
Model: `claude-3-5-sonnet` (set in `CLAUDE_MODEL` constant).

### In-conversation AI Bestie (`generate-response`)

System context injected per request:
- Neha's `about`, `looking`, raw `preferences` JSONB
- Structured preferences from `ai_assistant_profiles` (emotional signals, dealbreakers, boundaries)

Prompt instructs Claude to return **only** a JSON object:
```json
{
  "signal": "✅ | ⚠️ | 🚩",
  "read": "private note",
  "suggestedQuestion": "reply to send"
}
```

Signal calibration: default ✅. The ⚠️ / 🚩 thresholds were explicitly tightened
in v2.2.0 after the Bestie was flagging normal small talk as concerning.

### Advisor chat (`chat`)

System prompt persona: "Neha's warm, perceptive personal dating advisor — like texting
your warmest, most grounded girlfriend."

Match context injected: up to 6 matches with last 6 messages each, bio, fresh-activity flag.
Preferences context injected: dealbreakers, emotional signals, boundaries, maturity signals.

Format instructions: `**bold**` for names, `- bullets` for lists, emoji sparingly
(🟢 🔴 💡 💬 ✨ 💛), short paragraphs.

### JSON parsing (Claude 4.x note)
Claude 4.x wraps JSON responses in markdown code fences even when instructed not to.
All JSON responses are stripped before parsing:
```typescript
const raw = content.text.trim().replace(/^```json\s*/i, '').replace(/```$/, '');
parsed = JSON.parse(raw);
```

---

## Release History

### v2.2.0 — Verified Vibe Messaging UX (2026-05-22)
- Rich Messages list: NEW MATCHES strip, archetype chips, trust scores, filter tabs, real unread counts
- AI Bestie tone overhaul: give-and-take, appreciative, non-interrogative
- AI Bestie chat: markdown rendering, thumbs feedback stored in DB, sparkle button with gradient + pulse
- Unread tracking: last_read_at per user per match, mark-read endpoint
- Removed tick/checkmark badges from all avatars
- New: `ai_bestie_feedback` table, `mark-read` API
- New migrations: ai_bestie_feedback, add_last_read_to_matches

### v2.1.0 — AI Bestie Config + Rich Profiles (2026-05-22)
- AI Bestie configure page: per-item deletion, colour-coded probe groups
- Rich match profile view: trait bars, vibe pills, "What He Brings", archetype sections
- BestieAvatar: confident flat-vector SVG with layered golden stars
- Seed script: 5 more male matches for Neha

### v2.0.0 — AI Bestie Launch
- AI Bestie: per-message analysis, signal cards (✅/⚠️/🚩), suggested replies
- Bestie activate/deactivate toggle in conversation
- AI Bestie standalone advisor chat
- Coaching cards persisted in localStorage

### v1.0.0 — Verified Vibe Core
- Full verification flow (ID, liveness, photos, intent)
- Discovery with like/pass
- Real-time chat with typing indicators
- Trust score system
- Archetype-based matching
