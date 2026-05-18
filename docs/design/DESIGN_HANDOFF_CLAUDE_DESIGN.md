# Verified Vibe — Design Handoff for Figma Mockups

**From:** sreme19 (Product)  
**To:** Claude Design (UX/UI)  
**Project:** Verified Vibe Phase 1 MVP  
**Status:** Ready for Figma Design  
**Timeline:** Design sprint (2-3 weeks)

---

## **Executive Brief**

### **Project Vision**
Build a trust-first dating app for Gen Z where **your profile must be earned**. Users select an archetype, upload verified artifacts (ID, photos, bank statements), and receive a public Trust Score (0-100). Matches only happen between compatible archetypes.

**Positioning:** *"Stop swiping blind. Your intent is verified."*

### **Phase 1 Scope**
- 4 archetypes (Casual Man, Spoilt Woman, Marriage-Minded Man, Safety-First Woman)
- 11 core screens
- 9 distinct user flows (onboarding → discovery → match → chat)
- Dark mode, Gen Z aesthetic, anti-swipe-fatigue design

### **Success Metrics**
- 85%+ profile completion rate (vs. 60% industry average)
- 72-hour return rate: 50%+
- Match quality (lower ghost rate, longer conversations)

---

## **Design System (Finalized)**

### **Color Palette**
```
Primary Background:    #0f172a  (Slate-950)
Secondary Surface:     #1e293b  (Slate-800)
Trust/Verified:        #10b981  (Emerald)
Warning/Needs Action:  #f97316  (Orange)
Error/Failed:          #ef4444  (Red)
Text Primary:          #f1f5f9  (Slate-100)
Text Secondary:        #94a3b8  (Slate-400)
Border:                #334155  (Slate-700)
```

**Usage Rules:**
- Emerald: All success states, verification badges, primary CTAs
- Orange: Pending states, "needs attention" nudges
- Red: Failed verification, errors
- Slate: Neutral surfaces, text, borders

### **Typography**
```
Headlines (H1):     SF Pro Display, 32px bold, #f1f5f9
Section Heads (H2): SF Pro Display, 24px bold, #10b981 (emerald)
Body (P):           -apple-system, 16px regular, #f1f5f9
Small (14px):       -apple-system, 14px regular, #94a3b8
Mono (code):        Monaco, 12px, #cbd5e1
```

### **Spacing & Layout**
```
Padding (sections):     20px / 30px
Margin (blocks):        15px / 20px / 30px
Border radius (cards):  12px
Border radius (buttons): 16px
Button height:          48px (tap target)
Card min width:         120px
```

### **Motion**
```
Transitions:  300ms ease (hover states, modal opens)
Loading:      Spinner (emerald, rotating)
Progress:     Animated bar fill (emerald)
Swipe:        Spring physics, satisfying resistance
```

---

## **11 Screens — Detailed Specifications**

### **Screen 1: Home — Archetype Selector**

**Primary CTA:** User selects 1 of 4 archetypes

**Visual Hierarchy:**
```
Hero Section (top 30%):
- Headline: "Verified Vibe" (32px bold, emerald gradient optional)
- Subheading: "Trust First" (16px, slate-400)
- Instruction: "What brings you here?" (18px bold)
- Secondary text: "Pick the one that's you" (14px, slate-400)

Archetype Cards (70%):
- 4 cards, stacked vertically (mobile), grid 2×2 (tablet+)
- Each card: 120px height, 100% width
- Border: 1px solid #334155
- Hover: border → #10b981, slight shadow
- Layout: [Icon 40px] [Title 18px] [Subtitle 14px] [Button]
- Button: "Learn More ↓" (text link, slate-400 → emerald on hover)
```

**Interactions:**
- Tap card → Expand archetype detail modal (OR navigate to archetype learn screen)
- Modal shows: full name, compatible match, what needs to be verified
- "This is Me" CTA → Go to Intent Declaration

**Archetypes:**
1. 🎯 **Casual Man** — "Want casual dating & connection"
2. 💎 **Spoilt Woman** — "Want to be treated like royalty"
3. 💍 **Marriage-Minded Man** — "Looking for serious & forever"
4. 🛡️ **Safety-First Woman** — "Need verified, non-creep vibes"

