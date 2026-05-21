# AIAssistantSetupWizard Component

A comprehensive multi-step wizard component that guides new users through the setup process for AI Bestie or AI Wingman.

## Overview

The setup wizard provides a smooth onboarding experience for first-time users, walking them through:
1. **Privacy Notice & Consent** - Explain data usage and require acknowledgment
2. **Profile Data Import or Creation** - Allow users to import existing data or start fresh
3. **Preferences/Personality Setup** - Guide users through setting up their profile
4. **Confirmation & Activation** - Show summary and activate the assistant

## Features

- **Multi-step wizard interface** with progress indicator
- **Mobile-responsive design** that works on all devices
- **Support for both AI Bestie and AI Wingman** with appropriate labels and colors
- **Step validation** - prevents moving forward without completing required steps
- **Navigation controls** - next/previous buttons with proper state management
- **Error handling** - displays user-friendly error messages
- **Success feedback** - confirms when setup is complete
- **Cancel functionality** - allows users to exit the wizard with confirmation

## Usage

### Basic Usage

```svelte
<script>
  import AIAssistantSetupWizard from '$lib/components/AIAssistantSetupWizard.svelte';

  async function handleComplete(assistantType) {
    // Activate the assistant
    console.log(`${assistantType} activated!`);
  }

  function handleCancel() {
    // Close the wizard
    console.log('Setup cancelled');
  }
</script>

<AIAssistantSetupWizard
  assistantType="bestie"
  onComplete={handleComplete}
  onCancel={handleCancel}
/>
```

### For AI Wingman

```svelte
<AIAssistantSetupWizard
  assistantType="wingman"
  onComplete={handleComplete}
  onCancel={handleCancel}
/>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `assistantType` | `'bestie' \| 'wingman'` | `'bestie'` | The type of AI assistant being set up |
| `onComplete` | `(assistantType: AssistantType) => Promise<void>` | `undefined` | Callback when setup is completed |
| `onCancel` | `() => void` | `undefined` | Callback when user cancels the wizard |

## Step Details

### Step 1: Privacy Notice and Consent

- Displays privacy notice explaining data usage
- Shows what data is sent to Claude AI
- Explains data storage in Supabase
- Describes privacy protections
- Requires checkbox acknowledgment before proceeding
- Includes "I Agree & Activate" and "Cancel" buttons

### Step 2: Profile Data Import or Creation

- Presents two options: "Create New" or "Import Existing"
- If importing, shows textarea for pasting profile data
- Displays info box explaining the purpose of preferences/personality
- Validates that a choice is made before proceeding

### Step 3: Preferences/Personality Setup

- For AI Bestie: Shows PreferencesEditor component
- For AI Wingman: Shows PersonalityEditor component
- Allows users to set up their profile with guided fields
- Requires saving before proceeding to next step

### Step 4: Confirmation and Activation

- Shows summary of completed setup steps
- Displays next steps for using the assistant
- Includes "Activate [Assistant]" button
- Shows success message after activation

## Styling

The component uses:
- **Rose/Pink colors** for AI Bestie (rose-400, rose-500, rose-600)
- **Blue colors** for AI Wingman (blue-400, blue-500, blue-600)
- **Tailwind CSS** for responsive design
- **Lucide icons** for visual indicators
- **Dark theme** matching the application's design system

## Responsive Design

- **Mobile**: Stacked layout, full-width buttons
- **Tablet**: Optimized spacing and touch targets
- **Desktop**: Centered max-width container (max-w-2xl)

## Accessibility

- Proper heading hierarchy (h1, h2)
- Descriptive button labels
- Form labels for all inputs
- Keyboard navigation support
- ARIA labels where appropriate
- Color contrast meets WCAG standards

## Error Handling

The component handles:
- Failed setup completion (displays error message)
- Network errors (user-friendly error display)
- Validation errors (prevents proceeding without required data)
- Graceful error recovery (allows retry)

## State Management

The component manages:
- Current step (1-4)
- Privacy acknowledgment status
- Profile data choice (create/import)
- Setup completion status
- Loading states
- Error messages
- Success feedback

## Integration

The component integrates with:
- `PrivacySettings` - for privacy notice and consent
- `PreferencesEditor` - for female user profile setup
- `PersonalityEditor` - for male user profile setup
- Lucide icons - for visual indicators

## Example: Full Integration

```svelte
<script>
  import AIAssistantSetupWizard from '$lib/components/AIAssistantSetupWizard.svelte';
  import { goto } from '$app/navigation';

  let showWizard = false;
  let selectedAssistantType = 'bestie';

  async function handleSetupComplete(assistantType) {
    // Save setup completion to database
    const response = await fetch('/api/ai-assistant/setup-complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assistantType })
    });

    if (response.ok) {
      showWizard = false;
      // Redirect to chat page
      await goto('/chat');
    }
  }

  function handleCancel() {
    showWizard = false;
  }
</script>

{#if showWizard}
  <AIAssistantSetupWizard
    assistantType={selectedAssistantType}
    onComplete={handleSetupComplete}
    onCancel={handleCancel}
  />
{:else}
  <button onclick={() => (showWizard = true)}>
    Start Setup
  </button>
{/if}
```

## Testing

The component includes comprehensive tests for:
- Component rendering
- Step navigation
- Privacy acknowledgment
- Profile data selection
- Error handling
- Mobile responsiveness
- Accessibility

Run tests with:
```bash
npm run test -- AIAssistantSetupWizard.test.ts
```

## Requirements Met

This component satisfies the following requirements:
- **Requirement 1.1**: Displays privacy notice for AI Bestie
- **Requirement 2.1**: Displays privacy notice for AI Wingman
- **Requirement 15.1**: Shows privacy notice explaining data usage
- **Requirement 15.2**: Requires user consent before activation
- **Requirement 14.1**: Mobile-responsive design
- **Requirement 14.2**: Desktop-responsive design

## Notes

- The wizard is designed for first-time users but can be reused for reconfiguration
- All steps are required; users cannot skip steps
- The wizard validates input before allowing progression
- Progress is not saved between sessions; users must complete in one session
- The component is self-contained and doesn't require external state management
