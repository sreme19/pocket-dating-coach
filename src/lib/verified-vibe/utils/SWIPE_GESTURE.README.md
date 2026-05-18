# Swipe Gesture Handler

**Validates: Requirements 17 - Swipe Gesture Handling**

## Overview

The Swipe Gesture Handler provides comprehensive touch and mouse event handling for swipe detection in the discovery interface. It detects swipe left (pass) and swipe right (like) gestures with proper edge case handling.

## Features

- ✅ Touch and mouse event support
- ✅ Swipe direction detection (left/right)
- ✅ Diagonal swipe filtering
- ✅ Fast swipe detection with velocity calculation
- ✅ Configurable thresholds
- ✅ Progress tracking for visual feedback
- ✅ Comprehensive edge case handling

## Installation

The SwipeGestureHandler is available in `src/lib/verified-vibe/utils/swipeGesture.ts`.

```typescript
import { SwipeGestureHandler, createSwipeHandler } from '$lib/verified-vibe/utils/swipeGesture';
```

## Usage

### Basic Usage

```typescript
import { SwipeGestureHandler } from '$lib/verified-vibe/utils/swipeGesture';

// Create handler with default config
const handler = new SwipeGestureHandler();

// Start tracking on touch/mouse down
element.addEventListener('touchstart', (e) => handler.startSwipe(e));
element.addEventListener('mousedown', (e) => handler.startSwipe(e));

// Update position on touch/mouse move
element.addEventListener('touchmove', (e) => handler.updateSwipe(e));
element.addEventListener('mousemove', (e) => handler.updateSwipe(e));

// End swipe on touch/mouse up
element.addEventListener('touchend', (e) => {
  const swipeEvent = handler.endSwipe();
  if (swipeEvent) {
    if (swipeEvent.direction === 'right') {
      // Handle like
    } else {
      // Handle pass
    }
  }
});
element.addEventListener('mouseup', (e) => {
  const swipeEvent = handler.endSwipe();
  // Handle swipe
});
```

### With Custom Configuration

```typescript
const handler = new SwipeGestureHandler({
  threshold: 100,           // Minimum distance to trigger swipe (pixels)
  verticalThreshold: 50,    // Maximum vertical movement allowed (pixels)
  velocityThreshold: 0.5,   // Minimum velocity for fast swipe (pixels/ms)
  velocityWindow: 100       // Time window for velocity calculation (ms)
});
```

### Using Factory Function

```typescript
import { createSwipeHandler } from '$lib/verified-vibe/utils/swipeGesture';

const handler = createSwipeHandler({ threshold: 80 });
```

### Getting Progress During Swipe

```typescript
// Get current offset (pixels)
const offset = handler.getCurrentOffset();

// Get progress (0-1)
const progress = handler.getCurrentProgress();

// Check if currently tracking
const isActive = handler.isActive();
```

## SwipeEvent Properties

When a valid swipe is detected, the `endSwipe()` method returns a `SwipeEvent` object:

```typescript
interface SwipeEvent {
  direction: 'left' | 'right';  // Direction of swipe
  distance: number;              // Distance traveled (pixels)
  velocity: number;              // Velocity (pixels/ms)
  isFast: boolean;               // Whether this was a fast swipe
  startX: number;                // Starting X coordinate
  startY: number;                // Starting Y coordinate
  endX: number;                  // Ending X coordinate
  endY: number;                  // Ending Y coordinate
  duration: number;              // Duration of swipe (ms)
}
```

## Swipe Validation Rules

A swipe is considered valid if:

1. **Horizontal Movement**: Must have minimum horizontal movement (default: 50px)
2. **Vertical Movement**: Must not have too much vertical movement (default: 50px max)
3. **Duration**: Must complete within 1 second
4. **Direction**: Must be clearly left or right (not diagonal)

### Invalid Swipes

The following swipes are rejected:

- **Below Threshold**: Swipe distance < 50px
- **Diagonal**: Vertical movement > 50px
- **Too Slow**: Duration > 1000ms
- **Accidental**: Swipe that doesn't meet minimum requirements

## Velocity Calculation

Velocity is calculated as: `distance / duration` (pixels/ms)

Fast swipes are detected when velocity >= 0.5 pixels/ms (configurable).

### Examples

- **Fast Swipe**: 100px in 50ms = 2 pixels/ms (isFast: true)
- **Normal Swipe**: 100px in 200ms = 0.5 pixels/ms (isFast: true)
- **Slow Swipe**: 60px in 200ms = 0.3 pixels/ms (isFast: false)

## Integration with SwipeCard Component

The `SwipeCard` component uses the SwipeGestureHandler internally:

```svelte
<SwipeCard
  profile={profile}
  onLike={() => handleLike()}
  onPass={() => handlePass()}
  swipeThreshold={50}
/>
```

## Visual Feedback

