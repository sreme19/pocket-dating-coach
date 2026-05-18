/**
 * Settings Store
 *
 * Manages user settings state across the application.
 * Provides reactive stores for settings, privacy, and notification preferences.
 */

import { writable, derived } from 'svelte/store';

/**
 * Settings State Type
 */
interface SettingsState {
  profile: {
    firstName: string;
    lastName?: string;
    bio?: string;
    interests?: string[];
    lookingFor?: string;
  };
  account: {
    email: string;
    phone?: string;
    username: string;
  };
  preferences: {
    language: string;
    timezone: string;
    theme: string;
  };
  privacy: {
    profileVisibility: string;
    showOnlineStatus: boolean;
    showLastSeen: boolean;
    allowMessagesFrom: string;
    dataSharing: boolean;
    analyticsTracking: boolean;
  };
  notifications: {
    messageNotifications: boolean;
    messageFrequency: string;
    messageEmail: boolean;
    messagePush: boolean;
    messageSms: boolean;
    matchNotifications: boolean;
    matchFrequency: string;
    matchEmail: boolean;
    matchPush: boolean;
    matchSms: boolean;
    systemNotifications: boolean;
    systemFrequency: string;
    systemEmail: boolean;
    systemPush: boolean;
    systemSms: boolean;
    marketingNotifications: boolean;
    marketingFrequency: string;
    marketingEmail: boolean;
    marketingPush: boolean;
    dndEnabled: boolean;
    dndStartTime?: string;
    dndEndTime?: string;
  };
  blockedUsers: any[];
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  success: string | null;
  lastUpdated: Date | null;
}

/**
 * Initial settings state
 */
const initialState: SettingsState = {
  profile: {
    firstName: '',
    lastName: '',
    bio: '',
    interests: [],
    lookingFor: ''
  },
  account: {
    email: '',
    phone: '',
    username: ''
  },
  preferences: {
    language: 'en',
    timezone: 'UTC',
    theme: 'light'
  },
  privacy: {
    profileVisibility: 'public',
    showOnlineStatus: true,
    showLastSeen: true,
    allowMessagesFrom: 'anyone',
    dataSharing: false,
    analyticsTracking: true
  },
  notifications: {
    messageNotifications: true,
    messageFrequency: 'immediate',
    messageEmail: true,
    messagePush: true,
    messageSms: false,
    matchNotifications: true,
    matchFrequency: 'immediate',
    matchEmail: true,
    matchPush: true,
    matchSms: false,
    systemNotifications: true,
    systemFrequency: 'immediate',
    systemEmail: false,
    systemPush: true,
    systemSms: false,
    marketingNotifications: false,
    marketingFrequency: 'weekly',
    marketingEmail: false,
    marketingPush: false,
    dndEnabled: false,
    dndStartTime: '22:00',
    dndEndTime: '08:00'
  },
  blockedUsers: [],
  isLoading: false,
  isSaving: false,
  error: null,
  success: null,
  lastUpdated: null
};

/**
 * Create settings store
 */
