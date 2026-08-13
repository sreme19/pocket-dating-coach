---
title: What actually changed in the data stack between 2024 and 2026, and what did not move at all
date: 2026-08-17
summary: The story everyone tells is that AI replaced the data stack. Two years of attending India's data and AI conferences says something more useful: Kafka, Spark, Airflow, dbt and Iceberg run unchanged from May 2024 to May 2026, four new floors were built on top of them, and the layer that actually got displaced was business intelligence. If you are deciding whether to rebuild your platform to do AI, the evidence says the work is above your serving layer, not below it.
tags: [agent-architecture, riteangle]
---

Over the last two years I have been to eleven of India's data and AI conferences,
most of them in Bengaluru — the
[Data Engineering Summit](https://des.analyticsindiamag.com/),
[DataHack Summit](https://www.analyticsvidhya.com/datahacksummit/),
[MLDS](https://mlds.analyticsindiamag.com/),
[CYPHER](https://cypher.analyticsindiamag.com/) and the
[AWS Summit](https://aws.amazon.com/events/summits/bengaluru/) among them.

Recently I sat down and went back through all of it at once, rather than as
eleven separate afternoons.

The thing I expected to find was a replacement story: the data stack gives way to
the AI stack. That is not what happened.

## The 2024 stack

![Five layers: ingest with Kafka and CDC, storage on S3 with Hive, Iceberg and
Delta Lake, transform with Spark, dbt and Airflow, serve through a warehouse and
feature store, consume through Tableau and SageMaker. Generative AI is a single
dashed tile at the edge.](/blog/stack-2024.svg)

This is May 2024. It is a competent, unremarkable modern data platform, and every
component of it is still in production somewhere near you.

Two details are worth pausing on.

The first is a session laying out the complete menu of generative approaches
available to an enterprise. It has four rungs: prompt engineering, retrieval-augmented
generation, fine-tuning, and training from scratch. **Agents are not on the
ladder.** The same talk argues fine-tuning is only marginally better than retrieval, and
mostly not worth it.

The second is a consultancy presenting its target-state platform, on which one
service tile reads *AI agents and no-code LLM orchestration*. One box. Nothing
else in the talk names a framework, a protocol, or a tool-calling mechanism. In
May 2024 the entire agentic layer was a rectangle with a label.

## The 2026 stack

![The four lower layers unchanged — ingest, store, transform, serve, still Kafka,
Iceberg, Spark, dbt. Four new layers above: context, protocol, agent runtime, and
evaluation and governance. Consumption is now agents as well as
humans.](/blog/stack-2026.svg)

Same conferences, two years later.

The bottom four layers did not move. Kafka, Spark, Airflow, dbt, Iceberg, Delta
Lake and S3 all appear in May 2024 and are still being presented in May 2026.
Nobody replaced them. Nobody is arguing they should be replaced.

What happened is that four floors were added on top:

- **Context** — ontologies, semantic layers, assembly, vector and graph stores
- **Protocol** — MCP, A2A, tool registries
- **Agent runtime** — orchestration, memory, identity, managed services
- **Evaluation and governance** — model-graded judging, traces, guardrails, kill switches

The one thing that visibly receded is the top of the old stack. **Tableau's last
appearance is March 2026.** It came up steadily from the first event to roughly
the midpoint, then stopped being mentioned. The business-intelligence layer is
where the displacement happened — not the pipeline.

## What the dates actually show

Because I kept a record as I went, first-appearance dates are checkable rather
than remembered. Approximate, since this is what I personally saw presented and
not a census.

| Technology | Mentions | First seen | Last seen |
| --- | --- | --- | --- |
| Apache Kafka | 29 | May 2024 | May 2026 |
| Apache Spark | 17 | May 2024 | May 2026 |
| Airflow · dbt | 10 each | May 2024 | May 2026 |
| Iceberg · Delta Lake | 11 · 9 | May 2024 | May–Jun 2026 |
| RAG | 12 | May 2024 | Aug 2026 |
| "vector database", generic | 15 | May 2024 | Aug 2026 |
| Tableau | 11 | May 2024 | **Mar 2026** |
| Data Vault | 3 | May 2024 | **May 2024** |
| **MCP** | **91** | **Aug 2025** | Aug 2026 |
| A2A · LangGraph | 20 · 24 | Aug 2025 | Aug 2026 |
| Qdrant | 6 | Aug 2025 | Aug 2026 |
| Pinecone · Weaviate | 6 · 4 | Mar 2026 | Aug 2026 |
| AgentCore | 16 | Apr 2026 | Jun 2026 |
| Kiro | 38 | Apr 2026 | Jun 2026 |

Four things fall out of that table.

**MCP is the fastest-moving thing I saw.** First appearance August 2025.
By August 2026 it is the single most-mentioned technology at 91 references, ahead
of Kafka's 29 accumulated over two years. Nothing else in two years moved like
that.

**RAG and vector databases were already there in 2024** — but generically. The
2024 decks show an unlabelled vector store. Named products arrive later: Qdrant
in August 2025, Pinecone and Weaviate not until March 2026. The category preceded
the vendors by about eighteen months.

**Kiro went from nothing to 38 mentions in four months.** Coding agents were the
fastest-adopted product category I saw.

**Data Vault appears once and never again.** The clearest example of a 2024
modelling concern that simply stopped being discussed.

## The unit of work kept moving

![Four eras. May 2024, the prompt. August to September 2025, retrieval then
tools. March to May 2026, context. August 2026, the loop.](/blog/unit-of-work.svg)

Underneath the technology churn there is a cleaner story about what engineers
were being asked to *engineer*.

**2024 — the prompt.** The unit of work is the call. You choose a rung on the
four-rung ladder and you write a good instruction.

**August 2025 — retrieval, then tools.** MCP, A2A, LangGraph and ReAct all are
first presented on the same day, at the same event. Context
engineering is already being named as a discipline: one talk that month demotes
retrieval to just one of four memory types and defines four operations over the
context window — compress, isolate, trim, filter. Four weeks later a bank
presents an Agent2Agent deep-dive.

**March–May 2026 — context.** The protocol stack gets taught as a single subject.
Three consecutive talks in one hall independently argue that context, not model
quality, is the scarce resource; two use nearly the same title. A cloud
vendor ships an agent runtime, a registry and managed evaluations as products.

**August 2026 — the loop.** There is a session titled *Loop Engineering*. Another
is called *The Memory is the Harness*, arguing memory is the only durable
advantage. A third shows the same task run across three model versions while
scaffolding is deliberately deleted, cutting cost 38% — the argument being that
what was load-bearing in March is overhead by April.

Prompt, then retrieval, then context, then the loop. Each shift moves the work
one step further from the model call and one step closer to the system around it.

## What this means if you are building

Three conclusions I would defend.

**Do not rebuild your data platform to do AI.** The evidence is that the substrate
persisted unchanged through the entire agentic wave. Every 2026 agentic
architecture I saw is sitting on Kafka, Iceberg, Spark and dbt. The
work is above the serving layer, not below it.

**The scarce resource is context, and it is your own data problem.** The recurring
argument in 2026 is that model quality has stopped being the differentiator and
context assembly has become it — which makes it a data-engineering problem wearing
new clothes. One talk put the split neatly: short-term memory belongs to whichever
framework you chose, long-term memory comes from stores you own.

**Protocols arrived before the governance for them.** MCP went from first sighting
to the most-discussed technology in twelve months. At MLDS in March 2026, a talk
reported 66% of audited MCP servers carrying security findings, and
names real incidents — a compromised package, a path traversal exposing
credentials across thousands of hosted servers, and agent cards that are
self-reported with no verification. Adoption ran well ahead of the controls, and
the controls are now arriving as products: registries, evaluations, guardrails.

## What I would not conclude

What I saw has a shape, and it is worth naming, because it limits what any of
this proves.

These are Indian conferences, mostly Bengaluru, heavily weighted to enterprise
data and platform audiences. Two of the eleven are vendor-run, and vendor events
describe the world in a way that makes their product the answer — the AWS days
account for the widest single-event technology surface I recorded, which is a
fact about their launch cadence as much as about the industry.

It is also one attendee's view. I went to the sessions that interested me, sat in
rooms I chose, and missed entire tracks. The absence of something here is weak
evidence at best.

And a conference talk is a claim, not a deployment. It tells you what
organisations were willing to say publicly, which is a leading indicator of
practice, not a measure of it.

## References

Most sessions have no published recording — these events tend to livestream whole
halls rather than publish individual talks, and two of the 2026 events published
nothing beyond a teaser. Where a recording exists it is linked.

| Source | Event | Recording |
| --- | --- | --- |
| The four-rung generative menu; agentic AI as one platform tile | Data Engineering Summit 2024, May 2024 | Not published |
| Context engineering: four memory types, four window operations | DataHack Summit 2025, Aug 2025 | Not published |
| Agent2Agent deep-dive from a retail bank | CYPHER 2025, Sept 2025 | [Day 2, Hall 3](https://www.youtube.com/watch?v=uOqflHyRxcs) |
| The agent protocol stack; MCP security findings and named incidents | MLDS 2026, Mar 2026 | Not published |
| Agent runtime, registry and managed evaluations | AWS Summit Bengaluru 2026, Apr 2026 | [Keynote](https://www.youtube.com/watch?v=CprBATdRoh0) |
| Context as the scarce resource; three consecutive talks | Data Engineering Summit 2026, May 2026 | Not published |
| *Loop Engineering*; *The Memory is the Harness*; harness decay | DataHack Summit 2026, Aug 2026 | Not published |
| Agentic knowledge-augmented generation — Arun Prakash Asokan | DataHack Summit 2025 | [Recording](https://www.youtube.com/watch?v=Q1LtjqyxCFA) |
| Full hall recordings across three days | CYPHER 2025, Sept 2025 | [Day 1, Hall 3](https://www.youtube.com/watch?v=wgB_lwGzZaQ) · [Day 3, Hall 3](https://www.youtube.com/watch?v=o9nrXPslI3Y) |

*A companion to the riteangle architecture series. The posts either side of this
one describe one system built against this backdrop —
[match decisions without a model in the loop](/blog/match-decisions-without-a-model-in-the-loop)
and
[context assembly as a first-class subsystem](/blog/context-assembly-as-a-first-class-subsystem).*
