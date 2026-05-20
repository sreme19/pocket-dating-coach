# MatchOverlay Component

## Overview

The `MatchOverlay` component displays a celebratory overlay when a mutual match occurs in the Verified Vibe dating app. It shows the matched profile with a larger photo, name, age, location, and provides "Send Message" and "Close" buttons for user actions.

## Features

- ✨ **Celebratory Animation**: Animated heart icon and confetti effects
- 📸 **Profile Display**: Large profile photo with fallback placeholder
- 🎯 **Clear Actions**: "Send Message" and "Keep Discovering" buttons
- 📱 **Mobile Responsive**: Full-screen on mobile, centered modal on desktop
- ♿ **Accessible**: WCAG 2.1 AA compliant with proper ARIA attributes
- ⌨️ **Keyboard Support**: Escape key to close, full keyboard navigation
- 🎨 **Smooth Animations**: Fade, scale, and slide transitions
- 🌙 **Dark Mode**: Full dark mode support with design tokens

## Usage

### Basic Example

```svelte
<script lang="ts">
  import MatchOverlay from '$lib/verified-vibe/components/MatchOverlay.svelte';
  import type { VerifiedVibeUser } from '$lib/verified-vibe/types';

  let matchedProfile: VerifiedVibeUser = {
    id: 'user-456',
    gender: 'woman',
    archetype: 'spoilt_woman',
    firstName: 'Sarah',
    age: 26,
    city: 'Brooklyn, NY',
    avatar: 'https://example.com/photo.jpg',
    about: 'Love traveling and trying new restaurants',
    looking: 'Someone who appreciates the finer things',
    trustScore: 85,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  function handleSendMessage() {
    // Navigate to chat
    goto('/verified-vibe/chat');
  }

  function handleClose() {
    // Return to discovery
    showMatchOverlay = false;
  }
</script>

<MatchOverlay
  profile={matchedProfile}
  onSendMessage={handleSendMessage}
  onClose={handleClose}
/>
```

### With Store Integration

```svelte
<script lang="ts">
  import MatchOverlay from '$lib/verified-vibe/components/MatchOverlay.svelte';
  import { goto } from '$app/navigation';
  import { currentTab, setCurrentMatch } from '$lib/verified-vibe/stores';

  let showMatchOverlay = $state(false);
  let matchedProfile = $state(null);

  function handleLike(profile) {
    // Check for mutual match (in real app, this comes from API)
    if (isMutualMatch(profile)) {
      matchedProfile = profile;
      showMatchOverlay = true;
    }
  }

  function handleSendMessage() {
    showMatchOverlay = false;
    setCurrentMatch(matchId, matchedProfile);
    currentTab.set('chat');
    goto('/verified-vibe/chat');
  }

  function handleClose() {
    showMatchOverlay = false;
    // Continue discovering
  }
</script>

{#if showMatchOverlay && matchedProfile}
  <MatchOverlay
    profile={matchedProfile}
    onSendMessage={handleSendMessage}
    onClose={handleClose}
  />
{/if}
```

## Props

### `profile` (required)

Type: `VerifiedVibeUser`

The matched profile to display in the overlay.

```typescript
interface VerifiedVibeUser {
  id: string;
  gender: Gender;
  archetype: Archetype;
  firstName: string;
  age: number;
  city: string;
  avatar: string | null;
  about: string | null;
  looking: string | null;
  trustScore: number;
  createdAt: Date;
  updatedAt: Date;
}
```

### `onSendMessage` (optional)

Type: `() => void`

Callback function triggered when the user clicks the "Send Message" button. Typically used to navigate to the chat screen.

```svelte
<MatchOverlay
  profile={matchedProfile}
  onSendMessage={() => goto('/verified-vibe/chat')}
/>
```

### `onClose` (optional)

Type: `() => void`

Callback function triggered when the user clicks the "Close" button or presses Escape. Typically used to hide the overlay and return to discovery.

```svelte
<MatchOverlay
  profile={matchedProfile}
  onClose={() => showMatchOverlay = false}
/>
```

## Behavior

### Display

