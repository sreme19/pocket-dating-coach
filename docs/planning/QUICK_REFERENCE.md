# Stage 1 Quick Reference

## TL;DR

**Goal:** Build male profile onboarding → profile page pipeline

**4 Phases:**
1. **1A** (15 min) — Dev bypass: skip auth after archetype selection
2. **1B** (30 min) — Intake form: collect profile data in step 5
3. **1C** (20 min) — Synthesis API: Claude generates polished profile
4. **1D** (45 min) — Profile page: public view + enhance mode

**Total:** ~2 hours

---

## Phase 1A: Dev Bypass

**File:** `src/routes/verified-vibe/home/+page.svelte`

**Change:** After archetype selection, create dev user and navigate to verification

**Test:** Select Man → Select archetype → Land on `/verified-vibe/verification` (not auth)

---

## Phase 1B: Intake Form

**New file:** `src/lib/verified-vibe/components/ProfileIntakeStep.svelte`

**Modified file:** `src/routes/verified-vibe/verification/+page.svelte`

**Form fields:**
- First name (text)
- Age (number)
- City (text)
- About you (textarea)
- Personality tags (chips, pick 3)
- Looking for (radio/buttons)
- Interests (chips, pick 5)

**Save to:** `vv_profile_draft` in localStorage

**Test:** Fill form → Submit → Check localStorage

---

## Phase 1C: Synthesis API

**New file:** `src/routes/api/verified-vibe/generate-profile/+server.ts`

**Input:** `vv_profile_draft` + archetype + trust score

**Output:** 
```json
{
  "about": "polished blurb",
  "personalityDescriptors": ["tag1", "tag2", "tag3"],
  "intentStatement": "what they're looking for",
  "lifestyleTags": ["tag1", "tag2", "tag3"]
}
```

**Save to:** `vv_profile` in localStorage

**Test:** Submit form → API called → Response saved

---

## Phase 1D: Profile Page

**New file:** `src/routes/verified-vibe/profile/+page.svelte`

**Two modes:**
- **Public:** Read-only display of profile
- **Enhance:** Editable fields with save/cancel

**Sections:**
- Hero photo
- Name, age, city + badges
- About blurb
- Personality tags
- Photo grid (5 slots)
- Lifestyle tags
- Intent statement

**Test:** Profile renders → Edit fields → Save → Reload → Changes persist

---

## localStorage Keys

```
vv_user = {
  id, gender, archetype, firstName, age, city, trustScore
}

vv_profile_draft = {
  firstName, age, city, about, personalityTags, lookingFor, interests
}

vv_profile = {
  about, personalityDescriptors, intentStatement, lifestyleTags
}

vv_photos = [
  { dataUrl, label }
]
```

---

## Test Checklist

### 1A
- [ ] Reach verification without auth

### 1B
- [ ] Step 5 form renders
- [ ] Form data saves to localStorage
- [ ] Data persists on reload

### 1C
- [ ] API called with correct payload
- [ ] Response is valid JSON
- [ ] Response saved to localStorage
- [ ] Generated about is better than user input

### 1D
- [ ] Profile page renders
- [ ] All sections display correctly
- [ ] Enhance mode toggle works
- [ ] Edits save to localStorage
- [ ] Changes persist on reload
- [ ] Cancel discards changes

---

## Commands

```bash
# Start dev server
npm run dev

# Check for errors
npm run check

# Run tests (if any)
npm run test

# Setup FAL_KEY (for Stage 2)
npm run setup:fal
```

---

## Key Files to Know

```
src/routes/verified-vibe/
  ├── gate/+page.svelte          (gender selection)
  ├── home/+page.svelte          (archetype selection) [MODIFY 1A]
  ├── auth/+page.svelte          (email OTP)
  ├── verification/+page.svelte  (4-step flow) [MODIFY 1B]
  ├── profile/+page.svelte       (NEW 1D)
  └── api/verified-vibe/
      ├── verify-step/+server.ts (existing)
      └── generate-profile/+server.ts (NEW 1C)

src/lib/verified-vibe/
  ├── components/
  │   ├── IDExtractionStep.svelte
  │   ├── LivenessStep.svelte
  │   ├── PhotoUploadStep.svelte
  │   ├── SpendingUploadStep.svelte
  │   ├── SpendingQAStep.svelte
  │   └── ProfileIntakeStep.svelte (NEW 1B)
  ├── stores.ts                   (state management)
  ├── types.ts                    (TypeScript types)
  └── server/
      └── verification.ts         (Claude Vision calls)
```

---

## Common Patterns

### Component with submit handler
```svelte
<script lang="ts">
  let loading = $state(false);
  let error = $state<string | null>(null);
  
  async function handleSubmit() {
    loading = true;
    error = null;
    try {
      const response = await fetch('/api/endpoint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed');
      const result = await response.json();
      // Handle success
    } catch (e) {
      error = e instanceof Error ? e.message : 'Error';
    } finally {
      loading = false;
    }
  }
</script>
```

### Save to localStorage
```typescript
const data = { /* ... */ };
localStorage.setItem('key', JSON.stringify(data));
```

### Read from localStorage
```typescript
const data = JSON.parse(localStorage.getItem('key') || '{}');
```

---

## When to Commit

After each phase passes its tests:

```bash
git add .
git commit -m "feat: phase 1X - description"
git push origin feature/stage-1
```

---

## Questions?

See full docs:
- `STAGE_1_PLAN.md` — Detailed implementation plan
- `STAGE_1_TESTS.md` — All test cases
- `CURRENT_ANALYSIS.md` — Codebase analysis
- `STAGE_1_NEXT_STEPS.md` — What's next

Ready to start Phase 1A? 🚀
