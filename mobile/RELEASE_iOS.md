# iOS TestFlight release — Verified Vibe (Flutter)

Ships the Flutter app to TestFlight under the **existing** App Store Connect app
**`com.pocketdatingcoach.app`** (same record as the live Capacitor build), team
`4JFBYKQJDN`.

> ⚠️ This is a 3-screen prototype on the *same* listing as your shipped app.
> After upload, add the build to an **INTERNAL-ONLY** TestFlight group. Do **not**
> push it to the external testers / public group on the live build.

## What you provide (one-time)

An **App Store Connect API key** with the **App Manager** role:

1. App Store Connect → **Users and Access** → **Integrations** → **App Store Connect API**.
2. **Generate API Key**, role **App Manager**.
3. Download the **`AuthKey_<KEYID>.p8`** (downloadable once — keep it safe).
4. Note the **Key ID** and the **Issuer ID** (shown above the key list).

Then it's three values: `ASC_KEY_ID`, `ASC_ISSUER_ID`, and the path to the `.p8`.

## Run

```bash
ASC_KEY_ID=XXXXXXXXXX \
ASC_ISSUER_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx \
ASC_KEY_PATH=/absolute/path/AuthKey_XXXXXXXXXX.p8 \
mobile/scripts/release_ios.sh
```

The script: `flutter build ios --release --no-codesign` → `xcodebuild archive`
(Xcode auto-creates the distribution cert + App Store profile in the cloud via
the API key, so nothing needs to pre-exist in the keychain) → `exportArchive`
which uploads straight to App Store Connect. The build appears under **TestFlight**
after Apple finishes processing (a few minutes).

## Versioning

- Current: `1.0.1+1` (in `pubspec.yaml`). The live Capacitor build is `1.0 (1)`.
- App Store Connect requires a **unique build number per marketing version**. If
  upload is rejected for a duplicate build, bump the `+N` suffix in
  `pubspec.yaml` (e.g. `1.0.1+2`) and re-run.

## Notes / not-yet-done

- This bundles the prototype into the live app record. Long-term, when Flutter
  reaches parity it simply becomes the next public release of this same app.
- Permissions: none added yet. When camera/photos (verification) or push land,
  add the matching `NS*UsageDescription` keys to `ios/Runner/Info.plist`.
- App icon/splash are still Flutter defaults — fine for an internal TestFlight,
  replace before any public submission.
