---
title: Match decisions without a model in the loop
date: 2026-08-13
summary: riteangle runs LLMs at both edges of the matching pipeline and nothing in the middle. The decision itself is a weighted dot product and a min-cost max-flow solve. Here is the architecture, why the industry converged on it, and where we still violate it.
tags: [agent-architecture, riteangle]
---

Every night a batch job decides who meets whom. It loads the active pool, scores
every viable pairing, and commits the matches.

There is no LLM anywhere in that decision.

That surprises people, because riteangle is an agentic product end to end. There
is an assistant that coaches you, a proxy agent that messages on your behalf, a
generation step for every opener. But at the point where the system decides *who
you actually meet*, the model is out of the loop and the answer comes from
arithmetic.

## Probabilistic edges, deterministic core

![Five pipeline stages. Raw signals. LLM extraction run once per user, emitting
attribute and preference vectors. A weighted dot product. Min-cost max-flow
bipartite matching under per-side caps. LLM generation of the opener. Only stages
two and five involve an LLM.](/blog/who-decides.svg)

The LLM appears twice, at both ends, and never in between.

At ingestion it does what LLMs are genuinely good at: reading unstructured human
material — an uploaded payslip, a profile, a chat transcript — and emitting
structured estimates. It runs **once per user**, not once per pair, and its
output is cached. At generation it does the other thing LLMs are good at, which
is writing something a person will actually read.

Everything between those two points is a closed-form computation.

## Three vectors

Each user carries three vectors over a fixed taxonomy of dimensions — health,
career, financial, and so on. Nine open dimensions, plus four sensitive ones that
are excluded from any global ranking and only ever used in a pairwise context.

| Vector | Meaning | Range | Source |
| --- | --- | --- | --- |
| **v** — attributes | Claimed level on each dimension | 0–100 | LLM extraction |
| **c** — confidence | How corroborated that claim is | 0.3–1.0 | **Verified proofs only. Never the LLM** |
| **w** — preference weights | How much *this* user cares about each dimension | sums to 1 | LLM extraction, or set explicitly by the user |

Appeal of a candidate to an evaluator is a weighted dot product across the
taxonomy:

```text
A(m → f)  =  Σ  w[f,d] · v[m,d] · c[m,d]
             d
```

Because the weights are normalised and confidence is bounded above by 1, the
result stays on a 0–100 scale without clamping tricks.

Edge value is the **geometric mean** of the two directional appeals:

```text
value(m, f)  =  √( A(m → f) · A(f → m) )
```

The geometric mean rather than the arithmetic one, deliberately — it punishes
asymmetry. A pairing where one side scores 90 and the other 20 lands at 42, not
55. Lopsided enthusiasm is not a match, and the maths should say so.

Assignment is then a **min-cost max-flow solve** over the bipartite graph, with
per-side capacities acting as inbox caps rather than per-run quotas. That
distinction cost us: an earlier version applied caps per run, so a nightly solve
starting from a blank slate would hand out a full allocation on top of everything
already sitting in someone's inbox. Women hit 21 active matches against a cap of
12 before we caught it.

## Confidence is the vector the LLM never touches

This is the load-bearing constraint in the whole design.

An LLM will happily assign a high attribute score from a confident-sounding
profile. That is fine — **v** is a claim, and claims are cheap. What stops the
claim from propagating into the ranking is **c**, which is derived exclusively
from the verification record: proof categories completed, documents checked,
artifacts corroborated. It floors at 0.3 and only approaches 1.0 as real evidence
lands.

| | v (claimed) | c (confidence) | Effective contribution |
| --- | --- | --- | --- |
| Asserted, unproven | 90 | 0.3 | **27** |
| Asserted, verified | 90 | 1.0 | **90** |

Identical claim, identical LLM output, 3.3× the weight — purely as a function of
evidence.

Income goes further still. A stated salary is not scored by the LLM at all; it
runs through a fixed logarithmic curve normalised against cost-of-living by city
tier. It is the dimension people most reliably inflate and the one we can most
cheaply verify, so the model gets no vote.

## The industry converged here independently

I did not reason my way to this. I spent two years photographing conference
slides — roughly 900 across eleven events — and when I finally read the archive
as a corpus, the same architectural claim kept surfacing from organisations with
nothing in common.

| Organisation | Event | The claim |
| --- | --- | --- |
| **Everpure** | DataHack Summit 2026 | 40+ PB of live telemetry, tables past 250B rows. The LLM is **structurally barred from raw data**. It emits a declarative plan, compiled to a topologically sorted DAG and executed at *zero token burn*; a small model does final synthesis only |
| **INDmoney** | Data Engineering Summit 2026 | Telemetry feeds LLM agents for predictive silent-failure detection — but the **action is deterministic**: open a ticket, block the PR, apply the fix |
| **Novartis** | Data Engineering Summit 2026 | A multi-agent swarm over a zero-copy fabric, coordinated by a **deterministic knowledge graph** rather than an orchestrator agent, with cryptographically signed reasoning traces for continuous GxP |
| **Millennium** | MLDS 2026 | Stated it flatly: constraints beat cleverness. Use the model for reasoning, not for rule enforcement. Immutable audit trails, human-in-the-loop measured by *edit distance trending down* |
| **BITS Pilani** | MLDS 2026 | A quantified structure-over-policy argument, benchmarking a structured solver against multi-agent RL, OR-Tools and GNNs on a routing problem — presented on an agentic-AI stage |

