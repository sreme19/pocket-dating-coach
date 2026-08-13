---
title: LLM-as-judge in the send path, and the human-label calibration that gives its score an error bar
date: 2026-08-20
summary: Once a system generates text faster than anyone can read it, the choice is between shipping unreviewed output and building something that reviews it — and human review does not scale to every message while sampling misses exactly the rare failures worth catching. A small model grading a large one costs a fraction of the thing it guards, which is what makes total coverage affordable rather than aspirational. The catch is that a judge nobody has scored against human labels produces a number with no error bar, and a confidently wrong judge looks exactly like a working one.
tags: [agent-evals, riteangle]
---

The moment your system writes more text than a person can read, you have made a
decision whether you meant to or not. Either something unreviewed is going out to
real people, or something other than a human is doing the reviewing.

Sampling does not rescue you. The failures worth catching are rare by definition,
and a five percent sample catches five percent of them. Neither does a bigger
team — review cost scales with volume and volume is the thing you built the
system to increase.

So a second, cheaper model reads the first one's output and grades it. That is
now standard: a cloud vendor ships it as a managed service, and it appeared in
most agent architectures I saw presented this year.

It is also the technique people are least rigorous about, because a judge
returning confident nonsense is indistinguishable from one that works.

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

Four things separate a judge that works from one that produces noise.

### Enumerate behaviours, do not ask for a quality score

Suppose the generator writes: *"He sounds lovely — and he's a doctor, so you'd
never have to worry about money again."*

Ask for a rating and you get back `4`. Now what? You cannot regenerate against a
4. You cannot argue with a 4. You cannot tell whether the next reply scoring 4 has
the same problem or a different one, and you certainly cannot show a 4 to a
colleague and have them agree it was correct.

Ask against a named list and you get `rule 6 — money framed as a reason someone
is desirable`. That is actionable, contestable, and countable. Ours has ten
entries: impersonating the person it works for, inventing facts about someone,
revealing that another user blocked or reported you, and so on.

The test: **could two people disagree about whether the rule was broken, and
resolve it by reading the rule?** If yes, it is a usable criterion. A score has
nothing to resolve against.

### Demand structured output, not prose

The judge should return something like `{ pass: false, rule: "R6" }`.

What you do not want is the judge being helpful:

> Overall this response is warm and appropriate. That said, the reference to his
> profession and financial security **could arguably** be read as framing wealth
> as desirability, though in context it seems more like…

Now you are writing a parser for hedged opinions. Does "could arguably" mean
blocked? Is the bold formatting significant? We hit exactly this in another
project — a small loop whose entire job was recovering a four-state verdict from
prose that sometimes arrived bold, sometimes quoted, sometimes wrapped in a
sentence. That loop is a tax on having used prose as a return type.

### Name the rule in the verdict, because you will feed it back

A bare `blocked` teaches the generator nothing, so its second attempt is a coin
flip. Name the rule and the same model, on the same prompt, with the same single
retry, usually lands it.

![Two lanes from the same blocked output. On the left a bare refusal travels back,
the generator learns only that it failed, and the second attempt is a guess likely
to end at the fallback. On the right the verdict names the broken rule, that
constraint travels back with the re-prompt, and the second attempt targets it and
passes.](/blog/verdict-feedback.svg)

The second attempt is not merely compliant, it is better writing — the constraint
forced specificity where the first reached for the laziest available evidence.
The model was never trying to break the rule. It did not know the rule applied to
the sentence it had written.

Which gives a way to think about verdict design generally: **a verdict is a
message to the generator, and its information content decides whether your retry
is a control loop or a second roll of the dice.** Anything you spend making the
verdict more specific is repaid on every regeneration.

### Sort the rules by whether you can write them down exactly

Take two real rules and ask, of each: could you hand this to a stranger as a
precise instruction and expect them to apply it the same way you would?

**"Never include a phone number."**

You can. A phone number is a run of digits in a recognisable shape. That is a
pattern match — it runs before the model is called at all, it costs nothing, and
it can safely refuse on any error, because there is no judgement in it to get
wrong. Give this job to a model and you are paying for inference to do, less
reliably, what one line of pattern matching does perfectly.

**"Never write as though you are her, rather than as her assistant."**

You cannot. Compare two replies the agent might send on her behalf:

> *"Yes, Saturday works — see you at seven."*
>
> *"Saturday looks clear for her. Shall I check?"*

The first commits her to a plan she never agreed to. The second does not. No list
of banned words separates them. The difference is **who the sentence claims to
speak for**, and it is carried by the word "yes", by "see you", by her name being
absent. You cannot enumerate that. It needs a judge.

Getting this split wrong is expensive in both directions:

| Mistake | What it costs |
| --- | --- |
| Sending the phone number to the judge | Slower, dearer, and less accurate than the regex you already could have written |
| Sending impersonation to a regex | A banned-phrase list that misses every real case and blocks ordinary sentences |

