# Questions to Answer — Stage 2 & 4

Your FAL_KEY is now configured in `.env.local`. 

Now please answer these questions so I can proceed with Stage 2 and Stage 4.

---

## STAGE 2: AI Photo Generation

### Question 1: Scene Prompts
**Current scenes for Casual Man:**
- Lead: confident man, casual smart outfit, natural window light, shallow depth of field, clean background, genuine relaxed expression, portrait style
- Warmth: man in a cozy coffee shop, warm morning light, casual outfit, genuine smile, looking at camera, soft bokeh background
- Lifestyle: man outdoors on a weekend, natural daylight, relaxed and confident, park or city street, candid feel
- Conversation: man at a casual dinner or bar setting, soft warm evening lighting, relaxed expression, social atmosphere
- Social: man on a rooftop or outdoor terrace, golden hour lighting, city skyline background, confident and relaxed

**Current scenes for Marriage-Minded Man:**
- Lead: polished man, smart casual outfit, natural window light, warm tones, genuine confident expression, portrait style
- Warmth: man in a warm home environment, natural light, relaxed and comfortable, genuine smile, inviting atmosphere
- Lifestyle: man outdoors on a weekend hike or park, natural daylight, healthy and energetic, candid feel
- Conversation: man at an upscale restaurant, refined setting, warm candlelight, engaged and present expression
- Social: man at a scenic travel destination, natural light, confident and curious expression, beautiful background

**Your answer:**
- [ ] These scenes look good, keep as-is
- [ ] Adjust some scenes (please specify which ones and how)
- [ ] Replace some scenes (please specify which ones and with what)

---

### Question 2: Generation Settings
**Current settings:**
- `num_inference_steps`: 20 (affects quality & speed)
- `guidance_scale`: 4 (how closely to follow prompt)
- `id_weight`: 1.0 (how strongly to preserve face features)

**Your answer:**
- [ ] Keep current settings (20 steps, 4 guidance, 1.0 id_weight)
- [ ] Increase steps for better quality (20→30)
- [ ] Adjust guidance_scale (current: 4, range: 1-10)
- [ ] Adjust id_weight (current: 1.0, range: 0.5-2.0)

---

### Question 3: Error Handling & Retries
**Current behavior:**
- If a photo fails to generate, it's skipped
- User sees error message with count (e.g., "4 photos generated, 1 failed")
- User can click "Regenerate" to try again

**Your answer:**
- [ ] Retry failed photos automatically (1 time)
- [ ] Retry failed photos automatically (2 times)
- [ ] Retry failed photos automatically (3 times)
- [ ] Don't retry, just show error

---

### Question 4: Performance & UI
**Current behavior:**
- Generation takes ~25-30 seconds (5 photos in parallel)
- Shows "Generating AI photos… (~30s)" with spinner
- No progress indicator

**Your answer:**
- [ ] Add progress indicator (1/5, 2/5, etc.)
- [ ] Add loading skeleton for each photo slot
- [ ] Add both progress indicator and loading skeleton
- [ ] Keep current UI as-is

---

### Question 5: Testing Approach
**Your answer:**
- [ ] Test with 1 photo first, then scale to 5
- [ ] Test with different archetypes (casual vs marriage-minded)
- [ ] Test error scenarios (network down, API limit, etc.)
- [ ] Do all of the above

---

## STAGE 4: Female Profile Flow

### Question 6: Q&A Questions for Women
**Current Q&A questions (placeholder):**
- "What's your ideal first date?"
- "What are your relationship goals?"
- "What's important to you in a partner?"
- "What's your biggest turn-off?"

**Your answer:**
- [ ] Use these questions as-is
- [ ] Replace with different questions (please specify)
- [ ] Use same questions for all female archetypes
- [ ] Use different questions per archetype (please specify)

---

### Question 7: Female Archetypes
**Current archetypes:**
- **Spoilt Woman:** Expects luxury, high standards, wants to be treated well
- **Safety-First Woman:** Prioritizes security, stability, wants genuine connection

**Your answer:**
- [ ] These archetypes are good, keep as-is
- [ ] Adjust archetype definitions (please specify)
- [ ] Add specific personality descriptors for each (please specify)
- [ ] Add specific lifestyle tags for each (please specify)

---

### Question 8: Cross-Gender Matching
**Current matching logic:**
- Casual Man ↔ Spoilt Woman
- Marriage-Minded Man ↔ Safety-First Woman

**Your answer:**
- [ ] This matching logic is good, keep as-is
- [ ] Adjust matching logic (please specify)
- [ ] Allow all archetypes to match with each other
- [ ] Create custom matching rules (please specify)

---

### Question 9: Female Profile Synthesis
**Current Claude prompt for male profiles:**
- Generates polished about blurb
- Generates refined personality descriptors
- Generates intent statement
- Generates lifestyle tags

**Your answer:**
- [ ] Use same prompt for female profiles
- [ ] Adjust prompt for female profiles (please specify how)
- [ ] Use different prompts per female archetype (please specify)

---

### Question 10: Testing Approach for Female Flow
**Your answer:**
- [ ] Test with mock data first
- [ ] Test with real female users
- [ ] Test all archetype combinations
- [ ] Test error scenarios
- [ ] Do all of the above

---

## QUICK ANSWERS (If you want to go with my recommendations)

Just answer with these if you want to use my defaults:

**Stage 2:**
- Q1: Keep scenes as-is
- Q2: Keep current settings (20 steps, 4 guidance, 1.0 id_weight)
- Q3: Retry failed photos 1 time automatically
- Q4: Add both progress indicator and loading skeleton
- Q5: Do all testing (1 photo first, different archetypes, error scenarios)

**Stage 4:**
- Q6: Use same questions for all female archetypes
- Q7: Keep archetypes as-is
- Q8: Keep matching logic as-is (Casual ↔ Spoilt, Marriage-Minded ↔ Safety-First)
- Q9: Adjust prompt for female profiles (more emphasis on personality)
- Q10: Do all testing (mock data first, all archetypes, error scenarios)

---

## How to Answer

Just reply with:
1. Your answers to each question (or "use recommendations")
2. Any specific details if you're customizing

Example:
```
Stage 2:
Q1: Keep scenes as-is
Q2: Keep current settings
Q3: Retry 1 time
Q4: Add both progress indicator and loading skeleton
Q5: Do all testing

Stage 4:
Q6: Use same questions for all archetypes
Q7: Keep archetypes as-is
Q8: Keep matching logic as-is
Q9: Adjust prompt for female profiles
Q10: Do all testing
```

---

## Ready?

Once you answer these questions, I'll:
1. Start Stage 2 immediately (setup, testing, optimization, UI polish)
2. Then move to Stage 4 (verification, profile synthesis, discovery, testing)
3. Commit both stages when ready

Let me know! 🚀
