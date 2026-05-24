# Architecture Diagram — Preferences Feature

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         POCKET DATING COACH                             │
│                    AI Bestie Preferences Feature                        │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                          FRONTEND (Svelte)                               │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  src/routes/verified-vibe/chat/[conversationId]/+page.svelte           │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │ generateAndSendAIBestieResponse()                              │    │
│  │                                                                │    │
│  │ 1. Detect new message from male user                          │    │
│  │ 2. Call POST /api/verified-vibe/ai-bestie/generate-response   │    │
│  │    Payload: {                                                 │    │
│  │      conversationId,                                          │    │
│  │      adrianMessage,                                           │    │
│  │      matchName,                                               │    │
│  │      userId: $user?.id  ← FEMALE USER ID                     │    │
│  │    }                                                           │    │
│  │ 3. Receive { signal, read, suggestedQuestion }                │    │
│  │ 4. Display coaching card (signal + read)                      │    │
│  │ 5. Auto-send suggested question to male user                  │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
                                    ↓
                            HTTP POST Request
                                    ↓
┌──────────────────────────────────────────────────────────────────────────┐
│                          BACKEND (Node.js)                               │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  src/routes/api/verified-vibe/ai-bestie/generate-response/+server.ts   │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │ POST Handler                                                   │    │
│  │                                                                │    │
│  │ 1. Extract: conversationId, adrianMessage, matchName, userId  │    │
│  │ 2. Fetch from Supabase:                                        │    │
│  │    SELECT preferences, about, looking                          │    │
│  │    FROM verified_vibe_users                                    │    │
│  │    WHERE id = userId                                           │    │
│  │                                                                │    │
│  │ 3. Build context string:                                       │    │
│  │    "About her: [about text]                                    │    │
│  │     Looking for: [looking text]                                │    │
│  │     Her preferences: {                                         │    │
│  │       lookingFor: [...],                                       │    │
│  │       nonNegotiables: [...],                                   │    │
│  │       ...                                                      │    │
│  │     }"                                                         │    │
│  │                                                                │    │
│  │ 4. Call Claude API with context injected into prompt           │    │
│  │ 5. Parse response: { signal, read, suggestedQuestion }         │    │
│  │ 6. Return JSON to frontend                                     │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
                                    ↓
                        Supabase Query (Service Role)
                                    ↓
┌──────────────────────────────────────────────────────────────────────────┐
│                       DATABASE (PostgreSQL)                              │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  verified_vibe_users                                                    │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │ id (UUID)                                                      │    │
│  │ gender (enum)                                                  │    │
│  │ first_name (text)                                              │    │
│  │ age (int)                                                      │    │
│  │ city (text)                                                    │    │
│  │ about (text)                                                   │    │
│  │ looking (text)                                                 │    │
│  │ preferences (JSONB) ← NEW COLUMN                               │    │
│  │ trust_score (int)                                              │    │
│  │ created_at (timestamp)                                         │    │
│  │ updated_at (timestamp)                                         │    │
│  │                                                                │    │
│  │ Indexes:                                                       │    │
│  │ - PRIMARY KEY (id)                                             │    │
│  │ - GIN (preferences) ← NEW INDEX                                │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  Example preferences JSONB:                                             │
│  {                                                                      │
│    "lookingFor": ["serious relationship"],                              │
│    "nonNegotiables": ["understands NRI experience"],                    │
│    "strongPreferences": ["based in UK/Europe", "career-stable"],        │
│    "openTo": ["Indian men if relocation negotiable"],                   │
│    "notLookingFor": ["ABCD types"],                                     │
│    "communicationStyle": ["warm", "direct"],                            │
│    "greenFlags": ["navigated family expectations"],                     │
│    "yellowFlags": ["'I'm very open-minded'"],                           │
│    "redFlags": ["expects her to be traditional"],                       │
│    "interviewNotes": "Ask about 5-year plans"                           │
│  }                                                                      │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
                                    ↓
                        Claude API (Anthropic)
                                    ↓
