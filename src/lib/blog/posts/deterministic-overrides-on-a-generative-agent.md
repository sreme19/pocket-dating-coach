---
title: Making a rule hold when the model has already been told ten times and ignored it
date: 2026-08-21
summary: A prompt is an instruction, not a constraint, and a model told ten times not to do something will still do it on the turn where the sentence felt right. Worse, a refusal is a property of one model call and does not survive being wrapped in an orchestrator. So the rules that actually have to hold live in code that runs on the output — five checks, each written after something went wrong in production.
tags: [guardrails, riteangle]
---

Prompts are instructions, not constraints. A model that has been told ten times
not to do something will still do it on the turn where the sentence felt right.

So between the generator and the recipient there are five deterministic checks
that can rewrite or refuse the output. None of them is clever. All of them were
written after something went wrong.

## The overrides

![A generated reply passes five checks: a signal downgrade, a contact scrub, a
pair check, a wrap rewrite and a loop cap. Each exists because of a production
incident.](/blog/overrides-pipeline.svg)

Each check is a few lines of code that runs whatever the model produced, and each
one closes a hole the prompt could not.

## The one worth explaining properly

![A man declines a proof request. The model reads the tone as evasive and raises
a concern flag. The rule checks whether the same turn was a proof refusal, and
forces the flag back to neutral.](/blog/refusal-downgrade.svg)

An agent vetting a man asks for proof of income. He replies that he is not
applying for a loan and would like it to stop.

The model read that tone and raised a concern flag, which surfaced to the woman
as a note that he was being financially evasive.

Nothing about that is a bug in the usual sense. The sentence *is* curt. A model
grading tone in isolation will call it defensive, and it will do so consistently,
because the tone is genuinely defensive.

The problem is that declining to prove something is a boundary, not a warning
sign — and a system that penalises boundaries has picked a side.

So there is a rule: if the same turn was a refusal to supply proof, the concern
flag is forced back to neutral and the downgrade is logged. It runs on the output
regardless of how the sentence was phrased.

The reason this is code rather than a prompt line is that the prompt already said
it. It said it clearly. It was ignored on the turn where the model's tone
judgement was strong enough to override an instruction it had been given a
thousand tokens earlier.

## The other four

**Contact scrub.** Emails, phone numbers, links and handles are stripped from the
outbound message. Written after a woman pasted her own social handle into a chat
and her agent, having read it in the transcript, helpfully repeated it a few turns
later. The scrub applies to the outbound half only; the private coaching note she
sees is untouched, because that is her own information being shown back to her.

It has a known gap, which is documented where it lives: a bare username with no
`@` and no domain is not matched. That case is still prompt-only. A partial
mechanical defence plus an honest note beats a regex that pretends to be complete.

**Pair check.** Before the agent speaks, the code asserts the conversation
contains exactly one man and one woman. If it does not, the agent stays silent.
This replaced a lookup that took the first woman in the pair — which quietly
picked an arbitrary owner when a conversation had two.

**Wrap rewrite.** When the agent hands the conversation over, any trailing
question is removed and a fixed closing line is appended. A hand-off must not end
by asking something nobody will answer, and the closing line is added by the
sender *after* the database confirms the state actually changed — so the message
can never promise a hand-off that did not happen.

**Loop cap.** Ten exchanges per side when two agents are talking to each other,
reset when a human takes over. Two agents will continue a conversation
indefinitely. Neither of them gets bored, and both are billable.

## Why this is not just belt-and-braces

The strongest argument I heard for this approach all year came from a keynote at
DataHack Summit 2026 on agent safety.

The talk showed one malicious request run through two different orchestration
frameworks. Both ended in the harmful action being executed — **for opposite
reasons**. In one, the orchestrator missed the intent and re-delegated the task
past a sub-agent that had already refused it. In the other, the orchestrator
caught the intent but handed its sub-agent a context-free atomic step, so the
sub-agent had nothing to object to.

The conclusion is the useful part: **safety refusals do not compose across an
orchestrator boundary.** A refusal is a property of one model call with one
context. Wrap that call in a system and the refusal does not survive the wrapping.

If that is true, then a guarantee you need has to live outside the model calls
entirely. Not in a better prompt, and not in a more careful orchestrator — in code
that runs after the model, on the output, every time.

