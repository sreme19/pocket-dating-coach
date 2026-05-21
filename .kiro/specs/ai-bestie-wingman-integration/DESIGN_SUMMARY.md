# AI Bestie & AI Wingman Integration - Design Summary

## Key Design Decisions

### 1. Unified Message Thread Architecture

**Decision**: Both user and AI messages live in the same `verified_vibe_messages` table with metadata to distinguish them.

**Rationale**:
- Simplifies UI rendering (single message stream)
- Maintains conversation continuity
- Allows easy review of AI-sent messages
- Leverages existing message infrastructure

**Implementation**:
- Add `ai_assistant_messages` table to track AI-specific metadata
- Mark AI messages with `assistantType` and `is_impersonation` flag
- Store private analysis separately for user review

---

### 2. Profile Storage as JSONB with Version History

**Decision**: Store preferences.md and personality.md as JSONB in Supabase with immutable version history.

**Rationale**:
- Flexible schema for evolving profile structure
- Version history enables audit trail and rollback
- JSONB indexing supports efficient queries
- Separates auto-updates from manual edits

**Implementation**:
- `ai_assistant_profiles` table stores current profile + version history
- Each version immutable; new versions appended to history array
- Track update source (user vs. AI) and timestamp
- Support rollback to any previous version

---

### 3. AI Loop Prevention with Exchange Counter

**Decision**: Limit AI exchanges to 10 per side when both assistants active; reset after 24 hours.

**Rationale**:
- Prevents infinite loops between Bestie and Wingman
- Gives users control over AI usage
- 24-hour reset allows natural conversation flow
- Manual reset available in configuration

**Implementation**:
- `ai_assistant_configs` table tracks exchange count per match
- Atomic increment on each AI message
- Check before generating response; return error if limit reached
- Background job resets counters after 24 hours of inactivity

---

### 4. Private Analysis for User Review

**Decision**: Generate private analysis (flags, reasoning, suggestions) visible only to the user.

**Rationale**:
- Provides strategic insights without exposing AI to match
- Helps user understand AI's reasoning
- Enables user to override AI suggestions
- Maintains authenticity of conversation

**Implementation**:
- `ai_assistant_messages` table stores private analysis as JSONB
- Private analysis never sent to matched user
- Accessible via separate UI component
- Audit log all access to private analysis

---

### 5. Auto-Update Profile from User Messages

**Decision**: AI automatically extracts insights from user messages and updates preferences.md/personality.md.

**Rationale**:
- Keeps profile current without manual effort
- Learns from user's actual dating behavior
- Improves AI context over time
- Reduces friction for users

**Implementation**:
- After each user message, call Claude to extract insights
- Merge auto-updates with existing profile (never remove data)
- Track update source as 'ai' in version history
- User can review and revert auto-updates

---

### 6. Hourly Summary Bubble Updates

**Decision**: Generate match summaries hourly with key insights, compatibility score, and next steps.

**Rationale**:
- Provides quick overview of match status
- Aggregates insights across all matches
- Helps user prioritize conversations
- Updates automatically without user action

**Implementation**:
- `match_summaries` table stores latest summary
- Scheduled job runs hourly to regenerate summaries
- Claude extracts key insights from conversation history
- Summary includes compatibility score, red/green flags, next steps

---

### 7. Wingman Auto-Impersonation After 20+ Messages

**Decision**: Wingman can auto-send responses after 20+ messages in conversation.

**Rationale**:
- Requires sufficient context before impersonating
- Reduces risk of inappropriate responses early on
- User can enable/disable per match
- Threshold prevents premature automation

**Implementation**:
- Track message count in `ai_assistant_configs`
- Check threshold before allowing impersonation
- User can enable auto-impersonate toggle in configuration
- Show progress bar toward threshold

---

### 8. Reuse Existing Claude & Supabase Clients

**Decision**: Use same Claude API client and Supabase client as existing features.

**Rationale**:
- Reduces code duplication
- Maintains consistent error handling
- Simplifies dependency management
- Leverages existing infrastructure

**Implementation**:
- Import `getClaudeClient()` from `$lib/claude`
- Import `getSupabase()` from `$lib/server/supabase`
- Use existing vector search for book context
- Reuse existing system prompt builders

---

### 9. Bestie Takes Priority in Loop Prevention

**Decision**: If both assistants try to respond simultaneously, Bestie takes priority.

**Rationale**:
- Prevents race conditions
- Bestie (female) perspective often more nuanced
- Reduces complexity of simultaneous response handling
- User can manually trigger Wingman if needed

**Implementation**:
- Check Bestie exchange count first
- If Bestie can respond, generate Bestie response
- If Bestie at limit, check Wingman
- Return error if both at limit

---

### 10. Configuration Page for Setup & Management

**Decision**: Dedicated configuration page for each assistant with toggles, profile editor, and history.

**Rationale**:
- Centralizes AI assistant management
- Provides visibility into profile updates
- Enables manual profile editing
- Allows version history review and rollback

