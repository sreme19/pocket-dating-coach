# Trust Score Calculation

## Overview

The Trust Score system calculates a user's trustworthiness based on completion of all verification steps. Each verification step contributes equally (25%) to the final score, resulting in a 0-100 scale.

## Trust Score Breakdown

The trust score is composed of four equal components:

| Step | Weight | Description |
|------|--------|-------------|
| **ID Verification** | 25% | Government ID extraction and validation |
| **Liveness Check** | 25% | Face comparison between ID and selfie |
| **Photo Consistency** | 25% | Facial consistency across profile photos |
| **Q&A Completion** | 25% | Gender-specific questions answered |

## Score Calculation

### Formula

```
Trust Score = (ID Score × 0.25) + (Liveness Score × 0.25) + (Photo Score × 0.25) + (Q&A Score × 0.25)
```

### Score Ranges

- **0-24**: Minimal Trust (Red)
- **25-49**: Low Trust (Red)
- **50-74**: Medium Trust (Yellow)
- **75-99**: High Trust (Green)
- **100**: Fully Verified (Green)

### Color Coding

- **Red** (< 50): User has not completed sufficient verification
- **Yellow** (50-74): User has completed most verification steps
- **Green** (≥ 75): User is highly verified and trustworthy

## API Endpoint

### POST /api/verified-vibe/calculate-trust-score

Calculates a user's trust score based on their verification records.

#### Request

```typescript
{
  userId: string;
  verificationRecords: VerificationRecord[];
}
```

#### Response

```typescript
{
  data: {
    total: number;                    // 0-100
    idScore: number;                  // 0-100
    livenessScore: number;            // 0-100
    photoScore: number;               // 0-100
    qaScore: number;                  // 0-100
    color: 'red' | 'yellow' | 'green';
    label: string;                    // Human-readable label
    details: {
      id: TrustScoreDetail;
      liveness: TrustScoreDetail;
      photos: TrustScoreDetail;
      qa: TrustScoreDetail;
    };
  }
}
```

#### Example Request

```bash
curl -X POST http://localhost:5173/api/verified-vibe/calculate-trust-score \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "verificationRecords": [
      {
        "id": "record-1",
        "userId": "user-123",
        "step": "id",
        "status": "completed",
        "data": { "confidenceScore": 95 },
        "completedAt": "2024-01-15T10:30:00Z",
        "createdAt": "2024-01-15T10:00:00Z"
      },
      {
        "id": "record-2",
        "userId": "user-123",
        "step": "liveness",
        "status": "completed",
        "data": { "confidenceScore": 88 },
        "completedAt": "2024-01-15T10:35:00Z",
        "createdAt": "2024-01-15T10:05:00Z"
      },
      {
        "id": "record-3",
        "userId": "user-123",
        "step": "photos",
        "status": "completed",
        "data": { "confidenceScore": 92 },
        "completedAt": "2024-01-15T10:40:00Z",
        "createdAt": "2024-01-15T10:10:00Z"
      },
      {
        "id": "record-4",
        "userId": "user-123",
        "step": "spending_or_qa",
        "status": "completed",
        "data": {},
        "completedAt": "2024-01-15T10:45:00Z",
        "createdAt": "2024-01-15T10:15:00Z"
      }
    ]
  }'
```

#### Example Response

```json
{
  "data": {
    "total": 93,
    "idScore": 95,
    "livenessScore": 88,
    "photoScore": 92,
    "qaScore": 100,
    "color": "green",
    "label": "High Trust",
    "details": {
      "id": {
        "score": 95,
        "weight": 0.25,
        "contribution": 23.75,
        "status": "completed",
        "confidenceScore": 95
      },
      "liveness": {
        "score": 88,
        "weight": 0.25,
        "contribution": 22,
        "status": "completed",
        "confidenceScore": 88
      },
      "photos": {
        "score": 92,
        "weight": 0.25,
        "contribution": 23,
        "status": "completed",
        "confidenceScore": 92
      },
      "qa": {
        "score": 100,
        "weight": 0.25,
        "contribution": 25,
        "status": "completed"
      }
    }
  }
}
```

## Server Functions

### calculateTrustScore(verificationRecords)

Calculates the trust score breakdown from verification records.

```typescript
import { calculateTrustScore } from '$lib/verified-vibe/server/trustScore';

const breakdown = calculateTrustScore(verificationRecords);
console.log(breakdown.total);        // 93
console.log(breakdown.idScore);      // 95
console.log(breakdown.details);      // Full breakdown
```

### getTrustScoreColor(score)

Returns the color coding for a given score.

```typescript
import { getTrustScoreColor } from '$lib/verified-vibe/server/trustScore';

getTrustScoreColor(45);   // 'red'
getTrustScoreColor(60);   // 'yellow'
getTrustScoreColor(85);   // 'green'
```

### getTrustScoreLabel(score)

Returns a human-readable label for a given score.

```typescript
import { getTrustScoreLabel } from '$lib/verified-vibe/server/trustScore';

getTrustScoreLabel(0);    // 'Not Verified'
getTrustScoreLabel(30);   // 'Low Trust'
getTrustScoreLabel(60);   // 'Medium Trust'
getTrustScoreLabel(90);   // 'High Trust'
getTrustScoreLabel(100);  // 'Fully Verified'
```

