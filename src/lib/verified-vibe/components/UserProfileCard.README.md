# UserProfileCard Component

## Overview

The `UserProfileCard` component displays detailed user profiles with trust score badges, verification badges, and like/pass buttons. It's designed for the discovery feed and provides a comprehensive view of a user's profile information with prominent trust indicators.

## Features

- **Prominent Trust Score Badge**: Color-coded trust score display (0-100%)
- **Verification Badges**: Shows completed verification steps (ID, Liveness, Photos, Q&A)
- **Photo Display**: Profile photo with placeholder support
- **User Information**: Name, age, archetype, location, bio, and looking-for text
- **Trust Score Breakdown**: Detailed view of verification progress
- **Accessible Buttons**: Like and Pass buttons with proper ARIA labels
- **Mobile Responsive**: Optimized for 375px-1024px viewports
- **WCAG 2.1 AA Compliance**: Full accessibility support
- **Compact View**: Optional compact mode for space-constrained layouts

## Props

```typescript
interface Props {
  /** The user profile to display */
  profile: DiscoveryProfile;
  
  /** Callback when user clicks like button */
  onLike?: () => void;
  
  /** Callback when user clicks pass button */
  onPass?: () => void;
  
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

  let profile: DiscoveryProfile = {
    id: 'user-123',
    gender: 'woman',
    archetype: 'spoilt_woman',
    firstName: 'Sarah',
    age: 28,
    city: 'San Francisco',
    avatar: 'https://example.com/avatar.jpg',
    about: 'Love traveling and trying new restaurants',
    looking: 'Someone who appreciates the finer things',
    trustScore: 85,
    createdAt: new Date(),
    updatedAt: new Date(),
    distance: '5 mi',
    verified: ['id', 'liveness', 'photos'],
    likedUsers: []
  };

  function handleLike() {
    console.log('User liked profile');
  }

  function handlePass() {
    console.log('User passed on profile');
  }
</script>

<UserProfileCard
  {profile}
  onLike={handleLike}
  onPass={handlePass}
/>
```

### Compact View

```svelte
<UserProfileCard
  {profile}
  onLike={handleLike}
  onPass={handlePass}
  compact={true}
/>
```

### In Discovery Feed

```svelte
<script lang="ts">
  import UserProfileCard from '$lib/verified-vibe/components/UserProfileCard.svelte';
  import { matchingStore } from '$lib/verified-vibe/stores';

  async function handleLike(profileId: string) {
    const response = await fetch('/api/verified-vibe/like', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileId })
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.matched) {
        // Show match notification
      }
    }
  }

  async function handlePass(profileId: string) {
    await fetch('/api/verified-vibe/pass', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileId })
    });
  }
</script>

<div class="discovery-feed">
  {#each profiles as profile (profile.id)}
    <UserProfileCard
      {profile}
      onLike={() => handleLike(profile.id)}
      onPass={() => handlePass(profile.id)}
    />
  {/each}
</div>
```

## Data Structure

The component expects a `DiscoveryProfile` object with the following structure:

