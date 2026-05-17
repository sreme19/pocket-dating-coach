# Verified Vibe — Implementation Tasks

**Feature Name:** verified-vibe-refactor  
**Status:** Tasks Phase  
**Date:** May 17, 2026

---

## Task Dependency Graph

```
Phase 1: Foundation (Week 1)
├── Task 1: SvelteKit setup & routing
├── Task 2: Tailwind & design tokens
├── Task 3: Global stores & types
└── Task 4: Gate screen (gender + age)

Phase 2: Onboarding (Week 1-2)
├── Task 5: Home screen (archetype selection)
├── Task 6: ArchetypeCard component
├── Task 7: Verify requirements screen
└── Task 8: Live Now carousel

Phase 3: Verification (Week 2-3)
├── Task 9: Verification flow setup
├── Task 10: ID extraction (Claude vision)
├── Task 11: Liveness check (Claude vision)
├── Task 12: Photo upload & consistency check
├── Task 13: Spending/Q&A step
└── Task 14: Trust score calculation

Phase 4: Discovery & Matching (Week 3)
├── Task 15: Discovery screen (card stack)
├── Task 16: DiscoveryCard component
├── Task 17: Swipe gesture handling
├── Task 18: Like/Pass logic
└── Task 19: Match overlay

Phase 5: Chat & Messaging (Week 3-4)
├── Task 20: Chat screen
├── Task 21: ChatMessage component
├── Task 22: Message sending
├── Task 23: Realtime messages (Supabase)
└── Task 24: Online status

Phase 6: Trust Dashboard (Week 4)
├── Task 25: Trust dashboard screen
├── Task 26: TrustGauge component
├── Task 27: Profile card display
└── Task 28: Edit Q&A modal

Phase 7: Mobile & Polish (Week 4)
├── Task 29: Mobile responsiveness
├── Task 30: Bottom navigation
├── Task 31: Performance optimization
├── Task 32: Error handling & edge cases
└── Task 33: Testing & QA
```

---

## Phase 1: Foundation (Week 1)

### Task 1: SvelteKit Setup & Routing

**Description:** Set up SvelteKit routes for Verified Vibe feature.

**Acceptance Criteria:**
- [x] Create `/src/routes/verified-vibe/` directory structure
- [x] Create route files: gate, home, verify, verification, trust, discover, chat
- [x] Create API route directory: `/src/routes/api/verified-vibe/`
- [x] Set up layout with bottom navigation (hidden initially)
- [x] Implement route transitions with animations
- [x] Test all routes load without errors

**Subtasks:**
- Create +layout.svelte with navigation logic
- Create +page.svelte for each route
- Create +server.ts for each API endpoint
- Add route guards (redirect to gate if not authenticated)

**Estimated Time:** 4 hours

---

### Task 2: Tailwind & Design Tokens

**Description:** Set up Tailwind CSS with Verified Vibe design tokens.

**Acceptance Criteria:**
- [x] Add Verified Vibe color palette to tailwind.config.ts
- [x] Create CSS custom properties for design tokens
- [x] Set up dark mode (already exists, verify compatibility)
- [x] Create utility classes for common patterns
- [x] Test all accent colors (emerald, mint, lime, amber)
- [x] Verify responsive breakpoints work

**Subtasks:**
- Update tailwind.config.ts with verified-vibe colors
- Create src/lib/verified-vibe/styles.css with tokens
- Create component utility classes
- Test on mobile, tablet, desktop

**Estimated Time:** 3 hours

---

### Task 3: Global Stores & Types

**Description:** Set up SvelteKit stores and TypeScript types for Verified Vibe.

**Acceptance Criteria:**
- [x] Create src/lib/verified-vibe/types.ts with all interfaces
- [x] Create src/lib/verified-vibe/stores.ts with global state
- [x] Create src/lib/verified-vibe/constants.ts with archetype data
- [x] Create src/lib/verified-vibe/utils.ts with helper functions
- [x] Test store subscriptions and updates
- [x] Verify TypeScript compilation

**Subtasks:**
- Define VerifiedVibeUser, Archetype, Match, Message types
- Create writable stores for user, matches, messages, ui
- Define archetype data (casual_man, spoilt_woman, etc.)
- Create utility functions (calculateTrustScore, getCompatibleArchetypes, etc.)

