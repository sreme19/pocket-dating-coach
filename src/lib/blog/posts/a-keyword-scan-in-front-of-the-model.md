---
title: A deterministic keyword gate ahead of the LLM, and the clinician sign-off a classifier can never get
date: 2026-08-25
summary: Some questions a patient asks are urgent in a way the patient does not know, and getting one wrong means telling someone to wait until morning. A model would detect those better than a keyword list by every ordinary measure — it handles paraphrase, typos and mid-sentence language switching. It is used anyway, because a list of phrases cannot be argued out of its judgement by the message it is reading, cannot fail open during an outage, and can be read line by line and signed off by a clinician.
tags: [guardrails, decision-systems]
---

I built a patient education chatbot for a fertility clinic. People ask it what a
particular hormone result means, whether some symptom is normal, what happens at
the next stage of treatment.

Some of those questions are urgent in a way the person asking does not know.

The design decision I want to describe is that **the urgent path never reaches the
model**. It is handled by a keyword scan — a worse classifier than Claude by every
ordinary measure — and that was the point.

*(The clinic and clinician are anonymised here; the architecture is mine to
describe, the branding is not.)*

## Six stages, two of which can end the request

![Six stages: rate limit and input caps, an emergency keyword scan before any
model call, keyword retrieval over reviewed answers, prompt construction, the
model call, and a validator that discards the whole response on any forbidden
pattern.](/blog/safety-chain.svg)

The whole route is about 170 lines. Only stage five is generative.

Two of the six can terminate the request on their own — stage two before the model
is consulted, stage six after its output is thrown away.

## Why the crisis path is deliberately dumb

Stage two runs about sixty-five phrases against the message, in English, Hindi and
Kannada. On a hit it returns a pre-written escalation, reviewed by a clinician, in
the language the person was writing in. Claude is never called.

Claude would be better at this. It would catch phrasings nobody wrote down, handle
typos and paraphrase, and cope with someone switching language mid-sentence — all
things a substring match fails at badly.

![A model classifier catches phrasings nobody wrote down but can be argued out of
its judgement and fails open. A keyword scan misses things and trips on negations
but cannot be talked out of anything and prints on one
page.](/blog/enumerate-vs-generalise.svg)

Three properties decided it.

**It cannot be talked out of anything.** A model reading a message is influenced by
that message. A list of phrases is not.

**It cannot fail open.** When the provider has an outage, a model-based classifier
either blocks everything or waves everything through. A local string comparison has
no outage state.

**A clinician can review it.** The complete behaviour is a list. Somebody medically
qualified read every phrase and every escalation message and signed them off. No
equivalent review exists for "we asked the model to notice emergencies", because
there is nothing to read.

That third one is the real argument. On a path where being wrong means telling
someone to wait until morning, an approach a domain expert can audit line by line
beats one that scores better on a benchmark.

## Retrieval without a vector database

Stage three scores thirteen reviewed answer chunks by keyword and token overlap,
takes the top three, and caches them in memory. There is no embedding model and no
vector store.

At thirteen chunks, an embedding index adds a dependency, a build step and a
network call to a problem that a scoring function solves in a millisecond. It also
makes the retrieval unreviewable, which matters here for the same reason as above:
every chunk in that file was checked by a clinician, and I can show exactly which
three were used.

The rule I would generalise: **retrieval quality only starts to matter above a
corpus size most internal tools never reach.** Below that, keyword scoring is
easier to reason about and easier to defend.

## The validator throws away the whole response

Stage six checks the generated answer against eight forbidden patterns — dosage
instructions, statements interpreting a specific test result, diagnostic language,
prescription language.

A hit does not edit the response. It discards the entire thing and returns a fixed
safe reply.

Whole-response rejection looks crude, and it is deliberate. If a paragraph contains
one sentence stating a dosage, the rest of that paragraph was written by the same
model in the same breath, on the same wrong premise. Salvaging the good sentences
means shipping a reply built around a claim we just rejected.

