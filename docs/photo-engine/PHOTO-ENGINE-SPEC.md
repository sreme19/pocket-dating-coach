# riteangle — Men's AI Photo Engine: Spec & Guardrails

_Derived from the 2026-06-29 bake-off (5 men, multiple providers). This is the production
blueprint for turning a man's uploaded photos into his AI profile photos._

---

## 0. Decision

| | |
|---|---|
| **Engine (MVP / free tier)** | **Gemini 2.5 Flash Image** ("Nano Banana"), **multi-reference + edit-framing + flattering dial** |
| **Cost** | ~$0.04/image → **~$120 / 1,000 men** (3 photos each) — fits the MVP budget |
| **Training** | **None** (zero-shot edit) |
| **Premium / "Pro photos" tier (later)** | Per-person **fine-tune** (Astria FLUX LoRA, recipe in the internal photo-enhance notes, tune #5196244) — perfect identity, ~$1.80/man |
| **Rejected** | Gemini *recreate*-framing (drifts), InstantID/SDXL (cartoon, bad hands), flux-pulid (balds, glossy) |

**Why Gemini-edit won:** most realistic of the field, and framing it as an *edit of one real
man* (not a recreation) preserves identity + hair while keeping realism. Validated across a
diverse cohort: young/clean-shaven, short-hair, long-curly-bearded, middle-aged, older-grey.

---

## A. INPUT GUARDRAILS — which photos to accept & feed

**Reference selection is the single biggest quality lever.** (Chris balded when fed all 12 of
his photos incl. wet-hair pool selfies; he was "the very best" on a curated 4 clean frontals.)

Per man, auto-select **3–8** references that are:
- ✅ clear, **frontal** (or near-frontal), in focus, well-lit
- ✅ **dry, natural hair** as he normally wears it
- ✅ **solo** (his face dominant)
- ✅ varied angle/expression/setting

**Reject / exclude from the reference set:**
- ❌ wet/slicked hair, hats, sunglasses, heavy profile/up-angle, very distant
- ❌ group shots / another person near him (muddies multi-reference identity)
- ❌ blurry, low-res, or screenshots
- ❌ AI-generated or manipulated uploads (**anti-AI-forgery check** — reuse the P7 pipeline)
- ❌ photos that fail the **same-person face-match** against the others

If fewer than 3 usable photos survive → prompt the user to upload better ones (don't generate
from junk).

---

## B. PER-MAN APPEARANCE READ (one vision call)

Run **one** vision call per man over his selected photos to extract a short descriptor and a few flags. This drives both the prompt and the styling rules.

Extract:
- **hair**: length, texture, colour, hairline — and flag **grey / thinning / bald**
- **facial hair**: style + grey
- **build**: slim / average / **heavier / pot-belly**
- **age bracket**, **glasses (y/n)**

Prompt for it (≈12-word output):
> _"Describe ONLY this man's hair (length, texture, colour, hairline), facial hair, age, and build as a short comma-separated phrase for an image prompt. Flag if balding or genuinely bald, and if heavier-set. No name, clothing, or background."_

---

## C. GENERATION PROMPT (the recipe)

**Feed the curated reference photos as multi-image input** to `gemini-2.5-flash-image`, with this prompt (placeholders: `{scene}`, `{appearance}`, `{styling}`):

> These are reference photos of ONE specific real man. Produce a new, **flattering, photorealistic** photograph of the **SAME man**, `{scene}`. Keep his identity unmistakable: same face, bone structure, hair, hairline, beard and age bracket as the references, `{appearance}` — change only the background/setting and clothing `{styling}`.
> Show him at his **BEST**, the way a great photographer + good lighting would: well-rested and approachable — soften under-eye bags and dark circles, even and freshen his skin, neatly groom his beard and hair, warm flattering light, relaxed confident expression.
> But do **NOT** cross into a different or idealized person: do NOT slim or reshape his face, do NOT make him younger or older, do NOT change his hairline, hair length, or ethnicity.
> Natural skin texture (not plastic, glossy, or over-retouched), head-and-shoulders, photorealistic. He must be instantly recognizable as the same man — just his most attractive real self.

**Prompt-design lessons (do NOT regress):**
- ❌ "Recreate him as a youthful man with full hair" → idealizes & **drifts/ages/baldens**.
- ❌ Pure "keep identical, don't idealize" → too faithful, **keeps eye-bags/dark-circles/grey-stubble** ("realistic but unattractive").
- ✅ **Edit-framing + flattering dial** (above) → recognizable AND attractive = brand's "genuine best".

**Scenes (the library):** `lead` (clean portrait), `warmth` (café/indoor), `lifestyle` (outdoor/street). Rich-background scenes render especially well. Extend per archetype.

**Framing — prefer chest-up / waist-up; avoid full-body.** The reliable shots are head-and-shoulders to waist-up (café/portrait). **Full-body compositions risk an oversized head / wrong head-to-body proportion** that reads as unattractive. Constrain every scene to **at most waist-up**, and add to the prompt: _"correctly proportioned, realistic head-to-body ratio — the head must not be oversized."_ If a full-body shot is wanted, it MUST go through generate-N + proportion check (E).

**For OLDER / grey men** add to the prompt: _"preserve his grey/salt-and-pepper hair and his real age — do NOT darken his hair or make him look younger."_ (Without this, the model de-ages them.)

---

## D. STYLING-BY-FEATURE RULES (flattering wardrobe `{styling}`)

Driven off the appearance flags in (B). Apply **only** when the flag is true:
- **Genuinely bald / heavily thinning** → _"wearing a stylish hat or cap."_ (flatters + dodges bad-scalp rendering). **Never** hat a man with good hair — it hides his best feature.
- **Pot belly / heavier build** → _"wearing a well-structured blazer / smart layered jacket"_ (flatters the midsection).
- Otherwise → natural smart-casual fitting the scene.

---

## E. OUTPUT GUARDRAILS — generate-N, pick-best, label

**Generate several candidates per scene (e.g., 3–4) and auto-pick the best** — Gemini varies
shot-to-shot (the older man de-aged in one scene, kept grey in another). Score each candidate
with a vision judge and keep the top:
- **identity** match vs the reference photos (compare against ALL refs, not one — single-ref comparison under-scores good shots)
- **flattering** (attractive, well-lit, confident)
- **realism** (reads as a real photo, not AI)
- **artifact check** — reject broken hands/fingers, distorted eyes, extra limbs, garbled text/watermark, plastic/glossy skin, cartoonish, **oversized head / wrong head-to-body proportion**

**Hard rejects** (regenerate): identity drift to a different person · balding a non-bald man ·
de-aging · cartoon/gloss · anatomy errors · **oversized head / off body proportions**.

**Mandatory:** every output is **labeled "AI-generated from verified photos"** (brand honesty
requirement) and passes an **NSFW/safety** filter.

---

## F. COST & SCALE

- Per scene: `N candidates × $0.04`. 3 scenes × 3 candidates ≈ **$0.36/man** → **~$360/1,000** (or ~$120 at 1 candidate/scene — but candidates buy quality).
- **Lazy-generate**: only for men who complete onboarding / get viewed → pay for active users only.
- **Tiering**: free = this engine; **Pro = fine-tune** for men who want max fidelity.

---

## G. OBSERVED FAILURE MODES → MITIGATIONS (quick reference)

| Symptom | Cause | Mitigation |
|---|---|---|
| Different/older/balder face | "recreate" prompt; contaminated refs | edit-framing; curate refs (A); generate-N |
| Eye-bags, dark circles, grey stubble shown | over-faithful prompt | flattering dial (C) |
| Older man de-aged / hair darkened | model's young/dark-hair bias + variance | grey-hair guard (C); generate-N (E) |
| Balding a non-bald man | wet-hair/atypical refs diluted his hair | reference curation (A) |
| Cartoon, bad hands, over-muscled | wrong engine (SDXL InstantID) | use Gemini-edit, not SDXL ID models |
| Oversized head / wrong proportions | full-body composition | constrain to waist-up framing (C); generate-N + proportion reject (E) |
| Bald scalp looks bad | genuinely bald man | hat styling rule (D) |
| Pot belly unflattering | heavier build | blazer styling rule (D) |

---

_Harness that produced this: `scratch/photo-bakeoff/` (`run.mjs`, `gemini-prompts.mjs`, `build-grid.mjs`). The winning prompt is the live default in `run.mjs`._
