---
title: A warm introduction through someone I actually worked with, and the graph schema that makes colleague a guarantee rather than a filter
date: 2026-08-25
summary: The first professional query over eleven years of my own history returned a family member, because a filter is only as good as the caller who remembers to apply it. The fix was not a better filter but a schema — colleagues and private contacts got separate relationship tables, so the professional traversal is structurally incapable of reaching a clinician or a partner. That is a guarantee the other two stores in the same system cannot offer: an embedding index gets a mask at query time, a SQL store gets a second database file nobody attaches by accident, and only the graph can make a wrong answer unrepresentable. The measured price is recall — the conservative gate drops eleven real colleagues, and nine names stay filed as private with the conflict reported rather than resolved.
tags: [data-platform, agent-architecture, guardrails, context-engineering]
cover: /og/blog/where-a-wrong-answer-gets-prevented.png
---

The first time I queried for people I had worked with, my father came back in
the results.

Nothing failed in a way a test could catch. The graph had just been taught to
read eleven years of my own diary. The extraction rule was defensible: a name
appearing repeatedly inside a chapter dominated by one employer is probably a
colleague there. He is mentioned throughout those chapters. One stray mention of
an organisation nearby was enough, and he was given an edge in the professional
table.

That edge exists to serve one question. *Which person I actually worked with now
sits at a company on my target list?* Answered correctly, it turns a cold
approach into a warm introduction. Answered wrongly, it invents a warm
introduction that was never there. In the worse version of the same bug, it
proposes routing an executive job search through somebody I once went on a date
with.

This is the third store in a system that already had two, and adding it changed
what I think the interesting difference between the three actually is. It is not
which questions each one answers cheaply. That comparison is real, and I have
[written it up already](/blog/two-runtimes-and-no-send-button). It is where each
one lets you *prevent* a wrong answer, and how much of that prevention survives a
caller who forgets.

## Three stores, and three different places a mistake can be stopped

The corpus underneath all of this is about eleven hundred of my own documents.
Meeting notes, strategy decks, research logs, several thousand spreadsheets, and
seventeen numbered diary chapters running to roughly four hundred and ten
thousand words. It is split by shape rather than by subject.

Prose goes into a local embedding index — a 384-dimension model executed on the
processor, vectors in a plain array file, searched by one matrix multiply.
Spreadsheets go into DuckDB, because chopping a grid into paragraph-sized text
destroys the rows and columns that made it a grid. Companies, people and
investors go into Kuzu, an embedded graph database with a predefined schema of
node tables and relationship tables, and real Cypher over the top.

Each of those stores holds material that must never reach a drafting prompt: my
own compensation history, other people's interview scorecards, a personal diary.
And each offers a structurally different answer to *how do you stop that*.

**The embedding index can only mask.** Sensitivity and provenance are applied as
a filter over candidate rows before ranking, never as a pass over the results
afterwards. Filtering before the cutoff matters more than it sounds. Filter
afterwards and an excluded passage still consumes one of the five slots you asked
for, so a query for five results quietly returns four. But it is still a
predicate. Every retrieval path has to carry it, and a new path that forgets is a
leak with no symptom.

**The SQL store can separate the file.** Five of the workbooks are hiring
pipelines keyed to real people's names. They are legitimately my own business
records, so they load — into a *different* database file, which has to be
explicitly attached before any query can see it. DuckDB's attachment is not
persisted between sessions, so a new connection starts without it and has to ask
again. A sensitivity column in the shared database would have been easier to
build. It would also have put the burden on every query written from then on. A
convention is something you remember. A second file is something you cannot
forget.

**The graph can make the wrong answer unrepresentable.** That is the one the
other two cannot do, and it is what the last month of work was actually about.

## The question that justified the graph was about me, not about them

The company graph models who to approach: companies, their investors, the people
to reach. Every node in it points outward, and none of them is me. It answers a
two-hop question a table handles badly — which untouched company shares a backer
with one where a reply already landed.

