# Summary Generator Service

## Overview

The Summary Generator service creates hourly summaries of all active AI Bestie and AI Wingman conversations for each user. It aggregates insights from conversations, identifies compatibility signals (green/yellow/red flags), and generates recommended next moves.

## Features

- **Hourly Summaries**: Automatically generates summaries for all active conversations
- **Compatibility Analysis**: Identifies green flags, yellow flags, and red flags
- **Conversation Momentum**: Tracks whether conversations are heating up, steady, or cooling down
- **Recommended Next Moves**: Provides actionable suggestions for each match
- **Scheduled Job Support**: Can be triggered by cron services (Vercel Cron, AWS EventBridge, etc.)
- **Graceful Error Handling**: Continues processing even if individual summaries fail
- **History Tracking**: Stores summaries for historical analysis
- **Automatic Cleanup**: Deletes old summaries after 30 days

## Architecture

### Core Components

1. **Summary Generator** (`summary-generator.ts`)
   - Main service for generating summaries
   - Handles conversation analysis and Claude API calls
   - Manages Supabase storage

2. **Scheduled Job Endpoints**
   - `/api/ai-bestie/summary-job` - Generates summaries for female users
   - `/api/ai-wingman/summary-job` - Generates summaries for male users

3. **Summary Retrieval Endpoint**
   - `/api/ai-bestie/summary` - Retrieves summaries for display

## Usage

### Generating Summaries for a Single User

```typescript
import { generateHourlySummaries } from '$lib/server/summary-generator';

// Generate summaries for a female user (AI Bestie)
const result = await generateHourlySummaries('user-id-123', 'bestie');

// Generate summaries for a male user (AI Wingman)
const result = await generateHourlySummaries('user-id-456', 'wingman');

// With custom configuration
const result = await generateHourlySummaries('user-id-123', 'bestie', {
  minMessagesForSummary: 3,
  maxRecentMessages: 15,
  maxInsightsPerCategory: 5
});
```

### Generating Summaries for All Users

```typescript
import { generateAllHourlySummaries } from '$lib/server/summary-generator';

// Generate summaries for all users with active conversations
const result = await generateAllHourlySummaries();

// Returns: { processed: 5, failed: 0, errors: [] }
```

### Retrieving Summaries

```typescript
import { getLatestSummary, getSummaryHistory } from '$lib/server/summary-generator';

// Get the most recent summary for a user
const latest = await getLatestSummary('user-id-123', 'bestie');

// Get summary history (last 24 hours)
const history = await getSummaryHistory('user-id-123', 'bestie', 24);
```

### Cleaning Up Old Summaries

```typescript
import { deleteOldSummaries } from '$lib/server/summary-generator';

// Delete summaries older than 30 days
const result = await deleteOldSummaries(30);

// Returns: { deleted: 42 }
```

## Setting Up Scheduled Jobs

### Option 1: Vercel Cron

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/ai-bestie/summary-job",
      "schedule": "0 * * * *"
    },
    {
      "path": "/api/ai-wingman/summary-job",
      "schedule": "0 * * * *"
    }
  ]
}
```

### Option 2: AWS EventBridge

Create a rule that triggers the endpoint every hour:

```bash
aws events put-rule \
  --name ai-bestie-summary-job \
  --schedule-expression "rate(1 hour)"

aws events put-targets \
  --rule ai-bestie-summary-job \
  --targets "Id"="1","Arn"="arn:aws:lambda:...","RoleArn"="arn:aws:iam::..."
```

### Option 3: External Cron Service (e.g., EasyCron, cron-job.org)

Set up a POST request to:
- `https://your-domain.com/api/ai-bestie/summary-job`
- `https://your-domain.com/api/ai-wingman/summary-job`

With header:
```
Authorization: Bearer <CRON_SECRET>
```

### Option 4: Manual Trigger

Call the endpoint manually:

```bash
curl -X POST https://your-domain.com/api/ai-bestie/summary-job \
  -H "Authorization: Bearer <CRON_SECRET>"
```

## Environment Variables

Required environment variables:

```env
# Cron job authentication
CRON_SECRET=your-secret-key-here

# Supabase (already configured)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key

# Claude API (already configured)
ANTHROPIC_API_KEY=your-api-key

# Embeddings (already configured)
VOYAGE_API_KEY=your-api-key
```

## Data Structure

### MatchSummary

```typescript
interface MatchSummary {
  matchId: string;
  matchName?: string;
  matchProfile?: Partial<UserProfile>;
  keyInsights: string[];           // 2-3 key insights from conversation
  greenFlags: string[];             // Positive compatibility signals
  yellowFlags: string[];            // Neutral signals needing clarification
  redFlags: string[];               // Concerning signals
  recommendedNextMove: string;      // Actionable next step
  conversationMomentum: 'heating_up' | 'steady' | 'cooling_down';
  lastMessageTime: number;          // Timestamp of last message
  messageCount: number;             // Total messages in conversation
}
```

### HourlySummaryData

```typescript
interface HourlySummaryData {
  userId: string;
  summaries: MatchSummary[];
  generatedAt: number;
  totalMatches: number;
  assistantType: 'bestie' | 'wingman';
}
```

## Configuration Options

```typescript
interface SummaryGenerationConfig {
  minMessagesForSummary: number;      // Minimum messages to generate summary (default: 2)
  maxRecentMessages: number;          // Max recent messages to analyze (default: 10)
  maxInsightsPerCategory: number;     // Max insights per category (default: 3)
  bookContextChunks: number;          // Number of book chunks to retrieve (default: 5)
  includeYellowFlags: boolean;        // Include yellow flags in summary (default: true)
  includeRedFlags: boolean;           // Include red flags in summary (default: true)
}
```

