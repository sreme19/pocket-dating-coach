# Flutter Dev Workflow — Firebase App Distribution Handoff

## TL;DR

Push Flutter changes to the `development` branch → GitHub Actions automatically builds the APK → your phone gets a notification with a download link within ~10 minutes. No simulator, no Play Store, no pushing to main.

---

## Branch Structure

| Branch | Purpose |
|--------|---------|
| `main` | Production — real users. Only merge here when ready to release. |
| `development` | Active dev branch. Push here to test on real device. |
| `prototype` | Experiments / early feature work. |

**Rule:** Never push directly to `main` for untested features. Use `development` → test on phone → merge to `main` when confirmed working.

---

## How to Push & Test on Your Phone

```bash
# 1. Make your Flutter changes in mobile/
# 2. Commit and push to development
git add mobile/
git commit -m "fix: your change description"
git push origin development

# 3. Wait ~10 min — GitHub Actions builds the APK
# 4. Firebase App Tester app on your phone shows a notification
# 5. Tap → install → test
```

That's it. Every push to `development` that touches the `mobile/` folder triggers a new build automatically.

---

## One-Time Setup (do this once)

### Step 1 — Generate Firebase Token (on your machine)
```bash
npm install -g firebase-tools
firebase login:ci
# Copy the token printed in the terminal
```

### Step 2 — Add GitHub Secrets
Go to: https://github.com/sreme19/pocket-dating-coach/settings/secrets/actions

Add these two secrets:

| Name | Value |
|------|-------|
| `FIREBASE_TOKEN` | token from Step 1 |
| `FIREBASE_ANDROID_APP_ID` | `1:239928106804:android:edf3b327f4c86c1b544f61` |

### Step 3 — Add yourself as tester in Firebase
1. Go to https://console.firebase.google.com
2. Select project `pocket-dating-coach-8bc26`
3. App Distribution → Testers & Groups
4. Create group: `testers`
5. Add your email to the group

### Step 4 — Install Firebase App Tester on your Android phone
- Play Store → search **"Firebase App Tester"** → install
- Sign in with the same email you added in Step 3

---

## What Triggers a Build

A new APK is built and distributed when:
- You push to `development` AND any file inside `mobile/` changed

If you only push web/backend changes (no `mobile/` files), no build is triggered.

---

## Monitoring

Every build result (success/fail) is logged to the admin monitoring dashboard:
- Check name: `android_distribution`
- URL: https://riteangle.dating/admin/monitoring

---

## Workflow File

The GitHub Actions workflow is at:
`.github/workflows/flutter-distribute.yml`

Current config:
- **Build type:** Debug (no signing key needed — fine for internal testing)
- **Flutter channel:** Stable
- **Java:** 17
- **Tester group:** `testers`

To switch to release build later (for production-quality testing), the `flutter build apk --debug` line needs to be changed to `--release` and a keystore needs to be configured.

---

## If the Build Fails

1. Go to https://github.com/sreme19/pocket-dating-coach/actions
2. Click the failed "Android Distribution" run
3. Read the error in the logs
4. Common issues:
   - Missing `FIREBASE_TOKEN` secret → regenerate with `firebase login:ci`
   - Flutter dependency error → check `mobile/pubspec.yaml`
   - Gradle error → check `mobile/android/app/build.gradle.kts`
