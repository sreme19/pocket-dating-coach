# AI Agent Test Suite — Design & Build Handoff

> Target: a new **Test Suite** admin surface at `/admin/test-suite` (top-level nav item next to **Analytics**) that lets an operator load any user's AI assistant — with the **exact same knowledge base, prompts, and API connections as production** — prompt it, see the response the real owner/match would get, and inspect an **observability trace** of all background work the agent did to produce that response.

This document is self-contained. Read it top to bottom, then implement. It assumes the reader has the repo open at `/pocket-dating-coach` but knows nothing about prior conversation.

---

## 0. Non-negotiable principle: reuse production code, never reimplement

The whole value of this suite is that it exercises the **real** agent code path. Do **not** copy prompt strings, re-call Claude with a hand-written prompt, or re-query the KB in a parallel implementation — that would drift from production and make the suite worthless.

Instead, refactor each agent's generation logic into a **pure core function** that both the existing production endpoint and the new test endpoint call. The core takes two cross-cutting params:

- `trace` — an optional collector object; production passes a no-op, the test endpoint passes a real collector that records every background step.
- `persist` — a boolean; production passes `true` (write reply messages, bump profile versions, queue reports), the test endpoint passes `false` so test runs are **side-effect-free by default**.

If the core function is the single source of truth, the test path can never diverge from production.

---

## 1. Current architecture (verified against code)

### 1.1 The three agents

| Agent | Who | Modes | Production entry point | System prompt builder |
|---|---|---|---|---|
| **AI Bestie** | Female users | (a) advisor chat, (b) per-match reply on her behalf | (a) `POST /api/ai-bestie/message` → `src/routes/api/ai-bestie/message/+server.ts`; (b) `generateAndSendBestieReply()` → `src/lib/server/bestie-responder.ts:166` | (a) `buildAIBestieSystemPrompt()` `src/lib/prompts.ts:304`; (b) `buildBestieReplyPrompt()` `src/lib/prompts.ts:479` |
| **AI Wingman** | Male users | advisor chat (+ intelligence intent) | `POST /api/verified-vibe/ai-wingman/chat` → `src/routes/api/verified-vibe/ai-wingman/chat/+server.ts` | `buildAIWingmanSystemPrompt()` `src/lib/prompts.ts:375` |
| **AI Matchmaker** | System (pairs users) | nightly batch + on-demand intelligence | `POST /api/verified-vibe/matchmaker/intelligence` → `.../matchmaker/intelligence/+server.ts`; core in `src/lib/server/matchmaker-service.ts` | inline prompts in `softScore()` `matchmaker-service.ts:102` |

### 1.2 Shared infrastructure

- **Claude client**: `src/lib/claude.ts`. Model `claude-sonnet-4-5-20250929`, maxTokens 2048 (Matchmaker soft-score uses 300). Methods `askClaude()`, `askClaudeWithImage()`, `streamClaude()`.
- **Knowledge base (RAG)**: `searchBookChunks()` `src/lib/vectorstore.ts:3` → Supabase RPC `match_book_chunks(query_embedding, topK=5)`. Query embedding via Voyage `voyage-3-lite` in `src/lib/embeddings.ts:25`. Ingestion: `scripts/ingest.ts` (500-word chunks, 50 overlap → `book_chunks`).
- **Profiles**: `src/lib/server/profile-service.ts`. `loadPreferences(userId)` (women, `profile_type='preferences'`) and `loadPersonality(userId)` (men, `profile_type='personality'`) read latest version from `ai_assistant_profiles` with a 5-min in-memory cache. `updatePreferences()/updatePersonality()` write a new versioned row + `reason`. History via `getPreferencesHistory()/getPersonalityHistory()`.
- **Master profile** (Wingman, newer): `user_master_profile.data` (identity, generatedProfile, verifiedProofs) loaded inline in the wingman chat route (~lines 96–156).
- **Background workers**:
  - `autoUpdateProfile()` / `analyzeMatchCompatibility()` — `src/lib/server/ai-assistant-service.ts:306` / `:230` (insight extraction → profile merge; green/yellow/red flag scoring).
  - `appendAdvisorChat()` — `src/lib/server/advisor-chat.ts` (persists each owner↔assistant exchange to `ai_assistant_advisor_chats`).
  - Loop prevention — `POST /api/ai-loop-prevention/check`; counters on `ai_assistant_conversations.exchange_count` / `last_exchange_at`.
  - Intelligence reports — `queueIntelligenceReport()` `matchmaker-service.ts:398` → `vv_intelligence_reports`; processed by `src/lib/server/intelligence-report-processor.ts`.
