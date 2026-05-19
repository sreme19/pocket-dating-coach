# Stage 1 Implementation Plan — Test-Driven

## Overview
Build the male profile onboarding → profile pipeline. No AI images yet. Everything in localStorage.

**End Goal:** User completes verification → lands on `/verified-vibe/profile` with a generated profile they can view and edit.

---

## Phase Breakdown

### Phase 1A: Dev Mode Bypass
**Goal:** Remove auth wall for dev testing. After archetype selection, go directly to verification.

**What to build:**
1. Create a dev user object in localStorage when archetype is selected
2. Skip the `/verified-vibe/auth` page entirely in dev mode
3. Populate `vv_user` store with a mock user (ID, gender, archetype)

**Files to modify:**
- `src/routes/verified-vibe/home/+page.svelte` - After archetype selection, create dev user and navigate to verification

**Test checklist:**
- [ ] Select "Man" on gate
- [ ] Select archetype on home
- [ ] Verify you land on `/verified-vibe/verification` (not auth)
- [ ] Check localStorage for `vv_user` with ID, gender, archetype

**Commit message:** `feat: dev mode bypass for verification flow`

---

### Phase 1B: Profile Intake Step (Step 5)
**Goal:** Add a 5th step to verification that collects profile data.

**What to build:**
1. Create `ProfileIntakeStep.svelte` component with form fields:
   - First name (text input)
   - Age (number input)
   - City (text input)
   - About you (textarea, 2-3 sentences)
   - Personality tags (chip selector, pick 3 from ~15)
   - Looking for (radio/button group, 2-3 options)
   - Interests (chip selector, pick up to 5)

2. Add step 5 to verification flow in `+page.svelte`
3. Save form data to localStorage as `vv_profile_draft`

**Files to create:**
- `src/lib/verified-vibe/components/ProfileIntakeStep.svelte`

**Files to modify:**
- `src/routes/verified-vibe/verification/+page.svelte` - Add step 5 to steps array, render component

**Test checklist:**
- [ ] Verification shows "Step 5 of 5"
- [ ] Form renders with all fields
- [ ] Fill in sample data and submit
- [ ] Check localStorage for `vv_profile_draft` with all fields
- [ ] Data persists on page reload

**Commit message:** `feat: add profile intake step 5 to verification`

---

### Phase 1C: Profile Synthesis API
**Goal:** Call Claude to generate a polished profile from intake data.

