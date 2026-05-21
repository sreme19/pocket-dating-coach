# AIAssistantControls Component

## Overview

The `AIAssistantControls` component provides a user interface for activating and managing AI dating assistants (AI Bestie for women, AI Wingman for men). It displays contextual controls based on the user's gender and manages the activation/deactivation state.

## Features

- **Gender-based Assistant Selection**: Automatically shows the appropriate assistant based on user gender
  - Female users → AI Bestie (with heart icon, rose color)
  - Male users → AI Wingman (with shield icon, blue color)
  - Prefer not to say → No component rendered

- **Active Status Badge**: Visual indicator showing when an assistant is active
  - Animated pulse dot
  - "Active" label
  - Exchange count display (if applicable)

- **Configuration Dropdown**: Menu with options to:
  - Configure the assistant
  - Deactivate the assistant (only shown when active)

- **Responsive Design**:
  - Mobile: Stacked layout (flex-col)
  - Desktop: Inline layout (flex-row)
  - Full width on mobile, auto width on desktop

- **Loading States**: Shows spinners during activation/deactivation

- **Accessibility**: Keyboard navigation, proper button titles, semantic HTML

## Usage

### Basic Example

```svelte
<script lang="ts">
  import AIAssistantControls from '$lib/components/AIAssistantControls.svelte';
  import type { UserProfile, AssistantType } from '$lib/types';

  let userProfile: UserProfile | null = null;
  let activeAssistant: AssistantType | null = null;
  let isLoading = false;

  onMount(() => {
    const stored = localStorage.getItem('pdc_profile');
    if (stored) userProfile = JSON.parse(stored);
  });

  async function handleActivate(assistantType: AssistantType) {
    isLoading = true;
    try {
      const response = await fetch(`/api/ai-${assistantType}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: 'current-match-id' })
      });
      
      if (response.ok) {
        activeAssistant = assistantType;
      }
    } finally {
      isLoading = false;
    }
  }

  async function handleDeactivate() {
    isLoading = true;
    try {
      const response = await fetch(`/api/ai-${activeAssistant}/deactivate`, {
        method: 'POST'
      });
      
      if (response.ok) {
        activeAssistant = null;
      }
    } finally {
      isLoading = false;
    }
  }

  function handleConfigure() {
    // Navigate to configuration page
    window.location.href = '/ai-assistant-config';
  }
</script>

<AIAssistantControls
  bind:userProfile
  bind:activeAssistant
  {isLoading}
  onActivate={handleActivate}
  onDeactivate={handleDeactivate}
  onConfigure={handleConfigure}
  exchangeCount={5}
/>
```

### With Exchange Count

```svelte
<AIAssistantControls
  {userProfile}
  {activeAssistant}
  {isLoading}
  onActivate={handleActivate}
  onDeactivate={handleDeactivate}
  onConfigure={handleConfigure}
  exchangeCount={8}
/>
```

The exchange count is displayed in the active status badge as `(8)` to show the user how many exchanges have occurred in the current conversation.

## Props

### `userProfile` (bindable)
- **Type**: `UserProfile | null`
- **Required**: Yes
- **Description**: The current user's profile containing gender, age range, dating app, and relationship goal
- **Default**: `null`

### `activeAssistant` (bindable)
- **Type**: `AssistantType | null` (where `AssistantType = 'bestie' | 'wingman'`)
- **Required**: Yes
- **Description**: The currently active assistant type, or null if none is active
- **Default**: `null`

### `isLoading`
- **Type**: `boolean`
- **Required**: No
- **Description**: Whether the component is in a loading state (disables all buttons)
- **Default**: `false`

### `onActivate`
- **Type**: `(assistantType: AssistantType) => Promise<void>`
- **Required**: No
- **Description**: Callback function called when the user clicks the activation button
- **Example**: Calls API to activate the assistant

### `onDeactivate`
- **Type**: `() => Promise<void>`
- **Required**: No
- **Description**: Callback function called when the user clicks the deactivate option
- **Example**: Calls API to deactivate the assistant

### `onConfigure`
- **Type**: `() => void`
- **Required**: No
- **Description**: Callback function called when the user clicks the configure option
- **Example**: Navigates to configuration page

### `exchangeCount`
- **Type**: `number`
- **Required**: No
- **Description**: Number of exchanges in the current conversation (displayed in badge)
- **Default**: `0`

## Styling

The component uses Tailwind CSS classes and follows the project's design system:

- **Colors**:
  - AI Bestie: Rose/pink (`rose-600`, `rose-500/20`)
  - AI Wingman: Blue (`blue-600`, `blue-500/20`)
  - Inactive: Gray (`gray-700`, `gray-800`)

- **Responsive Breakpoints**:
  - Mobile: Default (no prefix)
  - Desktop: `md:` prefix (768px and up)

- **Custom Classes**:
  - `.bg-gray-750`: Custom gray color (rgb(31, 41, 55))

## Behavior

### Activation Flow

1. User clicks "Activate AI Bestie" or "Activate AI Wingman" button
2. Button shows loading spinner
3. `onActivate` callback is called with the assistant type
4. Upon success, `activeAssistant` is updated
5. Active status badge appears
6. Button becomes disabled (already active)

### Deactivation Flow

1. User clicks configuration button (gear icon)
2. Dropdown menu appears
3. User clicks "Deactivate AI Bestie" or "Deactivate AI Wingman"
4. Button shows loading spinner
5. `onDeactivate` callback is called
6. Upon success, `activeAssistant` is set to null
7. Active status badge disappears
8. Dropdown closes
9. Activation button becomes enabled again

### Configuration Flow

1. User clicks configuration button (gear icon)
2. Dropdown menu appears
3. User clicks "Configure Assistant"
4. `onConfigure` callback is called
5. Dropdown closes
6. Application navigates to configuration page

## Responsive Behavior

### Mobile (< 768px)

- Buttons stack vertically (flex-col)
- Full width buttons (w-full)
- Compact spacing (gap-3)
- Dropdown menu positioned absolutely below button

### Desktop (≥ 768px)

- Buttons display inline (flex-row)
- Auto width buttons (w-auto)
- Tighter spacing (gap-2)
- Dropdown menu positioned to the right

## Accessibility Features

- **Keyboard Navigation**: All buttons are keyboard accessible
- **Button Titles**: Configuration button has descriptive title
- **Loading Indicators**: Spinners provide visual feedback during async operations
- **Color Contrast**: All text meets WCAG AA standards
- **Semantic HTML**: Uses proper button elements with appropriate states

## Integration with Chat Page

To integrate this component into the chat page:

```svelte
<!-- In src/routes/chat/+page.svelte -->