- **Latency observability (already exists)**: every Bestie/Wingman reply upserts `vv_ai_response_timings` (`reply_message_id`, `response_type`, `generation_ms`, `claude_ms`, `waited_from_user_msg_ms`, render/delivery added client-side). Surfaced in **Analytics → AI Latency** tab. Matchmaker runs log to `vv_matchmaker_runs`.

### 1.3 Data model (key tables)

- `verified_vibe_users` — `id`, `gender` ('man'|'woman'|'prefer_not_to_say'), `archetype`, `first_name`, `age`, `city`, `trust_score`, `is_seed`.
- `verified_vibe_matches` — `id`, `user1_id`, `user2_id`, `status`, `ai_bestie_active`.
- `verified_vibe_messages` — `id`, `match_id`, `sender_id`, `content`, `is_ai`, `ai_signal`, `created_at`.
- `ai_assistant_profiles` — `user_id`, `profile_type` ('preferences'|'personality'), `data` (JSONB), `version`, `reason`, `is_current`.
- `ai_assistant_advisor_chats` — `user_id`, `assistant_type`, `messages` JSONB `[{role,content,ts,id?}]`.
- `ai_assistant_conversations` — per-match assistant transcript + `exchange_count`, `last_exchange_at`.
- `vv_pool_wingmen` / `vv_pool_besties` — distilled, Matchmaker-readable profile + preference signals.
- `vv_intelligence_reports`, `vv_matchmaker_runs`, `vv_ai_response_timings`.

### 1.4 Gender → assistant routing

`verified_vibe_users.gender` decides the assistant: `gender === 'woman' ? 'bestie' : 'wingman'` (see `src/routes/api/verified-vibe/ai-greeting/+server.ts`). The test suite must apply the **same** rule, not let the operator pick the assistant manually.

### 1.5 Admin shell & auth (reuse as-is)

- Nav: `src/routes/admin/+layout.svelte:9` (array of `{href,label}`). **Add `{ href: '/admin/test-suite', label: 'Test Suite' }` here.**
- Auth: shared password `QA_ADMIN_PASSWORD` → HMAC token in `pdc_admin` cookie (`src/lib/server/admin-auth.ts`); enforced in `src/routes/admin/+layout.server.ts` (redirects to `/admin/login`). The new route lives under `/admin`, so it inherits this gate automatically.
- UI conventions: dark navy bg `#0b1120`, card surface `#0d1522`, borders `white/[0.06]`, emerald `#10b981` primary, indigo for AI, rose for danger. Tailwind 4, bits-ui available. Tabs are a custom `<button>` bar + `activeTab` conditional render (see `src/routes/admin/analytics/+page.svelte:257`). Chart.js v4 if charts needed.

---

## 2. Goals & scope

Build an admin **Test Suite** with three cases. Each case returns **the response the real user/match would receive** plus an **observability trace** of the background work.

- **Case 1 — Individual assistant (advisor mode).** Load any profile (e.g. Sreekanth → AI Wingman, Mekhala → AI Bestie). Prompt it freely ("how can I get better matches?"). Get back the owner's reply + trace.
- **Case 2 — Bestie in match chat.** Load a female owner; the operator role-plays one of her male matches and chats. Get back the on-her-behalf Bestie reply the match would see + trace.
- **Case 3 — Matchmaker.** Run hard-filter + soft-score on a chosen pair (and optionally per-match ranking / competitive report). See pass/exclude reasons, 0–100 score, rationale, flags, prompt.

