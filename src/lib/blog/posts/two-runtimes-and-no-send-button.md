---
title: Automating my job hunt outreach with an agent that finds, researches, and drafts — and leaves sending to me
date: 2026-09-03
summary: A director/VP-level job search runs on outreach nobody automates safely, because the risky part is the send. This system automates finding, researching, and drafting end to end, and keeps the one irreversible step out of its code entirely. Underneath it, memory is split three ways: a table store for quantities, an embedding index for meaning, a graph for relationships. The question is no longer how to store data for a human to read, but how to organise it so an agent retrieves the right slice before a model call it pays for. The retrieval half gave the more surprising results: indexing each document's own title bought nearly what the vector index did, four employers' near-identical policies could only be separated by file path rather than by any retriever, and a negative result about rank fusion did not survive re-running it on a larger corpus.
tags: [agentic-architecture, operations, context-engineering, data-platform]
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

## Three representations of one business reality

The three stores are not three implementations of one idea. They are three ways
of writing the same facts down, and each one makes a different question cheap.

**A table keeps facts as rows and columns.** This is the oldest and most mature
of the three, and for anything countable nothing has displaced it. Relationships
live here too — a foreign key *is* a relationship and a join *is* a traversal —
so the honest claim is not that a relational store can't express a connection.
It's that every additional hop costs another join, written by whoever writes the
query, and that cost is what starts to bite at depth.

What a table externalises is meaning. A column has a name, a type, and perhaps a
constraint. Everything else — what it counts, which population it covers, when it
was last revised, whether its timestamps carry a zone — lives in documentation, a
naming convention, a data dictionary, or a colleague's head. A human reading a
figure applies a reflex an agent doesn't have: *hang on, is this current?*

I measured how hard that missing reflex bites in a separate local lakehouse
project, over a public federal complaints feed. Both numbers below are measured
there, not here:

- One day's delivery carried complaints spanning a median of 108 distinct event
  dates, and 72% of the days in the fetch window received rows across more than
  one delivery. One date was still receiving rows in 31 separate files. So
  Tuesday's count for a given day is simply lower than Friday's count for that
  same day. Nothing errors, no test goes red, and a correct answer quietly
  becomes a wrong one.
- About 4.5% of rows carried an event timestamp *later* than the complaint
  reporting it. The median negative gap is 2.8 hours, and 92% fall inside six.
  That isn't corruption, it's a timezone: one timestamp in the consumer's local
  time, the other in Eastern, and neither column declaring a zone.

The second is the more dangerous defect, because the column isn't broken. It's
underspecified. An analyst sees a three-hour negative gap and thinks *ah, local
time*. An agent reads a field typed as a timestamp, takes it at face value, and
computes a calling-window figure that can be off by six hours.

Neither finding argues against relational stores. Both argue that the metadata an
agent needs — units, grain, coverage, revision time, zone — has to be an output of
the table rather than a convention around it. Given that, a table is the
strongest of the three for anything countable: an agent reads the schema, writes
a precise query, and gets back exactly the rows it asked for and nothing else.

**An embedding index keeps facts as position.** Prose is split into chunks, each
chunk becomes a fixed-length vector, and retrieval returns the chunks nearest the
embedded question. The useful property is that nearness isn't spelling. A keyword
index asked for "termination" looks for that string. An embedding index also
reaches passages about dismissal, ending an engagement, and offboarding, none of
which contain the word.

Worth stating precisely, because the shorthand oversells it: what the index
computes is proximity in a learned space, which *approximates* meaning rather
than encoding it. Four near-identical employer policies, further down this post,
are exactly where the approximation and the intent come apart — four passages that
mean nearly the same thing, on a question that turned on which employer wrote
them, a fact none of the four contains.

Other modalities join this store through a pipeline rather than by being poured
into it. Audio becomes searchable by transcription, and it's the transcript that
gets chunked and embedded. Images and video go through either a multimodal
embedding model that maps them into a shared space with text, or a captioning
step whose captions get embedded. The store holds vectors. What produced each
vector is an upstream decision, and it sets the ceiling on what the store can
answer.

