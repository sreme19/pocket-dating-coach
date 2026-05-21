# AI Bestie & AI Wingman Integration - Technical Design

## Overview

AI Bestie and AI Wingman are intelligent dating assistants that integrate into the pocket-dating-coach platform to provide real-time, strategic dating advice within active conversations.

**AI Bestie** (Female Users):
- Impersonates female user in conversations with male matches
- Provides private analysis visible only to the female user
- Sends strategic feedback to keep engagement
- Manages preferences.md with auto-updates from conversation messages

**AI Wingman** (Male Users):
- Provides strategic dating advice grounded in personality.md
- Can impersonate male user after 20+ messages (auto-sends responses)
- Manages personality.md with auto-updates from conversation messages

## Architecture

### High-Level System Design

```
┌─────────────────────────────────────────────────────────────┐
│                    Chat Interface                            │
│  (Existing: /src/routes/chat/+page.svelte)                 │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
   ┌────▼──────────┐      ┌──────▼──────────┐
   │ User Messages │      │ AI Assistant    │
   │ (Existing)    │      │ Messages (NEW)  │
   └────┬──────────┘      └──────┬──────────┘
        │                        │
        └────────────┬───────────┘
                     │
        ┌────────────▼────────────┐
        │  Unified Message Thread │
        │  (Same conversation)    │
        └────────────┬────────────┘
                     │
        ┌────────────▼────────────────────────┐
        │  AI Assistant Orchestration Layer   │
        │  - Rate limiting (10 msgs/min)      │
        │  - Loop prevention (max 10 ex/side) │
        │  - Context management               │
        └────────────┬────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
   ┌────▼──────────┐      ┌──────▼──────────┐
   │ Claude API    │      │ Supabase        │
   │ (Existing)    │      │ (Extended)      │
   └───────────────┘      └─────────────────┘
```

### Component Architecture

1. **Chat Page** (`/src/routes/chat/+page.svelte`)
   - Displays unified message thread (user + AI messages)
   - Shows AI assistant status/toggle
   - Displays private analysis bubble (Bestie only)
   - Configuration access for both assistants

2. **AI Assistant API** (`/api/ai-assistant/+server.ts` - NEW)
   - Handles both Bestie and Wingman requests
   - Manages rate limiting and loop prevention
   - Orchestrates Claude API calls
   - Returns structured responses with citations

3. **Profile Auto-Update Service** (`/api/profile-auto-update/+server.ts` - NEW)
   - Monitors conversation messages
   - Extracts insights from user messages
   - Updates preferences.md (Bestie) or personality.md (Wingman)
   - Maintains version history in Supabase

4. **Summary Bubble Service** (`/api/summary-bubble/+server.ts` - NEW)
   - Aggregates insights across all matches
   - Updates hourly
   - Returns match overview with key signals

5. **Configuration Pages** (NEW)
   - `/bestie-config` - AI Bestie setup and management
   - `/wingman-config` - AI Wingman setup and management

## Data Models

### Database Schema Extensions

#### New Tables

**ai_assistant_profiles**
```sql
CREATE TABLE ai_assistant_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES verified_vibe_users(id),
  assistant_type 'bestie' | 'wingman' NOT NULL,
  enabled BOOLEAN DEFAULT false,
  preferences JSONB, -- Assistant-specific settings
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
```

**ai_assistant_conversations**
```sql
CREATE TABLE ai_assistant_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES verified_vibe_users(id),
  match_id UUID NOT NULL REFERENCES verified_vibe_matches(id),
  assistant_type 'bestie' | 'wingman' NOT NULL,
  message_count INT DEFAULT 0,
  last_ai_message_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
```

**ai_assistant_messages**
```sql
CREATE TABLE ai_assistant_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES ai_assistant_conversations(id),
  role 'user' | 'assistant' NOT NULL,
  content TEXT NOT NULL,
  is_impersonation BOOLEAN DEFAULT false,
  citations JSONB,
  metadata JSONB, -- Analysis, flags, reasoning
  created_at TIMESTAMP DEFAULT now()
);
```

