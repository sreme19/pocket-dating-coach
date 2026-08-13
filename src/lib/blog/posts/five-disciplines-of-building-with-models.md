---
title: Data, prompt, context, loop and harness engineering: the tooling, cost and failure mode of each layer
date: 2026-08-18
summary: Most failed agent projects are a data problem with an orchestration budget: a team buys a framework, builds an elaborate loop, and discovers the underlying data was six hours stale and nobody owned the definitions. These five disciplines arrived in sequence, each because the previous ran out of road, and each has a different unit of work, cost profile and characteristic failure. The last one is the only one whose purpose is to make the system smaller.
tags: [agent-architecture, riteangle]
---

There is a stack of disciplines here that nobody set out to design. Each arrived
because the previous one ran out of road. Across two years of India's data and AI
conferences the sequence is unmistakable — and so is the fact that most teams try
to start halfway up it.

## The five layers

![Five stacked layers. Data engineering engineers the table. Prompt engineering
engineers the instruction. Context engineering engineers what enters the window.
Loop engineering engineers the iteration. Harness engineering engineers the
scaffolding across model versions. Each assumes the one
beneath.](/blog/five-disciplines.svg)

The useful test for each layer is what breaks if you skip it.

Skip **data engineering** and there is nothing true for the model to reason over.
Skip **prompt engineering** and it does the wrong task, competently. Skip
**context engineering** and it is fluent and uninformed. Skip **loop
engineering** and it gets exactly one attempt at a problem that needs six. Skip
**harness engineering** and you keep paying, forever, for workarounds the current
model stopped needing months ago.

Most failed agent projects I heard described on stage were a layer-one problem
with a layer-four budget.

## What each one actually is

### 1. Data engineering — the unit of work is the table

Unchanged in purpose since before any of this. Ingest, store, transform, serve;
make it current, governed and queryable.

What changed is who consumes it. In 2024 the consumer was a dashboard. In 2026 an
agent queries the same warehouse, and it is much less forgiving than a human
analyst — it cannot tell that a column is stale, and it will state whatever it
finds with total confidence.

**Tools:** Kafka or Kinesis for ingest; S3 with Iceberg or Delta Lake for
storage; Spark, dbt and Airflow for transformation; Snowflake, Databricks,
BigQuery, Redshift or ClickHouse for serving; Trino for federation; Unity Catalog
or Lake Formation for governance.

**Cost:** the largest fixed cost of the five, and almost entirely infrastructure
rather than tokens.
**Speed to build:** months.
**Complexity:** high, but well understood, with thirty years of practice behind it.

### 2. Prompt engineering — the unit of work is the instruction

State the task, the shape of the output, and the constraints.

It is genuinely undervalued now that it is unfashionable. Most "the model can't do
this" conclusions I have watched people reach were a prompt that never specified
the output shape.

**Tools:** the model API and a place to keep prompts under version control. That
is the whole list. Structured output or tool-calling schemas if the provider
offers them. A playground for iteration.

**Cost:** one model call per task. The floor.
**Speed to build:** hours.
**Complexity:** low — which is exactly why it is worth exhausting before climbing
higher.
**Ceiling:** low. It cannot fix missing knowledge, and it cannot survive a task
that needs several steps.

### 3. Context engineering — the unit of work is what enters the window

Retrieve the right material, rank it, assemble it, trim it to fit, and ground the
volatile parts in a real query rather than the model's recollection.

A talk in August 2025 framed this better than I have seen since: retrieval is only
one of four memory types, and there are four operations you perform on the
window — compress, isolate, trim, filter. That is a checklist you can hold a
system against.

**Tools:** an embedding model; a vector store (pgvector if you already run
Postgres, otherwise Qdrant, Pinecone, Weaviate or Milvus); a graph store such as
Neo4j or Neptune when relationships matter more than similarity; hybrid retrieval
with BM25 and reciprocal rank fusion; a reranker; a semantic or ontology layer;
MCP where the context lives behind someone else's API.

**Cost:** still one model call, plus retrieval — which is cheap and is not a model
call. The token bill rises because the prompt gets longer.
**Speed to build:** weeks.
**Complexity:** moderate, and mostly a data problem wearing new clothes. The hard
part is relevance, not plumbing.

### 4. Loop engineering — the unit of work is the iteration

Plan, act, observe, decide whether to go again, escalate to a human, and know when
to stop. This is where cost stops being linear.

**Tools:** an orchestration framework (LangGraph, CrewAI, AutoGen, Strands
Agents, or hand-rolled state machines — plenty of shipped systems are the last
one); tool registries; A2A where agents must talk to other agents; durable
execution such as Temporal when a loop outlives a request; explicit
human-in-the-loop interrupts; retry, fallback and abort policies; a managed
runtime like Bedrock AgentCore if you would rather not build memory, identity and
session isolation yourself.

**Cost:** the step change. A worked example presented at the AWS summit — a single
insurance quote — took six loop iterations and four tool calls, with state
accumulating on every turn. Six to twelve model calls per task is normal, and each
one carries a fatter prompt than the last.
**Speed to build:** weeks to months.
**Complexity:** high, and qualitatively different. You now have a distributed
system with non-deterministic components, and the failure modes are partial
completion, silent looping and cost explosion rather than a clean error.

### 5. Harness engineering — the unit of work is the scaffolding itself

The newest of the five, and the only one whose purpose is to make the system
smaller.

You have built retries, reflection passes, validators, decomposition steps and
prompt gymnastics, each solving a real weakness of the model you had at the time.
Then the model improves and some of that scaffolding becomes pure overhead —
still running, still costing money, still adding latency, no longer earning it.

