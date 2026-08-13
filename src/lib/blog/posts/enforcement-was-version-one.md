---
title: Enforcement was version one, fairness was version four
date: 2026-08-16
summary: I built a productivity measurement system for a distributed team, with a five-step consequence ladder ending in exit. The ladder worked from the first day. The component that would have made the comparisons fair was version four, and its design was never written.
tags: [operations]
---

At some point I needed to know who on a distributed engineering team was
delivering and who was not. The team spanned three countries, everyone worked
remotely, and I could not see any of it. So I designed a measurement framework and
rolled it out.

It had four planned versions and a five-step consequence ladder. The ladder was
usable from day one. The version that would have made the numbers comparable
between people was the fourth, and I never specified it.

That ordering is the whole post. Everything else here is detail.

## The four versions

| Version | What it measures | Status at rollout |
| --- | --- | --- |
| v1 | Tickets completed per sprint | **Active** |
| v2 | Time to completion, and movement through stages | Upcoming |
| v3 | Story points, capped at 4 per ticket | Future |
| v4 | Technical complexity layer on top of points | Future — *framework TBD* |

The sequence is defensible as engineering. You cannot measure cycle time before
work is consistently ticketed, and you cannot weight by complexity before there is
a size unit to weight. Count, then time, then size, then difficulty. Each version
needs the one before it.

The v3 rule I still like: no ticket may exceed four story points, where two points
means up to two hours and four means up to four. Anything larger must be
decomposed. That is not really an estimation rule, it is a decomposition rule
wearing estimation's clothes, and it does something valuable — it forces the
ambiguity out of a large task at planning time instead of at the end of the sprint.

But look at the right-hand column. At the moment the framework went live, the only
thing being measured was *how many tickets you closed*. And the ladder was already
attached to it.

## The ladder

Five steps, applied when someone was consistently not driving sufficient outcomes
as shown by the ticket data:

1. Documented conversation, with a specific expectation set
2. Formal written warning, with an improvement timeline
3. Structured performance correction with measurable output targets
4. Financial consequence — compensation adjustment or contract reduction
5. Exit, requiring sign-off from the CEO

I do not think a consequence ladder is wrong. It is better than the alternative
most distributed teams run, which is a vague accumulation of disappointment
followed by an abrupt termination that surprises the person receiving it. Every
step above is written down, sequenced, and reaches a financial consequence only
after two documented conversations and a correction plan. Someone on step one
knows they are on step one.

The problem is not the ladder. The problem is what it was reading from.

## "No ticket, no work" is a definition, not a measurement

The core rule was stated plainly: work done without a Jira ticket does not count
toward productivity measurement.

As an operational instruction that is sound — undocumented work is invisible to
planning, and a team that tickets nothing cannot be coordinated across time zones.
I would give the same instruction again.

As a *measurement* it does something else entirely. It does not measure work. It
redefines work as the subset of work that happened to be ticketed, and then reports
on that subset with total confidence and no marker indicating what it excluded.

Consider what falls outside. Someone interrupts you to ask why a pipeline broke,
and you find it in twenty minutes. A colleague is stuck and you spend an afternoon
unblocking them. A number looks wrong, you chase it, and it turns out to be fine —
real work, correctly performed, producing no artefact. Someone asks a question in a
direct message that takes an hour to answer properly.

None of that becomes a ticket in practice, however much the policy says it should.
And it does not distribute evenly across a team. It concentrates on whoever is most
senior, most helpful, and most trusted — which is to say the framework
systematically under-counts exactly the people you can least afford to lose.

