---
title: A fail-closed regex and a fail-open model judge on every message, and the single corrective retry between them
date: 2026-08-15
summary: An agent writing on someone's behalf produces text a real person reads and attributes to a real person, and nobody can read all of it before it goes. Sampling misses exactly the rare failures worth catching. A small model grades every outbound message against an enumerated rubric at roughly a sixth of the generator's budget, which is what makes total coverage affordable — and the uncomfortable part is that nothing has ever checked whether the grader is right.
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

Stage two is the interesting one. A small model receives the large model's output
and grades it against a list of forbidden behaviours:

- Impersonating the person it works for
- Inventing facts about someone
- Revealing that another user blocked or reported you
- Framing money as a reason somebody is desirable

It returns a structured verdict, not prose.

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

One thing keeps this defensible rather than merely convenient: the regex layer
underneath still fails closed. The categories with the worst blast radius —
leaked identity documents, leaked contact details — stay covered even when the
model stage is down.

What would make it *properly* defensible is alerting on the fail-open path. That
is not built.

## The corrective regeneration

The first version deflected immediately: fail the gate, substitute a safe
fallback, done.

That behaviour caused an incident.

A woman tapped through to read her briefing about a man — the summary she had
been waiting on. She got a generic deflection instead. One clause, somewhere in a
long and entirely appropriate message, had tripped the validator.

The gate did its job. The product failed her.

Now a block does not end the turn. The generator is re-prompted **with the
specific violation named**, produces a second attempt, and that attempt is graded
again. Only if it fails twice does the fallback appear. Both attempts are logged.

This is the now-standard shape: an evaluator in the loop, rather than in a
dashboard. But one detail does the work. The evaluator's verdict is *fed back to
the generator as an instruction*.

A verdict that only blocks teaches nothing. A verdict that names the broken rule
usually gets a clean second attempt — because the model was never trying to break
the rule. It just did not know the rule applied to the sentence it wrote.

Here is what that looks like on a real message shape. An agent is recommending a
man to the woman it works for, and reaches for the easiest available evidence:

![A worked example. The first attempt recommends a man by citing his salary and
is blocked under the rule forbidding money as a reason someone is desirable. The
rule is named and fed back. The second attempt describes what he has built and
how he talks about it, and passes.](/blog/validator-example.svg)

The first attempt is not offensive. It is not a policy violation in any obvious
sense. It is just the laziest possible reason to want to meet someone, and it is
exactly the register this product should never adopt — so it is rule six on the
list.

What I find persuasive about this example is that the second attempt is *better
writing*, not merely permitted writing. Naming the constraint pushed the model
off the generic sentence and onto a specific one. That is the case for
regenerating rather than deflecting, in one comparison.

## Why a cheap model can guard an expensive one

![The generator runs a large model with up to roughly seven hundred output
tokens. The validator runs a small model returning about a hundred and twenty
structured tokens. The guard costs a fraction of what it
guards.](/blog/validator-tiers.svg)

The economics are what make this run on **every** message rather than a sample.

The generator is a frontier model with a budget of several hundred output tokens,
because it is writing something a person will read. The validator is a small,
cheap model returning a short structured verdict, because "is this compliant, and
if not, which rule" is a classification problem, not a writing problem.

The output budget for the validator is **120 tokens against the generator's 700 —
about 17%** — and the input side is more lopsided still. The generator receives
the full assembled context: profile, match history, transcript, priorities. The
validator receives the reply text and a rule list, and nothing else. On top of
that it runs on a cheaper model tier.

This mirrors a pattern that came up repeatedly at the conferences I went to this
year. A pharma-regulatory team at the AWS summit presented an architecture
where in-house small models handle traffic first and escalate to frontier models
only when confidence drops. Same instinct, inverted: they use the cheap model to
avoid calling the expensive one, we use the cheap model to check the expensive
one. Both work because a small model is adequate at judging and inadequate at
composing.

### What we measure, and what we don't

I would rather show this as a table than imply a rigour we do not have.

