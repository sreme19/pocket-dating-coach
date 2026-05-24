# Android Deployment Handoff
Date: May 22, 2026 | Branch: feature/vv-v2.4-dev

---

## What's Done

| Step | Status | Notes |
|---|---|---|
| Release keystore generated | DONE | `android/release.keystore` |
| `keystore.properties` created | DONE | `android/keystore.properties` |
| Capacitor configured (Live URL mode) | DONE | Points to production Vercel URL |
| Firebase project created | DONE | `android/app/google-services.json` placed |
| SHA-1 fingerprint added to Firebase | DONE | From release keystore |
| Android SDK versions fixed | DONE | minSdk 24, compileSdk 36, targetSdk 35 |
| Release AAB built | DONE | 4.0 MB, signed |
| Privacy policy page created | DONE | Live at production URL |
| Play Console app created | DONE | `com.pocketdatingcoach.app` |
| App content declarations | DONE | All sections completed |
| Store listing text | DONE | Name, short desc, full desc filled in |
| Internal testing track | PENDING | Not started |
| Closed testing (12 testers, 14 days) | PENDING | The main blocker for production |
| Store listing graphics | PENDING | Icon, feature graphic, screenshots |
| Production release | PENDING | Unlocks after closed testing |

---

## Critical File Locations

```
android/release.keystore          — signing key (NEVER COMMIT, NEVER LOSE)
android/keystore.properties       — signing credentials (NEVER COMMIT)
android/app/google-services.json  — Firebase config
android/variables.gradle          — SDK versions (minSdk=24, compileSdk=36, targetSdk=35)
android/app/build.gradle          — release signing config
capacitor.config.ts               — Capacitor config (server.url set to production)
src/routes/privacy-policy/        — privacy policy page
```

---

## Key URLs

| Resource | URL |
|---|---|
| Production app | https://pocket-dating-coach.vercel.app |
| Privacy policy | https://pocket-dating-coach.vercel.app/privacy-policy |
| Play Console | https://play.google.com/console |
| Firebase Console | https://console.firebase.google.com |

---

## Git Status

Feature branch `feature/vv-v2.4-dev` has 3 commits not yet merged to main:

```
3c7d18f fix: correct Capacitor server URL and prerender privacy policy page
c9dbb27 fix: prerender privacy policy page for static Vercel serving
44cf0f9 feat: add privacy policy page and fix Android SDK versions
```

**Before continuing Android work, merge to main:**
```bash
git checkout main
git pull origin main
git merge feature/vv-v2.4-dev
git push origin main
```

---

## How to Build a New Release AAB

Run these commands from the project root whenever you need a new build:

```bash
# Step 1 — sync Capacitor (already done, only needed if code changed)
npx cap sync android

# Step 2 — build the signed AAB
cd android
./gradlew bundleRelease

# Output file:
# android/app/build/outputs/bundle/release/app-release.aab
```

Before each new Play Store submission, increment `versionCode` in `android/app/build.gradle`:
```gradle
versionCode 2        # must be higher than previous submission
versionName "1.0.1"  # human-readable, shown to users
```

---

## Immediate Next Steps (do in this order)

### 1. Merge feature branch to main
```bash
git checkout main && git pull origin main && git merge feature/vv-v2.4-dev && git push origin main
```

### 2. Upload AAB to Closed Testing (starts the 14-day clock)
- Play Console → Testing → Closed testing → Create new release
- Upload: `android/app/build/outputs/bundle/release/app-release.aab`
- Add release notes, save and publish
- Copy the tester opt-in link

### 3. Get 12 Android testers opted in
- Share the opt-in link with 12 people who have Android phones
- They must click the link and install the app from Play Store
- The 14-day timer starts when the first tester opts in
- Sources: friends/family, WhatsApp groups, Discord, Reddit r/androidapps

### 4. Create store listing graphics (do while 14 days run)

**App Icon — 512×512 PNG, no transparency**
- Use Canva → search "App Icon template"
- Pink/gradient theme to match the app
- Export as PNG 512×512

**Feature Graphic — 1024×500 PNG**
- Use Canva → search "Google Play Feature Graphic"
- App name + tagline: "Your AI dating coach"
- Same color scheme as icon

**Phone Screenshots — minimum 2 (portrait)**
- Open https://pocket-dating-coach.vercel.app in Chrome
- F12 → device toolbar → iPhone 12 Pro (390×844)
- Log in, navigate to key screens, right-click → Capture screenshot
- Good screens: discovery/swipe screen, AI coaching chat, profile view

**10-inch Tablet Screenshots — minimum 2 (required)**
- Same Chrome DevTools approach
- Custom device: 1280×800, device pixel ratio 2
- Take same screens at tablet size

### 5. Apply for production (after 14 days + 12 testers)
- Play Console → Production → Apply for production access
- Answer questions about your closed test
- Google reviews and grants production access (usually 1-3 days)

---

## Architecture Notes

**Live URL mode:** The Android app is a native WebView shell that loads the Vercel deployment at runtime. This means:
- No `npm run build` needed before Play Store updates for feature changes — just deploy to Vercel
- New AAB is only needed when changing native Android config (permissions, icons, SDK versions)
- Users always get the latest version automatically on next app open

**Why bundled mode was ruled out:** The app uses `adapter-vercel` with server-side API routes (Claude AI, Supabase service key). These cannot be bundled into a static APK — they require a live server. Live URL mode is the correct architecture for this app.

---

## Capacitor Config (current state)

```typescript
// capacitor.config.ts
appId: 'com.pocketdatingcoach.app'
appName: 'Pocket Dating Coach'
webDir: 'build'                    // unused in live URL mode
server.url: 'https://pocket-dating-coach.vercel.app'
android.allowMixedContent: false
plugins.PushNotifications: badge, sound, alert
```

---

## Play Console Store Listing (already filled in)

**App name:** Pocket Dating Coach

**Short description:**
> Your AI-powered dating coach — better profiles, smarter openers, more dates.

**Full description:** Already saved in Play Console (AI coaching features, profile review, reply suggester, chat analyzer, Verified Vibe).

**Privacy policy URL:** https://pocket-dating-coach.vercel.app/privacy-policy

**Content rating:** Dating category, 18+

---

## Keystore Backup Reminder

The file `android/release.keystore` and the passwords in `android/keystore.properties` are the only way to publish updates to this app. If lost, you cannot update the Play Store listing — ever. Ensure they are backed up in:
- A password manager (file + both passwords)
- A secure offline location
