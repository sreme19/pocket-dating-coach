# App Store Rejection Remediation — Requirements v1.3

> **v1.3 — WS-1 (1.1.4 copy purge), WS-2 (referral cash) and WS-4 (paywall language) are IMPLEMENTED** on `development` in commit `e20d376`, 39 files, both codebases. Decisions in §8 were answered by Sree on 2026-07-29 and are reflected in the code.
>
> **Still outstanding — see §10 for the handover list:** WS-3 (2.5.4 background-audio verification + device recording), the demo-account seeding in §4.2, and all of WS-6 (App Store Connect notes, reply, description). Nothing has been pushed, deployed or resubmitted.
>
> Five surfaces were found during implementation that this document did not originally capture. They are marked **FOUND DURING IMPLEMENTATION** in place and summarised in §10.

**Submission:** 3a44802f-5ff0-4445-b8b1-b54111a45b41 · App ID 6777096281 · riteangle (iOS)
**Status:** Rejected, "Unresolved Issues". No other submitted items can be accepted until this version is resubmitted and accepted.
**Open guidelines:** 1.1.4 (Safety — Objectionable Content: compensated dating) · 2.5.4 (Software Requirements — undeclared background audio)
**Dormant, not resolved:** 4.3(b) (Spam). Raised Jul 17, not restated Jul 26, never explicitly accepted.
**Author:** engineering triage, 2026-07-29
**Audience:** implementing developers (Flutter + SvelteKit) + whoever owns App Store Connect

---

## 0. Read this first — why we are here

Round 1 (Jul 17) raised three issues: a broken privacy-policy link (2.1(a)), a wrong age-rating declaration (2.3.6), and 4.3(b) spam. The first two were fixed. To defeat 4.3(b), the reply to Apple described the product as having a **paid "Notice Me"** and a Trust Score built from verified **financial** records.

4.3(b) went away. Guideline **1.1.4 arrived in its place.** A reviewer read "men pay to reach a specific woman" + "men are verified and ranked by wealth" and classified the app as facilitating compensated dating.

Two facts that must shape every decision below:

1. **The paid "Notice Me" does not exist.** There is no `in_app_purchase`, no StoreKit, no Razorpay, no paywall, no credits and no wallet anywhere in `mobile/` or `src/`. `POST /api/verified-vibe/attention` validates sender, recipient, type and a 500-char body, inserts a row, and engages her Bestie — there is no cost check because there is no cost. App Store Connect confirms zero IAPs, zero subscriptions, no price schedule. We were rejected for a business model we never shipped.
2. **But the app does contain real transactional content the reviewer could reach.** Sections 2 and 3 below inventory it. It is not hypothetical and it is not defensible by letter — it has to be changed in the binary.

**Locked decisions (do not re-litigate):**

| Item | Decision |
| --- | --- |
| 2.5.4 background audio | **Keep** `audio` in `UIBackgroundModes`. Defend with a physical-device screen recording. iOS-only issue — Android declares no audio foreground service. |
| Refer & Earn cash | **Remove from the mobile app entirely — iOS *and* Android.** No ₹ amount reachable anywhere in the Flutter build. Web keeps it. |
| Archetype lane | **Keep the lane.** Do not delete the Casual-Generous / Spoiled-Casual archetypes. Everything else in the copy purge proceeds. |
| Notice Me | Mechanic is **unchanged**. It is a Bumble-style intro DM that is free. Only the description of it changes. |
| Platform scope | **iOS + Android + web, shipped together.** See §1.3. |
| Reply to Apple | Developer drafts it; **Sree reviews and approves before it is sent.** Nobody replies to App Review unreviewed. |

---

## 1. Non-negotiable engineering constraints

1. **No database migration. No archetype ID changes.** `casual_generous_man` and `spoiled_casual_woman` are persisted in `vv_archetype`, referenced in `src/lib/verified-vibe/types.ts`, in the match-validity rules in `constants.ts`, and in seeded profiles. **Rename display strings only** — `name`, `tag`, `longTag`, `emoji`, `brings`, question titles and option labels. IDs, DB column values, section `key`s and the `VerificationStep` enum (`spending_or_qa`) stay exactly as they are.
2. **Any surface that renders a raw ID must be found and fixed.** If any screen or API response shows `casual_generous_man` to a user rather than the display name, that is a bug in scope for this work. Audit before assuming there are none.
3. **Both codebases, same change.** Flutter (`mobile/lib`) is the reviewed binary; SvelteKit (`src/`) is what a reviewer sees if they follow any link out of the app or open `www.riteangle.dating`. Copy must not diverge — a reviewer finding purged copy in the app and the original copy on the web is worse than not fixing it.
4. **One build.** 2.5.4 and 1.1.4 ship together. Do not burn a submission on the plist alone.

### 1.3 Platform scope — iOS, Android and web

All three surfaces ship the same change set, together.

