# AI Loop Prevention Check Endpoint

## Overview

The `POST /api/ai-loop-prevention/check` endpoint validates whether a conversation can continue with AI assistants and provides information about exchange counts and warnings.

This endpoint is part of the AI Loop Prevention system that prevents infinite loops when both male and female users are using AI assistants simultaneously.

## Requirements

- **Requirement 11.1**: Enforce max 10 exchanges per side when both assistants active
- **Requirement 11.2**: Return current exchange counts and any warnings
- **Requirement 11.3**: Check if conversation can continue

## Endpoint Details

### URL
```
POST /api/ai-loop-prevention/check
```

### Authentication
- **Required**: Yes (user must be authenticated)
- **Method**: Session-based authentication via `locals.auth.getSession()`

### Request Body

```typescript
{
  userId?: string;           // Optional - extracted from session
  matchId: string;           // Required - unique match conversation ID
  assistantType?: 'bestie' | 'wingman';  // Optional - specific assistant to check
}
```

### Response

```typescript
{
  canContinue: boolean;      // Whether conversation can continue
  exchangeCount: {
    bestieExchanges: number;
    wingmanExchanges: number;
    lastBestieExchange: number | null;
    lastWingmanExchange: number | null;
  };
  warnings: string[];        // Array of warning messages
  remainingExchanges: {
    bestie: number;
    wingman: number;
  };
  maxExchangesPerSide: number;  // Currently 10
}
```

### Status Codes

- **200**: Success (always returned, even on error with safe defaults)
- **400**: Bad request (invalid parameters)
- **401**: Unauthorized (user not authenticated)

## Usage Examples

### Check if conversation can continue (no specific assistant)

```bash
curl -X POST http://localhost:5173/api/ai-loop-prevention/check \
  -H "Content-Type: application/json" \
  -d '{
    "matchId": "match-123"
  }'
```

Response:
```json
{
  "canContinue": true,
  "exchangeCount": {
    "bestieExchanges": 5,
    "wingmanExchanges": 3,
    "lastBestieExchange": 1704067200000,
    "lastWingmanExchange": 1704067100000
  },
  "warnings": [],
  "remainingExchanges": {
    "bestie": 5,
    "wingman": 7
  },
  "maxExchangesPerSide": 10
}
```

### Check if specific assistant can continue

```bash
curl -X POST http://localhost:5173/api/ai-loop-prevention/check \
  -H "Content-Type: application/json" \
  -d '{
    "matchId": "match-123",
    "assistantType": "bestie"
  }'
```

### Response when limit reached

```json
{
  "canContinue": false,
  "exchangeCount": {
    "bestieExchanges": 10,
    "wingmanExchanges": 5,
    "lastBestieExchange": 1704067200000,
    "lastWingmanExchange": 1704067100000
  },
  "warnings": [
    "AI Bestie has reached the maximum of 10 exchanges. User confirmation required to continue."
  ],
  "remainingExchanges": {
    "bestie": 0,
    "wingman": 5
  },
  "maxExchangesPerSide": 10
}
```

### Response when approaching limit

```json
{
  "canContinue": true,
  "exchangeCount": {
    "bestieExchanges": 8,
    "wingmanExchanges": 7,
    "lastBestieExchange": 1704067200000,
    "lastWingmanExchange": 1704067100000
  },
  "warnings": [
    "AI Bestie is approaching the exchange limit (2 remaining).",
    "AI Wingman is approaching the exchange limit (3 remaining)."
  ],
  "remainingExchanges": {
    "bestie": 2,
    "wingman": 3
  },
  "maxExchangesPerSide": 10
}
```

## Logic

### Continuation Check

1. **If specific assistant type provided**: Check if that assistant can continue
2. **If no assistant type provided**: Check both assistants; allow continuation if at least one can continue
3. **Limit enforcement**: Max 10 exchanges per side when both assistants are active

### Warning Generation

1. **Limit reached**: Generate warning if assistant has reached max exchanges
2. **Approaching limit**: Generate warning if assistant has 2 or fewer exchanges remaining
3. **Multiple warnings**: Generate separate warnings for each assistant approaching/at limit

### Error Handling

- On any error, return safe defaults:
  - `canContinue: true` (allow user to proceed)
  - `exchangeCount: { bestieExchanges: 0, wingmanExchanges: 0, ... }`
  - `warnings: ["Unable to verify exchange limits. Proceeding with caution."]`
  - HTTP 200 status (never block user due to error)

## Integration

### With AI Assistant Service

Call this endpoint before allowing an AI assistant to send a message:

```typescript
const checkResponse = await fetch('/api/ai-loop-prevention/check', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    matchId: 'match-123',
    assistantType: 'bestie'
  })
});

const { canContinue, warnings } = await checkResponse.json();

if (!canContinue) {
  // Show warning to user and require confirmation
  showWarning(warnings[0]);
  // Wait for user confirmation before proceeding
}
```

### With Message Router

The message router should check loop prevention before routing messages to AI assistants:

```typescript
if (isAIAssistantMessage) {
  const loopCheck = await checkLoopPrevention(matchId, assistantType);
  if (!loopCheck.canContinue) {
    return showUserWarning(loopCheck.warnings);
  }
}
```

## Testing

The endpoint includes comprehensive unit tests covering:

- **Authentication**: Validates user authentication
- **Request Validation**: Validates required parameters
- **Exchange Count Retrieval**: Returns accurate exchange counts
- **Conversation Continuation**: Correctly determines if conversation can continue
- **Warning Generation**: Generates appropriate warnings
- **Remaining Exchanges**: Calculates remaining exchanges correctly
- **Response Structure**: Returns properly structured response
- **Error Handling**: Returns safe defaults on error

Run tests:
```bash
npm run test -- src/routes/api/ai-loop-prevention/check
```

## Performance Considerations

- **Database Queries**: Queries `ai_assistant_match_configs` table with indexed lookups
- **Caching**: Consider caching exchange counts in memory for frequently checked conversations
- **Rate Limiting**: No rate limiting on this endpoint (it's a read-only check)

## Future Enhancements

1. **Configurable Limits**: Allow different limits per user tier
2. **Time-based Reset**: Reset exchange counters after a certain time period
3. **Gradual Limits**: Increase limits as conversation progresses
4. **Analytics**: Track exchange patterns for insights
5. **User Notifications**: Notify users when approaching limits