---

### **Screen 2: Intent Declaration**

**Purpose:** Confirm user understands archetype + what verification entails

**Visual Hierarchy:**
```
Header:
- Title: "You're a [Archetype Name]" (24px bold, emerald)
- Subheading: "Here's what that means on Verified Vibe" (16px, slate-400)

Body (70% of screen):
- 4-5 bullet points explaining:
  • What the archetype means
  • Who they'll match with
  • What they'll need to verify
  • What their profile will show
  • Trust score importance

- Tone: Honest, reassuring, specific (not preachy)
- Formatting: Checkmarks (✓) for positive statements

CTAs (bottom):
- Primary: "[Yes, This is Me]" (full-width, emerald)
- Secondary: "[← Go Back]" (full-width, slate ghost)
```

---

### **Screen 3: Profile Builder — Artifact Checklist**

**Purpose:** Guide through 4-step verification process (ID → Photos → Bank → Q&A)

**Visual Hierarchy:**
```
Progress Bar (top):
- Linear, full-width, 8px height
- Fill: #10b981, background: #334155
- Animated: 0% → 25% → 50% → 75% → 100%
- Text below: "Complete: X/4 artifacts"

Artifact Items (stacked):
Each item card:
- Height: 100px
- Border: 1px #334155 (locked) or #10b981 (active)
- Opacity: 1.0 (unlocked), 0.5 (locked)
- Layout: [Icon] [Title + Description] [Status/Button]

Status States:
- ✓ Completed: Emerald checkmark, "Verified"
- ⏳ Pending: Orange spinner, "Checking..."
- ✕ Failed: Red X, "Try again" (button)
- ○ Locked: Slate circle, "Locked" (button disabled)

CTA Buttons:
- [Start Upload] (active) — emerald, full-width
- [Locked] (inactive) — slate, disabled opacity
- [Retry] (failed) — orange, full-width
```

**Artifacts (in order):**
1. **Government ID** — "Let's verify you're real. Takes 30 sec"
2. **Bank Statement (3 months)** — "We'll see where you spend on dates"
3. **5+ Photos** — "Prove it's really you. Same person in every shot"
4. **Q&A Responses** — "Answer what matters to you"

---

### **Screen 4: ID + Liveness Check**

**Step 1: ID Upload**

```
Instructions (16px body):
- "Take a clear photo of your:"
  • Passport, driver's license, or national ID
- "Make sure you can see:"
  ✓ Your face (clear & centered)
  ✓ ID number (visible but not blurred)
  ✓ Expiry date (not expired)
  ✓ Security features (holograms)

Upload Zone:
- 200px height, dashed border (#475569)
- Centered, tap to upload or drag-and-drop
- Icon: 📷 (large, 60px, slate-600)
- Hover state: border → #10b981, bg slight highlight
- Text: "📷 Take a Photo (or upload from gallery)"

Privacy Note (small, italicized):
"We'll verify your ID in <60 seconds.
No data is stored — only that you're a real person."
```

**Step 2: Liveness Check**

```
Video Preview:
- Full-width video container, 300px height
- Border: 2px #10b981 (while recording)
- Centered face guide (optional outline)

Instructions:
- Large, bold text (24px): "Tilt your head left"
- Subtext (14px): "(or 'Nod', 'Smile', etc. — randomized)"
- Timer: "⏱️ 3 challenges, ~30 seconds total"

CTA:
- [Start Liveness Check] (full-width, emerald)

Reassurance:
- "Why this? It proves you're not a bot or fake photo."
```

**Step 3: Verifying**

```
State: Loading screen
- Spinner icon (emerald, rotating, 60px)
- Title: "Verifying Your ID..." (24px bold)
- Checklist (animated, items appear):
  ⏳ ID format & authenticity
  ⏳ Face match (ID photo ↔ selfie)
  ⏳ Liveness check (you're real)
- Timing note: "Takes <60 seconds"
```

**Step 4: Success**

```
State: Success screen
- Icon: Large ✓ in emerald circle (80px)
- Title: "✓ ID Verified!" (24px bold, emerald)
- Score: "+35 trust score points" (16px, emerald badge)

What We Verified:
- Checkmark list:
  ✓ Real government ID (not fake)
  ✓ You're a real person (liveness OK)
  ✓ Face matches ID (same person)

Privacy Statement (small, italicized):
"Your ID details are encrypted & private.
No one sees your ID number."

CTA:
- [Next: Photos] (full-width, emerald)
```

