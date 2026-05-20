# Stage 2 Testing Workflow

## Quick Start

1. **Start the dev server** (if not already running)
   ```bash
   npm run dev
   ```

2. **Open the app** in browser
   ```
   http://localhost:5173
   ```

3. **Follow the workflow below** to test each scenario

---

## Workflow: Complete Male Verification → Generate Photos

### Phase 1: Setup & Navigation

**Step 1.1**: Verify dev mode is enabled
- You should see the home page without auth
- If you see a login screen, check `VITE_SKIP_VERIFICATION=true` in `.env.local`

**Step 1.2**: Select archetype
- Click "Get Started" or navigate to `/verified-vibe/home`
- Select "Casual Man" (or "Marriage-Minded Man" for Test 6B)
- Should navigate directly to verification (no auth)

### Phase 2: Complete Verification

**Step 2.1**: ID Verification (Step 1)
- Upload any ID photo (or use a test image)
- Click "Continue"

**Step 2.2**: Photo Story (Step 2)
- Upload 3-5 photos of yourself (or test images)
- Label them as: lead, warmth, lifestyle, conversation, social
- Click "Continue"
- ⚠️ **Important**: These photos are used as reference for AI generation

**Step 2.3**: Spending Proof (Step 3)
- Select a spending level (e.g., "Moderate")
- Click "Continue"

**Step 2.4**: Q&A (Step 4)
- Answer the questions
- Click "Continue"

**Step 2.5**: Profile Intake (Step 5)
- Fill in:
  - Name: "Test User" (or your name)
  - Age: 28
  - City: "New York"
  - About: "I'm a casual guy looking for fun"
  - Personality: Select 3 tags (e.g., Ambitious, Laid-back, Funny)
  - Looking for: Select options
  - Interests: Select 5 tags
- Click "Complete Verification"

**Expected**: Should navigate to `/verified-vibe/profile`

### Phase 3: Profile Page — Before Generation

**Step 3.1**: Verify profile page loads
- Should see hero photo (lead photo from step 2.2)
- Should see name, age, city, archetype badge, trust score
- Should see about section
- Should see photo grid with uploaded photos
- Should see "Enhance with AI" button

**Step 3.2**: Verify photo grid
- Should show 5 slots (lead, warmth, lifestyle, conversation, social)
- Uploaded photos should appear in their labeled slots
- Empty slots should show "+" placeholder with "Add photo" text
- No ✨ badges yet (photos not AI-generated)

### Phase 4: AI Photo Generation

**Step 4.1**: Click "Enhance with AI"
- Button should become disabled
- Spinner should appear on button
- Progress indicator should appear: "Generating photos: 0/5"
- Progress bar should appear (empty)
- Photo grid should show loading skeletons for each slot

**Step 4.2**: Monitor generation progress
- Watch progress indicator update: 0/5 → 1/5 → 2/5 → ... → 5/5
- Watch progress bar fill proportionally
- Watch loading skeletons disappear as photos appear
- Each photo should have ✨ badge when it appears

**Step 4.3**: Wait for completion
- Generation should take 25-35 seconds
- All 5 photos should appear
- Button should return to normal state
- Progress indicator should disappear
- "Regenerate photos" button should appear

**Expected**: All 5 AI photos visible with ✨ badges

### Phase 5: Verify Results

**Step 5.1**: Check photo quality
- Photos should look like the same person
- Photos should match the scene descriptions
- For Casual Man: casual, relaxed scenes
- For Marriage-Minded Man: refined, intentional scenes

**Step 5.2**: Check UI state
- "Enhance with AI" button should be hidden
- "Regenerate photos" button should be visible
- Photo grid should show all 5 AI photos
- All photos should have ✨ badge

**Step 5.3**: Check persistence
- Reload page (Cmd+R)
- AI photos should still be visible
- ✨ badges should still be visible
- "Regenerate photos" button should still be visible

**Step 5.4**: Check localStorage
- Open DevTools (F12)
- Go to Application → Local Storage
- Find `vv_ai_photos` key
- Should contain array of 5 photo objects with `url`, `scene`, `role`

### Phase 6: Test Regeneration

**Step 6.1**: Click "Regenerate photos"
- Same process as Phase 4
- New photos should be generated
- Old photos should be replaced
- Progress indicator should appear again

**Step 6.2**: Verify new photos
- Photos should be different from previous generation
- All should have ✨ badge
- Should still be same person (face consistency)

### Phase 7: Test Enhance Mode

**Step 7.1**: Click "Enhance" button (top right)
- Should enter edit mode
- "Enhance with AI" button should disappear
- Photo grid should still be visible
- Can edit about, personality, intent, lifestyle

**Step 7.2**: Make edits
- Change about text
- Change personality tags
- Change intent
- Change lifestyle tags

**Step 7.3**: Save changes
- Click checkmark button
- Should return to public mode
- Changes should be saved
- AI photos should still be visible

