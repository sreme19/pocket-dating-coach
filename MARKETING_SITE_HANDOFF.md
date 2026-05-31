# Verified Vibe — Marketing Website Design Handoff

**For:** Claude Design
**From:** Pocket Dating Coach team
**Goal:** Design a public marketing/landing website for **Verified Vibe** in the spirit of [bumble.com](https://bumble.com), [tinder.com](https://tinder.com), and [hinge.co](https://hinge.co/en-gb) — bold, photo-forward, single-purpose: explain the product and drive sign-ups / app downloads.

This is a **marketing site**, separate from the actual product app. It does not need to be functional — it needs to sell the idea and look like a category-leading dating brand.

---

## 1. The product in one line

**Verified Vibe is a trust-first, AI-coached dating app where every match is identity-verified and every message is screened by your personal AI.**

Longer: Most dating apps are a guessing game — fake photos, hidden intentions, endless small talk that goes nowhere. Verified Vibe fixes that with two moves. First, **everyone is verified** (government ID, liveness selfie, photo consistency, and intent), and each profile carries a public **Trust Score from 0–100**. Second, **you get an AI coach**: women get an **AI Bestie** that reads every incoming message for red flags and drafts replies; men get an **AI Wingman** that builds a proof-backed profile and coaches conversations. The result is fewer games, fewer bad dates, and matches who are actually who they say they are.

### Who it's for
Serious daters tired of the games — whether they want marriage or something intentionally casual. The product forces clarity on intent up front (see archetypes) so nobody wastes time.

---

## 2. Brand voice & positioning

**Tone:** Confident, modern, a little cheeky — like Bumble's empowerment energy crossed with a trust/safety promise. Direct sentences. No corporate hedging.

**The core promise to repeat everywhere:** *Every person you talk to has been verified.*

**Messaging pillars (use these as section themes):**
1. **Verified, not vibes** — real people, real photos, a visible Trust Score.
2. **Your AI knows the red flags you'd miss** — AI Bestie / AI Wingman do the emotional heavy lifting.
3. **Pick your lane** — intent is declared up front, so matches actually align.
4. **Earn your profile, prove your intent, pay later** — low friction, high signal.

**Headline candidates (pulled from / inspired by the live app):**
- "Pick your lane." *(the app's own hero line)*
- "Skip the games. Every match is verified."
- "Your AI Bestie knows the red flags you'd miss."
- "Earn your profile. Prove your intent."
- "Dating with the receipts."
- "We verify ID, photos, spending & intent. You only see the signals — never the raw files." *(trust note, near-verbatim from app)*

**Words we own:** Verified Vibe · Trust Score · AI Bestie · AI Wingman · Pick your lane · Verified, not vibes.

---

## 3. Visual identity (match the live app)

The marketing site must feel like the same brand as the product. Pull directly from the app's design tokens (`src/app.css`, `src/lib/verified-vibe/design-tokens.css`).

### Color
| Role | Hex | Notes |
|------|-----|-------|
| **Primary / trust accent** | `#10b981` (emerald) | The signature color — verification, trust, "go". Use it the way Bumble uses yellow. |
| Bright accent | `#34d399` | Glows, hover states |
| Deep accent | `#064e3b` | Dark emerald for depth |
| Mint (secondary) | `#14b8a6` | |
| Lime (success) | `#84cc16` | |
| Amber (attention) | `#f59e0b` | Warnings / "⚠️ vague" signal |
| Danger / red flag | `#ef4444` | "🚩 red flag" signal |
| AI Bestie persona | `#ec4899` → `#a855f7` (pink→purple gradient) | Women's coach |
| AI Wingman persona | blue family (`#3b82f6`) | Men's coach |
| Ink / text | `#111827`, `#374151`, `#6b7280` | |
| Surfaces (light) | `#ffffff`, `#f9fafb`, `#f3f4f6` | |
| Dark shell | `#0b1120`, `#0d1522`, `#080e1b` | App uses a dark shell for tool pages — optional for a premium dark section |

**Recommendation:** Lead with a **bright, optimistic light theme** for the marketing site (like Bumble/Hinge), with emerald as the hero color, and consider one **dark "trust / under-the-hood" section** using the `#0b1120` shell to show off the verification tech.

### Typography
- **Inter** (sans, primary) — system-ui / -apple-system fallback. Use heavy weights (700) for big display headlines, the way Bumble uses its giant wordmark.
- Georgia (serif) available as an accent token if an editorial pull-quote is wanted.
- Scale runs to 48px in-app; for marketing, go **much bigger** on hero display type (think 80–140px wordmark-scale headlines like the reference sites).

### Shape & feel
- Soft, rounded everything: radius scale 4 / 8 / 12 / 16 / 24 / 32px, pills at full-round.
- Subtle layered shadows, backdrop blur on sticky nav.
- Micro-interactions: pulse on the AI persona badges, 200ms transitions.
- Iconography: **Lucide** icons. Recurring motifs: ✅ CheckCircle, 🛡️ Shield (Wingman), ❤️ Heart (Bestie), Zap, Eye.
- Overall vibe: **premium but playful** — trustworthy without being clinical.

### Logo / wordmark
- App is branded **Verified Vibe** (product) under **Pocket Dating Coach** (company). For this site, lead with **Verified Vibe**.
- No final logo exists yet — **please design a wordmark**. Suggestion: "Verified Vibe" with a verification checkmark integrated into the V, in emerald. Reference Bumble's confident lowercase wordmark treatment.

---

## 4. Imagery direction

Follow the reference sites: **big, warm, candid photos of real-looking people**, layered/overlapping cards, lots of personality.

- Style: authentic, diverse, candid (not stock-cheesy). Bumble/Hinge use slightly imperfect, joyful, real-feeling shots.
- **Trust overlay motif (our differentiator):** show profile photo cards with a small **Trust Score badge** (e.g. "92 ✓ Verified") and an **archetype chip** (e.g. "💍 Forever-Focused") overlaid — this is the visual hook that makes us look different from every other dating app.
- The product ships with sample profile imagery under `static/male_profiles/` and `static/female_profiles/` (each has a `photos/` folder) — usable as placeholder content to mock realistic cards, but **note these may be AI/sample assets; final marketing photography should be properly licensed.**
- AI Bestie has an existing illustrated mascot (confident dark-haired woman, pink→purple gradient, gold stars). It can anchor the "AI Bestie" section.

---

## 5. Recommended page structure

A single long-scroll landing page (plus a sticky nav), mirroring the reference sites. Sections, in order:

1. **Sticky nav** — wordmark left; links (How it works · Trust · For Her · For Him · Safety); "Sign in" + a primary "Get verified" CTA button (emerald) right. Reference Bumble's pill nav.

2. **Hero** — giant display headline ("Pick your lane." or "Verified, not vibes."), one-line subhead, primary CTA + app-store badges. Big overlapping photo cards with Trust Score + archetype overlays floating over an emerald-tinted background. This is the money shot — make it as bold as Bumble's.

3. **The trust strip** — short, punchy: "We verify ID · photos · spending · intent." A row of 4 verification steps, each worth 25 points → "Trust Score 0–100." Visual: a profile card filling up its trust meter.

4. **How it works** — 3 steps: (1) Verify yourself (ID, liveness, photos), (2) Pick your lane (declare intent), (3) Match & get coached. Clean numbered layout.

5. **Meet your AI coach** — split feature, the signature differentiator:
   - **AI Bestie (for her):** reads every message, flags ✅ genuine / ⚠️ vague / 🚩 red flag, drafts replies, summarizes matches. Pink→purple persona. Show a mock chat with a signal card.
   - **AI Wingman (for him):** builds a proof-backed profile, coaches conversations, no faking it. Blue persona. Show a mock profile-building moment.

6. **Pick your lane (archetypes)** — showcase the 16-archetype system. A playful grid of archetype chips with emojis (💍 Forever-Focused, 💸 Casual-Generous, 💞 Hopeless-Romantic, 🌱 Rebound-Healing, 🏛️ Traditional-Matrimony, 🔄 Second-Chapter, 🤝 Just-Friends, 🕊️ Untouched-Heart). Message: "No pretending. Say what you're here for, and match with people who want the same." (Full list in Appendix A.)

7. **Proof, not promises** — explain proof-gated chips: you can't claim it unless you can prove it (LinkedIn → Career Highlights, bank statements → Money Matters). "The receipts" angle. Reassurance: *no one sees your raw files — only the signals you allow.*

8. **Safety / trust deep-dive** — optional dark section (`#0b1120`). ID-verified, no exceptions; privacy-first; you control what's shared. Links to privacy policy.

9. **Social proof** — testimonials / stats ("X verified members", success quotes). Placeholder content fine.

10. **Final CTA** — full-bleed emerald, big headline ("Ready for dating with the receipts?"), email capture or app-store badges.

11. **Footer** — links (Date · Safety · Privacy · Support · Company), social, app-store badges, legal.

---

## 6. Deliverable & technical notes

- **Format:** Single responsive marketing landing page, mobile-first (the product is a mobile/PWA app, so most visitors are on phones — design mobile first, like the reference sites).
- **Stack suggestion:** Plain responsive HTML/CSS or a lightweight SvelteKit route, so it can drop into the existing SvelteKit repo if desired. Reuse the design tokens in `src/app.css`. (Not required — a standalone static page is fine.)
- **CTAs point to:** app sign-up flow (`/verified-vibe/gate` in the product) and app-store listings (Android build exists via Capacitor; iOS TBD).
- **Must include:** clear age gate / 18+ messaging (the product requires it), and a link to the privacy policy.
- **Accessibility:** maintain strong contrast (the app is contrast- and a11y-conscious), semantic headings, alt text.

---

## Appendix A — The 16 archetypes (for the "Pick your lane" section)

Eight per gender. Each is a declared intent; matches are made within compatible archetypes.

**Men:** 💸 Casual-Generous ("confident, generous, experiences over labels") · 💞 Hopeless-Romantic ("chasing the deep thing") · 🌱 Rebound-Healing ("recovering, honest, not rushing") · 🕊️ Untouched-Heart ("inexperienced, sincere, going slow") · 🎯 Forever-Focused ("marriage-minded, done with games") · 🏛️ Traditional-Matrimony ("family values, cultural fit") · 🔄 Second-Chapter ("loved before, ready to do it right") · 🤝 Just-Friends ("looking to connect, not date").

**Women:** ✨ Spoiled-Casual ("luxury vibes, treated well, no pressure") · 🌹 Hopeless-Romantic · 🌿 Rebound-Healing · 🌸 Untouched-Heart · 💍 Forever-Focused ("knows what she wants") · 🏛️ Traditional-Matrimony ("matrimony is the goal") · 🌺 Second-Chapter ("starting over right") · 🫂 Just-Friends.

Marketing simplification: you can group these into four lanes for the public site — **Casual · Romantic · Marriage-Minded · Healing / Starting Over** — then reveal the full 16 on hover/expand.

## Appendix B — Differentiators vs Tinder / Bumble / Hinge (the "why us")

| Verified Vibe | The others |
|---|---|
| Public 0–100 **Trust Score** on every profile | No trust signal |
| **ID + liveness + photo + intent** verification, mandatory | Optional/none |
| **AI Bestie** screens every message for red flags | You're on your own |
| **AI Wingman** builds a proof-backed profile | Self-declared everything |
| **Proof-gated claims** (LinkedIn, bank statements) | Anyone can claim anything |
| **Declared intent** via 16 archetypes | Ambiguous intentions |
| Privacy: signals shared, **raw files never** | — |

## Appendix C — Source-of-truth files in this repo

- Brand tokens / colors / type: `src/app.css`, `src/lib/verified-vibe/design-tokens.css`
- Live app hero & copy: `src/routes/verified-vibe/home/+page.svelte`, `src/routes/verified-vibe/gate/+page.svelte`
- Components to match style: `src/lib/components/`, `src/lib/verified-vibe/`
- Product overview: `README.md`, `CHANGELOG.md`, `docs/verified-vibe/GITHUB_WIKI.md`
- Sample profile imagery: `static/male_profiles/`, `static/female_profiles/`
- AI Bestie mascot: search `src/lib` for the `BestieAvatar` component