---

### **Screen 5: Upload Photos + Face Consistency**

**Step 1: Multi-Photo Upload**

```
Header:
- Title: "Upload Your Photos" (24px bold)
- Requirement: "5+ photos (same person)" (14px, slate-400)
- Progress: "0/5 photos" with linear bar

Instructions:
- Checkboxes (unchecked initially):
  ☐ One casual (t-shirt, everyday)
  ☐ One nice (dressed up)
  ☐ One activity (hobby/outdoor)
  ☐ One with friends (social proof)
  ☐ One close-up (face/smile)
  ☐ (Optional) One more for variety

Explanation:
"Why this? Face recognition checks if it's really you
in every photo."

Upload Zone:
- 200px height, dashed border
- Icon: 📸 (camera)
- Text: "[Add Photos] (drag & drop or tap)"

Thumbnail Gallery (below):
- Grid: 3 columns (mobile), 4 columns (tablet)
- Each: 120×120px, 8px rounded, border #334155
- Status badge (top-right corner, 32px circle):
  ✓ Emerald checkmark ("Verified")
  ⏳ Orange spinner ("Checking...")
  ✕ Red X ("Try again")
- Hover: border → emerald, slight scale
- Long-press: delete option appears
```

**Step 2: Face Consistency Verification**

```
State: Loading checklist
- Spinner (emerald)
- Title: "Verifying Photos..." (24px bold)
- Progress list (animated items):
  ⏳ Photo 1: Checking...
  ✓ Photo 2: Verified
  ⏳ Photo 3: Checking...
  ⏳ Photo 4: Pending
  ⏳ Photo 5: Pending

Timing: "Takes <60 seconds for all photos"
```

**Step 3: Success**

```
State: Success screen
- Icon: ✓ in emerald circle (80px)
- Title: "✓ All Photos Verified!" (24px bold, emerald)
- Score: "+20 trust score points" (emerald badge)

What We Confirmed:
- ✓ Same person in all 5 photos
- ✓ No fake/AI-generated photos
- ✓ Face clearly visible in each

Grooming Signal:
- "Well-groomed ✓"
- "(This helps your trust score)"

CTA:
- [Next: Bank Statement] (full-width, emerald)
```

---

### **Screen 6: Upload Bank Statement + Spending Extraction**

**Step 1: Bank Statement Upload**

```
Explanation:
- Title: "Upload Bank Statement"
- Requirement: "3 months (recent)"

Why Section:
"Why this? It shows where you spend on dating
& experiences (restaurants, travel, activities)."

What We Extract:
- ✓ Dining & restaurants
- ✓ Entertainment & events
- ✓ Travel & experiences
- ✗ NOT your balance or account #
  "(All financial numbers are redacted)"

Privacy Assurance (italicized, slate-400):
"• Your full statement never leaves your phone
 • Account numbers are removed
 • Only we can see the raw file
 • You choose what to show on profile"

Upload Zone:
- 200px height, dashed border
- Icon: 💰
- Text: "[Add Bank Statement (PDF/JPG)]"
```

**Step 2: Extracting Spending Pattern**

```
State: Loading screen
- Spinner (emerald, 60px)
- Title: "Analyzing Your Spending..." (24px bold)
- Checklist (animated):
  ⏳ Restaurants & dining
  ⏳ Entertainment & activities
  ⏳ Travel & experiences
  ⏳ Removing sensitive info

Timing: "Takes <60 seconds"
```

**Step 3: Spending Summary**

