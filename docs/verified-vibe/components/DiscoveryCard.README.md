# DiscoveryCard Component

## Overview

The `DiscoveryCard` component displays a swipeable profile card for the discovery interface in Verified Vibe. It shows comprehensive profile information including photo, name, age, archetype, distance, about text, trust score, and verification badges.

## Features

- **Full-width, high-quality profile photo display** with lazy loading and async decoding
- **Profile information display**: name, age, archetype emoji, distance
- **About and looking for text** with conditional rendering
- **Trust score badge** with color-coded visual indicator
- **Verification badges** showing completed verification steps (ID, Liveness, Photos, Q&A)
- **Smooth animations and transitions** for all interactions
- **Keyboard navigation** support (Arrow keys, Enter, Backspace)
- **Full accessibility** (WCAG 2.1 AA compliance)
- **Mobile responsive** design (375px - 1024px+)
- **Touch-friendly** with 44px minimum touch targets

## Usage

```svelte
<script>
  import DiscoveryCard from '$lib/verified-vibe/components/DiscoveryCard.svelte';
  import type { DiscoveryProfile } from '$lib/verified-vibe/types';

  let profile: DiscoveryProfile = {
    id: 'user-123',
    gender: 'woman',
    archetype: 'spoilt_woman',
    firstName: 'Sarah',
    age: 26,
    city: 'Brooklyn, NY',
    avatar: 'https://example.com/photo.jpg',
    about: 'Love traveling and trying new restaurants',
    looking: 'Someone who appreciates the finer things',
    trustScore: 85,
    verified: ['id', 'photos', 'spending_or_qa'],
    distance: '2 mi',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  function handleLike() {
    console.log('User liked profile');
  }

  function handlePass() {
    console.log('User passed on profile');
  }
</script>

<DiscoveryCard
  {profile}
  onLike={handleLike}
  onPass={handlePass}
/>
```

## Props

### `profile` (required)
Type: `DiscoveryProfile`

The profile data to display. Must include:
- `id`: Unique profile identifier
- `firstName`: User's first name
- `age`: User's age
- `archetype`: Dating archetype (casual_man, marriage_minded_man, spoilt_woman, safety_first_woman)
- `avatar`: URL to profile photo (can be null)
- `about`: Bio/about text (can be null)
- `looking`: What they're looking for (can be null)
- `trustScore`: Trust score 0-100
- `verified`: Array of verified steps (id, liveness, photos, spending_or_qa)
- `distance`: Distance from user (e.g., "2 mi")
- `city`: User's city
- `gender`: User's gender
- `createdAt`: Account creation date
- `updatedAt`: Last update date

### `onLike` (optional)
Type: `() => void`

Callback function called when user clicks the Like button or presses Arrow Right/Enter.

### `onPass` (optional)
Type: `() => void`

Callback function called when user clicks the Pass button or presses Arrow Left/Backspace.

## Keyboard Navigation

- **Arrow Right** or **Enter**: Like the profile
- **Arrow Left** or **Backspace**: Pass on the profile
- **Tab**: Focus the card and buttons
- **Space**: Activate focused button

## Accessibility

The component is fully accessible with:
- Semantic HTML (`<article>` element)
- ARIA labels for all interactive elements
- Keyboard navigation support
- Screen reader support
- Focus indicators
- Color contrast compliance (WCAG 2.1 AA)
- Touch targets ≥ 44px on mobile

## Styling

The component uses CSS custom properties for theming:
- `--color-vibe-bg-1`, `--color-vibe-bg-2`, `--color-vibe-bg-3`: Background colors
- `--color-vibe-text-1`, `--color-vibe-text-2`, `--color-vibe-text-3`: Text colors
- `--color-vibe-border`: Border color
- `--color-vibe-emerald`, `--color-vibe-mint`, `--color-vibe-lime`, `--color-vibe-amber`: Accent colors
- `--radius-lg`, `--radius-md`: Border radius
- `--spacing-lg`, `--spacing-md`, `--spacing-sm`: Spacing units
- `--shadow-lg`, `--shadow-md`: Shadow effects
- `--transition-base`: Transition timing

## Responsive Behavior

### Mobile (375px - 767px)
- Photo aspect ratio: 1:1 (square)
- Reduced padding and spacing
- Smaller font sizes
- Button text hidden on very small screens (< 480px)
- Badge labels hidden on very small screens (< 480px)

### Tablet (768px - 1024px)
- Photo aspect ratio: 3:4 (portrait)
- Standard padding and spacing
- Full font sizes

### Desktop (1025px+)
- Max width: 400px
- Photo aspect ratio: 3:4 (portrait)
- Full styling

## Performance Optimizations

- **Lazy loading**: Images use `loading="lazy"` attribute
- **Async decoding**: Images use `decoding="async"` for non-blocking rendering
- **Will-change**: CSS optimization for animations
- **Transitions**: Smooth 200ms transitions with reduced-motion support

## Testing

The component includes comprehensive tests:
- **Unit tests** (`DiscoveryCard.test.ts`): 41 tests covering all functionality
- **Accessibility tests** (`DiscoveryCard.a11y.test.ts`): WCAG 2.1 AA compliance
- **Mobile tests** (`DiscoveryCard.mobile.test.ts`): Responsive design verification

Run tests with:
```bash
npm test DiscoveryCard.test.ts
npm test DiscoveryCard.a11y.test.ts
npm test DiscoveryCard.mobile.test.ts
```

## Integration with Discovery Screen

The component is used in the Discovery screen (`/src/routes/verified-vibe/discover/+page.svelte`):

```svelte
<div class="card-stack">
  {#if hasMoreCards && currentProfile}
    <DiscoveryCard
      profile={currentProfile}
      onLike={handleLike}
      onPass={handlePass}
    />
  {/if}
</div>
```

## Archetype Emojis

- `casual_man`: 🎯
- `marriage_minded_man`: 💍
- `spoilt_woman`: 💎
- `safety_first_woman`: 🛡️

## Verification Badges

- `id`: Government ID verified
- `liveness`: Liveness check passed
- `photos`: Photos verified
- `spending_or_qa`: Spending pattern or Q&A verified

## Trust Score Colors

- 0-20: Red (Very Low)
- 21-40: Orange (Low)
- 41-60: Amber (Medium)
- 61-80: Lime (High)
- 81-100: Emerald (Very High)

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari 14+, Chrome Android)

## Dependencies

- `lucide-svelte`: Icon library
- `svelte/transition`: Animation library
- `TrustScoreBadge`: Component for displaying trust score

## Related Components

- `UserProfileCard`: Similar component for trust dashboard
- `TrustScoreBadge`: Trust score visualization
- `VerificationStep`: Verification flow component

## Future Enhancements

- Photo carousel with multiple images
- Swipe gesture detection
- Animation on card exit
- Match overlay integration
- Block/report functionality
- Profile preview modal
