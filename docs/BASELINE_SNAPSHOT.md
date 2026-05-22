# Codebase Baseline Snapshot

> Captured: 2026-05-22  
> Git commit: `68230d6` — `feat: implement AI Bestie coaching feature with flood prevention and bestie voice`  
> Git tag: `baseline/pre-preferences-system`  
> Branch: `main`

This document is the **regression reference** for the preferences system build.  
Before merging any new work, run `npm test` and `npm run check` and diff against these numbers.  
**Any test file that was passing below must still be passing after your change.**

---

## TypeScript / Svelte Check Baseline

**Command:** `npx svelte-check --tsconfig ./tsconfig.json`

```
4923 FILES   349 ERRORS   133 WARNINGS   116 FILES_WITH_PROBLEMS
```

These are **pre-existing errors** — none introduced by this session.  
Do not introduce new errors. Fixing existing ones is welcome but not required.

### Known pre-existing TS errors (do not regress further)
| File | Error |
|------|-------|
| `src/routes/chat/+page.svelte` | `ageRange`, `datingApp`, `relationshipGoal` don't exist on `VerifiedVibeUser` |
| `src/routes/verified-vibe/chat/+page.svelte` | Cannot find module `../api/verified-vibe/chat/conversations/+server` |
| `src/routes/verified-vibe/home/+page.svelte` | `Archetype | null` not assignable to `Archetype` |
| `src/routes/verified-vibe/discover/+page.svelte` | `"key"` not in `HTMLProps<"div">` |
| `src/lib/verified-vibe/components/TypingIndicator.svelte` | Duplicate `<script>` element |
| `src/lib/verified-vibe/components/TrustPointsBadge.svelte` | Implicit `any` index type |
| `src/lib/verified-vibe/components/ReadReceipt.svelte` | Cannot find module `date-fns` |
| `src/lib/verified-vibe/components/ProfileSettings.svelte` | Parameter `i` implicitly `any` |
| `src/routes/profile-review-male/+page.svelte` | `updatedAt` not on `MaleProfile` |

---

## Test Suite Baseline

**Command:** `npx vitest run`

```
Test Files:   69 passing  |  19 failing  (88 total)
```

### ✅ Files PASSING — must not regress

