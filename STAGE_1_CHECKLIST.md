# Stage 1 Implementation Checklist

## Pre-Implementation

- [ ] Review QUICK_REFERENCE.md (5 min read)
- [ ] Review STAGE_1_PLAN.md (10 min read)
- [ ] Confirm dev server is running: `npm run dev`
- [ ] Confirm VITE_SKIP_VERIFICATION=true in .env.local
- [ ] Confirm app loads at http://localhost:5174

---

## Phase 1A: Dev Mode Bypass

### Build
- [ ] Modify `src/routes/verified-vibe/home/+page.svelte`
  - [ ] After archetype selection, create dev user object
  - [ ] Save to localStorage as `vv_user`
  - [ ] Navigate to `/verified-vibe/verification` (skip auth)

### Test (Test Case 1A.1)
- [ ] Open http://localhost:5174/verified-vibe/gate
- [ ] Select "Man"
- [ ] Confirm 18+
- [ ] Click "Continue"
- [ ] Select any archetype
- [ ] Click "Lock In"
- [ ] Verify URL is `/verified-vibe/verification` (NOT `/verified-vibe/auth`)
- [ ] Open DevTools → Application → localStorage
- [ ] Find `vv_user` key
- [ ] Verify it contains: id, gender, archetype, firstName, trustScore

### Commit
- [ ] `git add .`
- [ ] `git commit -m "feat: dev mode bypass for verification flow"`
- [ ] `git push origin feature/stage-1`

---

## Phase 1B: Profile Intake Step

### Build
- [ ] Create `src/lib/verified-vibe/components/ProfileIntakeStep.svelte`
  - [ ] Form with fields: firstName, age, city, about, personalityTags, lookingFor, interests
  - [ ] Personality tags: chip selector, pick 3 from ~15 options
  - [ ] Looking for: radio/button group with 2-3 options
  - [ ] Interests: chip selector, pick up to 5
  - [ ] Submit button
  - [ ] Loading state during submission
  - [ ] Error handling

- [ ] Modify `src/routes/verified-vibe/verification/+page.svelte`
  - [ ] Add step 5 to steps array
  - [ ] Render ProfileIntakeStep component for step 5
  - [ ] Handle step 5 submission

### Test (Test Cases 1B.1, 1B.2, 1B.3)
- [ ] Complete Phase 1A (reach verification)
- [ ] Skip steps 1-4
- [ ] Verify step 5 shows "Step 5 of 5"
- [ ] Verify all form fields render
- [ ] Fill form with sample data:
  - [ ] First name: "Marcus"
  - [ ] Age: 31
  - [ ] City: "Brooklyn, NY"
  - [ ] About: "Product designer by day, amateur chef by night"
  - [ ] Personality: Select 3 tags
  - [ ] Looking for: Select one option
  - [ ] Interests: Select 3-5 tags
- [ ] Click Submit
- [ ] Open DevTools → Application → localStorage
- [ ] Find `vv_profile_draft` key
- [ ] Verify all form data is saved correctly
- [ ] Reload page
- [ ] Verify `vv_profile_draft` still exists with same data

### Commit
- [ ] `git add .`
- [ ] `git commit -m "feat: add profile intake step 5 to verification"`
- [ ] `git push origin feature/stage-1`

---

## Phase 1C: Profile Synthesis API

### Build
- [ ] Create `src/routes/api/verified-vibe/generate-profile/+server.ts`
  - [ ] POST endpoint
  - [ ] Validate request body (firstName, age, city, about, etc.)
  - [ ] Call Claude with profile synthesis prompt
  - [ ] Parse Claude response
  - [ ] Return JSON with: about, personalityDescriptors, intentStatement, lifestyleTags

- [ ] Modify `src/lib/verified-vibe/components/ProfileIntakeStep.svelte`
  - [ ] After form validation, call `/api/verified-vibe/generate-profile`
  - [ ] Pass: vv_profile_draft data + archetype + trustScore
  - [ ] Save response to localStorage as `vv_profile`
  - [ ] Navigate to `/verified-vibe/profile`

### Test (Test Cases 1C.1, 1C.2, 1C.3)
- [ ] Complete Phase 1B (have vv_profile_draft in localStorage)
- [ ] Submit step 5 form
- [ ] Open DevTools → Network tab
- [ ] Look for POST to `/api/verified-vibe/generate-profile`
- [ ] Verify request payload is correct
- [ ] Verify response status is 200
- [ ] Verify response contains: about, personalityDescriptors, intentStatement, lifestyleTags
- [ ] Open DevTools → Application → localStorage
- [ ] Find `vv_profile` key
- [ ] Verify all fields are present
- [ ] Verify generated about is better/more polished than user input
- [ ] Verify no console errors

