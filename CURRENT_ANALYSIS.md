# Current Codebase Analysis — Pocket Dating Coach

## What Exists Today

### ✓ Verification Flow (4 steps)
- Step 1: Government ID extraction (Claude Vision)
- Step 2: Liveness check (selfie vs ID comparison)
- Step 3: Photo story (upload 5+ photos with labels)
- Step 4: Spending/Q&A (men upload bank statement, women answer Q&A)

**Status:** Fully built, working, testable with dev mode

### ✓ Auth System
- Email OTP via Supabase
- Dev mode bypass with test accounts (`male@test.vv`, `female@test.vv`)
- Pre-auth data collection (gender, archetype stored in localStorage before sign-up)

**Status:** Working, can be skipped in dev mode

### ✓ Trust Score System
- Calculated based on completed verification steps
- Points allocated per step (ID: 10, Liveness: 10, Photos: 15, Spending/Q&A: 10)
- Total: 45 points possible

**Status:** Implemented but not fully integrated into profile

### ✓ Discovery Feed (Placeholder)
- Mock profiles shown in card stack
- Like/reject/chat actions
- Chat interface exists

**Status:** Works with mock data, needs real profiles

### ✓ State Management
- Svelte stores with localStorage persistence
- User store, verification store, matches store, etc.
- Hydration on app mount

**Status:** Solid foundation, follows good patterns

---

## What's Missing for Stage 1

### ✗ Profile Intake Form (Step 5)
- No component exists
- Need to collect: name, age, city, about, personality tags, looking for, interests

### ✗ Profile Synthesis API
- No endpoint exists
- Need to call Claude to generate polished profile from intake data

### ✗ Profile Page
- No route exists at `/verified-vibe/profile`
- Need public view + enhance (edit) mode

### ✗ Dev Mode Bypass for Auth
- Currently requires email OTP even in dev mode
- Need to skip directly to verification after archetype selection

---

## Key Architectural Patterns to Follow

### 1. Component Structure
```
src/lib/verified-vibe/components/
  ├── IDExtractionStep.svelte
  ├── LivenessStep.svelte
  ├── PhotoUploadStep.svelte
  ├── SpendingUploadStep.svelte
  ├── SpendingQAStep.svelte
  └── ProfileIntakeStep.svelte (NEW)
```

Each step component:
- Accepts `onSubmit` callback
- Manages its own state
- Calls API endpoint
- Handles loading/error states

### 2. API Endpoint Pattern
```
src/routes/api/verified-vibe/[endpoint]/+server.ts
```

Each endpoint:
- Validates request body
- Calls Claude or other service
- Returns JSON response
- Handles errors gracefully

### 3. localStorage Keys
```
vv_user              // Current user object
vv_profile_draft     // Form data before synthesis
vv_profile           // Generated profile after synthesis
vv_photos            // Uploaded photos with labels
vv_phase             // Current app phase
vv_tab               // Current tab
```

### 4. Svelte Store Pattern
```typescript
function createStore() {
  const { subscribe, set, update } = writable(initialValue);
  
  return {
    subscribe,
    set: (value) => {
      set(value);
      if (typeof window !== 'undefined') {
        localStorage.setItem('key', JSON.stringify(value));
      }
    },
    hydrate: () => {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('key');
        if (stored) set(JSON.parse(stored));
      }
    }
  };
}
```

---

## Data Flow for Stage 1

```
Gate (select gender)
  ↓
Home (select archetype)
  ↓ [1A: Create dev user, skip auth]
Verification (4 steps)
  ↓
Step 5: Profile Intake Form [1B]
  ↓ [Save to vv_profile_draft]
  ↓ [1C: Call API to generate profile]
  ↓ [Save to vv_profile]
Profile Page [1D]
  ↓
Public view (read-only)
  ↓
Enhance mode (editable)
```

---

## Environment Setup

### Required for dev:
```
VITE_SKIP_VERIFICATION=true
ANTHROPIC_API_KEY=sk-ant-...
PUBLIC_SUPABASE_URL=...
PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
```

### Optional for Stage 2:
```
FAL_KEY=... (for AI photo generation)
```

---

## Testing Strategy

### Manual Testing (for Stage 1)
- No automated tests yet
- Follow test cases in STAGE_1_TESTS.md
- Verify localStorage, UI rendering, data persistence
- Test error scenarios

### Browser DevTools Checks
- localStorage keys and values
- Network tab for API calls
- Console for errors
- Application tab for store state

---

## Code Quality Notes

### Strengths
- Good separation of concerns (components, stores, services)
- Consistent naming conventions
- TypeScript throughout
- Proper error handling patterns
- localStorage persistence built in

### Areas to Improve
- No automated tests (will add later)
- Some components are large (could be split)
- API error handling could be more robust
- No loading skeletons (could add for UX)

---

## Next Immediate Steps

1. **Phase 1A** (15-20 min)
   - Modify home page to create dev user and skip auth
   - Test: reach verification without auth

2. **Phase 1B** (30-45 min)
   - Create ProfileIntakeStep component
   - Add to verification flow
   - Test: form renders and saves to localStorage

3. **Phase 1C** (20-30 min)
   - Create generate-profile API endpoint
   - Call Claude with profile synthesis prompt
   - Test: API returns valid profile JSON

4. **Phase 1D** (45-60 min)
   - Create profile page route
   - Build public view layout
   - Build enhance mode with editing
   - Test: all sections render, edits persist

**Total estimated time:** 2-2.5 hours for all 4 phases

---

## Success Criteria for Stage 1

- [ ] User can reach verification without auth (1A)
- [ ] Step 5 form collects all required data (1B)
- [ ] API generates polished profile from intake (1C)
- [ ] Profile page displays generated profile (1D)
- [ ] Enhance mode allows editing and persists changes (1D)
- [ ] All test cases in STAGE_1_TESTS.md pass
- [ ] No console errors
- [ ] localStorage has correct data structure
- [ ] Can commit clean, focused PRs for each phase

---

## Ready to Start?

All planning is done. Waiting for your signal to begin Phase 1A.

**Recommendation:** Build one phase at a time, test it, commit it, then move to next.

This keeps things manageable and gives you confidence at each step.
