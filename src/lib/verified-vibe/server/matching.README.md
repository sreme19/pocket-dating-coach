# Compatibility Scoring Module

## Overview

The compatibility scoring module calculates compatibility scores between users based on archetype matching, Q&A answers alignment, and trust scores. This enables the discovery feed to prioritize and display the most compatible matches.

## Features

- **Archetype-Based Matching**: Uses a compatibility matrix to determine how well two archetypes align
- **Q&A Answer Alignment**: Analyzes spending habits, lifestyle, and values to find common ground
- **Trust Score Integration**: Considers both users' verification trust scores in the final calculation
- **Detailed Breakdown**: Provides a comprehensive breakdown of how the score was calculated
- **Matching Traits**: Identifies shared traits and complementary characteristics
- **Potential Issues**: Flags potential conflicts or differences to watch for

## Score Calculation

The compatibility score is calculated using a weighted formula:

```
Total Score = (Archetype Score × 0.6) + (Q&A Score × 0.3) + (Trust Score × 0.1)
```

### Components

#### 1. Archetype Compatibility (60%)
Based on a predefined compatibility matrix that reflects how well different archetypes align:

- **Casual Man** ↔ **Spoilt Woman**: 70% (complementary energy)
- **Marriage-Minded Man** ↔ **Safety-First Woman**: 80% (aligned goals)
- **Same Archetype**: 50-70% (depends on archetype)

#### 2. Q&A Alignment (30%)
Analyzes user answers to questions about:
- Spending habits
- Lifestyle preferences
- Core values

Scoring:
- Exact match: 100%
- Significant overlap (50%+ keywords): 50-100%
- Minimal overlap: 20-50%
- No overlap: 0-20%

#### 3. Trust Score Factor (10%)
Considers both users' verification trust scores:
- Both high (≥75): Boost by 10%
- Either low (<25): Reduce by 15%
- Otherwise: Average of both scores

## API Endpoint

### POST /api/verified-vibe/calculate-compatibility

Calculates compatibility between two users.

**Request:**
```typescript
{
  user1: VerifiedVibeUser,
  user2: VerifiedVibeUser,
  user1Answers?: UserAnswers,
  user2Answers?: UserAnswers
}
```

**Response:**
```typescript
{
  data: {
    total: number (0-100),
    archetypeScore: number,
    qaScore: number,
    trustScore: number,
    label: string,
    color: 'red' | 'orange' | 'yellow' | 'green',
    breakdown: {
      archetype: { score, weight, contribution, details },
      qa: { score, weight, contribution, details },
      trust: { score, weight, contribution, details }
    },
    matchingTraits: string[],
    potentialIssues: string[]
  }
}
```

## Usage Examples

### Basic Compatibility Calculation

```typescript
import { calculateCompatibility } from '$lib/verified-vibe/server/matching';

const user1 = {
  id: 'user1',
  archetype: 'marriage_minded_man',
  trustScore: 85,
  // ... other user properties
};

const user2 = {
  id: 'user2',
  archetype: 'safety_first_woman',
  trustScore: 80,
  // ... other user properties
};

const compatibility = calculateCompatibility(user1, user2);
console.log(`Compatibility: ${compatibility.total}%`);
```

### With Q&A Answers

```typescript
const answers1 = {
  spending: 'moderate',
  lifestyle: 'family-oriented',
  values: 'honesty'
};

const answers2 = {
  spending: 'moderate',
  lifestyle: 'family-oriented',
  values: 'honesty'
};

const compatibility = calculateCompatibility(user1, user2, answers1, answers2);
```

### Getting Labels and Colors

```typescript
import {
  getCompatibilityLabel,
  getCompatibilityColor,
  getCompatibilityPercentage
} from '$lib/verified-vibe/server/matching';

const score = 78;
const label = getCompatibilityLabel(score); // "Great Match"
const color = getCompatibilityColor(score); // "yellow"
const percentage = getCompatibilityPercentage(score); // "78%"
```

