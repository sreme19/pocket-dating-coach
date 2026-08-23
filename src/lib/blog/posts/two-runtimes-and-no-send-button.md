---
title: Automating my job hunt outreach with an agent that finds, researches, and drafts — and leaves sending to me
date: 2026-09-03
summary: A director/VP-level job search runs on outreach nobody automates safely, because the risky part is the send. This system automates finding, researching, and drafting end to end, grounded in a local three-store memory over the sender's own documents, and keeps the one irreversible step out of its code entirely. The retrieval half gave the more surprising result: indexing each document's own title bought nearly what the vector index did, and rank fusion lost to its best single member twice.
tags: [agentic-architecture, operations, context-engineering]
cover: /og/blog/two-runtimes-and-no-send-button.png
---

Every message this pipeline writes sits in a plain text file until someone
copies it into a professional network by hand. There is no button anywhere in
the code that would do that step for them instead — not a disabled one, not
one hidden behind a confirmation dialog. It was never written.

I built this for a director/VP-level job search in two verticals where the
seat almost never shows up as a posting — it gets created by someone reaching
a founder or a hiring lead before a job req exists. So the system isn't a
job-board matcher. It finds target companies, researches the right person,
drafts a note worth reading, and tracks what happened, in a loop that runs
once per company:

![Six stages in a loop. A company is found, then researched into a one-page brief, then checked against three fit rules. A fit gets drafted into an opening note; a non-fit is set aside and logged directly, no note written. Every drafted note is read, edited, and sent by a person by hand, since no automated path exists for that step. Every outcome, sent or set aside, lands in the shared notebook, which feeds a short weekly review that adjusts what gets searched for next.](/blog/job-hunt-loop.svg)

Five of those six stages run in code. Two decisions about the one stage that
doesn't turned out to matter more than anything specific to the job search.

## The action kept out of the code, not just gated by review

Every outbound message goes out from the sender's own logged-in session, by
hand, every time. That's a stronger guarantee than "a person reviews it before
it sends," because that phrasing still implies a send mechanism exists
somewhere with a person standing in front of it. Here the mechanism doesn't
exist. One step in the pipeline produces text and writes it to a file. A
separate step logs that a message was sent, after the fact, once a person has
actually sent it themselves. Neither of those, at any point, has ever had a
branch that posts anything anywhere.

![Two things happen inside the system: it searches the open web for public information, and it writes a draft message as plain text. A dashed boundary marks a line the system never crosses. Below that line, only a person acts: logging into the network on their own account, and clicking send, the one step nothing else in the system can trigger.](/blog/job-hunt-boundary.svg)

The reasoning is asymmetric risk, not caution for its own sake. A professional
network account carries an identity built over years; automating a send or
scraping profiles risks a suspension for a modest efficiency gain on a task
run maybe a dozen times in a busy week. Compare that to something with the
opposite risk shape: a research step that reads the wrong company name off a
page and drafts a note for the wrong target. That's recoverable — reread the
brief, redraft, nothing has left the system yet. A send is not recoverable in
the same way. Whenever an action can't be undone and the cost of it going
wrong is high, the fix isn't a careful gate in front of the action. It's not
building the action's on-ramp into the code at all.

## Two runtimes, one gate

The pipeline runs two ways, built to be equivalent rather than one being a
cheap fallback for the other.

One runtime is a standalone command-line tool backed by a metered API key.
Each command calls a large language model directly — grounded in live web
search rather than the model's own memory of a company — and can run
unattended on a schedule. This is the reference implementation: every
fit-filter rule and every drafting constraint is defined here first.

The other runtime is the identical logic executed live, in conversation, by
whichever coding-agent session is already paid for through a separate
subscription. Instead of a script calling an API on a schedule, an agent
sitting in the project does the research and drafting itself — same live web
search, same fit-filter rubric — read directly from the reference
implementation's own source rather than a rewritten copy of it, then hands the
result to a small set of functions that only read and write the tracking
sheet:

```text
metered runtime  --  a scheduled script calling the model directly
                       |
                       |  both read the identical fit-filter and drafting rules
                       v
free runtime     --  a live agent session doing the same research and drafting
                       |
                       v
              one shared set of read/write functions over the tracking sheet
```

Neither runtime touches the tracking sheet with its own logic; both go
through the same functions, which snapshot the sheet before every write and
only ever append. That single shared gate is what keeps the two runtimes from
drifting apart — a change to the fit-filter rubric takes effect in both the
moment the source changes, because the free runtime is told to go read that
source directly rather than follow a paraphrase of it that would go stale.

