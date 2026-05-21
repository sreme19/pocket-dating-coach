# Insight Extractor Service

## Overview

The Insight Extractor is a specialized service for deep analysis of conversations to extract meaningful insights about personality, preferences, compatibility, and relationship signals. It goes beyond the basic auto-updater by providing structured, categorized insights with reasoning.

## Features

### 1. Emotional Signal Extraction
Analyzes how someone communicates feelings and emotions:
- Emotional availability and openness
- Emotional maturity and self-awareness
- How they respond to emotional topics
- Signs of emotional depth or superficiality

**Function**: `extractEmotionalSignals()`

### 2. Lifestyle Signal Extraction
Analyzes how someone lives their life:
- Work/career priorities and ambitions
- Hobbies, interests, and activities
- Social habits and friend groups
- Travel and adventure preferences
- Health, fitness, and wellness priorities
- Financial habits and priorities

**Function**: `extractLifestyleSignals()`

### 3. Values Extraction
Analyzes what matters most to someone:
- Explicitly stated non-negotiables
- What they prioritize in decisions
- What they respect in others
- What they're willing to sacrifice for
- Moral and ethical priorities

**Function**: `extractValues()`

### 4. Red Flags Extraction
Identifies warning signs and concerning behaviors:
- Disrespectful or dismissive attitudes
- Inconsistencies or contradictions
- Controlling or manipulative behaviors
- Lack of accountability or responsibility
- Unhealthy patterns or habits
- Boundary violations

**Function**: `extractRedFlags()`

### 5. Dealbreakers Extraction
Identifies absolute no-gos and non-negotiables:
- Explicitly stated non-negotiables
- Behaviors they absolutely won't tolerate
- Values they refuse to compromise on
- Situations that would be relationship-ending
- Hard boundaries they've mentioned

**Function**: `extractDealbreakers()`

### 6. Compatibility Signals Extraction
Analyzes match messages for compatibility:
- **Green Flags**: Behaviors/statements that align with positive values
- **Yellow Flags**: Behaviors/statements that need clarification
- **Red Flags**: Behaviors/statements that are concerning
- **Dealbreakers**: Behaviors/statements that violate hard boundaries
- **Overall Assessment**: Summary of compatibility

**Function**: `extractCompatibilitySignals()`

### 7. Personality Insights Extraction (Male Users)
Extracts comprehensive personality profile:
- Communication style (direct, playful, genuine, reserved)
- Personality vibe (ambitious, chill, adventurous, intellectual)
- What matters most
- Core values
- Dating patterns and preferences
- Red flags to avoid

**Function**: `extractPersonalityInsights()`

### 8. Comprehensive User Insights
Extracts all user insights in parallel:
- Emotional signals
- Lifestyle signals
- Values
- Red flags
- Dealbreakers

**Function**: `extractAllUserInsights()`

## API Reference

### extractEmotionalSignals()

```typescript
async function extractEmotionalSignals(
  userMessages: ChatMessage[],
  userProfile: UserProfile | null,
  bookContext: string,
  assistantType: 'bestie' | 'wingman' = 'bestie',
  config: Partial<InsightExtractionConfig> = {}
): Promise<string[]>
```

**Parameters**:
- `userMessages`: Array of chat messages to analyze
- `userProfile`: User's profile information
- `bookContext`: Book context for grounding advice
- `assistantType`: Type of assistant ('bestie' or 'wingman')
- `config`: Configuration options

**Returns**: Array of emotional signals

**Example**:
```typescript
const signals = await extractEmotionalSignals(
  messages,
  userProfile,
  bookContext,
  'bestie',
  { maxInsightsPerCategory: 5 }
);
```

### extractCompatibilitySignals()

```typescript
async function extractCompatibilitySignals(
  matchMessages: ChatMessage[],
  userProfile: UserProfile | null,
  bookContext: string,
  userPreferences?: PreferencesProfile,
  assistantType: 'bestie' | 'wingman' = 'bestie',
  config: Partial<InsightExtractionConfig> = {}
): Promise<CompatibilityInsights>
```

**Parameters**:
- `matchMessages`: Array of match's messages to analyze
- `userProfile`: User's profile information
- `bookContext`: Book context for grounding advice
- `userPreferences`: User's preferences (optional, for context)
- `assistantType`: Type of assistant ('bestie' or 'wingman')
- `config`: Configuration options

**Returns**: CompatibilityInsights object with green/yellow/red flags and assessment

