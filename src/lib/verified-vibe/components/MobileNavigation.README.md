# MobileNavigation Component

## Overview

The `MobileNavigation` component provides a comprehensive mobile navigation system for the Verified Vibe application. It includes a top navigation bar with back button and hamburger menu, a bottom navigation bar for main sections, and full gesture support for swipe-based navigation.

## Features

### 1. **Bottom Navigation Bar**
- Three main navigation tabs: Discover, Trust, Chat
- Active tab highlighting with visual feedback
- Sticky positioning for easy access
- Mobile-optimized layout with icons and labels

### 2. **Top Navigation Bar**
- Back button for navigating to previous page
- Application title ("Verified Vibe")
- Hamburger menu button for additional options
- Sticky positioning for consistent access

### 3. **Hamburger Menu**
- Four additional menu items:
  - Trust Profile
  - Verification History
  - Trust Insights
  - Privacy & Data
- Smooth slide-in animation
- Click-outside detection to close menu
- Accessible menu structure

### 4. **Gesture Support**
- **Swipe Back**: Right swipe from left edge (< 50px) navigates back
- **Swipe Navigation**: Left/right swipes navigate between tabs
- Intelligent gesture detection with minimum distance thresholds
- Prevents accidental triggers with vertical movement detection

### 5. **Responsive Design**
- Supports mobile (375px), tablet (768px), and desktop (1024px+) viewports
- Three-column grid layout for bottom navigation
- Proper spacing and padding for all screen sizes
- Safe area insets for notched devices

### 6. **Accessibility (WCAG 2.1 AA)**
- Proper semantic HTML with navigation roles
- ARIA labels and attributes for all interactive elements
- Keyboard navigation support
- Screen reader support
- Color contrast compliance
- Respects `prefers-reduced-motion` preference

## Usage

### Basic Implementation

```svelte
<script lang="ts">
  import MobileNavigation from '$lib/verified-vibe/components/MobileNavigation.svelte';

  function handleNavigate() {
    console.log('Navigation occurred');
  }
</script>

<MobileNavigation onNavigate={handleNavigate} />
```

### With Props

```svelte
<MobileNavigation 
  onNavigate={() => {
    // Handle navigation
  }} 
/>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onNavigate` | `() => void` | `() => {}` | Callback function triggered when user navigates between tabs |

## Store Integration

The component uses the following Svelte stores:

### `currentTab`
- Type: `'discover' | 'trust' | 'chat'`
- Persisted to localStorage
- Updated when user clicks a navigation tab

### `currentPhase`
- Type: `'gate' | 'onboarding' | 'verification' | 'app'`
- Persisted to localStorage
- Controls visibility of bottom navigation (only shown in 'app' phase)

## Component Structure

```
MobileNavigation
├── Top Navigation Bar
│   ├── Back Button
│   ├── Title
│   └── Hamburger Menu Button
├── Hamburger Menu (conditional)
│   └── Menu Items
└── Bottom Navigation Bar (conditional, app phase only)
    ├── Discover Tab
    ├── Trust Tab
    └── Chat Tab
```

## Styling

The component uses CSS custom properties (design tokens) for consistent styling:

- **Colors**: `--color-vibe-*` variables
- **Spacing**: `--spacing-*` variables
- **Border Radius**: `--radius-*` variables
- **Transitions**: `--transition-*` variables

### CSS Classes

- `.mobile-navigation`: Main container
- `.mobile-topnav`: Top navigation bar
- `.mobile-bottomnav`: Bottom navigation bar
- `.mobile-menu`: Hamburger menu
- `.nav-item`: Navigation tab item
- `.nav-button`: Navigation button
- `.menu-item`: Menu item

## Gesture Handling

### Swipe Back Gesture
- **Trigger**: Right swipe from left edge (< 50px)
- **Action**: Calls `window.history.back()`
- **Minimum Distance**: 50px horizontal movement
- **Maximum Vertical Movement**: 50px

### Swipe Navigation Gesture
- **Trigger**: Left/right swipe in app phase
- **Action**: Navigates to adjacent tab
- **Minimum Distance**: 50px horizontal movement
- **Maximum Vertical Movement**: 50px
- **Boundaries**: Won't navigate past first or last tab

## Accessibility Features

### Keyboard Navigation
- Tab key navigates between interactive elements
- Enter/Space activates buttons
- Proper focus management

### Screen Reader Support
- Semantic HTML structure
- ARIA labels on all buttons
- Role attributes for navigation elements
- Proper heading hierarchy

### Visual Accessibility
- Color contrast ratio ≥ 4.5:1 for text
- Focus indicators on all interactive elements
- Respects `prefers-reduced-motion` media query
- Sufficient touch target size (≥ 44x44px)

## Mobile Responsive Breakpoints

| Breakpoint | Width | Layout |
|-----------|-------|--------|
| Mobile | 375px - 767px | Single column, full-width buttons |
| Tablet | 768px - 1023px | Optimized spacing |
| Desktop | 1024px+ | Full layout |

## Testing

The component includes 53 comprehensive unit tests covering:

- Bottom navigation bar rendering and interaction
- Hamburger menu functionality
- Back button functionality
- Gesture support (swipe back, swipe to navigate)
- Mobile responsive design
- Accessibility (WCAG 2.1 AA)
- Store management
- Navigation logic
- Edge cases

### Running Tests

```bash
npm test -- MobileNavigation.test.ts
```

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari 14+, Chrome Android)

## Performance Considerations

- Minimal re-renders using Svelte's reactivity
- Efficient event listener management
- CSS-based animations for smooth performance
- No external dependencies beyond Lucide icons

## Known Limitations

- Swipe gestures require touch support
- Back button depends on browser history
- Menu items navigate using `window.location.href`

## Future Enhancements

- [ ] Customizable menu items
- [ ] Animation preferences
- [ ] Custom navigation callbacks
- [ ] Badge support for notification counts
- [ ] Haptic feedback on mobile
- [ ] Swipe animation feedback

## Related Components

- `ArchetypeCard`: Archetype selection component
- `UserProfileCard`: User profile display component
- `TrustScoreBadge`: Trust score display component

## References

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Mobile Navigation Best Practices](https://www.nngroup.com/articles/mobile-navigation-patterns/)
- [Gesture Design Patterns](https://www.nngroup.com/articles/mobile-gestures/)
