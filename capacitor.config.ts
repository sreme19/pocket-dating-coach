import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor configuration for Pocket Dating Coach.
 *
 * Platform-agnostic design (Requirement 10.1):
 * - appId, appName, webDir, server, and plugins are shared across all platforms.
 * - The `android` block below is platform-specific but does NOT require removal for iOS.
 *   Capacitor ignores platform-specific blocks on other platforms gracefully.
 * - When adding iOS support, simply run `npx cap add ios` — no config changes needed.
 */
const config: CapacitorConfig = {
  appId: 'com.pocketdatingcoach.app',
  appName: 'Pocket Dating Coach',
  webDir: 'build',
  server: {
    url: 'https://pocket-dating-coach.vercel.app',
    cleartext: false
  },
  android: {
    // Platform-specific: ignored on iOS. Prevents mixed HTTP/HTTPS content in Android WebView.
    allowMixedContent: false
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    }
  }
};

export default config;
