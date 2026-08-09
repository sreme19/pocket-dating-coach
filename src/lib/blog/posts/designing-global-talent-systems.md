---
title: Designing global talent systems
date: 2026-08-09
summary: The spreadsheet always shows the wage differential. The coordination, leadership, and redesign taxes are what it leaves out — and they are where the cost actually lives.
tags: [operations]
---

I spent years designing and redesigning teams that sat in India, Indonesia, the
Philippines, Nigeria, and earlier in the US and Europe. The documented pattern is
consistent: joined pre-revenue as the third person leading operations and data
leadership across multiple countries, built a 15+ person global data
organization, stood up a 70+ person call center from scratch across India and the
Philippines, and later led cross-border restructuring that produced 300–400% cost
savings. The stated goal was almost always the same — lower cost per unit of
output while keeping quality and speed acceptable. The real work was never the
unit cost.

Pure cost arbitrage fails in predictable ways. The failure modes are not
mysterious, but they are easy to ignore when the spreadsheet looks good.

## The arrangement that looks obvious

You locate work where the fully loaded cost of a capable person is a fraction of
the cost in the primary market. You build a capability matrix so that you know,
in theory, who can do what. You create reporting lines, documentation standards,
and some form of review cadence. On paper the savings are large — three to four
times is common once you include benefits, office, management overhead, and
attrition.

The matrix is useful. It forces a conversation about actual skills instead of
titles. It makes gaps visible. It becomes the basis for hiring, training, and
succession. But a matrix is a static map. The system that actually runs is the
daily flow of decisions, context, and correction across time zones and cultural
defaults.

## A capability matrix in practice

Here is the shape of the tool that actually got used (simplified and anonymized).
These matrices later appeared again during knowledge-transfer and succession
work:

```
Skill / Capability                  | Person A | Person B | Person C | Person D | Depth
------------------------------------|----------|----------|----------|----------|--------
Owns end-to-end process design      |    3     |    1     |    0     |    2     |  Thin
Can train others on the process     |    3     |    2     |    1     |    2     |  
Can execute without supervision     |    3     |    3     |    2     |    3     |  
Can diagnose production failures    |    3     |    2     |    1     |    2     |  
Can write usable documentation      |    2     |    3     |    1     |    2     |  
Can hold full business context      |    3     |    1     |    0     |    1     |  Critical gap
```

Scoring was usually simple:  
0 = cannot do  
1 = can do with heavy guidance  
2 = can do independently  
3 = can teach and improve it  

The matrix was never a hiring form. It was a living record of systemic risk. The
most useful version was updated after projects, not once a year, and the
conversation always started with the “Depth” column: where is the system one
resignation away from losing a capability?

## Where the cost actually lives

Three taxes appear almost immediately.

### 1. Coordination tax

Every decision that used to require one conversation now requires three. Context
has to be written down or it evaporates. The person who holds the full picture of
a process is rarely the person executing the next step.

*Pattern observed across multiple builds:*  
A change that previously took a 15-minute conversation in one location started
taking 1.5–2 days of back-and-forth once the work was split. The delay was not
malice or incompetence. It was the cost of re-establishing shared context every
time. Decision latency became a first-class metric because it was the tax that
showed up first in the numbers.

### 2. Leadership bandwidth tax

Someone still has to own the standard. When the standard is enforced from a
different geography, two things happen: either the standard softens to match
local norms, or the person enforcing it becomes a bottleneck.

*Pattern observed:*  
In multi-year setups, a single senior person frequently ended up spending more
than half their time translating intent and reviewing work product rather than
improving the system. Throughput looked fine on paper; the actual constraint was
that person’s calendar. The original cost model had never priced the leadership
layer as a scarce resource.

### 3. Process redesign tax

You cannot simply relocate the same process. The version that worked when
everyone shared the same cultural assumptions and ambient knowledge does not
survive the move.

*Pattern observed:*  
Teams that tried to move an existing process “as-is” usually saw quality drift
within 60–90 days. The ones that succeeded treated the move as a redesign:
shorter documentation, explicit escalation paths, and a deliberate period where
the original location still owned the standard while the new location built
fluency. The first six to nine months were almost always more expensive than the
spreadsheet predicted.

## What the large restructurings actually required

The restructurings that produced the documented 300–400% savings required more
than lower wages. They required:

- Explicit process ownership that could survive the departure of any single person
- Written standards short enough to be used and specific enough to be enforceable
- A small number of people who could hold the full context and were willing to
  spend a large fraction of their time transferring it
- Acceptance that the first six to nine months would be more expensive, not less,
  while the new system stabilized
- Willingness to reassign or exit people who could not operate inside the new
  design, even when their individual cost looked attractive

Without those pieces the savings were temporary. The system slowly re-created the
original cost structure through rework, escalation, and the quiet return of work
to higher-cost locations.

## Business KPIs that actually moved

These were the measures that proved useful when talking to operators and boards
(not the usual HR dashboard):

| KPI | Why it mattered |
|-----|-----------------|
| **Cost per completed unit of work** (fully loaded) | Captured the real economics after coordination and rework |
| **Decision latency** (time from question to committed answer) | Directly measured the coordination tax |
| **% of work executed without escalation to primary location** | Showed whether capability had actually transferred |
| **Single points of failure** (skills with depth ≤ 1) | Forced attention to fragility the matrix revealed |
| **Time-to-independent-contribution** for new hires | Revealed how good the documentation and training system really was |
| **Rework / error rate measured downstream** | Quality problems often appeared far from the team that created them |
| **Retention of people scored 3 on critical capabilities** | Losing a “3” was far more expensive than the average attrition number suggested |

The wage differential always looked attractive. These KPIs told you whether the
system was actually becoming cheaper or merely relocating the cost.

## Implementation timeline

A realistic sequence, distilled from the multi-year pattern of standing up and
later restructuring these systems:

**Months 0–2 — Design & baseline**  
Map the current process and decision rights. Build the first version of the
capability matrix for the critical skills. Identify the true single points of
failure. Set the target cost model *including* coordination and leadership
overhead, not just wage rates. Decide what “done” looks like for capability
transfer.

**Months 2–5 — Seed & dual-run**  
Hire or identify the first cohort in the new location. Run dual ownership: the
original location still owns the standard while the new location executes under
close review. Update the capability matrix every two to four weeks. Measure
decision latency and rework from day one. Expect higher short-term cost.

**Months 5–9 — Stabilize & transfer**  
Shift primary ownership of individual processes only when depth ≥ 2 on the
matrix. Document the short, usable standards that actually get used. Force the
leadership bandwidth question into the open: who is spending their time
translating versus improving? Begin measuring % of work completed without
escalation.

**Months 9–15 — Optimize & harden**  
Remove remaining single points of failure. Tighten the cost-per-unit metric so it
reflects fully loaded reality. Use the matrix as a living risk register rather
than an annual HR exercise. At this stage the 300–400% savings become durable
only if the process and leadership layers have been redesigned, not just
relocated.

**Ongoing**  
Treat the matrix as operational infrastructure. Update it after major projects or
attrition events. Revisit the original cost model every six months; pure wage
arbitrage will slowly erode if coordination and leadership costs are ignored.

## The pattern that held up

The durable pattern was never “move the work to the cheapest capable location.”
It was “design the system so that capability can be distributed without
destroying the decision quality that made the original team valuable.”

That requires treating talent systems the same way you treat any other production
system: with explicit interfaces, observable failure modes, and a cost model that
includes the coordination and leadership layers rather than pretending they are
free.

The spreadsheet will always show the wage differential. The real design work is
pricing everything the spreadsheet leaves out.
