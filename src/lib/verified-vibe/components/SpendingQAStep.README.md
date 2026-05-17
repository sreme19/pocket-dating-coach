# SpendingQAStep Component

## Overview

The `SpendingQAStep` component handles gender-specific spending and Q&A verification for the Verified Vibe verification flow. It presents users with tailored questions about their spending habits, lifestyle values, and dating intent based on their gender/archetype.

## Features

- **Gender-specific questions** (man, woman, prefer_not_to_say)
- **Multiple question types** (multiple-choice and text input)
- **Progressive question flow** with navigation
- **Review and edit functionality** before submission
- **Real-time response tracking** and persistence
- **Mobile responsive** (375px-1024px)
- **WCAG 2.1 AA accessibility** compliant
- **Error handling** with user-friendly messages
- **Loading states** during submission

## Usage

```svelte
<script>
  import SpendingQAStep from '$lib/verified-vibe/components/SpendingQAStep.svelte';

  async function handleSubmit(data) {
    // data.responses: Record<string, string | string[]>
    console.log('Responses:', data.responses);
  }

  function handleCancel() {
    console.log('User cancelled');
  }
</script>

<SpendingQAStep
  gender="woman"
  onSubmit={handleSubmit}
  onCancel={handleCancel}
/>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `gender` | `'man' \| 'woman' \| 'prefer_not_to_say'` | `'prefer_not_to_say'` | User's gender for question selection |
| `onSubmit` | `(data: { responses: Record<string, string \| string[]> }) => Promise<void>` | `undefined` | Callback when user submits responses |
| `onCancel` | `() => void` | `undefined` | Callback when user cancels |

## Gender-Specific Questions

### Man Archetype (5 questions)
1. **Spending Comfort** - Multiple choice about date spending level
2. **Dating Intent** - Multiple choice about relationship goals
3. **Lifestyle Values** - Text input about what matters
4. **Relationship Timeline** - Multiple choice about timing
5. **Deal Breakers** - Text input about non-negotiables

### Woman Archetype (5 questions)
1. **Date Expectations** - Multiple choice about date quality
2. **Partner Qualities** - Text input about ideal partner
3. **Dating Intent** - Multiple choice about relationship goals
4. **Lifestyle Values** - Text input about what matters
5. **Red Flags** - Text input about warning signs

### Prefer Not to Say (5 questions)
1. **Dating Intent** - Multiple choice about relationship goals
2. **Lifestyle Values** - Text input about what matters
3. **Partner Qualities** - Text input about ideal partner
4. **Spending Comfort** - Multiple choice about date spending
5. **Deal Breakers** - Text input about non-negotiables

## Component States

The component has 3 main states:

1. **questions** - User answers questions one at a time
2. **review** - User reviews all answers before submission
3. **submitting** - Responses are being submitted to server

## Question Types

### Multiple Choice
- User selects one option from 3-4 choices
- Visual feedback with selection highlight and checkmark
- Only one option can be selected at a time

### Text Input
- User types free-form response
- 500 character limit with live character counter
- Textarea with minimum 120px height

## Navigation

- **Next Button** - Moves to next question (disabled until current question answered)
- **Back Button** - Returns to previous question (disabled on first question)
- **Review Button** - Appears on last question to go to review
- **Edit Buttons** - In review view to edit specific answers
- **Cancel Button** - Cancels verification (only in questions view)

## Response Format

Responses are stored as a Record mapping question IDs to answers:

```typescript
{
  "spending_comfort": "generous",
  "dating_intent": "marriage",
  "lifestyle_values": "Travel and fitness",
  "relationship_timeline": "year",
  "deal_breakers": "Dishonesty and lack of ambition"
}
```

## API Endpoint

**POST** `/api/verified-vibe/verify-step`

Request:
```json
{
  "step": "spending_or_qa",
  "data": {
    "responses": {
      "spending_comfort": "generous",
      "dating_intent": "marriage",
      ...
    }
  }
}
```

Response:
```json
{
  "status": "completed",
  "data": {
    "responses": { ... },
    "trustPoints": 20
  }
}
```

## Validation

- All questions must be answered before submission
- Multiple choice questions require exactly one selection
- Text input questions require non-empty response
- Text input limited to 500 characters
- Error messages displayed for validation failures

## Accessibility

- Keyboard navigation support (Tab, Enter, Arrow keys)
- ARIA labels on all interactive elements
- Screen reader friendly with proper semantic HTML
- Focus management and visible focus indicators
- Error announcements with `role="alert"`
- Touch targets >= 44x44px
- Color contrast ratios meet WCAG AA standards
- Support for reduced motion preferences

## Mobile Responsive

- **Mobile (375px-767px)**: Single column layout, stacked buttons
- **Tablet (768px-1023px)**: Optimized spacing and layout
- **Desktop (1024px+)**: Full-width with max-width constraint

## Design Tokens

Uses Verified Vibe design tokens:
- `--color-vibe-emerald` - Primary accent (buttons, highlights)
- `--color-vibe-bg-1`, `--bg-2`, `--bg-3` - Background colors
- `--color-vibe-text-1`, `--text-2`, `--text-3` - Text colors
- `--color-vibe-border` - Border color
- `--radius-lg`, `--radius-md`, `--radius-sm` - Border radius
- `--spacing-*` - Spacing values
- `--gap-*` - Gap values

## Error Handling

Common errors:
- "Please answer this question before continuing"
- "Please answer all questions before submitting"
- "Failed to submit responses"

## Performance

- Efficient state management with Svelte reactivity
- Minimal re-renders
- No unnecessary API calls
- Optimized for mobile devices

## Testing

See `SpendingQAStep.test.ts` for comprehensive unit tests covering:
- Component rendering
- Gender-specific questions
- Multiple choice interactions
- Text input handling
- Navigation flow
- Review functionality
- Error handling
- Submission process
- Accessibility features
- Progress tracking
- Response persistence

## Related Components

- `VerificationStep.svelte` - ID extraction step
- `LivenessStep.svelte` - Liveness check step
- `PhotoUploadStep.svelte` - Photo upload step
- Verification flow in `/src/routes/verified-vibe/verification/+page.svelte`

## Integration Example

```svelte
<script>
  import SpendingQAStep from '$lib/verified-vibe/components/SpendingQAStep.svelte';
  import { addVerificationRecord, user } from '$lib/verified-vibe/stores';

  async function handleSubmit(data) {
    const response = await fetch('/api/verified-vibe/verify-step', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        step: 'spending_or_qa',
        data: data.responses
      })
    });

    const result = await response.json();
    
    addVerificationRecord({
      id: `${$user?.id}-spending_or_qa`,
      userId: $user?.id || '',
      step: 'spending_or_qa',
      status: 'completed',
      data: result.data,
      completedAt: new Date(),
      createdAt: new Date()
    });
  }

  function handleCancel() {
    // Navigate back or show confirmation
  }
</script>

<SpendingQAStep
  gender={$user?.gender}
  onSubmit={handleSubmit}
  onCancel={handleCancel}
/>
```

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari 14+, Chrome Android)

## Known Limitations

- Questions are fixed per gender (not customizable per user)
- No branching logic based on previous answers
- Text responses are not validated for content
- No spell-check or grammar suggestions

## Future Enhancements

- Conditional questions based on previous answers
- Custom question sets per archetype
- Response validation and suggestions
- Integration with trust score calculation
- Analytics on common responses
