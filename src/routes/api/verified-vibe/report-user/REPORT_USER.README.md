# Report User API Endpoint

## Overview

The Report User endpoint allows authenticated users to report other users for inappropriate behavior, fake profiles, scams, or other violations of platform policies. Reports are sent to the moderation team for review and action.

## Endpoint

```
POST /api/verified-vibe/report-user
```

## Request

### Headers
```
Content-Type: application/json
Authorization: Bearer <token>  (in production)
```

### Body

```json
{
  "reportedUserId": "string",
  "reason": "inappropriate_content" | "harassment" | "fake_profile" | "scam" | "other",
  "description": "string (optional)"
}
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `reportedUserId` | string | Yes | The ID of the user being reported |
| `reason` | enum | Yes | The reason for the report |
| `description` | string | No | Additional details about the report (max 1000 characters) |

#### Valid Reasons

- `inappropriate_content` - User posted inappropriate or offensive content
- `harassment` - User is harassing or threatening other users
- `fake_profile` - User's profile appears to be fake or fraudulent
- `scam` - User is attempting to scam or defraud other users
- `other` - Other reason not listed above

### Validation Rules

- `reportedUserId` must be a non-empty string
- `reportedUserId` cannot be the same as the current user's ID (self-reporting prevention)
- `reason` must be one of the valid reasons listed above
- `description` must be a string if provided
- `description` must be less than 1000 characters
- `description` is optional but recommended for better context

## Response

### Success Response (200 OK)

```json
{
  "data": {
    "success": true,
    "message": "Report submitted successfully. Our moderation team will review it shortly.",
    "reportId": "report-1234567890-abc123def456"
  }
}
```

### Error Responses

#### 400 Bad Request

Missing `reportedUserId`:
```json
{
  "error": "reportedUserId is required"
}
```

Missing `reason`:
```json
{
  "error": "reason is required"
}
```

Invalid `reason`:
```json
{
  "error": "reason must be one of: inappropriate_content, harassment, fake_profile, scam, other"
}
```

Description too long:
```json
{
  "error": "description must be less than 1000 characters"
}
```

Self-reporting attempt:
```json
{
  "error": "Cannot report yourself"
}
```

#### 401 Unauthorized

```json
{
  "error": "Unauthorized"
}
```

#### 500 Internal Server Error

```json
{
  "error": "Internal server error"
}
```

## Usage Examples

### JavaScript/TypeScript

```typescript
// Report a user
async function reportUser(
  reportedUserId: string,
  reason: 'inappropriate_content' | 'harassment' | 'fake_profile' | 'scam' | 'other',
  description?: string
) {
  const response = await fetch('/api/verified-vibe/report-user', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      reportedUserId,
      reason,
      description
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error);
  }

  const data = await response.json();
  console.log('Report submitted:', data.data.reportId);
  return data.data;
}

// Usage
try {
  await reportUser(
    'user-123',
    'inappropriate_content',
    'User posted explicit content in their profile'
  );
  console.log('Report submitted successfully');
} catch (error) {
  console.error('Failed to submit report:', error.message);
}
```

### Svelte Component Integration

```svelte
<script lang="ts">
  import type { ReportReason } from '$lib/verified-vibe/types';

  let selectedReason: ReportReason = 'other';
  let description = '';
  let isSubmitting = false;

  async function handleReportUser(userId: string) {
    isSubmitting = true;
    try {
      const response = await fetch('/api/verified-vibe/report-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportedUserId: userId,
          reason: selectedReason,
          description: description || undefined
        })
      });

      if (!response.ok) {
        throw new Error('Failed to submit report');
      }

      const data = await response.json();
      
      // Show confirmation
      showNotification('Report submitted successfully');
      
      // Reset form
      selectedReason = 'other';
      description = '';
      
      // Close modal
      closeReportModal();
    } catch (error) {
      showError('Failed to submit report');
    } finally {
      isSubmitting = false;
    }
  }
</script>