**Estimated Time:** 3 hours

---

### Task 4: Gate Screen (Gender + Age Confirmation)

**Description:** Implement the initial gate screen for user onboarding.

**Acceptance Criteria:**
- [x] Display hero with "Verified Vibe" branding
- [x] Show gender selection (Man / Woman / Prefer not to say)
- [x] Show age confirmation checkbox (18+)
- [x] "Continue" button disabled until both selections made
- [x] On continue, save to store and navigate to home
- [x] Mobile responsive (full-width on mobile)
- [x] Smooth animations on selection

**Subtasks:**
- Create src/routes/verified-vibe/gate/+page.svelte
- Implement gender selection UI
- Implement age confirmation checkbox
- Add form validation
- Add navigation logic

**Estimated Time:** 3 hours

---

## Phase 2: Onboarding (Week 1-2)

### Task 5: Home Screen (Archetype Selection)

**Description:** Implement archetype selection screen with expandable cards.

**Acceptance Criteria:**
- [x] Display 2-4 archetype cards based on gender
- [x] Cards show emoji, name, tag
- [x] Tap card to expand and show full details
- [x] Expanded view shows traits, brings, requirements
- [x] "Lock it in" button on expanded card
- [x] Collapse card on second tap
- [x] Navigate to verify screen on lock-in
- [x] Mobile responsive (cards stack vertically)

**Subtasks:**
- Create src/routes/verified-vibe/home/+page.svelte
- Create ArchetypeCard component
- Implement expand/collapse logic
- Add trait display
- Add navigation

**Estimated Time:** 4 hours

---

### Task 6: ArchetypeCard Component

**Description:** Create reusable ArchetypeCard component.

**Acceptance Criteria:**
- [x] Component accepts archetype prop
- [x] Collapsed view: emoji, name, tag, chevron
- [x] Expanded view: full details, traits, brings, requirements
- [x] Smooth expand/collapse animation
- [x] Hover effects on desktop
- [x] Touch-friendly on mobile
- [x] Accessible (keyboard navigation, screen reader support)

**Subtasks:**
- Create src/lib/verified-vibe/components/ArchetypeCard.svelte
- Implement collapsed layout
- Implement expanded layout
- Add animations
- Add accessibility features

**Estimated Time:** 3 hours

---

### Task 7: Verify Requirements Screen

**Description:** Implement verification requirements screen.

**Acceptance Criteria:**
- [x] Display selected archetype prominently
- [x] Show list of verification steps (ID, liveness, photos, spending/Q&A)
- [x] Each step shows: number, name, description, time estimate
- [x] Display total time estimate
- [~] "Start Verification" button at bottom
- [~] "Back" button to return to archetype selection
- [~] Mobile responsive
- [~] Smooth animations

**Subtasks:**
- Create src/routes/verified-vibe/verify/+page.svelte
- Implement step list UI
- Add time estimates
- Add navigation buttons

**Estimated Time:** 2 hours

---

### Task 8: Live Now Carousel

**Description:** Implement scrolling carousel of active users.

**Acceptance Criteria:**
- [~] Display 10+ user cards in horizontal scroll
- [~] Each card shows: avatar, name, age, profession, online status
- [~] Online users have green dot, offline users have gray dot
- [~] Carousel auto-scrolls (optional)
- [~] Hover to pause scroll
- [~] Tap card to view profile (future)
- [~] Mobile responsive (scrolls horizontally)
- [~] Smooth scrolling

**Subtasks:**
- Create src/lib/verified-vibe/components/LiveNowCarousel.svelte
- Implement horizontal scroll
- Add user cards
- Add online status indicators
- Add auto-scroll logic

**Estimated Time:** 3 hours

---

## Phase 3: Verification (Week 2-3)

### Task 9: Verification Flow Setup

**Description:** Set up multi-step verification flow structure.

**Acceptance Criteria:**
- [~] Create src/routes/verified-vibe/verification/+page.svelte
- [~] Implement step navigation (1/4, 2/4, 3/4, 4/4)
- [~] Show progress bar
- [~] Implement "Next", "Back", "Skip" buttons
- [~] Store verification data in store
- [~] Persist to Supabase on each step
- [~] Handle errors gracefully
- [ ] Mobile responsive