The reason to keep the metered runtime at all, given that the free one costs
nothing, is that it's the only one that can be left running without a person
in a chat session. Exactly one lane runs unattended for that reason — a
weekly sweep that only discovers and researches, never drafts or sends. Even
that lane stays on the same machine, firing as an ordinary coding-agent
session on a local timer rather than moving to a hosted version of the same
idea; a cloud-hosted runner was considered and ruled out for a concrete
reason, not a vague one — it executes in an isolated sandbox with no access
to the one file this whole system reads and writes, so it structurally can't
be the thing running the sweep. The trade for staying local is a small,
honest one: it only fires while the laptop happens to be on and the app
happens to be open, and simply runs at next launch instead if it wasn't.
Everything else stays fully on-demand, because on-demand is free and a
background process can't reuse an interactive subscription's login by
design, which rules out "free and also unattended" as a third option
worth chasing.

## The gate between finding and acting

New target companies come from public signals — a funding announcement, an
executive hire, a product launch in the right space, found by search. Each
one lands in a queued state and stops there. Nothing in the system promotes a
queued company to an active outreach target on its own; that step is manual,
every time.

This is the same principle as the send action, one step earlier and lower
stakes. Getting discovery wrong costs almost nothing — a bad candidate just
sits in a list, unlooked-at. Getting outreach wrong costs something real: a
message to the wrong company at the wrong seniority spends a small amount of
credibility that doesn't come back. So the one gate in the whole pipeline
sits exactly on the boundary between "the system found something" and "the
system acted on it," and nowhere else — not one step earlier, where it would
slow down harmless discovery, and not one step later, where it would be too
late to matter.

## A filter with two wide dimensions and one narrow one

Before a queued company gets researched, three checks decide whether it's
worth the time, and only one of them is strict:

| Dimension | Width | Worked example |
| --- | --- | --- |
| Role family | Wide | A director/VP data-and-AI seat is the anchor, but a senior individual-contributor data-AI role, a product or GTM seat, a customer-facing technical role, or an investor-side role all pass. A pure sales-only seat is the only role-family miss. |
| Vertical | Wide | The two anchor verticals are voice-AI/contact-center and legal-tech/high-volume regulated intake, but any company built around a high-volume stream of customer, case, or transaction data passes too — a narrower target market on its own is context, not a disqualifier. |
| Location | Narrow | Fully remote, or one specific city, with no third option. A role that's a strong fit on every other dimension still fails outright if the only way to take it is relocating. |

The first two dimensions were widened deliberately after they started
producing "risk" verdicts on companies that were obviously worth researching
— the net had been excluding on adjacency (a role one step removed from the
core target, a market one step narrower than the anchor vertical) rather than
on an actual mismatch. Location never moved, because it's the one dimension
where "close enough" genuinely isn't: either the arrangement works
logistically or it doesn't, and no amount of enthusiasm on the other two
dimensions changes that.

The verdict is written back into the same row the candidate already lives
in, not into a separate report — a check that requires opening a second file
to read is a check that quietly stops getting read.

## The drafting step needed a memory, and one index would have been the wrong shape

A note that lands says something specific: a number the sender actually owned,
a decision they actually made. Those live in about two hundred and eighty of my
own documents — diaries, meeting notes, strategy docs — four of them running
past two hundred and thirty printed pages. Finding one proof point by reading
the document that holds it costs roughly a hundred and eighty thousand tokens
of context. That measurement is what forced a retrieval layer.

The obvious build is one index over everything. That would have been wrong,
because the questions arrive in three shapes.

Narrative questions want passages. "Why did that engagement end" has no
numeric answer, and no spreadsheet anywhere records a reason.

Quantity questions want an aggregation. "How many candidates reached a final
round" is a grouped count over rows, not a similarity match. Splitting a grid
into text passages destroys the column structure that makes the count possible.
This is the most common way a retrieval build goes wrong, and it degrades the
narrative side too, because grid fragments crowd out prose in every result set.

Relationship questions want a traversal, which is the third store, further
down.

So documents get sorted before anything is indexed: prose to a meaning-search
index, grids to a local analytical database, and a third bucket indexed nowhere
at all — source code, media, and other people's files.

