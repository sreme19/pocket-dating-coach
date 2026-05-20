# Stage 1 Manual Test Cases

## Phase 1A: Dev Mode Bypass

### Test 1A.1: Dev user creation on archetype selection
**Steps:**
1. Open app at `http://localhost:5174/verified-vibe/gate`
2. Select "Man"
3. Confirm 18+
4. Click "Continue"
5. Select any archetype (e.g., "Casual")
6. Click "Lock In"

**Expected:**
- Navigate to `/verified-vibe/verification` (NOT `/verified-vibe/auth`)
- Open DevTools → Application → localStorage
- Find `vv_user` key with JSON containing:
  - `id`: UUID string
  - `gender`: "man"
  - `archetype`: "casual_man" (or selected archetype)
  - `firstName`: "Dev User" or similar
  - `trustScore`: 0 or mock value

**Pass/Fail:** ✓ / ✗

---

## Phase 1B: Profile Intake Step

### Test 1B.1: Step 5 appears in verification
**Steps:**
1. Complete phases 1A (reach verification)
2. Skip steps 1-4 (use "Skip this step" button)
3. Reach step 5

**Expected:**
- Page shows "Step 5 of 5"
- Form renders with all fields:
  - First name (text input)
  - Age (number input)
  - City (text input)
  - About you (textarea)
  - Personality tags (chip selector)
  - Looking for (radio/button group)
  - Interests (chip selector)

**Pass/Fail:** ✓ / ✗

### Test 1B.2: Form data saves to localStorage
**Steps:**
1. Fill form with sample data:
   - First name: "Marcus"
   - Age: 31
   - City: "Brooklyn, NY"
   - About: "Product designer by day, amateur chef by night"
   - Personality: Select 3 (e.g., Ambitious, Creative, Grounded)
   - Looking for: Select one option
   - Interests: Select 3-5 (e.g., Travel, Food, Photography)
2. Click "Submit" or "Continue"
3. Open DevTools → Application → localStorage
4. Find `vv_profile_draft` key

**Expected:**
- `vv_profile_draft` exists with JSON containing all form fields
- All values match what was entered
- No errors in console

**Pass/Fail:** ✓ / ✗

### Test 1B.3: Form data persists on reload
**Steps:**
1. Complete test 1B.2
2. Reload page (Cmd+R)
3. Navigate back to step 5 (if needed)
4. Check localStorage again

**Expected:**
- `vv_profile_draft` still exists with same data
- Form fields are pre-populated with saved values (if component supports it)

**Pass/Fail:** ✓ / ✗

---

## Phase 1C: Profile Synthesis API

### Test 1C.1: API generates profile from intake data
**Steps:**
1. Complete phase 1B (have `vv_profile_draft` in localStorage)
2. Submit step 5 form
3. Open DevTools → Network tab
4. Look for POST request to `/api/verified-vibe/generate-profile`
5. Check response

**Expected:**
- Request is sent with correct payload:
  ```json
  {
    "firstName": "Marcus",
    "age": 31,
    "city": "Brooklyn, NY",
    "about": "...",
    "personalityTags": [...],
    "lookingFor": "...",
    "interests": [...],
    "archetype": "casual_man",
    "trustScore": 0
  }
  ```
- Response status: 200
- Response body contains:
  ```json
  {
    "about": "...",
    "personalityDescriptors": [...],
    "intentStatement": "...",
    "lifestyleTags": [...]
  }
  ```

**Pass/Fail:** ✓ / ✗

### Test 1C.2: Generated profile saves to localStorage
**Steps:**
1. Complete test 1C.1
2. Open DevTools → Application → localStorage
3. Find `vv_profile` key

**Expected:**
- `vv_profile` exists with JSON containing:
  - `about`: Polished version (better than user input)
  - `personalityDescriptors`: 3-5 tags (may differ from user selection)
  - `intentStatement`: 1 sentence about what they're looking for
  - `lifestyleTags`: 3-5 lifestyle tags
- No errors in console

**Pass/Fail:** ✓ / ✗

### Test 1C.3: Generated about is better than user input
**Steps:**
1. Complete test 1C.2
2. Compare `vv_profile_draft.about` vs `vv_profile.about`

**Expected:**
- Generated about is more specific, memorable, or better written
- Example: User input "I like cooking" → Generated "Amateur chef by night, serious about my craft"

**Pass/Fail:** ✓ / ✗

---

