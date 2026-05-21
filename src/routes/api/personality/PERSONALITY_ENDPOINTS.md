# Personality Management Endpoints

This document describes the personality management API endpoints for male users in the AI Wingman integration.

## Overview

The personality management endpoints provide functionality to:
- Retrieve a user's personality profile (personality.md)
- Update personality profile with automatic version tracking
- View version history of personality changes
- Restore previous versions of the personality profile

All endpoints require user authentication via the `Authorization` header.

## Endpoints

### 1. GET /api/personality/:userId

Retrieve the current personality profile for a male user.

**Parameters:**
- `userId` (path parameter, required): The unique identifier of the user

**Headers:**
- `Authorization` (required): Bearer token for authentication

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "communicationStyle": "direct",
    "personalityVibe": "ambitious",
    "mattersMost": "humor",
    "values": ["authenticity", "growth", "loyalty"],
    "datingPatterns": ["genuine conversation", "quick to meet"],
    "redFlagsToAvoid": ["overly focused on appearance"],
    "updatedAt": 1704067200000
  }
}
```

**Error Responses:**
- `400 Bad Request`: Missing or invalid userId parameter
- `401 Unauthorized`: Missing or invalid authorization header
- `500 Internal Server Error`: Database error or server failure

**Requirements:** 8.1, 12.1

---

### 2. POST /api/personality/:userId

Update the personality profile with automatic version tracking.

**Parameters:**
- `userId` (path parameter, required): The unique identifier of the user

**Headers:**
- `Authorization` (required): Bearer token for authentication
- `Content-Type`: application/json

**Request Body:**
```json
{
  "updates": {
    "communicationStyle": "playful",
    "values": ["authenticity", "growth", "loyalty", "humor"]
  },
  "reason": "Updated based on conversation insights"
}
```

**Fields:**
- `updates` (required, object): Partial PersonalityProfile object with fields to update
- `reason` (optional, string): Description of why the profile was updated. Defaults to "Profile updated"

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "communicationStyle": "playful",
    "personalityVibe": "ambitious",
    "mattersMost": "humor",
    "values": ["authenticity", "growth", "loyalty", "humor"],
    "datingPatterns": ["genuine conversation", "quick to meet"],
    "redFlagsToAvoid": ["overly focused on appearance"],
    "updatedAt": 1704067200000
  },
  "version": 2,
  "updatedAt": 1704067200000
}
```

**Error Responses:**
- `400 Bad Request`: Missing userId, invalid updates field, or invalid JSON
- `401 Unauthorized`: Missing or invalid authorization header
- `500 Internal Server Error`: Database error or server failure

**Requirements:** 8.1, 12.1, 12.2

---

### 3. GET /api/personality/:userId/history

Retrieve the version history of personality profile changes.

**Parameters:**
- `userId` (path parameter, required): The unique identifier of the user

**Headers:**
- `Authorization` (required): Bearer token for authentication

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "version-uuid-1",
      "version": 2,
      "data": {
        "communicationStyle": "playful",
        "personalityVibe": "ambitious",
        "mattersMost": "humor",
        "values": ["authenticity", "growth", "loyalty", "humor"],
        "datingPatterns": ["genuine conversation", "quick to meet"],
        "redFlagsToAvoid": ["overly focused on appearance"],
        "updatedAt": 1704067200000
      },
      "reason": "Updated based on conversation insights",
      "createdAt": 1704067200000
    },
    {
      "id": "version-uuid-2",
      "version": 1,
      "data": {
        "communicationStyle": "direct",
        "personalityVibe": "ambitious",
        "mattersMost": "humor",
        "values": ["authenticity", "growth", "loyalty"],
        "datingPatterns": ["genuine conversation", "quick to meet"],
        "redFlagsToAvoid": ["overly focused on appearance"],
        "updatedAt": 1704067200000
      },
      "reason": "Initial profile",
      "createdAt": 1704067200000
    }
  ],
  "count": 2
}
```

**Response Fields:**
- `success` (boolean): Whether the request was successful
- `data` (array): Array of ProfileVersion objects, ordered by version (newest first)
- `count` (number): Total number of versions

**ProfileVersion Object:**
- `id` (string): Unique identifier for this version
- `version` (number): Version number (incremental)
- `data` (object): PersonalityProfile data for this version
- `reason` (string): Reason for this update
- `createdAt` (number): Timestamp when this version was created

**Error Responses:**
- `400 Bad Request`: Missing or invalid userId parameter
- `401 Unauthorized`: Missing or invalid authorization header
- `500 Internal Server Error`: Database error or server failure

**Requirements:** 8.1, 12.1, 12.2

---

### 4. POST /api/personality/:userId/restore/:versionId

Restore a previous version of the personality profile.

**Parameters:**
- `userId` (path parameter, required): The unique identifier of the user
- `versionId` (path parameter, required): The ID of the version to restore

**Headers:**
- `Authorization` (required): Bearer token for authentication

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Personality profile restored to version version-uuid-2",
  "data": {
    "communicationStyle": "direct",
    "personalityVibe": "ambitious",
    "mattersMost": "humor",
    "values": ["authenticity", "growth", "loyalty"],
    "datingPatterns": ["genuine conversation", "quick to meet"],
    "redFlagsToAvoid": ["overly focused on appearance"],
    "updatedAt": 1704067200000
  },
  "version": 3,
  "restoredAt": 1704067200000
}
```

**Response Fields:**
- `success` (boolean): Whether the restore was successful
- `message` (string): Confirmation message
- `data` (object): The restored PersonalityProfile data
- `version` (number): The new version number created by the restore
- `restoredAt` (number): Timestamp when the restore occurred

