---
title: pgvector and Neo4j sitting on top of Postgres, and the multi-hop question neither alone can answer
date: 2026-08-16
summary: A founder building AI hardware asked me about a proprietary small language model, then I sent a follow-up note about vector and graph retrieval as the cheaper alternative — and the note undersold what was actually being decided. Each layer buys immunity from a different failure, not a discount on the same one. I grounded the claim in three systems I've actually run: a dating app's relational core in production, a graph demo that models that same app's match-and-handoff chain in Neo4j, and a governed lakehouse fusing pgvector with a lineage graph. Stacked in the right order, the three answer a question — why did a specific connection go quiet — that no single layer can answer alone, and the order you add them in is not interchangeable.
tags: [data-platform, agent-architecture, context-engineering]
cover: /og/blog/pgvector-and-neo4j-on-postgres.png
---

*A note on what follows: the exchange that opens this post is a real one, with the
company's name, the founder's name, and every identifying detail removed at their
request-equivalent — I have not published anything about their product beyond
what is already public, and the technical recommendation is generalised past
their specific system. Flagged before publishing, per my usual rule for anything
that touches someone else's work.*

A founder building AI-hardware for children — a voice companion, cloud pipeline,
a parent-facing app, already past prototype — messaged me asking about one
thing: standing up a proprietary small language model, self-hosted, with unit
economics that survive scale. A fair question for a team heads-down on shipping
a pilot. I answered it, then the next morning sent a follow-up I'd forgotten the
night before: before you build an SLM, try retrieval-augmented generation over
a vector database, optionally combined with a graph database — cheaper to
build, and it buys you the same win, more contextual generation per user at a
lower token cost.

Everything in that follow-up is true and none of it says which problem each
piece actually solves. "Combine with a graph database" reads as an upgrade
tier — do the vector thing, then, budget allowing, do the fancier thing too.
That is backwards. A vector index and a graph are not two strengths of the
same tool. They answer categorically different questions, and the relational
store underneath both of them is not legacy plumbing you retrieve *from* — it
is the one place the two other layers go to find out whether an answer is
still true.

## Three systems, not one write-up

I did not want to make this argument in the abstract, so here it is against
systems I have actually built and run rather than a synthetic comparison
built to prove a point.

