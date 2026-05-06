# Pocket Dating Coach — Steering Document

> AI-powered dating coach for the Indian market.
> SvelteKit frontend, Anthropic Claude API backend, RAG over a dating advice book.
> Features: profile analysis (vision), chat coaching, conversation analysis, reply generation.
>
> **This document covers:** architecture decisions, design rationale, and the
> operational upgrade roadmap (observability, caching, evaluation, model routing).

---

## What It Does

Users set a gender/age/app/goal profile once, then access four AI-powered features:

| Feature | Input | Output |
|---|---|---|
| **Chat coaching** | Free-form question | Advice grounded in the book |
| **Profile analysis** | Screenshot of dating profile | Structured feedback: bio, photos, prompts, opening strategy |
| **Conversation analysis** | Screenshot of chat | What's working, what needs work, next move |
| **Reply generation** | Conversation + their last message | 3 replies (playful / warm / direct) |

All outputs cite specific book chapters/principles. The book context is retrieved via
semantic similarity (embeddings + vector store).

---

## Architecture

### Tech Stack

| Layer | Technology |
|---|---|
| Frontend | SvelteKit + TypeScript |
| AI client | Anthropic Claude SDK (`src/lib/claude.ts`) |
| RAG | Embeddings (`src/lib/embeddings.ts`) + vector store (`src/lib/vectorstore.ts`) |
| Prompts | Centralised in `src/lib/prompts.ts` |
| Types | `src/lib/types.ts` |

### Request Flow

```
User action (chat / profile screenshot / conversation screenshot / reply request)
    ↓
Retrieve book context (embedding similarity → top K chunks)
    ↓
Build system prompt (persona + book context + gender instruction + user profile)
    ↓
Claude API call (claude-sonnet-4-5, max 2048 tokens)
    ↓
Return structured or free-form response
```

### Four API Patterns

1. **`askClaude`** — single-turn Q&A (no history). Used for profile and conversation analysis.
2. **`askClaudeWithImage`** — single-turn with base64 image. Used for profile/conversation screenshots.
3. **`streamClaude`** — streaming multi-turn chat. Used for the coaching chat feature.
4. All three share the same model constant (`CLAUDE_MODEL`) and max tokens (`MAX_TOKENS`).

### Prompt Design

All prompts are in `src/lib/prompts.ts`. Key pattern:

- System prompt always leads with the retrieved book excerpt as primary source
- Gender instruction adapts the male-written source material for women users
- Citations are required in every response (`Based on: [chapter or section name]`)
- Structured outputs (profile analysis, conversation analysis, reply generation) use
  strict JSON format specified in the system prompt

---

## Design Decisions

**Why RAG over full-book context?**
The book exceeds Claude's practical context budget for repeated calls. RAG retrieves
the 3–5 most relevant chunks per query, keeping prompts focused and costs manageable.
Trade-off: chapter-spanning advice may lose connective tissue between chunks.

**Why Svelte/SvelteKit?**
Lightweight bundle, fast hydration — important for a mobile-primary use case where
users are on mid-range phones. The dating coach is used in-the-moment (while on the
app), so load time matters.

**Why structured JSON for analysis features?**
Profile analysis and conversation analysis are multi-section outputs. Structured JSON
allows the frontend to render each section independently with its own heading and
layout, rather than parsing a free-form markdown response.

**Why centralised prompts.ts?**
All four prompt builders share the same patterns: book context injection, gender
instruction, user profile context. Centralising them prevents the prompts from
drifting and makes it easy to update the citation format or tone globally.

---

## Operational Upgrade Roadmap

### Context: Current Gaps

The app calls Claude with no observability, no prompt caching (despite large static
book context), no session persistence (chat history is browser-only), and no
evaluation of whether citations are accurate. The upgrades below address these in
priority order.

---

### Phase 1 — Prompt Caching (quick win, do first)

**Goal:** Reduce cost and latency for every feature. The book context is large and
repeated on every call — it's the ideal caching target.

