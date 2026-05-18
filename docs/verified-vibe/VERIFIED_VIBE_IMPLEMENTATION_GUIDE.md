# Verified Vibe — Full SvelteKit Refactor Implementation Guide

**Date:** May 17, 2026  
**Status:** Ready for Implementation  
**Estimated Duration:** 3-4 weeks (100-120 hours)

---

## Executive Summary

This document provides a complete implementation guide for converting Verified Vibe from a React prototype to a production-ready SvelteKit feature. The current implementation is a demo in `/static/verified-vibe/` with interactive screens but no backend integration. The refactor will:

1. **Convert React to Svelte** — Rewrite all components in Svelte for consistency with the rest of the app
2. **Add Backend Integration** — Connect to Supabase for user data, verification records, and matching
3. **Implement Claude Vision** — Use Claude API for ID extraction, liveness checks, and photo analysis
4. **Build Real Matching** — Replace demo data with real user matching logic
5. **Optimize for Mobile** — Ensure full responsiveness and touch-friendly UX
6. **Add Realtime Features** — Implement Supabase realtime for messages and online status

---

## Current State Analysis

### What Exists

**React Prototype** (`/static/verified-vibe/`)
- `app.jsx` — Main app component with phase/tab navigation
- `screens.jsx` — Screen components (Gate, Home, Verify, Verification, Discovery, Trust, Chat)
- `components.jsx` — Reusable components (buttons, cards, gauges, etc.)
- `verification.jsx` — Multi-step verification flow
- `tweaks-panel.jsx` — Development tweaks panel
- `data.js` — Mock data (archetypes, profiles, messages)
- `styles.css` — Complete design system with tokens
- `index.html` — React entry point

**Design System**
- Color palette (emerald, mint, lime, amber accents)
- Typography (Onest, JetBrains Mono, Instrument Serif)
- Components (buttons, cards, badges, gauges, etc.)
- Responsive design (mobile-first)

### What's Missing

- **Backend Integration** — No Supabase connection
- **Real Data** — All data is hardcoded demo data
- **Claude Integration** — No ID extraction, liveness checks, or photo analysis
- **User Authentication** — No user login/session management
- **Realtime Features** — No live messaging or online status
- **Error Handling** — Limited error handling
- **Mobile Optimization** — Some mobile issues (not fully tested)
- **Testing** — No unit/integration/E2E tests

---

## Implementation Strategy

### Phase 1: Foundation (Week 1)

**Goal:** Set up SvelteKit structure and design system.

1. **Create SvelteKit Routes**
   - `/src/routes/verified-vibe/` directory structure
   - Route files for each screen (gate, home, verify, verification, trust, discover, chat)
   - API routes for backend endpoints

2. **Set Up Design System**
   - Add Verified Vibe colors to Tailwind config
   - Create CSS custom properties for tokens
   - Create utility classes for common patterns

3. **Create Global State**
   - Define TypeScript types for all data models
   - Create SvelteKit stores for user, matches, messages, ui
   - Create constants for archetype data

4. **Implement Gate Screen**
   - Gender selection
   - Age confirmation
   - Navigation to home screen

### Phase 2: Onboarding (Week 1-2)

**Goal:** Implement archetype selection and verification requirements.

1. **Home Screen**
   - Archetype card display
   - Expandable card details
   - Live Now carousel
   - Lock-in button

2. **Verify Requirements Screen**
   - Step list display
   - Time estimates
   - Start verification button

3. **Components**
   - ArchetypeCard (collapsible)
   - LiveNowCarousel (scrolling)

### Phase 3: Verification (Week 2-3)

**Goal:** Implement multi-step verification with Claude integration.

1. **Verification Flow**
   - Step navigation (1/4, 2/4, 3/4, 4/4)
   - Progress bar
   - Error handling

2. **Claude Integration**
   - ID extraction (government ID photo)
   - Liveness check (selfie vs ID comparison)
   - Photo consistency check (5+ photos)
   - Q&A evaluation (women) or spending analysis (men)

3. **Supabase Integration**
   - Store verification records
   - Store photos in Supabase Storage
   - Calculate trust score

### Phase 4: Discovery & Matching (Week 3)

**Goal:** Implement card stack discovery and matching.

1. **Discovery Screen**
   - Card stack display
   - Swipe gestures (left/right)
   - Like/Pass buttons
   - Next card loading

