# Like/Pass Endpoint Implementation

## Overview

This document describes the implementation of the Like/Pass logic for the Verified Vibe dating app. The endpoints handle user interactions with profiles during the discovery phase, including liking profiles, detecting mutual matches, and passing on profiles.

## Endpoints

### POST /api/verified-vibe/like

Handles the like action on a profile. Checks for mutual matches and creates match records if both users have liked each other.

**Request:**
```json
{
  "profileId": "string",
  "userId": "string"
}
```

**Response (Success):**
```json
{
  "matched": true,
  "matchId": "string"
}
```

Or if no mutual match yet:
```json
{
  "matched": false
}
```

**Status Codes:**
- `201 Created` - Like was successfully processed
- `400 Bad Request` - Missing required fields or invalid input
- `409 Conflict` - Like already exists
- `500 Internal Server Error` - Database or server error

**Error Responses:**
```json
{
  "error": "Missing profileId"
}
```

### DELETE /api/verified-vibe/like

Removes a like from a profile.

**Request:**
```json
{
  "profileId": "string",
  "userId": "string"
}
```

**Response (Success):**
```json
{
  "success": true
}
```

**Status Codes:**
- `200 OK` - Like was successfully removed
- `400 Bad Request` - Missing required fields
- `500 Internal Server Error` - Database or server error

### POST /api/verified-vibe/pass

Handles the pass action on a profile. Stores the pass to prevent showing the profile again in discovery.

**Request:**
```json
{
  "profileId": "string",
  "userId": "string"
}
```

**Response (Success):**
```json
{
  "success": true
}
```

**Status Codes:**
- `201 Created` - Pass was successfully recorded
- `400 Bad Request` - Missing required fields or invalid input
- `409 Conflict` - Pass already exists
- `500 Internal Server Error` - Database or server error

## Database Schema

### verified_vibe_likes Table

Stores all likes from users to other users.

```sql
CREATE TABLE verified_vibe_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES verified_vibe_users(id),
  liked_user_id UUID NOT NULL REFERENCES verified_vibe_users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, liked_user_id)
);
```

### verified_vibe_passes Table

Stores all passes from users to other users.

```sql
CREATE TABLE verified_vibe_passes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES verified_vibe_users(id),
  passed_user_id UUID NOT NULL REFERENCES verified_vibe_users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, passed_user_id)
);
```

### verified_vibe_matches Table

Stores all matches between users.

```sql
CREATE TABLE verified_vibe_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id UUID NOT NULL REFERENCES verified_vibe_users(id),
  user2_id UUID NOT NULL REFERENCES verified_vibe_users(id),
  status TEXT NOT NULL CHECK (status IN ('pending', 'mutual', 'rejected')),
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Implementation Details

### Like Flow

1. **Validation**: Check that both `profileId` and `userId` are provided and not equal (prevent self-likes)
2. **Check Existing Like**: Query `verified_vibe_likes` to ensure the user hasn't already liked this profile
3. **Save Like**: Insert the like into `verified_vibe_likes`
4. **Check Mutual Match**: Query `verified_vibe_likes` to see if the target user has already liked the current user
5. **Create Match (if mutual)**: If mutual like exists, check if a match record already exists, then create one if needed
6. **Return Response**: Return success with match info if applicable

### Pass Flow

1. **Validation**: Check that both `profileId` and `userId` are provided and not equal
2. **Check Existing Pass**: Query `verified_vibe_passes` to ensure the user hasn't already passed this profile
3. **Save Pass**: Insert the pass into `verified_vibe_passes`
4. **Return Response**: Return success

### Discovery Queue Update

The discovery endpoint should filter out:
- Profiles the user has already liked
- Profiles the user has already passed
- Profiles the user has matched with
- Profiles that have blocked the user
- The user's own profile

Example query:
```sql
SELECT * FROM verified_vibe_users
WHERE id NOT IN (
  SELECT liked_user_id FROM verified_vibe_likes WHERE user_id = $1
  UNION
  SELECT passed_user_id FROM verified_vibe_passes WHERE user_id = $1
  UNION
  SELECT user2_id FROM verified_vibe_matches WHERE user1_id = $1
  UNION
  SELECT user1_id FROM verified_vibe_matches WHERE user2_id = $1
)
AND id != $1
ORDER BY trust_score DESC
LIMIT $2;
```

## Error Handling

### Validation Errors

- **Missing profileId**: Return 400 with "Missing profileId"
- **Missing userId**: Return 400 with "Missing userId"
- **Self-like/pass**: Return 400 with "Cannot like/pass your own profile"

### Conflict Errors

- **Duplicate like**: Return 409 with "You have already liked this profile"
- **Duplicate pass**: Return 409 with "You have already passed this profile"

### Database Errors

- **Query errors**: Log error and return 500 with "Failed to [action]"
- **Insert errors**: Log error and return 500 with "Failed to [action]"

## Testing

### Unit Tests

Located in `like.test.ts` and `pass.test.ts`:

- Validation tests (missing fields, self-actions)
- Like storage tests
- Duplicate prevention tests
- Mutual match detection tests
- Error handling tests
- Like removal tests

### Integration Tests

Located in `like-matching.integration.test.ts`:

- Mutual match detection
- Trust score impact on matching
- Archetype compatibility
- Q&A compatibility
- Matching traits and issues
- Discovery queue filtering
- Match record creation

### Running Tests

```bash
npm test like.test.ts
npm test pass.test.ts
npm test like-matching.integration.test.ts
```

## Performance Considerations

1. **Indexes**: Add indexes on `(user_id, liked_user_id)` and `(user_id, passed_user_id)` for fast lookups
2. **Unique Constraints**: Use UNIQUE constraints to prevent duplicates at the database level
3. **Query Optimization**: Use efficient queries with proper filtering
4. **Caching**: Consider caching discovery feed results with TTL

## Security Considerations

1. **User Authentication**: Verify user identity before processing likes/passes
2. **Rate Limiting**: Implement rate limiting to prevent abuse (e.g., 100 likes per hour)
3. **Data Validation**: Validate all input data before processing
4. **SQL Injection**: Use parameterized queries (Supabase handles this)
5. **Privacy**: Don't expose like/pass information to other users

## Future Enhancements

1. **Undo Like**: Allow users to undo a like within a time window
2. **Like Notifications**: Notify users when they receive a like
3. **Match Suggestions**: Suggest matches based on compatibility scores
4. **Blocking**: Allow users to block other users
5. **Reporting**: Allow users to report inappropriate profiles
6. **Analytics**: Track like/pass ratios and match success rates

## Related Files

- `/src/routes/verified-vibe/api/like/+server.ts` - Like endpoint implementation
- `/src/routes/verified-vibe/api/pass/+server.ts` - Pass endpoint implementation
- `/src/lib/verified-vibe/server/matching.ts` - Compatibility scoring logic
- `/src/lib/verified-vibe/types.ts` - TypeScript types
- `/src/lib/server/supabase.ts` - Supabase client setup
