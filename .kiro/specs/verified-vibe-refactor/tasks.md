# Verified Vibe — Implementation Tasks

**Feature Name:** verified-vibe-refactor  
**Status:** Tasks Phase  
**Date:** May 17, 2026

---

## Overview

Complete SvelteKit refactor of Verified Vibe dating app with 7 phases: Foundation, Onboarding, Verification, Discovery, Chat, Trust Dashboard, and Mobile Polish. Total 33 tasks across ~100-120 hours.

# Implementation Plan:

Phase-based execution with dependency management. Each phase builds on previous work. All tasks reference specific requirements from requirements.md and design patterns from design.md.

## Task Dependency Graph

```json
{
  "waves": [
    {
      "wave": 1,
      "tasks": ["1", "2", "3", "4"],
      "description": "Phase 1: Foundation - Setup and core infrastructure"
    },
    {
      "wave": 2,
      "tasks": ["5", "6", "7", "8"],
      "description": "Phase 2: Onboarding - User onboarding flow"
    },
    {
      "wave": 3,
      "tasks": ["9", "10", "11", "12", "13", "14"],
      "description": "Phase 3: Verification - Multi-step verification process"
    },
    {
      "wave": 4,
      "tasks": ["15", "16", "17", "18", "19"],
      "description": "Phase 4: Discovery - Card stack discovery interface"
    },
    {
      "wave": 5,
      "tasks": ["20", "21", "22", "23", "24"],
      "description": "Phase 5: Chat - Messaging and realtime updates"
    },
    {
      "wave": 6,
      "tasks": ["25", "26", "27", "28"],
      "description": "Phase 6: Trust Dashboard - User trust visualization"
    },
    {
      "wave": 7,
      "tasks": ["29", "30", "31", "32", "33"],
      "description": "Phase 7: Mobile & Polish - Optimization and testing"
    }
  ]
}
```

## Tasks

### Phase 1: Foundation (Week 1)

- [x] 1. SvelteKit Setup & Routing - Create `/src/routes/verified-vibe/` directory structure with routes for gate, home, verify, verification, trust, discover, chat. Set up layout with bottom navigation (hidden initially). Implement route transitions with animations. Test all routes load without errors.

- [x] 2. Tailwind & Design Tokens - Add Verified Vibe color palette to tailwind.config.ts (emerald, mint, lime, amber). Create CSS custom properties for design tokens in src/app.css. Set up dark mode compatibility. Create utility classes for common patterns. Test all accent colors and responsive breakpoints.

- [x] 3. Global Stores & Types - Create src/lib/verified-vibe/types.ts with VerifiedVibeUser, Archetype, Match, Message, VerificationStep interfaces. Create src/lib/verified-vibe/stores.ts with writable stores for user, matches, messages, ui state. Create src/lib/verified-vibe/constants.ts with archetype data (casual_man, spoilt_woman, etc.). Create src/lib/verified-vibe/utils.ts with helper functions (calculateTrustScore, getCompatibleArchetypes, etc.).

- [x] 4. Gate Screen - Implement src/routes/verified-vibe/gate/+page.svelte with hero branding, gender selection (Man/Woman/Prefer not to say), age confirmation checkbox (18+). "Continue" button disabled until both selections made. On continue, save to store and navigate to home. Mobile responsive with smooth animations.

### Phase 2: Onboarding (Week 1-2)

- [x] 5. Home Screen - Implement src/routes/verified-vibe/home/+page.svelte displaying 2-4 archetype cards based on gender. Cards show emoji, name, tag. Tap card to expand and show full details (traits, brings, requirements). "Lock it in" button on expanded card. Collapse card on second tap. Navigate to verify screen on lock-in. Mobile responsive with cards stacking vertically.

- [x] 6. ArchetypeCard Component - Create src/lib/verified-vibe/components/ArchetypeCard.svelte with collapsed view (emoji, name, tag, chevron) and expanded view (full details, traits, brings, requirements). Smooth expand/collapse animation (300ms). Hover effects on desktop. Touch-friendly on mobile (44x44px targets). Accessible with keyboard navigation and screen reader support.

- [x] 7. Verify Requirements Screen - Implement src/routes/verified-vibe/verify/+page.svelte displaying selected archetype prominently. Show list of verification steps (ID, liveness, photos, spending/Q&A) with number, name, description, time estimate. Display total time estimate. Include "Start Verification" button at bottom and "Back" button to return to archetype selection. Mobile responsive with smooth animations.

