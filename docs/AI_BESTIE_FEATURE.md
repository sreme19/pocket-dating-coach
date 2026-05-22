# AI Bestie Feature — Full Technical Reference

> Last updated: 2026-05-22  
> Status: ✅ Production-ready, committed to `main`

---

## 1. What AI Bestie Is

AI Bestie is an **opt-in coaching layer** inside the Verified Vibe chat screen. When a female user (e.g. Neha) activates it, an AI agent monitors the male match's (e.g. Adrian's) incoming messages in real time, evaluates them, and:

1. Shows **Neha** a private coaching card (signal + analysis) beneath each of Adrian's messages
2. **Auto-sends** a follow-up question to Adrian — written in the voice of "Neha's AI Bestie", referring to Neha in the third person

Adrian sees the AI-generated message arrive as a normal chat message. He does not see the coaching card.

---

## 2. User Flow

```
Neha opens chat with Adrian
  └─► Neha taps "AI Bestie" button in the chat header
        └─► POST /api/verified-vibe/ai-bestie/activate
              └─► Sets ai_bestie_active = true on the match row (Supabase)
                    └─► startBestiePoller() begins (5-second interval)
                          └─► Adrian sends a message
                                └─► Poller detects new unresponded message
                                      └─► POST /api/verified-vibe/ai-bestie/generate-response
                                            ├─► Claude evaluates the message
                                            └─► Returns { signal, read, suggestedQuestion }
                                                  ├─► Coaching card stored in local Map (Neha only sees this)
                                                  └─► suggestedQuestion auto-sent via POST /api/verified-vibe/chat/send
                                                        └─► Appears in both chat windows as a real message
```

---

## 3. Architecture

### 3.1 Frontend — Chat Page

**File:** `src/routes/verified-vibe/chat/[conversationId]/+page.svelte`

#### Key State Variables

```typescript
let activeAssistant = $state<AssistantType | null>(null);
// null = no assistant, 'bestie' = AI Bestie active

let aiBestieActive = $state(false);
// Fetched from the match row on load — reflects Supabase state

let respondedToMessageIds = $state<Set<string>>(new Set());
// Tracks which of Adrian's message IDs have already been responded to.
// Persisted to localStorage to survive page reloads and prevent flooding.

interface CoachingCard { signal: string; read: string; }
let coachingCards = $state<Map<string, CoachingCard>>(new Map());
// Maps Adrian's message ID → coaching card. NEVER sent to Supabase.
// Only visible to the female user (Neha).

let pollInterval: ReturnType<typeof setInterval> | null = null;
// Reference to the 5-second poller. Cleared in onDestroy.

let userIsSeed = $state(false);
// Whether the logged-in user is a seed/test account (@seed.vv email).
// Used to show the "Clear Chat" button.
```

#### localStorage Keys

| Key | Value | Purpose |
|-----|-------|---------|
| `ai-bestie-active-{conversationId}` | `"true"` | Survives page reload — re-activates AI Bestie automatically |
| `bestie-responded-{conversationId}` | JSON array of message IDs | Prevents re-responding to already-handled messages after reload |

#### Activation Flow

```typescript
async function handleAssistantChange(type: AssistantType) {
  if (isActivating) return;
  isActivating = true;

  // Store in localStorage immediately for reload persistence
  localStorage.setItem(`ai-bestie-active-${conversationId}`, 'true');
  activeAssistant = type;

  // Tell the server to set ai_bestie_active = true on the match
  await fetch('/api/verified-vibe/ai-bestie/activate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ conversationId })
  });

  // Start polling (no opening message sent — coaching only)
  startBestiePoller();
}
```

> **Why no opening message?**  
> Early versions auto-sent an intro message from AI Bestie when activated. This caused confusion — Adrian saw an unexpected "AI Bestie has joined" message. Removed. AI Bestie only speaks in response to Adrian's messages.

#### Poller Logic

```typescript
function startBestiePoller() {
  if (pollInterval) clearInterval(pollInterval);
  pollInterval = setInterval(async () => {
    if (!activeAssistant || !$user || !conversationId) return;

    // Fetch latest messages from server
    const res = await fetch(`/api/verified-vibe/chat/${conversationId}`, { ... });
    const fetched: Message[] = ...;

    // Merge any new messages into the Svelte store
    messages.update(existing => {
      const existingIds = new Set(existing.map(m => m.id));
      const newMsgs = fetched.filter(m => !existingIds.has(m.id));
      return [...existing, ...newMsgs];
    });

    // Only respond to the latest message from Adrian (not Neha's own messages)
    const latest = fetched.filter(m => m.senderId !== $user?.id).at(-1);
    if (latest && !respondedToMessageIds.has(latest.id)) {
      await generateAndSendAIBestieResponse(latest.content, latest.id);
    }
  }, 5000); // 5-second interval
}
```