The SwipeCard component provides:

- **Swipe Indicators**: Shows "❤️ Like" or "👎 Pass" during swipe
- **Progress Bar**: Visual progress bar at top of card
- **Card Transform**: Card rotates and translates during swipe
- **Opacity Change**: Card fades as swipe progresses

## Keyboard Support

The SwipeCard component supports keyboard navigation:

- **Arrow Right / Enter**: Like (swipe right)
- **Arrow Left / Backspace**: Pass (swipe left)

## Accessibility

- ✅ Keyboard navigation support
- ✅ Focus visible styles
- ✅ ARIA labels
- ✅ Semantic HTML
- ✅ Touch-friendly hit targets (44px minimum)

## Mobile Responsiveness

The gesture handler works seamlessly on:

- ✅ Touch devices (phones, tablets)
- ✅ Mouse devices (desktop)
- ✅ Hybrid devices (touch + mouse)

## Testing

Comprehensive test suite with 32+ tests covering:

- Touch event handling
- Mouse event handling
- Swipe direction detection
- Velocity calculation
- Edge cases (fast swipes, diagonal swipes)
- Custom configuration
- Progress tracking

Run tests:

```bash
npm run test -- src/lib/verified-vibe/utils/swipeGesture.test.ts
```

## Performance

- **Minimal Overhead**: Uses native event listeners
- **No Dependencies**: Pure TypeScript implementation
- **Efficient Calculations**: O(1) complexity for all operations
- **Memory Efficient**: Reusable handler instance

## Browser Support

- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

## API Reference

### SwipeGestureHandler

#### Constructor

```typescript
constructor(config?: SwipeConfig)
```

#### Methods

- `startSwipe(e: TouchEvent | MouseEvent): void` - Start tracking a swipe
- `updateSwipe(e: TouchEvent | MouseEvent): void` - Update swipe position
- `endSwipe(): SwipeEvent | null` - End swipe and return event if valid
- `getCurrentOffset(): number` - Get current swipe offset (pixels)
- `getCurrentProgress(): number` - Get current progress (0-1)
- `isActive(): boolean` - Check if currently tracking
- `reset(): void` - Reset handler state

### Factory Function

```typescript
createSwipeHandler(config?: SwipeConfig): SwipeGestureHandler
```

## Configuration

```typescript
interface SwipeConfig {
  threshold?: number;           // Default: 50
  verticalThreshold?: number;   // Default: 50
  velocityThreshold?: number;   // Default: 0.5
  velocityWindow?: number;      // Default: 100
}
```

## Examples

### Example 1: Basic Swipe Detection

```typescript
const handler = new SwipeGestureHandler();

element.addEventListener('touchstart', (e) => handler.startSwipe(e));
element.addEventListener('touchmove', (e) => handler.updateSwipe(e));
element.addEventListener('touchend', () => {
  const swipe = handler.endSwipe();
  if (swipe?.direction === 'right') {
    console.log('Liked!');
  } else if (swipe?.direction === 'left') {
    console.log('Passed!');
  }
});
```

### Example 2: Visual Feedback

```typescript
element.addEventListener('touchmove', (e) => {
  handler.updateSwipe(e);
  const progress = handler.getCurrentProgress();
  const offset = handler.getCurrentOffset();
  
  // Update visual feedback
  element.style.transform = `translateX(${offset}px)`;
  element.style.opacity = 1 - progress * 0.3;
});
```

### Example 3: Fast Swipe Detection

```typescript
const swipe = handler.endSwipe();
if (swipe?.isFast) {
  console.log('Fast swipe detected!');
  console.log(`Velocity: ${swipe.velocity} pixels/ms`);
}
```

## Troubleshooting

### Swipe Not Detected

- Check if swipe distance >= threshold (default: 50px)
- Verify vertical movement <= verticalThreshold (default: 50px)
- Ensure swipe completes within 1 second

### Diagonal Swipes Being Detected

- Reduce `verticalThreshold` to be more strict
- Default is 50px, try 30px or 20px

### Slow Swipes Not Detected

- Increase `velocityThreshold` if you want to detect slower swipes
- Default is 0.5 pixels/ms

## Performance Tips

1. **Reuse Handler**: Create one handler instance and reuse it
2. **Debounce Updates**: Avoid excessive DOM updates during swipe
3. **Use requestAnimationFrame**: For smooth animations
4. **Cleanup**: Call `reset()` when done with handler

## Related Components

- `SwipeCard.svelte`: Swipeable card component
- `DiscoveryCard.svelte`: Profile card display
- Discovery Feed: Main discovery interface

## Contributing

When modifying the swipe gesture handler:

1. Update tests in `swipeGesture.test.ts`
2. Maintain backward compatibility
3. Document configuration changes
4. Test on multiple devices

## License

Part of the Verified Vibe dating app refactor.
