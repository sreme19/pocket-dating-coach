# Verified Vibe Design Tokens & Utility Classes Guide

This guide documents all the design tokens and utility classes available in the Verified Vibe design system.

## Table of Contents

1. [Design Tokens (CSS Variables)](#design-tokens-css-variables)
2. [Spacing Utilities](#spacing-utilities)
3. [Border Radius Utilities](#border-radius-utilities)
4. [Font Utilities](#font-utilities)
5. [Shadow Utilities](#shadow-utilities)
6. [Transition Utilities](#transition-utilities)
7. [Color Utilities](#color-utilities)
8. [Component Patterns](#component-patterns)
9. [Layout Utilities](#layout-utilities)
10. [Responsive Utilities](#responsive-utilities)
11. [Dark Mode Support](#dark-mode-support)

---

## Design Tokens (CSS Variables)

All design tokens are defined as CSS custom properties and automatically adapt to dark mode.

### Color Tokens

#### Primary Accent Colors
- `--color-vibe-emerald`: #10b981 (Primary action color)
- `--color-vibe-mint`: #14b8a6 (Secondary action color)
- `--color-vibe-lime`: #84cc16 (Success/positive states)
- `--color-vibe-amber`: #f59e0b (Warning/attention states)

#### Background Colors (Light Mode)
- `--color-vibe-bg-1`: #ffffff (Primary background)
- `--color-vibe-bg-2`: #f9fafb (Secondary background)
- `--color-vibe-bg-3`: #f3f4f6 (Tertiary background)

#### Text Colors (Light Mode)
- `--color-vibe-text-1`: #111827 (Primary text)
- `--color-vibe-text-2`: #374151 (Secondary text)
- `--color-vibe-text-3`: #6b7280 (Tertiary text)
- `--color-vibe-text-4`: #9ca3af (Quaternary text)

#### Border Colors (Light Mode)
- `--color-vibe-border`: #e5e7eb (Standard border)
- `--color-vibe-border-light`: #f3f4f6 (Subtle border)

### Spacing Tokens

All spacing tokens follow a consistent scale:

```
--spacing-xs:   0.25rem (4px)
--spacing-sm:   0.5rem  (8px)
--spacing-md:   1rem    (16px)
--spacing-lg:   1.5rem  (24px)
--spacing-xl:   2rem    (32px)
--spacing-2xl:  2.5rem  (40px)
--spacing-3xl:  3rem    (48px)
--spacing-4xl:  4rem    (64px)
```

Same scale applies to:
- `--margin-*`
- `--gap-*`

### Border Radius Tokens

```
--radius-none:   0
--radius-sm:     0.25rem (4px)
--radius-md:     0.5rem  (8px)
--radius-lg:     0.75rem (12px)
--radius-xl:     1rem    (16px)
--radius-2xl:    1.5rem  (24px)
--radius-3xl:    2rem    (32px)
--radius-full:   9999px  (Fully rounded)
```

### Font Tokens

#### Font Families
- `--font-sans`: 'Inter', system-ui, -apple-system, sans-serif
- `--font-mono`: 'Menlo', 'Monaco', 'Courier New', monospace

#### Font Sizes
```
--font-size-xs:    0.75rem  (12px)
--font-size-sm:    0.875rem (14px)
--font-size-base:  1rem     (16px)
--font-size-lg:    1.125rem (18px)
--font-size-xl:    1.25rem  (20px)
--font-size-2xl:   1.5rem   (24px)
--font-size-3xl:   1.875rem (30px)
--font-size-4xl:   2.25rem  (36px)
--font-size-5xl:   3rem     (48px)
```

#### Font Weights
```
--font-weight-light:     300
--font-weight-normal:    400
--font-weight-medium:    500
--font-weight-semibold:  600
--font-weight-bold:      700
```

#### Line Heights
```
--line-height-tight:    1.25
--line-height-normal:   1.5
--line-height-relaxed:  1.75
--line-height-loose:    2
```

#### Letter Spacing
```
--letter-spacing-tight:   -0.02em
--letter-spacing-normal:  0
--letter-spacing-wide:    0.02em
```

### Shadow Tokens

```
--shadow-none:   none
--shadow-sm:     0 1px 2px 0 rgba(0, 0, 0, 0.05)
--shadow-md:     0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)
--shadow-lg:     0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)
--shadow-xl:     0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)
--shadow-2xl:    0 25px 50px -12px rgba(0, 0, 0, 0.25)
--shadow-inset:  inset 0 2px 4px 0 rgba(0, 0, 0, 0.05)
```

### Transition Tokens

#### Durations
```
--duration-fast:    150ms
--duration-base:    200ms
--duration-slow:    300ms
--duration-slower:  500ms
```

#### Timing Functions
```
--ease-linear:    linear
--ease-in:        cubic-bezier(0.4, 0, 1, 1)
--ease-out:       cubic-bezier(0, 0, 0.2, 1)
--ease-in-out:    cubic-bezier(0.4, 0, 0.2, 1)
```

#### Pre-configured Transitions
```
--transition-fast:       all 150ms cubic-bezier(0.4, 0, 0.2, 1)
--transition-base:       all 200ms cubic-bezier(0.4, 0, 0.2, 1)
--transition-slow:       all 300ms cubic-bezier(0.4, 0, 0.2, 1)
--transition-colors:     color, background-color, border-color (200ms)
--transition-transform:  transform (200ms)
--transition-opacity:    opacity (200ms)
```

---

## Spacing Utilities

### Padding Utilities

```css
.p-xs, .p-sm, .p-md, .p-lg, .p-xl, .p-2xl, .p-3xl, .p-4xl
```

### Margin Utilities

```css
.m-xs, .m-sm, .m-md, .m-lg, .m-xl, .m-2xl, .m-3xl, .m-4xl
```

### Gap Utilities

```css
.gap-xs, .gap-sm, .gap-md, .gap-lg, .gap-xl, .gap-2xl, .gap-3xl, .gap-4xl
```

### Directional Padding

```css
/* Top, Bottom, Left, Right */
.pt-xs, .pt-sm, .pt-md, .pt-lg, .pt-xl
.pb-xs, .pb-sm, .pb-md, .pb-lg, .pb-xl
.pl-xs, .pl-sm, .pl-md, .pl-lg, .pl-xl
.pr-xs, .pr-sm, .pr-md, .pr-lg, .pr-xl

/* Horizontal and Vertical */
.px-xs, .px-sm, .px-md, .px-lg, .px-xl
.py-xs, .py-sm, .py-md, .py-lg, .py-xl
```

### Directional Margin

```css
/* Top, Bottom, Left, Right */
.mt-xs, .mt-sm, .mt-md, .mt-lg, .mt-xl
.mb-xs, .mb-sm, .mb-md, .mb-lg, .mb-xl
.ml-xs, .ml-sm, .ml-md, .ml-lg, .ml-xl
.mr-xs, .mr-sm, .mr-md, .mr-lg, .mr-xl

/* Horizontal and Vertical */
.mx-xs, .mx-sm, .mx-md, .mx-lg, .mx-xl
.my-xs, .my-sm, .my-md, .my-lg, .my-xl
```

---

## Border Radius Utilities

### Standard Border Radius

```css
.rounded-none, .rounded-sm, .rounded-md, .rounded-lg, .rounded-xl, .rounded-2xl, .rounded-3xl, .rounded-full
```

### Directional Border Radius

```css
/* Top */
.rounded-t-sm, .rounded-t-md, .rounded-t-lg

/* Bottom */
.rounded-b-sm, .rounded-b-md, .rounded-b-lg

/* Left */
.rounded-l-sm, .rounded-l-md, .rounded-l-lg

/* Right */
.rounded-r-sm, .rounded-r-md, .rounded-r-lg
```

---

## Font Utilities

### Font Family

```css
.font-sans, .font-mono
```

### Font Size

```css
.text-xs, .text-sm, .text-base, .text-lg, .text-xl, .text-2xl, .text-3xl, .text-4xl, .text-5xl
```

### Font Weight

```css
.font-light, .font-normal, .font-medium, .font-semibold, .font-bold
```

### Line Height

```css
.leading-tight, .leading-normal, .leading-relaxed, .leading-loose
```

### Letter Spacing

```css
.tracking-tight, .tracking-normal, .tracking-wide
```

### Heading Styles

Pre-configured heading styles with appropriate font size, weight, and line height:

```css
.heading-h1  /* 48px, bold, tight line-height */
.heading-h2  /* 36px, bold, tight line-height */
.heading-h3  /* 30px, semibold, tight line-height */
.heading-h4  /* 24px, semibold, tight line-height */
.heading-h5  /* 20px, semibold, normal line-height */
.heading-h6  /* 18px, semibold, normal line-height */
```

### Body Text Styles

```css
.body-lg    /* 18px, relaxed line-height */
.body-base  /* 16px, normal line-height */
.body-sm    /* 14px, normal line-height */
.caption    /* 12px, light gray text */
```

---

## Shadow Utilities

### Elevation Shadows

```css
.shadow-none, .shadow-sm, .shadow-md, .shadow-lg, .shadow-xl, .shadow-2xl, .shadow-inset
```

### Interactive Shadows

```css
.shadow-hover   /* Applies shadow on hover */
.shadow-active  /* Applies inset shadow on active */
```

---

## Transition Utilities

### Basic Transitions

```css
.transition-fast      /* 150ms all properties */
.transition-base      /* 200ms all properties */
.transition-slow      /* 300ms all properties */
```

### Property-Specific Transitions

```css
.transition-colors    /* Color, background-color, border-color */
.transition-transform /* Transform property */
.transition-opacity   /* Opacity property */
.transition-shadow    /* Box-shadow property */
.transition-all       /* All properties */
```

---

## Color Utilities

### Background Colors

#### Solid Colors
```css
.bg-vibe-emerald, .bg-vibe-mint, .bg-vibe-lime, .bg-vibe-amber
.bg-vibe-bg-1, .bg-vibe-bg-2, .bg-vibe-bg-3
```

#### Light Variants
```css
.bg-vibe-emerald-light, .bg-vibe-emerald-lighter
.bg-vibe-mint-light, .bg-vibe-lime-light, .bg-vibe-amber-light
```

### Text Colors

#### Solid Colors
```css
.text-vibe-emerald, .text-vibe-mint, .text-vibe-lime, .text-vibe-amber
.text-vibe-text-1, .text-vibe-text-2, .text-vibe-text-3, .text-vibe-text-4
```

#### Light Variants
```css
.text-vibe-emerald-light, .text-vibe-mint-light, .text-vibe-lime-light, .text-vibe-amber-light
```

### Border Colors

```css
.border-vibe-border, .border-vibe-border-light
```

---

## Component Patterns

### Button Component

#### Base Pattern
```css
.btn-base  /* Padding, border-radius, font-weight, cursor, flexbox */
```

#### Button Variants
```css
.btn-primary    /* Emerald background, white text */
.btn-secondary  /* Light background, dark text, border */
.btn-ghost      /* Transparent background, emerald text */
.btn-danger     /* Red background, white text */
```

#### Button Sizes
```css
.btn-sm     /* Small padding and font size */
.btn-lg     /* Large padding and font size */
```

#### Button States
```css
.btn-disabled  /* Reduced opacity, not clickable */
.btn-full      /* Full width */
```

**Example Usage:**
```html
<button class="btn-base btn-primary btn-lg">Click Me</button>
<button class="btn-base btn-secondary">Secondary</button>
<button class="btn-base btn-ghost btn-sm">Ghost</button>
```

### Card Component

#### Base Pattern
```css
.card-base  /* Background, border, border-radius, padding, shadow */
```

#### Card Variants
```css
.card-elevated    /* Larger shadow */
.card-interactive /* Cursor pointer, hover effects */
.card-sm          /* Smaller padding and border-radius */
.card-lg          /* Larger padding and border-radius */
.card-bordered    /* Thicker border */
.card-accent      /* Left border accent in emerald */
```

**Example Usage:**
```html
<div class="card-base card-interactive">
  <h3 class="heading-h3">Card Title</h3>
  <p class="body-base">Card content goes here</p>
</div>
```

### Input Component

#### Base Pattern
```css
.input-base  /* Padding, border, border-radius, font, background, color */
```

#### Input Sizes
```css
.input-sm   /* Small padding and font size */
.input-lg   /* Large padding and font size */
```

#### Input States
```css
.input-error     /* Red border, red focus shadow */
.input-success   /* Green border, green focus shadow */
.input-disabled  /* Gray background, reduced opacity */
```

**Example Usage:**
```html
<input type="text" class="input-base" placeholder="Enter text">
<input type="text" class="input-base input-error" placeholder="Error state">
<input type="text" class="input-base input-disabled" disabled>
```

### Badge Component

#### Base Pattern
```css
.badge-base  /* Inline-flex, padding, border-radius, font-size, font-weight */
```

#### Badge Variants
```css
.badge-primary   /* Light emerald background, emerald text */
.badge-success   /* Light green background, green text */
.badge-warning   /* Light amber background, amber text */
.badge-danger    /* Light red background, red text */
.badge-neutral   /* Gray background, gray text */
```

#### Badge Sizes
```css
.badge-lg  /* Larger padding and font size */
```

**Example Usage:**
```html
<span class="badge-base badge-primary">Primary</span>
<span class="badge-base badge-success badge-lg">Success</span>
```

---

## Layout Utilities

### Flexbox Utilities

```css
.flex-center      /* Centered flex container */
.flex-between     /* Space-between flex container */
.flex-col         /* Flex column direction */
.flex-col-center  /* Centered flex column */
```

### Grid Utilities

```css
.grid-cols-2, .grid-cols-3, .grid-cols-4  /* Grid with 2, 3, or 4 columns */
```

---

## Responsive Utilities

### Mobile Utilities (max-width: 767px)

```css
.hidden-mobile      /* Hide on mobile */
.btn-full-mobile    /* Full width button on mobile */
.p-mobile-md        /* Medium padding on mobile */
.gap-mobile-md      /* Medium gap on mobile */
```

### Tablet Utilities (min-width: 768px)

```css
.hidden-tablet           /* Hide on tablet */
.grid-cols-2-tablet      /* 2-column grid on tablet */
```

### Desktop Utilities (min-width: 1024px)

```css
.hidden-desktop          /* Hide on desktop */
.grid-cols-3-desktop     /* 3-column grid on desktop */
.grid-cols-4-desktop     /* 4-column grid on desktop */
```

---

## Dark Mode Support

All utilities automatically adapt to dark mode via the `prefers-color-scheme: dark` media query.

### Dark Mode Changes

1. **Background Colors**: Inverted (light → dark)
2. **Text Colors**: Inverted (dark → light)
3. **Border Colors**: Adjusted for dark backgrounds
4. **Shadows**: More prominent in dark mode

### Example

```css
/* Light mode */
.card-base {
  background-color: var(--color-vibe-bg-1);  /* White */
  color: var(--color-vibe-text-1);           /* Dark gray */
}

/* Dark mode (automatic) */
@media (prefers-color-scheme: dark) {
  :root {
    --color-vibe-bg-1: #111827;    /* Dark gray */
    --color-vibe-text-1: #f9fafb;  /* White */
  }
}
```

---

## Usage Examples

### Complete Button Example

```html
<!-- Primary button -->
<button class="btn-base btn-primary btn-lg p-md rounded-lg">
  Get Started
</button>

<!-- Secondary button with hover effect -->
<button class="btn-base btn-secondary shadow-hover transition-base">
  Learn More
</button>

<!-- Disabled button -->
<button class="btn-base btn-primary btn-disabled">
  Disabled
</button>
```

### Complete Card Example

```html
<div class="card-base card-interactive card-lg rounded-xl shadow-md">
  <div class="flex-between mb-lg">
    <h3 class="heading-h3">Profile Card</h3>
    <span class="badge-base badge-primary">Verified</span>
  </div>
  
  <p class="body-base text-vibe-text-2 mb-md">
    This is a profile card with all the design tokens applied.
  </p>
  
  <div class="flex-center gap-md mt-lg">
    <button class="btn-base btn-primary btn-sm">View Profile</button>
    <button class="btn-base btn-secondary btn-sm">Message</button>
  </div>
</div>
```

### Responsive Grid Example

```html
<div class="grid-cols-1 gap-md">
  <!-- Mobile: 1 column -->
  <!-- Tablet: 2 columns -->
  <!-- Desktop: 3 columns -->
  
  <div class="card-base grid-cols-2-tablet grid-cols-3-desktop">
    <!-- Content -->
  </div>
</div>
```

---

## Best Practices

1. **Use Design Tokens**: Always use CSS variables instead of hardcoding values
2. **Consistent Spacing**: Use the spacing scale for all margins and padding
3. **Color Consistency**: Use the vibe color palette for all colors
4. **Responsive Design**: Use responsive utilities for mobile-first design
5. **Dark Mode**: Test all components in both light and dark modes
6. **Accessibility**: Ensure sufficient color contrast and touch targets (44x44px minimum)
7. **Performance**: Use utility classes instead of custom CSS when possible

---

## Maintenance

When updating design tokens:

1. Update the CSS variables in `:root`
2. Update dark mode overrides in `@media (prefers-color-scheme: dark)`
3. Update utility classes that depend on the tokens
4. Test in both light and dark modes
5. Update this documentation

---

## Support

For questions or issues with design tokens, please refer to:
- Design document: `/src/lib/verified-vibe/design.md`
- Component examples: `/src/lib/verified-vibe/components/`
- Tailwind config: `/tailwind.config.ts`
