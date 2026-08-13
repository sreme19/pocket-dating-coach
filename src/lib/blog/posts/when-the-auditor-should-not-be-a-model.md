---
title: When the auditor should not be a model
date: 2026-08-26
summary: I built the same reporting pipeline twice, weeks apart. The audit step is a Claude call in one version and plain arithmetic in the other. Having both makes the answer obvious, and it is not the one I expected when I started.
tags: [guardrails, decision-systems]
draft: true
---

I built the same thing twice.

A weekly reporting pipeline: three messy exports go in, a table of numbers and a
written analysis come out, and somebody senior reads the summary and makes
decisions with it. The first version was a command-line tool. The second was a
self-serve web app for people who do not use terminals.

Same pipeline, same stages, weeks apart. In one, the audit step is a Claude call.
In the other, it is plain Python. That accident is the most useful thing I have
learned about where to put a model.

*All figures, rates and segment names in this post are invented. The architecture
is real; the data and the commercial detail are not mine to publish.*

## The pipeline

![Eight stages. A ruleset version stamp, a model inferring the column layout,
deterministic cleaning, curve fitting, table building, a model writing the
findings, an audit step, and a conditional edge that only runs the executive
summary when the audit passes or warns.](/blog/spa-pipeline.svg)

Most of it is deterministic. Cleaning, deduplication, curve fitting and table
construction are ordinary code — the same input produces the same table every
time.

Two stages are generative, and one gates the output.

## The stage worth arguing about

![In build one the auditor is a model returning a verdict the caller must parse
out of prose. In build two the auditor is Python that re-derives every number and
returns a structured result.](/blog/auditor-two-ways.svg)

The audit step sits between the written findings and the executive summary. Its
job: *does the prose actually match the table it claims to describe?* If not, the
summary — the only part most people read — does not get written.

**In the first build, that auditor is Claude.** It receives the table and the
findings and runs five checks, returning `PASS`, `WARN`, `FAIL` or
`RULESET MISMATCH`.

**In the second build, the same step is Python.** It re-derives the percentages
and confirms they sum to 100, recomputes the revenue formula from its inputs and
compares, re-checks the margin arithmetic, and confirms nothing is missing.

Same position, same gate, opposite implementations.

## Which one is right

For the checks that actually shipped in the second build: **the Python one, and it
is not close.**

Every one of those four checks is arithmetic. Do these numbers sum correctly. Does
this formula reproduce this figure. A model asked to verify arithmetic will
usually get it right, but "usually" is a strange property to want from a
verification step, and it costs a network call and a few seconds to obtain.

There is a smaller, more embarrassing argument too. The model auditor returns a
verdict as text, so the calling code has to fish the word back out of prose that
might arrive bold, quoted, or wrapped in a polite sentence. There is a small
string-stripping loop whose entire job is to recover a four-state enum from
formatted markdown. That loop is a tax paid for using prose as a return type.

## Where the model auditor was right after all

Then the check that does not translate.

One of the five checks in the first build asks whether the written narrative is
*consistent with* the table — whether the analysis says demand rose while the
table shows it falling, whether it emphasises something the numbers do not
support, whether it draws a conclusion the data cannot carry.

There is no arithmetic for that. It is a reading-comprehension task over prose
someone will act on, and it is the check most likely to catch a genuinely
misleading report.

The second build does not have it. When I reimplemented the auditor as arithmetic,
that check quietly disappeared, because it was the one that could not be expressed
as a formula. I did not notice at the time. Writing this is how I noticed.

**So the honest answer is that neither build is right.** The four arithmetic checks
belong in Python. The narrative-consistency check needs a model. The correct
auditor is both, and I have shipped two halves of it in two different repositories.

## The rule I would extract

> **Ask what kind of claim the audit is making.** If it is a claim about numbers —
> sums, formulas, totals, completeness — verify it with the arithmetic that
> produced it. If it is a claim about meaning — does this text match this data, is
> this framing supported — a model is the only thing that can check it.

The trap is that both look like "review the output before shipping it", so they
end up as one step, implemented one way, and half the checking silently vanishes.

