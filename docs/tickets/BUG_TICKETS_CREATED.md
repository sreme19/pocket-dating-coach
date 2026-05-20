# Bug Tickets Created in Plane

## Summary
Three critical bug tickets have been created in Plane for the pocket-dating-coach project.

**Created:** May 19, 2026
**Workspace:** woam
**Project:** pocket-dating-coach

---

## Ticket #1: Government ID Extraction JSON Parsing Error

**Ticket ID:** PDC-32  
**Priority:** 🔴 URGENT  
**Status:** Backlog  

### Issue
Government ID extraction fails with error: `"Unexpected token '<', '<!doctype '... is not valid JSON"`

### Root Cause
Claude API is returning HTML error page instead of JSON, indicating:
- Invalid/Missing API Key (ANTHROPIC_API_KEY)
- API Rate Limiting (429 errors returned as HTML)
- API Version Mismatch
- Network/Firewall Issues

### Affected Files
- `/src/lib/verified-vibe/server/verification.ts` (lines 97-102)
- `/src/routes/verified-vibe/api/extract-id/+server.ts`

### Key Issues
1. No validation of API key format before use
2. No timeout on fetch calls - can hang indefinitely
3. Logs raw HTML content (could be huge)
4. Generic error message doesn't help user
5. No retry logic for rate limiting

### Impact
- Users cannot upload government ID
- Entire verification flow is blocked
- No clear error message to user

### Fix Priority
1. Verify ANTHROPIC_API_KEY is set and valid in .env.local
2. Add API key validation in verification.ts
3. Add try-catch around all JSON.parse() calls
4. Add timeout to fetch calls (30 seconds)
5. Add structured error responses from Claude API
6. Add retry logic with exponential backoff

---

## Ticket #2: Selfie Photo Upload Silent Failure

**Ticket ID:** PDC-33  
**Priority:** 🟠 HIGH  
**Status:** Backlog  

### Issue
Selfie photo upload fails silently with no error feedback to user

### Root Cause
Missing error handling in multiple layers:
- **Frontend:** No try-catch on response.json()
- **API Endpoint:** Generic error messages
- **Backend Function:** Incomplete JSON parsing validation

### Affected Files
- `/src/lib/verified-vibe/components/LivenessStep.svelte` (lines 73-77, 155-177)
- `/src/routes/verified-vibe/api/check-liveness/+server.ts`
- `/src/lib/verified-vibe/server/verification.ts` (lines 214-220)

### Key Issues
1. No try-catch on response.json() - crashes if API returns invalid JSON
2. No timeout handling - infinite loading if API hangs
3. No network error detection
4. No validation of confidence score range (allows > 100 or < 0)
5. Generic error messages don't help user
6. No retry logic for transient failures

### Impact
- Users see blank screen or app crash when uploading selfie
- No feedback on what went wrong
- Cannot retry or get help
- Verification flow is completely blocked

### Fix Priority
1. Add try-catch around response.json() in LivenessStep.svelte
2. Add timeout handling with AbortController
3. Add specific error messages for different failure types
4. Add validation of confidence score (0-100 range)
5. Add retry logic with exponential backoff
6. Add user-friendly error messages

---

## Ticket #3: Photo Story Upload Fails

**Ticket ID:** PDC-34  
**Priority:** 🟠 HIGH  
**Status:** Backlog  

### Issue
Photo Story upload fails - unable to upload 5+ photos

### Root Cause
Multiple issues prevent successful photo upload:
- **Missing Error Handling** - No try-catch on response.json()
- **Unsafe Regex JSON Extraction** - Greedy regex captures extra text
- **No Timeout Handling** - API calls can hang indefinitely
- **No Response Validation** - Assumes parsed JSON has required fields
- **Generic Error Messages** - User doesn't know what went wrong

### Affected Files
- `/src/lib/verified-vibe/components/PhotoUploadStep.svelte` (lines 115-135)
- `/src/routes/api/verified-vibe/check-photo-consistency/+server.ts` (lines 130-145)

### Key Issues
1. No try-catch on response.json() - crashes if API returns invalid JSON
2. Unsafe regex `/\{[\s\S]*\}/` is too greedy - captures extra text from Claude response
3. No timeout on fetch - can hang indefinitely if Claude API is slow
4. No validation that parsed.confidence is a number
5. No validation that parsed.consistent is a boolean
6. Generic error message doesn't help user
7. No retry logic for transient failures
8. No handling for rate limiting (429 errors)

### Impact
- Users cannot upload photos for their profile
- Photo Story step is completely blocked
- No feedback on what went wrong
- Verification flow cannot proceed

### Fix Priority
1. Add try-catch around response.json() in PhotoUploadStep.svelte
2. Add timeout handling with AbortController (30 seconds)
3. Improve regex-based JSON extraction or use safer parsing
4. Add validation of parsed response structure
5. Add specific error messages for different failure types
6. Add retry logic with exponential backoff
7. Add rate limiting detection and handling

---

## How to Access Tickets

1. Go to: https://app.plane.so/woam
2. View tickets PDC-32, PDC-33, and PDC-34
3. All are in the Backlog state
4. Full descriptions with code references are included

## Next Steps

1. **Immediate:** Verify ANTHROPIC_API_KEY is set correctly
2. **High Priority:** Implement error handling fixes for all three tickets
3. **Testing:** Test with invalid API key and network failures
4. **Monitoring:** Add logging to track API failures in production

---

## Script Used

Created using: `/scripts/create-plane-tickets.py`

This script can be reused to create additional tickets by modifying the bug descriptions and calling the create_ticket() function.