```
State: Success screen
- Icon: ✓ in emerald circle (80px)
- Title: "✓ Spending Pattern Verified!" (24px bold, emerald)
- Score: "+25 trust score points" (emerald badge)

Spending Profile (3 months):
- Card format, each spending category:

  🍽️ Dining & Restaurants: $850
     (Frequency: 2-3x/week)
     Venues: Casual, mid-range, occasional upscale

  🎭 Entertainment: $320
     (Events, concerts, movies)

  ✈️ Travel: $1,200
     (Weekend trips, experiences)

Signal: "📊 You invest in dates & experiences
(not cheap, not flashy)"

Privacy Reminder (italicized):
"Your account number, full balances, and salary
transfers are never seen or stored."

Visibility Controls:
- Checkboxes (user controls what shows):
  ☑ Dining (show restaurant spend)
  ☑ Entertainment (show activity spend)
  ☐ Travel (hide travel spend)
- Text: "(User controls visibility per category)"

CTA:
- [Next: Q&A] (full-width, emerald)
```

---

### **Screen 7: Q&A Responses — Intent Consistency**

**For Each Archetype, Different Questions:**

**Casual Man:**
```
Progress: "1/4" with linear bar

Q1: "What does 'casual' mean to you?"
    Placeholder: "Casual dating where both of us know what we want..."
    Char count: (0/300)

Q2: "What are you looking for right now?"
    Placeholder: "Real connection, some chemistry, no games..."

Q3: "How do you treat the people you date?"
    Placeholder: "With respect, honesty, and consideration..."

Q4: "What would be a dealbreaker for you?"
    Placeholder: "Someone who lies or isn't honest..."
```

**Spoilt Woman:**
```
Q1: "What does being 'spoilt' mean to you?"
Q2: "What are you looking for in a date?"
Q3: "What should a guy know about your values?"
Q4: "What's your ideal first date?"
```

**Marriage-Minded Man:**
```
Q1: "What does 'marriage-minded' mean to you?"
Q2: "What are your values in a partner?"
Q3: "Where do you see yourself in 5 years?"
Q4: "How important is building a family?"
```

**Safety-First Woman:**
```
Q1: "What does 'safety-first' mean for you?"
Q2: "What are the biggest red flags you watch for?"
Q3: "How do you decide if someone is trustworthy?"
Q4: "What reassurance do you need early on?"
```

**Text Input Specs:**
- Full-width textarea, 300 char limit
- Placeholder: Real example (not instructive)
- Char count below: "(0/300)" in slate-400

**CTA:**
- [Submit Answers] (full-width, emerald)

---

**Step 2: Checking Consistency**

```
State: Loading screen
- Spinner (emerald, 60px)
- Title: "Checking Your Answers..." (24px bold)
- Subtext: "Are you actually [archetype]? Or are you secretly looking
            for something different? (We're checking for honesty & intent)"
- Timing: "Takes <60 seconds"
```

**Step 3a: Success (Consistent)**

```
State: Success screen
- Icon: ✓ in emerald circle (80px)
- Title: "✓ Your Intent is Clear!" (24px bold, emerald)
- Score: "+10 trust score points" (emerald badge)

What We Found:
- ✓ Honest about what you want
- ✓ Not contradicting yourself
- ✓ Clear on boundaries

Closing: "This helps matches trust you from day one."

CTA:
- [Next: Review Profile] (full-width, emerald)
```

**Step 3b: Warning (Inconsistent)**

```
State: Warning screen
- Icon: ⚠️ (orange)
- Title: "⚠️ Some Inconsistency Detected" (24px bold, orange)
- Background: Slight orange tint

Conflict Explanation:
- "You said: 'Casual dating only'"
- "But also: 'Looking for marriage soon'"
- "Which is it?"

Educational Message:
"Matching people on Verified Vibe means being clear
about intent. Your match depends on your honesty."

Options:
- [Clarify Answers] (edit responses)
- [Change Archetype] (pick different)
- [Keep Answers As-Is] (not recommended, smaller button)
```

---

### **Screen 8: Trust Score Dashboard**

**Layout:**

