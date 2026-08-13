---
title: Human hand-off with an expiry that reverses
date: 2026-08-19
summary: An agent works on your behalf, then stops and hands you the result. You have 48 hours. What happens at hour 49 is the design problem — and deleting is the wrong answer.
tags: [guardrails, riteangle]
---

An agent in riteangle vets a stranger on someone's behalf. When it has what it
needs, it stops, wraps up, and hands the conversation over.

That hand-off is the most consequential moment in the product. Two people are now
waiting on one person, and one of them does not know it. So there is a deadline.

The interesting design question is not the deadline. It is what happens at hour
49.

## The clock

![A timeline. Hour zero, the agent wraps up. Hour 24, first nudge. Hour 45,
second nudge. Hour 48, expires but nothing is deleted, he gets a replacement and
she keeps a button to bring it back. Day 30, purged. A branch shows that sending
the agent back clears the wrap timestamp, which stops the
clock.](/blog/handoff-clock.svg)

Forty-eight hours, two nudges, then expiry.

Expiry marks the match expired. It does not delete it. The man is offered a
replacement so he is not left waiting on someone who has gone quiet, and she
keeps a button that brings the whole thing back. Only after thirty days is
anything actually removed.

That distinction — expired versus deleted — is the entire post.

## Why reversible

A deadline exists to protect the person on the other end. Someone was vetted,
approved and handed over; leaving him in an open-ended wait while she decides is
the actual harm.

But a deadline that destroys is a deadline that punishes the wrong person. She
was busy. She had a week. The cost of her missing a 48-hour window should be that
the thing goes quiet, not that it becomes unrecoverable.

Reversible expiry lets the deadline do its job — free him, stop the waiting —
without making a scheduling accident permanent. It costs one status value and a
retention window.

The general form: **the action that fires on a timeout should be the smallest one
that relieves the other party.** Not the largest one that tidies your database.

## One clock, one source

The nudges and the expiry are driven by a scheduled job. The agent also talks
about the deadline — it tells him someone will get back to him, and how soon.

Those two things read the same constant.

That sounds obvious. It was not, and there was an incident. Earlier the agent
described the timeline in its own words, generated fresh each time, while the job
enforced a different number. It told a man something that was not true, in a
context where he had no way to check.

An agent that talks about a deadline must read the same value that enforces it.
Any time a model describes a system rule in words, that rule needs one definition
that both the prose and the enforcement come from — otherwise the model is
paraphrasing a policy it cannot see.

## Suspending the clock without a pause flag

She can send the agent back with her own questions rather than taking over. Two
rounds maximum, ever, and he is told plainly when it is the last one.

Doing that clears the wrap timestamp. And because the countdown is calculated
*from* that timestamp, clearing it is what suspends the clock. There is no
separate paused flag.

This is a small thing that prevents a whole class of bug. Two pieces of state
that both describe whether a clock is running will eventually disagree, usually
during a race, usually in a way nobody notices until a user is nudged about
something that already ended. Deriving the state from the timestamp means there
is nothing to keep in sync.

## Who is allowed to speak

![Four states. Agent active: it speaks for her. She types, and the agent switches
off in one guarded transition with a banner on both sides. Wrapped: only she can
act, countdown running. Expired: nobody can act, but the record survives and she
can bring it back.](/blog/handoff-states.svg)

The moment she types her own message, the agent is switched off.

That happens as a single guarded transition. It can only fire once, so two
messages arriving together cannot both flip it. From then on, both people see a
banner telling them they are talking directly.

Being explicit about this matters more than the mechanism. He is told from the
first message that he is talking to her agent. He is told again when he is not.
A person's willingness to accept an agent in the middle depends entirely on never
being confused about which one he is speaking to.

## Two gates before the agent may finish

The hand-off is not the agent's decision alone.

**A checklist has to be complete.** The agent builds a short list of things worth
establishing about this person, and it cannot wrap while any remain open. The
list is stored with a revision number and updated with a compare-and-set, so two
overlapping generations cannot lose an item or double-count one.

**A proof gate has to pass.** If she weights something that can be evidenced, and
he has claimed it but never evidenced it, the wrap is blocked and the turn becomes
a request for proof instead. Handing over a man whose central claim is unverified
would waste her time in a way she could not detect.

The gate degrades open. No vector data means no block. A safety check that fails
closed on missing data would stop the product working for exactly the newest
users, which is the wrong trade here.

## Where the industry is

Human-in-the-loop recurs constantly in what I saw this year, but almost always as
approval — a person signs off before the agent acts. The interesting variants
were more specific.

