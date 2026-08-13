---
title: An optimiser in 512 megabytes
date: 2026-08-30
summary: Integer programming, ten thousand simulations and two graph models inside one memory-capped serverless function with a thirty-second timeout. Plus the decision to bundle sixteen megabytes of data into the deployment package rather than fetch it.
tags: [decision-systems]
draft: true
---

Optimisation and serverless are an awkward pair. Solvers want memory and time;
functions give you a hard ceiling on both.

This one runs integer programming, ten thousand Monte Carlo simulations and two
graph models inside **512 MB with a thirty-second timeout**, and answers in a few
seconds. The constraints turned out to improve the design rather than damage it.

Source is public: [ipl_ui](https://github.com/sreme19/ipl_ui).

## What runs inside the function

![Six stages inside a function limited to 512 MB and 30 seconds: load histories
and adjust for form, encode conditions, score threats as a bipartite graph, select
by integer programming, simulate ten thousand times, and only then let a model
write the explanation.](/blog/lambda-optimiser.svg)

Two of these are graph problems, which I did not expect going in.

**Threat scoring is bipartite matching.** Which of their players is dangerous to
which of yours is naturally a weighted graph between two sets, and once it is
posed that way, the useful quantities — who is most threatened, which of their
players constrains the most of your choices — are graph queries rather than
bespoke loops.

**Qualification scenarios are max-flow.** "What has to happen for this team to
still go through" reads like a combinatorial nightmare and is a flow problem on a
DAG of remaining fixtures. Posing it correctly replaced what would have been a
large amount of conditional logic.

The general lesson: a surprising share of "we need a clever heuristic here"
problems are a standard formulation nobody recognised. Both of these were solved
by naming the problem correctly rather than by writing a better algorithm.

## The trade I would defend

![Fetching from object storage keeps the package small and lets data change without
a redeploy but pays a network round trip on every cold start. Bundling makes the
package much larger and needs a redeploy to change data, but the data is present
the instant the function starts.](/blog/cold-start-tradeoff.svg)

A sixteen-megabyte analytical database is **bundled into the deployment package**
rather than fetched from object storage at runtime.

That is the wrong default. Fetching keeps artifacts small and lets data change
without a deploy, and it is what most guides recommend.

It is right here for three reasons. Under a thirty-second timeout, a cold start
that begins with a network round trip spends its most expensive moment waiting.
The data changes a handful of times a season, so the redeploy cost is trivial. And
bundling removes an entire failure mode — no credentials, no network reachability,
no permission that can be revoked by someone tidying up policies.

The generalisable question is not "how big is the artifact" but **"what is on the
critical path of a cold start, and can I remove it?"**

## Where the model is allowed to speak

There is a language model, and it writes commentary in four steps that map
one-to-one onto the four computation stages: conditions, threats, selection,
simulation.

That structure is the safeguard. Each narration step describes a result that
already exists, so there is no step whose job is to decide anything. The prose has
nowhere to introduce a recommendation, because every recommendation was made
before it ran.

It is also optional. Turn it off and you still get the eleven and the win
probability. That is the test I would apply to any narration layer: **if removing
the language model removes the answer, it was never narration.**

Regular readers will recognise this as the same conclusion as
[match decisions without a model in the loop](/blog/match-decisions-without-a-model-in-the-loop),
reached in a different codebase before I had articulated it as a principle.

## Small things worth stealing

**Session state expires by itself.** User inputs and a calibration log live in a
key-value store with a seven-day time-to-live. No cleanup job, no retention
policy, no growth. For genuinely ephemeral state, a TTL is the entire data
lifecycle.

**Simulation results are cached.** Ten thousand rollouts for the same eleven under
the same conditions produce the same distribution, so the second request is free.
Under a thirty-second budget, memoising the expensive deterministic step is what
makes an interactive interface possible at all.

**Errors file their own tickets.** A middleware catches server errors and opens a
tracking issue automatically. I am ambivalent — it is excellent for a personal
project where nobody is watching logs, and it would produce a mountain of noise on
anything with real traffic.

## The two-build question

There are two repositories for this product with near-identical READMEs pointing
at the same deployed site. One was hand-built; the other went through a
spec-driven workflow, where the requirements and design are written out and the
implementation follows from them.

The spec-driven one is the superset. It has the regression tests, the API route
tests, the analytics instrumentation and the bundled database. The hand-built one
does not.

I would not draw a strong conclusion from a sample of one. But the direction is
suggestive: writing the spec first produced the unglamorous supporting work —
tests, instrumentation — that building directly skipped. The interesting artifact
is not the code, it is which version ended up with the things nobody enjoys
writing.

## The pattern, without the cricket

> **Constrained environments are a design tool.** A hard memory ceiling and a
> short timeout force you to ask what is genuinely needed at request time, what
> can be precomputed, what can be cached, and what can be removed from the
> critical path. Most of those answers improve a system that has no constraints at
> all.

| Setting | The expensive step | What the ceiling forces |
| --- | --- | --- |
| **Logistics** | Route optimisation over a live network | Precompute the distance matrix; solve the assignment only |
| **Pricing** | Scenario simulation | Cache by input signature; the same scenario is asked repeatedly |
| **Scheduling** | Constraint solving over a roster | Bundle the ruleset; fetch only what changed |
| **Risk scoring** | Monte Carlo over a portfolio | Vectorise, then memoise on the position set |
| **Recommendations** | Candidate generation and ranking | Precompute candidates offline; rank at request time |

Three transfers:

**Look for the standard formulation before writing the heuristic.** Two of the
harder-looking problems here were bipartite matching and max-flow. Naming the
problem correctly is worth more than optimising the wrong solution.

**Audit the cold start, not the artifact size.** Object storage is the reflex, and
the reflex is wrong when the data is small, changes rarely, and the timeout is
tight.

**Make narration removable.** If the system still answers with the language model
switched off, the model is explaining. If it does not, the model is deciding, and
you should know which one you built.

## References

| Source | Event | Recording |
| --- | --- | --- |
| Intelligence in structure, not policy | [MLDS 2026](https://mlds.analyticsindiamag.com/), Mar 2026 | Not published |
| Serverless data and AI services, cold-start and cost framing | [AWS Summit Bengaluru 2026](https://aws.amazon.com/events/summits/bengaluru/), Apr 2026 | [Keynote](https://www.youtube.com/watch?v=CprBATdRoh0) |
| Spec-driven development and an AI-driven development lifecycle | [AWS Summit Bengaluru 2026](https://aws.amazon.com/events/summits/bengaluru/), Apr 2026 | Not published |
| Full hall recordings across three days | [CYPHER 2025](https://cypher.analyticsindiamag.com/), Sept 2025 | [Day 2, Hall 3](https://www.youtube.com/watch?v=uOqflHyRxcs) |

*Third in the decision-systems set, after
[three ways to not know things](/blog/three-ways-to-not-know-things).*
