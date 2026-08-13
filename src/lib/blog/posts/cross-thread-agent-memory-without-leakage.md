---
title: Cross-thread agent memory without cross-user leakage
date: 2026-08-14
summary: A cross-thread memory store for agents, where the privacy boundary is a column that was never created. How riteangle lets an agent reuse what you already said without letting it reveal who you said it to.
tags: [context-engineering, riteangle]
---

A man matched with three women has three separate agents talking to him. Each one
is working on behalf of a different person, and each one, quite reasonably, wants
to know whether he wants children.

So he gets asked three times.

That is a bad experience, and it is also a bad signal — by the third time he is
answering a form, not having a conversation. The obvious fix is shared memory: let
the third agent see what he told the first. The obvious fix is also a
cross-user data leak, because the moment an agent can quote something he said in
another thread, it has told him something about a conversation he did not have
with it.

The answer ledger is our attempt to get the first thing without the second.

## Long-term memory is the part you own

The framing that made this tractable came from an AWS session at their Bengaluru
summit — a slide splitting agent memory into six types across two lifetimes. The
argument that stuck: **short-term memory belongs to whichever framework you
picked**, and you have limited control over it, while **long-term memory is
retrieved from stores you own** — which makes data quality, not model quality,
the deciding variable.

A talk at DataHack Summit 2026 put it more bluntly still. The session was called
*The Memory is the Harness*, and its closing line was that memory is your only
true moat.

If long-term memory is the part you actually own, then its schema is a product
decision, not a storage detail. Which is where this gets interesting.

## The privacy boundary is a missing column

![The ledger table holds five columns: who said it, the canonical topic key, the
verbatim answer, when it was captured, and a staleness timestamp. Two further
columns are shown crossed out: the match it came from, and the counterparty it
was said to. Neither exists.](/blog/ledger-schema.svg)

The ledger stores what he said and the topic he said it about. It does not store
which conversation it came from, or who he was talking to.

Not "does not expose." Does not *store*. There is no match identifier and no
counterparty identifier on the row, so the provenance cannot be reconstructed
from the table — not by a query, not by an agent, not by someone with full
database access and bad intentions.

This is a deliberately crude mechanism, and crude is the point. Access control
that depends on every future query being written correctly is one refactor away
from failing. A column that was never created cannot be selected by accident.

The cost is real: we cannot answer "where did this come from" for our own
debugging either. That was the trade, and we took it.

## Writes are unconditional, reads are gated

![Write path is always on regardless of consent. Read path has three tiers: with
no decision yet, topic keys only; with consent granted, verbatim answers capped
at twelve entries; with consent revoked, locked but not purged.](/blog/ledger-consent.svg)

Consent gates **reading**, never writing.

That asymmetry is the bit people push back on, so it is worth defending. If
declining stopped the capture, then a man who says no in month one and yes in
month three starts from nothing, and his yes is worth nothing for another three
months. Gating the read instead means consent is instantly meaningful in both
directions — granting it makes existing memory usable immediately, revoking it
locks the store without destroying it. Revocation is a lock, not a purge.

The middle tier is the part I am most pleased with. Before any consent decision
exists, an agent can read **topic keys but not answers**. It can see that "kids"
has been covered before, without seeing what was said.

That sounds like a technicality. It is actually the whole feature. It lets the
agent make an informed decision about *whether asking is worth a turn* — if the
subject is already answered somewhere, maybe spend the turn on something else —
without any content crossing between threads. The cheapest possible signal, and
it turns out to be the one that matters.

## The verbatim gate

Anything entering the ledger has to survive one check: the extracted answer must
appear literally in what he typed. Not paraphrased, not summarised, not
"semantically equivalent." A substring match, or it is discarded.

This is a hard constraint on an extraction model that would much rather be
helpful, and it throws away perfectly good captures.