This is the same failure I have written about
[in a completely different context](https://sree.riteangle.dating/what-it-takes-to-measure-one-tap):
a pipeline that was correct from the first day, reporting confidently on a subset,
labelling everything identically, with nothing in the output disclosing what it
never saw. Every conversion I had was tagged with the same placeholder and the
dashboard looked fine. Every developer's month was summarised by ticket count and
the report looked fine.

## The exemption list was doing the work the metric couldn't

Written into the framework document is an acknowledgement that the metric is not
comparable between people. Not all work is equal; high-complexity contributors
should be given more flexibility on output volume and evaluated differently. Three
people were named as high-complexity. Everyone else, the document says, carries
primarily routine workloads and should be evaluated on ticket throughput more
directly.

I want to give that its due before criticising it. Writing the exemption down is
better than the usual move, which is to publish a single number and let managers
quietly apply their own adjustments in private. At least this way the adjustment is
legible, and someone reviewing a decision can see that a comparison was not
apples-to-apples.

But look at what it actually is. **The fairness correction existed as a
hand-maintained list of three names, rather than as a property of the
instrument.** That is precisely what v4 was supposed to fix, and v4 had no
framework. So the exemption list was not a stopgap on the way to a complexity
score. It *was* the complexity score, implemented as an unversioned side channel,
with no record of who added a name or when or on what basis.

I have written about the same shape in
[an allocation system](https://sree.riteangle.dating/routing-decisions-without-a-model-in-the-loop)
where the routing weights lived in a hand-maintained spreadsheet, and the failure
mode was not the weights but that their history was unrecoverable. A cap change
nobody logged became an incident. Here the analogous change is someone quietly
being on or off a list that determines how their output is read, and there would
have been no way to reconstruct it either.

If a metric requires an exemption list to be fair, the exemption list is the real
specification. Mine was three names in a paragraph.

## A monthly ranking over eight people

The review model asked for a monthly report covering tickets completed per
developer, the distribution across the team identifying high and low performers,
and anyone not creating tickets at all. The stated purpose was to build a
performance curve that makes underperformance visible over time.

The third item is genuinely useful and needs no statistics: someone creating no
tickets is a compliance fact, not a performance measurement, and you should know.

The curve is another matter. The team was single digits. Ranking eight people by
monthly ticket count, where tickets are capped at four points and the complexity
weighting does not exist, produces a distribution whose spread is mostly a
function of what kind of work happened to land on whom that month.

I have a rule for this on my own dashboards now, and I wrote it down as a hard
constraint: no percentage below thirty observations, because two things with four
observations each will differ by 50% for no reason, and showing that invites a
decision the data cannot support. A monthly ranking of a small team is that
situation exactly. I enforced the rule on advertising numbers, where the stakes are
a budget. I did not enforce it on people, where the stakes are somebody's
compensation.

## The decision I would defend without qualification

There was a desktop activity monitor running, producing a figure for productive
hours per day against a baseline of about six and a half. Alongside it, Slack
activity.

The framework demotes both explicitly: use as corroborating evidence only, and
neither replaces the ticket data as the primary signal.

I think that is right and I would do it again. Not because activity monitoring is
inaccurate — it is quite accurate about what it measures — but because of what it
does to the relationship. A ticket count is a number the person being measured can
see, predict, and dispute. They know what raises it. An hours-active figure derived
from keyboard and window telemetry is a number that happens *to* them, generated by
software they did not choose, measuring a proxy nobody believes in. Making it
primary buys a small amount of signal for a large amount of trust.

There is a general form of this that shows up all over my work now. In riteangle a
validator model may block another model's output but is
[forbidden from editing it](https://sree.riteangle.dating/a-safety-validator-that-is-also-a-model),
because a silent rewrite puts words at two removes from the person they are
attributed to. Same species of rule: a constraint on what a system is permitted to
do with evidence it is fully capable of acting on. The capability is not the
question. The standing is.

## What I never measured

| Question | Status |
| --- | --- |
| Did ticket throughput actually rise after rollout? | **Unmeasured.** No baseline was captured before v1. |
| Did the monthly curve ever change a decision? | **Unknown.** The report was specified; nothing records whether it was produced or read. |
| Did anyone reach step 3, 4, or 5 on the basis of ticket data? | **Not recorded** anywhere I can find. |
| Was the exemption list ever revised? | **No mechanism existed** to record a revision. |
| Did the framework reach v2? | **Unknown to me.** I handed it over and asked the incoming owner to maintain momentum, not redesign it. |

That last instruction is worth sitting with. I handed someone a framework I knew
was incomplete — one live version out of four, fairness deferred, consequences
attached — and told them explicitly to maintain it rather than change it. I framed
that as protecting the rollout from being relitigated, and there is a real argument
for that: a measurement system that changes every quarter measures nothing.

But I had also just removed the only person who knew which parts were provisional.

## What I would do differently

**Ship the complexity layer in v1, or don't rank.** Not the elaborate version — a
crude one. Two tiers, routine and non-routine, assigned per ticket at planning time
by the person who scoped it. That is enough to stop the comparison being nonsense
and it costs one dropdown. Absent that, publish per-person counts to the person
themselves and to nobody else, and do not draw a curve.

**Put the exemption list inside the metric.** If three people are evaluated
differently, that is a field on a person's record with a date and a reason, not a
sentence in a document. The test is whether someone could later ask "when did I
stop being evaluated on throughput, and who decided that" and get an answer.

**Attach the consequence ladder to the version that can support it.** The ladder
should have been gated on v3 at the earliest. What was live at rollout — a raw
count of variably-sized tickets over a single-digit team — can support a
conversation. It cannot support step four.

The framework was better than the nothing it replaced, which is the defence I
would actually make for it. But the thing I got wrong was not a modelling error. It
was a sequencing error, and it went in the direction that sequencing errors usually
go: the part that creates consequences for other people shipped first, and the part
that would have made those consequences fair was scheduled for later and never
written.
