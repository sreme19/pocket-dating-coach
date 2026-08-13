---
title: A safety validator that is also a model
date: 2026-08-15
summary: Every outbound message from riteangle's agents is graded by a second, cheaper model before it can be sent. Two stages, failing in opposite directions, with one corrective regeneration in between. Here is the design and the part of it I am not comfortable with.
tags: [guardrails, riteangle]
---

An agent in riteangle writes on someone's behalf. It messages a stranger as a
woman's proxy, it briefs her privately about a man, it coaches him without her
seeing it. Every one of those outputs is a message a real person reads and
attributes to a real person.

So nothing an agent generates goes out unexamined. Every outbound message passes
a two-stage gate first, and the second stage is itself a language model grading
the first one's work.

## Two stages, failing in opposite directions

![A generated reply passes a pattern scan that fails closed, then a small model
grading it against ten forbidden behaviours that fails open. A block triggers one
corrective regeneration before a safe fallback is
substituted.](/blog/validator-stages.svg)

Stage one is a set of regular expressions looking for personal data — email
addresses, phone numbers in two formats, and the Indian identity documents people
actually paste at each other. It is dumb, fast and certain.

Stage two is the interesting one. A small model receives the large model's
output and grades it against a list of forbidden behaviours: impersonating the
person it works for, inventing facts about someone, revealing that another user
blocked or reported you, framing money as a reason somebody is desirable. It
returns a structured verdict, not prose.

The two stages **fail in opposite directions**, and that is deliberate.

The pattern scan fails **closed**. If it errors, the message does not go. A regex
that throws is a bug in seven lines of code I control, it will be loud, and it
will be fixed the same day.

The model validator fails **open**. If the API is down, times out, returns a
non-200, or emits something unparseable, the message goes through ungraded.

I want to be straightforward that this is the weakest decision in the design. It
means an upstream outage silently removes an entire safety stage — the system
does not degrade into caution, it degrades into trust. The argument for it is
that this validator sits in the critical path of every single message, and a
provider blip would otherwise convert into a total product outage where nobody
can talk to anybody. The argument against it is that "safety off" and "product
up" is exactly the wrong pair of states to choose.

What makes it defensible rather than merely convenient is that the regex layer
underneath is still fail-closed, so the categories with the worst blast radius —
leaked identity documents, leaked contact details — remain covered when the model
stage is unavailable. What would make it properly defensible is alerting on the
fail-open path, which is not built.

## The corrective regeneration

The first version deflected immediately: fail the gate, substitute a safe
fallback, done.

That behaviour caused an incident. A woman tapped through to read her briefing
about a man — the summary she had been waiting on — and got a generic deflection
instead, because one clause somewhere in a long, useful, entirely appropriate
message had tripped the validator. The gate did its job and the product failed
her.

Now a block does not end the turn. The generator is re-prompted **with the
specific violation named**, produces a second attempt, and that attempt is graded
again. Only if it fails twice does the fallback appear. Both attempts are logged.

This is the same shape as the compliance pattern that has become standard in
agent stacks — an evaluator sitting in the loop rather than in a dashboard — but
the detail that matters is that the evaluator's output is *fed back to the
generator as an instruction*. A verdict that only blocks teaches nothing. A
verdict that says which rule was broken usually gets a clean second attempt,
because the model was not trying to break the rule, it just did not know the
rule applied to the sentence it wrote.

## A small model can afford to watch a big one

![The generator runs a large model with up to roughly seven hundred output
tokens. The validator runs a small model returning about a hundred and twenty
structured tokens. The guard costs a fraction of what it
guards.](/blog/validator-tiers.svg)

The economics are what make this run on **every** message rather than a sample.

The generator is a frontier model with a budget of several hundred output tokens,
because it is writing something a person will read. The validator is a small,
cheap model returning a short structured verdict, because "is this compliant, and
if not, which rule" is a classification problem, not a writing problem.

