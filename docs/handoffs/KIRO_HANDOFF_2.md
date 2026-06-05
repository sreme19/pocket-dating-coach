POCKET DATING COACH — HANDOFF 2: FIX APP-OPEN ERROR
Date: 2026-05-24

The Android app is live on Google Play closed testing. When testers open it, they see a Vercel error page instead of the app. This document tells you exactly what the problem is, what to fix, and what to verify.


THE ERROR

The tester's screen shows:

  404: NOT_FOUND
  Code: DEPLOYMENT_NOT_FOUND
  ID: bom1::qwgmn-1779629103663-e08fcc65e25a

This is a Vercel error page, not an app crash. The Android WebView opens, tries to load https://pocket-dating-coach.vercel.app, and Vercel returns 404 because the deployment at that URL no longer exists. The app code is fine. The problem is on the Vercel side.


ROOT CAUSE

The Capacitor config (capacitor.config.ts) hardcodes the Vercel production URL as the target for the Android WebView:

  server: {
    url: 'https://pocket-dating-coach.vercel.app',
    cleartext: false
  }

That URL was working when the AAB was built (versionCode 2, released 23 May 2026). Something happened to the Vercel deployment after the AAB was uploaded — either a failed redeployment left no active build at that alias, or the project was reorganized. Vercel's CDN now returns DEPLOYMENT_NOT_FOUND for that URL.

The Supabase auth logs (checked via MCP) show the app was recently also hitting https://pocket-dating-coach-sreme19s-projects.vercel.app — a preview/personal deployment URL — which suggests the project may have moved.


TASK 1: VERIFY THE CURRENT PRODUCTION URL

Open https://pocket-dating-coach.vercel.app in any browser. If it returns the same 404, the Vercel production deployment is broken and needs to be fixed before anything else.

Log into the Vercel dashboard. Find the pocket-dating-coach project. Check the Deployments tab. Look for the most recent deployment and its status.

If the latest deployment shows "Error" or "Failed":
  Click the three-dot menu on the latest successful deployment and select "Promote to Production". Or push a new commit to the main branch to trigger a fresh build.

If the project URL has changed:
  Find the current production URL (it will be listed under "Domains" in the project settings). Note it — you will need it in Task 2.

Once the URL loads correctly in a browser, the existing app (versionCode 2) will also work for testers who reinstall. But testers who already have it installed need an update pushed through Play Console, which is Task 2.


TASK 2: UPDATE CAPACITOR CONFIG IF THE URL CHANGED

If Task 1 confirmed that the production URL is still https://pocket-dating-coach.vercel.app and the deployment is now healthy, skip this task. The config is correct.

If the URL changed, open capacitor.config.ts and update the server.url:

  const config: CapacitorConfig = {
    appId: 'com.pocketdatingcoach.app',
    appName: 'Pocket Dating Coach',
    webDir: 'build',
    server: {
      url: 'https://NEW-URL-HERE.vercel.app',   <-- update this
      cleartext: false
    },
    android: {
      allowMixedContent: false
    },
    plugins: {
      PushNotifications: {
        presentationOptions: ['badge', 'sound', 'alert']
      }
    }
  };


TASK 3: BUILD AND UPLOAD VERSIONCODE 3

versionCode in android/app/build.gradle has already been updated to 3 and versionName to "1.0.2". Run these commands from the project root:

  npx cap sync android
  cd android && ./gradlew bundleRelease

The AAB will be at: android/app/build/outputs/bundle/release/app-release.aab

Upload it in Play Console:
  Testing > Closed testing > Manage track > Create new release > Upload the AAB

Testers will receive the update automatically. After they update, opening the app should load the app correctly instead of the Vercel error page.


TASK 4: CONFIRM THE FIX

After uploading versionCode 3, ask one tester to update the app and open it. They should see the Verified Vibe gate screen (two questions: gender and age confirmation), not a 404 page.

If they still see a 404 after updating, the Vercel URL is still broken. Go back to Task 1 and fix the deployment before proceeding.


FILES CHANGED SO FAR IN THIS SESSION

android/app/build.gradle
  versionCode 2 → 3
  versionName "1.0.1" → "1.0.2"

No other files changed. capacitor.config.ts still points to https://pocket-dating-coach.vercel.app — only change that if you confirmed in Task 1 that the URL has moved.


BROADER CONTEXT

This app is a Capacitor Live URL app. The Android binary is a thin WebView shell. All app logic lives at the Vercel URL. There is no bundled HTML/JS in the APK. This means if the Vercel URL goes down or changes, the app shows a blank or error page for all users. It also means fixing the Vercel URL fixes the app instantly for any tester who reinstalls — no Play Store update required for them.

The closed testing track needs 12 testers installed for 14 consecutive days before production access is unlocked. The 14-day clock starts from the day each tester installs. Fix this error first so the clock starts counting from valid, working installs.
