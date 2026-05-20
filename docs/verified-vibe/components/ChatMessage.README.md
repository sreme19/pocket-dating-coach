# ChatMessage Component

A fully accessible, responsive chat message component for the Verified Vibe dating app. Displays individual messages with sender/receiver distinction, timestamps, and optional read status indicators.

## Features

- **Sender/Receiver Distinction**: Left/right alignment with different bubble styles
- **Message Text**: Supports long text with proper wrapping and line break preservation
- **Timestamp Display**: Relative time formatting (e.g., "2m ago") with fallback to absolute time
- **Read Status Indicator**: Optional checkmark icons for sent/read status
- **Smooth Animations**: Fade and slide transitions with prefers-reduced-motion support
- **WCAG 2.1 AA Accessibility**: Full keyboard navigation, screen reader support, proper ARIA labels
- **Mobile Responsive**: Optimized for 375px-1024px viewports with touch-friendly targets
- **Dark Mode Support**: Automatic color scheme adaptation

## Usage

### Basic Usage

```svelte
<script lang="ts">
  import ChatMessage from '$lib/verified-vibe/components/ChatMessage.svelte';
  import type { Message } from '$lib/verified-vibe/types';

  const message: Message = {
    id: 'msg-123',
    matchId: 'match-456',
    senderId: 'user-789',
    content: 'Hey! How are you doing?',
    createdAt: new Date()
  };
</script>

<ChatMessage
  message={message}
  isCurrentUser={true}
  showTimestamp={true}
  showReadStatus={true}
  isRead={true}
/>
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `message` | `Message` | Required | The message object to display |
| `isCurrentUser` | `boolean` | Required | Whether this message is from the current user (affects alignment) |
| `showTimestamp` | `boolean` | `true` | Whether to display the timestamp |
| `showReadStatus` | `boolean` | `false` | Whether to display the read status indicator |
| `isRead` | `boolean` | `false` | Whether the message has been read (only shown if `showReadStatus` is true) |

### Message Type

```typescript
interface Message {
  id: string;
  matchId: string;
  senderId: string;
  content: string;
  createdAt: Date;
}
```

## Styling

The component uses CSS custom properties for theming:

- `--color-vibe-emerald`: Sent message background
- `--color-vibe-bg-2`: Received message background
- `--color-vibe-border`: Message border
- `--color-vibe-text-1`: Primary text color
- `--color-vibe-text-2`: Secondary text color
- `--color-vibe-text-3`: Tertiary text color
- `--spacing-*`: Spacing values
- `--radius-*`: Border radius values
- `--shadow-*`: Shadow values

## Accessibility

### WCAG 2.1 AA Compliance

- ✅ Semantic HTML with `<article>` element
- ✅ Proper ARIA labels for screen readers
- ✅ Keyboard navigation support (Tab, Enter, Space)
- ✅ Focus-visible outlines
- ✅ Color contrast ratios > 4.5:1
- ✅ Touch targets ≥ 44x44px
- ✅ Respects `prefers-reduced-motion`
- ✅ Decorative icons marked with `aria-hidden`

### Screen Reader Announcements

- Sent messages: "You sent: [message content] at [timestamp]"
- Received messages: "They sent: [message content] at [timestamp]"
- Read status: "message read" or "message sent"

## Responsive Design

### Breakpoints

- **Mobile (375px-480px)**: 90% max-width, smaller padding
- **Tablet (481px-767px)**: 75% max-width, medium padding
- **Desktop (768px+)**: 60% max-width, larger padding

### Mobile Features

- Touch-friendly bubble sizing
- Readable font sizes (16px minimum)
- Adequate line height (1.5+)
- No horizontal scrolling
- Full-width message container

## Timestamp Formatting

The component automatically formats timestamps:

- **< 1 minute**: "now"
- **< 1 hour**: "Xm ago" (e.g., "5m ago")
- **< 24 hours**: "Xh ago" (e.g., "3h ago")
- **< 7 days**: "Xd ago" (e.g., "2d ago")
- **≥ 7 days**: Absolute date/time (e.g., "May 17, 10:30 AM")

## Animation

Messages animate in with:

- **Fade**: 200ms opacity transition
- **Slide**: 300ms vertical slide from bottom

Both animations respect `prefers-reduced-motion` preference.

## Examples

### Sent Message with Read Status

```svelte
<ChatMessage
  message={sentMessage}
  isCurrentUser={true}
  showTimestamp={true}
  showReadStatus={true}
  isRead={true}
/>
```

### Received Message Without Timestamp

```svelte
<ChatMessage
  message={receivedMessage}
  isCurrentUser={false}
  showTimestamp={false}
/>
```

### Message with Long Text

```svelte
<ChatMessage
  message={{
    id: 'msg-123',
    matchId: 'match-456',
    senderId: 'user-789',
    content: 'This is a much longer message that will wrap to multiple lines...',
    createdAt: new Date()
  }}
  isCurrentUser={true}
/>
```

### Message with Line Breaks

```svelte
<ChatMessage
  message={{
    id: 'msg-123',
    matchId: 'match-456',
    senderId: 'user-789',
    content: 'Line 1\nLine 2\nLine 3',
    createdAt: new Date()
  }}
  isCurrentUser={true}
/>
```

## Testing

The component includes comprehensive tests:

- **Unit Tests** (`ChatMessage.test.ts`): 50+ test cases covering functionality
- **Accessibility Tests** (`ChatMessage.a11y.test.ts`): WCAG 2.1 AA compliance
- **Mobile Tests** (`ChatMessage.mobile.test.ts`): Responsive design validation

Run tests with:

```bash
npm run test
```

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari 14+, Chrome Android)

## Performance

- **Bundle Size**: ~2KB (minified + gzipped)
- **Render Time**: < 1ms per message
- **Animation Performance**: 60fps on mobile devices

## Dark Mode

The component automatically adapts to dark mode:

```css
@media (prefers-color-scheme: dark) {
  /* Dark mode styles applied automatically */
}
```

## Keyboard Shortcuts

- **Tab**: Focus message bubble
- **Enter/Space**: Trigger keyboard event (for future interactions like reactions)
- **Shift+Tab**: Focus previous element

## Known Limitations

- Emoji rendering depends on system fonts
- Very long URLs may not wrap properly (consider truncating in parent)
- Read status only shown for sent messages

## Future Enhancements

- Message reactions (👍, ❤️, etc.)
- Message editing
- Message deletion
- Message forwarding
- Message search highlighting
- Typing indicators
- Message grouping by sender

## Related Components

- `ChatScreen`: Main chat interface
- `ChatInput`: Message input component
- `MatchOverlay`: Match notification overlay

## Contributing

When modifying this component:

1. Maintain WCAG 2.1 AA compliance
2. Test on mobile devices (375px, 480px, 768px)
3. Update tests for new features
4. Update this README
5. Run `npm run test` and `npm run lint`

## License

Part of the Verified Vibe dating app. All rights reserved.
