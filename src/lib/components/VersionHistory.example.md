# VersionHistory Component

A standalone, reusable component for displaying and managing version history of user profiles (preferences.md and personality.md).

## Features

- **Display version history** in a timeline/list format
- **Show version metadata**: version number, timestamp, and reason for update
- **Expandable details**: Click to view full profile data for each version
- **Restore functionality**: Restore any previous version with confirmation
- **Mobile responsive**: Works seamlessly on mobile and desktop
- **Support for both profile types**: Preferences (female users) and Personality (male users)
- **Loading states**: Shows loading indicators during restore operations
- **Error handling**: Displays error messages if restore fails
- **Success feedback**: Shows success message after successful restore

## Usage

### Basic Usage

```svelte
<script>
  import VersionHistory from '$lib/components/VersionHistory.svelte';
  import type { ProfileVersion } from '$lib/server/profile-service';

  let versions: ProfileVersion[] = [];

  async function handleRestore(versionId: string) {
    // Call API to restore version
    const response = await fetch('/api/preferences/restore', {
      method: 'POST',
      body: JSON.stringify({ versionId })
    });
    
    if (!response.ok) {
      throw new Error('Failed to restore version');
    }
  }
</script>

<VersionHistory
  {versions}
  profileType="preferences"
  onRestore={handleRestore}
/>
```

### With Loading State

```svelte
<script>
  let isLoading = false;

  async function handleRestore(versionId: string) {
    isLoading = true;
    try {
      await restoreVersion(versionId);
    } finally {
      isLoading = false;
    }
  }
</script>

<VersionHistory
  {versions}
  profileType="preferences"
  {isLoading}
  onRestore={handleRestore}
/>
```

### Personality Profile Type

```svelte
<VersionHistory
  {versions}
  profileType="personality"
  onRestore={handleRestore}
/>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `versions` | `ProfileVersion[]` | `[]` | Array of profile versions to display |
| `profileType` | `'preferences' \| 'personality'` | `'preferences'` | Type of profile being displayed |
| `isLoading` | `boolean` | `false` | Whether a restore operation is in progress |
| `onRestore` | `(versionId: string) => Promise<void>` | `undefined` | Callback function when user clicks restore |

## Data Structure

### ProfileVersion

```typescript
interface ProfileVersion {
  id: string;                                    // Unique version ID
  version: number;                               // Version number (1, 2, 3, ...)
  data: PreferencesProfile | PersonalityProfile; // Profile data for this version
  reason: string;                                // Reason for this update
  createdAt: number;                             // Timestamp when version was created
}
```

### PreferencesProfile

```typescript
interface PreferencesProfile {
  emotionalSignals: string[];
  lifestyleSignals: string[];
  maturitySignals: string[];
  boundaries: string[];
  dealbreakers: string[];
  privateCompatibilityNotes: string[];
  updatedAt: number;
}
```

### PersonalityProfile

```typescript
interface PersonalityProfile {
  communicationStyle: string;
  personalityVibe: string;
  mattersMost: string;
  values: string[];
  datingPatterns: string[];
  redFlagsToAvoid: string[];
  updatedAt: number;
}
```

## Behavior

### Empty State
- Shows a friendly message when no versions are provided
- Suggests that version history will appear as the user updates their profile

### Version List
- Displays versions in reverse chronological order (newest first)
- Shows version number, timestamp, and item count
- Marks the current version with a green "Current" badge
- Displays the reason for each update

### Expansion
- Click on a version to expand and view full details
- Shows the complete reason for the update
- Displays all profile data fields for that version
- Shows a restore button for non-current versions

### Restore
- Shows a confirmation dialog before restoring
- Displays loading state while restore is in progress
- Shows success message after successful restore
- Shows error message if restore fails
- Disables restore button during operation

### Mobile Responsive
- Adapts layout for mobile devices
- Scrollable version list
- Scrollable profile data preview
- Touch-friendly buttons and interactions

## Styling

The component uses Tailwind CSS classes and follows the project's design system:

- **Colors**: Gray-800/50 background, gray-700 borders, blue accents
- **Typography**: Consistent font sizes and weights
- **Spacing**: Consistent padding and margins
- **Icons**: Uses lucide-svelte icons (Clock, RotateCcw, AlertCircle, CheckCircle, ChevronDown, ChevronUp)

## Integration Examples

### In a Configuration Page

```svelte
<script>
  import VersionHistory from '$lib/components/VersionHistory.svelte';
  import PreferencesEditor from '$lib/components/PreferencesEditor.svelte';
  import type { ProfileVersion } from '$lib/server/profile-service';

  let preferences;
  let versionHistory: ProfileVersion[] = [];

  onMount(async () => {
    const response = await fetch('/api/preferences/history');
    versionHistory = await response.json();
  });

  async function handleRestore(versionId: string) {
    const response = await fetch('/api/preferences/restore', {
      method: 'POST',
      body: JSON.stringify({ versionId })
    });
    
    if (response.ok) {
      // Reload preferences
      const updated = await fetch('/api/preferences');
      preferences = await updated.json();
    }
  }
</script>

<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
  <PreferencesEditor {preferences} />
  <VersionHistory
    versions={versionHistory}
    profileType="preferences"
    onRestore={handleRestore}
  />
</div>
```

### As a Dedicated Page

```svelte
<!-- src/routes/profile/version-history/+page.svelte -->
<script>
  import VersionHistory from '$lib/components/VersionHistory.svelte';
  import type { PageData } from './$types';

  export let data: PageData;

  async function handleRestore(versionId: string) {
    const response = await fetch('/api/preferences/restore', {
      method: 'POST',
      body: JSON.stringify({ versionId })
    });
    
    if (!response.ok) {
      throw new Error('Failed to restore version');
    }
  }
</script>

<div class="max-w-4xl mx-auto p-6">
  <VersionHistory
    versions={data.versions}
    profileType={data.profileType}
    onRestore={handleRestore}
  />
</div>
```

## Accessibility

- Semantic HTML structure
- Proper button and link roles
- Clear visual indicators for interactive elements
- Descriptive error and success messages
- Keyboard navigation support

## Testing

The component includes comprehensive tests covering:

- Rendering with and without data
- Expansion and collapse functionality
- Restore operations with confirmation
- Error handling
- Loading states
- Mobile responsiveness
- Date formatting
- Profile type handling

Run tests with:
```bash
npm run test -- VersionHistory.test.ts
```

## Requirements

**Validates: Requirements 8.1, 12.1, 12.2**

- **8.1**: Chat History Persistence and Retrieval - Version history is persisted and retrievable
- **12.1**: Profile Data Loading and Caching - Profile versions are loaded and displayed
- **12.2**: Profile Data Loading and Caching - Users can restore previous versions

## Notes

- The component is stateless and relies on props for data
- All async operations (restore) are handled through callbacks
- The component handles confirmation dialogs internally
- Error and success messages auto-dismiss after 3 seconds
- The component is fully responsive and mobile-friendly