## Conversation Momentum Analysis

The service analyzes conversation momentum based on:

1. **Message Length**: Longer messages indicate more engagement
2. **Question Count**: More questions indicate higher interest
3. **Exclamation Marks**: More enthusiasm indicators
4. **Recent Patterns**: Focuses on last 5 messages

### Momentum Levels

- **heating_up**: Long messages, multiple questions, high engagement
- **steady**: Consistent engagement, balanced conversation
- **cooling_down**: Short messages, few questions, declining engagement

## Error Handling

The service handles errors gracefully:

1. **Missing Profile Data**: Falls back to default system prompt
2. **Claude API Failures**: Skips individual conversations, continues with others
3. **Database Errors**: Returns empty summaries, logs error
4. **Parsing Errors**: Uses default values, continues processing
5. **Missing Book Context**: Continues without book context

## Performance Considerations

- **Caching**: Profile data is cached for 5 minutes
- **Batch Processing**: Processes all users in a single job
- **Parallel Processing**: Can be optimized to process users in parallel
- **Database Indexes**: Uses indexes on `user_id`, `assistant_type`, `is_active`

## Monitoring

### Logs to Check

```bash
# View summary generation logs
tail -f logs/summary-generator.log

# Check for errors
grep "ERROR" logs/summary-generator.log

# Monitor job execution
grep "summary-job" logs/api.log
```

### Metrics to Track

- Number of summaries generated per hour
- Number of failed summaries
- Average generation time per user
- Claude API call count
- Database query performance

## Testing

Run the test suite:

```bash
npm run test -- summary-generator.test.ts
```

Test specific functionality:

```bash
# Test summary generation
npm run test -- summary-generator.test.ts -t "generateHourlySummaries"

# Test error handling
npm run test -- summary-generator.test.ts -t "error"

# Test momentum analysis
npm run test -- summary-generator.test.ts -t "momentum"
```

## Troubleshooting

### Summaries Not Generating

1. Check `CRON_SECRET` is set correctly
2. Verify endpoint is accessible
3. Check Supabase connection
4. Review logs for errors

### Summaries Are Empty

1. Verify conversations have at least 2 messages
2. Check profile data is loaded correctly
3. Verify Claude API is working
4. Check book context is available

### High Error Rate

1. Check Claude API rate limits
2. Verify Supabase connection
3. Check for database query timeouts
4. Review error logs for patterns

### Performance Issues

1. Reduce `maxRecentMessages` in config
2. Reduce `bookContextChunks` in config
3. Implement parallel processing for users
4. Add database indexes if missing

## Future Enhancements

1. **Real-time Summaries**: Generate summaries on-demand instead of hourly
2. **Parallel Processing**: Process multiple users concurrently
3. **Custom Schedules**: Allow users to set custom summary frequencies
4. **Summary Notifications**: Notify users when new summaries are available
5. **Trend Analysis**: Track trends across multiple summaries
6. **Predictive Insights**: Use ML to predict conversation outcomes
7. **Personalized Recommendations**: Tailor recommendations based on user history

## Requirements Mapping

This service implements the following requirements:

- **Requirement 7.1**: Query all active conversations for a user
- **Requirement 7.2**: Extract insights from recent messages in each conversation
- **Requirement 7.3**: Generate a summary of key insights for each match
- **Requirement 42.1**: Create scheduled job to run every hour
- **Requirement 42.2**: Aggregate insights from all active conversations
- **Requirement 42.3**: Generate match summaries with key insights
- **Requirement 42.4**: Generate recommended next moves
- **Requirement 42.5**: Store summaries in Supabase
- **Requirement 42.6**: Handle scheduling (can be called hourly or on-demand)
- **Requirement 42.7**: Support both AI Bestie and AI Wingman contexts
- **Requirement 42.8**: Handle errors gracefully

## API Endpoints

### POST /api/ai-bestie/summary-job

Generates hourly summaries for all female users.

**Headers:**
```
Authorization: Bearer <CRON_SECRET>
```

**Response:**
```json
{
  "success": true,
  "processed": 5,
  "failed": 0,
  "errors": [],
  "cleaned": 10,
  "message": "Hourly summaries generated successfully..."
}
```

### POST /api/ai-wingman/summary-job

Generates hourly summaries for all male users.

**Headers:**
```
Authorization: Bearer <CRON_SECRET>
```

**Response:**
```json
{
  "success": true,
  "processed": 3,
  "failed": 0,
  "errors": [],
  "cleaned": 5,
  "message": "Hourly summaries generated successfully..."
}
```

### POST /api/ai-bestie/summary

Retrieves summaries for a specific user.

**Request:**
```json
{
  "userId": "user-id-123"
}
```

**Response:**
```json
{
  "summaries": [
    {
      "matchId": "match-1",
      "matchName": "John",
      "keyInsights": ["Very engaged", "Shares interests"],
      "greenFlags": ["Asks questions"],
      "yellowFlags": [],
      "redFlags": [],
      "recommendedNextMove": "Suggest meeting this week",
      "conversationMomentum": "heating_up",
      "lastMessageTime": 1704067200000,
      "messageCount": 15
    }
  ],
  "lastUpdated": 1704067200000,
  "totalMatches": 1
}
```

## Support

For issues or questions, please refer to:
- Design Document: `design.md`
- Requirements Document: `requirements.md`
- Task List: `tasks.md`