```
src/__tests__/ai-assistant-config.test.ts                          (14 tests)
src/__tests__/ai-assistant-correctness.test.ts                     (11 tests)
src/__tests__/api-endpoints.test.ts                                (76 tests)
src/__tests__/api-integration.test.ts                             (105 tests)
src/__tests__/integration-endpoints.test.ts                        (93 tests)
src/lib/components/AssistantBadge.test.ts                          (36 tests)
src/lib/components/CompatibilityFlags.test.ts                      (36 tests)
src/lib/components/PrivacySettings.test.ts                         (17 tests)
src/lib/components/SummaryBubble.test.ts                           (29 tests)
src/lib/prompts.test.ts                                            (34 tests)
src/lib/server/__tests__/ai-assistant-service.pbt.test.ts          (13 tests)
src/lib/server/__tests__/ai-assistant-service.test.ts              (25 tests)
src/lib/server/__tests__/ai-loop-prevention.pbt.test.ts            (15 tests)
src/lib/server/__tests__/ai-loop-prevention.test.ts               (32 tests)
src/lib/server/__tests__/error-handling-edge-cases.test.ts        (137 tests)
src/lib/server/__tests__/insight-extractor.test.ts                 (41 tests)
src/lib/server/__tests__/message-router.pbt.test.ts                (10 tests)
src/lib/server/__tests__/message-router.test.ts                    (27 tests)
src/lib/server/__tests__/profile-auto-updater.test.ts              (28 tests)
src/lib/server/__tests__/profile-service.pbt.test.ts               (9 tests)
src/lib/server/__tests__/profile-service.test.ts                   (18 tests)
src/lib/server/__tests__/session-state-integration.test.ts         (11 tests)
src/lib/server/__tests__/summary-generator.test.ts                 (16 tests)
src/lib/server/error-handler.test.ts                               (33 tests)
src/lib/server/profile-service.test.ts                             (57 tests)
src/lib/verified-vibe/__tests__/integration.test.ts                (47 tests)
src/lib/verified-vibe/accent-colors.test.ts                        (67 tests)
src/lib/verified-vibe/components/ArchetypeCard.a11y.test.ts        (36 tests)
src/lib/verified-vibe/components/ChatMessage.test.ts               (97 tests)
src/lib/verified-vibe/components/LivenessStep.test.ts              (36 tests)
src/lib/verified-vibe/components/MatchOverlay.test.ts              (36 tests)
src/lib/verified-vibe/components/SpendingQAStep.test.ts            (65 tests)
src/lib/verified-vibe/components/UserProfileCard.test.ts           (56 tests)
src/lib/verified-vibe/components/VerificationStep.test.ts          (38 tests)
src/lib/verified-vibe/design-tokens.test.ts                        (53 tests)
src/lib/verified-vibe/server/calculate-compatibility.test.ts       (26 tests)
src/lib/verified-vibe/server/matching.test.ts                      (49 tests)
src/lib/verified-vibe/server/notifications.test.ts                 (42 tests)
src/lib/verified-vibe/server/trustScore.test.ts                    (48 tests)
src/lib/verified-vibe/services/notificationService.test.ts         (30 tests)
src/lib/verified-vibe/services/performance.test.ts                 (42 tests)
src/lib/verified-vibe/services/service-worker.test.ts              (38 tests)
src/lib/verified-vibe/stores.test.ts                               (see run)
src/lib/verified-vibe/tests/archetype-card-expanded.test.ts        (37 tests)
src/lib/verified-vibe/tests/gate-animations.test.ts                (42 tests)
src/lib/verified-vibe/tests/gate-mobile-responsive.test.ts         (43 tests)
src/lib/verified-vibe/utils.test.ts                                (50 tests)
src/lib/verified-vibe/utils/swipeGesture.test.ts                   (32 tests)
src/routes/__tests__/privacy-utils.test.ts                         (54 tests)
src/routes/api/ai-bestie/activate/activate.test.ts                 (22 tests)
src/routes/api/ai-bestie/analyze/analyze.test.ts                   (22 tests)
src/routes/api/ai-bestie/deactivate/deactivate.test.ts             (23 tests)
src/routes/api/ai-bestie/message/message.test.ts                   (21 tests)
src/routes/api/ai-bestie/summary/server.test.ts                    (24 tests)
src/routes/api/ai-wingman/activate/activate.test.ts                (35 tests)
src/routes/api/ai-wingman/deactivate/deactivate.test.ts            (23 tests)
src/routes/api/ai-wingman/impersonate/server.test.ts               (24 tests)
src/routes/api/ai-wingman/message/message.test.ts                  (27 tests)
src/routes/api/chat/chat.test.ts                                   (22 tests)
src/routes/api/personality/personality.test.ts                     (12 tests)
src/routes/api/verified-vibe/chat/notify/notify.test.ts            (31 tests)
src/routes/api/verified-vibe/notify-match/notify-match.test.ts     (30 tests)
src/routes/api/verified-vibe/report-user/report-user.test.ts       (35 tests)
src/routes/chat/visual-indicators.test.ts                          (33 tests)
src/routes/verified-vibe/__tests__/privacy.test.ts                 (70 tests)
src/routes/verified-vibe/api/like/like.test.ts                     (13 tests)
src/routes/verified-vibe/chat/[conversationId]/conversation.test.ts(48 tests)
src/routes/verified-vibe/chat/[conversationId]/realtime.test.ts    (30 tests)
src/routes/verified-vibe/discover/discover.test.ts                 (28 tests)
src/routes/verified-vibe/home/home.test.ts                         (18 tests)
```

### ❌ Files FAILING at baseline — pre-existing failures, NOT our problem

These were already failing before the preferences system work begins.  
Do not make them worse; fixing them is a bonus.

