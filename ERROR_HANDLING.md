# Error Handling and Validation Implementation

## Overview

This document describes the comprehensive error handling and validation system implemented for all AI Bestie & AI Wingman API endpoints. The system provides consistent error responses, detailed logging, and graceful fallback behavior across all endpoints.

**Requirements Addressed**: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6

## Architecture

### Error Handler Module

**Location**: `src/lib/server/error-handler.ts`

The error handler module provides:

1. **Error Types**: Enumeration of error categories (validation, authentication, database, etc.)
2. **Validation Functions**: Utilities for validating request parameters
3. **Error Throwing Functions**: Consistent error throwing with logging
4. **Error Handling Utilities**: Helpers for handling specific error scenarios

### Error Types

```typescript
enum ErrorType {
  VALIDATION_ERROR = 'VALIDATION_ERROR',           // 400
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',   // 401
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',     // 403
  NOT_FOUND_ERROR = 'NOT_FOUND_ERROR',             // 404
  DATABASE_ERROR = 'DATABASE_ERROR',               // 500
  EXTERNAL_API_ERROR = 'EXTERNAL_API_ERROR',       // 502
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',           // 429
  INTERNAL_ERROR = 'INTERNAL_ERROR'                // 500
}
```

## Validation Functions

### 1. Required Fields Validation

```typescript
validateRequiredFields(body, ['field1', 'field2'])
```

Validates that all required fields are present and non-empty.

**Returns**: `{ valid: boolean, missingFields: string[] }`

**Example**:
```typescript
const { valid, missingFields } = validateRequiredFields(body, [
  'conversationId',
  'assistantType',
  'messages'
]);

if (!valid) {
  throwValidationError(`Missing required fields: ${missingFields.join(', ')}`);
}
```

### 2. Field Type Validation

```typescript
validateFieldTypes(body, { field1: 'string', field2: 'number' })
```

Validates that fields have the correct types.

**Returns**: `{ valid: boolean, invalidFields: Array<{ field, expected, actual }> }`

### 3. Enum Value Validation

```typescript
validateEnumValue(value, ['option1', 'option2'])
```

Validates that a value is one of the allowed enum values.

**Returns**: `{ valid: boolean, error?: string }`

### 4. UUID Validation

```typescript
validateUUID(value)
```

Validates UUID format (RFC 4122).

**Returns**: `{ valid: boolean, error?: string }`

### 5. String Length Validation

```typescript
validateStringLength(value, minLength, maxLength)
```

Validates string length constraints.

**Returns**: `{ valid: boolean, error?: string }`

### 6. Array Length Validation

```typescript
validateArrayLength(value, minLength, maxLength)
```

Validates array length constraints.

**Returns**: `{ valid: boolean, error?: string }`

### 7. Claude API Response Validation

```typescript
validateClaudeResponse(response)
```

Validates that Claude API response has the expected structure.

**Returns**: `{ valid: boolean, error?: string }`

### 8. Supabase Error Handling

```typescript
handleSupabaseError(error, context, defaultMessage)
```

Converts Supabase errors to user-friendly messages.

**Handles**:
- PGRST116: No rows found → "Resource not found"
- 23505: Unique constraint violation → "This resource already exists"
- 23503: Foreign key violation → "Invalid reference to related resource"
- 42P01: Table not found → "Database configuration error"

**Returns**: `{ userMessage: string, shouldThrow: boolean }`

## Error Throwing Functions

All error throwing functions automatically log the error and throw a SvelteKit error with the appropriate HTTP status code.

### Authentication Error

```typescript
throwAuthenticationError(message?: string)
// Throws 401 error
```

### Validation Error

```typescript
throwValidationError(message: string, details?: Record<string, unknown>)
// Throws 400 error
```

### Authorization Error

```typescript
throwAuthorizationError(message?: string)
// Throws 403 error
```

### Not Found Error

```typescript
throwNotFoundError(resource: string)
// Throws 404 error
```

### Database Error