**Subtasks:**
- Create verification page
- Implement step navigation
- Add progress bar
- Add button logic
- Add error handling

**Estimated Time:** 3 hours

---

### Task 10: ID Extraction (Claude Vision)

**Description:** Implement government ID extraction using Claude vision.

**Acceptance Criteria:**
- [~] Create VerificationStep component for ID upload
- [~] User can upload ID photo (file input)
- [~] Send photo to Claude API for extraction
- [~] Extract: ID number, name, DOB, expiration date
- [~] Display extracted data for user confirmation
- [~] User can confirm or re-upload
- [~] Save to verification record
- [~] Handle errors (unclear photo, invalid ID, etc.)
- [ ] Mobile responsive

**Subtasks:**
- Create VerificationStep component
- Implement file upload UI
- Create Claude vision integration
- Implement data extraction
- Add confirmation UI
- Add error handling

**Estimated Time:** 4 hours

---

### Task 11: Liveness Check (Claude Vision)

**Description:** Implement liveness check by comparing selfie to ID.

**Acceptance Criteria:**
- [~] Create VerificationStep component for selfie
- [~] User can take selfie (camera input or file upload)
- [~] Send selfie + ID photo to Claude API
- [~] Claude compares and returns confidence score (0-100)
- [~] If confidence > 80%, mark as passed
- [~] If confidence < 80%, ask user to retake
- [~] Display result to user
- [ ] Save to verification record
- [~] Handle errors
- [ ] Mobile responsive

**Subtasks:**
- Create selfie capture UI
- Implement Claude vision comparison
- Add confidence scoring
- Add retry logic
- Add error handling

**Estimated Time:** 4 hours

---

### Task 12: Photo Upload & Consistency Check

**Description:** Implement photo upload with consistency verification.

**Acceptance Criteria:**
- [~] Create VerificationStep component for photo upload
- [~] User can upload 5+ photos
- [~] Each photo can be labeled (lead, warmth, lifestyle, conversation, social)
- [~] Send all photos to Claude API for consistency check
- [~] Claude analyzes if all photos are same person
- [~] If consistent, mark as passed
- [~] If inconsistent, ask user to re-upload
- [ ] Display result to user
- [~] Save photos to Supabase storage
- [ ] Save to verification record
- [ ] Mobile responsive

**Subtasks:**
- Create photo upload UI
- Implement multi-file upload
- Implement Claude vision consistency check
- Add photo labeling
- Add retry logic
- Add Supabase storage integration

**Estimated Time:** 5 hours

---

### Task 13: Spending/Q&A Step

**Description:** Implement spending verification (men) or Q&A (women).

**Acceptance Criteria:**
- [ ] For men: Create VerificationStep for spending pattern upload
  - [~] User uploads bank statement or spending screenshot
  - [~] Claude analyzes spending pattern
  - [~] Mark as passed if credible
- [ ] For women: Create VerificationStep for Q&A
  - [~] Display 3-5 Q&A questions
  - [~] User answers each question
  - [~] Claude evaluates honesty/clarity
  - [~] Mark as passed if satisfactory
- [~] Save responses to verification record
- [ ] Handle errors
- [ ] Mobile responsive

**Subtasks:**
- Create spending upload UI (for men)
- Create Q&A form UI (for women)
- Implement Claude analysis
- Add validation
- Add error handling

**Estimated Time:** 4 hours

---

### Task 14: Trust Score Calculation

**Description:** Implement trust score calculation based on verification steps.

**Acceptance Criteria:**
- [~] Create calculateTrustScore() function
- [~] Identity category: ID (10 pts) + Liveness (10 pts) + Face match (10 pts) = 30 pts max
- [~] Lifestyle category: Photos (15 pts) + Consistency (15 pts) + Grooming (15 pts) = 45 pts max
- [~] Intent category: Q&A (10 pts) + Archetype clarity (10 pts) = 20 pts max
- [~] Total: 0-100 points
- [~] Update user trust score after each step
- [~] Display breakdown in trust dashboard
- [~] Test calculation logic