It exists because of what happens downstream. A ledger entry gets quoted back to
him later, in the second person — *you mentioned you're not looking to relocate*.
If the extraction paraphrased, tidied, or hallucinated a detail, we have put words
in a man's mouth and then attributed them to him. An agent that re-asks a question
is mildly annoying. An agent that confidently misquotes you is something you stop
trusting, permanently, and correctly.

So the model may only select spans, never compose them. Losing a fraction of
captures is cheap by comparison.

## Staleness is a real problem, not a hygiene one

Answers get a 120-day window, after which they are offered for reconfirmation
rather than quoted, and a hard 540-day drop. At most twelve entries reach the
prompt.

I would have treated this as retention housekeeping if I had not seen a slide at
DataHack Summit 2026 that named it as a production failure mode. A Cisco session
on enterprise compliance agents described what they called the policy-versioning
trap: retrieval returns the *current* policy, but the pull request under review
was written against an older one, so the agent's reasoning is confidently
anchored to the wrong version. Their fix was effective-date filtering on
retrieval.

Same shape, different domain. "He doesn't want to relocate" was true in March. If
it surfaces unqualified in November it is not memory, it is a stale assertion
wearing memory's clothes. The staleness window is not tidiness — it is the
difference between a fact and a fact-shaped thing.

Two other sessions circled the same drain from different angles: a hedge fund
talk at MLDS 2026 listed *context rot* and catastrophic forgetting among its
production lessons, and a Typewise session back in August 2025 was already
demoting retrieval to just one of four memory types, with four operations defined
over the window — compress, isolate, trim, filter — and named multi-turn context
exhaustion as the thing that breaks first. That talk also made the point that
output quality degrades well before a context window is full, which is why the
cap here is twelve entries rather than "as many as fit."

## Shared keys, grown from use

For cross-thread memory to work at all, both sides have to agree on what a topic
*is*. If one agent files something under "children" and another looks it up as
"kids," the ledger silently does nothing.

We do not maintain that taxonomy by hand. Topic keys are canonicalised into a
registry that grows from the questions agents actually generate — when an agent
coins a new subject while planning what to ask, that subject is registered, so
subsequent lookups across every thread land on the same key.

It is a small piece of plumbing and it is the reason the whole thing functions
rather than degrading into near-miss keys that never match.

## Where this sits against the industry

| Idea | Where it showed up | Where riteangle differs |
| --- | --- | --- |
| Six-type memory taxonomy, short vs long term | AWS Summit Bengaluru 2026 | We implement only long-term semantic memory. No episodic replay across threads — that is the leak |
| Long-term memory retrieved from stores you own; data quality decides | AWS Summit Bengaluru 2026 | Agreed, and taken further: the store's *schema* is the privacy control |
| Memory as the durable advantage | DataHack Summit 2026 | Same conclusion, arrived at from a consent problem rather than a moat argument |
| Effective-date filtering to avoid stale retrieval | DataHack Summit 2026 | Same mechanism, applied to personal disclosures rather than policy documents |
| Context rot, catastrophic forgetting | MLDS 2026 | Addressed by hard entry caps rather than summarisation |
| Retrieval as one of four memory types; compress, isolate, trim, filter | DataHack Summit 2025 | We do not compress. Verbatim-or-nothing, because entries are quoted back |

The gap I will name: none of these talks were about consent. They were about
capability, cost and correctness. The question of whether an agent is *permitted*
to know something it could trivially retrieve did not come up on any stage I sat
in, across eleven events. For a consumer product it is the first question, not a
footnote — and it is the one that forced every design decision above.

## The pattern, without the dating app

Strip the domain and this is:

> **Shared long-term memory across agent instances, with provenance omitted at
> the schema level and reads gated in tiers.** Facts are written unconditionally.
> Existence of a fact is readable before permission; content is readable only
> after. Capture is span-selection from the user's own words, never composition.
> Entries carry an effective-date window so a stale fact degrades to a question
> rather than an assertion.

The precondition is structural: **one principal is represented by several agent
instances, each acting for a different counterparty.** Whenever that is true, you
have both the redundancy problem and the leakage problem at once.

