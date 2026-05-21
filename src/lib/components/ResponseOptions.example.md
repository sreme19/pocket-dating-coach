# ResponseOptions Component

A component that displays AI-generated response suggestions as selectable cards with options to copy or edit before sending.

## Features

- **Multiple Response Options**: Display 2-3 response options with different tones
- **Tone Differentiation**: Color-coded badges for different tones (playful, warm, direct)
- **Copy to Clipboard**: One-click copy functionality with visual feedback
- **Edit Capability**: Allow users to edit messages before sending
- **Reasoning Display**: Show why each response works strategically
- **Citations**: Display citations grounded in book principles or preferences
- **Mobile Responsive**: Horizontal scrollable list on mobile, grid layout on desktop
- **Loading State**: Show loading indicator while generating options
- **Empty State**: Handle cases with no options available
- **Keyboard Accessible**: Full keyboard navigation support

## Usage

### Basic Usage

```svelte
<script>
  import ResponseOptions from '$lib/components/ResponseOptions.svelte';
  import type { ResponseOption } from '$lib/server/ai-assistant-service';

  let options: ResponseOption[] = [
    {
      id: 'option-1',
      tone: 'playful',
      message: 'That sounds amazing! I love hiking too. What\'s your favorite trail?',
      why: 'Matches his energy and shows genuine interest in his hobbies',
      citation: 'Based on: Compatibility Signals'
    },
    {
      id: 'option-2',
      tone: 'warm',
      message: 'I\'d love to hear more about your hiking adventures. What draws you to it?',
      why: 'Shows curiosity and invites deeper conversation',
      citation: 'Based on: Building Genuine Connection'
    },
    {
      id: 'option-3',
      tone: 'direct',
      message: 'Hiking is great. Are you looking for someone to join you on adventures?',
      why: 'Clarifies intentions and moves toward compatibility assessment',
      citation: 'Based on: Authentic Communication'
    }
  ];

  function handleSelect(option: ResponseOption) {
    console.log('Selected option:', option);
    // Copy to input field or send directly
  }

  function handleEdit(option: ResponseOption) {
    console.log('Edit option:', option);
    // Open edit modal or populate input field
  }
</script>

<ResponseOptions 
  {options}
  onSelect={handleSelect}
  onEdit={handleEdit}
/>
```

### With Loading State

```svelte
<script>
  import ResponseOptions from '$lib/components/ResponseOptions.svelte';
  
  let isLoading = true;
  let options = [];

  // Simulate loading
  setTimeout(() => {
    isLoading = false;
    options = [/* ... */];
  }, 2000);
</script>

<ResponseOptions 
  {options}
  isLoading={isLoading}
/>
```

### With Event Handlers

```svelte
<script>
  import ResponseOptions from '$lib/components/ResponseOptions.svelte';
  import type { ResponseOption } from '$lib/server/ai-assistant-service';

  let options: ResponseOption[] = [/* ... */];
  let selectedMessage = '';

  function handleSelect(option: ResponseOption) {
    selectedMessage = option.message;
    // Populate input field with selected message
  }

  function handleEdit(option: ResponseOption) {
    selectedMessage = option.message;
    // Open edit modal where user can modify the message
  }
</script>

<div class="space-y-4">
  <ResponseOptions 
    {options}
    onSelect={handleSelect}
    onEdit={handleEdit}
  />
  
  {#if selectedMessage}
    <div class="p-4 bg-gray-800 rounded-lg">
      <p class="text-sm text-gray-400 mb-2">Selected message:</p>
      <p class="text-gray-200">{selectedMessage}</p>
    </div>
  {/if}
</div>
```

### In Chat Context

