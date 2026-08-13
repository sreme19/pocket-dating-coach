---
title: Where a safety rule should live when the cost of forgetting it is somebody getting hurt
date: 2026-08-29
summary: A safety rule written in your own code can be read, reviewed and approved by a domain expert, and protects exactly the one route you remembered to wire it into. The same rule bought as managed infrastructure is opaque, catches paraphrase you never enumerated, and applies to every path including ones written six months from now by someone who never read your docs. Having built both, the split I would defend is to write the rules you must be able to defend, and buy the rules you must not be able to forget.
tags: [guardrails, decision-systems]
---

In [a keyword scan in front of the model](/blog/a-keyword-scan-in-front-of-the-model)
I described a medical chatbot whose safety is entirely application code: a keyword
list before the call, forbidden patterns after it.

That post ends by admitting the approach's real limit — pattern matching enforces
the rules you thought to write. Its own design notes say the plan is to move
enforcement to platform guardrails.

In a later project I built that version. So I now have both, and the comparison is
more interesting than either.

*Account identifiers, resource names and endpoints are omitted throughout.*

## The two shapes

![In the application-code version every protection is something you wrote: a
keyword list, rules in the prompt, forbidden patterns checked afterwards. In the
platform version a managed guardrail wraps input and output, redacts personal
details before the model sees them, refuses whole topics, and is attached again
inside the retrieval step.](/blog/guardrail-placement.svg)

The second system provisions a managed guardrail and attaches it in two places: to
the model invocation, and again *inside* the retrieval step, so a document coming
back from the knowledge base is subject to the same rules as a user's message.

What it enforces: personal details — names, phone numbers, addresses, email — are
redacted before the model sees them. Government identifiers are blocked outright
rather than redacted. Whole topics are denied, so a question outside the intended
domain is refused by the platform rather than by a sentence in a prompt.

## The trade, plainly

| | Application code | Platform guardrail |
| --- | --- | --- |
| Can I read the rules? | Yes, every one | No — it is a hosted classifier |
| Can a clinician sign it off? | Yes, it prints on a page | Not meaningfully |
| Coverage | Only routes I remembered to wire | Every caller, including future ones |
| Catches paraphrase? | No | Yes |
| Behaviour when the provider is down | Local checks still run | The whole call fails |
| Cost | Nothing | Per request |
| Changing a rule | A deploy | A console change, applied everywhere at once |

Two lines matter more than the rest.

**Auditability versus coverage.** The keyword list can be reviewed by a domain
expert, which is exactly why I chose it for the crisis path. The guardrail cannot
— but it applies to every code path, including one added six months later by
someone who never read the safety documentation. The regex only protects the route
it is wired into, and a second route is one afternoon away from existing.

**Enumeration versus generalisation.** Regex catches what you listed. A classifier
catches paraphrase, which is the failure mode the first system openly cannot
handle. Buying that means accepting a component whose exact behaviour you cannot
state.

## What I would actually do

Both, at different points, chosen by consequence rather than preference.

**Application code where a domain expert must approve the behaviour.** The crisis
path is the clearest case. A clinician approved every phrase and every escalation
message. There is no equivalent review for a hosted classifier — "it detects
emergencies" is not something anyone can sign.

**Platform guardrails for the broad, boring, universal rules.** Do not emit
personal data. Do not discuss things outside this domain. These are the same on
every route, benefit from generalisation, and are the ones most likely to be
forgotten when someone adds an endpoint.

Put crudely: **write the rules you must defend, buy the rules you must not
forget.**

The failure of the first system is not that regex is wrong. It is that regex is
*all* there is, so a rule I would have wanted everywhere lives in one file.

## The comparison endpoint, and why it is fair

The second project also has a feature I would build again.

![A question is asked once, retrieval runs once, and that identical context is
fanned out to three models in parallel so the only variable left is the
model.](/blog/fair-bakeoff.svg)

It answers a question with three different models side by side — but it
**retrieves the context once and fans that same context out to all three.**

That sounds minor and it is the whole point. Retrieve separately per model and any
difference in the answers might be the retriever, not the model. Most informal
comparisons make exactly that mistake and then draw conclusions about model
quality from what was actually retrieval variance.

Because the context is shared, the difference is attributable — and since the
prices differ by roughly four times between the cheapest and dearest options
tried, you can see what the extra spend buys on your own questions rather than on
a benchmark.

## The pattern, without either project

> **Sort your safety rules by whether their correctness must be defensible to
> someone outside engineering.** Rules a regulator, clinician or lawyer must
> approve belong in code you can print. Rules that simply must never be forgotten
> belong in infrastructure that applies itself. Most systems need both, and most
> systems have only one.

| Setting | Belongs in reviewable code | Belongs in platform infrastructure |
| --- | --- | --- |
| **Healthcare** | Crisis detection and the exact escalation wording | Never emit patient identifiers |
| **Financial services** | Suitability boundaries and mandatory disclosure text | Never emit account numbers; stay in domain |
| **Legal** | What constitutes advice versus information | Never emit client identifiers |
| **Public sector** | Eligibility determinations and appeal wording | Never emit national identifiers |
| **Any assistant** | The refusals you would defend in public | The redactions you would be embarrassed to have missed |

Three transfers:

**Ask who has to approve the rule.** If the answer is someone outside engineering,
they need to be able to read it. That single question decides most of these
placements.

**Assume a second route will exist.** Application-level protection is one new
endpoint away from being bypassed by accident. If a rule must hold everywhere,
put it where "everywhere" is the default.

**Share the retrieval when comparing models.** It costs one refactor and it is the
difference between a comparison and an anecdote.

## References

| Source | Event | Recording |
| --- | --- | --- |
| Guardrails, agent runtime and managed evaluations as platform services | [AWS Summit Bengaluru 2026](https://aws.amazon.com/events/summits/bengaluru/), Apr 2026 | [Keynote](https://www.youtube.com/watch?v=CprBATdRoh0) |
| Responsible AI for agents: walled-garden tool approval, approval thresholds | [AWS Summit Bengaluru 2026](https://aws.amazon.com/events/summits/bengaluru/), Apr 2026 | Not published |
| Safe agents: refusals do not compose across an orchestrator boundary | [DataHack Summit 2026](https://www.analyticsvidhya.com/datahacksummit/), Aug 2026 | Not published |
| Telemetry and enforcement for agent governance | [Data Engineering Summit 2026](https://des.analyticsindiamag.com/), May 2026 | Not published |
| Full hall recordings across three days | [CYPHER 2025](https://cypher.analyticsindiamag.com/), Sept 2025 | [Day 2, Hall 3](https://www.youtube.com/watch?v=uOqflHyRxcs) |

*Companion to [a keyword scan in front of the model](/blog/a-keyword-scan-in-front-of-the-model),
which is the same problem solved entirely in application code.*
