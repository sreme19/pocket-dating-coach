---
title: Agent replay with writes suppressed at the boundary, so production can be debugged without sending a message
date: 2026-08-23
summary: To debug an agent you need the prompt it actually saw, and the only way to get that is to run it — which sends messages to real people. This harness is the production code path with the writes cut at the boundary, and every suppressed effect recorded in plain language rather than silently skipped. It is very good at showing you one turn and completely unable to tell you whether that turn was any good, which is the state most eval work is actually in.
tags: [agent-evals, riteangle]
---

To debug an agent you need to see what it saw. Not a reconstruction — the actual
prompt, the actual context, the actual output before anything downstream touched
it.

The obvious way to get that is to run the agent. The obvious problem is that
running it sends messages to real people.

## Same code, different ending

![Both paths share the same context loaders, prompt builders and model. They
diverge only at the final step: production writes and sends, replay records what
each write would have been and performs none of them.](/blog/replay-divergence.svg)

The replay harness is not a copy of the agent. It is the agent, with the writes
turned off.

It calls the same context loaders — the same twenty blocks, the same queries. It
calls the same prompt builders. It calls the same model, Claude Sonnet 4.5, with
the same parameters. The only divergence is at the end, where production writes to
the database and replay records what the write would have been.

That sharing is deliberate and it is the whole value. The usual arrangement is a
test fixture that reproduces the prompt, starts accurate, and rots. Six months
later you are debugging a prompt no user has ever received.

Here the tested prompt cannot drift from the live prompt, because there is only
one piece of code that builds it.

## The side-effect ledger

The part I would rebuild first in any other system is not the trace. It is the
list of things that did not happen.

Every write the agent would have performed is recorded, with a plain-language
reason. Not "suppressed" — the actual statement it would have run, and why it was
skipped. The timing row it would have written, and the note that the analytics
dashboard stays clean as a result. The checklist revision it would have advanced.
The notification it would have queued.

This turns "did anything leak?" from a worry into a list you read. A run that
should not have touched anything but shows a pending write is immediately visible.
And when someone adds a new side effect to the agent months later and forgets to
guard it, the ledger is where that shows up.

## What a run actually gives you

Nine steps, in order: which persona was selected and why, the profile that loaded,
the match context, retrieval results with similarity scores, the **full assembled
system prompt**, the **raw model output before any guardrail touched it**, token
usage, post-processing, the suppressed side effects, and the timings.

The two in bold are the ones that matter for debugging. The prompt is the thing
you can never reconstruct after the fact, and the pre-guardrail output tells you
whether a bad reply was the model's fault or something downstream mangling it.

There is also a small piece of cost engineering worth stealing. Pairwise scoring
results are cached against **both participants' profile versions**, so editing one
profile invalidates only the pairs that involve it, rather than the whole matrix.
A cached run makes zero model calls.

## And now the part that is missing

![Six capabilities built: trace, full prompt, raw output, token usage, suppressed
side effects, saved resumable runs. Six absent: stored test cases, expected
outputs, a baseline, a diff, a batch runner, any pass or fail
verdict.](/blog/replay-gap.svg)

There is no golden set. No expected outputs. No baseline. No diff between two
runs. No batch runner. No pass or fail.

A run produces a complete picture of one turn, and no judgement about whether that
turn was any good. You look at it and decide with your eyes.

The design document for this harness promised that runs could be *revisited or
diffed*. Only "revisited" shipped. That is a fairly typical outcome — the
inspection half is satisfying to build and immediately useful, while the
measurement half is tedious and only pays off later.

The irony is precise: every saved run already stores the prompt, the input and the
output. That is the raw material of a golden set. It has been accumulating for
months and nothing consumes it that way.

## Where this sits against what is being built elsewhere

