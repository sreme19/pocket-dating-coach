# Stages 2, 3, 4 Roadmap — Pocket Dating Coach

## Overview

After Stage 1 (male profile onboarding), here's what comes next:

```
Stage 1 ✅ COMPLETE
  ↓
Stage 2 — AI Photo Generation (1-2 weeks)
  ↓
Stage 3 — Discovery & Matching (2-3 weeks)
  ↓
Stage 4 — Female Profile Flow (1-2 weeks)
  ↓
Stage 5 — Polish & Launch (1 week)
```

---

## Stage 2: AI Photo Generation

**Goal:** Generate AI-enhanced photos of users in different scenes using their uploaded photos as reference.

### What's Already Built
- ✅ `src/lib/photo-enhance/` module (types, scenes, index)
- ✅ `src/routes/api/photo-enhance/generate/+server.ts` endpoint
- ✅ Profile page has "Enhance with AI" button
- ✅ FAL_KEY setup scripts

### What Needs to Be Done

#### 2A: Test fal.ai Integration (1-2 days)
- [ ] Get FAL_KEY from fal.ai (free tier available)
- [ ] Run `npm run setup:fal` to configure
- [ ] Test the `/api/photo-enhance/generate` endpoint
- [ ] Verify FLUX PuLID model works with reference photos
- [ ] Test error handling (network, API limits, etc.)

**Test checklist:**
- [ ] Upload real photo in step 3
- [ ] Click "Enhance with AI" on profile page
- [ ] Wait ~30 seconds for generation
- [ ] Verify 5 AI photos appear in grid
- [ ] Each photo shows ✨ badge
- [ ] Photos are different scenes (lead, warmth, lifestyle, etc.)

#### 2B: Optimize Photo Generation (1-2 days)
- [ ] Tune scene prompts for better results
- [ ] Adjust inference steps and guidance scale
- [ ] Test with different archetypes (casual vs marriage-minded)
- [ ] Add retry logic for failed generations
- [ ] Cache generated photos to avoid re-generation

**Deliverables:**
- [ ] Scene prompts optimized per archetype
- [ ] Retry logic for failed photos
- [ ] Performance metrics (generation time, success rate)

#### 2C: UI Polish (1 day)
- [ ] Add loading skeleton for photo grid
- [ ] Improve error messages
- [ ] Add "Regenerate" button to try different styles
- [ ] Show generation progress (1/5, 2/5, etc.)

**Deliverables:**
- [ ] Better UX during generation
- [ ] Clear feedback on success/failure

### Success Criteria
- [ ] Users can generate 5 AI photos from 1 reference photo
- [ ] Photos are face-consistent and high quality
- [ ] Generation completes in <60 seconds
- [ ] Error handling is robust
- [ ] UI is polished and responsive

### Estimated Time: 1-2 weeks

---

## Stage 3: Discovery & Matching

**Goal:** Build the core matching algorithm and discovery feed so users can find and connect with matches.

### What's Already Built
- ✅ Discovery feed UI (card stack, swipe actions)
- ✅ Mock profiles in discovery
- ✅ Chat interface
- ✅ Like/reject/match logic (partial)

### What Needs to Be Done

#### 3A: Profile Storage & Retrieval (2-3 days)
- [ ] Move profiles from localStorage to Supabase
- [ ] Create `profiles` table with schema:
  ```sql
  id, user_id, gender, archetype, firstName, age, city,
  about, personalityDescriptors, intentStatement, lifestyleTags,
  photoUrls, trustScore, createdAt, updatedAt
  ```
- [ ] Create API endpoint to fetch user's own profile
- [ ] Create API endpoint to fetch other users' profiles

**Deliverables:**
- [ ] Supabase schema
- [ ] Profile CRUD endpoints
- [ ] RLS policies for privacy

#### 3B: Matching Algorithm (3-5 days)
- [ ] Define compatibility scoring:
  - Archetype compatibility (casual_man ↔ spoilt_woman, etc.)
  - Age range preferences
  - City proximity (or remote preference)
  - Personality alignment (shared traits)
  - Intent alignment (both looking for same thing)