| Quantity | Value | Source |
| --- | --- | --- |
| Patterns in the fail-closed stage | 7 | Configured |
| Rules in the model-graded stage | 10 | Configured |
| Corrective regenerations allowed | 1 | Configured |
| Validator output budget | 120 tokens | Configured |
| Generator output budget | up to 700 tokens | Configured |
| Validator budget as a share of generator | ~17% | Derived |
| Messages graded | every outbound message | By design, not sampled |
| **Block rate** | **unmeasured** | No dashboard reads the violations table |
| **False-positive rate** | **unmeasured** | Validator never scored against human labels |
| **Share of blocks the retry rescues** | **unmeasured** | Both attempts are logged; nothing aggregates them |
| **Fail-open events during provider outages** | **unmeasured** | No alerting on that path |

The top half of that table is configuration, which is easy. The bottom half is
measurement, which is the actual work, and it is not done. Every one of those
unknowns is answerable from data already sitting in the database — which makes
their absence a choice about priorities rather than a limitation.

## Where the industry stands

Evaluation-as-a-product was the loudest theme across the 2026 events I attended,
and it has moved from conference talk to shipped feature faster than almost
anything else I have followed.

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
alert. The data that would let me calibrate the validator is accumulating
untouched, which is a slightly absurd place to have arrived at.

## The pattern, without the dating app

Nothing above is specific to dating. Strip the domain and the pattern is:

> **Layered output validation with corrective regeneration.** A deterministic
> fail-closed check for the categories you can specify exactly, a model-graded
> fail-open check for the categories you cannot, and one bounded regeneration in
> which the failing rule is named back to the generator before you give up on the
> turn.

It applies wherever a generative system produces text that a real person reads
and attributes to an organisation or another human — which is most deployed
agents.

| Industry | The equivalent outbound message | What the rule list becomes |
| --- | --- | --- |
| **Clinical documentation** | A drafted note or discharge summary going into a patient record | No diagnosis not stated by the clinician, no invented medication or dose, no prognosis language the clinician did not use |
| **Financial advice and wealth** | Any client-facing summary or suggestion | Suitability boundaries, no performance guarantees, mandatory disclosures, no advice outside the client's stated risk profile |
| **Insurance claims** | Correspondence explaining a decision | No coverage assertion beyond the adjudicated outcome, no admission of liability, no speculation about cause |
| **Recruiting** | Candidate feedback and outreach | No protected-characteristic reasoning, no commitment on compensation or start date, no claim about a role that the requisition does not support |
| **Regulated customer support** | Refunds, cancellations, complaint responses | No entitlement the policy does not grant, no promise of a timeline the operation cannot meet |
| **Legal drafting** | Any first draft reaching a client | No jurisdictional claim outside scope, no advice framed as certainty, privilege boundaries respected |

The transferable pieces are the three design choices, not the code:

**Split your rules by whether you can specify them exactly.** Anything expressible
as a pattern — identifiers, account numbers, contact details, banned phrases —
belongs in the deterministic stage and should fail closed. Anything requiring
judgement — tone, impersonation, unsupported claims, framing — belongs in the
model stage. Trying to regex a judgement call produces false positives; trying to
model-grade an account number is wasteful and less reliable than a pattern.

**Choose your failure direction per stage, deliberately, and write down why.**
Ours are opposite and that is the single most contestable decision in the design.
In a clinical or financial setting I would almost certainly fail closed on both,
and accept the outage. The cost asymmetry runs the other way there. A blocked
message is an inconvenience. An ungraded one is a regulatory event.

**Feed the violation back rather than deflecting.** A gate that only blocks
converts every borderline output into a lost interaction. Naming the specific rule
and regenerating once recovers most of them, and — as the example above shows —
frequently produces a better output than the first attempt, because the
constraint forces specificity.

The economics that make this viable are also general. A frontier model writes; a
small fast model judges.

Judging is classification. It does not need the capability you are paying for in
generation. So the guard costs a fraction of the thing it guards, and you can
afford to run it on every output rather than a sample.

That ratio holds across providers and tiers, whatever you are building.

## The validator can block. It cannot rewrite.

One more constraint, because it is the part people find surprising.

The validator can block a message. It cannot edit one.

There is no path where a model rewrites another model's output and sends the
rewrite. A blocked message goes back to the original generator with a reason, or
it becomes a fixed fallback string. Nothing composes a correction on the fly.

The reason is attribution. These messages carry a real person's voice to another
real person.

A generator writing on her behalf is already a stretch. A *second* model quietly
amending what the first one said, with nobody in the loop, puts the words two
removes from the human they are attributed to.

Blocking is honest: something was wrong, and we did not send it. Quiet editing is
not.

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