### Checking Match Threshold

```typescript
import { isCompatibleMatch } from '$lib/verified-vibe/server/matching';

if (isCompatibleMatch(score, 60)) {
  // Score is above 60% threshold
}
```

### Sorting Profiles by Compatibility

```typescript
import { sortByCompatibility } from '$lib/verified-vibe/server/matching';

const profiles = [
  { compatibilityScore: 50, name: 'Profile A' },
  { compatibilityScore: 80, name: 'Profile B' },
  { compatibilityScore: 60, name: 'Profile C' }
];

const sorted = sortByCompatibility(profiles); // Descending order
// Result: [80, 60, 50]
```

## Archetype Compatibility Matrix

| | Casual Man | Marriage-Minded Man | Spoilt Woman | Safety-First Woman |
|---|---|---|---|---|
| **Casual Man** | 50 | 30 | 70 | 40 |
| **Marriage-Minded Man** | 30 | 60 | 50 | 80 |
| **Spoilt Woman** | 70 | 50 | 60 | 40 |
| **Safety-First Woman** | 40 | 80 | 40 | 70 |

## Compatibility Labels

- **Excellent Match** (85-100): Highly compatible, strong potential
- **Great Match** (70-84): Very compatible, good potential
- **Good Match** (55-69): Compatible, worth exploring
- **Possible Match** (40-54): Some compatibility, might work
- **Low Compatibility** (25-39): Limited compatibility, challenging
- **Very Low Compatibility** (0-24): Minimal compatibility, unlikely

## Color Coding

- 🟢 **Green** (75-100): Excellent to great match
- 🟡 **Yellow** (55-74): Good to possible match
- 🟠 **Orange** (35-54): Low to possible match
- 🔴 **Red** (0-34): Very low to low compatibility

## Matching Traits

The module identifies shared traits and complementary characteristics:

- **Common Traits**: "Both spontaneous and adventurous"
- **Complementary Traits**: "Complementary energy and interests"
- **Aligned Goals**: "Aligned life goals and values"

## Potential Issues

The module flags potential conflicts:

- "Different relationship expectations"
- "Potential lifestyle differences"
- "May need to establish commitment expectations"

## Testing

The module includes 49 comprehensive unit tests covering:

- Basic compatibility calculation
- Archetype compatibility matrix
- Q&A answer alignment
- Trust score impact
- Label and color generation
- Sorting and filtering
- Edge cases and boundary conditions

Run tests:
```bash
npm run test -- src/lib/verified-vibe/server/matching.test.ts
```

## Performance Considerations

- Compatibility calculations are lightweight and suitable for real-time use
- Sorting large profile lists should be done server-side for better performance
- Consider caching compatibility scores for frequently viewed profiles

## Future Enhancements

- Machine learning-based compatibility prediction
- User feedback integration to improve scoring
- Location-based compatibility factors
- Photo similarity analysis
- Conversation history analysis
- Behavioral pattern matching

## Related Modules

- `trustScore.ts`: Trust score calculation
- `verification.ts`: Verification step handling
- `notifications.ts`: Match notifications
- `UserProfileCard.svelte`: Profile display component
- `DiscoveryFeed`: Discovery feed page

## API Integration

The compatibility scoring is integrated into:

1. **Discovery Feed**: Profiles sorted by compatibility
2. **Profile Cards**: Compatibility score displayed
3. **Match Notifications**: Triggered on mutual likes
4. **Chat Interface**: Compatibility context in conversations

## Accessibility

- All scores are presented with both numeric and text labels
- Color coding is supplemented with text descriptions
- WCAG 2.1 AA compliant color contrast ratios
- Screen reader friendly labels and descriptions

## Security

- All calculations are deterministic and reproducible
- No sensitive user data is exposed in scores
- Server-side calculation prevents client-side manipulation
- Input validation on all API endpoints
