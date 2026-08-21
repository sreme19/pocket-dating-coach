---
title: Automating my job hunt outreach with an agent that finds, researches, and drafts — and leaves sending to me
date: 2026-09-03
summary: A director/VP-level job search runs on outreach nobody automates safely, because the risky part is the send. This system automates the finding, researching, and drafting end to end, and keeps the one irreversible step — actually sending a message — entirely out of its code, run by hand every time instead.
tags: [agentic-architecture, operations]
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

Strip the domain and what's left is: **an outbound pipeline where the one
irreversible action has no code path at all, and where the same research-and-
drafting logic runs on either a metered, unattended execution path or a free,
supervised one, as long as both write through the same gate.**

That generalizes well past a job search:

| Context | The irreversible action kept out of code | The free-runtime equivalent |
| --- | --- | --- |
| Sales development | Sending the outbound email or connection request | A rep pasting a drafted note from a shared queue |
| Recruiting outreach | Messaging a candidate on a professional network | A recruiter working from agent-drafted notes in an applicant tracker |
| Vendor and partner outreach | Committing to terms in a written reply | A drafted response a person reviews before sending |
| Fundraising outreach | Sending a cold note to an investor | A founder copying a drafted note from a running list |
| Customer win-back or renewal | Sending the actual retention offer | A success manager sending from a drafted, discount-capped template |
| Press and media outreach | Pitching a journalist directly | A drafted pitch a comms lead reviews before it goes out |

Three pieces transfer directly:

**Keep the irreversible action out of the code entirely, not just behind a
review step.** A review step is a person supervising a mechanism that still
exists; removing the mechanism means there's nothing left for an error, a
prompt-injection attempt, or a future refactor to accidentally trigger. The
difference only shows up the day something tries to use that path — and on
that day, "the code can't do it" beats "the code isn't supposed to do it."

**Put the human-vs-system boundary at the highest-stakes single step, not
earlier.** Gating discovery instead of the send would slow down the cheap,
recoverable part of the pipeline for no safety benefit, since a wrong
discovery costs nothing to unwind. The gate belongs exactly where getting it
wrong stops being free.

**Give the same logic two execution paths sharing one write gate, instead of
building "the cheap version" as a separate, drifting implementation.** The
free path here is cheap specifically because it's told to read the paid
path's own rules as its instructions, not a summary of them, and because both
write through identical, snapshotted, append-only functions. Two
implementations of the same judgment call will disagree eventually; one
source of truth read two different ways won't.

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

The pieces worth getting right from day one, because they're expensive to
retrofit: writing the fit verdict into the same row as the candidate rather
than a side report (moving it later means touching every consumer of that
report); choosing append-only before there's enough volume to justify
anything else (retrofitting update-in-place onto a sheet already full of
rows means writing a matching layer you didn't need to design under
pressure); and building the free runtime to read the paid runtime's rules
directly from day one, rather than hand-copying them once and letting the
copy drift.
