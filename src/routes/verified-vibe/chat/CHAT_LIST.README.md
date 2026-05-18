# Chat List Feature

## Overview

The Chat List feature displays all active conversations for the current user. It provides a clean, mobile-responsive interface for managing multiple conversations with matched users.

## Features

- **Conversation List**: Display all active conversations sorted by most recent message
- **User Information**: Show matched user's name, age, avatar, and trust score
- **Last Message Preview**: Display the last message in each conversation
- **Unread Badge**: Show unread message count for each conversation
- **Timestamp**: Display when the last message was sent (relative time)
- **Mobile Responsive**: Optimized for mobile (375px-1024px) and desktop screens
- **Accessibility**: WCAG 2.1 AA compliant with proper semantic HTML and ARIA labels
- **Loading States**: Show loading spinner while fetching conversations
- **Error Handling**: Display error message with retry option
- **Empty State**: Show helpful message when no conversations exist

## File Structure

```
src/routes/verified-vibe/chat/
├── +page.svelte                    # Chat list page component
├── chat-list.test.ts               # Comprehensive unit tests (36+ tests)
└── CHAT_LIST.README.md             # This file

src/routes/api/verified-vibe/chat/conversations/
└── +server.ts                      # API endpoint for fetching conversations
```

## API Endpoint

### GET /api/verified-vibe/chat/conversations

Retrieves all active conversations for the current user.

**Response:**
```json
{
  "data": {
    "conversations": [
      {
        "id": "conv_1",
        "matchId": "match_1",
        "matchedUser": {
          "id": "user_1",
          "firstName": "Sarah",
          "age": 26,
          "city": "Brooklyn, NY",
          "avatar": null,
          "trustScore": 88,
          "archetype": "spoilt_woman",
          "gender": "woman",
          "about": "Looking for someone genuine...",
          "looking": "Long-term relationship",
          "createdAt": "2024-01-15T00:00:00Z",
          "updatedAt": "2024-01-15T00:00:00Z"
        },
        "lastMessage": "That sounds amazing! When are you free?",
        "lastMessageTime": "2024-01-25T10:05:00Z",
        "unreadCount": 2
      }
    ]
  }
}
```

**Conversation Structure:**
- `id`: Unique conversation identifier
- `matchId`: ID of the match (for navigation to chat)
- `matchedUser`: User profile object with all user information
- `lastMessage`: Preview of the last message (string)
- `lastMessageTime`: Timestamp of the last message
- `unreadCount`: Number of unread messages (0 or greater)

## Component Usage

### Chat List Page

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import type { Conversation } from '../api/verified-vibe/chat/conversations/+server';

  let conversations = $state<Conversation[]>([]);
  let isLoading = $state(true);
  let error = $state<string | null>(null);

  onMount(async () => {
    // Fetch conversations from API
    const response = await fetch('/api/verified-vibe/chat/conversations');
    const data = await response.json();
    conversations = data.data.conversations;
  });

  function handleConversationClick(matchId: string) {
    goto(`/verified-vibe/chat/${matchId}`);
  }
</script>
```

## UI States

### Loading State
- Shows spinner and "Loading conversations..." message
- Displayed while fetching data from API

### Error State
- Shows error message
- Provides "Try Again" button to retry
- Triggered when API request fails

### Empty State
- Shows emoji icon (💬)
- Displays "No conversations yet" message
- Provides "Discover People" button to navigate to discovery feed

### Loaded State
- Shows list of conversations
- Each conversation is clickable
- Unread badges appear for conversations with unread messages

## Styling

### Design Tokens Used
- `--bg-1`: Primary background color
- `--bg-2`: Secondary background color
- `--bg-3`: Tertiary background color
- `--text-1`: Primary text color
- `--text-2`: Secondary text color
- `--text-3`: Tertiary text color
- `--text-4`: Quaternary text color
- `--border-1`: Primary border color
- `--border-2`: Secondary border color
- `--accent`: Accent color (for badges and buttons)
- `--accent-tint`: Accent tint color (for avatars)

### Responsive Breakpoints
- **Mobile**: 375px - 767px
- **Tablet**: 768px - 1023px
- **Desktop**: 1024px+

## Accessibility Features

- **Semantic HTML**: Uses proper heading hierarchy and semantic elements
- **ARIA Labels**: Back button has `aria-label="Go back"`
- **Keyboard Navigation**: All interactive elements are keyboard accessible
- **Color Contrast**: Meets WCAG AA standards (4.5:1 for text)
- **Focus Indicators**: Clear focus states for keyboard navigation
- **Screen Reader Support**: Proper text alternatives for icons
- **Touch Targets**: Minimum 44x44px touch targets on mobile

## Testing

### Test Coverage

The feature includes 36+ comprehensive unit tests covering:

1. **API Endpoint Tests** (36 tests)
   - Valid requests and responses
   - Conversation data structure validation
   - Sorting by most recent message
   - Unread message counts
   - User information validation
   - Last message content
   - Timestamp validation
   - Error handling
   - Empty state handling
   - Data consistency
   - Response structure

### Running Tests

```bash
# Run all tests
npm test

