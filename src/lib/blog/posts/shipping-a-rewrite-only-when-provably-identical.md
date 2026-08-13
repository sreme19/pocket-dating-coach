---
title: Letting an agent change live routing rules without anyone silently losing an enquiry
date: 2026-08-28
summary: Letting an agent edit a production configuration from a plain-English request is reckless unless something can answer what the change would actually do — offline, thousands of times, without touching live traffic. So a shadow reimplementation exists, and it earns the right to speak by reproducing every routing decision production has already made: 5,501 of 5,501, zero divergences, against a threshold set in advance. The same harness then makes a 7,900-line refactor reviewable, because behaviour preservation is demonstrated rather than argued.
tags: [agent-evals, decision-systems]
---

There is a routing engine deciding, hundreds of times an hour, which of many
possible recipients an inbound enquiry goes to. The rules are a large, hand-edited
configuration file. Changing it is high-stakes and fiddly, and the people who best
understand the desired change are not the people comfortable editing it.

So: an agent that takes the change in plain English and edits the configuration.

The obvious version of that is reckless. The interesting part is the gate.

*This describes a client system. The domain is generalised, all field names and
values here are invented, and no real record appears.*

## The rule

**The agent may not ship a change until a shadow reimplementation of the engine
reproduces every routing decision production has already made.**

Not "passes tests". Reproduces the actual decisions, on captured real inputs,
identically.

![A plain-English request is parsed into a structured edit, checked for ambiguity,
turned into an unapplied patch, then replayed against every captured production
decision through both engines. Only a divergence rate under threshold allows an
audited apply.](/blog/replay-gate.svg)

Result on the last full run: **5,501 decisions replayed, 5,501 matched, zero
divergences.** The threshold was under half a percent. It came in at zero.

## Why a shadow implementation at all

To let an agent reason about routing changes, something has to be able to answer
"what would this configuration do?" — quickly, offline, thousands of times, without
touching production.

The live engine cannot do that. So there is a second implementation, in Python,
that must behave identically.

That immediately raises the obvious objection: **you now have two engines and they
will drift.** Which is exactly right, and is why the replay harness is not a
testing convenience. It is the mechanism that makes the second implementation
legitimate at all. The reimplementation is not trusted because it was written
carefully. It is trusted because it reproduces reality on every case anyone has
seen.

If it stops doing that, it stops being allowed to speak.

## Naming every guess

Reimplementing an undocumented engine means guessing. Does it trim whitespace in
that field? Is matching case sensitive? Is that negative number a sentinel for
"missing" or a real value?

You cannot avoid the guesses. You can refuse to leave them implicit.

![Each guess about undocumented behaviour is written down with an identifier.
Some have been settled by an observed divergence; the rest remain open and are
declared open. A divergence is auto-tagged with the assumptions that could
explain it.](/blog/assumption-ontology.svg)

Every assumption gets an identifier and a written statement. When a replayed
decision diverges, it is **automatically tagged with the assumptions that could
explain it**.

That tagging is the part I would rebuild anywhere. A divergence on its own tells
you the rewrite is wrong somewhere across thousands of lines. A divergence tagged
with three candidate assumptions tells you which three sentences to go and verify.
It converts debugging into a lookup.

A few assumptions have been settled — each by a divergence that could only be
explained one way, which is a genuinely satisfying way to learn a system's
behaviour. The rest are still open, and are listed as open. A known unknown with an
identifier is a completely different object from an unknown unknown.

## The ambiguity stop

The agent refuses ambiguous requests rather than resolving them.

Ask it to route "weekend enquiries from the north" to a new team, and if "the
north" could match two different groupings in the configuration, it stops and
asks. It does not pick the more likely one.

This is the opposite of how a helpful assistant is normally tuned, and it is
correct here for an asymmetry reason. The cost of asking is one extra message. The
cost of guessing is a silent misroute affecting live traffic until somebody
notices — and misrouting is a quiet failure, not a loud one.

The general rule: **an agent should be more willing to ask, the harder its
mistakes are to detect.** Ambiguity resolution is a reasonable default when errors
surface immediately. It is a bad default when they surface in a monthly report.

