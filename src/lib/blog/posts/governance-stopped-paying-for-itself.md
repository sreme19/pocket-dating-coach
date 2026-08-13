---
title: Governance was the first thing to stop paying for itself
date: 2026-08-16
summary: I was asked to hit a cost target across three functions. The plan I came back with removed my own seat, on the grounds that it was buying governance at the price of three times the execution capacity. Here is the arithmetic and the argument, including the part I never got to verify.
tags: [operations, agentic-architecture]
---

I once held a role that kept changing shape. It started as analysis, became
governance, and ended as strategy. The last thing I did in it was write a cost
plan that removed the seat.

The ask was ordinary: aggressive monthly cost targets across three functions I
was responsible for, with the usual instruction to preserve capability. What I
came back with proposed layoffs, salary reductions, and the elimination of my own
role, in that order of size. The reasoning was not noble. It was that once I
costed the seat honestly against what it produced, it was the most expensive
thing on the list relative to what removing it would free.

I want to write down the arithmetic, because I have since read a great deal about
AI changing the shape of senior work and almost all of it is written about
somebody else's job.

## The number that decided it

The team's capacity, before and after removing me:

| | Development hours per month |
| --- | --- |
| With me in the structure | 300–400 |
| Without me | 1,000+ |

Removing the seat freed a little under half the data function's entire target
cost. That was never the interesting figure. The interesting figure is that the
same change tripled the hours the team could put into building things.

Those two numbers look like they belong to different problems, and the gap
between them is the whole post. A governance layer does not consume its cost in
salary. It consumes it in everyone else's throughput — in review queues, in
context that has to be re-established before work can proceed, in decisions that
wait on one calendar.

