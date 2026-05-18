# Phase 4: Discovery & Matching — Implementation Plan

**Date:** May 18, 2026  
**Status:** In Progress  
**Tasks:** 15-19 (5 tasks)  
**Estimated Duration:** 2-3 days  
**Estimated Hours:** 16-20 hours

---

## Overview

Phase 4 implements the discovery and matching system for Verified Vibe. Users will be able to browse verified profiles, swipe to like/pass, and create mutual matches.

---

## Tasks Breakdown

### Task 15: Discovery Screen (Card Stack)
**Objective:** Implement card stack discovery interface with profile display

**Components:**
- Discovery page (`/src/routes/verified-vibe/discover/+page.svelte`)
- DiscoveryCard component
- Card stack animation

**Features:**
- ✅ Display profile cards in stack format
- ✅ Show profile photo, name, age, archetype, distance
- ✅ Display about text and trust score
- ✅ Show verified badges
- ✅ Load more profiles on scroll
- ✅ Handle empty state

**API Endpoint:**
- `GET /api/verified-vibe/discover` - Fetch discovery profiles

**Acceptance Criteria:**
- [ ] Card stack displays correctly
- [ ] Profile information visible
- [ ] Verified badges displayed
- [ ] Load more profiles on scroll
- [ ] Empty state handled
- [ ] Mobile responsive

---

### Task 16: DiscoveryCard Component
**Objective:** Create reusable discovery card component

**Component:** `DiscoveryCard.svelte`

**Features:**
- ✅ Full-width profile photo
- ✅ Name, age, archetype emoji
- ✅ Distance display
- ✅ About/bio text
- ✅ Trust score badge
- ✅ Verified badges
- ✅ Smooth animations
- ✅ Accessible

**Props:**
```typescript
interface Props {
  profile: DiscoveryProfile;
  onLike?: () => void;
  onPass?: () => void;
}
```

**Acceptance Criteria:**
- [ ] Component renders correctly
- [ ] All profile info displayed
- [ ] Animations smooth
- [ ] Accessible with keyboard
- [ ] Mobile responsive

---

### Task 17: Swipe Gesture Handling
**Objective:** Implement touch and mouse swipe gestures

**Features:**
- ✅ Detect left swipe (pass)
- ✅ Detect right swipe (like)
- ✅ Animate card out on swipe
- ✅ Load next card smoothly
- ✅ Support both touch and mouse
- ✅ Visual feedback during swipe
- ✅ Handle edge cases

**Implementation:**
- Touch event listeners
- Mouse event listeners
- Swipe threshold detection
- Card animation
- Next card loading

**Acceptance Criteria:**
- [ ] Swipe left triggers pass
- [ ] Swipe right triggers like
- [ ] Card animates out smoothly
- [ ] Next card loads
- [ ] Works on touch and mouse
- [ ] Visual feedback provided

---

### Task 18: Like/Pass Logic
**Objective:** Implement like and pass functionality

**API Endpoints:**
- `POST /api/verified-vibe/like` - Like a profile
- `POST /api/verified-vibe/pass` - Pass on a profile

**Features:**
- ✅ Save like to database
- ✅ Check for mutual match
- ✅ Create match record if mutual
- ✅ Handle pass action
- ✅ Update discovery queue
- ✅ Error handling

**Matching Logic:**
1. User likes profile A
2. Check if profile A has liked user
3. If yes → create match record
4. If no → store like for future matching

**Acceptance Criteria:**
- [ ] Like saved to database
- [ ] Pass saved to database
- [ ] Mutual matches detected
- [ ] Match records created
- [ ] Discovery queue updated
- [ ] Errors handled

---

### Task 19: Match Overlay
**Objective:** Display match overlay when mutual match occurs

**Component:** `MatchOverlay.svelte`

**Features:**
- ✅ Show matched profile
- ✅ Display larger photo
- ✅ Show "Send Message" button
- ✅ Show "Close" button
- ✅ Smooth animations
- ✅ Mobile responsive

**Behavior:**
- Display when mutual match detected
- Allow user to send message or close
- Navigate to chat on "Send Message"
- Return to discovery on "Close"

**Acceptance Criteria:**
- [ ] Overlay displays on match
- [ ] Profile info visible
- [ ] Buttons functional
- [ ] Animations smooth
- [ ] Mobile responsive

---

## Architecture

### Discovery Flow

```
Discovery Screen
    ↓
Load Profiles (API)
    ↓
Display Card Stack
    ↓
User Swipes
    ├─ Right (Like)
    │   ├─ Save Like
    │   ├─ Check Mutual
    │   └─ Create Match (if mutual)
    │
    └─ Left (Pass)
        └─ Save Pass
    ↓
Load Next Card
    ↓
Repeat
```

### API Architecture

```
Frontend (Svelte)
    ↓
SvelteKit API Routes
├─ GET /api/verified-vibe/discover
├─ POST /api/verified-vibe/like
└─ POST /api/verified-vibe/pass
    ↓
Supabase
├─ verified_vibe_profiles
├─ verified_vibe_likes
├─ verified_vibe_passes
└─ verified_vibe_matches
```