- Shows matched profile with large photo (200x200px on desktop, 160x160px on mobile)
- Displays profile name, age, and location
- Shows profile about text if available
- Displays trust score badge
- Shows celebratory message: "It's a Match! You and [Name] liked each other"

### Animations

- **Fade In**: Overlay fades in over 300ms
- **Slide Up**: Modal slides up from bottom over 400ms
- **Scale**: Profile photo scales in over 500ms with 200ms delay
- **Bounce**: Heart icon bounces on load
- **Confetti**: Animated confetti falls from top over 3s
- **Ring Pulse**: Decorative ring around photo pulses continuously

### Interactions

- **Send Message Button**: Calls `onSendMessage` callback
- **Keep Discovering Button**: Calls `onClose` callback
- **Close Button**: Calls `onClose` callback
- **Escape Key**: Calls `onClose` callback
- **Backdrop Click**: Calls `onClose` callback (clicking outside modal)
- **Modal Click**: Does nothing (prevents accidental close)

### Responsive Behavior

| Viewport | Layout | Photo Size | Modal Width |
|----------|--------|-----------|-------------|
| Mobile (375px) | Full-screen | 160x160px | 100% |
| Small Mobile (480px) | Full-screen | 160x160px | 100% |
| Tablet (768px) | Centered | 180x180px | 450px |
| Desktop (1024px+) | Centered | 200x200px | 500px |

## Accessibility

### WCAG 2.1 AA Compliance

- ✅ Proper heading hierarchy (h2 for title, h3 for profile name)
- ✅ Semantic HTML (dialog role, button elements)
- ✅ ARIA attributes (aria-modal, aria-labelledby, aria-label)
- ✅ Keyboard navigation (Tab, Escape)
- ✅ Focus management (focus trap within modal)
- ✅ Color contrast (4.5:1 minimum)
- ✅ Touch targets (44x44px minimum)
- ✅ Screen reader support (alt text, descriptive labels)

### Keyboard Support

| Key | Action |
|-----|--------|
| Tab | Navigate between buttons |
| Enter | Activate focused button |
| Escape | Close overlay |

### Screen Reader Announcements

- Dialog role announces "Match notification"
- Title announces "It's a Match!"
- Buttons have descriptive labels
- Profile photo has descriptive alt text
- Decorative elements marked as aria-hidden

## Styling

### CSS Variables Used

```css
--color-vibe-bg-1          /* Modal background */
--color-vibe-bg-2          /* Button backgrounds */
--color-vibe-bg-3          /* Hover backgrounds */
--color-vibe-border        /* Border color */
--color-vibe-text-1        /* Primary text */
--color-vibe-text-2        /* Secondary text */
--color-vibe-text-3        /* Tertiary text */
--color-vibe-emerald       /* Primary action color */
--color-vibe-emerald-bright /* Hover state */
--spacing-lg               /* Large spacing */
--spacing-md               /* Medium spacing */
--spacing-sm               /* Small spacing */
--radius-xl                /* Large border radius */
--radius-lg                /* Medium border radius */
--shadow-xl                /* Large shadow */
--shadow-lg                /* Medium shadow */
--shadow-md                /* Small shadow */
--gap-lg                   /* Large gap */
--gap-md                   /* Medium gap */
--gap-sm                   /* Small gap */
--font-size-2xl            /* Extra large text */
--font-size-xl             /* Large text */
--font-size-base           /* Base text */
--font-size-sm             /* Small text */
--font-weight-bold         /* Bold weight */
--font-weight-semibold     /* Semibold weight */
```

### Dark Mode

The component automatically adapts to dark mode using CSS custom properties. No additional configuration needed.

## Testing

### Unit Tests

```bash
npm run test -- MatchOverlay.test.ts
```

Tests cover:
- Profile data display
- Photo display and placeholders
- Button functionality
- Keyboard navigation
- Callbacks
- Edge cases

### Accessibility Tests

```bash
npm run test -- MatchOverlay.a11y.test.ts
```

Tests cover:
- WCAG 2.1 AA compliance
- Semantic HTML
- ARIA attributes
- Keyboard navigation
- Screen reader support
- Color contrast

### Mobile Tests

```bash
npm run test -- MatchOverlay.mobile.test.ts
```

