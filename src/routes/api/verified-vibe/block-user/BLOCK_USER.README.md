# Block User API Endpoint

## Overview

The Block User endpoint allows authenticated users to block other users from appearing in their discovery feed. When a user is blocked, they will not see the blocking user's profile in their discovery feed, and vice versa.

## Endpoint

```
POST /api/verified-vibe/block-user
```

## Request

### Headers
```
Content-Type: application/json
Authorization: Bearer <token>  (in production)
```

### Body

```json
{
  "blockedUserId": "string"
}
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `blockedUserId` | string | Yes | The ID of the user to block |

### Validation Rules

- `blockedUserId` must be a non-empty string
- `blockedUserId` cannot be the same as the current user's ID (self-blocking prevention)
- `blockedUserId` must be a valid user ID format

## Response

### Success Response (200 OK)

```json
{
  "data": {
    "success": true,
    "message": "User {blockedUserId} has been blocked",
    "blockedUserId": "user-123"
  }
}
```

### Error Responses

#### 400 Bad Request

Missing or invalid `blockedUserId`:
```json
{
  "error": "blockedUserId is required"
}
```

Invalid `blockedUserId` type:
```json
{
  "error": "blockedUserId must be a string"
}
```

Self-blocking attempt:
```json
{
  "error": "Cannot block yourself"
}
```

#### 401 Unauthorized

```json
{
  "error": "Unauthorized"
}
```

#### 500 Internal Server Error

```json
{
  "error": "Internal server error"
}
```

## Usage Examples

### JavaScript/TypeScript

```typescript
// Block a user
async function blockUser(blockedUserId: string) {
  const response = await fetch('/api/verified-vibe/block-user', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      blockedUserId
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error);
  }

  const data = await response.json();
  console.log('User blocked:', data.data.blockedUserId);
  return data.data;
}

// Usage
try {
  await blockUser('user-123');
  console.log('User successfully blocked');
} catch (error) {
  console.error('Failed to block user:', error.message);
}
```

### Svelte Component Integration

```svelte
<script lang="ts">
  import { blockedUsers, blockUser } from '$lib/verified-vibe/stores';

  async function handleBlockUser(userId: string) {
    try {
      const response = await fetch('/api/verified-vibe/block-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockedUserId: userId })
      });

      if (!response.ok) {
        throw new Error('Failed to block user');
      }

      // Update local store
      blockUser(userId);
      
      // Show confirmation
      showNotification('User blocked successfully');
    } catch (error) {
      showError('Failed to block user');
    }
  }
</script>

<button onclick={() => handleBlockUser(profile.id)}>
  Block User
</button>
```

## Implementation Details

### Database Schema

In production, the following table would store block relationships:

```sql
CREATE TABLE blocked_users (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  blocked_user_id UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, blocked_user_id)
);

CREATE INDEX idx_blocked_users_user_id ON blocked_users(user_id);
CREATE INDEX idx_blocked_users_blocked_user_id ON blocked_users(blocked_user_id);
```

### Discovery Feed Integration

When fetching the discovery feed, blocked users should be excluded:

```typescript
// Query parameters for discovery feed
const params = new URLSearchParams({
  limit: '10',
  offset: '0',
  blockedIds: blockedUserIds.join(',')  // Pass blocked user IDs
});

const response = await fetch(`/api/verified-vibe/discovery-feed?${params}`);
```

### Bidirectional Blocking

When User A blocks User B:
- User B will not appear in User A's discovery feed
- User A will not appear in User B's discovery feed (optional, depends on product requirements)

## Security Considerations

1. **Authentication Required**: All block operations must be authenticated
2. **Authorization**: Users can only block other users, not themselves
3. **Rate Limiting**: Implement rate limiting to prevent abuse
4. **Audit Logging**: Log all block operations for moderation purposes
5. **Data Privacy**: Blocked user information should not be exposed to the blocking user

## Testing

The endpoint includes comprehensive unit tests covering:

- Successful block operations
- Input validation
- Self-blocking prevention
- Error handling
- Edge cases (long IDs, special characters, UUID formats)
- HTTP status codes

Run tests with:
```bash
npm test -- src/routes/api/verified-vibe/block-user/block-user.test.ts
```

## Related Endpoints

- `POST /api/verified-vibe/report-user` - Report inappropriate user behavior
- `GET /api/verified-vibe/discovery-feed` - Get discovery feed (excludes blocked users)

## Accessibility

- All error messages are clear and descriptive
- Proper HTTP status codes are used for different error scenarios
- Response format is consistent and predictable

## Performance

- Block operations should complete in < 100ms
- Blocked user list should be cached client-side for performance
- Discovery feed queries should use indexed lookups for blocked users

## Future Enhancements

1. **Unblock Functionality**: Add ability to unblock users
2. **Block List Management**: Allow users to view and manage their block list
3. **Mutual Blocking**: Automatically block both directions
4. **Block Notifications**: Notify users when they've been blocked (optional)
5. **Block Expiration**: Allow temporary blocks that expire after a period
