---
title: Forward-deployed engineering under five job titles, and the handoff test that decides if it worked
date: 2026-09-02
summary: A company that embeds an engineer inside one operation is buying a specific kind of work, and almost never writes down the part that decides whether it paid off. I did that work under five different titles before I had a name for it. Here is the defect that showed up in every one of them, and the test I never once wrote into a handover document.
tags: [operations]
cover: /og/blog/forward-deployed-engineering-under-five-job-titles.png
---

The week I left one role, the allocation weights lived in a spreadsheet three
people could read, the capability matrix was current to the month, and two
people who were not me could explain either one without calling. None of that
was in my job description. It was also the only part of four years there that
I would now call load-bearing.

I have since read a fair amount about forward-deployed engineering — the
practice of putting an engineer inside a customer's or a business unit's
actual operation, building the specific thing that operation needs, judged on
whether that operation's number moves rather than on a sprint velocity chart.
The term is recent and mostly associated with one company. The work is not
recent. I did it for years under titles like Ops Manager, GM, and Data &
Analytics lead, and none of those titles ever specified the part of the job
that turned out to matter most.

## What the title never had to say

Every one of those roles asked for the same three things, stated or not.

Build something specific to one operation's constraints, not a general
platform — a revenue-allocation system tuned to one company's buyer mix, a
capability instrument tuned to one team's actual failure modes, a training
programme built out of one function's real incidents rather than a generic
curriculum. Generic tooling exists precisely because most problems don't need
this. The ones that do are the ones nobody else will go and sit inside long
enough to see clearly.

