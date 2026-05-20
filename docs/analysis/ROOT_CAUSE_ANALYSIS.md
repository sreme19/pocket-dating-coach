# Root Cause Analysis: Verified Vibe Upload Issues

## Executive Summary

Three critical bugs have been identified in the Verified Vibe verification flow that prevent users from completing the identity verification process. All three bugs stem from **inadequate error handling and unsafe JSON parsing** when interacting with the Claude Vision API.

**Total Bugs:** 3  
**Severity:** 1 URGENT, 2 HIGH  
**Root Cause Pattern:** Missing error handling + Unsafe regex JSON extraction + No timeouts  
**Tickets Created:** PDC-32, PDC-33, PDC-34

---

## Common Root Cause Pattern

All three bugs share the same underlying issues:

### 1. **Unsafe Regex-Based JSON Extraction**
```typescript
// UNSAFE - Greedy regex captures extra text
const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
const parsed = JSON.parse(jsonMatch[0]); // Can throw SyntaxError
```

**Problem:** The regex `/\{[\s\S]*\}/` is greedy and will match from the FIRST `{` to the LAST `}`, potentially capturing:
- Extra text after the JSON object
- Multiple JSON objects (only outer one captured)
- Invalid JSON if Claude returns multiple objects

**Example:**
```
Claude response: "Here's the analysis: {"confidence": 85} and here's more text"
Regex captures: {"confidence": 85} and here's more text"  ← INVALID JSON
```

### 2. **Missing Error Handling on response.json()**
```typescript
// UNSAFE - No try-catch
const result = await response.json();
consistencyResult = result.data;
```

**Problem:** If the API returns invalid JSON or the response is malformed, this crashes without user feedback.

### 3. **No Timeout on Fetch Calls**
```typescript
// UNSAFE - Can hang indefinitely
const response = await fetch('/api/verified-vibe/check-photo-consistency', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ images, mimeTypes })
});
```

**Problem:** If Claude API is slow or unresponsive, the user sees infinite loading.

### 4. **No Validation of Parsed Response**
```typescript
// UNSAFE - Assumes fields exist and are correct type
result = {
  confidence: Math.round(parsed.confidence), // Could be undefined, string, or > 100
  consistent: parsed.confidence >= 80
};
```

**Problem:** No validation that:
- `parsed.confidence` is a number
- `parsed.confidence` is in range 0-100
- `parsed.consistent` is a boolean

---

## Bug #1: Government ID Extraction Fails

### Symptoms
- Error: `"Unexpected token '<', '<!doctype '... is not valid JSON"`
- User cannot upload government ID
- Verification flow blocked at step 1

### Root Cause Chain

1. **Claude API returns HTML instead of JSON**
   - Likely causes:
     - Invalid/missing ANTHROPIC_API_KEY
     - API rate limiting (429 error returned as HTML)
     - API version mismatch
     - Network/firewall blocking

2. **No error handling for HTML response**
   - Code tries to parse HTML as JSON
   - Throws SyntaxError: "Unexpected token '<'"

3. **Generic error message**
   - User sees cryptic error
   - No guidance on how to fix

### Code Flow
```
User uploads ID photo
  ↓
Frontend converts to base64
  ↓
POST /api/verified-vibe/extract-id
  ↓
Backend calls Claude API
  ↓
Claude API returns HTML (error page)
  ↓
Backend tries: JSON.parse(htmlContent)
  ↓
SyntaxError: Unexpected token '<'
  ↓
User sees: "Invalid response format from Claude API"
```

### Affected Code
- `/src/lib/verified-vibe/server/verification.ts` (lines 97-102)
- `/src/routes/verified-vibe/api/extract-id/+server.ts` (lines 70-93)

### Fix Strategy
1. Verify ANTHROPIC_API_KEY is set and valid
2. Add API key format validation
3. Add try-catch around JSON.parse with detailed error logging
4. Add timeout to fetch calls (30 seconds)
5. Add structured error responses
6. Add retry logic with exponential backoff

---

## Bug #2: Selfie Photo Upload Fails

### Symptoms
- Selfie upload appears to work but "Check Liveness" fails
- No error message shown to user
- App may crash or show blank screen
- Verification flow blocked at step 2

### Root Cause Chain

1. **No try-catch on response.json()**
   - If API returns invalid JSON, crashes without catching

2. **Unsafe regex JSON extraction in backend**
   - Claude response parsed with greedy regex
   - Extra text captured as part of JSON
   - JSON.parse fails

3. **No timeout handling**
   - If Claude API hangs, user sees infinite loading

4. **No validation of confidence score**
   - Accepts values > 100 or < 0
   - Accepts non-numeric values

### Code Flow
```
User uploads selfie
  ↓
Frontend creates preview
  ↓
User clicks "Check Liveness"
  ↓
Frontend converts to base64
  ↓
POST /api/verified-vibe/check-liveness
  ↓
Backend calls Claude API with 2 images
  ↓
Claude returns: "confidence: 85, match: true"
  ↓
Backend tries: JSON.parse(response)
  ↓
SyntaxError or TypeError
  ↓
Frontend: const result = await response.json() ← CRASHES HERE
  ↓
User sees: Blank screen or app crash
```

