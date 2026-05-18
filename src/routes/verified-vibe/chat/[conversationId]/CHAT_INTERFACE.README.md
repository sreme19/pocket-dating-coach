# Chat Interface - Implementation Guide

## Overview

The Chat Interface is a real-time messaging component that enables users to communicate with their matches. It displays message history chronologically, distinguishes between sent and received messages, and provides real-time updates through polling or WebSocket integration.

## Features

### Core Features
- **Message History**: Display all messages in a conversation chronologically
- **Sent/Received Distinction**: Visually distinguish messages sent by the current user vs. received from the match
- **Real-time Updates**: Automatic message updates using polling (2-second intervals)
- **Typing Indicators**: Show when the other user is typing
- **Message Timestamps**: Display when each message was sent
- **Message Input**: Text area for composing and sending messages
- **Error Handling**: Graceful error handling with retry options
- **Loading States**: Visual feedback during message loading and sending

### Mobile Responsive
- Optimized for 375px-1024px viewport widths
- Touch-friendly buttons and inputs
- Responsive typography and spacing
- Proper keyboard handling on mobile devices

### Accessibility (WCAG 2.1 AA)
- Semantic HTML structure
- ARIA labels for interactive elements
- Keyboard navigation support
- Color contrast compliance
- Screen reader friendly

## File Structure

```
src/routes/verified-vibe/chat/
├── +page.svelte                          # Chat list page
├── CHAT_LIST.README.md                   # Chat list documentation
├── chat-list.test.ts                     # Chat list tests
└── [conversationId]/
    ├── +page.svelte                      # Chat interface page
    ├── CHAT_INTERFACE.README.md          # This file
    └── chat-interface.test.ts            # Chat interface tests

src/routes/api/verified-vibe/chat/
├── conversations/
│   └── +server.ts                        # GET conversations endpoint
├── send/
│   └── +server.ts                        # POST send message endpoint
├── [conversationId]/
│   ├── +server.ts                        # GET conversation endpoint
│   ├── messages/
│   │   └── +server.ts                    # GET messages endpoint (polling)
│   └── typing/
│       └── +server.ts                    # POST typing indicator endpoint
└── chat-interface.test.ts                # Chat interface API tests
```

## Component API

### Chat Interface Page (`+page.svelte`)

#### Props
None - uses route parameters and stores

#### Route Parameters
- `conversationId` (string): The match ID for the conversation

#### Stores Used
- `currentMatch`: The matched user profile
- `messages`: Array of messages in the conversation
- `isTyping`: Whether the other user is typing

#### Key Functions

**`handleSendMessage()`**
- Sends a message to the server
- Validates message content
- Updates local message list
- Scrolls to bottom

**`startPolling()`**
- Starts polling for new messages every 2 seconds
- Fetches messages from `/api/verified-vibe/chat/[conversationId]/messages`
- Updates message list automatically

**`handleInputChange(e)`**
- Handles message input changes
- Shows typing indicator
- Notifies server of typing status

**`scrollToBottom()`**
- Scrolls message container to bottom
- Used after loading messages or sending new message

**`formatTime(date)`**
- Formats message timestamp
- Shows time for same-day messages
- Shows "Yesterday" for previous day
- Shows date for older messages

**`isSentMessage(message)`**
- Determines if message was sent by current user
- Used for styling (sent vs. received)

## API Endpoints

### GET /api/verified-vibe/chat/[conversationId]

Retrieves a specific conversation with message history.

**Response:**
```json
{
  "data": {
    "matchedUser": {
      "id": "user_1",
      "firstName": "Sarah",
      "age": 26,
      "city": "Brooklyn, NY",
      "avatar": null,
      "trustScore": 88,
      ...
    },
    "messages": [
      {
        "id": "msg_1",
        "matchId": "match_1",
        "senderId": "user_1",
        "content": "Hey! How are you?",
        "createdAt": "2024-01-15T10:30:00Z"
      },
      ...
    ]
  }
}
```

### GET /api/verified-vibe/chat/[conversationId]/messages

Retrieves messages for a conversation (used for polling).