- [ ] Build scoring function
- [ ] Create `/api/verified-vibe/calculate-compatibility` endpoint
- [ ] Test with sample profiles

**Deliverables:**
- [ ] Compatibility algorithm (0-100 score)
- [ ] API endpoint
- [ ] Test results showing good matches

#### 3C: Discovery Feed (2-3 days)
- [ ] Replace mock profiles with real profiles from Supabase
- [ ] Fetch profiles sorted by compatibility score
- [ ] Implement pagination/infinite scroll
- [ ] Add filters (age, distance, archetype)
- [ ] Cache profiles locally for performance

**Deliverables:**
- [ ] Real discovery feed
- [ ] Filters working
- [ ] Performance optimized

#### 3D: Like/Match/Reject Flow (2-3 days)
- [ ] Create `likes` table (user_id, liked_user_id, direction, createdAt)
- [ ] Create `matches` table (user1_id, user2_id, matchedAt)
- [ ] Implement like logic (one-way)
- [ ] Implement mutual match detection (both liked each other)
- [ ] Send notifications on match
- [ ] Create `/api/verified-vibe/like` endpoint

**Deliverables:**
- [ ] Like/match system working
- [ ] Notifications on match
- [ ] Match history visible

#### 3E: Chat Integration (2-3 days)
- [ ] Create `messages` table (match_id, sender_id, content, createdAt)
- [ ] Implement real-time messaging (Supabase Realtime)
- [ ] Show unread message count
- [ ] Mark messages as read
- [ ] Create `/api/verified-vibe/message` endpoint

**Deliverables:**
- [ ] Chat working between matched users
- [ ] Real-time updates
- [ ] Unread indicators

### Success Criteria
- [ ] Users see real profiles in discovery (not mock)
- [ ] Compatibility scoring works
- [ ] Like/match system works
- [ ] Chat works between matches
- [ ] Performance is good (< 2s page load)

### Estimated Time: 2-3 weeks

---

## Stage 4: Female Profile Flow

**Goal:** Build the female onboarding flow (different verification steps, different archetypes).

### What's Already Built
- ✅ Gate page supports gender selection
- ✅ Home page supports female archetypes (Spoilt, Safety-First)
- ✅ Verification flow has Q&A step for women
- ✅ Profile page works for all genders

### What Needs to Be Done

#### 4A: Female Verification Steps (2-3 days)
- [ ] Verify steps 1-3 work for women (ID, liveness, photos)
- [ ] Verify step 4 Q&A works (currently has placeholder questions)
- [ ] Add real Q&A questions for women:
  - "What's your ideal first date?"
  - "What are your relationship goals?"
  - "What's important to you in a partner?"
  - "What's your biggest turn-off?"
  - etc.
- [ ] Verify step 5 (profile intake) works for women

**Deliverables:**
- [ ] Female verification flow complete
- [ ] Q&A questions finalized
- [ ] All steps tested

#### 4B: Female Profile Synthesis (1-2 days)
- [ ] Adjust Claude prompt for female profiles
- [ ] Test profile generation for women
- [ ] Verify personality descriptors are appropriate
- [ ] Verify lifestyle tags are appropriate

**Deliverables:**
- [ ] Female profiles generated correctly
- [ ] Prompt tuned for female archetypes

#### 4C: Female Discovery (1-2 days)
- [ ] Verify female users see male profiles
- [ ] Verify male users see female profiles
- [ ] Test matching between genders
- [ ] Verify archetype compatibility works

**Deliverables:**
- [ ] Cross-gender discovery working
- [ ] Matching works between genders

#### 4D: Testing & Polish (1-2 days)
- [ ] End-to-end test: female user flow
- [ ] Test matching between male and female users
- [ ] Test chat between matched users
- [ ] Polish UI for female archetypes

**Deliverables:**
- [ ] Female flow fully tested
- [ ] All edge cases handled

### Success Criteria
- [ ] Female users can complete verification
- [ ] Female profiles are generated correctly
- [ ] Female users can discover and match with male users
- [ ] Chat works between matched users

### Estimated Time: 1-2 weeks

---

## Stage 5: Polish & Launch

**Goal:** Final polish, performance optimization, and launch readiness.