Be judged on the operation's outcome, not on your own output. A pipeline
shipped and unused is a failure by this standard, however clean the code. I
have written about a [routing system](https://sree.riteangle.dating/routing-decisions-without-a-model-in-the-loop)
I built this way, and a [training curriculum](https://sree.riteangle.dating/the-curriculum-was-the-incident-log)
built the same way — both judged, correctly, by what changed in the operation
afterward rather than by what I produced.

And the part nobody wrote down anywhere: plan your own removal from the
system while you are still the one holding it together. Every engagement like
this ends. The engineer leaves, gets promoted past the work, or the operation
matures past needing someone embedded. The job was never just building the
system. It was building a system that survives the day you stop being in the
room, and that requirement was never in any document I was handed.

## The exit was never in the brief

I have two examples of getting this specific part wrong, in two different
engagements, and they failed the same way.

I once wrote a [cost plan that proposed removing my own governance
seat](https://sree.riteangle.dating/governance-stopped-paying-for-itself),
on the correct observation that the seat was consuming more of the
organisation's throughput than it returned. I asked for a two-month ramp-down
and advisory support after. What I did not do — what nobody asked me to do —
was verify, after leaving, whether the capacity I had argued for actually
materialised, or whether the governance the seat had quietly been providing
simply moved onto the two most senior people left standing. I wrote at the
time that removing a governance layer does not delete governance, it
redistributes it. I did not go back and check where.

Separately, I was given four weeks to move a revenue-operations function's
[knowledge out of one person's head and into a team's](https://sree.riteangle.dating/the-curriculum-was-the-incident-log).
The stated target was to get the team to roughly 70% of that person's
capability. There is no instrument that reads 70% of a person, and I built
the training programme against that target anyway, then left within months of
running it. Both cases have the identical shape: a confident claim about
transfer, and no mechanism that would tell you, afterward, whether the
transfer actually held.

## The same defect, aimed at a person instead of a spreadsheet

I have written about one specific failure four separate times without
noticing, until recently, that it was one failure. A routing system whose
[weights lived in a hand-maintained spreadsheet with no change history](https://sree.riteangle.dating/routing-decisions-without-a-model-in-the-loop).
A productivity framework whose entire fairness correction was [three names in
a paragraph](https://sree.riteangle.dating/enforcement-was-version-one), with
no record of who added a name or when. A [capability matrix](https://sree.riteangle.dating/the-same-grid-three-kinds-of-evidence)
with no column recording who scored a cell or on what evidence. Three
systems, one shared cause: consequential state was sitting in a document, or
a channel, or a person's memory, with no history attached to it.

Forward-deployed work has its own version of that exact defect, and it is the
engineer. For as long as the engagement runs, you are the highest-resolution
record of why the system is built the way it is — which tradeoffs were
deliberate, which constraints were real and which were assumed, which parts
are provisional. None of that is written down anywhere else, for the same
reason the buyer weights weren't: writing it down is unglamorous, the system
works fine without it right up until the day it doesn't, and there is always
something more urgent to build. You are the unversioned spreadsheet. The
failure mode is identical — a decision nobody can reconstruct once the one
person who remembers it is gone — and I did not recognise it as the same
problem until I had written about it three times in other people's systems.

## The one case where I didn't have to be the fix

There is a version of this that worked, and it is worth being precise about
why, because the reason is uncomfortable: the pressure was commercial, not
personal discipline.

The routing system went through three versions, each one removing state that
had been sitting somewhere unauditable — a spreadsheet of hand-set weights,
then a single picker with the same weights, then a solved distribution
computed from realised revenue rather than anyone's judgment. Nothing about
that evolution depended on me remembering to write documentation. It
happened because a wrong routing decision cost money within the week, and
that pressure fell on the system whether or not I was paying attention to it.

Nothing in a training programme or a capability matrix produces that pressure
on its own. If the system degrades quietly back into tribal knowledge, the
operation mostly does not find out until the person carrying the knowledge is
already gone — which is later than the week a bad routing decision would have
surfaced, and by then there is no one left to ask what changed. Where the
commercial cost of hidden state is immediate, the system disciplines itself.
Where it is not, discipline has to be imposed, and forward-deployed work is
almost always in the second category. That is the actual argument for writing
things down as you build them rather than at the end: you are supplying, by
hand, the pressure that a routing system got for free.

## The handoff test

I would run four checks now, before calling any embedded engagement finished,
none of which I consistently ran at the time.

**Can someone who is not you run the system for one full operating cycle
without you in the room?** Not "could explain it to me" — actually run it,
unassisted, through whatever cadence the operation runs on. A capability
matrix updated after projects rather than annually has a cycle length. A
training curriculum built from an incident log has one too.

**Is the reasoning behind a decision recoverable from something other than
your memory?** Not the decision itself — the reasoning. A spreadsheet that
shows the current weights but not why they changed fails this. So does a
target with no written record of who set it or against what evidence.

**Is there a named owner, not you, holding the same information you hold?**
Not a stakeholder who signs off. Someone who could be asked the hard question
about the system next quarter and answer it from what they actually know,
not from a document they would have to go and reread.

**Would the thing keep improving after you leave, or only keep running?**
A system that survives without degrading is a floor. One that a team can
still move forward without you is a different and higher bar, and it is the
one that tells you whether you transferred capability or just automated
your own absence.

I passed the first check most of the time. I do not think I passed the
fourth one even once, and I never designed for it — I designed for the
system to survive, not for the team to be able to extend it.

## What I never measured

| Question | Status |
| --- | --- |
| Did the capacity freed by removing the governance seat materialise? | **Unmeasured.** I left before there was a way to check. |
| Did the training programme reach any defined threshold of transfer? | **Unfalsifiable as specified** — there was no instrument for "70% of a person." |
| Did any handoff still hold six months after I left? | **Unknown for all of them.** I have no engagement where I checked back. |
| Was the reasoning behind a decision recoverable without me, in any of these systems, at the time I left? | **Not verified.** I assumed it was legible because I had explained it once, in a meeting, to someone who has since also left. |

Every one of those is answerable in principle — a follow-up conversation, a
check-in six months out, a document with a named owner who confirms they
still use it. None of them require an instrument I did not already have. The
reason none of them exist is the same reason the buyer-weight spreadsheet had
no change log: nothing forced the check, and there was always the next
engagement to start.

## What I would tell someone about to do this work

If you are the engineer: your output is not the system. It is the system's
survival past the date you stop being reachable, and that has to be
designed in from the first week, not assembled at the end from whatever
notes you happened to leave behind. Write the reasoning down when you make
the decision, not when someone asks for a handover document — by the time
someone asks, you have usually already forgotten the constraint that made a
choice look obviously correct at the time.

If you are the one staffing this function: put an expiry and a named
successor into the engagement on day one, the way I should have put one into
my own governance seat instead of writing the removal plan only once the cost
target forced the question. An embedded engineer with no negotiated exit
becomes exactly the single point of failure the role exists to eliminate
everywhere else. And run the check-in six months after the person leaves,
even though — especially though — nobody is asking for it by then. That is
the only version of this test that has a chance of catching what I never
went back to look for.
