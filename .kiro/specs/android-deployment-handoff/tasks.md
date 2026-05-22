# Implementation Plan: Android Deployment Handoff

## Overview

Wrap the existing SvelteKit app (deployed on Vercel) inside a native Android shell using Capacitor. The native app loads the live Vercel URL directly, adds push notifications via FCM for genuine native value, and produces a signed AAB for Play Store submission. All server-side logic remains untouched.

## Tasks

- [x] 1. Install Capacitor and configure project
  - [x] 1.1 Install Capacitor core dependencies and create config
    - Run `npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/push-notifications`
    - Create `capacitor.config.ts` at project root with `appId: 'com.pocketdatingcoach.app'`, `appName: 'Pocket Dating Coach'`, `webDir: 'build'`, `server.url` pointing to production Vercel URL, `server.cleartext: false`, and push notification presentation options (`badge`, `sound`, `alert`)
    - Update `package.json` with Capacitor scripts: `cap:sync`, `cap:open`, `cap:build`
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6_

  - [ ]* 1.2 Write property tests for Capacitor config validation
    - **Property 1: Config Immutability** — For any generated config, `appId` matches `com.pocketdatingcoach.app` and conforms to reverse-domain format
    - **Property 2: HTTPS Enforcement** — For any URL in `server.url`, the protocol is always HTTPS and `cleartext` is always `false`
    - **Validates: Requirements 1.1, 1.3, 11.1**

- [x] 2. Add Android platform and configure native shell
  - [x] 2.1 Initialize Android platform
    - Run `npx cap add android` to generate the `android/` directory
    - Verify `AndroidManifest.xml` declares `INTERNET` and `POST_NOTIFICATIONS` permissions
    - Set `minSdk: 22`, `targetSdk: 34`, `compileSdk: 34` in `app/build.gradle`
    - Configure `singleTask` launch mode and `portrait` orientation in manifest
    - _Requirements: 2.1, 2.2, 2.5_

  - [x] 2.2 Implement WebView navigation and lifecycle handling
    - Override back button to navigate WebView history before exiting app
    - Implement instance state save/restore for WebView URL on process death
    - Add fallback to configured `server.url` if restored URL fails to load
    - Configure WebView to block navigation to external domains (open in system browser)
    - Add SSL error handling to block navigation and show security warning
    - _Requirements: 2.3, 2.4, 2.6, 2.7, 3.2, 3.5_

  - [x] 2.3 Add splash screen and loading states
    - Configure branded splash screen displayed during WebView load (max 10 seconds)
    - Add loading indicator visible while remote content loads
    - Dismiss splash/indicator once page finishes loading
    - _Requirements: 2.8, 3.4_

- [x] 3. Checkpoint - Ensure Capacitor builds and WebView loads
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement push notification client-side integration
  - [x] 4.1 Create push notification registration module
    - Create `src/lib/push-notifications.ts` with functions to request permissions, register with FCM, and handle token events
    - Implement permission request on first launch after install
    - On registration success, forward token to backend API with authenticated user ID
    - Handle registration errors gracefully (log, continue without notifications)
    - Handle permission denial (do not re-prompt, continue without notifications)
    - _Requirements: 4.1, 4.2, 4.3, 4.8, 4.9_

  - [x] 4.2 Implement notification event handlers
    - Handle foreground notifications: display in-app banner with title, body, badge, sound
    - Handle background notifications: system notification tray (native default)
    - Handle notification tap with deep link: navigate WebView to `deepLink` route
    - Handle notification tap without deep link: bring app to foreground, show last screen
    - _Requirements: 4.4, 4.5, 4.6, 4.7_

  - [x] 4.3 Implement token lifecycle management
    - Re-register token on each app launch (tokens can rotate)
    - On user logout: delete token from local storage and send removal request to backend
    - Clear WebView cookies, local storage, session storage on logout
    - _Requirements: 4.10, 5.3, 11.5_

- [x] 5. Implement backend API for device token management
  - [x] 5.1 Create Supabase migration for device_tokens table
    - Create table with columns: `id` (uuid), `user_id` (references auth.users), `token` (varchar 256), `platform` (enum: 'android', 'ios'), `created_at` (timestamptz)
    - Add unique constraint on `(user_id, platform)` to enforce one token per user per platform
    - Create RLS policies: SELECT, INSERT, UPDATE, DELETE restricted to `auth.uid() = user_id`
    - _Requirements: 5.1, 5.2, 5.7, 11.4_

  - [x] 5.2 Create POST /api/push/register endpoint
    - Validate authenticated Supabase session
    - Accept `{ token, platform }` payload; derive `userId` from session
    - Upsert token (replace existing for same userId + platform)
    - Return 401 for unauthenticated requests, 400 for invalid payload
    - _Requirements: 5.3, 5.4, 5.5_

  - [x] 5.3 Create DELETE /api/push/unregister endpoint
    - Validate authenticated Supabase session
    - Delete device token record for authenticated user and specified platform
    - Return 200 on success, 401 for unauthenticated requests
    - _Requirements: 4.10, 5.2_

  - [ ]* 5.4 Write unit tests for token management endpoints
    - Test successful registration with valid session
    - Test rejection of unauthenticated requests
    - Test upsert behavior (replace existing token)
    - Test unregister removes token
    - _Requirements: 5.3, 5.4, 5.5_