A useful test: **could you write the check as an assertion?** If yes, write the
assertion. If describing the check requires the words "reads as", "implies" or
"consistent with", you need a model.

## The other decision worth stealing

Before anything parses the input files, a model looks at them and infers the
column layout.

That sounds like using a model where a schema would do, and it was chosen against
a specific failure. The exports come from systems whose column names drift —
renamed, reordered, occasionally re-cased. A parser with a hardcoded mapping does
not crash on that. It silently reads the wrong column and produces a plausible,
wrong report.

Crashing would be fine. Silence is the problem. So the model inspects the file
first and reports what it actually contains.

How real is the drift? The exports arrive UTF-16 and tab-separated, and the second
build ships a debug endpoint that brute-forces five encodings when a file will not
open. That is the environment this defends against.

There is a fair objection: a model inspecting a file can also be wrong, and now the
failure is nondeterministic. The answer is that its output is a small structured
mapping, checked immediately against the columns the pipeline needs, and a
mismatch stops the run. A wrong guess fails loudly. A hardcoded mapping fails
quietly. Given the choice, take the loud one.

## Costs, since they turn out to be small

| Property | Value |
| --- | --- |
| Model calls per run | 4 |
| Runtime | 60–90 seconds |
| Cost per run | roughly $0.05–0.10 |
| Runs per week | one |
| Deterministic stages | 4 of 8 |

At a few cents a week the cost argument for removing a model call is nil. The
argument is entirely about determinism and about not parsing a verdict out of
prose.

Worth stating plainly, because "replace the LLM to save money" is a common framing
and it is the wrong one at this scale. Replace it because arithmetic does not need
checking by something that might disagree with itself next Tuesday.

## The pattern, without the reporting pipeline

| Setting | Belongs in code | Needs a model |
| --- | --- | --- |
| **Financial reporting** | Do the totals reconcile, do the balances foot | Does the commentary describe the same quarter the numbers do |
| **Clinical documentation** | Are all required fields present, is the dosage in range | Does the note's narrative match the recorded observations |
| **Compliance review** | Retention windows, mandatory disclosure present | Does the disclosure actually explain the thing it must disclose |
| **Data pipelines** | Row counts, null rates, referential integrity | Does this dataset's description still match what it contains |
| **Any generated report** | Every figure recomputable from source | Does the summary support the conclusion it draws |

Three transfers:

**Split your audit by claim type before you implement it.** Write the list of
checks, mark each as arithmetic or interpretive, and implement each in the
matching technology. Doing it in one pass with one tool is how a check gets lost.

**Never return a verdict as prose.** If a model must produce a verdict, make it
return a structured value. Parsing an enum back out of formatted text is a
reliability bug waiting for a model that decides to be emphatic.

**Put the gate in front of the artifact people actually read.** In this pipeline
the table is always produced; the summary is not. The gate belongs where the
consequence is, not at the end of everything.

## References

| Source | Event | Recording |
| --- | --- | --- |
| Constraints beat cleverness: the model for reasoning, not enforcement | [MLDS 2026](https://mlds.analyticsindiamag.com/), Mar 2026 | Not published |
| Deterministic execution with the model kept away from raw data | [DataHack Summit 2026](https://www.analyticsvidhya.com/datahacksummit/), Aug 2026 | Not published |
| Deterministic action from probabilistic detection | [Data Engineering Summit 2026](https://des.analyticsindiamag.com/), May 2026 | Not published |
| Managed agent evaluations and evaluator taxonomy | [AWS Summit Bengaluru 2026](https://aws.amazon.com/events/summits/bengaluru/), Apr 2026 | [Keynote](https://www.youtube.com/watch?v=CprBATdRoh0) |
| Full hall recordings across three days | [CYPHER 2025](https://cypher.analyticsindiamag.com/), Sept 2025 | [Day 2, Hall 3](https://www.youtube.com/watch?v=uOqflHyRxcs) |

*Related: [LLM-as-judge in the critical path](/blog/llm-as-judge-in-the-critical-path),
on the same question in a consumer product where the judge runs on every message.*