A hedge fund, a pharma company, a fintech, an infrastructure team and an academic
lab. Different domains, different constraints, same conclusion: **let the model
reason, don't let it enforce.**

The failure mode they are all avoiding is the same one. A generative model in an
enforcement path is non-reproducible by construction — you cannot regression-test
it, you cannot explain a specific output after the fact, and you cannot tell a
drift from a prompt change. Put it at the edges and those problems stay at the
edges.

## The feedback loop we refused to close

There is a progress indicator in the app, derived from a man's score, shown to
the woman he is matched with.

We had to write a rule into the codebase to stop ourselves connecting it back.

![Three stages connected left to right: verified proofs, confidence weighting,
and the score plus progress bar the counterparty sees. A dashed return arrow from
the bar back into confidence is crossed out.](/blog/refused-loop.svg)

The temptation is obvious. Engagement against a high bar is signal, and signal is
useful. But the moment a displayed artifact feeds back into the confidence
weighting that produced it, the metric is partly measuring its own prior output.
It drifts, slowly, and no one can attribute the drift afterwards.

So there are two rules written down in capitals: this indicator never feeds trust
or match scoring, and the hand-off gate may *read* the score to decide what to
show, but nothing about what was shown propagates back into scoring. Both exist
because at some point somebody — me — was about to close the loop and had to be
argued out of it in writing.

Second-order effects in a ranking system are not a bug you find in testing. They
are a bug you find six months later when the numbers stop meaning what the
documentation says they mean.

## Where we violate our own architecture

I would rather state this than have someone find it.

Everything above describes the **nightly batch**. It does not describe the
on-demand path.

There is a "find matches now" button. Pressing it runs an LLM over the candidate
set, scores each pairing 0–100, and commits anything above 50 as a real match.
That is an LLM making a matching decision — precisely the thing this post argues
against.

It is bounded: a small lifetime quota per account, fifty candidates per run. It
exists because a nightly job is nightly, and a member who joins at 10am should
not stare at an empty inbox until 2am. It is still the weakest component in the
system.

There is a quieter defect too. The solver carries an assortative term meant to
discourage pairing across very different profile-strength bands, and it reads a
field that is only populated by an admin-triggered shadow scoring pass. In
practice that field is zero for most users, so the term contributes nothing —
and worse, it is *partially* populated, so the penalty fires asymmetrically
against exactly the users who were shadow-scored. A tuning parameter that appears
active and is inert is worse than no parameter, so it is getting wired up or
removed.

## What determinism costs

The honest trade-off: this architecture is worse at serendipity.

An LLM reading two full profiles can notice something oblique and charming that
no dimension in my taxonomy encodes. A weighted dot product will never find that.
It only knows the dimensions I thought to define, weighted the way users said they
wanted them weighted. Every ranking system inherits the blind spots of its
feature set, and mine are hard-coded.

What I get back is counterfactual explainability. Because scoring is a pure
function, I can re-run it with one input changed and get an exact answer: proving
this specific claim moves this man from fourth to second in this woman's ranking.
Not a plausible-sounding rationalisation — the actual recomputed result.

You cannot do that with a model's opinion. And when the output of the system is
*who someone spends their Saturday with*, being able to show the working matters
more than being occasionally delightful.

## References

Most of these talks have no published recording. Indian AI conferences tend to
livestream entire halls rather than publish individual sessions, and two of the
2026 events published nothing beyond a teaser. Where a recording exists it is
linked.

| Source | Event | Recording |
| --- | --- | --- |
| Everpure — deterministic execution layer, zero token burn | DataHack Summit 2026, Bengaluru, Aug 2026 | Not published |
| INDmoney — deterministic action from probabilistic detection | Data Engineering Summit 2026, May 2026 | Not published |
| Novartis — deterministic coordination of an agent swarm | Data Engineering Summit 2026, May 2026 | Not published |
| Millennium — trust in an agent when stakes are real | MLDS 2026, Mar 2026 | Not published |
| BITS Pilani — structure over learned policy | MLDS 2026, Mar 2026 | Not published |
| Full hall recordings, several relevant sessions | CYPHER 2025, Sept 2025 | [Day 2, Hall 3](https://www.youtube.com/watch?v=uOqflHyRxcs) · [Day 3, Hall 3](https://www.youtube.com/watch?v=o9nrXPslI3Y) |
| Building real agentic systems — Alessandro Romano | DataHack Summit 2025 | [Recording](https://www.youtube.com/watch?v=-YG9WGThlgI) |
| Agentic knowledge-augmented generation — Arun Prakash Asokan | DataHack Summit 2025 | [Recording](https://www.youtube.com/watch?v=Q1LtjqyxCFA) |

*First of nine posts on riteangle's architecture. Next:
[cross-thread agent memory without cross-user leakage](/blog/cross-thread-agent-memory-without-leakage)
— a shared memory store deliberately built with no column recording where any of
its rows came from.*
