# iOS Deployment Handoff — Pocket Dating Coach

**Last updated:** 2026-06-05 (build 1 uploaded + live on TestFlight internal testing, installed on device)
**App ID (bundle identifier):** `com.pocketdatingcoach.app`
**Initial version:** `CFBundleShortVersionString 1.0.0`, `CFBundleVersion 1`
**Distribution channel:** TestFlight → App Store
**Live URL (WebView):** https://pocket-dating-coach.vercel.app

---

## Architecture at a Glance

Identical to Android: this is a **Live URL Capacitor app**. The iOS shell loads the
production Vercel URL at runtime inside a `WKWebView`. There is no bundled static
build serving the app — `webDir` (`build/`) exists only to satisfy Capacitor; the
real app is the server-rendered SvelteKit site on Vercel.

```
iOS .ipa
  └── Capacitor WKWebView
        └── https://pocket-dating-coach.vercel.app  ← loads at runtime
              └── SvelteKit (adapter-vercel, SSR)
                    └── Supabase (auth + DB)
                    └── Anthropic Claude API
                    └── APNs (push)
```

Capacitor 8 manages native dependencies via **Swift Package Manager** (`Package.swift`),
NOT CocoaPods. There is no `Podfile` / `Pods/` directory to manage.

---

## Current State: What Is Done

| Task | Status |
|------|--------|
| Apple Developer Program enrollment ($99/yr) | ✅ Done |
| CocoaPods installed (1.16.2) | ✅ Done (not required by Cap 8, but available) |
| `@capacitor/ios@8.4.0` added (aligned with core + android) | ✅ Done |
| iOS scripts added to package.json (`cap:open:ios`, `cap:sync:ios`, `cap:build:ios`) | ✅ Done |
| `ios/` Xcode project scaffolded (`npx cap add ios`) | ✅ Done |
| `npx cap sync ios` run, push-notifications plugin wired | ✅ Done |
| Bundle ID + display name match Android | ✅ `com.pocketdatingcoach.app` / "Pocket Dating Coach" |
| Full Xcode installed (26.5) + `xcode-select` pointed at it + license accepted | ✅ Done |
| App runs in iOS Simulator — landing page loads from Vercel | ✅ Verified (cold-load white flash, see note) |
| Signing team selected in Xcode (automatic signing) | ✅ Done — team "Sreekanth Dayanidhi" |
| Push Notifications capability added | ✅ Done (APNs .p8 key still TODO for sending) |
| Device registered to team | ✅ Done — iPhone UDID `00008120-0016686C2170201E` |
| Archive built + uploaded to App Store Connect | ✅ Done — build 1.0 (1) |
| App Store Connect app record created | ✅ Done — name "Pocket Dating Coach", SKU `com.pocketdatingcoach.app` |
| Export compliance answered | ✅ Done — "None of the algorithms" (HTTPS-only, exempt) |
| TestFlight internal testing live | ✅ Done — installed on device (mekhalaiyengar21@gmail.com) |
| TestFlight external (public link for friends) | ⬜ TODO — needs one-time Beta App Review |
| App Store listing + review submission | ⬜ TODO |

---

## RESOLVED: the device-registration blocker

`Product → Archive` originally failed with "Your team has no devices from which to
generate a provisioning profile." **Cause:** automatic signing insists on creating an
*iOS App Development* profile before it will build (even for an archive), and that
needs ≥1 registered device. Fixed by registering the iPhone (UDID above) — connect via
USB OR add the UDID manually at developer.apple.com → Devices, then Signing &
Capabilities → Try Again. Keep this in mind for any future team member's machine.

## NEXT: external testing (friends) + App Store

1. **External TestFlight group** — TestFlight tab → External Testing → + group →
   add build 1 → enable **Public Link** → share with friends (they install TestFlight
   + tap the link; no cable/UDID needed).
2. **Test Information is required first** — beta description, feedback email, contact
   info, and a **sign-in demo account** (seeded email + password) so the reviewer can
   get past the login wall. Missing demo creds is the #1 external-review rejection.
3. **Submit for Beta App Review** — one-time, ~24h. New builds afterward skip review.
4. **Before submitting (dating-app review risk):** confirm in-app **account deletion**
   and reachable **report/block** flows exist. Apple rejects dating apps lacking these.
5. **App Store release** — fill listing (screenshots 6.7"/6.5", App Privacy label,
   17+ rating) and submit for full App Review.
6. Organizer → **Distribute App → App Store Connect → Upload**.

(Alternative without the phone: register a UDID manually at
developer.apple.com/account → Devices — but USB is far easier.)

**Note — cold-load white flash:** On first launch the WebView shows a brief white
screen before the Vercel page renders. This is almost certainly the same symptom the
Android handoff calls the unresolved "app-open error." A splash screen / loading state
would fix the perception on both platforms. Follow-up, not a launch blocker.

---

## The Remaining Gate: Full Xcode

Only Command Line Tools are installed. You cannot build, archive, or open the
project without the full Xcode app.

1. Install **Xcode** from the Mac App Store (~7 GB).
2. Point the toolchain at it:
   ```bash
   sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
   sudo xcodebuild -license accept
   ```
3. Verify: `xcodebuild -version` should print a version, not an error.

---

## Step-by-Step From Here (all require Xcode)

### 1. Open the project
```bash
npm run cap:open:ios     # = cap open ios
```