**The relational layer** is [pocket-dating-coach](https://github.com/sreme19/pocket-dating-coach)
in production on Supabase Postgres — the ledger of record for every user, match,
message, and trust adjustment a real dating app generates. The same database
already runs a second job alongside that ledger: a `pgvector`-backed knowledge
base of relationship-coaching material, retrieved to ground the app's AI
coach's replies in an actual source rather than the model's unaided memory.
One database, two jobs, and the second job is the vector layer below.

**The graph layer** is [matchgraph-rag](https://github.com/sreme19/matchgraph-rag),
a project built to answer one specific question a vector index cannot: can a
similarity search tell you *why* two particular people's connection stalled?
It's a synthetic network with the same shape as the real one above — matches
that open a timed handoff window, most handoffs expiring unanswered, an
expired handoff handing the woman a replacement suitor and a new clock — built
in Neo4j specifically so that chain is a graph traversal instead of a table
scan.

**The layer above both** is [agent-ready-data](https://github.com/sreme19/agent-ready-data),
covered in an [earlier post](/blog/event-time-partitioning-in-iceberg), where a
lineage graph and a `pgvector` index are fused by reciprocal rank fusion so
that neither retrieval method has to cover the other's blind spot alone.

## What a relational store answers, and where it stops

Start with the ledger, because it is the layer every one of these systems
still has underneath it, including the two below that get the attention.

![Relational architecture: an application writes rows into normalized tables — people, matches, handoffs, trust events — related by foreign keys, with a query planner joining across them to answer one specific question at a time.](/blog/relational-ledger.svg)

Postgres answers "what is true right now, and what was true at a specific
past moment" with total precision, because every row is a fact with a
timestamp and a foreign key back to the fact it depends on. Ask it "how many
handoffs expired last week" or "what is this person's current trust score"
and it answers exactly, in milliseconds, with a query plan you can read.
That precision is also its ceiling: a relational query answers one join path
you wrote in advance. Ask a question whose shape you didn't anticipate — not
"what is the count" but "walk backwards through everything that led to this
state" — and you are writing a recursive query by hand for every new question
shape, or you are not asking that question at all. Most teams choose the
second, silently, by never noticing the query they'd have needed to write.

## What a vector index buys, on the same data

The knowledge base pocket-dating-coach already runs is the plainest version
of the next layer: relationship-advice material, embedded once, retrieved by
similarity at generation time so the coaching model's replies are grounded in
actual text instead of whatever it recalls unaided.

![Vector retrieval architecture: documents are embedded offline into a vector index (HNSW), a user query is embedded at request time, and approximate nearest-neighbor search returns the closest passages by cosine distance for the model to read before replying.](/blog/vector-retrieval.svg)

The mechanism is `pgvector`'s HNSW index — a layered graph of vectors, navigated
top-down at query time to reach an approximate nearest-neighbour set without
scanning every embedding in the table. What it buys is retrieval that survives
paraphrase: a user's question and a document's phrasing never need to share a
keyword, only proximity in embedding space, which is exactly the win a
relational query cannot offer without an index built for a question you
already knew to ask. What it does not buy is any notion of *why* one document
relates to another. Two bios can sit a hair's distance apart in embedding
space and correspond to two people with no relationship at all, and two people
whose connection is the entire subject of a question can sit far apart in that
same space if their bios happen not to read alike. Similarity is not
relationship, and a vector index has no way to know the difference — it can
only ever tell you what reads alike.

matchgraph-rag makes that gap concrete rather than asserted. Ask its vector
baseline — bios embedded, indexed, nothing else — why one specific woman's
handoff with one specific man went quiet, and it returns the nearest bios by
cosine distance:

```
--- Vector RAG (cosine similarity over bios, no relationship data) ---
  M0219  (distance=0.412)  Product manager. Into cricket and startups...
  W0044  (distance=0.431)  Data analyst. Into hiking and reading sci-fi...
  M0087  (distance=0.447)  ...
```

None of those three people are the man in the question. Nothing errored, no
score dropped toward zero to signal doubt — the index did exactly its job,
which was finding text that reads similarly, and the question asked for
something else entirely.

## What a graph adds, on the same question

matchgraph-rag's answer to the same question, walked as a graph rather than
searched as an index, is a traversal along an exact, named path: person, to
match, to handoff, to trust event, to the replacement match that followed.

![Graph traversal architecture: a property graph of people, matches, handoffs, trust events and replacement matches in Neo4j, queried by a multi-hop Cypher pattern that follows a specific chain of edges rather than searching for similar text.](/blog/graph-traversal.svg)

```
--- GraphRAG (exact traversal: W0007 -> match -> handoff -> trust -> replacement) ---
match MT001042: handoff status = expired, deadline = 2026-03-14T09:00:00
  trust event: 2026-03-14T09:00:00  delta=-3  (handoff_expired_no_response)
  this match expired and the woman was handed a replacement suitor via a new match
```

Same underlying model narrates both outputs above — the only thing that
changed is what facts it was handed. That is the entire argument for a graph
layer: it is not a smarter search, it is a different question answered by
walking edges someone had to model on purpose, rather than a text index built
to find things that merely resemble each other. The traversal is deterministic
and cheap — a graph query, not a model call — with the model doing narration
only, the same split every one of these three systems keeps: compute the fact
first, let a model describe it second, never the reverse.

## The layering, on one question a single layer can't answer

Here is the same question run through each layer alone, then through all
three stacked, to show what each addition actually buys rather than merely
claiming it.

![Three layers stacked over the same data: relational Postgres at the base holding the ledger of matches and trust events, pgvector in the middle retrieving grounding text by similarity, Neo4j on top walking the multi-hop chain — a single question passes up through all three before reaching the model.](/blog/layered-stack.svg)

*Relational alone*, given "why did this handoff go quiet," returns the row: a
status column reading `expired`, a deadline that passed, nothing else. True,
and useless as an explanation — a person asking "why" wants the causal
sequence a single row cannot express, no matter how many columns it has.

*Relational plus vector*, the pocket-dating-coach shape today, adds retrieval
over coaching material — good for "what should this person do next," because
that is a similarity question against a corpus of general advice. It still
cannot answer "why," because the *why* is not in any document's phrasing; it
is in the specific sequence of rows that happened to this specific pair, and
no embedding of that sequence exists to be close to anything.

*All three together* is what matchgraph-rag demonstrates: the relational
layer still holds every fact, the graph walks the exact five-hop path those
facts form for this one pair, and if a generation step is grounding a coach's
reply in general advice at the same time, the vector layer still does that
job in parallel — the three are not competing for the same query, they are
answering three different ones inside the same turn. Layering does not mean
richer answers to the same question; it means the system can now be asked
three distinct kinds of question and have an honest answer to all three,
instead of a confident answer to only one.

## What I'd tell the founder now

The corrected version of that follow-up message: a vector database earns its
keep the moment you have a corpus of text you want a model to ground replies
in rather than recall unaided — build that first, because most early products
need exactly that and nothing more. Add a graph only once a real user
question has the shape "why did this specific sequence of events happen to
this specific pair," because that is the one shape a similarity search cannot
approximate no matter how it's tuned, and a graph you build before that
question exists is a maintenance cost with no query yet to justify it. And
underneath either, keep the relational ledger as the layer both retrieval
methods answer *to* — a vector index or a graph that can drift out of sync
with the ledger of record is a second source of truth nobody asked for,
so both should be built as derived views refreshed from the ledger, never
as the ledger itself.

None of the three replaces a fine-tuned or self-hosted small model outright
— they answer a narrower question than "generate cheaply at scale" implies.
What they replace is the assumption that better generation requires a bigger
or more specialised model at all, when the actual gap, in every system above,
turned out to be what the model was handed before it wrote a single word.

## The pattern, without the dating app or the toy

| Domain | The relational fact | The vector question | The graph question |
| --- | --- | --- | --- |
| Customer support | Ticket status, SLA timer | "Find past tickets like this one" | "Why did this account escalate three times" |
| Insurance claims | Claim status, adjuster notes | "Find similar prior claims" | "Trace this claim's chain of reassignments and reopenings" |
| Supply chain | Shipment status, PO reference | "Find comparable delayed shipments" | "Trace which upstream delay caused this stockout" |
| Clinical records | Encounter row, diagnosis code | "Find similar case notes" | "Trace this patient's referral and readmission chain" |
| Fraud investigation | Transaction row, dispute status | "Find similarly worded disputes" | "Trace the account, device and payment-method links between two disputes" |
| Children's voice companion | Session log, safety-flag row | "Find similar past conversations for tone" | "Trace which prior session and parental setting produced this flagged reply" |

Three choices generalise past any one of these.

**Add a vector index the moment retrieval quality is the bottleneck, not
before.** It is the cheapest of the three layers to build and the one most
products need first — resist reaching for a graph as the next obvious upgrade
just because it sounds more sophisticated.

**Add a graph only once a real "why" question has a name.** Model the edges
that question actually walks — match, handoff, trust event, replacement — not
a generic entity graph speculatively covering everything, which costs real
modelling effort and answers nothing until a specific chain query exists to
run against it.

**Never let either retrieval layer become a second ledger.** Both should read
from the relational store, not fork from it — a vector index or a graph that
drifts from the row that's actually true is a worse failure mode than having
neither, because it now answers confidently and wrong instead of not
answering at all.

## The reference architecture

In build order: Postgres (Supabase or self-hosted) as the relational ledger of
record, every fact a row with a timestamp and a foreign key; `pgvector` as an
extension on that same database for anything needing similarity retrieval,
indexed with HNSW, refreshed as a derived view rather than a second source of
truth; Neo4j (Community Edition is free and sufficient below real production
scale) added only once a named multi-hop question exists, modelling exactly
the edges that question walks; reciprocal rank fusion where a system needs
both vector and graph retrieval in the same turn, so neither has to cover the
other's blind spot alone; a narration model called last, reading facts a
deterministic query already computed, never trusted to compute them itself.

The one piece worth deciding before you need it: which fields belong to the
ledger versus which get derived into vector or graph form, because retrofitting
a graph onto data nobody modelled as a graph from the start means re-deriving
every edge by hand instead of writing one new query against structure that
was already there.

## References

**Papers:** [Microsoft's GraphRAG](https://microsoft.github.io/graphrag/) — the
project that named the failure mode this post opens with: baseline
vector-only RAG "struggles to connect the dots" across a corpus and performs
poorly on questions requiring holistic, multi-hop synthesis, versus the local
and global search modes a knowledge graph enables.

**Tooling:** [pgvector](https://github.com/pgvector/pgvector) — HNSW and
IVFFlat indexing inside Postgres itself, so vectors sit beside relational
rows rather than in a separate store; [Pinecone's vector database
primer](https://www.pinecone.io/learn/vector-database/) on approximate
nearest-neighbour indexing generally; [matchgraph-rag](https://github.com/sreme19/matchgraph-rag)
and [agent-ready-data](https://github.com/sreme19/agent-ready-data), both
public and runnable at zero cost, for everything measured in this post and
its companion.

*Companion to [Data, prompt, context, loop and harness
engineering](/blog/five-disciplines-of-building-with-models) and [Event-time
partitioning in Iceberg](/blog/event-time-partitioning-in-iceberg), which
covers the fused vector-plus-graph retrieval layer this post's third system
uses in full.*