| Setting | The repeated question | What must not leak across instances |
| --- | --- | --- |
| **Multi-tenant B2B support** | An engineer re-explains their environment to an agent on every account they hold | Which other tenant they also work with |
| **Healthcare across providers** | A patient restates history at each new clinic | Which other clinicians they are seeing |
| **Recruiting** | A candidate re-answers relocation, notice period, compensation for every employer's agent | Which other employers they are talking to |
| **Professional services and agencies** | A client restates constraints to each engagement team | Which competitor the firm also serves |
| **Marketplaces and brokerage** | A buyer restates requirements to each seller's agent | Which other sellers they are negotiating with |
| **Insurance broking** | An applicant repeats disclosures per carrier | Which other carriers quoted them |

In every row, the value and the hazard come from the same fact. That is what
makes schema omission the right tool rather than access control: you are not
trying to restrict who can query the origin, you are trying to make the origin
unrecoverable.

Three transferable choices:

**Delete the join key, not the access.** Access control depends on every future
query being written correctly. A column that does not exist cannot be selected by
a mistaken query, a new engineer, an over-eager agent, or a leaked credential. You
pay for it in debuggability, and that is the trade to make consciously.

**Gate the read, not the write.** If declining stops capture, consent is worthless
for months after it is granted. Gating reads makes permission instantly meaningful
in both directions, and revocation becomes a lock rather than a destruction event
— which is also what makes it reversible without a data-recovery story.

**Ship a topics-only tier.** The middle tier — knowing a subject has been covered
without knowing what was said — is the highest-value, lowest-risk signal in the
whole design, and it is the one most systems skip. It is what lets an agent decide
whether a question is worth asking without any content crossing a boundary.

The constraint worth copying wholesale is the verbatim gate. If your system quotes
stored facts back to the person who supplied them, the extraction step must select
spans rather than compose summaries. A paraphrase that drifts becomes a
misattributed quote, and misattribution destroys trust far faster than asking a
question twice.

## What it does not do

It is memory, not retrieval. There is no embedding, no vector search, no semantic
similarity anywhere in the path. Topic keys are exact-match. If a subject is
phrased in a genuinely novel way, the ledger misses it and the man gets asked
again — the failure mode we set out to fix, still present in the tail.

That is a deliberate stopping point rather than an oversight. A similarity search
over cross-thread personal disclosures is exactly the mechanism that would let
content bleed between conversations in ways the schema no longer prevents, since
similarity does not respect the boundary that a missing column enforces. If we
add retrieval here, the privacy argument has to be rebuilt from scratch, and I
would rather ask a man a question twice than get that wrong once.

## References

Most sessions referenced here have no published recording. Where one exists it is
linked.

| Source | Event | Recording |
| --- | --- | --- |
| Agent memory taxonomy, short vs long term, data quality as the deciding variable | AWS Summit Bengaluru 2026, Apr 2026 | Not published |
| *The Memory is the Harness* | DataHack Summit 2026, Aug 2026 | Not published |
| Enterprise compliance agents, policy-versioning trap, effective-date filtering | DataHack Summit 2026, Aug 2026 | Not published |
| Production lessons: context rot, catastrophic forgetting, immutable audit trails | MLDS 2026, Mar 2026 | Not published |
| Context engineering: four memory types, four window operations | DataHack Summit 2025, Aug 2025 | Not published |
| Agentic knowledge-augmented generation — Arun Prakash Asokan | DataHack Summit 2025 | [Recording](https://www.youtube.com/watch?v=Q1LtjqyxCFA) |
| Full hall recordings, several memory and retrieval sessions | CYPHER 2025, Sept 2025 | [Day 2, Hall 3](https://www.youtube.com/watch?v=uOqflHyRxcs) |

*Second of nine posts on riteangle's architecture. Previous:
[Match decisions without a model in the loop](/blog/match-decisions-without-a-model-in-the-loop).
Next: context assembly, and what an agent is told before it says a word.*