**Subtasks:**
- Create calculateTrustScore() function
- Implement category scoring
- Add point allocation logic
- Test with various scenarios

**Estimated Time:** 2 hours

---

## Phase 4: Discovery & Matching (Week 3)

### Task 15: Discovery Screen (Card Stack)

**Description:** Implement card stack discovery interface.

**Acceptance Criteria:**
- [~] Create src/routes/verified-vibe/discover/+page.svelte
- [~] Fetch discovery cards from API
- [~] Display card stack (one card visible at a time)
- [~] Show profile photo, name, age, archetype, distance, about, trust score
- [~] Implement swipe gestures (left/right)
- [~] Implement Like/Pass buttons
- [~] Handle card transitions smoothly
- [~] Load next card after action
- [ ] Mobile responsive
- [~] Handle empty state (no more cards)

**Subtasks:**
- Create discovery page
- Implement card fetching
- Implement card display
- Add swipe gesture handling
- Add button logic
- Add empty state

**Estimated Time:** 4 hours

---

### Task 16: DiscoveryCard Component

**Description:** Create reusable DiscoveryCard component.

**Acceptance Criteria:**
- [~] Component accepts profile prop
- [~] Display profile photo (full-width, high-quality)
- [~] Display name, age, archetype emoji
- [~] Display distance, about text
- [~] Display trust score with badge
- [~] Display verified badges (ID, Photos, Spending, Q&A)
- [ ] Smooth animations
- [~] Accessible

**Subtasks:**
- Create src/lib/verified-vibe/components/DiscoveryCard.svelte
- Implement layout
- Add image optimization
- Add badge display
- Add animations

**Estimated Time:** 3 hours

---

### Task 17: Swipe Gesture Handling

**Description:** Implement swipe gestures for card navigation.

**Acceptance Criteria:**
- [~] Detect swipe left (pass) and swipe right (like)
- [~] Animate card out on swipe
- [~] Load next card smoothly
- [~] Support both touch and mouse events
- [~] Provide visual feedback during swipe
- [~] Handle edge cases (fast swipes, diagonal swipes)
- [ ] Mobile responsive
- [~] Accessible (keyboard support)

**Subtasks:**
- Implement touch event listeners
- Implement mouse event listeners
- Add swipe detection logic
- Add animation logic
- Add keyboard support

**Estimated Time:** 3 hours

---

### Task 18: Like/Pass Logic

**Description:** Implement like/pass logic and matching.

**Acceptance Criteria:**
- [~] Create POST /api/verified-vibe/like endpoint
- [~] On like, check if mutual match
- [~] If mutual match, create match record
- [~] If not mutual, store like for future matching
- [~] On pass, skip profile
- [~] Update discovery queue
- [ ] Handle errors
- [~] Test matching logic

**Subtasks:**
- Create API endpoint
- Implement matching logic
- Add Supabase integration
- Add error handling
- Test with various scenarios

**Estimated Time:** 3 hours

---

### Task 19: Match Overlay

**Description:** Implement match notification overlay.

**Acceptance Criteria:**
- [~] Create MatchOverlay component
- [~] Display when mutual match occurs
- [~] Show matched profile with larger photo
- [~] Show "Send Message" and "Close" buttons
- [~] On "Send Message", navigate to chat
- [~] On "Close", return to discovery
- [ ] Smooth animations
- [~] Mobile responsive (full-screen on mobile)

**Subtasks:**
- Create MatchOverlay component
- Implement layout
- Add animations
- Add button logic
- Add navigation

**Estimated Time:** 2 hours

---

## Phase 5: Chat & Messaging (Week 3-4)

### Task 20: Chat Screen

**Description:** Implement chat interface.

**Acceptance Criteria:**
- [~] Create src/routes/verified-vibe/chat/+page.svelte
- [~] Display conversation history
- [~] Show matched profile at top
- [~] Implement message input at bottom
- [~] Display messages in chronological order
- [~] Show sender/receiver distinction
- [~] Show timestamps
- [~] Handle empty state (no messages yet)
- [ ] Mobile responsive
- [~] Keyboard handling