```svelte
<script>
  import ResponseOptions from '$lib/components/ResponseOptions.svelte';
  import type { ResponseOption } from '$lib/server/ai-assistant-service';

  let responseOptions: ResponseOption[] = [];
  let showOptions = false;

  async function generateOptions() {
    showOptions = true;
    // Call API to generate options
    const response = await fetch('/api/ai-bestie/generate-options', {
      method: 'POST',
      body: JSON.stringify({
        conversationId: 'conv-123',
        matchLastMessage: 'What do you like to do for fun?'
      })
    });
    responseOptions = await response.json();
  }

  function handleSelectOption(option: ResponseOption) {
    // Copy to message input
    const input = document.querySelector('input[type="text"]') as HTMLInputElement;
    if (input) {
      input.value = option.message;
      input.focus();
    }
  }
</script>

<div class="space-y-4">
  <button onclick={generateOptions} class="px-4 py-2 bg-blue-600 rounded">
    Get Response Options
  </button>

  {#if showOptions}
    <ResponseOptions 
      options={responseOptions}
      onSelect={handleSelectOption}
    />
  {/if}
</div>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `options` | `ResponseOption[]` | `[]` | Array of response options to display |
| `onSelect` | `(option: ResponseOption) => void` | `undefined` | Callback when user selects an option |
| `onEdit` | `(option: ResponseOption) => void` | `undefined` | Callback when user clicks edit button |
| `isLoading` | `boolean` | `false` | Show loading state while generating options |

## ResponseOption Type

```typescript
interface ResponseOption {
  id?: string;
  tone: 'playful' | 'warm' | 'direct';
  message: string;
  why: string;
  citation?: string;
  feedback?: 'up' | 'down' | null;
}
```

## Styling

### Tone Color Scheme

**Playful (Amber)**
- Border: `border-amber-500/30`
- Background: `bg-amber-500/10`
- Badge: `bg-amber-500/20 text-amber-300 border-amber-500/30`

**Warm (Rose)**
- Border: `border-rose-500/30`
- Background: `bg-rose-500/10`
- Badge: `bg-rose-500/20 text-rose-300 border-rose-500/30`

**Direct (Blue)**
- Border: `border-blue-500/30`
- Background: `bg-blue-500/10`
- Badge: `bg-blue-500/20 text-blue-300 border-blue-500/30`

### Layout

**Mobile (< 768px)**
- Horizontal scrollable list
- Fixed width cards (320px)
- Full-width buttons
- Compact spacing

**Desktop (≥ 768px)**
- Grid layout (1-3 columns depending on screen size)
- Responsive card sizing
- Side-by-side buttons
- Generous spacing

## Accessibility

- Full keyboard navigation support
- Proper ARIA roles and labels
- Focus states for all interactive elements
- Semantic HTML structure
- Clear visual feedback for interactions
- Screen reader friendly

## Interactions

### Copy to Clipboard

- Click "Copy" button to copy message text
- Visual feedback: button changes to show "Copied" with checkmark
- Feedback persists for 2 seconds
- Graceful error handling if copy fails

### Edit Message

- Click "Edit" button to trigger edit callback
- Parent component can populate input field or open modal
- User can modify message before sending
- Original message remains unchanged

### Select Option

- Click anywhere on card to select it
- Visual feedback: selected card gets highlighted border
- Triggers onSelect callback
- Can be used to populate input field

## States

### Loading State

```svelte
<ResponseOptions 
  options={[]}
  isLoading={true}
/>
```

Shows:
- Animated spinner
- "Generating response options..." message

### Empty State

```svelte
<ResponseOptions 
  options={[]}
  isLoading={false}
/>
```

Shows:
- "No response options available" message

### With Options

```svelte
<ResponseOptions 
  options={[
    { id: '1', tone: 'playful', message: '...', why: '...', citation: '...' },
    { id: '2', tone: 'warm', message: '...', why: '...', citation: '...' },
    { id: '3', tone: 'direct', message: '...', why: '...', citation: '...' }
  ]}
/>
```

Shows:
- Cards with tone badges
- Message preview (line-clamped)
- Why explanation
- Citation
- Copy and Edit buttons

## Mobile Responsiveness

### Mobile View (< 768px)

- Horizontal scrollable container
- Fixed-width cards (320px)
- Full-width buttons within cards
- Compact spacing
- Touch-friendly button sizes

### Desktop View (≥ 768px)

- Grid layout with responsive columns
- 1 column on tablets
- 2 columns on large screens
- 3 columns on extra-large screens
- Larger cards with more breathing room

## Examples in Context

### In AI Bestie Chat

```svelte
<div class="space-y-4">
  <div class="bg-gray-900 rounded-lg p-4">
    <p class="text-gray-200">
      He just asked: "What do you like to do for fun?"
    </p>
  </div>

  <ResponseOptions 
    options={bestieSuggestions}
    onSelect={handleSelectBestieOption}
    onEdit={handleEditBestieOption}
  />

  <div class="flex gap-2">
    <input 
      type="text" 
      placeholder="Your response..."
      class="flex-1 px-4 py-2 bg-gray-800 rounded"
    />
    <button class="px-4 py-2 bg-rose-600 rounded">Send</button>
  </div>
</div>
```

### In AI Wingman Chat

```svelte
<div class="space-y-4">
  <div class="bg-gray-900 rounded-lg p-4">
    <p class="text-gray-200">
      She asked: "Tell me about yourself"
    </p>
  </div>

  <ResponseOptions 
    options={wingmanSuggestions}
    onSelect={handleSelectWingmanOption}
    onEdit={handleEditWingmanOption}
  />

  <div class="flex gap-2">
    <input 
      type="text" 
      placeholder="Your response..."
      class="flex-1 px-4 py-2 bg-gray-800 rounded"
    />
    <button class="px-4 py-2 bg-blue-600 rounded">Send</button>
  </div>
</div>
```

## Testing

The component includes comprehensive unit tests covering:
- Rendering with different response options
- Tone color differentiation
- Copy to clipboard functionality
- Edit button interactions
- Loading state
- Empty state
- Mobile vs desktop layout
- Keyboard accessibility
- Edge cases

Run tests with:
```bash
npm test src/lib/components/ResponseOptions.test.ts
```

## Requirements Covered

- **Requirement 3.7**: Display 2-3 response options as cards (AI Bestie)
- **Requirement 4.7**: Display 2-3 response options as cards (AI Wingman)
- **Requirement 6.2**: Show tone, message, and reasoning
- **Requirement 6.3**: Include "Copy to clipboard" button
- **Requirement 6.4**: Allow user to edit before sending
- **Requirement 14.1**: Mobile: scrollable horizontal list
- **Requirement 14.2**: Desktop: grid layout
- **Requirement 14.5**: Mobile responsiveness for response options
- **Requirement 14.6**: Desktop responsiveness for response options