**A graph keeps facts as connections, with the connection itself as data.** That
one gets its own section below, because the terminology and the payoff both need
room.

| Representation | Makes this cheap | Gets expensive at |
| --- | --- | --- |
| Table (DuckDB) | Counting rows — "how many reached a final round" | Depth: one join per hop |
| Embedding index (BGE-small) | Recall by meaning — "why did that engagement end" | Near-duplicates that score alike |
| Graph (Kuzu) | Traversal — "which untouched company shares an investor" | Aggregation, and full-text |

## The context bill, and why a bigger model doesn't pay it

Finding one proof point by reading the document that holds it cost roughly a
hundred and eighty thousand tokens. Retrieval returns about ten passages of a few
hundred tokens each for the same fact. That ratio is the whole case for putting a
retrieval layer under a drafting step, and it's worth separating the three costs
it moves, because they usually get collapsed into one.

**Tokens are billed.** A pipeline that hands a model the corpus and asks it to
find the relevant part pays for the corpus on every question, including all of it
that was irrelevant.

**Long prompts are slower before they are anything.** Time to first token grows
with input length. A retrieval step that runs locally in milliseconds and removes
most of the prompt is usually a net latency win rather than a tax on the request.

**Attention isn't uniform across a long context.** This is the one that gets left
out, and it's why the first two don't tell the whole story. Liu and colleagues
found that performance is highest when the relevant passage sits at the beginning
or the end of the input, and degrades measurably when a model has to reach for it
in the middle — including in models built for long contexts. So padding a prompt
with the corpus isn't merely slower and dearer. It can lower answer quality,
because the passage that matters is now buried among everything that came with
it.

The tempting response to a pipeline that's expensive, slow, and mediocre is a
stronger model. Sometimes that's right. But when the work the model is doing
badly is *finding* rather than *reasoning*, a stronger model buys a better search
over the same oversized haystack, at a higher price per question. The cheaper
move is to hand it a smaller haystack.

That reframes what the model is for. It's the reasoning step, and the finding
belongs to infrastructure specialised for it: deterministic, unit-testable, and
here, free to re-run. The entire memory layer under this drafting step calls no
model at all. That's precisely what makes it affordable to re-score against
thirty-eight labelled questions every time the corpus moves.

There's a real trade in this, and it isn't free. Any retrieval layer can drop the
passage the answer needed, where a model handed everything cannot. So the number
to watch isn't average answer quality. It's the rate at which retrieval returns
nothing useful for a question you know is answerable. Write the labelled question
set first, measure top-ten recall against it, and treat a fall in that number as
the signal to widen retrieval rather than to buy a larger model.

One framing is worth resisting. It's tempting to draw this as a maturity ladder:
raw prompting, then semantic retrieval, then structured queries, then graph
traversal, each superseding the last. Only the first step is a real progression —
moving retrieval out of the prompt and into infrastructure is close to strictly
better. What comes after isn't a ladder. Semantic, structured and relationship
retrieval are siblings, each matched to a shape of question, and a system that
"graduated" from its embedding index to a graph has usually just lost the ability
to answer narrative questions.

## The measured wins came from the chunks, not from a better retriever

Five retrieval methods, scored against thirty-eight hand-labelled questions.
Thirty-eight is a configured number — the size of the question set I wrote by
hand. Everything in the table is measured.

| Method | Best answer first | Answer in top ten | Mean reciprocal rank |
| --- | --- | --- | --- |
| Naive keyword match | 49% | 76% | 0.585 |
| BM25 | 51% | 78% | 0.615 |
| Dense vectors | 59% | 81% | 0.657 |
| Small-to-big (the default) | 51% | 84% | 0.654 |
| Rank fusion | 57% | 84% | 0.656 |

These are lower than the figures this post carried when it went up, where
small-to-big reached 94% in the top ten rather than 84%. Both runs are real.
The question set grew from thirty-two questions to thirty-eight, and the corpus
roughly doubled, from about five thousand passages to eleven and a half
thousand. More questions against a larger haystack is a harder test, so the
drop is not a regression to chase.