**Subtasks:**
- Create chat page
- Implement message display
- Add message input
- Add message fetching
- Add keyboard handling

**Estimated Time:** 3 hours

---

### Task 21: ChatMessage Component

**Description:** Create reusable ChatMessage component.

**Acceptance Criteria:**
- [~] Component accepts message prop
- [~] Display sender/receiver distinction (left/right alignment)
- [~] Display message text
- [~] Display timestamp
- [~] Show read status (optional)
- [ ] Smooth animations
- [ ] Accessible

**Subtasks:**
- Create ChatMessage component
- Implement layout
- Add styling
- Add animations

**Estimated Time:** 2 hours

---

### Task 22: Message Sending

**Description:** Implement message sending functionality.

**Acceptance Criteria:**
- [~] Create POST /api/verified-vibe/message endpoint
- [~] User can type message in input
- [~] User can send message (button or Enter key)
- [~] Message appears immediately in UI (optimistic update)
- [~] Message is saved to Supabase
- [~] Handle errors (network, validation)
- [~] Clear input after send
- [~] Disable send button while sending
- [ ] Mobile responsive

**Subtasks:**
- Create API endpoint
- Implement message input
- Add send logic
- Add optimistic updates
- Add error handling

**Estimated Time:** 3 hours

---

### Task 23: Realtime Messages (Supabase)

**Description:** Implement realtime message updates using Supabase.

**Acceptance Criteria:**
- [~] Subscribe to message changes for current match
- [~] New messages appear in real-time
- [~] Handle connection loss gracefully
- [~] Unsubscribe when leaving chat
- [~] Show "typing" indicator (optional)
- [~] Test with multiple clients
- [ ] Mobile responsive

**Subtasks:**
- Implement Supabase realtime subscription
- Add message listener
- Add typing indicator (optional)
- Add error handling
- Test with multiple clients

**Estimated Time:** 3 hours

---

### Task 24: Online Status

**Description:** Implement online status tracking.

**Acceptance Criteria:**
- [~] Track user online status in Supabase
- [~] Show online indicator in chat
- [~] Show "last seen" for offline users
- [~] Update status on app open/close
- [~] Handle connection loss
- [ ] Test with multiple clients

**Subtasks:**
- Implement Supabase presence tracking
- Add online status display
- Add last seen display
- Add error handling

**Estimated Time:** 2 hours

---

## Phase 6: Trust Dashboard (Week 4)

### Task 25: Trust Dashboard Screen

**Description:** Implement trust dashboard screen.

**Acceptance Criteria:**
- [~] Create src/routes/verified-vibe/trust/+page.svelte
- [~] Display user profile (avatar, name, age, city)
- [~] Display overall trust score
- [~] Display trust breakdown by category
- [~] Show completed verification steps
- [~] Show "Edit Q&A" button
- [ ] Mobile responsive
- [ ] Smooth animations

**Subtasks:**
- Create trust page
- Implement profile display
- Add trust breakdown
- Add edit button
- Add styling

**Estimated Time:** 3 hours

---

### Task 26: TrustGauge Component

**Description:** Create TrustGauge visualization component.

**Acceptance Criteria:**
- [~] Component accepts trust score prop
- [~] Display radial gauge (default)
- [~] Support linear gauge variant
- [~] Support arc gauge variant
- [~] Show score percentage
- [~] Show category breakdown
- [ ] Smooth animations
- [~] Accessible (ARIA labels)

**Subtasks:**
- Create TrustGauge component
- Implement SVG gauge
- Add variants (radial, linear, arc)
- Add animations
- Add accessibility

**Estimated Time:** 4 hours

---

### Task 27: Profile Card Display

**Description:** Implement profile card display in trust dashboard.

**Acceptance Criteria:**
- [~] Display user profile card
- [~] Show archetype emoji and name
- [~] Show age, city, distance
- [~] Show about/looking text
- [~] Show verified badges
- [~] Show edit button
- [ ] Mobile responsive

**Subtasks:**
- Create ProfileCard component
- Implement layout
- Add badge display
- Add edit button
- Add styling

**Estimated Time:** 2 hours

---

### Task 28: Edit Q&A Modal

**Description:** Implement Q&A editing modal.