**Current state:** Every call to `askClaude`, `askClaudeWithImage`, and `streamClaude`
re-processes the full book context (can be several hundred tokens per retrieved chunk).

**What to change in `claude.ts`:**

```typescript
// In askClaude and askClaudeWithImage — mark the system prompt as cacheable
const response = await client.messages.create({
  model: CLAUDE_MODEL,
  max_tokens: MAX_TOKENS,
  system: [
    {
      type: "text",
      text: systemPrompt,  // contains book context
      cache_control: { type: "ephemeral" }  // 5-minute TTL
    }
  ],
  messages: [{ role: "user", content: userMessage }]
});
```

For `streamClaude`, the same pattern applies — cache the system message.

**Expected impact:** The book context chunk (retrieved + formatted) is typically
300–600 tokens per call. Caching eliminates re-processing on repeated calls within
5 minutes. Reply generation (3 calls in sequence) benefits most — 2 of the 3 calls
hit the cache.

**Cost reduction:** ~40–60% on input token cost for high-frequency features.

---

### Phase 2 — Observability

**Goal:** Know which features are used, which book chunks are retrieved, and where
the system is failing users.

**What to add:**

1. **Server-side request log** (SvelteKit server route, not client):
   ```json
   {
     "session_id": "uuid",
     "feature": "reply_generation",
     "gender": "man",
     "input_tokens": 743,
     "output_tokens": 412,
     "model": "claude-sonnet-4-5",
     "latency_ms": 2100,
     "retrieved_chunks": ["chapter-3-opening-lines", "chapter-7-text-pacing"],
     "cache_hit": true
   }
   ```

2. **Book chunk coverage** — track which chunks are retrieved most often.
   Frequently-retrieved chunks are the most load-bearing; rarely-retrieved chunks
   may indicate book sections that don't map well to user queries.

3. **Feature usage distribution** — which of the four features is used most?
   This drives future development prioritisation.

4. **Error rate by feature** — which features fail most often? Vision-based features
   (profile analysis, conversation analysis) are more likely to fail on low-quality
   screenshots.

**Bedrock path:** Route all Claude calls through Bedrock. CloudWatch automatically
logs model, tokens, latency per invocation. Add custom metadata (feature, chunk IDs)
via the `additionalModelRequestFields` parameter.

---

### Phase 3 — Model Routing

**Goal:** Match model to task. Vision features need a vision-capable model;
text-only features can use a cheaper model.

**Current state:** All four features use `claude-sonnet-4-5` regardless of whether
they involve images.

**Routing logic:**

| Feature | Image input? | Complexity | Recommended Model |
|---|---|---|---|
| Profile analysis | Yes | High (structured multi-section) | Sonnet |
| Conversation analysis | Yes | High (pattern detection) | Sonnet |
| Reply generation | No | Medium (3 structured options) | Sonnet |
| Chat coaching | No | Low–Medium | Haiku (simple FAQ) → Sonnet (complex) |

**What to change:**

In `claude.ts`, export a model selector:
```typescript
export function selectModel(hasImage: boolean, complexity: "low" | "medium" | "high"): string {
  if (hasImage) return "claude-sonnet-4-6";
  if (complexity === "low") return "claude-haiku-4-5-20251001";
  return "claude-sonnet-4-6";
}
```

In `prompts.ts`, the `buildChatSystemPrompt` function can estimate complexity from
the user's question length and keyword signals (medical terms, multi-part questions).

**Chat coaching routing heuristic:**
```typescript
function chatComplexity(message: string): "low" | "medium" | "high" {
  if (message.length < 80 && !message.includes("?")) return "low";
  if (message.split("?").length > 2) return "high";
  return "medium";
}
```

**Expected cost impact:** ~60–70% of chat coaching messages are short questions
("what should my bio say?", "how do I open?"). Routing these to Haiku saves ~15×
on those calls.