| Approach | Where | How it compares |
| --- | --- | --- |
| A spending threshold above which a human must approve | AWS Summit Bengaluru 2026 | A value gate on the action. Ours is a time gate on the hand-off |
| Declarative checkpoints named in the agent's own construction | DataHack Summit 2026 | The interrupt is part of the agent definition rather than the surrounding code — cleaner than ours |
| Human-in-the-loop success measured by *edit distance trending down* | MLDS 2026 | The best idea here and we do not do it. If she rewrites less over time, the agent is improving |
| An agent as a state machine with an explicit hand-to-human branch | MLDS 2026 | Same shape as ours: hand-off is a terminal state, not a fallback |
| Never delete or send without review | AWS Summit Bengaluru 2026 | We apply this to the agent. The timeout applies it to the system itself |

The measurement idea is the one I would steal. Approval gates are easy to build
and nearly impossible to evaluate — you cannot tell whether a human is approving
because the output is good or because clicking approve is faster than reading.
Edit distance is a real signal, and we have the data to compute it.

## The pattern, without the dating app

> **When an agent hands work to a human, put a deadline on the hand-off and make
> the timeout action reversible.** Mark the state, relieve the waiting party,
> preserve the record, and offer a way back. Derive the countdown from a single
> timestamp rather than a separate flag. Let the same constant drive both the
> enforcement and anything the agent says about it.

| Setting | The hand-off | What should expire, not delete |
| --- | --- | --- |
| **Clinical triage** | A flagged case queued for a clinician | The flag ages out of the active queue; the case and its reasoning stay |
| **Fraud review** | A held transaction awaiting an analyst | The hold releases on a default action; the case record survives for audit |
| **Content moderation** | A borderline item queued for review | The item takes the default disposition; the queue entry stays reversible |
| **Recruiting** | A shortlisted candidate awaiting a hiring manager | The candidate is told and released; the shortlist entry can be restored |
| **Procurement** | A quote awaiting approval | The quote lapses and the supplier is informed; the approval trail persists |
| **IT service management** | An escalation awaiting an owner | It re-routes; the original assignment history remains |

Three transferable pieces:

**The timeout must relieve the third party.** In every row above there is someone
waiting who is not the person who missed the deadline. Design the timeout action
around them, not around queue hygiene.

**Separate expiry from deletion, always.** They are different operations with
different reversibility and different retention needs. Collapsing them makes a
missed deadline permanent, which turns a scheduling problem into a data-loss
problem.

**One definition per rule.** If an agent describes a policy in prose, the prose
and the enforcement must read the same value. This is the single cheapest way to
stop an agent confidently misdescribing your own system to a user.

## What we still owe

Two things.

**We do not measure whether the hand-off is any good.** We know the expiry rate.
We do not know whether the material she receives is worth 48 hours of a stranger's
patience. Edit distance would tell us, and it is computable from data we already
store.

**The nudges are the same each time.** Twenty-four hours and forty-five hours,
same tone, regardless of whether she has opened the thread, read it, or started
typing and stopped. A nudge that ignores what the person already did is a
notification, not a reminder.

## References

Most sessions have no published recording. Where one exists it is linked.

| Source | Event | Recording |
| --- | --- | --- |
| Responsible AI for agents: approval thresholds, no delete or send without review | [AWS Summit Bengaluru 2026](https://aws.amazon.com/events/summits/bengaluru/), Apr 2026 | Not published |
| Declarative approval checkpoints in an agent's construction | [DataHack Summit 2026](https://www.analyticsvidhya.com/datahacksummit/), Aug 2026 | Not published |
| Building trust in an agent when stakes get real; edit distance as an HITL metric | [MLDS 2026](https://mlds.analyticsindiamag.com/), Mar 2026 | Not published |
| Agent as a state machine with an explicit hand-to-human branch | [MLDS 2026](https://mlds.analyticsindiamag.com/), Mar 2026 | Not published |
| Production failure modes in enterprise compliance agents | [DataHack Summit 2026](https://www.analyticsvidhya.com/datahacksummit/), Aug 2026 | Not published |
| Full hall recordings across three days | [CYPHER 2025](https://cypher.analyticsindiamag.com/), Sept 2025 | [Day 2, Hall 3](https://www.youtube.com/watch?v=uOqflHyRxcs) |

*Fifth of nine posts on riteangle's architecture. Previous:
[context assembly as a first-class subsystem](/blog/context-assembly-as-a-first-class-subsystem).
Next: the places where plain code overrules the model, and the incident behind
each one.*