┌──────────────────────────────────────────────────────────────────────────┐
│                          AI ANALYSIS (Claude)                            │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Prompt Template:                                                       │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │ "You are AI Bestie — a sharp, no-nonsense dating coach        │    │
│  │  helping a woman interview and evaluate a male match.         │    │
│  │                                                                │    │
│  │  About her: [INJECTED: about text]                            │    │
│  │  Looking for: [INJECTED: looking text]                        │    │
│  │  Her preferences: [INJECTED: JSON stringified]                │    │
│  │                                                                │    │
│  │  Adrian just said: '[INJECTED: message]'                      │    │
│  │                                                                │    │
│  │  Evaluate his response and produce exactly three fields:      │    │
│  │  { signal, read, suggestedQuestion }"                         │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  Response:                                                              │
│  {                                                                      │
│    "signal": "✅" | "⚠️" | "🚩",                                        │
│    "read": "Analysis grounded in her preferences...",                   │
│    "suggestedQuestion": "Follow-up question..."                         │
│  }                                                                      │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Sequence

```
Timeline:
─────────────────────────────────────────────────────────────────────────

T0: Female user (Neha) activates AI Bestie
    └─ Sets activeAssistant = 'bestie'

T1: Male user (Adrian) sends message
    └─ Message stored in verified_vibe_messages

T2: Poller detects new message (every 2 seconds)
    └─ Calls generateAndSendAIBestieResponse()

T3: Frontend calls POST /api/verified-vibe/ai-bestie/generate-response
    Payload: {
      conversationId: "conv-123",
      adrianMessage: "I'm looking for someone...",
      matchName: "Adrian",
      userId: "neha-uuid"  ← KEY: Female user ID
    }

T4: Backend receives request
    └─ Validates all fields present

T5: Backend queries Supabase
    SELECT preferences, about, looking
    FROM verified_vibe_users
    WHERE id = 'neha-uuid'
    └─ Uses service role key (bypasses RLS)

T6: Supabase returns user data
    {
      preferences: { lookingFor: [...], ... },
      about: "I'm a software engineer...",
      looking: "Someone ambitious and culturally aware..."
    }

T7: Backend builds context string
    "About her: I'm a software engineer...
     Looking for: Someone ambitious...
     Her preferences: { lookingFor: [...], ... }"

T8: Backend calls Claude API
    Injects context into prompt
    └─ Claude analyzes Adrian's message through Neha's lens

T9: Claude returns analysis
    {
      signal: "✅",
      read: "He seems genuinely interested and shares your values...",
      suggestedQuestion: "What does ambition mean to you?"
    }

T10: Backend returns JSON to frontend

T11: Frontend displays coaching card
     - Shows signal emoji
     - Shows read text
     - Stores suggestedQuestion

T12: Frontend auto-sends suggested question to Adrian
     POST /api/verified-vibe/chat/send
     └─ Adrian receives: "What does ambition mean to you?"

T13: Neha sees coaching card + Adrian sees question
     └─ Feature complete ✅
```

---

## Component Interactions

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         COMPONENT DIAGRAM                               │
└─────────────────────────────────────────────────────────────────────────┘

Frontend Layer:
  Chat Page (+page.svelte)
    ├─ Detects new message
    ├─ Calls generateAndSendAIBestieResponse()
    ├─ Sends userId to API
    ├─ Receives { signal, read, suggestedQuestion }
    ├─ Displays coaching card
    └─ Auto-sends suggested question

API Layer:
  generate-response/+server.ts
    ├─ Validates request
    ├─ Queries Supabase (service role)
    ├─ Builds context string
    ├─ Calls Claude API
    ├─ Parses response
    └─ Returns JSON

Database Layer:
  verified_vibe_users
    ├─ Stores preferences (JSONB)
    ├─ Stores about (text)
    ├─ Stores looking (text)
    └─ GIN index on preferences

External Services:
  Claude API (Anthropic)
    ├─ Receives prompt with context
    ├─ Analyzes message
    └─ Returns structured response

Supabase:
  ├─ Stores user data
  ├─ Provides service role key
  └─ Handles authentication
```

---

## Security Model

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SECURITY LAYERS                                 │
└─────────────────────────────────────────────────────────────────────────┘

Layer 1: Frontend
  ├─ User must be authenticated
  ├─ User must be in active match
  └─ User must have activated AI Bestie

Layer 2: API Endpoint
  ├─ Validates all required fields
  ├─ Validates userId format
  └─ Returns 400 if missing fields

Layer 3: Database Access
  ├─ Uses Supabase service role key (server-side only)
  ├─ Bypasses RLS (intentional — service role)
  ├─ Fetches only: preferences, about, looking
  └─ No sensitive data exposed

Layer 4: Claude API
  ├─ Receives only necessary context
  ├─ No user IDs or emails sent
  ├─ No authentication tokens sent
  └─ Response is structured JSON only

Layer 5: Response Handling
  ├─ Coaching card shown only to female user
  ├─ Suggested question sent to male user (not coaching card)
  ├─ No preferences data sent to male user
  └─ No analysis details sent to male user

Result:
  ✅ Female user's preferences are private
  ✅ Male user never sees preferences
  ✅ Coaching card is personalized but private
  ✅ Suggested question is generic (no preference leakage)
```

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    DEPLOYMENT ARCHITECTURE                              │
└─────────────────────────────────────────────────────────────────────────┘