**What to build:**
1. Create API endpoint `POST /api/verified-vibe/generate-profile`
   - Receives: intake form data, photo labels, archetype, trust score
   - Calls Claude with a prompt to generate:
     - Polished about blurb (2-3 sentences, better than user input)
     - Refined personality descriptors (3-5 tags, may differ from user picks)
     - Intent statement (1 sentence, what they're looking for)
     - Lifestyle tags (3-5 tags, inferred from interests + archetype)
   - Returns: structured JSON with all generated fields

2. Call this endpoint after step 5 submission
3. Save response to localStorage as `vv_profile`

**Files to create:**
- `src/routes/api/verified-vibe/generate-profile/+server.ts`

**Files to modify:**
- `src/lib/verified-vibe/components/ProfileIntakeStep.svelte` - Add submit handler that calls API

**Test checklist:**
- [ ] Fill step 5 form and submit
- [ ] API is called with correct payload
- [ ] Claude returns valid JSON with all fields
- [ ] Response is saved to localStorage as `vv_profile`
- [ ] Check that generated about is better than user input
- [ ] Check that personality tags are refined

**Commit message:** `feat: add profile synthesis API with Claude`

---

### Phase 1D: Profile Page
**Goal:** Build `/verified-vibe/profile` with public view and enhance mode.

**What to build:**
1. Create route `src/routes/verified-vibe/profile/+page.svelte`
2. Two modes toggled by button:
   - **Public view** (default):
     - Hero photo (lead photo from photo story)
     - Name, age, city + archetype badge + trust score chip
     - AI-generated about blurb
     - Personality trait tags
     - Photo grid (5 slots, show uploaded photos or placeholders)
     - Lifestyle tags
     - Intent/looking for section
   - **Enhance mode** (edit):
     - Inline editable fields for about, personality tags, lifestyle tags
     - Save/cancel buttons
     - Save back to localStorage

3. After profile is generated, navigate to this page instead of `/discover`

**Files to create:**
- `src/routes/verified-vibe/profile/+page.svelte`

**Files to modify:**
- `src/lib/verified-vibe/components/ProfileIntakeStep.svelte` - After API success, navigate to profile page

**Test checklist:**
- [ ] Profile page renders with all sections
- [ ] Hero photo displays correctly
- [ ] Name, age, city show correctly
- [ ] Archetype badge displays
- [ ] Trust score chip displays
- [ ] About blurb shows (AI-generated version)
- [ ] Personality tags display
- [ ] Photo grid shows uploaded photos + placeholders
- [ ] Lifestyle tags display
- [ ] Intent statement displays
- [ ] Click "Enhance" button → fields become editable
- [ ] Edit a field and save → localStorage updates
- [ ] Reload page → changes persist
- [ ] Click "Enhance" again → fields show saved values

**Commit message:** `feat: add profile page with public and enhance modes`

---

## Implementation Order

Build in this order, test each before moving to next:

1. **1A** → Test dev bypass works
2. **1B** → Test intake form saves to localStorage
3. **1C** → Test API generates profile
4. **1D** → Test profile page renders and edits work

---

## Data Structures

### `vv_user` (localStorage)
```typescript
{
  id: string (UUID)
  gender: 'man' | 'woman'
  archetype: 'casual_man' | 'marriage_minded_man' | 'spoilt_woman' | 'safety_first_woman'
  firstName: string
  age: number
  city: string
  trustScore: number
  createdAt: string
}
```

### `vv_profile_draft` (localStorage)
```typescript
{
  firstName: string
  age: number
  city: string
  about: string
  personalityTags: string[] (user-selected, 3 items)
  lookingFor: string
  interests: string[] (user-selected, up to 5 items)
}
```

### `vv_profile` (localStorage)
```typescript
{
  about: string (AI-generated, polished)
  personalityDescriptors: string[] (AI-refined, 3-5 items)
  intentStatement: string (AI-generated, 1 sentence)
  lifestyleTags: string[] (AI-inferred, 3-5 items)
}
```

### `vv_photos` (localStorage)
```typescript
[
  {
    dataUrl: string (base64)
    label: string ('lead', 'warmth', 'lifestyle', 'conversation', 'social')
  }
]
```

---

## Claude Prompt for Profile Synthesis

```
You are a dating profile writer. Given a user's intake form responses, generate a polished profile.

User data:
- Gender: {gender}
- Archetype: {archetype}
- Name: {firstName}
- Age: {age}
- City: {city}
- About (raw): {about}
- Personality tags (user-selected): {personalityTags}
- Looking for: {lookingFor}
- Interests: {interests}
- Trust score: {trustScore}

Generate a JSON object with:
1. "about": A polished 2-3 sentence about blurb. Rewrite the user's input to be more specific, memorable, and authentic. Show personality.
2. "personalityDescriptors": 3-5 refined personality tags (may differ from user picks). Choose from: Ambitious, Laid-back, Adventurous, Intellectual, Funny, Creative, Athletic, Spontaneous, Grounded, Empathetic, Direct, Curious, Loyal, Social, Independent, Thoughtful, Witty, Genuine, Confident, Warm.
3. "intentStatement": 1 sentence describing what they're looking for. Make it specific to their archetype and interests.
4. "lifestyleTags": 3-5 lifestyle tags inferred from their interests and archetype. Choose from: Travel, Food & Dining, Fitness, Music, Art, Nightlife, Outdoors, Sports, Reading, Gaming, Cooking, Photography, Volunteering, Entrepreneurship, Tech, Fashion, Wellness, Spirituality.

Return ONLY valid JSON, no other text.
```

---

## Testing Strategy

Each phase has a manual test checklist. After each phase:
1. Run the app locally
2. Go through the flow
3. Check localStorage for correct data
4. Verify UI renders correctly
5. Test persistence (reload page)

No automated tests yet — focus on manual verification that the flow works end-to-end.

---

## Notes

- All data stays in localStorage (no Supabase writes)
- Dev mode: `VITE_SKIP_VERIFICATION=true` in `.env.local`
- Use existing Svelte stores pattern for state management
- Follow existing component structure and styling
- Photo data already exists from step 3 (PhotoUploadStep) — just read from localStorage