2. **Matching Logic**
   - Check compatibility matrix
   - Create match records
   - Show match overlay

3. **Components**
   - DiscoveryCard (swipeable)
   - MatchOverlay

### Phase 5: Chat & Messaging (Week 3-4)

**Goal:** Implement messaging with realtime updates.

1. **Chat Screen**
   - Message display
   - Message input
   - Message history

2. **Realtime Features**
   - Supabase realtime subscriptions
   - Message updates
   - Online status
   - Typing indicator

3. **Components**
   - ChatMessage
   - MessageInput

### Phase 6: Trust Dashboard (Week 4)

**Goal:** Implement trust score visualization.

1. **Trust Dashboard**
   - User profile display
   - Trust score gauge
   - Category breakdown
   - Edit Q&A modal

2. **Components**
   - TrustGauge (radial/linear/arc)
   - ProfileCard
   - EditQAModal

### Phase 7: Mobile & Polish (Week 4)

**Goal:** Optimize for mobile and finalize.

1. **Mobile Responsiveness**
   - Test on all breakpoints
   - Fix responsive issues
   - Optimize touch targets

2. **Performance**
   - Image optimization
   - Code splitting
   - Lazy loading
   - Service worker

3. **Testing & QA**
   - Unit tests
   - Integration tests
   - E2E tests
   - Mobile testing

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account
- Anthropic API key (already configured)

### Step 1: Create Directory Structure

```bash
mkdir -p src/routes/verified-vibe/{gate,home,verify,verification,trust,discover,chat,api}
mkdir -p src/lib/verified-vibe/{components,server}
```

### Step 2: Create Base Files

**src/lib/verified-vibe/types.ts**
```typescript
export interface VerifiedVibeUser {
  id: string;
  gender: 'man' | 'woman' | 'prefer_not_to_say';
  archetype: string;
  firstName: string;
  age: number;
  city: string;
  avatar: string;
  about: string;
  looking: string;
  trustScore: number;
  createdAt: Date;
  updatedAt: Date;
}

// ... (see design.md for full types)
```

**src/lib/verified-vibe/stores.ts**
```typescript
import { writable } from 'svelte/store';
import type { VerifiedVibeUser, Match, Message } from './types';

export const user = writable<VerifiedVibeUser | null>(null);
export const matches = writable<Match[]>([]);
export const messages = writable<Message[]>([]);
export const currentPhase = writable<'gate' | 'home' | 'verify' | 'verification' | 'app'>('gate');
export const currentTab = writable<'discover' | 'trust' | 'chat'>('discover');
export const loading = writable(false);
export const error = writable<string | null>(null);
```

**src/lib/verified-vibe/constants.ts**
```typescript
export const ARCHETYPES = [
  {
    id: 'casual_man',
    gender: 'man',
    emoji: '🎯',
    name: 'Casual Man',
    tag: 'Casual dating & real connection',
    // ... (see data.js for full archetype data)
  },
  // ... (other archetypes)
];

export const MATCH_MATRIX = {
  casual_man: ['spoilt_woman'],
  marriage_minded_man: ['spoilt_woman', 'safety_first_woman'],
  spoilt_woman: ['casual_man', 'marriage_minded_man'],
  safety_first_woman: ['marriage_minded_man']
};
```

### Step 3: Create Gate Screen