It is worth stating rather than quietly restating, because a retrieval number
published once tends to get quoted forever. The reason to keep scoring cheap
enough to re-run is so that it gets re-run when the corpus moves underneath it.

BM25 is in that table on purpose. Comparing embeddings against naive keyword
matching flatters them. BM25 needs no model, no accelerator, and no index build
beyond a term-frequency table, and on a corpus dense with proper nouns it is
genuinely hard to beat. An embedding index that can't beat it isn't earning its
place.

Four results came out of that work. Two were negative, and one of the two has
since been overturned by re-running it.

**Indexing each document's own title moved keyword ranking from 0.590 to 0.671
in the original thirty-two-question run — most of what the vector index bought,
for free.** That pair of figures belongs to that run and has not been re-tested
against the larger set; the finding is the direction, not the decimals. Several
diary files state
their entire subject in the filename and never repeat it in the body. A passage
indexed without its title was unfindable by the obvious question about it. The
instruction generalizes past this corpus: fix what sits inside the retrievable
unit before reaching for a better retriever.

Anthropic's contextual-retrieval write-up arrives at the same conclusion by a
more expensive route. It has a model write a short situating description for
every chunk before embedding, and reports retrieval failures falling from 5.7% to
3.7% of relevant documents missing from the top twenty, and to 1.9% once keyword
matching and reranking are added. Those are their measurements on their corpus,
not mine. The mechanism is identical, though: the chunk was missing the context
that made it findable. A filename is the cheapest available version of that
context, and it is already written.

**A fact buried inside a passage about something else needs the match and the
return to be different sizes.** One passage carries a weekly call-volume figure
inside roughly five hundred tokens of process rules. No method found it in the
top two hundred. The clause is a small share of the passage, so it averages into
invisibility at passage-level embedding — keyword search reached it at rank
thirty-three, dense search never did. Matching against windows of roughly a
hundred and twenty tokens, then returning the parent passage, fixed it. On the
larger question set it answers one of the two buried-fact questions where
passage-level dense search answers neither. It answered both on the smaller set,
so the honest version of this claim is that the technique reaches facts
passage-level embedding cannot, not that it reaches all of them.

**Reciprocal-rank fusion lost to its best single member twice, and then stopped
losing.** The mechanism is worth keeping either way: fusion rewards consensus
rather than coverage. A passage only one ranker finds scores once, while
anything both rankers find scores roughly double. The formula is a sum, across
the rankers, of one over a constant plus the passage's rank in that ranker's
list — Cormack and colleagues fixed the constant at sixty, specifically so that a
single outlier ranker putting something first can't dominate the fused order. On
the thirty-two-question set
that arithmetic pushed both buried-fact answers out of the fused top ten, which
read as a clean negative result.

On the current set fusion ties small-to-big at 84% in the top ten and recovers
the buried-fact question that passage-level dense search misses. So the verdict
is withdrawn while the mechanism stands. Small-to-big remains the default
because it is the simpler of two methods scoring the same, which is a weaker and
more accurate reason than the one I had.

That reversal is the more useful lesson than either measurement. A negative
result held on a thirty-two-question set at one corpus size, and did not survive
the corpus growing. Retrieval verdicts have a shelf life, and the arithmetic
that explains a result is more durable than the ranking it produced.

**Abstaining on a low score didn't work.** Both term coverage and vector
similarity were tried as a confidence threshold. Every threshold that silenced
a wrong answer silenced real ones too. Weak matches now carry a label instead
of being withheld. If you're building this, measure a candidate threshold
against your own true positives before shipping it — the intuition that a
confidence floor is free is the thing to check, not assume.

## Four employers wrote the same policy, and no retriever could tell them apart

A question arrived that looked trivial: what was the leave policy at the company
I worked at during a particular stretch. The system answered confidently and
returned a different employer's policy.

