---
title: Splitting an AI agent into math, code and reason
date: 2026-10-11
summary: Ask one language model to score every possible pair in a dating pool, enforce a privacy rule and explain the result, and it will do all three, a little differently each night, with no way to tell which part went wrong. Across thirteen systems I have built, the ones that hold up split the work three ways. Solvers handle anything with a best answer or a probability. Plain code handles anything that must hold every time. The model reads and writes what no rule can describe. The price is translation, because math and code need the problem in numbers and fields, so the riskiest moment moves to the seam where the model hands them over.
tags: [agentic-architecture, decision-systems, agent-architecture]
cover: /og/blog/math-code-reason-architecture.png
---

Every night, the first version of a matchmaker I built asked a language model the
same question about every possible pair in the pool: how good a match are these
two? In August the pool held 480 live pairs, so one night's run meant 480 model
calls. Each one was paid for, each one could come back slightly different if asked
twice, and none of them could explain afterward why one pair outscored another.

The replacement asks the model one question per person, once, when their profile
changes: read this profile and turn it into a short list of numbers. Scoring all
480 pairs is then a weighted sum, and choosing who actually meets whom is a
min-cost flow solve under capacity limits. The model still writes the
introduction, after the choice is made.

Analytics India Magazine held its Cypher 2026 conference in Bengaluru from
October 7 to 9. In his session there, Abhishek Upperwal, founder and CEO of Soket
AI, used a term I have been applying to my own work ever since: **MCR, for math,
code and reason.** He was describing where agentic AI has to go. The argument here is
my reading of it: agentic systems need all three as separate layers. Math
decides what is best and how likely. Code decides what is allowed and what is exact. Reason, meaning the
language model, does the reading and writing that nobody can reduce to a rule.

What follows sorts thirteen of my own systems into those three layers, shows what
each layer bought and where each one failed, and maps the idea onto the published
architectures it resembles.

![The math, code and reason stack. Reason, run by Claude Sonnet and Haiku, reads
unstructured input into fields and writes prose from finished results. Code,
meaning regex gates, override functions, reconciliation checks and replay
harnesses, decides what is allowed and what is exact. Math, meaning integer
programming in PuLP and CBC, min-cost flow, NumPy Monte Carlo, POMDP and
counterfactual regret minimization, decides what is best and how likely. A request
enters at the top, passes down through code into math, and comes back up through
code before the model writes the answer.](/blog/mcr-stack.svg)

## One model doing all three is the tempting design

The obvious build is a single capable model with a long prompt. Give it the data,
tell it the rules, ask for the answer and the explanation together. It demos well,
and it fails in three distinct ways.

**It gets the arithmetic wrong, and nobody can see where.** The clearest measured
case is old but instructive. In AI21 Labs' 2022 paper on MRKL systems, GPT-3's
accuracy on addition fell from 1.0 with two-digit numbers to 0.804 at three
digits, 0.255 at four and 0.093 at five. The same paper's model, which handed the
sum to a calculator, scored 1.0 from one digit to nine. GPT-3 is several model
generations old, so treat that number as history. The paper's other observation
has aged better: once the calculator did the sum, every remaining error came
from passing it the wrong operands. The mistakes did not disappear. They moved to
the handoff, where they could be found.

**It costs per question, forever.** The matchmaker above paid for one model call
per pair, so its bill grew with the number of men times the number of women.
Moving the scoring into arithmetic made the nightly cost of scoring effectively zero. The only model
spend left is one call per person, made when their profile changes.

**It treats every rule as a suggestion.** A prompt is an instruction, and a model
weighs instructions against everything else in its context. In the same dating
app, a man wrote that he was declining an income proof because he was not applying
for a loan. The prompt said a refusal must never count against anyone. After four
requests, the model flagged him as a concern anyway. In another thread, a woman
pasted her own social handle, and a few turns later her agent repeated it to the
man. A rule against leaking contact details does not feel like it applies to
something already visible in the transcript. Both rules now live in code that runs
on every reply the model writes, where the model's opinion of them no longer
matters.

Those are the three drivers, in the order they usually bite: correctness you can
check, cost you can predict, and rules that actually hold.