```typescript
throwDatabaseError(context: string, error: unknown, userMessage?: string)
// Throws 500 error
```

### External API Error

```typescript
throwExternalAPIError(context: string, error: unknown, userMessage?: string)
// Throws 502 error
```

### Rate Limit Error

```typescript
throwRateLimitError(message?: string)
// Throws 429 error
```

### Internal Error

```typescript
throwInternalError(context: string, error: unknown, userMessage?: string)
// Throws 500 error
```

## Logging

### Error Logging

```typescript
logError(context: string, error: unknown, errorType: ErrorType, details?: Record<string, unknown>)
```

Logs errors with:
- Timestamp
- Context (where the error occurred)
- Error type
- Error message and stack trace
- Additional details

**Example**:
```typescript
logError('AI Assistant Chat', err, ErrorType.EXTERNAL_API_ERROR, {
  context: 'Claude API call failed',
  assistantType: 'bestie'
});
```

## Endpoint Implementation Examples

### Example 1: AI Assistant Chat Endpoint

```typescript
export const POST: RequestHandler = async ({ request, locals }) => {
  // 1. Validate authentication
  const session = await locals.auth.getSession();
  if (!session?.user) {
    throwAuthenticationError('User authentication required');
  }

  // 2. Parse and validate request body
  let body: AIAssistantRequest;
  try {
    body = await request.json();
  } catch (err) {
    logError('AI Assistant Chat', err, ErrorType.VALIDATION_ERROR);
    throwValidationError('Invalid JSON in request body');
  }

  // 3. Validate required fields
  const { valid, missingFields } = validateRequiredFields(body, [
    'conversationId',
    'assistantType',
    'messages'
  ]);

  if (!valid) {
    throwValidationError(`Missing required fields: ${missingFields.join(', ')}`);
  }

  // 4. Validate field values
  const assistantTypeValidation = validateEnumValue(assistantType, ['bestie', 'wingman']);
  if (!assistantTypeValidation.valid) {
    throwValidationError(`Invalid assistantType: ${assistantTypeValidation.error}`);
  }

  // 5. Validate array structure
  const messagesValidation = validateArrayLength(messages, 1);
  if (!messagesValidation.valid) {
    throwValidationError(messagesValidation.error);
  }

  try {
    // 6. Process request with error handling
    const response = await client.messages.create({...});
    
    // 7. Validate response
    const responseValidation = validateClaudeResponse(response);
    if (!responseValidation.valid) {
      throwExternalAPIError('AI Assistant Chat', new Error(responseValidation.error));
    }

    return json(result);
  } catch (err) {
    // 8. Handle unexpected errors
    if (err instanceof Error && err.message.includes('SvelteKit')) {
      throw err;
    }
    logError('AI Assistant Chat', err, ErrorType.INTERNAL_ERROR);
    throwInternalError('AI Assistant Chat', err, 'Failed to get AI assistant response');
  }
};
```

### Example 2: Conversation Management Endpoint

