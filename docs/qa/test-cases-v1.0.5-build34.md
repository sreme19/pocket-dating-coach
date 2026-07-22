# QA Test Cases — riteangle v1.0.5 (Build 34)

Generated from git commits merged to `main` on 21–22 July 2026.  
All test cases require: a verified man account with ≥1 active match (woman with AI Bestie enabled).

---

## Feature 01 — In-Chat Proof Upload: Up to 10 Photos + Face Guidance
**Commit:** `ccd8ea9`

| ID | Action | Expected | Status | Notes |
|----|--------|----------|--------|-------|
| TC-01 | Upload 1 photo as proof inside an active chat | Proof submitted; Bestie acknowledges it in the next message | ⬜ Pending | |
| TC-02 | Upload exactly 10 photos in one proof session | All 10 accepted, no limit error shown | ⬜ Pending | |
| TC-03 | Upload a photo without a visible face | Rejection + face-positioning guidance shown | ⬜ Pending | |
| TC-04 | Attempt to upload an 11th photo | Upload blocked or capped at 10 with a clear message | ⬜ Pending | |

---

## Feature 02 — Trust & Boost Nudge Sheet (Post-Verification)
**Commit:** `71b3f6c`

| ID | Action | Expected | Status | Notes |
|----|--------|----------|--------|-------|
| TC-05 | Upload a valid proof photo that passes verification | "Trust & Boost" sheet slides up automatically | ⬜ Pending | |
| TC-06 | Read the Trust & Boost sheet content | Sheet shows the verified category and a trust score delta | ⬜ Pending | |
| TC-07 | Dismiss the sheet (swipe down / tap close) | Sheet closes; user returns to chat without losing scroll position | ⬜ Pending | |

---

## Feature 03 — Bestie: Proactive Proof Invites Targeted to Her Preferences
**Commit:** `4ec917b`

| ID | Action | Expected | Status | Notes |
|----|--------|----------|--------|-------|
| TC-08 | Man mentions job/company ("I work at a startup") | Bestie invites career/LinkedIn proof with a rank-benefit estimate | ⬜ Pending | |
| TC-09 | Man mentions travel ("just got back from Japan") | Bestie invites a travel proof upload | ⬜ Pending | |
| TC-10 | Man mentions gym/fitness | Bestie invites a discipline proof upload | ⬜ Pending | |
| TC-11 | Bestie already invited a category once; send next message | No repeated invite for the same category in consecutive messages | ⬜ Pending | |
| TC-12 | Man explicitly declines ("no thanks, I'd rather not") | Bestie responds gracefully; that category never raised again | ⬜ Pending | |

---

## Feature 04 — Bestie Hand-off Gate: Substance Floor
**Commit:** `af22d06`

| ID | Action | Expected | Status | Notes |
|----|--------|----------|--------|-------|
| TC-13 | Send 10+ casual messages only ("haha", "nice", "cool") with no real info | Bestie does NOT hand off; continues drawing out meaningful info | ⬜ Pending | |
| TC-14 | Chat normally and upload at least one verified proof | Hand-off becomes eligible after substance floor is met | ⬜ Pending | |
| TC-15 | Man shares real self-disclosure (job, city, lifestyle) without a proof | Substance floor met; hand-off can proceed if other conditions are satisfied | ⬜ Pending | |

---

## Feature 05 — Bestie Hand-off Gate: Proof Must Match Her Values
**Commit:** `a4696f5`

| ID | Action | Expected | Status | Notes |
|----|--------|----------|--------|-------|
| TC-16 | Woman values "career"; man uploads a travel proof only | Gate not satisfied; Bestie invites career proof before handing off | ⬜ Pending | |
| TC-17 | Woman values "travel"; man uploads a verified travel photo | Gate satisfied; hand-off proceeds when other conditions are met | ⬜ Pending | |

---

## Feature 06 — Bestie Gap-Drilling Cap: Max 2 Probes Per Topic
**Commit:** `dfac9b4`

| ID | Action | Expected | Status | Notes |
|----|--------|----------|--------|-------|
| TC-18 | Bestie asks about hometown twice; man deflects both times | Third message moves to a different topic — no third probe | ⬜ Pending | |
| TC-19 | Observe 5 consecutive Bestie messages in a new conversation | No single topic probed more than twice; topics visibly rotate | ⬜ Pending | |

---

## Feature 07 — Bestie: Warm Acknowledgement of Proof Upload
**Commit:** `4bf0f20`

| ID | Action | Expected | Status | Notes |
|----|--------|----------|--------|-------|
| TC-20 | Upload and verify a discipline proof mid-conversation | Bestie's next reply references the specific proof category warmly (once), then continues chat | ⬜ Pending | |
| TC-21 | Check the acknowledgement reply for length and tone | Acknowledgement is ≤2 sentences, not gushing; conversation continues naturally | ⬜ Pending | |

---

## Feature 08 — In-Chat Verify: Photo Only (No Documents)
**Commit:** `074caf1`

| ID | Action | Expected | Status | Notes |
|----|--------|----------|--------|-------|
| TC-22 | Tap the 📎 Verify button inside an active chat | Photo picker opens — only camera/gallery option shown, no document/file option | ⬜ Pending | |
| TC-23 | Try to attach a PDF or document file via Verify | Document option not available; only photos can be selected | ⬜ Pending | |
| TC-24 | Upload a valid photo via in-chat Verify | Photo accepted and proof flow proceeds normally | ⬜ Pending | |

---

## Summary

| Total | Passed | Failed | Pending |
|-------|--------|--------|---------|
| 24 | 0 | 0 | 24 |

**Tester:** _______________  
**Date tested:** _______________  
**Build tested:** v1.0.5 (34/35) — Production (riteangle.dating)
