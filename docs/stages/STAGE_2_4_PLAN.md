# Stage 2 & 4 Implementation Plan

## Overview

You want to build:
1. **Stage 2:** AI Photo Generation (1-2 weeks)
2. **Stage 4:** Female Profile Flow (1-2 weeks)

Then move to Stage 3 (Discovery & Matching) later.

---

## Stage 2: AI Photo Generation

### Current Status
- ✅ Photo enhancement module exists (`src/lib/photo-enhance/`)
- ✅ API endpoint exists (`/api/photo-enhance/generate`)
- ✅ Profile page has "Enhance with AI" button
- ✅ FAL_KEY setup scripts exist

### What Needs to Be Done

#### 2A: Setup & Testing (1-2 days)
1. Add FAL_KEY to `.env.local`
2. Test API connection to fal.ai
3. Test generation with real photos
4. Verify quality of generated photos

#### 2B: Optimization (1-2 days)
1. Tune scene prompts if needed
2. Add retry logic for failed photos
3. Optimize performance (parallel generation)
4. Add caching per user

#### 2C: UI Polish (1 day)
1. Add progress indicator (1/5, 2/5, etc.)
2. Add loading skeleton for photo slots
3. Improve error messages
4. Add "Regenerate" button for different styles

#### 2D: Testing & Commit (1-2 days)
1. Full end-to-end testing
2. Test with different archetypes
3. Test error scenarios
4. Commit to main

### Success Criteria
- [ ] Users can generate 5 AI photos from 1 reference photo
- [ ] Photos are face-consistent and high quality
- [ ] Generation completes in <60 seconds
- [ ] Error handling is robust
- [ ] UI is polished and responsive

### Estimated Time: 1-2 weeks

---

## Stage 4: Female Profile Flow

### Current Status
- ✅ Gate supports gender selection
- ✅ Home supports female archetypes (Spoilt, Safety-First)
- ✅ Verification has Q&A step for women
- ✅ Profile page works for all genders

### What Needs to Be Done

#### 4A: Female Verification Steps (1-2 days)
1. Verify steps 1-3 work for women (ID, liveness, photos)
2. Finalize Q&A questions for women
3. Test Q&A verification
4. Verify step 5 (profile intake) works for women

#### 4B: Female Profile Synthesis (1 day)
1. Adjust Claude prompt for female profiles
2. Test profile generation for women
3. Verify personality descriptors are appropriate
4. Verify lifestyle tags are appropriate

#### 4C: Female Discovery (1 day)
1. Verify female users see male profiles
2. Verify male users see female profiles
3. Test matching between genders
4. Verify archetype compatibility works

#### 4D: Testing & Polish (1-2 days)
1. End-to-end test: female user flow
2. Test matching between male and female users
3. Test chat between matched users
4. Polish UI for female archetypes

### Success Criteria
- [ ] Female users can complete verification
- [ ] Female profiles are generated correctly
- [ ] Female users can discover and match with male users
- [ ] Chat works between matched users

### Estimated Time: 1-2 weeks

---

## Questions I Need Answered

### For Stage 2

1. **FAL_KEY Setup**
   - Do you have your FAL_KEY ready?
   - Should I add it to `.env.local`, or do you want to run setup script?
   - Any quota limits I should know about?

2. **Scene Prompts**
   - Do the current scenes feel right?
   - Any adjustments needed?

3. **Generation Settings**
   - Should we increase inference steps for better quality? (20→30)
   - Any adjustments to guidance_scale or id_weight?

4. **Error Handling**
   - Should we retry failed photos automatically?
   - How many retries? (1, 2, 3?)

5. **Performance**
   - Is 25-30 seconds acceptable for generation?
   - Should we add progress indicator?
   - Should we add loading skeleton?

6. **Testing Approach**
   - Test with 1 photo first, then scale to 5?
   - Test with different archetypes?
   - Test error scenarios?

### For Stage 4

1. **Q&A Questions for Women**
   - What questions should we ask women during verification?
   - Should we use the same questions for all female archetypes, or different ones?
   - Any specific topics you want to cover?

2. **Female Archetypes**
   - Spoilt Woman: What should her profile look like?
   - Safety-First Woman: What should her profile look like?
   - Any specific personality descriptors or lifestyle tags?

3. **Cross-Gender Matching**
   - How should we match male and female users?
   - Should Casual Man match with Spoilt Woman?
   - Should Marriage-Minded Man match with Safety-First Woman?
   - Any other archetype combinations?

4. **Testing Approach**
   - Should we test with real female users, or mock data?
   - Should we test all archetype combinations?
   - Should we test error scenarios?

---

## My Recommendations

### Stage 2
- ✅ Keep scene prompts as-is for now, iterate based on feedback
- ✅ Use current generation settings (20 steps, 4 guidance, 1.0 id_weight)
- ✅ Retry failed photos 1 time automatically
- ✅ Add progress indicator and loading skeleton
- ✅ Test with 1 photo first, then scale to 5

### Stage 4
- ✅ Use same Q&A questions for all female archetypes (can customize later)
- ✅ Adjust Claude prompt for female profiles (more emphasis on personality)
- ✅ Match based on archetype compatibility (Casual ↔ Spoilt, Marriage-Minded ↔ Safety-First)
- ✅ Test with mock data first, then real users

---

## Timeline

### Stage 2: 1-2 weeks
- Week 1: Setup, testing, optimization
- Week 2: UI polish, final testing, commit

### Stage 4: 1-2 weeks
- Week 1: Verification, profile synthesis, discovery
- Week 2: Testing, polish, commit

### Total: 2-4 weeks

---

## Next Steps

1. **Answer the questions above**
2. **I'll start Stage 2 immediately**
3. **We'll test and iterate**
4. **Commit when ready**
5. **Move to Stage 4**
6. **Then Stage 3 (Discovery & Matching)**

---

## Ready?

Please provide:
1. Your FAL_KEY (or confirm I should use setup script)
2. Answers to the Stage 2 questions
3. Answers to the Stage 4 questions

Then I'll get started! 🚀
