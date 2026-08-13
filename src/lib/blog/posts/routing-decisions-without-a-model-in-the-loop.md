---
title: Routing decisions without a model in the loop
date: 2026-08-16
summary: Before riteangle I ran an allocation system with revenue attached. It had the same shape — a language model at the ingestion edge, arithmetic in the middle — and in two respects it was better than what I have now. Here is the precedent, and the thing I should port back.
tags: [agentic-architecture, operations]
---

I wrote recently that riteangle
[decides who meets whom without a model in the loop](https://sree.riteangle.dating/match-decisions-without-a-model-in-the-loop):
language models at both edges, a weighted dot product and a flow solve in the
middle. I presented that as a position I had reasoned my way to, corroborated by
a pile of conference slides.

That was incomplete. I had built the same architecture before, in a different
domain, on a system where a wrong answer cost money the same week. The problem was
routing inbound enquiries to the businesses that pay for them, and the shape was
identical — a model reading unstructured material at the edge, and a closed-form
computation making the actual decision.

It is worth writing down because the older system was better than my current one
in two specific ways, and because the sequence it evolved through is a decent map
of how these things usually go wrong.

## The decision

Enquiries arrive continuously. Each one has to go to exactly one buyer. Buyers
differ in what they pay, in what they will accept, and in how much they can
absorb — daily caps, hourly caps, and a burst allowance for the times when supply
spikes.

The objective is to maximise realised revenue, which is not the same as sending
each enquiry to whoever pays most. A buyer who pays well but converts poorly
earns less per enquiry than one who pays moderately and converts well. So the
quantity that governs everything is effective revenue per lead: what a buyer
actually turned out to be worth, measured after the fact.

There was one constraint that shaped the whole design. The routing decision had to
be made *before* a regulated consent step rendered on the page, because the
consent text names the recipient. Whatever the decision procedure was, it had to
resolve inside a page load. That rules out solving anything per enquiry. It has to
be a lookup against something computed in advance.

## Three versions, each one removing state nobody could see

**Version one: cascading layers with a dice roll.** An enquiry entered layer one.
Each buyer in the layer had eligibility criteria; if the enquiry qualified for
more than one, a weighted random pick chose between them. If it qualified for
none, it fell through to layer two, and so on, with fallbacks behind that.

The weights lived in a spreadsheet, maintained by hand.

That system worked, and its real failure mode was not the randomness. It was that
its entire configuration — which buyer sat in which layer, what each cap was, what
the weights were — lived in a document with no change log. A cap change that
nobody recorded became one of three incidents that later drove a whole training
programme. The system did not break. It quietly started doing something different
from what everyone believed it was doing, and there was no way to reconstruct
when it had changed or who had changed it.

**Version two: one picker, capped buyers removed.** Instead of layers and
fallbacks, a single weighted pick across everyone currently eligible, with any
buyer at their cap dropped from the pool before the dice were rolled.

This is a small change that did a lot. Multiple layers and fallback chains
disappeared, which meant the number of paths an enquiry could take collapsed from
something nobody could enumerate to something you could reason about. Filling
buyers became orderly rather than emergent.

It was still a random draw against hand-set weights.

**Version three: a solved distribution.** Predict what each buyer is worth per
enquiry for each segment, then compute the allocation across buyers that
maximises expected revenue subject to every cap. Output is not a winner. It is a
distribution — this segment goes 60% to one buyer, 30% to another, 10% to a
third — precomputed and looked up at request time.

The dice never went away, and that is the point. They just stopped carrying the
strategy. Randomness became the mechanism for *executing* a distribution rather
than the mechanism for *choosing* one.

## The model at the edge, and what it was asked

Everything above depends on knowing which enquiries actually reached a human,
because a call nobody answered tells you nothing about how a segment performs. It
is noise that drags every average toward the mean.

That question — did a person pick up, and when — was answered by a language model
reading call transcripts. Its target was 90–95% accuracy, and the reason the bar
was that high is that this number sits upstream of everything. Every performance
figure downstream is computed over the set of calls this classifier says were
answered. An error here does not produce a wrong answer in one place. It quietly
rescales the entire ranking.

That is the same job the extraction step does in riteangle: read unstructured
human material, emit a structured estimate, run once and cache it. Not in the
decision path. Feeding it.

## Confidence came from realised revenue, never from a model

This is the constraint the two systems share, and it is the load-bearing one.

In riteangle, a language model proposes what someone claims to be, and a separate
confidence vector — derived only from verified proofs, never from the model —
governs how much that claim contributes. A claim with no evidence behind it is
scored at a third of the weight of the same claim with evidence.

The allocation system had the same separation, arrived at for the same reason. A
buyer's worth was never a model's opinion. It was realised revenue over a trailing
window of answered calls. The model could tell you whether a call was answered. It
had no vote on what the answer was worth.

| | riteangle | allocation |
| --- | --- | --- |
| Model at ingestion | Reads profiles, documents, transcripts → attribute and preference vectors | Reads call transcripts → was this answered, and when |
| Runs | Once per user, cached | Once per call |
| The quantity it may not touch | Confidence, from verified proofs only | Revenue per enquiry, from realised outcomes only |
| The decision itself | Weighted dot product, then a min-cost max-flow solve | Predicted value per segment, then an allocation solve |
| Caps | Per-side inbox capacities | Per-buyer daily, hourly, and burst |
| Output | An assignment | A distribution, precomputed |

The trailing window was 7 to 21 days, and I want to be honest that this was a
tuning knob nobody ever properly defended. Short enough to track a buyer whose
performance is moving, long enough that a bad Tuesday does not reprice them. We
picked a range and argued about it periodically. I have no evidence it was
optimal and no experiment that would have told us.

## The thing the older system had that riteangle does not

A pure exploit policy goes blind.

If you route only to the buyers your data says are best, you stop collecting data
on everyone else. Their numbers freeze at whatever they were when you stopped
sending. A buyer who fixed their staffing, raised their answer rate, and became
your best option is invisible, because the evidence that would reveal it is
exactly the traffic you withheld.

So the allocation always reserved 5–10% for buyers the model rated poorly. Not
generosity. The cost of keeping the measurement alive.

riteangle has no equivalent, and writing this out has made that harder to ignore.
The matching solve ranks candidates on a score assembled from claims and
verification, and someone the score rates poorly gets fewer matches, which
generates less interaction, which produces no evidence that the score was wrong.
A ranking system with no exploration term cannot discover its own errors. Mine
does not have one.

The honest version of that comparison is that the allocation system was under
commercial pressure to notice a mispriced buyer, and riteangle is under no
equivalent pressure to notice a mispriced person. Which is a statement about
incentives, not architecture.

## The other thing it had: the decision was cheap enough to be uniform

Because the allocation was precomputed and looked up, every enquiry went through
the same procedure. There was no fast path and no slow path.

riteangle does have two paths. The nightly solve is the architecture I describe;
the on-demand "find matches now" button runs a language model over candidates and
commits what it likes. I flagged that in the earlier post as the weakest component
in the system, and the reason it exists is latency — a member who joins in the
morning should not face an empty inbox until the small hours.

The allocation system faced a harder version of the same constraint and solved it
the other way: it had to answer inside a page load, so it precomputed. A tighter
deadline produced a cleaner design, because it foreclosed the option of doing
something expensive and clever at request time.

## Where it violated its own architecture

I would rather state this than imply the older system was clean.

The optimisation ran for one class of buyer only — those paying per acquisition,
where conversion quality determines value and the arithmetic pays for itself.
Buyers paying a flat rate per enquiry stayed on standard allocation, which is to
say on version two: weighted picker, hand-set weights. So at any given moment part
of the traffic was governed by a solved distribution and part by a spreadsheet,
and the coexistence was permanent rather than transitional.

Two more, briefly. Concurrency limits were enforced for smaller buyers and ignored
for the large ones, on the reasoning that a buyer with a hundred-plus agents
cannot be saturated — plausible, never tested. And a planned stage that would have
predicted, at form submission, whether an enquiry would become a call at all was
specified and never built, which means the system optimised the allocation of
supply it could not forecast.

## What I actually think the pattern is

I have been describing "let the model reason, don't let it enforce" as an
architectural conviction. It is more accurate to say it is what survives contact
with a system where being wrong is expensive and visible within a week.

Both designs put a language model exactly where unstructured input has to become
structured, and nowhere else. Both derive the number that governs the outcome from
evidence rather than from inference. Both are auditable because the decision is a
function you can re-run with one input changed.

The difference is that one of them was disciplined by revenue, and the other is
disciplined only by me writing posts like this one and noticing what is missing.
On the evidence of the exploration term, revenue is the better disciplinarian.

*A companion to the riteangle architecture series rather than part of it. The
series proper continues with
[context assembly as a first-class subsystem](/blog/context-assembly-as-a-first-class-subsystem).*