**Implementation**:
- New route: `/ai-assistant/config/[matchId]`
- Tabs for Bestie and Wingman
- Profile editor with syntax highlighting
- Version history timeline with rollback
- Exchange counter display and reset button

---

## Data Flow Diagram

```
User sends message
    ↓
Message Router checks if AI activation
    ↓
If AI activation:
    ├─ Load AI Assistant Config
    ├─ Check Loop Prevention (exchange count < 10)
    ├─ Load Profile (preferences.md or personality.md)
    ├─ Get Book Context (vector search)
    ├─ Call Claude API with system prompt
    ├─ Extract citations from response
    ├─ Store message with is_impersonation flag
    ├─ Auto-update profile from user message
    ├─ Generate private analysis
    ├─ Increment exchange counter
    └─ Return response + private analysis to user
    
If user message:
    ├─ Store message normally
    ├─ Auto-update profile (if AI active)
    └─ Return message to UI
```

---

## Integration Points with Existing Code

### 1. Chat API Endpoint (`/api/chat`)

**Current**: Handles user messages and returns coach advice.

**Integration**: 
- Extend to detect AI activation
- Route to AI Assistant Service if AI active
- Otherwise, use existing coach logic

### 2. Message Storage (`verified_vibe_messages`)

**Current**: Stores all messages in match conversation.

**Integration**:
- Add `ai_assistant_messages` table for AI metadata
- Link via `message_id` foreign key
- Query both tables to reconstruct full conversation

### 3. User Profile (`verified_vibe_users`)

**Current**: Stores user archetype, name, age, city, etc.

**Integration**:
- Load user profile for context
- Use in system prompts
- Reference in private analysis

### 4. Vector Store (`book_chunks`)

**Current**: Stores book embeddings for semantic search.

**Integration**:
- Reuse existing `match_book_chunks()` function
- Get book context for system prompt
- Include citations in response

### 5. Claude API Client (`$lib/claude`)

**Current**: Provides `getClaudeClient()` and helper functions.

**Integration**:
- Use `getClaudeClient()` for all Claude calls
- Reuse `askClaude()` and `streamClaude()` functions
- Maintain consistent error handling

---

## Security & Privacy Considerations

### 1. Row-Level Security (RLS)

- `ai_assistant_profiles`: Users can only access their own profiles
- `ai_assistant_configs`: Users can only access configs for their matches
- `ai_assistant_messages`: Users can only access messages in their matches
- `match_summaries`: Users can only access summaries for their matches

### 2. Private Analysis Protection

- Private analysis never exposed to matched user
- Audit log all access to private analysis
- Encrypt private analysis at rest (optional)

### 3. AI Impersonation Transparency

- Mark all AI-sent messages with `is_impersonation: true`
- User can review all AI-sent messages in separate view
- Matched user never knows AI was involved

### 4. Rate Limiting

- 10 AI messages per match per hour
- 5 profile updates per day per user
- 1 summary generation per match per hour

---

## Testing Strategy

### Unit Tests

- Profile Service: load/save/merge operations
- AI Loop Prevention: exchange counter logic
- Summary Bubble: insight extraction and scoring
- System Prompts: citation extraction

### Property-Based Tests

- Profile merge idempotence
- Version history integrity
- Exchange counter monotonicity
- Loop prevention correctness
- Profile auto-update consistency

### Integration Tests

- Full flow: activate AI → send message → generate response → auto-update profile
- Loop prevention with both assistants active
- Summary bubble generation with multiple matches
- Profile version history and rollback

---

## Performance Targets

| Metric | Target | Optimization |
|--------|--------|--------------|
| AI Response Latency | < 3 seconds | Cache embeddings, limit history |
| Profile Load | < 100ms | Index on user_id + assistant_type |
| Exchange Counter Check | < 50ms | Atomic increment operation |
| Summary Generation | < 2 seconds | Batch queries, cache results |
| Claude API Cost | < $0.10 per response | Compress context, limit tokens |

---

## Rollout Plan

### Phase 1: Core Infrastructure (Week 1-2)
- Create database tables
- Implement Profile Service
- Implement AI Loop Prevention Service
- Create API endpoints

### Phase 2: AI Assistant Service (Week 2-3)
- Implement response generation
- Create system prompts
- Implement private analysis
- Add citations extraction

### Phase 3: Integration & UI (Week 3-4)
- Integrate with chat thread
- Create configuration page
- Add AI message indicators
- Implement summary bubble

### Phase 4: Advanced Features (Week 4-5)
- Auto-impersonation for Wingman
- Hourly summary updates
- Profile version history UI
- Private analysis review UI

### Phase 5: Testing & Refinement (Week 5-6)
- Unit tests
- Property-based tests
- Integration tests
- Performance optimization

---

## Success Metrics

1. **Engagement**: Users activate AI for 30%+ of matches
2. **Retention**: Users with AI active have 20% higher message count
3. **Satisfaction**: 4.5+ star rating for AI assistant features
4. **Performance**: 95th percentile response latency < 3 seconds
5. **Cost**: Average cost per response < $0.10
6. **Safety**: Zero instances of AI impersonation detected by matched users

