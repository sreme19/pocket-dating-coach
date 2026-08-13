---
title: Interpretable scoring without embeddings
date: 2026-08-24
summary: We have an embedding model and a vector index in the codebase, and the production ranking does not use either. Nine named dimensions instead, because the question that matters is not who is similar but what would change the answer.
tags: [agent-architecture, riteangle]
---

There is an embedding model wired up in this codebase, and a vector index sitting
behind it. Neither is used by anything that ranks people.

Ranking runs on nine named dimensions with hand-designed semantics. That is an
unfashionable choice in a year when every conference I went to had a talk about
vector databases, so it is worth setting out why.

## The question the system has to answer

Not *who is similar to whom*. The question is: **why is this person ranked here,
and what would move them?**

![Asked why one person ranks above another, an embedding can return a similarity
figure and its nearest neighbours, but the axes have no names. A dimension model
returns the contribution of each named dimension — and finance contributing almost
nothing because the claim was never evidenced.](/blog/interpretable-vs-embedding.svg)

An embedding can tell you two things are close. It cannot tell you which of the
512 axes did the work, because the axes do not mean anything individually. The
honest answer to "why did he rank above her" is that the vectors were nearer, and
there is nothing in that a person can act on.

With named dimensions the same question has a decomposable answer. Health
contributed 28. Career contributed 24. Finance contributed 4 — because he claimed
it and never evidenced it, so the confidence multiplier held it near the floor.

That second answer can be argued with. Someone can say the weighting is wrong, or
that finance should not be a dimension at all. Those are real conversations. "The
cosine similarity was 0.83" is not.

## Counterfactuals are exact, not estimated

![Because scoring is a pure function, a counterfactual is not an estimate. Change
one confidence value from unproven to proven, run the identical arithmetic, and
compare the two rankings.](/blog/counterfactual-rerun.svg)

This is the property I would not give up.

Because scoring is a pure function of three stored vectors, a what-if is just the
same function with one input changed. Take his current numbers, set the finance
confidence from unproven to proven, run the identical arithmetic, compare.

The output is not a prediction. It is the actual ranking he would have.

That makes a specific product possible: telling someone that proving one thing
moves them from fourth to second with a particular person. Not "would likely
improve your standing" — the position, computed. If the model produced that
answer, it would be a guess dressed as a fact, and I would not be willing to show
it to anyone.

## The taxonomy, and the four dimensions excluded from ranking

Nine open dimensions carry the ranking. Four more exist — faith, nationality,
ethnicity and appearance — and are structurally excluded from any global score:
their population weight is zero, so they can only ever be used pairwise, when one
specific person has said that one specific thing matters to them.

An embedding cannot do that. Attributes are entangled in the vector, and if
appearance or ethnicity is in the training signal it is in the ranking, silently
and inseparably. With named dimensions the exclusion is a value in a table and a
test that asserts it stays zero.

For a product deciding who meets whom, that is not a nice-to-have. It is the
difference between a policy you can state and a policy you can only hope for.

## Where the model still gets used

The dimension values are not hand-entered. A language model reads what someone
uploaded and wrote, and estimates each dimension. So the model does the perception
work — reading unstructured human material — and then leaves.

With one exception. Stated income does not go through the model at all. It runs
through a fixed curve normalised for cost of living by city tier, because it is
the dimension people most reliably inflate and the one we can most cheaply check.

And confidence is never model-set. It comes only from the verification record.
That split — the model may estimate the claim, never its own credibility — is
covered in
[match decisions without a model in the loop](/blog/match-decisions-without-a-model-in-the-loop).

## The argument I heard made better than I would make it

At MLDS 2026 a professor from BITS Pilani presented a structure-over-policy
argument on an agentic-AI stage, which took some nerve.

The talk was about delivery routing, and the case was quantified. Their structured
approach against multi-agent reinforcement learning: 293 minutes of training per
city for the learned method, saving 11% of distance, against 43% for theirs.
Against a classical solver: twice the vehicle distance and no bundling at all
despite capacity for ten deliveries. Against graph neural networks: a perfect
success rate, but a 47-minute average delivery time — which for food delivery
means the method works and the product fails.

The point was not that learned methods are bad. It was that a structured
formulation, where you can see and adjust the objective, beat them on the metric
that mattered while being explicable.

A talk at MLDS put the complementary idea from the data side: a data warehouse
records what happened, a context warehouse records *why an expert decided X in
situation Y*. That second thing is what a named-dimension model stores. The
weights are a written-down theory of what people say they care about, and they can
be wrong in public.