Out of scope: rubric scoring / human review of **production** interactions (covered by the existing QA Queue at `/admin/qa`). The Test Suite is for **driving** agents and **inspecting** them.

**Hard separation from the production QA Queue (decided).** The Test Suite must **never** write into the existing QA tables (`ai_qa_reviews`, the QA review queue, etc.). That queue is exclusively for QA of real production interactions and mixing synthetic test runs into it would corrupt those metrics. The Test Suite gets its **own** logging system (see §7.5) — its own tables, its own history view — fully isolated from production QA.

---

## 3. The observability trace (shared contract)

Define one normalized shape in `src/lib/server/agent-trace.ts`. All cores emit it; one Svelte component renders it.

```ts
export interface AgentTrace {
  agent: 'bestie_advisor' | 'bestie_match_reply' | 'wingman_advisor' | 'matchmaker';
  startedAt: string;            // ISO
  // --- inputs ---
  subject: {                    // whose assistant this is
    userId: string;
    name: string;
    gender: string;
    archetype?: string;
  };
  routing: { resolvedAssistant: 'bestie' | 'wingman'; reason: string };
  // --- profile loaded ---
  profile: {
    type: 'preferences' | 'personality' | null;
    version: number | null;
    data: unknown;              // the JSONB actually injected
    source: 'ai_assistant_profiles' | 'user_master_profile' | 'default';
  };
  matchContext?: unknown;       // abstracted match signals injected (Wingman/Bestie)
  // --- KB retrieval ---
  kb: {
    query: string;
    embeddingModel: string;     // 'voyage-3-lite'
    topK: number;
    chunks: { chapter: string; similarity: number; preview: string }[];
  } | null;
  // --- the actual Claude call ---
  claude: {
    model: string;
    maxTokens: number;
    systemPrompt: string;       // FULL assembled system prompt
    userMessage: string;
    rawOutput: string;          // before any post-processing
    usage?: { inputTokens?: number; outputTokens?: number };
  };
  // --- post-processing ---
  output: {
    reply: string;
    citations: string[];
    suggestions?: string[];
    coachingSignal?: { color: 'green'|'yellow'|'red'; text: string }; // Case 2
  };
  // --- background side-effects (what WOULD happen in prod) ---
  sideEffects: {
    name: string;               // e.g. 'autoUpdateProfile', 'queueIntelligenceReport', 'loopPreventionCheck'
    wouldPersist: boolean;      // false in test mode
    detail: unknown;            // extracted insights / report payload / counter values
  }[];
  // --- timing (mirror vv_ai_response_timings) ---
  timing: { totalMs: number; claudeMs: number; embeddingMs?: number; kbMs?: number };
  // --- matchmaker-specific (optional) ---
  matchmaker?: {
    hardFilter: { excluded: boolean; reasons: string[] };
    softScore: { score: number; rationale: string; flags: string[] };
  };
}
```

Implement `trace` as a small mutable collector with helper methods (`trace.setProfile()`, `trace.addChunk()`, `trace.recordClaude()`, `trace.addSideEffect()`, `trace.finish()`), plus a `NOOP_TRACE` used by production callers.

---

## 4. Refactor plan (extract the cores)

Minimal, behavior-preserving extractions. After each, the production endpoint just calls the core with `persist:true, trace:NOOP_TRACE` and must behave identically (verify with existing tests + a manual smoke run).

