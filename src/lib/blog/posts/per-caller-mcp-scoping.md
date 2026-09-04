---
title: Five agents reading one personal corpus, and the per-caller MCP projection that stops the public one from seeing the private nine tenths
date: 2026-09-04
summary: Five agents on my laptop needed the same 37,327-chunk document store, and one of them publishes to the open web. Auditing it first, 83% turned out to belong to a former employer. The fix was one MCP server with five surfaces, where the view of the corpus is bound to which agent is calling rather than to an argument it passes: the blog-facing surface sees 1,955 chunks, and asking it for more returns the same 1,955.
tags: [mcp, agents, retrieval, data-boundaries]
draft: true
cover: /og/blog/per-caller-mcp-scoping.png
---

I had five agents on one laptop, each in its own repository, and all five wanted
the same thing: a local document corpus of 41,128 chunks built from years of work
notes. One writes résumé material. One prepares fundraising conversations. One
drafts posts for this blog. Two handle ad operations and store releases.

Before wiring any of them up, I counted what was actually in the store. 37,327
chunks sit in the partition labelled safe for retrieval, and **31,097 of those,
83%, are a former employer's internal files**. Professional, unremarkable, and
not mine to quote anywhere.

That number is the whole post. The corpus already had a three-tier sensitivity
classifier, and it could not answer the question I was asking, because a
sensitivity label says how private a document is and never says whose it is.

## The failure a shared handle produces

The tempting design is one retrieval tool, mounted by everyone, with a filter
argument. It fails in a specific way worth showing on both sides.

Working as intended, the blog agent asks for something and passes the narrow
view:

```
corpus_search(query="retrieval architecture", projection="public")
→ 3 chunks, all from my own repository READMEs
```

Failing, the same tool, one argument different:

```
corpus_search(query="retrieval architecture", projection="full")
→ 3 chunks, two of them from a former employer's design docs
```

Nothing errored. No score dropped. The second call is not an attack; it is a
model choosing a plausible argument, and the argument happened to be the security
boundary. A filter is a suggestion when the caller supplies it.

## Binding the view to the caller

The server takes the audience as a launch argument, not a call argument. Each
consuming repository mounts its own instance:

```json
{ "mcpServers": { "commons": {
    "command": "/Users/me/.local/bin/commons-mcp",
    "args": ["--audience", "blogging"] } } }
```

The tool schema exposed to that session has no projection parameter at all. The
projection is looked up from the audience the process was started with, and the
audience is fixed by which repository the session is rooted in.

Measured, over the live corpus:

| Surface | Chunks visible | Share | Former-employer chunks |
|---|---|---|---|
| owner | 37,327 | 100% | 31,097 |
| fundraising | 5,287 | 14.2% | 0 |
| public / blog | 1,955 | 5.2% | 0 |

The adversarial check is the one worth running, and it takes a minute. Send the
narrow surface a `projection: "full"` it has no business asking for:

```
[blogging] corpus_search(query="…", projection="full")
→ "projection: public — blogging-agent (published to the open web)"
→ 1,955-chunk view, unchanged
```

The argument is dropped because it is not in the schema. There is nothing to
override.

## Allowlists, because a synced folder grows on its own

The projections name what a surface may see rather than what it may not. That
choice matters less on day one than in month three: a synced drive folder gains
contents without anyone deciding it should, and under a blocklist the new
material is visible until someone notices. Under an allowlist it is invisible
until someone names it.

Concretely, the public surface names my own repository documentation and one
product folder. Everything else in the store, including roughly 700 chunks I
could not confidently classify, is outside it and stays outside it.

## The trade-off I kept: writes do not go through the protocol

Four write paths cross between these repositories, and none of them is an MCP
tool. Two append through the owning repository's own command-line interface. Two
open a branch and a pull request.

This is a deliberate asymmetry rather than an omission. A read that goes wrong
shows you something you should not have seen. A write that goes wrong changes
someone else's repository, and in this case a push to the wrong branch deploys a
production web app and builds a store binary. A tool description is exactly the
kind of thing a model can be argued into calling, so the writes sit somewhere a
description cannot reach.

## The guard that could not run

The branch-and-pull-request tool enforces a path allowlist. Its first version
refused to do anything if any file outside that allowlist had been modified,
which sounded strict and correct.

Then I ran it against the real repository, which carries 140 uncommitted files in
ordinary use. It refused, correctly by its own rules, and would have refused
every time forever.

**A safety check that cannot run is not a safety check.** The working version
stages an explicit list and reports what it left alone. That is both usable and
stricter about what actually reaches a commit, because explicit staging is the
property that matters and refusing on a dirty tree never was.

## Beyond one laptop and one corpus

> When several callers share a store, the safest scope is the one they cannot
> name. Bind it to who is asking, and there is no argument left to get wrong.

| Setting | The shared store | What the narrow caller must not see |
|---|---|---|
| Support tooling | The ticket history | Other customers' tickets in the same thread |
| Clinical software | The patient record | Anything outside the treating clinician's episode |
| Recruiting | The candidate pipeline | Compensation and internal scoring, shown to the hiring manager |
| Financial services | The client book | Positions belonging to another adviser's clients |
| Internal search | The company wiki | Board, legal and people documents in the same index |
| Data platforms | The warehouse | Base tables, where an aggregate view is what was promised |

**Make the scope a property of the connection, not of the request.** If a caller
can name its own permission level, that level is advisory. Put it in the server
launch, the connection string, or the role, and the schema the caller sees will
not contain a way to ask for more.

**Audit ownership before sensitivity.** Classify who a document belongs to before
deciding how secret it is. My store had a working privacy classifier and still
could not distinguish my own writing from an ex-employer's, because those are
different axes and only one of them was modelled.

**Run the guard against a real working tree on day one.** Not a fixture, not a
clean checkout. The dirty-tree failure above cost ten minutes to find by running
it and would have survived any amount of reasoning about it, because the
behaviour was correct and the situation was not one I had pictured.
