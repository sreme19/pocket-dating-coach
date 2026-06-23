# Matchmaker Pool Migration — `vv_pool_profiles` single source

**Date:** 2026-06-23
**Scope chosen:** Full migration, **legacy tables kept in place** (not dropped).

## What changed (one paragraph)

The AI Matchmaker pipeline now reads and writes **only** the unified
`vv_pool_profiles` table. The legacy per-gender tables `vv_pool_wingmen` /
`vv_pool_besties` are **no longer written or read by the app** (left in the DB,
unused, for safety/rollback). The pool distiller is now sourced **exclusively
from `user_master_profile`** — the old direct read of `verified_vibe_verification`
is gone. Field population follows the onboarding→field mapping (see tables
below), and `conversationHooks` has been **removed entirely** (unused, no user
input path).

---

## 1. Data flow (before → after)

**Before**
```
onboarding ─▶ verified_vibe_verification (canonical)
           └▶ user_master_profile.onboarding (best-effort mirror)

distiller reads BOTH:
  match_profile   ◀─ user_master_profile (generatedProfile / proofs)
  preference_*    ◀─ verified_vibe_verification (loadQAResponses, priority)
        │
        ├▶ vv_pool_wingmen   (men)
        └▶ vv_pool_besties   (women)        ◀─ Matchmaker reads these
```

**After**
```
onboarding ─▶ verified_vibe_verification (canonical, immutable audit record)
           └▶ user_master_profile.onboarding (AUTHORITATIVE — enroll gated on it)

distiller reads ONLY user_master_profile:
  match_profile (self)  ◀─ onboarding picks + generatedProfile + verifiedProofs
  preferences  (wanted) ◀─ onboarding picks
        │
        └▶ vv_pool_profiles (assistant_type wingman|bestie)  ◀─ Matchmaker reads this
```

Key correctness change: because the distiller no longer falls back to
`verified_vibe_verification`, the master-profile write is now **authoritative**.
In `verify-step` the QA handler awaits the master write and **only enrolls in the
pool if that write succeeded** (`updateMasterProfile` now returns a boolean).

---

## 2. Field source mapping (what feeds `vv_pool_profiles`)

`match_profile` (JSONB, "who I am") and `preferences` (JSONB, "what I want").

| Field | Object | Source |
|---|---|---|
| `proofCategories` | match_profile | **Verification** — `verifiedProofs[].category` |
| `topProofSignals` | match_profile | **Verification** — `verifiedProofs[].insights` |
| `countriesTraveled` | match_profile | **Master/profile** — `masterData.countriesTraveled` |
| `headline` | match_profile | **AI** — `generatedProfile.headline` |
| `publicIntro` | match_profile | **AI** — `generatedProfile.publicIntro ?? about` |
| `values` | match_profile | **Onboarding** (self-values) + gp fallback |
| `lifestyleTags` | match_profile | **Onboarding** (self lifestyle) + gp fallback |
| `intentStatement` | match_profile | **Onboarding** (`deriveIntent`) |
| `compatibilitySignals` | match_profile | **Onboarding** (self vision) + gp fallback |
| `personalityDescriptors` | match_profile | **Onboarding** (self cards) + gp fallback |
| ~~`conversationHooks`~~ | — | **REMOVED** — no longer produced |
| `lookingFor` | preferences | **Onboarding** (`deriveIntent`) |
| `dealbreakers` | preferences | **Onboarding** (private/standards → negated) |
| `maturitySignals` | preferences | **Onboarding** (`deriveMaturitySignals`) |
| `emotionalSignals` | preferences | **Onboarding** (all "Drawn to" answers) |
| `lifestyleSignals` | preferences | **Onboarding** (Drawn-to lifestyle) |

### Per-archetype onboarding source keys

`match_profile` (self):

