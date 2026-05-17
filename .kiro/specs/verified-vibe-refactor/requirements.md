# Verified Vibe — Full SvelteKit Refactor

**Feature Name:** verified-vibe-refactor  
**Status:** Requirements Phase  
**Date:** May 17, 2026

---

## Executive Summary

Convert Verified Vibe from a React prototype (`/static/verified-vibe/`) into a production-ready SvelteKit feature with full backend integration, mobile responsiveness, and real user data persistence.

**Current State:** Interactive React prototype with demo data, no backend, embedded in static HTML.  
**Target State:** Full-featured SvelteKit application with Supabase backend, real verification flows, and user matching.

---

## User Stories & Acceptance Criteria

### Story 1: User Onboarding & Archetype Selection

**As a** new user,  
**I want to** quickly understand Verified Vibe and select my dating archetype,  
**So that** I can begin the verification process with clarity about my dating intent.

#### Acceptance Criteria

1. **Gate Screen (Gender + Age Confirmation)**
   - User sees a welcoming hero with "Verified Vibe" branding
   - User selects gender (Man / Woman / Prefer not to say)
   - User confirms they are 18+ (checkbox)
   - "Continue" button is disabled until both selections are made
   - On continue, user is taken to Home screen
   - Mobile responsive: full-width on mobile, centered on desktop

2. **Home Screen (Archetype Selection)**
   - User sees 2-4 archetype cards based on their gender
   - Each card shows: emoji, name, tag, description
   - User can tap a card to expand and see full details:
     - What they're looking for (match traits)
     - What they bring to the table (brings)
     - What to avoid (avoid traits)
     - Verification requirements (time estimate)
   - User can collapse the expanded card
   - "Lock it in" button appears on expanded card
   - On lock-in, user is taken to Verify Requirements screen
   - Live Now carousel shows active users (scrolling, with online status)
   - Mobile responsive: cards stack vertically, carousel scrolls horizontally

3. **Verify Requirements Screen**
   - User sees their selected archetype prominently
   - User sees a list of verification steps (ID, photos, spending, Q&A)
   - Each step shows: step number, name, description, time estimate
   - User sees total time estimate (e.g., "~10 minutes")
   - "Start Verification" button at bottom
   - "Back" button to return to archetype selection
   - Mobile responsive: full-width layout, readable on small screens

---

### Story 2: Verification Flow

**As a** user who has selected an archetype,  
**I want to** complete a multi-step verification process,  
**So that** I can build trust and unlock access to verified matches.

#### Acceptance Criteria

1. **Verification Flow (4 Steps)**
   - Step 1: Government ID verification
     - User uploads ID photo
     - System extracts name, DOB, ID number (via Claude vision)
     - User confirms extracted data
     - Success: "ID verified ✓"
   
   - Step 2: Liveness check
     - User takes a selfie
     - System compares selfie to ID photo (via Claude vision)
     - Success: "Face matches ID ✓"
   
   - Step 3: Photo story
     - User uploads 5+ photos
     - System analyzes photos for consistency (same person)
     - User labels each photo (lead, warmth, lifestyle, conversation, social)
     - Success: "Photos verified ✓"
   
   - Step 4: Spending pattern (for men) OR Q&A (for women)
     - Men: Upload bank statement or spending screenshot
     - Women: Answer 3-5 Q&A questions about dating intent
     - Success: "Spending verified ✓" or "Q&A complete ✓"

2. **Progress Tracking**
   - User sees progress bar showing current step (1/4, 2/4, etc.)
   - User can see which steps are complete (checkmark)
   - User can skip steps (with warning) to move forward
   - User can go back to previous steps to re-upload/re-answer
   - On completion, user is taken to Trust Dashboard

3. **Error Handling**
   - If ID extraction fails, user is prompted to re-upload
   - If face doesn't match ID, user is prompted to retake selfie
   - If photos are inconsistent, user is prompted to re-upload
   - Clear error messages guide user to fix issues
   - Mobile responsive: full-width forms, readable inputs

---

### Story 3: Trust Dashboard & Profile

**As a** verified user,  
**I want to** see my trust score and profile details,  
**So that** I understand how trustworthy I appear to potential matches.

#### Acceptance Criteria