```typescript
interface DiscoveryProfile extends VerifiedVibeUser {
  distance: string;           // e.g., "5 mi"
  verified: string[];         // Array of completed verification steps
  trustScore: number;         // 0-100
}

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

## Verification Badges

The component displays verification badges for completed steps:

- **ID**: Government ID verification
- **Liveness**: Selfie/liveness check
- **Photos**: Photo consistency check
- **Q&A**: Spending/Q&A completion

Badges are displayed as small circular indicators with checkmarks. On mobile, only icons are shown; on larger screens, labels are included.

## Trust Score Display

The trust score badge is prominently displayed in the top-right corner of the profile photo. The badge includes:

- **Score Percentage**: 0-100%
- **Color Coding**: 
  - Red: 0-49% (Low Trust)
  - Yellow: 50-74% (Medium Trust)
  - Green: 75-100% (High Trust)
- **Label**: Human-readable trust level

In expanded view, a trust score breakdown shows:
- Identity verification progress
- Verification step count (e.g., "3/4 steps")

## Responsive Design

The component is fully responsive across all viewport sizes:

### Mobile (375px - 479px)
- Photo aspect ratio: 1:1
- Compact spacing
- Icon-only verification badges
- Smaller font sizes
- Touch-friendly button sizes (44px minimum)

### Tablet (480px - 767px)
- Photo aspect ratio: 3:4
- Medium spacing
- Verification badges with labels
- Standard font sizes

### Desktop (768px+)
- Photo aspect ratio: 3:4
- Generous spacing
- Full verification badge labels
- Maximum width: 400px

## Accessibility

The component is fully WCAG 2.1 AA compliant:

- **Semantic HTML**: Proper heading hierarchy, button roles
- **ARIA Labels**: All interactive elements have descriptive labels
- **Keyboard Navigation**: Full keyboard support with Tab navigation
- **Focus Management**: Visible focus indicators on all interactive elements
- **Color Contrast**: All text meets WCAG AA contrast requirements
- **Touch Targets**: All buttons have minimum 44px touch target size
- **Screen Reader Support**: Proper region labels and descriptions

### Keyboard Shortcuts

- **Tab**: Navigate between buttons
- **Enter/Space**: Activate buttons
- **Arrow Keys**: Navigate photo carousel (when implemented)

## Styling

The component uses CSS custom properties for theming:

```css
--color-vibe-bg-1: Primary background
--color-vibe-bg-2: Secondary background
--color-vibe-bg-3: Tertiary background
--color-vibe-text-1: Primary text
--color-vibe-text-2: Secondary text
--color-vibe-text-3: Tertiary text
--color-vibe-border: Border color
--color-vibe-lime: Success/verification color
--color-vibe-emerald: Primary accent color
--spacing-*: Spacing values
--radius-*: Border radius values
--shadow-*: Shadow values
--font-size-*: Font sizes
--font-weight-*: Font weights
--line-height-*: Line heights
--transition-base: Base transition
--gap-*: Gap values
```

## Performance Considerations

- **Image Lazy Loading**: Profile photos use `loading="lazy"` for performance
- **GPU Acceleration**: Animations use `transform` and `opacity` for smooth 60fps performance
- **Reduced Motion**: Respects `prefers-reduced-motion` for accessibility
- **Efficient Rendering**: Uses Svelte's reactive declarations for optimal updates

## Testing

The component includes 20+ comprehensive unit tests covering:

- Profile display (name, age, archetype, distance, bio, looking-for)
- Photo display and placeholder handling
- Trust score badge display and edge cases
- Verification badges for all combinations
- Action buttons (like/pass) and callbacks
- Trust score details and verification count
- Accessibility features and ARIA labels
- Responsive design across viewports
- Edge cases (missing fields, long text, age ranges)
- User interactions (clicks, keyboard, touch)
- Visual states (expanded, compact)

Run tests with:

```bash
npm run test -- UserProfileCard.test.ts
```

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari 14+, Chrome Android)

## Related Components

- **TrustScoreBadge**: Displays the trust score badge
- **DiscoveryFeed**: Container for multiple profile cards
- **LiveNowCarousel**: Alternative profile display format

## API Integration

The component is designed to work with the following API endpoints:

- **POST /api/verified-vibe/like**: Record a like action
- **POST /api/verified-vibe/pass**: Record a pass action
- **GET /api/verified-vibe/discovery-feed**: Fetch profiles for discovery

## Future Enhancements

- Photo carousel with multiple images
- Swipe gestures for like/pass
- Match notifications
- Profile preview modal
- Share profile functionality
- Report/block user options
- Compatibility score display
- Message button integration

## Troubleshooting

### Trust Score Not Displaying

Ensure the profile object includes a `trustScore` property (0-100).

### Verification Badges Not Showing

Check that the `verified` array includes valid step names: `'id'`, `'liveness'`, `'photos'`, `'spending_or_qa'`.

### Buttons Not Responding

Ensure `onLike` and `onPass` callbacks are properly defined. Check browser console for errors.

### Mobile Layout Issues

Verify viewport meta tag is set: `<meta name="viewport" content="width=device-width, initial-scale=1" />`

## License

Part of the Verified Vibe application. All rights reserved.