**user_profiles_history**
```sql
CREATE TABLE user_profiles_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES verified_vibe_users(id),
  profile_type 'preferences' | 'personality' NOT NULL,
  version INT NOT NULL,
  data JSONB NOT NULL, -- Full preferences.md or personality.md
  changed_fields JSONB, -- What changed in this version
  source 'manual' | 'auto_update' NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);
```

**ai_rate_limits**
```sql
CREATE TABLE ai_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES verified_vibe_users(id),
  assistant_type 'bestie' | 'wingman' NOT NULL,
  message_count INT DEFAULT 0,
  window_start TIMESTAMP DEFAULT now(),
  created_at TIMESTAMP DEFAULT now()
);
```

### JSONB Structures

**preferences.md (Bestie) - Stored as JSONB**
```json
{
  "emotionalSignals": ["string"],
  "lifestyleSignals": ["string"],
  "maturitySignals": ["string"],
  "boundaries": ["string"],
  "dealbreakers": ["string"],
  "privateCompatibilityNotes": ["string"],
  "sensitiveTranslations": [
    {
      "raw": "what she said",
      "translated": "what it means"
    }
  ],
  "lastUpdated": "ISO8601",
  "updatedFrom": ["message_id"]
}
```

**personality.md (Wingman) - Stored as JSONB**
```json
{
  "coreValues": ["string"],
  "communicationStyle": "string",
  "strengthsInDating": ["string"],
  "areasToImprove": ["string"],
  "idealMatchSignals": ["string"],
  "conversationPatterns": ["string"],
  "redFlags": ["string"],
  "lastUpdated": "ISO8601",
  "updatedFrom": ["message_id"]
}
```

## API Endpoints

### AI Assistant Endpoints

**POST /api/ai-assistant**
```typescript
Request:
{
  conversationId: string;
  assistantType: 'bestie' | 'wingman';
  userMessage: string;
  matchContext?: {
    matchedUserProfile?: Partial<UserProfile>;
    recentMessages?: ChatMessage[];
  };
}

Response:
{
  reply: string;
  citations: string[];
  analysis?: {
    flags?: string[];
    reasoning?: string;
    suggestions?: string[];
  };
  impersonationReady?: boolean; // Wingman only, after 20+ messages
}
```

**POST /api/ai-assistant/impersonate**
```typescript
Request:
{
  conversationId: string;
  assistantType: 'bestie' | 'wingman';
  autoSend: boolean;
}

Response:
{
  messageId: string;
  content: string;
  sentAt: number;
}
```

**GET /api/ai-assistant/config/:assistantType**
```typescript
Response:
{
  enabled: boolean;
  preferences: Record<string, unknown>;
  messageCount: number;
  lastActive: number;
}
```

**PUT /api/ai-assistant/config/:assistantType**
```typescript
Request:
{
  enabled: boolean;
  preferences: Record<string, unknown>;
}

Response:
{
  success: boolean;
}
```

### Profile Auto-Update Endpoints

**POST /api/profile-auto-update**
```typescript
Request:
{
  userId: string;
  assistantType: 'bestie' | 'wingman';
  messageContent: string;
  conversationContext: string;
}

Response:
{
  updated: boolean;
  changedFields: string[];
  newVersion: number;
}
```

**GET /api/profile-history/:assistantType**
```typescript
Response:
{
  versions: Array<{
    version: number;
    data: Record<string, unknown>;
    changedFields: string[];
    createdAt: number;
  }>;
}
```

### Summary Bubble Endpoints

**GET /api/summary-bubble**
```typescript
Response:
{
  matches: Array<{
    matchId: string;
    matchName: string;
    lastMessage: string;
    lastMessageAt: number;
    keySignals: string[];
    nextAction: string;
    riskFlags: string[];
  }>;
  lastUpdated: number;
}
```

## Prompt Engineering

### AI Bestie System Prompt