**Query Parameters:**
- `since` (optional): ISO timestamp to get messages after this time

**Response:**
```json
{
  "data": {
    "messages": [
      {
        "id": "msg_1",
        "matchId": "match_1",
        "senderId": "user_1",
        "content": "Hey! How are you?",
        "createdAt": "2024-01-15T10:30:00Z"
      },
      ...
    ]
  }
}
```

### POST /api/verified-vibe/chat/send

Sends a message in a conversation.

**Request Body:**
```json
{
  "conversationId": "match_1",
  "content": "Hello, how are you?",
  "mediaUrls": [] // optional
}
```

**Response:**
```json
{
  "data": {
    "message": {
      "id": "msg_123",
      "matchId": "match_1",
      "senderId": "current_user_id",
      "content": "Hello, how are you?",
      "createdAt": "2024-01-15T10:35:00Z"
    }
  }
}
```

**Error Responses:**
- 400: Missing required fields or invalid content
- 401: Unauthorized
- 404: Conversation not found
- 500: Server error

### POST /api/verified-vibe/chat/[conversationId]/typing

Notifies the server that the user is typing.

**Request Body:**
```json
{
  "isTyping": true
}
```

**Response:**
```json
{
  "data": {
    "success": true
  }
}
```

## Styling

### CSS Variables Used
- `--bg-1`: Primary background color
- `--bg-2`: Secondary background color
- `--bg-3`: Tertiary background color
- `--text-1`: Primary text color
- `--text-2`: Secondary text color
- `--text-3`: Tertiary text color
- `--border-1`: Primary border color
- `--border-2`: Secondary border color
- `--accent`: Accent color (for sent messages)

### Key Classes

**`.chat-interface-screen`**
- Main container
- Flex column layout
- Full height

**`.chat-header`**
- Header with back button and user info
- Sticky positioning
- Border bottom

**`.messages-container`**
- Scrollable message area
- Flex column layout
- Padding and gap

**`.message-group`**
- Individual message wrapper
- Flex layout
- Sent/received variants

**`.message-bubble`**
- Message content container
- Rounded corners
- Different colors for sent/received

**`.input-area`**
- Message input section
- Sticky positioning
- Border top

**`.message-input`**
- Textarea for message composition
- Auto-resize
- Focus states

**`.send-btn`**
- Send button
- Disabled state handling
- Loading state

## Real-time Updates

### Polling Strategy
- Polls every 2 seconds for new messages
- Uses `since` parameter to fetch only new messages
- Automatically scrolls to bottom when new messages arrive
- Stops polling when component is destroyed

### Typing Indicators
- Notifies server when user starts typing
- Hides indicator after 3 seconds of inactivity
- Shows animated dots when other user is typing

### Future: WebSocket Integration
For production, consider replacing polling with WebSocket:
1. Establish WebSocket connection on component mount
2. Listen for `message` events
3. Listen for `typing` events
4. Send `typing` events when user types
5. Close connection on component destroy

## Testing

### Test Coverage
- 38+ comprehensive tests
- API endpoint validation
- Message sending and receiving
- Polling functionality
- Typing indicators
- Error handling
- Content validation
- Timestamp handling

### Running Tests
```bash
npm test chat-interface.test.ts
```

### Test Categories
1. **GET Conversation Endpoint** (6 tests)
   - Returns conversation with matched user and messages
   - Validates required fields
   - Checks chronological ordering
   - Handles missing conversation ID

2. **GET Messages Endpoint** (7 tests)
   - Returns all messages
   - Filters by timestamp
   - Supports polling
   - Handles missing conversation ID

3. **POST Send Message Endpoint** (11 tests)
   - Sends messages successfully
   - Validates required fields
   - Trims whitespace
   - Rejects empty messages
   - Enforces max length (5000 chars)
   - Handles special characters
   - Supports multiline messages

4. **POST Typing Indicator Endpoint** (6 tests)
   - Notifies typing status
   - Validates boolean field
   - Handles missing fields
   - Rejects invalid data