- **iOS** — the app under review. Everything in this document applies.
- **Android** — `mobile/lib` is shared Dart, so the entire §2 copy purge lands on Android automatically; **no separate copy pass is needed, but the Android build must be rebuilt and re-released** (see §9). Two things are genuinely Android-specific: the Refer & Earn cash removal must not be gated behind `Platform.isIOS` (§3.1), and Google Play's Inappropriate Content policy prohibits compensated dating in substantially the same terms as Apple's 1.1.4 — so this purge is pre-emptive Play protection, not just Apple remediation. Do not leave the transactional copy live on Android while fixing iOS.
- **Android is *not* affected by 2.5.4.** `mobile/android/app/src/main/AndroidManifest.xml` declares `RECORD_AUDIO` and `MODIFY_AUDIO_SETTINGS` but no audio foreground service, so there is no Android analogue of the background-mode declaration. §4 is iOS-only. (If background calls are later wanted on Android, that needs a foreground service — out of scope here.)
- **Web** — deploy coupled to the mobile release. A reviewer following any link to `www.riteangle.dating` and finding the original copy undoes the fix.
5. **Keep the 4.3(b) defence intact.** Nothing in this document touches the AI Bestie proxy, three-point identity verification, the no-swipe/no-Like model, one-match-at-a-time, or anonymous Tips. Those four carry the differentiation argument. Only the *money-for-companionship* framing is being removed, and the financial verification survives — reframed as fraud-and-solvency proofing, which is a stronger differentiator than wealth ranking anyway.

---

## 2. WS-1 — Guideline 1.1.4: purge the transactional framing

This is the release blocker. Apple asked for **removal**, not explanation. Every row below is a user-reachable string.

### 2.0 CONFIRMED — the exact screen Apple photographed

`Screenshot-0725-144835.png` was downloaded from the rejection on 2026-07-29. It settles the question. iPad, 2:48 PM Sat Jul 25, **not signed in** — the reviewer never created an account. It is the archetype detail sheet on the pre-auth "Pick your lane" screen (`mobile/lib/pre_auth_lane_screen.dart`), showing:

- the 💸 money-with-wings icon, and the heading **"YOU'RE A Casual-Generous."**
- *"You date well and you show it. Experiences over labels — dinners, weekends, no strings attached to who picks up the bill."*
- **BEST MATCH → 💎 Spoiled-Casual Women**
- **WHAT YOU BRING TO THE TABLE →** Financial confidence · Upscale experiences · No-pressure energy · Privacy & discretion · **Generosity as a love language** · Clarity of intent
- CTA: **"I'm a Casual-Generous Man — Let's go →"**

So the trigger is §2.1 + §2.2 exactly, on a screen reachable in two taps from a cold launch with no account. Refer & Earn was **not** the trigger — it still has to go per the locked decision, but the reply to Apple should lead with this sheet.

Two further strings sit on that same screen, partially visible behind the sheet in Apple's own screenshot, and both are in scope:

| File:line | Current | Required | Why |
| --- | --- | --- | --- |
| `pre_auth_lane_screen.dart:134` | "Earn your profile, verify your intent. ***Pay later.***" (accent italic, pre-auth) | **Delete the "Pay later." span entirely.** | A reviewer investigating a claimed paid mechanic saw the words "Pay later." on the first screen of an app with zero IAPs. This is the strongest in-app corroboration of the paywall the Jul 17 letter described. Highest priority string in this document after the sheet itself. |
| `pre_auth_lane_screen.dart:151` | "We verify ID, photos, **spending pattern** & intent." | "We verify ID, photos, lifestyle & intent." | Pre-auth, same screen. Consistent with the §2.2 `spending_or_qa` display rename. |

Both are pre-authentication, so no amount of demo-account preparation hides them.

### 2.1 The archetype pair (highest severity — reachable pre-authentication)

`mobile/lib/pre_auth_lane_screen.dart:56` renders the lane picker **before login**, so a reviewer on first launch sees these two cards with zero setup. `pre_auth_lane_screen.dart:242-248` renders `emoji`, `name`, `tag`.

**Required change: make the pair symmetric.** Today it is a giver/receiver pair — the *only* asymmetric pair in the whole taxonomy (every other lane mirrors: Hopeless-Romantic ↔ Hopeless-Romantic). That asymmetry is what reads as transactional. Give both sides the same name.

| Field | Current | Required |
| --- | --- | --- |
| `casual_generous_man` emoji | 💸 | 💫 (money emoji must go) |
| `casual_generous_man` name | Casual-Generous | **Experience-Led** |
| `casual_generous_man` tag | Confident, generous, experiences over labels | Confident, present, experiences over labels |
| `casual_generous_man` longTag | "You date well and you show it. Experiences over labels — dinners, weekends, no strings attached to who picks up the bill." | "You like dating to feel easy and well-planned. Experiences over labels — good dinners, weekends away, no pressure to define it." |
| `spoiled_casual_woman` emoji | ✨ | ✨ (may stay) |
| `spoiled_casual_woman` name | Spoiled-Casual | **Experience-Led** |
| `spoiled_casual_woman` tag | Luxury vibes, treated well, no pressure | Easy chemistry, good company, no pressure |
| `spoiled_casual_woman` longTag | "You want to be wined, dined and genuinely enjoyed — without labels and without apology. Life is short; experience it at full quality." | "You want dating to feel enjoyable and unhurried — real chemistry, good company, no pressure to define it." |