### Commit
- [ ] `git add .`
- [ ] `git commit -m "feat: add profile synthesis API with Claude"`
- [ ] `git push origin feature/stage-1`

---

## Phase 1D: Profile Page

### Build
- [ ] Create `src/routes/verified-vibe/profile/+page.svelte`
  - [ ] Read vv_user, vv_profile, vv_photos from localStorage
  - [ ] Two modes: public (default) and enhance (edit)
  - [ ] Public view sections:
    - [ ] Hero photo (lead photo or placeholder)
    - [ ] Name, age, city
    - [ ] Archetype badge
    - [ ] Trust score chip
    - [ ] About blurb (from vv_profile.about)
    - [ ] Personality tags (from vv_profile.personalityDescriptors)
    - [ ] Photo grid (5 slots, show uploaded or placeholders)
    - [ ] Lifestyle tags (from vv_profile.lifestyleTags)
    - [ ] Intent statement (from vv_profile.intentStatement)
  - [ ] Enhance mode:
    - [ ] About field becomes editable textarea
    - [ ] Personality tags become editable chip selector
    - [ ] Lifestyle tags become editable chip selector
    - [ ] Save button (updates localStorage)
    - [ ] Cancel button (discards changes)
  - [ ] Toggle button between modes

### Test (Test Cases 1D.1 through 1D.6)
- [ ] Complete Phase 1C (have vv_profile in localStorage)
- [ ] Verify page navigates to `/verified-vibe/profile`
- [ ] Verify all sections render:
  - [ ] Hero photo displays
  - [ ] Name shows "Marcus, 31"
  - [ ] City shows "Brooklyn, NY"
  - [ ] Archetype badge displays
  - [ ] Trust score displays
  - [ ] About shows AI-generated text
  - [ ] Personality tags display
  - [ ] Photo grid shows 5 slots
  - [ ] Lifestyle tags display
  - [ ] Intent statement displays
- [ ] Click "Enhance" button
- [ ] Verify fields become editable
- [ ] Edit about field: change text
- [ ] Edit personality tags: remove one, add another
- [ ] Click "Save"
- [ ] Verify page returns to public view
- [ ] Verify changes are visible
- [ ] Reload page
- [ ] Verify changes persist
- [ ] Click "Enhance" again
- [ ] Edit about field: change text
- [ ] Click "Cancel"
- [ ] Verify changes are discarded
- [ ] Verify original text is shown

### Commit
- [ ] `git add .`
- [ ] `git commit -m "feat: add profile page with public and enhance modes"`
- [ ] `git push origin feature/stage-1`

---

## End-to-End Test (Test Case E2E.1)

- [ ] Start at http://localhost:5174/verified-vibe/gate
- [ ] Select "Man" → Confirm 18+ → Continue
- [ ] Select archetype → Lock In
- [ ] Skip steps 1-4 of verification
- [ ] Fill step 5 form with sample data
- [ ] Submit
- [ ] Wait for API response
- [ ] Verify profile page loads
- [ ] Verify all data is correct
- [ ] Verify localStorage has: vv_user, vv_profile_draft, vv_profile
- [ ] No console errors

---

## Failure Scenarios (Test Cases F.1, F.2)

- [ ] Try to submit step 5 with empty required fields
  - [ ] Verify validation error shows
  - [ ] Verify submit is blocked
  - [ ] Verify no API call is made

- [ ] Simulate API error (network offline or API down)
  - [ ] Try to submit step 5
  - [ ] Verify error message displays
  - [ ] Verify localStorage is NOT updated with invalid data
  - [ ] Verify user can retry

---

## Final Verification

- [ ] All 16 test cases pass
- [ ] No console errors
- [ ] localStorage has correct data structure
- [ ] All 4 phases committed with clean commit messages
- [ ] Can navigate through entire flow without errors

---

## Ready for Stage 2?

Once all tests pass:
- [ ] Review STAGE_1_SUMMARY.txt
- [ ] Confirm all phases are working
- [ ] Prepare for Stage 2: AI Photo Generation
- [ ] Confirm FAL_KEY is set up (run `npm run setup:fal`)

---

## Notes

- Use browser DevTools liberally (Application tab for localStorage, Network tab for API calls)
- If something breaks, check console for errors first
- If a test fails, don't move to next phase — debug first
- Each phase depends on previous phases working correctly
- All data stays in localStorage (no Supabase writes)

---

## Questions?

See documentation:
- QUICK_REFERENCE.md — Quick lookup
- STAGE_1_PLAN.md — Detailed plan
- STAGE_1_TESTS.md — All test cases
- CURRENT_ANALYSIS.md — Codebase analysis

Ready to start Phase 1A? ✓