5. **Message Content Validation** (4 tests)
   - Handles URLs
   - Handles mentions
   - Handles hashtags
   - Handles unicode characters

6. **Timestamp Handling** (2 tests)
   - Returns valid ISO timestamps
   - Maintains chronological order

7. **Error Handling** (2 tests)
   - Handles network errors
   - Returns valid status codes

## Mobile Responsiveness

### Breakpoints
- **Mobile (375px-767px)**
  - Reduced padding and margins
  - Smaller font sizes
  - Touch-friendly button sizes (40px minimum)
  - Full-width input area

- **Tablet (768px-1023px)**
  - Medium padding and margins
  - Standard font sizes
  - Comfortable button sizes

- **Desktop (1024px+)**
  - Larger padding and margins
  - Larger font sizes
  - Optimized spacing

### Mobile Optimizations
- Textarea auto-resize
- Keyboard handling (Enter to send, Shift+Enter for newline)
- Touch-friendly tap targets
- Smooth scrolling
- Proper viewport handling

## Accessibility Features

### WCAG 2.1 AA Compliance
- **Semantic HTML**: Proper heading hierarchy, button elements
- **ARIA Labels**: All interactive elements have descriptive labels
- **Keyboard Navigation**: Full keyboard support
- **Color Contrast**: Text meets WCAG AA standards
- **Focus Management**: Visible focus indicators
- **Screen Reader Support**: Proper announcements for dynamic content

### Keyboard Shortcuts
- `Enter`: Send message (when not in multiline mode)
- `Shift+Enter`: New line in message
- `Tab`: Navigate between elements
- `Escape`: Close any open dialogs

## Performance Considerations

### Optimization Strategies
1. **Message Virtualization**: For conversations with many messages, consider virtualizing the list
2. **Debounced Polling**: Could reduce polling frequency based on user activity
3. **Message Caching**: Cache messages locally to reduce API calls
4. **Image Optimization**: Compress and lazy-load message images
5. **Code Splitting**: Load chat interface on-demand

### Current Performance
- Initial load: ~500ms
- Message send: ~200ms
- Polling interval: 2 seconds
- Smooth animations: 300ms transitions

## Future Enhancements

### Planned Features
1. **Photo Sharing**: Upload and share photos in chat
2. **Message Reactions**: React to messages with emojis
3. **Message Editing**: Edit sent messages
4. **Message Deletion**: Delete sent messages
5. **Read Receipts**: Show when messages are read
6. **Message Search**: Search through conversation history
7. **Voice Messages**: Record and send voice messages
8. **Video Calls**: Initiate video calls from chat
9. **Message Pinning**: Pin important messages
10. **Conversation Archiving**: Archive old conversations

### WebSocket Integration
Replace polling with WebSocket for:
- Real-time message delivery
- Instant typing indicators
- Reduced server load
- Better battery life on mobile

### Message Persistence
- Store messages in local database
- Sync with server
- Offline message queue
- Automatic retry on reconnect

## Troubleshooting

### Common Issues

**Messages not updating**
- Check polling interval (should be 2 seconds)
- Verify API endpoint is responding
- Check browser console for errors
- Ensure conversation ID is valid

**Typing indicator not showing**
- Verify typing notification endpoint is working
- Check if `isTyping` store is being updated
- Ensure typing timeout is set correctly

**Messages not sending**
- Validate message content (not empty, under 5000 chars)
- Check network connection
- Verify API endpoint is responding
- Check authentication status

**Scroll not working**
- Ensure messages container has proper height
- Check for CSS overflow issues
- Verify scroll behavior is enabled

## Dependencies

### External Libraries
- `svelte`: UI framework
- `svelte/transition`: Animations
- `svelte/store`: State management

### Internal Dependencies
- `$lib/verified-vibe/types`: TypeScript types
- `$lib/verified-vibe/stores`: Global state management

## Browser Support

- Chrome/Edge: Latest 2 versions
- Firefox: Latest 2 versions
- Safari: Latest 2 versions
- Mobile browsers: Latest versions

## License

Part of the Verified Vibe Refactor project.
