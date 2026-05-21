# CompatibilityFlags Component

The `CompatibilityFlags` component displays compatibility analysis results with visual indicators for green, yellow, and red flags.

## Features

- **Visual Indicators**: Green (✅), Yellow (⚠️), and Red (🚩) flags with color-coded styling
- **Expandable Sections**: Each flag group can be expanded/collapsed independently
- **Detailed Reasoning**: Each flag includes a signal and detailed reasoning
- **Citations**: Shows sources for the analysis at the bottom
- **Overall Assessment**: Displays a summary assessment at the top
- **Loading State**: Shows a spinner while analysis is being generated
- **Responsive Design**: Works on mobile and desktop

## Usage

```svelte
<script>
  import CompatibilityFlags from '$lib/components/CompatibilityFlags.svelte';
  import type { CompatibilityAnalysis } from '$lib/server/ai-assistant-service';

  let analysis: CompatibilityAnalysis = {
    greenFlags: [
      { signal: 'Asks about your interests', reason: 'Shows genuine curiosity and engagement' },
      { signal: 'Mentions shared hobbies', reason: 'Indicates compatibility in lifestyle' }
    ],
    yellowFlags: [
      { signal: 'Mentions travel early', reason: 'Could indicate expensive lifestyle expectations' }
    ],
    redFlags: [
      { signal: 'Dismissive of your career', reason: 'Conflicts with your value of ambition' }
    ],
    overallAssessment: 'This person shows promise but has some concerns to explore further.',
    citations: ['Based on: Compatibility Signals', 'Based on: Your Preferences']
  };

  let isLoading = false;
</script>

<CompatibilityFlags {analysis} {isLoading} />
```

## Props

- `analysis` (CompatibilityAnalysis, required): The compatibility analysis data containing flags and assessment
- `isLoading` (boolean, optional): Whether the analysis is currently being generated (default: false)

## Data Structure

```typescript
interface CompatibilityAnalysis {
  greenFlags: Array<{ signal: string; reason: string }>;
  yellowFlags: Array<{ signal: string; reason: string }>;
  redFlags: Array<{ signal: string; reason: string }>;
  overallAssessment: string;
  citations: string[];
}
```

## Styling

The component uses Tailwind CSS with a dark theme:
- **Green flags**: Green color scheme (green-300, green-500)
- **Yellow flags**: Yellow color scheme (yellow-300, yellow-500)
- **Red flags**: Red color scheme (red-300, red-500)
- **Background**: Dark gray with subtle borders

## Accessibility

- Expandable sections use semantic buttons with proper ARIA attributes
- Icons from lucide-svelte for visual clarity
- Color coding combined with icons for colorblind accessibility
- Proper contrast ratios for readability

## Examples

### Basic Usage
```svelte
<CompatibilityFlags {analysis} />
```

### With Loading State
```svelte
<CompatibilityFlags {analysis} isLoading={true} />
```

### Empty State
When all flag arrays are empty, the component displays a message indicating no analysis is available.