**src/routes/verified-vibe/gate/+page.svelte**
```svelte
<script lang="ts">
  import { goto } from '$app/navigation';
  import { currentPhase } from '$lib/verified-vibe/stores';
  
  let gender = $state<'man' | 'woman' | 'prefer_not_to_say' | null>(null);
  let ageConfirmed = $state(false);
  
  function handleContinue() {
    if (!gender || !ageConfirmed) return;
    currentPhase.set('home');
    goto('/verified-vibe/home');
  }
</script>

<div class="gate">
  <!-- Hero section -->
  <div class="gate-hero">
    <div class="gate-eyebrow">
      <span class="pulse"></span>
      Live now
    </div>
    <h1 class="gate-title">Verified <em>Vibe</em></h1>
    <p class="gate-sub">Trust-first dating for people who are serious.</p>
  </div>
  
  <!-- Gender selection -->
  <div class="gate-q">
    <div class="gate-q-label">
      <div class="gate-q-num">01</div>
      <div class="gate-q-title">Who are you?</div>
    </div>
    <div class="gate-pick">
      <button
        class="gate-pick-btn {gender === 'man' ? 'selected' : ''}"
        onclick={() => gender = 'man'}
      >
        <div class="pick-ico">👨</div>
        <div class="pick-name">Man</div>
      </button>
      <button
        class="gate-pick-btn {gender === 'woman' ? 'selected' : ''}"
        onclick={() => gender = 'woman'}
      >
        <div class="pick-ico">👩</div>
        <div class="pick-name">Woman</div>
      </button>
    </div>
  </div>
  
  <!-- Age confirmation -->
  <div class="gate-q">
    <div class="gate-q-label">
      <div class="gate-q-num {ageConfirmed ? 'done' : ''}">02</div>
      <div class="gate-q-title">Age check</div>
    </div>
    <label class="gate-age {ageConfirmed ? 'checked' : ''}">
      <input
        type="checkbox"
        bind:checked={ageConfirmed}
        style="display: none;"
      />
      <div class="box">
        {#if ageConfirmed}✓{/if}
      </div>
      <div class="copy">
        <div class="l">I'm 18 or older</div>
        <div class="s">Required to use Verified Vibe</div>
      </div>
    </label>
  </div>
  
  <!-- CTA -->
  <div class="gate-cta">
    <button
      class="btn btn-primary full"
      disabled={!gender || !ageConfirmed}
      onclick={handleContinue}
    >
      Continue
    </button>
  </div>
</div>

<style>
  /* Use Tailwind classes + CSS custom properties from design.md */
</style>
```

### Step 4: Create API Endpoints

**src/routes/api/verified-vibe/register/+server.ts**
```typescript
import { json } from '@sveltekit/server';
import { getSupabase } from '$lib/verified-vibe/server/supabase';

export async function POST({ request }) {
  const { gender, archetype, firstName, age, city } = await request.json();
  
  const supabase = getSupabase();
  
  const { data, error } = await supabase
    .from('verified_vibe_users')
    .insert({
      gender,
      archetype,
      first_name: firstName,
      age,
      city,
      trust_score: 0
    })
    .select()
    .single();
  
  if (error) {
    return json({ error: error.message }, { status: 400 });
  }
  
  return json(data);
}
```

### Step 5: Set Up Supabase Tables

Run these SQL commands in Supabase SQL editor:

```sql
-- Users table
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

-- Verification table
CREATE TABLE verified_vibe_verification (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES verified_vibe_users(id),
  step TEXT NOT NULL CHECK (step IN ('id', 'liveness', 'photos', 'spending_or_qa')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
  data JSONB,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Matches table
CREATE TABLE verified_vibe_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id UUID NOT NULL REFERENCES verified_vibe_users(id),
  user2_id UUID NOT NULL REFERENCES verified_vibe_users(id),
  status TEXT NOT NULL CHECK (status IN ('pending', 'mutual', 'rejected')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Messages table
CREATE TABLE verified_vibe_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES verified_vibe_matches(id),
  sender_id UUID NOT NULL REFERENCES verified_vibe_users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Key Implementation Details

### Claude Vision Integration

```typescript
// src/lib/verified-vibe/server/verification.ts

import { askClaudeWithImage } from '$lib/claude';

export async function extractIDData(idPhotoBase64: string) {
  const response = await askClaudeWithImage(
    `Extract the following from this government ID:
     - ID number
     - Full name
     - Date of birth
     - Expiration date
     
     Return as JSON: { idNumber, name, dob, expirationDate }`,
    idPhotoBase64
  );
  
  return JSON.parse(response);
}