## Math decides what is best and how likely

The math layer covers any step with a best answer under constraints, or a
probability to estimate. It is the oldest layer in this stack and the easiest to
skip, because a language model will happily produce something that
looks like an optimum.

Four of the systems are decision oracles, and in each one the model never touches
the decision. Between them they use four kinds of math:

- **Picking a cricket eleven** is integer programming. Choose 11 from 15 with a
  wicketkeeper, at most four overseas players and enough bowlers, maximizing
  expected runs. The design notes for the women's T20 version put the search space
  at roughly 3,000 arrangements and an exact solve at under a second. That is why
  simulated annealing was considered and rejected.
- **Win probability** is Monte Carlo: 10,000 simulated innings per scenario, a
  configured count. The same project's documentation records 4 to 5 seconds per
  prediction, with the simulation as the bottleneck.
- **Strategy against an opponent who is choosing too** is counterfactual regret
  minimization. In its sample output, a Game of Thrones turning-point oracle
  reports an exploitability of 0.064 for the strategy it recommends. The reader
  can see how far the answer sits from an equilibrium.
- **Acting when you cannot see the true state** is a POMDP. A spy-thriller oracle
  keeps a belief over hidden states and picks the action with the best expected
  value under that belief.

The matchmaker adds a fifth. A weighted dot product scores each direction of a
pair, and the geometric mean of the two directions gives the pair's value.
Min-cost flow then assigns matches under configured caps of 4 for each man and 12
for each woman. A claim nobody has verified enters the score at 0.3 of its
weight, also configured, so an unproven boast can never outweigh a checked fact.

The benefits are specific. **The answer is optimal under the stated constraints**,
which a heuristic or a model can only approximate. **The answer is reproducible**:
the women's T20 design notes put it as the same input state producing the same
action whatever the model's temperature. And **counterfactuals are exact**. Change
one weight in the matchmaker and rerun, and you know precisely which pairs moved
and why.

The hard side is real. Math needs the problem already in numbers. Somebody has to
decide that a profile which says "I run a small bakery and train for marathons"
means a 0.8 on ambition and a 0.7 on fitness, and no solver can do that reading.
Math can also be confidently wrong. The women's T20 model's headline accuracy was
61%, 11 correct out of 18. Split by outcome class, it was 11 of 11 on one class
and 0 of 7 on the other, which is exactly what always predicting the same outcome
would score. A solver's precision says nothing about whether its inputs or its
evaluation were right. That story has its own post on tiered evidence for a sport
with almost no data.

## Code decides what is allowed and what is exact

The code layer covers anything that must hold every single time, or must match to
the cent. It differs from math in its question. Math asks what the best choice
is. Code asks whether this choice is permitted, and whether these numbers add up.

It shows up in four positions:

1. **A gate in front of the model.** A patient-education chatbot for a clinic
   checks every message against a fixed list of crisis phrases, in English, Hindi
   and Kannada, before the model is called at all. A match skips the model and
   returns escalation guidance immediately. A list cannot be talked out of its
   judgment by the message it is reading.
2. **Overrides after the model.** The two dating-app incidents above became
   functions that run on every reply: a refusal turn forces the concern flag back
   to neutral, and outbound text is scrubbed of emails, phone numbers and handles.
3. **Exact arithmetic.** A weekly profitability report allocates spend across
   segments. Each segment's share is rounded with the largest-remainder method so
   the shares sum to exactly 100.00%, and the pipeline checks that segment costs
   add up to actual spend within one dollar.
4. **Proof before a change ships.** An agent edits a lead-routing configuration
   from plain-English requests. It is trusted only because a reimplementation of
   the routing engine first reproduced every decision production had made over
   nine days. That was 5,501 of 5,501, zero divergences, against a target of
   under 0.5% set in advance. Every proposed edit is replayed against
   that corpus before a human sees it.

Code also wins some jobs a model would do more flexibly. In a job-search agent,
deciding whether a question should be answered from a database or from documents
is a small set of rules, scored at 0.974 routing accuracy over 38 test questions.
A model classifier was rejected because it would answer differently across runs
and could not be unit-tested. The trigger for building it was a document search
that returned a stale paraphrase of a weekly volume figure, three times too low. A
written instruction to take numbers from the database had not prevented it.

