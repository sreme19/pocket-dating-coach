# Data Retention on Account Deletion — Design

**Status:** Built (v1.0), migration pending apply · **Date:** 2026-07-19

## What shipped (v1.0)

- **Migrations** (both applied):
  `20260719135355_soft_delete_and_data_retention_for_verified_vibe_users.sql` —
  adds `deleted_at`, `deletion_reason`, `anonymized_at`, `research_id` +
  active/pending-anon indexes; and
  `20260719141219_extend_vv_pool_profiles_availability_status_allow_deleted.sql` —
  adds `'deleted'` to the `vv_pool_profiles.availability_status` CHECK so
  soft-delete can drop a user from the matcher (the pool has no `deleted_at`).
- **`purgeUser(db, userId, { mode })`** in `src/lib/server/delete-user.ts` — `soft`
  (default): stamp `deleted_at`, drop from pool (`vv_pool_profiles.availability_status
  = 'deleted'`), unmatch active matches (`verified_vibe_matches.status = 'unmatched'`),
  and **ban** the auth login. `hard`: original destructive purge (cascade wipe).
- **Endpoints** — user `DELETE /api/verified-vibe/account` passes `mode:'soft'` +
  reason; admin `POST /admin/analytics/delete-user` accepts `{ hard?: true }`.
- **Query guards** — `deleted_at IS NULL` added to discovery-feed, match-scoring
  cohort + mutual-pair lookup, matchmaker cold-user list, vector backfill,
  `backfill-profile-fields` (prevents pool resurrection), daily-report counts, and
  the client `getProfile()` (bounces a soft-deleted user whose token is still live).
- **Day-90 job** — `src/lib/server/anonymize-deleted.ts` (`runAnonymizeDeleted`),
  exposed as matchmaker task `anonymize-deleted` (with `dryRun`/`olderThanDays`) and
  a daily Vercel cron `GET /api/cron/anonymize-deleted` (03:30 UTC). It purges
  photos (folder + URL-referenced AI photos) and voice samples from storage, strips
  the master-profile `identity`/`photos`/`aiPhotos`, scrubs the banned auth record's
  email/phone/metadata, coarsens age→5yr band, nulls name/free-text/avatar, and
  stamps `research_id` + `anonymized_at`.

### Deferred (not in v1.0)
- Full re-key of every behavioural/AI/match table to `research_id` (the `id` is
  already a random UUID; auth PII is scrubbed at day-90, which breaks the email link).
- Scrubbing names out of message / AI-conversation free-text.
- Coarsening `city → region` (city retained — it is already region-level).

---

## Original plan (v0.1)

## Goal

Retain user data after a user deletes their profile so we can improve the product
(matching, AI Bestie/Wingman, photo pipeline) while the app is early-stage — **without**
breaking the user's expectation that their account is gone, and without holding raw
identifiable dating data indefinitely (India DPDP Act / GDPR / app-store policy risk).

## Decisions (locked 2026-07-19)

- **Retention window: 90 days.** Soft-deleted immediately; anonymized at day 90.
- **Photos: kept 90 days**, then purged from storage at the day-90 pass. AI tags /
  derived attributes survive in anonymized form.
- Anonymized data (no identifiers, no photos) is retained **indefinitely** for product
  improvement.

## Current behaviour (what we're replacing)

Deletion today is **purely destructive and immediate** — there is no soft-delete anywhere
in the schema.

- Entry points: `DELETE /api/verified-vibe/account`
  (`src/routes/api/verified-vibe/account/+server.ts`) and the admin
  `POST /admin/analytics/delete-user`.
- Both call `purgeUser()` in `src/lib/server/delete-user.ts`, which does two hard deletes:
  1. `verified_vibe_users.delete()` → cascades to matches, messages, likes,
     `user_master_profile`, pool registries, AI feedback, intelligence reports, voice calls.
  2. `auth.admin.deleteUser()` → cascades to `ai_assistant_*` (bestie/wingman
     conversations) and `device_tokens`.
- Only `account_deletions` (a churn snapshot) survives, plus some FK-less orphan rows.
- **Storage is never cleaned up** — profile/proof photos in the `profiles` bucket and
  voice samples in `voice-samples` are already orphaned today.

So the exact data we want to retain is the data currently destroyed.

## Lifecycle

| Stage | When | State |
|---|---|---|
| **Soft delete** | On user action | User vanishes: unmatched, undiscoverable, unmessageable, login severed. All data + photos retained. |
| **Anonymize + photo purge** | Day 90 | Direct identifiers stripped → random `research_id`; face photos deleted from storage; behavioural / AI / match data retained indefinitely, anonymized. |
| **Hard erase (on request)** | On genuine erasure request | Full destructive purge (today's `purgeUser`) for users who explicitly demand it. |

## Implementation plan

### 1. Migration (additive, non-breaking)
- Add to `verified_vibe_users`: `deleted_at timestamptz`, `deletion_reason text`,
  `anonymized_at timestamptz`, `research_id uuid` (nullable; set at anonymization).
- Break the cascade that would destroy retained data: drop `ON DELETE CASCADE` on the
  `ai_assistant_*` tables' FK to `auth.users`, **or** copy those rows into a
  retention-safe table before the auth user is removed. (Decide during build — copy is
  safer, leaves prod FKs untouched.)
- Index `deleted_at` and `(deleted_at, anonymized_at)` for the query guards and the job.

### 2. Convert the deletion path to soft-delete
- `purgeUser()` gains a mode: **soft** (default, user-facing) vs **hard** (erasure request).
- Soft path: set `deleted_at = now()`, `deletion_reason`; **ban the auth login**
  (`auth.admin.updateUserById(..., { ban_duration })`) instead of deleting it, so the
  user can't sign back in and the `ai_assistant_*` rows survive. Keep the existing
  `account_deletions` churn insert.
- Hard path: today's two-delete behaviour, for genuine right-to-erasure.

### 3. Query guards (must ship with step 2)
- Add `deleted_at IS NULL` to every pool / discover / match / like / message / auth-gate
  read so a soft-deleted user truly disappears. Enumerate and audit these sites during
  build — this is the correctness-critical part.

### 4. Anonymization + photo-purge task (day-90)
- New `matchmaker/run` task (same pattern as existing backfill tasks) that finds
  `deleted_at < now() - 90d AND anonymized_at IS NULL` and:
  - assigns `research_id`, nulls name / email / free-text identifiers, coarsens
    `city → region` and `age → band`;
  - deletes face photos + voice samples from storage (`storage.remove()`);
  - re-keys retained behavioural/AI/match rows to `research_id`;
  - sets `anonymized_at = now()`.
- Runs on the existing scheduler.

## Compliance posture (required, not optional)

- **Disclose retention** in the deletion copy ("we keep anonymized data to improve the
  product"). The delete sheet already collects a churn reason — natural place.
- **Anonymized retention is defensible; indefinite raw-PII retention is not** — this is
  the entire reason for the day-90 anonymization + photo purge.
- **Keep a real "erase everything" path** (the hard mode) for genuine erasure requests.

## Open questions

- Copy `ai_assistant_*` to a retention table vs. drop the cascade FK? (Lean: copy.)
- Exact identifier list to strip vs. coarsen at anonymization (name/email/city/age/about/
  photos confirmed; message free-text is harder — decide during build).
- Where the day-90 job runs and how failures are retried/alerted.
