# Verified Vibe Design Tokens

This document provides a comprehensive guide to using CSS custom properties (design tokens) in the Verified Vibe design system.

## Overview

Design tokens are CSS custom properties that define the visual language of Verified Vibe. They ensure consistency across the application and make it easy to maintain and update the design system.

All tokens are defined in:
- **`src/app.css`** - Main tokens (colors, spacing, fonts, shadows, transitions)
- **`src/lib/verified-vibe/design-tokens.css`** - Extended tokens with utility classes and component patterns

## Token Categories

### 1. Color Tokens

Colors are organized by purpose and automatically adapt to light and dark modes.

#### Primary Accent Colors

Used for interactive elements and highlights:

```css
--color-vibe-emerald: #10b981;  /* Primary action color */
--color-vibe-mint: #14b8a6;     /* Secondary action color */
--color-vibe-lime: #84cc16;     /* Success/positive states */
--color-vibe-amber: #f59e0b;    /* Warning/attention states */
```

**Usage:**
```css
.button {
  background-color: var(--color-vibe-emerald);
}

.success-badge {
  background-color: var(--color-vibe-lime);
}

.warning-alert {
  background-color: var(--color-vibe-amber);
}
```

#### Background Colors

Light mode: `#ffffff`, `#f9fafb`, `#f3f4f6`  
Dark mode: `#111827`, `#1f2937`, `#374151`

```css
--color-vibe-bg-1: /* Primary background (main content area) */
--color-vibe-bg-2: /* Secondary background (cards, sections) */
--color-vibe-bg-3: /* Tertiary background (subtle areas) */
```

**Usage:**
```css
.page {
  background-color: var(--color-vibe-bg-1);
}

.card {
  background-color: var(--color-vibe-bg-2);
}

.subtle-section {
  background-color: var(--color-vibe-bg-3);
}
```

#### Text Colors

Light mode: `#111827`, `#374151`, `#6b7280`, `#9ca3af`  
Dark mode: `#f9fafb`, `#e5e7eb`, `#d1d5db`, `#9ca3af`

```css
--color-vibe-text-1: /* Primary text (headings, main content) */
--color-vibe-text-2: /* Secondary text (body text) */
--color-vibe-text-3: /* Tertiary text (secondary information) */
--color-vibe-text-4: /* Quaternary text (hints, disabled) */
```

**Usage:**
```css
h1 {
  color: var(--color-vibe-text-1);
}

p {
  color: var(--color-vibe-text-2);
}

.hint {
  color: var(--color-vibe-text-3);
}

.disabled {
  color: var(--color-vibe-text-4);
}
```

#### Border Colors

```css
--color-vibe-border: #e5e7eb;        /* Standard border */
--color-vibe-border-light: #f3f4f6;  /* Subtle border */
```

**Usage:**
```css
.card {
  border: 1px solid var(--color-vibe-border);
}

.subtle-divider {
  border-bottom: 1px solid var(--color-vibe-border-light);
}
```

### 2. Spacing Tokens

Consistent spacing scale for padding, margin, and gaps.

```css
--spacing-xs: 0.25rem;    /* 4px */
--spacing-sm: 0.5rem;     /* 8px */
--spacing-md: 1rem;       /* 16px */
--spacing-lg: 1.5rem;     /* 24px */
--spacing-xl: 2rem;       /* 32px */
--spacing-2xl: 2.5rem;    /* 40px */
--spacing-3xl: 3rem;      /* 48px */
--spacing-4xl: 4rem;      /* 64px */
```

**Usage:**
```css
/* Padding */
.button {
  padding: var(--spacing-md) var(--spacing-lg);
}

/* Margin */
.section {
  margin-bottom: var(--spacing-xl);
}

/* Gap in flexbox/grid */
.flex-container {
  display: flex;
  gap: var(--spacing-md);
}
```

### 3. Border Radius Tokens

Rounded corner scale for consistent shapes.

```css
--radius-none: 0;           /* No rounding */
--radius-sm: 0.25rem;       /* 4px */
--radius-md: 0.5rem;        /* 8px */
--radius-lg: 0.75rem;       /* 12px */
--radius-xl: 1rem;          /* 16px */
--radius-2xl: 1.5rem;       /* 24px */
--radius-3xl: 2rem;         /* 32px */
--radius-full: 9999px;      /* Fully rounded (pills, circles) */
```