1. **Trust Dashboard**
   - User sees their avatar and name
   - User sees overall trust score (0-100) with visual gauge
   - Gauge shows breakdown by category:
     - Identity (ID, liveness, face match)
     - Lifestyle (photos, grooming, consistency)
     - Intent (Q&A honesty, archetype clarity)
   - Each category shows score and completed items
   - User can tap "Edit Q&A" to update answers
   - Mobile responsive: gauge scales to screen size

2. **Profile Card**
   - User sees their archetype emoji and name
   - User sees their age, city, distance
   - User sees their about/looking text
   - User sees verified badges (ID, Photos, Spending, Q&A)
   - User can edit profile details
   - Mobile responsive: card layout adapts to screen

---

### Story 4: Discovery & Matching

**As a** verified user,  
**I want to** discover compatible matches and send messages,  
**So that** I can find meaningful connections.

#### Acceptance Criteria

1. **Discovery Screen (Card Stack)**
   - User sees a stack of profile cards
   - Each card shows: photo, name, age, archetype, distance, about, trust score
   - User can swipe right (like) or left (pass)
   - User can tap buttons: "Like" / "Pass" / "Message"
   - On like, if mutual match, show match overlay
   - Mobile responsive: full-width cards, touch-friendly buttons

2. **Match Overlay**
   - User sees matched profile with larger photo
   - User sees "Send Message" and "Close" buttons
   - On "Send Message", user is taken to Chat screen
   - Mobile responsive: overlay fills screen on mobile

3. **Chat Screen**
   - User sees conversation history with matched profile
   - User can type and send messages
   - Messages appear in real-time (via Supabase realtime)
   - User can see when match is typing
   - User can see date proposal card (if sent)
   - Mobile responsive: full-width chat, keyboard-friendly

---

### Story 5: Mobile Responsiveness

**As a** mobile user,  
**I want to** use Verified Vibe on my phone with full functionality,  
**So that** I can access the app anywhere.

#### Acceptance Criteria

1. **Responsive Design**
   - All screens adapt to mobile viewport (375px - 768px)
   - Touch targets are at least 44x44px
   - Buttons and inputs are easy to tap
   - Text is readable without zooming
   - Images scale appropriately
   - No horizontal scrolling (except carousels)

2. **Mobile-Specific UX**
   - Bottom navigation on mobile (Discover, Trust, Chat)
   - Hamburger menu for secondary actions
   - Full-screen modals instead of overlays
   - Swipe gestures for card navigation
   - Keyboard handling for chat input

3. **Performance**
   - Page load time < 2s on 4G
   - Images are optimized (WebP, lazy loading)
   - No jank during animations
   - Smooth scrolling on all screens

---

## Data Model

### User Profile

```typescript
interface VerifiedVibeUser {
  id: string;                    // UUID
  gender: 'man' | 'woman' | 'prefer_not_to_say';
  archetype: string;             // casual_man, spoilt_woman, etc.
  firstName: string;
  age: number;
  city: string;
  avatar: string;                // URL to profile photo
  about: string;                 // Bio
  looking: string;               // What they're looking for
  trustScore: number;            // 0-100
  createdAt: timestamp;
  updatedAt: timestamp;
}
```

### Verification Data

```typescript
interface VerificationRecord {
  id: string;
  userId: string;
  step: 'id' | 'liveness' | 'photos' | 'spending_or_qa';
  status: 'pending' | 'completed' | 'failed';
  data: {
    idNumber?: string;
    idName?: string;
    idDOB?: string;
    livenessMatch?: number;      // 0-100 confidence
    photoCount?: number;
    spendingVerified?: boolean;
    qaAnswers?: string[];
  };
  completedAt?: timestamp;
}
```

### Match Record

```typescript
interface Match {
  id: string;
  user1Id: string;
  user2Id: string;
  status: 'pending' | 'mutual' | 'rejected';
  createdAt: timestamp;
}
```

### Message

```typescript
interface Message {
  id: string;
  matchId: string;
  senderId: string;
  content: string;
  createdAt: timestamp;
}
```

---

## Technical Requirements

### Frontend Architecture

1. **SvelteKit Pages**
   - `/verified-vibe` — Main app entry point
   - `/verified-vibe/gate` — Gender + age confirmation
   - `/verified-vibe/home` — Archetype selection
   - `/verified-vibe/verify` — Verification requirements
   - `/verified-vibe/verification` — Multi-step verification flow
   - `/verified-vibe/trust` — Trust dashboard
   - `/verified-vibe/discover` — Card stack discovery
   - `/verified-vibe/chat` — Messaging

