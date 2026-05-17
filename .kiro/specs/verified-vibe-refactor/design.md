# Verified Vibe — Technical Design

**Feature Name:** verified-vibe-refactor  
**Status:** Design Phase  
**Date:** May 17, 2026

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    SvelteKit Frontend                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Pages: gate, home, verify, verification, trust,    │   │
│  │         discover, chat                              │   │
│  │  Components: ArchetypeCard, VerificationStep,       │   │
│  │             TrustGauge, ProfileCard, etc.           │   │
│  │  Stores: user, matches, messages, ui                │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    SvelteKit API Routes                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  /api/verified-vibe/register                        │   │
│  │  /api/verified-vibe/profile                         │   │
│  │  /api/verified-vibe/verify-step                     │   │
│  │  /api/verified-vibe/discover                        │   │
│  │  /api/verified-vibe/like                            │   │
│  │  /api/verified-vibe/message                         │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    Claude API                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Vision: Extract ID data, compare selfie to ID,     │   │
│  │          analyze photo consistency                  │   │
│  │  Text: Evaluate Q&A responses, generate matches     │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    Supabase Backend                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Tables: users, verification, matches, messages     │   │
│  │  Storage: profile photos, ID photos, selfies        │   │
│  │  Realtime: messages, online status, matches         │   │
│  │  Auth: Session management                           │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
src/routes/verified-vibe/
├── +layout.svelte                 # Main layout with bottom nav
├── +page.svelte                   # Entry point (redirects to gate)
├── gate/
│   └── +page.svelte               # Gender + age confirmation
├── home/
│   └── +page.svelte               # Archetype selection
├── verify/
│   └── +page.svelte               # Verification requirements
├── verification/
│   └── +page.svelte               # Multi-step verification flow
├── trust/
│   └── +page.svelte               # Trust dashboard
├── discover/
│   └── +page.svelte               # Card stack discovery
├── chat/
│   └── +page.svelte               # Messaging
└── api/
    ├── register/
    │   └── +server.ts             # Create user profile
    ├── profile/
    │   └── +server.ts             # Get/update profile
    ├── verify-step/
    │   └── +server.ts             # Submit verification step
    ├── discover/
    │   └── +server.ts             # Get discovery cards
    ├── like/
    │   └── +server.ts             # Like a profile
    ├── message/
    │   └── +server.ts             # Send/get messages
    └── matches/
        └── +server.ts             # Get matches

src/lib/verified-vibe/
├── stores.ts                      # Global state (user, matches, messages)
├── types.ts                       # TypeScript interfaces
├── constants.ts                   # Archetypes, traits, etc.
├── utils.ts                       # Helper functions
├── components/
│   ├── ArchetypeCard.svelte       # Collapsible archetype card
│   ├── VerificationStep.svelte    # Single verification step
│   ├── TrustGauge.svelte          # Trust score visualization
│   ├── ProfileCard.svelte         # User profile display
│   ├── DiscoveryCard.svelte       # Swipeable profile card
│   ├── ChatMessage.svelte         # Single message
│   ├── BottomNav.svelte           # Mobile navigation
│   ├── LiveNowCarousel.svelte     # Active users carousel
│   └── MatchOverlay.svelte        # Match notification
└── server/
    ├── verification.ts            # Claude verification logic
    ├── matching.ts                # Matching algorithm
    └── supabase.ts                # Supabase helpers
```

---

## State Management

### Global Stores

```typescript
// stores.ts

// User store
export const user = writable<VerifiedVibeUser | null>(null);
export const userTrust = writable<TrustScore | null>(null);
export const userVerification = writable<VerificationRecord[]>([]);

// Matches store
export const matches = writable<Match[]>([]);
export const currentMatch = writable<VerifiedVibeUser | null>(null);

// Messages store
export const messages = writable<Message[]>([]);
export const isTyping = writable(false);

// UI store
export const currentPhase = writable<'gate' | 'home' | 'verify' | 'verification' | 'app'>('gate');
export const currentTab = writable<'discover' | 'trust' | 'chat'>('discover');
export const loading = writable(false);
export const error = writable<string | null>(null);
```

### Component State

- Local component state for UI interactions (expanded cards, form inputs, etc.)
- Use `$state` rune for reactivity
- Use `$derived` for computed values

---

## Component Design

### ArchetypeCard.svelte

```svelte
<script lang="ts">
  import type { Archetype } from '$lib/verified-vibe/types';
  
  export let archetype: Archetype;
  export let selected = false;
  export let onSelect: () => void;
  
  let expanded = $state(false);
</script>