Also update every `matchTraits` / `avoidTraits` label that reads `Spoiled-Casual Women` or `Casual-Generous Men` — those strings appear across ~12 other archetype definitions in both codebases and are rendered on profile and match screens.

**Files:** `mobile/lib/archetypes.dart:42` (man), `:146` (woman), plus all `MatchTrait`/`AvoidTrait` labels · `src/lib/verified-vibe/constants.ts` → `ARCHETYPES.casual_generous_man`, `ARCHETYPES.spoiled_casual_woman`, and all `matchTraits`/`avoidTraits` labels · `mobile/lib/profile_screen.dart:496` (trait chips `['Generous','Sophisticated','Discreet']` → `['Present','Sophisticated','Discreet']`).

### 2.2 "What he brings her" — the benefit lists

`mobile/lib/archetypes.dart:261` currently advertises what a man in this lane provides to a woman:

> 💰 Financial stability · 🍾 Generosity on dates · 🗓️ Time he actually gives you · 🔒 Privacy & discretion · 💭 Real opinions, gently held

Remove the first two. Replace with `🎭 Plans he actually makes` and `🌿 No-pressure energy`.

`src/lib/verified-vibe/constants.ts` → `casual_generous_man.brings` currently: `Financial confidence`, `Upscale experiences`, `No-pressure energy`, `Privacy & discretion`, `Generosity as a love language`, `Clarity of intent`. Drop `Financial confidence`, `Upscale experiences`, `Generosity as a love language`. Add `Plans that actually happen`, `Consistency without pressure`.

Also `casual_generous_man.needs` contains `Spending pattern (prove you're solid)`. Change the display string to `Lifestyle proof (prove you're solid)`. **The `spending_or_qa` enum value does not change.**

Sweep `archetypeBrings` and `brings` for every other archetype too — `forever_focused_man` also lists `Financial stability`. Financial standing may not be advertised as a benefit one gender receives from the other, in any lane.

### 2.3 The onboarding flow behind the lane (second-highest severity)

**`mobile/lib/onboarding_questions.dart:697` — `_howSpoiledCasual` → `how_you_like_to_be_treated`.** This is the most damaging screen in the app. Current options:

> Thoughtful gifting 🎁 · Consistent romance 🌹 · Undivided attention 💬 · Elevated experiences ✈️ · Generous without being asked 🛍 · Surprise upgrades 🍾 · Picked up & dropped off 🚗 · **Nice hotels, no questions 🏨** · Small gestures that show effort 💐

**Required:** keep the section `key` (`how_you_like_to_be_treated`, DB-persisted), change the title to **"What makes you feel valued"**, and replace the option set entirely:

> Consistent romance 🌹 · Undivided attention 💬 · Thoughtful gestures 💐 · Planned time together 🗓️ · Being remembered in the details ✨ · Effort that shows up ✅ · Slow, unhurried evenings 🕯

Every removed option (gifting, elevated experiences, generous-without-being-asked, surprise upgrades, picked-up-and-dropped-off, nice-hotels-no-questions) must be gone from the binary, not merely hidden behind `more:`.

**`onboarding_questions.dart:636` — `_howCasualMan` → `lifestyle` card.** Current: `Comfortable & established` · `High-income lifestyle` · `Executive / founder` · `Luxury-oriented` · `Confident & generous — financially open with people you care about`. Required: `Comfortable & established` · `Career-focused` · `Executive / founder` · `Creative / independent` · `Steady & grounded`. No option may describe money the user is willing to spend on a partner.

**`onboarding_questions.dart:647` — `income`.** Keep the question and keep the brackets. Two hard requirements: it stays `private: true`, and the subtitle must state it explicitly — `"Optional · private · used only to refine matches, never shown on your profile"`. Then verify by test (§6) that no rendering path shows an income bracket to another user.

**Mirror all of the above in `src/lib/verified-vibe/components/CasualGenerousPreferencesStep.svelte:29-92`**, which carries the same question set (`intimacy_style`, `lifestyle_profile`, `income_range`, `boundaries_discretion`) with the same labels including `💰 High-income lifestyle`, `💎 Luxury-oriented lifestyle`, `🤝 Financially confident & generous`.

### 2.4 Explicit intimacy options — decision needed, recommendation included

`onboarding_questions.dart:617` (`_howCasualMan` → `chemistry`) and the web equivalent (`intimacy_style`) offer: PDA · Teasing & flirtation · Sensual connection · Exploring fantasies · Prefer discretion · **Roleplay** · **Power dynamics** · **BDSM-friendly** · Open relationships · Group experiences (web only).

Alone, at a 18+ rating, this is survivable. Sitting in the same flow as income brackets and "nice hotels, no questions", it completes the compensated-companionship picture — and Apple has already decided how it reads.

**Recommendation:** remove `Roleplay`, `Power dynamics`, `BDSM-friendly` and `Group experiences` from both codebases. Keep `PDA`, `Teasing & flirtation`, `Sensual connection`, `Exploring fantasies`, `Open relationships`, `Prefer discretion`. This is a product call — flagged in §8.

