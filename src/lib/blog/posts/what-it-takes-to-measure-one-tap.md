---
title: What it takes to measure one tap
date: 2026-08-09
summary: Four systems, none of which can see each other, cooperating to record that somebody pressed a button. Here is the whole arrangement and why each piece is there.
tags: [riteangle, operations]
cover: /og/blog/what-it-takes-to-measure-one-tap.png
---

I have one landing page with one button on it. The button sends you to the Play
Store. I would like to know how many people press it, and which ad brought them.

That turned out to need four systems that cannot see each other, and every
piece of the arrangement below exists because something specific broke without
it. None of it was designed up front. It accumulated, one failure at a time,
which is the only honest way to describe it.

## The shape of the problem

A tap crosses three boundaries, and nothing survives all of them.

```text
Snapchat  →  in-app browser  →  my site  →  Play Store  →  installed app
```

Snapchat knows who saw the ad and stops knowing anything the moment its browser
opens my page. My site sees a visit and stops knowing anything the moment the
browser leaves for Google. Google sees an install and knows nothing about the
ad. No cookie, no session, no identity crosses those lines — by design, and
increasingly by law.

So there is no single system that can answer "did this ad produce an install".
Every answer is assembled out of parts.

## Part one: the pixel, in one place only

Both ad networks give you a script and tell you to paste it into your site's
`<head>`. On a modern framework that means every route, which for me means the
entire signed-in product.

I put it on the landing page and nowhere else, and it is worth being precise
about why, because it is not squeamishness. Both networks run what they call
automatic matching: the script reads the page for anything shaped like an email
address or a phone number, hashes it, and sends it for identity matching. On a
landing page with no form, that collects nothing. Inside a dating app it would
be members' contact details, out of profiles and conversations, going to an ad
network because of where a script tag was pasted. Nobody consented to that, and
nobody would have noticed.

The same switch that disables the matching also disables the other thing worth
turning off:

```ts
window.fbq('set', 'autoConfig', false, PIXEL_ID);
window.fbq('init', PIXEL_ID);
```

The ordering there is the whole trick. Set it after `init` and the scraper has
already run.

## Part two: the events those networks invent for you

Both platforms offer a point-and-click tool: open your own site in an overlay,
click a button, tell it to count that. What it stores is a CSS selector, on
their servers, shipped to your page at runtime.

I had used it months earlier and forgotten. It had bound three rules to my
buttons and was reporting every tap twice — once under my event name and once
under one it chose. I could not find this by reading my own code, because
nothing in my code caused it. The only way to see it is to fetch the config file
your own page downloads and read it.

```json
"ec": [
  { "exv": ".wrap > .cta:nth-child(4)", "et": "START_CHECKOUT" },
  { "exv": ".mid .cta",                 "et": "START_CHECKOUT" },
  { "exv": ".close .cta",               "et": "START_CHECKOUT" }
]
```

Note the selector. `nth-child(4)` is positional: reorder that section and it
binds to a different element, or to nothing, and tells you neither. My markup
had become load-bearing for a system with no idea when I changed it.

Deleting them had one last joke in it. The tool refuses to save an empty event
set — the button greys out when you remove the last rule. I had to create a
deliberately inert rule, pointed at a URL that does not exist, so it would let
me publish a configuration containing nothing real.

## Part three: the server, because the page dies

This is the part I got wrong for longest.

Handing an event to a pixel does not send it. It queues it and flushes on a
timer, roughly once a second. Every button on my page leaves for the Play Store
immediately, so the page — and the queue inside it — can be gone before the
timer fires.

```text
0 ms     tap
6 ms     event handed to the SDK, sits in a queue
~?? ms   browser starts tearing down the page
1003 ms  flush timer fires, into a page that no longer exists
```

Page views were unaffected, because someone reading a page sits still for far
longer than a second. Only the tap was lost, and it was lost silently, and the
number it produced was zero rather than an error.

The fix is to stop reporting from a document that is in the middle of being
destroyed. The button posts to my own server with `keepalive: true`, a flag
whose entire purpose is that the browser must complete the request even after
the page is gone. The server writes a row I own, then forwards to both networks
from somewhere with no teardown deadline.

Three things fall out of that, and only the first was the goal. Ad blockers
cannot suppress a request my own server makes. The event is no longer racing
anything. And there is a row I can read in SQL a second later instead of waiting
on somebody's dashboard to batch.

One id per tap goes to each network twice, once from the browser and once from
the server, so each collapses the pair into a single conversion instead of
counting it twice. That id is also the primary key of my own table, which means
a retried request — normal on a mobile connection — writes one row rather than
three.

The forwards are awaited rather than left running in the background. A
serverless function is frozen the moment it responds, so a promise you do not
wait for is not finished later, it is dropped. I know this because it is how I
once shipped a nightly job that started six times and completed zero.

## Part four: smuggling the campaign through Google

The last boundary is the strangest, because nothing technical crosses it.

Google Play preserves one thing through an install: a string called `referrer`
hung off the listing URL. So the landing page takes whatever campaign tags the
ad appended to it, re-encodes them, and hangs them off the store link.

```ts
const incoming = new URLSearchParams(page.url.search);
for (const key of [...incoming.keys()]) {
  if (!key.startsWith('utm_')) incoming.delete(key);
}
return `${STORE_URL}&referrer=${encodeURIComponent(incoming.toString())}`;
```

A query string, encoded inside another query string, carried through an app
store, readable by the installed app days later. It is the only bridge between
the web and the app, and it is held together entirely by everyone agreeing to
respect a URL parameter.

Those tags are `utm_*` — Urchin Tracking Module, named for a company Google
bought in 2005 and shut down. Twenty years later every ad platform on earth
speaks a dead product's URL convention.

## The failure that outlasted all of it

I built every piece above, verified each one, and then read the first real tap
from a real phone:

```text
campaign: get_lp
utm:      {}
```

`get_lp` is the fallback my code uses when the incoming URL has no campaign tags
on it. None of my ads had ever set any. Every conversion I had, across both
networks and the Play Console, was labelled with the same placeholder.

The pipeline had been correct from the first day. There was simply nothing being
poured into it, and rather than saying so it reported a confident default.

Fixing it revealed one more thing worth knowing: on Snapchat the destination URL
is a property of the *creative*, not the ad. Two ads sharing a creative can
never carry different tags, no matter how you arrange the ad sets — and cloning
an ad set reuses the creative rather than copying it. So a duplicated ad set,
the standard way to run an A/B test, produces two arms you cannot tell apart. If
you want creative-level tagging to stay honest, you need one creative per
distinct tag, even where that means duplicating an asset you would rather reuse.

## What it still cannot do

There is no email step between the ad and the store, deliberately — an extra
page is an extra place to lose people. The cost of that decision is that nothing
joins these four systems at the level of a person. I get rates and volumes. I
never get "this specific human saw the ad and installed the app", and no amount
of further plumbing would change it.

That is the right trade for now, and it is worth stating plainly rather than
discovering later that the funnel you built cannot answer the question you
eventually want to ask.

## The part I would tell myself

Every failure here produced a number rather than an error. A queued event that
never sent produced a zero. Rules I had forgotten produced a plausible count.
Ads with no campaign tags produced a confident label that was the same for
everything.

Not one of them threw. Not one showed up in a log. They all rendered in the same
font as the numbers that were true — which is why I now spend the first hour
proving a measurement *could* have fired before I spend any time on why it
apparently did not.