> **Why poll and not realtime?**  
> Supabase realtime subscriptions require the anon key to match RLS policies. The chat tables are protected, and the anon key cannot subscribe to them without bypassing RLS. Polling is simpler and sufficient for this use case.

#### Anti-Flooding Protection

Three independent layers prevent AI Bestie from spamming:

1. **In-memory Set check** — `respondedToMessageIds.has(messageId)` at the top of `generateAndSendAIBestieResponse`
2. **Immediate mark before await** — The ID is added to the Set *before* the fetch call, so concurrent poller ticks cannot race
3. **localStorage persistence** — `persistRespondedIds()` writes the Set to localStorage after every response; `loadRespondedIds()` restores it in `onMount` and in the `$effect` that re-activates the poller

```typescript
function persistRespondedIds() {
  localStorage.setItem(
    `bestie-responded-${conversationId}`,
    JSON.stringify([...respondedToMessageIds])
  );
}

function loadRespondedIds() {
  try {
    const saved = localStorage.getItem(`bestie-responded-${conversationId}`);
    if (saved) respondedToMessageIds = new Set(JSON.parse(saved));
  } catch { /* ignore */ }
}
```

`loadRespondedIds()` is called in **two places**:
- Inside `onMount` (after AI Bestie active state is restored from localStorage)
- Inside the `$effect` that watches `conversationId` (before `startBestiePoller()`)

This double-call is intentional — the `$effect` fires before `onMount` completes, so either path covers the case depending on timing.

#### Generating & Sending the Response

```typescript
async function generateAndSendAIBestieResponse(adrianMessage: string, messageId: string) {
  if (!$user || !$currentMatch) return;
  if (respondedToMessageIds.has(messageId)) return; // guard 1

  // Guard 2: mark immediately to block concurrent calls
  respondedToMessageIds = new Set([...respondedToMessageIds, messageId]);
  persistRespondedIds();

  try {
    // 1. Ask Claude to evaluate Adrian's message
    const response = await fetch('/api/verified-vibe/ai-bestie/generate-response', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ conversationId, adrianMessage, matchName: $currentMatch.firstName, userId: $user?.id })
    });
    const { signal, read, suggestedQuestion } = await response.json();

    // 2. Store coaching card in local state only (NEVER written to Supabase)
    coachingCards = new Map(coachingCards.set(messageId, { signal, read }));

    // 3. Auto-send the suggested question to Adrian as a real message
    if (suggestedQuestion) {
      const sendResponse = await fetch('/api/verified-vibe/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ conversationId, content: suggestedQuestion })
      });
      if (sendResponse.ok) {
        const sentData = await sendResponse.json();
        addMessage({ id: sentData.data.message.id, matchId: conversationId, senderId: $user.id, content: suggestedQuestion, createdAt: new Date(sentData.data.message.createdAt) });
      }
    }
    scrollToBottom();
  } catch (err) {
    // On failure, remove from responded set so poller can retry
    respondedToMessageIds.delete(messageId);
    persistRespondedIds();
  }
}
```

#### Coaching Card Rendering

Coaching cards are rendered **only for the female user** (Neha) beneath each of Adrian's messages:

```svelte
{#if !isSentMessage(message) && activeAssistant === 'bestie' && coachingCards.get(message.id)}
  {@const card = coachingCards.get(message.id)!}
  <div class="coaching-card">
    <span class="signal">{card.signal}</span>
    <p class="read">{card.read}</p>
  </div>
{/if}
```

Conditions explained:
- `!isSentMessage(message)` — only under messages from Adrian (received messages)
- `activeAssistant === 'bestie'` — only when AI Bestie is active
- `coachingCards.get(message.id)` — only when a card has been generated for this specific message

#### Adrian's Intro Card

Adrian sees a passive banner when AI Bestie is active, rendered at the top of the chat:

```svelte
{#if aiBestieActive && $currentMatch?.gender === 'woman'}
  <div class="ai-bestie-intro-card">
    ✨ AI Bestie — {$currentMatch.firstName.toUpperCase()}'S AI BESTIE IS HERE
  </div>
{/if}
```

`aiBestieActive` is fetched from the server on `onMount` and reflects the `ai_bestie_active` column on the match row. Adrian must reload his chat page to see this banner after Neha activates.

