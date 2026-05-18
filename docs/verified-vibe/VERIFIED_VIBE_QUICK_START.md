# Verified Vibe — Quick Start Guide

**TL;DR:** Convert React prototype to SvelteKit. 3-4 weeks. 100-120 hours. Full spec ready.

---

## 📋 What's Ready

✅ **Complete Specification**
- Requirements document (user stories, acceptance criteria)
- Design document (architecture, components, API endpoints)
- Task list (33 tasks, 7 phases, dependency graph)
- Implementation guide (code examples, setup instructions)

✅ **Design System**
- Color palette (emerald, mint, lime, amber)
- Typography (Onest, JetBrains Mono, Instrument Serif)
- Components (buttons, cards, gauges, etc.)
- Responsive design (mobile-first)

✅ **React Prototype**
- All screens implemented (Gate, Home, Verify, Verification, Discovery, Trust, Chat)
- Interactive flows
- Demo data
- Design tokens

---

## 🚀 Getting Started (30 minutes)

### 1. Read the Spec (10 min)
```bash
# Read in this order:
1. VERIFIED_VIBE_REFACTOR_SUMMARY.md (this gives you the overview)
2. .kiro/specs/verified-vibe-refactor/requirements.md (user stories)
3. .kiro/specs/verified-vibe-refactor/design.md (technical design)
4. .kiro/specs/verified-vibe-refactor/tasks.md (implementation tasks)
```

### 2. Set Up Development Environment (10 min)
```bash
# Install dependencies (already done)
npm install

# Create Supabase tables (see design.md for SQL)
# Run SQL in Supabase dashboard

# Verify Claude API is configured
echo $ANTHROPIC_API_KEY  # Should be set
```

### 3. Create Directory Structure (5 min)
```bash
mkdir -p src/routes/verified-vibe/{gate,home,verify,verification,trust,discover,chat,api}
mkdir -p src/lib/verified-vibe/{components,server}
```

### 4. Start with Phase 1 (Week 1)
- Task 1: SvelteKit setup & routing
- Task 2: Tailwind & design tokens
- Task 3: Global stores & types
- Task 4: Gate screen

---

## 📁 File Structure

```
src/routes/verified-vibe/
├── +layout.svelte                 # Main layout
├── +page.svelte                   # Entry point
├── gate/+page.svelte              # Gender + age
├── home/+page.svelte              # Archetype selection
├── verify/+page.svelte            # Requirements
├── verification/+page.svelte      # Multi-step verification
├── trust/+page.svelte             # Trust dashboard
├── discover/+page.svelte          # Card stack
├── chat/+page.svelte              # Messaging
└── api/
    ├── register/+server.ts
    ├── profile/+server.ts
    ├── verify-step/+server.ts
    ├── discover/+server.ts
    ├── like/+server.ts
    ├── message/+server.ts
    └── matches/+server.ts

src/lib/verified-vibe/
├── types.ts                       # TypeScript interfaces
├── stores.ts                      # Global state
├── constants.ts                   # Archetype data
├── utils.ts                       # Helper functions
├── components/
│   ├── ArchetypeCard.svelte
│   ├── VerificationStep.svelte
│   ├── TrustGauge.svelte
│   ├── ProfileCard.svelte
│   ├── DiscoveryCard.svelte
│   ├── ChatMessage.svelte
│   ├── BottomNav.svelte
│   ├── LiveNowCarousel.svelte
│   └── MatchOverlay.svelte
└── server/
    ├── verification.ts            # Claude integration
    ├── matching.ts                # Matching logic
    └── supabase.ts                # Supabase helpers
```

---

## 🎯 Key Decisions

### Architecture
- **Frontend:** SvelteKit (consistent with existing app)
- **Backend:** Supabase (already integrated)
- **AI:** Claude vision for verification
- **Realtime:** Supabase realtime subscriptions

### Data Model
- **Users:** Gender, archetype, profile info, trust score
- **Verification:** Multi-step records (ID, liveness, photos, spending/Q&A)
- **Matches:** Compatibility-based matching
- **Messages:** Realtime chat

### Verification Flow
1. ID extraction (Claude vision)
2. Liveness check (selfie vs ID)
3. Photo consistency (5+ photos)
4. Spending (men) or Q&A (women)

### Trust Score
- Identity: 30 pts (ID, liveness, face match)
- Lifestyle: 45 pts (photos, consistency, grooming)
- Intent: 20 pts (Q&A, archetype clarity)
- Total: 0-100 pts

---

## 📊 Timeline

| Week | Phase | Hours | Deliverables |
|---|---|---|---|
| 1 | Foundation + Onboarding | 27 | Gate, Home, Verify screens |
| 2 | Verification | 22 | Multi-step verification flow |
| 3 | Discovery + Chat | 32 | Discovery, Matching, Chat |
| 4 | Polish + Testing | 19 | Mobile, Performance, Testing |
| **Total** | **7 phases** | **100-120** | **Production-ready feature** |

---

## 🔧 Implementation Checklist

### Phase 1: Foundation (Week 1)
- [ ] Create SvelteKit routes
- [ ] Set up Tailwind design tokens
- [ ] Create global stores & types
- [ ] Implement gate screen
- [ ] Test all routes load

### Phase 2: Onboarding (Week 1-2)
- [ ] Implement home screen
- [ ] Create ArchetypeCard component
- [ ] Implement verify requirements screen
- [ ] Create LiveNowCarousel component
- [ ] Test archetype selection flow