### 2. Configure signing
In Xcode → select the **App** target → **Signing & Capabilities** tab:
- Check **Automatically manage signing**.
- Select your **Team** (your Apple Developer account).
- Confirm **Bundle Identifier** = `com.pocketdatingcoach.app`.
Xcode generates the provisioning profile automatically.

### 3. Add Push Notifications (the app ships `@capacitor/push-notifications`)
- In **Signing & Capabilities** → **+ Capability** → add **Push Notifications**.
  This adds the `aps-environment` entitlement.
- If you use silent/background pushes, also add **Background Modes** → check
  **Remote notifications**. (Not needed for standard alert pushes.)
- In **App Store Connect** (or Apple Developer → Certificates) create an **APNs
  Auth Key (.p8)**. Your push backend currently uses Firebase (FCM) for Android —
  to reuse FCM for iOS, upload this `.p8` key into the Firebase project under
  **Project Settings → Cloud Messaging → Apple app configuration**. Otherwise wire
  APNs directly.

### 4. Confirm Supabase auth redirect
In Supabase Dashboard → Authentication → URL Configuration, ensure these exist
(likely already added during Android setup):
```
com.pocketdatingcoach.app://login-callback
https://pocket-dating-coach.vercel.app
```

### 5. Archive and upload to TestFlight
- In Xcode set the run destination to **Any iOS Device (arm64)** (not a simulator).
- **Product → Archive**.
- When the Organizer opens: **Distribute App → App Store Connect → Upload**.
- The build appears in App Store Connect → TestFlight after processing (~5–15 min).
- Unlike Google Play, there is **no 14-day / 12-tester gate**. Internal testers
  (up to 100, added by Apple ID) can install almost immediately. External testing
  groups require a lightweight Beta App Review (usually <24h).

### 6. Submit for App Store review
- Create the app record in App Store Connect (if not done): **My Apps → +**.
- Fill the listing: name, subtitle, description, keywords, screenshots
  (6.7" and 6.5" iPhone sizes required), support URL, marketing URL.
- Reuse the existing legal pages:
  - Privacy policy: https://pocket-dating-coach.vercel.app/privacy-policy
  - Child safety: https://pocket-dating-coach.vercel.app/child-safety
- Complete the **Privacy "Nutrition Label"** (App Privacy section) — declare data
  collected: email, user content, usage. Required before submission.
- Set age rating to **17+** (dating apps mandate this).
- Submit. Apple review is typically 1–3 days.

---

## Apple Review Risk Areas for a Dating App

Apple scrutinizes these harder than Google did. Confirm each exists BEFORE submitting:

1. **In-app account deletion** — Guideline 5.1.1(v): any app with account creation
   MUST offer in-app account deletion (not just deactivation, not "email us").
   Verify a delete-account path exists in the live app.
2. **User-generated content moderation** — Guideline 1.2: apps with UGC need a way
   to report objectionable content, block abusive users, and a published mechanism
   to act on reports within 24h. Confirm report/block flows are reachable.
3. **Age gate** — a real age confirmation at signup, consistent with the 17+ rating.
4. **Login completeness** — if any third-party login is offered, Sign in with Apple
   may be required (Guideline 4.8) unless using only email/password.

A rejection on any of these costs a review cycle, so check them now rather than after.

---

## Building a New Release (after the first one)

```bash
npm run cap:build:ios     # = vite build && cap sync ios
npm run cap:open:ios      # then Product → Archive in Xcode
```

Before each upload, bump the build number in Xcode (App target → General):
- **Version** (`CFBundleShortVersionString`): human-facing, e.g. `1.0.1`.
- **Build** (`CFBundleVersion`): must be strictly higher each upload, e.g. `2`.

---

## Key File Locations

| File | Purpose |
|------|---------|
| `capacitor.config.ts` | Shared config — `server.url` points to Vercel production |
| `ios/App/App.xcodeproj` | The Xcode project — open via `npm run cap:open:ios` |
| `ios/App/App/Info.plist` | Display name, permissions, capabilities |
| `ios/App/App/Assets.xcassets` | App icon + launch screen assets |
| `ios/.gitignore` | Capacitor-generated; excludes build/, DerivedData, xcuserdata |
| `ios/App/CapApp-SPM` | Swift Package Manager manifest for Capacitor plugins |

---

## Signing & Recovery Notes

- iOS signing is managed by Apple + Xcode (automatic signing). Unlike Android, there
  is **no local keystore you can permanently lose** — certificates and profiles live
  in your Apple Developer account and can be regenerated. The thing to protect is
  access to the **Apple Developer account itself**.
- The **APNs .p8 auth key** can only be downloaded once at creation. Back it up
  securely (password manager). It does not expire and is reusable across builds.

---

## What's Left Before App Store Release

1. **[ ] Install full Xcode** + `xcode-select` (the current blocker)
2. **[ ] Select signing team** in Xcode
3. **[ ] Add Push Notifications capability + create/upload APNs .p8 key**
4. **[ ] Verify Supabase iOS redirect URL**
5. **[ ] Confirm account deletion + report/block flows exist** (review risk)
6. **[ ] Archive → upload to TestFlight**, add internal testers
7. **[ ] Fill App Store Connect listing + App Privacy label + 17+ rating**
8. **[ ] Submit for App Store review**