<div class="report-form">
  <select bind:value={selectedReason}>
    <option value="inappropriate_content">Inappropriate Content</option>
    <option value="harassment">Harassment</option>
    <option value="fake_profile">Fake Profile</option>
    <option value="scam">Scam</option>
    <option value="other">Other</option>
  </select>

  <textarea
    bind:value={description}
    placeholder="Provide additional details (optional)"
    maxlength="1000"
  ></textarea>

  <button
    onclick={() => handleReportUser(profile.id)}
    disabled={isSubmitting}
  >
    {isSubmitting ? 'Submitting...' : 'Submit Report'}
  </button>
</div>
```

## Implementation Details

### Database Schema

In production, the following table would store reports:

```sql
CREATE TABLE reports (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  reported_user_id UUID REFERENCES users(id),
  reason VARCHAR NOT NULL,
  description TEXT,
  status VARCHAR DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  reviewed_at TIMESTAMP,
  reviewed_by UUID REFERENCES users(id)
);

CREATE INDEX idx_reports_user_id ON reports(user_id);
CREATE INDEX idx_reports_reported_user_id ON reports(reported_user_id);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_created_at ON reports(created_at);
```

### Moderation Workflow

1. **Report Submission**: User submits report with reason and optional description
2. **Report Storage**: Report is stored in database with `status: 'pending'`
3. **Moderation Notification**: Moderation team is notified of new report
4. **Review**: Moderator reviews report and user's profile
5. **Action**: Moderator takes action (warning, suspension, ban, etc.)
6. **Status Update**: Report status is updated to `'reviewed'` or `'resolved'`

### Automatic Actions

Consider implementing automatic actions for multiple reports:

```typescript
// If user receives 3+ reports in 24 hours
if (reportCount >= 3) {
  // Automatically hide profile from discovery
  // Send warning to user
  // Flag for manual review
}

// If user receives 5+ reports in 24 hours
if (reportCount >= 5) {
  // Automatically suspend account
  // Notify moderation team
}
```

## Security Considerations

1. **Authentication Required**: All report operations must be authenticated
2. **Authorization**: Users can only report other users, not themselves
3. **Rate Limiting**: Implement rate limiting to prevent spam reports
4. **Validation**: Validate all input to prevent injection attacks
5. **Audit Logging**: Log all reports for compliance and investigation
6. **Data Privacy**: Protect reporter identity from reported user
7. **False Report Prevention**: Track and penalize users who submit false reports

## Testing

The endpoint includes comprehensive unit tests covering:

- Successful report submissions
- Input validation for all fields
- Report reason validation
- Description length validation
- Self-reporting prevention
- Error handling
- Edge cases (long IDs, special characters, various descriptions)
- HTTP status codes

Run tests with:
```bash
npm test -- src/routes/api/verified-vibe/report-user/report-user.test.ts
```

## Related Endpoints

- `POST /api/verified-vibe/block-user` - Block a user from discovery feed
- `GET /api/verified-vibe/discovery-feed` - Get discovery feed

## Accessibility

- All error messages are clear and descriptive
- Proper HTTP status codes are used for different error scenarios
- Response format is consistent and predictable
- Report form should be accessible with keyboard navigation

## Performance

- Report submissions should complete in < 200ms
- Moderation dashboard should load reports efficiently
- Reports should be indexed by status and date for quick filtering

## User Experience

### Confirmation Message

After successful report submission, show:
```
"Thank you for reporting this user. Our moderation team will review your report and take appropriate action."
```

### Error Messages

Provide specific error messages:
- "Please select a reason for the report"
- "Description must be less than 1000 characters"
- "Failed to submit report. Please try again."

### Report Form Best Practices

1. Make reason field required
2. Provide helpful descriptions for each reason
3. Allow optional detailed description
4. Show character count for description field
5. Disable submit button until reason is selected
6. Show loading state during submission
7. Confirm submission with success message

## Future Enhancements

1. **Report Categories**: Add sub-categories for more specific reporting
2. **Evidence Upload**: Allow users to upload screenshots or evidence
3. **Report Status Tracking**: Let users track status of their reports
4. **Appeal Process**: Allow reported users to appeal moderation decisions
5. **Report Analytics**: Dashboard for moderation team to analyze report trends
6. **Automated Detection**: Use ML to detect and flag suspicious patterns
7. **Community Moderation**: Allow trusted users to help moderate reports
