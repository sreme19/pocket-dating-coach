# Android Deployment Handoff — Pocket Dating Coach

**Last updated:** 2026-05-24  
**App ID:** `com.pocketdatingcoach.app`  
**Current version:** `versionCode 2`, `versionName 1.0.1`  
**Play Console track:** Closed Testing (Alpha) — Active  
**Live URL (WebView):** https://pocket-dating-coach.vercel.app

---

## Architecture at a Glance

This is a **Live URL Capacitor app** — the Android shell loads the production Vercel URL at runtime inside a WebView. There is no bundled static build. This is intentional: the app has server-side API routes (Claude, Supabase, push notifications) that cannot be bundled.

```
Android APK/AAB
  └── Capacitor WebView
        └── https://pocket-dating-coach.vercel.app  ← loads at runtime
              └── SvelteKit (adapter-vercel, SSR)
                    └── Supabase (auth + DB)
                    └── Anthropic Claude API
                    └── Firebase FCM (push)
```

---

## Current State: What Is Done

| Task | Status |
|------|--------|
| Capacitor configured (Live URL mode) | ✅ Done |
| Android SDK versions fixed (minSdk 24, compileSdk 36, targetSdk 35) | ✅ Done |
| Release AAB built and signed (versionCode 2) | ✅ Done |
| AAB uploaded to Play Console closed testing (Alpha) | ✅ Done |
| Privacy policy page live | ✅ https://pocket-dating-coach.vercel.app/privacy-policy |
| Child safety page live | ✅ https://pocket-dating-coach.vercel.app/child-safety |
| Store listing filled (title, description, screenshots) | ✅ Done |
| Content rating completed | ✅ Done |
| App access declaration submitted | ✅ Done |
| Alpha track set to Active | ✅ Done |
| 12 testers added | ✅ Done |
| Tester opt-in link distributed | ✅ Done |

---

## The One Blocker: 14-Day Closed Testing Requirement

Google requires **at least 12 testers** to have the app **installed and active for 14 consecutive days** before you can apply for production access.

- **Clock starts** the day the first tester installs via the opt-in link
- **Track progress** in Play Console → Testing → Closed testing (Alpha) → Testers tab
- **Opt-in link for testers:** Play Console → Closed testing → Manage track → Copy link (under "Join on Android")

### What to tell testers
> "Download link: [paste opt-in URL]. Install, open it at least once. We just need it installed for 2 weeks — you don't have to do anything else. After that we can release to everyone."

### After 14 days
Play Console → Publishing overview → "Apply for production access" button will become available.

---

## Diagnosing the Error on App Open

When a tester opens the app and sees an error, these are the likely causes in order of probability:

### 1. Network/WebView can't load the Vercel URL
**Symptom:** White screen, "net::ERR_*" error, or "Page not found"  
**Test:** Open https://pocket-dating-coach.vercel.app in Chrome on the same Android device. If it fails there too, it's a network issue.  
**Fix:** Ensure Vercel deployment is live. Check `capacitor.config.ts` has the correct URL.

### 2. Supabase auth redirect URL not registered for Android
**Symptom:** Login/signup fails, redirect after OAuth returns blank screen  
**Fix:** In Supabase Dashboard → Authentication → URL Configuration, add:
```
com.pocketdatingcoach.app://login-callback
https://pocket-dating-coach.vercel.app
```

### 3. App opens to a route that requires auth and redirects weirdly
**Symptom:** Spinner then crash, or redirect loop  
**Fix:** Ensure the SvelteKit root route `/` handles unauthenticated users gracefully (shows landing or gate, not a protected route).

### 4. Capacitor bridge error (rare)
**Symptom:** "Capacitor: Could not find plugin" or similar  
**Fix:** Run `npx cap sync android` and rebuild the AAB.

### How to get the actual error message
To see the real error from the WebView:
1. Enable USB debugging on the Android device
2. Connect via USB → open Chrome on desktop → navigate to `chrome://inspect`
3. Click "inspect" under the device's WebView
4. Check Console tab for the real error

---

## Building a New Release AAB

Run these commands in order:

```bash
# 1. Build the SvelteKit app (not strictly needed in Live URL mode, but keeps webDir in sync)
npm run build

# 2. Sync Capacitor
npx cap sync android

# 3. Build the release AAB
cd android
./gradlew bundleRelease

# Output: android/app/build/outputs/bundle/release/app-release.aab
```

Before uploading to Play Console, increment `versionCode` in `android/app/build.gradle`:
```gradle
versionCode 3          // must be strictly higher than previous upload
versionName "1.0.2"    // update this too for human readability
```

---

## Signing Setup

Signing credentials are loaded from `android/keystore.properties` (not committed to git).  
File format:
```properties
keystorePath=../release.keystore
keystoreAlias=pocket-dating-coach
keystoreStorePassword=<your_store_password>
keystoreKeyPassword=<your_key_password>
```

**CRITICAL:** Back up `release.keystore` and `keystore.properties` to a secure location (password manager, encrypted drive). If lost, you cannot push updates to the Play Store — ever.

---

## Key File Locations

| File | Purpose |
|------|---------|
| `capacitor.config.ts` | Capacitor config — server.url points to Vercel production |
| `android/variables.gradle` | SDK versions (minSdk 24, compileSdk 36, targetSdk 35) |
| `android/app/build.gradle` | versionCode + versionName — increment before each upload |
| `android/keystore.properties` | Signing credentials (NOT in git) |
| `release.keystore` | Signing keystore (NOT in git — back up separately) |
| `src/routes/privacy-policy/+page.svelte` | Privacy policy page |
| `src/routes/child-safety/+page.svelte` | Child safety page |

---

## Database (Supabase)

**Connection pooler URL (for MCP / external tools):**
```
postgresql://postgres.stikoktiaxqtcsohcxzp:t9a6reBFWlWEzKMJ@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require
```

**Stats as of May 2026:** 16 tables, 54 users, 43 verified_vibe_profiles, 37 matches, 126 messages

**Known security issue:** `book_chunks` and `verified_vibe_typing_indicators` have RLS disabled. Fix in Supabase Dashboard → Database → Tables → enable Row Level Security.

---

## Vercel Environment Variables Required

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | Claude API for coaching features |
| `PUBLIC_SUPABASE_URL` | Supabase project URL |
| `PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase access |
| `SEED_ACCOUNT_PASSWORD` | Required for build — seeding test profiles |
| `FIREBASE_*` | Firebase Admin SDK for push notifications |

---

## What's Left Before Production

1. **[ ] Fix app-open error** — Identify via chrome://inspect + fix root cause (see Diagnosing section above)
2. **[ ] 14-day closed test** — Wait for 12 testers to have app installed 14 days
3. **[ ] Apply for production** — Play Console → Publishing overview → Apply for production access
4. **[ ] Fix RLS** — Enable Row Level Security on `book_chunks` and `verified_vibe_typing_indicators`
5. **[ ] Respond to Play review** — Google will review the app during the 14-day window; expect email from Google Play team

---

## Play Console Links

- **Dashboard:** https://play.google.com/console
- **App:** Look for "Pocket Dating Coach" under All apps
- **Tester opt-in link:** Play Console → Closed testing (Alpha) → Manage track → Copy link
- **Published listing:** https://play.google.com/store/apps/details?id=com.pocketdatingcoach.app (only visible to opted-in testers)
