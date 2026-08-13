---
title: Compliance as a union of detectors
date: 2026-09-01
summary: Five independent violation checks emitting one shared shape, so adding a regulation is adding a query rather than changing a schema. Plus the hardcoded timezone table sitting inside a model whose whole job is legal calling windows.
tags: [data-platform, decision-systems]
---

Contact-centre compliance is a small, sharp problem. There are rules about when
you may call someone, how often, and whether you may call them at all — and
breaking them carries real penalties.

The modelling question is how to structure the checks so that next year's
regulation does not require rewriting this year's.

## One shape, five detectors

![Five detectors run over one enriched set of attempts: calls outside permitted
local hours, too many attempts in a day, attempts after opt-out, do-not-call
register matches, and attempts with no recorded consent. Each emits the same three
fields, so they union into one table.](/blog/detector-union.svg)

Five checks, each entirely independent, each emitting the same three fields: what
was violated, how severe, and the supporting detail. They union into one table.

The detectors do not know about each other. Nothing coordinates them. Adding a
sixth is adding a sixth query to the union — **not a schema change, not a
migration, and not a rewrite of the five that already work.**

That is the whole idea, and it is worth stating because the tempting alternative
is a single clever model with a column per rule. That version looks tidier and
fails the moment a new rule needs a field the others do not have. A wide table
with sparse columns is a schema that grows with the regulation count; a union of
detectors is a schema that does not grow at all.

## Severity belongs in the detector

Each detector declares its own severity, rather than severity being assigned
downstream.

That is right because severity is a property of the rule, not of the finding. A
do-not-call match is critical whether it happened once or a thousand times. Too
many attempts in a day is a medium-severity pattern even in bulk. Deriving
severity from volume — which is what a downstream ranking step would do — would
systematically understate exactly the rare violations that matter most.

## Matching on a hash

The do-not-call check joins on a hashed phone number rather than the number
itself.

This is a small decision with a disproportionate payoff. The register can be
distributed as hashes, the platform never needs to hold the raw numbers to do the
matching, and the join works identically either way.

The general form: **when you only need to test equality, you rarely need the
value.** Anywhere two systems must agree on whether they hold the same person
without either learning the other's list, a hashed key does the job. It is worth
asking of any join key that happens to be personal data.

## The flaw I would fix first

The timezone conversion is a hardcoded table of fixed offsets, with no handling of
daylight saving.

In a model whose entire purpose is deciding whether a call fell inside a legally
permitted local window, that is not a rounding error. Twice a year, for a stretch
of weeks, every calling-hours verdict for a large fraction of the population is
off by an hour — in a direction that can turn a compliant call into a violation
and, worse, a violation into a compliant-looking record.

Every part of the design above is sound. The correctness of the whole thing rests
on an hour arithmetic that is wrong for two months of the year.

I am including it because it is the most realistic thing in this post. The
architecture was the interesting problem and got the attention; the timezone
handling was boring and got a `CASE` statement. That is how compliance systems
usually fail — not in the structure, in the part nobody wanted to think about.

## The pattern, without the contact centre

> **Model rule-checking as a union of independent detectors sharing one output
> contract.** Let each own its severity. Never let one detector's schema needs
> reach another. And be suspicious of the boring conversion sitting underneath the
> interesting logic, because that is where the actual bug will be.

| Setting | The detectors | The boring thing that breaks it |
| --- | --- | --- |
| **Financial crime** | Threshold breaches, structuring patterns, sanctions matches, PEP exposure | Currency conversion dates |
| **Data protection** | Retention overruns, missing lawful basis, cross-border transfers, unfulfilled deletions | What counts as the retention start |
| **Employment** | Working-time breaches, rest-period gaps, unpaid overtime, missing right-to-work | Timezone and shift-boundary handling |
| **Clinical safety** | Contraindications, dose ceilings, missing monitoring, expired consent | Age at the time of the event, not today |
| **Environmental** | Emission thresholds, permit expiries, monitoring gaps | Unit conversion between reporting standards |

Every one of those right-hand entries is a units-and-time problem, which is not a
coincidence. Rules are interesting and get reviewed. Conversions are dull and get
written once.

Three transfers:

**One output contract, enforced.** Every detector returns the same fields. That
single constraint is what makes the union work and what keeps the marginal cost of
a new rule near zero.

**Severity at the source.** The rule knows how bad it is. Nothing downstream has
the context to work that out from frequency.

**Hash the join key when you only need equality.** It removes an entire class of
data-handling obligation for no functional cost.

## References

| Source | Event | Recording |
| --- | --- | --- |
| Compliance-aware data platforms and governed access | [Data Engineering Summit 2026](https://des.analyticsindiamag.com/), May 2026 | Not published |
| Telemetry and enforcement for audit completeness | [Data Engineering Summit 2026](https://des.analyticsindiamag.com/), May 2026 | Not published |
| Data contracts and shared metric definitions | [Data Engineering Summit 2024](https://des.analyticsindiamag.com/agenda/schedule-2024/), May 2024 | Not published |
| Full hall recordings across three days | [CYPHER 2025](https://cypher.analyticsindiamag.com/), Sept 2025 | [Day 2, Hall 2](https://www.youtube.com/watch?v=lKAA4ua6bLI) |

*Source is public: [cci-platform](https://github.com/sreme19/cci-platform). The
data in it is synthetic.*