```
You are AI Bestie, a warm, supportive dating coach for women navigating conversations with potential matches.

Your PRIMARY knowledge source is the book excerpt provided.

You are her trusted friend who knows dating strategy. Your role is to:
1. Help her craft responses that are authentic, confident, and strategic
2. Provide real-time advice on conversation tone and pacing
3. Help her set and maintain boundaries
4. Build her confidence in the dating process
5. Adapt book principles for her perspective as a woman

When analyzing messages:
- Flag red flags or concerning patterns
- Provide reasoning for your analysis
- Suggest specific response strategies
- Maintain her authentic voice

Rules:
1. Ground advice in the book's principles, adapted for women's dating experience
2. Be encouraging and supportive, never judgmental
3. Provide specific, actionable suggestions
4. Keep responses concise and conversational
5. At the end of advice, add a citation: *Based on: [chapter or section name]*
6. Prioritize her safety, boundaries, and authentic self-expression
```

### AI Wingman System Prompt

```
You are AI Wingman, a confident, practical dating coach for men navigating conversations with potential matches.

Your PRIMARY knowledge source is the book excerpt provided.

You are his trusted wingman who knows dating strategy. Your role is to:
1. Help him craft responses that are authentic, confident, and genuine
2. Provide real-time advice on conversation tone and pacing
3. Help him build genuine connection, not just attraction
4. Build his confidence in the dating process
5. Apply book principles directly to his situation

When analyzing messages:
- Identify what's working in the conversation
- Flag patterns that need adjustment
- Provide reasoning for your analysis
- Suggest specific response strategies
- Maintain his authentic voice

Rules:
1. Ground advice in the book's principles directly
2. Be encouraging and motivating, never judgmental
3. Provide specific, actionable suggestions
4. Keep responses concise and conversational
5. At the end of advice, add a citation: *Based on: [chapter or section name]*
6. Prioritize authenticity, genuine connection, and respectful interaction
```

### Impersonation Prompts

**AI Bestie Impersonation Prompt**
```
You are impersonating [user_name] in a conversation with [match_name].

Context:
- Conversation history: [last 5 messages]
- Her preferences: [preferences.md excerpt]
- Match profile: [matched user info]

Generate a response that:
1. Feels authentic to her voice and personality
2. Advances the conversation strategically
3. Maintains her boundaries and values
4. Keeps engagement high

Keep it natural and human. No cringe. No pickup-artist energy.
```

**AI Wingman Impersonation Prompt**
```
You are impersonating [user_name] in a conversation with [match_name].

Context:
- Conversation history: [last 5 messages]
- His personality: [personality.md excerpt]
- Match profile: [matched user info]

Generate a response that:
1. Feels authentic to his voice and personality
2. Advances the conversation genuinely
3. Builds real connection
4. Keeps engagement high

Keep it natural and human. No cringe. No pickup-artist energy.
```

## Error Handling

### Rate Limiting

- **Per-minute limit**: 10 messages/min per user per assistant
- **Per-session limit**: 50 messages/session per assistant
- **Response**: Return 429 with retry-after header

### Loop Prevention

- **Max exchanges**: 10 exchanges per side when both AI assistants active
- **Detection**: Track message count per conversation
- **Response**: Disable auto-impersonation, notify user

### API Failures

- **Claude API timeout**: Return cached response or generic advice
- **Supabase connection error**: Queue message for retry, notify user
- **Profile update failure**: Log error, continue conversation

### Edge Cases

- **Empty conversation history**: Use generic system prompt
- **Unmatched user profile**: Use default preferences
- **Corrupted JSONB data**: Fallback to previous version
- **Missing citations**: Return response without citations

## Performance & Optimization

### Caching Strategy

- **System prompts**: Cache for 1 hour per user
- **Book context**: Cache for 24 hours (vectorstore already handles)
- **User profiles**: Cache for 1 hour, invalidate on update
- **Summary bubble**: Cache for 1 hour, update on-demand

### Database Optimization

