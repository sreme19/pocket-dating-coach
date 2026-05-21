# API Specifications - AI Bestie & AI Wingman Integration

## Overview

This document provides detailed specifications for all API endpoints required for AI Bestie and AI Wingman integration.

---

## 1. POST `/api/ai-assistant/activate`

**Purpose**: Activate AI assistant for a specific match.

**Authentication**: Required (user must own the match)

**Request Body**:
```typescript
{
  matchId: string                    // UUID of the match
  assistantType: 'bestie' | 'wingman' // Type of assistant
  autoImpersonate?: boolean          // For Wingman: enable auto-send after 20+ messages
}
```

**Response (200 OK)**:
```typescript
{
  success: true
  config: {
    matchId: string
    assistantType: 'bestie' | 'wingman'
    isActive: boolean
    autoImpersonate: boolean
    exchangeCount: number
    lastExchangeAt: number | null
    createdAt: number
    updatedAt: number
  }
  profile: {
    // For Bestie (preferences.md)
    emotionalSignals?: string[]
    lifestyleSignals?: string[]
    maturitySignals?: string[]
    boundaries?: string[]
    dealbreakers?: string[]
    privateCompatibilityNotes?: string[]
    sensitiveTranslations?: Array<{ raw: string; translated: string }>
    
    // For Wingman (personality.md)
    communicationStyle?: string
    personalityVibe?: string
    mattersMost?: string
    strengths?: string[]
    values?: string[]
    dealbreakers?: string[]
    conversationStarters?: string[]
    
    // Common
    lastUpdatedAt: number
    lastUpdatedBy: 'user' | 'ai'
    version: number
  }
}
```

**Response (400 Bad Request)**:
```typescript
{
  error: 'INVALID_REQUEST'
  message: 'matchId and assistantType are required'
}
```

**Response (403 Forbidden)**:
```typescript
{
  error: 'UNAUTHORIZED'
  message: 'You do not own this match'
}
```

**Response (404 Not Found)**:
```typescript
{
  error: 'MATCH_NOT_FOUND'
  message: 'Match does not exist'
}
```

**Response (500 Internal Server Error)**:
```typescript
{
  error: 'ACTIVATION_FAILED'
  message: 'Failed to activate AI assistant'
}
```

---

## 2. POST `/api/ai-assistant/deactivate`

**Purpose**: Deactivate AI assistant for a specific match.

**Authentication**: Required (user must own the match)

**Request Body**:
```typescript
{
  matchId: string
  assistantType: 'bestie' | 'wingman'
}
```

**Response (200 OK)**:
```typescript
{
  success: true
  message: 'AI assistant deactivated'
}
```

**Response (400 Bad Request)**:
```typescript
{
  error: 'INVALID_REQUEST'
  message: 'matchId and assistantType are required'
}
```

**Response (403 Forbidden)**:
```typescript
{
  error: 'UNAUTHORIZED'
  message: 'You do not own this match'
}
```

**Response (404 Not Found)**:
```typescript
{
  error: 'CONFIG_NOT_FOUND'
  message: 'AI assistant configuration not found'
}
```

---

## 3. POST `/api/ai-assistant/message`

**Purpose**: Generate AI response for a message in a conversation.

**Authentication**: Required (user must own the match)

**Request Body**:
```typescript
{
  matchId: string
  assistantType: 'bestie' | 'wingman'
  userMessage: string                    // The user's message to respond to
  conversationHistory: Array<{
    role: 'user' | 'assistant'
    content: string
    timestamp?: number
  }>
  userProfile: {
    gender: 'man' | 'woman' | 'prefer_not_to_say'
    ageRange: string
    datingApp: string
    relationshipGoal: string
  }
  matchedUserProfile?: {
    gender?: 'man' | 'woman' | 'prefer_not_to_say'
    ageRange?: string
    datingApp?: string
    relationshipGoal?: string
  }
}
```

