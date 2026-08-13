---
title: How a sort-order default corrupted an agent's memory
date: 2026-08-22
summary: An agent accused a blameless man nine times of something he said once. The cause was two documented, reasonable library defaults meeting each other. The fix was a test that reads our own source code rather than running it.
tags: [agent-evals, riteangle]
---

A man matched with someone, sent an opener, and had a normal conversation with
her agent. Over the next hour that agent accused him nine times of pushing the
same line, and twice threatened to end the conversation.

He had said it once. In his opening message. Before the conversation began.

He worked out what was happening before we did.

## What he was seeing

The agent reads the last twelve messages before every turn. That window is its
entire sense of what has just been said.

His opener was pinned to the top of that window permanently. So on every turn,
the agent looked at what appeared to be the most recent thing he had written, saw
the same line again, and drew the obvious conclusion: he had just repeated it.
Nine turns, nine repetitions, escalating each time — exactly as a person would
respond to someone who genuinely would not drop it.

The agent's behaviour was correct given its input. Its input was wrong in a way
nothing surfaced.

## Two defaults, both reasonable

![Two defaults combining. A multi-row insert sends the union of all keys, so a
row omitting its timestamp is written an explicit null. Postgres sorts nulls
first in descending order. The null-timestamped opener therefore sits at the top
of every newest-first query.](/blog/null-sort-bug.svg)

**The first default is in the database client.** When you insert several rows at
once, it builds one statement from the union of all the keys across those rows. A
row that omits a column does not fall through to the column's default — it is
written an explicit `NULL`, because the column is now named in the statement.

That is correct behaviour. A single statement must have consistent columns.

**The second default is in Postgres.** In a descending sort, `NULL` sorts *first*.
A null timestamp is therefore treated as the most recent thing that has ever
happened.

That is also correct, and documented.

Neither is a bug. The failure exists only where they meet: one insert path
created a message row without a timestamp, and every "newest first" query in the
system then treated that row as newer than everything else, forever.

## Why nothing caught it

This is the part I find genuinely instructive.

There was no error. No exception, no failed constraint, no log line, no anomaly
in latency or cost. Every query returned twelve rows, as designed. The database
was internally consistent and would have passed any integrity check.

The only symptom was an agent that seemed to have developed a fixation.

And critically, the natural diagnosis was wrong. Everything about the presentation
pointed at the prompt — an agent repeating an accusation looks like a prompt
problem, or a model being oversensitive, or a bad instruction about persistence.
We would have spent a long time editing prompt text that was working perfectly.

**When an agent behaves strangely, the input is a more likely culprit than the
instruction, and the input is the thing nobody looks at.** The prompt is in a file
you can read. The context window is assembled at runtime from a dozen queries and
then thrown away.

## The fix, and the test that is not a behaviour test

The fix itself is two lines of discipline: every message insert sets its
timestamp explicitly, and every descending sort over that table specifies that
nulls come last.

The interesting part is what we could write to stop it recurring.

![A behaviour test writes through a mock, which applies column defaults correctly,
so the null never appears — it passes having proved nothing. A source-shape test
reads the repository's own source and asserts three structural
properties.](/blog/source-shape-test.svg)

A normal regression test cannot catch either bug.

Write the test against a mock and the mock applies column defaults properly, so
the null never appears. Sort an array in memory and the language's null ordering
differs from the database's. In both cases the test passes and has demonstrated
nothing at all about the two behaviours that actually caused the incident.

So the regression test reads our own source code instead of running it. It
asserts three structural facts:

1. No descending sort over the message table omits the nulls-last modifier — with
   each sort attributed to the table it belongs to, so an unrelated query is not
   flagged.
2. No multi-row insert omits the timestamp column.
3. The specific query the agent reads still carries the guard, asserted by name,
   so a refactor or rename cannot quietly drop it.

This is an unusual kind of test and I would not write many of them. It couples
tests to code shape, which is normally exactly what you avoid, and it will produce
false alarms when someone legitimately restructures a query.

It earns that cost here because **the bug lives in the gap between two libraries'
defaults, and nothing you can execute in a test harness reproduces that gap.** The
only artifact that reliably carries the mistake is the source text itself. So that
is what gets pinned.