![A question arrives, from a person or from the drafting step needing a proof point. Before anything is searched, a rule-based router decides which store holds that shape of answer, on a vocabulary of 3,070 terms drawn from table names, column names and row labels, scoring 97% on the labelled question set. Narrative questions reach a meaning-search index: a 384-dimension BGE-small model run through ONNX on the CPU, stored as a plain NumPy array searched by a single matrix multiply rather than in any vector database, matching on 120-token windows and returning the parent passage. Quantity questions reach DuckDB, roughly 190 tables across two database files, where the restricted set opens only on an explicit opt-in and the live ledger is mirrored in read-only. Relationship questions reach Kuzu, an embedded graph database with real Cypher, holding companies, people and investors for two-hop traversals, every edge deterministically extracted rather than inferred. The retrieved evidence feeds the drafting step, the only part of the path that calls a model. The draft lands in a plain text file, a person sends it from their own account, and the outcome is appended to the Excel tracking sheet through openpyxl and mirrored one-way into the Numbers copy.](/blog/corpus-query-path.svg)

The whole layer runs without calling a model. Embeddings come from a small
sentence-transformer executing locally on the processor, both databases are
embedded libraries rather than services, and nothing in the layer reaches a
network. Two things follow from that. It is free to re-run, diff, and
unit-test, which matters because a retrieval layer nobody can re-run is a
retrieval layer nobody can measure. And a personal diary sitting alongside
identifiable third-party records never leaves the machine — a hosted embedding
endpoint would have shipped all of it off the box in a single batch job.

The economics land in the same place. Retrieval returns roughly ten passages of
a few hundred tokens each, against the hundred and eighty thousand a full
document read cost. Same fact, a fraction of the context, and the index itself
costs nothing per query because no metered call is involved in building or
searching it.

## The measured wins came from the chunks, not from a better retriever

Five retrieval methods, scored against thirty-two hand-labelled questions.
Thirty-two is a configured number — the size of the question set I wrote by
hand. Everything in the table is measured.

| Method | Best answer first | Answer in top ten | Mean reciprocal rank |
| --- | --- | --- | --- |
| Naive keyword match | 48% | 81% | 0.590 |
| BM25 | 55% | 84% | 0.671 |
| Dense vectors | 77% | 90% | 0.808 |
| Small-to-big (the default) | 74% | 94% | 0.809 |
| Rank fusion | 77% | 87% | 0.809 |

BM25 is in that table on purpose. Comparing embeddings against naive keyword
matching flatters them. BM25 needs no model, no accelerator, and no index build
beyond a term-frequency table, and on a corpus dense with proper nouns it is
genuinely hard to beat. An embedding index that can't beat it isn't earning its
place.

Four results came out of that run, and two of them are negative.

**Indexing each document's own title moved keyword ranking from 0.590 to 0.671
— most of what the vector index bought, for free.** Several diary files state
their entire subject in the filename and never repeat it in the body. A passage
indexed without its title was unfindable by the obvious question about it. The
instruction generalizes past this corpus: fix what sits inside the retrievable
unit before reaching for a better retriever.

**A fact buried inside a passage about something else needs the match and the
return to be different sizes.** One passage carries a weekly call-volume figure
inside roughly five hundred tokens of process rules. No method found it in the
top two hundred. The clause is a small share of the passage, so it averages into
invisibility at passage-level embedding — keyword search reached it at rank
thirty-three, dense search never did. Matching against windows of roughly a
hundred and twenty tokens, then returning the parent passage, fixed it: both
buried-fact questions went from unanswered to answered. The cost is about two
and a half times more vectors.

**Reciprocal-rank fusion lost to its best single member, twice.** It rewards
consensus rather than coverage. A passage only one ranker finds scores once,
while anything both rankers find scores roughly double, and that arithmetic
pushed both buried-fact answers out of the fused top ten. It stays in the
codebase as a documented negative result rather than being deleted, because the
next person reaching for fusion should meet the measurement before the
intuition.

**Abstaining on a low score didn't work.** Both term coverage and vector
similarity were tried as a confidence threshold. Every threshold that silenced
a wrong answer silenced real ones too. Weak matches now carry a label instead
of being withheld. If you're building this, measure a candidate threshold
against your own true positives before shipping it — the intuition that a
confidence floor is free is the thing to check, not assume.

## An instruction in a prompt is not a mechanism

The rule "numbers come from the spreadsheet, never from prose" was written down
plainly, in the instructions the drafting agent reads. It was still wrong in
practice. A keyword search returned a *paraphrase* of an operational rate,
lifted out of a process document — and that paraphrase understated real weekly
volume by a factor of three. A stale restatement reaching a draft is the
concrete harm here, not a hypothetical one.

The fix was a classifier in front of the search, deciding which store answers
before anything is retrieved. Quantity phrasings route to the analytical
database. Narrative phrasings route to the passage index. Some questions need
both, and get both.

