---
title: Integer programming and ten thousand Monte Carlo rollouts in 512 MB, for an optimal XI in four seconds
date: 2026-08-30
summary: Solvers want memory and time; a free-tier serverless function gives you 512 MB and thirty seconds, and a person is watching a spinner the whole time. This is what fits: integer programming, ten thousand Monte Carlo rollouts and two graph models, answering in about four seconds, with the language model firewalled to commentary that can be switched off without losing the answer. The ceiling turned out to force better decisions than an unconstrained environment would have.
tags: [decision-systems]
---

You are about to captain a cricket side. You know the venue, the opposition and
whether you are batting first. Fifteen players are available and you must pick
eleven.

The tool takes those inputs and hands back three things: the eleven it would pick,
your probability of winning with them, and a few paragraphs explaining why. It
answers in about four seconds in a browser.

Underneath, that means integer programming, ten thousand simulated matches and two
graph models — inside a serverless function capped at **512 MB of memory and
thirty seconds**, because it is a side project that has to cost nothing when
nobody is using it.

Those two facts fight each other, and resolving that fight produced a better
system than an unconstrained one would have been. Source is public:
[ipl_ui](https://github.com/sreme19/ipl_ui).

## Six stages, one function

![Six stages inside a function limited to 512 MB and 30 seconds: load histories
and adjust for form, encode conditions, score threats as a bipartite graph, select
by integer programming, simulate ten thousand times, and only then let a model
write the explanation.](/blog/lambda-optimiser.svg)

Everything above happens in a single invocation. There is no queue, no worker, no
job to poll — because a person is sitting in front of a form waiting for an
answer, and a captain deciding a team is not going to come back in five minutes to
see how it went.

That is the constraint that shapes everything: **interactive latency, on a cold
start, under a hard memory ceiling.**

## Two problems that turned out to be textbook

Two of the six stages looked like they needed clever bespoke code, and did not.

**Working out who threatens whom is bipartite matching.** A captain's real question
is which of the opposition's bowlers are dangerous to which of your batters. That
is a weighted graph between two disjoint sets of people, and once you write it
down that way, the interesting quantities — which of your players is most exposed,
which of their bowlers constrains the most of your choices — are standard graph
queries rather than nested loops you invent on the spot.

**Working out what still has to happen for a team to qualify is max-flow.** "We
need to beat them, and then that other match has to go a particular way" reads
like a combinatorial mess and is a flow problem over a graph of remaining
fixtures. Posing it correctly deleted what would otherwise have been a long tail
of conditional logic that nobody could have verified.

Neither of these was solved by writing a better algorithm. Both were solved by
recognising a formulation that already existed. That is worth internalising,
because the instinct when a problem looks gnarly is to reach for a heuristic, and
the heuristic is usually a worse version of something with a name.

## Sixteen megabytes bundled into the deployment package

![Fetching from object storage keeps the package small and lets data change without
a redeploy but pays a network round trip on every cold start. Bundling makes the
package much larger and needs a redeploy to change data, but the data is present
the instant the function starts.](/blog/cold-start-tradeoff.svg)

The player histories live in a sixteen-megabyte analytical database file, and that
file is **shipped inside the deployment artifact** rather than fetched from object
storage when the function runs.

Every guide tells you not to do this. Keep artifacts small, fetch data at runtime,
change the data without redeploying. That advice is correct in general and wrong
here, for three specific reasons.

The first invocation after a period of inactivity is a cold start, and a cold start
that begins by opening a network connection spends its most expensive moment
waiting on somebody else's service. Under thirty seconds total, with a human
watching a spinner, that is the wrong place to spend the budget.

The data changes a handful of times per season. The cost of a redeploy — the thing
bundling supposedly makes expensive — is a few minutes, a few times a year.

And bundling deletes a whole category of failure. No credentials to expire, no
network path to be misconfigured, no storage permission for someone to tidy away
six months from now while cleaning up policies. The function either starts or it
does not; it cannot start and then discover it cannot read its own data.

The question to actually ask is not *how large is my artifact*. It is **what sits
on the critical path of a cold start, and can I take it off.**

## Where the model is allowed to speak, and where it is not

There is a language model in this system. It writes the commentary — the part that
explains, in prose, why this eleven and what the risks are.

It writes in four steps, and those four steps map one-to-one onto the four
computation stages: conditions, threats, selection, simulation. That mapping is
the entire safeguard. Every narration step describes a result that already exists
in memory before the model is invoked, so there is no step whose job is to work
anything out. The prose has nowhere to insert a recommendation, because every
recommendation was made by a solver several stages earlier.

It is also switchable. Turn the model off and you still get the eleven and the win
probability; you lose the explanation and nothing else.

That gives a clean test for any system that claims to use a model for
explanation: **remove the model and see whether you still have an answer.** If you
do, it was narrating. If you do not, it was deciding, and you should know which
one you built. I arrived at the same conclusion independently in a different
codebase and wrote it up as
[match decisions without a model in the loop](/blog/match-decisions-without-a-model-in-the-loop) —
this project got there first, without me noticing it was a principle.

## Three small things that made it fit

**Session state deletes itself.** A user's inputs and the running calibration log
live in a key-value store with a seven-day expiry set at write time. There is no
cleanup job and no retention policy, because the data has a natural lifetime and
the store enforces it. For genuinely ephemeral state, an expiry is the entire data
lifecycle.

**The expensive step is memoised.** Ten thousand rollouts for the same eleven under
the same conditions produce the same distribution, so the second request for it is
free. When a user is tweaking one input at a time — which is exactly how anyone
uses a tool like this — most requests reuse a simulation. Under a thirty-second
budget, caching the deterministic expensive step is what makes the interface feel
interactive rather than merely functional.

**Server errors open their own tickets.** Middleware catches a 5xx and files a
tracking issue automatically. I am genuinely ambivalent. On a side project with no
one watching logs it means failures get noticed at all. On anything with real
traffic it would generate a mountain of duplicates, and I would remove it before
the first busy day.

## The same product, built twice

Two repositories exist for this thing, with near-identical descriptions, pointing
at the same deployed site. One was built by hand. The other went through a
spec-driven workflow, where requirements and design are written out first and the
implementation follows.

The spec-driven one is a strict superset. It has the regression tests, the API
route tests, the analytics instrumentation and the bundled database. The
hand-built one has none of those.

One data point proves nothing about methodology, and I am not going to pretend
otherwise. But the *direction* is suggestive, and specific: writing the spec first
did not produce better core logic — the solver is the same. It produced the
unglamorous supporting work that gets skipped when you are building directly
toward a working demo. The interesting artifact is not the code. It is which
version ended up with the tests.

## Where else the ceiling helps

If you are putting any solver behind an interactive request — pricing, rostering,
routing, allocation — you will meet a version of this, and the constraint is worth
treating as a design input rather than an obstacle.

| If you are building | The expensive step | What the ceiling forces you to do |
| --- | --- | --- |
| **Delivery routing** | Optimising over a live network | Precompute the distance matrix; solve only the assignment at request time |
| **Quote and pricing tools** | Scenario simulation | Cache on the input signature — users re-ask the same scenario constantly |
| **Shift scheduling** | Constraint solving over a roster | Bundle the ruleset; fetch only what actually changed |
| **Portfolio risk** | Monte Carlo over positions | Vectorise first, then memoise on the position set |
| **Recommendations** | Candidate generation, then ranking | Generate candidates offline; rank only at request time |

Every row is the same move: find the part that does not depend on this specific
request, and do it earlier.

The three things I would carry into any of them. **Look for the named formulation
before writing a heuristic** — two of the hardest-looking problems here were
textbook graph problems in disguise. **Audit what happens during a cold start, not
how big your artifact is** — object storage is the reflex, and the reflex is wrong
when the data is small and the timeout is tight. And **make the narration
removable**, so you can always demonstrate which component is actually deciding.

## References

| Source | Event | Recording |
| --- | --- | --- |
| Intelligence in structure, not policy | [MLDS 2026](https://mlds.analyticsindiamag.com/), Mar 2026 | Not published |
| Serverless data and AI services, cold-start and cost framing | [AWS Summit Bengaluru 2026](https://aws.amazon.com/events/summits/bengaluru/), Apr 2026 | [Keynote](https://www.youtube.com/watch?v=CprBATdRoh0) |
| Spec-driven development and an AI-driven development lifecycle | [AWS Summit Bengaluru 2026](https://aws.amazon.com/events/summits/bengaluru/), Apr 2026 | Not published |
| Full hall recordings across three days | [CYPHER 2025](https://cypher.analyticsindiamag.com/), Sept 2025 | [Day 2, Hall 3](https://www.youtube.com/watch?v=uOqflHyRxcs) |

*Third in the decision-systems set, after
[three ways to not know things](/blog/three-ways-to-not-know-things).*
