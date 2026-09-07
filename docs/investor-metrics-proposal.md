# Investor metrics snapshot — proposal

**Nothing here has been applied.** No view exists, no role exists, no grant has
been made. This is a proposal for the fixed metric set, written so the decision
can be made cold — before a specific investor conversation, which is what makes
it a definition rather than a selection.

Context: `portfolio-commons/CONVENTIONS.md` and the `pdc_traction` tool, which
currently returns `unavailable` with this as its reason.

## Why a snapshot and not a query

Investor numbers have a property ad numbers do not: **you have to be able to
reproduce what you said.** If a deck says 1,100 weekly actives in September, that
number needs to still be recoverable in December, along with how it was computed.

So the shape is a dated, append-only snapshot that `pdc-investor-agent` reads —
never a live query. Three consequences, all good: provenance comes free, the
numbers work offline, and the fundraising agent holds **zero database
credentials**.

## The access design

Established already by `ads_agent_ro` (see
`supabase/migrations/20260828120000_ads_agent_ro_rls_policies.sql`): an ops agent
gets a purpose-scoped Postgres role, never the Supabase MCP server, whose token
is scoped to the project rather than to tables.

Investor metrics invert the difficulty. Ad metrics live in marketing tables, so a
table grant sufficed. These are computed **over the member tables** that
`ads_agent_ro` is specifically forbidden. So:

- **Security-definer aggregate views**, owned by a privileged role, computing
  over the member tables and exposing only counts and rates.
- A role with `SELECT` on **the views and no grant on any base table**.
  Aggregates without access to what they aggregate.
- A **small-count floor**: suppress any cell below a threshold. At this stage a
  cohort might be four people, which is both re-identifying and useless to an
  investor.
- One more lesson already paid for: `ads_agent_ro` was created with GRANTs but no
  RLS policy, connected fine, and returned zero rows silently for a week. Every
  view needs a smoke test that fails loudly on zero.

## Candidate metrics

Mapped to tables visible in `supabase/migrations/`. **Marked where the mapping is
a guess** — the member tables are not all created in migrations, so some of this
needs your confirmation rather than my inference.

| Metric | Likely source | Confident? |
|---|---|---|
| Cumulative signups | `verified_vibe_beta_signups` | yes |
| New signups per week | `verified_vibe_beta_signups` | yes |
| Acquisition by channel | `user_acquisition` | yes |
| Funnel: page view → store click | `marketing_page_views`, `marketing_store_clicks` | yes |
| Leads captured | `marketing_lead_submissions`, `marketing_leads` | yes |
| Weekly / monthly actives | `mobile_event_log`, `verified_vibe_analytics` | **guess** |
| Activation (finished onboarding) | member table, not in migrations | **guess** |
| Matches produced | `ts_runs`, `ts_pair_scores` | **guess** |
| W1 / W4 retention cohorts | needs a per-user first-seen date | **guess** |
| AI assistant usage per active | `vv_ai_response_timings` | **guess** |

## Prerequisite, found 4 September

**The privacy policy does not currently mention aggregate analytics.** Section 2
of `src/routes/privacy-policy/+page.svelte` enumerates its purposes — operating
the profile and matching, identity verification through Trust & Boost, trust
scores, the AI companions, keeping the profile current — and says nothing about
aggregate statistics, business measurement or service improvement in 11,697
bytes.

That reorders this work rather than blocking it. Creating security-definer
aggregates over the member tables, for a fundraising deck, under a policy that
does not mention aggregate analysis, is the wrong order under DPDP's purpose
limitation. **The clause lands first.** Something to the effect of *"to produce
aggregate, non-identifying statistics about how the service is used, for
operating and improving it"* — wording is the owner's call, and possibly a
lawyer's.

## What I need from you

0. **The policy clause above**, before any view is created.
1. **Which of these belong in the fixed set.** Fixed matters: the agent reports
   the whole set every time rather than choosing, which is the difference between
   optimism and misrepresentation when the same investor sees two updates.
2. **Confirmation of the five guesses**, or the right table for each.
3. **The small-count floor.** I would suggest suppressing below 10.
4. **Whether the privacy policy covers aggregate business analytics.** Almost
   certainly yes, and the snapshot design keeps you clean either way — worth
   confirming now rather than discovering later under DPDP.

## What happens after that

A migration creating the views and the role, a scheduled or manual snapshot
writer producing `metrics/YYYY-MM-DD.json`, and `pdc_traction` reading that file
instead of returning `unavailable`. None of it needs the investor agent to touch
the database at all.

## Confirmed 7 September, against production

Six of the eleven candidate metrics above were marked **guess**. Producing traction
figures for an external application form settled most of them by running read-only
counts against production. Corrected mappings:

| Metric | Actual source | Note |
|---|---|---|
| Members | `verified_vibe_users` | **must** filter `is_seed=false, is_provisional=false` |
| Matches produced | `verified_vibe_matches` | not `ts_runs`/`ts_pair_scores`; has a `source` column (`matchmaker`, `notice_me`, `aibestie_lp`, `beta_invite`) |
| Matchmaker runs | `vv_matchmaker_runs` | |
| Monthly actives | distinct `sender_id` in `verified_vibe_messages` | `mobile_event_log` not needed for this |
| Activation | `verified_vibe_verification` (`step`, `status`) | per-step, distinct users |
| Trust | `verified_vibe_users.trust_score` | **continuous** 0–100, not bucketed to 0/25/50/75/100 |
| AI Bestie vetting conversations | `aibestie_lp_sessions` | |

### Two traps that make a metric wrong while it still looks fine

**1. `verified_vibe_messages.is_ai` — over half the message volume is the product,
not the members.** 1,724 of 3,299 messages have `is_ai = true`. Any engagement
metric computed without that filter measures our own send rate. Concretely:
"matches with a conversation in them" reads **570 of 573** unfiltered and **322 of
573** on human messages only. The first number is an artefact and would not have
survived a diligence question.

**2. supabase-js silently caps a `select` at 1000 rows.** No error, no warning — a
short array. A distinct-count over `verified_vibe_messages` therefore read **257**
matches-with-messages on the capped fetch versus **570** paginated, and the
distinct-sender count read 71 versus the true 109. Any metric derived from row
sets rather than `{ count: 'exact', head: true }` has to paginate with `.range()`
and assert the total before it is quoted.

### The metric nobody was computing

Both members sending a human message: **13 of 573 matches**. Matches are produced
and one side talks; two-way conversation is the actual funnel step, and it is
absent from the candidate list above. It belongs there — for a matching product it
is closer to activation than any signup count.

### Standing note on the privacy clause

The prerequisite recorded on 4 September still stands: the privacy policy does not
mention aggregate analytics. The counts described here are aggregate and
non-identifying, but they have now been used externally once, ahead of that
clause. That ordering was not ideal and is worth closing before the next use.
