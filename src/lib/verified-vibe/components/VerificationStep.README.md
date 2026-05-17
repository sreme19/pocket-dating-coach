# VerificationStep Component - ID Extraction

## Overview

The `VerificationStep.svelte` component handles government ID photo upload and Claude Vision API integration for extracting ID information. It's part of the Verified Vibe multi-step verification flow.

## Features

- **File Upload**: Drag-and-drop and click-to-select file upload
- **Image Preview**: Real-time preview of uploaded ID photo
- **Claude Vision Integration**: Automatic ID data extraction using Claude API
- **Data Confirmation**: User can review and edit extracted data
- **Error Handling**: Graceful error handling with user-friendly messages
- **Loading States**: Visual feedback during processing
- **Mobile Responsive**: Fully responsive design (375px-1024px)
- **Accessibility**: WCAG 2.1 AA compliant

## Usage

```svelte
<script>
  import VerificationStep from '$lib/verified-vibe/components/VerificationStep.svelte';
  import type { IDExtractionResult } from '$lib/verified-vibe/types';

  async function handleSubmit(data: IDExtractionResult) {
    // Save extracted data to verification record
    console.log('Extracted ID data:', data);
  }

  function handleCancel() {
    // Handle cancel/re-upload
    console.log('User cancelled');
  }
</script>

<VerificationStep
  onSubmit={handleSubmit}
  onCancel={handleCancel}
/>
```

## Component Props

| Prop | Type | Description |
|------|------|-------------|
| `onSubmit` | `(data: IDExtractionResult) => Promise<void>` | Callback when user confirms extracted data |
| `onCancel` | `() => void` | Callback when user cancels or re-uploads |

## Data Structure

### IDExtractionResult

```typescript
interface IDExtractionResult {
  idNumber: string;           // ID/License number
  idName: string;             // Full name as shown on ID
  idDOB: string;              // Date of birth (MM/DD/YYYY)
  expirationDate?: string;    // Expiration date (MM/DD/YYYY, optional)
}
```

## Component States

### 1. Upload State
- User can drag-and-drop or click to select an image
- File validation (image type, max 5MB)
- Image preview
- Requirements checklist

### 2. Extracted State
- Displays extracted ID information
- User can edit any field
- Option to re-upload
- Confirm button to save

### 3. Confirmed State
- Success message with checkmark
- Confirmation that ID has been verified

## API Integration

### POST /api/verified-vibe/extract-id

**Request:**
```json
{
  "image": "base64-encoded-image-data",
  "mimeType": "image/jpeg"
}
```

**Response:**
```json
{
  "data": {
    "idNumber": "DL123456",
    "idName": "John Doe",
    "idDOB": "01/15/1990",
    "expirationDate": "01/15/2030"
  }
}
```

**Error Response:**
```json
{
  "error": "ID photo is unclear. Please upload a clearer photo."
}
```

## Error Handling

The component handles various error scenarios:

1. **Unclear Photo**: "ID photo is unclear. Please upload a clearer photo."
2. **Invalid ID**: "Could not find a valid ID in the photo. Please try again."
3. **API Error**: "Service temporarily unavailable. Please try again."
4. **Generic Error**: "Failed to extract ID information. Please try again."

## Accessibility Features

- **ARIA Labels**: All interactive elements have descriptive labels
- **Keyboard Navigation**: Full keyboard support (Tab, Enter, Space)
- **Focus Indicators**: Clear visual focus states
- **Color Contrast**: WCAG AA compliant (4.5:1 minimum)
- **Touch Targets**: 44x44px minimum on mobile
- **Screen Reader Support**: Semantic HTML and ARIA attributes

## Mobile Responsiveness

The component adapts to different screen sizes:

- **Mobile (375px-767px)**: Single column layout, full-width buttons
- **Tablet (768px-1023px)**: Optimized spacing and touch targets
- **Desktop (1024px+)**: Centered layout with max-width

## Styling

The component uses:
- **Design Tokens**: CSS custom properties from `design-tokens.css`
- **Tailwind CSS**: Utility classes for responsive design
- **Dark Mode**: Automatic dark mode support
- **Animations**: Smooth transitions and loading states

## Testing

The component includes comprehensive tests:

- **Unit Tests**: File upload, validation, API integration
- **Integration Tests**: End-to-end user flows
- **Accessibility Tests**: WCAG 2.1 AA compliance
- **Mobile Tests**: Responsive design verification

Run tests:
```bash
npm test -- src/lib/verified-vibe/components/VerificationStep.test.ts
```

## Performance

- **Image Optimization**: Supports WebP, JPEG, PNG formats
- **Lazy Loading**: Images loaded on demand
- **Code Splitting**: Component lazy-loaded in routes
- **Caching**: API responses cached when appropriate

## Security

- **Input Validation**: Base64 image validation
- **API Key Protection**: API key never exposed to client
- **Error Sanitization**: No sensitive data in error messages
- **HTTPS Only**: All API calls use HTTPS

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari 14+, Chrome Android)

## Dependencies

- `svelte`: ^4.0.0
- `lucide-svelte`: For icons
- Claude Vision API (server-side)

## Future Enhancements

- [ ] Camera capture for mobile
- [ ] Batch ID extraction
- [ ] OCR fallback
- [ ] ID verification with government databases
- [ ] Multi-language support
- [ ] Accessibility improvements for screen readers

## Related Components

- `VerificationFlow`: Multi-step verification container
- `LivenessCheck`: Selfie capture and comparison
- `PhotoUpload`: Multiple photo upload
- `TrustGauge`: Trust score visualization

## Support

For issues or questions, please refer to:
- Component tests: `src/lib/verified-vibe/components/VerificationStep.test.ts`
- Server functions: `src/lib/verified-vibe/server/verification.ts`
- API endpoint: `src/routes/verified-vibe/api/extract-id/+server.ts`