```typescript
export const POST: RequestHandler = async ({ request, locals }) => {
  // Validate authentication
  const session = await locals.auth.getSession();
  if (!session?.user) {
    throwAuthenticationError('User authentication required');
  }

  // Parse and validate request body
  let body: { matchConversationId: string; assistantType: AssistantType };
  try {
    body = await request.json();
  } catch (err) {
    logError('Create Conversation', err, ErrorType.VALIDATION_ERROR);
    throwValidationError('Invalid JSON in request body');
  }

  // Validate required fields
  const { valid, missingFields } = validateRequiredFields(body, [
    'matchConversationId',
    'assistantType'
  ]);

  if (!valid) {
    throwValidationError(`Missing required fields: ${missingFields.join(', ')}`);
  }

  try {
    // Check if conversation already exists (idempotent)
    const { data: existing, error: checkError } = await getSupabase()
      .from('ai_assistant_conversations')
      .select('id')
      .eq('user_id', session.user.id)
      .eq('match_conversation_id', matchConversationId)
      .eq('assistant_type', assistantType)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      const { userMessage, shouldThrow } = handleSupabaseError(checkError, 'Create Conversation');
      if (shouldThrow) {
        throwDatabaseError('Create Conversation', checkError, userMessage);
      }
    }

    if (existing) {
      return json(existing); // Return existing conversation
    }

    // Create new conversation
    const { data, error: insertError } = await getSupabase()
      .from('ai_assistant_conversations')
      .insert({...})
      .select()
      .single();

    if (insertError) {
      const { userMessage, shouldThrow } = handleSupabaseError(insertError, 'Create Conversation');
      if (shouldThrow) {
        throwDatabaseError('Create Conversation', insertError, userMessage);
      }
    }

    return json(data);
  } catch (err) {
    if (err instanceof Error && err.message.includes('SvelteKit')) {
      throw err;
    }
    logError('Create Conversation', err, ErrorType.INTERNAL_ERROR);
    throwInternalError('Create Conversation', err, 'Failed to create conversation');
  }
};
```

## Graceful Fallback Behavior

### Missing Profile Data

When a user's preferences.md or personality.md cannot be loaded:

```typescript
try {
  const personality = await loadPersonality(userId);
  return json({ success: true, data: personality });
} catch (err) {
  logError('GET /api/personality', err, ErrorType.DATABASE_ERROR, { userId });

  // Return default personality on error (graceful fallback)
  const defaultPersonality: PersonalityProfile = {
    communicationStyle: '',
    personalityVibe: '',
    mattersMost: '',
    values: [],
    datingPatterns: [],
    redFlagsToAvoid: [],
    updatedAt: Date.now()
  };

  return json({
    success: true,
    data: defaultPersonality,
    warning: 'Could not load your profile data. Using default values.'
  });
}
```

### Missing Book Context

When book context cannot be loaded from the vector store:

```typescript
let bookContext = '';
try {
  const queryEmbedding = await getEmbedding(lastUserMessage);
  const chunks = await searchBookChunks(queryEmbedding, 5);
  bookContext = chunks.map(c => `[${c.chapter}]\n${c.content}`).join('\n\n---\n\n');
} catch (err) {
  logError('AI Assistant Chat', err, ErrorType.EXTERNAL_API_ERROR, {
    context: 'Failed to search book chunks'
  });
  // Continue without book context - graceful fallback
  bookContext = 'No book context available.';
}
```

### Loop Prevention Check Fallback

When exchange limits cannot be verified:

```typescript
try {
  canContinueResult = await canContinue(userId, matchId, assistantType);
} catch (err) {
  logError('Loop Prevention Check', err, ErrorType.INTERNAL_ERROR, {
    context: 'Failed to check assistant continuation'
  });
  // Graceful fallback - allow continuation but warn user
  warnings.push('Unable to verify exchange limits. Proceeding with caution.');
}
```

## HTTP Status Codes

| Error Type | Status Code | Meaning |
|---|---|---|
| VALIDATION_ERROR | 400 | Bad Request - Invalid input parameters |
| AUTHENTICATION_ERROR | 401 | Unauthorized - User not authenticated |
| AUTHORIZATION_ERROR | 403 | Forbidden - User lacks permission |
| NOT_FOUND_ERROR | 404 | Not Found - Resource doesn't exist |
| RATE_LIMIT_ERROR | 429 | Too Many Requests - Rate limit exceeded |
| DATABASE_ERROR | 500 | Internal Server Error - Database operation failed |
| EXTERNAL_API_ERROR | 502 | Bad Gateway - External service error |
| INTERNAL_ERROR | 500 | Internal Server Error - Unexpected error |

## User-Friendly Error Messages

All errors are returned with user-friendly messages that don't expose internal details:

