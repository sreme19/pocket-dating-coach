# Stage 2 Test Plan — AI Photo Generation with fal.ai

## Overview
Stage 2 adds AI photo enhancement to the male profile flow. After a user completes verification and lands on their profile page, they can click "Enhance with AI" to generate 5 new photos of themselves in different scenes using fal.ai's FLUX PuLID model.

## Implementation Status
✅ **Code Complete**
- Retry logic with exponential backoff (1 retry on failure)
- Progress tracking UI with progress bar and skeleton loading
- Full integration with profile page
- API endpoint configured with 90s timeout
- FAL_KEY configured in `.env.local`

## Build Status
✅ **Builds Successfully**
- No errors
- Only warnings: unused CSS selectors and accessibility hints (non-blocking)

## Test Scenarios

### Test 1: Verify Environment Configuration
**Objective**: Ensure FAL_KEY is properly configured and accessible

**Steps**:
1. Check `.env.local` contains `FAL_KEY=47d5e150-a6e9-441f-ae4b-66661e4581a2:0c0381e18f8f4ccf3f6a9b66953031c3`
2. Verify the API endpoint can read the key: `POST /api/photo-enhance/generate` with valid input
3. Check that missing FAL_KEY returns 500 error with helpful message

**Expected Result**: ✅ FAL_KEY is configured and accessible to the API

---

### Test 2: Complete Male Verification Flow
**Objective**: Ensure user can reach the profile page with uploaded photos

**Steps**:
1. Start app in dev mode (skip auth enabled)
2. Select "Casual Man" archetype on home page
3. Complete all 5 verification steps:
   - Step 1: ID verification (upload ID photo)
   - Step 2: Photo story (upload 3-5 photos, label them)
   - Step 3: Spending proof (select spending level)
   - Step 4: Q&A (answer questions)
   - Step 5: Profile intake (fill in name, age, city, about, personality, interests)
4. Verify profile page loads with:
   - User info (name, age, city, archetype badge, trust score)
   - Hero photo (lead photo from photo story)
   - About section (from profile intake)
   - Photo grid showing uploaded photos
   - "Enhance with AI" button visible

**Expected Result**: ✅ Profile page displays correctly with all user data and uploaded photos

---

### Test 3: AI Photo Generation — Success Path
**Objective**: Verify successful generation of 5 AI photos

**Steps**:
1. From profile page with uploaded photos, click "Enhance with AI"
2. Observe:
   - Button becomes disabled with spinner
   - Progress indicator appears: "Generating photos: 0/5"
   - Photo grid shows loading skeletons for each slot
   - Progress bar fills as photos are generated
3. Wait for generation to complete (~25-35 seconds)
4. Verify:
   - All 5 photos appear in grid with ✨ badge
   - Progress indicator shows "Generating photos: 5/5"
   - Button returns to normal state
   - Photos are saved to localStorage (`vv_ai_photos`)
   - "Regenerate photos" button appears

**Expected Result**: ✅ All 5 photos generated successfully with proper UI feedback

---

### Test 4: AI Photo Generation — Partial Failure
**Objective**: Verify graceful handling of failed photo generations

**Steps**:
1. Simulate network issue or API limit by:
   - Throttling network to slow 3G
   - Or waiting until fal.ai rate limit is hit
2. Click "Enhance with AI"
3. Observe generation progress
4. When failure occurs:
   - Some photos may succeed, some may fail
   - Error message appears: "X photos generated, Y failed"
   - Successful photos are displayed with ✨ badge
   - Failed slots show placeholder with "+" icon
5. Click "Regenerate photos" to retry

**Expected Result**: ✅ Partial failures handled gracefully with clear error messaging

---

### Test 5: Retry Logic
**Objective**: Verify automatic retry on transient failures

**Steps**:
1. Simulate transient network error (e.g., timeout on first attempt)
2. Click "Enhance with AI"
3. Observe:
   - First attempt fails
   - System automatically retries after 1 second delay
   - Second attempt succeeds
   - Photo appears in grid

**Expected Result**: ✅ Automatic retry succeeds without user intervention

---

### Test 6: Different Archetypes
**Objective**: Verify scene prompts are appropriate for different archetypes

**Test 6A: Casual Man**
1. Complete verification as "Casual Man"
2. Generate AI photos
3. Verify photos show casual, relaxed scenes:
   - Coffee shop, park, casual dinner, rooftop
   - Casual smart outfit, relaxed expressions

**Test 6B: Marriage-Minded Man**
1. Complete verification as "Marriage-Minded Man"
2. Generate AI photos
3. Verify photos show refined, intentional scenes:
   - Home setting, active outdoors, upscale dining, travel
   - Polished outfit, confident expressions