### What Needs to Be Done

#### 5A: Performance Optimization (2-3 days)
- [ ] Optimize image loading (lazy load, compression)
- [ ] Optimize API queries (add indexes, pagination)
- [ ] Optimize bundle size
- [ ] Add caching strategies
- [ ] Monitor performance metrics

#### 5B: Security & Privacy (2-3 days)
- [ ] Audit RLS policies
- [ ] Verify user data is private
- [ ] Add rate limiting to APIs
- [ ] Verify photo storage is secure
- [ ] Add GDPR compliance (data export, deletion)

#### 5C: Testing & QA (3-5 days)
- [ ] Full end-to-end testing
- [ ] Cross-browser testing
- [ ] Mobile testing
- [ ] Load testing
- [ ] Security testing

#### 5D: Documentation & Deployment (2-3 days)
- [ ] Write deployment guide
- [ ] Document API endpoints
- [ ] Document database schema
- [ ] Create admin dashboard (optional)
- [ ] Deploy to production

#### 5E: Launch & Monitoring (1-2 days)
- [ ] Deploy to production
- [ ] Monitor for errors
- [ ] Gather user feedback
- [ ] Fix critical bugs

### Success Criteria
- [ ] App is performant (< 2s page load)
- [ ] App is secure (no data leaks)
- [ ] App is tested (no critical bugs)
- [ ] App is documented
- [ ] App is deployed and live

### Estimated Time: 1 week

---

## Timeline Summary

| Stage | Duration | Status |
|-------|----------|--------|
| Stage 1 | 2-2.5 hours | ✅ COMPLETE |
| Stage 2 | 1-2 weeks | ⏳ NEXT |
| Stage 3 | 2-3 weeks | 📋 PLANNED |
| Stage 4 | 1-2 weeks | 📋 PLANNED |
| Stage 5 | 1 week | 📋 PLANNED |
| **Total** | **~8-10 weeks** | |

---

## Immediate Next Steps (Stage 2)

### Week 1: AI Photo Generation
1. **Day 1-2:** Get FAL_KEY, test fal.ai integration
2. **Day 3-4:** Optimize scene prompts, add retry logic
3. **Day 5:** UI polish, loading states

### Deliverables
- [ ] Users can generate 5 AI photos from 1 reference
- [ ] Photos are face-consistent and high quality
- [ ] Generation completes in <60 seconds
- [ ] Error handling is robust

### Success Metrics
- [ ] 90%+ generation success rate
- [ ] Average generation time < 45 seconds
- [ ] User satisfaction > 4/5 stars

---

## Key Decisions for Stages 2-5

### Database Strategy
- **Stage 1:** localStorage only (dev-friendly)
- **Stage 2:** Still localStorage (photos are local)
- **Stage 3+:** Move to Supabase (profiles, matches, messages)

### Matching Algorithm
- Simple compatibility score (0-100)
- Based on: archetype, age, city, personality, intent
- Can be improved later with ML

### Real-time Features
- Use Supabase Realtime for chat
- Polling for discovery feed (simpler than WebSocket)
- Can upgrade to WebSocket later

### Scaling Considerations
- Supabase handles up to 100k concurrent users
- Image storage: use Supabase Storage or S3
- Consider CDN for photo delivery
- Add caching layer (Redis) if needed

---

## Questions Before Starting Stage 2

1. **FAL_KEY:** Do you have a fal.ai account? (Free tier available)
2. **Supabase:** Ready to move profiles to Supabase in Stage 3?
3. **Timeline:** Want to build all stages, or focus on Stage 2 first?
4. **Priorities:** What's most important?
   - Photo quality (Stage 2)
   - Matching algorithm (Stage 3)
   - Female flow (Stage 4)
   - Launch readiness (Stage 5)

---

## Ready for Stage 2?

Stage 2 is the most straightforward next step:
- ✅ Code is already written
- ✅ Just needs testing and tuning
- ✅ No database changes needed
- ✅ Can be done in 1-2 weeks

**Recommendation:** Start Stage 2 immediately. It's a quick win that makes the app much more impressive.

Let me know when you're ready to begin! 🚀