### 2.5 The Trust Score's "generosity" component

`src/lib/verified-vibe/server/trustScore.ts:242-282` defines `CGTrustSubscores` with a field literally named `generositySignals`, fed by spending proof, weighted **30%** — the largest single component of the Casual-Generous trust total.

- Rename the field to `lifestyleSignals` (or `verifiedActivity`) throughout, including `calculateCGSubscores` and `calculateCGTotal`.
- Audit every place the subscore *label* reaches a UI and ensure no user-facing string says "generosity".
- `src/lib/verified-vibe/dimensions.ts:38`: `label: 'Financial standing & generosity'` → `'Financial standing'`; `blurb: 'Income, assets, and how generously someone shows up.'` → `'Verified income and assets — used to confirm someone is real and solvent.'` Weight (`avgWeight: 0.16`) is unchanged; this is a labelling fix, not a scoring change.
- `src/lib/verified-vibe/valuation.ts` needs no logic change — it is server-side and never rendered. Leave the curve alone.

### 2.6 Proof-upload copy

`mobile/lib/category_proof_screen.dart:305` — Spending Proof privacy copy currently reads: *"AI reads spend amounts to **verify generosity** — shown as a lifestyle signal on your profile."*

Required: *"AI reads amounts to verify your lifestyle is real. Your receipts stay private — viewers see only the verified result."*

`category_proof_screen.dart:320` — Wealth Proof (bank statements, brokerage, crypto, property valuation). **Keep the category** — it is fraud-and-solvency verification and part of the 4.3(b) differentiation. Reframe the subtitle and privacy copy so it reads as verification, never as a signal of what a match will receive. Verify the title too: "Wealth Proof" in a dating app is a bad look for a reviewer already primed; prefer **"Financial Verification"**.

Hard requirement: **no wealth or spending figure, band, or derived label may be displayed to the other party.** Internal trust input only.

### 2.7 AI prompt output — the Bestie can generate the violation at runtime

`src/lib/prompts.ts:504` instructs the AI:

> "If a match has uploaded verified lifestyle proofs (travel, **wealth**, fitness etc.), mention this naturally and positively… e.g. 'He's actually taken the time to verify his travel lifestyle'"

A reviewer chatting with the Bestie can be told a man has verified his wealth. Purged static copy does not help if the model says it out loud.

- Remove `wealth` from that list. Permitted mentions: travel, fitness, career, social proof, lifestyle.
- Add an explicit negative instruction: the Bestie and Wingman must never reference a user's income, wealth, spending, net worth, assets, or generosity, and must never frame a match in terms of what they can provide or pay for.
- `prompts.ts:436` tells the Wingman to proactively solicit income verification. Keep the solicitation (it is legitimate verification) but strip any framing that ties it to attractiveness or to what a woman will receive.
- `prompts.ts:742` already forbids asking for income in chat. Good — keep it and mirror the same rule into the Bestie prompt.
- Add these strings to the AI QA console's regression cases (`/admin/qa`) so the constraint is checked, not assumed.

### 2.8 The invite share copy — reachable, and it markets men by income

`src/routes/verified-vibe/refer/+page.svelte:94` and `mobile/lib/refer_screen.dart:397`, the message a user sends to invite women:

> "everyone's identity-verified, skews **high-earning tech/finance**, and an AI weeds out the creeps before they reach you"

And `mobile/lib/refer_screen.dart:662`:

> "Most are creeps 🙄 but a few are genuine, successful, even **high-earning**."

Remove income as a selling point from every invite variant (`networking`, `casual`, `serious`) in both codebases. "Identity-verified", "screened by AI", "tech/finance/founders/creatives" as *fields* are all fine; earnings are not.

### 2.9 `female-profile.ts` — leave the guard, reword the output

`src/lib/female-profile.ts:8-18` has `GENEROUS_PROVIDER_TERMS` (`sugar daddy`, `spoil`, `provider`, `wealthy`, `allowance`…) used by `hasSensitiveProviderFantasy()` to *detect and neutralise* transactional answers. This is a defensive control and should be kept and cited to Apple.

But its replacement text at `:59` still says *"…men who are **generous**, intentional, financially steady…"*. Reword to remove `generous` and `financially steady`. Same for the `generous attention` signal at `:70`.

---

## 3. WS-2 — Remove Refer & Earn cash from the mobile app (iOS + Android)

**Decision: no ₹ amount is reachable anywhere in the Flutter build, on either platform.** Both tracks (₹100/₹150 per verified woman, ₹25 per verified man). The invite mechanic itself stays — only the money goes.

Paying users cash per verified woman recruited, inside an app already flagged for compensated dating, is the single hardest thing to explain to a reviewer. It is severable from the referral flows that matter.

### 3.1 Mobile build requirements