#### Clear Chat Button (Seed Users Only)

A red trash icon button appears in the chat header only when `userIsSeed === true`. Seed users have emails ending in `@seed.vv`.

```typescript
async function isSeedUser(): Promise<boolean> {
  const { getSupabaseClient } = await import('$lib/client/supabase');
  const supabase = getSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.email?.endsWith('@seed.vv') ?? false;
}

async function handleClearChat() {
  if (!confirm('Clear all messages? This cannot be undone.')) return;
  const { data: { session } } = await supabase.auth.getSession();
  await fetch(`/api/verified-vibe/chat/${conversationId}/clear`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${session?.access_token}` }
  });
  messages.set([]); // clear local store immediately
  respondedToMessageIds = new Set();
  persistRespondedIds();
  coachingCards = new Map();
}
```

---

### 3.2 Backend — API Endpoints

#### POST `/api/verified-vibe/ai-bestie/activate`

**File:** `src/routes/api/verified-vibe/ai-bestie/activate/+server.ts`

Sets `ai_bestie_active = true` on the `verified_vibe_matches` row.  
Requires Bearer token. Verifies the requester is `user1_id` or `user2_id` on the match.

```typescript
await supabase
  .from('verified_vibe_matches')
  .update({ ai_bestie_active: true })
  .eq('id', conversationId)
  .or(`user1_id.eq.${userId},user2_id.eq.${userId}`);
```

---

#### POST `/api/verified-vibe/ai-bestie/generate-response`

**File:** `src/routes/api/verified-vibe/ai-bestie/generate-response/+server.ts`

The core Claude integration. Accepts:

```typescript
{
  conversationId: string,
  adrianMessage: string,   // the raw message text from Adrian
  matchName: string,       // first name of the male user (e.g. "Adrian")
  userId: string           // Neha's user ID (used to fetch her preferences)
}
```

Fetches Neha's profile (`about`, `looking`, `preferences`) from `verified_vibe_users` to personalise the prompt.

**System prompt (as of 2026-05-22):**

```
You are AI Bestie — a sharp, no-nonsense AI assistant jumping into a dating conversation
on behalf of Neha. You are NOT Neha. You are her bestie. You speak to {matchName} in your
own voice, referring to Neha in the third person ("my bestie Neha", "Neha", "she").

{matchName} just said: "{adrianMessage}"

Evaluate his response and produce exactly three fields in this JSON format:
{
  "signal": "🚩" | "⚠️" | "✅",
  "read": "One or two sentences explaining what his response reveals about his intent,
           values, or character — evaluated as a potential partner for Neha.",
  "suggestedQuestion": "A single, direct follow-up message to {matchName}, written in the
                        voice of Neha's AI Bestie. Refer to Neha in the third person
                        (e.g. 'my bestie Neha is looking for...', 'Neha needs someone who...').
                        Do NOT write as if you are Neha. Be warm but firm.
                        End with a question to keep him accountable."
}

Signal guide:
- ✅ Positive — shows genuine interest, honesty, or compatibility
- ⚠️ Caution — vague, evasive, or worth pressing on
- 🚩 Red flag — entitlement, dishonesty, inconsistency, or a deal-breaker pattern

Return only the JSON object. No extra text.
```

**Critical voice rule:**  
`suggestedQuestion` must read as the AI Bestie speaking *about* Neha, not *as* Neha.

❌ Wrong: `"I appreciate the honesty, but I'm looking for something long-term."`  
✅ Correct: `"I appreciate the honesty, but my bestie Neha is looking for something long-term from the start. Would you agree you're not on the same page?"`

Returns:
```typescript
{
  signal: "🚩" | "⚠️" | "✅",
  read: string,
  suggestedQuestion: string
}
```

**JSON parsing note:**  
Claude 4.x wraps JSON in markdown fences (` ```json ... ``` `) even when instructed not to. Strip them before parsing:
```typescript
const raw = content.text.trim().replace(/^```json\s*/i, '').replace(/```$/, '');
parsed = JSON.parse(raw);
```
This is documented in `/memory/feedback_claude4_json_markdown.md`.

---

#### DELETE `/api/verified-vibe/chat/[conversationId]/clear`

**File:** `src/routes/api/verified-vibe/chat/[conversationId]/clear/+server.ts`

Deletes all messages for a conversation. **Seed users only** (enforced by checking email ends with `@seed.vv`).  
Used during development/testing to reset chat state without touching the database directly.

Guards:
1. Bearer token required
2. Email must end in `@seed.vv`
3. Requesting user must be `user1_id` or `user2_id` on the match

---

### 3.3 Database Schema

```sql
-- verified_vibe_matches
id            uuid PRIMARY KEY
user1_id      uuid REFERENCES auth.users   -- IMPORTANT: always user1_id / user2_id (NOT user_a_id / user_b_id)
user2_id      uuid REFERENCES auth.users
status        text CHECK (status IN ('pending', 'mutual', 'rejected'))
ai_bestie_active  boolean DEFAULT false
created_at    timestamptz