**Important Notes:**
- Restoring a version creates a NEW version entry (not replacing the current version)
- The full version history is preserved
- The restored version becomes the current active profile
- A new version number is assigned to the restored data

**Error Responses:**
- `400 Bad Request`: Missing or invalid userId or versionId parameters
- `401 Unauthorized`: Missing or invalid authorization header
- `404 Not Found`: Version not found for this user
- `500 Internal Server Error`: Database error or server failure

**Requirements:** 8.1, 12.1, 12.2

---

## Data Models

### PersonalityProfile

```typescript
interface PersonalityProfile {
  communicationStyle: string;      // e.g., "direct", "playful", "genuine"
  personalityVibe: string;         // e.g., "ambitious", "chill", "adventurous"
  mattersMost: string;             // e.g., "humor", "looks", "compatibility"
  values: string[];                // Core values (e.g., ["authenticity", "growth"])
  datingPatterns: string[];        // Observed dating patterns
  redFlagsToAvoid: string[];       // Red flags to watch for
  updatedAt: number;               // Timestamp of last update
}
```

### ProfileVersion

```typescript
interface ProfileVersion {
  id: string;                      // Unique version identifier
  version: number;                 // Version number (incremental)
  data: PersonalityProfile;        // The profile data for this version
  reason: string;                  // Reason for this update
  createdAt: number;               // Timestamp when created
}
```

---

## Authentication

All endpoints require authentication via the `Authorization` header:

```
Authorization: Bearer <token>
```

The token should be a valid JWT or session token for the authenticated user.

---

## Error Handling

### Common Error Responses

**400 Bad Request:**
```json
{
  "error": "userId parameter is required"
}
```

**401 Unauthorized:**
```json
{
  "error": "Authorization header is required"
}
```

**404 Not Found:**
```json
{
  "error": "Version not found"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Failed to load personality profile"
}
```

---

## Version History Tracking

The personality management system automatically tracks all changes:

1. **Version Numbers**: Each update creates a new version with an incremented version number
2. **Immutability**: Previous versions are never modified after creation
3. **Reason Tracking**: Each update includes a reason for the change
4. **Timestamps**: Each version records when it was created
5. **Restoration**: Restoring a version creates a new version entry, preserving the full history

### Example Version History Flow

```
Version 1: Initial profile (communicationStyle: "direct")
Version 2: Updated values (added "humor" to values)
Version 3: Updated communication style (changed to "playful")
Version 4: Restored from Version 1 (communicationStyle: "direct" again)
```

---

## Gender Validation

These endpoints are designed for **male users only**. The system should validate:
- User gender is "man"
- Reject requests from female users (gender: "woman")
- Allow "prefer_not_to_say" users with explicit confirmation

---

## Requirements Mapping

- **Requirement 8.1**: Chat History Persistence and Retrieval
  - Personality profiles are stored in Supabase with version history
  - Profiles can be retrieved and updated across sessions

- **Requirement 8.2**: Chat History Persistence and Retrieval
  - Conversation history is maintained with personality context
  - Profiles are loaded when AI Wingman is activated

- **Requirement 12.1**: Profile Data Loading and Caching
  - Personality profiles are loaded from Supabase
  - Data is cached in memory for performance
  - Cache is invalidated on updates

- **Requirement 12.2**: Profile Data Loading and Caching
  - Version history is tracked and retrievable
  - Previous versions can be restored
  - Full audit trail is maintained

---

## Usage Examples

### Get Current Personality Profile

```bash
curl -X GET "https://api.example.com/api/personality/user-123" \
  -H "Authorization: Bearer token-123"
```

### Update Personality Profile

```bash
curl -X POST "https://api.example.com/api/personality/user-123" \
  -H "Authorization: Bearer token-123" \
  -H "Content-Type: application/json" \
  -d '{
    "updates": {
      "communicationStyle": "playful",
      "values": ["authenticity", "growth", "loyalty", "humor"]
    },
    "reason": "Updated based on recent conversations"
  }'
```

### Get Version History

```bash
curl -X GET "https://api.example.com/api/personality/user-123/history" \
  -H "Authorization: Bearer token-123"
```

### Restore Previous Version

```bash
curl -X POST "https://api.example.com/api/personality/user-123/restore/version-uuid-2" \
  -H "Authorization: Bearer token-123"
```

---

## Testing

The endpoints include comprehensive test coverage:

- **Unit Tests** (`personality.test.ts`): Test individual functions and services
- **Integration Tests** (`personality.integration.test.ts`): Test complete request/response flows
- **Property-Based Tests**: Validate universal correctness properties

Run tests with:
```bash
npm test -- src/routes/api/personality/
```

---

## Performance Considerations

1. **Caching**: Personality profiles are cached in memory for 5 minutes
2. **Database Indexes**: Queries are optimized with indexes on user_id and profile_type
3. **Version History**: Only the latest version is typically loaded; history is fetched on demand
4. **Batch Operations**: Updates are atomic and include version tracking in a single transaction

---

## Security Considerations

1. **Authentication**: All endpoints require valid authorization header
2. **User Isolation**: Users can only access their own personality profiles (enforced by RLS policies)
3. **Data Validation**: All inputs are validated before processing
4. **Error Messages**: Generic error messages are returned to prevent information leakage
5. **Audit Trail**: All changes are logged with reason and timestamp

---

## Future Enhancements

1. **Bulk Updates**: Support updating multiple fields in a single request
2. **Diff View**: Show differences between versions
3. **Auto-Update**: Automatically update personality based on conversation insights
4. **Merge Conflicts**: Handle concurrent updates gracefully
5. **Export/Import**: Allow users to export and import personality profiles