### State Management

```
Global Stores
├─ discoveryProfiles (array of profiles)
├─ discoveryIndex (current card index)
├─ discoveryLoading (loading state)
└─ currentMatch (matched profile)
```

---

## File Structure

```
src/
├── lib/verified-vibe/
│   ├── components/
│   │   ├── DiscoveryCard.svelte (EXISTING, ENHANCE)
│   │   └── MatchOverlay.svelte (EXISTING, ENHANCE)
│   ├── server/
│   │   └── matching.ts (EXISTING)
│   └── types.ts
├── routes/verified-vibe/
│   ├── discover/
│   │   └── +page.svelte (EXISTING, ENHANCE)
│   └── api/
│       ├── discover/
│       │   └── +server.ts (EXISTING, ENHANCE)
│       ├── like/
│       │   └── +server.ts (EXISTING, ENHANCE)
│       └── pass/
│           └── +server.ts (EXISTING, ENHANCE)
└── docs/tasks/
    ├── TASK_15_DISCOVERY_SCREEN_COMPLETION.md
    ├── TASK_16_DISCOVERY_CARD_COMPLETION.md
    ├── TASK_17_SWIPE_GESTURE_COMPLETION.md
    ├── TASK_18_LIKE_PASS_LOGIC_COMPLETION.md
    ├── TASK_19_MATCH_OVERLAY_COMPLETION.md
    └── PHASE_4_DISCOVERY_MATCHING_COMPLETION.md
```

---

## Implementation Strategy

### Phase 4A: Discovery Screen & Card Display (Tasks 15-16)
1. Enhance discovery page
2. Implement card stack display
3. Load profiles from API
4. Display profile information
5. Handle empty state

### Phase 4B: Swipe Gestures (Task 17)
1. Implement touch event listeners
2. Implement mouse event listeners
3. Detect swipe direction
4. Animate card out
5. Load next card

### Phase 4C: Like/Pass Logic (Task 18)
1. Implement like API endpoint
2. Implement pass API endpoint
3. Check for mutual matches
4. Create match records
5. Update discovery queue

### Phase 4D: Match Overlay (Task 19)
1. Create match overlay component
2. Display on mutual match
3. Show matched profile
4. Implement navigation
5. Handle close action

---

## Testing Strategy

### Manual Testing
- [ ] Load discovery page
- [ ] Verify profiles display
- [ ] Test swipe left (pass)
- [ ] Test swipe right (like)
- [ ] Test mutual match detection
- [ ] Test match overlay
- [ ] Test on mobile
- [ ] Test on desktop
- [ ] Test error scenarios

### Unit Tests
- [ ] Swipe detection logic
- [ ] Like/pass logic
- [ ] Match detection
- [ ] Component rendering

### Integration Tests
- [ ] Full discovery flow
- [ ] API endpoints
- [ ] State management
- [ ] Error handling

---

## Performance Targets

| Metric | Target |
|--------|--------|
| Page Load | <2s |
| Card Animation | <300ms |
| API Response | <500ms |
| Swipe Response | <100ms |
| Component Render | <50ms |

---

## Accessibility Requirements

- ✅ Keyboard navigation
- ✅ Screen reader support
- ✅ Color contrast > 4.5:1
- ✅ Touch targets > 44x44px
- ✅ ARIA labels
- ✅ Error messages

---

## Security Considerations

- ✅ Validate user ID
- ✅ Prevent self-likes
- ✅ Validate profile ID
- ✅ Check authentication
- ✅ Rate limiting (TODO)
- ✅ Input validation

---

## Known Limitations

1. **Matching Algorithm:** Simple compatibility check
2. **Profile Filtering:** Basic filtering only
3. **Performance:** No pagination optimization
4. **Caching:** No profile caching

---

## Future Enhancements

1. Advanced matching algorithm
2. Profile caching
3. Pagination optimization
4. Undo last action
5. Profile filtering
6. Search functionality
7. Favorites list

---

## Success Criteria

- ✅ All 5 tasks completed
- ✅ Discovery screen functional
- ✅ Swipe gestures working
- ✅ Like/pass logic implemented
- ✅ Match overlay displaying
- ✅ Mobile responsive
- ✅ Accessible
- ✅ Error handling
- ✅ Comprehensive documentation

---

## Timeline

**Day 1:**
- Task 15: Discovery Screen
- Task 16: DiscoveryCard Component

**Day 2:**
- Task 17: Swipe Gesture Handling
- Task 18: Like/Pass Logic

**Day 3:**
- Task 19: Match Overlay
- Testing & Documentation

---

## References

- [Verified Vibe Requirements](./requirements.md)
- [Verified Vibe Design](./design.md)
- [Phase 3 Completion](./PHASE_3_VERIFICATION_COMPLETION.md)

