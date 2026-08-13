---
title: LLM-as-judge in the send path, and the human-label calibration that gives its score an error bar
date: 2026-08-20
summary: Once a system generates text faster than anyone can read it, the choice is between shipping unreviewed output and building something that reviews it — and human review does not scale to every message while sampling misses exactly the rare failures worth catching. A small model grading a large one costs a fraction of the thing it guards, which is what makes total coverage affordable rather than aspirational. The catch is that a judge nobody has scored against human labels produces a number with no error bar, and a confidently wrong judge looks exactly like a working one.
tags: [agent-evals, riteangle]
---

Model-graded evaluation was the loudest theme at the 2026 conferences I went to.
A cloud vendor now ships it as a managed service. A pharmaceutical team presented
a deployment gate built on it. It appears, in one form or another, in most agent
architectures I saw presented this year.

It is also the technique people are least rigorous about, because a judge that
returns confident nonsense is indistinguishable from one that works.

## Two placements, two different problems

![Two placements. Blocking: the judge sits between generator and user, so latency
is on the critical path and a false positive costs the user their answer. Scoring:
the judge runs after the fact over stored outputs, where latency is irrelevant and
a false positive costs only a misleading dashboard.](/blog/judge-placement.svg)

The first decision is where the judge sits, and it changes everything else.

**Blocking** puts the judge between the generator and the user. Its verdict is
enforced. Latency lands on every request, cost lands on every request, and a false
positive costs a real person their answer.

**Scoring** runs the judge over stored outputs after the fact. Latency is
irrelevant, you can batch it overnight, and you can re-run the whole history every
time you change the rubric. A false positive costs you a misleading dashboard.

Most teams build the second and talk about it as though it were the first. The two
have almost nothing in common operationally. If your judge has never blocked
anything, it is a measurement instrument, not a control.

riteangle runs the blocking placement, for one narrow purpose: every outbound
message from an agent is graded before it can be sent. That is described in more
detail in [a safety validator that is also a
model](/blog/a-safety-validator-that-is-also-a-model). This post is about the
technique generally.

## Judging is classification, so buy the cheap model

The economics only work because grading is a much smaller job than generating.

| | Generator | Judge |
| --- | --- | --- |
| Model | Claude Sonnet 4.5 | Claude Haiku 4.5 |
| Input | Full assembled context | The output, plus a rule list |
| Output budget | up to 700 tokens | 120 tokens |
| Output shape | Prose a person reads | A structured verdict |
| Share of generator's output budget | — | **~17%** |

Generation needs capability. Judging needs consistency and a decent grasp of the
rubric. Those are different requirements, and the second is much cheaper to buy.

This ratio is what makes 100% coverage affordable. Sampling a judge is usually a
false economy: the cases you most want caught are rare, and a 5% sample catches
5% of them.

## Designing the rubric

Four things that separate a judge that works from one that produces noise.

**Enumerate behaviours, do not ask for a quality score.** "Rate this reply 1–5"
produces a number with no defensible meaning. A list of specific forbidden
behaviours produces a verdict you can act on and argue with. Ours has ten entries
— impersonation, invented facts, revealing that another user blocked you, framing
money as a reason someone is desirable, and so on.

**Demand structured output, not prose.** The judge returns a verdict and the rule
that was broken. If you have to parse an opinion, you have built a second
generation problem on top of your first.

**Name the rule in the verdict, because you will feed it back.** A verdict that
only blocks teaches nothing. A verdict that says *which* rule broke lets you
re-prompt the generator with that specific constraint, and it usually produces a
clean second attempt. The model was rarely trying to break the rule; it did not
know the rule applied to the sentence it wrote.

**Split rules by whether you can specify them exactly.** Anything expressible as a
pattern — account numbers, contact details, identifiers — belongs in a
deterministic check before the model ever runs, and that check should fail closed.
Reserve the judge for the judgement calls. Asking a model to regex is wasteful and
less reliable than a regex.

## The step almost nobody runs

![A loop. Sample stored outputs. Humans label them against the same rubric. The
judge scores the identical sample. Compare to get agreement rate, false positives
and false negatives. Adjust rubric, tier or threshold.](/blog/judge-calibration.svg)

Here is the uncomfortable part, and I include myself in it.

A judge produces a number. Nobody checks the number against reality. Ours has
never been scored against human labels, so I cannot tell you its false-positive
rate — and a false positive here costs a real user a real message.

The loop is not complicated. Sample stored outputs. Have humans label them against
the same rubric the judge uses. Run the judge over the identical sample. Compare.
You get an agreement rate, a false-positive rate and a false-negative rate, and
those three numbers tell you whether to change the rubric, move to a different
model tier, or shift the threshold.

Two details matter. Label against the *same* rubric, or you are measuring
disagreement about the rules rather than the judge's accuracy. And have more than
one person label an overlapping subset, so you know how much humans agree with
each other before you hold a model to that bar.

Without this you have a number with no error bar. That is worse than no number,
because it gets put on a dashboard and believed.

## Known failure modes

These come up repeatedly in the literature and in what practitioners described on
stage. Worth testing for explicitly.

| Failure mode | What happens | Mitigation |
| --- | --- | --- |
| **Verbosity bias** | Longer answers score higher regardless of quality | Include length-matched pairs in the calibration set |
| **Position bias** | In pairwise comparison, one position wins more often | Run both orderings and average |
| **Self-preference** | A judge favours text from its own model family | Use a different family from the generator where you can |
| **Rubric drift** | Rules are edited; old scores no longer comparable | Version the rubric; store the version with the verdict |
| **Fail-open blindness** | Provider errors silently pass everything | Alert on the error path, do not just count verdicts |
| **Threshold theatre** | A gate exists but never blocks anything | Track block rate; a rate of zero means no gate |