export async function checkLiveness(selfieBase64: string, idPhotoBase64: string) {
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

### Matching Algorithm

```typescript
// src/lib/verified-vibe/server/matching.ts

import { MATCH_MATRIX } from '$lib/verified-vibe/constants';

export function getCompatibleArchetypes(userArchetype: string): string[] {
  return MATCH_MATRIX[userArchetype] || [];
}

export async function findMatches(userId: string, userArchetype: string) {
  const compatibleArchetypes = getCompatibleArchetypes(userArchetype);
  
  const supabase = getSupabase();
  
  const { data, error } = await supabase
    .from('verified_vibe_users')
    .select('*')
    .in('archetype', compatibleArchetypes)
    .neq('id', userId)
    .gte('trust_score', 50)  // Only show verified users
    .limit(10);
  
  if (error) throw error;
  
  return data;
}
```

### Realtime Messages

```typescript
// src/lib/verified-vibe/components/ChatScreen.svelte

import { onMount } from 'svelte';
import { getSupabase } from '$lib/verified-vibe/server/supabase';
import { messages } from '$lib/verified-vibe/stores';

export let matchId: string;

onMount(() => {
  const supabase = getSupabase();
  
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
  
  return () => {
    supabase.removeChannel(channel);
  };
});
```

---

## Testing Strategy

### Unit Tests

```typescript
// src/lib/verified-vibe/__tests__/matching.test.ts

import { describe, it, expect } from 'vitest';
import { getCompatibleArchetypes } from '../server/matching';

describe('Matching', () => {
  it('should return compatible archetypes for casual_man', () => {
    const compatible = getCompatibleArchetypes('casual_man');
    expect(compatible).toContain('spoilt_woman');
  });
  
  it('should return compatible archetypes for marriage_minded_man', () => {
    const compatible = getCompatibleArchetypes('marriage_minded_man');
    expect(compatible).toContain('spoilt_woman');
    expect(compatible).toContain('safety_first_woman');
  });
});
```

### E2E Tests

```typescript
// tests/verified-vibe.e2e.ts

import { test, expect } from '@playwright/test';

test('Full Verified Vibe flow', async ({ page }) => {
  // Gate screen
  await page.goto('/verified-vibe');
  await page.click('button:has-text("Man")');
  await page.click('input[type="checkbox"]');
  await page.click('button:has-text("Continue")');
  
  // Home screen
  await expect(page).toHaveURL('/verified-vibe/home');
  await page.click('text=Casual Man');
  await page.click('button:has-text("Lock it in")');
  
  // Verify screen
  await expect(page).toHaveURL('/verified-vibe/verify');
  await page.click('button:has-text("Start Verification")');
  
  // Verification flow
  await expect(page).toHaveURL('/verified-vibe/verification');
  // ... (continue with verification steps)
});
```

---

## Deployment Checklist

- [ ] All routes created and tested
- [ ] All API endpoints working
- [ ] Supabase tables created and indexed
- [ ] Claude integration tested
- [ ] Realtime features working
- [ ] Mobile responsiveness verified
- [ ] Performance optimized (Lighthouse > 80)
- [ ] Error handling comprehensive
- [ ] Security audit passed
- [ ] Accessibility audit passed (WCAG 2.1 AA)
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] E2E tests passing
- [ ] Mobile testing on real devices
- [ ] Cross-browser testing
- [ ] Staging deployment successful
- [ ] Production deployment successful

---

## Rollback Plan

If issues arise in production:

1. **Immediate:** Revert to previous version (git rollback)
2. **Short-term:** Disable Verified Vibe feature flag
3. **Investigation:** Review logs, identify root cause
4. **Fix:** Deploy fix to staging, test thoroughly
5. **Redeploy:** Gradual rollout (10% → 50% → 100%)

---

## Success Metrics

**Week 1:**
- [ ] Gate, Home, Verify screens complete
- [ ] 100+ test users registered

**Week 2:**
- [ ] Verification flow complete
- [ ] 50%+ of users complete verification
- [ ] Trust score calculation working

**Week 3:**
- [ ] Discovery & matching working
- [ ] 30%+ of users make a match
- [ ] Chat working with realtime updates

**Week 4:**
- [ ] All features complete
- [ ] Mobile fully responsive
- [ ] Performance optimized
- [ ] 0 critical bugs
- [ ] > 90% user satisfaction

---

## Resources

- **Design System:** `/static/verified-vibe/styles.css`
- **Mock Data:** `/static/verified-vibe/data.js`
- **React Components:** `/static/verified-vibe/screens.jsx`, `components.jsx`
- **Spec Documents:** `.kiro/specs/verified-vibe-refactor/`
- **SvelteKit Docs:** https://kit.svelte.dev/
- **Supabase Docs:** https://supabase.com/docs
- **Claude API Docs:** https://docs.anthropic.com/

---

## Questions & Support

For questions or issues during implementation:

1. Check the spec documents (requirements.md, design.md, tasks.md)
2. Review the React prototype for UI/UX reference
3. Check SvelteKit and Supabase documentation
4. Reach out to the team for clarification

Good luck! 🚀