## Phase 1D: Profile Page

### Test 1D.1: Profile page renders after generation
**Steps:**
1. Complete phase 1C (have `vv_profile` in localStorage)
2. After API response, check if page navigates to `/verified-vibe/profile`

**Expected:**
- URL is `/verified-vibe/profile`
- Page loads without errors
- All sections render:
  - Hero photo area
  - Name, age, city
  - Archetype badge
  - Trust score chip
  - About blurb
  - Personality tags
  - Photo grid
  - Lifestyle tags
  - Intent statement

**Pass/Fail:** ✓ / ✗

### Test 1D.2: Public view displays correct data
**Steps:**
1. On profile page in public view
2. Verify each section

**Expected:**
- **Hero photo**: Shows lead photo from `vv_photos` or placeholder
- **Name/Age/City**: Shows "Marcus, 31" and "Brooklyn, NY"
- **Archetype badge**: Shows "CASUAL" or appropriate badge
- **Trust score**: Shows numeric score (e.g., "0 points" or "81 points")
- **About**: Shows AI-generated about from `vv_profile.about`
- **Personality tags**: Shows tags from `vv_profile.personalityDescriptors`
- **Photo grid**: Shows 5 slots with uploaded photos or placeholders
- **Lifestyle tags**: Shows tags from `vv_profile.lifestyleTags`
- **Intent**: Shows `vv_profile.intentStatement`

**Pass/Fail:** ✓ / ✗

### Test 1D.3: Enhance mode toggle works
**Steps:**
1. On profile page in public view
2. Click "Enhance" button (or similar)
3. Verify fields become editable

**Expected:**
- Button changes to "Done" or "Save"
- About field becomes textarea (editable)
- Personality tags become chip selector (editable)
- Lifestyle tags become chip selector (editable)
- Save/Cancel buttons appear

**Pass/Fail:** ✓ / ✗

### Test 1D.4: Edit and save in enhance mode
**Steps:**
1. Enter enhance mode (test 1D.3)
2. Edit about field: change text
3. Edit personality tags: remove one, add another
4. Click "Save"

**Expected:**
- Fields are updated in localStorage (`vv_profile`)
- Page returns to public view
- Changes are visible in public view
- No errors in console

**Pass/Fail:** ✓ / ✗

### Test 1D.5: Changes persist on reload
**Steps:**
1. Complete test 1D.4
2. Reload page (Cmd+R)
3. Verify changes are still there

**Expected:**
- Profile page loads with edited values
- About shows edited text
- Personality tags show edited selection
- Lifestyle tags show edited selection

**Pass/Fail:** ✓ / ✗

### Test 1D.6: Cancel in enhance mode discards changes
**Steps:**
1. Enter enhance mode
2. Edit about field: change text
3. Click "Cancel"

**Expected:**
- Changes are discarded
- Page returns to public view
- About shows original (pre-edit) text

**Pass/Fail:** ✓ / ✗

---

## Full End-to-End Flow

### Test E2E.1: Complete flow from gate to profile
**Steps:**
1. Start at `/verified-vibe/gate`
2. Select "Man" → Confirm 18+ → Continue
3. Select archetype → Lock In
4. Skip steps 1-4 of verification
5. Fill step 5 form with sample data
6. Submit
7. Wait for API response
8. Verify profile page loads

**Expected:**
- All steps complete without errors
- Profile page shows generated profile
- All data is correct
- localStorage has `vv_user`, `vv_profile_draft`, `vv_profile`

**Pass/Fail:** ✓ / ✗

---

## Failure Scenarios

### Test F.1: Missing required fields in step 5
**Steps:**
1. On step 5 form
2. Leave required fields empty (e.g., first name, about)
3. Try to submit

**Expected:**
- Form shows validation error
- Submit is blocked
- No API call is made

**Pass/Fail:** ✓ / ✗

### Test F.2: API error handling
**Steps:**
1. On step 5 form
2. Fill form correctly
3. Simulate API error (e.g., network offline, API down)
4. Submit

**Expected:**
- Error message displays to user
- localStorage is NOT updated with invalid data
- User can retry

**Pass/Fail:** ✓ / ✗

---

## Summary

Total tests: 16
- Phase 1A: 1 test
- Phase 1B: 3 tests
- Phase 1C: 3 tests
- Phase 1D: 6 tests
- E2E: 1 test
- Failure scenarios: 2 tests

**All tests must pass before moving to Stage 2.**
