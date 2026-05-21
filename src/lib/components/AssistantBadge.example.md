# AssistantBadge Component

A reusable badge component that displays AI assistant status with visual differentiation between AI Bestie and AI Wingman.

## Features

- **Visual Differentiation**: Color-coded badges (pink/rose for Bestie, blue for Wingman)
- **Icon Support**: Heart icon for Bestie, Shield icon for Wingman
- **Status Indicator**: Shows active/inactive status with pulse animation
- **Exchange Counter**: Displays the number of exchanges in the conversation
- **Tooltip**: Hover tooltip showing detailed status information
- **Multiple Variants**: Badge, pill, and compact variants for different use cases
- **Responsive Sizing**: Small, medium, and large size options
- **Accessibility**: Proper ARIA labels and semantic HTML

## Usage

### Basic Usage

```svelte
<script>
  import AssistantBadge from '$lib/components/AssistantBadge.svelte';
</script>

<!-- AI Bestie badge -->
<AssistantBadge assistantType="bestie" />

<!-- AI Wingman badge -->
<AssistantBadge assistantType="wingman" />
```

### With Status and Exchange Count

```svelte
<AssistantBadge 
  assistantType="bestie"
  status="active"
  exchangeCount={5}
/>
```

### Different Sizes

```svelte
<!-- Small -->
<AssistantBadge assistantType="bestie" size="sm" />

<!-- Medium (default) -->
<AssistantBadge assistantType="bestie" size="md" />

<!-- Large -->
<AssistantBadge assistantType="bestie" size="lg" />
```

### Different Variants

```svelte
<!-- Badge variant (default) - shows label and exchange count -->
<AssistantBadge assistantType="bestie" variant="badge" exchangeCount={3} />

<!-- Pill variant - similar to badge with slightly different padding -->
<AssistantBadge assistantType="bestie" variant="pill" exchangeCount={3} />

<!-- Compact variant - only shows icon, no label or count -->
<AssistantBadge assistantType="bestie" variant="compact" />
```

### Without Tooltip

```svelte
<AssistantBadge 
  assistantType="wingman"
  showTooltip={false}
/>
```

### Complete Example

```svelte
<script>
  import AssistantBadge from '$lib/components/AssistantBadge.svelte';
  
  let assistantType = 'bestie';
  let isActive = true;
  let exchanges = 7;
</script>

<div class="flex gap-4">
  <AssistantBadge 
    {assistantType}
    status={isActive ? 'active' : 'inactive'}
    exchangeCount={exchanges}
    size="md"
    variant="badge"
    showTooltip={true}
  />
</div>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `assistantType` | `'bestie' \| 'wingman'` | Required | The type of AI assistant |
| `status` | `'active' \| 'inactive'` | `'active'` | The current status of the assistant |
| `exchangeCount` | `number` | `0` | Number of exchanges in the conversation |
| `showTooltip` | `boolean` | `true` | Whether to show tooltip on hover |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Size of the badge |
| `variant` | `'badge' \| 'pill' \| 'compact'` | `'badge'` | Visual variant of the badge |

## Styling

### Color Scheme

**AI Bestie (Pink/Rose)**
- Background: `bg-rose-500/20`
- Text: `text-rose-300`
- Border: `border-rose-500/30`
- Pulse: `bg-rose-400`
- Tooltip: `bg-rose-900/90`

**AI Wingman (Blue)**
- Background: `bg-blue-500/20`
- Text: `text-blue-300`
- Border: `border-blue-500/30`
- Pulse: `bg-blue-400`
- Tooltip: `bg-blue-900/90`

### Size Classes

**Small (sm)**
- Badge: `px-2 py-1 text-xs`
- Icon: `w-3 h-3`

**Medium (md)**
- Badge: `px-3 py-1.5 text-sm`
- Icon: `w-4 h-4`

**Large (lg)**
- Badge: `px-4 py-2 text-base`
- Icon: `w-5 h-5`

## Accessibility

- Uses `role="status"` for screen readers
- Includes descriptive `aria-label` with assistant type, status, and exchange count
- Tooltip content is included in aria-label for accessibility
- Proper semantic HTML structure
- Keyboard accessible (hover states work with keyboard focus)

## Animation

- **Pulse Animation**: Active status shows a subtle pulse animation on the icon
- **Tooltip Animation**: Smooth fade-in animation when tooltip appears
- **Transitions**: Smooth color and opacity transitions

## Examples in Context

### In Chat Header

```svelte
<div class="flex items-center justify-between">
  <h2>Conversation with John</h2>
  <AssistantBadge 
    assistantType="bestie"
    status="active"
    exchangeCount={5}
    size="md"
  />
</div>
```

### In Message List

```svelte
{#each messages as message}
  <div class="flex gap-2">
    {#if message.assistantType}
      <AssistantBadge 
        assistantType={message.assistantType}
        status="active"
        size="sm"
        variant="compact"
      />
    {/if}
    <div>{message.content}</div>
  </div>
{/each}
```

### Multiple Badges

```svelte
<div class="flex gap-2">
  <AssistantBadge assistantType="bestie" status="active" exchangeCount={3} />
  <AssistantBadge assistantType="wingman" status="inactive" exchangeCount={0} />
</div>
```

## Testing

The component includes comprehensive unit tests covering:
- Rendering with different assistant types
- Color coding for each type
- Icon differentiation
- Tooltip functionality
- Size variants
- Visual variants
- Accessibility attributes
- Edge cases and integration scenarios

Run tests with:
```bash
npm test src/lib/components/AssistantBadge.test.ts
```

## Requirements Covered

- **Requirement 9.1**: Visual differentiation of AI assistants with distinct badges
- **Requirement 9.2**: Color coding (pink for Bestie, blue for Wingman)
- **Requirement 9.3**: Icon differentiation (heart for Bestie, shield for Wingman)
- **Requirement 9.4**: Tooltip with status and exchange count information
- **Requirement 14.1, 14.2**: Mobile and desktop responsiveness through size variants