**Usage:**
```css
.button {
  border-radius: var(--radius-lg);
}

.card {
  border-radius: var(--radius-xl);
}

.avatar {
  border-radius: var(--radius-full);
}

.pill-badge {
  border-radius: var(--radius-full);
}
```

### 4. Font Tokens

Typography scale and font properties.

#### Font Family

```css
--font-sans: 'Inter', system-ui, -apple-system, sans-serif;
--font-mono: 'Menlo', 'Monaco', 'Courier New', monospace;
```

#### Font Size

```css
--font-size-xs: 0.75rem;      /* 12px */
--font-size-sm: 0.875rem;     /* 14px */
--font-size-base: 1rem;       /* 16px */
--font-size-lg: 1.125rem;     /* 18px */
--font-size-xl: 1.25rem;      /* 20px */
--font-size-2xl: 1.5rem;      /* 24px */
--font-size-3xl: 1.875rem;    /* 30px */
--font-size-4xl: 2.25rem;     /* 36px */
--font-size-5xl: 3rem;        /* 48px */
```

#### Font Weight

```css
--font-weight-light: 300;
--font-weight-normal: 400;
--font-weight-medium: 500;
--font-weight-semibold: 600;
--font-weight-bold: 700;
```

#### Line Height

```css
--line-height-tight: 1.25;    /* Headings */
--line-height-normal: 1.5;    /* Body text */
--line-height-relaxed: 1.75;
--line-height-loose: 2;
```

#### Letter Spacing

```css
--letter-spacing-tight: -0.02em;
--letter-spacing-normal: 0;
--letter-spacing-wide: 0.02em;
```

**Usage:**
```css
h1 {
  font-size: var(--font-size-4xl);
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-tight);
}

p {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-normal);
  line-height: var(--line-height-normal);
}

.label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  letter-spacing: var(--letter-spacing-wide);
}

code {
  font-family: var(--font-mono);
}
```

### 5. Shadow Tokens

Elevation shadows for depth and layering.

```css
--shadow-none: none;
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
--shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
--shadow-2xl: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
--shadow-inset: inset 0 2px 4px 0 rgba(0, 0, 0, 0.05);
```

**Usage:**
```css
.card {
  box-shadow: var(--shadow-md);
}

.modal {
  box-shadow: var(--shadow-2xl);
}

.button:active {
  box-shadow: var(--shadow-inset);
}
```

### 6. Transition/Animation Tokens

Smooth animations and transitions.

#### Duration

```css
--duration-fast: 150ms;       /* Micro-interactions */
--duration-base: 200ms;       /* Default */
--duration-slow: 300ms;
--duration-slower: 500ms;
```

#### Timing Function

```css
--ease-linear: linear;
--ease-in: cubic-bezier(0.4, 0, 1, 1);
--ease-out: cubic-bezier(0, 0, 0.2, 1);
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
```

#### Pre-configured Transitions

```css
--transition-fast: all var(--duration-fast) var(--ease-in-out);
--transition-base: all var(--duration-base) var(--ease-in-out);
--transition-slow: all var(--duration-slow) var(--ease-in-out);
--transition-colors: color, background-color, border-color;
--transition-transform: transform;
--transition-opacity: opacity;
```

**Usage:**
```css
.button {
  transition: var(--transition-colors);
}

.button:hover {
  background-color: var(--color-vibe-mint);
}

.card {
  transition: var(--transition-base);
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

.fade-in {
  animation: fadeIn var(--duration-base) var(--ease-in-out);
}
```

## Component Patterns

Pre-built component patterns using design tokens:

### Button

```css
.btn-base {
  padding: var(--spacing-md) var(--spacing-lg);
  border-radius: var(--radius-lg);
  font-weight: var(--font-weight-semibold);
  font-size: var(--font-size-base);
  transition: var(--transition-colors);
  cursor: pointer;
  border: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--gap-sm);
}
```

### Card

```css
.card-base {
  background-color: var(--color-vibe-bg-1);
  border: 1px solid var(--color-vibe-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  box-shadow: var(--shadow-sm);
  transition: var(--transition-base);
}
```

### Input

```css
.input-base {
  padding: var(--spacing-md);
  border: 1px solid var(--color-vibe-border);
  border-radius: var(--radius-md);
  font-family: var(--font-sans);
  font-size: var(--font-size-base);
  background-color: var(--color-vibe-bg-1);
  color: var(--color-vibe-text-1);
  transition: var(--transition-colors);
}

.input-base:focus {
  outline: none;
  border-color: var(--color-vibe-emerald);
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
}
```

