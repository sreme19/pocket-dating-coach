# AI Bestie Message Endpoint

## Overview

The AI Bestie message endpoint (`POST /api/ai-bestie/message`) handles sending messages to AI Bestie and receiving strategic dating advice. This endpoint is part of the AI Bestie & AI Wingman integration feature.

## Endpoint Details

### URL
```
POST /api/ai-bestie/message
```

### Authentication
Requires authenticated user session with valid `user_id`.

### Request Body

```typescript
{
  conversationId: string;           // Unique identifier for this conversation
  userMessage: string;              // The user's message/question
  recentMessages?: ChatMessage[];   // Previous messages in conversation (optional)
  matchedUserProfile?: {            // Profile of the matched user (optional)
    gender?: string;
    ageRange?: string;
    datingApp?: string;
    relationshipGoal?: string;
  }
}
```

### Response

```typescript
{
  reply: string;                    // AI Bestie's advice/response
  citations: string[];              // References to book chapters/sections
  suggestions?: string[];           // Optional actionable suggestions
}
```

## Features

### 1. Message Validation
- Validates authentication and user session
- Validates required fields (conversationId, userMessage)
- Validates message format and content
- Validates matchedUserProfile fields if provided

### 2. Profile Loading
- Loads user's preferences.md from database
- Validates preferences are not empty
- Handles missing profile data gracefully

### 3. Context Building
- Searches for relevant book chunks using embeddings
- Formats recent messages for context
- Includes matched user profile information
- Builds comprehensive system prompt for Claude

### 4. Claude API Integration
- Calls Claude API with tailored system prompt
- Handles API errors gracefully
- Validates response format
- Extracts citations from response

### 5. Citation Extraction
- Extracts citations in format: `*Based on: [text]*`
- Removes citations from main response text
- Cleans up extra whitespace

### 6. Suggestion Extraction
- Extracts suggestions from response (lines starting with `-` or `•`)
- Returns as optional array in response
- Handles responses without suggestions

### 7. Database Storage
- Saves user message to database
- Saves AI response with assistantType: 'bestie'
- Appends to existing conversation history
- Handles database errors gracefully

### 8. Profile Auto-Update
- Extracts insights from conversation
- Auto-updates preferences.md with new signals
- Tracks reason for update
- Runs asynchronously (fire and forget)

### 9. Error Handling
- Returns 401 for authentication errors
- Returns 400 for validation errors
- Returns 503 for Claude API errors
- Returns 500 for internal errors
- Logs all errors for debugging

## Example Usage

### Request
```bash
curl -X POST http://localhost:5173/api/ai-bestie/message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "conversationId": "conv-123",
    "userMessage": "He just asked me out for coffee. Should I say yes?",
    "recentMessages": [
      { "role": "user", "content": "Hi there" },
      { "role": "assistant", "content": "Hey! How are you?" }
    ],
    "matchedUserProfile": {
      "gender": "man",
      "ageRange": "25-30",
      "datingApp": "hinge",
      "relationshipGoal": "serious"
    }
  }'
```

### Response
```json
{
  "reply": "Coffee is a great low-pressure first date! It shows he's genuinely interested in getting to know you. Say yes with enthusiasm and suggest a specific time.",
  "citations": [
    "Based on: Chapter 3 - First Dates",
    "Based on: Chapter 1 - Reading Interest Signals"
  ],
  "suggestions": [
    "Say yes with enthusiasm",
    "Suggest a specific time",
    "Ask about his favorite coffee spot"
  ]
}
```

## Requirements Covered

- **Requirement 3.1**: User sends message to AI Bestie
- **Requirement 3.2**: System passes context to Claude (preferences, match profile, recent messages)
- **Requirement 3.3**: Uses buildAIBestieSystemPrompt function
- **Requirement 3.4**: Response includes advice, reasoning, and citations
- **Requirement 3.5**: Chat interface displays response
- **Requirement 3.6**: System saves messages to Supabase
- **Requirement 5.1**: Analyzes match for compatibility signals
- **Requirement 5.2**: Identifies green/yellow/red flags
- **Requirement 6.1**: Generates response options
- **Requirement 6.2**: Displays options as selectable cards

## Testing

### Unit Tests (21 tests)
- Authentication validation
- Request validation
- Profile loading
- Claude API integration
- Citation extraction
- Database operations
- Response format

### Integration Tests (27 tests)
- Message flow
- Suggestion extraction
- Citation extraction
- Request validation
- Response format
- Error handling
- Data persistence
- Context building

Run tests:
```bash
npm test src/routes/api/ai-bestie/message/
```

## Error Handling

### Authentication Errors (401)
```json
{
  "status": 401,
  "message": "User authentication required"
}
```

### Validation Errors (400)
```json
{
  "status": 400,
  "message": "Missing required fields: conversationId"
}
```

### Claude API Errors (503)
```json
{
  "status": 503,
  "message": "Sorry, I couldn't generate a response. Please try again."
}
```

### Internal Errors (500)
```json
{
  "status": 500,
  "message": "Failed to get AI Bestie response"
}
```

## Database Schema

Messages are stored in `ai_assistant_conversations` table:

```sql
{
  id: UUID,
  user_id: UUID,
  match_conversation_id: TEXT,
  assistant_type: 'bestie',
  messages: JSONB[],
  is_active: BOOLEAN,
  updated_at: TIMESTAMP
}
```

Each message in the array:
```typescript
{
  role: 'user' | 'assistant',
  content: string,
  assistantType?: 'bestie'
}
```

## Performance Considerations

- Profile data is cached in memory for 5 minutes
- Book chunks are searched using embeddings (5 results)
- Messages are appended to existing conversation (no full rewrite)
- Auto-update runs asynchronously (doesn't block response)
- Database errors don't prevent response from being returned

## Security

- Validates user authentication before processing
- Validates all input parameters
- Sanitizes user messages before sending to Claude
- Stores messages in user-specific database records
- RLS policies ensure users can only access their own data
- No PII beyond necessary context is sent to Claude

## Future Enhancements

- Rate limiting (max 10 messages per minute)
- Turn limits (max 100 messages per session)
- Conversation history retrieval
- Conversation deletion
- Preference version history
- Hourly summary generation
- Compatibility flag analysis
- Response option generation
