# Android Release Handoff Document

## Status
The Android App Bundle (AAB) has been successfully built and is ready for upload to Google Play Console.

## What Was Done
1. Configured release signing in `mobile/android/app/build.gradle.kts`
2. Created `mobile/android/key.properties` with signing credentials
3. Used `release.keystore` with alias `pocket-dating-coach`
4. Built release AAB successfully

## Built AAB Location
```
mobile/build/app/outputs/bundle/release/app-release.aab
```
Size: 75.7MB

## Signing Config Used
- Keystore file: `mobile/android/app/upload-keystore.jks` (copied from `release.keystore`)
- Key alias: `pocket-dating-coach`
- Store password: converzate@2019
- Key password: converzate@2019

## key.properties (mobile/android/key.properties)
```
storePassword=converzate@2019
keyPassword=converzate@2019
keyAlias=pocket-dating-coach
storeFile=upload-keystore.jks
```

## build.gradle.kts Changes (mobile/android/app/build.gradle.kts)
Added keystore signing config replacing the debug signing config for release builds.

## Upload to Play Console
1. Go to Google Play Console → Riteangle app
2. Open Testing → Closed Testing (Alpha)
3. Create new release
4. Upload `app-release.aab`
5. Release name: `1.0.1 (13)`
6. Release notes:
```
- Push notifications support
- New app icon and splash screen
- Bug fixes for onboarding and matchmaking preferences
- Various UI and stability improvements
```
7. Save → Review → Start rollout

## App Info
- App ID: `com.pocketdatingcoach.verified_vibe`
- Version: `1.0.1+13`
- Platform: Flutter

## Important Notes
- `key.properties` and `upload-keystore.jks` are in `.gitignore` — do not commit them
- The AAB is already signed and ready to upload directly
