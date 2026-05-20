# Stage 1 — Next Steps & Recommendations

## Current Status
✓ Code reviewed and analyzed
✓ Implementation plan created (STAGE_1_PLAN.md)
✓ Test cases documented (STAGE_1_TESTS.md)
✓ FAL_KEY setup scripts created (for Stage 2)

---

## Recommended Next Action

### Start with Phase 1A: Dev Mode Bypass

**Why start here?**
- Smallest scope (1 file modification)
- Unblocks all subsequent phases
- Quick to test and verify
- No API calls or complex logic

**What to build:**
1. Modify `src/routes/verified-vibe/home/+page.svelte`
2. After archetype selection, create a dev user in localStorage
3. Navigate directly to `/verified-vibe/verification` (skip auth)

**Expected time:** 15-20 minutes

**Files to modify:**
- `src/routes/verified-vibe/home/+page.svelte`

**Test:** Follow test case **1A.1** in STAGE_1_TESTS.md

---

## Why This Approach Works

### Test-Driven Benefits
1. **Each phase is independently testable** — You can verify it works before moving on
2. **Clear success criteria** — Test cases define exactly what "done" means
3. **Reversible** — If something breaks, you know exactly which phase caused it
4. **Confidence** — You can commit after each phase with confidence

### Staged Commits
After each phase passes its tests:
```bash
git add .
git commit -m "feat: phase 1X description"
git push origin feature/stage-1-phase-1X
```

This keeps commits small, focused, and easy to review/revert.

---

## Phase Dependencies

```
1A (Dev bypass)
  ↓
1B (Intake form) — requires 1A to reach verification
  ↓
1C (Synthesis API) — requires 1B to have form data
  ↓
1D (Profile page) — requires 1C to have generated profile
```

**You cannot skip phases.** Each depends on the previous one.

---

## Questions Before We Start

1. **Ready to start Phase 1A?** I can build it now and you test it.
2. **Prefer I build all 4 phases at once, or one at a time?** 
   - One at a time = safer, more feedback loops
   - All at once = faster, but harder to debug if something breaks
3. **Any concerns about the plan or test cases?**

---

## What Happens After Stage 1

Once all 4 phases pass their tests:
- Male users can complete verification → land on profile page
- Profile is AI-generated and editable
- All data persists in localStorage
- Ready to move to **Stage 2: AI Photo Generation**

Stage 2 will:
- Use the photos uploaded in step 3
- Call fal.ai FLUX PuLID to generate AI-enhanced versions
- Replace placeholders on profile page with generated photos
- Add "Enhance with AI" button

---

## Commit Strategy

Suggested commit messages:

```
Phase 1A:
  feat: dev mode bypass for verification flow

Phase 1B:
  feat: add profile intake step 5 to verification

Phase 1C:
  feat: add profile synthesis API with Claude

Phase 1D:
  feat: add profile page with public and enhance modes

Final:
  feat: complete stage 1 - male profile onboarding pipeline
```

---

## Files We'll Create/Modify

### Phase 1A
- Modify: `src/routes/verified-vibe/home/+page.svelte`

### Phase 1B
- Create: `src/lib/verified-vibe/components/ProfileIntakeStep.svelte`
- Modify: `src/routes/verified-vibe/verification/+page.svelte`

### Phase 1C
- Create: `src/routes/api/verified-vibe/generate-profile/+server.ts`
- Modify: `src/lib/verified-vibe/components/ProfileIntakeStep.svelte`

### Phase 1D
- Create: `src/routes/verified-vibe/profile/+page.svelte`
- Modify: `src/lib/verified-vibe/components/ProfileIntakeStep.svelte`

**Total new files:** 3
**Total modified files:** 3

---

## Ready?

Let me know:
1. Should I start with Phase 1A?
2. One phase at a time or all at once?
3. Any questions about the plan?

I'll build it, you test it, we iterate until all tests pass, then commit.
