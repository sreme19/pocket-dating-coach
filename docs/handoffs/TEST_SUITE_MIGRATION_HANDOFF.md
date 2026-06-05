# Handoff: apply the Test Suite logging migration

> **For:** Kiro (or whoever runs DB ops)
> **Goal:** create two tables so the admin Test Suite's *Persist*, *History*, and Matchmaker *pair-score cache* features actually store data. Until this runs, those features no-op gracefully (no errors, just nothing saved).
> **Effort:** ~2 minutes. One SQL paste into the Supabase SQL editor.
> **Risk:** Very low. Two brand-new tables only. No existing table is touched. Idempotent (`create table if not exists`).

---

## 1. Context — what you're applying and why

PR [#49](https://github.com/sreme19/pocket-dating-coach/pull/49) added an admin **Test Suite** at `/admin/test-suite`. It drives the real AI agents (Bestie / Wingman / Matchmaker) with production prompts + KB + Claude, and is **side-effect-free by default** — it never writes to any production table.

It does, however, have its **own** isolated logging, kept deliberately separate from the production QA queue (`ai_qa_reviews`):

| Table | Feature it unblocks | Behaviour while table is missing |
|---|---|---|
| `ts_runs` | The **Persist this run** toggle and the **History** tab (stores each run's full trace) | Persist toggle silently saves nothing; History tab shows the empty state |
| `ts_pair_scores` | Matchmaker **pair-score cache** + **Warm the matrix** (avoids re-spending Claude calls on the same pair) | Every pair score is a fresh Claude call; nothing is cached |

The application code already ships with guarded writes (`try/catch` → `console.warn`), so a missing table is harmless — it just means these features are inert. Running this migration turns them on.

The migration file already lives in the repo at:

```
supabase/migrations/20260602152742_test_suite_logging.sql
```

---

## 2. Why the SQL editor (not a CLI migrate)

This project has **no `exec_sql` RPC** and migrations are applied manually through the **Supabase SQL editor** — that's the established workflow here. Do **not** look for a `supabase db push` / programmatic path.

- **Supabase project ref:** `stikoktiaxqtcsohcxzp`
- Real service credentials are in `.env.local` (`.env.production` is intentionally blank).
- Dashboard: <https://supabase.com/dashboard/project/stikoktiaxqtcsohcxzp/sql/new>

---

## 3. Steps

1. Open the SQL editor for the project: <https://supabase.com/dashboard/project/stikoktiaxqtcsohcxzp/sql/new>
2. Paste the **entire** SQL block from §4 below (or open `supabase/migrations/20260602152742_test_suite_logging.sql` and copy its contents).
3. Click **Run**. You should see `Success. No rows returned.`
4. Run the verification queries in §5 to confirm both tables exist.
5. Do the in-app smoke test in §6.

---

## 4. The SQL (verbatim — safe to re-run)

```sql
-- Test Suite logging — isolated from the production QA Queue.
-- Read/written ONLY by /admin/test-suite. Never flows into ai_qa_reviews.

-- One row per Test Suite run (Case 1 / 2 / 3), holding the full AgentTrace.
create table if not exists ts_runs (
  id                  uuid primary key default gen_random_uuid(),
  case_type           text not null,        -- 'advisor' | 'match_reply' | 'matchmaker'
  agent               text not null,        -- 'bestie_advisor' | 'wingman_advisor' | 'bestie_match_reply' | 'matchmaker'
  subject_user_id     uuid,
  counterpart_user_id uuid,
  reviewer            text,                 -- pdc_reviewer cookie, for attribution
  input               jsonb not null,       -- operator message/params + history
  output              jsonb not null,       -- reply / score result
  trace               jsonb not null,       -- the full AgentTrace
  created_at          timestamptz default now()
);

create index if not exists ts_runs_created_idx on ts_runs (created_at desc);
create index if not exists ts_runs_agent_idx   on ts_runs (agent);

-- Cached pairwise Matchmaker scores so repeated runs don't re-call Claude.
-- Keyed by both user ids AND both profile versions, so a profile change
-- invalidates only the affected pairs.
create table if not exists ts_pair_scores (
  male_user_id           uuid not null,
  female_user_id         uuid not null,
  male_profile_version   int,
  female_profile_version int,
  hard_filter            jsonb not null,    -- { excluded, reasons }
  soft_score             jsonb not null,    -- { score, rationale, flags }
  scored_at              timestamptz default now(),
  primary key (male_user_id, female_user_id, male_profile_version, female_profile_version)
);
```

> **RLS note:** these tables are accessed only by server-side routes using the **service-role** key, which bypasses RLS — so no policies are required for the feature to work. If your org has a "RLS must be enabled on every table" lint, enable RLS with no policies (service role still bypasses it):
> ```sql
> alter table ts_runs        enable row level security;
> alter table ts_pair_scores enable row level security;
> ```

---

## 5. Verify it worked

Run in the SQL editor — both should return a row:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('ts_runs', 'ts_pair_scores')
order by table_name;
-- expect 2 rows: ts_pair_scores, ts_runs

select count(*) as run_count from ts_runs;          -- expect 0
select count(*) as cached_pairs from ts_pair_scores; -- expect 0
```

---

## 6. In-app smoke test (confirms the wiring end-to-end)

On the deployed app (or local dev), log in to `/admin` and open **Test Suite**:

1. **Persist + History**
   - Flip **Persist this run** ON (top-right; label should read *"writes to ts_runs sandbox"*).
   - In **Individual assistant**, pick any profile and send one prompt (e.g. *"how can I get better matches?"*). This spends one real Claude call.
   - Open the **History** tab → the run should now appear; click it → its full trace re-renders on the right.
   - SQL check: `select count(*) from ts_runs;` → should be ≥ 1.

2. **Matchmaker cache**
   - In **Matchmaker**, pick a male + female who are *in pool*, click **Score pair** → the cost line shows *"freshly scored + cached"* and **Claude calls this run: 1**.
   - Click **Score pair** again on the same pair → it should now show *"served from cache"* and **Claude calls this run: 0**.
   - SQL check: `select count(*) from ts_pair_scores;` → should be ≥ 1.

If both behave as above, the migration is live and the features are fully on.

> **Heads-up on spend:** the **Warm the matrix** button pre-scores up to 60 uncached pairs and fires a real Claude call per uncached pair. Only click it when you intend that spend.

---

## 7. Rollback (only if you need to remove the tables)

```sql
drop table if exists ts_runs;
drop table if exists ts_pair_scores;
```

This is fully safe — no production table or foreign key depends on them, and the app reverts to its graceful no-op behaviour.

---

## 8. One-line summary for Kiro

> Open the Supabase SQL editor for project `stikoktiaxqtcsohcxzp`, paste & run the SQL in §4 (the contents of `supabase/migrations/20260602152742_test_suite_logging.sql`), then confirm with §5. This creates `ts_runs` and `ts_pair_scores` — two new, isolated tables that turn on the Test Suite's Persist/History and Matchmaker cache. Nothing else changes.