### getTrustScorePercentage(score)

Formats a score as a percentage string.

```typescript
import { getTrustScorePercentage } from '$lib/verified-vibe/server/trustScore';

getTrustScorePercentage(75);   // '75%'
getTrustScorePercentage(33.3); // '33%'
```

### isFullyVerified(verificationRecords)

Checks if all verification steps are completed.

```typescript
import { isFullyVerified } from '$lib/verified-vibe/server/trustScore';

const verified = isFullyVerified(verificationRecords);
if (verified) {
  console.log('User is fully verified!');
}
```

### getNextIncompleteStep(verificationRecords)

Returns the next incomplete verification step.

```typescript
import { getNextIncompleteStep } from '$lib/verified-vibe/server/trustScore';

const nextStep = getNextIncompleteStep(verificationRecords);
// Returns: 'id' | 'liveness' | 'photos' | 'spending_or_qa' | null
```

### getVerificationProgress(verificationRecords)

Returns the verification progress as a percentage (0-100).

```typescript
import { getVerificationProgress } from '$lib/verified-vibe/server/trustScore';

const progress = getVerificationProgress(verificationRecords);
console.log(progress); // 75 (3 out of 4 steps completed)
```

## Components

### TrustScoreBadge

Displays the trust score as a circular badge with color coding.

```svelte
<script>
  import TrustScoreBadge from '$lib/verified-vibe/components/TrustScoreBadge.svelte';
</script>

<TrustScoreBadge score={85} size="md" showLabel={true} showPercentage={true} />
```

**Props:**
- `score` (number): Trust score 0-100
- `size` ('sm' | 'md' | 'lg'): Badge size (default: 'md')
- `showLabel` (boolean): Show label below badge (default: true)
- `showPercentage` (boolean): Show percentage in badge (default: true)

### TrustScoreBar

Displays the trust score as a progress bar with breakdown by step.

```svelte
<script>
  import TrustScoreBar from '$lib/verified-vibe/components/TrustScoreBar.svelte';
  import { calculateTrustScore } from '$lib/verified-vibe/server/trustScore';

  let breakdown = calculateTrustScore(verificationRecords);
</script>

<TrustScoreBar {breakdown} showBreakdown={true} />
```

**Props:**
- `breakdown` (TrustScoreBreakdown): Trust score breakdown object
- `showBreakdown` (boolean): Show step-by-step breakdown (default: true)

## Database Schema

The trust score is stored in the `users` table:

```sql
ALTER TABLE users ADD COLUMN trust_score INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN trust_score_updated_at TIMESTAMP;
```

## Integration with Verification Flow

The trust score is automatically calculated after each verification step is completed:

1. User completes ID verification → Score updates to 25%
2. User completes Liveness check → Score updates to 50%
3. User completes Photo consistency → Score updates to 75%
4. User completes Q&A → Score updates to 100%

## Usage Examples

### Calculate and Display Score

```svelte
<script>
  import { calculateTrustScore } from '$lib/verified-vibe/server/trustScore';
  import TrustScoreBadge from '$lib/verified-vibe/components/TrustScoreBadge.svelte';
  import TrustScoreBar from '$lib/verified-vibe/components/TrustScoreBar.svelte';

  let verificationRecords = [];
  let breakdown;

  onMount(async () => {
    // Fetch verification records from API
    const response = await fetch(`/api/verified-vibe/verification-records?userId=${userId}`);
    verificationRecords = await response.json();
    
    // Calculate trust score
    breakdown = calculateTrustScore(verificationRecords);
  });
</script>

<div class="space-y-4">
  <TrustScoreBadge score={breakdown.total} size="lg" />
  <TrustScoreBar {breakdown} />
</div>
```

### Check Verification Status

```typescript
import { isFullyVerified, getNextIncompleteStep } from '$lib/verified-vibe/server/trustScore';

if (isFullyVerified(verificationRecords)) {
  console.log('User can access discovery feed');
} else {
  const nextStep = getNextIncompleteStep(verificationRecords);
  console.log(`User needs to complete: ${nextStep}`);
}
```

### Update User Profile with Score

```typescript
// In your API endpoint or server action
const breakdown = calculateTrustScore(verificationRecords);

// Update user profile in database
await db.users.update(userId, {
  trust_score: breakdown.total,
  trust_score_updated_at: new Date()
});
```

## Testing

The trust score calculation includes 48+ unit tests covering:

- Score calculation with various confidence levels
- Color coding for different score ranges
- Label generation
- Verification progress tracking
- Edge cases (missing records, failed steps, etc.)

Run tests with:

```bash
npm test trustScore.test.ts
```

## Performance Considerations

- Trust score calculation is O(n) where n is the number of verification records (typically 4)
- Calculation is fast enough to run on every verification step completion
- Consider caching the score in the user profile to avoid recalculation

## Future Enhancements

- Time-based score decay (older verifications worth less)
- Weighted scoring based on verification method
- Behavioral scoring (response times, profile completeness)
- Machine learning-based trust prediction
- Integration with fraud detection systems