It is rule-based rather than a model, deliberately. Routing here is a small
closed problem, and a model classifier would be non-deterministic across runs,
awkward to unit-test, and would make the one layer that calls no model depend
on one. Its accuracy is scored alongside retrieval: 97% on the question set,
and twelve of fourteen held-out phrasings. Both misses routed to the database
when prose was the right answer, which is the safe direction to fail in.

One detail decided whether it worked at all. The routing vocabulary is built at
load time from table names, column names *and row labels* — three thousand and
seventy terms in total. Table names alone were too weak. The table holding an
automation rate has neither "automation" nor "rate" anywhere in its name; those
words exist only as cell values inside it.

## A relationship map earns its place at the second hop

The third store answers one question the other two handle badly: which company
I haven't approached shares an investor with one where someone already replied.

A table manages the first hop comfortably — list the investors in a given
company. The second hop is where it turns awkward, and the second hop is the
entire value. An untouched target connected through a shared backer to a
conversation already in progress is a warm approach rather than a cold one, and
that reframes a long backlog as a ranked shortlist. So companies, people and
investors live in an embedded graph database, queried in a graph query
language, where that traversal is a single statement.

Every edge comes from deterministic extraction — parsed fields and written
research notes, never inference. That's a correctness requirement rather than a
shortcut. A fabricated shared investor routes outreach down a warm-intro path
that doesn't exist, and a warm approach that turns out to be cold is worse than
no suggestion at all.

Two rules keep it honest, and the second is the one worth copying.

Company names in written research notes carry forms the tracking sheet doesn't:
a parenthetical legal name, two names joined by a slash, a trailing corporate
suffix. Matching on the literal string alone dropped eight companies' investor
and contact data silently. Lookup now tries a series of derived keys, most
specific first.

And when a research note's company still matches nothing in the tracking sheet,
the note is recorded as unmatched and skipped — no node is created for it. The
tracking sheet defines what exists. Inventing a company from a near-miss name
would split one company's edges across two nodes, and a traversal over a split
node returns answers that are confident and wrong.

## Sensitivity belongs in a separate file, not a flag on a row

The corpus holds three kinds of material: professional content, my own private
life, and identifiable third parties who never agreed to sit in a search index.
Which of the three a document is has nothing to do with which store it lands
in, and it gets enforced when a query runs rather than by convention.

Five of the workbooks are hiring pipelines keyed to real people's names. They
are legitimately my own business records, so they load — into a *separate*
database file, attached only on an explicit opt-in. A sensitivity column in the
shared database would have been easier to build, and it would have meant every
future query had to remember the filter. A separate file keeps those rows
outside the default query path altogether. A convention is something you
remember; a boundary is something you can't forget.

The drafting path filters harder still, to professional material only. A
proof-point search running unfiltered will eventually surface a compensation
figure into a draft's context — mine, or a job candidate's.

Some categories are excluded unconditionally, with no setting that re-enables
them:

- Financial and identity documents.
- Third-party HR material.
- The folder a form-hosting service creates for uploaded files. That one held a
  couple of hundred named applicants' CVs, submitted against an internship
  posting — other people's documents, gathered for a purpose that wasn't this
  one.

Scope is a preference a later rebuild can revisit. Those aren't.

One more finding, from getting it wrong first. Judging a folder by its name
doesn't work. A folder of a hundred and eleven files looked like venture
history and turned out to be a hundred and two monthly invoices wrapped around
four documents that mattered. Relevance is now scored on each document's own
opening words, against probes describing what a relevant document looks like
*and* probes describing what an irrelevant one looks like. Both directions are
needed: a household-finances document and a profitability memo both talk about
money, and only the negative probes separate them. The output is a ranked report
a person adjudicates, not a decision — and the middle bucket is the point,
because that is exactly where a name-based guess picks wrong without saying so.

## What a version of this should measure that mine doesn't yet

The tracking sheet is append-only: recording that a contact replied, or that
an outcome changed, is always a new row, never an edit to an old one. That
was a deliberate choice to avoid the fragility of matching and rewriting an
existing row by hand, and it has one direct cost — "what's the current state
of this thread" is a small aggregation over rows computed on demand, not a
single field you can glance at. If you're adapting this shape: don't reach
for update-in-place until row-matching has actually caused a real bug, and
budget for building that aggregation once you have enough rows that scanning
them by eye stops working.

The research step behind all of this is grounded entirely in public web
search, deliberately, to stay off a professional network's logged-in session
entirely — which means it works from name-and-title snippets, not a full
profile read. If you're building something similar and considering a deeper,
authenticated research step: don't add it speculatively. Add it once you can
point at evidence that shallow search-based research, and not sending
capacity, is the actual bottleneck slowing the pipeline down — and track how
often a drafted note gets rewritten by hand before sending as the signal that
tells you when that's true.