**Response (200 OK)**:
```typescript
{
  success: true
  reply: string                          // AI-generated response
  citations: string[]                    // Citations from book
  suggestions?: string[]                 // Optional follow-up suggestions
  privateAnalysis?: {
    flags: string[]                      // Red/green/yellow flags
    reasoning: string                    // Why these flags matter
    suggestions: string[]                // Strategic suggestions
    matchInsights: string[]              // What we learned about match
  }
  loopPreventionActive?: boolean         // True if loop prevention triggered
  exchangeCount?: number                 // Current exchange count
}
```

**Response (400 Bad Request)**:
```typescript
{
  error: 'INVALID_REQUEST'
  message: 'userMessage and conversationHistory are required'
}
```

**Response (403 Forbidden)**:
```typescript
{
  error: 'UNAUTHORIZED'
  message: 'You do not own this match'
}
```

**Response (429 Too Many Requests)**:
```typescript
{
  error: 'AI_LOOP_PREVENTION_ACTIVE'
  message: 'AI has reached max exchanges for this match. Try again in 24 hours or reset manually.'
  exchangeCount: 10
  maxExchanges: 10
  resetAt: number                        // Unix timestamp when counter resets
}
```

**Response (503 Service Unavailable)**:
```typescript
{
  error: 'CLAUDE_TIMEOUT'
  message: 'AI response took too long. Please try again.'
  retryAfter: 5000                       // Milliseconds to wait before retry
}
```

---

## 4. GET `/api/ai-assistant/profile`

**Purpose**: Get current AI assistant profile (preferences.md or personality.md).

**Authentication**: Required

**Query Parameters**:
```typescript
{
  assistantType: 'bestie' | 'wingman'
}
```

**Response (200 OK)**:
```typescript
{
  success: true
  profile: {
    // Profile data (varies by assistant type)
    emotionalSignals?: string[]
    lifestyleSignals?: string[]
    // ... other fields
    
    lastUpdatedAt: number
    lastUpdatedBy: 'user' | 'ai'
    version: number
  }
  version: number
  history: Array<{
    id: string
    version: number
    profile: object
    changeReason: string
    createdAt: number
    createdBy: 'user' | 'ai'
  }>
}
```

**Response (400 Bad Request)**:
```typescript
{
  error: 'INVALID_REQUEST'
  message: 'assistantType is required'
}
```

**Response (404 Not Found)**:
```typescript
{
  error: 'PROFILE_NOT_FOUND'
  message: 'Profile does not exist. Create one by activating the assistant.'
}
```

---

## 5. PUT `/api/ai-assistant/profile`

**Purpose**: Update AI assistant profile (preferences.md or personality.md).

**Authentication**: Required

**Request Body**:
```typescript
{
  assistantType: 'bestie' | 'wingman'
  profile: {
    // Partial profile data to merge
    emotionalSignals?: string[]
    lifestyleSignals?: string[]
    // ... other fields
  }
  changeReason: string                   // Why this change was made
}
```

**Response (200 OK)**:
```typescript
{
  success: true
  profile: {
    // Updated profile
    lastUpdatedAt: number
    lastUpdatedBy: 'user'
    version: number
  }
  version: number
  history: Array<{
    id: string
    version: number
    profile: object
    changeReason: string
    createdAt: number
    createdBy: 'user' | 'ai'
  }>
}
```

**Response (400 Bad Request)**:
```typescript
{
  error: 'INVALID_REQUEST'
  message: 'assistantType, profile, and changeReason are required'
}
```

**Response (409 Conflict)**:
```typescript
{
  error: 'VERSION_CONFLICT'
  message: 'Profile was updated by another request. Please refresh and try again.'
  currentVersion: number
}
```

---

## 6. POST `/api/ai-assistant/profile/revert`

**Purpose**: Revert profile to a previous version.

**Authentication**: Required

**Request Body**:
```typescript
{
  assistantType: 'bestie' | 'wingman'
  versionId: string                      // ID of version to revert to
}
```

