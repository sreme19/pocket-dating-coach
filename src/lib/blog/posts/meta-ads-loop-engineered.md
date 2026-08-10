---
title: Meta ads, loop engineered
date: 2026-08-10
summary: Half the button presses were never reaching Meta, and the screen that would have fixed it was greyed out. The way through was an error message that refused the right thing for the wrong reason.
tags: [advertising, riteangle]
---

I run ads on Instagram and Facebook for a dating app. The measurement was
reporting roughly half of what happened, and the switch that would have fixed it
was disabled — with a tooltip explaining that I did not have permission to press
it.

This is the companion to
[the Snapchat one](https://sree.riteangle.dating/snapchat-advertising-loop-engineered).
Same app, same landing page, same four systems that cannot see each other. A
different set of things went wrong, and one of them was interesting enough to be
worth the whole post.

## What has to travel, and where it stops

```text
   Instagram / FB       our landing page          Google Play         the app
   ──────────────       ────────────────          ───────────         ───────
   shows the ad    ──►  somebody arrived   ──►    listing page   ──►  install
   charges a click      somebody tapped                               signup
```

Four systems. None can see the next one. Meta stops knowing anything the moment
its in-app browser opens my page. My page stops knowing anything the moment the
browser leaves for Google. Google knows about an install and nothing about the
advert that caused it.

## Half the presses were going missing

Meta's reporting said six people had pressed the button. My own server said
fourteen. Both were counting the same button on the same page over the same days.

The reason is timing. Meta's measurement lives in the browser, and it does not
send events immediately — it collects them and posts them about a second later.
Every button on that page opens the Play Store. So the page is often destroyed,
along with everything it was holding, before the second is up. Arrivals survive
because people sit still on a page for longer than a second. Button presses do
not.

Ad blockers take a further share, and this traffic arrives through the Instagram
and Facebook in-app browsers, which are their own peculiar environment.

The fix is to report the press from my server instead, where nothing is being
torn down and no blocker can reach:

```text
   FROM THE BROWSER                      FROM THE SERVER
   ───────────────                       ───────────────
   press at 6ms                          press recorded on my machine
   send queued for ~1s                   posted directly to Meta
   page destroyed at ~200ms              nothing is being destroyed
   → event never sent                    → event always sent
```

Both are sent, sharing one random reference, so Meta collapses the pair into a
single press rather than counting it twice.

## The locked door

Sending from the server needs a credential, and Meta has a screen for producing
one. The button was not merely disabled — it was not a button at all. Just grey
text with a note: **you must be an admin of this business portfolio.**

The reason took a while to see. An advertising account can sit on its own, or it
can sit inside a "business portfolio". Mine sits on its own. The permission the
screen wants only exists inside a portfolio. So there was no version of me that
could satisfy it.

The documented fix is to move the advertising account permanently into a
portfolio. That is irreversible, and it moves the billing arrangement with it. To
unlock a measurement improvement on a campaign spending a test budget, that is
the wrong trade — the sort of decision you should make deliberately when it
matters, not because a setup guide put a red banner in front of you.

## The door was on the screen, not on the building

Here is the part worth keeping.

The setup **screen** refused. The **interface behind it** was never asked.

A credential generated through Meta's developer tool — the thing engineers use to
try requests by hand — posted an event successfully. Same account, same
measurement, same person, no ownership moved.

The way we found out was an error message:

```text
   ATTEMPT 1 — deliberately incomplete event

   "You haven't added sufficient customer information
    parameter data for this event"

   ATTEMPT 2 — same credential, complete event

   "events_received: 1"
```

That first rejection is the useful one. It complains about **what was in the
event**. To complain about the contents, Meta had to have already accepted the
credential, found the right account, and checked that I was allowed to write to
it. A permission failure would have stopped before it ever looked inside.

So a refusal is not one thing. Read *which layer* refused. A complaint about your
contents is a confirmation of your access, wearing a discouraging face.

## What "sufficient information" turned out to mean

That first error is also a warning about quality. Meta will reject an event
outright if it carries nothing to identify who it belongs to, and it says so
plainly: a combination broad enough to be useless is treated as no information at
all.

We were sending browser type and network address. Accepted — but sitting just
above the floor. An event Meta accepts and then quietly discounts is the
expensive kind of working, because it appears in every count and changes no
decision.

Two better identifiers were already sitting on the page, unused:

| What | Where it comes from | Why it matters |
| ---- | ------------------- | -------------- |
| The click reference | Meta adds it to the address of every ad click | Identifies the click itself, rather than guessing at a person from their device |
| The browser reference | A cookie Meta's own code sets on arrival | Ties the server's report to the visit Meta already knows about |

Neither is new personal information. Both are Meta's own labels, created by Meta,
read off a page Meta sent the visitor to, and handed back to Meta. No email, no
phone number, and the deliberate decision never to store visitors' network
addresses is untouched.

One detail that took care: the click reference embeds *when the click was seen*.
Read it at the moment of the button press and you stamp the wrong time. It has to
be captured on arrival and remembered until it is needed.

## Stage by stage

| Stage | What actually happens | How often |
| ----- | --------------------- | --------- |
| 1 · What we saw | On arrival, the page tells my server. On the button press, it tells my server again. Both notes share one random session reference, so a press ties back to the arrival that produced it. The visitor's country comes from the network edge, which has already worked it out; their address is never stored. | continuously |
| 2 · What Meta is told | My server reports the press to Meta directly, carrying the two identifiers above. | every press |
| 3 · What we paid | Read out of Meta's own reporting, one day at a time. **Not yet running** — see below. | — |
| 4 · Tell somebody | A daily email that only arrives when something is wrong. A weekly email that says what to do about it. A page I can open whenever. | daily, weekly, on demand |
| 5 · Decide | Campaigns that cross agreed lines get flagged — worth more money, worth stopping, worth a look. | weekly |
| 6 · Change the ads | Me, by hand, in Meta's ad tool. | weekly |

## The rule that would have told me to stop everything

The weekly report flags a campaign for stopping if it brought a hundred visits
and produced no members.

Nobody has been traced to a campaign yet — the piece that carries an advert's
identity through an app install only started shipping this week. So *every*
campaign currently shows no members. Left alone, that rule would have
confidently recommended stopping all of them, including whichever one is
working.

So the flags check first whether the underlying number is a real zero or an
absent one, and stay silent when it is absent. The report says the column is
empty and why, instead of letting emptiness pass as a finding.

Structurally-empty and genuinely-zero look identical in a table and mean opposite
things. Every report I trust has to be able to tell me which one it is looking
at.

## What is safe to share

Worth being explicit, since this is a public post about a live advertising
account.

| Shared here | Held back | Reasoning |
| ----------- | --------- | --------- |
| How the mechanism works, end to end | Account, business and application reference numbers | The mechanism is the useful part and copying it costs me nothing. The reference numbers identify one account and teach nobody anything. |
| Ratios — half the presses missing, six versus fourteen | Absolute spend, daily budgets | Ratios carry the lesson. Spend is commercially my own business, and the argument does not need it. |
| That one campaign aims at one Indian city | Which city, which age range, which audience | Targeting is the part a competitor could actually use. |
| The shape of every error we hit | Any credential, ever | Obvious, but worth saying: Meta's debugging tool puts the credential in the page address, which means it lands in browser history and travels in referrer headers. A screenshot of that screen is a leak. |

The rule of thumb I ended up with: **publish the shape of the mechanism, never
the coordinates of the account.** Everything above is reproducible by someone
with their own account and useless to someone aiming at mine.

## The half that is still open

Two things remain, and they are the same two as on Snapchat.

```text
   WHAT I NOW KNOW                 WHAT META IS CURRENTLY TOLD
   ───────────────                 ───────────────────────────
   arrivals, presses,              hears: "a button was pressed"
   country, placement                     ↓
        ↓                          set to chase: page visits
   weekly decision                        ↓
        ↓                          buys the cheapest visits available
   I change the adverts
```

Meta never learns which campaign produced a *member*. It hears that a button was
pressed, and the campaigns are set to chase page visits — the cheapest and least
valuable event in the chain. So each week I reach a better conclusion than Meta's
own machinery can act on, and its machinery is what spends the money in between
my decisions.

There is a trap here I nearly walked into. The obvious move is to switch the
campaigns to chase members instead. But Meta needs something like fifty examples
a week before it can learn a pattern, and this button gets pressed a handful of
times a month. Switching now would leave it guessing indefinitely and delivering
worse than before. Feed it properly first, then switch when the number justifies
it.

The second gap is spend. Reading what I paid, per campaign, per day, is the one
thing that genuinely does need the ownership move. Which makes it a real decision
rather than a chore — and one worth taking when Meta is spending enough to be
worth the paperwork.

## The mistake I made, twice

I twice told my collaborators that a piece of code was not live in production. It
was live both times.

I was checking by fetching the published page and searching the files it loads.
The search worked. The *walk* did not: it followed one style of internal
reference and silently ignored another, so it was searching three files out of a
hundred and twelve and reporting a confident absence.

What caught it was searching for something I already knew was there. It came back
empty too, which meant the instrument was broken rather than the thing being
measured. Thirty seconds, and it should have been the first thing I did rather
than the third — I had spent the gap suspecting a deployment tool and a config
file, both of which turned out to be innocent.

A negative result is a claim about the world *and* a claim about your instrument.
Test the instrument on a case with a known answer before you believe the
interesting one.

That, more than any of the plumbing, is the thing I would want to carry into the
next of these.
