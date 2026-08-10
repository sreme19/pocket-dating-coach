---
title: Snapchat advertising, loop engineered
date: 2026-08-10
summary: A dashboard tells you what happened. A loop makes the next decision better than the last one. Here is the whole arrangement for one ad account, including the half of it that is still open.
tags: [advertising, riteangle]
---

I run ads on Snapchat for a dating app. For a while I had numbers, and the
numbers were wrong in ways that looked fine.

The fix was not a better dashboard. It was arranging things so that every week
produces a decision, the decision changes something real, and the effect of that
change comes back round without anyone rebuilding the analysis by hand. That is
all I mean by a loop.

This is the third of these. The
[first](https://sree.riteangle.dating/what-it-takes-to-measure-one-tap)
describes the plumbing that records a single button press. The
[second](https://sree.riteangle.dating/zero-is-not-a-measurement) is a day spent
on a number that read zero for three separate reasons. This one is the machine
those two turned into.

## What has to travel, and where it stops

```text
   Snapchat            our landing page          Google Play         the app
   ────────            ────────────────          ───────────         ───────
   shows the ad   ──►  somebody arrived    ──►   listing page   ──►  install
   charges a click     somebody tapped                               signup
```

Four systems, and none of them can see the next one. Snapchat stops knowing
anything the moment its browser opens my page. My page stops knowing anything
the moment the browser leaves for Google. Google knows about an install and
nothing about the ad that caused it.

Nothing follows a person across those lines — no cookie, no login, nothing. So
each boundary needs its own arrangement, and the loop is what holds them
together.

## The loop

```text
        ┌──────────────────┐                    ┌──────────────────┐
        │  1  WHAT WE SAW  │                    │  2  WHAT WE PAID │
        │                  │                    │                  │
        │  arrivals        │                    │  spend per       │
        │  button taps     │                    │  audience, daily │
        │  country         │                    │  from Snapchat   │
        └────────┬─────────┘                    └────────┬─────────┘
                 │                                       │
                 └───────────────┬───────────────────────┘
                                 ▼
                     ┌───────────────────────┐
                     │  3  PUT TOGETHER      │
                     │                       │
                     │  throw out the robots │
                     │  match money to       │
                     │  the traffic it       │
                     │  actually bought      │
                     └───────────┬───────────┘
                                 ▼
                     ┌───────────────────────┐
                     │  4  TELL SOMEBODY     │
                     │                       │
                     │  daily: is it broken? │
                     │  weekly: what now?    │
                     └───────────┬───────────┘
                                 ▼
                     ┌───────────────────────┐
                     │  5  DECIDE            │
                     │                       │
                     │  scale · pause ·      │
                     │  investigate          │
                     └───────────┬───────────┘
                                 ▼
                     ┌───────────────────────┐
                     │  6  CHANGE THE ADS    │
                     └───────────┬───────────┘
                                 │
                                 │  and the change shows up
                                 └──────────────────► back to 1
```

Six stages. The last arrow is the only thing that makes it a loop rather than a
report: a change made on Monday is visible in the following Monday's numbers
without anybody doing arithmetic again.

## Stage by stage

| Stage | What actually happens | How often |
| ----- | --------------------- | --------- |
| 1 · What we saw | When somebody lands on the page, the page sends a short note to my own server saying so. When they press the button, it sends a second note. Both notes carry the same random session number, so a press can be tied to the arrival that produced it. The visitor's country comes from the network edge, which has already worked it out; their address is never stored. | continuously |
| 2 · What we paid | I read spend out of Snapchat's own reporting, broken down by audience, one day at a time, using Snapchat's idea of where a day starts rather than mine. | every hour, always re-reading the last seven days |
| 3 · Put together | Robot traffic is set aside. Money is matched to the traffic it paid for. | every time anything is read |
| 4 · Tell somebody | A daily email that only arrives when something is wrong. A weekly email that says what to do about it. A page I can open whenever. | daily, weekly, on demand |
| 5 · Decide | Audiences that cross agreed lines get flagged — worth more money, worth stopping, worth a look. | weekly |
| 6 · Change the ads | Me, by hand, in Snapchat's ad tool. | weekly |

Nothing here is clever. What makes it work is that each stage is wrong in a way
the next stage can catch.

## Why the last seven days get read again every hour

Snapchat does not finish counting a day when the day ends. It settles about two
days later. So the spend figure for yesterday is not yesterday's real spend.

If I read each day once and kept it, every day in my records would be frozen at
whatever it happened to be within an hour of it happening — which is exactly
when it is least finished. Reading the last week again every hour means the
numbers walk toward the truth instead of away from it.

This is the sort of thing that produces no error and no complaint. It just
quietly makes last week slightly wrong forever.

## Three quiet ways the numbers lied

None of these announced themselves. Each was found by checking something that
looked fine.

| What looked fine | What was actually happening |
| ---------------- | --------------------------- |
| A healthy count of page visits | Six in ten "visitors" were Snapchat's own review system, which fetches the page every time I edit an advert. It arrives in bursts of a dozen in a few seconds, from a desktop computer in another country, on adverts aimed only at India. It inflated visits without inflating button presses, so every rate looked worse than it was — and worst for whichever advert I had most recently touched, which is always the one I am trying to judge. |
| A spend total that added up | I changed how finely spend was recorded, from campaign level to audience level. The new rows did not replace the old ones; they sat next to them. Every rupee was counted twice. The total looked entirely plausible. |
| Money and traffic in the same table | They could not be matched. Snapchat's spend records identify an audience by a code. The adverts were labelling traffic with the audience's *name*. Same thing, no shared handle — so spend sat on one row and the visits it bought sat on another, and the cost of anything was uncomputable. |

The pattern in all three: the system was not broken, it was confidently
answering a slightly different question. That is the failure mode worth building
against, because nothing alerts you to it.

## What it refuses to say

This is the part I would defend hardest if somebody wanted to tidy it up.

| Rule | Why |
| ---- | --- |
| No percentage below thirty observations | Two adverts with four visitors each will differ by 50% for no reason. Showing that invites a decision the data cannot support. Under thirty, it prints the count and nothing else. |
| Robot traffic is set aside, never deleted, and the count is shown | A filter nobody can see is a filter that eventually removes something real without anyone noticing. |
| Missing is never drawn as zero | An audience with no spend recorded and an audience that spent nothing look identical on a chart and mean opposite things. |
| No cost-per-signup flag until signups can actually be traced | Otherwise the weekly email invents a recommendation out of a number it cannot compute. That gate lifts itself when the first traced signup arrives. |
| The daily email stays silent when everything is fine | A daily all-clear becomes invisible within a week, and takes the one that matters with it. |

A weekly email is only worth acting on if you trust it not to guess. Every rule
above costs information and buys that.

## The half that is still open

Here is the honest limit, and it is a big one.

There are really two loops. The one above is mine: I look, I decide, I change
something. The other belongs to Snapchat, which decides thousands of times a day
who sees the advert, and it runs on whatever I tell it.

```text
   MY LOOP  (working)          SNAPCHAT'S LOOP  (almost no input)
   ─────────────────────       ─────────────────────────────────
   spend + visits + taps       hears only: "a button was pressed"
        ↓                            ↓
   weekly decision             optimises for: page visits
        ↓                            ↓
   I change the adverts        buys the cheapest visits it can find
```

Snapchat never learns which audience produced a *member*. It only hears that a
button was pressed, and the adverts are currently set to chase page visits —
the cheapest and least valuable thing in the whole chain. So every week I get a
better answer than Snapchat's own machinery is able to act on, and its machinery
is what spends the money in between my decisions.

Closing that needs two things I have not done: send the install and the signup
back to Snapchat as events it can learn from, and register the app so Snapchat
can be asked to optimise for installs at all. Until then I am steering a system
that is being pulled somewhere else the rest of the week.

## One number I cannot explain yet

Of the clicks Snapchat charges me for, somewhere between one in eight and two in
five arrive as a page visit. The rest are billed and never show up.

That could be people changing their mind during the load, or it could be that a
swipe is a cheaper gesture than a click and means less. I do not know which, and
it sits upstream of every other number here — it is invisible unless billed
clicks and my own visit records are placed in the same row, which they now are.

That is the next thing to look at, and it is a good illustration of the point:
the loop's real output is not a report. It is a better question than the one I
started the week with.