- [x] 8. Live Now Carousel - Implement src/lib/verified-vibe/components/LiveNowCarousel.svelte with 10+ user cards in horizontal scroll. Each card shows avatar, name, age, profession, online status (green dot for online, gray for offline). Carousel auto-scrolls (optional). Hover to pause scroll. Tap card to view profile (future). Mobile responsive with smooth horizontal scrolling.

### Phase 3: Verification (Week 2-3)

- [x] 9. Verification Flow Setup - Create src/routes/verified-vibe/verification/+page.svelte implementing multi-step verification flow. Show step navigation (1/4, 2/4, 3/4, 4/4) with progress bar. Implement "Next", "Back", "Skip" buttons with proper logic. Store verification data in store and persist to Supabase on each step. Handle errors gracefully. Mobile responsive.

- [x] 10. ID Extraction (Claude Vision) - Create VerificationStep component for ID upload. User can upload ID photo (file input). Send photo to Claude API for extraction (ID number, name, DOB, expiration date). Display extracted data for user confirmation. User can confirm or re-upload. Save to verification record. Handle errors (unclear photo, invalid ID, etc.). Mobile responsive.

- [x] 11. Liveness Check (Claude Vision) - Create VerificationStep component for selfie capture. User can take selfie (camera input or file upload). Send selfie + ID photo to Claude API for comparison. Claude returns confidence score (0-100). If confidence > 80%, mark as passed. If confidence < 80%, ask user to retake. Display result to user. Save to verification record. Handle errors. Mobile responsive.

- [ ] 12. Photo Upload & Consistency Check - Create VerificationStep component for photo upload. User can upload 5+ photos with labels (lead, warmth, lifestyle, conversation, social). Send all photos to Claude API for consistency check. Claude analyzes if all photos are same person. If consistent, mark as passed. If inconsistent, ask user to re-upload. Display result. Save photos to Supabase storage. Save to verification record. Mobile responsive.

- [ ] 13. Spending/Q&A Step - Create VerificationStep component for spending verification (men) or Q&A (women). For men: upload bank statement or spending screenshot, Claude analyzes spending pattern, mark as passed if credible. For women: display 3-5 Q&A questions, user answers each, Claude evaluates honesty/clarity, mark as passed if satisfactory. Save responses to verification record. Handle errors. Mobile responsive.

- [ ] 14. Trust Score Calculation - Create calculateTrustScore() function in utils.ts. Identity category: ID (10 pts) + Liveness (10 pts) + Face match (10 pts) = 30 pts max. Lifestyle category: Photos (15 pts) + Consistency (15 pts) + Grooming (15 pts) = 45 pts max. Intent category: Q&A (10 pts) + Archetype clarity (10 pts) = 20 pts max. Total: 0-100 points. Update user trust score after each step. Display breakdown in trust dashboard. Test calculation logic.

### Phase 4: Discovery & Matching (Week 3)

- [ ] 15. Discovery Screen (Card Stack) - Create src/routes/verified-vibe/discover/+page.svelte implementing card stack discovery interface. Fetch discovery cards from API. Display card stack (one card visible at a time) showing profile photo, name, age, archetype, distance, about, trust score. Implement swipe gestures (left/right). Implement Like/Pass buttons. Handle card transitions smoothly. Load next card after action. Mobile responsive. Handle empty state (no more cards).

- [ ] 16. DiscoveryCard Component - Create src/lib/verified-vibe/components/DiscoveryCard.svelte accepting profile prop. Display profile photo (full-width, high-quality). Display name, age, archetype emoji. Display distance, about text. Display trust score with badge. Display verified badges (ID, Photos, Spending, Q&A). Smooth animations. Accessible.

- [ ] 17. Swipe Gesture Handling - Implement touch and mouse event listeners for swipe detection. Detect swipe left (pass) and swipe right (like). Animate card out on swipe. Load next card smoothly. Support both touch and mouse events. Provide visual feedback during swipe. Handle edge cases (fast swipes, diagonal swipes). Mobile responsive. Accessible with keyboard support.

- [ ] 18. Like/Pass Logic - Create POST /api/verified-vibe/like endpoint. On like, check if mutual match. If mutual match, create match record. If not mutual, store like for future matching. On pass, skip profile. Update discovery queue. Handle errors. Test matching logic.

- [ ] 19. Match Overlay - Create MatchOverlay component displaying when mutual match occurs. Show matched profile with larger photo. Show "Send Message" and "Close" buttons. On "Send Message", navigate to chat. On "Close", return to discovery. Smooth animations. Mobile responsive (full-screen on mobile).

### Phase 5: Chat & Messaging (Week 3-4)