```
Trust Score Gauge (top 40%):
- Radial or linear gauge visualization
- Center number: "72/100" (large, emerald)
- Circular fill: 72% emerald, rest slate
- Below: "[===== 72% ====]" visual
- Label: "High Trust - Great!"
- Sub-label: "(Top 40% of Casual Men)"

Breakdown (middle 40%):
- 3 category rows, collapsible:

  Identity 🟢 29/35 pts
  ├─ ID verified ✓
  ├─ Liveness check ✓
  └─ Face consistency ✓

  Lifestyle 🟢 38/45 pts
  ├─ Photos verified ✓
  ├─ Spending credible ✓
  └─ Grooming signal ✓

  Intent 🟡 5/20 pts
  ├─ Q&A honesty ✓
  └─ Archetype clarity ⚠️ (needs work)

- Color coding:
  🟢 Green (>80%): Excellent
  🟡 Yellow (50-79%): Needs work
  🔴 Red (<50%): Critical

Improvement Nudges (bottom 20%):
- Card format, specific not generic:
  "➕ Boost 'Intent Clarity'"
  "Your Q&A had some conflict. Clear that up = +5 pts."
  [Edit Q&A]

- Non-judgmental tone ("needs work", not "bad")

Score Impact Explanation:
- "What This Means:"
- "Your score determines match visibility:"
- "72/100 = You're in top tier. Most women will see
           your profile early in feed."
- "Scores below 60 = limited visibility until you improve."

CTAs (bottom):
- [Re-upload Artifacts] (secondary)
- [← Back to Home] (tertiary)
```

---

### **Screen 9: Discovery Feed — Archetype-Filtered**

**Feed Header:**
```
Title: "Discover"
Subtitle: "Casual Men" (or whichever archetype user is)

Compatible Archetypes:
- 🎯 Spoilt Women (primary)
- 💍 Marriage-Minded (if open)

Filters (collapsible):
- [Min Score: 50+] [Distance ▼] [Apply]

Pass Count:
- "You have 10 passes today. Use wisely."
- Visual bar: "[====== 7 used ███░░░░░░░░ 3 left]"
- Explanation: "Passes are limited to prevent fatigue
                and encourage quality matches."
```

**Profile Card (Stack View):**
```
Full-width card, vertically scrollable:

Photo Section (300px height):
- Full-width image, object-fit: cover
- Top-right corner badge:
  🛡️ VERIFIED
  Trust Score: 72/100
  (Emerald background, white text)

Card Bottom (white text overlay on dark gradient):
- Name, age, location
  "Casual Man, 28 · Brooklyn, NY · 2 miles away"

Verified Artifacts:
- "Verified artifacts:"
- "✓ ID verified  ✓ Photos  ✓ Spending"

About Section:
- Small heading: "About him:"
- Quote: "Into hiking, coffee, and real convos"

Spending Signal:
- 🍽️ Dining & date spend:
- "$850/month on experiences"

Interaction Area (bottom):
- Two buttons: [← Pass] [→ Interested]
- Or: "Tap photo for full profile"
```

**Full Profile Expand (on tap):**
```
State: Modal or full-screen view

Header:
- Name, age, location
- Trust Score gauge: 72/100 (green bar)

Trust Breakdown:
- Identity (29/35): ✓ ID verified & liveness, ✓ Real person, ✓ Face consistent
- Lifestyle (38/45): ✓ Photos verified, ✓ Spends on dates, ✓ Well-groomed
- Intent (5/20): ⚠️ Some Q&A inconsistency

About Section:
- "Into hiking, coffee, and real convos. Looking for something casual
  but real. Not here for games."

What He's Looking For:
- "Someone fun, genuine, open to a vibe. Chemistry matters most."

Spending Pattern:
- 🍽️ Dining: $850/month (casual-upscale)
- 🎭 Entertainment: $320/month
- ✈️ Travel: $1,200/month
- "(Signal: Values experiences & dates)"

CTAs:
- [← Back to Cards]
- [← Pass] [→ Interested]
```

---

### **Screen 10: Match Confirmation**

**Visual Style:** Celebratory, playful

```
State: Full-screen celebration

Icon/Animation:
- Large "✨ It's a Match! ✨" heading (32px bold)
- Optional: Confetti animation or celebration emoji

Photo:
- Large circular photo of matched person (200px diameter)
- Border: 2px emerald

Archetype Pairing:
- Visual icons + text:
  "🎯 Casual Man
   +
   💎 Spoilt Woman"

Next Steps:
- "What happens next?"
- Numbered list (3 items):
  1. Start a conversation here (safe app)
  2. Get to know each other
  3. Move to text/meet IRL when ready

Safety Reminder:
- "Safety tip:"
- "Both profiles are verified. If anything feels off,
  report it instantly."
- (Small, reassuring tone)

CTAs (stacked):
- [Send First Message] (full-width, emerald)
- [View Profile Again] (full-width, slate ghost)
```

