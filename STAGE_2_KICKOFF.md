# Stage 2 Kickoff — AI Photo Generation

## Questions Before We Start

### 1. FAL_KEY Configuration
- [ ] Do you have your FAL_KEY ready?
- [ ] Should I add it to `.env.local` now, or do you want to run the setup script yourself?
- [ ] Do you want to test with a small quota first, or go full speed?

### 2. Scene Prompts & Archetypes
For the AI photo generation, we need to define scenes for each archetype. Currently we have:

**Casual Man** (5 scenes):
- Lead: confident man, casual smart outfit, natural window light
- Warmth: cozy coffee shop, warm morning light
- Lifestyle: outdoors on weekend, natural daylight
- Conversation: casual dinner or bar setting, soft warm evening lighting
- Social: rooftop or outdoor terrace, golden hour lighting

**Marriage-Minded Man** (5 scenes):
- Lead: polished man, smart casual outfit, natural window light, warm tones
- Warmth: warm home environment, natural light, relaxed and comfortable
- Lifestyle: active outdoors on hike or park, natural daylight
- Conversation: upscale restaurant, refined setting, warm candlelight
- Social: scenic travel destination, natural light, beautiful background

**Questions:**
- [ ] Do these scenes feel right for the archetypes?
- [ ] Should we adjust any prompts?
- [ ] Any specific scenes you want to add/remove?

### 3. Generation Settings
Current settings for FLUX PuLID:
- `num_inference_steps`: 20 (affects quality & speed)
- `guidance_scale`: 4 (how closely to follow prompt)
- `id_weight`: 1.0 (how strongly to preserve face features)
- `num_images`: 1 per scene (5 total)

**Questions:**
- [ ] Should we increase inference steps for better quality? (20→30 = slower but better)
- [ ] Should we adjust guidance scale? (4 is balanced, higher = more prompt-focused)
- [ ] Should we adjust id_weight? (1.0 is default, higher = more face consistency)

### 4. Error Handling & Retries
Current behavior:
- If a photo fails to generate, it's skipped
- User sees error message with count (e.g., "4 photos generated, 1 failed")
- User can click "Regenerate" to try again

**Questions:**
- [ ] Should we retry failed photos automatically?
- [ ] How many retries? (1, 2, 3?)
- [ ] Should we show retry progress to user?

### 5. Performance & Caching
Current behavior:
- Each generation takes ~25-30 seconds (5 photos in parallel)
- Generated photos are stored in localStorage
- No caching between users

**Questions:**
- [ ] Is 25-30 seconds acceptable, or should we optimize?
- [ ] Should we cache generated photos per user?
- [ ] Should we add a "Regenerate" button to try different styles?

### 6. UI/UX Polish
Current UI:
- "Enhance with AI" button (purple gradient)
- Loading spinner with "Generating AI photos… (~30s)"
- Error message if generation fails
- "Regenerate photos" button after success

**Questions:**
- [ ] Should we add a progress indicator (1/5, 2/5, etc.)?
- [ ] Should we show a loading skeleton for each photo slot?
- [ ] Should we add a "Try different style" option?
- [ ] Any other UI improvements?

### 7. Testing Strategy
**Questions:**
- [ ] Should we test with 1 photo first, then scale to 5?
- [ ] Should we test with different photo types (selfie, full body, etc.)?
- [ ] Should we test with different archetypes?
- [ ] Should we test error scenarios (network down, API limit, etc.)?

### 8. Deployment & Monitoring
**Questions:**
- [ ] Should we add logging to track generation success rate?
- [ ] Should we track generation time?
- [ ] Should we track user satisfaction (ratings)?
- [ ] Any monitoring/alerting you want?

---

## My Recommendations

### Scene Prompts
✅ Current prompts look good. I'd suggest:
- Keep them as-is for now
- Test with real users
- Iterate based on feedback

### Generation Settings
✅ I recommend:
- `num_inference_steps`: 20 (good balance of speed & quality)
- `guidance_scale`: 4 (balanced)
- `id_weight`: 1.0 (default, good face consistency)

### Error Handling
✅ I recommend:
- Retry failed photos 1 time automatically
- Show user count of successful photos
- Allow manual regenerate

### Performance
✅ I recommend:
- 25-30 seconds is acceptable for MVP
- Add caching per user (localStorage)
- Add "Regenerate" button for different styles

### UI/UX
✅ I recommend:
- Add progress indicator (1/5, 2/5, etc.)
- Add loading skeleton for each photo slot
- Keep "Regenerate" button simple

### Testing
✅ I recommend:
- Test with 1 photo first
- Test with different archetypes
- Test error scenarios
- Get user feedback

### Deployment
✅ I recommend:
- Add basic logging (success rate, time)
- Track generation time
- Monitor for API errors

---

## Next Steps

Once you answer these questions, I'll:

1. **Setup & Configuration** (30 min)
   - Add FAL_KEY to `.env.local`
   - Verify API connection works

2. **Testing** (1-2 hours)
   - Test with real photos
   - Verify generation works
   - Check quality of generated photos

3. **Optimization** (2-4 hours)
   - Tune scene prompts if needed
   - Add retry logic
   - Optimize performance

4. **UI Polish** (1-2 hours)
   - Add progress indicator
   - Add loading skeleton
   - Improve error messages

5. **Testing & Commit** (1-2 hours)
   - Full end-to-end testing
   - Commit to main

**Total: 1-2 weeks**

---

## Ready?

Please answer the questions above, and I'll get started on Stage 2! 🚀