- **Remove the earnings UI** from `mobile/lib/refer_screen.dart`: the earnings block (`~:703-740`), the tier/cap progress, `_cash`/`_menCash` rendering, `:665` ("You earn ₹X for every guy who joins and gets verified"), `:736` ("₹X for a woman, ₹X for a man, to your UPI"). No ₹ glyph, no "earn", no "payout", no "UPI" string may survive in the Flutter binary on either platform.
- **No platform gate.** Because Android is in scope too, do **not** add a `Platform.isIOS` check and do not add a server flag for this — delete the earnings UI from the Flutter app unconditionally. One code path, nothing to forget, nothing that can regress on one platform only. (This supersedes the earlier Q9 recommendation of a server-driven flag, which existed only to keep Android showing cash.)
- **Keep** the invite mechanic: link generation, the three tabs/moods, share-to-WhatsApp/Instagram, and the private-link flow. Reframe the screen as **"Invite"** rather than "Refer & Earn", including the pill at `mobile/lib/profile_screen.dart:163`.
- **Do not delete the server ledger.** `src/lib/server/beta-invite.ts:57-69` keeps accruing for everyone, including mobile-originated referrals — users who have already earned must not lose money. The app simply does not render it; the web surface still does.
- The web app (`src/routes/verified-vibe/refer/+page.svelte`) keeps its earnings UI **unchanged**. Only the §2.8 invite share copy changes there.

### 3.2 Verification

`grep -riE '₹|\bUPI\b|earn(ed|ings)?|payout|cash' mobile/lib` returns nothing user-facing after this change (comments and the ledger doc-block may remain, but must be updated to say the mobile surface no longer shows cash on either platform). Verify on a real Android device as well as iOS — the check is that the string is absent from the build, not that a flag is off.

---

## 4. WS-3 — Guideline 2.5.4: keep `audio`, prove it

`mobile/ios/Runner/Info.plist:71` declares `remote-notification` and `audio`. **Both stay.** The defence is a screen recording.

There is a real feature behind it: LiveKit voice calls with the AI Bestie (`mobile/lib/voice_call_screen.dart`, entered from the "Call Bestie" pill at `mobile/lib/conversation_screen.dart:1182` → `_openVoiceCall()` at `:685`). Apple's stated remedy is a physical-device recording that shows audio continuing after the user navigates to the Home Screen, referenced in App Review Information → Notes.

### 4.1 Verify the behaviour actually exists — before recording anything

`voice_call_screen.dart` has **no `didChangeAppLifecycleState` handling** and no explicit `AVAudioSession` configuration; the room is built at `:76`, connected at `:99`, disconnected at `:195` and disposed at `:200`. Background continuation is currently relying entirely on the plist key plus whatever `flutter_webrtc` configures by default.

**Required:** on a physical device, start a Bestie call, press Home, and confirm the Bestie's audio keeps playing and the room stays connected for at least 30 seconds. If audio stops or the room drops:

- configure the audio session explicitly for playback-in-background before connecting;
- ensure the LiveKit room is not torn down on app pause (no lifecycle-driven `disconnect()`/`dispose()`);
- confirm the call survives the screen locking too.

**We cannot record what does not work.** If after this work background audio genuinely does not function, escalate before submitting — the fallback (remove the key) is a one-line change but reverses a locked decision, so it needs sign-off.

### 4.2 Make the flow reachable for a reviewer — this is the part that failed last time

The call pill only renders `if (_bestieIsProxy)` (`conversation_screen.dart:1182`) — i.e. only while her AI Bestie is still speaking for her, inside an existing match. Apple said they "could not locate any features that require persistent audio" because **on a fresh demo account, the feature is genuinely unreachable.** Recording it is necessary but not sufficient; the reviewer must also be able to reproduce it.

**Required:** prepare the review demo account so that, at first login, it already has:

1. at least one active match whose thread is in the Bestie-proxy state (`_bestieIsProxy == true`), so the "Call Bestie" pill is visible immediately;
2. no onboarding, verification or photo gate blocking access to that thread — the reviewer must not have to complete ID/liveness to see it;
3. the thread reachable in ≤ 3 taps from launch.