### Badge

```css
.badge-base {
  display: inline-flex;
  align-items: center;
  gap: var(--gap-xs);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
}
```

## Dark Mode Support

All tokens automatically adapt to dark mode using the `prefers-color-scheme: dark` media query. No additional configuration needed.

```css
/* Automatically switches in dark mode */
.card {
  background-color: var(--color-vibe-bg-1);
  color: var(--color-vibe-text-1);
  border-color: var(--color-vibe-border);
}
```

## Utility Classes

Pre-built utility classes for common patterns:

### Spacing
```html
<div class="p-md m-lg gap-xl">Content</div>
```

### Border Radius
```html
<div class="rounded-lg">Card</div>
<div class="rounded-full">Avatar</div>
```

### Font
```html
<h1 class="text-4xl font-bold">Heading</h1>
<p class="text-base font-normal leading-normal">Body text</p>
```

### Shadow
```html
<div class="shadow-md">Card with shadow</div>
<div class="shadow-lg">Elevated card</div>
```

### Transition
```html
<button class="transition-colors hover:bg-vibe-mint">Button</button>
```

### Color
```html
<div class="bg-vibe-emerald text-white">Success</div>
<div class="bg-vibe-amber text-vibe-text-1">Warning</div>
```

## Best Practices

1. **Always use tokens** - Never hardcode colors, spacing, or other design values
2. **Use semantic tokens** - Choose tokens based on purpose, not appearance
3. **Maintain consistency** - Use the same token for similar elements
4. **Test dark mode** - Verify all components work in both light and dark modes
5. **Document custom values** - If you need a custom value, add it to the token system
6. **Use component patterns** - Leverage pre-built patterns for consistency

## Adding New Tokens

To add new tokens:

1. Add the token to `:root` in `src/app.css`
2. Add dark mode override if needed in the `@media (prefers-color-scheme: dark)` block
3. Document the token in this file
4. Add utility classes if applicable in `design-tokens.css`

Example:

```css
:root {
  --spacing-5xl: 5rem;  /* 80px */
}

@media (prefers-color-scheme: dark) {
  :root {
    /* Dark mode overrides if needed */
  }
}
```

## Examples

### Complete Button Component

```svelte
<script>
  let variant = 'primary';
</script>

<button class="btn-base" class:btn-primary={variant === 'primary'} class:btn-secondary={variant === 'secondary'}>
  Click me
</button>

<style>
  .btn-base {
    padding: var(--spacing-md) var(--spacing-lg);
    border-radius: var(--radius-lg);
    font-weight: var(--font-weight-semibold);
    font-size: var(--font-size-base);
    transition: var(--transition-colors);
    cursor: pointer;
    border: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--gap-sm);
  }

  .btn-primary {
    background-color: var(--color-vibe-emerald);
    color: white;
  }

  .btn-primary:hover {
    background-color: #059669;
  }

  .btn-secondary {
    background-color: var(--color-vibe-bg-2);
    color: var(--color-vibe-text-1);
    border: 1px solid var(--color-vibe-border);
  }

  .btn-secondary:hover {
    background-color: var(--color-vibe-bg-3);
  }
</style>
```

### Complete Card Component

```svelte
<div class="card">
  <h2 class="card-title">Card Title</h2>
  <p class="card-content">Card content goes here</p>
</div>

<style>
  .card {
    background-color: var(--color-vibe-bg-1);
    border: 1px solid var(--color-vibe-border);
    border-radius: var(--radius-lg);
    padding: var(--spacing-lg);
    box-shadow: var(--shadow-sm);
    transition: var(--transition-base);
  }

  .card:hover {
    box-shadow: var(--shadow-md);
  }

  .card-title {
    font-size: var(--font-size-xl);
    font-weight: var(--font-weight-semibold);
    color: var(--color-vibe-text-1);
    margin-bottom: var(--spacing-md);
  }

  .card-content {
    font-size: var(--font-size-base);
    color: var(--color-vibe-text-2);
    line-height: var(--line-height-normal);
  }
</style>
```

## References

- [CSS Custom Properties (MDN)](https://developer.mozilla.org/en-US/docs/Web/CSS/--*)
- [Design Tokens (Design Systems)](https://www.designsystems.com/design-tokens/)
- [Tailwind CSS](https://tailwindcss.com/)