Four former employers each wrote an office policy, a leave policy and a
contractor policy. The documents are near-identical in wording, because that is
how such documents get written. Twenty working days of annual leave, ten days of
sick leave, a clause about public holidays not counting against the balance. All
four say roughly that.

Retrieval matches on wording. So it returned all four, ranked by nothing that
mattered. The employer actually being asked about came sixteenth under keyword
matching and twenty-fifth under dense vectors. The default returns five results.

Two things about that are worth separating. The first is that the answer was
wrong. The second is that nothing in the output said so — every returned passage
was a genuine leave policy, scoring exactly as a good match should score. This
is the failure mode that matters in a drafting pipeline: not an empty result,
but a plausible one from the wrong source.

**A better retriever cannot fix this, and it is worth checking rather than
assuming.** The smarter method ranked the right employer *worse* than the crude
one, twenty-fifth against sixteenth. That is the signal that the problem is not
ranking quality. The information needed to separate four near-identical
documents was never in their text. Nobody writes "this is the policy of the
company you worked at from this year to that year" inside the policy.

It was in the file path the whole time. Exported document folders carry
per-account directory names, and folder and file names carry company names. So
documents now get an organisation label derived from where they sit rather than
what they say, and a query can be scoped to one. The right employer's three
policy passages come back at the top, in place of three other employers'.

Two design choices in that are transferable, and one bug is worth the space.

**A document gets a set of labels, not one.** One contractor policy sits in a
second company's folder inside a third company's export directory. All three
facts are true. An earlier instinct was to score the candidates and keep a
winner, which would have discarded the label that makes the document findable at
all. Where provenance is genuinely multi-valued, storing it as a set costs
nothing and forcing a single value silently loses data.

**The label describes where a document sits, not what it discusses.** A meeting
note filed under one company that talks at length about another is labelled by
where it lives. That is a real limitation and the right trade. Labelling by
content would match every document that so much as mentions a company, which is
the problem being solved rather than a solution to it. Provenance is a property
of the artifact; subject matter is a property of the text, and conflating them
gives you back the original mess.

The bug is the kind that hides in plain sight. The machine's own user account is
named after one of the companies, so every absolute path in the corpus contains
that company's name. The first version of the matcher labelled all one thousand
three hundred and sixty-six documents as belonging to that employer, instead of
the seventeen that do. It looked like it worked, because a filter that matches
everything returns plausible results for every query.

The fix is to strip the machine-specific prefix before matching anything, and
the durable version of the fix is a test that fails if that ever stops
happening. The general shape: when deriving metadata from a path, the parts of a
path that describe the *machine* are not data about the *document*, and they are
easy to leave in because they are invisible in every example you look at.

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

Three terms carry the whole model, and they're worth naming precisely. A **node**
is an entity — here a company, a person, or an investor. An **edge** is a named,
directed relationship between two nodes: backed by, employs, invested in. In a
property graph, which is what this store implements, both nodes *and* edges carry
their own properties. A company node holds a vertical and a funding stage; the
edge to its investor holds the round and the date it was announced. Attributes on
the relationship are the part people miss, and they're model-specific: in an RDF
triple store an edge is a bare triple, and giving it attributes of its own takes
reification.

Traversal is what you do with that. Start at a node you can name, follow an edge
type, arrive at another node, read its properties, and keep going while the
relationships stay relevant. What comes back is a connected set of facts, not a
ranked list of passages.

![Two parts. The first is the anatomy of a property graph: a node is an entity such as a company, carrying properties like a name, a vertical, a funding stage and an outreach status; an edge is a named, directed relationship such as backed_by, carrying its own properties — the round, the announced date, the source of the claim. Edge properties are a property-graph feature; an RDF triple store needs reification for the same thing. The second is the traversal that justifies the store. Start at a company where a reply already landed, walk backed_by to its investor, walk the same edge type in reverse to a second company in that investor's portfolio that has never been approached, then walk employs to the person to contact there. One statement in Cypher, against a join per hop written by hand in a relational store. Every edge is parsed from a record or a research note, never inferred, because a fabricated shared investor sends a cold approach down a warm path that isn't there.](/blog/agent-graph-anatomy.svg)