I have written before about the [leadership bandwidth
tax](https://sree.riteangle.dating/designing-global-talent-systems) in
distributed teams: the observation that a single senior person often ends up
spending more than half their time translating intent and reviewing work product
rather than improving the system, and that the original cost model never priced
their calendar as scarce. That post described the pattern in the third person. I
had been the calendar for years and had not run the number on myself.

## Hours are a bad metric, and it was still the right one

Development hours are a poor measure of output. They are partly tracked and
partly asserted, they treat an hour of routine dashboard work as equal to an hour
of hard modelling, and a team can absolutely produce a thousand mediocre hours.
I would reject this number in most arguments.

It survived here for one reason: the ratio was not marginal. A 15% capacity
difference measured in hours tells you nothing. A 3× difference is too large to
be an artefact of how the hours were counted. When an instrument is crude and the
signal is enormous, the crudeness stops mattering — which is the opposite of the
situation I usually find myself in, where the signal is small and the instrument
is the entire problem.

## What the AI shift actually changed

The capacity argument alone would have justified reorganising the layer. It did
not, on its own, justify removing it. What did was a thesis about which kind of
work had become cheap.

Here is the thought experiment I kept coming back to. Delete every pipeline,
every ETL job, and every dashboard the team had built over several years. Keep
only the raw data. With the tools available now, most of that estate could be
rebuilt in a fraction of the original time.

That is not a claim about dashboards being easy. It is a claim about where the
difficulty used to live. The expensive part was never the SQL. It was the human
problem-structuring in front of it: deciding what the question was, decomposing
it into stages, specifying the shape of the answer. That structuring work is what
a governance layer exists to do well, and it is precisely the work that got
cheap.

The loop we ended up running looked like this:

```text
business requirement  →  model generates the implementation plan
                      →  human validates and executes
```

The human role moved from building systems to guiding and validating them. That
is a real and useful role. It is also a much smaller one, and it does not need a
director.

## Only one kind of AI use threatens the seat

It is worth separating two things that get discussed as though they were the
same, because only one of them has this effect.

**Exploratory use** is what most organisations were already doing: research,
campaign ideas, drafting, summarising. It makes existing people faster. It
threatens no structure, which is exactly why it gets adopted without argument.

**Decision use** is different. Given ten thousand items, what is the next action
on each, when, and in what form? That is an optimisation problem wearing a
generative interface, and it is the thing I wanted to go and work on. But it
requires sustained experimentation, and a company consolidating for efficiency is
the wrong place to run it — not because anyone lacks imagination, but because
those two activities compete for the same scarce attention and the consolidation
has to win.

So the seat became hard to justify from both directions at once. The work that
had made it valuable was being automated, and the work that would have made it
valuable again could not be done there.

## The plan, and the two-thirds of it that missed

Three functions, each with its own monthly cost target. What I proposed, against
that target:

| Function | Proposed vs target |
| --- | --- |
| Data / Analytics | +14% |
| Voice AI / Product Ops | +15% |
| People / HR | −22% |

I missed on two of three and covered it with a large underrun on the third. The
net landed about 4% over, which is the sentence that made the plan presentable,
and it is worth being clear that "close to target in aggregate" is doing some work
there. Two functions were over. The reason they were over is that
I chose continuity over the number in both — retaining people with upside at
reduced compensation rather than exiting them, and staging cuts rather than
taking them at once, because a team that watches four people leave in a week
stops doing its job for a month.

Those are defensible choices and they are still misses. I would rather show the
table than describe the plan as having hit its target.

## What I never measured

The honest limit of everything above: I proposed a capacity change, argued for it
with a 3× figure, and then left before anyone could check whether the capacity
materialised.

| Question | Status |
| --- | --- |
| Did monthly output actually rise after the change? | **Unmeasured.** I was gone. |
| Did the 1,000+ hours become work anyone valued? | **Unmeasured.** Hours were the proxy; nothing tracked outcomes against them. |
| Did decision latency improve or worsen without a central reviewer? | **Unmeasured.** No baseline was captured before the change. |
| Did quality drift once review was distributed? | **Unmeasured.** The failure mode would surface at 60–90 days, and I stopped looking. |

Every one of those was answerable from data the company already had. Their
absence is a choice about priorities, and the priority was making the decision
rather than proving it afterwards. I have some sympathy for that under a cost
deadline and I would not describe it as rigour.

There is a specific way this could be wrong that I want to name rather than have
someone find. Removing a governance layer does not delete governance. It
redistributes it — in this case onto two senior people who were already the
deepest technical coverage on the team and were already the answer to "who else
could do this if they left". The plan reduced cost and increased fragility at the
same time, and I documented the fragility as a risk with mitigations, which is
not the same as fixing it. A handover that names its single points of failure is
more honest than one that doesn't. It is not more robust.

## What I asked for instead

I proposed a two-month ramp-down, then three to four months of advisory support
at roughly thirty hours a month, at no cost. When it became clear that an
unpriced arrangement is awkward to put in a plan, I suggested a dollar an hour —
thirty dollars a month, explicitly symbolic.

The principle behind that, written down at the time: getting paid considerably
more later, assuming I am competent, is worth more than getting paid anything
now at the cost of the thing I actually want to work on. Lifestyle pressure is
transient. I am aware this is an easier position to hold with savings than
without, and that it reads as a luxury belief in a way I can't fully argue my way
out of.

What I would not do is stay in a seat I had just finished arguing was too
expensive. If the analysis is right, it is right about me.

## The part worth keeping

I have written a lot on this blog about measurements that lie by producing a
confident number instead of an error. This is the inverse problem: a number that
was almost certainly true and that I had spent years not computing, because the
subject of the measurement was me.

The test I would offer is small and slightly uncomfortable. Take the capacity
argument you would accept without hesitation about anyone else in your
organisation — that a role consuming this much of everyone's throughput has to
produce something commensurate — and run it on your own seat. Most of the time it
will pass. The point is that you should know, and that not having run it is a
choice you are making rather than a gap in the data.

Mine didn't pass. That was the most useful thing I found out that year.
