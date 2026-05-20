# Testing Fix #1: Government ID Extraction

## Quick Test Checklist

### ✅ Test 1: Happy Path (Valid ID)
**Steps:**
1. Go to Verified Vibe flow
2. Upload a clear government ID photo
3. Click "Extract Data"
4. Verify extracted information appears
5. Click "Confirm & Continue"

**Expected Result:** 
- ✅ Data extracted successfully
- ✅ Shows Name, DOB, ID Number
- ✅ Moves to next step

---

### ✅ Test 2: Invalid API Key
**Steps:**
1. Set `ANTHROPIC_API_KEY` to invalid value (e.g., `sk-ant-invalid`)
2. Go to Verified Vibe flow
3. Upload an ID photo
4. Click "Extract Data"

**Expected Result:**
- ✅ Shows error: "Service temporarily unavailable. Please try again later."
- ✅ No crash or blank screen
- ✅ User can retry

---

### ✅ Test 3: Unclear Photo
**Steps:**
1. Upload a blurry or low-quality ID photo
2. Click "Extract Data"

**Expected Result:**
- ✅ Shows error: "ID photo is unclear. Please upload a clearer photo."
- ✅ User can upload different photo

---

### ✅ Test 4: Non-ID Image
**Steps:**
1. Upload a random photo (not an ID)
2. Click "Extract Data"

**Expected Result:**
- ✅ Shows error: "Could not find a valid ID in the photo. Please try again."
- ✅ User can upload different photo

---

### ✅ Test 5: Timeout (Slow Network)
**Steps:**
1. Open DevTools (F12)
2. Go to Network tab
3. Set throttling to "Slow 3G"
4. Upload an ID photo
5. Click "Extract Data"
6. Wait 30+ seconds

**Expected Result:**
- ✅ After 30 seconds: "Request took too long. Please try again."
- ✅ No infinite loading
- ✅ User can retry

---

### ✅ Test 6: File Size Validation
**Steps:**
1. Try to upload a file > 5MB

**Expected Result:**
- ✅ Shows error: "File size must be less than 5MB"
- ✅ File not uploaded

---

### ✅ Test 7: File Type Validation
**Steps:**
1. Try to upload a non-image file (e.g., .txt, .pdf)

**Expected Result:**
- ✅ Shows error: "Please select an image file"
- ✅ File not uploaded

---

## Browser Console Checks

While testing, check the browser console (F12 > Console) for:

✅ **No red errors** - All errors should be caught and shown to user  
✅ **Proper logging** - Should see logs like:
- `"Claude API error (401): Invalid API key"`
- `"Failed to parse Claude response as JSON"`
- `"Claude API request timeout"`

---

## What to Look For

### ✅ Good Signs
- Clear error messages
- No app crashes
- Ability to retry
- Proper loading states
- Timeout after 30 seconds

### ❌ Bad Signs
- Blank screen
- Console errors
- Infinite loading
- Generic "Failed" message
- No timeout

---

## Rollback Plan

If issues found:
1. Revert changes to the three files
2. Identify specific issue
3. Fix and re-test

---

**Status:** Ready for testing  
**Estimated Test Time:** 10-15 minutes  
**Next Step:** Confirm all tests pass, then proceed to Fix #2