The benefits: **rules are enforced rather than requested**, every rule is
**testable in isolation**, and a failure leaves **a log line naming the rule** that
fired.

The hard side is just as concrete. The clinic's output filter looks for a dosage
instruction written as the word *take*, then a number, then *mg* or *IU*. It
catches "take 75 mg" and replaces the reply. It misses "take 75 units" because
nobody wrote that pattern, and it misses "the usual dose is 75 mg" because that
sentence never says *take*. Code catches exactly what someone enumerated and
nothing else. That is its strength when a domain expert must sign off every rule, and its weakness
everywhere a paraphrase is possible.

## Reason does what nobody can write a rule for

The reason layer is the language model, kept to the jobs only it can do:

- **Reading.** Turning a free-text profile into attribute scores. Inspecting a
  week's input files when the column names have drifted, where an exact string
  check is either too strict or too loose.
- **Translating intent.** Turning a request like "send Spanish-speaking leads from
  these three states to the new team" into a structured patch against a
  configuration, with output forced through a schema and one corrective retry.
- **Judging meaning.** Checking whether a written analysis actually discusses the
  gap the table shows, which is a question about prose rather than numbers.
- **Writing.** Every oracle above ends with a model turning a finished decision
  trace into a brief. The cricket narrator's instructions forbid stating any figure
  that is absent from the trace.

The benefit is reach: unstructured in, unstructured out, at the two edges of a
system where people live.

The judging job is the one most easily lost. The weekly report pipeline was built
twice. In the first build, a model audited the final report, including whether the
figures quoted in the written findings matched the table and whether the yield gap
was explicitly discussed. The second build replaced that auditor with plain
Python, which was the right call for four of its five checks. It also silently
dropped the prose-against-table check, because no deterministic function can read
a paragraph. The rewrite looked strictly better and quietly lost the one check
only a model could run. The full comparison is in
[an LLM auditor and a deterministic one in the same pipeline](/blog/when-the-auditor-should-not-be-a-model).

The model's own limits set the boundaries of everything above. It cannot be
regression-tested, its answers drift between runs, and it treats rules as
weights. Those limits are why it reads and writes and does not decide.

## Four ways the layers hand off

Across the thirteen systems, the layers connect in only four shapes.

![Four handoff shapes, each a short chain of colored stages. Solve then narrate:
math produces a decision trace and a model writes the brief. Read, compute,
write: a model reads profiles into vectors, math scores and assigns, a model
writes the introduction. Gate, generate, guard: code screens the message, a model
answers, code checks the reply. Propose then prove: a model drafts a
configuration patch, code replays it against thousands of past decisions, and a
human approves.](/blog/mcr-handoffs.svg)

**Solve, then narrate.** Math produces a decision trace, and the model turns it
into prose. All four oracles work this way. So does a graph-retrieval demo, where a
database traversal computes why a match stalled and a small model narrates the
facts for about a tenth of a cent per run. The test is to switch the model off.
The cricket optimizer still returns the eleven and the win probability; it only
loses the explanation.

**Read, compute, write.** The model is at both edges and math is in the middle.
The matchmaker is the example: profiles in, vectors out, a solve, then an
introduction written for a match that already exists.

**Gate, generate, guard.** Code on both sides of a model whose output reaches a
person. The clinic bot and the dating-app reply agent both run this way.

**Propose, then prove.** The model drafts a change, and code proves what the change
would do before anyone accepts it. The routing editor is the example.

The MRKL finding applies to all four. When the computation is exact, the errors
collect at the seams: a model passing the wrong operand, extracting the wrong
field, naming a player the solver never picked. So the seams are where checks
belong. Give every handoff a schema that fails loudly, and check every entity the
narrator mentions against the trace it was handed.

## Deciding which layer owns a step

Most steps sort themselves once you ask the questions in the right order.

