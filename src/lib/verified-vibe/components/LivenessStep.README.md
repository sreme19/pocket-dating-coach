# LivenessStep Component - Selfie Capture & Liveness Verification

## Overview

The `LivenessStep.svelte` component handles selfie photo capture and Claude Vision API integration for liveness verification. It compares the user's selfie to their ID photo to verify they are the same person.

## Features

- **Camera Capture**: Direct camera access for selfie capture
- **File Upload**: Drag-and-drop and click-to-select file upload
- **Image Preview**: Real-time preview of uploaded selfie
- **Claude Vision Integration**: Automatic liveness check comparing selfie to ID
- **Confidence Scoring**: Returns 0-100 confidence score
- **Pass/Fail Logic**: Automatically passes if confidence >= 80%
- **Error Handling**: Graceful error handling with user-friendly messages
- **Loading States**: Visual feedback during processing
- **Mobile Responsive**: Fully responsive design (375px-1024px)
- **Accessibility**: WCAG 2.1 AA compliant

## Usage

```svelte
<script>
  import LivenessStep from '$lib/verified-vibe/components/LivenessStep.svelte';
  import type { LivenessCheckResult } from '$lib/verified-vibe/types';

  let idPhotoBase64 = 'base64-encoded-id-photo';

  async function handleSubmit(data: LivenessCheckResult) {
    // Save liveness result to verification record
    console.log('Liveness result:', data);
  }

  function handleCancel() {
    // Handle cancel/re-upload
    console.log('User cancelled');
  }
</script>

<LivenessStep
  {idPhotoBase64}
  onSubmit={handleSubmit}
  onCancel={handleCancel}
/>
```

## Component Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `idPhotoBase64` | `string` | Yes | Base64-encoded ID photo for comparison |
| `onSubmit` | `(data: LivenessCheckResult) => Promise<void>` | No | Callback when user confirms liveness check |
| `onCancel` | `() => void` | No | Callback when user cancels |

## Data Structure

### LivenessCheckResult

```typescript
interface LivenessCheckResult {
  confidence: number;  // 0-100 confidence score
  match: boolean;      // true if confidence >= 80%
}
```

## Component States

### 1. Upload State
- User can choose between camera capture or file upload
- Camera tab: Direct camera access for selfie
- Upload tab: Drag-and-drop or click to select image
- File validation (image type, max 5MB)
- Image preview
- Requirements checklist

### 2. Result State
- Displays confidence score (0-100)
- Shows pass/fail status
- Visual confidence bar
- Option to retake selfie
- Confirm button (only if match)

### 3. Confirmed State
- Success message with checkmark
- Confirmation that liveness has been verified

## API Integration

### POST /api/verified-vibe/check-liveness

**Request:**
```json
{
  "selfie": "base64-encoded-selfie-image",
  "idPhoto": "base64-encoded-id-photo",
  "mimeType": "image/jpeg"
}
```

**Response (Success):**
```json
{
  "data": {
    "confidence": 92,
    "match": true
  }
}
```

**Response (Failure):**
```json
{
  "error": "Face doesn't match ID. Please retake your selfie."
}
```

## Error Handling

The component handles various error scenarios:

1. **No Face Detected**: "Face not clearly visible. Please retake your selfie."
2. **Face Doesn't Match**: "Face doesn't match ID. Please retake your selfie."
3. **Camera Access Denied**: "Unable to access camera. Please check permissions."
4. **API Error**: "Service temporarily unavailable. Please try again."
5. **Generic Error**: "Failed to check liveness. Please try again."

## Accessibility Features

- **ARIA Labels**: All interactive elements have descriptive labels
- **Keyboard Navigation**: Full keyboard support (Tab, Enter, Space)
- **Focus Indicators**: Clear visual focus states
- **Color Contrast**: WCAG AA compliant (4.5:1 minimum)
- **Touch Targets**: 44x44px minimum on mobile
- **Screen Reader Support**: Semantic HTML and ARIA attributes
- **Reduced Motion**: Respects prefers-reduced-motion preference

## Mobile Responsiveness

The component adapts to different screen sizes:

- **Mobile (375px-767px)**: Single column layout, full-width buttons, camera fills screen
- **Tablet (768px-1023px)**: Optimized spacing and touch targets
- **Desktop (1024px+)**: Centered layout with max-width

## Styling

The component uses:
- **Design Tokens**: CSS custom properties from `design-tokens.css`
- **Tailwind CSS**: Utility classes for responsive design
- **Dark Mode**: Automatic dark mode support
- **Animations**: Smooth transitions and loading states
- **Gradients**: Confidence bar with gradient fill

## Camera Capture

The component uses the Web Camera API:

```typescript
// Request camera access
const stream = await navigator.mediaDevices.getUserMedia({
  video: { facingMode: 'user' }
});

// Capture photo from video stream
const canvas = document.createElement('canvas');
const context = canvas.getContext('2d');
context.drawImage(videoElement, 0, 0);
canvas.toBlob((blob) => {
  // Convert to file and process
});
```

### Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14.1+
- Mobile browsers (iOS Safari 14.3+, Chrome Android)

### Permissions

Users must grant camera permission for capture to work. The component handles permission denial gracefully.

## Performance

- **Image Optimization**: Supports WebP, JPEG, PNG formats
- **Lazy Loading**: Images loaded on demand
- **Code Splitting**: Component lazy-loaded in routes
- **Canvas Optimization**: Efficient canvas rendering for photo capture
- **Memory Management**: Proper cleanup of media streams

## Security

- **Input Validation**: Base64 image validation
- **API Key Protection**: API key never exposed to client
- **Error Sanitization**: No sensitive data in error messages
- **HTTPS Only**: All API calls use HTTPS
- **Stream Cleanup**: Media streams properly closed on unmount

## Testing

The component includes comprehensive tests:

- **Unit Tests**: File upload, camera capture, validation
- **Integration Tests**: End-to-end user flows
- **Accessibility Tests**: WCAG 2.1 AA compliance
- **Mobile Tests**: Responsive design verification

Run tests:
```bash
npm test -- src/lib/verified-vibe/components/LivenessStep.test.ts
```

## Related Components

- `VerificationStep`: ID extraction component
- `PhotoUpload`: Multiple photo upload
- `VerificationFlow`: Multi-step verification container
- `TrustGauge`: Trust score visualization

## Future Enhancements

- [ ] Liveness detection (blink, head movement)
- [ ] Multiple selfie angles
- [ ] Batch liveness checks
- [ ] Improved face detection
- [ ] Multi-language support
- [ ] Accessibility improvements for screen readers

## Support

For issues or questions, please refer to:
- Component tests: `src/lib/verified-vibe/components/LivenessStep.test.ts`
- Server functions: `src/lib/verified-vibe/server/verification.ts`
- API endpoint: `src/routes/verified-vibe/api/check-liveness/+server.ts`