### Phase 3: Verification (Week 2-3)
- [ ] Set up verification flow
- [ ] Implement ID extraction (Claude)
- [ ] Implement liveness check (Claude)
- [ ] Implement photo upload & consistency
- [ ] Implement spending/Q&A step
- [ ] Calculate trust score
- [ ] Test all verification steps

### Phase 4: Discovery (Week 3)
- [ ] Implement discovery screen
- [ ] Create DiscoveryCard component
- [ ] Implement swipe gestures
- [ ] Implement like/pass logic
- [ ] Create match overlay
- [ ] Test discovery flow

### Phase 5: Chat (Week 3-4)
- [ ] Implement chat screen
- [ ] Create ChatMessage component
- [ ] Implement message sending
- [ ] Set up realtime messages
- [ ] Implement online status
- [ ] Test chat flow

### Phase 6: Trust Dashboard (Week 4)
- [ ] Implement trust dashboard
- [ ] Create TrustGauge component
- [ ] Create ProfileCard component
- [ ] Implement edit Q&A modal
- [ ] Test trust dashboard

### Phase 7: Polish (Week 4)
- [ ] Mobile responsiveness
- [ ] Bottom navigation
- [ ] Performance optimization
- [ ] Error handling
- [ ] Testing & QA
- [ ] Deployment

---

## 💡 Key Code Patterns

### Store Usage
```typescript
import { user, matches, messages } from '$lib/verified-vibe/stores';

// Subscribe to store
const unsubscribe = user.subscribe(value => {
  console.log('User:', value);
});

// Update store
user.set(newUser);
user.update(u => ({ ...u, trustScore: 75 }));
```

### API Endpoint
```typescript
// src/routes/api/verified-vibe/register/+server.ts
import { json } from '@sveltekit/server';

export async function POST({ request }) {
  const data = await request.json();
  // Process data
  return json(result);
}
```

### Component
```svelte
<script lang="ts">
  import type { VerifiedVibeUser } from '$lib/verified-vibe/types';
  
  export let user: VerifiedVibeUser;
  
  let expanded = $state(false);
</script>

<div class="card" onclick={() => expanded = !expanded}>
  {#if expanded}
    <!-- Expanded view -->
  {:else}
    <!-- Collapsed view -->
  {/if}
</div>
```

### Claude Integration
```typescript
import { askClaudeWithImage } from '$lib/claude';

const response = await askClaudeWithImage(
  'Extract ID data from this image',
  base64Image
);
```

### Supabase Query
```typescript
import { getSupabase } from '$lib/verified-vibe/server/supabase';

const supabase = getSupabase();
const { data, error } = await supabase
  .from('verified_vibe_users')
  .select('*')
  .eq('id', userId);
```

---

## 🧪 Testing

### Unit Tests
```bash
npm run test -- src/lib/verified-vibe/__tests__/
```

### Integration Tests
```bash
npm run test -- src/routes/api/verified-vibe/__tests__/
```

### E2E Tests
```bash
npm run test:e2e
```

### Manual Testing
1. Test on mobile (375px)
2. Test on tablet (768px)
3. Test on desktop (1024px)
4. Test all user flows
5. Test error scenarios

---

## 🚢 Deployment

### Staging
```bash
npm run build
npm run preview
# Test on staging environment
```

### Production
```bash
# Gradual rollout
# 10% → 50% → 100%
# Monitor error rates and performance
```

### Rollback
```bash
# If issues arise
git revert <commit>
npm run build
npm run deploy
```

---

## 📚 Reference Documents

| Document | Purpose |
|---|---|
| `VERIFIED_VIBE_REFACTOR_SUMMARY.md` | Executive summary (this file) |
| `VERIFIED_VIBE_IMPLEMENTATION_GUIDE.md` | Detailed implementation guide |
| `.kiro/specs/verified-vibe-refactor/requirements.md` | User stories & acceptance criteria |
| `.kiro/specs/verified-vibe-refactor/design.md` | Technical architecture & design |
| `.kiro/specs/verified-vibe-refactor/tasks.md` | Implementation tasks & timeline |
| `/static/verified-vibe/` | React prototype (reference) |

---

## ❓ FAQ

**Q: Can I start with a different phase?**  
A: No, phases have dependencies. Start with Phase 1 (Foundation).

**Q: How long does each phase take?**  
A: Phase 1: 13 hrs, Phase 2: 14 hrs, Phase 3: 22 hrs, Phase 4: 16 hrs, Phase 5: 16 hrs, Phase 6: 13 hrs, Phase 7: 19 hrs.

**Q: Can I work on multiple phases in parallel?**  
A: Only if you have multiple developers. Single developer should follow phases sequentially.

**Q: What if I get stuck?**  
A: Check the spec documents, review the React prototype, check SvelteKit/Supabase docs, reach out to the team.

**Q: How do I test Claude integration?**  
A: Use test images, verify API responses, check token usage, test error scenarios.

**Q: How do I handle errors?**  
A: Implement error boundaries, show user-friendly messages, log errors, implement retry logic.

**Q: How do I optimize performance?**  
A: Lazy load images, code splitting, caching, service worker, optimize bundle size.

---

## 🎯 Success Criteria

- [ ] All 33 tasks completed
- [ ] All tests passing
- [ ] Lighthouse score > 80
- [ ] Mobile fully responsive
- [ ] 0 critical bugs
- [ ] > 90% user satisfaction
- [ ] < 2s page load time
- [ ] 99.9% uptime

---

## 🚀 Ready to Start?

1. **Read the spec** (30 min)
2. **Set up environment** (30 min)
3. **Start Phase 1** (Week 1)
4. **Follow the task list** (tasks.md)
5. **Deploy to production** (Week 4)

Good luck! 💪

