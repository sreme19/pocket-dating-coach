# Networking Mode ("Seasons") — Design

**Status:** Spec (v0.1), **no code yet** · **Date:** 2026-07-24 · **Branch when built:** `development` → Firebase tester build

## Story / goal

People move through **emotional seasons**. Someone fresh off an ugly break-up, or just
fatigued by the grind of dating, often wants to *meet people with zero romantic pressure* —
networking, friendship, no signal that they're "on the market" — while staying on the
platform. That vibe may later evolve back into dating. Today the only options are "keep
dating" or "leave." Networking Mode gives them a **third door: pause the romance without
leaving**, and reopen it whenever the season changes.

We are uniquely placed to do this well because the AI companion (Bestie for women, Wingman
for men) can hold the boundary *socially and warmly* — so it never feels like a cold filter.

## Core model — a "season," not an engine filter

Networking is a **per-user global flag** ("season") that does exactly three things:

1. **Repaints the app** — the whole skin flips pink → teal, plus a persistent "Networking
   season" banner. (See *Reskin*.)
2. **Reprograms the AI companion** — the Bestie/Wingman is told the owner is in a networking
   season and behaves accordingly (announces intent to matches, keeps threads platonic,
   de-ranks pushers). (See *AI behaviour*.)
3. **Adds same-gender networkers to Discover** — the only change to *who* appears.

It does **not** hide opposite-gender profiles, does **not** rewrite the matching engine, and
does **not** try to broker the romance transition — **romance evolves offline**, by the two
people, not by the app.

## Decisions (locked 2026-07-24)

- **Name:** "Networking" (kept, over Connect/Friends/Social).
- **Straight-only for MVP.** Same-gender visibility safely means "networking intent." Queer
  intent (date vs network with same gender) is **deferred** — it needs an explicit intent
  flag, not the gender heuristic.
- **Protection is social, via the AI (advise + de-rank), not screen-filtering.** The owner
  still sees every message; Bestie/Wingman reframes, coaches, and de-ranks — it does **not**
  hold/screen messages (that heavier "buffer" model was rejected for MVP).
- **Same-gender networkers are additive to Discover** (a networking woman also sees other
  networking women; a networking man sees other networking men).
- **Romance evolves offline** — no in-app "upgrade this connection to dating" mechanic.
- **Reskin = global teal accent + mode banner** across Discover / Chat / Profile (not a full
  bespoke palette per surface; a CSS-var / theme swap).
- **Symmetric across genders** — a man's Wingman gates women identically.
- **Return-to-Date is opt-in-to-notify** — on flip back, the AI *asks the owner first*
  ("want me to tell your active networking contacts you're open to dating again?") rather
  than auto-broadcasting; scope = people they actually talked to.
- **De-ranking is local** to the owner's own inbox; it does **not** dent the other person's
  global trust/standing. Genuine harassment still routes to existing Block / Report / Unmatch.
- **Networking cards** drop the romantic compatibility % and swap the "🌹 Admire" action for
  "🤝 Connect" (Tip and Next stay).
- **A subtle "Networking season" badge** shows on the owner's profile/card so intent is clear
  *before* anyone messages.
- **Switch-back nudge is mild** — at most ~once / 2 weeks, only after positive engagement,
  with a permanent "don't suggest again" off-switch.
- **Default season for everyone = Date.** Networking is opt-in.

## Visibility matrix

Two independent layers: **who you can see** (Discover) and **how romance is gated** (AI).

### Who appears in Discover

| Viewer | Sees opposite gender | Sees same gender |
|---|---|---|
| **Date** season | ✅ all (unchanged) | ❌ never (unchanged) |
| **Networking** season | ✅ all (unchanged) | ✅ **only those also in Networking** |

- Opposite-gender visibility is **untouched** by season — nobody gets hidden.
- Same-gender visibility requires **both** the viewer and the target to be in a Networking
  season (mutual). A Date-mode user is never shown same-gender profiles, and is never shown
  *to* networkers as a same-gender card.

### How a connection is gated (orthogonal to visibility)

The gate follows the **season of each participant**, applied by *their own* AI:

| Pair | Nature | AI behaviour |
|---|---|---|
| Both Date (cross-gender) | Dating | Normal romantic Bestie/Wingman (today). |
| Either party in Networking (cross-gender) | Networking | The networking party's AI announces "networking-only right now — if that changes you'll be notified," keeps it platonic, de-ranks the other in the networking party's inbox if they keep pushing romance. |
| Both Networking (same-gender) | Networking | Inherently platonic (straight-only). AI is a "networking buddy" — no romance angle at all. |

**Key generalisation:** *your season governs how your AI represents you and what advances it
tolerates on your behalf.*

## AI companion behaviour (Bestie / Wingman)

Same character, "networking hat." Grounding is injected as **season context** in the existing
Bestie/Wingman prompt assembly — no new agent, no new pipeline.

- **Announce intent, warmly & once:** when a match opens or the AI speaks first, it discloses
  the owner's networking season to the other party in-thread (e.g. *"heads up — Priya's in a
  networking season right now, so keeping things friendly. If that changes, you'll be the
  first to know."*).
- **Keep it platonic:** reframe romantic openers toward networking substance; don't flirt on
  the owner's behalf.
- **De-rank persistent pushers:** after the owner's networking intent has been stated, if the
  other party keeps steering romantic, sink them in the owner's inbox (local only).
- **Mild switch-back nudge:** occasionally (cap ~1 / 2 weeks, gated on positive engagement)
  the AI may gently note the owner *can* switch to Date any time via Discover. Honour a
  permanent "don't suggest again."