1. **`generateBestieAdvisorCore(input, opts)`** — pull the body of `src/routes/api/ai-bestie/message/+server.ts` (profile load → KB search → `buildAIBestieSystemPrompt` → Claude → citation parse) into `src/lib/server/cores/bestie-advisor-core.ts`. Route becomes a thin wrapper.
2. **`generateBestieMatchReplyCore(input, opts)`** — extract from `generateAndSendBestieReply()` in `bestie-responder.ts` the generation portion (build `buildBestieReplyPrompt` → Claude → signal/citation parse). The `persist` flag gates the message insert + `vv_ai_response_timings` upsert + coaching-signal attach.
3. **`generateWingmanCore(input, opts)`** — extract from `.../ai-wingman/chat/+server.ts` (master-profile load, match context assembly, intelligence-intent detection, prompt build, Claude, advisor-chat append). `persist` gates `appendAdvisorChat()`, `queueIntelligenceReport()`, and the timings upsert. Intelligence intent is still **detected** in test mode and recorded as a `sideEffect` with `wouldPersist:false`.
4. **`scorePairCore(maleRow, femaleRow, opts)`** — extract `hardFilter()` + `softScore()` from `matchmaker-service.ts` so a single pair can be evaluated without running the nightly batch. Return `{ hardFilter, softScore }` and fill `trace.matchmaker`.

Each core signature: `(input, { persist, trace }: { persist: boolean; trace: TraceCollector })`.

---

## 5. Routes & files to create

```
src/routes/admin/test-suite/
  +page.svelte            # tab shell: Case 1 | Case 2 | Case 3 | History
  +page.server.ts         # load() → list of seed/test profiles (id, name, gender, archetype)
src/routes/api/admin/test-suite/
  profiles/+server.ts     # GET: searchable profile list (reuse verified_vibe_users)
  advisor/+server.ts      # POST Case 1: { userId, message, history } → { reply, trace }
  match-reply/+server.ts  # POST Case 2: { ownerUserId, matchId?, asMatchProfile, message, history } → { reply, trace }
  matchmaker/+server.ts   # POST Case 3: { maleUserId, femaleUserId } or { userId, mode } → { result, trace }
  warm-matrix/+server.ts  # POST Case 3: score all uncached seed pairs into ts_pair_scores
  runs/+server.ts         # GET: list/read ts_runs for the History tab
supabase/migrations/
  <ts>_test_suite_logging.sql   # creates ts_runs + ts_pair_scores (see §7.5)
src/lib/server/cores/
  bestie-advisor-core.ts
  bestie-match-reply-core.ts
  wingman-core.ts
  matchmaker-core.ts      # wraps scorePairCore + optional ranking/competitive
src/lib/server/agent-trace.ts   # AgentTrace type + collector + NOOP_TRACE
src/lib/components/admin/
  TracePanel.svelte       # renders AgentTrace (collapsible sections)
  ChatTester.svelte       # shared chat UI (message list + composer) for Case 1 & 2
```

All `/api/admin/**` endpoints must re-check the admin token (the `+layout.server.ts` gate covers pages, not API routes) — import `tokenIsValid` from `admin-auth.ts` and 401 if absent.

---

## 6. Case-by-case UX & data flow

### Case 1 — Individual assistant (advisor)

UI: left = profile picker (search seed profiles by name/archetype/gender) + chat composer; right = `TracePanel`. A badge shows the resolved assistant (Bestie/Wingman) derived from gender — operator cannot override.

Flow: `POST /api/admin/test-suite/advisor { userId, message, history }` →
- resolve gender → assistant; if Bestie call `generateBestieAdvisorCore`, if Wingman call `generateWingmanCore`, both with `persist:false, trace:collector`.
- respond `{ reply, suggestions, citations, trace }`.

Render the reply in the chat bubble exactly as the owner's app would (same citation/suggestion formatting). Render the trace on the right.

### Case 2 — Bestie in match chat

UI: pick a **female** owner (filter `gender='woman'`). Optionally pick an existing match from `verified_vibe_matches` to inherit real `matchContext`, or define an ad-hoc "as this match" profile (gender man, age range, dating app, goal). Operator types as the **male match**; responses are the Bestie's on-her-behalf replies.