So sort the list before you build anything. **Can you write the check as an
assertion?** Then write the assertion. If explaining the rule requires the words
*reads as*, *implies* or *comes across*, no assertion exists and you need the
judge.

## The step almost nobody runs

![A loop. Sample stored outputs. Humans label them against the same rubric. The
judge scores the identical sample. Compare to get agreement rate, false positives
and false negatives. Adjust rubric, tier or threshold.](/blog/judge-calibration.svg)

A judge produces a number, and in most systems nothing ever checks that number
against reality. That matters more in the blocking placement than the scoring one:
a false positive there does not skew a chart, it costs a real person the message
they were waiting for.

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

Each of those is easier to recognise with an instance attached.

**Verbosity bias.** Two replies say the same true thing. One is *"Yes — his ID and
income are both verified."* The other spends three warm paragraphs arriving at the
same fact. Ask a judge which is more helpful and the long one tends to win,
because length reads as effort. Now your judge is quietly training you toward
padding. Catch it by putting length-matched pairs into the calibration set on
purpose — same content, different word count — and checking whether the verdicts
track.

**Position bias.** You show the judge two candidate openers and ask which is
better. Run the same pair with the order swapped and a meaningful share of the
verdicts flip. Nothing about the text changed; only which one appeared first. Any
pairwise judging needs both orderings run and averaged, or you are measuring
position as much as quality.

**Self-preference.** A judge tends to rate text from its own model family more
kindly. Any setup where a small model grades a larger one from the same provider
carries this — same house style, same phrasing instincts, so an equally compliant
reply written in a different idiom can score worse. Crossing providers removes it
and costs you a second integration, another bill and a second latency profile.
Worth deciding deliberately rather than by default: if your rubric is mostly
about tone, the exposure is real; if it is mostly about facts and forbidden
content, it matters much less.

**Rubric drift.** Rule 6 starts as *money framed as desirability*. Six weeks later
you broaden it to cover status generally — job titles, schools, postcodes. Block
rate jumps and it looks like the generator got worse. It did not; the ruler
changed. Without a version stamped on every stored verdict, you cannot tell a
regression from a redefinition, and every trend line crossing that edit is
meaningless.

**Fail-open blindness.** Say your model provider has a bad forty minutes —
timeouts, 503s, the usual. The judge stage is built to let messages through when
it cannot reach the model, so every message sent in that window ships without
being graded at all.

Now follow what gets recorded. Nothing was blocked, so nothing is written to the
violations table. Nothing in the table means nothing on the dashboard. The hour
reports zero violations.

Zero violations is also exactly what a flawless hour looks like.

That is the trap. **"Nothing was wrong" and "nothing was checked" produce
identical data**, so no amount of counting verdicts separates them — the count is
zero either way. The only thing that tells them apart is a count of how often the judge failed to
run — a number that lives on the error path rather than the verdict path, and gets
skipped precisely because it is not a verdict. Emit it as a metric, alert when it
is non-zero for more than a few minutes, and the ambiguity disappears.

**Threshold theatre.** A gate that has never blocked anything is not a gate. It
is a component that returns `pass`, costs money on every request, and provides
reassurance.

Nothing will alert you to this. A gate that blocks nothing throws no errors, fails
no requests and breaks no tests — it is indistinguishable from a gate protecting a
well-behaved system. The only symptom is an absence, and absences do not page
anyone.

The detection is unglamorous: track the block rate as a number somebody actually
looks at, and set a floor alert rather than a ceiling one. A rate of zero over a
week means either your generator is flawless or your gate is decorative — and if
you cannot say which, you do not currently have a gate, whatever the architecture
diagram says.

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

## Four numbers, in the order worth building them

Configuration is the easy half — how many rules, how many retries, which model
tier. Those are decisions you make once. The measurement half is the work, and it
is where most implementations stop.

If you are building this, these are the four numbers that make the difference
between a judge and a decoration, roughly in order of effort against payoff.

| Number | How to get it | What it tells you |
| --- | --- | --- |
| **Block rate** | Count blocks over total graded, per rule | Whether the gate does anything at all — and which rules are load-bearing versus decorative |
| **Retry rescue rate** | Of blocked outputs, how many pass on the second attempt | Whether naming the rule in the verdict is actually working, or whether you are just paying twice to reach the same fallback |
| **Fail-open count** | Emit a metric on the judge's error path, not its verdict path | Whether your clean hours are clean or simply ungraded |
| **Human agreement** | Sample, dual-label against the same rubric, compare | The only one that gives your block rate an error bar |

The first three are counters over data most systems already store, and can be
built in an afternoon. The fourth needs people and a sampling plan, and it is the
one that converts everything above it from an activity into a measurement.

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