## A failure mode that is on nobody's list

I have paid attention to the production-failure taxonomies presented at
conferences this year, because they are genuinely useful. A session at DataHack
Summit 2026 showed a roughly thirty-item inventory of ways agent systems fail in
production — cost explosion, context-window exhaustion, cross-user data leakage,
rate-limit exhaustion. Another, on enterprise compliance agents, named five
specific failures with fixes, including a versioning trap where retrieval returns
the current policy while the document under review was written against an older
one.

Nothing on those lists is this.

The closest relative is that policy-versioning trap, and the family resemblance is
real: in both cases retrieval returns something technically valid that is wrong
*for this moment*, and the agent reasons confidently from it. But theirs is a
domain-modelling problem. Ours was a data-access default.

The category I would add to those taxonomies is: **the agent's context was
assembled correctly by code that was itself correct, and is still wrong.** No
component misbehaved. The failure was in the seam.

## The pattern, without the dating app

> **An agent's context window is a query result, and it deserves the scrutiny you
> give any other query result.** Test the ordering. Test what happens when a
> nullable column is null. Assume that anything assembled at runtime and then
> discarded is invisible, and make it visible before you need it.

| Setting | The equivalent seam | What it would look like |
| --- | --- | --- |
| **Support agents** | A ticket comment written without a timestamp by one integration | The agent believes an old complaint is the customer's latest word |
| **Clinical summarisation** | An observation with a null recorded-at from a device feed | A months-old reading presented as the current one |
| **Financial reporting agents** | A journal entry defaulting to null period | A prior-period figure surfacing as this quarter's |
| **Any RAG system** | A document whose date is missing, sorted newest-first | Stale guidance retrieved as current, confidently cited |
| **Multi-source pipelines** | Two writers, one of which omits a column the other sets | Divergent ordering that only appears at read time |

Four things I would take from this:

**Log the context, not just the output.** In production we store the reply, the
timing and any violation. We do not store the window the agent was actually
looking at. That is the one artifact that would have made this obvious in minutes
instead of hours.

**Test your ordering explicitly, against the real database.** Not the sort — the
ordering *of null and edge values*, against the actual engine. Every database has
opinions here and they differ.

**Believe the user's diagnosis.** He told us exactly what was happening. The
instinct with a complaint about an AI behaving oddly is to treat it as a
perception problem. He had a better model of the failure than we did.

**When a bug lives between two correct components, pin the shape.** Most of the
time, testing behaviour rather than implementation is right. When the defect is
that two reasonable defaults compose badly, behaviour is precisely what you cannot
observe, and the code's structure is the only thing that carries the mistake.

## What it changed

That incident is now cited in three other places in this codebase as the reason a
particular decision went the way it did — including the rule that an agent may
never auto-close a conversation on its own judgement, and the choice to surface a
detected dealbreaker to the human rather than acting on it.

One man reading his own chat log carefully produced more architectural change
than any design review we have run.

## References

Most sessions have no published recording. Where one exists it is linked.

| Source | Event | Recording |
| --- | --- | --- |
| A production failure-mode taxonomy for agent systems | [DataHack Summit 2026](https://www.analyticsvidhya.com/datahacksummit/), Aug 2026 | Not published |
| Enterprise compliance agents: five named production failures, including the policy-versioning trap | [DataHack Summit 2026](https://www.analyticsvidhya.com/datahacksummit/), Aug 2026 | Not published |
| Context rot and catastrophic forgetting among production lessons | [MLDS 2026](https://mlds.analyticsindiamag.com/), Mar 2026 | Not published |
| Immutable audit trails: if you cannot trace it, you cannot trust it | [MLDS 2026](https://mlds.analyticsindiamag.com/), Mar 2026 | Not published |
| Full hall recordings across three days | [CYPHER 2025](https://cypher.analyticsindiamag.com/), Sept 2025 | [Day 2, Hall 3](https://www.youtube.com/watch?v=uOqflHyRxcs) |

*Seventh of nine posts on riteangle's architecture. Previous:
[deterministic overrides on a generative agent](/blog/deterministic-overrides-on-a-generative-agent).
Next: replaying production agents with every side effect suppressed.*