---

### **Screen 11: Chat with Intent Banner**

**Layout:** Messaging interface with verification focus

```
Header Area:
- Back button, "Messages" title, more menu

INTENT BANNER (sticky below header):
- Background: #1e293b, border-bottom: 2px #10b981
- Layout: Archetype pair + photos + trust scores + actions
  "🎯 Casual Man matched with 💎 Spoilt Woman"
  [Photo] Sarah, 26 · Brooklyn
  "Both verified. Trust score: 72 & 81"
  [Report User] [Video Call]

Message Thread (70%):
- User messages (right): emerald background, white text, rounded
- Match messages (left): slate-700 background, slate-100 text, rounded
- Timestamps (optional): small, slate-500
- Read receipts: small ✓ checkmarks

Sticky Date Proposal Card (in-chat):
- Minimalist card format
- "📅 Suggest a Date"
- Fields:
  When: [Friday evening] [Time: 7 PM]
  Where: [Restaurant/Bar] [Pick place]
  Budget: [$20-50] [Casual vibe]
- CTA: [Send Proposal] (emerald)

Input Area (sticky, bottom):
- Full-width text input
- Placeholder: "Type here..."
- Quick actions: [Emoji] [Photos] [Send →]

Overall Tone:
- Professional but warm
- Focus on intent & safety
- Conversational, not transactional
```

---

## **Component Library — Finalized Specs**

| Component | Specs | Usage |
|-----------|-------|-------|
| **Primary Button** | 48px height, emerald bg, white text, 16px rounded, full-width | "This is Me", "Start", "Send" |
| **Secondary Button** | 48px height, slate-700 bg, slate-100 text, 16px rounded, full-width | "← Back", "Cancel", "Learn More" |
| **Ghost Button** | 48px height, transparent bg, emerald text, 16px rounded, 1px border | "View Profile", "Skip" |
| **Archetype Card** | 120px height, border: 1px #334155, 12px rounded, hover: emerald border | Home screen, swipe cards |
| **Status Badge** | Small pill (6px rounded), emerald ✓ / orange ⏳ / red ✕ | Artifact verification, progress |
| **Trust Score Gauge** | Radial or linear, 0-100, color by performance (green >80%, yellow 50-79%, red <50%) | Trust dashboard, card preview |
| **Progress Bar** | Full-width, 8px height, emerald fill animated | Artifact checklist, Q&A |
| **Text Input** | Full-width, slate-700 border, placeholder examples, char count | Forms, Q&A responses |
| **Textarea** | Full-width, slate-700 border, 300 char limit, placeholder | Q&A, profile description |
| **Intent Banner** | Sticky top or bottom, archetype pairs, trust scores, action buttons | Chat screen |
| **Message Bubble** | Rounded corners, aligned right/left, emerald/slate backgrounds | Chat thread |
| **Modal/Card** | Border: 1px #334155, 12px rounded, slate-800 bg, shadow optional | Expanded profiles, forms |

---

## **Design Handoff Checklist**

### **Figma Deliverables**
- [ ] 11 screen mockups (mobile 375px, tablet 768px, desktop 1280px)
- [ ] Component library (buttons, cards, badges, inputs)
- [ ] Color swatch file
- [ ] Typography styles
- [ ] Interactive prototype (click-through flow)
- [ ] Design specs per screen (spacing, sizing, colors)
- [ ] Responsive breakpoints documented
- [ ] Accessibility notes (WCAG AA contrast verified)
- [ ] Interaction states (hover, focus, active, loading, error)

### **Documentation to Include**
- [ ] Design system overview
- [ ] Component usage guidelines
- [ ] Copy / tone of voice examples
- [ ] Motion/animation specifications
- [ ] Handoff guide for developers

### **Design Review Checklist**
- [ ] Dark mode verified on all screens
- [ ] Gen Z aesthetic confirmed (not clinical, playful)
- [ ] Trust/verification theme consistent (emerald prominently used)
- [ ] Anti-swipe-fatigue positioning clear (daily passes, filters visible)
- [ ] Safety messaging present on key screens
- [ ] Archetype differences clear (different Q&A, copy per archetype)
- [ ] Mobile-first responsive behavior verified
- [ ] Accessibility: 48px tap targets, WCAG AA contrast, keyboard nav support

