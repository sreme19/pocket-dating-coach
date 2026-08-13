---
title: Twenty context blocks per turn, with the output schema derived from them, so the agent cannot pad or invent
date: 2026-08-16
summary: Prompts built by string concatenation at the call site drift from whatever you tested, and the context an agent actually saw is thrown away the moment it replies. Here assembly is a subsystem: twenty blocks loaded in parallel, volatile facts grounded in SQL rather than recollection, and an output schema derived from which blocks arrived — so the model is never asked for a field this turn cannot fill. Nothing in it counts a token, which is the honest gap.
tags: [context-engineering, riteangle]
---

The prompt is not a template with a few variables in it. It is assembled, per
turn, from around twenty independently-loaded blocks — and which blocks arrive
changes not just what the agent knows, but what it is required to say back.

This is the part of riteangle that most resembles a real subsystem rather than a
feature. It also contains the single largest gap in the whole architecture, which
I will get to.

## What gets loaded before a word is written

![Six groups of context read in parallel: who he is, who is interested, his
matches, where he stands, what he told other agents, and this conversation. All
merged into one system prompt. Every limit is a row count or a string length;
nothing counts tokens.](/blog/context-fanin.svg)

Six groups, roughly twenty blocks, all fetched concurrently and then concatenated
into one system prompt.

A few of them are worth naming individually.

**Where he stands right now** is computed in SQL — live counts of who is active
in his pool, and his trust rank among them. No model touches it. This exists
because agents are extremely willing to invent a competitive picture if you let
them, and a real number in the prompt is the cheapest way to stop that.

**What he told other agents** is the answer ledger from the
[previous post](/blog/cross-thread-agent-memory-without-leakage) — capped at
twelve entries, and only present at all if consent allows.

**His matches** shows the shape of the whole thing. Ten are loaded, and only the
strongest six get hydrated with bio, preferences and recent messages. The other
four exist as names. That is a relevance decision made in plain code before the
model sees anything.

## The output schema is built from the input

This is the part I have not seen elsewhere, so it is worth spelling out.

![Five mappings from a context block being present to an extra field the model
must return: a pending proof request adds a refusal field, an active checklist
adds a completed-items field, a hand-off adds a wrap-up field, networking mode
adds a pressure field, a pending consent question adds a consent
field.](/blog/context-dynamic-schema.svg)

The agent returns structured JSON, not prose. But the *shape* of that JSON is
assembled at the same time as the context.

If there is no proof request pending this turn, the output schema has no field
for a proof refusal. If no checklist is active, there is no field for completed
items. The prompt finishes by stating the exact number of fields expected, and
that number changes turn to turn.

The reason is that a fixed schema teaches a model to fill things in. Ask for
twelve fields when only nine are meaningful, and you will get twelve — three of
them invented to satisfy the shape. Then your parser has to decide whether a null
meant "nothing to report" or "the model didn't know", and those two cases need
opposite handling.

Building the schema from the context removes the question. A field that could
only be noise this turn is simply not requested.

## Everyone arrived at context in 2026

Across the conferences I went to this year, context assembly went from a footnote
to the headline act in about twelve months.

The clearest single moment: at the Data Engineering Summit in May, **three
consecutive talks in the same hall** — MathCo, Tiger Analytics and EPAM —
independently argued that enterprise AI failure is a context problem rather than
a model problem. Two of them used nearly the same title. One was headed
*Data Rich. Context Poor.*

| Idea | Where | What it says |
| --- | --- | --- |
| Context as the scarce resource | Data Engineering Summit 2026 | Three consecutive talks, same diagnosis, no coordination |
| Context warehouse vs data warehouse | MLDS 2026 | A data warehouse records what happened. A context warehouse records *why an expert decided X in situation Y* |
| Ontology-driven multi-hop assembly | Data Engineering Summit 2026 | A worked traversal answering "why did Q4 growth decline", pruning dead branches — summarised as *this is reasoning, not retrieval* |
| Context products, not raw chunks | Data Engineering Summit 2026 | A seven-step serving path ending in **token-budgeted assembly** of structured context, then a decision trace written back as audit |
| Four memory types, four operations | DataHack Summit 2025 | Retrieval demoted to one of four types. The operations on the window: compress, isolate, trim, filter |

That last one is from August 2025 and it is the most useful framing I found,
because it is a checklist you can hold your own system against.

## Four operations, and we only do two properly

| Operation | What it means | riteangle |
| --- | --- | --- |
| **Filter** | Only load what this turn could plausibly need | **Yes.** Blocks are conditional; most turns load a subset |
| **Isolate** | Keep sources separated so they cannot contaminate each other | **Yes.** Every block is loaded and labelled separately, and the ledger is structurally prevented from carrying its origin |
| **Trim** | Cut what does not fit | **Crudely.** Fixed row counts and character slices, chosen by hand |
| **Compress** | Summarise older material to retain meaning at lower cost | **Offline only.** Per-match summaries and extracted preferences are generated on a schedule and stored — but nothing compresses at generation time |