| Test File | Tests | Failing | Root Cause |
|-----------|-------|---------|------------|
| `src/routes/verified-vibe/chat/chat-list.test.ts` | 36 | 35 | Cannot find module for Conversation type |
| `src/lib/server/__tests__/rls-policies.test.ts` | 34 | 29 | `ai_assistant_profiles` table missing in DB |
| `src/routes/api/preferences/preferences.test.ts` | 34 | 32 | `ai_assistant_profiles` table missing in DB |
| `src/lib/verified-vibe/components/ArchetypeCard.test.ts` | 20 | 15 | DOM/jsdom rendering failures |
| `src/lib/verified-vibe/components/DiscoveryCard.mobile.test.ts` | 43 | 19 | DOM/jsdom rendering failures |
| `src/lib/verified-vibe/components/DiscoveryCard.a11y.test.ts` | 44 | 14 | DOM/jsdom rendering failures |
| `src/routes/api/verified-vibe/chat/chat-interface.test.ts` | 38 | 24 | Mock setup mismatches |
| `src/lib/verified-vibe/components/PhotoUploadStep.test.ts` | 27 | 14 | DOM/jsdom rendering failures |
| `src/lib/verified-vibe/components/DiscoveryCard.test.ts` | 41 | 6 | DOM/jsdom rendering failures |
| `src/lib/verified-vibe/components/PhotoUploadStep.a11y.test.ts` | 27 | 6 | DOM/jsdom rendering failures |
| `src/routes/api/preferences/preferences.integration.test.ts` | 55 | 3 | `ai_assistant_profiles` table missing |
| `src/lib/components/AIAssistantSetupWizard.test.ts` | 21 | 6 | Component mock failures |
| `src/lib/components/ResponseOptions.test.ts` | 33 | 5 | Component mock failures |
| `src/lib/components/VersionHistory.test.ts` | 24 | 5 | Component mock failures |
| `src/lib/verified-vibe/utils/errorHandling.test.ts` | 43 | 3 | Async timeout/retry test flakiness |
| `src/lib/components/PersonalityEditor.test.ts` | 28 | 2 | Component mock failures |
| `src/lib/components/PreferencesEditor.test.ts` | 22 | 2 | Component mock failures |
| `src/lib/components/MobileResponsiveness.test.ts` | 79 | 2 | Component mock failures |
| `src/lib/verified-vibe/components/UserProfileCard.block-report.test.ts` | 23 | 2 | Mock setup mismatches |

---

## What's Working in Production (Manual Verification)

Features confirmed working end-to-end as of this baseline:

### Verified Vibe Core
- ✅ Auth login with seed accounts (`*@seed.vv` / `SeedPass123!`)
- ✅ Discovery feed — shows matched profiles, like/pass
- ✅ Mutual match detection and match creation
- ✅ Chat list — shows all conversations with last message + time
- ✅ Chat page — send/receive messages, scroll, timestamps
- ✅ Message bubble styling — sent (right, green) / received (left, bordered)

### AI Bestie
- ✅ Activate button in chat header
- ✅ State persists across page reloads (`localStorage`)
- ✅ Poller runs every 5 seconds detecting Adrian's new messages
- ✅ Claude evaluates message → `{ signal, read, suggestedQuestion }`
- ✅ Coaching card rendered below Adrian's message (Neha only, local state)
- ✅ `suggestedQuestion` auto-sent to Adrian in AI Bestie voice (third person, not Neha impersonation)
- ✅ Flood prevention — responded IDs persisted to localStorage, no re-responses on reload
- ✅ Clear chat button (seed users only)
- ✅ AI Bestie reads `about`, `looking`, `preferences` from `verified_vibe_users`

### Infrastructure
- ✅ `ANTHROPIC_API_KEY` loaded correctly via `forceLoadEnvLocal()` in `vite.config.ts`
- ✅ `getClaudeClient()` throws clearly if API key missing
- ✅ All verified-vibe API routes use correct column names: `user1_id` / `user2_id`

---

## What's NOT Yet Built (Planned Next)

1. `ai_assistant_profiles` Supabase table (missing — causes 3 test files to fail)
2. Structured `PreferencesProfile` wired to actual DB
3. Onboarding → initialise preferences from archetype + `about` + `looking`
4. Profile/trust save → update structured preferences
5. Chat replies (Neha's messages) → extract insights → update preferences
6. AI Bestie → read from `ai_assistant_profiles` instead of raw user row

---

## How to Use This Document

Before starting the preferences system work:
```bash
git tag baseline/pre-preferences-system
git push origin baseline/pre-preferences-system
```

After every significant change:
```bash
npm test 2>&1 | tail -20          # must show ≥69 passing, ≤19 failing
npm run check 2>&1 | tail -3      # must show ≤349 errors
```

If a previously-passing test file starts failing → **stop and investigate before merging**.