### Affected Code
- `/src/lib/verified-vibe/components/LivenessStep.svelte` (lines 73-77)
- `/src/routes/verified-vibe/api/check-liveness/+server.ts`
- `/src/lib/verified-vibe/server/verification.ts` (lines 214-220)

### Fix Strategy
1. Add try-catch around response.json() in frontend
2. Add timeout handling with AbortController
3. Add validation of confidence score (0-100 range)
4. Add specific error messages for different failure types
5. Add retry logic with exponential backoff

---

## Bug #3: Photo Story Upload Fails

### Symptoms
- User uploads 5+ photos and labels them
- "Check Consistency" button clicked
- Upload fails with generic error or no error
- Verification flow blocked at step 3

### Root Cause Chain

1. **Same unsafe regex JSON extraction**
   - Claude response: `"Analyzing... {"confidence": 92, "consistent": true} ...more text"`
   - Regex captures: `{"confidence": 92, "consistent": true} ...more text"` ← INVALID
   - JSON.parse fails

2. **No try-catch on response.json()**
   - Frontend crashes if API returns invalid JSON

3. **No timeout on fetch**
   - Processing 5+ images takes time
   - If Claude API slow, user sees infinite loading

4. **No validation of response structure**
   - Assumes parsed.confidence is a number
   - Assumes parsed.consistent is a boolean

### Code Flow
```
User uploads 5+ photos
  ↓
Frontend creates previews
  ↓
User labels each photo
  ↓
User clicks "Check Consistency"
  ↓
Frontend converts all to base64
  ↓
POST /api/verified-vibe/check-photo-consistency
  ↓
Backend calls Claude API with 5 images
  ↓
Claude returns: "Based on analysis... {"confidence": 92, "consistent": true} ..."
  ↓
Backend regex: /\{[\s\S]*\}/ captures extra text
  ↓
Backend tries: JSON.parse(invalidJson)
  ↓
SyntaxError
  ↓
Frontend: const result = await response.json() ← CRASHES HERE
  ↓
User sees: Generic error or blank screen
```

### Affected Code
- `/src/lib/verified-vibe/components/PhotoUploadStep.svelte` (lines 115-135)
- `/src/routes/api/verified-vibe/check-photo-consistency/+server.ts` (lines 130-145)

### Fix Strategy
1. Add try-catch around response.json() in frontend
2. Add timeout handling with AbortController (30 seconds)
3. Improve regex-based JSON extraction (use safer parsing)
4. Add validation of parsed response structure
5. Add specific error messages for different failure types
6. Add retry logic with exponential backoff

---

## Impact Analysis

### User Impact
- **Cannot complete verification:** All three steps blocked
- **No feedback:** Generic error messages don't help
- **Cannot retry:** No retry mechanism
- **Frustration:** Users abandon the flow

### Business Impact
- **Conversion loss:** Users cannot verify identity
- **Support burden:** Users contact support with vague errors
- **Data quality:** Incomplete verification data

### System Impact
- **API quota waste:** Failed requests consume Claude API quota
- **No monitoring:** Errors not tracked or logged properly
- **Cascading failures:** One API failure blocks entire flow

---

## Recommended Fix Priority

### P0 - IMMEDIATE (Today)
1. Verify ANTHROPIC_API_KEY is set and valid
2. Add try-catch around all JSON.parse() calls
3. Add try-catch around all response.json() calls
4. Add timeout to all fetch calls (30 seconds)

### P1 - HIGH (This Week)
1. Improve regex-based JSON extraction
2. Add validation of parsed response structure
3. Add specific error messages for different failure types
4. Add retry logic with exponential backoff

### P2 - MEDIUM (Next Week)
1. Add rate limiting detection and handling
2. Add comprehensive logging for debugging
3. Add monitoring and alerting
4. Add tests for error scenarios

---

## Testing Strategy

### Unit Tests
- Test JSON parsing with invalid input
- Test response validation
- Test timeout handling
- Test retry logic

### Integration Tests
- Test with invalid API key
- Test with rate limiting (429 errors)
- Test with slow API responses
- Test with malformed Claude responses

### End-to-End Tests
- Test complete verification flow
- Test error recovery
- Test retry mechanism
- Test user feedback messages

---

## Prevention Measures

### Code Review Checklist
- [ ] All fetch calls have timeout
- [ ] All response.json() calls have try-catch
- [ ] All JSON.parse() calls have try-catch
- [ ] All parsed responses are validated
- [ ] Error messages are user-friendly
- [ ] Retry logic is implemented

### Best Practices
1. Always wrap JSON.parse in try-catch
2. Always wrap response.json() in try-catch
3. Always add timeout to fetch calls
4. Always validate parsed response structure
5. Always provide specific error messages
6. Always implement retry logic

---

## Conclusion

The three bugs are symptoms of a larger architectural issue: **inadequate error handling and unsafe JSON parsing**. Fixing these bugs requires:

1. **Defensive programming:** Assume APIs can fail
2. **Proper error handling:** Try-catch all risky operations
3. **User feedback:** Clear, actionable error messages
4. **Resilience:** Retry logic and timeouts
5. **Monitoring:** Track and log all failures

Once these fixes are implemented, the verification flow will be robust and user-friendly.