Tests cover:
- Responsive layout (375px, 480px, 768px)
- Touch interactions
- Mobile-specific styling
- Orientation changes
- Performance

## Performance

### Optimization Techniques

- **Lazy Loading**: Profile photo uses `loading="eager"` for immediate display
- **Will-change**: CSS will-change hints for animated elements
- **Reduced Motion**: Respects `prefers-reduced-motion` media query
- **Efficient Animations**: Uses CSS transitions and keyframes
- **No Jank**: Smooth 60fps animations

### Metrics

- **Render Time**: < 100ms
- **Animation Duration**: 300-600ms
- **Confetti Duration**: 3s
- **File Size**: ~8KB (minified)

## Integration Examples

### In Discovery Screen

```svelte
<script lang="ts">
  import DiscoveryCard from './DiscoveryCard.svelte';
  import MatchOverlay from './MatchOverlay.svelte';

  let showMatchOverlay = $state(false);
  let matchedProfile = $state(null);

  async function handleLike(profile) {
    const response = await fetch('/api/verified-vibe/like', {
      method: 'POST',
      body: JSON.stringify({ profileId: profile.id })
    });

    const { matched, matchId } = await response.json();

    if (matched) {
      matchedProfile = profile;
      showMatchOverlay = true;
    }
  }
</script>

<div class="discover-screen">
  <DiscoveryCard
    profile={currentProfile}
    onLike={() => handleLike(currentProfile)}
  />

  {#if showMatchOverlay && matchedProfile}
    <MatchOverlay
      profile={matchedProfile}
      onSendMessage={() => goto('/verified-vibe/chat')}
      onClose={() => showMatchOverlay = false}
    />
  {/if}
</div>
```

### With Notifications

```svelte
<script lang="ts">
  import MatchOverlay from './MatchOverlay.svelte';
  import { addNotification } from '$lib/verified-vibe/stores';

  function handleSendMessage() {
    addNotification({
      id: crypto.randomUUID(),
      userId: currentUser.id,
      type: 'match',
      status: 'unread',
      title: 'New Match!',
      body: `You matched with ${matchedProfile.firstName}`,
      data: {
        matchId,
        userId: matchedProfile.id,
        userPhoto: matchedProfile.avatar,
        userName: matchedProfile.firstName,
        actionUrl: '/verified-vibe/chat'
      },
      createdAt: new Date()
    });

    goto('/verified-vibe/chat');
  }
</script>

<MatchOverlay
  profile={matchedProfile}
  onSendMessage={handleSendMessage}
  onClose={() => showMatchOverlay = false}
/>
```

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari 14+, Chrome Android 90+)

## Known Limitations

- Confetti animation may be disabled on devices with `prefers-reduced-motion` enabled
- Photo ring animation respects `prefers-reduced-motion`
- Very long profile names may wrap on small screens

## Future Enhancements

- [ ] Add sound effect on match
- [ ] Add haptic feedback on mobile
- [ ] Add profile preview on hover (desktop)
- [ ] Add share match functionality
- [ ] Add match history view
- [ ] Add animated profile transitions

## Related Components

- `DiscoveryCard` - Profile card for discovery screen
- `ChatMessage` - Individual message in chat
- `TrustScoreBadge` - Trust score display
- `UserProfileCard` - User profile display

## Troubleshooting

### Overlay not showing

- Ensure `profile` prop is provided
- Check that `showMatchOverlay` state is true
- Verify component is rendered in correct location

### Animations not playing

- Check `prefers-reduced-motion` setting
- Verify CSS is loaded correctly
- Check browser console for errors

### Buttons not responding

- Ensure callbacks are provided
- Check that `isAnimating` state is not stuck
- Verify event listeners are attached

### Mobile layout issues

- Check viewport meta tag is set correctly
- Verify CSS media queries are working
- Test on actual mobile device

## Contributing

When modifying this component:

1. Update tests to cover new functionality
2. Ensure WCAG 2.1 AA compliance
3. Test on mobile devices
4. Update this README with changes
5. Run full test suite before committing

## License

Part of the Verified Vibe dating app refactor project.
