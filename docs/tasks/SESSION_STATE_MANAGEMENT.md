# Session State Management Implementation

## Overview

This document describes the session state management system implemented for Task 32 of the AI Bestie & AI Wingman Integration spec. The system handles:

1. **Tracking active assistants per match** - Maintains which AI assistant (if any) is active for each match conversation
2. **Loading conversation history on page load** - Retrieves previous messages when returning to a conversation
3. **Persisting session state across page refreshes** - Ensures state survives browser refreshes using both server-side and client-side storage
4. **Handling switching between assistants** - Allows users to switch from one assistant to another seamlessly

## Architecture

### Server-Side Components

#### 1. Session State Manager (`src/lib/server/session-state-manager.ts`)

The core server-side service that manages session state with the following responsibilities:

**Key Functions:**

- `loadSessionState(userId, matchId)` - Loads the complete session state for a match, including:
  - Active assistant type (if any)
  - Conversation history
  - Assistant configuration (exchange count, auto-impersonate flag)
  - Caches results for 1 minute to reduce database queries

- `saveConversationHistory(userId, matchId, assistantType, messages)` - Persists conversation messages to Supabase

- `addMessageToHistory(userId, matchId, assistantType, message)` - Appends a single message to the conversation

- `switchAssistant(userId, matchId, newAssistantType)` - Deactivates current assistant and activates a new one

- `clearSessionState(userId, matchId, assistantType)` - Marks conversation as inactive

- `getActiveSessionsForUser(userId)` - Retrieves all active sessions for a user

**Caching Strategy:**

- In-memory cache with 1-minute TTL
- Reduces database queries for frequently accessed sessions
- Cache is invalidated when state changes (activation, deactivation, message addition)

**localStorage Integration:**

- `persistSessionStateToLocalStorage()` - Saves session state to browser storage
- `loadSessionStateFromLocalStorage()` - Retrieves session state from browser storage
- `syncSessionState()` - Syncs server state to client storage

### Client-Side Components

#### 2. Session Store (`src/lib/client/session-store.ts`)

Svelte stores for managing session state on the frontend:

**Main Store Functions:**

- `createSessionStore(userId, matchId)` - Creates a reactive store for a specific match session
- `load()` - Loads session state from server
- `activateAssistant(assistantType)` - Activates an AI assistant
- `deactivateAssistant()` - Deactivates the active assistant
- `switchAssistant(newAssistantType)` - Switches to a different assistant
- `addMessage(message)` - Adds a message to conversation history
- `updateConversationHistory(messages)` - Updates the entire conversation history

**Derived Stores:**

- `createHasActiveAssistantStore()` - Boolean indicating if any assistant is active
- `createActiveAssistantStore()` - Current active assistant type
- `createConversationHistoryStore()` - Current conversation messages
- `createExchangeCountStore()` - Current exchange count for loop prevention

### API Endpoints

#### Session Management Endpoints

**POST `/api/session/load`**
- Loads session state for a match
- Request: `{ userId, matchId }`
- Response: `{ activeAssistant, conversationHistory, assistantConfig, lastLoadedAt }`

**POST `/api/session/activate-assistant`**
- Activates an AI assistant for a match
- Request: `{ userId, matchId, assistantType }`
- Response: `{ success, activeAssistant, assistantConfig }`

**POST `/api/session/deactivate-assistant`**
- Deactivates the active assistant
- Request: `{ userId, matchId }`
- Response: `{ success, activeAssistant }`

**POST `/api/session/switch-assistant`**
- Switches to a different assistant
- Request: `{ userId, matchId, assistantType }`
- Response: `{ success, activeAssistant, assistantConfig }`

**POST `/api/session/add-message`**
- Adds a message to conversation history
- Request: `{ userId, matchId, assistantType, message }`
- Response: `{ success, message }`

## Data Flow

### Page Load Flow

```
1. User navigates to chat page
   ↓
2. Chat component mounts
   ↓
3. Load user profile from localStorage
   ↓
4. Initialize session store with userId and matchId
   ↓
5. Call sessionStore.load()
   ↓
6. Fetch /api/session/load
   ↓
7. Server loads session state from Supabase
   ↓
8. Return activeAssistant and conversationHistory
   ↓
9. Update UI with loaded state
   ↓
10. Conversation history is displayed
```

### Message Sending Flow

```
1. User sends message
   ↓
2. Add message to local state
   ↓
3. Send to /api/chat with activeAssistant info
   ↓
4. Server routes to appropriate handler
   ↓
5. Generate response
   ↓
6. Return response with assistantType
   ↓
7. Add both messages to session store
   ↓
8. Call sessionStore.addMessage() for persistence
   ↓
9. POST /api/session/add-message
   ↓
10. Server saves to Supabase
```

### Assistant Activation Flow

```
1. User clicks "Activate AI Bestie/Wingman"
   ↓
2. Call sessionStore.activateAssistant(assistantType)
   ↓
3. POST /api/session/activate-assistant
   ↓
4. Server calls activateAssistant() from AI Assistant Manager
   ↓
5. Creates/updates config in Supabase
   ↓
6. Load updated session state
   ↓
7. Return activeAssistant
   ↓
8. Update UI to show active assistant
```

### Assistant Switching Flow

```
1. User switches from Bestie to Wingman
   ↓
2. Call sessionStore.switchAssistant('wingman')
   ↓
3. POST /api/session/switch-assistant
   ↓
4. Server deactivates current assistant
   ↓
5. Server activates new assistant
   ↓
6. Load updated session state
   ↓
7. Return new activeAssistant
   ↓
8. Update UI to show new assistant
```