-- verified_vibe_messages
id            uuid PRIMARY KEY
match_id      uuid REFERENCES verified_vibe_matches
sender_id     uuid REFERENCES auth.users
content       text
created_at    timestamptz
```

> ⚠️ **Column name gotcha:** All code uses `user1_id` / `user2_id`. A bulk find-replace during debugging briefly introduced `user_a_id` / `user_b_id` across several files, breaking authentication checks with "Failed to verify match". If you see that error, search the codebase for `user_a_id` and revert to `user1_id`.

---

## 4. Infrastructure — Env & Build Fixes

### 4.1 ANTHROPIC_API_KEY Empty in Dev

**Problem:** Claude Code agent sets `ANTHROPIC_API_KEY=""` in the shell environment. Vite respects existing env vars and does NOT override them with `.env.local` values, so the API key was silently empty even though `.env.local` had a valid key.

**Fix:** `vite.config.ts` runs `forceLoadEnvLocal()` at startup, which reads `.env.local` and force-writes all keys into `process.env`, overriding empty values:

```typescript
function forceLoadEnvLocal() {
  const envLocalPath = resolve(process.cwd(), '.env.local');
  if (!existsSync(envLocalPath)) return;
  const content = readFileSync(envLocalPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.substring(0, eqIdx).trim();
    const val = trimmed.substring(eqIdx + 1).trim();
    if (key && val) {
      process.env[key] = val; // always overwrite, even if shell has an empty value
    }
  }
}
forceLoadEnvLocal(); // runs at Vite startup, before any plugins
```

This is called **before** `defineConfig(...)` so the env vars are set before SvelteKit's plugin reads them.

### 4.2 Singleton Claude Client Removed

The original `claude.ts` cached a singleton `_client`. This caused the empty API key to be baked in at first call and never retried even after the env was fixed. The fix creates a fresh `Anthropic` instance per call and throws clearly if the key is missing:

```typescript
export function getClaudeClient(): Anthropic {
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured. Check your .env.local file.');
  }
  return new Anthropic({ apiKey });
}
```

---

## 5. Seed User Reference

Seed users are pre-seeded test accounts with emails in the format:

```
{folder_name_lowercase}@seed.vv
```

Password for all seed accounts: `SeedPass123!`

Example for Neha:
- ❌ `neha@seed.vv` — stale orphaned auth user, no profile or matches. Do not use.
- ✅ `neha_nri_diaspora_x5r2vd@seed.vv` — correct account with full profile and mutual matches

To find the correct email for a seed user, check the seed data folder name and append `@seed.vv`.

---

## 6. What AI Bestie Does NOT Do

| Behaviour | Status |
|-----------|--------|
| Sends an opening message when activated | ❌ Removed (was causing confusion) |
| Writes coaching cards to Supabase | ❌ Never — local state only |
| Adrian sees the coaching card | ❌ Never — only Neha sees it |
| Responds to Neha's own messages | ❌ Filtered out by `senderId !== $user.id` |
| Re-responds to the same message on page reload | ❌ Prevented by localStorage persistence |
| Responds to multiple messages in one poll tick | ❌ Only responds to the single latest unresponded message |

---

## 7. Files Changed in This Feature

| File | Change |
|------|--------|
| `src/routes/verified-vibe/chat/[conversationId]/+page.svelte` | All AI Bestie UI, poller, coaching cards, clear button, flood prevention |
| `src/routes/api/verified-vibe/ai-bestie/generate-response/+server.ts` | Claude prompt — voice of AI Bestie (third person), not impersonating Neha |
| `src/routes/api/verified-vibe/ai-bestie/activate/+server.ts` | Sets ai_bestie_active flag on match |
| `src/routes/api/verified-vibe/chat/[conversationId]/clear/+server.ts` | New: seed-only chat clear endpoint |
| `src/routes/verified-vibe/api/message/+server.ts` | Corrected column names: user1_id / user2_id |
| `src/lib/claude.ts` | Removed singleton, added explicit API key validation |
| `vite.config.ts` | Added forceLoadEnvLocal() to fix empty ANTHROPIC_API_KEY |