The second layer models the other direction. Eleven years of my own episodes, the
organisations I passed through, the areas of life I tracked. The two share one
database on purpose. *Someone I worked with who is now at a target company* is a
traversal only if both halves live in the same store. Split across two databases,
it becomes an export, a join in application code, and a name-matching problem
nobody wants to own.

There is deliberately no node representing me. An ego node is connected to
everything, which makes it useless to query — a node with a hundred per cent
degree filters nothing and traverses nowhere. Ego networks conventionally omit
the ego for exactly this reason: [it is tied to all alters by definition, so it
offers little additional structural
information](https://inarwhal.github.io/NetworkAnalysisR-book/ch6-Ego-Network-Data-R.html).
The hub here is an episode — a time-boxed span of life — and organisations, areas
and people all attach to that instead. "What was I doing in 2021" becomes a date
range over episodes rather than a walk through a hub.

The episodes are transcribed, not inferred. I had already numbered the chapters
myself, so each one yields exactly one episode and nothing invents a span I never
wrote. Dating them needed one non-obvious choice. The naive span is the minimum
and maximum date mentioned, and that is wrong here. One chapter otherwise
entirely set in 2023 and 2024 mentions 2013 exactly once, in passing. Taking the
minimum stretches that episode across a decade and overlaps every chapter in
between.

So the span is the fifth to ninety-fifth percentile of the dates present, and a
separate count records how many fall more than six months outside it. That
distinguishes a retrospective aside from ordinary spread. Counting dates outside
the trimmed span would have flagged roughly ten per cent of every chapter by
construction, which is to say it would have flagged nothing.

## What cannot be derived should be recorded twice, not guessed once

Three chapters are titled with a working codename rather than an organisation.
The obvious derivation is not merely unhelpful. It is confidently wrong, in a
specific direction.

Count organisation mentions in one of those chapters and it reads as ninety-nine
per cent one employer, two hundred and thirty-eight mentions — with the
organisation the chapter is actually *about* appearing zero times. That is not
noise. In that year the new venture had no public name yet and the codename was
the working name, while the payroll was still the previous employer. The same
pattern repeats one era later, in the next chapter.

Both facts are true and they answer different questions. So the subject
organisation is a hand-maintained mapping, and the measured dominance is kept in
its own property on the episode node rather than discarded as an error. A
property graph lets both sit on the same node without either pretending to be the
other. The temptation in a tabular store is to pick a winner and write one
column. The temptation with an embedding index is not to notice the question was
ever ambiguous.

One chapter names no organisation I have confirmed. Text dominance says a
particular employer at seventy-six per cent, which is exactly the payroll signal
the other three chapters just proved untrustworthy. It stays unmapped, and is
reported as unmapped. A few chapter titles encode a private figure rather than an
organisation name at all. Those are flagged only so nothing downstream reads one
as an employer, and what they decode to is recorded nowhere in the pipeline.

## Separate relationship tables, not a kind property

Here is the decision the whole layer turns on.

The diary names colleagues, clinicians, family and dating contacts in the same
four hundred and ten thousand words. The obvious model is one person node with a
kind property, and a professional query that filters on it.

![Two ways to model people in a graph, compared. Above: one Person node table carrying a kind property whose value is colleague, clinical, intimate or family. Every professional traversal has to add a WHERE clause filtering on that property, and the query written later by somebody who never read the design doc omits it and returns a clinician, scored and sourced, with nothing about the row looking wrong. The guarantee lives in each caller. Below: the same people reached through two separate relationship tables declared in Kuzu, worked-with and known-privately, both running from an Episode node to an Acquaintance node. The professional traversal names the worked-with relationship type, so a clinician, a partner or a family member is not reachable from it at all. The guarantee lives in the schema, and the care moves to write time, where the extraction rules decide which table an edge goes into.](/blog/typed-edges-vs-kind-property.svg)

The obvious model is wrong, and the reason is the same one that put a second
DuckDB file on disk. A property puts the guarantee in every caller's hands. Every
traversal ever written against that graph has to remember the predicate. The one
that forgets returns a clinician — confidently, with an evidence string and a
mention count that make the row look thoroughly sourced.

So colleagues attach through one relationship table and everyone else through a
second one. A professional query matches the first and therefore *cannot* return
a doctor, even if whoever wrote the query never thought about doctors. Kuzu
requires a predefined schema: node tables, relationship tables declared between
specific node-table pairs, [typed properties declared up
front](https://kuzudb.github.io/docs/). That requirement reads as friction while
prototyping. Here it is the thing doing the protecting, because the constraint is
checked by the store rather than by the caller.

The second half of the same decision: people named in the diary are their own
node type, distinct from the node type holding target-company contacts. A diary
first name and a target company's contact with the same first name are almost
certainly two different people. Merging them on a shared primary key would
fabricate precisely the warm-introduction path the company graph already refuses
to invent. Linking the two halves is a deliberate act, with its own relationship
table and a field recording who confirmed it. It is never a side effect of
sharing a first name.

Compare what the same protection costs in the other two stores. In the embedding
index it is a boolean mask recomputed on every search path, verified by a test
that runs six retrieval methods across six provenance labels and asserts that no
restricted passage comes back. In DuckDB it is a file that is not attached. In
the graph it is a table that does not connect those two node types, and there is
nothing to verify because there is nothing to get wrong.

## What admits a name, and what merely weights it

Extraction is two tiers, and the split is the part worth copying.

Strong frames — a line beginning "Meeting", "Call with", "Followed up with" —
take a person as their object almost without exception. Those decide *who is a
person at all*. Three hundred and sixty-six names clear that gate. The rejections
are as informative as the admissions: a city, a business function, a dating app
and a former employer all follow "Meeting" as naturally as a person does, and all
four are correctly refused.

Loose frames — "to X", "for X", "with X" — are far too permissive to admit
anybody. They readily produce a city name and a department name. But they are
perfectly good for counting how often an *already admitted* person is mentioned.
So: strong frames gate, all frames weight.

That gate costs recall, and the cost is measured rather than assumed. Eleven real
people never appear in one of those frames and are dropped. That is the intended
direction of error. A missing colleague costs a query some recall. A mistyped
intimate relationship costs me my dignity in front of a recruiter.

Two frames had to be promoted from typing-only to admitting, and both times the
evidence was a recall hole found by hand-checking against the diary.

A clinician addressed only as "Dr" plus a surname never appears in a work frame,
so clinical recall was one out of eight before the title itself became an
admitting frame. And dating frames typed people without admitting them. A name
appearing only in a dating context was correctly identified as private, then
silently dropped. That sounds safe and is not: dropping the name leaves it free
to be picked up later by a stray organisation mention. Making those frames admit
took the private-contact count from three to twenty-two, and recovered every
hand-verified case that was being lost.

The narrowness of those frames is load-bearing in a way that is easy to
underestimate. "Date with" looks like an obvious romantic signal. A real diary
line reading *fix date with someone for the shoot* is a calendar entry with a
photo editor, and on the first run it typed that colleague as a romantic partner.
The pattern now excludes a scheduling verb before it and a purpose clause after
it. Getting the negative lookahead to survive the engine's backtracking took a
word boundary after the name. Without it the engine shortens the match until the
exclusion no longer applies, and the purpose clause stops excluding anything.

Family needed a different mechanism entirely. The diary says "dad" and "wife" two
hundred and ninety times and almost never next to a name — the one pattern that
matched "my wife" followed by a name matched falsely. What works is that the
diary addresses family *by* the kinship term: "Meeting Dad". The term is the
name. A kinship term clearing the strong-frame gate is a family member, which is
how my father stopped being a colleague.

## A conflict recorded is better than a conflict resolved

Some names appear in both a work frame and a dating frame. The typing rule puts
private kinds ahead of colleague, so those are filed as private. That is the
right default — mistyping a colleague as private costs recall, and the reverse
costs something you cannot get back.

But the conflict is real and unresolved. It may be two people sharing a first
name, or one person who was genuinely both. Silently picking the safe answer
throws away the information that the question was hard. So those names are marked
as contested, the conflicting evidence is written into the record, and the build
reports them. Nine surface on the real corpus. The typing stays private; the
uncertainty stays visible.

This is the same conclusion the retrieval side reached from the opposite
direction, which is why I trust it. On the embedding index I measured whether a
score threshold could make a weak match abstain rather than answer. It cannot:
the threshold that silences a wrong answer also silences real ones, on both term
coverage and cosine distance. Weak matches are labelled instead of suppressed. In
both stores the useful move was the same — keep the answer and attach the doubt
to it, rather than build a rule that quietly decides.

There is one gap this does not close. A single first name can belong to two
different people in two different eras: a work contact in one chapter, a private
contact in another. That is one node in this graph, and the contested flag is the
only thing that surfaces it. If you build this, make the identity assertion a
human act with its own edge from day one — the way the link between diary people
and target-company contacts already is. Retrofitting identity onto a graph that
already merged two people means splitting every edge by hand.

## Where each store lets you stop a mistake

| | Embedding index | SQL store | Graph |
| --- | --- | --- | --- |
| Question it makes cheap | Which passage explains this | How many rows match | What connects these two |
| Where prevention lives | A mask applied before ranking | A separate database file, attached on request | A relationship table that does not exist between those types |
| Who has to remember | Every retrieval path | Whoever writes the attach statement | Nobody |
| How it fails | A path forgets the mask, and the result looks normal | Someone attaches the restricted file and forgets to detach | The extraction writes the edge into the wrong table |
| Where the effort goes | Testing every path | One boundary, once | Getting the typing right at write time |

Read the last row across. The graph does not remove the work; it moves it. An
embedding index and a SQL store are defended at read time, over and over, by
whoever writes each query. A graph is defended once, at write time, by whoever
decides which table an edge goes into — and everything downstream inherits that
decision whether or not it knows the decision was made.

That is why the extraction rules above are so conservative, and why they are
allowed to cost eleven colleagues. In a store where a wrong answer is prevented
at write time, the write is the only place left to be careful.

## Beyond one person's document folder

> When two populations must never be confused, the difference belongs in the
> schema rather than in a predicate. A predicate is a promise every future
> caller has to keep. A schema is a promise the store keeps on their behalf —
> and the price is paid once, at write time, by whoever decides which table an
> edge belongs in.

| Domain | Two edge types that must not be interchangeable | What one mistyped edge produces |
| --- | --- | --- |
| Clinical coordination | Treating clinician and next-of-kin contact | A discharge summary routed to a relative nobody authorised |
| Financial crime | Transaction counterparty and shared-device link | An investigation naming someone connected only by a hotel network |
| Recruiting | Former colleague and former candidate | A referral request sent to somebody you once rejected |
| Corporate development | Board interlock and personal acquaintance | A confidential approach routed through a director's private friendship |
| Field service | Certified installer and warranty claimant | A dispatch sent to the person who reported the fault |
| Consumer social | Mutual professional contact and blocked contact | A suggested connection surfacing an ex to a user who blocked them |

Three choices generalise past any of these.

**Put a distinction you cannot afford to get wrong into the schema, not into the
predicate.** The test is not whether a filter works today — it will. The test is
whether the fifth query written against this data, by somebody who never read the
design note, still gets the right answer. A kind property fails that test. Two
relationship tables pass it, and so does a separate database file. Pick the
crudest boundary the store itself enforces, and accept that it looks heavier than
it needs to be.

**Make the gate that admits an entity stricter than the signal that weights it.**
Conflating those two is why bad graphs get built. Evidence good enough to count
how often something is mentioned is nowhere near good enough to decide that it is
a person, or a company, or a fault. Use the narrow, high-precision pattern to
decide what exists, then use everything you have to rank it. Then measure what
the narrow gate costs, so the recall you gave up is a number you chose rather
than one you never looked at.

**When two typings genuinely conflict, record the conflict and keep the safe
default.** Do not resolve it silently, and do not abstain. Abstention thresholds
were measured on the retrieval side of this same system and they do not separate
cleanly — the cutoff that suppresses a wrong answer suppresses real ones at the
same rate. Attach the doubt to the answer instead, count how many carry it, and
put that count in the build output where somebody will see it.

## A reference architecture for this shape

For anyone building the same thing. One ingest pass that classifies every source
file by *shape* before anything is indexed — prose, grid, or excluded — with a
sensitivity label decided independently of that and applied at query time rather
than at ingest time. Prose into a local embedding index, a small
sentence-transformer executed on the processor rather than a hosted endpoint,
because a corpus with a diary in it should not be shipped off the machine in a
batch job. Vectors in a plain array file, brute-forced with one matrix multiply
until the corpus outgrows memory. Grids into an embedded SQL store, with anything
covering identifiable third parties in a second database file that has to be
explicitly attached. Entities and relationships into an embedded graph database
with a declared schema, where every distinction that matters is a separate
relationship table rather than a property on a shared one. A rule-based router in
front of all three, scored on the same labelled question set as retrieval itself,
so "numbers come from SQL" is a mechanism rather than an instruction. And every
edge derived from deterministic extraction against a record that already exists,
never from a model reading prose — a fabricated relationship does not degrade an
answer slightly, it manufactures a connection that was never there.

Three things are cheap now and expensive later. Deciding which relationships get
their own table before you have written any edges, because splitting a merged
table means re-typing every edge by hand against source material you may no
longer have. Making cross-domain identity an explicit, human-asserted edge from
the first build, so "this diary contact is that target-company contact" has
somewhere to live that is distinguishable from a guess. And writing the labelled
question set before the retrieval layer rather than after, because every choice
above it is unarguable in both directions without one — chunk size, whether to
index titles, whether the gate is too strict.

## References

**Papers and texts**

- *Ego Network Data*, in **Network Analysis: Integrating Social Network Theory,
  Method, and Application with R** — the convention this layer follows in
  omitting the ego node: "Ego is often (but not always) excluded from
  visualizations and calculations because ego is, by definition, tied to all
  alters."
  [inarwhal.github.io](https://inarwhal.github.io/NetworkAnalysisR-book/ch6-Ego-Network-Data-R.html)

**Tooling**

- [Kuzu](https://kuzudb.github.io/docs/) — the embedded graph database used here.
  Its data model is "based on the property graph model, together with some
  structure (including node and relationship tables, and a pre-defined schema)",
  and that pre-defined schema is the mechanism this whole post rests on.
- [DuckDB's ATTACH statement](https://duckdb.org/docs/current/sql/statements/attach.html)
  — how the restricted second database stays isolated. Attachment is explicit and
  not persisted between sessions: "when a new session is launched, you have to
  re-attach to all databases."
- [BAAI/bge-small-en-v1.5](https://huggingface.co/BAAI/bge-small-en-v1.5) — the
  384-dimension, 33.4M-parameter embedding model behind the prose index, run
  locally on CPU, including the asymmetric query-side instruction prefix that is
  the easiest thing to get wrong when wiring one of these up.

*Companion to [Automating my job hunt outreach with an agent that finds,
researches, and drafts](/blog/two-runtimes-and-no-send-button), which covers the
router and the retrieval evaluation in full, and [pgvector and Neo4j sitting on
top of Postgres](/blog/pgvector-and-neo4j-on-postgres), which makes the
which-store-answers-which-question argument across three separate systems.*
