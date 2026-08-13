---
title: The curriculum was the incident log
date: 2026-08-16
summary: I had four weeks to move one person's operational knowledge into a team's heads. So I built the syllabus backwards out of three real incidents, organised around one question. The question mattered more than any of the content.
tags: [operations]
---

A revenue operations function was running almost entirely out of one person's
head. That is a normal situation and it is fine right up until the moment it
isn't. I had about four weeks to change it.

The obvious approach is to document what the person knows and have everyone read
it. I have watched that fail enough times to distrust it: the expert writes down
what they think is important, which is reliably not the part that is hard, and the
reader retains almost none of it because nothing is at stake while they read.

So I built the curriculum out of the failure log instead. Three incidents from the
previous couple of months became the syllabus, and everything was organised around
a single question.

## The question

> What is missing in the system that could have stopped the incident?

I want to be precise about what that question does not ask.

It does not ask who made the mistake. It does not ask what the person should have
done. Both of those are natural, both feel like accountability, and both produce
the same output: a conversation in which someone accepts responsibility, followed
by no durable change. The knowledge stays in the same head it was in before, plus
a small amount of shame.

Asking what the *system* lacked produces something you can build. Every answer is
a mechanism — a log, a check, an approval step, a report. That means the training
programme generates process improvements as a byproduct, and the trainee learns
the reasoning by participating in the diagnosis rather than by being told the
conclusion.

The reframe costs nothing and changes the entire output of the exercise. It is the
part of this design I am most confident about.

## Four levels, and only one of them is about the present

| Level | Focus |
| --- | --- |
| **Factuals** | Business-as-usual has to work reliably |
| **Risk control** | Prevent the metrics deteriorating |
| **Counterfactuals** | Handle problems that have not happened yet |
| **Optimisation & scale** | Improve beyond what the current system can do |

Nearly every training programme I have been given or inherited consists entirely
of the first tier. Here is the tool, here is the process, here is the runbook, now
do the job. That tier is necessary — the first level covered the revenue sheet and
its core metrics, reconciliation, where leads flow between departments, how to
read a campaign review — and it is not sufficient, because an operations role is
mostly not the steady state. It is the exceptions.

The second tier is about noticing deterioration: detecting revenue leakage,
keeping an operations log, tracking changes to analytics. Not "run the process"
but "notice when the process has started producing something subtly wrong."

The third and fourth tiers are the ones almost nobody trains, and they are where
the four weeks actually went.

## The SOP was the output of the exercise, not the input

Counterfactual training worked like this. Take an incident from the last month or
two. Sit the trainee down and have them simulate their response to it, live, out
loud. Then write the standard operating procedure from wherever they faltered.

That inversion is the mechanism. Normally an expert writes an SOP and a junior
person reads it, which fails because the expert cannot see which parts of their own
reasoning are non-obvious — it is all obvious to them, that is what expertise
feels like. Running the simulation first surfaces the actual gaps: the step they
did not know existed, the number they did not think to check, the person they did
not know to tell.

The documented outcome of that exercise was not "can resolve the incident." It was
that the trainee learns to handle the incident *in a leadership meeting*. Which is
a different skill and, in an operations role, often the harder one. Diagnosing a
revenue discrepancy is technical work. Standing in front of the person whose
revenue it is and explaining what happened, what it cost, what you have changed,
and what you do not yet know — under time pressure, without either
over-apologising or getting defensive — is a performance skill, and it is
completely trainable by rehearsal. It just almost never gets rehearsed.

## The target was a ratio to a person

The stated objective: get the team operating at roughly 70% of one individual's
operations-management capability within four weeks, then start expanding beyond
it.

There is something honest in that. It admits where the knowledge actually lives.
Most capability targets are written against a document or a competency framework,
which quietly pretends the knowledge is already externalised. Mine said plainly:
there is a person, everything runs through him, get to about two-thirds of him
quickly and then keep going.

It is also unfalsifiable, and I should have noticed at the time. There is no
instrument that reads 70% of a person. I had a
[capability matrix](https://sree.riteangle.dating/the-same-grid-three-kinds-of-evidence)
with written behavioural descriptors sitting right there — an instrument built for
exactly this — and I did not use it to define the target. I wrote a percentage of
a colleague instead.

Worse, it makes the dependency you are trying to eliminate into the unit of
measurement. If the person you are benchmarking against improves, the team's
score falls. If he leaves, the measurement disappears along with the reason you
built the programme.

## Every countermeasure turned out to be the same countermeasure

Here are the three incidents and what each one produced.

| Incident | What was missing | What was added |
| --- | --- | --- |
| Suspected revenue leakage | Nothing watched the gap between leads sold and revenue events | Leakage detection, plus an operations log |
| A cap change on one buyer went untracked | Requirements arrived as chat messages and vanished | A formal requirement log and structured change requests |
| Misallocation via the allocation weights sheet | The sheet had no history and no approval step | Change logging, an approval flow, an audit trail |

Read the right-hand column. Three different incidents, in three different parts of
the operation, and every single fix is a record of what changed and who changed
it.

The stated principle behind the third one was "error-proof system design," and the
instruction behind the second was blunter: *stop relying on chat messages.* The
fourth tier added a single source of truth dashboard whose stated purpose was that
anyone could see the metrics without asking a particular individual — which is the
same fix again, applied to the state held in people rather than in spreadsheets.

I have now written this finding four times without noticing it was the same
finding.

In [an allocation system](https://sree.riteangle.dating/routing-decisions-without-a-model-in-the-loop),
the routing weights lived in a hand-maintained spreadsheet, and the failure was
not the weights but that their history was unrecoverable. In
[a capability matrix](https://sree.riteangle.dating/the-same-grid-three-kinds-of-evidence),
nothing recorded which manager assigned which score. In
[a productivity framework](https://sree.riteangle.dating/enforcement-was-version-one),
the list of people exempt from the metric was three names in a paragraph with no
record of who added them. And here, three incidents whose single shared cause was
consequential state living in a channel with no history.

That is not four lessons. It is one defect that I reproduced in four systems,
which is a considerably less flattering description and I think the correct one.
The systems were different enough that I never saw the pattern. Writing them up
one after another is what made it visible, which is an argument for writing things
up.

## What I never measured

| Question | Status |
| --- | --- |
| Did the team reach 70% of the benchmark? | **Unfalsifiable as specified.** No instrument existed. |
| Did the four countermeasures get built? | **Not recorded.** They were specified as training outcomes, not tracked as deliverables. |
| Did incident frequency drop afterwards? | **Unmeasured.** No before-baseline, and I left within months. |
| Were the SOPs written during simulation ever used? | **Unknown.** |

I was the training coordinator on this programme. Cadence, evaluation and
escalation were explicitly my responsibility. So the absence of an evaluation
record is not an oversight by someone else — it is the one deliverable that had my
name on it, and it is the one that does not exist.

## What I would keep, and the one thing I would change

Keep the question. "What is missing in the system that could have stopped this" is
worth more than any framework I have built, it costs nothing, and it converts
blame into mechanisms.

Keep the inversion. Simulate first, then write the SOP from where the person
faltered. The expert cannot find those gaps by introspection.

Change the sequencing, which is the same mistake I have written about
[elsewhere](https://sree.riteangle.dating/enforcement-was-version-one). The audit
trails were outputs of the training programme — things the team would build as
they learned why they mattered. That is pedagogically elegant and operationally
backwards. Every one of those three incidents was still possible on day one of the
programme, and remained possible for as long as the training took, because the
mechanism that would have prevented it was scheduled as a lesson rather than
installed as a fix.

Build the log first. Then teach people why it is there.
