# UserProfileCard - Block and Report Functionality

## Overview

The UserProfileCard component has been enhanced with block and report functionality to help users maintain a safe and respectful environment. Users can now block other users from appearing in their discovery feed and report inappropriate behavior to the moderation team.

## Features

### Block Functionality
- **Block Button**: Accessible via "More Options" menu
- **Bidirectional Blocking**: Blocked users won't see the blocking user's profile
- **Instant Feedback**: User receives confirmation when blocking is successful
- **Menu Integration**: Block option is part of the more options menu to keep UI clean

### Report Functionality
- **Report Button**: Accessible via "More Options" menu
- **Multiple Reasons**: Users can select from predefined report reasons
- **Optional Description**: Users can provide additional context for their report
- **Moderation Queue**: Reports are sent to the moderation team for review
- **User Confirmation**: Users receive confirmation that their report was submitted

## Component Props

```typescript
interface Props {
  /** The user profile to display */
  profile: DiscoveryProfile;
  /** Callback when user clicks like button */
  onLike?: () => void;
  /** Callback when user clicks pass button */
  onPass?: () => void;
  /** Callback when user clicks block button */
  onBlock?: () => void;
  /** Callback when user clicks report button */
  onReport?: () => void;
  /** Whether to show compact view */
  compact?: boolean;
}
```

## Usage

### Basic Usage

```svelte
<script lang="ts">
  import UserProfileCard from '$lib/verified-vibe/components/UserProfileCard.svelte';
  import type { DiscoveryProfile } from '$lib/verified-vibe/types';

  let profile: DiscoveryProfile;

  function handleBlock() {
    console.log('User blocked');
  }

  function handleReport() {
    console.log('User reported');
  }
</script>

<UserProfileCard
  {profile}
  onBlock={handleBlock}
  onReport={handleReport}
/>
```

### With API Integration

```svelte
<script lang="ts">
  import UserProfileCard from '$lib/verified-vibe/components/UserProfileCard.svelte';
  import { blockedUsers, blockUser } from '$lib/verified-vibe/stores';
  import type { DiscoveryProfile } from '$lib/verified-vibe/types';

  let profile: DiscoveryProfile;
  let isLoading = false;

  async function handleBlock() {
    isLoading = true;
    try {
      const response = await fetch('/api/verified-vibe/block-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockedUserId: profile.id })
      });

      if (!response.ok) {
        throw new Error('Failed to block user');
      }

      // Update store
      blockUser(profile.id);

      // Show notification
      showNotification('User blocked successfully');
    } catch (error) {
      showError('Failed to block user');
    } finally {
      isLoading = false;
    }
  }

  async function handleReport() {
    isLoading = true;
    try {
      // Open report modal
      openReportModal(profile.id);
    } finally {
      isLoading = false;
    }
  }
</script>

<UserProfileCard
  {profile}
  onBlock={handleBlock}
  onReport={handleReport}
/>
```

### With Report Modal

```svelte
<script lang="ts">
  import UserProfileCard from '$lib/verified-vibe/components/UserProfileCard.svelte';
  import ReportModal from './ReportModal.svelte';
  import type { DiscoveryProfile } from '$lib/verified-vibe/types';

  let profile: DiscoveryProfile;
  let showReportModal = false;
  let reportingUserId: string | null = null;

  function handleReport() {
    reportingUserId = profile.id;
    showReportModal = true;
  }

  async function submitReport(reason: string, description: string) {
    try {
      const response = await fetch('/api/verified-vibe/report-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportedUserId: reportingUserId,
          reason,
          description
        })
      });

      if (!response.ok) {
        throw new Error('Failed to submit report');
      }

      showNotification('Report submitted successfully');
      showReportModal = false;
    } catch (error) {
      showError('Failed to submit report');
    }
  }
</script>

<UserProfileCard
  {profile}
  onReport={handleReport}
/>

{#if showReportModal}
  <ReportModal
    userId={reportingUserId}
    onSubmit={submitReport}
    onClose={() => (showReportModal = false)}
  />
{/if}
```