**Example**:
```typescript
const compatibility = await extractCompatibilitySignals(
  matchMessages,
  userProfile,
  bookContext,
  userPreferences,
  'bestie'
);

console.log(compatibility.greenFlags);    // Array of positive signals
console.log(compatibility.redFlags);      // Array of concerning signals
console.log(compatibility.overallAssessment); // Summary
```

### extractAllUserInsights()

```typescript
async function extractAllUserInsights(
  userMessages: ChatMessage[],
  userProfile: UserProfile | null,
  bookContext: string,
  assistantType: 'bestie' | 'wingman' = 'bestie',
  config: Partial<InsightExtractionConfig> = {}
): Promise<ExtractedInsights>
```

**Parameters**:
- `userMessages`: Array of user messages to analyze
- `userProfile`: User's profile information
- `bookContext`: Book context for grounding advice
- `assistantType`: Type of assistant ('bestie' or 'wingman')
- `config`: Configuration options

**Returns**: ExtractedInsights object with all insight types

**Example**:
```typescript
const insights = await extractAllUserInsights(
  userMessages,
  userProfile,
  bookContext,
  'bestie'
);

console.log(insights.emotionalSignals);  // How they communicate feelings
console.log(insights.lifestyleSignals);  // How they live their life
console.log(insights.values);            // What matters to them
console.log(insights.redFlags);          // Warning signs
console.log(insights.dealbreakers);      // Absolute no-gos
```

### extractPersonalityInsights()

```typescript
async function extractPersonalityInsights(
  userMessages: ChatMessage[],
  userProfile: UserProfile | null,
  bookContext: string,
  config: Partial<InsightExtractionConfig> = {}
): Promise<PersonalityInsights>
```

**Parameters**:
- `userMessages`: Array of user messages to analyze
- `userProfile`: User's profile information
- `bookContext`: Book context for grounding advice
- `config`: Configuration options

**Returns**: PersonalityInsights object with personality profile

**Example**:
```typescript
const personality = await extractPersonalityInsights(
  userMessages,
  userProfile,
  bookContext
);

console.log(personality.communicationStyle);  // 'direct', 'playful', etc.
console.log(personality.personalityVibe);     // 'ambitious', 'chill', etc.
console.log(personality.values);              // Core values
console.log(personality.datingPatterns);      // Dating preferences
```

## Configuration

### InsightExtractionConfig

```typescript
interface InsightExtractionConfig {
  minMessagesForExtraction: number;      // Minimum messages before extraction (default: 2)
  maxInsightsPerCategory: number;        // Max insights per category (default: 5)
  deduplicateInsights: boolean;          // Avoid duplicate insights (default: true)
  includeReasoningInFlags: boolean;      // Include reasoning in flags (default: true)
}
```

**Example**:
```typescript
const config: Partial<InsightExtractionConfig> = {
  minMessagesForExtraction: 3,
  maxInsightsPerCategory: 10,
  deduplicateInsights: true
};

const signals = await extractEmotionalSignals(
  messages,
  userProfile,
  bookContext,
  'bestie',
  config
);
```

## Data Structures

### ExtractedInsights

```typescript
interface ExtractedInsights {
  emotionalSignals: string[];
  lifestyleSignals: string[];
  values: string[];
  redFlags: string[];
  dealbreakers: string[];
  maturitySignals?: string[];
  boundaries?: string[];
  privateNotes?: string[];
}
```

### CompatibilityInsights

```typescript
interface CompatibilityInsights {
  greenFlags: Array<{ signal: string; reason: string }>;
  yellowFlags: Array<{ signal: string; reason: string }>;
  redFlags: Array<{ signal: string; reason: string }>;
  dealbreakers: Array<{ signal: string; reason: string }>;
  overallAssessment: string;
}
```

### PersonalityInsights

```typescript
interface PersonalityInsights {
  communicationStyle: string;
  personalityVibe: string;
  mattersMost: string;
  values: string[];
  datingPatterns: string[];
  redFlagsToAvoid: string[];
}
```

## Error Handling

The insight extractor handles errors gracefully:

1. **Insufficient Messages**: Returns empty arrays if fewer than `minMessagesForExtraction` messages
2. **Claude API Errors**: Logs error and returns empty results
3. **Invalid JSON**: Logs error and returns empty results
4. **Missing Fields**: Returns empty arrays for missing fields
5. **Non-Array Fields**: Filters out non-array responses

**Example**:
```typescript
try {
  const signals = await extractEmotionalSignals(
    messages,
    userProfile,
    bookContext
  );
  
  if (signals.length === 0) {
    console.log('No emotional signals extracted');
  }
} catch (error) {
  console.error('Extraction failed:', error);
}
```