**Expected Result**: ✅ Scene prompts differ appropriately by archetype

---

### Test 7: Progress Tracking UI
**Objective**: Verify progress indicator updates correctly

**Steps**:
1. Click "Enhance with AI"
2. Watch progress indicator:
   - Starts at 0/5
   - Updates as each photo completes
   - Shows progress bar filling proportionally
   - Loading skeletons appear for photos being generated
   - Completed photos appear with ✨ badge
3. Verify final state shows 5/5

**Expected Result**: ✅ Progress indicator updates smoothly and accurately

---

### Test 8: Photo Grid Display
**Objective**: Verify photo grid displays correctly in both states

**Test 8A: Before AI Generation**
1. Profile page with uploaded photos
2. Verify:
   - Photo grid shows uploaded photos
   - No ✨ badge on photos
   - "Enhance with AI" button visible
   - "Regenerate photos" button NOT visible

**Test 8B: After AI Generation**
1. After successful generation
2. Verify:
   - Photo grid shows AI photos
   - All photos have ✨ badge
   - "Enhance with AI" button NOT visible
   - "Regenerate photos" button visible
   - Photos are labeled (lead, warmth, lifestyle, conversation, social)

**Expected Result**: ✅ Photo grid displays correctly in both states

---

### Test 9: Enhance Mode (Edit Profile)
**Objective**: Verify enhance mode doesn't interfere with photo generation

**Steps**:
1. Profile page in public mode
2. Click "Enhance" button to enter edit mode
3. Verify:
   - "Enhance with AI" button is NOT visible in edit mode
   - Photo grid is still visible
   - Can edit about, personality tags, intent, lifestyle
4. Save changes
5. Return to public mode
6. Click "Enhance with AI" to generate photos
7. Verify generation works normally

**Expected Result**: ✅ Enhance mode and photo generation don't conflict

---

### Test 10: localStorage Persistence
**Objective**: Verify AI photos are saved and persist across page reloads

**Steps**:
1. Generate AI photos successfully
2. Verify photos appear in grid
3. Reload page (Cmd+R)
4. Verify:
   - AI photos still appear in grid
   - ✨ badges still visible
   - "Regenerate photos" button still visible
   - localStorage contains `vv_ai_photos` with photo data

**Expected Result**: ✅ AI photos persist across page reloads

---

### Test 11: Error Scenarios

**Test 11A: Missing Reference Photo**
1. Try to call API without `referenceDataUrl`
2. Verify: 400 error with message "referenceDataUrl is required"

**Test 11B: Invalid Data URL**
1. Try to call API with non-image data URL
2. Verify: 400 error with message "referenceDataUrl must be a base64 image data URL"

**Test 11C: Missing FAL_KEY**
1. Temporarily remove FAL_KEY from `.env.local`
2. Try to generate photos
3. Verify: 500 error with message "FAL_KEY is not configured"

**Expected Result**: ✅ All error scenarios handled with clear messages

---

### Test 12: Performance
**Objective**: Verify generation completes in reasonable time

**Steps**:
1. Click "Enhance with AI"
2. Time the generation
3. Verify completes in 25-35 seconds (parallel generation)

**Expected Result**: ✅ Generation completes in ~30 seconds

---

## Test Execution Checklist

- [ ] Test 1: Environment Configuration
- [ ] Test 2: Complete Male Verification Flow
- [ ] Test 3: AI Photo Generation — Success Path
- [ ] Test 4: AI Photo Generation — Partial Failure
- [ ] Test 5: Retry Logic
- [ ] Test 6: Different Archetypes
- [ ] Test 7: Progress Tracking UI
- [ ] Test 8: Photo Grid Display
- [ ] Test 9: Enhance Mode
- [ ] Test 10: localStorage Persistence
- [ ] Test 11: Error Scenarios
- [ ] Test 12: Performance

## Success Criteria

✅ All 12 test scenarios pass
✅ No console errors or warnings
✅ UI is responsive and smooth
✅ Progress indicator updates correctly
✅ Photos persist across reloads
✅ Error messages are clear and helpful
✅ Generation completes in ~30 seconds

## Next Steps After Testing

1. **If all tests pass**:
   - Commit Stage 2 changes
   - Move to Stage 4 (Female Profile Flow)

2. **If tests fail**:
   - Document failure details
   - Fix root cause
   - Re-run affected tests

## Notes

- FAL_KEY is configured and ready
- Build succeeds with no errors
- Retry logic is in place for robustness
- Progress tracking UI is complete
- All code is properly typed with TypeScript
