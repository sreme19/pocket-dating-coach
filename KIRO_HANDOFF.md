POCKET DATING COACH — ANDROID DEPLOYMENT HANDOFF FOR KIRO
Last updated: 2026-05-24

This document covers everything needed to finish getting Pocket Dating Coach live on the Google Play Store. The Android shell is already uploaded to closed testing. Two things are blocking production: an error that shows when testers open the app, and a 14-day closed testing requirement that Google enforces before production access is granted.


ARCHITECTURE

This is a Live URL Capacitor app. The Android APK/AAB is a thin shell — it opens a WebView pointed at https://pocket-dating-coach.vercel.app and loads the full app from there at runtime. There is no bundled static build inside the APK.

This architecture is intentional. The app has server-side API routes (Claude AI coaching, Supabase auth, push notifications) that require a live server. SvelteKit uses adapter-vercel, which produces server functions, not a static bundle. Bundled mode would break everything.

App ID: com.pocketdatingcoach.app / Current versionCode: 2


TASK 1: FIX THE ERROR ON APP OPEN (PRIORITY)

When testers open the app, they see an error. Most likely cause: Supabase auth redirect URL is not registered for the production domain.

Fix: Open Supabase Dashboard for project stikoktiaxqtcsohcxzp. Go to Authentication > URL Configuration. Under "Redirect URLs", confirm both are present:
  https://pocket-dating-coach.vercel.app
  https://pocket-dating-coach.vercel.app/**

Second candidate: the root SvelteKit route redirects unauthenticated users to a protected page before the session loads. Check src/routes/+page.svelte and src/routes/+layout.svelte — unauthenticated users should hit a gate or landing page, not a redirect to a protected route.

To get the actual error from the device: USB debugging on Android, open Chrome desktop, go to chrome://inspect, click Inspect on the WebView. The Console tab shows the real error.

After fixing, build a new AAB: increment versionCode to 3 in android/app/build.gradle, run npx cap sync android, then cd android && ./gradlew bundleRelease. Upload the AAB at android/app/build/outputs/bundle/release/app-release.aab to the Alpha track in Play Console.


TASK 2: RLS SECURITY FIX

Two tables have Row Level Security disabled: book_chunks and verified_vibe_typing_indicators. Enable RLS on both in Supabase Dashboard > Database > Tables, then add appropriate read/write policies.


TASK 3: 14-DAY CLOSED TESTING

12 testers are on the list but need to actually install via the opt-in link. Get the link from Play Console > Closed testing > Manage track > Copy link. Send it to every tester. After 14 days of active installs, "Apply for production access" becomes available in Play Console > Publishing overview.


KEY FILES

capacitor.config.ts — server.url must stay pointed at https://pocket-dating-coach.vercel.app
android/app/build.gradle — increment versionCode before every Play Store upload
android/keystore.properties — signing credentials, not in git, do not lose this
release.keystore — signing keystore, not in git, back it up

DB pooler URL for Kiro MCP: postgresql://postgres.stikoktiaxqtcsohcxzp:t9a6reBFWlWEzKMJ@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require


PRODUCTION CHECKLIST

Fix app-open error (Supabase redirect URL or SvelteKit auth guard)
Build versionCode 3 AAB, upload to Alpha
Enable RLS on book_chunks and verified_vibe_typing_indicators
Confirm 12 testers have installed via opt-in link (not just added to list)
Wait 14 days
Apply for production access
Upload production release (versionCode 4+)