function createSettingsStore() {
  const { subscribe, set, update } = writable<SettingsState>(initialState);

  return {
    subscribe,

    /**
     * Load settings from API
     */
    async loadSettings(userId: string) {
      update((state) => ({ ...state, isLoading: true, error: null }));

      try {
        const response = await fetch(`/api/verified-vibe/settings?userId=${userId}`);

        if (!response.ok) {
          throw new Error('Failed to load settings');
        }

        const { data } = await response.json();

        update((state) => ({
          ...state,
          profile: data.settings.profile || state.profile,
          account: data.settings.account || state.account,
          preferences: data.settings.preferences || state.preferences,
          isLoading: false,
          lastUpdated: new Date()
        }));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to load settings';
        update((state) => ({
          ...state,
          isLoading: false,
          error: errorMessage
        }));
      }
    },

    /**
     * Load privacy settings from API
     */
    async loadPrivacy(userId: string) {
      try {
        const response = await fetch(`/api/verified-vibe/privacy?userId=${userId}`);

        if (!response.ok) {
          throw new Error('Failed to load privacy settings');
        }

        const { data } = await response.json();

        update((state) => ({
          ...state,
          privacy: data.privacy || state.privacy,
          lastUpdated: new Date()
        }));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to load privacy settings';
        update((state) => ({
          ...state,
          error: errorMessage
        }));
      }
    },

    /**
     * Load notification preferences from API
     */
    async loadNotifications(userId: string) {
      try {
        const response = await fetch(`/api/verified-vibe/notification-preferences-extended?userId=${userId}`);

        if (!response.ok) {
          throw new Error('Failed to load notification preferences');
        }

        const { data } = await response.json();

        update((state) => ({
          ...state,
          notifications: data.preferences || state.notifications,
          lastUpdated: new Date()
        }));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to load notification preferences';
        update((state) => ({
          ...state,
          error: errorMessage
        }));
      }
    },

    /**
     * Load blocked users from API
     */
    async loadBlockedUsers(userId: string) {
      try {
        const response = await fetch(`/api/verified-vibe/blocked-users?userId=${userId}&limit=100`);

        if (!response.ok) {
          throw new Error('Failed to load blocked users');
        }

        const { data } = await response.json();

        update((state) => ({
          ...state,
          blockedUsers: data.blockedUsers || [],
          lastUpdated: new Date()
        }));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to load blocked users';
        update((state) => ({
          ...state,
          error: errorMessage
        }));
      }
    },

    /**
     * Save settings to API
     */
    async saveSettings(userId: string, settings: Partial<SettingsState>) {
      update((state) => ({ ...state, isSaving: true, error: null, success: null }));

      try {
        const response = await fetch('/api/verified-vibe/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, settings })
        });

        if (!response.ok) {
          throw new Error('Failed to save settings');
        }

        const { data } = await response.json();

        update((state) => ({
          ...state,
          profile: data.settings.profile || state.profile,
          account: data.settings.account || state.account,
          preferences: data.settings.preferences || state.preferences,
          isSaving: false,
          success: 'Settings saved successfully',
          lastUpdated: new Date()
        }));

        // Clear success message after 3 seconds
        setTimeout(() => {
          update((state) => ({ ...state, success: null }));
        }, 3000);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to save settings';
        update((state) => ({
          ...state,
          isSaving: false,
          error: errorMessage
        }));
      }
    },

    /**
     * Save privacy settings to API
     */
    async savePrivacy(userId: string, privacy: Partial<SettingsState['privacy']>) {
      update((state) => ({ ...state, isSaving: true, error: null, success: null }));

      try {
        const response = await fetch('/api/verified-vibe/privacy', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, privacy })
        });

        if (!response.ok) {
          throw new Error('Failed to save privacy settings');
        }

        const { data } = await response.json();

        update((state) => ({
          ...state,
          privacy: data.privacy || state.privacy,
          isSaving: false,
          success: 'Privacy settings saved successfully',
          lastUpdated: new Date()
        }));

        setTimeout(() => {
          update((state) => ({ ...state, success: null }));
        }, 3000);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to save privacy settings';
        update((state) => ({
          ...state,
          isSaving: false,
          error: errorMessage
        }));
      }
    },

    /**
     * Save notification preferences to API
     */
    async saveNotifications(userId: string, preferences: Partial<SettingsState['notifications']>) {
      update((state) => ({ ...state, isSaving: true, error: null, success: null }));

      try {
        const response = await fetch('/api/verified-vibe/notification-preferences-extended', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, preferences })
        });

        if (!response.ok) {
          throw new Error('Failed to save notification preferences');
        }

        const { data } = await response.json();

        update((state) => ({
          ...state,
          notifications: data.preferences || state.notifications,
          isSaving: false,
          success: 'Notification preferences saved successfully',
          lastUpdated: new Date()
        }));

        setTimeout(() => {
          update((state) => ({ ...state, success: null }));
        }, 3000);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to save notification preferences';
        update((state) => ({
          ...state,
          isSaving: false,
          error: errorMessage
        }));
      }
    },

    /**
     * Clear error message
     */
    clearError() {
      update((state) => ({ ...state, error: null }));
    },

    /**
     * Clear success message
     */
    clearSuccess() {
      update((state) => ({ ...state, success: null }));
    },

    /**
     * Reset to initial state
     */
    reset() {
      set(initialState);
    }
  };
}

/**
 * Export settings store
 */
export const settingsStore = createSettingsStore();

/**
 * Derived stores for specific sections
 */
export const profileStore = derived(settingsStore, ($settings) => $settings.profile);
export const accountStore = derived(settingsStore, ($settings) => $settings.account);
export const preferencesStore = derived(settingsStore, ($settings) => $settings.preferences);
export const privacyStore = derived(settingsStore, ($settings) => $settings.privacy);
export const notificationsStore = derived(settingsStore, ($settings) => $settings.notifications);
export const blockedUsersStore = derived(settingsStore, ($settings) => $settings.blockedUsers);
export const settingsLoadingStore = derived(settingsStore, ($settings) => $settings.isLoading);
export const settingsSavingStore = derived(settingsStore, ($settings) => $settings.isSaving);
export const settingsErrorStore = derived(settingsStore, ($settings) => $settings.error);
export const settingsSuccessStore = derived(settingsStore, ($settings) => $settings.success);