- [x] 6. Implement notification payload construction
  - [x] 6.1 Create notification payload builder
    - Create `src/lib/server/notifications.ts` with `buildNotificationPayload()` function
    - Enforce title max 65 chars, body max 240 chars (truncate if exceeded)
    - Include `type` discriminator limited to: `conversation_reminder`, `follow_up_prompt`, `profile_tip`
    - Include `deepLink` as relative path starting with `/` when applicable
    - Construct payload with both `notification` object and `data` object
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.6_

  - [x] 6.2 Create notification send function
    - Create `sendNotification()` that sends payload to FCM HTTP API
    - Only send to tokens that exist in storage and are not flagged invalid
    - On FCM delivery failure due to invalid token, remove token from database
    - _Requirements: 6.5, 5.6_

  - [ ]* 6.3 Write property tests for notification payload construction
    - **Property 5: Notification Payload Bounds** — For any generated title (arbitrary string), output title ≤ 65 chars; for any generated body, output body ≤ 240 chars; `type` is always one of the three valid discriminators
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4**

- [x] 7. Checkpoint - Ensure push notification flow works end-to-end
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement offline graceful degradation
  - [x] 8.1 Add offline detection and UI states
    - Implement full-screen offline state with offline icon, message, and manual retry button
    - Add network connectivity listener to auto-retry within 3 seconds of restoration
    - Implement retry logic: max 3 attempts with 5-second intervals before showing offline state
    - Ensure no crashes or unhandled exceptions while offline
    - Retain last successfully loaded WebView content visible on screen during offline
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 1.7_

  - [ ]* 8.2 Write property tests for offline graceful degradation
    - **Property 7: Offline Graceful Degradation** — For any app state and any sequence of simulated network failures, the app state machine never enters a crash/unhandled state
    - **Validates: Requirements 9.1, 9.3**

- [x] 9. Configure release signing
  - [x] 9.1 Set up release signing configuration
    - Create signing config in `android/app/build.gradle` referencing keystore path, alias, and passwords from environment variables or local properties file
    - Configure release build type to use the signing config
    - Configure debug build type to use default debug keystore only
    - Document keystore generation command: `keytool -genkey -v -keystore release.keystore -alias pocket-dating-coach -keyalg RSA -keysize 2048 -validity 10000`
    - _Requirements: 7.1, 7.2, 7.6, 7.7, 7.8_

  - [x] 9.2 Configure version management
    - Set initial `versionCode: 1` and `versionName: '1.0.0'` in `build.gradle`
    - Add comments documenting that `versionCode` must be strictly incremented for each Play Store submission
    - _Requirements: 7.3_

- [x] 10. Security hardening
  - [x] 10.1 Update .gitignore and secure secrets
    - Add entries to `.gitignore`: `*.jks`, `*.keystore`, `android/app/release.keystore`, `google-services.json`, `android/app/google-services.json`
    - Verify no server-side API keys (Anthropic, Supabase service role, Voyage, fal.ai) are referenced in any Android source, resource, or asset file
    - Document keystore password storage in secrets manager (not in source)
    - _Requirements: 7.4, 7.5, 11.2_

  - [ ]* 10.2 Write property tests for domain restriction and secret exclusion
    - **Property 9: Domain Restriction** — For any URL string not matching the configured `server.url` origin, the navigation handler returns "block"
    - **Property 10: No Secrets in Client Bundle** — For any string in a set of known secret patterns, the string does not appear in the Android project source files
    - **Validates: Requirements 3.2, 11.2, 11.3**

- [x] 11. Ensure iOS extensibility
  - [x] 11.1 Validate platform-agnostic configuration
    - Verify `capacitor.config.ts` contains no Android-specific fields that would require modification for iOS
    - Verify push notification registration payload accepts both `android` and `ios` platform identifiers
    - Add TypeScript type for platform: `'android' | 'ios'`
    - _Requirements: 10.1, 10.2, 10.3_

  - [ ]* 11.2 Write property tests for platform extensibility
    - **Property 8: Platform Extensibility** — For any valid config object, no field is platform-specific; the device token payload type accepts both `android` and `ios`
    - **Validates: Requirements 10.1, 10.3**

- [x] 12. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The existing SvelteKit source (`src/`), adapter config (`svelte.config.js`), and environment files (`.env.*`) remain unchanged per Property 3 (Server Logic Isolation)
- All implementation uses TypeScript consistent with the existing project
- Testing uses vitest + fast-check as already configured in the project
- The `android/` directory is generated by Capacitor CLI and should be committed to version control for reproducible builds

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "5.1"] },
    { "id": 3, "tasks": ["4.1", "5.2", "5.3", "6.1"] },
    { "id": 4, "tasks": ["4.2", "4.3", "5.4", "6.2"] },
    { "id": 5, "tasks": ["6.3", "8.1"] },
    { "id": 6, "tasks": ["8.2", "9.1"] },
    { "id": 7, "tasks": ["9.2", "10.1"] },
    { "id": 8, "tasks": ["10.2", "11.1"] },
    { "id": 9, "tasks": ["11.2"] }
  ]
}
```