Flow: `POST /api/admin/test-suite/match-reply { ownerUserId, matchId?, asMatchProfile, message, history }` →
- call `generateBestieMatchReplyCore` with `persist:false`. The core builds `buildBestieReplyPrompt` with the owner's preferences + match context, runs Claude, parses the 3rd-person reply + coaching signal.
- respond `{ reply, coachingSignal, citations, trace }`.

Note in the trace whether the realtime/poller path would have inserted a message and bumped `exchange_count` (loop prevention) — record as side-effects, do not write.

### Case 3 — Matchmaker

UI: two pickers (a male user, a female user) → "Score pair" button; results card shows hardFilter (excluded? + reasons), softScore (0–100 gauge, rationale, flags), and the exact prompt in the trace. Secondary controls: "Per-match ranking" (male) and "Competitive report" (female) that render the structured output (read-only; `persist:false` so nothing is queued/fired).

Flow: `POST /api/admin/test-suite/matchmaker { maleUserId, femaleUserId }` →
- load both pool rows (`vv_pool_wingmen`/`vv_pool_besties`); if a user isn't enrolled, surface a clear "not in pool — run refreshPoolEntry first" message.
- call `scorePairCore` → respond `{ hardFilter, softScore, trace }`.

### Case 3 cost — cache the pairwise score matrix instead of fanning out

The production per-match ranking scores a user against ~20 competitors → ~20 Claude calls **per run**. That cost model assumes a large live pool. Here the pool is a small **fixed** seed set (21 male + 21 female) plus the 2 real profiles (Sreekanth, Mekhala) — so re-scoring the same pairs on every run is pure waste. Do this instead:

1. **Cache every pairwise score** in `ts_pair_scores` (§7.5), keyed by both user IDs **and** both profile versions. `scorePairCore` checks the cache first; on hit it returns instantly with zero Claude calls and marks the trace `cached: true`. On miss it scores once and writes the row. A profile-version change naturally invalidates only the affected pairs.
2. **Per-match ranking reads from the matrix, it does not re-score.** Ranking a male = look up his cached score against each female in the pool (and vice-versa). With the full matrix warm, ranking and competitive reports cost **0 Claude calls** — they're just sorts over cached numbers. The only Claude cost is the gap-action / action-list narration, which is 1–2 calls, not 20.
3. **"Warm the matrix" button (admin).** One control that scores all uncached male×female pairs in the seed pool once (≤ 21×21 = 441 pairs, but realistically far fewer survive hard-filter; run them sequentially or in small batches with a visible progress count). After warming, every ranking/competitive view in the suite is instant and free. Re-warm only refreshes cache misses.
4. **Configurable competitor cap** for any genuinely live run: default `N=5` competitors in test mode instead of 20, with the cap shown in the UI so the operator knows coverage was bounded (never silently truncate).
5. **Always show cost.** Each Case 3 result displays "Claude calls this run: X (Y served from cache)" so the operator sees exactly what was spent.

Net effect: the expensive fan-out happens at most **once per (pair, profile-version)** across the whole suite's lifetime, not once per run.

---

## 7. Side-effect safety (critical)

Default **all** test runs to `persist:false`. This is the load-bearing guarantee of the whole suite, so it is spelled out at the exact call sites. Several agent paths that look read-only actually write — these **must** be gated:

| Write | Call site | Why it's dangerous in test mode |
|---|---|---|
| **`autoUpdateProfile('bestie', …)`** | `src/routes/api/ai-bestie/message/+server.ts:368` | **Highest risk.** Writes a new version into `ai_assistant_profiles` — the same table the agent reads on every future request. Un-gated, testing the Bestie literally retrains its preferences and changes production behavior. |
| `ai_assistant_conversations` upsert | `.../ai-bestie/message/+server.ts:332` | Persists the advisor transcript + bumps exchange state. |
| `verified_vibe_messages` insert + coaching-signal attach + `exchange_count` bump | `src/lib/server/bestie-responder.ts` (Case 2 path) | Injects a fake AI message into a real match thread and advances loop-prevention counters. |
| `queueIntelligenceReport(...)` | `.../ai-wingman/chat/+server.ts:82` | Fires a real intelligence report (and downstream push). |
| `appendAdvisorChat(...)` | `.../ai-wingman/chat/+server.ts:390` | Persists the Wingman advisor transcript. |
| `vv_ai_response_timings` upsert | `.../ai-wingman/chat/+server.ts:400`; bestie-responder | Would pollute the production Analytics → AI Latency dashboard with synthetic runs. |
| `updatePreferences` / `updatePersonality` | `profile-service.ts` (via `autoUpdateProfile`) | Profile version bumps the agent reads from. |
| match-firing / report writes | `matchmaker-service.ts` nightly + on-demand | Creates real matches / queued reports. |

