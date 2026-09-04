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

## What I need from you

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