## What the replay is really protecting

There is a second thing this harness enabled, which is where most of the value
landed.

The configuration had grown to roughly a hundred and sixty rule groups across
thousands of lines of JSON, with the accumulated duplication that implies. It
needed restructuring, and nobody wanted to touch it, because you cannot review a
change of that size by reading it.

With a replay harness you do not have to. Restructure however you like, replay
every captured decision, and if the outcomes are identical, the refactor is
behaviour-preserving — demonstrated, not argued.

That is the same guarantee a good test suite gives you, except the test cases are
real historical decisions rather than the ones somebody thought to write. For a
system whose behaviour was never fully specified, captured production traffic is
the only honest specification available.

## What this is not

It does not prove correctness. It proves **equivalence to current behaviour**, on
inputs that have actually occurred. If production has a bug, the shadow faithfully
reproduces the bug, and the gate passes.

That is the right guarantee for a refactor and the wrong one for a fix. When the
change is meant to alter behaviour, divergences are the point, and the harness
switches role: instead of demanding zero, you inspect each divergence and confirm
it is one you intended.

It is also blind to inputs nobody has sent yet. Zero divergences over 5,501
captured decisions says nothing about the 5,502nd if it has a shape never seen
before. That is a real limit and it argues for continuing to capture rather than
freezing the corpus.

## The pattern, without the routing engine

> **Before letting an agent modify a system nobody fully understands, build
> something that can answer "what would this do?" offline — and make it earn trust
> by reproducing decisions the real system has already made.** Name every
> assumption you had to guess. Tag failures with the assumptions that could
> explain them. Refuse ambiguity instead of resolving it.

| Setting | The captured corpus | What the gate proves |
| --- | --- | --- |
| **Pricing engines** | Historical quotes with their inputs | A repricing refactor changes no existing quote |
| **Entitlement and access rules** | Past authorisation decisions | A policy rewrite grants and denies exactly as before |
| **Claims adjudication** | Settled claims and their determinations | Rule consolidation alters no outcome |
| **Tax and payroll logic** | Prior calculated runs | An engine upgrade reproduces every historical figure |
| **Feature flags and targeting** | Logged assignment decisions | A targeting refactor keeps the same users in the same buckets |
| **Search ranking** | Logged queries and result orderings | A scoring change moves only what you intended |

Three transfers:

**Capture decisions, not just outcomes.** The harness needs the inputs *and* the
decision. Most systems log the outcome and discard the inputs, which makes replay
impossible later. Start capturing before you need it.

**Give every assumption an identifier.** The identifier is what turns a vague
worry into a trackable item, and what lets a failure point at a specific guess.
This costs almost nothing and pays every time something diverges.

**Set the threshold before you run it.** Deciding what divergence rate is
acceptable *after* seeing the number is how a gate becomes a formality. It was set
under half a percent in advance, which is why zero means something.

## References

| Source | Event | Recording |
| --- | --- | --- |
| Eval toolchain: versioned trajectories, approved baseline, human gate | [DataHack Summit 2026](https://www.analyticsvidhya.com/datahacksummit/), Aug 2026 | Not published |
| A deployment gate with a non-negotiable floor, demonstrated blocking a release | [MLDS 2026](https://mlds.analyticsindiamag.com/), Mar 2026 | Not published |
| Tackling antipatterns with an AI-driven development lifecycle | [AWS Summit Bengaluru 2026](https://aws.amazon.com/events/summits/bengaluru/), Apr 2026 | [Keynote](https://www.youtube.com/watch?v=CprBATdRoh0) |
| Constraints beat cleverness: the model for reasoning, not enforcement | [MLDS 2026](https://mlds.analyticsindiamag.com/), Mar 2026 | Not published |
| Full hall recordings across three days | [CYPHER 2025](https://cypher.analyticsindiamag.com/), Sept 2025 | [Day 2, Hall 3](https://www.youtube.com/watch?v=uOqflHyRxcs) |

*Related: [agent replay without the side effects](/blog/agent-replay-without-the-side-effects),
which is the same idea applied to a conversational agent rather than a rules
engine — and which, unlike this one, never got its divergence gate built.*