Trim is the weak one. "Last twelve messages" is a guess that happens to work. It
is not responsive to whether those twelve messages are one-word replies or four
paragraphs each.

## The gap: nothing counts tokens

There is no tokeniser in this codebase. Nothing counts tokens, estimates a cost,
or decides what to evict when the window tightens.

What exists instead is a set of hand-chosen limits: twelve messages, ten matches
narrowed to six, ten admirers, twelve ledger entries, 240 characters here, 120
there. They were picked by looking at output and adjusting.

There is a comment in the conversation-history module saying that beyond twelve
turns the thread is summarised. **That summarisation is not implemented.** The
code takes the last twelve turns and drops the rest. I found it while researching
this post, which is its own small lesson about comments.

Set against the EPAM talk describing *token-budgeted assembly of structured
context products*, this is plainly behind. They have a budget and allocate it. I
have constants that were right when I chose them.

The honest defence is that it has not hurt yet, because these prompts are nowhere
near the context limit. The honest concern is that this design gets more wrong as
it grows, not less — every new block is another fixed allocation competing with
the others, and nothing arbitrates. The first time a user with a very long
history meets an agent with a very full prompt, the failure will be silent:
slightly worse answers, no error.

One related omission worth naming: **prompt caching is not used on these
prompts**. Two minor routes use it. The large advisor and proxy prompts — the
ones with twenty blocks in them, substantially identical between turns — do not.
That is a straightforward cost saving sitting untaken.

## The bit I would keep

If I rebuilt this tomorrow, one decision carries over unchanged: **the context
loaders are shared with the test harness by construction.**

The admin test suite does not reimplement context assembly for testing. It calls
the same loaders production calls, then declines to persist anything. It is
impossible for the tested prompt and the live prompt to drift, because they are
produced by the same code.

That sounds obvious and it is surprisingly rare. The usual pattern is a test
fixture that starts accurate and quietly rots, until you are debugging a prompt
that no user has ever received.

## The pattern, without the dating app

> **Treat context assembly as a subsystem with its own module boundary, its own
> concurrency, and its own tests — not as string formatting at the call site.**
> Load blocks independently and in parallel. Make each block conditional. Derive
> the output schema from which blocks arrived. Ground volatile facts in a query
> rather than the model's recollection. And share the assembly code with whatever
> you use to evaluate it.

| Setting | The blocks being assembled | The volatile fact to ground in SQL |
| --- | --- | --- |
| **Customer support** | Account state, entitlements, recent tickets, product config, outage status | Current plan and open incidents — never the model's memory of them |
| **Clinical decision support** | Problem list, medications, allergies, recent labs, care-plan stage | Active medication list, as of now |
| **Field service** | Asset history, warranty state, parts availability, technician skills | Stock on hand at the nearest depot |
| **Sales** | Account tier, contract terms, open opportunities, prior conversations | Current pricing and discount authority |
| **Fraud and risk review** | Transaction history, device signals, prior decisions, policy version | The policy version in force at the transaction date |

Three transfers worth the effort:

**Load in parallel, not in sequence.** These blocks are independent reads.
Sequential loading turns twenty round-trips into latency the user watches. This is
plain engineering, and it is the difference between a two-second and a
six-second reply.

**Ground the volatile facts in a query.** Anything a model would confabulate —
counts, rankings, current status, effective policy — should arrive as a computed
value inside the prompt. A number in the context is cheaper than any amount of
instruction telling the model not to guess.

**Derive the schema from the context.** If your agent returns structured output,
build the required fields from what is actually present. It removes a whole class
of ambiguity from the parser and stops the model padding.

And the anti-pattern to avoid, which I am currently guilty of: **do not let
hand-tuned constants stand in for a budget.** Row limits are fine as a first
version. They stop being fine when blocks multiply, because nothing is deciding
what matters when they compete.

## References

Most sessions here have no published recording. Where one exists it is linked.

| Source | Event | Recording |
| --- | --- | --- |
| Context at the core; token-budgeted assembly of structured context products | Data Engineering Summit 2026, May 2026 | Not published |
| Context warehouse versus data warehouse | MLDS 2026, Mar 2026 | Not published |
| Ontology-driven multi-hop reasoning over a context graph | Data Engineering Summit 2026, May 2026 | Not published |
| Context engineering: four memory types, four window operations | DataHack Summit 2025, Aug 2025 | Not published |
| Architecture of context engineering | DataHack Summit 2026, Aug 2026 | Not published |
| Agentic knowledge-augmented generation — Arun Prakash Asokan | DataHack Summit 2025 | [Recording](https://www.youtube.com/watch?v=Q1LtjqyxCFA) |
| Full hall recordings, several context and retrieval sessions | CYPHER 2025, Sept 2025 | [Day 2, Hall 3](https://www.youtube.com/watch?v=uOqflHyRxcs) |

*Fourth of nine posts on riteangle's architecture. Previous:
[cross-thread agent memory without cross-user leakage](/blog/cross-thread-agent-memory-without-leakage).
Next: a hand-off that expires in 48 hours, and reverses instead of deleting.*
