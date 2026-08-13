---
title: Choosing a solver by what you cannot see: full information, hidden moves, hidden state
date: 2026-08-27
summary: Reach for game theory on a problem with no opponent and you have built machinery you did not need; reach for optimisation when someone is actively choosing against you and your clean optimum will not hold still. Three decision-support systems built in sequence, where the rungs are not algorithms but what you are allowed to assume you know. The most transferable finding is that picking between equilibrium concepts is a question about who commits first, and once you have both solvers, the difference between them prices the commitment.
tags: [decision-systems]
---

I built three decision-support systems in a row without meaning to build a
sequence. Each one started because the previous one made an assumption I could no
longer make.

Read together they are a ladder, and the rungs are not about algorithms. They are
about **what you are allowed to assume you know**.

## The ladder

![Three rungs. The lowest assumes you see the whole state and only you choose,
solved with integer programming and Monte Carlo. The middle drops the assumption
that you see the other side's move, solved with counterfactual regret
minimisation. The top drops the assumption that you see the state at all, solved
with point-based value iteration over belief states and a leader-follower
equilibrium.](/blog/oracle-ladder.svg)

Each rung keeps everything beneath it. Monte Carlo appears in all three. What
changes is what you may assume before you run it.

## Rung one — you can see everything

The first system picks a cricket team. Full information: every player's record is
public, the conditions are known, and nobody is hiding anything.

That makes it an optimisation problem rather than a game. Integer programming
selects the eleven under the real constraints — role coverage, overs available,
squad rules — and Monte Carlo estimates how often that eleven wins.

Three details worth carrying forward.

**A second optimisation predicts the opponent's team.** If they are also picking
optimally, you can model that, and then pick against their likely eleven rather
than against an average one.

**The selection is made robust rather than optimal.** Rather than trusting every
form estimate equally, the model protects against a bounded number of the most
uncertain opponent players simultaneously underperforming your expectation. You
give up a little expected value for a solution that does not collapse when a
couple of estimates are wrong. This is the single most transferable idea in the
project — most real optimisation problems are fed by estimates, and the naive
optimum is usually fitted to noise in those estimates.

**Form is a posterior, not an average.** A conjugate update over recent
performances, with sampling used to explore rather than always picking the current
best. And once enough real outcomes have been recorded, the probability outputs
get recalibrated against them, because a simulator that says 70% should be right
about seven times in ten.

The optimiser and the simulator also talk to each other: a bounded swap search
feeds candidate elevens back through simulation, accepting a change only when it
improves the win estimate by more than a set threshold, for at most a few rounds.
That loop stops the optimiser from being confident about an objective the
simulation disagrees with.

## Rung two — you cannot see what they chose

The second system moves to a setting where the other side is choosing at the same
time as you and you do not see their choice.

Optimisation no longer applies. There is no best move, only a best *distribution*
over moves — and if you always pick your strongest option, you become predictable
and therefore beatable.

The solver is counterfactual regret minimisation: play the game against itself
many times, track how much you regret not having played each alternative, and
adjust toward the ones you regret not playing. It converges to a strategy that is
hard to exploit, and it reports how exploitable it still is, which is a genuinely
useful thing to be able to state.

Two additions that made the output more honest than the maths alone:

**Opponents are modelled as people, not as expected-value maximisers.** Each
adversary carries their own loss aversion and their own distortion of small
probabilities, using the rank-dependent form of prospect theory rather than the
simplified version. That matters because the whole point is predicting what
someone will actually do, and people systematically overweight small chances and
feel losses more than equivalent gains.

**When there is only one opponent, the system skips the game theory entirely** and
solves it as a straightforward sequential decision problem. Regret minimisation
is the right tool for a genuine multi-party standoff and unnecessary machinery for
a two-party one.

The single best piece of code in the whole set lives here: a function that, given
a decision that turned out badly, reports *which behavioural distortion explains
it*. Not that the decision was wrong — which specific modelled bias produced it.
That is the difference between a model that scores things and a model that
explains itself.

## Rung three — you cannot see the state

The third system removes the last assumption. You no longer observe the world
directly; you get noisy signals and must act on a belief about what is true.

Planning now happens over belief states rather than states, and the exact solution
is intractable as the state space grows — so it uses a point-based approximation:
sample a set of representative beliefs, iterate value estimates over those, and
accept a good policy instead of an optimal one.

**And the equilibrium changes.**

![In a simultaneous game neither side sees the other's choice. In a leader-follower
game the leader commits first and is observed doing it, which is often worth more.
Subtracting one value from the other prices the
commitment.](/blog/commitment-value.svg)

