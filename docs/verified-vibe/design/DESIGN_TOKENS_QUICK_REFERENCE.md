# Design Tokens Quick Reference

## Quick Start

### Using Color Tokens
```css
.button {
  background-color: var(--color-vibe-emerald);
  color: white;
}

.warning {
  background-color: var(--color-vibe-amber);
}

.success {
  background-color: var(--color-vibe-lime);
}
```

### Using Spacing Tokens
```css
.card {
  padding: var(--spacing-lg);
  margin-bottom: var(--spacing-xl);
  gap: var(--gap-md);
}
```

### Using Border Radius Tokens
```css
.button {
  border-radius: var(--radius-lg);
}

.avatar {
  border-radius: var(--radius-full);
}
```

### Using Font Tokens
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
```

### Using Shadow Tokens
```css
.card {
  box-shadow: var(--shadow-md);
}

.card:hover {
  box-shadow: var(--shadow-lg);
}
```

### Using Transition Tokens
```css
.button {
  transition: var(--transition-colors);
}

.button:hover {
  background-color: var(--color-vibe-mint);
}
```

## Token Cheat Sheet

### Colors
- **Primary:** `--color-vibe-emerald` (#10b981)
- **Secondary:** `--color-vibe-mint` (#14b8a6)
- **Success:** `--color-vibe-lime` (#84cc16)
- **Warning:** `--color-vibe-amber` (#f59e0b)
- **Background:** `--color-vibe-bg-1`, `--color-vibe-bg-2`, `--color-vibe-bg-3`
- **Text:** `--color-vibe-text-1`, `--color-vibe-text-2`, `--color-vibe-text-3`, `--color-vibe-text-4`
- **Border:** `--color-vibe-border`, `--color-vibe-border-light`

### Spacing
- **xs:** 4px | **sm:** 8px | **md:** 16px | **lg:** 24px
- **xl:** 32px | **2xl:** 40px | **3xl:** 48px | **4xl:** 64px

### Border Radius
- **sm:** 4px | **md:** 8px | **lg:** 12px | **xl:** 16px
- **2xl:** 24px | **3xl:** 32px | **full:** 9999px

### Font Size
- **xs:** 12px | **sm:** 14px | **base:** 16px | **lg:** 18px
- **xl:** 20px | **2xl:** 24px | **3xl:** 30px | **4xl:** 36px | **5xl:** 48px

### Font Weight
- **light:** 300 | **normal:** 400 | **medium:** 500
- **semibold:** 600 | **bold:** 700

### Shadows
- **sm:** Subtle | **md:** Standard | **lg:** Elevated
- **xl:** High elevation | **2xl:** Maximum elevation

### Transitions
- **fast:** 150ms | **base:** 200ms | **slow:** 300ms | **slower:** 500ms

## Common Patterns

### Button
```css
.btn {
  padding: var(--spacing-md) var(--spacing-lg);
  border-radius: var(--radius-lg);
  font-weight: var(--font-weight-semibold);
  transition: var(--transition-colors);
  background-color: var(--color-vibe-emerald);
  color: white;
}
```

### Card
```css
.card {
  background-color: var(--color-vibe-bg-1);
  border: 1px solid var(--color-vibe-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  box-shadow: var(--shadow-sm);
}
```

### Input
```css
.input {
  padding: var(--spacing-md);
  border: 1px solid var(--color-vibe-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  transition: var(--transition-colors);
}

.input:focus {
  border-color: var(--color-vibe-emerald);
}
```

### Badge
```css
.badge {
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  background-color: var(--color-vibe-lime);
}
```

## Dark Mode

All tokens automatically adapt to dark mode. No additional CSS needed!

```css
/* This works in both light and dark modes */
.card {
  background-color: var(--color-vibe-bg-1);
  color: var(--color-vibe-text-1);
  border-color: var(--color-vibe-border);
}
```

## Utility Classes

Pre-built utility classes available in `design-tokens.css`:

```html
<!-- Spacing -->
<div class="p-md m-lg gap-xl">Content</div>

<!-- Border Radius -->
<div class="rounded-lg">Card</div>
<div class="rounded-full">Avatar</div>

<!-- Font -->
<h1 class="text-4xl font-bold">Heading</h1>
<p class="text-base leading-normal">Body</p>

<!-- Shadow -->
<div class="shadow-md">Card</div>

<!-- Transition -->
<button class="transition-colors">Button</button>

<!-- Color -->
<div class="bg-vibe-emerald text-white">Success</div>
```

## Files

- **Main tokens:** `src/app.css` (120 CSS custom properties)
- **Extended tokens:** `src/lib/verified-vibe/design-tokens.css` (367 lines)
- **Full documentation:** `src/lib/verified-vibe/DESIGN_TOKENS.md`
- **Color reference:** `src/lib/verified-vibe/COLORS.md`

## Tips

1. Use semantic token names (e.g., `--color-vibe-emerald` for primary actions)
2. Always use tokens instead of hardcoding values
3. Test components in both light and dark modes
4. Use pre-built component patterns for consistency
5. Add new tokens to the system instead of using custom values

## Examples

### Complete Button Component
```svelte
<button class="btn-primary">Click me</button>

<style>
  .btn-primary {
    padding: var(--spacing-md) var(--spacing-lg);
    border-radius: var(--radius-lg);
    font-weight: var(--font-weight-semibold);
    background-color: var(--color-vibe-emerald);
    color: white;
    transition: var(--transition-colors);
    cursor: pointer;
    border: none;
  }

  .btn-primary:hover {
    background-color: #059669;
  }
</style>
```

### Complete Card Component
```svelte
<div class="card">
  <h2 class="card-title">Title</h2>
  <p class="card-content">Content</p>
</div>

<style>
  .card {
    background-color: var(--color-vibe-bg-1);
    border: 1px solid var(--color-vibe-border);
    border-radius: var(--radius-lg);
    padding: var(--spacing-lg);
    box-shadow: var(--shadow-sm);
  }

  .card-title {
    font-size: var(--font-size-xl);
    font-weight: var(--font-weight-semibold);
    color: var(--color-vibe-text-1);
    margin-bottom: var(--spacing-md);
  }

  .card-content {
    color: var(--color-vibe-text-2);
    line-height: var(--line-height-normal);
  }
</style>
```

## Need Help?

- See `DESIGN_TOKENS.md` for comprehensive documentation
- See `COLORS.md` for color palette details
- See `design-tokens.css` for utility classes and component patterns