A session at MLDS put the same point more bluntly: use the model for reasoning,
not for enforcing rules. Constraints beat cleverness.

## An interface for refusing

The most developed version of this idea I saw presented came from a research team
at MLDS 2026, who showed a guardrail as a function the agent calls before acting.
It takes the proposed plan and the current state, and returns whether the action
is allowed, the reasons, the projected effect on risk and service levels, and a
set of safe alternatives.

That is considerably better than what we have. Ours are five independent checks
bolted along a pipeline; theirs is one interface with a typed answer, which means
the refusal is inspectable and the alternatives are machine-readable.

The gap is worth naming: our overrides can block or rewrite, but they cannot
explain themselves to the agent in a form it can act on. The agent finds out what
happened only in the sense that its output changed.

## The pattern, without the dating app

> **Put the rules you actually need to hold in deterministic code that runs on
> the model's output, not in the prompt that produced it.** Prompts express
> intent; code expresses guarantees. Anything you would be embarrassed to explain
> to a user belongs in the second category.

| Setting | The model's plausible mistake | The deterministic override |
| --- | --- | --- |
| **Lending** | Reads a borrower's terse reply as evasive and notes it on the file | Never let a declined optional disclosure become a negative signal |
| **Healthcare intake** | Repeats a patient identifier back in an outbound message | Strip identifiers from anything leaving the system |
| **HR and case management** | Summarises a grievance in a way that names a protected characteristic | Post-generation scan; block and regenerate |
| **Customer support** | Ends a closing message with a question that reopens the ticket | Strip trailing questions on terminal messages |
| **Multi-agent systems** | Two agents negotiate with each other indefinitely | Hard exchange cap, reset only on human involvement |
| **Any assistant** | Confirms an action the database did not commit | Append confirmation text only after the write succeeds, never before |

Three things that transfer:

**Write the override when the incident happens, and record why.** Every one of
ours carries the specific failure that caused it in a comment beside it. That note
is what stops someone deleting the rule two years later because it looks
paranoid.

**Override the output, not the input.** Fixing the prompt is tempting and it works
until the context is unusual. A check that runs on the produced output does not
care how the model got there.

**Let the last one be the model's own judgement, not the first.** In our signal
pipeline the model's tone assessment is genuinely useful and mostly right. The
override does not replace it. It catches the one case where being right about tone
produces a wrong conclusion about a person.

## What we still get wrong

The overrides are silent. When the refusal downgrade fires, it is logged, but
nothing reads that log — the same problem as
[the judge's violation table](/blog/llm-as-judge-in-the-critical-path). I cannot
tell you how often the model's tone assessment gets overruled, which is exactly
the number that would tell me whether the prompt needs work or the rule is
carrying the whole thing.

And they are ordered by accident rather than design. Five checks accumulated one
at a time; nobody has asked whether the order matters, or whether two of them can
disagree. That is fine at five. It will not be fine at fifteen.

## References

Most sessions have no published recording. Where one exists it is linked.

| Source | Event | Recording |
| --- | --- | --- |
| Safe agents: refusals do not compose across an orchestrator boundary | [DataHack Summit 2026](https://www.analyticsvidhya.com/datahacksummit/), Aug 2026 | Not published |
| A guardrail as a callable interface returning allowed, reasons and safe alternatives | [MLDS 2026](https://mlds.analyticsindiamag.com/), Mar 2026 | Not published |
| Constraints beat cleverness: use the model for reasoning, not enforcement | [MLDS 2026](https://mlds.analyticsindiamag.com/), Mar 2026 | Not published |
| Production failure modes in enterprise compliance agents | [DataHack Summit 2026](https://www.analyticsvidhya.com/datahacksummit/), Aug 2026 | Not published |
| Deterministic execution layer with the model kept away from raw data | [DataHack Summit 2026](https://www.analyticsvidhya.com/datahacksummit/), Aug 2026 | Not published |
| Full hall recordings across three days | [CYPHER 2025](https://cypher.analyticsindiamag.com/), Sept 2025 | [Day 2, Hall 3](https://www.youtube.com/watch?v=uOqflHyRxcs) |

*Sixth of nine posts on riteangle's architecture. Previous:
[human hand-off with an expiry that reverses](/blog/human-handoff-with-an-expiry-that-reverses).
Next: the two database defaults that made an agent accuse a blameless man nine
times.*