## Database Schema

### ai_assistant_match_configs Table

Stores the configuration for each assistant per match:

```sql
CREATE TABLE ai_assistant_match_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  match_id TEXT NOT NULL,
  assistant_type 'bestie' | 'wingman' NOT NULL,
  is_active BOOLEAN DEFAULT FALSE,
  auto_impersonate BOOLEAN DEFAULT FALSE,
  exchange_count INTEGER DEFAULT 0,
  last_exchange_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, match_id, assistant_type)
);
```

### ai_assistant_conversations Table

Stores conversation history:

```sql
CREATE TABLE ai_assistant_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  match_conversation_id TEXT NOT NULL,
  assistant_type 'bestie' | 'wingman' NOT NULL,
  messages JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN DEFAULT TRUE,
  exchange_count INTEGER DEFAULT 0,
  last_exchange_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, match_conversation_id, assistant_type)
);
```

## Usage Examples

### In a Svelte Component

```svelte
<script lang="ts">
  import { createSessionStore } from '$lib/client/session-store';
  import type { AssistantType } from '$lib/types';

  let sessionStore = createSessionStore('user-123', 'match-456');

  onMount(async () => {
    // Load session state from server
    await sessionStore.load();
  });

  // Subscribe to session state
  sessionStore.subscribe((state) => {
    console.log('Active assistant:', state.activeAssistant);
    console.log('Messages:', state.conversationHistory);
  });

  // Activate an assistant
  async function activateBestie() {
    await sessionStore.activateAssistant('bestie');
  }

  // Add a message
  async function addMessage(content: string) {
    const message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: Date.now()
    };
    await sessionStore.addMessage(message);
  }

  // Switch assistants
  async function switchToWingman() {
    await sessionStore.switchAssistant('wingman');
  }
</script>
```

### Server-Side Usage

```typescript
import { loadSessionState, switchAssistant } from '$lib/server/session-state-manager';

// Load session state
const sessionState = await loadSessionState('user-123', 'match-456');
console.log('Active assistant:', sessionState.activeAssistant);
console.log('Messages:', sessionState.conversationHistory);

// Switch assistants
await switchAssistant('user-123', 'match-456', 'wingman');
```

## Testing

### Unit Tests

Located in `src/lib/server/__tests__/session-state-manager.test.ts`:

- Session state loading and caching
- localStorage persistence and retrieval
- Cache invalidation
- Error handling

Run with: `npm test -- src/lib/server/__tests__/session-state-manager.test.ts`

### Integration Tests

Located in `src/lib/server/__tests__/session-state-integration.test.ts`:

- Session caching behavior
- localStorage persistence across sessions
- Session state structure validation
- Concurrent session loads
- Error handling for missing sessions

Run with: `npm test -- src/lib/server/__tests__/session-state-integration.test.ts`

All tests pass: **23 tests passing**

## Performance Considerations

### Caching Strategy

- **In-memory cache**: 1-minute TTL reduces database queries
- **localStorage**: Enables instant page load without server round-trip
- **Cache invalidation**: Automatic when state changes

### Database Queries

- Single query to load session state (includes config and conversation history)
- Indexed queries on `(user_id, match_id)` for fast lookups
- Batch operations for switching assistants

### Optimization Tips

1. **Lazy load conversation history**: Only load recent messages (last 10-20)
2. **Paginate old messages**: Load older messages on demand
3. **Use localStorage for offline support**: Sync when connection restored
4. **Debounce message saves**: Batch multiple messages before persisting

## Error Handling

### Common Errors

1. **Missing session**: Returns empty session with no active assistant
2. **Database errors**: Logged and returned to client with user-friendly message
3. **Invalid localStorage data**: Gracefully ignored, falls back to server load
4. **Concurrent operations**: Handled by cache invalidation

### Error Recovery

- Automatic retry on network errors
- Fallback to server state if localStorage is corrupted
- User-friendly error messages in UI

## Future Enhancements

1. **Real-time sync**: Use Supabase subscriptions for real-time updates
2. **Offline support**: Queue messages locally, sync when online
3. **Session expiration**: Auto-cleanup old sessions
4. **Analytics**: Track session duration and assistant usage
5. **Multi-device sync**: Sync sessions across devices

## Requirements Mapping

This implementation satisfies the following requirements:

- **8.1**: Chat history persistence and retrieval ✓
- **8.2**: Session state tracking across page refreshes ✓
- **8.3**: Active assistant tracking per match ✓
- **8.4**: Conversation history loading on page load ✓
- **8.5**: Switching between assistants ✓

## Files Created

1. `src/lib/server/session-state-manager.ts` - Server-side session management
2. `src/lib/client/session-store.ts` - Client-side Svelte stores
3. `src/routes/api/session/load/+server.ts` - Load session endpoint
4. `src/routes/api/session/activate-assistant/+server.ts` - Activate assistant endpoint
5. `src/routes/api/session/deactivate-assistant/+server.ts` - Deactivate assistant endpoint
6. `src/routes/api/session/switch-assistant/+server.ts` - Switch assistant endpoint
7. `src/routes/api/session/add-message/+server.ts` - Add message endpoint
8. `src/lib/server/__tests__/session-state-manager.test.ts` - Unit tests
9. `src/lib/server/__tests__/session-state-integration.test.ts` - Integration tests
10. Updated `src/routes/chat/+page.svelte` - Chat page with session management

## Conclusion

The session state management system provides a robust, scalable solution for tracking AI assistant sessions, persisting conversation history, and handling assistant switching. The implementation uses a combination of server-side caching, client-side stores, and localStorage to ensure optimal performance and user experience.