<script lang="ts">
  import AIAssistantControls from '$lib/components/AIAssistantControls.svelte';
  // ... other imports
</script>

<!-- Add to chat header or message section -->
<div class="px-6 py-4 border-b border-gray-800">
  <div class="flex items-center justify-between gap-4">
    <div class="flex items-center gap-3">
      <Sparkles class="w-5 h-5 text-rose-400" />
      <div>
        <h1 class="font-semibold text-white">Ask Your Coach</h1>
        <p class="text-xs text-gray-500">Powered by your dating book</p>
      </div>
    </div>
    
    <!-- AI Assistant Controls -->
    <AIAssistantControls
      bind:userProfile
      bind:activeAssistant
      {isLoading}
      onActivate={handleActivate}
      onDeactivate={handleDeactivate}
      onConfigure={handleConfigure}
      {exchangeCount}
    />
  </div>
</div>
```

## Error Handling

The component itself doesn't handle errors, but the parent component should:

```svelte
<script lang="ts">
  let error: string | null = null;

  async function handleActivate(assistantType: AssistantType) {
    isLoading = true;
    error = null;
    try {
      const response = await fetch(`/api/ai-${assistantType}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: 'current-match-id' })
      });
      
      if (!response.ok) {
        error = 'Failed to activate assistant. Please try again.';
        return;
      }
      
      activeAssistant = assistantType;
    } catch (err) {
      error = 'An error occurred. Please try again.';
      console.error(err);
    } finally {
      isLoading = false;
    }
  }
</script>

{#if error}
  <div class="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
    {error}
  </div>
{/if}

<AIAssistantControls
  {userProfile}
  {activeAssistant}
  {isLoading}
  onActivate={handleActivate}
  onDeactivate={handleDeactivate}
  onConfigure={handleConfigure}
  {exchangeCount}
/>
```

## Testing

The component includes comprehensive unit tests covering:

- Assistant type determination based on user gender
- Active status display
- Button states and disabled conditions
- Callback handlers
- Responsive layout classes
- Visual indicators (colors, icons)
- Dropdown menu behavior
- Loading states
- Accessibility features

Run tests with:
```bash
npm test -- AIAssistantControls.test.ts
```

## Requirements Covered

This component implements the following requirements:

- **Requirement 1.1**: Display "Activate AI Bestie" button for female users
- **Requirement 2.1**: Display "Activate AI Wingman" button for male users
- **Requirement 9.1**: Display distinct visual indicator for active assistant
- **Requirement 9.2**: Show assistant type badge
- **Requirement 9.3**: Display active status clearly
- **Requirement 9.4**: Update visual indicators when assistant activated/deactivated
- **Requirement 14.1**: Mobile-friendly responsive layout
- **Requirement 14.2**: Desktop-friendly responsive layout

## Future Enhancements

- Add tooltip showing assistant description on hover
- Add animation when transitioning between active/inactive states
- Add keyboard shortcut for quick activation (e.g., Cmd+B for Bestie)
- Add confirmation dialog before deactivation
- Add assistant status indicator showing exchange count and rate limit warnings