# Run chat list tests only
npm test -- chat-list.test.ts

# Run tests in watch mode
npm test:watch -- chat-list.test.ts
```

### Test Examples

```typescript
// Test: Conversations sorted by most recent
it('should return conversations sorted by most recent first', async () => {
  const response = await GET({ url: mockUrl } as any);
  const data = await response.json();
  
  const conversations = data.data.conversations;
  for (let i = 0; i < conversations.length - 1; i++) {
    const current = new Date(conversations[i].lastMessageTime).getTime();
    const next = new Date(conversations[i + 1].lastMessageTime).getTime();
    expect(current).toBeGreaterThanOrEqual(next);
  }
});

// Test: Unread message counts
it('should have unread count of 0 or greater', async () => {
  const response = await GET({ url: mockUrl } as any);
  const data = await response.json();
  
  data.data.conversations.forEach((conv) => {
    expect(conv.unreadCount).toBeGreaterThanOrEqual(0);
  });
});
```

## Performance Considerations

- **Lazy Loading**: Conversations are fetched on component mount
- **Efficient Sorting**: Conversations are sorted by timestamp on the server
- **Minimal Re-renders**: Uses Svelte's reactive state management
- **Optimized Images**: Avatar images should be optimized and lazy-loaded
- **Pagination**: Can be extended to support pagination for large conversation lists

## Future Enhancements

1. **Search**: Add search functionality to filter conversations
2. **Pagination**: Implement pagination for users with many conversations
3. **Conversation Pinning**: Allow users to pin important conversations
4. **Mute Notifications**: Add option to mute notifications for specific conversations
5. **Archive**: Allow users to archive conversations
6. **Delete**: Add option to delete conversations
7. **Real-time Updates**: Implement WebSocket for real-time conversation updates
8. **Typing Indicators**: Show when other user is typing
9. **Read Receipts**: Show when messages have been read
10. **Conversation Preview**: Show more context in the last message preview

## Browser Support

- Chrome/Edge: Latest 2 versions
- Firefox: Latest 2 versions
- Safari: Latest 2 versions
- Mobile browsers: iOS Safari 12+, Chrome Android 90+

## Dependencies

- **Svelte 5**: UI framework
- **SvelteKit**: Meta-framework for routing and server functions
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide Svelte**: Icon library (optional, for additional icons)

## Related Features

- **Chat Interface** (Task 21): Send and receive messages
- **Message Notifications** (Task 22): Notify users of new messages
- **Photo Sharing** (Task 23): Share photos in chat
- **Chat Moderation** (Task 24): Flag inappropriate messages
- **Discovery Feed** (Task 15): Find and match with users
- **Match Notifications** (Task 17): Notify users of new matches

## Troubleshooting

### Conversations not loading
- Check network tab in browser DevTools
- Verify API endpoint is accessible at `/api/verified-vibe/chat/conversations`
- Check browser console for error messages

### Styling issues
- Verify design tokens are defined in `src/lib/verified-vibe/design-tokens.css`
- Check Tailwind CSS configuration
- Ensure CSS variables are properly scoped

### Accessibility issues
- Use browser accessibility inspector to check ARIA labels
- Test with screen reader (NVDA, JAWS, VoiceOver)
- Verify keyboard navigation works with Tab key

## Contributing

When modifying this feature:

1. Update tests to cover new functionality
2. Ensure WCAG 2.1 AA compliance
3. Test on mobile devices (375px-1024px)
4. Update this README with any changes
5. Run `npm test` to verify all tests pass
6. Run `npm run check` to verify TypeScript types

## License

This feature is part of the Pocket Dating Coach application and follows the same license as the main project.
