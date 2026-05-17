# PhotoUploadStep Component

## Overview

The `PhotoUploadStep` component handles photo upload and consistency verification for the Verified Vibe verification flow. It allows users to upload 5+ photos, label them, and verify that all photos are of the same person using Claude Vision API.

## Features

- **Multi-photo upload** with drag-and-drop support
- **Photo labeling** (lead, warmth, lifestyle, conversation, social)
- **Claude Vision integration** for photo consistency analysis
- **Real-time feedback** on consistency check results
- **Mobile responsive** (375px-1024px)
- **WCAG 2.1 AA accessibility** compliant
- **Error handling** with user-friendly messages
- **Loading states** during processing

## Usage

```svelte
<script>
  import PhotoUploadStep from '$lib/verified-vibe/components/PhotoUploadStep.svelte';

  async function handleSubmit(data) {
    // data.photos: File[]
    // data.labels: Record<string, string> (index -> label mapping)
    console.log('Photos:', data.photos);
    console.log('Labels:', data.labels);
  }

  function handleCancel() {
    console.log('User cancelled');
  }
</script>

<PhotoUploadStep
  onSubmit={handleSubmit}
  onCancel={handleCancel}
/>
```

## Props

| Prop | Type | Description |
|------|------|-------------|
| `onSubmit` | `(data: { photos: File[]; labels: Record<string, string> }) => Promise<void>` | Callback when user confirms photos |
| `onCancel` | `() => void` | Callback when user cancels |

## States

The component has 4 main states:

1. **upload** - User uploads photos (minimum 5)
2. **label** - User labels each photo
3. **checking** - Claude API analyzes photo consistency
4. **result** - Shows consistency check results

## Photo Labels

Users must label each photo with one of:
- `lead` - Main/profile photo
- `warmth` - Friendly/approachable photo
- `lifestyle` - Activity/lifestyle photo
- `conversation` - Engaging/social photo
- `social` - Group/social photo

## Consistency Check

The component sends all photos to Claude Vision API which:
- Analyzes facial features
- Compares photos for consistency
- Returns confidence score (0-100)
- Marks as consistent if confidence >= 80%

## API Endpoint

**POST** `/api/verified-vibe/check-photo-consistency`

Request:
```json
{
  "images": ["base64_image_1", "base64_image_2", ...],
  "mimeTypes": ["image/jpeg", "image/png", ...]
}
```

Response:
```json
{
  "data": {
    "confidence": 92,
    "consistent": true
  }
}
```

## Validation

- Minimum 5 photos required
- Maximum 5MB per file
- Only image files accepted
- All photos must be labeled before consistency check
- Consistency check requires confidence >= 80%

## Accessibility

- Keyboard navigation support
- ARIA labels on all interactive elements
- Screen reader friendly
- Focus management
- Error announcements with `role="alert"`
- Touch targets >= 44x44px

## Mobile Responsive

- **Mobile (375px-767px)**: Single column layout, stacked photos
- **Tablet (768px-1023px)**: 2-3 column grid
- **Desktop (1024px+)**: 3-4 column grid

## Error Handling

Common errors:
- "Please upload only image files"
- "Some files exceed 5MB limit"
- "Please upload at least 5 photos"
- "Please label all photos"
- "Failed to check photo consistency"
- "Photos must be consistent (confidence >= 80%)"

## Design Tokens

Uses Verified Vibe design tokens:
- `--color-vibe-emerald` - Primary accent
- `--color-vibe-bg-1`, `--bg-2`, `--bg-3` - Background colors
- `--color-vibe-text-1`, `--text-2`, `--text-3` - Text colors
- `--color-vibe-border` - Border color
- `--radius-lg`, `--radius-md` - Border radius
- `--spacing-*` - Spacing values
- `--gap-*` - Gap values

## Performance

- Lazy loads image previews
- Efficient base64 encoding
- Optimized Claude API calls
- Minimal re-renders with Svelte reactivity

## Testing

See `PhotoUploadStep.test.ts` for unit tests and `PhotoUploadStep.mobile.test.ts` for mobile-specific tests.

## Related Components

- `VerificationStep.svelte` - ID extraction step
- `LivenessStep.svelte` - Liveness check step
- Verification flow in `/src/routes/verified-vibe/verification/+page.svelte`