## UI/UX Design

### More Options Menu

The block and report buttons are hidden in a "More Options" menu (⋮) to keep the UI clean:

```
┌─────────────────────────────┐
│  Profile Photo              │
│                             │
│  Trust Score Badge ↗        │
│  Verification Badges ↙      │
└─────────────────────────────┘
│ Name, Age, Location         │
│ Bio and About               │
│ Trust Score Breakdown       │
└─────────────────────────────┘
│ [Pass] [Like] [⋮]           │
│         ↓ (click ⋮)         │
│      [Block]                │
│      [Report]               │
└─────────────────────────────┘
```

### Menu Behavior

1. **Initial State**: Menu is hidden
2. **Click More Button**: Menu appears above the button
3. **Click Block/Report**: Menu closes and action is performed
4. **Click Outside**: Menu closes (optional)

### Accessibility

- **Keyboard Navigation**: All buttons are keyboard accessible
- **ARIA Labels**: Descriptive labels for screen readers
- **Focus Management**: Focus is properly managed when menu opens/closes
- **Color Contrast**: Menu items have sufficient color contrast
- **Touch Targets**: Buttons are at least 44x44px for mobile

## Styling

### CSS Classes

```css
/* More Options Container */
.more-options-container {
  position: relative;
}

/* More Button */
.more-button {
  background: transparent;
  color: var(--color-vibe-text-2);
  border-color: var(--color-vibe-border);
  font-size: var(--font-size-lg);
  padding: var(--spacing-md) var(--spacing-sm);
}

/* More Options Menu */
.more-options-menu {
  position: absolute;
  bottom: 100%;
  right: 0;
  background: var(--color-vibe-bg-2);
  border: 1px solid var(--color-vibe-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  z-index: 100;
  min-width: 140px;
}

/* Menu Items */
.menu-item {
  display: flex;
  align-items: center;
  gap: var(--gap-sm);
  width: 100%;
  padding: var(--spacing-md) var(--spacing-lg);
  background: transparent;
  border: none;
  color: var(--color-vibe-text-2);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: all 150ms ease;
  text-align: left;
}

.menu-item:hover {
  background: var(--color-vibe-bg-3);
  color: var(--color-vibe-text-1);
}

.menu-item.block-item:hover {
  color: #ef4444;
}

.menu-item.report-item {
  border-top: 1px solid var(--color-vibe-border);
}

.menu-item.report-item:hover {
  color: #f59e0b;
}
```

## State Management

### Using Svelte Stores

```typescript
import { blockedUsers, blockUser, unblockUser } from '$lib/verified-vibe/stores';

// Block a user
blockUser('user-123');

// Unblock a user
unblockUser('user-123');

// Check if user is blocked
$blockedUsers.includes('user-123');
```

### Store Integration

```svelte
<script lang="ts">
  import { blockedUsers } from '$lib/verified-vibe/stores';

  let profile: DiscoveryProfile;

  $: isBlocked = $blockedUsers.includes(profile.id);
</script>

{#if isBlocked}
  <p>This user is blocked</p>
{/if}
```

## API Integration

### Block User API

```typescript
POST /api/verified-vibe/block-user
Content-Type: application/json

{
  "blockedUserId": "user-123"
}

Response:
{
  "data": {
    "success": true,
    "message": "User user-123 has been blocked",
    "blockedUserId": "user-123"
  }
}
```

### Report User API

```typescript
POST /api/verified-vibe/report-user
Content-Type: application/json

{
  "reportedUserId": "user-123",
  "reason": "inappropriate_content",
  "description": "User posted explicit content"
}

Response:
{
  "data": {
    "success": true,
    "message": "Report submitted successfully. Our moderation team will review it shortly.",
    "reportId": "report-1234567890-abc123def456"
  }
}
```

## Error Handling

### Block Errors

