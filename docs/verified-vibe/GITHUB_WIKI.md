# Verified Vibe Profile Generation

This page is written as a GitHub Wiki-ready reference for the current Verified Vibe profile generation work.

## Summary

Verified Vibe now includes a local male profile pipeline that moves a user from archetype selection into verification, collects profile details, asks Claude to synthesize a dating profile, and renders the result on an editable profile page.

This implementation is intentionally still local-first. It uses browser `localStorage` for profile state and includes a dev-mode auth bypass so the flow can be exercised quickly while the production auth/profile persistence path is still being finalized.

## User Flow

1. Start from `/verified-vibe/home`.
2. Select an archetype.
3. The app creates a local dev user and routes directly to `/verified-vibe/verification`.
4. Complete the verification steps.
5. Fill out the new profile intake step.
6. The app saves a draft to `localStorage` and calls `/api/verified-vibe/generate-profile`.
7. The generated profile is saved locally and the user is routed to `/verified-vibe/profile`.
8. The profile page supports public display and an enhance/edit mode.

## Key Routes

- `/verified-vibe/home`: archetype selection and current dev-mode bypass.
- `/verified-vibe/verification`: five-step verification plus profile intake.
- `/verified-vibe/profile`: local profile display, editing, and AI photo enhancement entry point.
- `/api/verified-vibe/generate-profile`: Claude-backed profile copy generation.
- `/api/photo-enhance/generate`: fal.ai-backed profile photo generation.

## Key Files

- `src/routes/verified-vibe/home/+page.svelte`
- `src/routes/verified-vibe/verification/+page.svelte`
- `src/lib/verified-vibe/components/ProfileIntakeStep.svelte`
- `src/routes/verified-vibe/profile/+page.svelte`
- `src/routes/api/verified-vibe/generate-profile/+server.ts`
- `src/routes/api/photo-enhance/generate/+server.ts`
- `src/lib/photo-enhance/index.ts`
- `src/lib/photo-enhance/scenes.ts`
- `src/lib/photo-enhance/types.ts`
- `scripts/setup-fal-key.js`
- `scripts/setup-fal-key.sh`

## Local Storage Contract

- `verified_vibe_archetype`: selected archetype.
- `verified_vibe_pending_archetype`: selected archetype pending persistence.
- `vv_photos`: uploaded photo data URLs and labels.
- `vv_profile_draft`: raw profile intake data.
- `vv_profile`: Claude-generated profile copy and tags.
- `vv_ai_photos`: generated AI photo results from fal.ai.

## Environment

Required for profile copy generation:

```sh
ANTHROPIC_API_KEY=sk-ant-api03-...
```

Required for AI photo generation:

```sh
FAL_KEY=...
```

Use the helper when configuring fal.ai locally:

```sh
npm run setup:fal
```

## Current Review Notes

- The home route currently bypasses Supabase auth for development speed.
- The layout currently treats verification and profile routes as public paths.
- Generated profile content falls back to the raw intake data if the Claude call fails.
- AI photo enhancement requires `FAL_KEY` and depends on the installed `@fal-ai/client` API shape.
- Profile and photo data are browser-local and are not yet persisted to Supabase.

## Verification Status

The commit was reviewed and preserved as a commit exercise without implementation fixes.

- `npm run check`: failing. Notable failures include `@fal-ai/client` API typing errors in `src/lib/photo-enhance/index.ts`, plus existing Svelte/type issues elsewhere in the app.
- `npm test`: failing and then stopped after multiple failing suites. Failures include older Verified Vibe accessibility/mobile tests, PhotoUploadStep expectations that still reference the previous five-photo consistency flow, and timeout-prone DiscoveryCard suites.

## GitHub / Release Notes

When publishing this state, call out that the commit adds the local profile generation pipeline and AI photo enhancement foundation, but it is not production-ready yet. The next engineering pass should reconcile the fal.ai client API usage, remove or guard the dev auth bypass before production, and update tests for the current one-photo-plus profile flow.