- **Validation Error**: "Invalid request parameters. Please check your input."
- **Authentication Error**: "Authentication required. Please log in."
- **Authorization Error**: "You do not have permission to access this resource."
- **Not Found Error**: "The requested resource was not found."
- **Database Error**: "Database error occurred. Please try again later."
- **External API Error**: "External service error. Please try again later."
- **Rate Limit Error**: "Too many requests. Please wait before trying again."
- **Internal Error**: "An unexpected error occurred. Please try again later."

## Testing

### Unit Tests

Comprehensive unit tests are provided in `src/lib/server/error-handler.test.ts`:

```bash
npm run test -- src/lib/server/error-handler.test.ts
```

**Test Coverage**:
- ✅ Required fields validation
- ✅ Field type validation
- ✅ Enum value validation
- ✅ UUID validation
- ✅ String length validation
- ✅ Array length validation
- ✅ Claude API response validation
- ✅ Supabase error handling
- ✅ Error logging

### Integration Testing

To test error handling in endpoints:

1. **Invalid JSON**: Send malformed JSON to any endpoint
2. **Missing Fields**: Omit required fields from request body
3. **Invalid Types**: Send wrong data types for fields
4. **Invalid Enums**: Send invalid enum values
5. **Database Errors**: Simulate database failures
6. **API Errors**: Simulate Claude API failures

## Best Practices

### 1. Always Validate Input

```typescript
// ✅ Good
const { valid, missingFields } = validateRequiredFields(body, ['field1', 'field2']);
if (!valid) {
  throwValidationError(`Missing: ${missingFields.join(', ')}`);
}

// ❌ Bad
if (!body.field1 || !body.field2) {
  throw error(400, 'Missing fields');
}
```

### 2. Use Specific Error Types

```typescript
// ✅ Good
throwDatabaseError('Create Conversation', dbError, 'Failed to create conversation');

// ❌ Bad
throw error(500, 'Error');
```

### 3. Log with Context

```typescript
// ✅ Good
logError('AI Assistant Chat', err, ErrorType.EXTERNAL_API_ERROR, {
  context: 'Claude API call failed',
  assistantType: 'bestie'
});

// ❌ Bad
console.error('Error:', err);
```

### 4. Provide Graceful Fallbacks

```typescript
// ✅ Good
try {
  const data = await loadData();
  return json({ success: true, data });
} catch (err) {
  logError('Load Data', err, ErrorType.DATABASE_ERROR);
  return json({
    success: true,
    data: defaultData,
    warning: 'Using default data'
  });
}

// ❌ Bad
try {
  const data = await loadData();
  return json({ success: true, data });
} catch (err) {
  throw error(500, 'Failed to load data');
}
```

### 5. Handle Supabase Errors Specifically

```typescript
// ✅ Good
if (dbError) {
  const { userMessage, shouldThrow } = handleSupabaseError(dbError, 'Context');
  if (shouldThrow) {
    throwDatabaseError('Context', dbError, userMessage);
  }
}

// ❌ Bad
if (dbError) {
  throw error(500, 'Database error');
}
```

## Endpoints with Error Handling

The following endpoints have been updated with comprehensive error handling:

1. **POST /api/ai-assistant/chat** - Generate AI response
2. **POST /api/ai-assistant/conversations** - Create conversation
3. **GET /api/ai-assistant/conversations** - List conversations
4. **GET /api/ai-assistant/conversations/[conversationId]** - Get conversation
5. **PATCH /api/ai-assistant/conversations/[conversationId]** - Update conversation
6. **DELETE /api/ai-assistant/conversations/[conversationId]** - Delete conversation
7. **GET /api/personality** - Get personality profile
8. **POST /api/personality** - Update personality profile
9. **POST /api/ai-loop-prevention/check** - Check loop prevention limits

## Future Enhancements

1. **Rate Limiting**: Implement per-user rate limiting
2. **Request Logging**: Log all requests for audit trail
3. **Error Metrics**: Track error rates and types
4. **Retry Logic**: Implement exponential backoff for transient errors
5. **Circuit Breaker**: Implement circuit breaker for external APIs
6. **Error Recovery**: Implement automatic recovery strategies