The last two are the ones I would check first in any system, because both present
as a perfectly healthy dashboard.

## What the industry showed this year

| What was presented | Where | The idea worth stealing |
| --- | --- | --- |
| Managed agent evaluations as a cloud service, with an evaluator taxonomy covering tool-selection accuracy, goal success rate and harmfulness | [AWS Summit Bengaluru 2026](https://aws.amazon.com/events/summits/bengaluru/) | Judging is not one thing. Separate evaluators for *did it pick the right tool*, *did it achieve the goal*, and *was it harmful* |
| A weighted deployment gate with a non-negotiable trust floor, demonstrated on a pipeline that scored 79 and was blocked | [MLDS 2026](https://mlds.analyticsindiamag.com/) | A floor that overrides the composite. A high average must not buy your way past a critical failure |
| Chain-of-thought judging | [DataHack Summit 2026](https://www.analyticsvidhya.com/datahacksummit/) | Make the judge reason before it rules; the reasoning is also your audit trail |
| Human-in-the-loop measured by edit distance trending down | [MLDS 2026](https://mlds.analyticsindiamag.com/) | A judge-free quality signal you already have the data for |
| An eval toolchain with versioned trajectories, tagged runs and an approved baseline behind a human gate | [DataHack Summit 2026](https://www.analyticsvidhya.com/datahacksummit/) | Treat eval runs as versioned artifacts, not console output |

The pharma example is the one I keep returning to. Their pipeline scored 79
against a gate of 80 and was blocked — because 4 of 1,851 generated statements
had no source mapping. An audit trail that was **99.8% complete** was still a hard
fail.

That is what a real gate looks like. It refuses things that are nearly good
enough, and the team presented their own system failing it.

## The pattern, without the dating app

> **Use a cheap model to grade an expensive one against an enumerated rubric,
> return a structured verdict naming the broken rule, feed that rule back for one
> corrective attempt, and calibrate the judge against human labels before you
> trust a single number it produces.**

| Setting | What the judge grades | The rule that must never pass |
| --- | --- | --- |
| **Clinical documentation** | A drafted note before it enters the record | A diagnosis or dose the clinician never stated |
| **Financial advice** | Client-facing summaries | A performance guarantee, or advice outside the stated risk profile |
| **Insurance claims** | Correspondence explaining a decision | An admission of liability, or coverage beyond the adjudicated outcome |
| **Recruiting** | Candidate feedback | Reasoning that touches a protected characteristic |
| **Code generation** | A generated patch before review | A hard-coded credential, or a known injection pattern |
| **Regulated support** | Refunds and complaint responses | An entitlement the policy does not grant |

Three transferable rules:

**Decide blocking or scoring before you build.** They have different latency
budgets, different cost ceilings and different consequences for a false positive.
Building one and deploying it as the other is the most common mistake here.

**Choose the failure direction per stage and write down why.** In a consumer
product, failing open on the model stage keeps the product alive during a provider
outage — and I have argued for that choice in our own system. In a clinical or
financial setting I would fail closed and accept the outage, because a blocked
message is an inconvenience while an ungraded one is a regulatory event.

**Store every verdict, and then actually read them.** We log every block with the
original text, the substitute, the rule broken and the stage that caught it. That
table has never been read by anything. The corpus that would let me calibrate the
judge is sitting there, accumulating, untouched — which is an accurate description
of most eval data I have heard described.

## What we owe on this

Plainly, from our own system:

| Quantity | Status |
| --- | --- |
| Rules in the graded stage | 10, configured |
| Corrective regenerations | 1, configured |
| Coverage | every outbound message |
| Judge output budget | 120 tokens, ~17% of the generator's |
| **Block rate** | **unmeasured** |
| **False-positive rate** | **unmeasured** |
| **Retry rescue rate** | **unmeasured** |
| **Human agreement with the judge** | **never tested** |

Everything above the line is a configuration choice, which is easy. Everything
below it is measurement, which is the actual work. All four are answerable from
data already stored.

## References

Most sessions have no published recording — these events tend to livestream whole
halls rather than publish individual talks. Where one exists it is linked.

| Source | Event | Recording |
| --- | --- | --- |
| Managed agent evaluations and evaluator taxonomy | [AWS Summit Bengaluru 2026](https://aws.amazon.com/events/summits/bengaluru/), Apr 2026 | [Keynote](https://www.youtube.com/watch?v=CprBATdRoh0) |
| Weighted deployment gate with a non-negotiable trust floor | [MLDS 2026](https://mlds.analyticsindiamag.com/), Mar 2026 | Not published |
| Chain-of-thought judging | [DataHack Summit 2026](https://www.analyticsvidhya.com/datahacksummit/), Aug 2026 | Not published |
| Eval toolchain: versioned trajectories, approved baseline, human gate | [DataHack Summit 2026](https://www.analyticsvidhya.com/datahacksummit/), Aug 2026 | Not published |
| Edit distance as a human-in-the-loop metric | [MLDS 2026](https://mlds.analyticsindiamag.com/), Mar 2026 | Not published |
| Building real agentic systems — Alessandro Romano | [DataHack Summit 2025](https://www.analyticsvidhya.com/datahacksummit-2025/) | [Recording](https://www.youtube.com/watch?v=-YG9WGThlgI) |
| Full hall recordings across three days | [CYPHER 2025](https://cypher.analyticsindiamag.com/), Sept 2025 | [Day 2, Hall 3](https://www.youtube.com/watch?v=uOqflHyRxcs) · [Day 3, Hall 3](https://www.youtube.com/watch?v=o9nrXPslI3Y) |

*Companion to [a safety validator that is also a
model](/blog/a-safety-validator-that-is-also-a-model), which covers how this is
wired into one production system.*