2. **Svelte Components**
   - `ArchetypeCard.svelte` — Collapsible archetype card
   - `VerificationStep.svelte` — Single verification step
   - `TrustGauge.svelte` — Trust score visualization
   - `ProfileCard.svelte` — User profile display
   - `DiscoveryCard.svelte` — Swipeable profile card
   - `ChatMessage.svelte` — Single message in chat
   - `BottomNav.svelte` — Mobile navigation

3. **State Management**
   - Use SvelteKit stores for global state (user, matches, messages)
   - Use component state for local UI state
   - Persist user session to localStorage

4. **Styling**
   - Tailwind CSS (existing setup)
   - Dark mode (existing design tokens)
   - Responsive breakpoints: mobile (375px), tablet (768px), desktop (1024px)
   - Accent colors: emerald, mint, lime, amber (existing)

### Backend Integration

1. **Supabase Tables**
   - `verified_vibe_users` — User profiles
   - `verified_vibe_verification` — Verification records
   - `verified_vibe_matches` — Match records
   - `verified_vibe_messages` — Chat messages

2. **API Endpoints**
   - `POST /api/verified-vibe/register` — Create user profile
   - `GET /api/verified-vibe/profile` — Get current user profile
   - `POST /api/verified-vibe/verify-step` — Submit verification step
   - `GET /api/verified-vibe/discover` — Get discovery cards
   - `POST /api/verified-vibe/like` — Like a profile
   - `POST /api/verified-vibe/message` — Send message
   - `GET /api/verified-vibe/messages` — Get chat history

3. **Claude Integration**
   - Use Claude vision to extract ID data
   - Use Claude vision to compare selfie to ID
   - Use Claude vision to analyze photo consistency
   - Use Claude to evaluate Q&A responses

4. **Realtime Features**
   - Supabase realtime for messages
   - Supabase realtime for match notifications
   - Supabase realtime for online status

---

## Non-Functional Requirements

### Performance

- Page load time < 2s on 4G
- Time to interactive < 3s
- Lighthouse score > 80
- Images optimized (WebP, lazy loading)
- No layout shift (CLS < 0.1)

### Security

- All user data encrypted at rest
- HTTPS only
- CSRF protection on forms
- Rate limiting on API endpoints
- No sensitive data in localStorage
- Verification data stored securely

### Accessibility

- WCAG 2.1 AA compliance
- Keyboard navigation on all screens
- Screen reader support
- Color contrast > 4.5:1
- Touch targets > 44x44px

### Reliability

- 99.9% uptime
- Graceful error handling
- Retry logic for failed uploads
- Offline support (cached data)
- Error logging and monitoring

---

## Out of Scope

- Advanced matching algorithm (MVP uses simple compatibility matrix)
- Video verification (MVP uses photo + selfie)
- Background checks (future phase)
- Payment processing (future phase)
- Admin dashboard (future phase)
- Analytics (future phase)

---

## Success Metrics

1. **User Adoption**
   - 100+ users complete gate screen in first week
   - 50%+ of users complete verification
   - 30%+ of users make a match

2. **Engagement**
   - Average session duration > 5 minutes
   - 70%+ of users return within 7 days
   - 50%+ of matches send at least one message

3. **Quality**
   - 0 critical bugs in first month
   - < 5% verification failure rate
   - > 90% user satisfaction (NPS > 50)

4. **Performance**
   - Page load time < 2s
   - 99.9% uptime
   - < 100ms API response time

---

## Timeline

- **Week 1:** SvelteKit setup, component library, gate + home screens
- **Week 2:** Verification flow, Claude integration, Supabase setup
- **Week 3:** Discovery + matching, chat, realtime features
- **Week 4:** Mobile optimization, testing, deployment

---

## Dependencies

- SvelteKit 2.57.0 (existing)
- Tailwind CSS 4.2.4 (existing)
- Supabase JS SDK (existing)
- Anthropic Claude SDK (existing)
- Lucide Svelte (existing)

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Claude vision API costs | High | Implement caching, batch processing |
| Supabase realtime latency | Medium | Use polling fallback, optimize queries |
| Mobile performance | Medium | Lazy load images, code splitting |
| User data privacy | High | Encrypt sensitive data, audit logs |
| Verification fraud | High | Multi-step verification, manual review |

