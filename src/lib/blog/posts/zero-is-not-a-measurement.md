---
title: Zero is not a measurement
date: 2026-08-09
summary: I spent a day on a conversion number that read zero. Three separate things were wrong, and not one of them raised an error.
tags: [riteangle, operations]
---

I put a small amount of money behind a Snapchat ad this week, pointed it at a
landing page with one button on it, and then went looking at what came back.
Arrivals were being counted. Button taps read zero.

Twenty-nine people had reached the page. None of them, apparently, had touched
the only button on it.

![The landing page: a headline reading “No swiping. Ever. Just matches.”, one
line of supporting copy, and a single pink button reading “Get the Android
app”.](/blog/zero-landing.png)

*The page. There is one thing to do on it.*

The obvious readings are that the page is bad or the tracking is broken. Both
turned out to be wrong, and getting to that took most of a day. Three separate
things were wrong. None of them produced an error, a warning, or a red box
anywhere. Each one produced a number that looked fine.

Here is the whole journey, with what actually survived each step.

![Six steps from ad impression to install. 6,845 impressions became 285 taps on
the ad, then 29 arrivals on the landing page, then zero recorded button taps.
Installs are visible only in the Play Console.](/blog/zero-journey.svg)

Every number above comes from a different system, and the interesting one is the
zero.

![The Google Play listing for riteangle, showing the app title, an install
button, and four phone screenshots of the app.](/blog/zero-store.png)

*The destination. Nothing on my side can see this page, which is why the tap
towards it is the last thing I can honestly measure — and why it mattered that I
was not measuring it.*

## The event that never left

The first thing I checked was whether the tracking code was wired to the button
at all. It was. I clicked the real button on the live page and watched the
event go out with the right name and the right payload. So the button worked,
and the number was still zero.

What I hadn't checked was *when* it went out.

```
Click fires at            6 ms
Beacon leaves at       1003 ms
```

The Snap Pixel does not send an event when you hand it one. It puts it in a
queue and empties that queue on a timer, roughly once a second. That is a
perfectly sensible thing to do — batching is cheaper than a request per event,
and on most sites the page sticks around long enough that nobody notices.

My page does not stick around. Every button on it sends you to the Play Store
immediately. So the real sequence is: tap, browser starts tearing down the
page, and about a second later a timer tries to fire inside a page that no
longer exists. The event was real. Nobody was ever told about it.

![A timeline from zero to 1100 milliseconds. The event is queued at 6
milliseconds, the page begins unloading almost immediately, and the flush timer
fires at 1003 milliseconds into a page that no longer
exists.](/blog/zero-race.svg)

The shape of the data had been telling me this the whole time and I had read it
as a coincidence:

| Event | Does the page survive it? | Recorded |
| ----- | ------------------------- | -------- |
| Landing on the page | yes, they read it for a while | 29 |
| Tapping the button | no, it leaves immediately | 0 |

Same page, same script, same pixel. The only variable is whether the page
outlives the thing it is trying to report. Page views survive because arrivals
sit still for longer than a second. Button taps don't, because they have
essentially no time left.

I have written a lot of code that assumes handing an event to a library means
the event has been sent. It means the library has accepted it. Those are
different, and the gap is where a page can die.

## Rules I could not grep for

While I was in there I found an event I did not recognise, firing on the same
page. Nothing in the repository fired it. I searched the whole codebase for the
name and got nothing.

It turned out to live on Snapchat's servers. Their Pixel Setup Tool lets you
open your own site in an overlay, click a button, and say "count that." What it
stores is a CSS selector, and it ships that selector to your page inside the
pixel's config file at runtime.

```json
"ec": [
  { "exv": ".wrap > .cta:nth-child(4)", "et": "START_CHECKOUT" },
  { "exv": ".mid .cta",                 "et": "START_CHECKOUT" },
  { "exv": ".close .cta",               "et": "START_CHECKOUT" }
]
```

Three of them, bound to three of my four buttons, so those taps were being
reported twice under two different names. I had created them myself, weeks
earlier, clicking around the tool while trying to get something working. I had
completely forgotten.

Two things about this bother me more than the double-counting.

The first is that `.wrap > .cta:nth-child(4)` is a positional selector. Reorder
anything in that section and it silently binds to a different element, or
nothing at all. My markup is now load-bearing for a system that has no idea when
I change it, and won't tell me when it breaks.

The second is that I could not have found this by reading my own code. There is
no file, no config entry, no import. The only way to see it is to fetch the
vendor's config file and read it. That is a real category of state — behaviour
that runs on your page, that you own, that your repository knows nothing about.
I don't have a good general answer for it beyond knowing it exists.

Removing them had its own small joke at the end: the setup tool refuses to save
an empty event set. The button greys out the moment you delete the last rule. I
had to create one deliberately inert rule, pointed at a URL that doesn't exist,
so the tool would let me publish a configuration with nothing real in it.

## Clicks are not arrivals

The third thing was not a bug, just a number meaning something other than what
it says.

I had bought 285 clicks. Twenty-nine people arrived. That is a 90% loss between
paying for a tap and anyone reaching the page.

Snapchat counts a click at the instant a finger lands on the ad. Everything
after that — the in-app browser opening, the network, the page loading — is loss
it never sees. And Snapchat is an app where people tap constantly to skip
forward. An ad appears, the thumb is already moving, that counts.

The tell was the cost. Clicks were coming in at about a quarter of a rupee. Real
visitors, on the one campaign I had set to optimise for arrivals rather than
taps, cost around three rupees. When one of your metrics is twelve times cheaper
than the thing it is supposed to approximate, it is not a bargain.

The split across three ads made it obvious:

| Optimised for | Arrival rate |
| ------------- | ------------ |
| Clicks | 8.3% |
| Clicks | 7.7% |
| Landing page views | 46.7% |

Same site, same speed, same pixel. One ad is nearly six times better at turning
a tap into a visitor, and the only difference is what I asked Snapchat to go and
find. I asked two of them for cheap taps and got exactly that. The algorithm was
not wrong. My instruction was.

## The thing they have in common

None of these three failures raised an error.

The queued event that never sent produced a zero. The forgotten selector rules
produced a plausible-looking event with real counts behind it. The clicks that
never arrived produced an excellent cost-per-click. Every one of them was a
confident number sitting in a dashboard, formatted identically to the numbers
that were true.

A zero that means "this did not happen" and a zero that means "nobody was
watching" render the same. I don't think there's a clever fix for that. What
changed for me is smaller and duller: when a measurement says nothing happened,
I now spend the first hour proving the measurement *could* have fired, before I
spend any time on why the thing didn't happen. On this occasion that would have
saved most of a day.

## What I actually changed

I made the buttons open the store in a new context, so the page survives long
enough for the queue to flush. It is one attribute. I have documented at some
length in the source why it is load-bearing, because it reads exactly like
something a tidy-minded person would delete.

I have not verified it works. It behaves correctly in a normal browser, but the
traffic arrives through an in-app browser inside a social app, and those don't
always honour it. The honest position is that I've made a change I believe in
and haven't proven yet, and the only test that counts is a real phone on a real
ad. If it fails, the durable answer is to report the event from my server
instead of from a page that is in the middle of being destroyed, which is where
this probably should have been all along.

The other two I fixed properly. The selector rules are gone. The campaigns are
being pointed at arrivals rather than taps — and I'm running that as a test
rather than a certainty, because my own data is not unanimous that it's an
improvement.

Small money, small numbers. But I would have drawn a confident and completely
wrong conclusion from all of it, which is the part worth writing down.
