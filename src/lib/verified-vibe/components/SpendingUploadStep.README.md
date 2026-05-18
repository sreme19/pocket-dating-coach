# SpendingUploadStep Component

## Overview

The `SpendingUploadStep` component handles spending verification for men in the Verified Vibe verification flow. It allows users to upload a bank statement or spending screenshot, which is then analyzed by Claude AI to verify credible spending patterns.

## Features

- **File upload** with drag-and-drop support
- **File validation** (size, type)
- **Image preview** before submission
- **Claude AI analysis** of spending patterns
- **Mobile responsive** (375px-1024px)
- **WCAG 2.1 AA accessibility** compliant
- **Error handling** with user-friendly messages
- **Loading states** during submission

## Usage

```svelte
<script>
  import SpendingUploadStep from '$lib/verified-vibe/components/SpendingUploadStep.svelte';

  async function handleSubmit(data) {
    // data.spendingImage: base64-encoded image
    // data.mimeType: image MIME type (e.g., 'image/jpeg')
    console.log('Spending image:', data.spendingImage);
    console.log('MIME type:', data.mimeType);
  }

  function handleCancel() {
    console.log('User cancelled');
  }
</script>

<SpendingUploadStep
  onSubmit={handleSubmit}
  onCancel={handleCancel}
/>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onSubmit` | `(data: { spendingImage: string; mimeType: string }) => Promise<void>` | `undefined` | Callback when user submits spending image |
| `onCancel` | `() => void` | `undefined` | Callback when user cancels |

## Component States

The component has 3 main states:

1. **upload** - User selects and uploads a file
2. **review** - User reviews the uploaded image before submission
3. **submitting** - Image is being analyzed by Claude

## File Validation

### Accepted File Types
- JPEG (image/jpeg)
- PNG (image/png)
- WebP (image/webp)

### File Size Limit
- Maximum: 10MB

### Validation Errors
- "File is too large. Maximum size is 10MB."
- "Invalid file type. Please upload a JPEG, PNG, or WebP image."

## Upload Information

The component displays helpful information about what to upload:
- Bank statement screenshot (last 3 months)
- Credit card statement
- Payment app screenshot (Venmo, PayPal, etc.)
- Any proof of spending pattern

## Response Format

The `onSubmit` callback receives:

```typescript
{
  spendingImage: string;  // Base64-encoded image data
  mimeType: string;       // Image MIME type (e.g., 'image/jpeg')
}
```

## API Endpoint

**POST** `/api/verified-vibe/verify-step`

Request:
```json
{
  "step": "spending_or_qa",
  "data": {
    "spendingImage": "base64-encoded-image",
    "mimeType": "image/jpeg",
    "gender": "man"
  }
}
```

Response:
```json
{
  "status": "completed",
  "data": {
    "type": "spending",
    "credible": true,
    "confidence": 85,
    "reasoning": "Bank statement shows consistent spending pattern..."
  },
  "trustPoints": 10
}
```

## Claude Analysis

The component sends the spending image to Claude for analysis. Claude evaluates:

1. **Legitimacy** - Is this a real bank statement or spending record?
2. **Authenticity** - Does the spending pattern appear genuine?
3. **Red flags** - Are there signs of manipulation or fraud?
4. **Credibility** - Overall confidence score (0-100)

Claude returns:
- `credible`: boolean indicating if spending is credible
- `confidence`: confidence score (0-100)
- `reasoning`: explanation of the assessment

## Error Handling

Common errors:
- "File is too large. Maximum size is 10MB."
- "Invalid file type. Please upload a JPEG, PNG, or WebP image."
- "Failed to submit spending image. Please try again."
- "Service temporarily unavailable. Please try again."

## Accessibility

- Keyboard navigation support (Tab, Enter, Space)
- ARIA labels on all interactive elements
- Screen reader friendly with proper semantic HTML
- Focus management and visible focus indicators
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

## Performance

- Efficient state management with Svelte reactivity
- Minimal re-renders
- No unnecessary API calls
- Optimized for mobile devices
- Base64 encoding done client-side

## Testing

See `SpendingUploadStep.test.ts` for comprehensive unit tests covering:
- Component rendering
- File upload and validation
- File size and type validation
- Preview functionality
- Error handling
- Submission process
- Accessibility features
- Mobile responsiveness

## Related Components

- `SpendingQAStep.svelte` - Q&A verification for women
- `VerificationStep.svelte` - ID extraction step
- `LivenessStep.svelte` - Liveness check step
- `PhotoUploadStep.svelte` - Photo upload step
- Verification flow in `/src/routes/verified-vibe/verification/+page.svelte`

## Integration Example

```svelte
<script>
  import SpendingUploadStep from '$lib/verified-vibe/components/SpendingUploadStep.svelte';
  import { addVerificationRecord, user } from '$lib/verified-vibe/stores';

  async function handleSubmit(data) {
    const response = await fetch('/api/verified-vibe/verify-step', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        step: 'spending_or_qa',
        data: {
          spendingImage: data.spendingImage,
          mimeType: data.mimeType,
          gender: 'man'
        }
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

<SpendingUploadStep
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

- Single file upload only (not multiple files)
- No image cropping or editing
- No manual spending entry (image upload only)
- Claude analysis is not real-time (happens on server)

## Future Enhancements

- Multiple file upload support
- Image cropping/editing before upload
- Manual spending entry option
- Real-time Claude analysis feedback
- Spending pattern visualization
- Integration with trust score calculation
- Analytics on common spending patterns

## Privacy & Security

- Images are sent to Claude for analysis
- Images are not stored permanently
- Personal information in images is analyzed but not extracted
- All data transmission uses HTTPS
- Base64 encoding is done client-side
- No sensitive data stored in localStorage