A table manages the first hop comfortably — list the investors in a given
company. The second hop is where it turns awkward, and the second hop is the
entire value. An untouched target connected through a shared backer to a
conversation already in progress is a warm approach rather than a cold one, and
that reframes a long backlog as a ranked shortlist. So companies, people and
investors live in an embedded graph database, queried in a graph query
language, where that traversal is a single statement.

The reason to check this rather than assume it is that the failure mode of asking
an embedding index a relationship question isn't an empty result. I built a
separate public project to make that concrete, on a synthetic matchmaking network
where the facts worth having are all chains: a match, a timed handoff, a trust
event, a replacement. Asked why one person's handoff with one specific
counterparty went quiet, the vector path did the only thing it can. It embedded
the question and returned the profiles that read most similarly. None of them
belonged to the counterparty in the question. Nothing errored, no score
collapsed, and nothing in the output said the real answer needed a specific set of
edges walked instead. The graph path walked them and returned the expired
deadline, the trust movement, and the replacement that followed.

The same model narrated both. The difference was entirely in which facts it was
handed — which is the argument of this whole post in one experiment: retrieval
architecture, not model choice, decides whether "why" questions are answerable at
all.

Every edge comes from deterministic extraction — parsed fields and written
research notes, never inference. That's a correctness requirement rather than a
shortcut. A fabricated shared investor routes outreach down a warm-intro path
that doesn't exist, and a warm approach that turns out to be cold is worse than
no suggestion at all.

That's a real divergence from how graph retrieval is often built. Microsoft's
GraphRAG names the same limitation in ordinary vector retrieval — it "struggles to
connect the dots" across facts linked only by a shared attribute — and then builds
its graph by having a model read the corpus and extract the entities and
relationships it finds. That's the right trade when the relationships exist only
in prose and no structured record of them exists. It's the wrong trade here,
because a structured record already exists and the cost of a wrong edge is
asymmetric. A hallucinated shared investor doesn't degrade an answer slightly. It
manufactures a warm introduction that was never there.

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

## Picking the representation is the retrieval decision

The three stores have been described one at a time, which understates the
interesting part. The routing layer's job isn't to pick a favourite. It's to read
the shape of a question and send it where that shape is cheap.

| Question | Where it goes | Because |
| --- | --- | --- |
| "How many candidates reached a final round?" | The table store | A grouped count over rows; no passage contains the answer |
| "Why did that engagement end?" | The embedding index | A reason recorded in prose, which no column holds |
| "Which untouched company shares an investor with one that replied?" | The graph | Two hops, where a table needs a join per hop |
| "Is this company worth approaching, and through whom?" | All three | It decomposes into a count, a proof point, and a traversal |

The fourth row is the one that matters architecturally, because it's the common
case for anything worth calling an agent. A question that decomposes doesn't want
a router that picks one store. It wants the sub-questions dispatched separately,
the results assembled, and each fact labelled with where it came from before any
of it reaches a model.

![A single question arrives that no one store answers on its own: is this company worth approaching, and through whom. Before anything is searched, it splits into three sub-questions, because each is a different shape of answer. Which of my own proof points speaks to their problem goes to the meaning-search index. How many companies at this stage have replied before goes to DuckDB. Who do I already know one hop from this company goes to Kuzu. The three result sets meet in a fusion step that de-duplicates them, tags each fact with the store that produced it, and applies the sensitivity and provenance filters as a mask before ranking rather than as a pass afterwards. Only then does a model run, on the fused context, doing reasoning and synthesis rather than search. The output is a draft in a plain text file that a person sends themselves. Three retrievals, none of them metered, and one model call on a fraction of the context.](/blog/retrieval-fanout.svg)

The word "fusion" covers two different operations, and conflating them is how
this step gets built wrong. Combining two ranked lists over the *same* corpus is
rank fusion in the technical sense, and the arithmetic above applies: shared rank
positions, one relevance scale, a defensible combined order. That's what happens
here between the keyword and dense rankers over the same passages.