| Archetype | values | lifestyleTags | intentStatement | compatibilitySignals | personalityDescriptors |
|---|---|---|---|---|---|
| casual_generous_man | standards | lifestyle, experiences | (lane) | lifestyle, standards | lifestyle |
| spoiled_casual_woman | standards | vibe, experiences | (lane) | vibe, how_you_like_to_be_treated | vibe |
| hopeless_romantic | standards | — | (lane) | how_you_show_up, emotional_openness | emotional_openness, how_you_show_up |
| forever_focused | what_you_value | life_stage | timeline | partnership_vision, relationship_approach | life_stage, relationship_approach |
| traditional_matrimony | core_values | lifestyle, religion, marital_status | connection_style, marital_status | partner_fit, core_values, religion | core_values |
| rebound_healing | standards | where_you_are | comfort_level, where_you_are | what_you_need, comfort_level | where_you_are |
| untouched_heart | values | experience_level | experience_level | what_you_need, values | experience_level, what_excites_you |
| second_chapter | what_is_different | where_you_are | where_you_are, this_chapter | this_chapter, what_you_need | what_is_different, where_you_are |
| just_friends | good_friend_traits | social_style, what_you_enjoy | comfort_zone | social_style, what_you_enjoy | social_style |

`preferences` (wanted):

| Archetype | lookingFor | dealbreakers | maturitySignals | emotionalSignals | lifestyleSignals |
|---|---|---|---|---|---|
| casual_generous_man | (lane) | standards | standards | energy, chemistry, appreciation | experiences, appreciation |
| spoiled_casual_woman | (lane) | standards | standards | energy, chemistry, appreciation | how_you_like_to_be_treated, experiences |
| hopeless_romantic | (lane) | what_youre_done_with, standards | standards | partner_energy, connection_style, love_language, chemistry | — |
| forever_focused | life_stage, timeline | non_negotiables | non_negotiables, relationship_approach | partner_qualities, what_you_value, chemistry | partnership_vision |
| traditional_matrimony | connection_style, marital_status | core_values, lifestyle, +religion | partner_fit, core_values, connection_style | (all drawn-to) | partner_fit, family_approach, lifestyle |
| rebound_healing | comfort_level, where_you_are | standards | standards | energy_needed, what_slow_means, what_you_seek, chemistry | what_you_need |
| untouched_heart | experience_level | values | values | partner_energy, what_you_hope_for, what_matters, chemistry | what_you_need |
| second_chapter | where_you_are, this_chapter | non_negotiables | non_negotiables, what_is_different | what_you_seek, what_you_appreciate, chemistry | what_you_need |
| just_friends | comfort_zone | — (none) | — (none) | friend_energy, great_connection, vibe | activities, what_you_enjoy |

(`(lane)` = no explicit intent question; a fixed archetype phrase is used.
"all drawn-to" = the catch-all `drawnToValues` join.)

---

## 3. The adapter approach (why the matchmaker logic is untouched)

The scoring/filter logic in `matchmaker-service.ts` and `match-scoring.ts` reads
the **legacy** shapes (`preference_signals` for men; `preference_model` +
`match_profile.whatSheValues` + `relationshipIntent` for women). Rather than
rewrite all of that, two pure adapters map a unified row back to those shapes at
read time:

```
poolToWingmanRow(p): preferences → preference_signals
poolToBestieRow(p):  preferences → preference_model (+ relationshipIntent = lookingFor)
                     match_profile.values → match_profile.whatSheValues (alias)
```

Every data-load site now queries `vv_pool_profiles` (filtered by
`assistant_type`) and maps through the relevant adapter. The heavy LLM
prompt/scoring code is unchanged.

---

## 4. Files changed

### Server — pipeline
| File | Change |
|---|---|
| `src/lib/server/pool-registry.ts` | **Rewritten distiller.** Removed `distillMale/FemaleMatchProfile`, `distillMale/FemalePreferenceModel`, `loadQAResponses`, `refreshWingman/BestiePoolEntry`. Added generic `distillMatchProfile` / `distillPreferences`, the per-archetype source-key helpers, and a single `refreshPoolEntry(userId)` writing `vv_pool_profiles`. Reads `user_master_profile` only. `enrollInPoolIfVerified` now calls `refreshPoolEntry`. **`conversationHooks` no longer produced.** |
| `src/lib/server/matchmaker-service.ts` | Added `poolToWingmanRow` / `poolToBestieRow` adapters + `loadWingmanRow`/`loadBestieRow`. Migrated all pool reads (`softOverrideCandidates`, `runNightlyBatch`, `runMatchmakerForUser`, `getMatchmakerStatus`, `generatePerMatchRanking`, `generateFemaleCompetitiveReport`) to `vv_pool_profiles`. |
| `src/lib/server/match-scoring.ts` | Added `loadPoolRow` helper (imports the adapters); migrated the 2 pool-load sites in `generateMatchScores` and `rivalComposites`. |
| `src/lib/server/competitive-snapshot.ts` | Migrated rival/partner pool loads to `vv_pool_profiles` via adapters. |
| `src/lib/server/trust-recompute.ts` | `refreshPoolBandIfEnrolled` now checks membership in `vv_pool_profiles` and calls `refreshPoolEntry`. |
| `src/lib/server/test-suite.ts` (admin) | `listRoster`, `getPoolRow`, `runMatchmaker`, `warmMatrix` migrated to `vv_pool_profiles` via adapters. |

