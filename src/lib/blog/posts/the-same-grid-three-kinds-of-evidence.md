---
title: The same grid, three kinds of evidence
date: 2026-08-16
summary: I used one instrument to assess my team, myself, and the market I wanted to move into. All three produced a capability grid that looked identical. Only one of them had evidence underneath it, and nothing in the presentation said which.
tags: [operations]
---

For a few years I maintained a capability matrix for the teams I ran. Roughly
thirty capabilities down one axis, people across the other, a score in each cell,
updated after projects rather than annually. I have
[written about it before](https://sree.riteangle.dating/designing-global-talent-systems)
as a risk register rather than an HR form — the question it answered was where the
system was one resignation away from losing something.

What I did not notice until I went back through the files is that I built the same
grid three times, for three different subjects. Once for my team. Once for myself.
Once for the market I was trying to move into.

All three came out looking like a capability matrix. The evidence underneath them
was wildly different, and the format gave no indication of that whatsoever.

## What the instrument actually measured

The scale ran 1 to 5, with written descriptors for each level. Paraphrasing the
top and bottom:

**5** — delivers to requirement, bug-free, without feedback from managers or
peers, more than 90% of the time.

**2** — almost every deliverable requires correction from a manager or peer, but
they get there after feedback.

**1** — cannot connect a requirement to a deliverable, and does not get there even
with feedback.

Read those again and notice what they are denominated in. Not quality. Not
knowledge. Not speed. Every level is defined by **how much of someone else's
attention the person consumes to produce acceptable work.**

That was not a design goal I set out with, and I think it is the most useful
property the instrument had. It is measuring supervision cost. Which means it is
denominated in exactly the same currency as the thing I have
[written about elsewhere](https://sree.riteangle.dating/governance-stopped-paying-for-itself)
as the real cost of a governance layer — senior calendar time spent translating
and reviewing rather than improving the system. A team of 3s and a team of 5s can
produce the same output while consuming completely different amounts of the one
resource that is genuinely scarce.

A separate five-point scale covered functional capability — planning,
prioritisation, stakeholder interfacing, coaching — with the same structure. Top
of that scale is someone who plans and executes without oversight and coaches
others. Bottom is someone who needs significant correction on most of it.

## NA is not a one

The scale had a sixth value, and it is the part I would defend hardest.

**NA** — not applicable, or not trained, or not responsible for this, or not
started.

A **1** means we asked and it did not work. **NA** means we never asked. Those are
completely different facts about a person, and there is enormous pressure to
collapse them, because a blank cell looks like missing data and a spreadsheet with
numbers in every cell looks finished.

Collapse them and you have converted "we never trained her on this" into "she
cannot do this." Then you average the column, and the person nobody invested in
scores as the person who failed. The instrument stops measuring capability and
starts measuring who got opportunities, while still looking exactly like a
capability score.

I have since written a great deal on this blog about
[the same mistake in measurement systems](https://sree.riteangle.dating/zero-is-not-a-measurement):
that a zero meaning "this did not happen" and a zero meaning "nobody was watching"
render identically, and that structurally-empty and genuinely-zero look the same
in a table and mean opposite things. I wrote that about an advertising dashboard
about a year after this spreadsheet already had the rule in it. I had solved it
once, in a context where the cost of getting it wrong was somebody's appraisal,
and then had to learn it again from scratch when the subject was a button on a
landing page.

## Words became numbers, and that was not free

One month the matrix used High / Medium / Low. The next month the same cells held
1 to 5.

The upgrade was real. You cannot subtract two Mediums. Once cells hold numbers you
can compute a delta between months, sort a column to find the thin capability, and
see whether training moved anything. The whole point of updating after projects
rather than annually is to read the change, and ordinal words make change nearly
unreadable.

What it cost is false precision. High-Medium-Low is honestly vague. A 4 sitting
next to a 3 implies those differ by a knowable, consistent amount, assessed the
same way by every manager scoring every person. They do not. The descriptors help
— they are behavioural rather than vibes — but two managers will not draw the
3-versus-4 line in the same place, and nothing in the sheet records who scored what.

I would still make the change. But the numbers were never as good as they looked,
and the spreadsheet stopped saying so the moment the words left.

## Capability is not accountability

Alongside the scores was a second, entirely separate grid: for each asset the team
owned, who was the manager, who was the lead, who was the assistant lead, and who
were the developers.

Keeping those apart matters more than it sounds. Two people can both score a 4 on
a capability and only one of them owns the thing. Conflate them and you cannot
answer the question the matrix exists for — because "three people can do this" and
"three people are responsible for this" have different implications, and only the
second one tells you what happens on a Monday when one of them resigns.

The scores tell you who *could* pick something up. The ownership grid tells you
what is actually load-bearing. You need both, in separate tables.

## The same grid, turned on myself

At some point I pointed the instrument at my own career. Six capability gaps —
platform orchestration, a cloud stack I had less depth in, model lifecycle
governance, large-scale language model systems, formalised data governance,
executive narrative — each written as gap, then action, then intended outcome.

I even set the boundary explicitly, which I still think was right: the goal was
not to become an individual contributor in any of them, but to lead teams, make
architectural decisions, and evaluate trade-offs with confidence. There is a real
difference between the depth needed to build a thing and the depth needed to tell
whether someone else's design of it is sound, and confusing those is how senior
people waste years.

Here is the part I cannot defend. **There are no scores.**

Thirty-odd capabilities assessed 1-to-5 for every person who worked for me,
monthly, against written descriptors. For myself: six prose paragraphs, no scale,
no baseline, no dated re-score. Elsewhere in the same document there is a
self-assessment that is a two-column table of ✅ excels and ❌ needs support —
which is High/Medium/Low with the middle removed, and I had already rejected that
resolution for everyone else.

The instrument I trusted enough to make compensation and retention decisions with,
I did not trust enough to point at myself in a form that could produce an
uncomfortable number.

## And turned on the market

The third version was a tech-stack mastery matrix covering data and analytics
leaders whose careers I wanted to understand: languages, ML tooling, cloud, BI,
laid out per person so I could see what the repeatedly-hired profile actually
contains. Alongside it, a folder of saved profiles of people whose positioning I
was reverse-engineering.

It was built by feeding a pile of their resumes and public profiles to a language
model and asking for the grid.

That grid's evidence is *what people chose to write about themselves in a document
whose purpose is to get them hired.* Which is a claim. It is not a proof, and the
matrix has no column distinguishing one from the other.

This is the same distinction that ended up structurally enforced in the product I
now build. riteangle scores someone on what they claim, and separately on how
corroborated that claim is, and the second number is derived only from verified
evidence — never from a model. An unproven claim contributes about a third of the
weight of a proven one. The market matrix was all claim and no corroboration, and
because it rendered as a grid of capabilities it read with the same authority as
the team matrix, which had a manager's direct observation behind every cell.

## The comparison nothing in the format shows

| | Team | Myself | Market |
| --- | --- | --- | --- |
| Who assessed it | Managers who watched the work | Me | A language model |
| Evidence underneath | Direct observation over months, hours logged | Introspection | Self-descriptions written to get hired |
| Resolution | 1–5 plus explicit NA | Prose; elsewhere a two-value table | 1–5-ish, model-assigned |
| Re-scored over time | Monthly, after projects | Never | Never |
| Decisions it supported | Retention, training, compensation | A reading list | Which roles to target |
| Should it have supported those | Yes | Not really | No |

Three grids. One format. The strongest one had a person's direct observation in
every cell and an explicit category for "we never asked." The weakest was a model
summarising strangers' marketing copy. And they look the same, which is the whole
problem — the presentation carries no signal about how much weight the numbers can
bear.

Every failure I have written about on this blog has this shape. The queued event
that produced a zero, the forgotten selector rules that produced a plausible
count, the ads with no campaign tags that produced a confident label. None of them
threw an error. They rendered in the same font as the numbers that were true.

A capability matrix is the same species of object. It renders authoritatively
regardless of whether anyone watched the work.

## What I would do differently

Two things, and neither is complicated.

**Score yourself on the same axes, or don't produce the grid.** If the instrument
is good enough to inform someone else's compensation, it is good enough to
generate a number about you that you don't enjoy. If you won't do that, the
honest conclusion is that you don't believe the instrument, and you should find
out why before you use it on anyone else.

**Put an evidence column on it.** Not a confidence score — a plain note per cell,
or at minimum per grid, saying what this rests on: observed directly, reported by
a manager, inferred from a document, generated. The team matrix effectively had
this because everyone knew a manager had watched the work. The market matrix badly
needed it and did not have it.

The instrument was good. Better than most things I built in those years, and it is
the only one I still reach for. What was missing was any record, anywhere on it, of
how much I was entitled to believe it.