---

## **Design Questions for Clarification**

1. **Card interaction on discovery feed:** Should swipe left/right trigger immediately, or after 30%+ drag?
2. **Trust score visualization:** Radial gauge (circular) vs. linear bar? Preference?
3. **Photo upload UX:** Should thumbnails appear as they upload, or only after all uploads complete?
4. **Inconsistent Q&A flow:** Should we show which specific questions contradict, or general warning?
5. **Date proposal placement:** In-chat sticky card (current) or separate tab?
6. **Archetype icons:** Use emoji (current) or custom SVG icons? Custom icons would feel more premium.
7. **Privacy reassurance:** Should we show redacted bank statement example? Or just describe what's extracted?
8. **Verification animations:** Should passing verification have celebration animation, or quiet success state?
9. **Daily pass refill:** Should refill time be shown (e.g., "Resets in 4 hours"), or just daily?
10. **Trust score threshold:** Below 60 = hidden. Should we show "improvement path" with estimated score after re-uploads?

---

## **Design Assets Needed**

- [ ] 4 archetype icons (🎯 Casual, 💎 Spoilt, 💍 Marriage, 🛡️ Safety) — custom SVG preferred
- [ ] Verification checkmarks (emerald, 32px)
- [ ] Loading spinners (emerald, animated)
- [ ] Error states (red X icons)
- [ ] Optional: Celebration confetti animation (for match screen)
- [ ] Optional: Custom illustrations for empty states (no matches, no messages, etc.)

---

## **Success Criteria (Design Phase)**

✅ **Design is ready for handoff when:**
- All 11 screens have high-fidelity mockups
- Interactive prototype demonstrates full user flow
- Component library is reusable & complete
- Design system is documented (colors, typography, spacing)
- Accessibility verified (contrast, tap targets, focus states)
- Designer can explain every design decision (why emerald? why this layout?)
- Developer-ready specs (dimensions, fonts, spacing, states)
- Copy/tone is consistent across all screens
- Mobile responsiveness tested at 375px, 768px, 1280px

---

## **Timeline & Milestones**

| Week | Deliverable | Status |
|------|-------------|--------|
| Week 1 | Screens 1-3 (Onboarding) mockups | TBD |
| Week 2 | Screens 4-7 (Verification) mockups | TBD |
| Week 3 | Screens 8-11 (Discovery & Chat) mockups | TBD |
| Week 3 | Component library finalized | TBD |
| Week 4 | Interactive prototype complete | TBD |
| Week 4 | Design specs + handoff docs | TBD |

---

## **Contact & Questions**

**Product Owner:** sreme19  
**Design Lead:** [Claude Design]  
**Figma Link:** [TBD — will be shared once project created]

**Key Questions to Discuss:**
- Color palette preference (emerald as primary trust color — confirmed?)
- Custom icons vs. emoji (looks more premium with custom SVG)
- Animation level (subtle transitions vs. playful celebrations)
- Responsive breakpoints (mobile-first prioritization?)

---

## **Appendix: Design Inspiration & References**

**Aesthetic Targets:**
- Dark mode, Gen Z-friendly (Hinge + Bumble visual language, but premium)
- Trust/verification → emerald accent (not red, not blue)
- Anti-marketplace positioning → emphasis on depth, not swipes
- Playful but serious → balance between fun copy and safety

**UX Patterns to Consider:**
- Tinder card swipe interaction (satisfying, low friction)
- Hinge's "like comment" depth (not just swipes)
- Bumble's safety-first messaging (reassurance tone)
- Stripe's onboarding flows (step-by-step clarity)

**Reference Apps:**
- Hinge (depth-focused profiles)
- Bumble (safety first positioning)
- Stripe (clear onboarding, trust signaling)
- Plaid (verification flows, privacy messaging)

---

**Ready for Figma Design!** 🎨

Detailed wireframes, specifications, and component library above. Designer can use this as a complete brief to start high-fidelity mockups.

Next step: Create Figma project, import wireframes, build component library, iterate on visual design.

Questions? Ping sreme19.
