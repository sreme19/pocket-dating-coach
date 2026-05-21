# AI Bestie Summary Endpoint

## Overview

The AI Bestie Summary endpoint (`POST /api/ai-bestie/summary`) retrieves hourly summaries of all active AI Bestie conversations with key insights, compatibility signals, and recommended next moves.

## Endpoint Details

### URL
```
POST /api/ai-bestie/summary
```

### Authentication
- **Required**: Yes
- **Method**: Session-based (via `locals.auth.getSession()`)
- **Error**: Returns 401 if user is not authenticated

### Request Body

```typescript
{
  "userId"?: string  // Optional: override authenticated user ID
}
```

**Parameters**:
- `userId` (optional): If provided, retrieves summaries for this user instead of the authenticated user. Useful for admin/support scenarios.

### Response

```typescript
{
  "summaries": MatchSummary[],
  "lastUpdated": number,        // Timestamp of when summaries were generated
  "totalMatches": number        // Total number of matches with summaries
}
```

**MatchSummary Structure**:
```typescript
{
  "matchId": string,                                    // Unique match identifier
  "matchName": string,                                  // Display name for the match
  "matchProfile": Partial<UserProfile>,                 // Optional: matched user's profile
  "keyInsights": string[],                              // 2-3 key insights about the conversation
  "greenFlags": string[],                               // Positive compatibility signals
  "yellowFlags": string[],                              // Neutral/unclear signals requiring clarification
  "redFlags": string[],                                 // Negative signals conflicting with preferences
  "recommendedNextMove": string,                        // Suggested action for next interaction
  "conversationMomentum": "heating_up" | "steady" | "cooling_down",  // Conversation trajectory
  "lastMessageTime": number,                            // Timestamp of last message
  "messageCount": number                                // Total messages in conversation
}
```

## Examples

### Request

```bash
curl -X POST https://example.com/api/ai-bestie/summary \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <session-token>" \
  -d '{}'
```

### Response (Success)

```json
{
  "summaries": [
    {
      "matchId": "match-abc123",
      "matchName": "Match match-abc",
      "keyInsights": [
        "Very engaged and asks thoughtful questions",
        "Shares your values around career and travel",
        "Seems genuinely interested in getting to know you"
      ],
      "greenFlags": [
        "Asks about your interests and remembers details",
        "Shows vulnerability and emotional depth",
        "Communicates clearly about feelings"
      ],
      "yellowFlags": [
        "Mentions expensive travel plans early - could indicate lifestyle mismatch"
      ],
      "redFlags": [],
      "recommendedNextMove": "Suggest meeting for coffee this week to continue the connection",
      "conversationMomentum": "heating_up",
      "lastMessageTime": 1704067200000,
      "messageCount": 15
    },
    {
      "matchId": "match-def456",
      "matchName": "Match match-def",
      "keyInsights": [
        "Conversation has been steady but not progressing",
        "Seems interested but not taking initiative"
      ],
      "greenFlags": [
        "Respectful and polite in all interactions"
      ],
      "yellowFlags": [
        "Limited emotional depth in responses",
        "Hasn't asked personal questions"
      ],
      "redFlags": [],
      "recommendedNextMove": "Ask a more personal question to deepen the connection",
      "conversationMomentum": "steady",
      "lastMessageTime": 1704066000000,
      "messageCount": 8
    }
  ],
  "lastUpdated": 1704067200000,
  "totalMatches": 2
}
```

### Response (No Conversations)

```json
{
  "summaries": [],
  "lastUpdated": 1704067200000,
  "totalMatches": 0
}
```

## Error Responses

### 401 Unauthorized
```json
{
  "error": "User authentication required"
}
```

### 400 Bad Request
```json
{
  "error": "Could not load your preferences. Please ensure your profile is set up."
}
```

### 500 Internal Server Error
```json
{
  "error": "Failed to generate summaries"
}
```

## Requirements Mapping

This endpoint implements the following requirements:

- **Requirement 3.1**: AI Bestie real-time advice and message crafting
- **Requirement 3.2**: System passes context to Claude including preferences and match context
- **Requirement 5.1**: AI Bestie compatibility assessment and flag system
- **Requirement 5.2**: Response includes green/yellow/red flags with reasoning
- **Requirement 7.1**: Hourly summary generation for all matches
- **Requirement 7.2**: Summary includes key insights, flags, and recommended next moves
- **Requirement 7.3**: Conversation momentum indicator

## Implementation Details

### Summary Generation Process

1. **Authentication**: Validates user session
2. **Profile Loading**: Loads user's preferences.md to ensure profile is set up
3. **Conversation Retrieval**: Fetches all active AI Bestie conversations from Supabase
4. **Book Context**: Searches vector store for relevant book chapters
5. **Summary Generation**: For each conversation:
   - Formats recent messages (last 10)
   - Calls Claude API with system prompt and analysis request
   - Parses JSON response to extract insights and flags
   - Handles errors gracefully with default values
