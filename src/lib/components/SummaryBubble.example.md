# SummaryBubble Component Examples

The `SummaryBubble` component displays hourly summaries of all matches with AI Bestie insights, including key insights, compatibility flags, conversation momentum, and recommended next moves.

## Basic Usage

```svelte
<script>
  import SummaryBubble from '$lib/components/SummaryBubble.svelte';
  import type { MatchSummary } from '$lib/routes/api/ai-bestie/summary/+server';

  let summaries: MatchSummary[] = [];
  let lastUpdated = Date.now();

  onMount(async () => {
    const response = await fetch('/api/ai-bestie/summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await response.json();
    summaries = data.summaries;
    lastUpdated = data.lastUpdated;
  });
</script>

<SummaryBubble {summaries} {lastUpdated} />
```

## With Refresh Functionality

```svelte
<script>
  import SummaryBubble from '$lib/components/SummaryBubble.svelte';
  import type { MatchSummary } from '$lib/routes/api/ai-bestie/summary/+server';

  let summaries: MatchSummary[] = [];
  let lastUpdated = Date.now();
  let isLoading = false;

  async function loadSummaries() {
    isLoading = true;
    try {
      const response = await fetch('/api/ai-bestie/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      summaries = data.summaries;
      lastUpdated = data.lastUpdated;
    } finally {
      isLoading = false;
    }
  }

  onMount(loadSummaries);
</script>

<SummaryBubble {summaries} {lastUpdated} {isLoading} onRefresh={loadSummaries} />
```

## Example Data Structure

```typescript
const exampleSummaries: MatchSummary[] = [
  {
    matchId: 'match-1',
    matchName: 'John',
    matchProfile: {
      gender: 'man',
      ageRange: '28-32',
      datingApp: 'hinge',
      relationshipGoal: 'serious'
    },
    keyInsights: [
      'Very engaged in conversation - responds quickly and thoughtfully',
      'Shares your values around career and personal growth',
      'Shows genuine interest in your hobbies and interests'
    ],
    greenFlags: [
      'Asks thoughtful follow-up questions',
      'Shows vulnerability and emotional depth',
      'Respects your boundaries'
    ],
    yellowFlags: [
      'Mentions travel frequently - could indicate expensive lifestyle',
      'Recently out of a long-term relationship'
    ],
    redFlags: [],
    recommendedNextMove: 'Suggest meeting for coffee this week - momentum is strong',
    conversationMomentum: 'heating_up',
    lastMessageTime: 1704067200000,
    messageCount: 23
  },
  {
    matchId: 'match-2',
    matchName: 'Mike',
    keyInsights: [
      'Casual conversation style - mostly surface-level topics',
      'Limited engagement with your interests'
    ],
    greenFlags: [
      'Respectful tone throughout'
    ],
    yellowFlags: [
      'Takes hours to respond',
      'Conversations feel one-sided'
    ],
    redFlags: [
      'Dismissive of your career goals',
      'Makes assumptions about your preferences'
    ],
    recommendedNextMove: 'Consider moving on - compatibility seems low',
    conversationMomentum: 'cooling_down',
    lastMessageTime: 1704063600000,
    messageCount: 8
  }
];
```

## Features

### Mobile Layout
- Compact card layout with match name and message count
- First key insight visible in preview (on larger screens)
- Flags summary with emoji indicators (🟢 🟡 🔴)
- Momentum indicator with icon
- Tap to expand for full details
- Optimized spacing for small screens

### Desktop Layout
- Expandable panel with full details
- All key insights visible in preview
- Detailed flag breakdown with reasoning
- Recommended next move section
- Conversation momentum with visual indicator
- Hover effects for better interactivity

### Key Features
1. **Hourly Summaries** - Aggregated insights from all active conversations
2. **Compatibility Flags** - Green/yellow/red flags with visual indicators
3. **Conversation Momentum** - Shows if conversation is heating up, steady, or cooling down
4. **Recommended Next Moves** - AI-generated suggestions for next action
5. **Key Insights** - 2-3 sentence summaries of important conversation points
6. **Message Count** - Shows total messages in conversation
7. **Last Message Time** - Displays when the last message was sent
8. **Refresh Functionality** - Manual refresh button to update summaries
9. **Loading State** - Shows spinner while loading
10. **Empty State** - Helpful message when no conversations exist

## Responsive Behavior

### Mobile (< 640px)
- Compact card layout
- First insight hidden (tap to expand)
- Flags shown as emoji summary
- Full details in expanded view
- Optimized touch targets

### Desktop (≥ 640px)
- Expanded card layout
- First insight visible in preview
- Flags shown with labels
- Hover effects
- Better spacing and typography

## Styling

The component uses Tailwind CSS with a dark theme:
- Background: `bg-gray-800/20` with `border-gray-700`
- Text: `text-gray-100` for primary, `text-gray-400` for secondary
- Flags: Color-coded (green, yellow, red) with semi-transparent backgrounds
- Momentum: Color-coded indicators with icons
- Interactions: Hover states and smooth transitions

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `summaries` | `MatchSummary[]` | `[]` | Array of match summaries to display |
| `lastUpdated` | `number` | `0` | Timestamp of last update |
| `isLoading` | `boolean` | `false` | Whether data is currently loading |
| `onRefresh` | `() => void` | `undefined` | Callback function for refresh button |

## Accessibility

- Semantic HTML structure
- ARIA labels for interactive elements
- Keyboard navigation support
- Color contrast meets WCAG AA standards
- Loading state clearly indicated
- Empty state provides helpful guidance

## Performance

- Efficient rendering with Svelte reactivity
- Minimal re-renders on prop changes
- Smooth animations and transitions
- Optimized for mobile and desktop
- Lazy loading of expanded details

## Integration

The component integrates with the AI Bestie summary API:

```typescript
// Fetch summaries from API
const response = await fetch('/api/ai-bestie/summary', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
});

const { summaries, lastUpdated, totalMatches } = await response.json();
```

See the API documentation for more details on the summary endpoint.