This mirrors a pattern that showed up repeatedly across the conferences I sat in
this year. A pharma-regulatory team at the AWS summit presented an architecture
where in-house small models handle traffic first and escalate to frontier models
only when confidence drops. Same instinct, inverted: they use the cheap model to
avoid calling the expensive one, we use the cheap model to check the expensive
one. Both work because a small model is adequate at judging and inadequate at
composing.

## Where the industry has got to

Evaluation-as-a-product was the loudest theme in my 2026 slide archive, and it
has moved from conference talk to shipped feature faster than almost anything
else I tracked.

| What was shown | Where | Where riteangle stands |
| --- | --- | --- |
| Managed agent evaluations shipping as a preview cloud service, with an evaluator taxonomy covering tool-selection accuracy, goal success and harmfulness | AWS Summit Bengaluru 2026 | We run one evaluator, on harmfulness only. No goal-success scoring at all |
| A weighted deployment gate with a hard trust floor that blocks release regardless of the composite score — demonstrated on a pipeline that scored 79 and was blocked | MLDS 2026 | We gate individual messages, not releases. No pre-deployment gate exists |
| An evaluation toolchain with versioned trajectories, tagged runs and an approved baseline behind a human approval step | DataHack Summit 2026 | **Not built.** We have no golden set and no baseline to regress against |
| Model-graded evaluation as a standard architecture pattern | Across most 2026 events | Present, and in the critical path rather than offline |

The honest summary of that table: we are ahead on *enforcement* and behind on
*measurement*. Our validator blocks a real message in production today, which
several of those talks were still describing as an ambition. But nobody has ever
scored our validator against human labels, so I cannot tell you its false-positive
rate. Given that a false positive costs a user their briefing — the exact incident
above — that is a real gap, not a theoretical one.

There is a second gap worth naming. Every block is written to a violations table
with the original text, the substitute, the rule broken and the stage that caught
it. That table is written and **never read**. There is no screen, no digest, no
alert. The corpus that would let me calibrate the validator is accumulating
untouched, which is a slightly absurd place to have arrived at.

## What the model may not do to its own output

One more constraint, because it is the part people find surprising.

The validator can block a message. It cannot edit one.

There is no path where a model rewrites another model's output and sends the
rewrite. A blocked message goes back to the original generator with a reason, or
it becomes a fixed fallback string. Nothing composes a correction on the fly.

The reason is attribution. These messages carry a real person's voice to another
real person. A generator writing on her behalf is already a stretch; a *second*
model silently amending what the first one said on her behalf, with no one in the
loop, puts words at two removes from the human they are attributed to. Blocking is
honest — something was wrong and we did not send it. Quiet editing is not.

## References

Most sessions referenced here have no published recording. Where one exists it is
linked.

| Source | Event | Recording |
| --- | --- | --- |
| Managed agent evaluations, evaluator taxonomy, agent registry | AWS Summit Bengaluru 2026, Apr 2026 | Not published |
| Confidence-threshold routing between small and frontier models | AWS Summit Bengaluru 2026, Apr 2026 | Not published |
| Weighted deployment gate with a non-negotiable trust floor | MLDS 2026, Mar 2026 | Not published |
| Evaluation toolchain: versioned trajectories, approved baseline, human gate | DataHack Summit 2026, Aug 2026 | Not published |
| Keynote covering the production-readiness gap for agents | AWS Summit Bengaluru 2026 | [Recording](https://www.youtube.com/watch?v=CprBATdRoh0) |
| Full hall recordings, several evaluation sessions | CYPHER 2025, Sept 2025 | [Day 2, Hall 3](https://www.youtube.com/watch?v=uOqflHyRxcs) |

*Third of nine posts on riteangle's architecture. Previous:
[cross-thread agent memory without cross-user leakage](/blog/cross-thread-agent-memory-without-leakage).
Next: context assembly, and what an agent is told before it says a word.*