6. **Sorting**: Sorts summaries by last message time (most recent first)
7. **Response**: Returns formatted summaries with metadata

### Error Handling

The endpoint implements comprehensive error handling:

- **Authentication Errors**: Returns 401 if user not authenticated
- **Validation Errors**: Returns 400 for invalid input or missing profile
- **Database Errors**: Returns 500 if Supabase operations fail
- **API Errors**: Gracefully skips conversations if Claude API fails
- **Parsing Errors**: Uses default values if JSON parsing fails
- **Graceful Degradation**: Continues processing other conversations if one fails

### Performance Considerations

- **Caching**: Preferences are loaded once per request
- **Batch Processing**: All conversations processed in a single request
- **Parallel Claude Calls**: Each conversation's summary is generated independently
- **Timeout Handling**: Individual conversation failures don't block the entire response
- **Database Indexing**: Uses indexed queries on `user_id` and `assistant_type`

### Security

- **Authentication Required**: All requests must be authenticated
- **User Isolation**: Users can only access their own summaries
- **Input Validation**: All request parameters are validated
- **Error Messages**: Generic error messages prevent information leakage
- **Rate Limiting**: Subject to application-level rate limiting

## Testing

The endpoint includes comprehensive unit tests covering:

- **Authentication**: Validates authentication requirements
- **Request Validation**: Tests invalid input handling
- **Profile Validation**: Ensures preferences are set up
- **Conversation Retrieval**: Tests database operations
- **Summary Generation**: Tests Claude API integration
- **Error Handling**: Tests graceful error handling
- **Edge Cases**: Tests null/undefined values and multiple conversations
- **Response Format**: Validates response structure

Run tests with:
```bash
npm test src/routes/api/ai-bestie/summary/+server.test.ts
```

## Usage Examples

### Get Summaries for Current User

```typescript
const response = await fetch('/api/ai-bestie/summary', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({})
});

const data = await response.json();
console.log(`Found ${data.totalMatches} matches`);
data.summaries.forEach(summary => {
  console.log(`${summary.matchName}: ${summary.recommendedNextMove}`);
});
```

### Get Summaries for Specific User (Admin)

```typescript
const response = await fetch('/api/ai-bestie/summary', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userId: 'admin-user-id' })
});

const data = await response.json();
```

### Display Summaries in UI

```svelte
<script>
  import { onMount } from 'svelte';
  
  let summaries = [];
  let loading = true;
  let error = null;
  
  onMount(async () => {
    try {
      const response = await fetch('/api/ai-bestie/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      
      if (!response.ok) throw new Error('Failed to load summaries');
      
      const data = await response.json();
      summaries = data.summaries;
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  });
</script>

{#if loading}
  <p>Loading summaries...</p>
{:else if error}
  <p class="error">{error}</p>
{:else if summaries.length === 0}
  <p>No active conversations yet</p>
{:else}
  <div class="summaries">
    {#each summaries as summary}
      <div class="summary-card">
        <h3>{summary.matchName}</h3>
        <p class="momentum" class:heating_up={summary.conversationMomentum === 'heating_up'}>
          {summary.conversationMomentum}
        </p>
        <div class="insights">
          {#each summary.keyInsights as insight}
            <p>• {insight}</p>
          {/each}
        </div>
        <div class="flags">
          {#each summary.greenFlags as flag}
            <span class="flag green">✓ {flag}</span>
          {/each}
          {#each summary.yellowFlags as flag}
            <span class="flag yellow">⚠ {flag}</span>
          {/each}
          {#each summary.redFlags as flag}
            <span class="flag red">✗ {flag}</span>
          {/each}
        </div>
        <p class="next-move">Next: {summary.recommendedNextMove}</p>
      </div>
    {/each}
  </div>
{/if}
```

## Related Endpoints

- `POST /api/ai-bestie/activate` - Activate AI Bestie for a match
- `POST /api/ai-bestie/message` - Send a message to AI Bestie
- `POST /api/ai-bestie/analyze` - Analyze a match for compatibility flags
- `POST /api/ai-bestie/deactivate` - Deactivate AI Bestie for a match

## Future Enhancements

- **Caching**: Cache summaries for 1 hour to reduce API calls
- **Filtering**: Add filters for conversation momentum or flag types
- **Pagination**: Support pagination for users with many matches
- **Scheduling**: Automatic hourly summary generation and storage
- **Notifications**: Alert users when new red flags are detected
- **Comparison**: Compare summaries across time periods
- **Export**: Export summaries as PDF or CSV