![A decision path for assigning a step to a layer. First: is the input or output
free text, images or speech? If yes, the model reads it into fields or writes it
from a finished result. Second: does the step choose among options or estimate a
likelihood? If yes, math, through a solver or a simulation. Third: must it hold on
every run or match exactly? If yes, code, through a gate, a check or exact
arithmetic. Otherwise it is a judgment about meaning, so the model does it with
code bounding its output. The footer test: remove the model, and if the answer is
still there, the model was only narrating.](/blog/mcr-which-layer.svg)

Take two steps from the dating app. "Is this message a refusal to provide proof?"
is a judgment about meaning, so the model answers it. "What happens to the concern
flag on a refusal turn?" must hold every time, so code answers it. One sentence of
product policy splits across two layers, and the split is the design.

## The portfolio, sorted

Here are all thirteen systems, marked by which layer owns each system's key step
and which layers support it. A fourth column covers the systems where a person
keeps the final call.

![A grid of thirteen systems against four columns: reason, code, math and a
person. Math owns the key step in the IPL optimizer, the women's T20 oracle, the
spy-thriller POMDP oracle, the Game of Thrones oracle and the dating matchmaker.
Code owns it in the dating reply agent, the clinic chatbot, the weekly
profitability report, the routing editor, the ad-operations agent, the
graph-retrieval demo and the call-compliance detectors. The model owns the key
step only where it writes something a person reads, in the reply agent, the
clinic chatbot, the job-search agent and the ad-operations agent, and in each of
those code or a person stands after it. A person keeps the final call in the
routing editor, the job-search agent and the ad-operations agent. The
call-compliance detectors use code alone.](/blog/mcr-portfolio-grid.svg)

Two things stand out. Every selection, assignment, probability, figure and
permission in the thirteen comes from math or code, or waits for a person. Where
the model does offer a verdict, it has company:

- A job-fit call and a read on whether an ad is working both stop at a person who
  decides what to do with them.
- A concern flag on a match, and a grade on an outgoing message, both feed rules
  in code that have the last word.

And wherever the model's prose reaches someone other than the person who asked, code
or a person checks it first. The clinic's answers pass a filter, the dating
replies pass five overrides, outreach drafts wait for a person to send them, and
ads are created paused for a person to switch on.

None of this was designed top-down. Each system arrived at the split on its own,
usually after an incident. The term from the conference names a pattern that had
already shown up thirteen times.

## The family this belongs to

The idea has relatives, and most of them have a name. The table lists the closest
ones I could verify, with the result each source reports.