In test mode the cores must perform **none** of the above. Intent detection, insight extraction, compatibility scoring, etc. are still **computed** (so the trace can show "this is what would have been written") and recorded as `sideEffects` with `wouldPersist:false` — but the DB write is skipped.

Confirmed safe (no gating needed): `loadPreferences` / `loadPersonality` do **not** insert a default row on a missing profile — they return an in-memory default and only populate the read cache (`profile-service.ts:57`, `:107`). Reads of profiles, master profile, pool rows, KB chunks, and existing messages are all non-mutating.

Reads (profile load, KB search, pool rows, master profile) use the real service-role client `getSupabase()` (`src/lib/server/supabase.ts`) and the real Claude/Voyage APIs — that is what makes it "production-identical".

Note: "side-effect-free" refers to **production** tables only. The Test Suite **does** persist a record of each run into its **own** isolated logging tables (§7.5) so runs can be reviewed/compared later — that is separate QA, never the production QA Queue.

---

## 7.5 Test Suite's own logging system (separate from QA Queue)

The Test Suite owns its logging end to end. New tables, prefixed `ts_` to make the separation obvious and to keep them out of any production query:

```sql
-- one row per test run (Case 1/2/3)
create table ts_runs (
  id            uuid primary key default gen_random_uuid(),
  case_type     text not null,          -- 'advisor' | 'match_reply' | 'matchmaker'
  agent         text not null,          -- 'bestie_advisor' | 'wingman_advisor' | 'bestie_match_reply' | 'matchmaker'
  subject_user_id  uuid,                 -- whose assistant
  counterpart_user_id uuid,             -- match (Case 2) or female (Case 3)
  reviewer      text,                   -- pdc_reviewer cookie, for attribution
  input         jsonb not null,         -- the operator's message/params + history
  output        jsonb not null,         -- reply / score result
  trace         jsonb not null,         -- the full AgentTrace
  created_at    timestamptz default now()
);

-- cached pairwise matchmaker scores so repeated runs don't re-call Claude (see §6 Case 3)
create table ts_pair_scores (
  male_user_id    uuid not null,
  female_user_id  uuid not null,
  male_profile_version   int,           -- invalidate cache when a profile changes
  female_profile_version int,
  hard_filter   jsonb not null,         -- { excluded, reasons }
  soft_score    jsonb not null,         -- { score, rationale, flags }
  scored_at     timestamptz default now(),
  primary key (male_user_id, female_user_id, male_profile_version, female_profile_version)
);
```

These tables live in their own migration and are read **only** by the Test Suite. Add a **History** tab to `/admin/test-suite` that lists recent `ts_runs` (filter by case/agent/subject) and re-renders any stored `AgentTrace` in the same `TracePanel` — so a test conversation can be revisited or diffed without re-running it. No `ts_*` data ever flows into `/admin/qa`.

---

## 8. TracePanel rendering