Note the interaction with `POOL_REQUIRED_STEPS` and the photo identity gate — a seeded account that trips either one will present the reviewer with a verification wall instead of a chat. Test the demo account from a clean install, on an **iPad** (round 2 was reviewed only on iPad Air 11" M3) as well as iPhone.

### 4.3 The recording

- Physical device (not Simulator — Apple can tell).
- Show: open the thread → tap "Call Bestie" → Bestie speaks → **navigate to the Home Screen** → audio audibly continues → return to the app → call still live → end call.
- Keep it under ~60s, no editing, no captions needed.
- Host it somewhere with a stable, non-expiring, no-login URL, and put that URL in App Review Information → Notes.

### 4.4 Do **not** switch to `voip`

An external analysis suggested `voip` may be the more correct mode. It is not, for us. `voip` requires a CallKit integration with PushKit-delivered call notifications; declaring it without CallKit is a harder rejection than the one we have and Apple polices it more aggressively than `audio`. Our calls are LiveKit sessions inside a Flutter screen, not system telephony. **Keep `audio`.**

---

## 5. WS-4 — Notice Me: correct the record, change no mechanics

**The feature is not changing.** For the reply to Apple and for the review notes, this is what it actually is:

> Notice Me (internally "Craving Attention") is a free, one-time introductory message — the same shape as Bumble's opening DM. A man writes up to 500 characters to one woman. He cannot send a second one to the same person. The conversation only opens if she accepts it. She does not have to read it or triage it herself: her AI Bestie engages on her behalf, screens him, and only if the exchange passes the hand-off gate does she step in and take over the thread. There is no payment, no unlock, no priority tier and no consumable involved at any point.

Code of record: `src/routes/api/verified-vibe/attention/+server.ts` (validation only, no cost check) → `engageBestieForAttention()` in `src/lib/server/attention-bestie.ts` → hand-off gate (`handoff-gate.ts`, `HANDOFF_PROOF_GATE`) → 48h reversible hand-off timeout.

### 5.1 Required code change: remove the phantom paywall tease

`mobile/lib/chat_list_screen.dart:1586`:

> "You've used all N AI match searches. More will be available to unlock soon."

There is no IAP behind "unlock", so this is a paywall promise the reviewer can neither test nor buy — exactly the ambiguity that got us here. Reword to remove "unlock" and any purchase implication (e.g. *"You've used all N AI match searches. Your searches reset daily."* — use whatever is actually true). Same for the stale credits language at `mobile/lib/profile_edit.dart:104`.

### 5.2 Audit for any other purchase implication

`grep -riE 'unlock|upgrade|premium|paid|purchase|credits' mobile/lib src/routes src/lib` and confirm nothing user-facing implies a purchase. Until an IAP exists, the app must contain no purchase language at all.

### 5.3 If Notice Me is ever monetised (not now)

Recorded so it is not rediscovered painfully: attaching payment to reaching a **specific person** is precisely what 1.1.4 exists to prohibit, and it would additionally have to run through Apple IAP (3.1.1). If a paid tier is wanted later, put it on coaching, verification, or unlimited AI match searches — never on access to an individual.

---

## 6. WS-5 — Acceptance criteria & QA

### 6.1 Automated banned-string gate (add to CI)

Fail the build if any of these appear in user-facing strings across `mobile/lib` and `src`:

```
nice hotels, no questions      picks up the bill        wined and dined
generous without being asked   surprise upgrades        picked up & dropped off
thoughtful gifting             elevated experiences     generosity on dates
spoiled                        sugar                    verify generosity
high-earning                   generositySignals        Financial stability (as a "brings" item)
₹ / UPI / earn / payout        (mobile/lib only)
```

Keep `GENEROUS_PROVIDER_TERMS` in `src/lib/female-profile.ts` exempt — it is the guard, not a violation.

### 6.2 Manual reviewer-simulation checklist — run on a real iPad, clean install

1. Launch, do not sign in. Walk the pre-auth lane picker for both genders. No money framing, no 💸, no asymmetric giver/receiver pair.
2. Sign in with the review demo account. Land within 3 taps on a Bestie-proxy thread with the "Call Bestie" pill visible.
3. Start the call. Press Home. Audio continues. Return. Call still live.
4. Walk the full Experience-Led onboarding for both genders. No income shown to anyone but the owner; no gifting/hotels/upgrades options anywhere.
5. Open Invite from the profile pill. No ₹, no earnings, no UPI.
6. Chat with the Bestie about a match with wealth/spending proofs uploaded. It must never mention wealth, income, spending, net worth, assets or generosity.
7. Open every proof-upload category. No "verify generosity"; financial verification framed as verification.
8. Tap the privacy policy link from the login screen (the 2.1(a) fix — re-verify it, it was fixed in a different build).

### 6.3 Regression risk to watch

Renaming `generositySignals` touches trust computation code paths. The trust score is **cohort-percentile normalised** — a mistake here silently redistributes every user's score. Run the existing trust tests, and diff computed scores for a sample of production users before and after. A pure rename must produce byte-identical scores; if it doesn't, something else changed.

---

## 7. WS-6 — App Store Connect (not code)

Owned by whoever holds ASC access, but sequenced with the build.

1. **App Review Notes** — currently two generic sentences, and it is the highest-leverage field we control. It must contain: demo credentials; a numbered walkthrough to the Bestie thread; the background-audio recording URL with an explicit pointer that this is the 2.5.4 evidence; a plain statement that **Notice Me is free and the app contains no in-app purchases or subscriptions**; and a short note that transactional framing has been removed from the archetype copy and the referral surface.
2. **Reply to Apple** — **process is fixed: the developer writes the draft, sends it to Sree, and Sree approves it before it is submitted to App Review.** Nothing goes to Apple unreviewed.

   Content requirements for that draft: explicitly correct the paid-"Notice Me" claim from the Jul 17 letter, because Apple's file currently says in our own words that we sell access to women. Lead with the 1.1.4 removals — name the specific screen in `Screenshot-0725-144835.png` and what changed on it, since Apple wants removal, not argument. Then the 2.5.4 recording URL. Re-state the AI-proxy + identity-verification differentiation to keep 4.3(b) buried, but **do not** re-use money, generosity or wealth-ranking as differentiators — that is precisely what converted a spam finding into a compensated-dating finding.
3. **Store description / promotional text** — soften the economic framing ("value, not popularity", "what you bring vs what you want", "more proven"). Read innocently it is a compatibility engine; read by a primed reviewer it is a marketplace. Paste the current text into the ticket so it can be edited concretely.
4. **Leave Age Assurance and Parental Controls at No.** 2.3.6 is closed. The argument that ID+liveness "is arguably age assurance" is true in spirit and wrong tactically — do not re-open a resolved finding.
5. **Do not chase the bundle ID.** `com.pocketdatingcoach.app` vs the riteangle brand cannot be changed after app creation. Noise.
6. **Low priority, real:** `mobile/lib/pre_auth_lane_screen.dart:107` promises "Get matched within MM:SS minutes" on a live countdown, pre-auth. If that is not literally true, it is 2.3.1 bait for a future round.

---

## 8. Decisions — ANSWERED

**All blocking questions were answered by Sree on 2026-07-29. Implement exactly as recorded below; do not substitute your own judgement on these without going back to Sree.**

| # | Question | **DECISION** |
| --- | --- | --- |
| Q1 | Display name for the archetype pair | ✅ **"Experience-Led" on both sides.** The asymmetry was the violation; symmetry is the fix. |
| Q2 | "Pay later." (`pre_auth_lane_screen.dart:134`) | ✅ **Delete it.** No purchase language anywhere in the app until an IAP actually exists. |
| Q3 | `Roleplay` / `Power dynamics` / `BDSM-friendly` / `Group experiences` (§2.4) | ✅ **Cut all four**, both codebases. |
| Q4 | "What you bring to the table" section | ✅ **Keep the section, purge the money items.** Dropping it only for this archetype would read as concealment. |
| Q5 | "Wealth Proof" category | ✅ **Rename to "Financial Verification". Keep the category** — it is fraud/solvency proofing and part of the 4.3(b) defence. |
| Q6 | Income question | ✅ **Keep it, private.** Must never render to another user — §6.2 item 4 is the test. |
| Q7 | Deploy coupling | ✅ **iOS + Android + web ship together.** See §1.3 — Android is fully in scope, not just iOS. |
| Q8 | Reply to Apple | ✅ **Developer drafts it and sends the draft to Sree. Sree reviews and approves. Only then does it go to App Review.** No unreviewed reply — the Jul 17 letter is what caused this rejection. |

### Still open — decide during implementation, but assign an owner

*(Q9 is now closed by the Q7 decision: with Android in scope, there is no platform gate to build — see §3.1.)*

| # | Question | Owner | Recommendation |
| --- | --- | --- | --- |
| ~~Q9~~ | ~~Cash gate mechanism~~ | — | **Closed by Q7.** Android is in scope, so no gate exists — the earnings UI is removed from Flutter unconditionally (§3.1). |
| Q10 | Do mobile-originated referrals keep **accruing** cash invisibly, or stop accruing? | Product | Keep accruing, hide the display. Users who already earned must not lose money; the web surface still shows it. |
| Q11 | Rename "Refer & Earn" → "Invite" in the app, on web, or both? | Product | App only (both platforms). Web keeps its earnings UI and its name. |
| Q12 | **Does background audio actually work on device today?** Nothing in `voice_call_screen.dart` handles lifecycle or configures the audio session. Must be verified before we commit to the recording defence. | Eng | Verify first (§4.1). If it does not work, this becomes a real fix, not a recording task — escalate before submitting, since the fallback (drop the key) reverses a locked decision. |
| Q13 | Who films the recording, on what device, and where is it hosted? Needs a stable, no-login, non-expiring URL for the Notes field. | Eng + ASC owner | Whoever has a physical iPhone and the TestFlight build. Host on the marketing site, not a share link that can expire. |
| Q14 | Who seeds the review demo account with a live Bestie-proxy thread, and does that account bypass the verification/photo gates? (§4.2) | Eng | Extend the existing demo-login bypass. This is why Apple "could not locate" the audio feature — it is not optional. |
| Q15 | Is the `generositySignals` rename safe in the same release, given cohort-percentile trust normalisation? | Eng | Yes — pure rename. Prove it: computed scores must be byte-identical before/after on a production sample (§6.3). |
| Q16 | Financial dimension weight (`avgWeight: 0.16`) — relabel only, or reweight too? | Product | Relabel only this release. Reweighting is a scoring change and would muddy the diff in Q15. |
| Q17 | Keep the pre-auth "Get matched within MM:SS minutes" countdown? (§7.6) | Product | Remove it, or make it literally true. It is 2.3.1 bait on a submission already under scrutiny. |

### Resolved

| # | Question | Answer |
| --- | --- | --- |
| ~~Q0~~ | Which screen triggered 1.1.4? | **Resolved 2026-07-29.** The pre-auth archetype detail sheet — see §2.0. Downloaded and inspected. |

---

## 9. Sequencing

1. §2 copy purge + §3 cash removal + §5.1 paywall-tease removal → one branch, both codebases. Per the repo convention, work on `development` and merge to `main` when done; do not open a new feature branch.
2. §4.1 verify background audio on a physical device; fix if broken (iOS only).
3. §4.2 seed and test the review demo account from a clean iPad install.
4. §6.1 CI gate green; §6.2 manual checklist passed on iPad **and** iPhone **and** an Android device.
5. Build + bump `mobile/pubspec.yaml`; TestFlight; run §6.2 once more against the actual TestFlight build.
6. §4.3 record background audio on the shipping build.
7. §7 notes + description. Developer drafts the reply → Sree approves → send.
8. Resubmit to App Review.
9. **Android release** — build the app bundle and upload to Play using the documented release process. Sequence this so the transactional copy is not live on Play while iOS is under review. Note the CI detection quirk: mobile changes are detected by diffing `origin/main...origin/development`, so push `development`, wait for the detect job, *then* push `main` — pushing the same SHA to `main` first makes the mobile job skip.

Do not resubmit until every item in §6.2 passes on the build being submitted. This app has been rejected twice, and round 2 introduced issues round 1 never raised — a third round is likely to surface something new again, so the goal is to leave nothing reachable that a reviewer can misread.

---

## 10. Implementation record & handover (added v1.3)

Commit `e20d376` on `development` — 39 files, +842/−468. Flutter: 62/62 tests pass, `flutter analyze` clean on every edited file (all remaining errors are in vendored `mobile/build/` SDK examples, pre-existing). Web: 258 unit tests pass across the affected suites; `svelte-check` introduced no new errors against a pre-existing baseline of 202. `scripts/check-banned-strings.sh` is green. Web verified in-browser: the pre-auth screen now reads "Earn your profile, verify your intent." with no purchase language, and "We verify ID, photos, lifestyle & intent."

### 10.1 Five surfaces this document originally missed

Manual review found the archetype sheet. These five were found only by the banned-string gate and by walking the running app — which is the argument for keeping the gate in CI.

| # | Surface | Why it mattered |
| --- | --- | --- |
| 1 | **Income + net worth on the public profile** — `profile_body.dart` rendered both as 22px hero numbers in the reviewed binary; `PublicProfileBody.svelte` showed "Annual Income · Self declared" plus wealth tiles and "✓ AI verified via bank statement". | The most direct violation in the product, and a flat contradiction of decision Q6. Now career-only on both platforms. |
| 2 | **Per-date spend band** — `SpendingQAStep.svelte` asked a man's "comfort level with spending on dates" in ₹ bands including "Generous spender ₹8,000–20,000", and `profile/+page.svelte` published the answer as an "On dates 💸" chip. | Advertising a price per date. Web-only, so not in the reviewed binary, but live on the site. |
| 3 | **"Pay later." on web** — `verified-vibe/home/+page.svelte` carried the same string as the app's pre-auth screen. | Fixing only the app would have left it one link away. |
| 4 | **The `_drawnToCasual` option set** — `onboarding_questions.dart` offered Luxury hotels · VIP nightlife · High-end social · Exotic cars · Financial generosity · Thoughtful gifting · Luxury treatment. | **In the reviewed binary**, two screens past the sheet Apple photographed. |
| 5 | **"Provider mindset"** and a wider luxury vocabulary across `DrawnToStep`, `CasualGenerousProfileStep`, `SpendingQAStep`, and the `public-profile` API's `brings` list (`Financial stability` / `Generosity on dates` returned straight to a viewer). | The API list is what a profile viewer actually receives, regardless of client. |

### 10.2 What is left — nothing here is code

1. **§4.1 — verify background audio on a physical device.** Unstarted, and it is the only open item that could reverse a locked decision. `voice_call_screen.dart` still has no lifecycle handling and no explicit audio-session configuration; background continuation is riding on the plist key alone. Verify before filming.
2. **§4.2 — seed the review demo account** with a live Bestie-proxy thread. Without it the "Call Bestie" pill never renders and the reviewer cannot reach the feature, which is why Apple could not find it the first time.
3. **§4.3 — record the recording**, host it at a stable no-login URL.
4. **§6.2 — run the manual checklist** on iPad, iPhone and an Android device against the actual TestFlight build.
5. **§7 — App Store Connect**: review notes, the store description, and the reply. Reply process is fixed: developer drafts → Sree approves → send. It must correct the paid-"Notice Me" claim; Apple's file currently says in our own words that we sell access to women.
6. **Wire `scripts/check-banned-strings.sh` into CI** so it runs on every push rather than by hand.
7. **Android release** per §9 step 9, minding the `origin/main...origin/development` detect quirk.
8. **Q10/Q11/Q15/Q16/Q17 in §8** remain open but unblocking. Note Q9 is closed: with Android in scope there is no platform gate to build.

### 10.3 One thing to watch

`lifestyleSignals` (was `generositySignals`) is a pure rename and weights are unchanged, so computed trust totals should be identical. That was verified by unit tests, **not** against production data. Trust is cohort-percentile normalised, so before deploying, diff computed scores for a sample of real users and confirm they are byte-identical — §6.3.