- **Return-to-Date consent:** on flip back to Date, the AI asks the owner whether to let their
  active networking contacts know they're open to dating again. Never auto-broadcast.
- **Same-gender networking threads:** pure networking-buddy tone; the AI helps with intros,
  shared interests, follow-ups — never romance.

## Reskin — Date (pink) vs Networking (teal)

Applied globally by toggling a mode attribute that swaps the CSS custom properties (web:
`:root[data-mode="networking"]` overriding `src/app.css` accent/bg vars; Flutter: a second
`ThemeData` in `config.dart` selected by the flag). Color is **never the only** signal — the
banner text + icon carry it for accessibility.

| Token | Date (romance) | Networking (proposed) |
|---|---|---|
| `--accent` | `#FF3B6B` | `#0E9AAE` (teal) |
| `--accent-bright` | `#E11D54` | `#0A7C8C` |
| `--accent-dim` | `#7A1133` | `#0A3B44` |
| `--accent-tint` | `rgba(255,59,107,.12)` | `rgba(14,154,174,.12)` |
| `--accent-glow` | `rgba(255,59,107,.35)` | `rgba(14,154,174,.32)` |
| secondary | `#FF7A4D` (coral) | `#5AA9E6` (sky) |
| `--bg-1` (page) | `#FFF3F0` (blush) | `#EDF6F7` (teal mist) |
| `--bg-3` | `#FBE9E6` | `#DCEDEF` |
| `--border-1` | `#F1E0E3` | `#D3E7EA` |
| text / success / amber | unchanged | unchanged (success `#15B86B` stays legible on teal) |

- **Toggle:** a pill segmented control top of Discover — `💬 Networking ⇄ 🌹 Date`.
- **Banner:** slim persistent bar under the header while in Networking — *"Networking season —
  no dating pressure. Switch to Date anytime."*
- **Transition:** short cross-fade of the accent on flip.

## Data model (proposed — build-time detail)

- **`verified_vibe_users.discovery_mode`** `text` `default 'date'` CHECK in
  (`'date'`,`'networking'`); `discovery_mode_changed_at timestamptz`. Source of truth.
- Mirror to **`vv_pool_profiles`** (the discovery/matcher reads the pool) so the feed query
  can branch without a join.
- **Discovery feed query:** existing opposite-gender query **unioned** with a same-gender
  branch guarded by `viewer.mode = 'networking' AND target.mode = 'networking'`.
- **`verified_vibe_matches.connection_type`** derived at read-time from the two participants'
  current modes (either networking ⇒ `networking`; else `date`) — governs AI framing + card
  verbs. Avoid storing a stale snapshot.
- **Same-gender match lifecycle:** a same-gender networking match exists only while *both* are
  networking; if one flips to Date, hide it (reversible, like soft-unmatch) rather than delete.
- **De-rank:** a per-match, per-owner signal (e.g. `romantic_pressure_count`, `deranked_at`)
  used only in that owner's inbox sort. Never touches global trust/standing.
- **Season history** (emotional-season analytics): deferred.

All additive, non-breaking; keep the `verified_vibe_*` ids/routes (rename user-facing text
only, per brand rules).

## Phased MVP scope

**Phase 0 — Spec (this doc).**

**Phase 1 — Thin slice that tests the hypothesis** *(does a no-pressure season retain fatigued
users instead of churning them?)*:
- `discovery_mode` flag + Discover toggle (web + Flutter).
- Global teal reskin + banner (CSS-var / theme swap).
- Same-gender additive visibility in the discovery feed (both-networking).
- AI grounding: season context in Bestie/Wingman prompts (announce, platonic, buddy tone).
- Networking card treatment: Admire→Connect, hide romance %, "Networking season" badge.
- Safety: confirm Block/Unmatch are mode-agnostic; add a "using networking to hit on me"
  report reason.

**Phase 2 — Enforcement & lifecycle:**
- AI de-rank on persistent romantic pressure + inbox re-sort.
- Return-to-Date "want me to tell your contacts?" consent flow.
- Switch-back nudge cadence + permanent opt-out.
- Networking "shared interests" chip in place of the romance %.

**Phase 3 — Later:**
- Season history / analytics.
- Same-gender networking compatibility model.
- Networking-specific profile fields / photo norms.
- Queer intent flag (unlocks non-hetero networking/dating separation).

## Safety

- **Blocks/Unmatch are mode-agnostic** — a block holds across both seasons (no re-approaching
  a rejecter under a "just networking" pretext).
- **New report reason:** "using networking to hit on me."
- **De-rank ≠ punishment** — it protects the owner's inbox locally; real abuse escalates to
  the existing Report/Block flow.
- The networking badge discloses the owner's season to matches — acceptable because it is a
  boundary the owner opted into, and disclosure is contextual (AI in-thread) + a subtle badge.

## Open questions (resolve during build)

- **Liquidity:** women↔women networking supply is thin at current cohort (~30F/100M target).
  Messaging when the same-gender pool is near-empty.
- **Networking compatibility:** does same-gender networking need its own score, or is
  recency + shared-interests enough for MVP? (Lean: shared-interests, no score.)
- **Photo norms:** are AI-stylised men's portraits right for networking, or does networking
  want a more "real/professional" photo? (Lean: keep current for MVP.)
- **De-rank trigger:** heuristic vs light classifier for "persistent romantic pressure."
- **Feature discovery:** should a Date-mode user ever be *told* Networking exists, and if so,
  how (without nudging a happy dater or a sad one badly)?
