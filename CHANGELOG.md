# Changelog — Verified Vibe

All notable changes to the Verified Vibe app are documented here.

---

## [v2.5.0] — 2026-05-23

### AI Bestie — Actionable Draft Messages

The AI Bestie conversation page can now push messages directly to Neha's matches. When Neha confirms a message she wants to send, AI Bestie presents it as a one-tap action card — no copy-paste needed.

**What changed:**

- **Draft action cards** — When the AI response includes a confirmed message for a specific match, a green-accented card appears above the input bar showing the recipient name, message preview, a "Send to [Name] →" button, and a dismiss option.
- **One-tap send** — Tapping the send button fetches the current session token, calls `/api/verified-vibe/chat/send` with Bearer auth, removes the card, and posts a "✅ Sent to [Name]!" confirmation in the chat.
- **Server-side draft resolution** — The API builds a `nameToMatchId` map during match context assembly. Claude emits `[DRAFT:MatchFirstName]...[/DRAFT]` markers in its response. The server resolves each name to a match UUID, strips the markers from the visible reply, and returns `drafts[]` alongside `reply`.
- **Guard: only confirmed messages** — Claude is instructed to emit `[DRAFT]` blocks only when Neha has explicitly confirmed she wants to send — not for suggestions or examples. Unresolvable match names are silently dropped.

**Files changed:**
- `src/routes/api/verified-vibe/ai-bestie/chat/+server.ts`
- `src/routes/verified-vibe/chat/ai-bestie/+page.svelte`
- `docs/AI_BESTIE_FEATURE.md` — sections 8.5, 8.9, 8.10, updated section 9

---

## [v2.4.0] — 2026-05-22

### AI Bestie — Conversation Page + Critical Fixes

Full release of the standalone AI Bestie advisor screen, plus several critical fixes that were blocking the entire Verified Vibe app.

#### Critical Fixes

- **Auth + nav completely broken** — Root cause: `pathname` was used in `+layout.svelte` template without being declared. The `ReferenceError` silently broke Svelte's client-side hydration for every child route, making the "Send code" auth button non-responsive and the bottom nav disappear. Fixed by declaring `let pathname = $derived($page.url.pathname)`.
- **Discover page stuck on "Loading profiles…"** — `loadRichProfile()` was failing silently and leaving `richProfile = null` forever. Fixed with `buildFallbackProfile()` that always returns a renderable profile from basic discovery data (with archetype name/emoji from constants). `$effect` now passes the full profile object rather than just the ID to avoid a race condition.
- **Bottom nav missing for seed accounts** — Seed accounts don't have DB verification steps, so `currentPhase` was `'verify'`, hiding the nav. Fixed with a `VITE_SKIP_VERIFICATION=true` dev bypass: if set and the profile has `gender + archetype + first_name`, `currentPhase` is set to `'app'`.

#### AI Bestie Conversation Page

New dedicated chat UI at `/verified-vibe/chat/ai-bestie` where Neha can talk directly to her AI advisor.

**Features shipped:**

- **Match digest** (`📋 Summarize my matches` chip) — On-demand crisp summary of all mutual matches: who has good energy, who's worth more time, any genuine concerns.
- **Fresh insights** (`✨ Fresh insights` chip) — Flags only matches with new activity in the last 48 hours; no generic filler.
- **Free-form advice** — Ask anything about a specific match, situation, or strategy.
- **Preference detection** — When Neha explicitly states a dealbreaker, boundary, or signal, it's saved silently to her profile via `[PREF:type:value]` markers that Claude embeds in its reply. Markers are stripped before the reply reaches the client. Only fires on explicit statements, never on inference.
- **Configurable persona name** — Header shows the name configured in the AI Bestie setup screen (read from `localStorage` key `ai_bestie_persona`).
- **7-day message history** — Conversation persisted to `localStorage` (`vv_bestie_messages`), pruned to 7 days on load.
- **Auto-grow textarea** — Chat input grows from 2 rows up to 180px as you type; sends on Enter, newline on Shift+Enter.
- **Paragraph-formatted responses** — Markdown renderer converts `**bold**`, bullet lists, and double-newline paragraph breaks into proper HTML.
- **Feedback** — Thumbs up/down on each assistant message; sent to `/api/verified-vibe/ai-bestie/feedback`.

**AI context per request:**
- Neha's full preferences profile (dealbreakers, signals, boundaries, notes)
- Up to 6 most recent mutual matches with bio + last 6 messages each
- `🆕 (active in last 48h)` tag for insights intent

**Files changed:**
- `src/routes/verified-vibe/+layout.svelte` — pathname declaration fix, hydration order fix
- `src/lib/verified-vibe/stores.ts` — hydration ordering, `VITE_SKIP_VERIFICATION` bypass
- `src/routes/verified-vibe/discover/+page.svelte` — `buildFallbackProfile()`, rich profile race-condition fix
- `src/routes/verified-vibe/chat/ai-bestie/+page.svelte` — new AI Bestie conversation UI
- `src/routes/api/verified-vibe/ai-bestie/chat/+server.ts` — new chat API with context assembly, preference detection

---

## [v2.3.0] — 2026-05-22

### Android Deployment + Privacy Policy

- Privacy policy page at `/verified-vibe/privacy` (prerendered for static serving)
- Android SDK version fixes; Capacitor server URL corrected
- Android deployment handoff documentation

---

## [v2.2.0] — 2026-05-22

### Profile Autofill + AI Bestie History

- Auto-fill buttons for Personality, Looking For, and Lifestyle profile sections
- AI Bestie per-match chat history with 15-day auto-pruning (later reduced to 7 days in v2.4)

---

## [v2.1.0] — 2026-05-22

### Verified Vibe Core — Auth, Discover, Chat

Initial production-ready state of the Verified Vibe sub-app:

- Auth flow (email OTP)
- Verification steps (identity, selfie, intent)
- Discovery feed with swiping
- 1-on-1 match chat with AI Bestie per-match coaching
- Profile creation and archetype selection
- Trust score display

---

> Versions prior to v2.1 were internal prototypes. See git history for full details.