**Bedrock path:** Bedrock Intelligent Prompt Routing — configure a routing profile
that maps complexity signals to Haiku vs Sonnet automatically.

---

### Phase 4 — Session Persistence

**Goal:** Users lose their chat history on refresh. This is a significant UX gap
for a coaching app — context from a previous conversation is valuable.

**Current state:** Chat history is in-memory (SvelteKit component state). Browser
refresh loses everything.

**What to add:**

1. **Server-side session store** — SvelteKit server routes + a lightweight store
   (SQLite via `better-sqlite3`, or Upstash Redis for serverless):
   ```typescript
   interface Session {
     id: string;
     gender: string;
     messages: Array<{ role: "user" | "assistant"; content: string }>;
     created_at: number;
     last_active: number;
   }
   ```

2. **Session ID in browser** — store session ID in `localStorage`. On load,
   fetch and restore the last session.

3. **Session TTL** — expire sessions after 7 days of inactivity. Dating advice
   context is time-sensitive; stale sessions may give outdated advice.

4. **Cross-feature context** — if a user analyzed a profile in one session and
   then asks a chat question, the previous profile analysis context can inform
   the coaching response.

---

### Phase 5 — Evaluation (citation accuracy)

**Goal:** Verify that citations in Claude's responses actually map to the retrieved
book chunks.

**Current state:** The prompt requires Claude to append `Based on: [chapter name]`
to every piece of advice. There is no check that the cited chapter was in the
retrieved chunks.

**What to build:**

1. **Citation verifier** — after each response, extract the citation string and
   check whether the cited chapter appears in the retrieved chunk IDs:
   ```typescript
   function verifyCitations(response: string, retrievedChunks: string[]): boolean {
     const citations = extractCitations(response);  // regex: /Based on: (.+)/g
     return citations.every(c => retrievedChunks.some(chunk => chunk.includes(c)));
   }
   ```

2. **Golden Q&A set** — create 15–20 fixed questions with known correct citations.
   Run weekly against the production RAG pipeline. Track "citation accuracy rate".

3. **Retrieval quality score** — for each golden question, score whether the correct
   chunk was in the top 3 retrieved results. If it isn't, the embedding or chunking
   strategy needs adjustment.

**Bedrock path:** Bedrock Model Evaluation with a custom evaluation metric for
citation accuracy.

---

### Phase 6 — Guardrails

**Goal:** Prevent harmful or irresponsible dating advice.

The dating coach is lower-stakes than the IVF chatbot, but some guardrails are
important: no advice that encourages manipulation, harassment, or unsafe meetups.

**What to add:**

1. **Topic blocks in system prompt** — already partially covered by the persona
   ("no cringe, no pickup-artist lines"). Make this explicit:
   - No manipulation tactics
   - No advice to pursue someone who has said no
   - No meetup safety advice that ignores basic safety practices

2. **Content filter** — scan responses for flagged patterns before returning to user.

3. **Bedrock Guardrails topic blocks** — configure denied topics:
   "manipulation tactics", "harassment", "ignoring rejection".

---

### Priority Order

| Phase | Effort | Value | Do When |
|---|---|---|---|
| 1 — Prompt caching | 1 hour | High | Now — immediate cost reduction |
| 2 — Observability | 4 hours | High | After caching — need baseline metrics |
| 3 — Model routing | 4 hours | High | After observability confirms cost |
| 4 — Session persistence | 1 day | High | Major UX gap — do before public launch |
| 5 — Evaluation | 1 day | Medium | After session persistence |
| 6 — Guardrails | 4 hours | Medium | Before any public promotion |

---

## Content Notes

- The primary knowledge source is a dating advice book written for Indian men.
- `genderInstruction()` in `prompts.ts` adapts the content for women users.
- When the book is updated or replaced, update the chunking in `embeddings.ts`
  and re-run the embedding pipeline to regenerate `vectorstore`.
- Citation format is standardised: `Based on: [chapter or section name]`. Do not
  change this format without updating the citation verifier (Phase 5).
