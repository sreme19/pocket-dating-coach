# AI Bestie ↔ Man Thread — Design Gap Inventory (Flutter / Android)

**Locked:** 2026-06-26
**Surface:** `mobile/lib/conversation_screen.dart` — the man's view of a `Bestie ↔ man` thread.
**Repro:** profile owner = Chris (man) viewing his match Mekhala (woman), Bestie active.

## Headline gap
The screen tells the man two contradictory things at once. The header says **"Mekhala · Away"** with Mekhala's face (= "you're messaging Mekhala, she's not here"), while the body is an AI replying instantly. The only things reconciling that are one 11px gray caption ("Mekhala's AI Bestie") and a sentence the model happened to write. Every persistent UI element (header, avatar, presence) says "this is Mekhala" — the opposite of the truth.

## Inventory

| # | Gap | Problem | Why it matters | Code |
|---|-----|---------|----------------|------|
| 1 | Misleading header identity | Header = match name + her photo while talking to her Bestie | Breaks spec rule "man always knows up front he's talking to her Bestie" | `conversation_screen.dart:411–444` |
| 2 | "Away" presence is a lie | Gray dot + "Away" while the AI answers in ~1s | No "AI Bestie · active" presence state; human online/away is wrong signal | `:429,442` (`_partnerOnline`) |
| 3 | No intro / transparency card on mobile | Disclosure baked into AI's first message prose only | Web has structured persistent `bestie-intro-card`; mobile's is model-generated → not guaranteed, scrolls away | web `…/chat/[conversationId]/+page.svelte:1467`; absent in Flutter |
| 4 | No path-planning / "joins in N/5" progress | Nothing shows progress toward Mekhala stepping in | Web shows "joins in · N/5 cleared" star bar — the gap-filling motivator. Mobile drops it | web intro card; absent in Flutter |
| 5 | Giant empty void above first message | ~60% blank cream on sparse threads | Reads as broken; no empty-state framing | bottom-anchored list, no intro card |
| 6 | Bestie reuses the woman's real face in-thread | Bubble avatar = Mekhala's photo, not a distinct Bestie avatar | Reinforces the "this is Mekhala" illusion; `BestieAvatar` exists but unused in-thread | `_Bubble` (`otherAvatar`) |
| 7 | Weak AI visual distinction | AI bubble = light-pink + 11px gray label only | No sparkle/icon/system styling on the bubble itself | `_Bubble:616–693` |
| 8 | No explicit hand-off notice | Nothing says "you're now talking to Mekhala directly" on hand-off | Spec §C9 requires explicit, never-silent hand-off; today only the label silently flips | none exists |
| 9 | Wingman assist icon unlabeled & off-palette | Purple ✨✨ at composer-left, no label | His only inline coaching affordance is undiscoverable + lone purple in a pink screen | `_Composer` |
| 10 | Voice CTA competes with composer | Full-width pink→purple "Voice chat…" pill permanently between thread and input | Heavy always-on CTA in prime real estate | `_BestieCallBanner:531–577` |

## Severity
- **Substantive (transparency/compliance):** 1, 2, 3, 8
- **Layout/empty-state:** 4, 5
- **Polish/distinction:** 6, 7, 9, 10

## Fix sequencing
**Pass 1 — SHIPPED** (build 1.0.5+22, commit 98290ec): Gaps 1, 2, 3, 4, 5 — gave the Bestie a first-class identity in the man's thread: header active state (sparkle badge + "AI Bestie" subtitle) and the ported web intro card with N/5 progress.

**Pass 2 — SHIPPED** (build 1.0.5+23): Gaps 6–10 —
- 6: AI-message avatar keeps her photo but carries a sparkle badge (distinct from her direct messages).
- 7: AI sender label gets a sparkle + pink/bold treatment vs gray for human messages.
- 8: explicit, never-silent hand-off banner for the man ("You're now talking to {name} directly") once she steps in (spec §C9).
- 9: fixed the man's-advisor mislabel (composer + suggestion sheet said "AI Bestie" → now "AI Wingman") and made the composer button a discoverable labeled "✨ Wingman" pill.
- 10: voice-call CTA now only shows while her Bestie is the active proxy.