Rung two assumed both sides choose blind. That was wrong for this domain: a
planner commits to an approach before the person carrying it out ever acts, and
that commitment is visible. So the solver moves from a simultaneous equilibrium to
a leader–follower one.

Committing first sounds like a disadvantage. Frequently it is not — a credible
commitment changes what the other side finds worth doing. And because you can
compute the leader's value under both, you can subtract them and get **the price
of committing early as a single number**, which a planner can weigh against the
flexibility they gave up.

That is the finding I would keep from all three projects. Choosing between
equilibrium concepts is a modelling decision about *who actually moves first*, not
a mathematical preference — and once you have both solvers, the difference between
them is itself a useful output.

Two smaller mechanisms here are more broadly applicable than the game theory:
classical critical-path scheduling with three-point estimates over the task graph,
which surfaces where the slack is; and ranking candidate observations by how much
uncertainty each would remove, so the planner knows *which question to ask next*.
That second one — value of information — is underused almost everywhere.

## The invariant

Across all three, the language model never decides anything. It writes the
explanation after the solver has produced the answer.

Same input state, same recommendation, regardless of which model is loaded or what
temperature it is set to. The prose changes; the decision does not.

I did not set out to make that a principle. It happened because the interesting
part of each project was the formulation, and once the formulation exists, asking
a language model to second-guess it is strictly worse than reporting it. I later
found the same conclusion argued from production experience by teams at several
conferences, and wrote about that in
[match decisions without a model in the loop](/blog/match-decisions-without-a-model-in-the-loop).

## Two honest caveats

**One of these systems models covert operations, and I have framed that carefully
here.** It is built as a fictional planning exercise, but the technique — treating
adversarial planning as an optimisation over beliefs — describes real activity
with real consequences. I have kept the description at the level of method. It
also refuses, structurally and at several independent entry points, to plan from
the adversary's side, with no flag to turn that off. That refusal is part of the
architecture rather than a policy note, which is the only version of such a
constraint I trust.

**The design documents oversell in one place.** One project's write-up discusses
causal inference and evolutionary dynamics at length. Neither is implemented —
there is a schema and a rollout function, and no operator that would make the
causal claim true. I am flagging it because I wrote those documents, and a design
note describing an aspiration in the present tense is a small dishonesty that
compounds.

## The pattern, without cricket or spies

> **Pick the solver by asking what you cannot observe.** Full observability and a
> single decision-maker is an optimisation problem. Hidden simultaneous choices is
> a game. A hidden state is a planning problem over beliefs. Getting this wrong
> means using elaborate machinery on a problem that did not need it, or a clean
> optimum for a situation that will not hold still.

| What you cannot see | The problem you actually have | Real examples |
| --- | --- | --- |
| Nothing — full information | Constrained optimisation, robustified against estimate error | Rostering, network design, portfolio construction, scheduling |
| The other party's simultaneous move | A game; you need a distribution over actions | Pricing against a competitor, auction bidding, fraud versus fraudster |
| The state itself | Planning over beliefs, plus value of information | Medical diagnosis and testing, predictive maintenance, exploration, security monitoring |
| Who moves first is unclear | Compute both equilibria and price the difference | Regulatory commitment, published pricing, capacity announcements |

Three transfers:

**Robustify rather than optimise when your inputs are estimates.** Protecting
against a bounded number of simultaneous bad estimates costs a little expected
value and removes most of the fragility. Almost every optimisation fed by a
forecast should do this and almost none do.

**Ask who commits first before choosing an equilibrium.** It is the question that
determines the solver, and it is a fact about your domain that you probably
already know.

**Rank your next observation by uncertainty removed.** If you can act to learn as
well as act to achieve, the choice of what to learn deserves the same rigour as
the choice of what to do.

## References

| Source | Event | Recording |
| --- | --- | --- |
| Intelligence in structure, not policy — structured methods benchmarked against learned ones | [MLDS 2026](https://mlds.analyticsindiamag.com/), Mar 2026 | Not published |
| Deterministic coordination of a multi-agent system | [Data Engineering Summit 2026](https://des.analyticsindiamag.com/), May 2026 | Not published |
| Constraints beat cleverness: the model for reasoning, not enforcement | [MLDS 2026](https://mlds.analyticsindiamag.com/), Mar 2026 | Not published |
| Full hall recordings across three days | [CYPHER 2025](https://cypher.analyticsindiamag.com/), Sept 2025 | [Day 3, Hall 3](https://www.youtube.com/watch?v=o9nrXPslI3Y) |

*Source for the first and second systems is public:
[ipl-oracle](https://github.com/sreme19/ipl-oracle) and
[got-oracle](https://github.com/sreme19/got-oracle).*