| Architecture | Split it proposes | Math | Code | Reason | Reported result |
| --- | --- | --- | --- | --- | --- |
| [MRKL systems](https://arxiv.org/abs/2205.00445), AI21 Labs, 2022 | A router sends each input to a neural or symbolic expert | Calculator | Symbolic experts | Router and fallback model | 1.0 addition accuracy up to nine digits after training on one |
| [PAL](https://arxiv.org/abs/2211.10435), CMU, 2022 | Model writes a program, interpreter runs it | Inside the program | Python interpreter | Decomposition | 15 points over chain-of-thought on GSM8K |
| [Program of Thoughts](https://arxiv.org/abs/2211.12588), 2022 | Separates computation from reasoning | Inside the program | Interpreter | Reasoning as code | About 12% over chain-of-thought on average |
| [Logic-LM](https://arxiv.org/abs/2305.12295), UCSB, 2023 | Model formalizes, a symbolic solver infers, errors flow back | Logic solver | Solver interface | Formalization | 39.2% over standard prompting, 18.4% over chain-of-thought |
| [Chain of Code](https://arxiv.org/abs/2312.04474), 2023 | Model writes code; lines that cannot run are simulated by the model | Partial | Interpreter | Simulates the rest | 84% on BIG-Bench Hard |
| [OptiMUS](https://arxiv.org/abs/2402.10172), Stanford, 2024 | Model formulates a mixed-integer program, a solver solves it | MILP solver | Solver code | Formulation and debugging | Over 20% better than prior methods on easy sets, over 30% on hard |
| [LLM-Modulo](https://arxiv.org/abs/2402.01817), ASU, 2024 | Model proposes plans, external verifiers check them | Verifiers | Critics | Candidate generation | Position paper |
| [AlphaGeometry](https://deepmind.google/discover/blog/alphageometry-an-olympiad-level-ai-system-for-geometry/), DeepMind, 2024 | Model suggests constructions, a deduction engine proves | Symbolic engine | None separate | Construction ideas | 25 of 30 olympiad problems; prior best 10 |
| [Thinking fast and slow in AI](https://arxiv.org/abs/2010.06002), IBM et al., 2020 | Neural System 1, symbolic System 2, a layer that chooses | System 2 | Metacognition | System 1 | Vision paper |
| [Compound AI systems](https://bair.berkeley.edu/blog/2024/02/18/compound-ai-systems/), Berkeley, 2024 | Many interacting components beat one model | Any | Any | Any | Industry framing |
| [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents), Anthropic, 2024 | Workflows on predefined code paths versus autonomous agents | None | Control flow | Agent steps | Guidance |
| [12-Factor Agents](https://github.com/humanlayer/12-factor-agents), HumanLayer | Mostly deterministic software with model steps placed inside it | None | Owns control flow | Placed steps | Practitioner guide |

Three differences matter.

**Most of these merge math and code.** PAL and Program of Thoughts put the math
inside a generated program, and the program is also the enforcement. MCR keeps
them apart, and the reason is how you test each one. Code is tested by unit tests:
this input must be refused, these shares must sum to 100.00%. Math is tested by
optimality and calibration: is this the best eleven, and do predicted 70% chances
come true about 70% of the time? A component doing both jobs gets neither test
properly.

**Several put the model upstream as the formulator.** In OptiMUS and Logic-LM, the
model writes the optimization problem or the logic program, then a solver runs it.
In most of my systems the problem is fixed in code and the model only supplies
inputs and reads outputs. That is safer for a recurring decision. Formulation by a
model suits one-off problems where nobody has written the program yet.

**The fast-and-slow analogy fits, with the model as the fast half.** In the IBM
framing and in DeepMind's description of AlphaGeometry, the neural model is the
fast, intuitive System 1, and the symbolic engine is the slow, deliberate System 2.
It is tempting to cast a model that thinks before it answers as System 2. In this
architecture it stays System 1, however long it thinks. It gives the quick, fluent
read of messy input, and the decision belongs to the slow machinery you can check.

Chain of Code is the useful counterexample. It deliberately blurs the line
between code and model, letting the model pretend to execute what the interpreter
cannot. That is a good trade for a benchmark. In a system that sends money,
messages or matches, the line is the point.

## The pattern, without cricket or dating apps

> **Math decides what is best and how likely. Code decides what is allowed and
> what is exact. The model reads what arrives and writes what leaves, and
> every decision in between is made by something you can test.**

| If you are building | Reason reads and writes | Math decides | Code enforces |
| --- | --- | --- | --- |
| **Insurance claims** | Reads adjuster notes and photos into fields; drafts the letter | Fraud likelihood, reserve estimate | Policy limits, coverage exclusions, approval thresholds |
| **Lending** | Reads bank statements and payslips | Default probability, pricing | Regulatory caps, affordability rules, adverse-action reasons |
| **Delivery dispatch** | Parses customer emails and address notes | Vehicle routing under time windows | Driver hours, vehicle capacity, restricted zones |
| **Hospital scheduling** | Summarizes referral letters | Operating room and staff scheduling | Red-flag escalation rules, consent checks |
| **Retail pricing** | Reads competitor pages and supplier emails | Price optimization against elasticity | Price floors, minimum advertised price, margin guards |
| **Contract review** | Extracts clauses and summarizes deviations | Exposure scoring across a portfolio | Playbook rules, signature authority, deadline calendaring |

Three design choices carry over to any of them.

**Make the model removable.** Build a switch that runs the system without the
model and confirm the decision is still there. If it is, the model was narrating.
If it is not, the model was deciding, and you should know which one you built.

**Put a schema at every seam.** The errors in a layered system collect where one
layer hands to another. A typed contract between the model and the solver turns a
silent misread into a loud failure at the exact step where it happened.

**Move a rule into code the first time a prompt fails to hold it.** A rule that
lives only in a prompt is a request. The first incident is the cheapest moment to
write the function, and every one of the overrides above has its incident written
next to it.

## A reference architecture

Every component here is something I have run:

- **Reason:** Claude Sonnet for extraction and writing, Claude Haiku for grading
  and short narration. Structured output forced through a schema, with one
  corrective retry before failing.
- **Seams:** Pydantic models between every agent, so a malformed handoff stops the
  run instead of flowing downstream.
- **Math:** PuLP with the CBC solver for integer programs; NumPy for vectorized
  Monte Carlo; a min-cost flow solver for assignment; NetworkX for graph problems;
  scikit-learn for Platt calibration once real outcomes exist.
- **Code:** regex gates in front of the model; pure override functions after it;
  reconciliation checks on every figure; dbt contracts and freshness tests on the
  data; a replay harness over captured production decisions for anything that
  edits configuration.
- **Orchestration:** LangGraph, with error routers that end the run before the
  narrator can write about corrupted state.
- **Record:** a runs table holding the input, the solver's decision trace and the
  narration separately, so any brief can be checked against the numbers behind it.

The things that are cheap on day one and expensive later:

1. **The no-model switch.** Retrofitting it means untangling every place the model
   quietly made a choice.
2. **Logging the decision trace before narration.** Without it, a wrong brief
   cannot be traced to a wrong number or a wrong sentence.
3. **Capturing production decisions for replay.** You cannot replay a history you
   never recorded.
4. **A name check on the narrator.** Every entity in the prose must exist in the
   trace: a few lines of code that catch the most embarrassing class of error.

## References

**Talks**

- Abhishek Upperwal, Soket AI, session at Cypher 2026, Bengaluru, October 7, 2026.
  Event coverage:
  [Cypher 2026 Day 1 highlights](https://analyticsindiamag.com/ai-features/cypher-2026-day-1-highlights-ai-moves-beyond-models-to-decisions-agents-and-sovereignty),
  Analytics India Magazine. Company research focus:
  [soket.ai](https://soket.ai/).

**Papers**

- Karpas et al., [MRKL Systems](https://arxiv.org/abs/2205.00445), AI21 Labs, 2022.
- Gao et al., [PAL: Program-aided Language Models](https://arxiv.org/abs/2211.10435), 2022.
- Chen et al., [Program of Thoughts Prompting](https://arxiv.org/abs/2211.12588), 2022.
- Pan et al., [Logic-LM](https://arxiv.org/abs/2305.12295), 2023.
- Li et al., [Chain of Code](https://arxiv.org/abs/2312.04474), 2023.
- AhmadiTeshnizi, Gao and Udell, [OptiMUS](https://arxiv.org/abs/2402.10172), 2024.
- Kambhampati et al., [LLMs Can't Plan, But Can Help Planning in LLM-Modulo Frameworks](https://arxiv.org/abs/2402.01817), 2024.
- Booch et al., [Thinking Fast and Slow in AI](https://arxiv.org/abs/2010.06002), 2020.
- Trinh, Luong et al., AlphaGeometry, as described in
  [DeepMind's announcement](https://deepmind.google/discover/blog/alphageometry-an-olympiad-level-ai-system-for-geometry/), January 2024.

**Industry and tooling**

- Zaharia et al., [The Shift from Models to Compound AI Systems](https://bair.berkeley.edu/blog/2024/02/18/compound-ai-systems/), Berkeley AI Research, 2024.
- Anthropic, [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents), December 2024.
- HumanLayer, [12-Factor Agents](https://github.com/humanlayer/12-factor-agents).

*Each layer has its own deeper post:
[min-cost max-flow picks the match](/blog/match-decisions-without-a-model-in-the-loop),
[MILP, CFR and POMDP chosen by what you cannot observe](/blog/three-ways-to-not-know-things),
[deterministic overrides after generation](/blog/deterministic-overrides-on-a-generative-agent),
[a keyword gate ahead of the model](/blog/a-keyword-scan-in-front-of-the-model) and
[a replay harness gating an agent's edits](/blog/shipping-a-rewrite-only-when-provably-identical).*