**Step 7.4**: Verify photo generation still works
- Click "Enhance with AI" again
- Should generate new photos normally
- Edit mode doesn't interfere with generation

### Phase 8: Test Different Archetype

**Step 8.1**: Start new verification
- Go to `/verified-vibe/home`
- Select "Marriage-Minded Man"
- Complete verification flow (same as Phase 2)

**Step 8.2**: Generate photos
- Click "Enhance with AI"
- Wait for generation
- Verify photos show different scenes:
  - Home setting, active outdoors, upscale dining, travel
  - More refined, intentional scenes

**Step 8.3**: Compare with Casual Man
- Photos should be noticeably different in tone
- Same person, different scene context

---

## Error Testing Workflow

### Error Test 1: Network Failure

**Setup**:
1. Open DevTools (F12)
2. Go to Network tab
3. Set throttling to "Slow 3G"

**Test**:
1. Click "Enhance with AI"
2. Generation should be slower
3. May timeout or fail
4. Should show error message
5. Can retry by clicking "Regenerate photos"

### Error Test 2: Partial Failure

**Setup**:
1. Generate photos normally
2. Immediately click "Regenerate photos" again
3. May hit fal.ai rate limit

**Test**:
1. Some photos may succeed, some may fail
2. Should show error: "X photos generated, Y failed"
3. Successful photos should display with ✨ badge
4. Failed slots should show placeholder
5. Can retry by clicking "Regenerate photos"

### Error Test 3: Missing Reference Photo

**Setup**:
1. Go to profile page
2. Don't upload any photos in verification

**Test**:
1. Should not see "Enhance with AI" button
2. Should see message: "Upload photos in verification to unlock AI enhancement"

---

## Checklist: All Tests Passed

- [ ] Phase 1: Setup & Navigation ✅
- [ ] Phase 2: Complete Verification ✅
- [ ] Phase 3: Profile Page — Before Generation ✅
- [ ] Phase 4: AI Photo Generation ✅
- [ ] Phase 5: Verify Results ✅
- [ ] Phase 6: Test Regeneration ✅
- [ ] Phase 7: Test Enhance Mode ✅
- [ ] Phase 8: Test Different Archetype ✅
- [ ] Error Test 1: Network Failure ✅
- [ ] Error Test 2: Partial Failure ✅
- [ ] Error Test 3: Missing Reference Photo ✅

---

## Troubleshooting

### Issue: "Enhance with AI" button doesn't appear
**Solution**: 
- Verify you uploaded photos in Step 2.2
- Check localStorage: `vv_photos` should contain photo data
- Reload page

### Issue: Generation fails immediately
**Solution**:
- Check `.env.local` has FAL_KEY
- Check browser console for error message
- Verify network connection
- Try again (may be rate limited)

### Issue: Photos don't appear after generation
**Solution**:
- Check browser console for errors
- Check Network tab for failed requests
- Verify fal.ai API is responding
- Try regenerating

### Issue: Progress indicator doesn't update
**Solution**:
- Check browser console for errors
- Verify generation is actually running (check Network tab)
- May be slow network (check throttling)

### Issue: Photos disappear after reload
**Solution**:
- Check localStorage: `vv_ai_photos` should exist
- Check browser console for errors
- Try generating again

---

## Performance Expectations

- **Generation time**: 25-35 seconds (parallel)
- **UI responsiveness**: Should remain responsive during generation
- **Memory usage**: Should not spike significantly
- **Network**: Should see 5 parallel requests to fal.ai

---

## Success Criteria

✅ All 8 phases complete successfully
✅ All 3 error tests handled gracefully
✅ No console errors
✅ UI is responsive
✅ Photos persist across reloads
✅ Generation completes in ~30 seconds
✅ Different archetypes show different scenes

---

## Next Steps After Testing

1. **If all tests pass**:
   - Document any observations
   - Commit Stage 2 changes
   - Move to Stage 4

2. **If tests fail**:
   - Document failure details
   - Note exact error messages
   - Check browser console
   - Try troubleshooting steps above
   - Report issues for fixing

---

## Quick Reference

**Key URLs**:
- Home: `http://localhost:5173/verified-vibe/home`
- Verification: `http://localhost:5173/verified-vibe/verification`
- Profile: `http://localhost:5173/verified-vibe/profile`

**Key localStorage Keys**:
- `vv_user` — User info (name, age, city, archetype, trust score)
- `vv_profile_draft` — Profile intake form data
- `vv_profile` — Generated profile (about, personality, intent, lifestyle)
- `vv_photos` — Uploaded photos
- `vv_ai_photos` — Generated AI photos

**Key API Endpoint**:
- `POST /api/photo-enhance/generate` — Trigger photo generation

**DevTools Tips**:
- Console: Check for errors
- Network: Monitor fal.ai requests
- Application → Local Storage: Check data persistence
- Performance: Monitor generation time