Development:
  Local Machine
    ├─ .env.local (dev credentials)
    ├─ npm run dev (local server)
    └─ npm run seed:preferences (populate test data)

Staging:
  Vercel Preview
    ├─ Automatic on PR
    ├─ Uses staging Supabase
    └─ Full feature testing

Production:
  Vercel Production
    ├─ Automatic on push to main
    ├─ Uses production Supabase
    ├─ Preferences column live
    ├─ GIN index active
    └─ API endpoint live

Database:
  Supabase (PostgreSQL)
    ├─ verified_vibe_users table
    ├─ preferences JSONB column
    ├─ GIN index for performance
    └─ RLS policies (unchanged)

Migration:
  1. Apply SQL (add column + index)
  2. Verify (check column exists)
  3. Seed (populate preferences)
  4. Test (end-to-end)
  5. Deploy (push to main)
```

---

## Performance Considerations

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PERFORMANCE OPTIMIZATION                             │
└─────────────────────────────────────────────────────────────────────────┘

Query Performance:
  ├─ GIN index on preferences column
  ├─ Enables fast JSONB lookups
  ├─ Supports future filtering by preferences
  └─ Minimal overhead for inserts/updates

API Response Time:
  ├─ Supabase query: ~50-100ms
  ├─ Claude API call: ~1-2 seconds
  ├─ Total: ~1-2 seconds
  └─ Acceptable for async operation

Database Size:
  ├─ JSONB is efficient (binary format)
  ├─ ~1KB per user (typical preferences)
  ├─ 1000 users = ~1MB
  └─ Negligible impact

Caching Opportunities (Future):
  ├─ Cache preferences in memory
  ├─ Cache Claude responses
  ├─ Invalidate on preference updates
  └─ Reduce API calls
```

---

## Error Handling

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      ERROR HANDLING FLOW                                │
└─────────────────────────────────────────────────────────────────────────┘

Scenario 1: Missing userId
  ├─ API returns 400 "Missing required fields"
  └─ Frontend shows error toast

Scenario 2: User not found
  ├─ API logs error
  ├─ Continues with empty preferences
  └─ Claude still provides analysis (just less personalized)

Scenario 3: Preferences column missing
  ├─ API catches error
  ├─ Logs error
  ├─ Continues with empty preferences
  └─ Feature degrades gracefully

Scenario 4: Claude API fails
  ├─ API catches error
  ├─ Returns 500 "Failed to generate response"
  └─ Frontend shows error toast

Scenario 5: Invalid JSON from Claude
  ├─ API catches parse error
  ├─ Returns 500 "Claude returned invalid JSON"
  └─ Frontend shows error toast

Result:
  ✅ No silent failures
  ✅ Graceful degradation
  ✅ Clear error messages
  ✅ Logging for debugging
```

---

## Future Enhancements

```
Potential improvements (not in current scope):

1. Preference Updates
   ├─ POST /api/verified-vibe/preferences/update
   ├─ Allow users to update preferences
   └─ Persist changes to database

2. Preference Merging
   ├─ POST /api/verified-vibe/preferences/merge
   ├─ Extract preferences from chat messages
   ├─ Merge with existing preferences
   └─ Auto-update during conversation

3. Preference-Based Matching
   ├─ Use preferences for initial matching
   ├─ Filter candidates by preferences
   └─ Improve match quality

4. Analytics
   ├─ Track which preferences are most common
   ├─ Analyze preference-to-match success
   └─ Optimize matching algorithm

5. Admin Dashboard
   ├─ View/edit user preferences
   ├─ Bulk import preferences
   └─ Export preference analytics
```

---

This architecture is:
- ✅ Secure (preferences never exposed to male user)
- ✅ Performant (GIN index, async operations)
- ✅ Scalable (JSONB allows flexible schema)
- ✅ Maintainable (clear separation of concerns)
- ✅ Testable (each layer can be tested independently)