## When I would use embeddings instead

I want to be even-handed, because the choice here is genuinely task-dependent.

| Use embeddings when | Use named dimensions when |
| --- | --- |
| The relevant features are unknown or too numerous to enumerate | You can name the dimensions and defend the list |
| The query is open-ended semantic search | The output is a ranking someone will contest |
| Nobody will ask why two things matched | You must exclude specific attributes provably |
| The corpus is large and heterogeneous | Counterfactuals are a product feature |
| Approximate recall is acceptable | The decision affects a person materially |

Most retrieval problems are on the left. Ranking people is on the right, and it is
on the right for reasons that have nothing to do with model quality.

## What it costs

Two real costs, and I would rather state them than pretend the trade is free.

**No serendipity.** A model reading two full profiles might notice something
oblique that no dimension encodes. My arithmetic never will. It knows only the
dimensions I thought to define, and it inherits every blind spot in that list.

**The taxonomy is a maintenance burden and a source of bias.** Nine dimensions
chosen by one person is a theory of what matters in a partner, and it is
inevitably partial. The advantage is not that it avoids bias — it is that the bias
is written down in a table where someone can point at it, rather than distributed
across weights nobody can read.

There is also a scaling limit worth naming. This works because the taxonomy is
small and the population is one market. A dimension model does not obviously
survive contact with a domain where the relevant features vary by segment.

## The pattern, without the dating app

> **When the output is a ranking that affects people and someone will ask why,
> use a small set of named features with an explicit, inspectable combining
> function.** Reserve embeddings for retrieval, where recall matters and nobody
> demands an explanation. Keep the scoring function pure so counterfactuals are
> computed rather than estimated.

| Setting | Why interpretable wins | The counterfactual users actually want |
| --- | --- | --- |
| **Credit** | The decision is contestable and often regulated | What would move me from decline to approve |
| **Insurance pricing** | Rating factors must be stateable, and some excluded by law | Which factor is driving my premium |
| **Recruiting** | Protected characteristics must be provably out of scope | What would make me a stronger candidate here |
| **Admissions and grants** | Awards are appealable | Where did my application actually lose points |
| **Supplier selection** | Decisions are audited | What would we need to fix to win next time |
| **Clinical prioritisation** | Clinicians must be able to challenge the ordering | Which finding moved this patient up the queue |

Three things that transfer:

**Separate the claim from its evidence, and multiply them.** One number for what
is asserted and one for how well it is corroborated. It is the single change that
made our scores defensible, and it is trivially portable.

**Keep the scoring function pure.** No database, no environment, no model call. It
is what lets you re-run it with one input changed and get an exact answer instead
of a plausible one.

**Exclude sensitive attributes structurally, not by policy.** A weight pinned to
zero and a test asserting it is a guarantee. A note in a document is not.

## Where this leaves the embedding index

Still in the codebase, still working, connected to three older routes that predate
the current agents. It is not used by anything that ranks people, and I am not
going to pretend that was a grand plan — it was built for a retrieval feature that
the product moved past.

The honest position is that it is the right tool for a job we no longer do here,
and the wrong tool for the job we do.

## References

Most sessions have no published recording. Where one exists it is linked.

| Source | Event | Recording |
| --- | --- | --- |
| Intelligence in structure, not policy — a quantified structure-over-learned-policy argument | [MLDS 2026](https://mlds.analyticsindiamag.com/), Mar 2026 | Not published |
| Context warehouse versus data warehouse — storing *why* an expert decided | [MLDS 2026](https://mlds.analyticsindiamag.com/), Mar 2026 | Not published |
| Ontology-driven multi-hop reasoning over a context graph | [Data Engineering Summit 2026](https://des.analyticsindiamag.com/), May 2026 | Not published |
| Agentic knowledge-augmented generation — Arun Prakash Asokan | [DataHack Summit 2025](https://www.analyticsvidhya.com/datahacksummit-2025/) | [Recording](https://www.youtube.com/watch?v=Q1LtjqyxCFA) |
| Full hall recordings across three days | [CYPHER 2025](https://cypher.analyticsindiamag.com/), Sept 2025 | [Day 3, Hall 3](https://www.youtube.com/watch?v=o9nrXPslI3Y) |

*Ninth and last of the riteangle architecture series. Previous:
[agent replay without the side effects](/blog/agent-replay-without-the-side-effects).
The series starts at
[match decisions without a model in the loop](/blog/match-decisions-without-a-model-in-the-loop).*
