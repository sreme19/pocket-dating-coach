#!/usr/bin/env bash
#
# Headless TestFlight build + upload for the Verified Vibe Flutter app
# (bundle id com.pocketdatingcoach.app, team 4JFBYKQJDN).
#
# Requires an App Store Connect API key with the "App Manager" role:
#   ASC_KEY_ID     – the key's ID (e.g. ABC123XYZ)
#   ASC_ISSUER_ID  – the issuer ID (a UUID, shown above the keys list)
#   ASC_KEY_PATH   – path to the downloaded AuthKey_<ASC_KEY_ID>.p8 file
#
# Usage:
#   ASC_KEY_ID=XXX ASC_ISSUER_ID=YYY ASC_KEY_PATH=~/Downloads/AuthKey_XXX.p8 \
#     mobile/scripts/release_ios.sh
#
# Xcode auto-creates the distribution cert + App Store provisioning profile in
# the cloud (via -allowProvisioningUpdates + the API key), so no certs need to
# pre-exist in the keychain. The export step uploads straight to App Store
# Connect; the build then appears under TestFlight after processing.
#
# ⚠️  After upload, add the build to an INTERNAL-ONLY TestFlight group. Do NOT
#     distribute to the external testers on the live Capacitor build — this is a
#     3-screen prototype sharing the same app record.
set -euo pipefail

: "${ASC_KEY_ID:?set ASC_KEY_ID}"
: "${ASC_ISSUER_ID:?set ASC_ISSUER_ID}"
: "${ASC_KEY_PATH:?set ASC_KEY_PATH (path to AuthKey_<id>.p8)}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"   # the mobile/ dir
cd "$ROOT"

echo "▸ [1/3] Assembling Flutter (release, no codesign)…"
flutter build ios --release --no-codesign

echo "▸ [2/3] Archiving with Xcode (auto-signing via ASC API key)…"
xcodebuild \
  -workspace ios/Runner.xcworkspace \
  -scheme Runner \
  -configuration Release \
  -archivePath build/Runner.xcarchive \
  -allowProvisioningUpdates \
  -authenticationKeyPath "$ASC_KEY_PATH" \
  -authenticationKeyID "$ASC_KEY_ID" \
  -authenticationKeyIssuerID "$ASC_ISSUER_ID" \
  DEVELOPMENT_TEAM=4JFBYKQJDN \
  archive

echo "▸ [3/3] Exporting + uploading to App Store Connect…"
xcodebuild \
  -exportArchive \
  -archivePath build/Runner.xcarchive \
  -exportPath build/ipa \
  -exportOptionsPlist ios/ExportOptions.plist \
  -allowProvisioningUpdates \
  -authenticationKeyPath "$ASC_KEY_PATH" \
  -authenticationKeyID "$ASC_KEY_ID" \
  -authenticationKeyIssuerID "$ASC_ISSUER_ID"

echo
echo "✅ Uploaded. The build will show in App Store Connect → your app → TestFlight"
echo "   once Apple finishes processing (usually a few minutes)."
echo "   → Add it to an INTERNAL tester group only."
