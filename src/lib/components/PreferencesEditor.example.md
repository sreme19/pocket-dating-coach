# PreferencesEditor Component Example

The `PreferencesEditor` component allows users to view and edit their dating preferences with version tracking and history restoration.

## Basic Usage

```svelte
<script>
  import PreferencesEditor from '$lib/components/PreferencesEditor.svelte';
  import { loadPreferences, updatePreferences } from '$lib/server/profile-service';

  let preferences;
  let isLoading = false;

  onMount(async () => {
    preferences = await loadPreferences(userId);
  });

  async function handleSave(updates, reason) {
    isLoading = true;
    try {
      await updatePreferences(userId, updates, reason);
      preferences = await loadPreferences(userId);
    } finally {
      isLoading = false;
    }
  }
</script>

<PreferencesEditor
  {preferences}
  {isLoading}
  onSave={handleSave}
/>
```

## With Version History

```svelte
<script>
  import PreferencesEditor from '$lib/components/PreferencesEditor.svelte';
  import { loadPreferences, updatePreferences, getPreferencesHistory, restoreProfileVersion } from '$lib/server/profile-service';

  let preferences;
  let versionHistory = [];
  let isLoading = false;

  onMount(async () => {
    preferences = await loadPreferences(userId);
    versionHistory = await getPreferencesHistory(userId);
  });

  async function handleSave(updates, reason) {
    isLoading = true;
    try {
      await updatePreferences(userId, updates, reason);
      preferences = await loadPreferences(userId);
      versionHistory = await getPreferencesHistory(userId);
    } finally {
      isLoading = false;
    }
  }

  async function handleRestoreVersion(versionId) {
    isLoading = true;
    try {
      await restoreProfileVersion(userId, versionId);
      preferences = await loadPreferences(userId);
      versionHistory = await getPreferencesHistory(userId);
    } finally {
      isLoading = false;
    }
  }
</script>

<PreferencesEditor
  {preferences}
  {isLoading}
  onSave={handleSave}
  showVersionHistory={true}
  {versionHistory}
  onRestoreVersion={handleRestoreVersion}
/>
```

## Props

- `preferences` (PreferencesProfile, optional): The user's current preferences
- `isLoading` (boolean, optional): Whether data is being loaded
- `onSave` (function, optional): Callback when user saves changes
- `onCancel` (function, optional): Callback when user cancels
- `showVersionHistory` (boolean, optional): Whether to show version history
- `versionHistory` (ProfileVersion[], optional): Array of previous versions
- `onRestoreVersion` (function, optional): Callback to restore a previous version

## Features

- **Edit all preference fields**: Emotional signals, lifestyle signals, maturity signals, boundaries, dealbreakers, and private notes
- **Add/Remove items**: Users can add new items or remove existing ones
- **Version tracking**: Each save includes a reason and timestamp
- **Version history**: View and restore previous versions
- **Change detection**: Save button only enabled when changes are made
- **Error handling**: Shows error messages if save fails
- **Success feedback**: Displays confirmation when changes are saved
- **Mobile responsive**: Works on mobile and desktop
- **Tips panel**: Helpful guidance for users

## Styling

The component uses Tailwind CSS with a dark theme (gray-800 background). It includes:
- Blue accent color for primary actions
- Red accent color for destructive actions
- Green accent color for success messages
- Responsive grid layout (1 column on mobile, 3 columns on desktop)

## Accessibility

- Semantic HTML with proper labels
- Keyboard navigation support
- ARIA attributes for screen readers
- Clear error and success messages
- Disabled states for buttons during loading