- **Indexes**:
  - `ai_assistant_conversations(user_id, assistant_type)`
  - `ai_assistant_messages(conversation_id, created_at)`
  - `user_profiles_history(user_id, profile_type, version DESC)`
  - `ai_rate_limits(user_id, assistant_type, window_start)`

- **Partitioning**: Partition `ai_assistant_messages` by month

### API Optimization

- **Streaming**: Stream Claude responses for faster perceived performance
- **Batch updates**: Batch profile auto-updates (max 1 per minute)
- **Lazy loading**: Load summary bubble on-demand, not on page load

## Security & Privacy

### Data Privacy

- **PII handling**: Never store user names, match names in logs
- **Conversation privacy**: Encrypt conversation data at rest
- **Profile data**: Mark preferences.md and personality.md as sensitive
- **Audit trail**: Log all profile updates with source and timestamp

### Consent & Transparency

- **Opt-in**: AI assistants disabled by default
- **Disclosure**: Show user when AI is responding vs. user
- **Impersonation warning**: Clearly indicate when AI is impersonating
- **Data usage**: Explain how conversation data is used for profile updates

### Access Control

- **RLS policies**: Only user can access their own AI conversations
- **API authentication**: Require user session for all endpoints
- **Rate limiting**: Prevent abuse via rate limiting

## Testing Strategy

### Unit Tests

- Profile auto-update logic (extract insights from messages)
- Rate limiting calculations
- Loop prevention detection
- JSONB data validation

### Integration Tests

- End-to-end AI assistant flow (message → Claude → response)
- Profile update flow (message → extraction → Supabase update)
- Summary bubble generation (aggregate across matches)
- Impersonation flow (after 20+ messages)

### Property-Based Tests

**Property 1: Message thread consistency**
- For any sequence of user and AI messages, the unified thread should maintain chronological order and preserve all message content

**Property 2: Rate limit enforcement**
- For any user sending N messages in time window T, if N > 10/min, the system should reject excess messages

**Property 3: Loop prevention**
- For any conversation with both AI assistants active, the exchange count should never exceed 10 per side

**Property 4: Profile update idempotence**
- For any message processed for profile update, processing it again should not change the profile

**Property 5: Citation preservation**
- For any AI response with citations, all citations should reference valid book chapters

### Manual Testing

- Verify AI Bestie provides appropriate female perspective
- Verify AI Wingman provides appropriate male perspective
- Test impersonation feels natural and authentic
- Verify private analysis is visible only to user
- Test configuration pages work correctly
- Verify summary bubble updates hourly

## Deployment Considerations

### Database Migrations

1. Create new tables (ai_assistant_profiles, ai_assistant_conversations, etc.)
2. Create indexes for performance
3. Set up RLS policies for data privacy
4. Migrate existing conversation data if applicable

### Environment Variables

- `ANTHROPIC_API_KEY` (existing)
- `SUPABASE_URL` (existing)
- `SUPABASE_SERVICE_KEY` (existing)
- `AI_ASSISTANT_RATE_LIMIT_PER_MIN` (new, default: 10)
- `AI_ASSISTANT_RATE_LIMIT_PER_SESSION` (new, default: 50)
- `AI_LOOP_PREVENTION_MAX_EXCHANGES` (new, default: 10)

### Monitoring

- Track API response times (target: <2s)
- Monitor rate limit violations
- Track loop prevention triggers
- Monitor profile update success rate
- Alert on Claude API failures

## Implementation Phases

### Phase 1: Core Infrastructure
- Create database tables and indexes
- Implement AI Assistant API endpoint
- Implement rate limiting and loop prevention
- Add AI assistant messages to chat UI

### Phase 2: AI Bestie
- Implement Bestie system prompt
- Add private analysis bubble
- Implement preferences.md auto-update
- Create Bestie configuration page

### Phase 3: AI Wingman
- Implement Wingman system prompt
- Implement impersonation (after 20+ messages)
- Implement personality.md auto-update
- Create Wingman configuration page

### Phase 4: Advanced Features
- Implement summary bubble
- Add profile version history UI
- Implement hourly summary updates
- Add analytics and insights