## Where it is weak, in its own words

The steering document for the project lists the holes, and they are worth stating
because they are the honest limit of this approach.

| Weakness | Why it happens | What it costs |
| --- | --- | --- |
| Substring matching ignores negation | A message saying there is *no* fever contains the word | False escalations — the safe direction, but annoying |
| Regex cannot catch paraphrase | A pattern for one dosage phrasing does not match a differently-worded one | A real miss, and the reason the plan is to move to managed guardrails |
| Keyword retrieval misses synonyms | No semantic similarity anywhere | Occasionally retrieves the wrong three chunks |
| Emergency list is hand-maintained | Someone has to add phrases as they are observed | Coverage decays unless it is reviewed |

The paraphrase gap is the serious one, and it is the reason the roadmap points at
platform-level guardrails rather than more regex. Pattern matching enforces the
rules you thought to write. It does nothing about the rule you meant.

## What is actually tested

Three of the test suites are property-based rather than example-based — the
emergency detector, the response validator, and retrieval. Instead of checking
specific inputs, they assert invariants across generated ones: any input
containing a listed phrase escalates; any output containing a forbidden pattern is
rejected; retrieval always returns at most three chunks.

That is the right shape of test for this code, because the risk is not a
particular failing input. It is a class of input nobody enumerated.

One thing to fix before anyone reads the repo: the docs still name an older model
than the code actually calls. Documentation drift on the model identifier is a
small thing that undermines every other claim in the document.

## The pattern, without the clinic

> **On the paths where a wrong answer causes harm, prefer a mechanism you can
> enumerate over one that scores better.** Put it *before* the model where the
> question is whether to answer at all, and *after* the model where the question
> is whether the answer is allowed. Reserve generative capability for the middle,
> where being occasionally wrong is survivable.

| Setting | The pre-model gate | The post-model gate |
| --- | --- | --- |
| **Mental health support** | Self-harm phrases route to a human line without a model call | No advice framed as treatment |
| **Financial guidance** | Distress or hardship language escalates to a person | No performance guarantees, no specific product recommendation |
| **Legal information** | Time-critical matters route to an actual solicitor | Nothing framed as advice for a specific case |
| **Safeguarding intake** | Disclosure phrases trigger a defined protocol immediately | No wording that could be read as a determination |
| **Pharmacy and triage** | Red-flag symptoms bypass the assistant entirely | No dosages, no diagnoses |

Three transfers:

**Put the highest-stakes check before the expensive one.** It is cheaper, it cannot
be prompt-injected by the content it is reading, and it works when your provider
does not.

**Write the escalation text in advance and have an expert approve it.** The value
is not the detection — it is that the response to a detection was composed
carefully by a qualified person rather than generated under time pressure.

**Reject whole outputs, not fragments.** Partial rejection assumes the rest of the
response is independent of the part you removed. It usually is not.

## References

| Source | Event | Recording |
| --- | --- | --- |
| Responsible AI for agents: approval thresholds, no send without review | [AWS Summit Bengaluru 2026](https://aws.amazon.com/events/summits/bengaluru/), Apr 2026 | [Keynote](https://www.youtube.com/watch?v=CprBATdRoh0) |
| Safe agents: refusals do not compose across an orchestrator boundary | [DataHack Summit 2026](https://www.analyticsvidhya.com/datahacksummit/), Aug 2026 | Not published |
| Compliance agents and production failure modes | [DataHack Summit 2026](https://www.analyticsvidhya.com/datahacksummit/), Aug 2026 | Not published |
| Guardrails as a platform capability rather than application code | [CYPHER 2025](https://cypher.analyticsindiamag.com/), Sept 2025 | [Day 2, Hall 3](https://www.youtube.com/watch?v=uOqflHyRxcs) |

*Companion piece: the same class of protection built as infrastructure rather than
application code, in a later project — that post is next.*