<!-- Collapsed view: emoji, name, tag, chevron -->
<!-- Expanded view: full details, traits, brings, requirements -->
<!-- Lock it in button on expanded -->
```

### VerificationStep.svelte

```svelte
<script lang="ts">
  import type { VerificationStep } from '$lib/verified-vibe/types';
  
  export let step: VerificationStep;
  export let onSubmit: (data: any) => Promise<void>;
  
  let uploading = $state(false);
  let error = $state<string | null>(null);
</script>

<!-- Step-specific UI: file upload, form, etc. -->
<!-- Progress indicator -->
<!-- Submit button -->
```

### TrustGauge.svelte

```svelte
<script lang="ts">
  import type { TrustScore } from '$lib/verified-vibe/types';
  
  export let trust: TrustScore;
  export let style: 'radial' | 'linear' | 'arc' = 'radial';
</script>

<!-- SVG gauge visualization -->
<!-- Category breakdown -->
<!-- Score labels -->
```

### DiscoveryCard.svelte

```svelte
<script lang="ts">
  import type { VerifiedVibeUser } from '$lib/verified-vibe/types';
  
  export let profile: VerifiedVibeUser;
  export let onLike: () => void;
  export let onPass: () => void;
  
  let swiping = $state(false);
</script>

<!-- Profile photo -->
<!-- Name, age, archetype, distance -->
<!-- About text -->
<!-- Trust score -->
<!-- Like/Pass buttons -->
<!-- Swipe gesture handling -->
```

---

## API Endpoints

### POST /api/verified-vibe/register

**Request:**
```json
{
  "gender": "man",
  "archetype": "casual_man",
  "firstName": "Alex",
  "age": 28,
  "city": "Brooklyn, NY"
}
```

**Response:**
```json
{
  "id": "uuid",
  "gender": "man",
  "archetype": "casual_man",
  "firstName": "Alex",
  "age": 28,
  "city": "Brooklyn, NY",
  "trustScore": 0,
  "createdAt": "2026-05-17T10:00:00Z"
}
```

### POST /api/verified-vibe/verify-step

**Request:**
```json
{
  "step": "id",
  "data": {
    "idPhoto": "base64-encoded-image"
  }
}
```

**Response:**
```json
{
  "status": "completed",
  "data": {
    "idNumber": "DL123456",
    "idName": "Alexander Smith",
    "idDOB": "1998-03-15"
  },
  "trustPoints": 10
}
```

### GET /api/verified-vibe/discover

**Query Params:**
- `limit`: number of cards to return (default: 10)
- `offset`: pagination offset (default: 0)

**Response:**
```json
{
  "profiles": [
    {
      "id": "uuid",
      "name": "Sarah",
      "age": 26,
      "archetype": "spoilt_woman",
      "city": "Brooklyn, NY",
      "distance": "2 mi",
      "photo": "url",
      "trustScore": 81,
      "about": "...",
      "verified": ["ID", "Photos", "Spending"]
    }
  ]
}
```

### POST /api/verified-vibe/like

**Request:**
```json
{
  "profileId": "uuid"
}
```

**Response:**
```json
{
  "matched": true,
  "matchId": "uuid"
}
```

### POST /api/verified-vibe/message

**Request:**
```json
{
  "matchId": "uuid",
  "content": "Hey! How's your day going?"
}
```

**Response:**
```json
{
  "id": "uuid",
  "matchId": "uuid",
  "senderId": "uuid",
  "content": "Hey! How's your day going?",
  "createdAt": "2026-05-17T10:00:00Z"
}
```

---

## Claude Integration

### ID Extraction

```typescript
async function extractIDData(idPhotoBase64: string) {
  const response = await askClaudeWithImage(
    `Extract the following from this government ID:
     - ID number
     - Full name
     - Date of birth
     - Expiration date
     
     Return as JSON.`,
    idPhotoBase64
  );
  
  return JSON.parse(response);
}
```

### Liveness Check

```typescript
async function checkLiveness(selfieBase64: string, idPhotoBase64: string) {
  const response = await askClaudeWithImage(
    `Compare these two photos:
     1. Government ID photo
     2. Selfie
     
     Rate the confidence that they are the same person (0-100).
     Return as JSON: { confidence: number, match: boolean }`,
    [idPhotoBase64, selfieBase64]
  );
  
  return JSON.parse(response);
}
```

### Photo Consistency

```typescript
async function checkPhotoConsistency(photoBase64Array: string[]) {
  const response = await askClaudeWithImage(
    `Analyze these ${photoBase64Array.length} photos.
     Are they all of the same person? (0-100 confidence)
     Return as JSON: { confidence: number, consistent: boolean }`,
    photoBase64Array
  );
  
  return JSON.parse(response);
}
```

---

## Supabase Schema

### verified_vibe_users

```sql
CREATE TABLE verified_vibe_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gender TEXT NOT NULL CHECK (gender IN ('man', 'woman', 'prefer_not_to_say')),
  archetype TEXT NOT NULL,
  first_name TEXT NOT NULL,
  age INTEGER NOT NULL,
  city TEXT NOT NULL,
  avatar_url TEXT,
  about TEXT,
  looking TEXT,
  trust_score INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### verified_vibe_verification

