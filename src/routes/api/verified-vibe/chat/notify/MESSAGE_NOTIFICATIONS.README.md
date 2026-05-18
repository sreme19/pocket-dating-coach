# Message Notifications

## Overview

The Message Notifications feature provides in-app and push notifications for new messages in conversations. Users can receive notifications when messages arrive, with the ability to mute notifications per conversation.

## Features

- **In-App Notifications**: Toast notifications displayed when the app is in focus
- **Push Notifications**: Browser push notifications when the app is closed
- **Per-Conversation Muting**: Users can mute notifications for specific conversations
- **Message Preview**: Notifications include a preview of the message (first 100 characters)
- **Sender Information**: Notifications include the sender's name and optional photo
- **Tap to Open**: Clicking a notification opens the conversation
- **Notification Center**: Centralized view of all notifications with read/unread status

## API Endpoint

### POST /api/verified-vibe/chat/notify

Sends a message notification when a new message arrives.

#### Request Body

```typescript
{
  conversationId: string;    // ID of the conversation (match ID)
  userId: string;            // ID of the user receiving the notification
  senderId: string;          // ID of the user sending the message
  senderName: string;        // Name of the sender
  senderPhoto?: string;      // Photo URL of the sender (optional)
  messagePreview: string;    // Preview of the message (max 100 characters)
  isMuted?: boolean;         // Whether notifications are muted for this conversation
}
```

#### Response

```typescript
{
  success: boolean;
  notification?: {
    id: string;
    userId: string;
    type: 'message';
    status: 'unread' | 'read';
    title: string;
    body: string;
    data: {
      matchId: string;
      userId: string;
      userName: string;
      userPhoto?: string;
      actionUrl: string;
    };
    createdAt: Date;
  };
  error?: string;
}
```

#### Error Responses

- **400**: Invalid request (missing required fields, invalid types, or empty strings)
- **500**: Internal server error

## Usage

### Sending a Notification

```typescript
// When a new message arrives
const response = await fetch('/api/verified-vibe/chat/notify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    conversationId: 'conv_123',
    userId: 'user_456',
    senderId: 'user_789',
    senderName: 'John Doe',
    senderPhoto: 'https://example.com/photo.jpg',
    messagePreview: 'Hey, how are you?',
    isMuted: false
  })
});

const data = await response.json();
if (data.success) {
  // Notification created successfully
  console.log('Notification:', data.notification);
}
```

### Using the Notification Service

```typescript
import {
  sendMessageNotification,
  getConversationMutingStatus,
  toggleConversationMuting,
  requestNotificationPermission
} from '$lib/verified-vibe/services/notificationService';

// Request notification permission
const granted = await requestNotificationPermission();

// Send a message notification
if (granted) {
  sendMessageNotification('John Doe', 'Hey, how are you?', 'conv_123', 'https://example.com/photo.jpg');
}

// Check if notifications are muted for a conversation
const isMuted = getConversationMutingStatus('conv_123');

// Toggle muting for a conversation
const newMutedStatus = toggleConversationMuting('conv_123');
```

### Using the Notification Center Component

```svelte
<script>
  import NotificationCenter from '$lib/verified-vibe/components/NotificationCenter.svelte';
</script>

<NotificationCenter />
```

### Using the Mute Button Component

```svelte
<script>
  import NotificationMuteButton from '$lib/verified-vibe/components/NotificationMuteButton.svelte';

  function handleMuteChange(isMuted) {
    console.log('Notifications muted:', isMuted);
  }
</script>

<NotificationMuteButton conversationId="conv_123" onMuteChange={handleMuteChange} />
```

## Implementation Details

### Notification Types

- **message**: New message notification
- **match**: New match notification
- **verification**: Verification step completed
- **system**: System notifications

### Notification Status

- **unread**: Notification has not been read
- **read**: Notification has been read

### Muting Behavior

When notifications are muted for a conversation:
- The notification is still created and stored
- Push notifications are not sent
- In-app toast notifications are not shown
- The notification appears in the notification center with a muted indicator

### Storage

- Muted conversations are stored in localStorage under `vv_muted_conversations`
- Notifications are stored in the Svelte store `notifications`
- Unread notification count is tracked in `unreadNotifications` store

## Accessibility

- All notification components follow WCAG 2.1 AA standards
- Notifications include proper ARIA labels
- Keyboard navigation is fully supported
- Color is not the only indicator of notification status

## Mobile Responsiveness

- Toast notifications adapt to mobile screen sizes
- Notification center is fully responsive (375px-1024px)
- Touch-friendly buttons and interactive elements
- Proper spacing and sizing for mobile devices

## Testing

The notification feature includes comprehensive unit tests:

- **API Endpoint Tests** (15+ tests):
  - Valid requests with all required fields
  - Missing field validation
  - Invalid field type validation
  - Empty string validation
  - Message preview length validation
  - Notification data structure validation
  - Error handling

- **Service Tests** (20+ tests):
  - Conversation muting functionality
  - Notification formatting
  - Permission handling
  - Event dispatching
  - LocalStorage management
  - Error handling

Run tests with:
```bash
npm run test
```

## Browser Support

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support (iOS 16+)
- Mobile browsers: Full support

## Performance Considerations

- Notifications are created asynchronously
- Toast notifications auto-dismiss after 5 seconds
- Muted conversations are cached in localStorage
- Notification list is virtualized for large numbers of notifications

## Security

- Message previews are sanitized to prevent XSS
- Notification data is validated on both client and server
- User IDs are verified before sending notifications
- Sensitive data is not included in push notifications

## Future Enhancements

- Sound notifications
- Vibration feedback on mobile
- Notification grouping
- Scheduled notifications
- Notification scheduling (do not disturb hours)
- Notification analytics
- Rich notifications with actions
- Notification history export

## Troubleshooting

### Notifications not appearing

1. Check browser notification permissions
2. Verify the app is not in focus (for push notifications)
3. Check if notifications are muted for the conversation
4. Check browser console for errors

### Notifications not working on mobile

1. Ensure the app is installed as a PWA
2. Check mobile browser notification settings
3. Verify the app has notification permission
4. Check if the device is in do-not-disturb mode

### Muting not working

1. Clear browser cache and localStorage
2. Check if localStorage is enabled
3. Verify the conversation ID is correct
4. Check browser console for errors

## Related Components

- `NotificationCenter.svelte`: Displays all notifications
- `NotificationMuteButton.svelte`: Mutes/unmutes notifications for a conversation
- `notificationService.ts`: Core notification logic
- `stores.ts`: Notification state management

## References

- [Web Notifications API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API)
- [Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