Collapsible sections in this order, matching the user's mental model of "background work":
1. **Routing & subject** — name, gender, resolved assistant + reason.
2. **Profile loaded** — type, version, source, pretty-printed JSON of the injected `data`.
3. **Match context** (Cases 1-Wingman / 2) — abstracted signals injected.
4. **Knowledge base** — query, model, table of top-K chunks (chapter, similarity %, preview).
5. **Claude call** — model, maxTokens, **full system prompt** (monospace, scrollable), user message, raw output, token usage.
6. **Post-processing** — citations, suggestions, coaching signal.
7. **Background side-effects** — list of what would have fired (badge "skipped — test mode").
8. **Timing** — total / claude / embedding / kb, styled like the AI Latency tab (amber/red thresholds optional).

Add a "Copy trace JSON" button for sharing/repro.

---

## 9. Build order

1. `agent-trace.ts` (type + collector + NOOP) + the `ts_runs` / `ts_pair_scores` migration (§7.5).
2. Refactor #1 (Bestie advisor core) + verify production route unchanged. Wire `ts_runs` logging.
3. `TracePanel.svelte` + `ChatTester.svelte` + the `/admin/test-suite` page shell + nav link → **Case 1 end-to-end** for both Bestie & Wingman (needs refactor #3 too).
4. Refactor #2 (Bestie match-reply core) → **Case 2**.
5. Refactor #4 (matchmaker `scorePairCore`) with `ts_pair_scores` cache + "Warm the matrix" → **Case 3**.
6. **History tab** reading `ts_runs`.
7. API-route auth checks, empty/error states (no profile in pool, no KB hit, Claude error), per-run cost display, "Copy trace JSON".

---

## 10. Acceptance criteria

- New **Test Suite** item appears next to Analytics, behind the existing admin password.
- Case 1: selecting a male seed profile loads Wingman, a female loads Bestie (auto-derived); prompting returns a reply byte-identical in formatting to production and a fully populated trace.
- Case 2: chatting as a match to a female owner returns the same on-her-behalf reply + coaching signal the match would receive.
- Case 3: scoring a pair returns hard-filter reasons + a 0–100 soft score with rationale/flags and the exact prompt.
- **No test run writes to any production table** (verify: row counts in `verified_vibe_messages`, `ai_assistant_profiles`, `ai_assistant_conversations`, `ai_assistant_advisor_chats`, `vv_ai_response_timings`, `vv_intelligence_reports`, and all production QA tables unchanged after a test session). Runs persist only to `ts_runs` / `ts_pair_scores`.
- **Specifically**: after a Bestie advisor test run, the subject's latest `ai_assistant_profiles` version is unchanged (proves `autoUpdateProfile` was gated — the #1 risk). After a Wingman test run, no new `vv_intelligence_reports` row exists.
- The History tab can re-render any past run's trace without re-calling Claude.
- Re-running the same Case 3 pair (same profile versions) makes **zero** Claude calls (served from `ts_pair_scores`), shown in the per-run cost line.
- Production Bestie/Wingman/Matchmaker behavior is unchanged after the refactors (existing tests pass; manual smoke run matches prior output).

---

## 11. Decisions & remaining open questions

**Decided:**
1. **Persisted test runs — separate system, not the QA Queue.** Test runs are **never** written to the production QA Queue (`ai_qa_reviews` etc.); that queue is only for production interactions. The Test Suite logs to its own `ts_runs` / `ts_pair_scores` tables and has its own History tab (§7.5).
2. **Matchmaker cost — cache the pairwise matrix.** The pool is a small fixed seed set (21 + 21) plus 2 real profiles (Sreekanth, Mekhala). Score each pair at most once per profile-version into `ts_pair_scores`; rankings/competitive reports read from cache (0 Claude calls); a "Warm the matrix" button pre-scores the whole pool once; default competitor cap N=5 for any live run; per-run cost always displayed (§6 Case 3).

**Still open:**
3. **Custom profiles?** Case 2 "ad-hoc match profile" — needed, or only real existing matches?
4. **KB transparency.** OK to show full book-chunk text in the trace, or preview only (licensing/IP)?
5. **Token usage.** Surface Claude input/output token counts per run for cost tracking? (Requires reading `usage` off the Anthropic response — easy to add in `claude.ts`.)