```typescript
try {
  const response = await fetch('/api/verified-vibe/block-user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blockedUserId: profile.id })
  });

  if (!response.ok) {
    const error = await response.json();
    if (response.status === 400) {
      // Validation error
      console.error('Validation error:', error.error);
    } else if (response.status === 401) {
      // Not authenticated
      console.error('Not authenticated');
    } else {
      // Server error
      console.error('Server error:', error.error);
    }
  }
} catch (error) {
  console.error('Network error:', error);
}
```

### Report Errors

```typescript
try {
  const response = await fetch('/api/verified-vibe/report-user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      reportedUserId: profile.id,
      reason: 'inappropriate_content',
      description: 'User posted explicit content'
    })
  });

  if (!response.ok) {
    const error = await response.json();
    if (response.status === 400) {
      // Validation error
      if (error.error.includes('reason')) {
        console.error('Invalid report reason');
      } else if (error.error.includes('description')) {
        console.error('Description too long');
      }
    } else {
      console.error('Failed to submit report:', error.error);
    }
  }
} catch (error) {
  console.error('Network error:', error);
}
```

## Testing

### Unit Tests

The component includes comprehensive unit tests covering:

- Block button rendering and interaction
- Report button rendering and interaction
- More options menu visibility
- Callback invocation
- Accessibility attributes
- Mobile responsiveness
- Integration with other buttons

Run tests with:
```bash
npm test -- src/lib/verified-vibe/components/UserProfileCard.block-report.test.ts
```

### Test Coverage

- ✅ More options menu rendering
- ✅ Block button functionality
- ✅ Report button functionality
- ✅ Menu toggle behavior
- ✅ Integration with other buttons
- ✅ Optional callbacks
- ✅ Accessibility
- ✅ Compact view

## Mobile Responsiveness

### Mobile Layout

On mobile devices (< 768px):
- More options button is always visible
- Menu appears above the button
- Touch targets are at least 44x44px
- Menu items have adequate spacing

### Tablet Layout

On tablet devices (768px - 1024px):
- More options button is visible
- Menu appears above the button
- Larger touch targets for easier interaction

### Desktop Layout

On desktop devices (> 1024px):
- More options button is visible
- Menu appears above the button
- Hover effects on menu items

## Accessibility Compliance

### WCAG 2.1 AA Compliance

- ✅ Keyboard navigation support
- ✅ Screen reader support with ARIA labels
- ✅ Color contrast ratios meet standards
- ✅ Focus indicators are visible
- ✅ Touch targets are at least 44x44px
- ✅ Semantic HTML elements
- ✅ Proper heading hierarchy
- ✅ Error messages are clear and descriptive

## Performance Considerations

1. **Lazy Loading**: Menu is only rendered when needed
2. **Event Delegation**: Use event delegation for menu items
3. **Debouncing**: Debounce API calls to prevent spam
4. **Caching**: Cache blocked users list locally
5. **Optimistic Updates**: Update UI before API response

## Security Considerations

1. **Input Validation**: All inputs are validated on client and server
2. **CSRF Protection**: Use CSRF tokens for POST requests
3. **Rate Limiting**: Implement rate limiting on API endpoints
4. **Authentication**: All operations require authentication
5. **Authorization**: Users can only block/report other users

## Future Enhancements

1. **Unblock Functionality**: Add ability to unblock users
2. **Block List Management**: Show list of blocked users
3. **Report Status Tracking**: Let users track their reports
4. **Bulk Actions**: Block/report multiple users at once
5. **Undo Functionality**: Allow undoing block/report actions
6. **Notifications**: Notify users of moderation actions
7. **Appeal Process**: Allow users to appeal moderation decisions

## Related Components

- `UserProfileCard` - Main profile card component
- `ReportModal` - Modal for submitting detailed reports
- `NotificationCenter` - Display notifications to users
- `DiscoveryFeed` - Discovery feed that uses UserProfileCard

## Related APIs

- `POST /api/verified-vibe/block-user` - Block a user
- `POST /api/verified-vibe/report-user` - Report a user
- `GET /api/verified-vibe/discovery-feed` - Get discovery feed (excludes blocked users)
