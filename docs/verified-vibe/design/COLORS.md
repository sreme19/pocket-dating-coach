# Verified Vibe Color Palette

This document describes the Verified Vibe color palette available in Tailwind CSS.

## Primary Accent Colors

These vibrant colors are used for interactive elements, buttons, and highlights:

- **Emerald** (`--color-vibe-emerald`): `#10b981` - Primary action color
- **Mint** (`--color-vibe-mint`): `#14b8a6` - Secondary action color
- **Lime** (`--color-vibe-lime`): `#84cc16` - Success/positive states
- **Amber** (`--color-vibe-amber`): `#f59e0b` - Warning/attention states

### Usage in Tailwind

```html
<!-- Background -->
<div class="bg-[var(--color-vibe-emerald)]">Emerald background</div>

<!-- Text -->
<p class="text-[var(--color-vibe-mint)]">Mint text</p>

<!-- Border -->
<div class="border-2 border-[var(--color-vibe-lime)]">Lime border</div>
```

## Background Colors

Light mode backgrounds with proper contrast:

- **bg-1** (`--color-vibe-bg-1`): `#ffffff` - Primary background (white)
- **bg-2** (`--color-vibe-bg-2`): `#f9fafb` - Secondary background (light gray)
- **bg-3** (`--color-vibe-bg-3`): `#f3f4f6` - Tertiary background (lighter gray)

Dark mode backgrounds:
- **bg-1**: `#111827` - Primary background (dark)
- **bg-2**: `#1f2937` - Secondary background (darker gray)
- **bg-3**: `#374151` - Tertiary background (medium gray)

### Usage

```html
<!-- Light mode -->
<div class="bg-[var(--color-vibe-bg-1)]">Main content area</div>
<div class="bg-[var(--color-vibe-bg-2)]">Card background</div>
<div class="bg-[var(--color-vibe-bg-3)]">Subtle background</div>
```

## Text Colors

Semantic text colors for readability:

- **text-1** (`--color-vibe-text-1`): `#111827` - Primary text (dark)
- **text-2** (`--color-vibe-text-2`): `#374151` - Secondary text (medium)
- **text-3** (`--color-vibe-text-3`): `#6b7280` - Tertiary text (light)
- **text-4** (`--color-vibe-text-4`): `#9ca3af` - Quaternary text (very light)

Dark mode text colors:
- **text-1**: `#f9fafb` - Primary text (light)
- **text-2**: `#e5e7eb` - Secondary text (medium light)
- **text-3**: `#d1d5db` - Tertiary text (medium)
- **text-4**: `#9ca3af` - Quaternary text (light gray)

### Usage

```html
<h1 class="text-[var(--color-vibe-text-1)]">Main heading</h1>
<p class="text-[var(--color-vibe-text-2)]">Body text</p>
<span class="text-[var(--color-vibe-text-3)]">Secondary text</span>
<small class="text-[var(--color-vibe-text-4)]">Hint text</small>
```

## Border Colors

Borders for UI elements:

- **border** (`--color-vibe-border`): `#e5e7eb` - Standard border
- **border-light** (`--color-vibe-border-light`): `#f3f4f6` - Subtle border

Dark mode borders:
- **border**: `#4b5563` - Standard border
- **border-light**: `#374151` - Subtle border

### Usage

```html
<div class="border border-[var(--color-vibe-border)]">Card with border</div>
<div class="border border-[var(--color-vibe-border-light)]">Subtle border</div>
```

## Dark Mode Support

All colors automatically adapt to dark mode using `prefers-color-scheme: dark` media query. No additional configuration needed.

```html
<!-- Automatically switches colors in dark mode -->
<div class="bg-[var(--color-vibe-bg-1)] text-[var(--color-vibe-text-1)]">
  Adapts to dark mode
</div>
```

## Component Examples

### Button with Emerald Accent

```svelte
<button class="bg-[var(--color-vibe-emerald)] text-white px-4 py-2 rounded">
  Action Button
</button>
```

### Card with Proper Contrast

```svelte
<div class="bg-[var(--color-vibe-bg-1)] border border-[var(--color-vibe-border)] rounded-lg p-4">
  <h3 class="text-[var(--color-vibe-text-1)] font-semibold">Card Title</h3>
  <p class="text-[var(--color-vibe-text-2)]">Card content goes here</p>
</div>
```

### Status Badge

```svelte
<!-- Success -->
<span class="bg-[var(--color-vibe-lime)] text-[var(--color-vibe-text-1)] px-2 py-1 rounded">
  Verified
</span>

<!-- Warning -->
<span class="bg-[var(--color-vibe-amber)] text-[var(--color-vibe-text-1)] px-2 py-1 rounded">
  Pending
</span>
```

## Accessibility Notes

- All text colors meet WCAG AA contrast requirements (4.5:1 minimum)
- Accent colors are vibrant and distinguishable
- Dark mode colors are optimized for reduced eye strain
- Use semantic color meanings (lime for success, amber for warning)

## Color Palette Reference

| Name | Light | Dark | Usage |
|------|-------|------|-------|
| Emerald | #10b981 | #10b981 | Primary actions |
| Mint | #14b8a6 | #14b8a6 | Secondary actions |
| Lime | #84cc16 | #84cc16 | Success states |
| Amber | #f59e0b | #f59e0b | Warning states |
| BG-1 | #ffffff | #111827 | Main background |
| BG-2 | #f9fafb | #1f2937 | Card background |
| BG-3 | #f3f4f6 | #374151 | Subtle background |
| Text-1 | #111827 | #f9fafb | Primary text |
| Text-2 | #374151 | #e5e7eb | Secondary text |
| Text-3 | #6b7280 | #d1d5db | Tertiary text |
| Text-4 | #9ca3af | #9ca3af | Quaternary text |
| Border | #e5e7eb | #4b5563 | Standard border |
| Border-Light | #f3f4f6 | #374151 | Subtle border |