| What was presented | Where | Where we stand |
| --- | --- | --- |
| An eval toolchain with versioned trajectories, tagged runs, an approved baseline and a human approval gate | [DataHack Summit 2026](https://www.analyticsvidhya.com/datahacksummit/) | We have trajectories. No versions, no tags, no baseline, no gate |
| Managed agent evaluations as a cloud service, scoring tool-selection accuracy, goal success and harmfulness | [AWS Summit Bengaluru 2026](https://aws.amazon.com/events/summits/bengaluru/) | We score harmfulness only, and only in production, never in replay |
| A deployment gate that blocked a release scoring 79 against a threshold of 80 | [MLDS 2026](https://mlds.analyticsindiamag.com/) | No gate exists. Nothing can fail |
| Marking which loop stages a coding agent may touch and which stay human-owned | [DataHack Summit 2026](https://www.analyticsvidhya.com/datahacksummit/) | Not formalised |

The pattern across all four is that they treat eval output as a **versioned
artifact** rather than console output. That is the step we have not taken, and it
is what separates a debugging tool from an evaluation system.

## Why this gap is so common

I want to be fair to the version of me that built the inspection half and stopped.

Inspection pays back the day you build it. The first time you open a trace and see
that the prompt contained a stale profile, it has already justified itself.

Measurement pays back later, and only if you keep it current. A golden set is a
liability the moment the product changes: cases go stale, expected outputs need
updating, and a suite that is 30% wrong is worse than no suite because people
learn to ignore its failures.

So the incentive gradient points at inspection, and most teams — most conference
talks, too, until this year — stop there. What changed in 2026 is that evaluation
started shipping as a product, which suggests enough people hit the ceiling of
looking at things with their eyes.

## The pattern, without the dating app

> **Build the replay harness out of the production code path, suppress writes at
> the boundary rather than mocking the layers above it, and record every
> suppressed effect as a readable list.** Then — and this is the part to actually
> finish — promote saved runs into a versioned case set with expected outputs, so
> a change can be compared rather than admired.

| Setting | What replay lets you do safely | The write to suppress |
| --- | --- | --- |
| **Support agents** | Re-run a real ticket against a changed prompt | The reply to the customer, and the ticket status change |
| **Clinical decision support** | Replay a real case with the current model | Anything written to the patient record |
| **Trading and risk** | Re-run a decision against yesterday's state | Order submission |
| **Code agents** | Replay a pull request review | The comment, the status check, the merge |
| **Outbound communication** | Re-run a campaign decision | The send |

Three transferable points:

**Suppress at the boundary, not in the middle.** Mocking the context layer means
testing a prompt that no longer matches production. Let everything run and cut the
final write — the divergence should be one clearly marked step.

**Record what would have happened, in words.** A boolean "dry run" flag tells you
nothing. A list saying *this row would have been written to this table, and here
is why it was skipped* is inspectable by someone who did not write the code.

**Version your runs against the prompt and model that produced them.** Ours are
not, which means a saved run cannot answer "was this before or after we changed
the system prompt". That single missing column is the difference between a
scrapbook and a baseline.

## What I would build next

Concretely, in order, all of it from data already stored:

1. Stamp saved runs with the prompt version and model version. One column each.
2. Promote a few dozen saved runs into a case set — they already contain input,
   prompt and output.
3. Add a diff between two runs over the same case.
4. Run the case set on a schedule and alert on drift.

None of that is research. It is a week of unglamorous work standing between a good
debugger and an actual evaluation system.

## References

Most sessions have no published recording. Where one exists it is linked.

| Source | Event | Recording |
| --- | --- | --- |
| Eval toolchain: versioned trajectories, tagged runs, approved baseline, human gate | [DataHack Summit 2026](https://www.analyticsvidhya.com/datahacksummit/), Aug 2026 | Not published |
| Managed agent evaluations and evaluator taxonomy | [AWS Summit Bengaluru 2026](https://aws.amazon.com/events/summits/bengaluru/), Apr 2026 | [Keynote](https://www.youtube.com/watch?v=CprBATdRoh0) |
| A weighted deployment gate with a non-negotiable floor | [MLDS 2026](https://mlds.analyticsindiamag.com/), Mar 2026 | Not published |
| Building real agentic systems — Alessandro Romano | [DataHack Summit 2025](https://www.analyticsvidhya.com/datahacksummit-2025/) | [Recording](https://www.youtube.com/watch?v=-YG9WGThlgI) |
| Full hall recordings across three days | [CYPHER 2025](https://cypher.analyticsindiamag.com/), Sept 2025 | [Day 2, Hall 3](https://www.youtube.com/watch?v=uOqflHyRxcs) |

*Eighth of nine posts on riteangle's architecture. Previous:
[how a sort-order default corrupted an agent's memory](/blog/how-a-sort-order-default-corrupted-an-agents-memory).
Next: why the scoring model is nine hand-designed dimensions rather than an
embedding.*