Harness engineering is measuring which parts still pay, and deleting the rest.

**Tools:** an eval harness with a golden set; LLM-as-judge scoring; trajectory
capture and replay; tracing through OpenTelemetry, Langfuse, Arize Phoenix or
LangSmith; cost and token telemetry per decision; CI gates that block a release on
an eval regression; guardrails and kill switches; a registry so you know what is
deployed.

**Cost:** the only layer that *reduces* the bill. Its own cost is evaluation runs
and the engineering time to measure honestly.
**Speed to build:** ongoing. It is a practice, not a project.
**Complexity:** moderate technically, hard organisationally — it requires deleting
code that currently works.

## What it costs to run

![Four bars showing model calls per task. Prompt is one call. Context is one call
plus retrieval. Loop is six to twelve calls. Harness runs the same loop with
scaffolding removed, measured at thirty-eight percent
cheaper.](/blog/cost-curve.svg)

Cost climbs with every layer you add, until the last one.

The harness figure comes from a session at DataHack Summit 2026: the same task run
across three successive model versions while scaffolding was deliberately
removed. Cost fell from roughly $200 to $124 and wall-clock from six hours to
3.8 — a 38% reduction, achieved by deleting things. The framing was that what was
load-bearing in March had become overhead by April.

## Side by side

| | Data | Prompt | Context | Loop | Harness |
| --- | --- | --- | --- | --- | --- |
| **Unit of work** | The table | The instruction | The window | The iteration | The scaffolding |
| **Model calls / task** | none | 1 | 1 | 6–12 | 6–12, shrinking |
| **Dominant cost** | Infrastructure | Negligible | Longer prompts | Call count | Eval runs |
| **Time to build** | Months | Hours | Weeks | Weeks–months | Continuous |
| **Complexity** | High, familiar | Low | Moderate | High | Moderate |
| **Main failure** | Stale or wrong data | Wrong task done well | Fluent and uninformed | Silent loops, cost blowout | Paying for dead scaffolding |
| **Skip it when** | Never | Never | The model already knows | One step suffices | You are pre-production |

## Where the money actually goes

Three things worth internalising before you budget.

**The jump from context to loop is the expensive one.** Going from one call to six
is not a 6× cost increase — it is worse, because each iteration carries an
accumulated state and a longer prompt. Latency compounds the same way. This is the
step where a demo that felt free becomes a product with a unit-economics problem.

**Cheap models are underused as guards.** Several teams presented the same
structure: a small model handles classification, routing or validation, and a
frontier model is called only when needed. One pharma-regulatory architecture
routed on confidence, escalating to a frontier model only when the in-house small
model was unsure. Judging is classification; it does not need the capability you
are paying for in generation.

**Determinism is a cost lever, not just a correctness one.** One team presented an
agent system over petabyte-scale telemetry where the model produces a plan and a
sandboxed deterministic layer executes it — described as running at zero token burn, with a small model only for final synthesis. Every step you can
move out of the model is a step that stops costing per-token and starts being
testable.

## The order matters

The sequence is not a maturity ladder you graduate along, leaving the previous
rung behind. It is a stack, and every layer keeps running.

The mistake I saw described repeatedly on stage is starting at layer four. A team
buys an agent framework, builds an elaborate loop, and discovers the problem was
that the underlying data was six hours stale and nobody owned the semantic
definitions. No amount of orchestration fixes that. The recurring 2026 line — that
context, not model quality, is now the differentiator — is really a statement that
layers one and three are where the work is, and layer four gets the attention.

The opposite mistake is rarer but real: building a harness for a loop you have not
yet proved you need. If one well-constructed call answers the question, the
correct number of agents is zero.

## References

Most sessions have no published recording. These events tend to livestream whole
halls rather than publish individual talks. Where a recording exists it is linked.

| Source | Event | Recording |
| --- | --- | --- |
| Context engineering: four memory types, four window operations | DataHack Summit 2025, Aug 2025 | Not published |
| Worked ReAct example: six iterations, four tool calls for one quote | AWS Summit Bengaluru 2026, Apr 2026 | Not published |
| Agent runtime, registry and managed evaluations | AWS Summit Bengaluru 2026, Apr 2026 | [Keynote](https://www.youtube.com/watch?v=CprBATdRoh0) |
| Confidence-threshold routing between small and frontier models | AWS Summit Bengaluru 2026, Apr 2026 | Not published |
| Deterministic execution layer at zero token burn | DataHack Summit 2026, Aug 2026 | Not published |
| Harness decay and the subtraction principle, −38% measured | DataHack Summit 2026, Aug 2026 | Not published |
| *Loop Engineering* | DataHack Summit 2026, Aug 2026 | Not published |
| Building real agentic systems — Alessandro Romano | DataHack Summit 2025 | [Recording](https://www.youtube.com/watch?v=-YG9WGThlgI) |
| Agentic knowledge-augmented generation — Arun Prakash Asokan | DataHack Summit 2025 | [Recording](https://www.youtube.com/watch?v=Q1LtjqyxCFA) |
| Full hall recordings across three days | CYPHER 2025, Sept 2025 | [Day 2, Hall 3](https://www.youtube.com/watch?v=uOqflHyRxcs) · [Day 3, Hall 3](https://www.youtube.com/watch?v=o9nrXPslI3Y) |

*Companion to [From pipelines to loops](/blog/from-pipelines-to-loops), which
covers when each of these shifts actually happened, and roughly when.*