Combining a count from a table, a passage from an index, and a path from a graph
is not that. There's no shared relevance scale between a number and a paragraph,
and no meaningful way to rank one against the other. What that step actually does
is assemble and label: keep every fact, record which store produced it, and hand
the model a context where the provenance of each claim is explicit. Calling it
fusion is fine. Implementing it as though the three results were comparable
scores is not.

Each store is also weakest at what another is best at, and the graph is the
clearest case. Asked how many candidates reached a final round, it would have to
walk every matching path and count what it landed on — a grouped count performed
the expensive way, over a structure built for depth rather than breadth. That's
the same question the table store answers in one statement. Neither of them is
badly built; they're shaped for different questions.

So the three are complementary in a specific sense rather than a diplomatic one.
They aren't competing implementations with a winner pending. They're different
projections of one business reality, and the projection that makes a question
cheap is a property of the question, not of the technology.

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

**Match the store to the shape of the question, and make that choice in
infrastructure rather than in a prompt.** Writing "numbers come from the
spreadsheet, never from prose" into a model's instructions did not stop a
paraphrased rate from reaching a draft. A rule-based classifier in front of the
search did, because it decides before anything is retrieved rather than hoping
afterwards. Scaled up, that same instruction is an architecture: a count belongs
in a table, a reason belongs in an index over prose, a two-hop connection belongs
in a graph, and the fix for a pipeline that's slow, expensive and mediocre is
usually a smaller, better-labelled context rather than a larger model. Exhaust
the cheap fixes to what sits inside the retrievable unit first — a document's own
title indexed alongside its passages, a smaller window to match against than the
one you return — because those cost nothing and they close most of the gap.

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

Retrieval carries two independent filter dimensions, and both are applied as a
mask before ranking rather than as a pass over the results afterwards. One is
sensitivity, which keeps private and third-party material out of the drafting
path. The other is provenance, derived from each document's own file path, which
is what separates four employers' near-identical policies. Filtering before the
cutoff rather than after is the detail worth copying: filter afterwards and an
excluded passage still consumes one of the slots you asked for, so a query for
five results quietly returns four.

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

The through-line, if there's one worth keeping past the job search: none of this
was a choice between a table, an index and a graph. It was the same business
reality written down three times, in three shapes, because the shape that makes a
question cheap belongs to the question rather than to the technology. Structured
facts stay structured. Prose stays searchable by meaning. Relationships become
something you can walk. A router picks, only the relevant slice travels, and the
model is left doing the part it's genuinely best at — reasoning over a small,
well-labelled context. What that buys is unusual in moving four ways at once: less
context, lower latency, a smaller bill, and better answers, because the passage
that mattered is no longer competing with the corpus it arrived in.

## References

**Papers**

- Cormack, Clarke and Büttcher, *Reciprocal Rank Fusion outperforms Condorcet and
  individual Rank Learning Methods*, SIGIR '09 — the source of the fusion
  arithmetic used here, including the constant of sixty and the reason for it.
  [PDF](http://cormack.uwaterloo.ca/cormacksigir09-rrf.pdf)
- Liu, Lin, Hewitt, Paranjape, Bevilacqua, Petroni and Liang, *Lost in the Middle:
  How Language Models Use Long Contexts*, 2023 — the finding behind the attention
  argument above. [arXiv:2307.03172](https://arxiv.org/abs/2307.03172)

**Engineering write-ups**

- Anthropic, *Introducing Contextual Retrieval* — prepending a model-written
  situating description to each chunk before embedding, and the failure-rate
  reductions quoted above, which are theirs and not mine.
  [anthropic.com](https://www.anthropic.com/news/contextual-retrieval)
- Microsoft Research, *GraphRAG: Unlocking LLM discovery on narrative private
  data* — names the same limitation in ordinary vector retrieval, and builds its
  graph by model-driven extraction rather than deterministically.
  [microsoft.com](https://www.microsoft.com/en-us/research/blog/graphrag-unlocking-llm-discovery-on-narrative-private-data/)