```sql
CREATE TABLE verified_vibe_verification (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES verified_vibe_users(id),
  step TEXT NOT NULL CHECK (step IN ('id', 'liveness', 'photos', 'spending_or_qa')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
  data JSONB,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### verified_vibe_matches

```sql
CREATE TABLE verified_vibe_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id UUID NOT NULL REFERENCES verified_vibe_users(id),
  user2_id UUID NOT NULL REFERENCES verified_vibe_users(id),
  status TEXT NOT NULL CHECK (status IN ('pending', 'mutual', 'rejected')),
  created_at TIMESTAMP DEFAULT NOW()
);
```

### verified_vibe_messages

```sql
CREATE TABLE verified_vibe_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES verified_vibe_matches(id),
  sender_id UUID NOT NULL REFERENCES verified_vibe_users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Realtime Features

### Messages Subscription

```typescript
const channel = supabase
  .channel(`match:${matchId}`)
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'verified_vibe_messages',
      filter: `match_id=eq.${matchId}`
    },
    (payload) => {
      messages.update(m => [...m, payload.new]);
    }
  )
  .subscribe();
```

### Online Status

```typescript
const channel = supabase
  .channel('online-users')
  .on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState();
    // Update online status
  })
  .subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await channel.track({ user_id: userId, online_at: new Date() });
    }
  });
```

---

## Mobile Responsiveness

### Breakpoints

- Mobile: 375px - 767px
- Tablet: 768px - 1023px
- Desktop: 1024px+

### Mobile-Specific Features

1. **Bottom Navigation**
   - Fixed at bottom on mobile
   - Tabs: Discover, Trust, Chat
   - Badge for unread messages

2. **Full-Screen Modals**
   - Match overlay fills screen
   - Verification steps full-width
   - No side-by-side layouts

3. **Touch Gestures**
   - Swipe left/right for discovery cards
   - Swipe up to dismiss overlays
   - Long-press for profile preview

4. **Keyboard Handling**
   - Chat input stays above keyboard
   - Form inputs auto-focus
   - Dismiss keyboard on submit

---

## Performance Optimization

### Image Optimization

- Use WebP format with JPEG fallback
- Lazy load images below fold
- Responsive images (srcset)
- Compress to < 100KB per image

### Code Splitting

- Route-based code splitting (SvelteKit default)
- Component lazy loading for heavy components
- Separate bundle for Claude integration

### Caching

- Cache user profile in localStorage
- Cache discovery cards (5-minute TTL)
- Cache matches list (1-minute TTL)
- Service worker for offline support

---

## Error Handling

### User-Facing Errors

- "ID extraction failed. Please try again with a clearer photo."
- "Face doesn't match ID. Please retake your selfie."
- "Photos are inconsistent. Please upload photos of the same person."
- "Network error. Please check your connection and try again."

### Logging

- Log all Claude API calls (input, output, cost)
- Log all verification failures (step, reason)
- Log all API errors (endpoint, status, message)
- Send to error tracking service (e.g., Sentry)

---

## Security Considerations

### Data Protection

- Encrypt sensitive data at rest (ID numbers, DOB)
- Use HTTPS only
- CSRF protection on all forms
- Rate limiting on API endpoints (10 req/min per user)

### Verification Security

- Store ID photos separately from user profile
- Don't store raw ID numbers (hash instead)
- Manual review for edge cases
- Fraud detection (duplicate IDs, fake photos)

### Privacy

- No data sharing with third parties
- User can delete account (GDPR compliance)
- Clear privacy policy
- Transparent about data usage

---

## Testing Strategy

### Unit Tests

- Utility functions (matching, scoring)
- Store logic (state updates)
- Component rendering

### Integration Tests

- API endpoints (request/response)
- Supabase queries
- Claude API calls

### E2E Tests

- Full user flow (gate → verification → discovery → chat)
- Mobile responsiveness
- Error scenarios

### Performance Tests

- Lighthouse audit
- Load testing (100+ concurrent users)
- Image optimization

---

## Deployment

### Staging

- Deploy to staging environment
- Run full test suite
- Manual QA on mobile devices
- Performance testing

### Production

- Blue-green deployment
- Gradual rollout (10% → 50% → 100%)
- Monitor error rates and performance
- Rollback plan if issues arise

---

## Monitoring & Analytics

### Metrics to Track

- User registration rate
- Verification completion rate
- Match rate
- Message rate
- Session duration
- Error rate by endpoint
- API response time
- Image upload success rate

### Tools

- Supabase analytics
- Sentry for error tracking
- PostHog for product analytics
- Vercel analytics for performance