## The pattern without the job search

Strip the domain and two patterns are left. **An outbound pipeline where the
one irreversible action has no code path at all, and where the same
research-and-drafting logic runs on either a metered, unattended execution path
or a free, supervised one, as long as both write through the same gate.** And
underneath it: **a private memory that routes a question to the store holding
that shape of answer, rather than instructing a model to prefer one source over
another.**

Both generalize well past a job search:

| Context | The irreversible action kept out of code | Where its own records answer better than a model's recall |
| --- | --- | --- |
| Sales development | Sending the outbound email or connection request | Won-deal notes, for the proof point that actually moved a buyer like this one |
| Recruiting outreach | Messaging a candidate on a professional network | Prior placement records, for which pitch converted this role family before |
| Vendor and partner outreach | Committing to terms in a written reply | Past contract terms, for what was already conceded and shouldn't be reoffered |
| Fundraising outreach | Sending a cold note to an investor | The company's own metric history, so a figure in a deck traces to a source |
| Customer win-back or renewal | Sending the actual retention offer | Support and usage history, for why this particular account actually lapsed |
| Press and media outreach | Pitching a journalist directly | Past coverage, for what this outlet has already run and won't run twice |

Three pieces transfer directly:

**Keep the irreversible action out of the code entirely, not just behind a
review step.** A review step is a person supervising a mechanism that still
exists; removing the mechanism means there's nothing left for an error, a
prompt-injection attempt, or a future refactor to accidentally trigger. The
difference only shows up the day something tries to use that path — and on
that day, "the code can't do it" beats "the code isn't supposed to do it."
Put that boundary at the highest-stakes single step and no earlier. Gating
discovery instead of the send would slow the cheap, recoverable part of the
pipeline for no safety benefit, because a wrong discovery costs nothing to
unwind. The gate belongs exactly where getting it wrong stops being free.

**Give the same logic two execution paths sharing one write gate, instead of
building "the cheap version" as a separate, drifting implementation.** The
free path here is cheap specifically because it's told to read the paid
path's own rules as its instructions, not a summary of them, and because both
write through identical, snapshotted, append-only functions. Two
implementations of the same judgment call will disagree eventually; one
source of truth read two different ways won't.

**Fix what sits inside the retrievable unit before reaching for a better
retriever.** Indexing a document's own title alongside its passages closed most
of the gap between a keyword index and a vector one here, at no infrastructure
cost, because several documents state their subject in the filename and never
repeat it in the body. The same instruction covers the buried-fact case: when a
single clause is invisible inside a large passage, changing the size of what you
match against beats changing the model you match with. Reach for a heavier
retriever after the cheap fixes to the unit are exhausted, not before.

## A reference architecture for this shape

For anyone building the same pattern: a spreadsheet or lightweight database
as the single source of truth, read and written through one small set of
functions that snapshot before every write and only append; a research step
grounded in live web search rather than a model's own memory, so every claim
traces back to something fetched, not recalled; a fit filter computed inside
that same research call rather than as a separate pass, with its verdict
written into the same row it judges; a drafting step that reads a small,
human-curated file of confirmed-good examples before writing anything new;
zero code path for the one irreversible action, with a logging step that
only ever runs after a human confirms it happened; and exactly one scheduled
lane, kept to the smallest slice of the pipeline that actually benefits from
running unattended.

The memory layer under the drafting step is three local stores and a router in
front of them, all of it model-free. Narrative passages go through a small
sentence-transformer — a 384-dimension BGE model executed on the processor via
ONNX, cached to a plain array file and searched by one matrix multiply, because
at this corpus size a specialized vector index adds operational surface for no
measurable latency. Spreadsheets go into DuckDB, with third-party material in a
second database file attached only on request. Companies, people and investors
go into Kuzu, an embedded graph database with real Cypher, so a two-hop
shared-investor traversal is one statement. In front of all three sits a
rule-based router, scored on the same question set as retrieval itself.

The pieces worth getting right from day one, because they're expensive to
retrofit: writing the fit verdict into the same row as the candidate rather
than a side report (moving it later means touching every consumer of that
report); choosing append-only before there's enough volume to justify
anything else (retrofitting update-in-place onto a sheet already full of
rows means writing a matching layer you didn't need to design under
pressure); building the free runtime to read the paid runtime's rules
directly from day one, rather than hand-copying them once and letting the
copy drift; and writing the labelled question set before the retrieval
layer rather than after, because every choice above it — chunk size, whether
to index titles, whether fusion helps — is unarguable without it.