**Acceptance Criteria:**
- [~] Create modal for editing Q&A responses
- [~] Display current Q&A responses
- [~] Allow user to edit each response
- [~] Save changes to Supabase
- [~] Update trust score after save
- [ ] Handle errors
- [ ] Mobile responsive

**Subtasks:**
- Create edit modal component
- Implement form
- Add save logic
- Add error handling

**Estimated Time:** 2 hours

---

## Phase 7: Mobile & Polish (Week 4)

### Task 29: Mobile Responsiveness

**Description:** Ensure full mobile responsiveness across all screens.

**Acceptance Criteria:**
- [~] Test on mobile (375px), tablet (768px), desktop (1024px)
- [~] All screens adapt to viewport
- [~] Touch targets are 44x44px minimum
- [~] Text is readable without zooming
- [~] Images scale appropriately
- [~] No horizontal scrolling (except carousels)
- [~] Forms are mobile-friendly
- [~] Modals are full-screen on mobile

**Subtasks:**
- Test all screens on mobile
- Fix responsive issues
- Optimize touch targets
- Test on various devices

**Estimated Time:** 4 hours

---

### Task 30: Bottom Navigation

**Description:** Implement mobile bottom navigation.

**Acceptance Criteria:**
- [~] Create BottomNav component
- [~] Show on mobile only (hidden on desktop)
- [~] Tabs: Discover, Trust, Chat
- [~] Show badge for unread messages
- [~] Smooth transitions between tabs
- [~] Accessible (keyboard navigation)
- [ ] Mobile responsive

**Subtasks:**
- Create BottomNav component
- Implement tab logic
- Add badge display
- Add styling

**Estimated Time:** 2 hours

---

### Task 31: Performance Optimization

**Description:** Optimize performance for fast load times.

**Acceptance Criteria:**
- [~] Page load time < 2s on 4G
- [~] Time to interactive < 3s
- [~] Lighthouse score > 80
- [~] Images optimized (WebP, lazy loading)
- [~] No layout shift (CLS < 0.1)
- [~] Code splitting working
- [~] Service worker for offline support

**Subtasks:**
- Optimize images
- Implement lazy loading
- Add code splitting
- Add service worker
- Run Lighthouse audit

**Estimated Time:** 4 hours

---

### Task 32: Error Handling & Edge Cases

**Description:** Implement comprehensive error handling.

**Acceptance Criteria:**
- [~] Handle network errors gracefully
- [~] Handle API errors with user-friendly messages
- [~] Handle file upload errors
- [~] Handle Claude API errors
- [~] Handle Supabase errors
- [~] Implement retry logic
- [~] Log errors for debugging
- [~] Test error scenarios

**Subtasks:**
- Add error boundaries
- Implement error messages
- Add retry logic
- Add error logging
- Test error scenarios

**Estimated Time:** 3 hours

---

### Task 33: Testing & QA

**Description:** Comprehensive testing and quality assurance.

**Acceptance Criteria:**
- [~] Unit tests for utility functions
- [~] Integration tests for API endpoints
- [~] E2E tests for full user flow
- [~] Mobile testing on real devices
- [~] Cross-browser testing
- [~] Performance testing
- [~] Security testing
- [~] Accessibility testing (WCAG 2.1 AA)

**Subtasks:**
- Write unit tests
- Write integration tests
- Write E2E tests
- Test on mobile devices
- Test on different browsers
- Run performance tests
- Run accessibility audit

**Estimated Time:** 6 hours

---

## Summary

**Total Estimated Time:** 100-120 hours (3-4 weeks)

**Breakdown by Phase:**
- Phase 1 (Foundation): 13 hours
- Phase 2 (Onboarding): 14 hours
- Phase 3 (Verification): 22 hours
- Phase 4 (Discovery): 16 hours
- Phase 5 (Chat): 16 hours
- Phase 6 (Trust Dashboard): 13 hours
- Phase 7 (Mobile & Polish): 19 hours

**Team Recommendation:**
- 1 full-stack developer: 3-4 weeks
- 1 frontend developer + 1 backend developer: 2-3 weeks
- 1 frontend developer + 1 QA engineer: 3-4 weeks