**Response (200 OK)**:
```typescript
{
  success: true
  profile: {
    // Reverted profile
    lastUpdatedAt: number
    lastUpdatedBy: 'user'
    version: number
  }
  version: number
}
```

**Response (400 Bad Request)**:
```typescript
{
  error: 'INVALID_REQUEST'
  message: 'assistantType and versionId are required'
}
```

**Response (404 Not Found)**:
```typescript
{
  error: 'VERSION_NOT_FOUND'
  message: 'Version does not exist'
}
```

---

## 7. GET `/api/ai-assistant/config`

**Purpose**: Get AI assistant configuration for a match.

**Authentication**: Required (user must own the match)

**Query Parameters**:
```typescript
{
  matchId: string
}
```

**Response (200 OK)**:
```typescript
{
  success: true
  config: {
    matchId: string
    assistantType: 'bestie' | 'wingman'
    isActive: boolean
    autoImpersonate: boolean
    exchangeCount: number
    lastExchangeAt: number | null
    createdAt: number
    updatedAt: number
  }
}
```

**Response (400 Bad Request)**:
```typescript
{
  error: 'INVALID_REQUEST'
  message: 'matchId is required'
}
```

**Response (403 Forbidden)**:
```typescript
{
  error: 'UNAUTHORIZED'
  message: 'You do not own this match'
}
```

**Response (404 Not Found)**:
```typescript
{
  error: 'CONFIG_NOT_FOUND'
  message: 'Configuration not found'
}
```

---

## 8. PUT `/api/ai-assistant/config`

**Purpose**: Update AI assistant configuration for a match.

**Authentication**: Required (user must own the match)

**Request Body**:
```typescript
{
  matchId: string
  config: {
    isActive?: boolean
    autoImpersonate?: boolean
  }
}
```

**Response (200 OK)**:
```typescript
{
  success: true
  config: {
    matchId: string
    assistantType: 'bestie' | 'wingman'
    isActive: boolean
    autoImpersonate: boolean
    exchangeCount: number
    lastExchangeAt: number | null
    createdAt: number
    updatedAt: number
  }
}
```

**Response (400 Bad Request)**:
```typescript
{
  error: 'INVALID_REQUEST'
  message: 'matchId and config are required'
}
```

**Response (403 Forbidden)**:
```typescript
{
  error: 'UNAUTHORIZED'
  message: 'You do not own this match'
}
```

---

## 9. POST `/api/ai-assistant/config/reset-counter`

**Purpose**: Manually reset exchange counter for a match.

**Authentication**: Required (user must own the match)

**Request Body**:
```typescript
{
  matchId: string
  assistantType: 'bestie' | 'wingman'
}
```

**Response (200 OK)**:
```typescript
{
  success: true
  exchangeCount: 0
  message: 'Exchange counter reset'
}
```

**Response (400 Bad Request)**:
```typescript
{
  error: 'INVALID_REQUEST'
  message: 'matchId and assistantType are required'
}
```

**Response (403 Forbidden)**:
```typescript
{
  error: 'UNAUTHORIZED'
  message: 'You do not own this match'
}
```

---

## 10. GET `/api/ai-assistant/summary`

**Purpose**: Get match summary bubble(s).

**Authentication**: Required

**Query Parameters**:
```typescript
{
  matchId?: string                       // If omitted, return all summaries for user
}
```

**Response (200 OK)**:
```typescript
{
  success: true
  summaries: Array<{
    matchId: string
    matchName: string
    lastMessageAt: number
    messageCount: number
    keyInsights: string[]                // Top 3-5 insights
    compatibilityScore: number           // 0-100
    nextSteps: string[]                  // Suggested actions
    redFlags: string[]
    greenFlags: string[]
    generatedAt: number
  }>
}
```

**Response (400 Bad Request)**:
```typescript
{
  error: 'INVALID_REQUEST'
  message: 'matchId must be a valid UUID'
}
```

**Response (403 Forbidden)**:
```typescript
{
  error: 'UNAUTHORIZED'
  message: 'You do not own this match'
}
```