## Usage Examples

### Extract Emotional Signals from User Messages

```typescript
import { extractEmotionalSignals } from '$lib/server/insight-extractor';

const signals = await extractEmotionalSignals(
  userMessages,
  userProfile,
  bookContext,
  'bestie'
);

console.log('Emotional signals:', signals);
// Output: ['Values vulnerability and emotional openness', 'Seeks authentic connections', ...]
```

### Analyze Match for Compatibility

```typescript
import { extractCompatibilitySignals } from '$lib/server/insight-extractor';

const compatibility = await extractCompatibilitySignals(
  matchMessages,
  userProfile,
  bookContext,
  userPreferences,
  'bestie'
);

console.log('Green flags:', compatibility.greenFlags);
console.log('Red flags:', compatibility.redFlags);
console.log('Assessment:', compatibility.overallAssessment);
```

### Extract All User Insights

```typescript
import { extractAllUserInsights } from '$lib/server/insight-extractor';

const insights = await extractAllUserInsights(
  userMessages,
  userProfile,
  bookContext,
  'bestie'
);

// Update profile with extracted insights
await updatePreferences(userId, {
  emotionalSignals: insights.emotionalSignals,
  lifestyleSignals: insights.lifestyleSignals,
  values: insights.values,
  redFlags: insights.redFlags,
  dealbreakers: insights.dealbreakers
}, 'Extracted from conversation');
```

### Extract Personality Profile (Male Users)

```typescript
import { extractPersonalityInsights } from '$lib/server/insight-extractor';

const personality = await extractPersonalityInsights(
  userMessages,
  userProfile,
  bookContext
);

// Update personality profile
await updatePersonality(userId, {
  communicationStyle: personality.communicationStyle,
  personalityVibe: personality.personalityVibe,
  mattersMost: personality.mattersMost,
  values: personality.values,
  datingPatterns: personality.datingPatterns,
  redFlagsToAvoid: personality.redFlagsToAvoid
}, 'Extracted from conversation');
```

## Integration with Profile Auto-Updater

The insight extractor is designed to work with the profile auto-updater:

```typescript
import { extractAllUserInsights } from '$lib/server/insight-extractor';
import { updatePreferences } from '$lib/server/profile-service';

// Extract insights
const insights = await extractAllUserInsights(
  userMessages,
  userProfile,
  bookContext,
  'bestie'
);

// Update profile with insights
if (Object.keys(insights).some(key => insights[key].length > 0)) {
  await updatePreferences(userId, insights, 'Extracted from conversation');
}
```

## Testing

The insight extractor includes comprehensive unit tests:

```bash
npm test -- src/lib/server/__tests__/insight-extractor.test.ts
```

**Test Coverage**:
- ✅ Emotional signal extraction
- ✅ Lifestyle signal extraction
- ✅ Values extraction
- ✅ Red flags extraction
- ✅ Dealbreakers extraction
- ✅ Compatibility signals extraction
- ✅ Personality insights extraction
- ✅ Error handling and edge cases
- ✅ Configuration options
- ✅ Assistant type handling

## Performance Considerations

1. **Parallel Extraction**: `extractAllUserInsights()` extracts all insight types in parallel for better performance
2. **Message Filtering**: Only processes messages if minimum threshold is met
3. **Result Caching**: Consider caching results to avoid re-extraction
4. **API Rate Limiting**: Claude API calls are subject to rate limits

## Best Practices

1. **Minimum Messages**: Ensure at least 2-3 messages before extraction for meaningful results
2. **Regular Updates**: Extract insights periodically (e.g., after every 5-10 messages)
3. **Deduplication**: Enable deduplication to avoid duplicate insights
4. **Error Handling**: Always handle potential errors gracefully
5. **Configuration**: Adjust configuration based on your use case

## Troubleshooting

### No insights extracted
- Check if messages meet minimum threshold
- Verify Claude API is working
- Check if messages contain relevant content

### Duplicate insights
- Enable deduplication in config
- Check if insights are already in profile

### API errors
- Check Claude API key
- Check rate limits
- Check network connectivity

## Future Enhancements

1. **Caching**: Add caching layer for frequently extracted insights
2. **Batch Processing**: Support batch extraction for multiple conversations
3. **Custom Prompts**: Allow custom extraction prompts
4. **Confidence Scores**: Add confidence scores to extracted insights
5. **Trend Analysis**: Track how insights change over time