- [ ] 20. Chat Screen - Create src/routes/verified-vibe/chat/+page.svelte implementing chat interface. Display conversation history. Show matched profile at top. Implement message input at bottom. Display messages in chronological order. Show sender/receiver distinction. Show timestamps. Handle empty state (no messages yet). Mobile responsive. Keyboard handling.

- [ ] 21. ChatMessage Component - Create src/lib/verified-vibe/components/ChatMessage.svelte accepting message prop. Display sender/receiver distinction (left/right alignment). Display message text. Display timestamp. Show read status (optional). Smooth animations. Accessible.

- [ ] 22. Message Sending - Create POST /api/verified-vibe/message endpoint. User can type message in input. User can send message (button or Enter key). Message appears immediately in UI (optimistic update). Message is saved to Supabase. Handle errors (network, validation). Clear input after send. Disable send button while sending. Mobile responsive.

- [ ] 23. Realtime Messages (Supabase) - Implement Supabase realtime subscription for message changes. Subscribe to current match messages. New messages appear in real-time. Handle connection loss gracefully. Unsubscribe when leaving chat. Show "typing" indicator (optional). Test with multiple clients. Mobile responsive.

- [ ] 24. Online Status - Implement Supabase presence tracking for user online status. Track user online status in Supabase. Show online indicator in chat. Show "last seen" for offline users. Update status on app open/close. Handle connection loss. Test with multiple clients.

### Phase 6: Trust Dashboard (Week 4)

- [ ] 25. Trust Dashboard Screen - Create src/routes/verified-vibe/trust/+page.svelte implementing trust dashboard. Display user profile (avatar, name, age, city). Display overall trust score. Display trust breakdown by category. Show completed verification steps. Show "Edit Q&A" button. Mobile responsive. Smooth animations.

- [ ] 26. TrustGauge Component - Create src/lib/verified-vibe/components/TrustGauge.svelte accepting trust score prop. Display radial gauge (default). Support linear gauge variant. Support arc gauge variant. Show score percentage. Show category breakdown. Smooth animations. Accessible with ARIA labels.

- [ ] 27. Profile Card Display - Create ProfileCard component for trust dashboard. Display user profile card. Show archetype emoji and name. Show age, city, distance. Show about/looking text. Show verified badges. Show edit button. Mobile responsive.

- [ ] 28. Edit Q&A Modal - Create modal for editing Q&A responses. Display current Q&A responses. Allow user to edit each response. Save changes to Supabase. Update trust score after save. Handle errors. Mobile responsive.

### Phase 7: Mobile & Polish (Week 4)

- [ ] 29. Mobile Responsiveness - Test all screens on mobile (375px), tablet (768px), desktop (1024px). Ensure all screens adapt to viewport. Verify touch targets are 44x44px minimum. Verify text is readable without zooming. Verify images scale appropriately. Ensure no horizontal scrolling (except carousels). Verify forms are mobile-friendly. Verify modals are full-screen on mobile.

- [ ] 30. Bottom Navigation - Create BottomNav component showing on mobile only (hidden on desktop). Tabs: Discover, Trust, Chat. Show badge for unread messages. Smooth transitions between tabs. Accessible with keyboard navigation. Mobile responsive.

- [ ] 31. Performance Optimization - Optimize page load time < 2s on 4G. Optimize time to interactive < 3s. Achieve Lighthouse score > 80. Optimize images (WebP, lazy loading). Ensure no layout shift (CLS < 0.1). Implement code splitting. Add service worker for offline support.

- [ ] 32. Error Handling & Edge Cases - Handle network errors gracefully. Handle API errors with user-friendly messages. Handle file upload errors. Handle Claude API errors. Handle Supabase errors. Implement retry logic. Log errors for debugging. Test error scenarios.

- [ ] 33. Testing & QA - Write unit tests for utility functions. Write integration tests for API endpoints. Write E2E tests for full user flow. Test on mobile devices. Test on different browsers. Run performance tests. Run accessibility audit (WCAG 2.1 AA).

## Notes

**Total estimated time:** 100-120 hours (3-4 weeks)

**Breakdown by phase:**
- Phase 1 (Foundation): 13 hours - ✅ COMPLETE
- Phase 2 (Onboarding): 14 hours - ✅ COMPLETE
- Phase 3 (Verification): 22 hours
- Phase 4 (Discovery): 16 hours
- Phase 5 (Chat): 16 hours
- Phase 6 (Trust Dashboard): 13 hours
- Phase 7 (Mobile & Polish): 19 hours

**Current Progress:** 8/33 tasks complete (24.2%) | ~90-110 hours remaining

**Next Phase:** Phase 3 - Verification (Tasks 9-14)