### Server — endpoints
| File | Change |
|---|---|
| `src/routes/api/verified-vibe/verify-step/+server.ts` | `updateMasterProfile` returns a boolean; QA handler **gates pool enrollment on a successful onboarding master-write** (authoritative single source). |
| `src/routes/api/verified-vibe/master-profile/+server.ts` | `refreshWingman/Bestie` → `refreshPoolEntry`. |
| `src/routes/api/verified-vibe/matchmaker/intelligence/+server.ts` | `refreshWingman/Bestie` → `refreshPoolEntry`. |

### Unchanged but related (still callers of `enrollInPoolIfVerified` → now writes `vv_pool_profiles`)
- `src/routes/api/admin/backfill-pool/+server.ts` — use this to backfill (see §6).

---

## 5. What is NOT migrated (left alone on purpose)

- **`vv_pool_wingmen` / `vv_pool_besties` tables** — kept in the DB, no longer
  written/read by the app. Their backfilled rows in `vv_pool_profiles` (from the
  `20260620000000` migration) remain until re-distilled.
- **`scripts/_debug_check_user.ts`** — dev-only script still reads the legacy
  tables; will show stale data for users distilled after this change. Not used by
  the app. Update or ignore.
- **`src/lib/server/supabase.ts`** type defs for the legacy tables — harmless,
  left for the kept tables.
- **`src/routes/api/female-profile/*` / `whatSheValues`** — that's the AI
  `generatedProfile` shape (input to the distiller), unrelated to the pool tables.

---

## 6. Required ops step — backfill existing users

Existing enrolled users have `vv_pool_profiles` rows from the migration backfill,
which used the **old** shape (e.g. men's `values` empty, `conversationHooks`
present, men's `lifestyleSignals`/`maturitySignals` empty). To re-distill them
into the new onboarding-derived shape, run the backfill (re-runs
`refreshPoolEntry` per user):

```
POST /api/admin/backfill-pool   (admin-gated)
```

Until then, readers still work (adapters tolerate missing keys), but those
fields will be sparse for pre-migration users.

---

## 7. Residual risks / follow-ups

1. **Single point of failure.** With `verified_vibe_verification` no longer read
   by the distiller, a failed onboarding master-write means empty pool
   preferences. Mitigations in place: the write is awaited + enrollment gated on
   success; the mobile `syncVerificationToMasterProfile()` backstop re-writes
   `master.onboarding` at the photos step. The `verify_vibe_verification` row
   remains as an audit/manual-recovery source.
2. **Photos-step enrollment is ungated.** `enrollInPoolIfVerified` also fires
   from the photos handler (which doesn't write onboarding). It relies on the
   earlier QA-step writes already being in master. If those failed, that row will
   be sparse until the next master-profile update / backfill.
3. **Dropping the legacy tables** is a deliberate follow-up (not done now). Once
   the backfill has run and the matchmaker has been observed healthy on
   `vv_pool_profiles`, add a migration to DROP `vv_pool_wingmen` /
   `vv_pool_besties` and remove their `supabase.ts` type defs + the debug script.

---

## 8. Verification performed

- `npm run check` — **0 type errors** in any changed file (19 project-wide errors
  are all pre-existing in untouched files).
- `vitest` pool-registry derivation suites (`pool-registry.dealbreakers`,
  `pool-registry.intent-maturity`) — **110 passed**.
- Full `src/lib/server` suite — 619 passed; the 51 failures are confined to 3
  pre-existing, unrelated files (`rls-policies` live-DB integration timeouts,
  `notifications.send` FCM mocking, `ai-assistant-service.pbt`), none of which
  import the changed modules.