**Response (404 Not Found)**:
```typescript
{
  error: 'SUMMARY_NOT_FOUND'
  message: 'Summary not found'
}
```

---

## 11. GET `/api/ai-assistant/messages`

**Purpose**: Get all AI-sent messages for a match.

**Authentication**: Required (user must own the match)

**Query Parameters**:
```typescript
{
  matchId: string
  limit?: number                         // Default: 50, Max: 100
  offset?: number                        // Default: 0
}
```

**Response (200 OK)**:
```typescript
{
  success: true
  messages: Array<{
    id: string
    messageId: string                    // Reference to verified_vibe_messages
    assistantType: 'bestie' | 'wingman'
    isImpersonation: boolean
    content: string
    privateAnalysis: {
      flags: string[]
      reasoning: string
      suggestions: string[]
      matchInsights: string[]
    }
    createdAt: number
  }>
  total: number
  limit: number
  offset: number
}
```

**Response (400 Bad Request)**:
```typescript
{
  error: 'INVALID_REQUEST'
  message: 'matchId is required'
}
```

**Response (403 Forbidden)**:
```typescript
{
  error: 'UNAUTHORIZED'
  message: 'You do not own this match'
}
```

---

## 12. GET `/api/ai-assistant/impersonation-status`

**Purpose**: Check if Wingman can impersonate (20+ messages threshold).

**Authentication**: Required (user must own the match)

**Query Parameters**:
```typescript
{
  matchId: string
}
```

**Response (200 OK)**:
```typescript
{
  success: true
  canImpersonate: boolean
  messageCount: number
  requiredMessages: 20
  percentComplete: number                // 0-100
}
```

**Response (400 Bad Request)**:
```typescript
{
  error: 'INVALID_REQUEST'
  message: 'matchId is required'
}
```

**Response (403 Forbidden)**:
```typescript
{
  error: 'UNAUTHORIZED'
  message: 'You do not own this match'
}
```

---

## Error Codes Reference

| Code | HTTP Status | Meaning |
|------|-------------|---------|
| INVALID_REQUEST | 400 | Missing or invalid request parameters |
| UNAUTHORIZED | 403 | User does not own the resource |
| MATCH_NOT_FOUND | 404 | Match does not exist |
| CONFIG_NOT_FOUND | 404 | Configuration not found |
| PROFILE_NOT_FOUND | 404 | Profile does not exist |
| VERSION_NOT_FOUND | 404 | Profile version not found |
| SUMMARY_NOT_FOUND | 404 | Summary not found |
| VERSION_CONFLICT | 409 | Profile was updated by another request |
| AI_LOOP_PREVENTION_ACTIVE | 429 | Exchange limit reached |
| ACTIVATION_FAILED | 500 | Failed to activate AI assistant |
| CLAUDE_TIMEOUT | 503 | Claude API timeout |

---

## Rate Limiting

All endpoints are subject to rate limiting:

- **Per User**: 100 requests per minute
- **Per Match**: 10 AI message generations per hour
- **Per Profile**: 5 profile updates per day

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1234567890
```

---

## Pagination

Endpoints that return lists support pagination:

**Query Parameters**:
```typescript
{
  limit?: number                         // Default: 50, Max: 100
  offset?: number                        // Default: 0
}
```

**Response**:
```typescript
{
  success: true
  data: Array<...>
  total: number
  limit: number
  offset: number
}
```

---

## Timestamps

All timestamps are Unix timestamps (milliseconds since epoch).

Example: `1704067200000` = January 1, 2024 00:00:00 UTC

---

## Authentication

All endpoints require authentication via:

1. **Session Cookie**: `session_id` (for browser requests)
2. **Bearer Token**: `Authorization: Bearer <token>` (for API requests)

The authentication middleware validates that the user owns the resource being accessed.

---

## CORS

All endpoints support CORS with the following headers:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

---

## Versioning

API version: `v1`

All endpoints are prefixed with `/api/v1/` (or `/api/` for backward compatibility).

Future versions will be available at `/api/v2/`, etc.

